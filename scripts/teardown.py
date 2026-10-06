#!/usr/bin/env python3

import os
import shutil
import subprocess
import sys

from common import COMPOSE, ROOT, die, env_value, info, ok, root_path, run, warn

os.umask(0o077)


def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print(f"Usage: {sys.argv[0]} --confirm [--volumes|--wipe-data]")
        print("  --confirm required; --volumes/--wipe-data also removes named volumes")
        return 0
    if "--confirm" not in sys.argv:
        die(f"Please add --confirm, like: {sys.argv[0]} --confirm")
    wipe = "--volumes" in sys.argv or "--wipe-data" in sys.argv
    if shutil.which("docker") is None:
        die("Docker is missing. Please install Docker first.")
    if wipe:
        warn("This will delete your database. Make sure you have a backup.")
    info("Stopping app")
    cmd = COMPOSE + ["down"] + (["-v"] if wipe else [])
    proc = run(cmd, "Stopping app", capture_output=True, text=True)
    if proc.returncode != 0:
        die(f"Stopping the app failed: {(proc.stderr or proc.stdout).strip()}")
    tags = set()
    cur = env_value("IMAGE_TAG")
    if cur:
        tags.add(cur.strip())
    ns = env_value("IMAGE_NAMESPACE")
    dep_dir = root_path(env_value("DEPLOYMENT_DIR") or "deployments")
    for name in ("last-known-good", "current"):
        p = os.path.join(dep_dir, name)
        if os.path.isfile(p):
            with open(p) as f:
                for line in f:
                    if "IMAGE_TAG=" in line:
                        _, _, v = line.partition("=")
                        if v.strip():
                            tags.add(v.strip())
    for tag in tags:
        if not tag or tag in ("dev", "latest") or "CHANGE_ME" in tag:
            continue
        for svc in ("coke-backend", "coke-nginx"):
            img = f"{ns}/{svc}:{tag}" if ns else f"local/{svc}:{tag}"
            if run(["docker", "image", "inspect", img], f"Checking image {img}", capture_output=True).returncode == 0:
                run(["docker", "rmi", img], f"Removing image {img}", capture_output=True)
    if wipe:
        ok("Teardown done. App removed and data folders are empty.")
    else:
        ok("Teardown done. App stopped but data is saved.")
    info("Backups are still saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
