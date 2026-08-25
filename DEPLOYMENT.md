# Coke Docker deployment

## Quick Start

### 1. Prerequisites

Install Docker Desktop (or Engine with Compose v2), Git, curl, gzip, and Python 3.

### 2. Set up the environment

```bash
cp .env.example .env
mkdir -p backups deployments
```

Edit `.env` and replace every placeholder:

- `SECRET_KEY` — random string, at least 50 characters
- `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` — database passwords
- `ALLOWED_HOSTS` — your domain or server IP (no wildcards)
- `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` — your site origin
- `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `DEFAULT_FROM_EMAIL` — real SMTP account
- Keep `DEBUG=false` and `CORS_ALLOW_ALL_ORIGINS=false`

### 3. Deploy (production)

```bash
python scripts/deploy.py
```

That is the whole deploy. `deploy.py` runs everything in order:
preflight checks, database backup, image build, migrations, static files,
service restart, and verification. If verification fails it rolls back to
the last-known-good images. It derives the image tag from the current Git
commit automatically.

`preflight.py` and `verify.py` are optional standalone checks — run them
separately only if you want to inspect before or after a deploy.

### 4. Open the app

Visit `http://SERVER_IP:8080/coke/` (port comes from `NGINX_PORT`).

### 5. Day-to-day operations

```bash
python scripts/backup.py                                        # database backup
python scripts/restore.py backups/database_....sql.gz --confirm # restore database
python scripts/rollback.py                                      # back to last-known-good images
```

### Development mode

```bash
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d
python scripts/verify.py dev
```

Dev mode adds a hot-reloading frontend container. On a fresh database, run
migrations once:

```bash
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml exec backend python manage.py migrate
```

### Troubleshooting

- **`Access denied for user 'coke'`** — the MySQL volume keeps the old password
  when `.env` changes. Update it in the running DB with `ALTER USER`, or delete
  the `mysql_data` volume (this wipes the database).
- **HTTP 400 from the backend** — `ALLOWED_HOSTS` must include `backend,nginx`
  (the verify script checks the backend through Docker DNS).
- **Emails not sending** — SMTP values in `.env` are still placeholders.

---

## Evidence and architecture

This repository has a Django project (`backend_coke_system`) with WSGI
`backend_coke_system.wsgi:application`, and a CRA project
(`frontend_coke_system`) whose Router basename is `/coke/`. Existing URLs are
`/api/`, `/admin/`, and `/media/`. The settings use MySQL, a database cache
table `otp_cache_table`, `/app/media`, and `/app/staticfiles`; no Redis,
Celery, or Channels runtime is deployed despite `channels`, `channels_redis`,
and `redis` appearing in `requirements.txt`.

The Dockerfiles accept configurable base-image build args; the repository
does not pin immutable image digests. The chosen defaults are Python
`3.12-slim-bookworm`, Node `22-bookworm-slim`, MySQL `8.4`, and Nginx
`1.27.5-alpine`. These are operator-chosen defaults rather than versions
discovered from the source, so they can be upgraded independently.

Production services are `nginx`, `backend`, and `db` only. Nginx is the only
service with a host port, `${NGINX_PORT}:80`, and uses Compose DNS names. Its
image builds CRA with `npm ci`, `REACT_APP_API_BASE=/api`, and `PUBLIC_URL=/coke`;
all env files, including tracked `.env.production`, are excluded from the
build context. It serves `/coke/` with SPA fallback to `/coke/index.html`,
redirects `/coke` to `/coke/`, proxies `/api/` and `/admin/` without stripping
prefixes, and serves read-only shared `/media/` and `/static/` volumes.
The root URL `/` also redirects to `/coke/`, so
`http://SERVER_IP:${NGINX_PORT}` is the documented entry point.

Development adds CRA internally on port 3000 with source and node_modules
mounts. CRA uses Node's built-in `fetch` health check. Dev Nginx proxies
`/coke/` to `frontend:3000`, forwards websocket upgrade headers, and still
proxies API/admin to the backend. Use Nginx, never direct app ports.

## Dependencies and runtime

Backend package manager is pip; dependencies are pinned in
`backend_coke_system/requirements.txt`. Major existing dependencies: Django
5.1.7, djangorestframework 3.15.2, djangorestframework-simplejwt 5.5.1,
django-cors-headers 4.7.0, mysqlclient 2.2.7, PyMySQL 1.1.1, pandas 2.2.3,
Prophet 1.1.6, and gunicorn 23.0.0. Frontend package manager is npm with
Create React App (`react-scripts` 5.0.1); major existing dependencies:
React 19.1.0, react-router-dom 7.13.1, and axios 1.13.6.

Internal service ports: backend/gunicorn `8000`, CRA dev server `3000`,
MySQL `3306`. External dependencies: Gmail SMTP (`smtp.gmail.com:587` with
TLS) and a browser fallback image CDN used by the existing frontend
application. No Redis or queue runtime is deployed.

## Prerequisites and environment

Install Docker Engine/Desktop with Compose v2, Git, curl, gzip, Python 3
(for preflight checks), and DNS/TCP access to Gmail SMTP. Create the directories
and private environment file:

```bash
cp .env.example .env
mkdir -p backups deployments
```

Replace all template values. `.env.example` is intentionally not deployable:
choose a random `SECRET_KEY`, real database passwords, real SMTP account/app
password, explicit host/origin values, and keep `DEBUG=false` for production.
Production rejects `CHANGE_ME`, `your-account`, `example.com`, wildcards, and
`CORS_ALLOW_ALL_ORIGINS=true`. The actual database default is `cokedb7`.

`BACKUP_DIR`, `DEPLOYMENT_DIR`, `BACKUP_RETENTION_DAYS`, and
`BACKUP_MIN_FREE_GB` control operations. Relative backup/deployment directories
are resolved from the repository root, so custom values such as
`BACKUP_DIR=/srv/coke/backups` and `DEPLOYMENT_DIR=/srv/coke/deployments` are
supported. Gmail uses `smtp.gmail.com:587` with
TLS; the preflight only checks DNS and TCP and never sends mail.

On POSIX hosts, operational scripts use `umask 077`, create backup and
deployment directories with mode 700, and keep SQL temporary/final files
owner-only (600). Windows permission semantics are not asserted.

## Exact commands

Production (these commands are operator-run; this implementation does not run
them automatically):

```bash
export IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
python scripts/preflight.py
python scripts/deploy.py
python scripts/verify.py
docker compose --env-file .env -f compose.yaml ps
```

Development:

```bash
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml build frontend
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up
python scripts/verify.py dev
```

Open `http://127.0.0.1:${NGINX_PORT}/coke/`; the template selects port 8080.
Port checks:

```bash
docker compose --env-file .env -f compose.yaml config
curl -i http://127.0.0.1:${NGINX_PORT}/nginx-health
curl -i http://127.0.0.1:${NGINX_PORT}/coke/
curl -i http://127.0.0.1:${NGINX_PORT}/admin/login/
```

## Port exposure verification

After deployment, confirm only Nginx publishes a host port:

```bash
docker compose --env-file .env -f compose.yaml ps
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Expected result: only the `nginx` container shows `${NGINX_PORT}->80/tcp` in
the PORTS column. The `backend`, `db`, and (in dev mode) `frontend` containers
show no published host ports â€” they are reachable only through Nginx via Compose
DNS. If any other container exposes a host port, the Compose files need
correction; the application should never be accessed directly.

## Deployment behavior and safety

`deploy.py` derives and exports the current 12-character Git SHA (the
`replace-with-git-sha` template value is replaced at runtime). Standalone
production preflight therefore needs the explicit `export IMAGE_TAG=...`
shown above. It runs `docker compose build` to create versioned backend and
Nginx images, preflights without changing services, records exact currently
running backend and Nginx image refs/digests/state, creates a SQL backup,
starts and bounded-waits for MySQL, then runs migrations using fresh one-shot
backend containers:

```text
docker compose run --rm --no-deps backend python manage.py migrate --noinput
docker compose run --rm --no-deps backend python manage.py createcachetable --database default
docker compose run --rm --no-deps backend python manage.py collectstatic --noinput
```

It then recreates backend/Nginx, verifies, and only then writes current and
last-known-good state including the backup path. `createcachetable` failures
are not ignored. Old images are never pruned. The first deployment may create
an empty-db backup; no backup is skipped silently.

Migrations are idempotent. The cache table is created explicitly. The only
seed behavior is a `post_migrate` signal that creates "Van Load" and
"Warehouse" `TransactionType` defaults (see Source changes below); there are
no fixture files, and deployment does not run a separate fixture-loading
step. Tracked media is copied into the backend image and seeds an empty
`media_data` volume; `collectstatic` populates `static_data`. Do not delete
volumes to solve a startup problem.

On failed verification, only backend/Nginx are rolled back when a complete
prior state exists; rollback errors are reported, not hidden. With no prior
state, only backend/Nginx are stopped. Database restore is never automatic.
Because migrations may already have changed schema, releases should remain
backward-compatible; otherwise use an operator-approved manual restore.

## Backup, restore, rollback

```bash
python scripts/backup.py
python scripts/restore.py backups/database_YYYY-MM-DD_HH-mm-ss.sql.gz --confirm
python scripts/rollback.py
python scripts/rollback.py deployments/previous-<sha>.state
python scripts/rollback.py <prior-sha>
```

Backups are atomically written as
`database_YYYY-MM-DD_HH-mm-ss.sql.gz`, gzip-tested, size-checked, retained by
`BACKUP_RETENTION_DAYS`, and dumped through the internal `db` service using
`MYSQL_PWD` plus the application `MYSQL_USER`/`MYSQL_PASSWORD`; credentials
are not process arguments. Backup waits for healthy MySQL and checks free disk
immediately. Restore validates the dump, requires `--confirm`, stops only
backend/Nginx for the maintenance window, restores through internal MySQL,
and restarts the app. Media is separate and is not restored by SQL.

Rollback validates both exact prior backend and Nginx images before running
`up -d --no-build --force-recreate backend nginx`. It never changes or restores
the database and is never called by restore.

## Source changes and limitations

The Docker infrastructure introduced environment-driven backend settings
(`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`, `DB_HOST`), static-root and media handling, and
frontend `REACT_APP_API_BASE=/api` configuration. The one build-blocking
issue found during Docker build was an orphan `/chatbot-devices` route
import in the frontend: the imported component and its backend endpoint did
not exist. This import and route were removed; no speculative replacement
was added. A stale SCSS file (`chatbotdeviceapprovals.scss`) remains but is
not imported.

Docker validation also removed unused `django-bootstrap-v5==1.0.11` and
`djongo==1.3.7` from `requirements.txt`; both conflict with Django 5.1.7 and
no backend usage or import was found.

A `post_migrate` signal on the `TransactionType` model creates "Van Load"
and "Warehouse" defaults via `get_or_create`; this is the only seed
behavior. There are no fixture files, and deployment does not run a
fixture-loading step.

### TLS and security

HTTP is deliberate: no certificate or TLS configuration exists in this
repository. HTTPS should be added with a certificate-owning load balancer or
reviewed Nginx 443 config with secrets mounted outside Git; do not generate
or commit keys here. This Docker setup does not fix pre-existing application
security concerns: `/media/` is publicly served without authentication
(including receipt uploads), and the application has existing logging and
authentication issues that are outside the scope of this infrastructure
change.

If MySQL is unhealthy, inspect `docker compose ... logs db` and credentials.
If uploads fail, inspect `/app/media` volume permissions. If the frontend has
the old LAN API URL, rebuild and confirm no `.env.production` entered the
Nginx context. If the port is busy, change `NGINX_PORT` or stop its owner;
preflight permits only the already-running project Nginx to own that same
port. `/api/` may legitimately return 404 at its root, but must not return a
5xx during verification.
