/**
 * Recurring Date RRULE Generator — Tool Manifest.
 * Tool #316 — Category 4 (Developer & Code).
 *
 * Build and parse iCalendar RRULE recurrence strings per RFC 5545 §3.8.5.3.
 * Two-way editor: build via UI or paste an RRULE, instantly see plain-English
 * meaning and the next N concrete occurrences, with full support for
 * FREQ (SECONDLY→YEARLY), INTERVAL, COUNT/UNTIL, BYDAY (with ordinals),
 * BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYSETPOS, WKST, EXDATE/RDATE.
 * Export VEVENT/.ics and code snippets for rrule.js + python-dateutil.
 * DST-aware UNTIL handling. 100% client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "recurring-date-rrule-generator",
  name: "Recurring Date RRULE Generator",
  description:
    "Build and parse iCalendar RRULE recurrence strings per RFC 5545 §3.8.5.3. Two-way editor: build via UI or paste an RRULE, instantly see the plain-English meaning and the next N concrete occurrences. Full support for FREQ (SECONDLY / MINUTELY / HOURLY / DAILY / WEEKLY / MONTHLY / YEARLY), INTERVAL, COUNT, UNTIL, BYDAY with ordinals, BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYSETPOS, WKST, EXDATE / RDATE. DST-aware UNTIL handling. Export VEVENT .ics and code snippets for rrule.js + python-dateutil. 100% client-side.",
  category: "developer",
  keywords: [
    "rrule", "rrule generator", "icalendar", "rfc 5545",
    "recurrence rule", "recurring event", "ical",
    "byday", "bysetpos", "bymonthday", "bymonth",
    "rrule.js", "python-dateutil", "vevent",
    "count until", "dst", "ical export",
  ],
  icon: "repeat",
  requiresNetwork: false,
  seo: {
    title: "Recurring Date RRULE Generator — RFC 5545 builder + parser + .ics | UnQTools",
    faq: [
      {
        q: "What is an RRULE and which RFC does this tool follow?",
        a: "RRULE is the recurrence rule property defined in RFC 5545 §3.8.5.3 (iCalendar). It describes a repeating pattern such as 'every weekday', 'the last Friday of every month', or 'every Tuesday and Thursday for 10 occurrences'. This tool builds and parses RRULE strings strictly per the RFC, supporting FREQ (SECONDLY, MINUTELY, HOURLY, DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, COUNT, UNTIL, BYDAY (with positive and negative ordinals like 1MO or -1FR), BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYSETPOS, WKST, plus EXDATE exceptions and RDATE additions.",
      },
      {
        q: "How does UNTIL differ from COUNT, and how is DST handled?",
        a: "COUNT limits the recurrence to a fixed number of occurrences (e.g. COUNT=10 stops after 10 instances). UNTIL sets an absolute end date — no occurrence may extend past it. Per RFC 5545, when DTSTART is a date with local time and the rule has no UTC offset, UNTIL must still be a UTC value (suffix Z). This tool normalizes UNTIL to UTC when serializing and compares occurrences to UNTIL in absolute time, so a daylight-saving shift cannot accidentally include or exclude an event near the boundary. If DTSTART is a pure date (VALUE=DATE), UNTIL is also a pure date with no Z.",
      },
      {
        q: "What is BYSETPOS and how do negative positions work?",
        a: "BYSETPOS picks specific occurrences from the candidate set generated for each interval period. For example, with FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1 you get the last weekday of every month — BYDAY generates all weekdays, then BYSETPOS=-1 takes the last one. Positive numbers count from the start (1 = first), negative from the end (-1 = last). Multiple values are allowed (e.g. BYSETPOS=1,-1 picks the first and last). This tool implements BYSETPOS for all frequencies and handles the edge case where the candidate set is empty (e.g. Feb 30).",
      },
      {
        q: "Can I paste an existing RRULE and edit it in the UI?",
        a: "Yes — the editor is two-way. Paste any RRULE string (with or without the DTSTART property line) into the raw box and the form fields populate automatically. Round-trips are lossless for all RFC 5545 properties this tool supports. The parsed rule is then shown as plain English ('Every weekday for 10 occurrences starting January 15, 2026') and as the next N concrete dates so you can verify the pattern matches your intent before exporting.",
      },
      {
        q: "What extra features does this tool have versus other RRULE generators?",
        a: "(1) Two-way editor: build via UI or paste RRULE. (2) All six frequencies (SECONDLY→YEARLY). (3) INTERVAL, COUNT, UNTIL with DST-aware UTC normalization. (4) BYDAY with positive/negative ordinals. (5) BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYHOUR, BYMINUTE, BYSECOND. (6) BYSETPOS with negatives. (7) WKST (week-start) selector. (8) EXDATE exception dates and RDATE additions. (9) Plain-English summary. (10) Next N occurrences preview with cap. (11) VEVENT/.ics export. (12) Code snippets for rrule.js and python-dateutil. (13) localStorage history (max 20, metadata only). (14) Shareable URL (fragment-encoded, never uploaded). (15) Feb 29 leap-year handling and week 53 support.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All RRULE parsing, expansion, and .ics generation run locally with pure JavaScript — no API calls, no uploads, no account. History is stored in localStorage on this device only and contains only metadata (frequency, count, layout), never your raw date strings or event titles.",
      },
    ],
  },
  status: "done",
};
