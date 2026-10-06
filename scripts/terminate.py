#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

from common import COMPOSE, ROOT, die, info, ok, phase, run, warn

os.umask(0o077)


def main():
    phase("Starting terminate")
    if "--help" in sys.argv or "-h" in sys.argv:
        print(f"Usage: {sys.argv[0]} --confirm [--volumes|--wipe-data]")
        print("  --confirm required; --volumes/--wipe-data also removes named volumes")
        return 0
    if "--confirm" not in sys.argv:
        die(f"Please add --confirm, like: {sys.argv[0]} --confirm")
    wipe = "--volumes" in sys.argv or "--wipe-data" in sys.argv
    if shutil.which("docker") is None:
        die("Docker is missing. Please install Docker first.")
    compose = COMPOSE
    info("Stopping services")
    for svc in ["nginx", "backend", "db"]:
        q = subprocess.run(compose + ["ps", "-q", svc], capture_output=True, text=True)
        if not q.stdout.strip():
            continue
        info(f"Stopping {svc}")
        r = run(compose + ["stop", svc], f"Stopping {svc}", capture_output=True, text=True)
        if r.returncode != 0:
            warn(f"Stopping {svc} had a problem: {(r.stderr or r.stdout).strip()}")
    if wipe:
        warn("This will delete your database. Make sure you have a backup.")
    cmd = compose + ["down"] + (["-v"] if wipe else [])
    proc = run(cmd, "Stopping app", capture_output=True, text=True)
    if proc.returncode != 0:
        die(f"Stopping the app failed: {(proc.stderr or proc.stdout).strip()}")
    ok("Terminate done. Stopped in order: web, app, database.")
    if wipe:
        ok("Data folders are now empty.")
    else:
        ok("Data is still saved.")
    info("Backups are still saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
