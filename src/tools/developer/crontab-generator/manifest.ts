/**
 * Crontab Generator — Tool Manifest.
 * Tool #97 — Category 4 (Developer & Code).
 *
 * Visual cron-expression builder. Pick minute / hour / day / month /
 * weekday via friendly controls (every / every-N / specific / range / list),
 * get a valid 5-field expression, a plain-English description, the next N
 * run times, presets (every 5 min, hourly, daily, weekly, monthly, …),
 * two-way builder ↔ expression sync, and a validator. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "crontab-generator",
  name: "Crontab Generator",
  description:
    "Build cron expressions visually — pick minute/hour/day/month/weekday via every / every-N / specific / range / list controls, get a valid 5-field expression, a plain-English description, the next N run times (timezone-aware), and 15+ presets (every 5 min, hourly, daily, weekly, monthly, weekdays, weekends, quarterly, yearly). Two-way builder↔expression sync, validator (catches the day-of-month vs day-of-week OR-semantics gotcha), Quartz 6/7-field and AWS EventBridge modes. 100% client-side — no network.",
  category: "developer",
  keywords: [
    "cron", "crontab", "cron expression", "cron generator",
    "cron builder", "crontab generator", "schedule", "cron syntax",
    "quartz cron", "aws eventbridge cron", "cron presets",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Crontab Generator — Visual Cron Expression Builder with Presets | UnQTools",
    faq: [
      {
        q: "What are the 5 fields of a cron expression?",
        a: "Standard Unix cron has 5 fields separated by spaces: `minute hour day-of-month month day-of-week`. Ranges: minute 0–59, hour 0–23, day-of-month 1–31, month 1–12 (or JAN–DEC), day-of-week 0–6 (or SUN–SAT, where 0 and 7 are both Sunday). Each field accepts `*` (every), `*/N` (every N), `A-B` (range), `A,B,C` (list), or `A-B/N` (stepped range).",
      },
      {
        q: "What is the day-of-month vs day-of-week OR-semantics gotcha?",
        a: "In standard (Vixie) cron, if BOTH day-of-month and day-of-week are restricted (not `*`), the job runs when EITHER matches (OR semantics) — not both. So `0 0 1 * 1` runs at midnight on the 1st of the month AND every Monday, not 'midnight on the 1st when it's a Monday'. If only one is restricted, the other is treated as `*`. This tool's validator flags the OR case explicitly.",
      },
      {
        q: "How are the next-run times computed?",
        a: "The tool runs the standard Vixie cron algorithm entirely in your browser — no network, no external library. It walks minute-by-minute from your chosen start time (default: now), respecting the day-of-month/day-of-week OR rule, until it finds the next matching minute. Results show the next 5 runs in your browser's local timezone. DST transitions are handled automatically by the Date object.",
      },
      {
        q: "What is the difference between Unix, Quartz, and AWS EventBridge cron?",
        a: "Unix cron is 5-field (minute hour dom month dow). Quartz is 6 or 7-field: `seconds minutes hours dom month dow [year]`, supports `?` (no specific value), `L` (last), `W` (weekday), and `#` (nth weekday). AWS EventBridge uses 6-field cron(minutes hours dom month dow year) — but its day-of-month and day-of-week use AND semantics (the opposite of Unix!) and `?` is required in one of them. This tool supports all three modes.",
      },
      {
        q: "What extra features does this tool have versus crontab.guru?",
        a: "(1) Visual builder with every / every-N / specific / range / list modes per field. (2) 15+ one-click presets (every 5/10/15/30 min, hourly, daily, weekly, weekdays, weekends, monthly, quarterly, yearly, midnight, noon, business hours). (3) Two-way sync — type an expression, the builder updates; tweak the builder, the expression updates. (4) Plain-English description. (5) Next-5-run preview (timezone-aware, DST-aware). (6) Validator with the OR-semantics warning. (7) Quartz 6/7-field mode. (8) AWS EventBridge mode (with the AND-semantics warning). (9) Month/weekday name support (JAN–DEC, SUN–SAT). (10) Stepped ranges (1-10/2 = 1,3,5,7,9). (11) Copy + download .cron / .txt. (12) Shareable deep-link to your config. (13) Recent history (localStorage, last 20). 100% client-side — no ads, no tracking.",
      },
    ],
  },
  status: "done",
};
