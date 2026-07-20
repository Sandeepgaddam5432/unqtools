/**
 * Mock CSV Data Generator — Tool Manifest.
 * Tool #297 — Category 4 (Developer & Code).
 *
 * Generates realistic mock CSV datasets — define columns + types, choose row
 * count, delimiter, quoting, header, line endings — produced fully in-browser
 * with RFC 4180 correctness and unlimited rows. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mock-csv-data-generator",
  name: "Mock CSV Data Generator",
  description:
    "Generate realistic mock CSV datasets — define columns with types (string, number, date, boolean, email, phone, name, address, uuid, url, custom), choose row count, delimiter (comma/semicolon/tab/pipe), header toggle, quoting policy, line endings (LF/CRLF), BOM toggle, infer columns from pasted header, seedable for reproducibility. Export as CSV/TSV/JSON. Unlimited rows, 100% client-side, no row caps, strict RFC 4180.",
  category: "developer",
  keywords: [
    "mock csv generator", "csv test data generator", "generate csv online unlimited",
    "fake csv data", "mock data", "csv faker", "tsv generator",
    "rfc 4180 csv", "test data csv", "csv mock data",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "Mock CSV Data Generator — Unlimited Rows, RFC 4180, Seeded | UnQTools",
    faq: [
      {
        q: "How does the Mock CSV Data Generator work?",
        a: "Define columns by giving each a name and a type (string, number, date, boolean, email, phone, first name, last name, full name, address, city, state, country, zip, company, uuid, url, paragraph, hex color, ipv4, ipv6, enum, regex, or custom constant). Choose a row count, delimiter (comma, semicolon, tab, pipe, custom), header on/off, quoting policy (always / minimal / none), line endings (LF / CRLF), and an optional BOM. The tool produces strict RFC 4180-compliant output that round-trips cleanly through any compliant parser.",
      },
      {
        q: "Is the generated data reproducible?",
        a: "Yes. The tool uses a deterministic, seedable mulberry32 PRNG. Enter the same seed and you get the identical dataset every time — useful for golden-file CI checks or sharing test fixtures. Switch the seed (or leave it blank for time-based) to get a fresh dataset for the same schema.",
      },
      {
        q: "What column types are supported?",
        a: "20+ faker types: string, number (with min/max), boolean, date (past/future/recent/iso), email, phone, first_name, last_name, full_name, username, street, city, state, country, zip, company, job_title, sentence, paragraph, url, uuid, ipv4, ipv6, hex_color, timestamp, age, money, enum (with weighted values), regex (with pattern), and constant. Each type produces type-appropriate realistic values. You can also infer column types from a pasted header row.",
      },
      {
        q: "Are my schemas or example data uploaded anywhere?",
        a: "No. Column definitions are processed entirely in your browser. Nothing is sent to a server. History (last 20 generations) is stored in localStorage on this device only, and the shareable URL encodes options in the fragment (after #) which browsers never transmit.",
      },
      {
        q: "What extras does this tool offer versus Mockaroo and generatedata.com?",
        a: "(1) Unlimited rows (no 1,000-row free cap). (2) Fully offline — your schema never leaves the browser. (3) Strict RFC 4180 escaping for embedded delimiters/quotes/newlines. (4) 4 delimiter presets + custom char. (5) 3 quoting policies (always / minimal / none). (6) LF vs CRLF line endings. (7) Excel-friendly BOM toggle. (8) 20+ faker types. (9) Weighted ENUMs. (10) Regex-pattern column. (11) Infer columns from pasted header row. (12) Blank % per column. (13) Unique constraint enforcement (collision-safe). (14) Deterministic mulberry32 seed. (15) CSV / TSV / JSON output. (16) localStorage history (max 20). (17) Shareable-URL config. (18) Copy / download .csv / .tsv / .json.",
      },
    ],
  },
  status: "done",
};
