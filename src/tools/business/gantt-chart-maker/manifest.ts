import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gantt-chart-maker",
  name: "Gantt Chart Maker (ASCII + HTML)",
  description:
    "Generate Gantt charts from a task list — ASCII and printable HTML versions. Parse tasks with start/end dates and progress, compute project duration, task offsets, durations, overlaps and weekend markers. Color presets (rainbow / blue-scale / priority-based), progress overlay, today marker. 18 extra features. 100% client-side.",
  category: "business",
  keywords: [
    "gantt chart", "project timeline", "task schedule",
    "ascii gantt", "html gantt", "project plan",
    "milestone", "schedule", "timeline",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Gantt Chart Maker — ASCII + HTML Gantt Generator | UnQTools",
    faq: [
      {
        q: "How does the Gantt chart maker work?",
        a: "Set a project start date and end date, then enter tasks — one per line in the format `title,start_date,end_date,progress` (e.g. `Design,2026-07-01,2026-07-05,100`). The tool parses tasks, computes each task's offset and duration within the project timeline, detects overlaps, marks weekends, and renders both an ASCII chart and a printable HTML chart with optional progress bars and a today marker.",
      },
      {
        q: "What output formats are supported?",
        a: "ASCII art (text-based chart, one row per task), printable HTML with inline CSS and colored cells, plain-text report, and CSV (title, start, end, duration_days, progress). Copy or download any format.",
      },
      {
        q: "Are weekends and the current day shown?",
        a: "Yes. Enable 'Show weekends' to gray out weekend columns in both ASCII and HTML charts. Enable 'Show today' to draw a vertical marker at the current date (clamped to the project range).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Task parser with date validation. (2) Project duration calculator. (3) Task offset calculator. (4) Task duration calculator. (5) Date range validator. (6) Task overlap detector. (7) ASCII Gantt chart generator. (8) HTML Gantt chart generator (printable, inline CSS). (9) Progress bar overlay. (10) Today marker. (11) Render as text report. (12) Render as CSV. (13) Copy + Download .txt + Download HTML + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL. (16) Summary stats (total tasks, project duration, completed, in-progress). (17) 3 color presets (rainbow, blue-scale, priority-based). (18) Weekend marker.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All chart generation, parsing and calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
