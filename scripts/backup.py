#!/usr/bin/env python3

import gzip
import os
import shutil
import subprocess
import time
from datetime import datetime

from common import COMPOSE, die, env_value, info, ok, root_path, run, wait_for_db

os.umask(0o077)


def main():
    if shutil.which("docker") is None:
        die("Docker is missing. Please install Docker first.")

    backup_dir = root_path(env_value("BACKUP_DIR"))
    retention = env_value("BACKUP_RETENTION_DAYS")
    min_free = env_value("BACKUP_MIN_FREE_GB")
    if not retention.isdigit():
        die("BACKUP_RETENTION_DAYS should be a number. Check your .env file.")
    if not min_free.isdigit():
        die("BACKUP_MIN_FREE_GB should be a number. Check your .env file.")

    os.makedirs(backup_dir, mode=0o700, exist_ok=True)
    os.chmod(backup_dir, 0o700)
    free = shutil.disk_usage(backup_dir).free
    if free < int(min_free) * 1024 * 1024 * 1024:
        die("There is not enough free disk space to save a backup.")

    proc = subprocess.run(COMPOSE + ["ps", "-q", "db"], capture_output=True, text=True)
    if not proc.stdout.strip():
        run(COMPOSE + ["up", "-d", "db"], "Starting database", check=False)
    if not wait_for_db(90):
        die("The database did not get ready in time. Check docker logs for db.")

    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    tmp = os.path.join(backup_dir, f".database_{stamp}.sql.gz.tmp")
    file = os.path.join(backup_dir, f"database_{stamp}.sql.gz")

    dump_cmd = COMPOSE + ["exec", "-T", "db", "sh", "-c",
                          'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump --single-transaction --routines --events --triggers -u "$MYSQL_USER" "$MYSQL_DATABASE"']
    dump = run(dump_cmd, "Saving database", capture_output=True)
    if dump.returncode != 0:
        die("Saving the database failed. Check docker logs for db.")
    with open(tmp, "wb") as f:
        with gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=f) as gz:
            gz.write(dump.stdout)
    os.chmod(tmp, 0o600)

    if os.path.getsize(tmp) == 0:
        os.remove(tmp)
        die("The backup file is empty. Nothing was saved.")
    try:
        with gzip.open(tmp, "rb") as gz:
            while gz.read(65536):
                pass
    except Exception:
        os.remove(tmp)
        die("The backup file looks broken. Nothing was saved.")

    os.replace(tmp, file)
    os.chmod(file, 0o600)

    cutoff = time.time() - int(retention) * 86400
    for name in os.listdir(backup_dir):
        if name.startswith("database_") and name.endswith(".sql.gz"):
            path = os.path.join(backup_dir, name)
            if os.path.getmtime(path) < cutoff:
                os.remove(path)

    size = os.path.getsize(file)
    ok(f"Backup done: {file} ({_human(size)})")
    return file


def _human(n):
    for unit in ("B", "K", "M", "G"):
        if n < 1024 or unit == "G":
            return f"{n:.1f}{unit}" if unit != "B" else f"{n}B"
        n /= 1024.0
    return f"{n:.1f}G"


if __name__ == "__main__":
    main()
