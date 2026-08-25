#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

get() { env_value "$1"; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

check_tools() {
    [[ -f .env ]] || die ".env is missing"
    for tool in bash git curl gzip df awk sed; do
        command -v "$tool" >/dev/null || die "required shell tool missing: $tool"
    done
    command -v docker >/dev/null || die "Docker is missing"
    docker info >/dev/null || die "Docker daemon unavailable"
    docker compose version >/dev/null || die "Compose v2 unavailable"

    docker_version=$(docker version --format '{{.Server.Version}}')
    compose_version=$(docker compose version --short)
    echo "Docker: $docker_version"
    echo "Compose: $compose_version"
}

check_environment() {
    required=(
        IMAGE_NAMESPACE IMAGE_TAG DEPLOY_ENV NGINX_PORT
        PYTHON_IMAGE_TAG NODE_IMAGE_TAG NGINX_IMAGE_TAG MYSQL_IMAGE_TAG
        MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD
        SECRET_KEY DEBUG ALLOWED_HOSTS CORS_ALLOWED_ORIGINS
        CSRF_TRUSTED_ORIGINS CORS_ALLOW_ALL_ORIGINS EMAIL_HOST EMAIL_PORT
        EMAIL_USE_TLS EMAIL_HOST_USER EMAIL_HOST_PASSWORD DEFAULT_FROM_EMAIL
        BACKUP_RETENTION_DAYS BACKUP_MIN_FREE_GB BACKUP_DIR DEPLOYMENT_DIR
    )
    for key in "${required[@]}"; do
        [[ -n "$(get "$key")" ]] || die "$key is empty"
    done

    retention=$(get BACKUP_RETENTION_DAYS)
    min_free=$(get BACKUP_MIN_FREE_GB)
    email_port=$(get EMAIL_PORT)
    [[ "$retention" =~ ^[0-9]+$ ]] || die "BACKUP_RETENTION_DAYS must be numeric"
    [[ "$min_free" =~ ^[0-9]+$ ]] || die "BACKUP_MIN_FREE_GB must be numeric"
    [[ "$email_port" =~ ^[0-9]+$ && $email_port -ge 1 && $email_port -le 65535 ]] || die "EMAIL_PORT must be 1..65535"

    port=$(get NGINX_PORT)
    [[ "$port" =~ ^[0-9]+$ && $port -ge 1 && $port -le 65535 ]] || die "NGINX_PORT must be 1..65535"
    echo "Selected Nginx host port: $port"

    debug=$(lower "$(get DEBUG)")
    env_name=$(lower "$(get DEPLOY_ENV)")
    if [[ "$env_name" != dev && "$env_name" != development ]]; then
        [[ "$debug" == false ]] || die "production DEBUG must be false"
        for key in ALLOWED_HOSTS CORS_ALLOWED_ORIGINS CSRF_TRUSTED_ORIGINS; do
            value=$(get "$key")
            normalized=$(lower "$value")
            [[ "$normalized" != *'*'* ]] || die "$key contains wildcard"
            [[ "$normalized" != *change_me* && "$normalized" != *your-account* && "$normalized" != *example.com* ]] || die "$key contains a template value"
        done
        [[ "$(lower "$(get CORS_ALLOW_ALL_ORIGINS)")" == false ]] || die "production CORS_ALLOW_ALL_ORIGINS must be false"
        for key in MYSQL_PASSWORD MYSQL_ROOT_PASSWORD SECRET_KEY EMAIL_HOST EMAIL_HOST_USER EMAIL_HOST_PASSWORD DEFAULT_FROM_EMAIL; do
            value=$(get "$key")
            normalized=$(lower "$value")
            [[ "$normalized" != *change_me* && "$normalized" != *your-account* && "$normalized" != *example.com* ]] || die "$key contains a placeholder"
        done
        secret=$(get SECRET_KEY)
        [[ ${#secret} -ge 50 ]] || die "production SECRET_KEY must be at least 50 characters"
        [[ "$(lower "$secret")" != django-insecure-dev-change-me ]] || die "production fallback SECRET_KEY is not allowed"
    fi

    if [[ "$env_name" != dev && "$env_name" != development ]]; then
        tag=$(get IMAGE_TAG)
        [[ "$tag" != dev && "$tag" != latest && "$tag" != *CHANGE_ME* ]] || die "production IMAGE_TAG is not identifiable"
    fi
}

check_files_and_disk() {
    for file in compose.yaml compose.dev.yaml nginx/Dockerfile nginx/default.conf nginx/dev.conf \
        backend_coke_system/Dockerfile backend_coke_system/requirements.txt \
        frontend_coke_system/Dockerfile frontend_coke_system/package-lock.json; do
        [[ -f "$file" ]] || die "missing $file"
    done

    backup_dir=$(get BACKUP_DIR)
    deployment_dir=$(get DEPLOYMENT_DIR)
    mkdir -p -m 700 "$backup_dir" "$deployment_dir"
    chmod 700 "$backup_dir" "$deployment_dir"
    [[ -w "$backup_dir" && -w "$deployment_dir" ]] || die "backup/deployment directories are not writable"
    free=$(df -Pk . | awk 'NR==2{print $4}')
    ((free >= min_free * 1024 * 1024)) || die "free disk below threshold"
}

check_compose_and_port() {
    "${COMPOSE[@]}" config >/dev/null || die "invalid Compose configuration"
    json=$("${COMPOSE[@]}" config --format json)
    python_cmd=$(command -v python3 || command -v python || true)
    [[ -n "$python_cmd" ]] || die "python3/python is required"
    "$python_cmd" -c '
import json, sys
x = json.load(sys.stdin)
s = x["services"]
assert not [n for n, v in s.items() if n != "nginx" and v.get("ports")]
p = s["nginx"]["ports"]
assert len(p) == 1 and p[0].get("target") == 80
assert str(p[0].get("published")) == sys.argv[1]
assert {"mysql_data", "media_data", "static_data"}.issubset(x["volumes"])
' "$port" <<<"$json" || die "rendered exposure or configured volumes are invalid"

    if command -v python3 >/dev/null || command -v python >/dev/null; then
        "$python_cmd" -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',$port)); s.close()" 2>/dev/null || {
            id=$("${COMPOSE[@]}" ps -q nginx 2>/dev/null || true)
            published=$(docker inspect -f '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$id" 2>/dev/null || true)
            [[ "$published" == "$port" ]] || die "NGINX_PORT is already in use"
        }
    fi
}

check_images_network_and_nginx() {
    network=$("${COMPOSE[@]}" config --networks 2>/dev/null | awk 'NF{line=$0} END{print line}')
    if [[ -n "$network" ]]; then
        docker network inspect "$network" >/dev/null 2>&1 || echo "Compose network deferred until deploy: $network"
    fi
    for image in "mysql:$(get MYSQL_IMAGE_TAG)" "nginx:$(get NGINX_IMAGE_TAG)" \
        "$(get IMAGE_NAMESPACE)/coke-backend:$(get IMAGE_TAG)" \
        "$(get IMAGE_NAMESPACE)/coke-nginx:$(get IMAGE_TAG)"; do
        docker image inspect "$image" >/dev/null 2>&1 || echo "Image deferred to deploy/build: $image"
    done
    nginx_tag=$(get NGINX_IMAGE_TAG)
    docker run --rm --add-host backend:127.0.0.1 \
        -v "$ROOT/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
        "nginx:$nginx_tag" nginx -t >/dev/null || die "Nginx config syntax failed"
}

check_running_database() {
    if id=$("${COMPOSE[@]}" ps -q db 2>/dev/null) && [[ -n "$id" ]]; then
        [[ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" == healthy ]] || die "running db is not healthy"
        "${COMPOSE[@]}" exec -T db sh -c \
            'export MYSQL_PWD="$MYSQL_PASSWORD"; mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT 1"' \
            >/dev/null || die "running db connectivity failed"
    fi
}

check_smtp_in_production() {
    [[ "$env_name" == dev || "$env_name" == development ]] && return 0
    smtp=$(get EMAIL_HOST)
    if command -v getent >/dev/null; then
        getent hosts "$smtp" >/dev/null || die "SMTP DNS failed"
    else
        "$python_cmd" -c "import socket; socket.gethostbyname('$smtp')" || die "SMTP DNS failed"
    fi
    "$python_cmd" -c "import socket; s=socket.create_connection(('$smtp',int('$(get EMAIL_PORT)')),5); s.close()" || die "SMTP TCP check failed"
}

check_tools
check_environment
check_files_and_disk
check_compose_and_port
check_images_network_and_nginx
check_running_database
check_smtp_in_production
echo "PREFLIGHT SUCCESS (no production services were started, stopped, or recreated)."
