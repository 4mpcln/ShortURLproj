# Development Guide

[Back to README](../README.md)

Complete the [local installation](../README.md#installation) first.
All commands below run from the repository root.

## Local Backend With Hot Reload

Use this mode when editing backend TypeScript. Docker runs only PostgreSQL
and Redis; both application servers run locally.

### 1. Stop Docker Backend and Configure the Local Process

```bash
docker compose stop backend
docker compose up -d postgres redis
cp -n Backend/.env.example Backend/.env
```

Set `Backend/.env` to:

```dotenv
NODE_ENV=development
PORT=3211
SHORT_URL_BASE=http://localhost:3211
WEB_ORIGIN=http://localhost:3210
DATABASE_URL=postgres://shorturl:shorturl@localhost:5432/shorturl
REDIS_URL=redis://localhost:6379
JWT_SECRET=
```

Set a stable `JWT_SECRET` using the generation command in README. If published
database/cache ports differ, update the connection URLs. A local process cannot
use Docker service hostnames such as `postgres` or `redis`.
Do not use production credentials for local development or tests.

### 2. Apply Migrations and Start Both Apps

Wait until PostgreSQL is healthy, then run:

```bash
npm run db:migrate
npm run dev
```

Backend uses `tsx watch`; Frontend uses Vite hot reload.
Alternatively run `npm run dev:api` and `npm run dev:web` in separate terminals.
Do not run these alongside `npm run dev`, which would start duplicate servers.
Avoid a plain `docker compose up` in this mode because it also starts Backend.

### 3. Preserve Access-Code Encryption When Switching Modes

Docker and the local backend use different key storage by default. To open
protected links created in Docker, copy its existing key to a private file and
set `ACCESS_CODE_KEY_FILE` in `Backend/.env` to that file's absolute path.
See [Backups](#backups). A newly generated key cannot decrypt existing codes.

## Environment Configuration

### Configuration Locations

| Location | Used by |
| --- | --- |
| Root `.env` | Docker Compose; only variables referenced by `docker-compose.yml` are injected |
| `Backend/.env` | Local backend and migration scripts |
| `Frontend/.env` or `Frontend/.env.local` | Optional Vite configuration; `VITE_` values are public browser code |
| Vercel environment variables | Hosted build and API; Production and Preview are configured separately |
| `.vercel/` | CLI project metadata and optional pulled settings; excluded from Git |

Docker does not load `Backend/.env`; workspace environment files are excluded
from its build. Never put database credentials, `JWT_SECRET`, or
`ACCESS_CODE_KEY` in a `VITE_` variable.

### Backend Variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` for local HTTP; `production` enables Secure cookies |
| `PORT` | Local process port, default `3211`; Docker's internal port remains `3211` |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string; optional on Vercel |
| `JWT_SECRET` | Stable signing secret; at least 32 characters required in production |
| `WEB_ORIGIN` | Frontend origin without a page path; local default `http://localhost:3210` |
| `SHORT_URL_BASE` | Public redirect base; local default `http://localhost:3211`, Vercel default `https://<deployment-domain>` |
| `APP_BASE_URL` | Fallback when `SHORT_URL_BASE` is unset |
| `ACCESS_CODE_KEY` | 32-byte key encoded as 64 hexadecimal characters; required on Vercel |
| `ACCESS_CODE_KEY_FILE` | Local key-file override; otherwise `.data/access-code.key` relative to Backend's working directory |

`SHORT_URL_BASE` must be reachable by visitors; do not use a Docker hostname,
credentials, query parameters or fragments. Member QR codes encode this public
short URL; guest QR codes encode their entered content directly.

### Changing Ports

To publish Docker Backend on `3221`, set `BACKEND_PORT=3221` in the root
`.env`, then run:

```bash
docker compose up -d --build --no-deps backend
```

Change the `/api` proxy target in
[Frontend/vite.config.ts](../Frontend/vite.config.ts) to
`http://localhost:3221`, then restart Vite. Update any explicit
`SHORT_URL_BASE` or `APP_BASE_URL` override as well.

`FRONTEND_PORT` changes Backend's default `WEB_ORIGIN`, not Vite's port.
For Frontend on `3220`, set `FRONTEND_PORT=3220`, recreate Docker Backend,
and run:

```bash
npm exec --workspace Frontend -- vite --host 0.0.0.0 --port 3220 --strictPort
```

For a local backend, update `PORT`, `WEB_ORIGIN`, and `SHORT_URL_BASE` in
`Backend/.env` instead. Keep Vite's proxy consistent and restart processes
after changing their environment.

## Scripts and Tests

### Workspace Scripts

```bash
npm run dev          # local frontend and backend
npm run dev:web      # frontend only
npm run dev:api      # local backend only
npm run db:up        # PostgreSQL only
npm run db:migrate   # database migrations
npm run generate:api # regenerate the Orval client
npm run build        # build both workspaces
npm run lint         # type-check both workspaces
```

Regenerate the API client only after changing
[Backend/openapi.json](../Backend/openapi.json). Review the generated
`Frontend/src/api/generated/shortUrl.ts` changes with the specification.

### Build and Unit Tests

```bash
npm run build
npm run lint
node --test Backend/test/session-expiration.test.mjs Backend/test/vercel-config.test.mjs Backend/test/access-code.test.mjs Backend/test/short-url-base.test.mjs Backend/test/statistics-cache.test.mjs Backend/test/web-origin.test.mjs
node --import tsx --test Frontend/test/*.test.ts
```

Backend unit tests import compiled modules, so build first. Build output is
`Backend/dist/` and `Frontend/dist/`; a frontend build alone does not provide
the API or database.

### Integration Tests

Use a migrated **local** database, healthy API, and Redis for cache tests.
Never point tests at production. Tests create temporary accounts/links and
remove their own fixtures.

```bash
npm --workspace Backend run test:integration
```

The suite shares the API's authentication limiter: 30 attempts per IP in
15 minutes. A full run can return `429`; do not disable the production limiter.
For a focused Docker run, restart only the local Backend, wait for it to be
healthy, then run one file:

```bash
docker compose restart backend
docker compose ps
node --test Backend/test/auth.integration.test.mjs
```

Use a fresh local backend per file when testing several auth-heavy files.
In hot-reload mode, restart the local process instead. Without a stable
`JWT_SECRET`, a restart also signs out local users.

## Maintenance

Frontend updates through Vite. Rebuild Docker Backend after source changes:

```bash
docker compose up -d --build --no-deps backend
docker compose logs --tail=60 backend
```

For root environment changes alone, use
`docker compose up -d --no-deps backend`; `docker compose restart` does not
load changed Compose values. After dependency changes, stop the dev servers,
run `npm ci --include=dev`, rebuild Backend, and restart Frontend.
Back up data before schema changes.

## Backups

Compose volumes `shorturl_postgres_data` and `shorturl_backend_keys` preserve
the database and encryption key. Docker may prefix their names with the project
name. Normal `docker compose down` keeps them; adding `-v` deletes them.

Access codes use AES-256-GCM. **Back up the database and corresponding key**;
ciphertext alone cannot recover protected links. Local Backend defaults to
`Backend/.data/access-code.key`.

With PostgreSQL running and the backend container present:

```bash
umask 077
backup_dir=".data/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
docker compose exec -T postgres pg_dump -U shorturl -d shorturl --no-owner --no-acl > "$backup_dir/shorturl.sql"
docker compose cp backend:/app/Backend/.data/access-code.key "$backup_dir/access-code.key"
chmod 600 "$backup_dir/shorturl.sql" "$backup_dir/access-code.key"
```

The key file is created on first encryption. If no protected links/key exist,
skip the key copy and restrict the SQL file's permissions separately.
`.data/` is excluded from Git; keep a separate secure backup outside the computer.

On Vercel, preserve the hosted database and existing `ACCESS_CODE_KEY`.
Never replace that key during routine redeploys or import a backup over
production without reviewing the destination and matching key.

## Troubleshooting

### Docker or Port Problems

Check `docker info`, then inspect services and logs:

```bash
docker compose ps
docker compose logs --tail=100 postgres redis backend
lsof -nP -iTCP:3210 -sTCP:LISTEN
lsof -nP -iTCP:3211 -sTCP:LISTEN
```

The `lsof` commands apply to macOS/Linux. Stop duplicate app servers in their
original terminals. Vite may choose another port when `3210` is occupied.
Stop Docker Backend before switching to local mode.
Fix migration errors instead of deleting volumes.

### Login/Register Fails

1. Check Backend's health and the Vite proxy target.
2. Use one hostname; clear stale `VITE_API_BASE_URL` overrides and restart Vite.
3. Use `NODE_ENV=development` on local HTTP. Production requires HTTPS,
   a stable `JWT_SECRET`, and a matching `WEB_ORIGIN`.
4. `409` means duplicate username/email, `401` means invalid credentials or
   an expired session, and `429` means too many auth attempts.

Sessions expire one hour after sign-in, regardless of activity. An unset
development JWT secret also causes sign-out after backend restarts.

### Migration 006 Finds Duplicate Accounts

Inspect normalized duplicates without fetching password hashes:

```bash
docker compose exec postgres psql -U shorturl -d shorturl -c "SELECT lower(btrim(name)) AS username, count(*) FROM users GROUP BY 1 HAVING count(*) > 1;"
docker compose exec postgres psql -U shorturl -d shorturl -c "SELECT lower(btrim(email)) AS email, count(*) FROM users GROUP BY 1 HAVING count(*) > 1;"
```

Back up and review affected accounts before renaming and rerunning migrations.
The migration does not silently rename or delete users.

### Protected Links Fail After Switching Backends

Restore the key matching the stored ciphertext. Docker's key, a local key file,
and Vercel's `ACCESS_CODE_KEY` work interchangeably only when they contain the
same 32-byte key. A new key cannot decrypt old access codes.

### Stale Code or Delayed Statistics

Confirm the browser is using local Vite, not the production site. Docker Backend
needs a rebuild after source edits; Vercel needs a new deployment.

Daily aggregates are cached for up to five minutes per owner, link and period.
Editing, pinning, enabling/disabling and deleting invalidate the cache.
Redis outages fall back to PostgreSQL; do not delete visit data to force refreshes.
On Vercel, omit `REDIS_URL` unless a hosted Redis service is available.

For hosted build and routing errors, see
[Deployment troubleshooting](DEPLOY.md#troubleshooting).
