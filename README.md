# QLEAN (ShortURLproj)

Shorten URLs, create QR codes, organize a personal library, and view visit statistics.

Live application: [qlean-three.vercel.app](https://qlean-three.vercel.app)

## Features

- Short URLs with optional custom aliases.
- Styled QR codes with PNG downloads.
- Member library with tags, folders, schedules and visit statistics.
- Optional six-digit access codes for member links and QR codes.
- Login using username or email, with one-hour sessions.

## Stack

| Part | Technology | Local port |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, Orval | `3210` |
| Backend | Node.js, Express, TypeScript | `3211` |
| Database | PostgreSQL 16 | `5432` |
| Cache | Redis 7 | `6379` |

## Prerequisites

Install [Node.js 22.x](https://nodejs.org/en/download) with npm,
[Git](https://git-scm.com/downloads), and
[Docker Desktop / Docker Compose v2](https://docs.docker.com/compose/install/).

Commands below run in macOS Terminal, Linux, or Windows WSL2. On Windows,
enable Docker Desktop's WSL2 integration. Start Docker before continuing.

Verify the tools:

```bash
node --version
npm --version
git --version
docker compose version
docker info
```

Ports `3210`, `3211`, `5432`, and `6379` must be available. PostgreSQL and Redis
run in Docker; no separate database installation is needed.

## Installation

The recommended setup runs **PostgreSQL, Redis and Backend in Docker**.
**Frontend runs locally on port 3210, not in Docker.**
Run all commands from the repository root unless stated otherwise.

### 1. Download the Project

```bash
git clone https://github.com/4mpcln/ShortURLproj.git
cd ShortURLproj
```

If already downloaded, open the folder containing `package.json`,
`docker-compose.yml`, `Frontend/`, and `Backend/`.

### 2. Install Dependencies

```bash
npm ci --include=dev
```

This installs both workspaces, including the build tools. Separate installs
inside Frontend and Backend are not needed.

### 3. Configure the Environment

Create the root `.env` without overwriting an existing file:

```bash
cp -n .env.example .env
```

The default ports in that file work with the supplied configuration:

```dotenv
FRONTEND_PORT=3210
BACKEND_PORT=3211
POSTGRES_PORT=5432
REDIS_PORT=6379
JWT_SECRET=
```

Generate a secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `JWT_SECRET` in the root `.env` to the generated value. Keep it private and
reuse it across restarts. If left empty in development, backend restarts sign
out existing sessions. Do not commit real `.env` files or secrets.

No `Backend/.env` or `Frontend/.env` is needed for this Docker setup.
Frontend sends `/api` requests through Vite to `http://localhost:3211`.

### 4. Start Backend and Database Services

```bash
docker compose up -d --build
```

The first run downloads the images, builds Backend and creates persistent
volumes. Backend applies the database migrations automatically before starting;
a separate migration command is not required.

Check that `postgres`, `redis`, and `backend` are healthy:

```bash
docker compose ps
docker compose logs --tail=60 backend
curl -fsS http://localhost:3211/health
```

The health endpoint should return `{"status":"ok"}`. There should be no
frontend container.

### 5. Start Frontend

Open a second terminal in the repository root:

```bash
npm run dev:web
```

Keep the terminal running and open **http://localhost:3210**.
Use `localhost` consistently rather than switching to `127.0.0.1`.

| Address | Purpose |
| --- | --- |
| `http://localhost:3210` | Web application |
| `http://localhost:3211/health` | Backend health check |
| `http://localhost:3211/<code>` | Local short-link redirects |

### 6. Verify the Installation

1. Create a short URL for `https://example.com`, then open the generated link.
   Guests can dismiss the account prompt to continue without logging in.
2. Register with a unique username/email and a password of at least eight
   characters. Log in, create a link or QR code, and check **My library**.
3. Open the item's statistics and test the QR download. Daily statistics can
   take up to five minutes to reflect new visits.

There is no default account; register through the app. Local accounts and data
are separate from production. Logout and session expiration return to the
homepage; sessions expire one hour after login or registration.

## Stop and Restart

Stop Frontend with `Ctrl+C` in its terminal. Stop Docker services with:

```bash
docker compose down
```

This preserves database and encryption-key volumes. **Do not add `-v`** unless
you intend to delete the saved data.

To restart, run `docker compose up -d`, then `npm run dev:web` in another terminal.

## Common Issues

| Problem | Check |
| --- | --- |
| Docker cannot connect | Start Docker Desktop and run `docker info`. |
| Backend is unhealthy | Read `docker compose logs --tail=100 postgres redis backend`; do not delete volumes to fix errors. |
| Port already in use | Stop duplicate dev servers. Keep one Frontend on `3210` and one Backend on `3211`. |
| Login/register cannot reach Backend | Check `/health`. If an existing frontend environment sets `VITE_API_BASE_URL`, clear it and restart Vite to use the proxy. |
| Backend changes are not reflected | Run `docker compose up -d --build --no-deps backend`. Frontend source changes use Vite hot reload. |

For other errors, see [Troubleshooting](docs/DEVELOPMENT.md#troubleshooting).

## Additional Documentation

The installation above is complete; these guides are optional for other workflows:

- [Development](docs/DEVELOPMENT.md): local backend, environment settings, tests, backups and troubleshooting.
- [Vercel and Neon deployment](docs/DEPLOY.md): hosted database, production settings and deployment.
- [Application and API reference](docs/REFERENCE.md): accounts, routes, library behavior and endpoints.
- [DFD Level 0](docs/dfd-level-0.md)
- [ER diagram](docs/er-diagram.md)
