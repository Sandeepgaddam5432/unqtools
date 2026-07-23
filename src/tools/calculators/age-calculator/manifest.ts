/**
 * Age Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "age-calculator",
  name: "Age Calculator",
  description:
    "Calculate exact age in years, months, days, hours, and total seconds from birthdate. Find next birthday, days remaining, weekday born, Zodiac sign, and 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["age calculator", "birthdate", "birthday", "years old", "zodiac", "next birthday", "days alive"],
  icon: "cake",
  requiresNetwork: false,
  seo: {
    title: "Age Calculator — Exact Years/Months/Days + Zodiac | UnQTools",
    faq: [
      { q: "How is age calculated?", a: "Age is the elapsed time between birthdate and target date, computed as calendar difference (not just days/365.25). Years and months roll over on the birth-day-of-month; days are the remaining remainder." },
      { q: "What extras does this tool have?", a: "Extras: (1) Years+months+days breakdown, (2) Total days/hours/minutes/seconds alive, (3) Next birthday countdown, (4) Day of week you were born, (5) Western Zodiac sign, (6) Chinese Zodiac animal, (7) Birthstone + birth flower, (8) Half-birthday calculator, (9) Retirement age estimate (65), (10) Voting/license eligibility check, (11) Generation label (Boomer/GenX/Millennial/GenZ/GenAlpha), (12) Life expectancy comparison (WHO 2023), (13) Custom target date." },
    ],
  },
  status: "done",
};
