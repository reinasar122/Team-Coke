# Deployment scripts

Bash scripts for deploying, verifying, backing up, restoring, and rolling
back the Docker stack. Run them from the repository root. They read
configuration from `.env` (see `.env.example`).

Requires: bash, Docker with Compose v2, git, curl, gzip, python3.

## Scripts

| Script | What it does | Usage |
|---|---|---|
| `preflight.sh` | Checks tools, `.env` values, compose config, port, images, nginx syntax, SMTP. Makes no changes. | `bash scripts/preflight.sh` |
| `deploy.sh` | Full production deploy: preflight, DB backup, build images, migrate, create cache table, collect static, recreate services, verify. Rolls back on failure. | `bash scripts/deploy.sh` |
| `verify.sh` | Checks the running stack: health, port exposure, CRA/SPA pages, API/admin, volumes, DB, DNS, migrations, logs. | `bash scripts/verify.sh` (add `dev` for the dev stack) |
| `backup.sh` | Dumps the database to `BACKUP_DIR` as `database_<timestamp>.sql.gz`, validates it, prunes old backups. | `bash scripts/backup.sh` |
| `restore.sh` | Stops backend/nginx, restores the database from a dump, restarts the app. Media is not restored. | `bash scripts/restore.sh backups/database_....sql.gz --confirm` |
| `rollback.sh` | Recreates backend/nginx from a previous image (last-known-good by default). Database is never changed. | `bash scripts/rollback.sh` or `bash scripts/rollback.sh deployments/previous-<sha>.state` |

`common.sh` is shared helpers (env lookup, compose wrapper, wait loops) and is
not run directly.

## Typical flow

Production:

    bash scripts/deploy.sh

`deploy.sh` runs preflight, backup, build, migrate, and verify itself.
`preflight.sh` and `verify.sh` are optional standalone checks.

Development:

    docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d
    bash scripts/verify.sh dev

See `DEPLOYMENT.md` for the full deployment guide.
