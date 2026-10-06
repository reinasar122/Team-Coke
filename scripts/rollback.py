#!/usr/bin/env python3

import os
import subprocess
import sys

from common import COMPOSE, die, env_value, ok, phase, root_path, run
import verify

os.umask(0o077)


def main(state_file=None):
    phase("Starting rollback")
    deployment_dir = root_path(env_value("DEPLOYMENT_DIR"))
    input_path = state_file or (sys.argv[1] if len(sys.argv) > 1 else os.path.join(deployment_dir, "last-known-good"))

    if os.path.isfile(input_path):
        state = {}
        with open(input_path) as f:
            for line in f:
                if "=" in line:
                    k, _, v = line.partition("=")
                    state[k.strip()] = v.strip()
        tag = state.get("IMAGE_TAG", "")
        namespace = state.get("IMAGE_NAMESPACE", "")
        backend = state.get("BACKEND_IMAGE", "")
        nginx = state.get("NGINX_IMAGE", "")
        if not (backend and nginx):
            die("That save file is missing app details. Try another save file.")
    else:
        tag = input_path
        namespace = env_value("IMAGE_NAMESPACE")
        backend = f"{namespace}/coke-backend:{tag}"
        nginx = f"{namespace}/coke-nginx:{tag}"

    if not tag:
        die("I could not find which version to go back to.")
    if run(["docker", "image", "inspect", backend], "Checking old app image",
                      capture_output=True).returncode != 0:
        die(f"I cannot find the old app image {backend}. It may have been deleted.")
    if run(["docker", "image", "inspect", nginx], "Checking old web image",
                      capture_output=True).returncode != 0:
        die(f"I cannot find the old web image {nginx}. It may have been deleted.")

    os.environ["IMAGE_TAG"] = tag
    if namespace:
        os.environ["IMAGE_NAMESPACE"] = namespace
    if run(COMPOSE + ["up", "-d", "--no-build", "--remove-orphans", "--force-recreate", "backend", "nginx"], "Restarting old version",
                      capture_output=True).returncode != 0:
        die("I could not restart the old version. Please check docker logs.")

    if verify.main() == 0:
        ok(f"Rollback done. Back on version {tag}. Data was not changed.")
        return 0
    die("Rollback failed. Data was not changed. Fix it by hand.")


if __name__ == "__main__":
    sys.exit(main())
