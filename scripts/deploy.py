#!/usr/bin/env python3

import os
import shutil
import subprocess
import sys

from common import COMPOSE, ROOT, die, env_value, root_path, run, wait_for_db
import preflight
import backup
import verify
import rollback

os.umask(0o077)


def main():
    deploy_env = env_value("DEPLOY_ENV")
    if deploy_env.lower() != "production":
        die("DEPLOY_ENV must be production")
    deployment_dir = root_path(env_value("DEPLOYMENT_DIR"))
    os.makedirs(deployment_dir, mode=0o700, exist_ok=True)
    os.chmod(deployment_dir, 0o700)

    tag = run(["git", "rev-parse", "--short=12", "HEAD"],
                         capture_output=True, text=True).stdout.strip()
    os.environ["IMAGE_TAG"] = tag
    if tag in ("dev", "latest") or "CHANGE_ME" in tag:
        die("could not derive a production Git SHA")

    preflight.main()

    state = os.path.join(deployment_dir, f"previous-{tag}.state")
    with open(state, "w") as f:
        f.write(f"IMAGE_TAG={tag}\nIMAGE_NAMESPACE={env_value('IMAGE_NAMESPACE')}\n")
    for service in ("backend", "nginx"):
        proc = run(COMPOSE + ["ps", "-q", service],
                              capture_output=True, text=True)
        cid = proc.stdout.strip()
        if cid:
            image = run(
                ["docker", "inspect", "-f", "{{.Config.Image}}", cid],
                capture_output=True, text=True).stdout.strip()
            digest = run(
                ["docker", "inspect", "-f", "{{index .RepoDigests 0}}", cid],
                capture_output=True, text=True).stdout.strip()
            st = run(
                ["docker", "inspect", "-f", "{{.State.Status}}", cid],
                capture_output=True, text=True).stdout.strip()
            up = service.upper()
            with open(state, "a") as f:
                f.write(f"{up}_IMAGE={image}\n{up}_DIGEST={digest}\n{up}_STATE={st}\n")

    backup_path = backup.main()

    if run(COMPOSE + ["build", "backend", "nginx"],
                      capture_output=True).returncode != 0:
        die("docker compose build failed")
    if run(COMPOSE + ["up", "-d", "db"], capture_output=True).returncode != 0:
        die("docker compose up db failed")
    if not wait_for_db(90):
        die("database did not become healthy")
    for cmd in (["run", "--rm", "--no-deps", "backend", "python", "manage.py", "migrate", "--noinput"],
                ["run", "--rm", "--no-deps", "backend", "python", "manage.py", "createcachetable", "--database", "default"],
                ["run", "--rm", "--no-deps", "backend", "python", "manage.py", "collectstatic", "--noinput"]):
        if run(COMPOSE + cmd, capture_output=True).returncode != 0:
            die("management command failed")
    if run(COMPOSE + ["up", "-d", "--force-recreate", "backend", "nginx"],
                      capture_output=True).returncode != 0:
        die("docker compose up backend nginx failed")

    if verify.main() == 0:
        current = os.path.join(deployment_dir, "current")
        ns = env_value("IMAGE_NAMESPACE")
        with open(current, "w") as f:
            f.write(f"IMAGE_TAG={tag}\nIMAGE_NAMESPACE={ns}\nBACKUP={backup_path}\n"
                    f"BACKEND_IMAGE={ns}/coke-backend:{tag}\nNGINX_IMAGE={ns}/coke-nginx:{tag}\n")
        shutil.copyfile(current, os.path.join(deployment_dir, "last-known-good"))
        print(f"DEPLOY SUCCESS (state directory: {deployment_dir})")
        return 0

    print("DEPLOY FAILURE: no database restore was attempted; schema changes may require a backward-compatible release or manual restore.",
          file=sys.stderr)
    if os.path.getsize(state) > 0 and _count(state, "_IMAGE=") == 2:
        if rollback.main(state) == 0:
            print("Application rollback succeeded; database remains unchanged.", file=sys.stderr)
        else:
            print("APPLICATION ROLLBACK FAILED: preserve logs and recover manually; database remains unchanged.",
                  file=sys.stderr)
    else:
        run(COMPOSE + ["stop", "backend", "nginx"],
                       capture_output=True)
        print("No complete prior state; stopped only backend/nginx.", file=sys.stderr)
    return 1


def _count(path, needle):
    n = 0
    with open(path) as f:
        for line in f:
            if needle in line:
                n += 1
    return n


if __name__ == "__main__":
    sys.exit(main())
