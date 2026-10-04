# Project audit and fixes

Completed October 4, 2026. Reviewed application pages, forms and navigation; all API resources; authentication and authorization; inventory accounting; Prisma models, migrations and seed; reports and downloads; dependencies; scripts; and build/test configuration.

| Finding                                                                           | Resolution                                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Malformed, nonobject or oversized JSON could become server errors                 | Require JSON objects, validate UTF-8, return 400/415/413 and enforce a 64 KB body limit                    |
| Numeric coercion accepted null, boolean or blank quantities/costs                 | Restrict accepted input types and reject invalid values                                                    |
| Invalid page/date/stock/archive filters could reach Prisma or be silently ignored | Shared validation, real calendar checks, ordered date ranges and supported enums                           |
| Excessive page numbers produced unusable pagination                               | Clamp pages with a consistent count/results transaction and deterministic ordering                         |
| Extra API path segments were ignored                                              | Reject unsupported resource shapes and methods                                                             |
| Condition edits could bypass incident accounting                                  | Require stock and incident operations for unavailable conditions; restrict form choices                    |
| Replenishing disposed inventory retained its disposed condition                   | Reconcile condition after stock operations and retain condition history                                    |
| Mixed incidents or damage assessments could leave stale conditions                | Derive unavailable condition from outstanding incident records                                             |
| Beyond-repair records offered repair                                              | Require reassessment before repair and hide the invalid action                                             |
| Retried stock submissions could duplicate stock and history                       | Browser request IDs, unique database key and payload checks under the item lock                            |
| Item edits could overwrite changes from an older form                             | Compare the submitted revision under the item lock and reject stale edits                                  |
| Lookup archiving could race inventory creation                                    | Lock referenced category/location rows while validating and saving                                         |
| Direct database changes could break incident accounting                           | Deferred checks require unavailable quantities to match unresolved damage/loss at commit                   |
| Original damage/loss facts could be changed or deleted                            | Triggers preserve incident identity, quantities, reporting dates and original descriptions                 |
| Archived incidents offered actions rejected by the backend                        | Hide unavailable actions, link to the item and provide a working restore action                            |
| Client session redirects could be swallowed by error handlers                     | Central session-expiry event routes the browser back to login                                              |
| Expired logout was rejected; forged cookies could create logout activity          | Clear expired cookies and log only an actual removed session                                               |
| URL navigation could leave stale filters                                          | Use Next's navigation hook; verify Back/Forward in Chromium                                                |
| Large currency calculations lost precision                                        | Use stored decimal valuations, exact totals and currency formatting without floating conversion            |
| Historical reports excluded archived inventory                                    | Include archived items for movement/incident reports and expose an all-inventory choice                    |
| Unbounded report exports risked excessive memory use                              | Fetch at most 5,001 rows and request narrower filters above 5,000                                          |
| PDF headers could overflow and page labels overlapped                             | Wrap long headers, reserve footer space and print one page-count label                                     |
| Dialogs lacked an accessible title                                                | Link each dialog to its heading                                                                            |
| Missing site icon                                                                 | Add a native SVG application icon                                                                          |
| Script policy allowed unrestricted inline execution                               | Per-request nonces, dynamic rendering and strict script policy; eval limited to development                |
| Vulnerable development lint dependency chain                                      | Replace only Next ESLint's glob dependency with a tested local tinyglobby adapter; full audit reports zero |
| Test database guard accepted a connection-URL substring                           | Parse and require the exact dedicated database name                                                        |
| Seed could create unusable initial account fields                                 | Validate administrator username/name before creation                                                       |
| Development server exposed beyond the local interface                             | Bind development to 127.0.0.1                                                                              |

The additive fourth migration was applied to both local databases. No development inventory was deleted or reset. No known defects from this audit remain unresolved. Product limits and deployment requirements are documented in README and VERIFICATION; passing tests cannot establish the absence of every possible defect.

Validation: 61 unit tests, 24 real PostgreSQL tests, 10 production browser/API tests, lint, strict TypeScript, production compilation, Prisma validation, migration status, schema comparison and full dependency audit. See [VERIFICATION.md](VERIFICATION.md).

## Borrow and return addition

The subsequent borrow/return module adds normalized loan and return tables, preserved borrower/release snapshots, partial returns, linked damaged/lost dispositions, computed overdue status, cancellation, history/timelines, dashboard alerts and ten additional reports. Database safeguards now include borrowed units in the unavailable-stock equation. Two additive migrations were applied without resetting inventory. Updated results are recorded in VERIFICATION.md.

# Project audit — October 4, 2026

Reviewed authentication, API routing and validation, inventory and incident services, borrowing and returns, reports and exports, client forms and navigation, database schema and integrity triggers, local setup, dependencies, and production build behavior. Existing branding changes were preserved. Integration and browser tests write only to the guarded `hm_inventory_test` database.

| Finding | Fix and verification |
| --- | --- |
| Development login failed through `127.0.0.1` when `APP_ORIGIN` used `localhost`. | Development accepts loopback aliases on the configured protocol and port. Production still requires the exact configured origin. Regression tests reject foreign hosts, ports, protocols, null origins, and origins containing paths. |
| Stock, borrow, and return forms retained a request key after the submitted values changed. An edited retry could conflict with a previously committed submission. | Keys now follow the normalized, validated payload. Identical retries reuse their key; edited submissions receive a new key. A production browser regression simulates a committed stock movement whose response is lost and verifies that an identical retry does not add stock twice. |
| Concurrent stock submissions could use the same request key against different inventory items, bypassing item-level serialization and reaching a unique-constraint race. | An advisory transaction lock serializes requests by key before inventory locking, matching the borrowing/return services. The integration regression verifies one committed movement and one explicit conflict, with correct balances. |
| CSV formula escaping missed formulas preceded by spaces or a newline. | CSV exports prefix suspicious cells with an apostrophe and preserve normal quoting. Regression tests cover whitespace, newline, tab, and formula prefixes. |
| JSON parsing accepted media types merely containing `application/json`. | The parser requires the exact media type, while allowing charset parameters. Lookalike types return 415. Existing body-size and malformed-JSON protections remain covered. |
| Activity filters interpreted Manila dates as UTC timestamp boundaries. | Timestamped activity uses Manila midnight boundaries. Date-only acquisition, borrowing, and return values keep their calendar-date semantics. |
| The dashboard's 30-day stock chart used the UTC calendar day. | Its range now ends on the laboratory's Manila calendar day, including the current day during the first eight hours after Manila midnight. |
| A failed report request left the previous report and export buttons visible. | Starting generation clears the prior result and export query. The browser regression verifies that reversed dates cannot leave stale exports visible. |
| An item-detail load failure had no retry control, and its error was not cleared on reload. | Added a retry button and cleared the error before reloading. |
| On Windows, Prisma generation failed with EPERM while the running development server held the query-engine DLL. | Stopped the identified project server during build verification. The final production build passed. README documents releasing the lock before generation/build. |

### Follow-up verification

- 93 unit/validation/security regression tests passed.
- 42 PostgreSQL integration tests passed.
- 15 production browser/API tests passed, exercising all 17 modules, stock/incident workflows, borrowing/returns/cancellation, authentication, CSRF, CSP, session expiry, password changes, exports/printing, URL navigation, and mobile layout.
- ESLint, strict TypeScript, production build, and Prisma schema validation passed.
- All six migrations are applied; Prisma reports no schema drift.
- Read-only checks of the development database found zero stock/loan/incident balance violations and zero valuation mismatches. Encoding is UTF-8.
- npm's advisory check reported zero known vulnerabilities across production and development dependencies.

### Follow-up scope and operational limits

Optional item photographs are explicitly optional in the project specification and remain omitted. Reports retain the documented 5,000-row limit and built-in PDF font limitations. Cloud deployment and provider configuration were not tested. Test coverage and code review do not prove the absence of every possible defect.

Windows browser testing required execution outside the restricted sandbox after an account-lookup failure in the test seed subprocess. The database guard remained active; the development database was not reset or seeded by the audit.
