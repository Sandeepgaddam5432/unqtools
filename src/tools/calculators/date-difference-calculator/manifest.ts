/**
 * Date Difference Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "date-difference-calculator",
  name: "Date Difference Calculator",
  description:
    "Calculate days, weeks, months, years, business days, and weekdays between two dates. Add/subtract days from a date. With 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["date difference", "days between", "business days", "workdays", "add days to date", "date math", "duration"],
  icon: "calendar",
  requiresNetwork: false,
  seo: {
    title: "Date Difference Calculator — Business Days + Add/Subtract | UnQTools",
    faq: [
      { q: "How are business days calculated?", a: "Business days exclude weekends (Saturday/Sunday) and any holidays you specify. The default mode counts Monday-Friday only; you can add custom holiday dates that will also be excluded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Total days/weeks/months/years, (2) Business days + weekends breakdown, (3) Custom holiday exclusion, (4) Add/subtract N days from a date, (5) Add/subtract business days, (6) Weekday of both dates, (7) ISO week numbers, (8) Day-of-year + days remaining in year, (9) Quarter and half-year, (10) Per-week breakdown table, (11) CSV export, (12) Relative time humanized (e.g. '3 months 2 days'), (13) Leap-year aware." },
    ],
  },
  status: "done",
};
