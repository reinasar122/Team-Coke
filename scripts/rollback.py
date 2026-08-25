#!/usr/bin/env python3

import os
import subprocess
import sys

from common import COMPOSE, die, env_value, root_path
import verify

os.umask(0o077)


def main(state_file=None):
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
            die("state lacks both exact application images")
    else:
        tag = input_path
        namespace = env_value("IMAGE_NAMESPACE")
        backend = f"{namespace}/coke-backend:{tag}"
        nginx = f"{namespace}/coke-nginx:{tag}"

    if not tag:
        die("no prior tag/state")
    if subprocess.run(["docker", "image", "inspect", backend],
                      capture_output=True).returncode != 0:
        die(f"missing exact backend image {backend}")
    if subprocess.run(["docker", "image", "inspect", nginx],
                      capture_output=True).returncode != 0:
        die(f"missing exact nginx image {nginx}")

    os.environ["IMAGE_TAG"] = tag
    if namespace:
        os.environ["IMAGE_NAMESPACE"] = namespace
    if subprocess.run(COMPOSE + ["up", "-d", "--no-build", "--force-recreate", "backend", "nginx"],
                      capture_output=True).returncode != 0:
        die("failed to recreate backend/nginx")

    if verify.main() == 0:
        print(f"ROLLBACK SUCCESS to {tag}; database unchanged and not restored.")
        return 0
    print("ROLLBACK FAILURE: database unchanged; manual recovery required.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
