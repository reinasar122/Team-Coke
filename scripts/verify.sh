#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

dev=false
if [[ "${1:-}" == dev ]]; then
    dev=true
    COMPOSE+=( -f compose.dev.yaml )
fi

port=$(env_value NGINX_PORT)
[[ "$port" =~ ^[0-9]+$ && $port -ge 1 && $port -le 65535 ]] || die "invalid NGINX_PORT"

json=$("${COMPOSE[@]}" config --format json)
python_cmd=$(command -v python3 || command -v python || true)
[[ -n "$python_cmd" ]] || die "python required"
"$python_cmd" -c '
import json, sys
s = json.load(sys.stdin)["services"]
assert not [n for n, v in s.items() if n != "nginx" and v.get("ports")]
p = s["nginx"]["ports"]
assert len(p) == 1 and p[0]["target"] == 80
assert str(p[0]["published"]) == sys.argv[1]
' "$port" <<<"$json" || die "invalid Compose exposure"

for service in db backend nginx; do
    wait_for_service "$service" 45 || die "$service did not start"
    wait_for_healthy "$service" 45 || die "$service did not become healthy"
done
if $dev; then
    wait_for_service frontend 45 || die "frontend did not start"
    wait_for_healthy frontend 45 || die "frontend did not become healthy"
fi

for service in db backend nginx; do
    id=$("${COMPOSE[@]}" ps -q "$service")
    exposure=$(docker port "$id" 2>/dev/null || true)
    if [[ "$service" == nginx ]]; then
        grep -Eq "^80/tcp[[:space:]]+->[[:space:]].*:${port}$" <<<"$exposure" || die "running nginx mapping is not 80/tcp -> $port"
    else
        [[ -z "$exposure" ]] || die "$service has a published port"
    fi
done
if $dev; then
    id=$("${COMPOSE[@]}" ps -q frontend)
    [[ -z "$(docker port "$id" 2>/dev/null || true)" ]] || die "frontend has a published port"
fi

plan=$({ "${COMPOSE[@]}" exec -T backend python manage.py showmigrations --plan; }) || die "migration plan failed"
! grep -q '\[ \]' <<<"$plan" || die "unapplied migrations"
"${COMPOSE[@]}" exec -T backend python manage.py check --database default >/dev/null || die "Django DB check failed"
"${COMPOSE[@]}" exec -T nginx nginx -t >/dev/null || die "Nginx syntax failed"
"${COMPOSE[@]}" exec -T nginx getent hosts backend >/dev/null || die "backend DNS failed"
"${COMPOSE[@]}" exec -T nginx wget -q -O - http://backend:8000/admin/login/ >/dev/null || die "backend connectivity failed"

for service in db backend nginx; do
    id=$("${COMPOSE[@]}" ps -q "$service")
    case "$service" in
        db) target=/var/lib/mysql ;;
        backend) target=/app/media ;;
        nginx) target=/media ;;
    esac
    mount=$(docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$target\"}}{{.Type}} {{.Name}}{{end}}{{end}}" "$id")
    [[ "$mount" == volume* ]] || die "$service is missing named volume mount $target"
done
id=$("${COMPOSE[@]}" ps -q backend)
mount=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/staticfiles"}}{{.Type}} {{.Name}}{{end}}{{end}}' "$id")
[[ "$mount" == volume* ]] || die "backend is missing static_data mount"
id=$("${COMPOSE[@]}" ps -q nginx)
mount=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/static"}}{{.Type}} {{.Name}}{{end}}{{end}}' "$id")
[[ "$mount" == volume* ]] || die "nginx is missing static_data mount"

health=$(curl -sS -o /tmp/coke-nginx-health -w '%{http_code}' "http://127.0.0.1:$port/nginx-health") || die "HTTP health failed"
[[ "$health" == 200 ]] || die "nginx-health returned $health"
[[ "$(cat /tmp/coke-nginx-health)" == ok ]] || die "nginx-health body failed"

check_cra() {
    local path=$1 body
    body=$(curl -fsS "http://127.0.0.1:$port$path") || die "CRA HTML failed $path"
    grep -q '<div id="root"' <<<"$body" || die "CRA root missing $path"
    grep -qE 'static/(js|css)/' <<<"$body" || die "CRA assets missing $path"
}
check_cra /coke/
check_cra /coke/not-a-real-route
for path in /admin/login/ /api/; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port$path") || die "HTTP failed $path"
    [[ "$code" =~ ^[0-9]{3}$ && $code -lt 500 ]] || die "$path returned $code"
done

log_services=(db backend nginx)
$dev && log_services+=(frontend)
logs=$("${COMPOSE[@]}" logs --tail=50 "${log_services[@]}" 2>&1)
echo "Recent service logs:"
printf '%s\n' "$logs" >&2
grep -Eiq 'panic|traceback|address already in use|unable to connect|cannot connect|startup failed|exited with code' <<<"$logs" && die "fatal startup pattern found in recent logs" || true
echo "VERIFY SUCCESS: port $port, exposure, health, CRA, SPA, API/admin, volumes, DB, DNS, migrations, and logs passed."
