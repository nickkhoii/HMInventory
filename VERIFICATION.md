# Verification record

Audited October 4, 2026 on Windows with Node.js 24.19.0, Next.js 16.3.8, Prisma 6.19.0 and local PostgreSQL 18.4. Database and browser tests use the separate hm_inventory_test database. Existing development inventory was preserved and checked: zero unavailable-balance or usable-stock condition inconsistencies.

| Check                                       | Result                                     |
| ------------------------------------------- | ------------------------------------------ |
| Unit and validation tests                   | 80 passed                                  |
| PostgreSQL integration tests                | 41 passed                                  |
| Browser/API tests against production build  | 13 passed                                  |
| ESLint                                      | Passed                                     |
| Strict TypeScript                           | Passed                                     |
| Production build                            | Passed                                     |
| Prisma schema validation                    | Passed                                     |
| Migration status                            | All six migrations applied; up to date     |
| Schema drift                                | No difference detected                     |
| Full npm audit, including development tools | Zero vulnerabilities                       |
| Next lint glob adapter compatibility        | Literal and glob directory matching passed |

Tests cover stock movements, overspending, rollback, concurrent withdrawals and retries, valuation, damage/repair, loss/recovery, damaged-unit disposal, physical counts, filters/reports, archived history, stale edits, original incident identity, deferred unavailable-balance constraints and immutable audit history. Test records are retained to preserve the audit model.

Borrow/return coverage includes multi-item loans; insufficient/invalid quantities; partial and repeated returns; combined return limits; Good/Fair, damaged and lost outcomes; incident repair/recovery; overdue status; cancellation; immutable facts; database balance checks; concurrent borrows/returns and deduplicated retries; borrower-only and return-number searches; ten report variants; and returns to archived inventory.

Production browser checks cover all seventeen modules, authentication and invalid/forged/expired sessions, CSRF, password changes and session revocation, login throttling, category/item forms, stock operations, incident restoration and repair, accessible dialogs, browser URL history, CSV/PDF downloads and print styles, and mobile navigation without horizontal overflow. The real CSP is exercised in Chromium with a correctly nonced script and a blocked injected inline script.

See [AUDIT.md](AUDIT.md) for findings and fixes and [README.md](README.md) for setup, test and deployment commands.

## Practical limits

- Cloud infrastructure was not part of this local audit; production deployment requires the configured PostgreSQL database and application origin.
- Reports support up to 5,000 filtered rows. Narrow filters for larger datasets. Built-in PDF fonts do not cover every writing system; complex-script typography requires an embedded font.
- Optional item photographs remain omitted. Whole-unit quantities and full-record damage/loss incident resolution are documented rules; loan returns support partial quantities.
