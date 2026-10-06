#!/usr/bin/env python3

import os
import shutil
import subprocess
import sys

from common import COMPOSE, die, env_value, fail, info, ok, phase, root_path, run, wait_for_db, warn
import preflight
import backup
import cleanup
import verify
import rollback

os.umask(0o077)


def main():
    phase("Starting deployment")
    deploy_env = env_value("DEPLOY_ENV")
    if deploy_env.lower() != "production":
        die("This deploy is for production only. Set DEPLOY_ENV to production in .env.")
    deployment_dir = root_path(env_value("DEPLOYMENT_DIR"))
    os.makedirs(deployment_dir, mode=0o700, exist_ok=True)
    os.chmod(deployment_dir, 0o700)

    tag = run(["git", "rev-parse", "--short=12", "HEAD"],
                      "Reading version from git",
                      capture_output=True, text=True).stdout.strip()
    os.environ["IMAGE_TAG"] = tag
    if tag in ("dev", "latest") or "CHANGE_ME" in tag:
        die("I could not find a good version name from git. Please commit your code first.")
    ok(f"Deploying version {tag}")

    preflight.main()

    state = os.path.join(deployment_dir, f"previous-{tag}.state")
    with open(state, "w") as f:
        f.write(f"IMAGE_TAG={tag}\nIMAGE_NAMESPACE={env_value('IMAGE_NAMESPACE')}\n")
    for service in ("backend", "nginx"):
        proc = subprocess.run(COMPOSE + ["ps", "-q", service],
                              capture_output=True, text=True)
        cid = proc.stdout.strip()
        if cid:
            image = subprocess.run(
                ["docker", "inspect", "-f", "{{.Config.Image}}", cid],
                capture_output=True, text=True).stdout.strip()
            digest = subprocess.run(
                ["docker", "inspect", "-f", "{{index .RepoDigests 0}}", cid],
                capture_output=True, text=True).stdout.strip()
            st = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Status}}", cid],
                capture_output=True, text=True).stdout.strip()
            up = service.upper()
            with open(state, "a") as f:
                f.write(f"{up}_IMAGE={image}\n{up}_DIGEST={digest}\n{up}_STATE={st}\n")

    backup_path = backup.main()

    def _fail(reason):
        fail(reason)
        if os.path.getsize(state) > 0 and _count(state, "_IMAGE=") == 2:
            if rollback.main(state) == 0:
                ok("Rollback done. Database was not changed.")
            else:
                fail("Rollback failed. Check the logs and fix it by hand. Database was not changed.")
        else:
            run(COMPOSE + ["stop", "backend", "nginx"], "Stopping backend and nginx",
                           capture_output=True)
            warn("No last working version found, so the app was stopped.")
        info(f"Database backup available at {backup_path} if manual restore is needed.")
        cleanup.main()
        _summary(deployment_dir, tag, backup_path, "FAILED")
        return 1

    phase("Building images")
    if run(COMPOSE + ["pull", "db"], "Pulling base images", capture_output=True).returncode != 0:
        warn("Could not pull latest base images. Using cached images.")
    if run(COMPOSE + ["build", "backend", "nginx"], "Building backend and nginx images",
                      capture_output=True).returncode != 0:
        return _fail("Building the app images failed. Check the error above.")
    phase("Starting services")
    if run(COMPOSE + ["up", "-d", "--remove-orphans", "db"], "Starting database",
                      capture_output=True).returncode != 0:
        return _fail("Starting the database failed. Check docker logs for db.")
    if not wait_for_db(90):
        return _fail("The database did not get ready in time. Check docker logs for db.")
    ok("Database is ready")
    for label, cmd in (("Applying database migrations",
                      ["run", "--rm", "--no-deps", "backend", "python", "manage.py", "migrate", "--noinput"]),
                     ("Creating cache table",
                      ["run", "--rm", "--no-deps", "backend", "python", "manage.py", "createcachetable", "--database", "default"]),
                     ("Collecting static files",
                      ["run", "--rm", "--no-deps", "backend", "python", "manage.py", "collectstatic", "--noinput"])):
        if run(COMPOSE + cmd, label,
               capture_output=True).returncode != 0:
            return _fail(f"Deploy stopped. Failed step: {label}. Check the error above.")
    ok("Database update done")
    if run(COMPOSE + ["up", "-d", "--remove-orphans", "--force-recreate", "backend", "nginx"], "Starting backend and nginx",
                      capture_output=True).returncode != 0:
        return _fail("Starting the app failed. Check docker logs for backend and nginx.")
    ok("Services started")

    if verify.main() == 0:
        current = os.path.join(deployment_dir, "current")
        ns = env_value("IMAGE_NAMESPACE")
        with open(current, "w") as f:
            f.write(f"IMAGE_TAG={tag}\nIMAGE_NAMESPACE={ns}\nBACKUP={backup_path}\n"
                    f"BACKEND_IMAGE={ns}/coke-backend:{tag}\nNGINX_IMAGE={ns}/coke-nginx:{tag}\n")
        shutil.copyfile(current, os.path.join(deployment_dir, "last-known-good"))
        cleanup.main()
        _summary(deployment_dir, tag, backup_path, "SUCCESS")
        ok(f"Deployment complete. Version {tag} is live.")
        return 0

    return _fail("Deploy stopped because the final check failed. Database was not restored.")


def _summary(deployment_dir, tag, backup_path, result):
    phase("Summary")
    ns = env_value("IMAGE_NAMESPACE")
    lines = [
        f"Version: {tag}",
        f"Backup: {backup_path}",
        f"Backend: {ns}/coke-backend:{tag}",
        f"Nginx: {ns}/coke-nginx:{tag}",
    ]
    for line in lines:
        info(line)
    if result == "SUCCESS":
        ok("Result: SUCCESS")
    else:
        fail("Result: FAILED")
    try:
        with open(os.path.join(deployment_dir, f"deploy-{tag}.log"), "w") as f:
            f.write("\n".join(lines + [f"Result: {result}"]) + "\n")
    except OSError:
        warn("Could not write deployment summary file.")


def _count(path, needle):
    n = 0
    with open(path) as f:
        for line in f:
            if needle in line:
                n += 1
    return n


if __name__ == "__main__":
    sys.exit(main())
