import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meeting-notes-maker",
  name: "Meeting Notes Maker",
  description:
    "Generate structured meeting notes — agenda recap, decisions, action items (grouped by owner + sorted by due date), parking lot, and next-meeting pointer. Parses attendees, agenda recap (topic,discussion), decisions, action items (task,owner,due_date), parking lot. Calculates meeting duration, detects overdue action items, renders as text, printable HTML, or Markdown. 18 extra features: 5 parsers, duration calculator, by-owner grouper, by-due-date sorter, overdue detector, 7 meeting-type presets, 3 renderers, summary stats, history (localStorage), shareable URL, copy/download .txt/.html/.md/.csv. 100% client-side.",
  category: "business",
  keywords: [
    "meeting notes", "meeting minutes", "notes maker",
    "action items", "decisions", "parking lot",
    "agenda recap", "meeting summary", "facilitator",
    "follow-up", "owner", "due date",
  ],
  icon: "clipboard-list",
  requiresNetwork: false,
  seo: {
    title: "Meeting Notes Maker — Decisions, Action Items, Parking Lot | UnQTools",
    faq: [
      {
        q: "How does the meeting notes maker work?",
        a: "Enter the meeting title, date, start/end time, location, facilitator, and attendees (one per line). For agenda recap use `topic,discussion_summary` per line. List decisions (one per line) and action items as `task,owner,due_date` per line. Add parking-lot items (one per line) and an optional next-meeting date. The tool calculates meeting duration, groups action items by owner, sorts them by due date (earliest first), flags overdue items, and exports as text, printable HTML, or Markdown.",
      },
      {
        q: "What format are action items in?",
        a: "One per line, comma-separated: `task,owner,due_date`. Example: `Draft proposal,Alice,2026-07-25`. The due_date must be YYYY-MM-DD. The parser strips quotes, handles commas inside quoted values, and skips blank lines. Lines with missing fields are reported as errors. Action items without a due date still appear, sorted after dated items.",
      },
      {
        q: "How are action items grouped and sorted?",
        a: "Action items are grouped by owner (alphabetical) so each owner sees their tasks together, and within the master list they are sorted by due date (earliest first) so the most urgent items bubble to the top. Items without a due date appear at the end. Overdue items (due before today) are flagged with an OVERDUE marker.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Attendees parser (one per line). (2) Agenda recap parser (CSV: topic,discussion_summary). (3) Decisions parser (one per line). (4) Action items parser (CSV: task,owner,due_date). (5) Parking lot parser (one per line). (6) Meeting duration calculator (end − start, wraps midnight). (7) Action items by-owner grouper. (8) Action items by-due-date sorter. (9) Decisions / action items / parking lot counters. (10) Plain-text notes renderer (formatted). (11) Printable HTML notes renderer (inline CSS). (12) Markdown notes renderer (wiki/Notion compatible). (13) Copy + Download .txt/.html/.md/.csv. (14) History (localStorage, last 20). (15) Shareable URL (encode inputs in hash). (16) Summary stats (attendees, decisions, action items, parking lot, duration, overdue count). (17) Action item overdue detector (compare due_date to today). (18) 7 meeting-type presets (standup, weekly, monthly, quarterly, retrospective, 1:1, brainstorm).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, grouping, sorting, and rendering happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
