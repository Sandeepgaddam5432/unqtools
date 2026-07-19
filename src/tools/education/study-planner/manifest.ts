import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "study-planner",
  name: "Study Planner & Exam Timetable",
  description:
    "Plan study schedules for exams — break subjects into daily study blocks with Pomodoro-style sessions, breaks, and revision days. Days-until-exam calculator, auto-adjusted chapters-per-day, weekly timetables, per-day session blocks with time slots, holiday/exclusion support, per-chapter difficulty markers, text/CSV/HTML export, history (localStorage), shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "study planner", "study schedule", "exam planner",
    "timetable", "pomodoro", "study session",
    "revision", "exam prep", "education",
  ],
  icon: "calendar-clock",
  requiresNetwork: false,
  seo: {
    title: "Study Planner & Exam Timetable — Pomodoro Sessions + Revision Days | UnQTools",
    faq: [
      {
        q: "How does the study planner work?",
        a: "Enter your subject name, exam date, total chapters, daily study hours, and session/break durations. The tool calculates days until exam, auto-adjusts chapters-per-day to fit your time budget, generates Pomodoro-style session blocks (50 min study + 15 min break, with a 60-min long break every 4 sessions), reserves the last 2 days for revision, and produces a day-by-day timetable with chapter-to-session assignments.",
      },
      {
        q: "How are revision days handled?",
        a: "When 'include revision' is on, the tool reserves the last 2 study days before the exam for revision (no new chapters assigned — sessions are marked as 'revision'). The remaining study days are allocated to new chapters so you finish learning before revision begins.",
      },
      {
        q: "How does the Pomodoro scheduler work?",
        a: "Each study day starts at your chosen start time. Sessions follow a Pomodoro-style pattern: sessionDurationMin study + breakDurationMin break, repeated. After every 4 study sessions a long break of 60 minutes is inserted. Sessions continue until your dailyStudyHours budget is exhausted.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Days-until-exam calculator. (2) Auto-adjusted chapters-per-day. (3) Pomodoro session block generator. (4) Revision day allocator (last 2 days reserved). (5) Weekly summary generator (hours, chapters, study days). (6) Per-day schedule with time slots. (7) Break presets (5/10/15/30 min). (8) Session duration presets (25/50/90 min). (9) Text timetable renderer. (10) CSV export. (11) Printable HTML timetable with inline CSS. (12) Copy + Download .txt + Download CSV + Download HTML. (13) History (localStorage, last 20). (14) Shareable URL with inputs encoded in hash. (15) Summary stats (total days, sessions, hours, chapters, revision days). (16) Holiday/exclusion date support (comma-separated dates to skip). (17) Per-chapter difficulty markers (easy/medium/hard — adjust session allocation). (18) Study days per week selector (1-7).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All planning, scheduling and rendering runs locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
