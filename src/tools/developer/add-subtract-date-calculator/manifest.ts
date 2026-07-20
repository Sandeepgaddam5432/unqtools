/**
 * Add / Subtract Date Calculator — Tool Manifest.
 * Tool #305 — Category 4 (Developer & Code).
 *
 * Add or subtract years, months, weeks, days, hours, minutes and seconds
 * from a starting date/time. Calendar-day or business-day mode with custom
 * weekend + holiday list. Month-end policy toggle (clamp vs overflow).
 * Repeat/series mode (e.g. every 2 weeks x 10) with table export.
 * Timezone-aware shareable URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "add-subtract-date-calculator",
  name: "Add / Subtract Date Calculator",
  description:
    "Add or subtract years, months, weeks, days, hours, minutes and seconds from a starting date/time. Calendar-day or business-day mode with custom weekend + holiday list. Month-end policy toggle (clamp to last day vs overflow). Repeat/series mode (e.g. every 2 weeks x 10) with CSV export. Shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "add days to date", "subtract days from date", "date plus days",
    "date minus days", "date calculator", "date math",
    "add months to date", "add years to date", "what date is x days from today",
    "business days from date", "working days from date",
    "month end clamp", "leap year aware", "date arithmetic",
  ],
  icon: "calendar-plus",
  requiresNetwork: false,
  seo: {
    title: "Add / Subtract Date Calculator — Y/M/W/D/h/m/s + business days | UnQTools",
    faq: [
      {
        q: "How does the month-end clamp work when adding months?",
        a: "By default we use the 'clamp' policy: if adding 1 month to Jan 31 would land on Feb 31 (which doesn't exist), we clamp to the last valid day of the target month — Feb 28 or Feb 29 in a leap year. This matches timeanddate and Calculator.net. You can switch to 'overflow' policy via the toggle, which rolls the extra days into the next month (so Jan 31 + 1 month = Mar 3 in a non-leap year). The active policy is shown in plain English under the result.",
      },
      {
        q: "What's the difference between calendar days and business days mode?",
        a: "Calendar-day mode adds the literal number of days (every day counts). Business-day mode skips your weekend days (default Sat+Sun, configurable to any pattern) and any holidays you supply (one YYYY-MM-DD per line). For example, adding 10 business days from a Monday lands 14 calendar days later (skipping 2 weekends). Adding to a Friday adds the next 10 working weekdays, which is 14 calendar days. Negative counts subtract and walk backwards.",
      },
      {
        q: "Can I add or subtract more than one unit at once?",
        a: "Yes. You can fill in any combination of years, months, weeks, days, hours, minutes and seconds. Operations apply in order: years, then months (with month-end clamp/overflow), then weeks, then days, then hours, minutes, seconds. This matches the order that calendar libraries like Temporal.PlainDateTime.add use, and avoids the ambiguity you get when adding days first then months (the clamping behaviour would differ).",
      },
      {
        q: "What is the repeat/series mode for?",
        a: "Series mode generates a recurring schedule. Enter an offset (e.g. every 2 weeks), a count (e.g. 10 occurrences), and a start date — we apply the offset 1, 2, 3, ... count times to produce a table of upcoming dates. Each row shows the iteration number, the resulting date, the weekday, and the ISO date string. You can copy or download the table as CSV for use in calendars, planners or spreadsheets.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Add/subtract Y/M/W/D/h/m/s in a single operation. (2) Month-end policy toggle (clamp vs overflow) with plain-English explanation. (3) Calendar-day and business-day modes. (4) Custom weekend days (any pattern, e.g. Fri+Sat for Middle East weeks). (5) Custom holiday list excluded from business-day math. (6) Repeat/series mode with count + CSV export. (7) Stepper inputs for every unit. (8) Now / Start of day / End of day quick helpers. (9) Negative-result handling (subtract past epoch). (10) Large-offset safety (±1000 years). (11) Shareable URL encoding all inputs (fragment, never sent to server). (12) localStorage history (max 20, metadata only). (13) Copy each result format, download CSV.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All date math runs locally. The shareable URL is fragment-encoded so it never reaches a server. History is stored in localStorage on this device only and contains metadata (date strings and offsets), never any notes or personal data.",
      },
    ],
  },
  status: "done",
};
