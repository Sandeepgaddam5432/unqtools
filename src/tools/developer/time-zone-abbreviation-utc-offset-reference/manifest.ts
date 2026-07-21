/**
 * Time Zone Abbreviation & UTC Offset Reference — Tool Manifest.
 * Tool #318 — Category 4 (Developer & Code).
 *
 * A searchable, IANA-backed reference of 200+ time zone abbreviations
 * (EST, PST, GMT, CET, JST, …) with their UTC offsets, full names, and
 * IANA equivalents. Resolves the notorious ambiguity (CST = Central US,
 * China, or Cuba; IST = India, Ireland, or Israel) by listing every
 * candidate zone. Search by abbreviation, IANA id, city, or numeric UTC
 * offset. Live "now in this zone" readout via Intl.DateTimeFormat.
 * Fully client-side, offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "time-zone-abbreviation-utc-offset-reference",
  name: "Time Zone Abbreviation & UTC Offset Reference",
  description:
    "Searchable reference of 200+ time zone abbreviations (EST, PST, GMT, CET, JST, UTC+05:30, …) with full names, UTC offsets, DST status, IANA equivalents, and example cities. Resolves ambiguous abbreviations (CST, IST, BST, AMT) to all candidate zones. Live 'now in this zone' readout. 100% client-side, offline.",
  category: "developer",
  keywords: [
    "time zone abbreviations", "utc offset list", "tz database",
    "iana time zones", "est", "pst", "gmt", "cet", "jst",
    "cst ambiguity", "ist ambiguity", "bst ambiguity",
    "utc offset", "dst status", "time zone reference",
    "what is cst", "what is ist", "half hour timezone",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "Time Zone Abbreviation & UTC Offset Reference — 200+ Zones, IANA, DST | UnQTools",
    faq: [
      {
        q: "Why are time zone abbreviations like CST, IST, and BST ambiguous?",
        a: "Time zone abbreviations are not standardized and are reused across the world. CST is Central Standard Time in North America (UTC−6) but also China Standard Time (UTC+8) and Cuba Standard Time (UTC−5). IST can be India Standard Time (UTC+5:30), Irish Standard Time (UTC+1), or Israel Standard Time (UTC+2). BST is British Summer Time (UTC+1) but also Bougainville Standard Time (UTC+11). This tool lists every candidate IANA zone for each ambiguous abbreviation so you can pick the right one.",
      },
      {
        q: "How are the UTC offsets and DST status computed?",
        a: "Offsets are derived from the IANA tz database via the JavaScript Intl.DateTimeFormat API, evaluated against the user's current instant. Each zone's standard offset and DST offset are computed by formatting two reference instants (January and July of the current year) in the target zone. This means the tool reflects the live, current tz database in the browser — no static table that goes stale.",
      },
      {
        q: "Why do some zones have half-hour or 45-minute offsets?",
        a: "Several zones do not use whole-hour offsets: India (UTC+5:30), Nepal (UTC+5:45), the Chatham Islands (UTC+12:45), parts of Australia (e.g. UTC+9:30), Newfoundland (UTC−3:30), and Iran (UTC+3:30) among others. This reference includes every fractional offset and labels them clearly so you don't accidentally round them.",
      },
      {
        q: "What's the difference between standard offset and DST offset, and why are both shown?",
        a: "The standard (winter) offset is the UTC offset a zone uses outside daylight saving time. The DST (summer) offset is what it uses when DST is active — typically 1 hour ahead of standard, but in some cases 30 minutes (e.g. Lord Howe Island) or 0 (the zone doesn't observe DST). Showing both lets you verify what offset applies right now and what would apply at other times of year.",
      },
      {
        q: "What extra features does this tool have versus a static table?",
        a: "(1) Search by abbreviation, full name, IANA id, city, or numeric offset (e.g. '+5:30'). (2) 200+ abbreviations mapped to 100+ IANA zones. (3) Disambiguation panel for ambiguous abbreviations (CST/IST/BST/AMT and more). (4) Live current offset and DST status via Intl.DateTimeFormat. (5) 'Now in this zone' instant readout. (6) Offset filter chips (e.g. show all UTC+5:30 zones). (7) Standard vs DST offsets shown side by side. (8) Copy IANA id. (9) Recently changed zones reference list. (10) localStorage history (max 20). (11) Shareable URL (fragment-encoded). (12) Grouped results by abbreviation.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All timezone lookups use Intl.DateTimeFormat and a bundled abbreviation→IANA zone map. The tool never makes a network request. Your search history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
