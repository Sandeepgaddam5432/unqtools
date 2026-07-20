/**
 * IBAN Generator & Validator — Tool Manifest.
 * Tool #284 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "iban-generator-validator",
  name: "IBAN Generator & Validator",
  description:
    "Generate valid test IBANs for 70+ countries and validate/decode any IBAN with MOD-97 checksum, per-country length rules, BBAN structural breakdown, batch processing, and print/electronic formatting. 100% client-side — test/sandbox IBANs only, structurally valid but unassigned.",
  category: "developer",
  keywords: [
    "iban", "iban generator", "iban validator", "iban checker",
    "mod 97", "test iban", "iban format", "bban",
    "international bank account number", "iban decoder",
  ],
  icon: "credit-card",
  requiresNetwork: false,
  seo: {
    title: "IBAN Generator & Validator — MOD-97 Checksum + 70+ Countries | UnQTools",
    faq: [
      {
        q: "What is an IBAN and how does the MOD-97 checksum work?",
        a: "An International Bank Account Number (IBAN) is a standardized bank account identifier used in 90+ countries. It starts with a 2-letter country code, followed by 2 MOD-97 check digits, then a country-specific BBAN. To validate, we move the first 4 characters to the end, convert letters to numbers (A=10, B=11, ..., Z=35), and compute the integer modulo 97 — if the result is 1, the IBAN is structurally valid.",
      },
      {
        q: "How many countries does the IBAN registry cover?",
        a: "Our bundled ISO 13616 registry covers 70+ IBAN-enabled countries with each country's total IBAN length and BBAN segment structure (n = digits, a = uppercase letters, c = alphanumeric). Examples: Germany (DE, 22 chars, 18n), France (FR, 27 chars, 10n 11c 2n), UK (GB, 22 chars, 4a 6n 8n), Saudi Arabia (SA, 24 chars, 2n 18c).",
      },
      {
        q: "Can I generate test IBANs for sandbox use?",
        a: "Yes. Pick a country and we'll generate a structurally-valid IBAN with the correct length, BBAN character types, and MOD-97 check digits. These IBANs are sandbox/test only — they pass MOD-97 validation but are not assigned to real bank accounts. Never use them for actual financial transactions.",
      },
      {
        q: "Are my IBANs uploaded to a server?",
        a: "Never. Every MOD-97 calculation, structural check, and decode runs 100% client-side in your browser. There is no server endpoint, no analytics on the input field, and no logging of IBAN data. The history feature stores only operation metadata (counts + timestamps) in localStorage on this device — never the IBANs themselves.",
      },
      {
        q: "What extra features does this tool have versus other IBAN tools?",
        a: "(1) 70+ country ISO 13616 registry with BBAN structure. (2) MOD-97 checksum validate/generate. (3) Structural breakdown (bank code, branch code, account number where applicable). (4) Print format (4-char groups) and electronic format (no spaces). (5) Country picker with format specimen. (6) Batch validate up to 10k rows. (7) Batch generate up to 1k IBANs per click. (8) Color-coded component breakdown. (9) Per-country length validation with helpful hints. (10) Question-mark autocomplete for missing digits. (11) CSV export of batch results. (12) localStorage history (max 20, no IBANs stored). (13) Shareable URL with country + count + format encoded.",
      },
    ],
  },
  status: "done",
};
