# HM Laboratory Inventory Management System

A database-backed, single-administrator system for Hospitality Management laboratory equipment, tools, utensils, furniture and consumable supplies. Built with Next.js App Router, React, strict TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, bcrypt, Recharts and jsPDF.

## Features

- Secure administrator login, password visibility control, optional 30-day sessions, logout, database-backed login throttling and protected pages/API routes. No registration or additional roles.
- Inventory creation, editing, archiving/restoration, unique inventory codes, condition history, searchable and paginated inventory, category/location/condition/stock filters and sorting including valuation.
- Category and laboratory location management, with archive/restore and retained references.
- Administrator-recorded borrowing with multiple inventory items, borrower information, partial/full returns, linked damage and loss, overdue alerts, cancellation, searchable history and timelines. Borrowers have no accounts.
- Stock-in/out, adjustments, physical counts, returns, damage, loss, repair, recovery and disposal. Every balance change includes a permanent transaction and activity record.
- Damage assessment/repair statuses, missing/investigation/lost statuses, linked repair/recovery, and disposal of damaged units without subtracting usable units.
- Database-derived dashboard cards, category and condition charts, 30-day stock movement, recent transactions and stock alerts.
- Thirteen inventory, movement and incident reports with filters, totals, CSV, PDF and print layouts. CSV values are protected against spreadsheet formula injection.
- Ten additional borrowing/return reports with borrower, item, date and status filters, CSV/PDF exports and printing.
- Item history, centralized transactions, immutable activity logs, administrator profile/password changes and configurable institutional report headers.
- Responsive sidebar, accessible form labels, native modal dialogs, confirmation prompts, loading/error/empty states and success notifications.

Stock forms use unique request IDs to deduplicate retries. Item edits detect stale forms. Database constraints keep unavailable quantities aligned with borrowed units and unresolved incidents and preserve original incident facts. Monetary values and totals retain decimal precision. Historical reports include archived inventory by default; reports support up to 5,000 rows and ask for narrower filters beyond that limit.

## Requirements

Node.js 22.12+ or Node.js 24 LTS; npm; PostgreSQL 16+ (UTF-8). A local PostgreSQL installer is optional: the included development helper starts PostgreSQL binaries inside the ignored `.local-db` directory and binds to `127.0.0.1:55432`.

On Windows PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`. The commands below use `npm`; substitute `npm.cmd` where needed.

## Quick local setup

```sh
npm ci
npm run db:local
```

Keep that terminal running. In another terminal:

```sh
npm run setup:local
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000. The setup helper writes an ignored `.env` with username `administrator` and a random initial password. Read `ADMIN_INITIAL_PASSWORD` from that file locally; it is never printed or embedded in the frontend. Sign in and change the password in Settings. Seed reruns never overwrite an existing administrator password. Remove the initial password from `.env` after initialization. Sample data is opt-in with `SEED_SAMPLE_DATA=true`; the local helper enables it. Production should use `false`.

## Use an existing PostgreSQL database

Copy `.env.example` to `.env` and configure:

| Variable                 | Purpose                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Application PostgreSQL connection, pooled if desired                                                       |
| `DIRECT_URL`             | Direct PostgreSQL connection for Prisma migrations                                                         |
| `APP_ORIGIN`             | Exact browser origin, e.g. `http://localhost:3000` or your HTTPS production domain; required for mutations |
| `ADMIN_USERNAME`         | Initial administrator username                                                                             |
| `ADMIN_NAME`             | Initial administrator display name                                                                         |
| `ADMIN_INITIAL_PASSWORD` | Unique initial password, at least 12 characters and at most 72 UTF-8 bytes                                 |
| `SEED_SAMPLE_DATA`       | `true` to initialize sample inventory; `false` for production                                              |

Create a UTF-8 database and a dedicated database user. Apply schema and initialize the account:

```sh
npm run db:generate
npm run db:deploy
npm run db:seed
```

`db:migrate` uses `prisma migrate dev` for authoring new migrations and needs permission to create a shadow database. `db:deploy` applies committed migrations without a shadow database and is the appropriate production command. Never use `db push` as a replacement: custom integrity/audit/valuation triggers live in migrations.

## Architecture and quantity rules

```text
app/                 Login, authenticated layout, module pages and API routes
components/          Reusable navigation, forms, tables, charts and module views
lib/                 Authentication, validation, queries, reports and stock service
prisma/              Relational schema, committed SQL migrations and seed
scripts/             Local database/setup and guarded test database reset
tests/               Unit, PostgreSQL integration and browser/API checks
```

`quantity` is total held/accounted inventory. `availableQuantity` is the usable portion. Damage and loss move usable units into incident records without deleting held quantities. Repair/recovery resolves an entire matching incident exactly once and returns its units to availability. Partial resolution of damage/loss incident records is deliberately disallowed; create separate incident records when units need separate outcomes. Stock-out and ordinary disposal reduce both total and available. Disposal linked to a damage record reduces held quantity alone. Physical count correction sets the usable count while retaining known unavailable units. “Other” adjustments add units; use Deduct Quantity for reductions. Quantities are whole units, with a maximum held balance of 100 million.

An item is out of stock when available quantity is zero and low stock when positive available quantity is at or below its minimum. The condition field describes the item generally; incident records track quantities with different outcomes. Unit cost is the most recently recorded stock-in cost, not a weighted average. Total value is quantity × unit cost and is enforced by a database trigger; missing and damaged units remain in held valuation until disposal/stock reduction.

Every mutation locks the item's PostgreSQL row, validates against the latest balances, then saves transactions, incidents, balances, condition changes and logs in one database transaction. Concurrent withdrawals serialize on that row. Exceptions roll back the complete operation. A unique code constraint, restrictive foreign keys, nonnegative checks and singleton administrator constraint reinforce the application rules. Transaction, activity, disposal and condition history tables reject updates/deletes through database triggers.

There are six migrations:

1. `202610040001_initial`: normalized tables, enums, relationships and indexes.
2. `202610040002_integrity`: singleton administrator/settings, stock constraints and immutable history triggers.
3. `202610040003_valuation`: indexed automatically calculated valuation.
4. `202610040004_audit_fixes`: request deduplication and incident/accounting safeguards.
5. `202610040005_borrow_return`: normalized borrowing/return tables, counters, numbering and permanent history constraints.
6. `202610040006_return_integrity`: required borrower fields and matching damage/loss records for return conditions.

## Borrow and return workflow

Use **Borrow Items** to enter the borrower's name/type, optional ID, program/department, section/contact, purpose and dates. Add/remove inventory lines before saving. The server checks available quantities and generates a unique `BRW-year-sequence` number. Borrowers are transaction records; the administrator remains the only authenticated account.

Use **Return Items** to search open loans by number, borrower, ID or inventory item. Open a loan and enter the quantity returned for each item; zero leaves that item outstanding. **Add return line** splits an item across Good, Fair, Damaged or Lost/Missing outcomes. Partial returns leave the rest outstanding. Every return has a unique `RTN-year-sequence` number and a permanent timeline entry.

The database enforces:

```text
Total held = Available + Borrowed + Unresolved damaged + Unresolved lost/missing
Outstanding on a loan line = Borrowed - Returned/reported lost - Cancelled
```

Good/Fair returns reduce borrowed quantity and increase availability. Damaged/lost outcomes reduce borrowed quantity and create a linked incident without increasing availability. They count as resolved quantities on the loan; subsequent repair/recovery occurs through the incident module. Borrowing and returning keep total held quantity unchanged. Disposal reduces held quantity. Physical counts retain outstanding borrowed and incident units.

Overdue status is computed when the expected date is earlier than today's Manila calendar date and units remain outstanding. Today is due, not overdue. The dashboard shows borrowed units, active loans, overdue loans, due-today units and a due/overdue table. Damaged Returns and Lost Borrowed Items show cumulative reported return quantities; incident modules show current unresolved quantities.

**Borrowing History** provides search, borrower/date/expected-date/status filters, sorting and pagination. Details preserve the original item names/codes and release conditions, borrower information, return conditions, final return date and chronological timeline. Archiving inventory does not prevent settling an existing loan.

Cancel a loan only when the release did not occur and no returns have been recorded. A required reason, cancelled quantities and an audit event remain; all borrowed units return to availability. A partially returned loan must be settled through return records.

Reports include currently borrowed items, borrowing history, return history, overdue items, student/faculty/department borrowing, damaged returned items, lost borrowed items and borrowing by date range. Start/end dates filter borrowing dates for borrowing reports and return dates for return reports. Expected-return date filters are separate. Historical reports include archived inventory by default. Original borrower/release/return facts cannot be overwritten or deleted.

## Authentication and security

Passwords use bcrypt with cost 12; inputs are capped at 72 UTF-8 bytes to avoid bcrypt truncation. Opaque 256-bit session tokens live in HTTP-only, same-site cookies. Only SHA-256 token digests are stored in PostgreSQL. Production cookies require HTTPS. Sessions expire after eight hours, or 30 days when remembered. Changing a password revokes other sessions. The single account has a database-backed limit of ten login attempts per 15-minute window, shared across application instances.

Proxy performs an early cookie-presence check. The authenticated server layout and every API request additionally validate the session in the database. Cookie presence alone grants no access. Mutations require an exact `Origin` match against `APP_ORIGIN`, protecting login and authenticated forms from cross-site submissions. API input is validated on the server; React escapes displayed text, Prisma parameterizes queries, and raw lock queries use tagged parameters. Database/authentication secrets never enter client components. Security headers prevent embedding and restrict asset origins. Administrator activity logs are read-only; no history deletion endpoint exists.

Scripts use per-request CSP nonces; production permits neither unrestricted inline scripts nor eval. The scoped Next ESLint glob adapter in `scripts/next-root-glob` replaces the vulnerable development dependency chain while retaining directory matching. Its contract is tested against the installed Next plugin.

## Tests and production build

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

For database integration tests, use a dedicated database **named exactly `hm_inventory_test`**. Apply migrations to that database first. Tests add uniquely named records and preserve history; they do not delete production data. Example PowerShell:

```powershell
$env:DATABASE_URL='postgresql://postgres:local-development-only@127.0.0.1:55432/hm_inventory_test'
$env:DIRECT_URL=$env:DATABASE_URL
npm.cmd run db:deploy
npm.cmd run test:integration
Remove-Item Env:DATABASE_URL
Remove-Item Env:DIRECT_URL
```

Unit tests cover movement rules, overspending, stock thresholds and validation. PostgreSQL tests cover creation/editing, uniqueness, valuation, stock-in/out, atomic rollback, damage/repair, loss/recovery, damage disposal, physical counts, filters/reports, concurrent withdrawals, archive/restore, database constraints and immutable audit history. Browser/API tests cover authentication, protected pages, CSRF, forms, exports and mobile navigation. See `tests/e2e` and the verification report for the command and recorded results.

For browser tests, keep `db:local` running, set the isolated test URLs as above, and run:

```sh
npx playwright install chromium
npm run test:e2e
# To exercise a previously built production server:
# PowerShell: $env:E2E_PRODUCTION='true'
# npm.cmd run test:e2e
```

The browser setup seeds the test account using the initialization credentials in the environment or `.env`, then resets only the test database's login throttle. The test server uses port 3000; stop any existing development server before running. Test passwords are restored after password-change checks. Do not run the production build concurrently with a development/test server on Windows, because the loaded Prisma engine DLL cannot be replaced while in use.

For a clean repeat of local integration tests only, `scripts/reset-test-db.mjs` refuses any target except `127.0.0.1:55432/hm_inventory_test`. It deletes that isolated test database. Do not use it for real inventory.

## Vercel and Neon deployment

1. Create a Neon PostgreSQL project and use a UTF-8 database. Obtain pooled and direct connection strings with `sslmode=require`.
2. Import this repository into Vercel as a Next.js project. Set `DATABASE_URL` to the pooled URL, `DIRECT_URL` to the direct URL, and `APP_ORIGIN` to the exact HTTPS site origin. Use separate databases for preview and production.
3. From a trusted terminal with the production connection variables, run `npm ci` and `npm run db:deploy`. Run `npm run db:seed` once with a unique initial administrator password and `SEED_SAMPLE_DATA=false`. Remove initialization credentials afterward. Do not put them in source control or public variables.
4. Use `npm run build` as the Vercel build command. It generates the Prisma client before building Next.js. Migrations are an explicit release step rather than being run on every preview build.
5. Deploy, sign in over HTTPS, change the initial password and verify a stock transaction and report. Confirm `APP_ORIGIN` matches the chosen domain; update it if a custom domain changes.

The project is prepared for deployment; these instructions do not create a cloud database or publish a live Vercel site. `next start` serves the production build locally; HTTPS is required for production session cookies. Use a local TLS reverse proxy when verifying production authentication locally, or use `next dev` for ordinary local work.

## Troubleshooting

- **Prisma connection error:** Check both URLs, whether PostgreSQL is running, port, user permissions and TLS configuration. For the helper, restart `npm run db:local`.
- **Login initialization error:** Supply the initial password before seeding. The seed deliberately refuses weak/missing credentials when no administrator exists.
- **Invalid request origin:** Set `APP_ORIGIN` to the browser's exact origin, including port. Restart the server after environment changes.
- **Too many login attempts:** Wait for the 15-minute window; the throttle persists across server restarts.
- **Unauthorized after a production build:** Secure cookies need HTTPS. Use development mode locally.
- **Unicode database errors on Windows:** Create the database with UTF-8 encoding. The supplied local helper explicitly requests UTF-8/C locale for new clusters/databases.
- **Duplicate code/name:** Use a distinct inventory code/category/location name; archived records retain their unique names.
- **Rejected repair/recovery:** Select an unresolved record and resolve its full quantity. Recovered/repaired records cannot be credited twice.
- **PowerShell script policy:** Use `npm.cmd` and `npx.cmd` rather than changing the system execution policy.
- **Binary installation blocked:** The development PostgreSQL helper needs its platform binary package; Prisma needs its engine. Permit the appropriate package installation scripts/downloads, or use a normally installed PostgreSQL server.

## Operational limitations

Inventory images are optional and are not included. Quantities are whole units. Reports load their selected result set in memory, so use date/category/location filters for very large exports. Report dates use acquisition date for inventory reports and event date for movement/incident reports; display times use Asia/Manila. Browser print controls page numbering. There is no user registration, password recovery email service or additional account management. Keep the administrator credentials in an institutional password manager, manage database backups with your PostgreSQL provider, and verify restore procedures before relying on live records.
