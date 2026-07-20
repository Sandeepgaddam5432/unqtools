/**
 * ISO 8601 Date Parser & Formatter — Tool Manifest.
 * Tool #309 — Category 4 (Developer & Code).
 *
 * Parse any ISO 8601 / RFC 3339 string into its components and render a date
 * into every ISO 8601 variant — calendar, week, ordinal, with/without offset,
 * fractional seconds and durations/intervals. Strict + lenient modes.
 * Forgiving tokenizer accepts basic + extended format, comma OR dot decimals,
 * negative/expanded years, leap seconds (:60), 24:00:00, week 53. Code
 * snippets in JS/Python/Java/Go. Fully client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "iso-8601-date-parser-formatter",
  name: "ISO 8601 Date Parser & Formatter",
  description:
    "Parse any ISO 8601 / RFC 3339 string into its components and format a date into every ISO 8601 variant — calendar, week, ordinal, datetime, duration, interval, recurring. Forgiving tokenizer accepts basic + extended format, comma or dot decimals, Z or offset, negative/expanded years, leap seconds, 24:00:00, week 53. Strict vs lenient modes. Code snippets in JS/Python/Java/Go. 100% client-side.",
  category: "developer",
  keywords: [
    "iso 8601", "iso 8601 parser", "iso 8601 formatter",
    "rfc 3339", "iso 8601 duration", "iso 8601 interval",
    "week date", "ordinal date", "iso 8601 validator",
    "pnydnm", "iso 8601 recurring", "expanded year",
    "leap second", "iso calendar", "basic format",
    "extended format",
  ],
  icon: "calendar-clock",
  requiresNetwork: false,
  seo: {
    title: "ISO 8601 Date Parser & Formatter — duration, interval, week, ordinal | UnQTools",
    faq: [
      {
        q: "What ISO 8601 formats does this parser accept?",
        a: "All of them: calendar dates (2026-01-15), week dates (2026-W03-4), ordinal dates (2026-015), times (13:45:30), datetimes with offset (2026-01-15T13:45:30+02:00), durations (P1Y2M10DT2H30M), intervals (start/end or start/duration), and recurring intervals (R5/start/duration). It also accepts basic format (20260115T134530Z), comma decimal separators (13:45:30,5), negative or expanded years (-0050, +12026), leap seconds (:60), and the special 24:00:00 end-of-day.",
      },
      {
        q: "What is the difference between Z and +00:00?",
        a: "Both denote UTC (zero offset). Z is the ISO 8601 shorthand for +00:00 and is the most common form. They are semantically identical — the same instant. This tool accepts both interchangeably and lets you normalize to either when re-formatting. Note that -00:00 is also valid in RFC 3339 (it means 'offset unknown, treat as UTC for display only'); we display it as Z in strict mode and preserve it in lenient mode.",
      },
      {
        q: "How do ISO 8601 week dates work?",
        a: "Week dates use the ISO week-numbering year, which can differ from the calendar year near January 1 or December 31. Week 1 is the week containing the year's first Thursday (equivalently, the week containing January 4). Weeks run Monday (day 1) through Sunday (day 7). So 2026-W01-1 is the Monday of week 1 of the ISO year 2026, which is 2025-12-29 in calendar form. Years with 53 weeks are those where January 1 falls on Thursday (or Wednesday in a leap year).",
      },
      {
        q: "What is a leap second and how is it handled?",
        a: "A leap second is a one-second adjustment (usually 23:59:60 UTC) inserted occasionally to keep UTC in sync with Earth's rotation. JavaScript Date cannot represent it and rolls over to the next day at 00:00:00. This parser correctly recognises 23:59:60 as a valid ISO 8601 time (strict mode, leap-second-aware) and represents it as nanosecond 60 within minute 59 of hour 23; on format-back we emit it literally rather than letting Date silently truncate it.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Parses every ISO 8601 variant: calendar, week, ordinal, time, datetime, duration, interval, recurring. (2) Forgiving tokenizer: basic and extended format, comma OR dot decimals, Z or explicit offset, expanded/negative years. (3) Strict vs lenient mode with explicit rejection reasons. (4) Formats a chosen instant into ALL ISO variants simultaneously (calendar, week, ordinal, basic, extended, with/without offset). (5) Week-date ↔ calendar ↔ ordinal conversion both directions. (6) Duration add/subtract with month/week semantics. (7) Interval / recurring parsing and rendering. (8) Leap second (:60) and 24:00:00 end-of-day support. (9) Code snippets in JS/Python/Java/Go. (10) Per-variant copy button. (11) localStorage history (max 20, metadata only). (12) Shareable URL with input + mode (fragment-encoded, never sent to server).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, formatting and arithmetic run locally with JavaScript Date and a custom tokenizer. History is stored in localStorage on this device only and contains metadata (kind of input, whether strict, length of input), never your raw date strings.",
      },
    ],
  },
  status: "done",
};
