#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

from common import COMPOSE, ROOT, die

os.umask(0o077)


def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print(f"Usage: {sys.argv[0]} --confirm [--volumes|--wipe-data] [--dev]")
        print("  --confirm required; --volumes/--wipe-data also removes named volumes")
        print("  --dev include frontend/dev compose (nginx -> frontend -> backend -> db)")
        return 0
    if "--confirm" not in sys.argv:
        die(f"Usage: {sys.argv[0]} --confirm [--volumes|--wipe-data] [--dev]")
    wipe = "--volumes" in sys.argv or "--wipe-data" in sys.argv
    dev = "--dev" in sys.argv
    if shutil.which("docker") is None:
        die("required tool missing: docker")
    compose = COMPOSE + (["-f", "compose.dev.yaml"] if dev else [])
    for svc in ["nginx", "frontend", "backend", "db"]:
        if svc == "frontend" and not dev:
            continue
        q = subprocess.run(compose + ["ps", "-q", svc], capture_output=True, text=True)
        if not q.stdout.strip():
            continue
        print(f"Stopping {svc}...")
        r = subprocess.run(compose + ["stop", svc], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"warning: stop {svc} failed: {(r.stderr or r.stdout).strip()}", file=sys.stderr)
    if wipe:
        print("WARNING: --volumes wipes DB (mysql_data, media_data, static_data); ensure backup exists.", file=sys.stderr)
    cmd = compose + ["down"] + (["-v"] if wipe else [])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        die(f"docker compose down failed: {(proc.stderr or proc.stdout).strip()}")
    order = "nginx -> frontend -> backend -> db" if dev else "nginx -> backend -> db"
    print(f"TERMINATE SUCCESS: stack terminated in reverse order ({order})")
    if wipe:
        print("TERMINATE SUCCESS: volumes wiped - system clean like never deployed")
    else:
        print("TERMINATE SUCCESS: volumes kept")
    print("Backups/deployments kept for audit. To wipe fully: rm -rf deployments backups", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
