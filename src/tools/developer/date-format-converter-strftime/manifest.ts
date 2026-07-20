/**
 * Date Format Converter (strftime / token) — Tool Manifest.
 * Tool #310 — Category 4 (Developer & Code).
 *
 * Convert a date into any custom format string and translate format patterns
 * between ecosystems — strftime (C/Python), Moment/Day.js, Luxon, date-fns,
 * Java SimpleDateFormat, .NET, and Unicode LDML. 200+ format tokens supported
 * across 7 systems. Live preview, footgun linter (YYYY week-year, DD vs dd,
 * hh vs HH, mm vs MM, SS vs ss), code snippets per library, best-effort
 * format detection, shareable URL. Fully client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "date-format-converter-strftime",
  name: "Date Format Converter (strftime / token)",
  description:
    "Convert a date into any custom format string and translate format patterns between 7 ecosystems — strftime (C/Python), Moment/Day.js, Luxon, date-fns, Java SimpleDateFormat, .NET, and Unicode LDML. 200+ format tokens. Live preview, footgun linter (YYYY week-year, DD vs dd, hh vs HH), code snippets per library, best-effort format detection. 100% client-side.",
  category: "developer",
  keywords: [
    "strftime", "date format", "format converter",
    "moment to date-fns", "luxon tokens", "java simpledateformat",
    "ldml", "icu tokens", "unicode date format",
    "yyyy vs yyyy", "footgun linter", "date tokens cheatsheet",
    "python strftime", ".net datetime format", "strftime to moment",
  ],
  icon: "calendar-days",
  requiresNetwork: false,
  seo: {
    title: "Date Format Converter — strftime ↔ Moment ↔ date-fns ↔ Java ↔ .NET ↔ LDML | UnQTools",
    faq: [
      {
        q: "Which date format systems are supported?",
        a: "Seven: strftime (C, Python, PHP, Ruby), Moment.js / Day.js, Luxon, date-fns v2+, Java SimpleDateFormat, .NET DateTime.ToString, and Unicode LDML / ICU. The tool formats a chosen date using any of these and cross-translates a pattern from one system to all others, so you can take a strftime pattern from a Python script and get the equivalent moment.js, date-fns, Java, .NET and LDML patterns side-by-side.",
      },
      {
        q: "Why does YYYY give the wrong year near December 31 / January 1?",
        a: "In Java SimpleDateFormat, Unicode LDML and date-fns, capital YYYY is the ISO WEEK-NUMBERING year, not the calendar year. The week-numbering year can differ from the calendar year by 1 around year-end (because ISO week 1 is the week with the year's first Thursday). Use lowercase yyyy for the calendar year. This tool's footgun linter flags YYYY with a warning whenever it appears in those systems.",
      },
      {
        q: "What's the difference between DD and dd in date-fns?",
        a: "It's the #1 date-fns footgun. Lowercase dd is day-of-month (01-31). Uppercase D is day-of-YEAR (1-366) — so DD gives a 2-digit day-of-year. If you write yyyy-DD-mm expecting 2026-15-01 you'll actually get 2026-015-01 (day-of-year). The linter flags DD and D in date-fns patterns to catch this.",
      },
      {
        q: "How do I escape literal text in each system?",
        a: "strftime: only % needs escaping (use %%). Moment/Day.js: wrap literal text in square brackets, e.g. YYYY'[Q1]'. date-fns, Java SimpleDateFormat, and Unicode LDML: wrap in single quotes, e.g. 'yyyy-MM-dd'. Two single quotes in a row ('') produce a literal single quote. Luxon has no escape syntax — letters are always tokens. .NET uses backslash per-letter escapes, e.g. yyyy\\-MM\\-dd. The converter handles all of these automatically when translating between systems.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) 7 format systems with 200+ total tokens. (2) Live preview against a chosen instant (UTC or local). (3) One-click cross-translate a pattern into all 6 other systems. (4) Footgun linter (YYYY week-year, DD vs dd, hh vs HH, mm vs MM, SS vs ss) with severity badges. (5) Token-by-token explanation of any pattern. (6) Token cheatsheet per system with live examples. (7) Best-effort format detection from a sample date string. (8) Code snippets for all 7 libraries (Python, moment, Day.js, Luxon, date-fns, Java, .NET). (9) Reference-date selector. (10) UTC toggle. (11) localStorage history (max 20, metadata only). (12) Shareable URL with pattern + system + UTC flag (fragment-encoded).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All formatting, conversion, and linting run locally with JavaScript Date and Intl.DateTimeFormat. History is stored in localStorage on this device only and contains metadata (pattern + system + preview), never your date input.",
      },
    ],
  },
  status: "done",
};
