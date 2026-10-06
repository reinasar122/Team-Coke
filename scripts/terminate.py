#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

from common import COMPOSE, ROOT, die, run

os.umask(0o077)


def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print(f"Usage: {sys.argv[0]} --confirm [--volumes|--wipe-data]")
        print("  --confirm required; --volumes/--wipe-data also removes named volumes")
        return 0
    if "--confirm" not in sys.argv:
        die(f"Usage: {sys.argv[0]} --confirm [--volumes|--wipe-data]")
    wipe = "--volumes" in sys.argv or "--wipe-data" in sys.argv
    if shutil.which("docker") is None:
        die("required tool missing: docker")
    compose = COMPOSE
    for svc in ["nginx", "backend", "db"]:
        q = subprocess.run(compose + ["ps", "-q", svc], capture_output=True, text=True)
        if not q.stdout.strip():
            continue
        print(f"Stopping {svc}...")
        r = run(compose + ["stop", svc], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"warning: stop {svc} failed: {(r.stderr or r.stdout).strip()}", file=sys.stderr)
    if wipe:
        print("WARNING: --volumes wipes DB (mysql_data, media_data, static_data); ensure backup exists.", file=sys.stderr)
    cmd = compose + ["down"] + (["-v"] if wipe else [])
    proc = run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        die(f"docker compose down failed: {(proc.stderr or proc.stdout).strip()}")
    print("TERMINATE SUCCESS: stack terminated in reverse order (nginx -> backend -> db)")
    if wipe:
        print("TERMINATE SUCCESS: volumes wiped - system clean like never deployed")
    else:
        print("TERMINATE SUCCESS: volumes kept")
    print("Backups/deployments kept for audit. To wipe fully: rm -rf deployments backups", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
