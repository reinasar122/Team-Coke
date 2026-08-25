#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

deployment_dir=$(root_path "$(env_value DEPLOYMENT_DIR)")
input=${1:-"$deployment_dir/last-known-good"}

if [[ -f "$input" ]]; then
    tag=$(sed -n 's/^IMAGE_TAG=//p' "$input")
    namespace=$(sed -n 's/^IMAGE_NAMESPACE=//p' "$input")
    backend=$(sed -n 's/^BACKEND_IMAGE=//p' "$input")
    nginx=$(sed -n 's/^NGINX_IMAGE=//p' "$input")
    [[ -n "$backend" && -n "$nginx" ]] || die "state lacks both exact application images"
else
    tag=$input
    namespace=$(env_value IMAGE_NAMESPACE)
    backend="$namespace/coke-backend:$tag"
    nginx="$namespace/coke-nginx:$tag"
fi

[[ -n "$tag" ]] || die "no prior tag/state"
docker image inspect "$backend" >/dev/null || die "missing exact backend image $backend"
docker image inspect "$nginx" >/dev/null || die "missing exact nginx image $nginx"

export IMAGE_TAG=$tag
[[ -n "$namespace" ]] && export IMAGE_NAMESPACE=$namespace
"${COMPOSE[@]}" up -d --no-build --force-recreate backend nginx

if "$ROOT/scripts/verify.sh"; then
    echo "ROLLBACK SUCCESS to $tag; database unchanged and not restored."
else
    echo "ROLLBACK FAILURE: database unchanged; manual recovery required." >&2
    exit 1
fi
