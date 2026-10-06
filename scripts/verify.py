#!/usr/bin/env python3

import json
import re
import subprocess
import sys
import urllib.request

from common import COMPOSE, die, env_value, ok, phase, run, wait_for_healthy, wait_for_service


def _has_volume_mount(compose, service, target):
    cid = subprocess.run(compose + ["ps", "-q", service],
                         capture_output=True, text=True).stdout.strip()
    tpl = '{{range .Mounts}}{{if eq .Destination "%s"}}{{.Type}} {{.Name}}{{end}}{{end}}' % target
    mount = subprocess.run(["docker", "inspect", "-f", tpl, cid],
                           capture_output=True, text=True).stdout
    return mount.startswith("volume")


def main():
    compose = COMPOSE
    phase("Running health checks")

    port = env_value("NGINX_PORT")
    if not (port.isdigit() and 1 <= int(port) <= 65535):
        die("The web port in NGINX_PORT looks wrong. Use a number from 1 to 65535.")

    json_out = subprocess.run(
        compose + ["config", "--format", "json"],
        capture_output=True, text=True,
    ).stdout
    s = json.loads(json_out)["services"]
    if [n for n, v in s.items() if n != "nginx" and v.get("ports")]:
        die("Only the web service should open a port. Please check compose.yaml.")
    p = s["nginx"]["ports"]
    if not (len(p) == 1 and p[0]["target"] == 80):
        die("The web service should only open port 80 inside Docker.")
    if str(p[0]["published"]) != port:
        die("The web port does not match NGINX_PORT in your .env file.")

    services = ["db", "backend", "nginx"]
    phase("Checking services")
    for service in services:
        if not wait_for_service(service, 45):
            die(f"The {service} service did not start. Check docker logs for {service}.")
        if not wait_for_healthy(service, 45):
            die(f"The {service} service is not healthy yet. Check docker logs for {service}.")
    ok("Services are running")

    for service in services:
        proc = subprocess.run(compose + ["ps", "-q", service],
                              capture_output=True, text=True)
        cid = proc.stdout.strip()
        exposure = subprocess.run(["docker", "port", cid],
                                  capture_output=True, text=True).stdout
        if service == "nginx":
            if not re.search(rf"^80/tcp\s+->\s+.*:{port}$", exposure, re.M):
                die(f"The web port is not open as 80 to {port}. Please check compose.yaml.")
        else:
            if exposure.strip():
                die(f"The {service} service should not open a port to your computer.")

    plan = run(
        compose + ["exec", "-T", "backend", "python", "manage.py", "showmigrations", "--plan"],
        "Checking database updates",
        capture_output=True, text=True,
    )
    if plan.returncode != 0:
        die("I could not check database updates. Check docker logs for backend.")
    if "[ ]" in plan.stdout:
        die("Some database updates are missing. Run migrate first.")
    if run(
            compose + ["exec", "-T", "backend", "python", "manage.py", "check", "--database", "default"],
            "Checking database connection",
            capture_output=True).returncode != 0:
        die("The app cannot reach its database. Check your DB settings in .env.")
    if run(compose + ["exec", "-T", "nginx", "nginx", "-t"],
           "Checking nginx settings",
                      capture_output=True).returncode != 0:
        die("The web server settings have a mistake. Please check nginx/default.conf.")
    if subprocess.run(compose + ["exec", "-T", "nginx", "getent", "hosts", "backend"],
                      capture_output=True).returncode != 0:
        die("The web service cannot find the app service. Check docker network.")
    if subprocess.run(
            compose + ["exec", "-T", "nginx", "wget", "-q", "-O", "-",
                       "http://backend:8000/admin/login/"],
            capture_output=True).returncode != 0:
        die("The web service cannot reach the app. Check docker logs for backend.")

    targets = {"db": "/var/lib/mysql", "backend": "/app/media", "nginx": "/media"}
    for service, target in targets.items():
        if not _has_volume_mount(compose, service, target):
            die(f"The {service} service lost its saved files at {target}. Check compose.yaml.")
    if not _has_volume_mount(compose, "backend", "/app/staticfiles"):
        die("The app lost its static files folder. Check compose.yaml.")
    if not _has_volume_mount(compose, "nginx", "/static"):
        die("The web service lost its static files folder. Check compose.yaml.")

    base = f"http://127.0.0.1:{port}"
    code, body = _http(base + "/nginx-health")
    if code != 200:
        die(f"The web health page returned {code}. Check docker logs for nginx.")
    if body.strip() != "ok":
        die("The web health page looks wrong. Check docker logs for nginx.")

    for path in ("/coke/", "/coke/not-a-real-route"):
        code, body = _http(base + path)
        if code != 200:
            die(f"The app page {path} did not open. Check docker logs for nginx and backend.")
        if '<div id="root"' not in body:
            die(f"The app page {path} is missing its content. The frontend build may have failed.")
        if not re.search(r"static/(js|css)/", body):
            die(f"The app page {path} is missing its style and script files.")
    for path in ("/admin/login/", "/api/"):
        code, _ = _http(base + path)
        if not (str(code).isdigit() and code < 500):
            die(f"The page {path} has a server error ({code}). Check docker logs for backend.")

    log_services = ["db", "backend", "nginx"]
    phase("Checking app pages")
    proc = run(
        compose + ["logs", "--tail=50"] + log_services,
        "Reading recent service logs",
        capture_output=True, text=True,
    )
    logs = proc.stdout + proc.stderr
    if re.search(r"panic|traceback|address already in use|unable to connect|cannot connect|startup failed|exited with code",
                 logs, re.I):
        die("I found an error in the recent logs. Please check docker logs.")
    ok(f"Health checks done. App is live on port {port}.")
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
