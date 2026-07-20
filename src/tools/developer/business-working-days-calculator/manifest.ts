/**
 * Business / Working Days Calculator — Tool Manifest.
 * Tool #307 — Category 4 (Developer & Code).
 *
 * Count working days between two dates, or add/subtract N working days from
 * a date. Configurable weekends (Sat+Sun, Fri+Sat, Sun-only, Thu+Fri, etc.),
 * custom holiday list, country holiday presets (US/UK/India/AU/CA 2025–2026),
 * include/exclude end day, half-day handling, day-by-day breakdown, batch
 * range lists with CSV export, saved reusable holiday sets, shareable URL.
 * 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "business-working-days-calculator",
  name: "Business / Working Days Calculator",
  description:
    "Count business days between two dates or add/subtract N working days from a date. Configurable weekends (Sat+Sun, Fri+Sat, Sun-only, Thu+Fri, none), custom holiday list, country holiday presets (US/UK/India/AU/CA 2025–2026), include/exclude end day, half-day handling, day-by-day breakdown, batch ranges with CSV export, saved holiday sets. Shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "business days calculator", "working days between dates", "add business days",
    "subtract business days", "workday calculator", "networkdays",
    "count working days", "skip weekends", "exclude holidays",
    "fri sat weekend", "gulf weekend", "indian weekend",
    "holiday presets", "half day", "calendar days vs business days",
  ],
  icon: "briefcase",
  requiresNetwork: false,
  seo: {
    title: "Business / Working Days Calculator — Add/Count with Holidays | UnQTools",
    faq: [
      {
        q: "How does the business days calculator work?",
        a: "Enter a start date and an end date. We count every weekday that is not in your weekend set (default Saturday + Sunday) and not in your holiday list. You can toggle 'include end day' to match NETWORKDAYS conventions, switch the weekend pattern (e.g. Fri+Sat for Gulf countries, Sunday only for parts of India), and paste any list of YYYY-MM-DD holidays. The result breaks down total calendar days, business days, weekend days skipped, and holidays skipped.",
      },
      {
        q: "How do I add or subtract N working days from a date?",
        a: "Switch to the 'Add / Subtract' tab, enter a start date and the number of business days (use a negative number to subtract). We walk forward (or backward) day-by-day, skipping weekends and holidays, until we have moved the requested count. The result shows the target date, the weekday, how many weekend days and holidays we skipped, and the calendar-day delta. For example, adding 10 business days to a Monday lands 14 calendar days later (skipping 2 Saturdays + 2 Sundays).",
      },
      {
        q: "Can I save my holiday list for next time?",
        a: "Yes. Name and save your holiday set in the sidebar — it persists in localStorage on this device (up to 20 sets). You can also pick a country preset (US/UK/India/AU/CA 2025–2026) to auto-populate federal/public holidays, then add or remove individual dates. Saved sets appear in the dropdown so you can reuse them across calculations.",
      },
      {
        q: "What if a holiday falls on a weekend?",
        a: "We never double-count: a holiday that lands on a weekend is counted as a weekend day (skipped once) and reported separately as 'holidays on weekend (not double-counted)'. This matches the behavior of timeanddate.com and Calculator.net business-day calculators. For observed-day shifting (e.g. Christmas Day on a Saturday observed on Friday), adjust your holiday list manually to the observed date.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Both count-between and add/subtract-N in one tool. (2) Any weekend pattern (6 presets + custom). (3) Country holiday presets for US/UK/India/AU/CA. (4) Custom holiday list with flexible input formats (YYYY-MM-DD, M/D/YYYY, D-M-YYYY). (5) Include/exclude start and end days. (6) Half-day decimal handling. (7) Day-by-day breakdown table with type tags. (8) Batch range list with CSV export. (9) Saved reusable holiday sets (localStorage, max 20). (10) Calculation history (localStorage, max 20). (11) Shareable URL fragment encoding all inputs. (12) Privacy-first: 100% client-side, no uploads.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All date math runs locally in your browser. Saved holiday sets and calculation history live in localStorage on this device only. The shareable URL uses a URL fragment (the part after #) which browsers never send to servers.",
      },
    ],
  },
  status: "done",
};
