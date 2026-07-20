/**
 * Date Format Converter (strftime / token) — pure logic.
 *
 * Convert a date into any custom format string and translate format patterns
 * between ecosystems — strftime (C/Python), Moment/Day.js tokens, Luxon,
 * date-fns, Java SimpleDateFormat, .NET, and Unicode LDML. 50+ format tokens
 * supported. Live preview, footgun linter (YYYY week-year, hh vs HH, etc.),
 * code snippets per library, and best-effort format detection.
 *
 * Pure functions only — no DOM, no network. Uses JavaScript Date +
 * Intl.DateTimeFormat for locale-aware rendering. Offline, deterministic.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FormatSystem =
  | "strftime"
  | "moment"
  | "luxon"
  | "date-fns"
  | "java"
  | "dotnet"
  | "ldml";

export type TokenConcept =
  | "year4"
  | "year2"
  | "year_unpadded"
  | "century"
  | "week_year4"
  | "week_year2"
  | "month2"
  | "month_unpadded"
  | "month_name"
  | "month_abbr"
  | "day2"
  | "day_unpadded"
  | "day_space_padded"
  | "day_of_year3"
  | "day_of_year2"
  | "day_of_year_unpadded"
  | "weekday_name"
  | "weekday_abbr"
  | "weekday_num_sun0"
  | "weekday_num_mon1"
  | "hour24_2"
  | "hour24_unpadded"
  | "hour24_space_padded"
  | "hour12_2"
  | "hour12_unpadded"
  | "hour12_space_padded"
  | "minute2"
  | "minute_unpadded"
  | "second2"
  | "second_unpadded"
  | "ms3"
  | "us6"
  | "ns9"
  | "ampm_upper"
  | "ampm_lower"
  | "tz_offset_colon"
  | "tz_offset_nocolon"
  | "tz_offset_short"
  | "tz_name"
  | "unix_sec"
  | "unix_ms"
  | "iso_week2"
  | "iso_week_unpadded"
  | "locale_date"
  | "locale_time"
  | "locale_datetime"
  | "iso_date"
  | "iso_time"
  | "iso_datetime"
  | "newline"
  | "tab"
  | "percent"
  | "literal_text";

export interface TokenDef {
  concept: TokenConcept;
  token: string;
  desc: string;
}

export interface FormatOptions {
  /** BCP-47 locale for locale-aware tokens (month/weekday names, AM/PM). */
  locale?: string;
  /** Use UTC instead of local time. Default false (local time). */
  utc?: boolean;
}

export interface LintIssue {
  severity: "warning" | "info";
  system: FormatSystem;
  token: string;
  message: string;
}

export interface ExplainItem {
  raw: string;
  concept: TokenConcept | null;
  desc: string | null;
  example: string;
}

export interface CodeSnippets {
  strftime: string;
  moment: string;
  dayjs: string;
  luxon: string;
  dateFns: string;
  java: string;
  dotnet: string;
}

export interface HistoryEntry {
  ts: number;
  pattern: string;
  system: FormatSystem;
  preview: string;
}

export interface DetectedFormat {
  pattern: string;
  system: FormatSystem;
  /** Confidence 0-1; lower = guessier. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants — token tables per system (50+ tokens total)
// ---------------------------------------------------------------------------

export const SYSTEM_LABELS: Record<FormatSystem, string> = {
  strftime: "strftime (C / Python)",
  moment: "Moment.js / Day.js",
  luxon: "Luxon",
  "date-fns": "date-fns",
  java: "Java SimpleDateFormat",
  dotnet: ".NET DateTime",
  ldml: "Unicode LDML / ICU",
};

export const TOKEN_TABLE: Record<FormatSystem, ReadonlyArray<TokenDef>> = {
  strftime: [
    { concept: "year4", token: "%Y", desc: "4-digit year (e.g. 2026)" },
    { concept: "year2", token: "%y", desc: "2-digit year (e.g. 26)" },
    { concept: "century", token: "%C", desc: "Century (e.g. 20)" },
    { concept: "month2", token: "%m", desc: "Month 01-12" },
    { concept: "month_name", token: "%B", desc: "Full month name (January)" },
    { concept: "month_abbr", token: "%b", desc: "Abbreviated month (Jan)" },
    { concept: "day2", token: "%d", desc: "Day of month 01-31" },
    { concept: "day_space_padded", token: "%e", desc: "Day space-padded ( 1-31)" },
    { concept: "day_of_year3", token: "%j", desc: "Day of year 001-366" },
    { concept: "hour24_2", token: "%H", desc: "Hour 24h 00-23" },
    { concept: "hour24_space_padded", token: "%k", desc: "Hour 24h space-padded 0-23" },
    { concept: "hour12_2", token: "%I", desc: "Hour 12h 01-12" },
    { concept: "hour12_space_padded", token: "%l", desc: "Hour 12h space-padded 1-12" },
    { concept: "minute2", token: "%M", desc: "Minute 00-59" },
    { concept: "second2", token: "%S", desc: "Second 00-60" },
    { concept: "ms3", token: "%L", desc: "Milliseconds 3-digit" },
    { concept: "us6", token: "%f", desc: "Microseconds 6-digit (Python)" },
    { concept: "ns9", token: "%N", desc: "Nanoseconds 9-digit (GNU)" },
    { concept: "ampm_upper", token: "%p", desc: "AM/PM uppercase" },
    { concept: "ampm_lower", token: "%P", desc: "am/pm lowercase (GNU)" },
    { concept: "weekday_abbr", token: "%a", desc: "Abbreviated weekday (Mon)" },
    { concept: "weekday_name", token: "%A", desc: "Full weekday (Monday)" },
    { concept: "weekday_num_sun0", token: "%w", desc: "Weekday 0-6 (Sun=0)" },
    { concept: "weekday_num_mon1", token: "%u", desc: "Weekday 1-7 (Mon=1)" },
    { concept: "iso_week2", token: "%V", desc: "ISO week 01-53" },
    { concept: "week_year4", token: "%G", desc: "ISO week-year 4-digit" },
    { concept: "week_year2", token: "%g", desc: "ISO week-year 2-digit" },
    { concept: "tz_offset_nocolon", token: "%z", desc: "Timezone offset +HHMM" },
    { concept: "tz_name", token: "%Z", desc: "Timezone name (UTC, EST)" },
    { concept: "unix_sec", token: "%s", desc: "Unix timestamp seconds" },
    { concept: "unix_ms", token: "%Q", desc: "Unix timestamp ms (GNU)" },
    { concept: "locale_date", token: "%x", desc: "Locale date" },
    { concept: "locale_time", token: "%X", desc: "Locale time" },
    { concept: "locale_datetime", token: "%c", desc: "Locale date and time" },
    { concept: "iso_date", token: "%F", desc: "ISO date (YYYY-MM-DD)" },
    { concept: "iso_time", token: "%T", desc: "ISO time (HH:MM:SS)" },
    { concept: "iso_datetime", token: "%D", desc: "Short date (MM/DD/YY)" },
    { concept: "newline", token: "%n", desc: "Newline" },
    { concept: "tab", token: "%t", desc: "Tab" },
    { concept: "percent", token: "%%", desc: "Literal %" },
  ],
  moment: [
    { concept: "year4", token: "YYYY", desc: "4-digit year" },
    { concept: "year2", token: "YY", desc: "2-digit year" },
    { concept: "year_unpadded", token: "Y", desc: "Year unpadded" },
    { concept: "month2", token: "MM", desc: "Month 01-12" },
    { concept: "month_unpadded", token: "M", desc: "Month 1-12" },
    { concept: "month_name", token: "MMMM", desc: "Full month name" },
    { concept: "month_abbr", token: "MMM", desc: "Abbreviated month" },
    { concept: "day2", token: "DD", desc: "Day 01-31" },
    { concept: "day_unpadded", token: "D", desc: "Day 1-31" },
    { concept: "day_of_year3", token: "DDDD", desc: "Day of year 001-366" },
    { concept: "day_of_year_unpadded", token: "DDD", desc: "Day of year 1-366" },
    { concept: "weekday_name", token: "dddd", desc: "Full weekday name" },
    { concept: "weekday_abbr", token: "ddd", desc: "Abbreviated weekday" },
    { concept: "weekday_num_sun0", token: "d", desc: "Weekday 0-6 (Sun=0)" },
    { concept: "hour24_2", token: "HH", desc: "Hour 24h 00-23" },
    { concept: "hour24_unpadded", token: "H", desc: "Hour 24h 0-23" },
    { concept: "hour12_2", token: "hh", desc: "Hour 12h 01-12" },
    { concept: "hour12_unpadded", token: "h", desc: "Hour 12h 1-12" },
    { concept: "minute2", token: "mm", desc: "Minute 00-59" },
    { concept: "minute_unpadded", token: "m", desc: "Minute 0-59" },
    { concept: "second2", token: "ss", desc: "Second 00-59" },
    { concept: "second_unpadded", token: "s", desc: "Second 0-59" },
    { concept: "ms3", token: "SSS", desc: "Milliseconds 3-digit" },
    { concept: "ampm_upper", token: "A", desc: "AM/PM uppercase" },
    { concept: "ampm_lower", token: "a", desc: "am/pm lowercase" },
    { concept: "iso_week2", token: "WW", desc: "ISO week 01-53" },
    { concept: "iso_week_unpadded", token: "W", desc: "ISO week 1-53" },
    { concept: "week_year4", token: "GGGG", desc: "ISO week-year 4-digit" },
    { concept: "week_year2", token: "GG", desc: "ISO week-year 2-digit" },
    { concept: "tz_offset_colon", token: "Z", desc: "Offset +HH:MM" },
    { concept: "tz_offset_nocolon", token: "ZZ", desc: "Offset +HHMM" },
    { concept: "unix_sec", token: "X", desc: "Unix seconds" },
    { concept: "unix_ms", token: "x", desc: "Unix milliseconds" },
  ],
  luxon: [
    { concept: "year4", token: "yyyy", desc: "4-digit year" },
    { concept: "year2", token: "yy", desc: "2-digit year" },
    { concept: "month2", token: "MM", desc: "Month 01-12" },
    { concept: "month_unpadded", token: "M", desc: "Month 1-12" },
    { concept: "month_name", token: "MMMM", desc: "Full month name" },
    { concept: "month_abbr", token: "MMM", desc: "Abbreviated month" },
    { concept: "day2", token: "dd", desc: "Day 01-31" },
    { concept: "day_unpadded", token: "d", desc: "Day 1-31" },
    { concept: "day_of_year3", token: "ooo", desc: "Day of year 001-366" },
    { concept: "weekday_name", token: "cccc", desc: "Standalone full weekday" },
    { concept: "weekday_abbr", token: "ccc", desc: "Abbreviated weekday" },
    { concept: "weekday_num_mon1", token: "c", desc: "Weekday 1-7 (Mon=1)" },
    { concept: "hour24_2", token: "HH", desc: "Hour 24h 00-23" },
    { concept: "hour24_unpadded", token: "H", desc: "Hour 24h 0-23" },
    { concept: "hour12_2", token: "hh", desc: "Hour 12h 01-12" },
    { concept: "hour12_unpadded", token: "h", desc: "Hour 12h 1-12" },
    { concept: "minute2", token: "mm", desc: "Minute 00-59" },
    { concept: "second2", token: "ss", desc: "Second 00-59" },
    { concept: "ms3", token: "SSS", desc: "Milliseconds 3-digit" },
    { concept: "ampm_upper", token: "a", desc: "AM/PM (lowercased form is locale-dependent)" },
    { concept: "iso_week2", token: "WW", desc: "ISO week 01-53" },
    { concept: "week_year4", token: "kkkk", desc: "ISO week-year 4-digit" },
    { concept: "week_year2", token: "kk", desc: "ISO week-year 2-digit" },
    { concept: "tz_offset_colon", token: "Z", desc: "Offset +HH:MM" },
    { concept: "tz_offset_nocolon", token: "ZZ", desc: "Offset +HHMM" },
  ],
  "date-fns": [
    { concept: "year4", token: "yyyy", desc: "4-digit calendar year" },
    { concept: "year2", token: "yy", desc: "2-digit year" },
    { concept: "year_unpadded", token: "y", desc: "Year unpadded" },
    { concept: "week_year4", token: "YYYY", desc: "Week-numbering year (footgun!)" },
    { concept: "week_year2", token: "YY", desc: "2-digit week-numbering year" },
    { concept: "month2", token: "MM", desc: "Month 01-12" },
    { concept: "month_unpadded", token: "M", desc: "Month 1-12" },
    { concept: "month_name", token: "MMMM", desc: "Full month name" },
    { concept: "month_abbr", token: "MMM", desc: "Abbreviated month" },
    { concept: "day2", token: "dd", desc: "Day 01-31" },
    { concept: "day_unpadded", token: "d", desc: "Day 1-31" },
    { concept: "day_of_year3", token: "DDD", desc: "Day of year 001-366" },
    { concept: "day_of_year2", token: "DD", desc: "Day of year 01-366 (footgun: use dd for day-of-month)" },
    { concept: "day_of_year_unpadded", token: "D", desc: "Day of year 1-366" },
    { concept: "weekday_name", token: "EEEE", desc: "Full weekday name" },
    { concept: "weekday_abbr", token: "EEE", desc: "Abbreviated weekday" },
    { concept: "weekday_num_sun0", token: "i", desc: "ISO weekday 1-7 (Mon=1)" },
    { concept: "hour24_2", token: "HH", desc: "Hour 24h 00-23" },
    { concept: "hour24_unpadded", token: "H", desc: "Hour 24h 0-23" },
    { concept: "hour12_2", token: "hh", desc: "Hour 12h 01-12" },
    { concept: "hour12_unpadded", token: "h", desc: "Hour 12h 1-12" },
    { concept: "minute2", token: "mm", desc: "Minute 00-59" },
    { concept: "minute_unpadded", token: "m", desc: "Minute 0-59" },
    { concept: "second2", token: "ss", desc: "Second 00-59" },
    { concept: "second_unpadded", token: "s", desc: "Second 0-59" },
    { concept: "ms3", token: "SSS", desc: "Milliseconds 3-digit" },
    { concept: "ampm_upper", token: "a", desc: "am/pm lowercase (date-fns convention)" },
    { concept: "ampm_lower", token: "aaa", desc: "am/pm short form" },
    { concept: "iso_week2", token: "II", desc: "ISO week 01-53" },
    { concept: "tz_offset_colon", token: "xxx", desc: "Offset +HH:MM" },
    { concept: "tz_offset_nocolon", token: "xx", desc: "Offset +HHMM" },
    { concept: "tz_offset_short", token: "x", desc: "Offset +HH" },
  ],
  java: [
    { concept: "year4", token: "yyyy", desc: "4-digit calendar year" },
    { concept: "year2", token: "yy", desc: "2-digit year" },
    { concept: "week_year4", token: "YYYY", desc: "Week year (footgun! use yyyy)" },
    { concept: "month2", token: "MM", desc: "Month 01-12" },
    { concept: "month_unpadded", token: "M", desc: "Month 1-12" },
    { concept: "month_name", token: "MMMM", desc: "Full month name" },
    { concept: "month_abbr", token: "MMM", desc: "Abbreviated month" },
    { concept: "day2", token: "dd", desc: "Day 01-31" },
    { concept: "day_unpadded", token: "d", desc: "Day 1-31" },
    { concept: "day_of_year3", token: "DDD", desc: "Day of year 001-366" },
    { concept: "day_of_year_unpadded", token: "D", desc: "Day of year 1-366" },
    { concept: "weekday_name", token: "EEEE", desc: "Full weekday name" },
    { concept: "weekday_abbr", token: "EEE", desc: "Abbreviated weekday" },
    { concept: "weekday_num_mon1", token: "u", desc: "Weekday 1-7 (Mon=1)" },
    { concept: "hour24_2", token: "HH", desc: "Hour 24h 00-23" },
    { concept: "hour24_unpadded", token: "H", desc: "Hour 24h 0-23" },
    { concept: "hour12_2", token: "hh", desc: "Hour 12h 01-12" },
    { concept: "hour12_unpadded", token: "h", desc: "Hour 12h 1-12" },
    { concept: "minute2", token: "mm", desc: "Minute 00-59" },
    { concept: "minute_unpadded", token: "m", desc: "Minute 0-59" },
    { concept: "second2", token: "ss", desc: "Second 00-59" },
    { concept: "second_unpadded", token: "s", desc: "Second 0-59" },
    { concept: "ms3", token: "SSS", desc: "Milliseconds 3-digit" },
    { concept: "ampm_upper", token: "a", desc: "AM/PM marker" },
    { concept: "iso_week2", token: "ww", desc: "Week of year (locale)" },
    { concept: "tz_offset_nocolon", token: "Z", desc: "RFC 822 offset +HHMM" },
    { concept: "tz_offset_colon", token: "XXX", desc: "ISO 8601 offset +HH:MM" },
    { concept: "tz_name", token: "zzzz", desc: "Timezone long name" },
  ],
  dotnet: [
    { concept: "year4", token: "yyyy", desc: "4-digit year" },
    { concept: "year2", token: "yy", desc: "2-digit year" },
    { concept: "year_unpadded", token: "y", desc: "Year no padding" },
    { concept: "month2", token: "MM", desc: "Month 01-12" },
    { concept: "month_unpadded", token: "M", desc: "Month 1-12" },
    { concept: "month_name", token: "MMMM", desc: "Full month name" },
    { concept: "month_abbr", token: "MMM", desc: "Abbreviated month" },
    { concept: "day2", token: "dd", desc: "Day 01-31" },
    { concept: "day_unpadded", token: "d", desc: "Day 1-31" },
    { concept: "day_space_padded", token: "dd", desc: "Day space-padded (same as dd in .NET)" },
    { concept: "weekday_name", token: "dddd", desc: "Full weekday name" },
    { concept: "weekday_abbr", token: "ddd", desc: "Abbreviated weekday" },
    { concept: "hour24_2", token: "HH", desc: "Hour 24h 00-23" },
    { concept: "hour24_unpadded", token: "H", desc: "Hour 24h 0-23" },
    { concept: "hour12_2", token: "hh", desc: "Hour 12h 01-12" },
    { concept: "hour12_unpadded", token: "h", desc: "Hour 12h 1-12" },
    { concept: "minute2", token: "mm", desc: "Minute 00-59" },
    { concept: "minute_unpadded", token: "m", desc: "Minute 0-59" },
    { concept: "second2", token: "ss", desc: "Second 00-59" },
    { concept: "second_unpadded", token: "s", desc: "Second 0-59" },
    { concept: "ms3", token: "fff", desc: "Milliseconds 3-digit" },
    { concept: "us6", token: "ffffff", desc: "Microseconds 6-digit" },
    { concept: "ns9", token: "fffffffff", desc: "Nanoseconds 9-digit" },
    { concept: "ampm_upper", token: "tt", desc: "AM/PM" },
    { concept: "tz_offset_colon", token: "zzz", desc: "Offset +HH:MM" },
    { concept: "tz_offset_nocolon", token: "zz", desc: "Offset +HHMM" },
    { concept: "tz_offset_short", token: "z", desc: "Offset +H" },
  ],
  ldml: [
    { concept: "year4", token: "yyyy", desc: "Calendar year (4-digit minimum)" },
    { concept: "year2", token: "yy", desc: "2-digit year" },
    { concept: "year_unpadded", token: "y", desc: "Year (variable width)" },
    { concept: "week_year4", token: "YYYY", desc: "Week year (footgun!)" },
    { concept: "month2", token: "MM", desc: "Month 01-12" },
    { concept: "month_unpadded", token: "M", desc: "Month 1-12" },
    { concept: "month_name", token: "MMMM", desc: "Full month name" },
    { concept: "month_abbr", token: "MMM", desc: "Abbreviated month" },
    { concept: "day2", token: "dd", desc: "Day 01-31" },
    { concept: "day_unpadded", token: "d", desc: "Day 1-31" },
    { concept: "day_of_year3", token: "DDD", desc: "Day of year 001-366" },
    { concept: "weekday_name", token: "EEEE", desc: "Full weekday name" },
    { concept: "weekday_abbr", token: "EEE", desc: "Abbreviated weekday" },
    { concept: "weekday_num_mon1", token: "e", desc: "Local weekday" },
    { concept: "hour24_2", token: "HH", desc: "Hour 24h 00-23" },
    { concept: "hour24_unpadded", token: "H", desc: "Hour 24h 0-23" },
    { concept: "hour12_2", token: "hh", desc: "Hour 12h 01-12" },
    { concept: "hour12_unpadded", token: "h", desc: "Hour 12h 1-12" },
    { concept: "minute2", token: "mm", desc: "Minute 00-59" },
    { concept: "minute_unpadded", token: "m", desc: "Minute 0-59" },
    { concept: "second2", token: "ss", desc: "Second 00-59" },
    { concept: "second_unpadded", token: "s", desc: "Second 0-59" },
    { concept: "ms3", token: "SSS", desc: "Milliseconds 3-digit" },
    { concept: "ampm_upper", token: "a", desc: "AM/PM marker" },
    { concept: "iso_week2", token: "ww", desc: "Week of year" },
    { concept: "tz_offset_colon", token: "XXX", desc: "ISO 8601 offset +HH:MM" },
    { concept: "tz_offset_nocolon", token: "XX", desc: "Offset +HHMM" },
    { concept: "tz_name", token: "zzzz", desc: "Timezone long name" },
  ],
};

// Build lookup maps: token -> concept, per system.
const TOKEN_LOOKUP: Record<FormatSystem, Map<string, TokenConcept>> = (() => {
  const out: Partial<Record<FormatSystem, Map<string, TokenConcept>>> = {};
  for (const sys of Object.keys(TOKEN_TABLE) as FormatSystem[]) {
    const m = new Map<string, TokenConcept>();
    // Sort tokens by length descending so longest-match wins.
    const sorted = [...TOKEN_TABLE[sys]].sort((a, b) => b.token.length - a.token.length);
    for (const def of sorted) m.set(def.token, def.concept);
    out[sys] = m;
  }
  return out as Record<FormatSystem, Map<string, TokenConcept>>;
})();

// Reverse map: concept -> token, per system.
const CONCEPT_LOOKUP: Record<FormatSystem, Map<TokenConcept, string>> = (() => {
  const out: Partial<Record<FormatSystem, Map<TokenConcept, string>>> = {};
  for (const sys of Object.keys(TOKEN_TABLE) as FormatSystem[]) {
    const m = new Map<TokenConcept, string>();
    for (const def of TOKEN_TABLE[sys]) {
      // Keep the first token for each concept (so prefer the order listed).
      if (!m.has(def.concept)) m.set(def.concept, def.token);
    }
    out[sys] = m;
  }
  return out as Record<FormatSystem, Map<TokenConcept, string>>;
})();

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

export interface ParsedToken {
  type: "literal" | "token";
  text?: string;
  raw?: string;
  concept?: TokenConcept | null;
}

export function tokenize(pattern: string, system: FormatSystem): ParsedToken[] {
  if (!pattern) return [];
  const out: ParsedToken[] = [];
  const lookup = TOKEN_LOOKUP[system];
  let i = 0;
  let lit = "";

  const flushLit = () => {
    if (lit) { out.push({ type: "literal", text: lit }); lit = ""; }
  };

  if (system === "strftime") {
    while (i < pattern.length) {
      const ch = pattern[i];
      if (ch === "%") {
        const next = pattern[i + 1];
        if (!next) {
          lit += ch;
          i++;
          continue;
        }
        // Try %% first (longest match)
        const twoChar = pattern.slice(i, i + 2);
        if (lookup.has(twoChar)) {
          flushLit();
          out.push({ type: "token", raw: twoChar, concept: lookup.get(twoChar) ?? null });
          i += 2;
          continue;
        }
        // Single-char after %
        const singleToken = `%${next}`;
        if (lookup.has(singleToken)) {
          flushLit();
          out.push({ type: "token", raw: singleToken, concept: lookup.get(singleToken) ?? null });
          i += 2;
          continue;
        }
        // Unknown % escape — preserve % and char as literal
        lit += ch;
        i++;
      } else {
        lit += ch;
        i++;
      }
    }
    flushLit();
    return out;
  }

  // Moment/Day.js: brackets [...] are literal
  if (system === "moment") {
    while (i < pattern.length) {
      const ch = pattern[i];
      if (ch === "[") {
        flushLit();
        const end = pattern.indexOf("]", i + 1);
        if (end < 0) {
          lit += pattern.slice(i);
          break;
        }
        lit += pattern.slice(i + 1, end);
        i = end + 1;
        // Brackets produce literal text directly.
        continue;
      }
      if (/[A-Za-z]/.test(ch)) {
        // Run of same letter
        let j = i + 1;
        while (j < pattern.length && pattern[j] === ch) j++;
        const token = pattern.slice(i, j);
        // Try longest match (some systems have multi-char tokens like "DDDD")
        let matched = "";
        for (let k = token.length; k >= 1; k--) {
          const sub = token.slice(0, k);
          if (lookup.has(sub)) { matched = sub; break; }
        }
        if (matched) {
          flushLit();
          out.push({ type: "token", raw: matched, concept: lookup.get(matched) ?? null });
          // Leftover letters in the run become literal
          if (token.length > matched.length) {
            out.push({ type: "literal", text: token.slice(matched.length) });
          }
          i += matched.length;
        } else {
          lit += ch;
          i++;
        }
      } else {
        lit += ch;
        i++;
      }
    }
    flushLit();
    return out;
  }

  // Java/.NET/date-fns/Luxon/LDML: repeated letters; single-quoted 'literal' is literal
  if (system === "java" || system === "date-fns" || system === "ldml") {
    while (i < pattern.length) {
      const ch = pattern[i];
      if (ch === "'") {
        flushLit();
        // '' = literal single quote; 'text' = literal text
        if (pattern[i + 1] === "'") {
          lit += "'";
          i += 2;
          continue;
        }
        const end = pattern.indexOf("'", i + 1);
        if (end < 0) {
          lit += pattern.slice(i + 1);
          break;
        }
        lit += pattern.slice(i + 1, end);
        i = end + 1;
        continue;
      }
      if (/[A-Za-z]/.test(ch)) {
        let j = i + 1;
        while (j < pattern.length && pattern[j] === ch) j++;
        const token = pattern.slice(i, j);
        let matched = "";
        for (let k = token.length; k >= 1; k--) {
          const sub = token.slice(0, k);
          if (lookup.has(sub)) { matched = sub; break; }
        }
        if (matched) {
          flushLit();
          out.push({ type: "token", raw: matched, concept: lookup.get(matched) ?? null });
          if (token.length > matched.length) {
            out.push({ type: "literal", text: token.slice(matched.length) });
          }
          i += matched.length;
        } else {
          lit += ch;
          i++;
        }
      } else {
        lit += ch;
        i++;
      }
    }
    flushLit();
    return out;
  }

  // Luxon / .NET: no quote-escape; just repeated letters
  while (i < pattern.length) {
    const ch = pattern[i];
    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1;
      while (j < pattern.length && pattern[j] === ch) j++;
      const token = pattern.slice(i, j);
      let matched = "";
      for (let k = token.length; k >= 1; k--) {
        const sub = token.slice(0, k);
        if (lookup.has(sub)) { matched = sub; break; }
      }
      if (matched) {
        flushLit();
        out.push({ type: "token", raw: matched, concept: lookup.get(matched) ?? null });
        if (token.length > matched.length) {
          out.push({ type: "literal", text: token.slice(matched.length) });
        }
        i += matched.length;
      } else {
        lit += ch;
        i++;
      }
    } else {
      lit += ch;
      i++;
    }
  }
  flushLit();
  return out;
}

// ---------------------------------------------------------------------------
// Concept rendering
// ---------------------------------------------------------------------------

function pad(n: number, width: number): string {
  const s = String(Math.abs(n));
  return s.length >= width ? s : s.padStart(width, "0");
}

function getISOWeek(date: Date): { weekYear: number; week: number } {
  const d = new Date(date.getTime());
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + (4 - dow));
  const isoYear = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const week = Math.floor((d.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
  return { weekYear: isoYear, week };
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86400000) + 1;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function renderConcept(
  date: Date,
  concept: TokenConcept,
  opts?: FormatOptions,
): string {
  const utc = !!opts?.utc;
  const getFullYear = () => utc ? date.getUTCFullYear() : date.getFullYear();
  const getMonth = () => utc ? date.getUTCMonth() : date.getMonth();
  const getDate = () => utc ? date.getUTCDate() : date.getDate();
  const getDay = () => utc ? date.getUTCDay() : date.getDay();
  const getHours = () => utc ? date.getUTCHours() : date.getHours();
  const getMinutes = () => utc ? date.getUTCMinutes() : date.getMinutes();
  const getSeconds = () => utc ? date.getUTCSeconds() : date.getSeconds();
  const getMs = () => utc ? date.getUTCMilliseconds() : date.getMilliseconds();

  // For ISO week, we need a UTC-like date regardless of the local display.
  // Use the local components but construct a UTC date for week math.
  const localForWeek = new Date(Date.UTC(getFullYear(), getMonth(), getDate()));

  switch (concept) {
    case "year4": return pad(getFullYear(), 4);
    case "year2": return pad(getFullYear() % 100, 2);
    case "year_unpadded": return String(getFullYear());
    case "century": return pad(Math.floor(getFullYear() / 100), 2);
    case "week_year4": {
      const w = getISOWeek(localForWeek);
      return pad(w.weekYear, 4);
    }
    case "week_year2": {
      const w = getISOWeek(localForWeek);
      return pad(w.weekYear % 100, 2);
    }
    case "month2": return pad(getMonth() + 1, 2);
    case "month_unpadded": return String(getMonth() + 1);
    case "month_name": return MONTH_NAMES[getMonth()];
    case "month_abbr": return MONTH_ABBR[getMonth()];
    case "day2": return pad(getDate(), 2);
    case "day_unpadded": return String(getDate());
    case "day_space_padded": return String(getDate()).padStart(2, " ");
    case "day_of_year3": return pad(dayOfYear(localForWeek), 3);
    case "day_of_year2": return pad(dayOfYear(localForWeek), 2);
    case "day_of_year_unpadded": return String(dayOfYear(localForWeek));
    case "weekday_name": return WEEKDAY_NAMES[getDay()];
    case "weekday_abbr": return WEEKDAY_ABBR[getDay()];
    case "weekday_num_sun0": return String(getDay());
    case "weekday_num_mon1": {
      const d = getDay();
      return String(d === 0 ? 7 : d);
    }
    case "hour24_2": return pad(getHours(), 2);
    case "hour24_unpadded": return String(getHours());
    case "hour24_space_padded": return String(getHours()).padStart(2, " ");
    case "hour12_2": {
      const h = getHours() % 12;
      return pad(h === 0 ? 12 : h, 2);
    }
    case "hour12_unpadded": {
      const h = getHours() % 12;
      return String(h === 0 ? 12 : h);
    }
    case "hour12_space_padded": {
      const h = getHours() % 12;
      return String(h === 0 ? 12 : h).padStart(2, " ");
    }
    case "minute2": return pad(getMinutes(), 2);
    case "minute_unpadded": return String(getMinutes());
    case "second2": return pad(getSeconds(), 2);
    case "second_unpadded": return String(getSeconds());
    case "ms3": return pad(getMs(), 3);
    case "us6": return pad(getMs() * 1000, 6);
    case "ns9": return pad(getMs() * 1_000_000, 9);
    case "ampm_upper": return getHours() < 12 ? "AM" : "PM";
    case "ampm_lower": return getHours() < 12 ? "am" : "pm";
    case "tz_offset_colon": {
      const off = -date.getTimezoneOffset();
      const sign = off < 0 ? "-" : "+";
      const abs = Math.abs(off);
      return `${sign}${pad(Math.floor(abs / 60), 2)}:${pad(abs % 60, 2)}`;
    }
    case "tz_offset_nocolon": {
      const off = -date.getTimezoneOffset();
      const sign = off < 0 ? "-" : "+";
      const abs = Math.abs(off);
      return `${sign}${pad(Math.floor(abs / 60), 2)}${pad(abs % 60, 2)}`;
    }
    case "tz_offset_short": {
      const off = -date.getTimezoneOffset();
      const sign = off < 0 ? "-" : "+";
      return `${sign}${Math.floor(Math.abs(off) / 60)}`;
    }
    case "tz_name": {
      try {
        const fmt = new Intl.DateTimeFormat(opts?.locale ?? "en-US", { timeZoneName: "short" });
        const parts = fmt.formatToParts(date);
        const tz = parts.find((p) => p.type === "timeZoneName");
        return tz?.value ?? "UTC";
      } catch {
        return "UTC";
      }
    }
    case "unix_sec": return String(Math.floor(date.getTime() / 1000));
    case "unix_ms": return String(date.getTime());
    case "iso_week2": {
      const w = getISOWeek(localForWeek);
      return pad(w.week, 2);
    }
    case "iso_week_unpadded": {
      const w = getISOWeek(localForWeek);
      return String(w.week);
    }
    case "locale_date":
      try {
        return new Intl.DateTimeFormat(opts?.locale, { dateStyle: "short" }).format(date);
      } catch { return date.toDateString(); }
    case "locale_time":
      try {
        return new Intl.DateTimeFormat(opts?.locale, { timeStyle: "medium" }).format(date);
      } catch { return date.toTimeString(); }
    case "locale_datetime":
      try {
        return new Intl.DateTimeFormat(opts?.locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
      } catch { return date.toString(); }
    case "iso_date": {
      const y = pad(getFullYear(), 4);
      const m = pad(getMonth() + 1, 2);
      const d = pad(getDate(), 2);
      return `${y}-${m}-${d}`;
    }
    case "iso_time": {
      const h = pad(getHours(), 2);
      const m = pad(getMinutes(), 2);
      const s = pad(getSeconds(), 2);
      return `${h}:${m}:${s}`;
    }
    case "iso_datetime": {
      const m = pad(getMonth() + 1, 2);
      const d = pad(getDate(), 2);
      const y2 = pad(getFullYear() % 100, 2);
      return `${m}/${d}/${y2}`;
    }
    case "newline": return "\n";
    case "tab": return "\t";
    case "percent": return "%";
    case "literal_text": return "";
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// Public format / convert / lint / explain
// ---------------------------------------------------------------------------

export function formatBySystem(
  date: Date,
  pattern: string,
  system: FormatSystem,
  opts?: FormatOptions,
): string {
  const tokens = tokenize(pattern, system);
  let out = "";
  for (const t of tokens) {
    if (t.type === "literal") {
      out += t.text ?? "";
    } else if (t.concept) {
      out += renderConcept(date, t.concept, opts);
    } else {
      // Unknown token — emit raw.
      out += t.raw ?? "";
    }
  }
  return out;
}

export function convertPattern(
  pattern: string,
  from: FormatSystem,
  to: FormatSystem,
): string {
  if (from === to) return pattern;
  const tokens = tokenize(pattern, from);
  const targetLookup = CONCEPT_LOOKUP[to];
  let out = "";
  for (const t of tokens) {
    if (t.type === "literal") {
      out += escapeLiteral(t.text ?? "", to);
    } else if (t.concept) {
      const target = targetLookup.get(t.concept);
      if (target) {
        out += target;
      } else {
        // No equivalent — leave a comment-like marker so users see the gap.
        out += escapeLiteral(`[${t.raw}]`, to);
      }
    } else {
      // Unknown token — escape as literal.
      out += escapeLiteral(t.raw ?? "", to);
    }
  }
  return out;
}

function escapeLiteral(text: string, system: FormatSystem): string {
  if (!text) return "";
  if (system === "strftime") {
    // Only % needs escaping in strftime.
    return text.replace(/%/g, "%%");
  }
  // For all other systems, non-letter text is literal as-is and needs no
  // escaping. Only escape text that contains letters that could be
  // misinterpreted as tokens.
  if (!/[A-Za-z]/.test(text)) {
    return text;
  }
  if (system === "moment") {
    return `[${text}]`;
  }
  if (system === "java" || system === "date-fns" || system === "ldml") {
    return `'${text.replace(/'/g, "''")}'`;
  }
  // Luxon / .NET: no escape syntax in our converter; emit as-is. Note that
  // Luxon has no escape at all, and .NET uses backslash-escapes per letter,
  // which we don't generate here. Callers should review converted patterns.
  return text;
}

export function lintPattern(pattern: string, system: FormatSystem): LintIssue[] {
  const issues: LintIssue[] = [];
  const tokens = tokenize(pattern, system);
  const seen = new Set<string>();
  for (const t of tokens) {
    if (t.type !== "token" || !t.raw) continue;
    const key = t.raw;
    if (seen.has(key)) continue;
    seen.add(key);

    // Footgun: YYYY in Java/LDML is week-year, not calendar year.
    if ((system === "java" || system === "ldml") && t.raw === "YYYY") {
      issues.push({
        severity: "warning",
        system,
        token: t.raw,
        message:
          "YYYY is the ISO WEEK year in this system, not the calendar year. " +
          "Use yyyy for the calendar year. Around year-end, YYYY can be off by one.",
      });
    }
    // Footgun: YYYY in date-fns is also week-numbering year.
    if (system === "date-fns" && t.raw === "YYYY") {
      issues.push({
        severity: "warning",
        system,
        token: t.raw,
        message:
          "YYYY is the week-NUMBERING year in date-fns (use yyyy for the calendar year). " +
          "Off by one near year-end.",
      });
    }
    // Footgun: hh (12h) vs HH (24h).
    if (t.raw === "hh") {
      issues.push({
        severity: "info",
        system,
        token: t.raw,
        message:
          "hh is 12-hour time (01-12). If you wanted 24-hour time (00-23), use HH. " +
          "Make sure your pattern also has an AM/PM marker (a/tt/A/%p).",
      });
    }
    // Footgun: DD vs dd in date-fns (DD = day of year, dd = day of month)
    if (system === "date-fns" && t.raw === "DD") {
      issues.push({
        severity: "warning",
        system,
        token: t.raw,
        message:
          "DD in date-fns is the day of the YEAR (001-366), not the day of the month. " +
          "Use dd for day-of-month (01-31). This is the #1 date-fns footgun.",
      });
    }
    // Footgun: D vs d in date-fns
    if (system === "date-fns" && t.raw === "D") {
      issues.push({
        severity: "warning",
        system,
        token: t.raw,
        message:
          "D in date-fns is the day of the YEAR (1-366), not the day of the month. " +
          "Use d for day-of-month (1-31).",
      });
    }
    // Footgun: MM vs mm (month vs minute)
    if (t.raw === "mm") {
      issues.push({
        severity: "info",
        system,
        token: t.raw,
        message:
          "mm (lowercase) is minute (00-59). If you wanted the month, use MM (uppercase).",
      });
    }
    // Footgun: ss vs SS
    if (t.raw === "SS" || t.raw === "SSS") {
      issues.push({
        severity: "info",
        system,
        token: t.raw,
        message:
          "SS/SSS is fractional seconds (sub-second), not seconds. Use ss for seconds (00-59).",
      });
    }
  }
  return issues;
}

export function explainPattern(
  pattern: string,
  system: FormatSystem,
  refDate?: Date,
): ExplainItem[] {
  const date = refDate ?? new Date(Date.UTC(2026, 0, 15, 13, 45, 30, 123));
  const tokens = tokenize(pattern, system);
  const lookup = TOKEN_TABLE[system];
  const out: ExplainItem[] = [];
  for (const t of tokens) {
    if (t.type === "literal") {
      out.push({ raw: t.text ?? "", concept: "literal_text", desc: "Literal text", example: t.text ?? "" });
    } else {
      const def = lookup.find((d) => d.token === t.raw);
      const example = t.concept ? renderConcept(date, t.concept) : (t.raw ?? "");
      out.push({
        raw: t.raw ?? "",
        concept: t.concept ?? null,
        desc: def?.desc ?? "Unknown token",
        example,
      });
    }
  }
  return out;
}

export function listTokens(system: FormatSystem): ReadonlyArray<TokenDef> {
  return TOKEN_TABLE[system];
}

export function countAllTokens(): number {
  let total = 0;
  for (const sys of Object.keys(TOKEN_TABLE) as FormatSystem[]) {
    total += TOKEN_TABLE[sys].length;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Best-effort format detection
// ---------------------------------------------------------------------------

export function detectFormat(dateStr: string): DetectedFormat | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  // Try a few common patterns.
  const candidates: Array<{ pattern: string; system: FormatSystem; confidence: number }> = [];

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(s)) {
    candidates.push({ pattern: "%Y-%m-%dT%H:%M:%S%z", system: "strftime", confidence: 0.95 });
    candidates.push({ pattern: "yyyy-MM-dd'T'HH:mm:ssxxx", system: "date-fns", confidence: 0.95 });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    candidates.push({ pattern: "%Y-%m-%d", system: "strftime", confidence: 0.9 });
    candidates.push({ pattern: "yyyy-MM-dd", system: "date-fns", confidence: 0.9 });
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) {
    candidates.push({ pattern: "%Y/%m/%d", system: "strftime", confidence: 0.85 });
    candidates.push({ pattern: "yyyy/MM/dd", system: "date-fns", confidence: 0.85 });
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    candidates.push({ pattern: "%m/%d/%Y", system: "strftime", confidence: 0.7 });
    candidates.push({ pattern: "MM/dd/yyyy", system: "date-fns", confidence: 0.7 });
  }
  if (/^\d{4}\d{2}\d{2}$/.test(s)) {
    candidates.push({ pattern: "%Y%m%d", system: "strftime", confidence: 0.85 });
    candidates.push({ pattern: "yyyyMMdd", system: "date-fns", confidence: 0.85 });
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    candidates.push({ pattern: "%Y-%m-%d %H:%M:%S", system: "strftime", confidence: 0.85 });
    candidates.push({ pattern: "yyyy-MM-dd HH:mm:ss", system: "date-fns", confidence: 0.85 });
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
    candidates.push({ pattern: "%H:%M:%S", system: "strftime", confidence: 0.85 });
    candidates.push({ pattern: "HH:mm:ss", system: "date-fns", confidence: 0.85 });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

export function codeSnippets(
  date: Date,
  pattern: string,
  system: FormatSystem,
): CodeSnippets {
  const iso = date.toISOString();
  const ts = Math.floor(date.getTime() / 1000);
  // Convert pattern to each target system for snippet reference.
  const strftimePat = convertPattern(pattern, system, "strftime");
  const momentPat = convertPattern(pattern, system, "moment");
  const luxonPat = convertPattern(pattern, system, "luxon");
  const dateFnsPat = convertPattern(pattern, system, "date-fns");
  const javaPat = convertPattern(pattern, system, "java");
  const dotnetPat = convertPattern(pattern, system, "dotnet");
  return {
    strftime: `// Python\nfrom datetime import datetime\nd = datetime.fromisoformat("${iso}".replace("Z", "+00:00"))\nprint(d.strftime("${strftimePat}"))`,
    moment: `// Moment.js\nconst moment = require("moment");\nconst d = moment("${iso}");\nconsole.log(d.format("${momentPat}"));`,
    dayjs: `// Day.js\nimport dayjs from "dayjs";\nconst d = dayjs("${iso}");\nconsole.log(d.format("${momentPat}"));`,
    luxon: `// Luxon\nimport { DateTime } from "luxon";\nconst d = DateTime.fromISO("${iso}");\nconsole.log(d.toFormat("${luxonPat}"));`,
    dateFns: `// date-fns v2+\nimport { format } from "date-fns";\nconst d = new Date("${iso}");\nconsole.log(format(d, "${dateFnsPat}"));`,
    java: `// Java\nimport java.time.Instant;\nimport java.time.ZonedDateTime;\nimport java.time.format.DateTimeFormatter;\nvar d = Instant.parse("${iso}").atZone(java.time.ZoneId.systemDefault());\nvar fmt = DateTimeFormatter.ofPattern("${javaPat}");\nSystem.out.println(fmt.format(d));`,
    dotnet: `// .NET (C#)\nusing System;\nvar d = DateTimeOffset.Parse("${iso}");\nConsole.WriteLine(d.ToString("${dotnetPat}"));`,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:date-format-converter:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(pattern: string, system: FormatSystem, utc: boolean): string {
  const params = new URLSearchParams();
  if (pattern) params.set("p", pattern);
  if (system) params.set("s", system);
  if (utc) params.set("utc", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { pattern: string; system: FormatSystem; utc: boolean } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { pattern: "", system: "strftime", utc: false };
  const params = new URLSearchParams(clean);
  const validSystems = Object.keys(SYSTEM_LABELS) as FormatSystem[];
  const sys = (params.get("s") ?? "strftime") as FormatSystem;
  return {
    pattern: params.get("p") ?? "",
    system: validSystems.includes(sys) ? sys : "strftime",
    utc: params.get("utc") === "1",
  };
}

// Expose unused reference for callers that want all systems at once.
export const ALL_SYSTEMS: ReadonlyArray<FormatSystem> = Object.keys(SYSTEM_LABELS) as FormatSystem[];
