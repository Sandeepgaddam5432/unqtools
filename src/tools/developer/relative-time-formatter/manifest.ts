/**
 * Relative Time ("Time Ago") Formatter — Tool Manifest.
 * Tool #311 — Category 4 (Developer & Code).
 *
 * Pure-JS relative-time formatter: turn any timestamp or two dates into a
 * human "time ago" / "in X" phrase ("2 hours ago", "in 3 days", "just now")
 * across 5 locales (en, es, fr, de, ja) with configurable thresholds, auto
 * unit selection, multi-locale preview grid, and copy-paste code snippets
 * for Intl.RelativeTimeFormat / Luxon / Day.js / date-fns.
 *
 * 100% client-side, no network, no uploads.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "relative-time-formatter",
  name: "Relative Time (Time Ago) Formatter",
  description:
    "Format any timestamp as a relative phrase ('2 hours ago', 'in 3 days', 'just now') across 5 locales (en, es, fr, de, ja) with auto unit selection, configurable thresholds, numeric 'always' vs 'auto' modes, multi-locale preview grid, and copy-paste code snippets for Intl.RelativeTimeFormat, Luxon, Day.js, and date-fns. 100% client-side.",
  category: "developer",
  keywords: [
    "relative time", "time ago", "time ago formatter",
    "relative time format", "Intl.RelativeTimeFormat",
    "humanize date", "human readable time", "2 hours ago",
    "in 3 days", "just now", "luxon torelative",
    "dayjs fromnow", "date-fns formatdistance",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Relative Time (Time Ago) Formatter — Intl.RelativeTimeFormat + Luxon/Day.js/date-fns Snippets | UnQTools",
    faq: [
      {
        q: "How does the relative time formatter pick the unit automatically?",
        a: "We compute the signed difference in milliseconds, then walk the unit ladder (second → minute → hour → day → week → month → year) using configurable thresholds. By default: ≤45s is 'just now' (numeric:auto → 'now'), <90s uses seconds, <45min uses minutes, <22h uses hours, <7d uses days, <26d uses weeks, <11mo uses months, otherwise years. The result is passed to Intl.RelativeTimeFormat so pluralization, gender, and inflection are handled by CLDR.",
      },
      {
        q: "What is the difference between numeric 'always' and 'auto'?",
        a: "Intl.RelativeTimeFormat accepts a numeric option. 'always' (default in the API) renders every value literally: format(0, 'second') → 'in 0 seconds'. 'auto' uses idiomatic phrasing where available: format(0, 'second') → 'now', format(-1, 'day') → 'yesterday' (en), 'ayer' (es), 'hier' (fr), 'gestern' (de), '昨日' (ja). This tool exposes both via a single toggle so you can preview the exact string each mode produces.",
      },
      {
        q: "Which locales are supported?",
        a: "Five locales with full CLDR coverage are bundled: English (en), Spanish (es), French (fr), German (de), and Japanese (ja). The multi-locale preview grid renders your timestamp in all five at once so you can compare phrasing, plural rules, and 'yesterday'/'tomorrow' idioms side by side. The generated Intl snippet can be edited to use any BCP-47 tag (e.g. 'zh-CN', 'ar', 'pt-BR').",
      },
      {
        q: "Does the generated code snippet run as shown?",
        a: "Yes. The Intl.RelativeTimeFormat snippet uses only the native browser API — no dependencies. The Luxon snippet requires luxon (DateTime.fromMillis(ts).toRelative({ locale })). The Day.js snippet requires dayjs plus the relativeTime plugin (dayjs(ts).fromNow()). The date-fns snippet requires date-fns and the matching locale object (formatDistance(ts, Date.now(), { addSuffix: true, locale })). All four are copy-paste runnable.",
      },
      {
        q: "What extra features does this tool have versus raw Intl.RelativeTimeFormat?",
        a: "(1) Auto unit selection (the native API makes you pick). (2) Configurable thresholds (justNow, minute, hour, day, week, month, year cutoffs). (3) numeric 'always' vs 'auto' toggle. (4) Three style modes (long, short, narrow). (5) Multi-locale preview grid (5 locales at once). (6) Code snippet generator for 4 libraries. (7) Full breakdown table (years/months/weeks/days/hours/minutes/seconds totals). (8) Sample-date presets. (9) localStorage history (max 20). (10) Shareable URL with full option round-trip. (11) Future-vs-past direction indicator. (12) Copy / download as .txt. 100% client-side.",
      },
    ],
  },
  status: "done",
};
