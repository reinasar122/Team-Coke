#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
COMPOSE=(docker compose --env-file .env -f compose.yaml)

root_path() {
    case "$1" in
        /*) printf '%s\n' "$1" ;;
        *) printf '%s/%s\n' "$ROOT" "$1" ;;
    esac
}

env_value() {
    "${COMPOSE[@]}" config --environment 2>/dev/null |
        awk -F= -v key="$1" '$1 == key { value = substr($0, index($0, "=") + 1) } END { print value }'
}

die() { echo "FAILURE: $*" >&2; exit 1; }

wait_for_db() {
    local limit=${1:-60} i=0 id status
    while ((i++ < limit)); do
        id=$("${COMPOSE[@]}" ps -q db 2>/dev/null || true)
        status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' "$id" 2>/dev/null || true)
        [[ "$status" == healthy ]] && return 0
        sleep 2
    done
    return 1
}

wait_for_service() {
    local service=$1 limit=${2:-60} i=0 id status
    while ((i++ < limit)); do
        id=$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null || true)
        status=$(docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || true)
        [[ "$status" == running ]] && return 0
        sleep 2
    done
    return 1
}

wait_for_healthy() {
    local service=$1 limit=${2:-60} i=0 id status
    while ((i++ < limit)); do
        id=$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null || true)
        status=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || true)
        [[ "$status" == healthy ]] && return 0
        sleep 2
    done
    return 1
}
