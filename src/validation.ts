import { z } from "zod";
import { normalizeDigits } from "./normalize.js";
// Names may include Persian/Latin letters, spaces, ZWNJ, apostrophes and hyphens.
export const personName = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[\p{L}\p{M}\s\u200c'’.-]+$/u, "NAME_LETTERS_ONLY");
export const descriptiveText = z
  .string()
  .trim()
  .max(120)
  .regex(/^[^\p{N}]*$/u, "TEXT_DIGITS_FORBIDDEN");
export const mobile = z
  .string()
  .transform(normalizeDigits)
  .pipe(z.string().regex(/^09\d{9}$/, "INVALID_MOBILE"));
export const phone = z
  .string()
  .transform(normalizeDigits)
  .pipe(z.string().regex(/^0\d{10}$/, "INVALID_PHONE"));
export const optionalPhone = phone.or(z.literal(""));
export const education = z.union([
  descriptiveText,
  z
    .object({
      description: descriptiveText.optional(),
      level: descriptiveText.optional(),
    })
    .passthrough(),
]);
export const caseNumber = z
  .string()
  .transform(normalizeDigits)
  .pipe(z.string().regex(/^[1-9]\d{0,2}$/, "CASE_NUMBER_1_TO_999"));
export const username = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, "INVALID_USERNAME")
  .transform((v) => v.toLowerCase());
