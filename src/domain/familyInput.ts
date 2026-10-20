import { personName, descriptiveText, mobile, optionalPhone, education, caseNumber, } from "../validation.js";
import { z } from "zod";
import {persianRules} from "./persianFields.js";
const validId = (v: string) => {
    if (!/^\d{10}$/.test(v) || /^(\d)\1{9}$/.test(v))
        return false;
    const r = v
        .slice(0, 9)
        .split("")
        .reduce((n, d, i) => n + Number(d) * (10 - i), 0) % 11, c = Number(v[9]);
    return r < 2 ? c === r : c === 11 - r;
}, nid = z.string().transform(persianRules.digits).refine(validId, "INVALID_NATIONAL_ID"), jsonbValue = (v: unknown) => v === undefined || v === null
    ? {}
    : typeof v === "string"
        ? JSON.stringify(v)
        : v, member = z
    .object({
    name: personName,
    relation: z.string().default(""),
    nationalId: nid,
    birthDate: z.string().default(""),
    education: education.optional(),
    job: descriptiveText.default(""),
    monthlyIncome: z.coerce.number().int().nonnegative().max(9000000000000).default(0),
})
    .passthrough(), note = z
    .object({
    text: z.string().min(1),
    status: z.string().default(""),
    institutionNote: z.string().default(""),
})
    .passthrough(), family = z
    .object({
    caseNumber: caseNumber,
    familySurname: personName,
    headName: personName,
    headNationalId: nid,
    headBirthDate: z.string().default(""),
    headPhone: mobile,
    headCardNumber: z
        .string().transform(persianRules.digits)
        .pipe(z.string().regex(/^\d{16}$/))
        .or(z.literal(""))
        .default(""),
    headIban: z.string().transform(persianRules.normalizeIban).pipe(z.string().max(26)).optional(),
    accountHolder: z.string().trim().max(120).optional(),
    accountRelation: z.string().trim().max(120).optional(),
    province: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    village: z.string().trim().max(120).optional(),
    postalCode: z.string().transform(persianRules.digits).pipe(z.string().max(10)).optional(),
    familyPhone: optionalPhone.default(""),
    headEducation: education.optional(),
    headJob: descriptiveText.default(""),
    insurance: z.any().optional(),
    housingType: z.string().default("other"),
    housingDeposit: z.number().nonnegative().default(0),
    housingRent: z.number().nonnegative().default(0),
    address: z.string().default(""),
    notes: z.string().default(""),
    priority: z.string().default("متوسط"),
    supervisorId: z.string().uuid().nullable().optional(),
    members: z.array(member).max(100).default([]),
    notesHistory: z.array(note).default([]),
})
    .passthrough();
export function normalizeHousing(f: Record<string, any>) {
    if (["ملکی", "owned", "owner"].includes(f.housingType)) {
        f.housingDeposit = 0;
        f.housingRent = 0;
        f.housing = { ...(f.housing ?? {}), deposit: 0, rent: 0 };
    }
}
export { family as familyInput, jsonbValue };
