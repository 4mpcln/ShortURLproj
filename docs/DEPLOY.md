# Vercel and Neon Deployment

[Back to README](../README.md)

Current production: [qlean-three.vercel.app](https://qlean-three.vercel.app).
The existing `qlean` project uses Neon Free, resource `qlean-db`, with the local
schema but separate data. Local accounts and links were not copied.

**For the existing project, reuse the database and secrets.** Link to `qlean`
and follow [Redeploys](#redeploys); do not provision a replacement database.

The following steps cover a first deployment. Install Node.js, Git and project
dependencies as described in README. Docker is not used by Vercel.
Run commands from the repository root.

## 1. Sign In and Link the Project

```bash
npx vercel@latest login
npx vercel@latest link
```

Complete browser authentication, choose the correct team/account, and select
an existing project or create a new one. Fresh clones need to be linked again
because `.vercel/` is not committed.

Deploy the **repository root**, not Frontend or Backend alone.
[vercel.json](../vercel.json) defines:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | Repository root |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Output directory | `Frontend/dist` |
| Function region | `sin1` (Singapore) |

[api/index.mjs](../api/index.mjs) exposes compiled Express as a function.
`/api/...`, `/health`, and `/s/<code>` reach Backend; frontend paths use the
SPA rewrite. No Docker containers run in this deployment.

## 2. Connect Hosted PostgreSQL

In Vercel's Storage/Marketplace interface:

1. Connect an existing Neon database, or create a new database on the Free plan.
   Check the displayed plan before provisioning; prefer Singapore.
2. Read and accept provider terms if prompted.
3. Connect the database to this project's **Production** environment.
4. Confirm the integration supplies `DATABASE_URL`.

Vercel cannot use your computer's `localhost` or Docker's `postgres` hostname.
Do not expose the local database to the internet as a workaround.

## 3. Set Production Environment Variables

Configure these in the Vercel project's Production settings:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Hosted PostgreSQL URL from Neon, retaining its TLS options |
| `JWT_SECRET` | Stable random secret of at least 32 characters |
| `ACCESS_CODE_KEY` | Stable encryption key of exactly 64 hexadecimal characters |
| `REDIS_URL` | Optional hosted Redis URL; omit to use PostgreSQL fallback |

For a new project, run this once per secret to generate two different values:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store them privately. Alternatively, use CLI prompts without putting secret
values in shell commands:

```bash
npx vercel@latest env add NODE_ENV production
npx vercel@latest env add JWT_SECRET production
npx vercel@latest env add ACCESS_CODE_KEY production
```

Enter `production` for `NODE_ENV` and the corresponding secret for each key.
Neon normally supplies `DATABASE_URL`.

Reuse existing secrets for an existing deployment: changing `JWT_SECRET`
signs users out, and changing `ACCESS_CODE_KEY` breaks existing protected links.
Leave `VITE_API_BASE_URL` unset for same-origin requests. Never put secrets in
`VITE_` variables or commit them.

## 4. Apply Database Migrations

Confirm the linked project and database before running:

```bash
npx vercel@latest env run -e production -- npm run db:migrate
```

This uses **hosted Production**, not Docker. Environment values are supplied to
the command without writing credentials to a file.
See [Vercel environment commands](https://vercel.com/docs/cli/env).

The script enables `pgcrypto` and applies
[Backend/db/migrations](../Backend/db/migrations) in filename order:

| Migration | Purpose |
| --- | --- |
| `001_create_short_urls.sql` | Short URLs |
| `002_create_users.sql` | Accounts and ownership |
| `003_library.sql` | Tags, folders, QR settings, schedules and click logs |
| `004_link_enabled.sql` | Enable/disable links |
| `005_access_codes.sql` | Encrypted access codes |
| `006_unique_account_identifiers.sql` | Unique usernames/emails |

The six tables are `users`, `short_urls`, `tags`, `folders`, `short_url_tags`,
and `click_logs`. Migrations create the same schema; they do not copy local data.

Back up populated databases before schema changes. Resolve normalized account
duplicates before migration 006. Vercel deployments do not automatically run
migrations; apply them deliberately when the schema changes.

## 5. Build and Deploy

```bash
npm run build
npx vercel@latest deploy --prod
```

Wait for `READY` and open the production domain. Vercel rebuilds both workspaces;
`--include=dev` ensures TypeScript is available despite `NODE_ENV=production`.
Runtime cookies are Secure and HttpOnly, with a one-hour session limit.

## 6. Verify Production

For the current deployment:

```bash
curl -fsS https://qlean-three.vercel.app/health
```

Expect `{"status":"ok"}`; substitute your own domain for a different project.
Check these browser workflows:

1. Open and refresh `/shortenurl` and `/qr-maker` directly.
2. Register, log out, and log in using username and email.
3. Create a link, follow its `/s/<code>` address, and check Library/Statistics.
4. Save/download a member QR code and test CSV/PDF downloads.
5. Test a protected link with incorrect and correct codes. Library should show
   **Encrypted**, with the code visible only in the owner's statistics.

In browser developer tools, `qlean_session` should be HttpOnly, Secure,
SameSite=Lax and expire about one hour after sign-in. Do not share its token.

## Redeploys

For routine changes, use the existing project and secrets:

```bash
npx vercel@latest deploy --prod
```

Redeploy after changing production variables. Run migrations separately if the
schema changes. Configure a separate database and environment for previews;
never use production data for previews or integration tests.

For a custom domain connected to this Vercel project, set:

```dotenv
WEB_ORIGIN=https://links.example.com
SHORT_URL_BASE=https://links.example.com/s
```

Use your actual HTTPS domain and redeploy. Keep `/s` for the short-link rewrite.
Printed QR codes retain their encoded URL; keep the old domain working or
regenerate codes after changing domains.

## Troubleshooting

- **`tsc: command not found`:** use root install command `npm ci --include=dev`.
- **API fails:** check function logs, migrations, `DATABASE_URL`, `JWT_SECRET`,
  `ACCESS_CODE_KEY`, and production `NODE_ENV`. Redeploy after configuration changes.
- **Page refresh returns 404:** deploy the root with `vercel.json`,
  root build `npm run build`, output `Frontend/dist`, and the SPA rewrite.
- **Login fails:** use HTTPS and ensure `WEB_ORIGIN` matches the production domain.
- **Protected links fail:** preserve the original encryption key, not a new one.

Official references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[Node.js functions](https://vercel.com/docs/functions/runtimes/node-js),
and [hosted PostgreSQL](https://vercel.com/docs/postgres).
