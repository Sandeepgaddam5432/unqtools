/**
 * Time Duration Calculator — Tool Manifest.
 * Tool #308 — Category 4 (Developer & Code).
 *
 * Add / subtract / multiply / divide durations in days/hours/minutes/seconds.
 * Compute duration between two clock times (cross-midnight aware). Totalize
 * multiple timesheet rows with break subtraction. Convert HH:MM:SS ↔ decimal
 * hours ↔ minutes ↔ seconds. 12/24h clock support. Multi-row timesheet with
 * CSV export. Shareable URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "time-duration-calculator",
  name: "Time Duration Calculator",
  description:
    "Add, subtract, multiply and divide time durations. Find the duration between two clock times (cross-midnight aware). Totalize multiple timesheet rows with break subtraction. Convert HH:MM:SS to decimal hours and back. 12/24h clock support, mixed-unit normalization (75s = 1m15s), multi-segment totals with CSV export. Shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "time duration calculator", "add time calculator", "hours between two times",
    "subtract time", "time arithmetic", "duration calculator",
    "decimal hours", "hh:mm:ss", "timesheet calculator",
    "time card calculator", "work hours", "cross midnight time",
    "time math", "minutes to hours", "seconds to hours",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Time Duration Calculator — Add/Subtract/Multiply/Divide + Timesheet | UnQTools",
    faq: [
      {
        q: "How does the time duration calculator work?",
        a: "There are three modes. (1) Arithmetic: enter two durations in days/hours/minutes/seconds and choose add, subtract, multiply or divide — results show in HH:MM:SS, decimal hours, and human-readable form. (2) Between: enter two clock times like '9:00 AM' and '5:30 PM' and we compute the duration, automatically detecting cross-midnight cases. (3) Timesheet: paste multiple start/end/break rows and we total the net work hours with optional per-row labels.",
      },
      {
        q: "How do you handle crossing midnight?",
        a: "In 'between two times' and timesheet modes, if the end time is earlier than the start time (as seconds since midnight), we assume the end time is on the next calendar day and add 24 hours. For example, 22:00 to 02:00 returns 4 hours, not -20 hours. You can also force the next-day interpretation with the 'next day' toggle if your shift starts and ends on the same clock-time band (e.g. 12:00 PM to 12:00 PM next day).",
      },
      {
        q: "How do decimal hours work, and how are they rounded?",
        a: "We compute decimal hours as total_seconds ÷ 3600. This is the standard payroll representation — e.g. 7h 30m = 7.5h, 8h 15m = 8.25h. We use integer-second core math throughout to avoid floating-point drift; the only float operations are decimal-hour display and division results. For payroll rounding to the nearest minute, use the round/floor helpers (roundToMinute, floorToMinute) so 7h 30m 23s becomes 7h 30m = 7.500h.",
      },
      {
        q: "Can I totalize a timesheet with multiple rows and breaks?",
        a: "Yes. In Timesheet mode, paste one row per line in the format 'start end breakMinutes label' (e.g. '09:00 17:00 30 lunch'). We parse 12h (with AM/PM) or 24h times, subtract the break minutes from each row's gross duration, detect cross-midnight, and total all rows. The result includes gross total, break total, net total, and decimal hours. Export the breakdown as CSV for payroll or invoicing.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) All four arithmetic operations (add/subtract/multiply/divide) on durations. (2) Cross-midnight-aware between-times calculator with optional next-day override. (3) Multi-row timesheet totaler with per-row break minutes and labels. (4) Mixed-unit normalization (parse '1d 2h 3m 4s' or '90m' or '1:30:00'). (5) Decimal-hours conversion both ways. (6) 12h and 24h clock parsing and formatting. (7) Human-readable output ('1 day, 2 hours'). (8) Compact output ('1d2h3m4s'). (9) Payroll rounding helpers (round/floor to nearest minute). (10) CSV export of timesheet rows. (11) Calculation history (localStorage, max 20). (12) Shareable URL fragment encoding all inputs. (13) Privacy-first: 100% client-side, no uploads.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All time math runs locally in your browser using integer-second arithmetic. Timesheet data is never uploaded. History is stored in localStorage on this device only. The shareable URL uses a URL fragment (the part after #) which browsers never send to servers.",
      },
    ],
  },
  status: "done",
};
