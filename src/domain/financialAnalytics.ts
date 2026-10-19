// Monetary arithmetic stays integer-exact. Estimates are decision support, never payment instructions.
export type Period = { year: number; month: number };
export function jalaliPeriod(now = new Date()): Period {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric' }).formatToParts(now).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
}
export function shiftPeriod(p: Period, offset: number): Period {
  const n = p.year * 12 + p.month - 1 + offset;
  return { year: Math.floor(n / 12), month: n % 12 + 1 };
}
const abs = (v: bigint) => v < 0n ? -v : v;
const mean = (v: bigint[]) => v.reduce((a, b) => a + b, 0n) / BigInt(v.length);
const predict = (v: bigint[], method: string) => method === 'last_month' ? v.at(-1)! : mean(v.slice(-3));
export function forecastRecordedMonths(values: string[]) {
  const v = values.map(BigInt);
  if (v.length < 3 || v.filter(x => x > 0n).length < 3) return { available: false as const, reason: 'INSUFFICIENT_HISTORY' };
  // Rolling-origin holdouts. Each origin sees preceding months only.
  const methods = ['mean_3', 'last_month'];
  const scores = methods.map(method => {
    const errors = v.slice(3).map((actual, i) => abs(actual - predict(v.slice(0, i + 3), method)));
    return { method, errors, mae: errors.length ? mean(errors) : null };
  });
  const best = scores.reduce((a, b) => b.mae !== null && a.mae !== null && b.mae < a.mae ? b : a);
  const estimate = predict(v, best.method);
  // A planning range, NOT a statistical confidence interval. With no holdouts use max recent deviation.
  const deviation = best.errors.length ? best.errors.reduce((a, b) => a > b ? a : b, 0n) : v.slice(-3).reduce((a, b) => abs(b - estimate) > a ? abs(b - estimate) : a, 0n);
  const low = estimate > deviation ? estimate - deviation : 0n;
  const lastBacktest = v.length > 3 ? { predicted: predict(v.slice(0, -1), best.method).toString(), actual: v.at(-1)!.toString() } : null;
  return { available: true as const, method: best.method, estimate: estimate.toString(), low: low.toString(), high: (estimate + deviation).toString(), mae: best.mae?.toString() ?? null, backtestMonths: best.errors.length, lastBacktest, rangeKind: 'historical_max_error_planning_range', historyMonths: v.length };
}
export function planningEnvelope(forecast: ReturnType<typeof forecastRecordedMonths>, committed: string) {
  const c = BigInt(committed);
  if (!forecast.available) return { low: null, likely: null, high: null };
  const floor = (v: string) => (BigInt(v) > c ? BigInt(v) : c).toString();
  // Commitments overlap historical spending. Do not add them a second time.
  return { low: floor(forecast.low), likely: floor(forecast.estimate), high: floor(forecast.high) };
}
