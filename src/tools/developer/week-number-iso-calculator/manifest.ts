/**
 * Week Number (ISO 8601) Calculator — Tool Manifest.
 * Tool #312 — Category 4 (Developer & Code).
 *
 * Pure-JS week-number calculator: find the ISO 8601 week number for any date
 * (and the reverse: the date range for a given year + week). Supports ISO,
 * US (Sun-start), Simple (Jan 1-7), and Middle-Eastern (Sat-start) week
 * numbering conventions. Whole-year week grid. Week-53 and cross-year
 * boundary handling. 100% client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "week-number-iso-calculator",
  name: "Week Number (ISO 8601) Calculator",
  description:
    "Calculate the ISO 8601 week number for any date and the reverse (year + week → date range). Supports ISO 8601 (Mon-start, week 1 = first Thursday), US (Sun-start), Simple (Jan 1-7), and Middle-Eastern (Sat-start) conventions. Whole-year week grid. Week-53 detection. Cross-year boundary handling. 100% client-side.",
  category: "developer",
  keywords: [
    "week number", "iso week", "iso 8601",
    "week of year", "what week is it",
    "week number calculator", "iso week date",
    "week 53", "week-year", "us week number",
    "monday start week", "calendar week",
  ],
  icon: "calendar-days",
  requiresNetwork: false,
  seo: {
    title: "Week Number (ISO 8601) Calculator — Date ↔ Week + Year Grid | UnQTools",
    faq: [
      {
        q: "What is an ISO 8601 week number?",
        a: "ISO 8601 weeks run Monday→Sunday. Week 1 of a year is the week that contains the first Thursday of January (equivalently, the week containing January 4). This means a date in late December can belong to week 1 of the next year, and a date in early January can belong to week 52 or 53 of the previous year. The 'week-year' is the year the week belongs to, which may differ from the calendar year. Our calculator reports both week and week-year.",
      },
      {
        q: "When does a year have 53 weeks?",
        a: "In ISO 8601, a year has 53 weeks if and only if its first day (Jan 1) is a Thursday, OR it's a leap year whose Jan 1 is a Wednesday. Recent 53-week ISO years: 2015, 2020, 2026, 2032. For the US (Sun-start) convention, a year has 53 weeks if Jan 1 is Sunday, OR (leap year and Jan 1 is Saturday). For Simple (Jan 1-7 = week 1) and Middle-Eastern (Sat-start) conventions, the rules differ — the calculator surfaces 'isWeek53' and 'totalWeeksInYear' for every convention.",
      },
      {
        q: "What's the difference between ISO, US, Simple, and Middle-Eastern week numbering?",
        a: "ISO 8601: Mon-start, week 1 = first Thursday (international standard). US: Sun-start, week 1 = week containing Jan 1 (week-year = year of the Sunday starting the week). Simple: weeks are 7-day buckets with Jan 1-7 = week 1 (no partial weeks, easy to compute, week = ceil(dayOfYear/7)). Middle-Eastern: Sat-start, week 1 = week containing Jan 1 (used in Saudi Arabia and other Gulf countries). Toggle the convention selector to see how the same date maps to different week numbers.",
      },
      {
        q: "How do I find the date range for a given week number?",
        a: "Enter the week-year and week number in the reverse-lookup panel and pick a convention. The calculator returns the start (Mon/Sun/Sat) and end (Sun/Sat/Fri) dates as YYYY-MM-DD, plus a Date object. For ISO week 1 of 2015, the range is 2014-12-29 → 2015-01-04 (the week containing Thursday Jan 1 2015). Week 53 of 2020 is 2020-12-28 → 2021-01-03.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) Four week-numbering conventions (ISO, US, Simple, Middle-Eastern). (2) Date → week + week-year. (3) Year + week → date range (reverse lookup). (4) Whole-year week grid with current-week highlight. (5) Week-53 detection per convention. (6) Cross-year boundary handling (Dec 29 → next year W01, Jan 1 → prior year W53). (7) Total weeks in year. (8) Weekday name + ISO weekday number. (9) 'Find current week' shortcut. (10) localStorage history (max 20). (11) Shareable URL with convention + date. (12) Copy / download year-grid as .csv. 100% client-side.",
      },
    ],
  },
  status: "done",
};
