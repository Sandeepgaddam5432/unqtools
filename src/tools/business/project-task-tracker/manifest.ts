import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "project-task-tracker",
  name: "Project Task Tracker (Kanban)",
  description:
    "Track project tasks with priorities, statuses, due dates and assignees — Kanban-style organization. Parse CSV task lists, filter by priority/status/assignee/overdue, sort by due-date/priority/status/title, compute summary stats (total, by-status, by-priority, overdue, completion %), priority weighting, next-action recommender, copy/download text + CSV, history (localStorage), shareable URL. 18 extra features. 100% client-side.",
  category: "business",
  keywords: [
    "task tracker", "project management", "kanban",
    "todo list", "task list", "priority",
    "due date", "assignee", "agile",
  ],
  icon: "kanban-square",
  requiresNetwork: false,
  seo: {
    title: "Project Task Tracker — Kanban Style (Priorities, Status, Due Dates) | UnQTools",
    faq: [
      {
        q: "How does the project task tracker work?",
        a: "Enter a project name and a list of tasks — one per line in the format `title,priority,status,due_date,assignee` (e.g. `Design homepage,high,todo,2026-07-20,Alice`). The tool parses, filters and sorts tasks, then renders a Kanban-style report grouped by status with completion %, overdue count, priority breakdown, and next-action recommendation.",
      },
      {
        q: "What statuses and priorities are supported?",
        a: "Statuses: todo, in-progress, blocked, done. Priorities: low, medium, high, urgent. Each priority has a numeric weight (urgent=4, high=3, medium=2, low=1) used for sorting and the next-action recommender.",
      },
      {
        q: "Can I filter and sort tasks?",
        a: "Yes. Filter by all / by-priority / by-status / by-assignee / overdue. Sort by due-date / priority / status / title. The filtered and sorted list is reflected in the report, CSV export and text export.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Task parser with field validation. (2) 4 status presets. (3) 4 priority presets. (4) Filter by priority/status/assignee/overdue. (5) Sort by due-date/priority/status/title. (6) Total tasks counter. (7) Status breakdown counter. (8) Priority breakdown counter. (9) Overdue task finder. (10) Completion % calculator. (11) Render as text report (grouped by status). (12) Render as CSV. (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL. (16) Summary stats. (17) Priority weight calculator. (18) Next-action recommender.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All task parsing, filtering, sorting and stats run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
