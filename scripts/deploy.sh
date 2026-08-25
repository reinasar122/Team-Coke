#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

deploy_env=$(env_value DEPLOY_ENV)
[[ "$(printf '%s' "$deploy_env" | tr '[:upper:]' '[:lower:]')" == production ]] || die "DEPLOY_ENV must be production"
deployment_dir=$(root_path "$(env_value DEPLOYMENT_DIR)")
mkdir -p -m 700 "$deployment_dir"
chmod 700 "$deployment_dir"

tag=$(git rev-parse --short=12 HEAD)
export IMAGE_TAG=$tag
[[ "$tag" != dev && "$tag" != latest && "$tag" != *CHANGE_ME* ]] || die "could not derive a production Git SHA"

"$ROOT/scripts/preflight.sh"

state="$deployment_dir/previous-$tag.state"
printf 'IMAGE_TAG=%s\nIMAGE_NAMESPACE=%s\n' "$tag" "$(env_value IMAGE_NAMESPACE)" > "$state"
for service in backend nginx; do
    id=$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null || true)
    if [[ -n "$id" ]]; then
        printf '%s_IMAGE=%s\n%s_DIGEST=%s\n%s_STATE=%s\n' \
            "${service^^}" "$(docker inspect -f '{{.Config.Image}}' "$id")" \
            "${service^^}" "$(docker inspect -f '{{index .RepoDigests 0}}' "$id" 2>/dev/null || true)" \
            "${service^^}" "$(docker inspect -f '{{.State.Status}}' "$id")" >> "$state"
    fi
done

backup_output=$({ "$ROOT/scripts/backup.sh"; })
backup=$(printf '%s\n' "$backup_output" | sed -n 's/^BACKUP_PATH=//p')
[[ -n "$backup" ]] || die "backup did not return a path"

export IMAGE_TAG=$tag
"${COMPOSE[@]}" build backend nginx
"${COMPOSE[@]}" up -d db
wait_for_db 90 || die "database did not become healthy"
"${COMPOSE[@]}" run --rm --no-deps backend python manage.py migrate --noinput
"${COMPOSE[@]}" run --rm --no-deps backend python manage.py createcachetable --database default
"${COMPOSE[@]}" run --rm --no-deps backend python manage.py collectstatic --noinput
"${COMPOSE[@]}" up -d --force-recreate backend nginx

if "$ROOT/scripts/verify.sh"; then
    current="$deployment_dir/current"
    printf 'IMAGE_TAG=%s\nIMAGE_NAMESPACE=%s\nBACKUP=%s\nBACKEND_IMAGE=%s\nNGINX_IMAGE=%s\n' \
        "$tag" "$(env_value IMAGE_NAMESPACE)" "$backup" \
        "$(env_value IMAGE_NAMESPACE)/coke-backend:$tag" \
        "$(env_value IMAGE_NAMESPACE)/coke-nginx:$tag" > "$current"
    cp "$current" "$deployment_dir/last-known-good"
    echo "DEPLOY SUCCESS (state directory: $deployment_dir)"
else
    echo "DEPLOY FAILURE: no database restore was attempted; schema changes may require a backward-compatible release or manual restore." >&2
    if [[ -s "$state" && $(grep -c '_IMAGE=' "$state") -eq 2 ]]; then
        if "$ROOT/scripts/rollback.sh" "$state"; then
            echo "Application rollback succeeded; database remains unchanged." >&2
        else
            echo "APPLICATION ROLLBACK FAILED: preserve logs and recover manually; database remains unchanged." >&2
        fi
    else
        "${COMPOSE[@]}" stop backend nginx >/dev/null 2>&1 || true
        echo "No complete prior state; stopped only backend/nginx." >&2
    fi
    exit 1
fi
