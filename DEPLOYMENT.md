# Neon and Vercel deployment

The Neon database configured in the local `.env` has all six committed migrations applied and the administrator initialized. Verification confirmed zero inventory records. No live Vercel deployment has been published yet; Vercel project configuration is still required.

Selected deployment mode: a fresh production database, without copying local inventory or adding sample records.

## Database and environment

Create a Neon project for production. Use its pooled PostgreSQL URL for `DATABASE_URL` and its direct URL for `DIRECT_URL`. Both must require TLS (`sslmode=require`). Prisma 6 reads these from the existing schema, using the direct connection for migrations.

Copy the URLs from Neon's **Connect** dialog for the same branch, database and role. The pooled hostname contains `-pooler`; the direct hostname does not. `.env.example` provides Neon placeholders: replace them with the actual URLs, including your project's region and database name. Keep any connection options Neon supplies and add `connect_timeout=15` if absent to accommodate compute wake-up. The existing Prisma client works over PostgreSQL TCP; no Neon driver adapter or schema conversion is required.

For local development against Neon, put both URLs in the ignored `.env`, keep `APP_ORIGIN=http://localhost:3000`, then run `npm run db:generate`, `npm run db:deploy`, initialize the administrator as described below, and run `npm run dev`. The local PostgreSQL helper is optional. Existing `.env` files are not overwritten by this configuration change.

Set these server-only variables in the Vercel project's **Production** environment:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection URL |
| `DIRECT_URL` | Neon direct PostgreSQL connection URL |
| `APP_ORIGIN` | Exact HTTPS origin of the production domain, with no path |
| `SEED_SAMPLE_DATA` | `false` |

For a fresh database, initialize the account once with `npm run db:seed`, using the Neon URLs and a new unique `ADMIN_INITIAL_PASSWORD`, plus `ADMIN_USERNAME` and `ADMIN_NAME`. The password must be at least 12 characters and at most 72 UTF-8 bytes. Use a fresh production credential rather than the development password. Change it after signing in; remove the bootstrap password from any cloud environment afterward. Seed reruns preserve an existing administrator's password.

When migrating local inventory instead, back up and restore the existing database through Neon's direct connection before enabling the production app. Preserve migration history, sessions/audit tables, sequences, constraints, and triggers. Do not seed sample records or reset the database. Migration of local data requires a separate choice from starting an empty production database.

## Vercel project

`vercel.json` selects Next.js, installs the lockfile with `npm ci`, and runs `npm run build:vercel`. That command generates Prisma Client, applies the committed migrations with `prisma migrate deploy`, then compiles Next.js. A migration failure stops the deployment. It does not reset the database or automatically seed it.

Select Node.js 24 in the Vercel project settings. Link this working copy to the intended Vercel project, configure the production domain and environment variables, deploy the current code, initialize the administrator if starting fresh, then verify HTTPS login, dashboard access, reports, and logout.

Configure Preview deployments with a separate Neon branch/database and the preview's exact HTTPS `APP_ORIGIN`. The same build command applies migrations to the configured database, so preview variables must not point to the production database. Environment changes require a redeployment.

`.vercelignore` excludes local PostgreSQL files, local environment secrets, dependencies, caches, and test artifacts from CLI uploads. `.vercel/` project metadata is ignored by Git. All application secrets remain server-side.

## References

- [Prisma 6 with Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon)
- [Vercel project configuration](https://vercel.com/docs/project-configuration)
- [Vercel environment variables](https://vercel.com/docs/cli/env)
