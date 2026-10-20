# Shared Persian UI components

These are native DOM/CSS counterparts of the proposed React components, not a React/Tailwind migration. Existing classic-script load order, access controls, financial precision and approvals remain in place.

## Included
- Stat, bar/line chart and sparkline from the prior financial dashboard remain; the scenario now has an RTL range slider, Persian percentage output and reset, synchronized with the numeric field. It changes a simulation only, never recorded payments.
- The header bell is the only management-message inbox; it combines authorized direct messages and system alerts. The overview keeps only important system alerts and no duplicate message modal/button. The header count is the combined total; the sidebar follow-up badge still counts system alerts only.
- The 320px inbox has all/unread/messages/alerts filters, Tehran calendar-day groups, inline escaped message expansion, explicit acknowledgement, individual/batch read, keyboard dismissal/focus handling and internal scrolling. Reading (including batch reading) never acknowledges a message. If only one source fails, the other stays usable with a compact retry notice. Smaller scoped typography and lighter buttons support light/dark and mobile layouts.
- Message unread counts are computed before the 100-message response limit. When more unread items exist than the loaded window, the batch action is labelled as reading this page, not all historical messages. No new role permissions are granted.
- Shared inline alerts escape their text and distinguish information/success/warning/error. Loading feedback includes button spinners, reusable region overlays, aria-busy and reduced-motion support.
- Existing tables retain pagination/column controls and receive shared styling, column scopes and keyboard-focusable horizontal overflow regions.
- Family forms have structured national ID, card, IBAN and postal code fields, Persian/Arabic digit normalization, format feedback and informational bank detection. Optional account-holder/relation, IBAN, province/city/village and postal fields are stored in existing profile JSON; no schema migration is required. Existing detailed street address is retained.
- Province/city use native searchable datalists and linked validation; changing province clears city. Village is a separate optional field. Time fields keep native browser pickers with a Tehran-time Now shortcut and clear action. Contact timestamps explicitly use Tehran's current UTC+03:30 offset.

## Validation and compatibility
Browser and server use byte-identical rule/data modules. National ID checksum, card Luhn, Iranian IBAN mod-97, postal length/non-repetition and 24-hour time syntax are checked. These checks do **not** verify identity, account ownership, an account's active status, or the existence of a postal address. The bank-prefix list is informational and incomplete; an unknown prefix alone is not a rejection.

Formatting occurs on initialization/blur, not on each keystroke. Overlength values and unexpected letters are not silently truncated/deleted into valid identifiers. Canonical identifiers are strings with Latin digits, preserving leading zeroes. Full card/IBAN/national identifiers are not placed in notifications or test screenshots using real records.

Previously stored invalid card/IBAN/postal/location values may remain unchanged during an unrelated edit. Newly changed nonempty values must pass server validation. New-field changes by a liaison use the existing explicit-field review workflow; restricted summary responses do not include these fields. No additional role permissions or third-party data transmission were introduced.

## Geography source
`iran-divisions.js` / `iranDivisions.cjs` are a static snapshot of MIT-licensed `iran-cities-json@2.0.0` (31 provinces and its supplied city lists), obtained from the npm package. Source: https://github.com/jd1378/iran-cities-json . License: `IRAN-DIVISIONS-LICENSE.txt`.

This older snapshot is **not** an official up-to-date administrative registry and may omit renamed/new cities. Refresh the reviewed dataset before deployment where current exhaustive coverage is required. The UI does not pretend to provide an official address lookup.

## Checks
`npm run verify` covers type checking, unit/regression tests, dependency audit, build and frontend asset/load-order checks. `npm run test:browser` runs desktop/mobile component, finance and release tests. `tests/persian-fields.integration.test.ts` exercises real PostgreSQL writes, normalization, rejection, legacy preservation, privacy and approval. Integration/browser suites require a fresh synthetic test database, never production data.

The service-worker shell cache is v99; API responses remain uncached. A repository push does not itself prove production deployment.
