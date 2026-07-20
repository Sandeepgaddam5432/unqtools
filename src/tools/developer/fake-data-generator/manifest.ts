/**
 * Fake Data Generator (Faker-style) — Tool Manifest.
 * Tool #281 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "fake-data-generator",
  name: "Fake Data Generator (Faker)",
  description:
    "Generate realistic-but-fake structured records in JSON, CSV, NDJSON, or SQL. 40+ field types (names, emails, phones, addresses, UUIDs, IPs, URLs, companies, lorem ipsum, dates, money, colors, ISBNs, semver). Batch generation, deterministic seed, schema editor, history. 100% client-side.",
  category: "developer",
  keywords: [
    "fake data", "faker", "test data", "mock data", "data generator",
    "fake names", "fake emails", "fake addresses", "mock data generator",
    "faker js", "json generator", "csv generator",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "Fake Data Generator (Faker) — JSON, CSV, SQL Mock Data | UnQTools",
    faq: [
      {
        q: "What kind of fake data can I generate?",
        a: "40+ field types: first/last/full names, usernames, emails, phone numbers, street/city/state/ZIP/country/full address, UUID v4, IPv4/IPv6/MAC addresses, URLs, domains, slugs, color names, company names, job titles, catch phrases, lorem ipsum words/sentences/paragraphs, dates, ISO timestamps, money, ages, integers, decimals, booleans, hex/RGB colors, passwords, nationalities, ISBN-13, semver, timezones, and constants.",
      },
      {
        q: "How is the data generated — does it ever leave my browser?",
        a: "Everything runs locally in your browser with a deterministic mulberry32 PRNG. No data is uploaded to any server. Your schema, seed, and generated records never leave this device. The same seed always produces the same dataset, so you can reproduce test fixtures exactly.",
      },
      {
        q: "What export formats are supported?",
        a: "JSON (pretty-printed array), CSV (RFC 4180 — quoting and escaping handled), NDJSON (one JSON object per line, ideal for log/streaming pipelines), and SQL (escaped INSERT statements with a configurable table name). Copy to clipboard or download as a file.",
      },
      {
        q: "Can I generate large batches and reproducible datasets?",
        a: "Yes. Generate up to 100,000 rows per click. Because the PRNG is seeded, the same seed always yields the identical dataset — perfect for sharing test fixtures across teams or pinning regression tests. Use the share link to encode your schema + seed in the URL fragment (which browsers never transmit to servers).",
      },
      {
        q: "What extra features does this tool have versus other Faker tools?",
        a: "(1) 40+ field generators. (2) Schema editor (add/remove fields, set type + min/max/null %). (3) Deterministic seed for reproducibility. (4) Batch up to 100k rows. (5) Four export formats (JSON/CSV/NDJSON/SQL). (6) Live 5-row preview. (7) Default schema presets. (8) Null injection per field. (9) SQL string escaping. (10) CSV RFC 4180 quoting. (11) localStorage history (max 20). (12) Shareable URL with schema encoded in fragment.",
      },
    ],
  },
  status: "done",
};
