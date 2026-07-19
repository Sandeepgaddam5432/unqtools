import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "time-tracker",
  name: "Time Tracker",
  description:
    "Track time spent on tasks and projects — start/stop/pause timer, project tags, billable hours, hourly rates. Daily/weekly summaries, project breakdowns, time rounding (6/15/30 min for billing), CSV/text reports, history (localStorage), shareable URL. 100% client-side.",
  category: "business",
  keywords: [
    "time tracker", "timer", "timesheet", "billable hours",
    "project tracking", "freelance", "time logging",
    "hourly rate", "time clock", "punch card",
  ],
  icon: "timer",
  requiresNetwork: false,
  seo: {
    title: "Time Tracker — Billable Hours, Projects, Reports | UnQTools",
    faq: [
      {
        q: "How does the time tracker work?",
        a: "Enter a task name (and optional project, billable flag, hourly rate, notes), then click Start. The timer counts elapsed time in HH:MM:SS. Click Pause to halt without saving, Resume to continue, or Stop to save the entry. Saved entries are listed in a table with daily/weekly summaries, project breakdowns, and billable totals.",
      },
      {
        q: "Can I round time for billing?",
        a: "Yes. Pick a rounding preset — 6-minute (1/10 hr), 15-minute (1/4 hr), 30-minute (1/2 hr), or no rounding. Rounding is applied per-entry to the duration before computing the billable amount. Most consultants round up to the nearest 6 or 15 minutes.",
      },
      {
        q: "Can I export my timesheet?",
        a: "Yes. Download all entries as a CSV (date, task, project, duration_hours, billable, rate, cost) or as a formatted text report. Copy a shareable URL with the entries encoded in the hash to send to a colleague.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Start/Stop/Pause/Resume timer logic. (2) Time formatter (HH:MM:SS). (3) Time parser (HH:MM:SS → ms). (4) Duration calculator. (5) Billable amount calculator. (6) Entry validator (taskName required, duration > 0). (7) Day/week grouper. (8) Project summary. (9) Billable summary. (10) Text report generator. (11) CSV report generator. (12) History (localStorage, max 100 entries). (13) Shareable URL. (14) Summary stats (total entries, hours, billable, cost). (15) Time rounding presets (6/15/30 min, none). (16) Project tag suggestions from previous entries.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The timer runs entirely in your browser. Entries are stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
