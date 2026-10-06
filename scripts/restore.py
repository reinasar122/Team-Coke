#!/usr/bin/env python3

import gzip
import os
import shutil
import subprocess
import sys

from common import COMPOSE, die, info, ok, run, wait_for_db, warn

os.umask(0o077)


def main():
    if shutil.which("docker") is None:
        die("Docker is missing. Please install Docker first.")
    if len(sys.argv) != 3 or sys.argv[2] != "--confirm":
        die(f"Please tell me which backup to use, like: {sys.argv[0]} backups/file.sql.gz --confirm")
    dump = sys.argv[1]
    if not (os.path.isfile(dump) and os.path.getsize(dump) > 0):
        die("That backup file is missing or empty. Check the file name.")
    try:
        with gzip.open(dump, "rb") as gz:
            gz.read(1)
    except OSError:
        die("That backup file looks broken. Try another backup.")

    def restart_apps():
        if run(COMPOSE + ["up", "-d", "backend", "nginx"], "Restarting app services",
                          capture_output=True).returncode != 0:
            warn("Data is back, but the app did not restart. Start backend and nginx by hand.")
            return False
        return True

    info("Pausing app services")
    if run(COMPOSE + ["stop", "backend", "nginx"], "Pausing backend and nginx",
                      capture_output=True).returncode != 0:
        die("I could not pause the app. Nothing was restored.")

    restore_status = 0
    proc = subprocess.run(COMPOSE + ["ps", "-q", "db"], capture_output=True, text=True)
    if not proc.stdout.strip():
        if run(COMPOSE + ["up", "-d", "db"], "Starting database", capture_output=True).returncode != 0:
            restore_status = 1
    if restore_status == 0:
        if not wait_for_db(90):
            restore_status = 1
    if restore_status == 0:
        mysql_cmd = COMPOSE + ["exec", "-T", "db", "sh", "-c",
                               'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"']
        mysql = subprocess.Popen(mysql_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE)
        with gzip.open(dump, "rb") as gz:
            try:
                shutil.copyfileobj(gz, mysql.stdin)
            except BrokenPipeError:
                pass
        mysql.stdin.close()
        mysql.wait()
        if mysql.returncode != 0:
            restore_status = 1
    if not restart_apps():
        restore_status = 1
    if restore_status != 0:
        die("Restore failed. Data may be half restored. App was restarted, please check it.")
    ok("Restore done. Database is back. Uploaded files were not changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
