/**
 * Edge-Case / Naughty String Generator — Tool Manifest.
 * Tool #293 — Category 4 (Developer & Code).
 *
 * Provides a curated, categorized library of "naughty" / edge-case test
 * strings — the Big List of Naughty Strings plus Unicode / emoji / RTL /
 * zalgo / injection / boundary inputs — to stress-test forms, parsers, and
 * APIs. Filter, search, batch-generate, and export ready-to-use fixtures
 * (JSON, CSV, Playwright, Jest, pytest). 100% client-side. Defensive-use
 * only — payloads are provided to help QA your own systems.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "naughty-string-generator",
  name: "Edge-Case / Naughty String Generator",
  description:
    "Browse, filter, and export a curated library of 200+ naughty edge-case test strings — the Big List of Naughty Strings plus Unicode, emoji, RTL/bidi overrides, zalgo, SQL injection, XSS payloads, control chars, zero-width, null bytes, boundary values, and more. Categorized, searchable, seed-reproducible random sampling, and one-click export to JSON, CSV, Playwright, Jest, or pytest fixtures. 100% client-side, defensive QA use only.",
  category: "developer",
  keywords: [
    "naughty strings", "big list of naughty strings", "blns",
    "edge case test strings", "unicode test input", "qa test fixtures",
    "sql injection test", "xss test payload", "zalgo", "rtl bidi",
    "boundary value test", "playwright fixture", "jest fixture", "pytest fixture",
    "fuzz testing",
  ],
  icon: "shield-alert",
  requiresNetwork: false,
  seo: {
    title: "Edge-Case / Naughty String Generator — BLNS + Unicode + Injection + Fixtures | UnQTools",
    faq: [
      {
        q: "What's in the naughty-string library?",
        a: "200+ curated strings in 12 categories: reserved keywords, special characters, control characters, zero-width / BOM, Unicode (Greek, Cyrillic, CJK, Arabic, etc.), emoji (including ZWJ sequences and modifier pairs), RTL/bidi overrides, zalgo, SQL injection, XSS / script injection, Unicode numbers, and boundary values (empty, whitespace, huge, max int, etc.).",
      },
      {
        q: "Why are SQL injection and XSS payloads included?",
        a: "Strictly for defensive QA of your own systems. The payloads are well-known — they appear in OWASP cheat sheets, the BLNS repo, and security textbooks. Use them to verify that your forms, parsers, and APIs correctly escape, parameterize, and reject dangerous input. Never run these against systems you don't own or have permission to test.",
      },
      {
        q: "Which export formats are supported?",
        a: "Plain text (one per line), JSON array, CSV (category,value), Playwright fixture (test.describe with test.each), Jest fixture (describe.each), and pytest fixture (parametrize). Each export preserves category metadata so your test reports show which category a failing string came from.",
      },
      {
        q: "Can I generate random samples from the library?",
        a: "Yes. Set a count and an optional seed (mulberry32 PRNG) and we sample that many strings — either across all categories or from a chosen subset. The same seed always produces the same sample, so test runs are reproducible.",
      },
      {
        q: "What extra features does this tool have versus the raw BLNS repo?",
        a: "(1) 200+ curated strings in 12 categorized buckets. (2) Per-category filter checkboxes. (3) Free-text search across both value and description. (4) Custom Unicode-range generator (enter start/end code points). (5) Boundary-value generator (empty, whitespace, huge, max int, surrogate pairs, BOM). (6) Seeded random sampling (mulberry32). (7) One-click export to plain text, JSON, CSV, Playwright, Jest, and pytest fixtures. (8) Per-string copy chip. (9) localStorage history (max 20). (10) Shareable config URL (fragment-encoded, never sent to server). (11) Defensive-use banner. (12) 100% client-side, fully offline.",
      },
    ],
  },
  status: "done",
};
