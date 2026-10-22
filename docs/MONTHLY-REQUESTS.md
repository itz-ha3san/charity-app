# Monthly request bundles

## Upgrade

Apply `npm run migrate` (adds `034_monthly_requests.sql`), then rebuild/restart the service. Do not expose the new frontend against an unmigrated database. No production migration or deployment is performed by this change.

## Page layout and deployment errors

The monthly workspace is presented as a full-page overlay, not a padded floating dialog. It retains the modal auth/lifecycle boundary and safe close behaviour. The period/liaison controls are inside the hero's compact period menu. A green coverage strip precedes the right-hand supervisor invoice grid and the narrow left-hand blue receipt. Single-family invoices without available ad-hoc aids share a row on desktop; mobile stacks the columns. The charity logo is retained.

Available ad-hoc aids open in each supervisor's picker. Selected aid cards are also displayed immediately beneath their own family row. All family and aid details remain in the sidebar and exported PNG. Sidebar family breakdowns are expandable per supervisor to keep the receipt compact; PNG output always includes every family in full, regardless of accordion state. The shared select/number/table enhancers do not restyle the component's explicitly native controls and tables.

The monthly GET/POST routes check for the three migration-034 tables and return `409 MIGRATIONS_REQUIRED` if absent. The UI distinguishes that error from invalid liaison, denied access, missing endpoint, server failure and connection failure. Failed loads do not show fabricated invoices or a green full-coverage claim. Choosing the period again permits retry. This does not run or replace a production database migration.

## Behaviour

- Home dashboard adds **ثبت ماهیانه** and a non-functional **صورت‌جلسه** placeholder beside the narrower action panel. Existing charity logo assets remain in place.
- A liaison sees only their existing shared `familyViewScope`; admin/CEO/supervision deputy can choose a liaison. All active scoped families are included, grouped by their current supervisor. Unassigned families form an explicit group.
- Fixed amounts come from `families.profile_data.monthlyAid`. Missing/invalid amounts block final submission; explicit zero remains included. Search and supervisor filters never change request coverage or totals.
- Only approved/accountant-referred, unpaid, unreserved ad-hoc cases from the same family are selectable. The receipt names each family's supervisor, aid category, title and amount; it does not collapse these into an anonymous “selected extras” total.
- Amounts use decimal strings and BigInt, never floating-point arithmetic. There is no fabricated example financial data in production code.
- Drafts are server-side. No family information or payment drafts are stored in localStorage.
- Review precedes submission. Final submission is a **financial request**, not approval or transfer: it creates fixed monthly cases in `در بررسی` for supervision deputy review, and references existing ad-hoc cases without duplicating them. Zero fixed amounts create coverage records but no zero-value financial case.
- Submitted requests are read-only snapshots, not paid receipts. They cannot currently be cancelled/amended through this module; ordinary case approval/payment continues in the existing workflow.
- Atomic batch transaction, period claims, family locks and a single-case database guard prevent duplicate monthly requests for the same family/period. Repeat submission of the same liaison/period returns the saved request. Changed scope/amounts/aid availability requires refreshing before retrying.
- Past periods and the next month are selectable. Dates use the Tehran Jalali calendar.

## Verification

`npm run typecheck`, `npm run frontend:check`, `npm run test:unit`, `npm run build`.
`CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/check-monthly-browser.mjs` runs mocked-API UI checks (320/390/1280px, light/dark, total calculation, filters, family/topic receipt, drafts, review/submit and stale-data errors). The fixture loads the real linked CSS plus shared lifecycle, controls, advanced UI, UX, product UI and enhanced-table scripts; checks also cover the compact period menu, migration/server errors and retry.

**Database integration/concurrency tests were not run in the implementation environment (no PostgreSQL service).** Before production, verify migration on a staging backup and test two simultaneous submissions, changed assignments, cancelled/paid ad-hoc cases, zero amounts and permission boundaries against PostgreSQL. This UI check does not replace those tests.

## PNG invoice export

- «دانلود فاکتور PNG» prepares all families, independent of search/supervisor filters. Each supervisor invoice also has its own export button. Click the generated download link to save the PNG.
- Output contains the original charity logo, liaison, Jalali period, draft/submitted status, every family's fixed amount, **selected** aid category/title/amount, supervisor subtotals and grand total. It explicitly says it is not a bank receipt.
- Export renders locally with Canvas and the bundled Persian font; no third-party image service/CDN, upload, financial write or new backend endpoint is involved. It uses the current in-memory selection, including unsaved changes, marked as draft.
- Output matches the narrow blue sidebar receipt: dark navy gradient, rounded corners, blue receipt icon, ticket notches/dashed separators, family/aid details and a large centered grand total (1320px PNG width). It is not an A4/table report. Long invoices paginate into individually downloadable PNGs instead of clipping content or silently losing families. Very large invoices are capped at 100 images with an explicit error; exporting by supervisor is available.
- Blob URLs are invalidated when the form changes/closes. No image is stored in localStorage. A file the user explicitly downloads stays on their device.
- Browser checks cover real PNG signature/dimensions/downloads, full coverage under filters, supervisor-only export, exact totals, selected aid descriptions, mobile/light/dark and long-invoice pagination.

### Per-family transfer breakdown

The sidebar receipt and the downloaded ticket both place each family's **own total transfer amount beside its name**, followed by separate fixed-monthly and ad-hoc subtotals. Every selected aid's category/title/amount appears directly below its family as well as in the lower consolidated aid summary. Supervisor totals remain reference totals, not a replacement for separate family transfers. Missing fixed amounts remain explicitly marked, never implied to be zero.
