/**
 * Date Difference Calculator — Tool Manifest.
 * Tool #304 — Category 4 (Developer & Code).
 *
 * Calculate the difference between two dates (+ optional times) in
 * years/months/days (calendar-aware), plus totals in weeks/days/hours/minutes/
 * seconds. Include/exclude end day toggle with plain-English explanation.
 * Business-days-only mode with custom weekend + holiday list. Age calculation.
 * "Ago / from now" relative phrasing. Batch mode for multiple date pairs.
 * Optional time zone per date. Shareable URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "date-difference-calculator",
  name: "Date Difference Calculator",
  description:
    "Calculate the difference between two dates in calendar years/months/days and totals in weeks/days/hours/minutes/seconds. Include/exclude end day toggle with plain-English explanation. Business-days mode with custom weekend + holiday list. Age calculation. 'Ago / from now' phrasing. Batch mode. Shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "date difference", "days between dates", "date duration",
    "business days", "working days", "weekdays between",
    "age calculator", "years months days", "leap year aware",
    "include end day", "how many days until", "how long ago",
    "calendar difference", "date math",
  ],
  icon: "calendar",
  requiresNetwork: false,
  seo: {
    title: "Date Difference Calculator — calendar Y/M/D + business days + age | UnQTools",
    faq: [
      {
        q: "How is the calendar years/months/days breakdown calculated?",
        a: "We subtract the start date from the end date one calendar component at a time, borrowing from the next-larger unit when needed. If the end day is earlier than the start day, we borrow days from the previous month (using that month's actual length — so Feb gives 28 or 29). If the end month is earlier than the start month, we borrow from years. This is calendar-correct for month-end and leap-day cases like Jan 31 → Feb 28 (which is 0 months 28 days, not 1 month).",
      },
      {
        q: "What does 'include end day' mean and why are there two conventions?",
        a: "There are two common conventions. Exclusive (default): count the number of midnights crossed from start to end, so Jan 1 → Jan 2 = 1 day and the same day = 0 days. Inclusive: count both endpoints, so Jan 1 → Jan 2 = 2 days and the same day = 1 day. Calculators disagree on which to use, which is why we expose a toggle and show a plain-English explanation of which convention is currently active. The toggle affects both the total days and the Y/M/D breakdown by exactly one day.",
      },
      {
        q: "How are business days counted and what about holidays?",
        a: "Business days = weekdays minus holidays. You pick which days of the week count as weekend (default Saturday + Sunday; you can change to Friday-Saturday for Middle East weeks or any other pattern) and provide a holiday list (one date per line, YYYY-MM-DD). We then walk the date range day-by-day, counting days that are not in your weekend set and not in your holiday list. The 'include end day' toggle controls whether the end date itself is counted.",
      },
      {
        q: "Can this also calculate age?",
        a: "Yes. Switch to age mode, enter a birth date, and we compute the age in calendar years/months/days (with borrowing, same as the date difference). We also show the next birthday in days and the date it falls on, plus the total number of days you've been alive. The age is computed against today's UTC date by default but you can pin 'today' to any date for back-dated or future calculations.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Calendar-correct Y/M/D breakdown handling variable month lengths and leap years. (2) Include/exclude end day toggle with plain-English explanation. (3) Totals in weeks/days/hours/minutes/seconds simultaneously. (4) Optional time-of-day inputs for sub-day precision. (5) Optional time-zone per date for true elapsed time across DST. (6) Business-days mode with custom weekend + holiday list. (7) Age calculation with next-birthday countdown. (8) 'Ago / from now' relative phrasing. (9) Batch mode for multiple date pairs (CSV input/output). (10) Negative difference handling (end before start). (11) Shareable URL encoding all inputs (fragment, never sent to server). (12) localStorage history (max 20, metadata only). (13) Copy each unit, copy full summary, download CSV.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All date math runs locally. The shareable URL is fragment-encoded so it never reaches a server. History is stored in localStorage on this device only and contains metadata (date strings), never any notes.",
      },
    ],
  },
  status: "done",
};
