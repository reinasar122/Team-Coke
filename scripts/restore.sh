#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
for tool in docker gzip; do command -v "$tool" >/dev/null || die "required tool missing: $tool"; done
[[ $# -eq 2 && "$2" == --confirm ]] || die "Usage: $0 dump.sql.gz --confirm"
dump=$1
[[ -s "$dump" ]] && gzip -t "$dump" || die "invalid or empty dump"

restart_apps() {
    "${COMPOSE[@]}" up -d backend nginx >/dev/null || {
        echo "RESTORE FAILURE: restore completed but application services did not restart" >&2
        return 1
    }
}

"${COMPOSE[@]}" stop backend nginx >/dev/null 2>&1 || die "could not stop backend/nginx; restore was not started"
restore_status=0
if ! id=$("${COMPOSE[@]}" ps -q db 2>/dev/null || true) || [[ -z "$id" ]]; then
    "${COMPOSE[@]}" up -d db || restore_status=1
fi
if ((restore_status == 0)); then
    wait_for_db 90 || restore_status=1
fi
if ((restore_status == 0)); then
    gzip -dc "$dump" | "${COMPOSE[@]}" exec -T db sh -c 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"' || restore_status=1
fi
restart_apps || restore_status=1
((restore_status == 0)) || die "restore failed; database may be partially restored; application services were restarted"
echo "Restore complete. Media is separate and was not restored."
