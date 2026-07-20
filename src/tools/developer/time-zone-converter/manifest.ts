/**
 * Time Zone Converter — Tool Manifest.
 * Tool #302 — Category 4 (Developer & Code).
 *
 * Convert a date/time from one time zone to many others, DST-aware for any
 * past/future date (including historical rule changes). City/zone autocomplete
 * mapped to IANA ids. Show UTC offset, abbreviation (IST/PST/etc.), DST active
 * flag. Ambiguous-time resolver (fall-back overlap) and gap warning
 * (spring-forward). Live "now" mode. Difference summary. Shareable link.
 * Fully client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "time-zone-converter",
  name: "Time Zone Converter",
  description:
    "Convert a date and time from one time zone to many others — DST-aware for any past or future date. City/zone autocomplete mapped to IANA ids. Shows UTC offset, abbreviation (IST/PST/etc.) and DST-active flag. Detects spring-forward gaps and fall-back overlaps. Live 'now' mode. Difference summary. Shareable link. 100% client-side.",
  category: "developer",
  keywords: [
    "time zone converter", "timezone converter", "dst converter",
    "utc offset", "iana timezone", "ist to pst", "est to gmt",
    "meeting planner", "time difference", "world clock",
    "spring forward", "fall back", "ambiguous time",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "Time Zone Converter — DST-aware, 400+ zones, gap/overlap detection | UnQTools",
    faq: [
      {
        q: "How does this time zone converter handle DST?",
        a: "We use the browser's built-in Intl.DateTimeFormat with the full IANA timezone database, which knows every historical and future DST rule change for 400+ zones. When you pick a date and source zone, we look up the actual UTC offset at that exact instant — including for past dates when DST rules were different. We also flag the twice-a-year ambiguous local times (spring-forward gaps and fall-back overlaps) that break naive converters.",
      },
      {
        q: "What is a spring-forward gap and a fall-back overlap?",
        a: "In the spring, clocks jump from 02:00 to 03:00 (in most zones), so local times between 02:00 and 03:00 never occur — that's a gap. In the autumn, clocks fall back from 02:00 to 01:00, so local times between 01:00 and 02:00 occur twice (once in DST, once in standard) — that's an overlap. This tool explicitly detects and warns about both. For overlap times, we use the DST (earlier) interpretation by default.",
      },
      {
        q: "How does the half-hour and 45-minute zones work?",
        a: "Not all time zones are whole-hour offsets. India (IST) is UTC+5:30, Nepal (NPT) is UTC+5:45, the Chatham Islands (CHAST) is UTC+12:45, and a handful of others use 30- or 45-minute offsets. This tool correctly handles all of them because we compute offsets minute-by-minute from the IANA database rather than rounding to whole hours.",
      },
      {
        q: "Can I convert one time to multiple zones at once?",
        a: "Yes. Enter your source date, time and zone once, then add as many target zones as you like — New York, London, Berlin, Mumbai, Tokyo, Sydney, etc. — and we show every target's wall-clock, UTC offset, abbreviation and DST flag side-by-side. You can also see a difference summary like 'Mumbai is 9h 30m ahead of New York right now'.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) City/zone autocomplete mapped to IANA ids (400+ zones, 200+ cities). (2) DST-aware conversion for any past/future date using Intl + IANA database. (3) One source instant → many target zones simultaneously. (4) UTC offset, abbreviation (IST/PST/etc.) and DST-active flag per zone. (5) Spring-forward gap warning + fall-back overlap detection with explicit disambiguation. (6) Live 'now' mode with one-click copy ISO/UTC. (7) Difference summary ('X is 9h 30m behind Y'). (8) Half-hour and 45-minute zone support (IST, NPT, CHAST). (9) Shareable URL encoding source + targets + instant (fragment, never sent to server). (10) localStorage history (max 20, metadata only). (11) Historical DST rule changes respected. (12) Mobile-first stacked cards with offset badges.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All timezone math runs locally via Intl.DateTimeFormat with the IANA database bundled in your browser. History is stored in localStorage on this device only and contains metadata (zone ids + instant), never your notes.",
      },
    ],
  },
  status: "done",
};
