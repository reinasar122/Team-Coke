# Team-Coke

Coca-Cola sales and inventory system. Django REST backend in
`backend_coke_system/` and a React (Create React App) frontend in
`frontend_coke_system/`, backed by MySQL.

Both run modes are independent: pick one, or run them side by side.

## Run with Docker (production-style stack)

Needs Docker with Compose v2. The stack is MySQL + Gunicorn + Nginx.

1. Copy `.env.example` to `.env` and replace every `CHANGE_ME` value.
2. From the repository root: `python deploy.py`

See `DEPLOYMENT.md` for the full guide and `scripts/README.md` for backups,
restore, and rollback.

## Run without Docker (local development)

Needs Python 3.12, Node 18+ (20 or 22 recommended), and a local MySQL 8.

### 1. Database

```sql
CREATE DATABASE cokedb7 CHARACTER SET utf8mb4;
```

### 2. Backend

```powershell
cd backend_coke_system
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env    # then edit DB_USER/DB_PASSWORD if needed
python manage.py migrate
python manage.py createcachetable
python manage.py runserver 8000
```

`migrate` seeds an Admin role, a "Main Warehouse", and the default admin
account. `createcachetable` is required for the OTP cache.

### 3. Frontend

```powershell
cd frontend_coke_system
npm install
npm start
```

Open http://localhost:3000/coke (the router basename is `/coke`). The dev
server already targets http://localhost:8000/api.

### First login

Email/phone login uses the phone number `09179902969` with password
`admin123`. The app forces a password change on first login, and newly
registered users need approval from an admin before they can sign in.

### Configuration

Local settings live in `backend_coke_system/.env` (see `.env.example`).
Django reads it only when running outside Docker; real environment variables
always take precedence, and Docker never sees this file. The root `.env`
belongs to the Docker/compose workflow.

## Running both at once

The modes do not collide: local dev uses ports 3000 and 8000, the Docker
stack uses the `NGINX_PORT` from `.env` (default 8080), and the compose
database is not published to the host, so your local MySQL on 3306 stays
free. Each mode uses its own database.
