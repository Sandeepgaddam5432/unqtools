/**
 * Age Calculator — Tool Manifest.
 * Tool #306 — Category 4 (Developer & Code).
 *
 * Calculate exact age from a birth date to today (or any reference date) in
 * years/months/days (calendar-aware, no negative-day bugs) plus total
 * months/weeks/days/hours/minutes/seconds. Next birthday countdown with
 * weekday. Feb-29 birthday policy toggle. Milestones (10,000 days,
 * 1 billion seconds, etc.). Zodiac + Chinese zodiac extras. Age gap
 * comparison. Shareable URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "age-calculator",
  name: "Age Calculator",
  description:
    "Calculate exact age from a birth date in calendar years/months/days (no negative-day bugs) plus totals in months/weeks/days/hours/minutes/seconds. Next-birthday countdown with weekday. Feb-29 birthday policy toggle. Milestones (1,000 days, 10,000 days, 1 billion seconds). Zodiac sign + Chinese zodiac. Age gap comparison. Shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "age calculator", "how old am I", "age in days",
    "exact age", "years months days age", "birthday countdown",
    "next birthday", "leap year birthday", "Feb 29 birthday",
    "zodiac sign", "chinese zodiac", "age milestones",
    "billion seconds old", "10000 days old", "age gap",
  ],
  icon: "cake",
  requiresNetwork: false,
  seo: {
    title: "Age Calculator — exact Y/M/D + next birthday + zodiac | UnQTools",
    faq: [
      {
        q: "How is the exact age in years/months/days calculated without the negative-day bug?",
        a: "We borrow correctly across month boundaries. First subtract years from the birth date, then months, then days. When the day-of-month of the reference date is earlier than the birth day-of-month, we borrow one month's worth of days from the previous month (using that month's actual length — Feb gives 28 or 29). When the reference month is earlier than the birth month, we borrow from years. This is calendar-correct: a birth date of Jan 31 with a reference of Feb 28 returns 0 years, 0 months, 28 days — not the wrong '1 month, -3 days' you see in naive implementations.",
      },
      {
        q: "How are Feb 29 birthdays handled in non-leap years?",
        a: "People born on Feb 29 have a birthday that doesn't exist in most years. We offer two policies you can toggle: 'Feb 28' (celebrate on the last day of February — the most common convention, used by most governments and timeanddate) or 'Mar 1' (celebrate on the day after Feb 28, used by some jurisdictions including New Zealand and Hong Kong for legal purposes). The next-birthday countdown uses your chosen policy in non-leap years. In leap years the actual Feb 29 is used.",
      },
      {
        q: "What's included in the 'age in various units' section?",
        a: "Beyond the calendar Y/M/D breakdown, we compute total months (years*12 + months, rounded), total weeks (total days / 7), total days (full 24-hour periods since birth), total hours, total minutes, and total seconds. If you supply a birth time as well as a birth date, the hour/minute/second totals become exact; otherwise we count from midnight UTC of the birth date.",
      },
      {
        q: "What milestones and extras does this tool show?",
        a: "(1) Calendar-correct Y/M/D age with borrow logic. (2) Totals in months/weeks/days/hours/minutes/seconds. (3) Next-birthday date + weekday + days remaining. (4) Feb-29 birthday policy toggle (Feb 28 vs Mar 1). (5) Zodiac sign (Western astrology) based on birth month + day. (6) Chinese zodiac animal based on birth year. (7) Milestone tracker: 1,000 / 10,000 / 100,000 / 1,000,000 days, 1 billion seconds, plus 18/21/50/100 years. (8) Age gap comparison between two birth dates. (9) Birth date validation including leap-day correctness. (10) 'Today' override for back-dated or future reference dates. (11) Shareable URL encoding all inputs (fragment, never sent to server). (12) localStorage history (max 20, metadata only). (13) Copy each format, copy full summary.",
      },
      {
        q: "What about timezone — does it matter for age?",
        a: "Age is a calendar concept, not a wall-clock one. We do all math in UTC to avoid DST-related off-by-one bugs. In practice this means: if you were born in Tokyo on 2000-01-01 local time, you're 25 years old on 2025-01-01 UTC. For most users this matches their intuition. If you need to pin 'today' to a specific timezone's date, set the reference date explicitly — the tool uses UTC midnight of whatever date you supply.",
      },
      {
        q: "Is my birth date sent anywhere?",
        a: "No. All age math runs locally. The shareable URL is fragment-encoded so it never reaches a server. History is stored in localStorage on this device only and contains metadata (birth date strings), never any notes or personally identifying context beyond what you entered.",
      },
    ],
  },
  status: "done",
};
