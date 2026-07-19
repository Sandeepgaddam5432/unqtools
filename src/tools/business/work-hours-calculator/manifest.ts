import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "work-hours-calculator",
  name: "Work Hours Calculator",
  description:
    "Calculate work hours between two times — handles overnight shifts, breaks, and overtime. Time parser (12h AM/PM and 24h), break deduction, daily overtime threshold with 1.5x multiplier, regular vs overtime pay, effective hourly rate, summary stats, 6 shift presets, break presets, text + CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "business",
  keywords: [
    "work hours", "hours calculator", "time calculator",
    "overnight shift", "shift calculator", "break deduction",
    "overtime", "overtime pay", "hourly rate",
    "time clock", "clock in clock out", "pay calculator",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Work Hours Calculator — Overnight Shifts, Breaks, Overtime Pay | UnQTools",
    faq: [
      {
        q: "How does the work hours calculator work?",
        a: "Enter your start time, end time, and break minutes. The tool parses both times into minutes since midnight, optionally adds 24 hours when end < start (overnight shift), subtracts the break, and reports the worked hours. With an hourly rate, it splits the worked hours into regular vs overtime using the threshold you set (default 8 hours/day) and computes regular pay, overtime pay (rate × multiplier, default 1.5x), and total pay.",
      },
      {
        q: "How are overnight shifts handled?",
        a: "If end time is earlier than start time (e.g. start 22:00, end 06:00) and the overnight shift toggle is on, the tool automatically treats the end time as the next day and adds 24 hours. You can also enable auto-detect — the calculator will check end < start and flag it as overnight automatically.",
      },
      {
        q: "How is overtime calculated?",
        a: "Daily overtime uses the threshold you set (default 8 hours). Any worked hours above the threshold are paid at the overtime rate, which is your hourly rate × the multiplier (default 1.5x). Regular hours are paid at the straight hourly rate. Total pay = regular pay + overtime pay. The effective hourly rate is total pay ÷ worked hours.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Time parser supporting both 12h AM/PM and 24h formats. (2) Time formatter (12h and 24h output). (3) Overnight shift auto-detect. (4) Break deduction. (5) Daily overtime threshold calculator. (6) Regular vs overtime pay calculator. (7) Overtime rate multiplier. (8) Date format selector (12h/24h). (9) Render as text report. (10) Render as CSV. (11) Copy + Download .txt + Download CSV + Share link + Clear. (12) History (localStorage, max 20). (13) Shareable URL (inputs in hash). (14) Summary stats (worked hours, regular, overtime, total pay, effective hourly rate). (15) 6 common shift presets (9-5, 8-4, 10-6, night 22-6, etc.). (16) Break presets (0, 15, 30, 60, 90 minutes).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Every calculation runs 100% in your browser. History is stored in localStorage on this device only. Nothing is uploaded — the share link encodes inputs in the URL hash which never leaves the device unless you copy and send it.",
      },
    ],
  },
  status: "done",
};
