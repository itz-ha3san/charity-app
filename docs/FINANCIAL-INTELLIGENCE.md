# Financial intelligence v1

Entry: **امور مالی → داشبورد مالی هوشمند**. Admin, CEO and finance/accountant positions only. Both endpoints repeat server authorization; family scope is composed with existing familyViewScope. The family picker returns only case number/id/archive and at most 30 results. No names, medical records, national IDs or bank accounts are fetched for analytics. All queries are parameterized, bounded to 12 complete Jalali months plus current-month totals, and run in a read-only repeatable-read snapshot. API responses inherit the application's private/no-store policy.

## Measures and coverage

- Unit: **toman**, same as existing financial UI. Grain: recorded financial payment, grouped by its accounting `jalali_year/month`, not creation date or bank settlement date.
- Historical charts show twelve **complete** months, with separate amount/count toggle and an exact accessible table. Current month is a separate partial-period card and never a training observation.
- Months before the first recorded payment under the same family/fund/category/archive filter are unknown, not zeros. Subsequent empty months mean zero *recorded* payments, not proven zero expenditure. Imported/missing history can bias results; no completeness is inferred.
- Noncash assistance and donor income are not aggregated as cash. No donor-receipt/shortfall forecast without verified receipts data.
- Archive default `all` preserves historical spending. `active`/`archived` filter historical populations explicitly; unpaid requests on archived families are always excluded from next-month commitments.
- Commitments: only approved/referred-to-accountant unpaid cases on active families with an explicit period matching next month. Undated, current-month and later requests are not silently assigned to next month. Unpaid cases have no fund assignment: applying fund filter sets commitment amount to `null`, not zero.

## Forecast

This first release is **statistical decision support, not an external LLM integration**. There are no API keys, third-party calls or invented AI explanations. Generated descriptions are rule-based Persian text explaining the calculated values. Adding a language model later needs explicit provider/retention decisions and data minimization; it must not calculate ledger totals or approve aid.

- At least three complete months containing positive recorded payments are required. Otherwise forecast and planning scenarios are unavailable; actual payments and known commitments remain visible.
- Candidate methods: three-month moving average, previous-month value. Integer-exact BigInt arithmetic; division truncates below one toman.
- Rolling origins after month three compare each prediction with the next observed accounting month, using only prior values. Mean absolute error selects the candidate; ties favor moving average. No seasonal/inflation assumptions.
- The displayed error is **in-sample model-selection backtest**, not independent future validation; the UI states this. Initial three-month forecasts have no holdout error and are labeled provisional.
- Planning low/high = prediction ± maximum absolute historical prediction error, floored at zero. Without holdouts, maximum deviation from last-three-month baseline is used. These are **heuristic planning scenarios, not calibrated confidence intervals**. Constant historical values may yield equal scenarios; future certainty is never implied.
- Approved commitments may overlap historical patterns. Each scenario is max(commitments, baseline scenario), never their sum. Per-category forecasts are independent; sparse categories have no forecast and category sums need not match total model.
- The what-if percentage is local simulation (-100..300 integer), does not write data, infer funding, prioritize households, or trigger payment.

## UI and provenance

Financial intelligence loads lazily, on same origin, without a chart CDN or new runtime dependency. The logo is local. Chart marks are proportional from a zero baseline; Persian exact amounts/counts are available in native tooltips, focus labels and an accessible table. The SVG fits mobile width with fewer month tick labels; every bar retains its exact focus/tooltip label and the full monthly table. Wide tables scroll only within their region. A component ResizeObserver redraws labels at actual chart width and disconnects on modal removal. RTL oldest-first ordering follows the VibeFarsi pattern. No synthetic demonstration data is shown in production.

Design references inspected: https://vibefarsi.ir/, https://vibefarsi.ir/components/chart, https://vibefarsi.ir/r/components/chart.json, https://vibefarsi.ir/components/password-input. These provided Persian RTL, same-unit amount/count separation, field and reveal-password interaction conventions. The project remains vanilla JavaScript; no third-party source copied, no new React/Tailwind migration, no attribution claim of library installation.

Login v3 reuses actual charity logos, a low-opacity decorative background mark, accessible labels/reveal control, Caps Lock feedback, reduced-motion support and mobile stacked layout. Fake case counts were removed from the login illustration. Existing authentication/session/security logic is unchanged. No claim of encrypted transport is shown on possible local HTTP installs; production still requires HTTPS.

## Validation

Run `npm run verify`, `npm run test:analytics:integration` with a fresh disposable `TEST_DATABASE_URL`, and `npm run test:browser`. New tests cover insufficient history, integer precision, rollover, holdout boundaries, overlap, family/fund/category/archive filters, authorization, bounded private-safe search and responsive UI. No production data is used in tests.
