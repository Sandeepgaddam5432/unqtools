/**
 * Test ID Generator (SSN / Tax / National ID) — Tool Manifest.
 * Tool #299 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "test-id-generator",
  name: "Test ID Generator (SSN / Tax / National ID)",
  description:
    "Generate clearly-fake, format-valid national identifiers for testing — US SSN/EIN/ITIN, UK NINO, India PAN/Aadhaar, German Steuer-ID, Brazil CPF/CNPJ, Canada SIN, Spain NIF, France INSEE. Uses reserved/never-issued ranges where defined (SSN area 900-999, ITIN 9XX-7X-XXXX, SIN prefix 9, NINO prefix TN), correct per-country checksums (Verhoeff, Luhn, mod-11, mod-23, mod-97), validate any ID, bulk export to CSV/JSON/text. 100% client-side — test only, never real.",
  category: "developer",
  keywords: [
    "test ssn generator", "fake national id", "test tax id", "test ein",
    "aadhaar test number", "pan test number", "cpf generator validator",
    "cnpj generator", "nino generator", "steuer id generator",
    "sin generator", "nif generator", "insee generator", "verhoeff",
    "test id generator",
  ],
  icon: "id-card",
  requiresNetwork: false,
  seo: {
    title: "Test ID Generator — Fake SSN, EIN, NINO, Aadhaar, CPF, SIN | UnQTools",
    faq: [
      {
        q: "Are these national IDs real?",
        a: "No. Every ID this tool generates is format-valid (passes the country-specific checksum where one exists) but UNASSIGNED — wherever an officially reserved or never-issued range exists (US SSN area 900-999, US ITIN 9XX-7X-XXXX, Canada SIN prefix 9, UK NINO prefix TN/NT), we use it so output can never collide with a real person's ID. They are for sandbox / development / testing only. Never use generated IDs against live government or financial systems.",
      },
      {
        q: "Which countries and ID types are supported?",
        a: "Twelve ID types across nine countries: US SSN (test area 900-999), US EIN, US ITIN (9XX-7X-XXXX reserved), UK NINO (TN/NT administrative prefix), India PAN, India Aadhaar (Verhoeff checksum), German Steueridentifikationsnummer (mod-10 check), Brazil CPF (mod-11), Brazil CNPJ (mod-11), Canada SIN (Luhn, test prefix 9), Spain NIF/DNI (mod-23 letter), France INSEE/NIR (mod-97 control key).",
      },
      {
        q: "Which checksum algorithms are implemented?",
        a: "Four country-specific checksums: Verhoeff (Aadhaar), Luhn mod-10 (Canada SIN), mod-11 (Brazil CPF and CNPJ with their distinct weight tables), mod-23 letter (Spain NIF/DNI using the official TRWAGMYFPDXBNJZSQVHLCKE table), mod-97 control key (France INSEE/NIR), and the German Steuer-ID mod-10 weighted-sum check. SSN/EIN/ITIN/NINO/PAN have no formal checksum — they use structural rules and reserved ranges instead.",
      },
      {
        q: "Can I bulk-generate IDs for automated test suites?",
        a: "Yes. Generate up to 5,000 IDs per click, optionally restricted to a specific ID type, with optional separators (dashes/spaces) for display. Export the batch as JSON, CSV (type,value,format,country,checksum), or plain text with one ID per line. The validator accepts bulk input too — paste up to 10,000 IDs (one per line) and get per-row valid/invalid with a reason.",
      },
      {
        q: "What extra features does this tool have versus other ID generators?",
        a: "(1) Twelve ID types across nine countries with correct per-country formats. (2) Reserved/never-issued ranges used wherever defined. (3) Correct checksums: Verhoeff, Luhn, mod-11 (Brazil), mod-23 (Spain), mod-97 (France), mod-10 (Germany). (4) Validator with per-ID reason codes. (5) Bulk generate up to 5k per click. (6) Bulk validate up to 10k rows. (7) Toggle separators for display vs plain digits. (8) Per-type reserved-range badge. (9) Deterministic seed via mulberry32 for reproducible fixtures. (10) Three export formats (JSON/CSV/text). (11) localStorage history max 20. (12) Shareable URL with seed + type + count + separators. (13) Prominent test-only honesty banner.",
      },
    ],
  },
  status: "done",
};
