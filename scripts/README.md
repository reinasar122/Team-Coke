# Deployment scripts

Python scripts for deploying, verifying, backing up, restoring, and rolling
back the Docker stack. Run them from the repository root. They read
configuration from `.env` (see `.env.example`).

Requires: python3, Docker with Compose v2, git, curl.

## Scripts

| Script | What it does | Usage |
|---|---|---|
| `preflight.py` | Checks tools, `.env` values, compose config, port, images, nginx syntax, SMTP. Makes no changes. | `python scripts/preflight.py` |
| `deploy.py` | Full production deploy: preflight, DB backup, build images, migrate, create cache table, collect static, recreate services, verify. Rolls back on failure. | `python deploy.py` or `python scripts/deploy.py` |
| `cleanup.py` | Removes temporary deployment files (`*.tmp`). Never touches volumes, data, backups, or logs. | `python scripts/cleanup.py` |
| `verify.py` | Checks the running stack: health, port exposure, CRA/SPA pages, API/admin, volumes, DB, DNS, migrations, logs. | `python scripts/verify.py` |
| `backup.py` | Dumps the database to `BACKUP_DIR` as `database_<timestamp>.sql.gz`, validates it, prunes old backups. | `python scripts/backup.py` |
| `restore.py` | Stops backend/nginx, restores the database from a dump, restarts the app. Media is not restored. | `python scripts/restore.py backups/database_....sql.gz --confirm` |
| `rollback.py` | Recreates backend/nginx from a previous image (last-known-good by default). Database is never changed. | `python scripts/rollback.py` or `python scripts/rollback.py deployments/previous-<sha>.state` |

`common.py` is shared helpers (env lookup, compose wrapper, wait loops) and is
not run directly.

## Typical flow

Production (run from the repository root):

    python deploy.py

`deploy.py` runs preflight, backup, build, migrate, cleanup, and verify itself,
`preflight.py` and `verify.py` are optional standalone checks.

See `DEPLOYMENT.md` for the full deployment guide.
