# Shared Persian UI components

These are native DOM/CSS counterparts of the proposed React components, not a React/Tailwind migration. Existing classic-script load order, access controls, financial precision and approvals remain in place.

## Included
- Stat, bar/line chart and sparkline from the prior financial dashboard remain; the scenario now has an RTL range slider, Persian percentage output and reset, synchronized with the numeric field. It changes a simulation only, never recorded payments.
- The header bell is the only management-message inbox; it combines authorized direct messages and system alerts. The obsolete start-work/important-alerts card is removed; the bell and follow-up center use the same authorized system-alert source, with no duplicate message modal/button. The header count is the combined total; the sidebar follow-up badge still counts system alerts only.
- The 320px inbox has all/unread/messages/alerts filters, Tehran calendar-day groups, inline escaped message expansion, explicit acknowledgement, individual/batch read, keyboard dismissal/focus handling and internal scrolling. Reading (including batch reading) never acknowledges a message. If only one source fails, the other stays usable with a compact retry notice. Smaller scoped typography and lighter buttons support light/dark and mobile layouts.
- Message unread counts are computed before the 100-message response limit. When more unread items exist than the loaded window, the batch action is labelled as reading this page, not all historical messages. No new role permissions are granted.
- Shared inline alerts escape their text and distinguish information/success/warning/error. Loading feedback includes button spinners, reusable region overlays, aria-busy and reduced-motion support.
- Existing tables retain pagination/column controls and receive shared styling, column scopes and keyboard-focusable horizontal overflow regions.
- Family forms have structured national ID, card, IBAN and postal code fields, Persian/Arabic digit normalization, format feedback and informational bank detection. Optional account-holder/relation, IBAN, province/city/village and postal fields are stored in existing profile JSON; no schema migration is required. Existing detailed street address is retained.
- Province/city use native searchable datalists and linked validation; changing province clears city. Village is a separate optional field. Time fields keep native browser pickers with a Tehran-time Now shortcut and clear action. Contact timestamps explicitly use Tehran's current UTC+03:30 offset.

## Validation and compatibility
Browser and server use byte-identical rule/data modules. National ID checksum, card Luhn, Iranian IBAN mod-97, postal length/non-repetition and 24-hour time syntax are checked. These checks do **not** verify identity, account ownership, an account's active status, or the existence of a postal address. The bank-prefix list is informational and incomplete; an unknown prefix alone is not a rejection.

Formatting occurs on initialization and while typing, with caret-preserving digit grouping and blur feedback. Overlength values and unexpected letters are not silently truncated/deleted into valid identifiers. Canonical identifiers are strings with Latin digits, preserving leading zeroes. Full card/IBAN/national identifiers are not placed in notifications or test screenshots using real records.

Previously stored invalid card/IBAN/postal/location values may remain unchanged during an unrelated edit. Newly changed nonempty values must pass server validation. New-field changes by a liaison use the existing explicit-field review workflow; restricted summary responses do not include these fields. No additional role permissions or third-party data transmission were introduced.

## Geography source
`iran-divisions.js` / `iranDivisions.cjs` are a static snapshot of MIT-licensed `iran-cities-json@2.0.0` (31 provinces and its supplied city lists), obtained from the npm package. Source: https://github.com/jd1378/iran-cities-json . License: `IRAN-DIVISIONS-LICENSE.txt`.

This older snapshot is **not** an official up-to-date administrative registry and may omit renamed/new cities. Refresh the reviewed dataset before deployment where current exhaustive coverage is required. The UI does not pretend to provide an official address lookup.

## Checks
`npm run verify` covers type checking, unit/regression tests, dependency audit, build and frontend asset/load-order checks. `npm run test:browser` runs desktop/mobile component, finance and release tests. `tests/persian-fields.integration.test.ts` exercises real PostgreSQL writes, normalization, rejection, legacy preservation, privacy and approval. Integration/browser suites require a fresh synthetic test database, never production data.

The service-worker shell cache is v103; API responses remain uncached. A repository push does not itself prove production deployment.


## Monetary fields, responsive drawer and typography
- Shared native PriceInput behavior covers every existing monetary input: member income, insurance/treatment, debt, transport, utilities, installments, aid, housing deposit/rent, financial requests, specialist estimated/actual costs, approved amounts, budgets and cash donations/allocations.
- Display uses Persian digits and three-digit grouping. The fixed unit is **toman**, matching existing business storage; there is no rial conversion or editable currency switch. FormData and drawer results contain ungrouped Latin integer strings. Invalid letters, negative/decimal amounts and values above the JavaScript safe-integer range are rejected rather than silently sanitized. Existing field-specific minima remain in force.
- Non-monetary years, months, inventory quantities and scenario percentages are unchanged. Financial amounts still follow existing server validation, review and payment permissions.
- Short amount prompts use `AppUI.promptMoney`: a right-side native dialog on desktop and bottom drawer on mobile, with focus restoration, Escape/backdrop/cancel, internal scrolling, safe-area padding and a swipe handle. Confirming an amount alone does not perform a payment.
- Vazirmatn variable (100–900) is locally embedded in `public/fonts/vazirmatn.css`; no runtime Google/font-provider requests are made. Noto Arabic remains fallback. Original SIL OFL license is retained at `public/fonts/Vazirmatn-OFL.txt`. Source: https://github.com/rastikerdar/vazirmatn .

## Adaptive branded login CAPTCHA
After two failed sign-ins from an IP, login requires a slider puzzle made from the charity's existing logo. Normal first-attempt login is unchanged. Refresh generates a new image; the range is keyboard-operable and explicit verification reports success/failure. The server, not client JavaScript, validates the position.

`GET /auth/captcha` generates the PNG background/piece and an opaque HttpOnly, SameSite=Strict `/auth` cookie (Secure follows COOKIE_SECURE). The answer is not included in the JSON. `POST /auth/captcha/verify` verifies within a small tolerance. Challenges expire after two minutes; verified proofs expire within one minute and are consumed on the next gated login attempt, including an incorrect password attempt. Challenges bind to the requesting IP, rotate on refresh, allow at most five guesses and twelve issues per IP/minute, and have bounded in-memory storage. Responses remain private/no-store and are excluded from service-worker caching.

This is a lightweight first-party abuse barrier, **not a claim of strong bot resistance**. Existing password verification, IP throttles and account locks remain primary controls. Puzzle/proof state is process-local: restarting invalidates it, and multi-replica deployments require sticky routing or a shared TTL store. A visual puzzle does not provide a nonvisual equivalent; provide an accessible alternative before deploying where that is required. No external CAPTCHA service or new secret/configuration is needed. No database migration is added by this change.
