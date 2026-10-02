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
  docker-compose.yml   # PostgreSQL
  package.json         # Shared workspace scripts
```

## Requirements From The Assignment

- Build a Short URL system.
- Use React and Node.js.
- Store data in a database. This project uses PostgreSQL.
- Provide source code in Git and include installation instructions.
- Include diagrams for DFD Level 0 and ER diagram.

## Quick Start

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

Generated short links use `http://localhost:3211/{code}` by default (or the configured PORT). Set
`APP_BASE_URL` in `Backend/.env` to change this domain. The domain must point
to this backend for generated links to redirect through this project.
For local redirects, use `APP_BASE_URL=http://localhost:3211`.

Copy the example files before running locally:

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

Passwords are hashed with bcrypt. Sessions use a seven-day JWT in an HttpOnly,
SameSite=Lax cookie, with Secure enabled in production. Set a stable `JWT_SECRET`
of at least 32 characters in `Backend/.env` to keep sessions across server restarts.
Development generates an ephemeral secret if unset; production requires a secret.
The authentication endpoints limit login/registration attempts.

Run `npm --workspace Backend run test:integration` with the API and PostgreSQL
running to verify accounts, session cookies, ownership and guest access. The test
removes only its own temporary users and links when finished.

Guest QR codes encode the original content directly and are not stored. Members
use Save QR before downloading; saved QR codes encode the returned short URL,
with their original content, design and organization stored in PostgreSQL.
Plain-text QR destinations are served as text/plain by the short-link endpoint.

Members can create reusable tags (Social, Examination and Campaign are seeded),
choose unique tag colors, create/reuse folders, schedule opening and expiry times,
and pin items. Schedules use timezone-aware timestamps and are enforced on the
backend on every visit. Scheduled links return 403; expired links return 410.
Only successful visits are counted. Statistics show request counts, not unique
people or verified scans; bots can count too. Daily buckets use Asia/Bangkok.
Historical clicks before migration 003 remain in the total but have no daily logs.

If APP_BASE_URL is set to `https://shorturl.at`, that domain must route to this backend
for redirects, tracking and schedules. Merely setting APP_BASE_URL does not
configure or grant ownership of a domain. For local testing, open the same code
at http://localhost:3211/{code}, or set APP_BASE_URL to that address and restart
the backend before creating new links/QR codes. Use a domain you control in production.

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
- `PATCH /api/library/links/{id}/pin`
- `GET /api/library/links/{id}/statistics?days=30`

## Diagrams

- DFD Level 0: [docs/dfd-level-0.md](docs/dfd-level-0.md)
- ER Diagram: [docs/er-diagram.md](docs/er-diagram.md)
