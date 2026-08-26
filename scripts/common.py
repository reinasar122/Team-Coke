#!/usr/bin/env python3

import os
import subprocess
import sys
import time
from pathlib import Path
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ponytail: ANSI only, no colorama dep - VT ANSI with plain fallback
def _supports_color():
    if os.getenv("NO_COLOR") is not None: return False
    if os.getenv("TERM") == "dumb": return False
    return sys.stdout.isatty() or sys.stderr.isatty()
def _color(code, text): return f"\033[{code}m{text}\033[0m" if _supports_color() else text
def ok(msg): print(f"{_color('32', '[ OK ]')} {msg}")
def info(msg): print(f"{_color('36', '[INFO]')} {msg}")
def passed(msg): print(f"{_color('32', '[PASS]')} {msg}")
def fail(msg): print(f"{_color('31', '[FAIL]')} {msg}", file=sys.stderr)
log_ok=ok; log_info=info; log_pass=passed; log_fail=fail

def run(cmd, **kwargs):
    disp = cmd if isinstance(cmd, str) else " ".join(str(c) for c in cmd)
    info(f"$ {disp}")
    proc = subprocess.run(cmd, **kwargs)
    if proc.returncode == 0:
        ok(f"\u2192 ok ({proc.returncode})")
    else:
        raw = getattr(proc, "stderr", None) or getattr(proc, "stdout", None) or ""
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", "replace")
        err = raw.strip().splitlines()[:1]
        fail(f"\u2192 fail ({proc.returncode})" + (f": {err[0][:120]}" if err and err[0] else ""))
    return proc
log_run = run

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
    print(f"{_color('31', '[FAIL]')} {msg}", file=sys.stderr)
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
