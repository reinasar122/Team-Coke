#!/usr/bin/env python3

import json
import os
import shutil
import socket
import subprocess
import sys

from common import COMPOSE, ROOT, die, env_value, info, ok, root_path, run, skip

os.umask(0o077)


def _has_template(value):
    return any(t in value.lower() for t in ("change_me", "your-account", "example.com"))


def check_tools():
    if not os.path.isfile(".env"):
        die("I could not find your .env file. Copy .env.example to .env first.")
    for tool in ("git", "curl"):
        if shutil.which(tool) is None:
            die(f"The tool {tool} is missing. Please install it first.")
    if shutil.which("docker") is None:
        die("Docker is missing. Please install Docker first.")
    if run(["docker", "info"], "Checking Docker status", capture_output=True).returncode != 0:
        die("Docker is not running. Please start Docker first.")
    if run(["docker", "compose", "version"], "Checking Compose status", capture_output=True).returncode != 0:
        die("Docker Compose v2 is missing. Please update Docker first.")

    docker_version = run(
        ["docker", "version", "--format", "{{.Server.Version}}"],
        "Checking Docker version",
        capture_output=True, text=True,
    ).stdout.strip()
    compose_version = run(
        ["docker", "compose", "version", "--short"],
        "Checking Compose version",
        capture_output=True, text=True,
    ).stdout.strip()
    info(f"Found Docker version {docker_version}")
    info(f"Found Compose version {compose_version}")


def check_environment():
    required = [
        "IMAGE_NAMESPACE", "IMAGE_TAG", "DEPLOY_ENV", "NGINX_PORT",
        "PYTHON_IMAGE_TAG", "NODE_IMAGE_TAG", "NGINX_IMAGE_TAG", "MYSQL_IMAGE_TAG",
        "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD",
        "SECRET_KEY", "DEBUG", "ALLOWED_HOSTS", "CORS_ALLOWED_ORIGINS",
        "CSRF_TRUSTED_ORIGINS", "CORS_ALLOW_ALL_ORIGINS", "EMAIL_HOST", "EMAIL_PORT",
        "EMAIL_USE_TLS", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD", "DEFAULT_FROM_EMAIL",
        "BACKUP_RETENTION_DAYS", "BACKUP_MIN_FREE_GB", "BACKUP_DIR", "DEPLOYMENT_DIR",
    ]
    for key in required:
        if not env_value(key):
            die(f"{key} is empty")

    retention = env_value("BACKUP_RETENTION_DAYS")
    min_free = env_value("BACKUP_MIN_FREE_GB")
    email_port = env_value("EMAIL_PORT")
    if not retention.isdigit():
        die("BACKUP_RETENTION_DAYS must be numeric")
    if not min_free.isdigit():
        die("BACKUP_MIN_FREE_GB must be numeric")
    if not (email_port.isdigit() and 1 <= int(email_port) <= 65535):
        die("EMAIL_PORT must be 1..65535")

    port = env_value("NGINX_PORT")
    if not (port.isdigit() and 1 <= int(port) <= 65535):
        die("The web port in NGINX_PORT looks wrong. Use a number from 1 to 65535.")
    info(f"We will use web port {port}.")

    debug = env_value("DEBUG").lower()
    env_name = env_value("DEPLOY_ENV").lower()
    if env_name not in ("dev", "development"):
        if debug != "false":
            die("production DEBUG must be false")
        for key in ("ALLOWED_HOSTS", "CORS_ALLOWED_ORIGINS", "CSRF_TRUSTED_ORIGINS"):
            value = env_value(key).lower()
            if "*" in value:
                die(f"{key} contains wildcard")
            if _has_template(value):
                die(f"{key} contains a template value")
        if env_value("CORS_ALLOW_ALL_ORIGINS").lower() != "false":
            die("production CORS_ALLOW_ALL_ORIGINS must be false")
        for key in ("MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD", "SECRET_KEY",
                    "EMAIL_HOST", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD",
                    "DEFAULT_FROM_EMAIL"):
            value = env_value(key).lower()
            if _has_template(value):
                die(f"{key} contains a placeholder")
        secret = env_value("SECRET_KEY")
        if len(secret) < 50:
            die("production SECRET_KEY must be at least 50 characters")
        if env_value("SECRET_KEY").lower() == "django-insecure-dev-change-me":
            die("production fallback SECRET_KEY is not allowed")

    if env_name not in ("dev", "development"):
        tag = env_value("IMAGE_TAG")
        if tag in ("dev", "latest") or "CHANGE_ME" in tag:
            die("production IMAGE_TAG is not identifiable")


def check_files_and_disk():
    for file in ("compose.yaml", "nginx/Dockerfile",
                 "nginx/default.conf",
                 "backend_coke_system/Dockerfile", "backend_coke_system/requirements.txt",
                 "frontend_coke_system/package-lock.json"):
        if not os.path.isfile(file):
            die(f"The file {file} is missing.")

    backup_dir = root_path(env_value("BACKUP_DIR"))
    deployment_dir = root_path(env_value("DEPLOYMENT_DIR"))
    os.makedirs(backup_dir, mode=0o700, exist_ok=True)
    os.makedirs(deployment_dir, mode=0o700, exist_ok=True)
    os.chmod(backup_dir, 0o700)
    os.chmod(deployment_dir, 0o700)
    if not (os.access(backup_dir, os.W_OK) and os.access(deployment_dir, os.W_OK)):
        die("I cannot write to the backup folder. Please check folder rights.")
    min_free = int(env_value("BACKUP_MIN_FREE_GB"))
    free = shutil.disk_usage(ROOT).free
    if free < min_free * 1024 * 1024 * 1024:
        die("There is not enough free disk space for a safe deploy.")


def check_compose_and_port():
    if subprocess.run(COMPOSE + ["config"], capture_output=True).returncode != 0:
        die("The compose file looks wrong. Please check compose.yaml.")
    json_out = subprocess.run(
        COMPOSE + ["config", "--format", "json"],
        capture_output=True, text=True,
    ).stdout
    x = json.loads(json_out)
    s = x["services"]
    if [n for n, v in s.items() if n != "nginx" and v.get("ports")]:
        die("Only the web service should open a port. Please check compose.yaml.")
    p = s["nginx"]["ports"]
    if not (len(p) == 1 and p[0].get("target") == 80):
        die("The web service should only open port 80 inside Docker.")
    if str(p[0].get("published")) != env_value("NGINX_PORT"):
        die("The web port does not match NGINX_PORT in your .env file.")
    if not {"mysql_data", "media_data", "static_data"}.issubset(x["volumes"]):
        die("A needed data folder is missing. Please check compose.yaml.")

    port = int(env_value("NGINX_PORT"))
    try:
        sock = socket.socket()
        sock.bind(("127.0.0.1", port))
        sock.close()
    except OSError:
        proc = subprocess.run(
            COMPOSE + ["ps", "-q", "nginx"],
            capture_output=True, text=True,
        )
        cid = proc.stdout.strip()
        published = ""
        if cid:
            published = subprocess.run(
                ["docker", "inspect", "-f",
                 "{{(index (index .NetworkSettings.Ports \"80/tcp\") 0).HostPort}}",
                 cid],
                capture_output=True, text=True,
            ).stdout.strip()
        if published != env_value("NGINX_PORT"):
            die(f"Port {env_value('NGINX_PORT')} is already in use. Stop the other app or change NGINX_PORT.")


def check_images_network_and_nginx():
    network = subprocess.run(
        COMPOSE + ["config", "--networks"],
        capture_output=True, text=True,
    ).stdout.strip().splitlines()
    if network:
        last = network[-1].strip()
        if last and subprocess.run(
                ["docker", "network", "inspect", last],
                capture_output=True).returncode != 0:
            skip(f"Network {last} will be created during deploy.")
    for image in ("mysql:" + env_value("MYSQL_IMAGE_TAG"),
                  "nginx:" + env_value("NGINX_IMAGE_TAG"),
                  f"{env_value('IMAGE_NAMESPACE')}/coke-backend:{env_value('IMAGE_TAG')}",
                  f"{env_value('IMAGE_NAMESPACE')}/coke-nginx:{env_value('IMAGE_TAG')}"):
        if subprocess.run(["docker", "image", "inspect", image],
                          capture_output=True).returncode != 0:
            skip(f"Image {image} will be built during deploy.")
    nginx_tag = env_value("NGINX_IMAGE_TAG")
    if run(
            ["docker", "run", "--rm", "--add-host", "backend:127.0.0.1",
             "-v", f"{ROOT}/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro",
             f"nginx:{nginx_tag}", "nginx", "-t"],
            "Checking nginx settings",
            capture_output=True).returncode != 0:
        die("The web server settings have a mistake. Please check nginx/default.conf.")


def check_running_database():
    proc = subprocess.run(COMPOSE + ["ps", "-q", "db"], capture_output=True, text=True)
    cid = proc.stdout.strip()
    if cid:
        status = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Health.Status}}", cid],
            capture_output=True, text=True,
        ).stdout.strip()
        if status != "healthy":
            die("The database is running but not healthy yet. Check docker logs for db.")
        if run(
                COMPOSE + ["exec", "-T", "db", "sh", "-c",
                           'export MYSQL_PWD="$MYSQL_PASSWORD"; mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT 1"'],
                "Checking database connection",
                capture_output=True).returncode != 0:
            die("I cannot reach the database. Please check your DB password in .env.")


def check_smtp_in_production():
    env_name = env_value("DEPLOY_ENV").lower()
    if env_name in ("dev", "development"):
        skip("Mail check skipped for dev environment")
        return
    smtp = env_value("EMAIL_HOST")
    try:
        socket.gethostbyname(smtp)
    except OSError:
        die("I cannot find your mail server. Please check EMAIL_HOST in .env.")
    try:
        sock = socket.create_connection((smtp, int(env_value("EMAIL_PORT"))), 5)
        sock.close()
    except OSError:
        die("I cannot reach your mail server. Please check EMAIL_HOST and EMAIL_PORT.")


def main():
    info("Checking prerequisites")
    check_tools()
    ok("Prerequisites done")
    info("Validating environment configuration")
    check_environment()
    check_files_and_disk()
    ok("Environment validation done")
    info("Checking services")
    check_compose_and_port()
    check_images_network_and_nginx()
    check_running_database()
    check_smtp_in_production()
    ok("Service checks done")
    ok("Preflight complete. Ready to deploy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
