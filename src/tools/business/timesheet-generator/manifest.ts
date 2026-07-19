import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "timesheet-generator",
  name: "Timesheet Generator",
  description:
    "Generate weekly / bi-weekly / semi-monthly / monthly timesheets from clock-in/out entries. Per-entry worked hours with break deduction, weekly totals, overtime (threshold + 1.5x), regular vs overtime pay, gross pay, daily breakdown, weekly summary, text + CSV + printable HTML export, history (localStorage), shareable URL, summary stats, time formatter, break presets. 100% client-side.",
  category: "business",
  keywords: [
    "timesheet", "time card", "time sheet",
    "clock in", "clock out", "punch clock",
    "weekly timesheet", "bi-weekly", "overtime",
    "hours worked", "pay calculator", "work hours",
  ],
  icon: "calendar-clock",
  requiresNetwork: false,
  seo: {
    title: "Timesheet Generator — Weekly/Bi-Weekly Time Cards + Overtime | UnQTools",
    faq: [
      {
        q: "How does the timesheet generator work?",
        a: "Enter the employee name, week start date (a Monday), pay period type (weekly / bi-weekly / semi-monthly / monthly), and one entry per line in the form `date,clock_in,clock_out,break_minutes` (e.g. `2026-07-13,09:00,17:30,30`). The tool parses each line, computes per-entry worked hours (clock-out minus clock-in minus break), sums the weekly total, then splits the total into regular vs overtime using the 40-hour default threshold and 1.5x default multiplier. With an hourly rate, it also computes regular pay, overtime pay, and gross pay.",
      },
      {
        q: "How is overtime calculated?",
        a: "Overtime is computed on the weekly total. Any hours above the threshold (default 40 hours/week) are paid at the overtime rate (default 1.5x). Entries are processed in date order — the first entries fill up the regular threshold and any remaining hours spill into overtime. You can change both the threshold and the multiplier if your jurisdiction or contract differs (e.g. 8 hours/day for daily OT in some locales — use the weekly threshold that matches your policy).",
      },
      {
        q: "Can I export the timesheet?",
        a: "Yes — three formats: plain text (.txt) for email/paste, CSV (.csv) with columns date, clock_in, clock_out, break, hours, regular, overtime, pay (one row per entry plus summary rows), and printable HTML (.html) that opens in any browser and prints cleanly. You can also copy the text version to clipboard or share a link with the inputs encoded in the URL hash.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 pay period type presets (weekly, bi-weekly, semi-monthly, monthly). (2) Entry parser with date + time format validation. (3) Per-entry worked hours calculator with break deduction. (4) Weekly total calculator. (5) Overtime calculator (threshold + multiplier). (6) Regular vs overtime pay split. (7) Gross pay calculator. (8) Daily breakdown report. (9) Weekly summary report. (10) Render as text timesheet. (11) Render as CSV (date, clock_in, clock_out, break, hours, regular, overtime, pay). (12) Printable HTML timesheet with inline CSS. (13) Copy + Download .txt + Download CSV + Download HTML. (14) History (localStorage, max 20). (15) Shareable URL (inputs in hash). (16) Summary stats (total hours, regular, overtime, gross pay, days worked). (17) Time formatter (HH:MM ↔ decimal hours). (18) Break presets (0, 30, 60, 90 min quick select).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Every calculation runs 100% in your browser. History is stored in localStorage on this device only. Nothing is uploaded — the share link encodes inputs in the URL hash which never leaves the device unless you copy and send it.",
      },
    ],
  },
  status: "done",
};
