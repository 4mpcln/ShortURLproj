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

Generated short links use `https://shorturl.at/{code}` by default. Set
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
- `/register` and `/login` are placeholder pages.
- Unknown paths display a not-found page.

Production hosting must serve `Frontend/dist/index.html` for frontend paths
so that direct visits and page refreshes work with BrowserRouter.

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

## Diagrams

- DFD Level 0: [docs/dfd-level-0.md](docs/dfd-level-0.md)
- ER Diagram: [docs/er-diagram.md](docs/er-diagram.md)
