# Application and API Reference

[Back to README](../README.md)

## Project Structure

```text
ShortURLproj/
  Frontend/            # React, Vite and generated Orval client
  Backend/             # API, OpenAPI specification and SQL migrations
  api/index.mjs        # Vercel function entry point
  docs/                # Guides and diagrams
  docker-compose.yml   # PostgreSQL, Redis and Backend
  vercel.json          # Production build and routing
  .env.example         # Compose configuration template
  package.json         # Workspace scripts
```

## Frontend Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/shortenurl` |
| `/shortenurl` | Short URL creation |
| `/qr-maker` | Styled QR generation and PNG download |
| `/register`, `/login` | Account modal on the Short URL page |
| `/my-links` | Member-only library, up to 500 items, pinned first |
| `/my-links/:id` | Owner statistics: 7, 15, 30, 45, 60 days or a custom range |
| `/link-access/:code` | Six-digit access-code prompt |
| `/link-unavailable/:code` | Schedule/availability information |

Unknown paths show a not-found page. Production hosting must serve the frontend
SPA for direct visits and refreshes.

## Accounts

The first interaction with Short URL or QR Maker opens the account modal once
per browser-tab session. Closing it or pressing Escape allows guest access.
Guest links are not automatically assigned to an account after login.

Login accepts username or email. Both identifiers are matched case-insensitively
after trimming whitespace; usernames and emails are unique under those rules.
Duplicates return `409`; unique indexes also protect against concurrent requests.
An email-shaped identifier is always treated as an email.
The API accepts `identifier`/`password` and legacy `email`/`password` requests.

Account passwords are bcrypt-hashed, at least eight characters, and at most
72 UTF-8 bytes. Sessions use a one-hour JWT and HttpOnly, SameSite=Lax cookie;
production adds Secure. Activity does not extend expiration.
The frontend checks every minute while visible, on returning to the tab, and
on authenticated API rejection. Logout/expiration returns to `/shortenurl`.
Authentication endpoints rate-limit login and registration.

## URLs, QR Codes and Library

Short URL shows the three most recently created links. This history uses
sessionStorage per tab, with separate guest/member storage.
My library is the member's server-backed history.

QR Maker draws on Generate. Editing content/options clears the preview and
disables downloads until regeneration. Member QR codes save automatically and
encode the returned short URL; guest QR codes encode the original content and
are not stored. Member QR content, design and organization are stored in
PostgreSQL. Plain-text destinations are served as `text/plain`.

Members can create reusable tags/folders, choose tag colors, schedule opening
and expiry, and pin items. Social, Examination and Campaign tags are seeded.
The Edit dialog updates content, title, tags, folders and schedules while
preserving the alias, QR design and statistics.

Delete requires a 0.8-second hold or double click. Early release, leaving the
button or losing focus cancels the hold. Mouse, touch and Space/Enter holds
are supported. Deletion permanently removes the item and click logs, not
reusable tags/folders. Edit/delete require ownership and update recent history.

Six-digit access codes are optional and member-only. Library shows
**Encrypted**, not the code. Only the owner can see the code in statistics;
visitors must enter the correct code before reaching the destination.

## Schedules and Statistics

Schedules use timezone-aware timestamps and are checked on every visit.
Unavailable links direct visitors to `/link-unavailable/:code`, showing opening
time in Asia/Bangkok. Check again reads availability without counting a visit;
an active link then opens through the short-link endpoint. Expired links return
`410`. Public availability data excludes the destination and owner metadata.

Only successful visits count. Statistics measure requests, not unique people
or verified scans; bots can count. Daily buckets use Asia/Bangkok and can be
cached for five minutes. Historical visits before migration 003 remain in totals
but have no daily logs.

The public short-link domain must reach Backend for tracking and access checks.
Changing that domain does not rewrite previously printed QR codes.

## API

Specification: [Backend/openapi.json](../Backend/openapi.json).
Regenerate its Orval client only after changing the contract.

Important endpoints:

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/short-urls`
- `GET /api/short-urls`
- `GET /api/short-urls/{code}`
- `GET /{code}` (local redirect)
- `GET /{code}` (redirect; legacy `GET /s/{code}` also supported)
- `GET /api/my-links`
- `GET /api/library/organization`
- `POST /api/library/tags`
- `POST /api/library/folders`
- `POST /api/library/qr`
- `PATCH /api/library/links/{id}`
- `DELETE /api/library/links/{id}`
- `PATCH /api/library/links/{id}/pin`
- `GET /api/library/links/{id}/statistics?days=30`
- `GET /api/short-urls/{code}/access`
- `POST /api/short-urls/{code}/unlock`

## Diagrams

- [DFD Level 0](dfd-level-0.md)
- [ER diagram](er-diagram.md)
