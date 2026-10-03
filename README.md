# ShortURLproj

Short URL developer test project using React, Node.js, PostgreSQL, and Orval.

## Stack

- Frontend: React + Vite + TypeScript on port `3210`
- Backend: Node.js + Express + TypeScript on port `3211`
- Database: PostgreSQL
- API client mapping: Orval generates React client code from `Backend/openapi.json`

## Project Structure

```text
ShortURLproj/
  Frontend/            # React, Vite, and Orval API client
  Backend/             # Node.js API, OpenAPI spec, and database migrations
  docs/                # DFD and ER diagrams
  docker-compose.yml   # PostgreSQL, Redis and Backend
  package.json         # Shared workspace scripts
```

## Requirements From The Assignment

- Build a Short URL system.
- Use React and Node.js.
- Store data in a database. This project uses PostgreSQL.
- Provide source code in Git and include installation instructions.
- Include diagrams for DFD Level 0 and ER diagram.

## Quick Start

Start Docker Desktop, then run from `ShortURLproj`:

```bash
docker compose up
```

This builds, if needed, and starts PostgreSQL, Redis and Backend. Backend waits for the
database health check and applies migrations before starting. These services do
not need a local Node.js installation. The existing PostgreSQL volume is reused.

Run Frontend locally with Node.js in a separate terminal:

```bash
npm install
npm run dev:web
```

Frontend: http://localhost:3210. Vite serves the current source with hot reload
and proxies `/api` requests to Backend on port 3211. Frontend is not a Docker service.

- Backend health: http://localhost:3211/health
- PostgreSQL: localhost:5432
- Redis: localhost:6379 (loopback only; override with `REDIS_PORT`)

Statistics daily aggregates are cached in Redis for five minutes, separately for
each owner, link and period. Ownership and link metadata are checked on every API
request. The browser reuses visited statistics until the same expiry time; editing,
pinning, enabling/disabling or deleting an item invalidates its cached statistics.
New visits can take up to five minutes to appear in the daily breakdown. A Redis
outage falls back to PostgreSQL. For a local Backend process, set `REDIS_URL` in
`Backend/.env` (default `redis://localhost:6379`); Compose uses `redis://redis:6379`.

Use `docker compose up -d` to run in the background. Use `--build` after changing
Backend source code; Docker runs a compiled Backend build without hot reload.

```bash
docker compose ps                    # inspect service health
docker compose logs -f backend       # read API and migration logs
docker compose down                  # stop services; keep saved database data
```

Keep port 3211 free for Docker's Backend. Frontend's Vite server uses port 3210.
To use a different Backend port (public short URLs follow this port by default):

```bash
BACKEND_PORT=3221 docker compose up -d --build
```

When changing Backend's port, update the `/api` proxy target in
`Frontend/vite.config.ts` to match. `FRONTEND_PORT` only sets Backend's default
`WEB_ORIGIN`; choose Frontend's actual Vite port with its dev command.

Optional Compose settings belong in a `.env` file beside `docker-compose.yml`;
see the root `.env.example`. Backend/Frontend `.env` files are excluded from image
builds. Inside Docker, Backend connects to `postgres:5432`; the browser uses
Vite's same-origin `/api` proxy. `SHORT_URL_BASE` must be reachable by the browser,
not a Docker service name. This Compose configuration uses development-mode auth
for local HTTP; production HTTPS hosting needs secure production configuration.
Without `JWT_SECRET`, restarting Backend invalidates existing login sessions.

Signed-in users can protect URL and QR items with a six-digit access code. Visitors
must enter the code before Backend returns the destination or QR content; rejected
attempts do not count as visits. Library cards show only the protection status,
and the code is returned only by the owner's authenticated statistics endpoint.
Access codes are encrypted with AES-256-GCM. Docker preserves the encryption key
in `shorturl_backend_keys`; a local Backend stores it in `Backend/.data/access-code.key`.
Back up this key together with the database to retain access to protected links.

## Local Development

For hot reload, run PostgreSQL in Docker and the apps locally instead:

```bash
npm install
npm run db:up
npm run db:migrate
npm run generate:api
npm run dev
```

Open the app at:

```text
http://localhost:3210
```

The API runs at:

```text
http://localhost:3211
```

## Environment

Generated short links use `http://localhost:3211/{code}` by default (or the configured port). Set
`SHORT_URL_BASE` in the root `.env` for Docker Compose, or in `Backend/.env` for
local Node.js development, to change this domain. The domain must point
to this backend for generated links to redirect through this project.
For local redirects, use `SHORT_URL_BASE=http://localhost:3211`.
For production, use a domain you control, for example `SHORT_URL_BASE=https://mydomain.com`.
After changing this setting in the root `.env`, run `docker compose up -d backend`
to recreate Backend with the new environment. For local Node.js, restart Backend.
No source change or Frontend rebuild is required.

Backend's `toShortUrl(code)` is the single URL builder. Every API response supplies
`shortUrl`; the UI displays that exact value and uses it for links, Copy and tracked
QR codes. Guest QR codes continue to encode the entered URL or text directly.
`APP_BASE_URL` remains a compatibility fallback when `SHORT_URL_BASE` is unset;
`SHORT_URL_BASE` takes precedence when both are configured.

For local Node.js development, copy the workspace example files:

```bash
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

Default database connection:

```text
postgres://shorturl:shorturl@localhost:5432/shorturl
```

## Useful Scripts

```bash
npm run dev          # run frontend and backend
npm run dev:web      # run React app on port 3210
npm run dev:api      # run API on port 3211
npm run db:up        # start PostgreSQL with Docker
npm run db:migrate   # create database tables
npm run generate:api # generate frontend API client with Orval
npm run build        # build all workspaces
```

## Main Features

- Create a short URL from an original URL.
- Optionally provide a custom alias.
- Copy the generated short URL.
- Redirect short URLs to the original URL.
- Track click counts and timestamps.
- List recently created URLs.

## Frontend Routes

- `/` redirects to `/shortenurl`, the main Short URL page.
- `/qr-maker` generates styled QR codes from URLs or text, with PNG downloads.
- `/register` and `/login` open the account modal on the Short URL page.
- `/my-links` is the member-only My library, showing up to 500 URL/QR items, pinned first.
- `/my-links/:id` shows owner-only daily visit statistics for 7, 30 or 90 days.
- Unknown paths display a not-found page.

Production hosting must serve `Frontend/dist/index.html` for frontend paths
so that direct visits and page refreshes work with BrowserRouter.

## Accounts

The first interaction with Short URL or QR Maker opens the login modal once per
browser-tab session. Nevermind, Escape, or closing the dialog keeps guest access.
Members can save new short links and QR codes to their account and view them in My library;
existing guest links are not automatically assigned to an account.

Log in with an email address or the existing account Name as a username. Both
are matched case-insensitively and surrounding whitespace is ignored. Names
and emails are unique under the same rules; duplicate registrations return
409 with a message identifying the conflicting field. Database unique indexes
also prevent duplicates from concurrent requests. An identifier formatted as
an email address is always treated as an email.
The login API accepts `identifier` and `password`; legacy `email` and `password`
requests remain supported.

Migration `006_unique_account_identifiers.sql` adds these constraints without
changing existing accounts. Any existing case-insensitive duplicates must be
resolved before applying it.

Short URL keeps the three most recently created links beneath its form, newest first.
This small history survives navigation and reloads in the same browser tab using
sessionStorage, with separate storage for guests and each signed-in account.
My library remains the account's complete server-backed history.

My library includes an Edit dialog for titles, destinations or QR text, tags,
folders and schedules. Editing preserves the alias, QR design and visit statistics.
Delete requires holding the trash button for 0.8 seconds or double clicking it;
releasing early, moving outside the button or losing focus cancels the hold.
Mouse, touch and Space/Enter holds are supported. Deletion is permanent and
removes the item's click logs; reusable tags and folders remain. Editing and
deleting also update the recent-link history. Both API operations require the
owning account.

Passwords are hashed with bcrypt. Sessions expire one hour after login or
registration, using a JWT and matching one-hour HttpOnly cookie. Activity does
not extend this deadline, and older tokens are also limited to one hour.
Logging out or detecting expiration returns the browser to `/shortenurl`.
The browser checks the session every minute while visible and when returning
to the tab; authenticated API rejections also end the session.
Sessions use a SameSite=Lax cookie, with Secure enabled in production. Set a stable `JWT_SECRET`
of at least 32 characters in `Backend/.env` to keep sessions across server restarts.
Development generates an ephemeral secret if unset; production requires a secret.
The authentication endpoints limit login/registration attempts.

Run `npm --workspace Backend run test:integration` with the API and PostgreSQL
running to verify accounts, session cookies, ownership and guest access. The test
removes only its own temporary users and links when finished.

QR Maker draws only when Generate is pressed. Typing or changing options clears
the preview and disables downloading until the next generation. Member-only
Title, tags, folders and schedules sit in a collapsible, scrollable panel below Size.
Collapsing the panel keeps its values. Generate automatically saves member QR codes
to My library, while guest QR codes encode the original content directly and are not stored.
Downloads become available after drawing completes. Saved QR codes encode the returned short URL,
with their original content, design and organization stored in PostgreSQL.
Plain-text QR destinations are served as text/plain by the short-link endpoint.

Members can create reusable tags (Social, Examination and Campaign are seeded),
choose unique tag colors, create/reuse folders, schedule opening and expiry times,
and pin items. Schedules use timezone-aware timestamps and are enforced on the
backend on every visit. Scheduled links redirect to `/link-unavailable/{code}` on
`WEB_ORIGIN`, showing the existing background and a centered availability dialog
with the opening time in Asia/Bangkok. Check again reads the status without counting
a visit; once active, it opens the real short URL so the backend checks the schedule
again before redirecting and recording the visit. Expired links still return 410.
The public availability API returns only status, opening time and the short URL,
not the original destination or account metadata.
Only successful visits are counted. Statistics show request counts, not unique
people or verified scans; bots can count too. Daily buckets use Asia/Bangkok.
Historical clicks before migration 003 remain in the total but have no daily logs.

The configured public domain must route to this backend for redirects, tracking
and schedules. Existing printed QR codes keep their encoded URL; changing the
base URL does not rewrite them. Keep the old domain routing to this backend or
regenerate QR codes after a domain change.

## Vercel Deployment

Production: https://qlean-three.vercel.app

Production uses Neon Free with the existing schema and a separate, initially
empty database. Local Docker data has not been migrated or modified.

Deploy the repository root `ShortURLproj`, not the `Frontend` directory.
`vercel.json` builds both workspaces, serves the Vite frontend, and routes API
requests to the existing Express application through `api/index.mjs`. Browser
routes support direct visits and refreshes. On Vercel, new short links use
`https://<deployment-domain>/s/<code>` so aliases do not collide with app pages.
Local development and Docker continue using port 3211 and their existing links.

Configure these server-side environment variables in the Vercel project:

- `NODE_ENV`: `production` to enable secure session cookies. The install command explicitly includes dev dependencies needed to build TypeScript.
- `DATABASE_URL`: a hosted PostgreSQL connection string, with the provider's required TLS settings. Localhost and Docker service names are not reachable from Vercel.
- `JWT_SECRET`: a stable random secret of at least 32 characters.
- `ACCESS_CODE_KEY`: a stable 32-byte encryption key encoded as 64 hexadecimal characters. Preserve this key across deployments; if migrating existing protected links, use their existing encryption key.
- `REDIS_URL`: optional hosted Redis connection string. Without it, statistics use PostgreSQL directly.

Do not set `VITE_API_BASE_URL` for this deployment: the frontend uses same-origin
`/api` requests, keeping session cookies on the website's domain. Vercel's system
variables supply the default website and short-link origins. To use a custom
domain, set `WEB_ORIGIN=https://<domain>` and `SHORT_URL_BASE=https://<domain>/s`.
Use a separate database for preview environments to keep test data out of production.

Apply the migrations to the hosted database before releasing the app. Set
`DATABASE_URL` securely in the local environment, then run `npm run db:migrate`.
This creates the schema; it does not copy users or links from the local database.
Never expose PostgreSQL's local Docker port to the public internet.

```bash
npx vercel login
npx vercel link
npx vercel deploy --prod
```

After deployment, verify `/health`, registration/login, creation of a short link,
its `/s/<code>` redirect, protected links and a direct visit to `/my-links`.
Vercel references: [Vite hosting](https://vercel.com/docs/frameworks/frontend/vite),
[Node.js functions](https://vercel.com/docs/functions/runtimes/node-js),
and [hosted PostgreSQL](https://vercel.com/docs/postgres).

## API

OpenAPI spec:

```text
Backend/openapi.json
```

Important endpoints:

- `POST /api/short-urls`
- `GET /api/short-urls`
- `GET /api/short-urls/{code}`
- `GET /{code}`
- `GET /api/my-links`
- `GET /api/library/organization`
- `POST /api/library/tags`
- `POST /api/library/folders`
- `POST /api/library/qr`
- `PATCH /api/library/links/{id}`
- `DELETE /api/library/links/{id}`
- `PATCH /api/library/links/{id}/pin`
- `GET /api/library/links/{id}/statistics?days=30`

## Diagrams

- DFD Level 0: [docs/dfd-level-0.md](docs/dfd-level-0.md)
- ER Diagram: [docs/er-diagram.md](docs/er-diagram.md)
