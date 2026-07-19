import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-json-mock-data-generator",
  name: "AI JSON Mock Data Generator",
  description:
    "Generate realistic mock data from a JSON Schema or a plain-English field description. Pure-JS faker-style generators (names, emails, UUIDs v4, dates, addresses, phone numbers, URLs, lorem ipsum, numbers, booleans, enums, arrays, nested objects). Constraint-aware (min/max, minLength/maxLength, enum, format, pattern). Seeded PRNG for reproducible output. Export to JSON, CSV, or INSERT SQL. History (localStorage), shareable URL, optional BYO-key LLM to infer a schema from a natural-language description. 100% client-side — no row caps, no upload.",
  category: "ai",
  keywords: [
    "mock data", "fake data", "faker", "faker.js", "json mock data",
    "mock data generator", "test data", "sample data", "mockaroo alternative",
    "fake json", "seeded random", "csv mock", "sql insert mock",
  ],
  icon: "flask-conical",
  requiresNetwork: false,
  seo: {
    title: "AI JSON Mock Data Generator — Faker-style, Unlimited Rows, Seeded | UnQTools",
    faq: [
      {
        q: "How does the mock data generator work?",
        a: "Provide a JSON Schema (paste one or write it inline) describing the shape of each record — types, formats, enums, constraints — and choose how many rows you want. The tool walks the schema and generates a realistic value for each field: names, emails, UUIDs, ISO dates, addresses, phone numbers, URLs, lorem ipsum, numbers in range, booleans, and enums. Nested objects and arrays are generated recursively. Output is rendered as JSON, CSV, or INSERT SQL. Everything runs locally in your browser with no row cap.",
      },
      {
        q: "Which JSON Schema keywords are supported?",
        a: "Types: string, number, integer, boolean, null, array, object. Formats: email, date-time, date, uuid, uri, ipv4, phone. Constraints: minimum, maximum, exclusiveMinimum, exclusiveMaximum, minLength, maxLength, minItems, maxItems, enum, pattern (basic), and const. Composition: anyOf (first valid branch), and array 'items' (single-schema or tuple). Unknown formats fall back to a sensible default for the type (e.g., a random word for an unannotated string).",
      },
      {
        q: "Can I get reproducible output?",
        a: "Yes. Enter any seed string and the tool uses a deterministic PRNG (mulberry32) seeded from a 32-bit hash of that string. The same schema + same seed + same row count always produces the same records. Leave the seed empty for fresh random output every time you click Generate.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) JSON-Schema-driven generation (paste any schema). (2) Faker-style generators: names, emails, UUID v4, ISO date-time, date-only, addresses (street/city/state/zip/country), phone numbers, URLs, lorem ipsum, integers, decimals, booleans, enums. (3) Nested objects and arrays (recursive). (4) Constraint-aware (min/max, min/maxLength, enum, pattern). (5) Seeded PRNG (mulberry32) for reproducible output. (6) Row count 1–10000. (7) JSON export (array or single object). (8) CSV export (flattened keys). (9) SQL INSERT export (auto table name). (10) History (localStorage, last 20). (11) Shareable URL with schema + options encoded. (12) Sample schema presets. (13) Optional BYO-key LLM to infer a schema from a natural-language description.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All schema parsing, mock value generation, and export rendering run locally in your browser. Your schemas and generated data never leave this device. The only network call is if you paste your own LLM API key and click 'Infer schema from description' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
