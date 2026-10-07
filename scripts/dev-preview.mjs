// Local preview: serves public/ with mocked API responses so the UI can be
// viewed and clicked without PostgreSQL, migrations, TLS or a real login.
// Usage: npm run dev:preview   ->  http://127.0.0.1:8099/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = Number(process.env.PREVIEW_PORT || 8099);

const user = {
  id: "u1",
  name: "کاربر آزمایشی",
  username: "preview",
  role: "admin",
  position: "ceo",
  mustChangePassword: false,
};

const family = {
  id: "f1",
  caseNumber: "1402-0001",
  familySurname: "احمدی",
  headName: "مریم احمدی",
  headRelation: "سرپرست",
  headNationalId: "1234567890",
  headBirthDate: "1360/01/01",
  headPhone: "09120000000",
  familyPhone: "02100000000",
  headEducation: { level: "دیپلم", description: "دیپلم" },
  headJob: "خیاط",
  headCardNumber: "6037991234567890",
  incomeDescription: "کمک ماهانه",
  insurance: "تأمین اجتماعی",
  medical: "درمان تکمیلی",
  housingType: "استیجاری",
  housingRent: 3000000,
  address: "تهران، خیابان نمونه",
  debt: 0,
  transportationCost: 300000,
  utilityCost: 250000,
  monthlyInstallments: 0,
  monthlyAid: 1500000,
  priority: "عادی",
  nextFollowUp: "1403/05/01",
  archived: false,
  approvalStatus: "approved",
  members: [
    {
      id: "m1",
      name: "علی احمدی",
      relation: "فرزند",
      nationalId: "1234567891",
      birthDate: "1390/01/01",
      education: "پایه ششم",
      job: "محصل",
    },
  ],
  caseItems: [],
  notesHistory: [],
  notes: [],
  documents: [],
};

const families = [
  family,
  { ...family, id: "f2", caseNumber: "1402-0002", headName: "زهرا کریمی", familySurname: "کریمی" },
  { ...family, id: "f3", caseNumber: "1402-0003", headName: "حسن رضایی", familySurname: "رضایی" },
];

const respond = (pathname) => {
  if (pathname === "/auth/status") return { bootstrapped: true };
  if (pathname === "/auth/me") return { user };
  if (pathname === "/api/families") return { total: families.length, families };
  if (pathname.startsWith("/api/families/")) return { family };
  if (pathname === "/api/dashboard") return { active: 12, urgent: 3, overdue: 2 };
  if (pathname === "/api/alerts") return { unread: 4, alerts: [] };
  if (pathname === "/api/follow-ups/overdue") return { items: [] };
  return {};
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    if (pathname === "/auth/logout") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end("{}");
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(respond(pathname)));
  }
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = normalize(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Preview (mock data, no database): http://127.0.0.1:${PORT}/\n`);
});
