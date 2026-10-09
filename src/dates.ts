const asciiDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => {
  const fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
  return String(fa >= 0 ? fa : "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
});

export function normalizeDateToIso(value: unknown): string | null {
  const raw = asciiDigits(String(value ?? "").trim());
  const text = raw.match(/^\d{4}-\d{2}-\d{2}T/) ? raw.slice(0, 10) : raw.replace(/[/.]/g, "-");
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year > 1700) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (year < 1200 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    calendar: "persian", year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
  });
  const dayOfYear = month <= 6 ? (month - 1) * 31 + day - 1 : 186 + (month - 7) * 30 + day - 1;
  const roughDate = Date.UTC(year + 621, 2, 19) + dayOfYear * 86400000;
  for (let offset = -3; offset <= 3; offset++) {
    const date = new Date(roughDate + offset * 86400000);
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    if (Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day) {
      return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function daysUntilDate(value: unknown, today = new Date()): number | null {
  const iso = normalizeDateToIso(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const due = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((due - current) / 86400000);
}
