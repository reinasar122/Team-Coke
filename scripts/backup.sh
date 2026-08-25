#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

for tool in docker gzip df awk date find du mkdir mv chmod; do
    command -v "$tool" >/dev/null || die "required tool missing: $tool"
done

backup_dir=$(root_path "$(env_value BACKUP_DIR)")
retention=$(env_value BACKUP_RETENTION_DAYS)
min=$(env_value BACKUP_MIN_FREE_GB)
[[ "$retention" =~ ^[0-9]+$ ]] || die "BACKUP_RETENTION_DAYS must be numeric"
[[ "$min" =~ ^[0-9]+$ ]] || die "BACKUP_MIN_FREE_GB must be numeric"

mkdir -p -m 700 "$backup_dir"
chmod 700 "$backup_dir"
free=$(df -Pk "$backup_dir" | awk 'NR==2{print $4}')
((free >= min * 1024 * 1024)) || die "insufficient free disk for backup"

id=$("${COMPOSE[@]}" ps -q db 2>/dev/null || true)
if [[ -z "$id" ]]; then
    "${COMPOSE[@]}" up -d db
fi
wait_for_db 90 || die "database did not become healthy"

stamp=$(date +%Y-%m-%d_%H-%M-%S)
tmp="$backup_dir/.database_$stamp.sql.gz.tmp"
file="$backup_dir/database_$stamp.sql.gz"
"${COMPOSE[@]}" exec -T db sh -c \
    'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump --single-transaction --routines --events --triggers -u "$MYSQL_USER" "$MYSQL_DATABASE"' |
    gzip -9 > "$tmp"
chmod 600 "$tmp"
gzip -t "$tmp" && [[ -s "$tmp" ]] || {
    rm -f "$tmp"
    die "backup validation failed"
}
mv "$tmp" "$file"
chmod 600 "$file"
find "$backup_dir" -type f -name 'database_*.sql.gz' -mtime +"$retention" -delete
echo "BACKUP_PATH=$file"
echo "Backup: $file ($(du -h "$file" | awk '{print $1}'))"
