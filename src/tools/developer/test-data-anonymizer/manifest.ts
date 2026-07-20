/**
 * Test Data Anonymizer / Data Masking Tool — Tool Manifest.
 * Tool #300 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "test-data-anonymizer",
  name: "Test Data Anonymizer / Data Masking Tool",
  description:
    "Detect and anonymize PII in CSV/JSON/free-text — emails, phones, SSNs, credit cards, names, addresses, IPs, ZIPs, DOBs. Five masking strategies (mask, pseudonymize, generalize, fake, format-preserving) with deterministic seeded mapping for referential integrity. Format-preserving masks keep Luhn-valid cards, valid email shape, and valid phone digits. 100% client-side — your real data never leaves the browser.",
  category: "developer",
  keywords: [
    "data anonymization", "data masking", "pii masking", "anonymize test data",
    "csv anonymizer", "json anonymizer", "format preserving encryption",
    "deterministic pseudonymization", "free text pii detection",
    "data privacy tool", "anonymizer online", "mask ssn in csv",
  ],
  icon: "eye-off",
  requiresNetwork: false,
  seo: {
    title: "Test Data Anonymizer — PII Masking for CSV/JSON/Text | UnQTools",
    faq: [
      {
        q: "Is my data sent anywhere?",
        a: "No. All detection, masking, and export runs locally in your browser. There is no upload, no server, no telemetry. The privacy guarantee is the entire point of the tool — paste your dataset, configure strategies, download the anonymized version, and the original never leaves your machine. History stores only metadata (timestamp, row count, strategies used), never the actual data.",
      },
      {
        q: "What PII types are auto-detected?",
        a: "Eight PII types via regex + Luhn validation: emails (RFC 5322 simplified), US/International phone numbers (E.164 + national formats), US SSNs (with 900-999 / 666 / 000 invalidity checks), credit cards (13-19 digits, Luhn-validated), IPv4 addresses, US ZIP codes (5 and 5+4), dates of birth (ISO YYYY-MM-DD + MM/DD/YYYY), and person names (via a 200+ first/last name dictionary). For CSV input, the detector samples up to 50 rows per column to determine the dominant PII type.",
      },
      {
        q: "What masking strategies are available?",
        a: "Five strategies per PII type. (1) Mask — replace with asterisks preserving length (e.g., 'jane@example.com' → 'j***@e******.com'). (2) Pseudonymize — deterministic fake value via seeded mapping; same input always maps to same output, preserving referential integrity across columns and files. (3) Generalize — DOB→year only, ZIP→first 3 digits, age bands. (4) Fake — random realistic replacement from in-memory dictionaries (200+ first names, 200+ last names, 50+ streets, 50+ cities). (5) Format-preserving — Luhn-valid card replacement, valid-shape email, valid-digit phone. Redact (replace with [REDACTED]) is also available as a hard-core option.",
      },
      {
        q: "How does format-preserving masking work?",
        a: "Format-preserving replaces a real PII value with a fake one that retains the same structural validity. For credit cards, we generate a new Luhn-valid number of the same length using the same brand prefix. For emails, we keep the domain and substitute the local part with random alphanumeric characters of the same length. For phone numbers, we keep the country code and replace the subscriber digits with random ones. This means downstream validators (e.g., a payment form that checks Luhn) still accept the masked data — perfect for realistic test fixtures.",
      },
      {
        q: "What extra features does this tool have versus other anonymizers?",
        a: "(1) Eight PII types with regex+Luhn detection. (2) Five masking strategies (mask/pseudonymize/generalize/fake/format-preserving) + redact. (3) Deterministic seeded mapping for referential integrity across columns and runs. (4) CSV column-level auto-detection sampling up to 50 rows. (5) JSON deep traversal (objects + arrays + nested). (6) Free-text PII detection with positional replacement. (7) Format-preserving Luhn-valid card masking. (8) Generalization for DOB (→ year) and ZIP (→ 3-digit prefix). (9) Before/after preview diff. (10) Three input formats (CSV/JSON/text) with three export formats each. (11) Per-strategy per-type configuration matrix. (12) localStorage history max 20 (metadata only). (13) Shareable URL with seed + strategies encoded. (14) Privacy banner stating zero-upload guarantee.",
      },
    ],
  },
  status: "done",
};
