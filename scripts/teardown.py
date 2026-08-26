#!/usr/bin/env python3

import os
import shutil
import subprocess
import sys

from common import COMPOSE, ROOT, die, env_value, root_path, run

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
    if wipe:
        print("WARNING: --volumes wipes DB (mysql_data, media_data, static_data); ensure backup exists.", file=sys.stderr)
    cmd = COMPOSE + ["down"] + (["-v"] if wipe else [])
    proc = run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        die(f"docker compose down failed: {(proc.stderr or proc.stdout).strip()}")
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
            if run(["docker", "image", "inspect", img], capture_output=True).returncode == 0:
                run(["docker", "rmi", img], capture_output=True)
    if wipe:
        print("TEARDOWN SUCCESS: stack removed, volumes wiped - system clean like never deployed")
    else:
        print("TEARDOWN SUCCESS: stack removed, volumes kept")
    print("Backups/deployments kept for audit. To wipe fully: rm -rf deployments backups", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
