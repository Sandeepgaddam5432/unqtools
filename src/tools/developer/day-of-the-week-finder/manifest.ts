/**
 * Day of the Week Finder — Tool Manifest.
 * Tool #313 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "day-of-the-week-finder",
  name: "Day of the Week Finder",
  description:
    "Find which day of the week any date falls on using Zeller's congruence and Sakamoto's algorithm — plus day-of-year, ISO week, days until/since today, next/previous weekday finder, Nth weekday of month (e.g. 2nd Tuesday), recurring-weekday view across a year range, and Doomsday-rule teaching mode. 100% client-side.",
  category: "developer",
  keywords: [
    "day of the week", "weekday finder", "what day was i born",
    "zeller congruence", "sakamoto algorithm", "doomsday rule",
    "iso week", "day of year", "calendar math", "nth weekday of month",
    "next friday", "previous monday",
  ],
  icon: "calendar",
  requiresNetwork: false,
  seo: {
    title: "Day of the Week Finder — Zeller, Sakamoto, Doomsday Rule | UnQTools",
    faq: [
      {
        q: "What algorithms does the day-of-the-week finder use?",
        a: "We compute the weekday two independent ways and check they agree: Zeller's congruence (a classic formula that maps year/month/day to a weekday number using integer floor division) and Sakamoto's algorithm (a compact 7-lookup table method). When both match the JavaScript Date object's result, you have three independent confirmations of the weekday.",
      },
      {
        q: "How do I find the 2nd Tuesday or 4th Thursday of a month?",
        a: "Use the 'Nth weekday of month' tab. Pick the year, month, the weekday you want, and which occurrence (1st–5th). The tool returns the exact date — perfect for figuring out US Thanksgiving (4th Thursday of November), Thanksgiving (2nd Monday of October in Canada), or any recurring monthly meeting.",
      },
      {
        q: "What is the Doomsday rule and how does the teaching mode work?",
        a: "The Doomsday rule (Conway's algorithm) is a mental-math shortcut: certain dates ('anchor days') always fall on the same weekday in any given year — e.g., 4/4, 6/6, 8/8, 10/10, 12/12, plus 5/9, 9/5, 7/11, 11/7 and Pi Day (3/14). The teaching mode walks you step-by-step: compute the century anchor, the year's doomsday, then walk from the nearest anchor date to your target.",
      },
      {
        q: "Does this work for dates before the Gregorian calendar reform of 1582?",
        a: "We use the proleptic Gregorian calendar (extending Gregorian rules backward) for all dates by default, which is standard for ISO 8601. The tool notes this and warns for pre-1582 historical dates where the Julian calendar was actually in use in most of Europe. Use the Julian-vs-Gregorian note for context on historical research.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Zeller's congruence implementation. (2) Sakamoto's algorithm implementation. (3) Day-of-year (1–366) with leap-year handling. (4) ISO 8601 week number. (5) Days-until / days-since today. (6) Next/previous specific-weekday finder. (7) Nth weekday of month (1st–5th). (8) Recurring-weekday view across a year range (e.g., Christmas for the next 10 years). (9) Doomsday-rule step-by-step teaching mode. (10) Julian-vs-Gregorian historical note. (11) localStorage history (max 20). (12) Shareable URL. (13) Copy / download results as text.",
      },
    ],
  },
  status: "done",
};
