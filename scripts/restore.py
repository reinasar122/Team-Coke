#!/usr/bin/env python3

import gzip
import os
import shutil
import subprocess
import sys

from common import COMPOSE, die, run, wait_for_db

os.umask(0o077)


def main():
    if shutil.which("docker") is None:
        die("required tool missing: docker")
    if len(sys.argv) != 3 or sys.argv[2] != "--confirm":
        die(f"Usage: {sys.argv[0]} dump.sql.gz --confirm")
    dump = sys.argv[1]
    if not (os.path.isfile(dump) and os.path.getsize(dump) > 0):
        die("invalid or empty dump")
    try:
        with gzip.open(dump, "rb") as gz:
            gz.read(1)
    except OSError:
        die("invalid or empty dump")

    def restart_apps():
        if run(COMPOSE + ["up", "-d", "backend", "nginx"],
                          capture_output=True).returncode != 0:
            print("RESTORE FAILURE: restore completed but application services did not restart",
                  file=sys.stderr)
            return False
        return True

    if run(COMPOSE + ["stop", "backend", "nginx"],
                      capture_output=True).returncode != 0:
        die("could not stop backend/nginx; restore was not started")

    restore_status = 0
    proc = subprocess.run(COMPOSE + ["ps", "-q", "db"], capture_output=True, text=True)
    if not proc.stdout.strip():
        if run(COMPOSE + ["up", "-d", "db"], capture_output=True).returncode != 0:
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
        die("restore failed; database may be partially restored; application services were restarted")
    print("Restore complete. Media is separate and was not restored.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
