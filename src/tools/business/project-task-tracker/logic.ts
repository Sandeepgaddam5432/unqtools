/**
 * Project Task Tracker — pure logic.
 *
 * Parse task lists, filter and sort, compute stats, render text/CSV reports.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type Status = "todo" | "in-progress" | "blocked" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type FilterBy = "all" | "by-priority" | "by-status" | "by-assignee" | "overdue";
export type SortBy = "due-date" | "priority" | "status" | "title";

export interface Task {
  title: string;
  priority: Priority;
  status: Status;
  dueDate: string; // YYYY-MM-DD or ""
  assignee: string;
}

export interface ParseResult {
  tasks: Task[];
  errors: string[];
}

export interface TaskStats {
  total: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  overdue: number;
  completionPct: number;
}

export interface SummaryStats {
  total: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  overdue: number;
  completionPct: number;
  uniqueAssignees: number;
  nextDueTask: Task | null;
}

export interface HistoryEntry {
  ts: number;
  projectName: string;
  taskCount: number;
  completionPct: number;
}

// ---- Constants / Presets ----

export const STATUS_PRESETS: Status[] = ["todo", "in-progress", "blocked", "done"];

export const PRIORITY_PRESETS: Priority[] = ["low", "medium", "high", "urgent"];

export const FILTER_OPTIONS: FilterBy[] = ["all", "by-priority", "by-status", "by-assignee", "overdue"];

export const SORT_OPTIONS: SortBy[] = ["due-date", "priority", "status", "title"];

export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const STATUS_ORDER: Record<Status, number> = {
  todo: 1,
  "in-progress": 2,
  blocked: 3,
  done: 4,
};

export const STATUS_LABELS: Record<Status, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  blocked: "Blocked",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// ---- Parsing ----

/** Normalize a priority string (case-insensitive, alias aware). */
export function normalizePriority(s: string): Priority {
  const k = (s || "").toLowerCase().trim();
  if (k === "urgent" || k === "u" || k === "p1" || k === "critical") return "urgent";
  if (k === "high" || k === "h" || k === "p2") return "high";
  if (k === "medium" || k === "m" || k === "med" || k === "p3" || k === "normal") return "medium";
  return "low";
}

/** Normalize a status string (case-insensitive, alias aware). */
export function normalizeStatus(s: string): Status {
  const k = (s || "").toLowerCase().trim().replace(/\s+/g, "-");
  if (k === "todo" || k === "to-do" || k === "backlog" || k === "open") return "todo";
  if (k === "in-progress" || k === "inprogress" || k === "doing" || k === "wip" || k === "progress") return "in-progress";
  if (k === "blocked" || k === "stuck" || k === "waiting") return "blocked";
  if (k === "done" || k === "completed" || k === "complete" || k === "closed" || k === "finished") return "done";
  return "todo";
}

/** Split a CSV row honoring quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/** Validate YYYY-MM-DD date and return canonical form (or ""). */
export function normalizeDate(s: string): string {
  const k = (s || "").trim();
  if (!k) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) return "";
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse `title,priority,status,due_date,assignee` lines. */
export function parseTasks(text: string): ParseResult {
  const tasks: Task[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { tasks, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 3) {
      errors.push(`Line ${idx + 1}: needs at least title,priority,status`);
      return;
    }
    const [title, priorityStr, statusStr, dueStr, assigneeStr] = parts;
    if (!title) {
      errors.push(`Line ${idx + 1}: title is required`);
      return;
    }
    const priority = normalizePriority(priorityStr);
    const status = normalizeStatus(statusStr);
    const dueDate = dueStr ? normalizeDate(dueStr) : "";
    if (dueStr && !dueDate) {
      errors.push(`Line ${idx + 1}: invalid due_date "${dueStr}" (use YYYY-MM-DD)`);
      return;
    }
    tasks.push({
      title,
      priority,
      status,
      dueDate,
      assignee: (assigneeStr || "").trim(),
    });
  });
  return { tasks, errors };
}

// ---- Filtering ----

/** Determine whether a task is overdue relative to `today` (YYYY-MM-DD). */
export function isOverdue(task: Task, today: string): boolean {
  if (!task.dueDate || task.status === "done") return false;
  if (!today) return false;
  return task.dueDate < today;
}

/** Filter tasks by the selected criteria. */
export function filterTasks(
  tasks: Task[],
  filterBy: FilterBy,
  value: string,
  today: string,
): Task[] {
  if (filterBy === "all") return [...tasks];
  if (filterBy === "overdue") return tasks.filter((t) => isOverdue(t, today));
  if (filterBy === "by-priority") {
    const p = normalizePriority(value);
    return tasks.filter((t) => t.priority === p);
  }
  if (filterBy === "by-status") {
    const s = normalizeStatus(value);
    return tasks.filter((t) => t.status === s);
  }
  if (filterBy === "by-assignee") {
    const a = (value || "").toLowerCase().trim();
    if (!a) return [...tasks];
    return tasks.filter((t) => t.assignee.toLowerCase() === a);
  }
  return [...tasks];
}

// ---- Sorting ----

/** Sort tasks by the selected criteria. Returns a new sorted array. */
export function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const out = [...tasks];
  if (sortBy === "due-date") {
    out.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortBy === "priority") {
    out.sort((a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]);
  } else if (sortBy === "status") {
    out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  } else if (sortBy === "title") {
    out.sort((a, b) => a.title.localeCompare(b.title));
  }
  return out;
}

// ---- Calculations ----

/** Calculate completion % (done / total × 100), 0 if no tasks. */
export function calcCompletionPct(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

/** Compute the priority weight of a task (urgent=4, high=3, medium=2, low=1). */
export function priorityWeight(priority: Priority): number {
  return PRIORITY_WEIGHTS[priority];
}

/** Compute stats: total, by-status, by-priority, overdue, completion %. */
export function computeStats(tasks: Task[], today: string): TaskStats {
  const byStatus: Record<Status, number> = {
    todo: 0, "in-progress": 0, blocked: 0, done: 0,
  };
  const byPriority: Record<Priority, number> = {
    low: 0, medium: 0, high: 0, urgent: 0,
  };
  let overdue = 0;
  for (const t of tasks) {
    byStatus[t.status] += 1;
    byPriority[t.priority] += 1;
    if (isOverdue(t, today)) overdue += 1;
  }
  return {
    total: tasks.length,
    byStatus,
    byPriority,
    overdue,
    completionPct: calcCompletionPct(tasks),
  };
}

/** Recommend the next action: highest priority + earliest due date among open tasks. */
export function nextAction(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => t.status !== "done");
  if (open.length === 0) return null;
  const sorted = [...open].sort((a, b) => {
    const w = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
    if (w !== 0) return w;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  return sorted[0];
}

/** Compute summary stats including unique assignees and next due task. */
export function summaryStats(tasks: Task[], today: string): SummaryStats {
  const base = computeStats(tasks, today);
  const assignees = new Set<string>();
  for (const t of tasks) {
    if (t.assignee) assignees.add(t.assignee.toLowerCase());
  }
  const open = tasks.filter((t) => t.status !== "done" && t.dueDate);
  let nextDueTask: Task | null = null;
  if (open.length > 0) {
    nextDueTask = [...open].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  }
  return {
    ...base,
    uniqueAssignees: assignees.size,
    nextDueTask,
  };
}

// ---- Renderers ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Calculate the number of days a task is overdue (0 if not overdue or done). */
export function daysOverdue(task: Task, today: string): number {
  if (!isOverdue(task, today)) return 0;
  const t1 = new Date(task.dueDate + "T00:00:00Z").getTime();
  const t2 = new Date(today + "T00:00:00Z").getTime();
  return Math.floor((t2 - t1) / 86_400_000);
}

/** Render tasks as a text report grouped by status (Kanban style). */
export function renderText(
  tasks: Task[],
  projectName: string,
  today: string,
): string {
  const L: string[] = [];
  const header = projectName || "Project Tasks";
  L.push("=".repeat(60));
  L.push(header.toUpperCase());
  L.push("=".repeat(60));
  const stats = computeStats(tasks, today);
  L.push(`Total: ${stats.total}  |  Done: ${stats.byStatus.done}  |  Overdue: ${stats.overdue}  |  Completion: ${stats.completionPct}%`);
  L.push("-".repeat(60));

  for (const s of STATUS_PRESETS) {
    const group = tasks.filter((t) => t.status === s);
    L.push("");
    L.push(`[${STATUS_LABELS[s]}] — ${group.length}`);
    L.push("-".repeat(40));
    if (group.length === 0) {
      L.push("  (none)");
      continue;
    }
    for (const t of group) {
      const od = isOverdue(t, today) ? "  ⚠ OVERDUE" : "";
      const due = t.dueDate ? `  due:${t.dueDate}` : "";
      const asg = t.assignee ? `  @${t.assignee}` : "";
      L.push(`  • (${PRIORITY_LABELS[t.priority]}) ${t.title}${due}${asg}${od}`);
    }
  }

  const nxt = nextAction(tasks);
  L.push("");
  L.push("-".repeat(60));
  if (nxt) {
    L.push(`Next action: ${nxt.title} [${PRIORITY_LABELS[nxt.priority]}]${nxt.dueDate ? ` due ${nxt.dueDate}` : ""}${nxt.assignee ? ` @${nxt.assignee}` : ""}`);
  } else {
    L.push("Next action: all tasks done 🎉");
  }
  return L.join("\n");
}

/** Render tasks as CSV (title,priority,status,due_date,assignee,days_overdue). */
export function renderCsv(tasks: Task[], today: string): string {
  const lines = ["title,priority,status,due_date,assignee,days_overdue"];
  for (const t of tasks) {
    lines.push([
      escapeCsv(t.title),
      t.priority,
      t.status,
      t.dueDate,
      escapeCsv(t.assignee),
      String(daysOverdue(t, today)),
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:project-task-tracker:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareParams {
  projectName: string;
  tasksText: string;
  filterBy: FilterBy;
  filterValue: string;
  sortBy: SortBy;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  if (p.projectName) params.set("proj", p.projectName);
  if (p.tasksText) params.set("tasks", p.tasksText);
  if (p.filterBy && p.filterBy !== "all") params.set("filter", p.filterBy);
  if (p.filterValue) params.set("fv", p.filterValue);
  if (p.sortBy) params.set("sort", p.sortBy);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const out: ShareParams = { projectName: "", tasksText: "", filterBy: "all", filterValue: "", sortBy: "priority" };
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  out.projectName = params.get("proj") ?? "";
  out.tasksText = params.get("tasks") ?? "";
  const f = params.get("filter") as FilterBy | null;
  if (f && FILTER_OPTIONS.includes(f)) out.filterBy = f;
  out.filterValue = params.get("fv") ?? "";
  const s = params.get("sort") as SortBy | null;
  if (s && SORT_OPTIONS.includes(s)) out.sortBy = s;
  return out;
}
