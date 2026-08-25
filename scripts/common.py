#!/usr/bin/env python3

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

COMPOSE = ["docker", "compose", "--env-file", ".env", "-f", "compose.yaml"]


def root_path(p):
    p = str(p)
    if os.path.isabs(p):
        return p
    return str(ROOT / p)


def env_value(key):
    proc = subprocess.run(
        COMPOSE + ["config", "--environment"],
        capture_output=True, text=True,
    )
    value = ""
    for line in proc.stdout.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            if k == key:
                value = v
    return value


def die(msg):
    print(f"FAILURE: {msg}", file=sys.stderr)
    sys.exit(1)


def _container_id(service):
    proc = subprocess.run(
        COMPOSE + ["ps", "-q", service],
        capture_output=True, text=True,
    )
    return proc.stdout.strip()


def _inspect_field(container_id, template):
    if not container_id:
        return ""
    proc = subprocess.run(
        ["docker", "inspect", "-f", template, container_id],
        capture_output=True, text=True,
    )
    return proc.stdout.strip()


def wait_for_db(limit=90):
    return wait_for_healthy("db", limit)


def wait_for_service(service, limit=60):
    for _ in range(limit):
        if _inspect_field(_container_id(service), "{{.State.Status}}") == "running":
            return True
        time.sleep(2)
    return False


def wait_for_healthy(service, limit=60):
    for _ in range(limit):
        status = _inspect_field(
            _container_id(service),
            "{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}",
        )
        if status == "healthy":
            return True
        time.sleep(2)
    return False
