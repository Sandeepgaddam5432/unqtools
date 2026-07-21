/**
 * Markdown Linter & Formatter — Tool Manifest.
 * Tool #350 — Category 4 (Developer & Code).
 *
 * A pure-JS Markdown linter implementing 25+ markdownlint-compatible rules
 * (MD001, MD003, MD004, MD005, MD007, MD009, MD010, MD012, MD013, MD018,
 * MD019, MD022, MD025, MD026, MD029, MD030, MD031, MD032, MD033, MD034,
 * MD035, MD039, MD040, MD041, MD047, MD058) with auto-fix, configurable
 * options (line length, list marker, heading style, code fence style), and
 * a formatter that reconciles lint and Prettier-style rules. 100%
 * client-side — no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-linter-formatter",
  name: "Markdown Linter & Formatter",
  description:
    "Lint Markdown against 25+ markdownlint-compatible rules (MD001–MD058) and auto-format with one click. Violations are reported with rule IDs, line numbers, fixable markers, and human messages. Configurable options: line length, list marker (-, *, +), heading style (atx vs setext), code fence style (backtick vs tilde), emphasis style, trailing spaces, blank lines around blocks. Auto-fix, copy, download, history (localStorage, max 20), shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "markdownlint", "markdown linter", "markdown formatter",
    "prettier markdown", "md001", "md003", "markdown lint online",
    "markdown auto-fix", "markdown rules", "markdown style",
    "gfm linter", "commonmark linter", "markdown cleanup",
  ],
  icon: "check-check",
  requiresNetwork: false,
  seo: {
    title: "Markdown Linter & Formatter — markdownlint Rules (MD001–MD058) + Auto-fix | UnQTools",
    faq: [
      {
        q: "Which markdownlint rules are implemented?",
        a: "25+ rules: MD001 (heading-increment), MD003 (heading-style), MD004 (ul-style), MD005 (list-indent), MD007 (ul-indent), MD009 (trailing-spaces), MD010 (hard-tabs), MD012 (multiple-blanks), MD013 (line-length), MD018 (no-missing-space-atx), MD019 (no-multiple-space-atx), MD022 (blanks-around-headings), MD025 (single-h1), MD026 (no-trailing-punctuation), MD029 (ol-prefix), MD030 (list-marker-space), MD031 (blanks-around-fences), MD032 (blanks-around-lists), MD033 (no-inline-html), MD034 (no-bare-urls), MD035 (hr-style), MD039 (no-space-in-links), MD040 (fenced-code-language), MD041 (first-line-heading), MD047 (single-trailing-newline), MD058 (blanks-around-tables).",
      },
      {
        q: "Can the linter auto-fix violations?",
        a: "Yes. Most rules are auto-fixable: trailing whitespace, hard tabs, multiple blanks, heading style normalization, list marker consistency, blank lines around blocks, fenced code language defaults, and a single trailing newline. The Fix button applies all safe fixes; rules that conflict (e.g., MD013 line-length vs content) are reported but not auto-broken.",
      },
      {
        q: "Are the rule names compatible with markdownlint config files?",
        a: "Yes — every rule uses the canonical markdownlint ID (MD001, MD003, …). The default config mirrors the markdownlint recommended preset. You can toggle individual rules on/off and adjust parameters (line length, list marker, code fence style) in the UI; the active config is reflected in the shareable URL.",
      },
      {
        q: "Does this conflict with Prettier?",
        a: "No. The formatter applies a Prettier-compatible preset that disables rules which would conflict with Prettier's output (MD013 line-length, MD033 no-inline-html, MD034 no-bare-urls are relaxed) so the cleaned output is stable under both tools. You can also re-enable any rule if you prefer stricter behavior.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 25+ markdownlint-compatible rules with stable IDs. (2) Auto-fix for safe violations. (3) Per-rule toggle and parameter editor. (4) Line-precise violation list with fixable markers. (5) Configurable line length, list marker, heading style, code fence style, emphasis style. (6) Prettier-reconciled preset. (7) Copy / download (.md) / shareable URL with config. (8) History of recent lints (localStorage, max 20). (9) Stats: total violations, fixable count, by-rule breakdown. (10) Sample messy document loader. (11) Inline-disable comment helper (HTML comment). (12) Pure-JS — no Worker, no install, no upload. 100% client-side.",
      },
    ],
  },
  status: "done",
};
