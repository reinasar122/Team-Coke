#!/usr/bin/env python3

import json
import re
import subprocess
import sys
import urllib.request

from common import COMPOSE, die, env_value, run, wait_for_healthy, wait_for_service


def _has_volume_mount(compose, service, target):
    cid = subprocess.run(compose + ["ps", "-q", service],
                         capture_output=True, text=True).stdout.strip()
    tpl = '{{range .Mounts}}{{if eq .Destination "%s"}}{{.Type}} {{.Name}}{{end}}{{end}}' % target
    mount = subprocess.run(["docker", "inspect", "-f", tpl, cid],
                           capture_output=True, text=True).stdout
    return mount.startswith("volume")


def main():
    dev = len(sys.argv) > 1 and sys.argv[1] == "dev"
    compose = COMPOSE + (["-f", "compose.dev.yaml"] if dev else [])

    port = env_value("NGINX_PORT")
    if not (port.isdigit() and 1 <= int(port) <= 65535):
        die("invalid NGINX_PORT")

    json_out = subprocess.run(
        compose + ["config", "--format", "json"],
        capture_output=True, text=True,
    ).stdout
    s = json.loads(json_out)["services"]
    if [n for n, v in s.items() if n != "nginx" and v.get("ports")]:
        die("invalid Compose exposure")
    p = s["nginx"]["ports"]
    if not (len(p) == 1 and p[0]["target"] == 80):
        die("invalid Compose exposure")
    if str(p[0]["published"]) != port:
        die("invalid Compose exposure")

    services = ["db", "backend", "nginx"]
    if dev:
        services.append("frontend")
    for service in services:
        if not wait_for_service(service, 45):
            die(f"{service} did not start")
        if not wait_for_healthy(service, 45):
            die(f"{service} did not become healthy")

    for service in services:
        proc = subprocess.run(compose + ["ps", "-q", service],
                              capture_output=True, text=True)
        cid = proc.stdout.strip()
        exposure = subprocess.run(["docker", "port", cid],
                                  capture_output=True, text=True).stdout
        if service == "nginx":
            if not re.search(rf"^80/tcp\s+->\s+.*:{port}$", exposure, re.M):
                die(f"running nginx mapping is not 80/tcp -> {port}")
        else:
            if exposure.strip():
                die(f"{service} has a published port")

    plan = run(
        compose + ["exec", "-T", "backend", "python", "manage.py", "showmigrations", "--plan"],
        capture_output=True, text=True,
    )
    if plan.returncode != 0:
        die("migration plan failed")
    if "[ ]" in plan.stdout:
        die("unapplied migrations")
    if run(
            compose + ["exec", "-T", "backend", "python", "manage.py", "check", "--database", "default"],
            capture_output=True).returncode != 0:
        die("Django DB check failed")
    if run(compose + ["exec", "-T", "nginx", "nginx", "-t"],
                      capture_output=True).returncode != 0:
        die("Nginx syntax failed")
    if subprocess.run(compose + ["exec", "-T", "nginx", "getent", "hosts", "backend"],
                      capture_output=True).returncode != 0:
        die("backend DNS failed")
    if subprocess.run(
            compose + ["exec", "-T", "nginx", "wget", "-q", "-O", "-",
                       "http://backend:8000/admin/login/"],
            capture_output=True).returncode != 0:
        die("backend connectivity failed")

    targets = {"db": "/var/lib/mysql", "backend": "/app/media", "nginx": "/media"}
    for service, target in targets.items():
        if not _has_volume_mount(compose, service, target):
            die(f"{service} is missing named volume mount {target}")
    if not _has_volume_mount(compose, "backend", "/app/staticfiles"):
        die("backend is missing static_data mount")
    if not _has_volume_mount(compose, "nginx", "/static"):
        die("nginx is missing static_data mount")

    base = f"http://127.0.0.1:{port}"
    code, body = _http(base + "/nginx-health")
    if code != 200:
        die(f"nginx-health returned {code}")
    if body.strip() != "ok":
        die("nginx-health body failed")

    for path in ("/coke/", "/coke/not-a-real-route"):
        code, body = _http(base + path)
        if code != 200:
            die(f"CRA HTML failed {path}")
        if '<div id="root"' not in body:
            die(f"CRA root missing {path}")
        if not re.search(r"static/(js|css)/", body):
            die(f"CRA assets missing {path}")
    for path in ("/admin/login/", "/api/"):
        code, _ = _http(base + path)
        if not (str(code).isdigit() and code < 500):
            die(f"{path} returned {code}")

    log_services = ["db", "backend", "nginx"]
    if dev:
        log_services.append("frontend")
    proc = run(
        compose + ["logs", "--tail=50"] + log_services,
        capture_output=True, text=True,
    )
    logs = proc.stdout + proc.stderr
    print("Recent service logs:")
    print(logs, file=sys.stderr)
    if re.search(r"panic|traceback|address already in use|unable to connect|cannot connect|startup failed|exited with code",
                 logs, re.I):
        die("fatal startup pattern found in recent logs")
    print(f"VERIFY SUCCESS: port {port}, exposure, health, CRA, SPA, API/admin, volumes, DB, DNS, migrations, and logs passed.")
    return 0


def _http(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""


if __name__ == "__main__":
    sys.exit(main())
