import { describe, it, expect, beforeEach } from "vitest";
import {
  STATUS_PRESETS,
  PRIORITY_PRESETS,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  PRIORITY_WEIGHTS,
  STATUS_ORDER,
  STATUS_LABELS,
  PRIORITY_LABELS,
  normalizePriority,
  normalizeStatus,
  splitCsvRow,
  normalizeDate,
  parseTasks,
  isOverdue,
  filterTasks,
  sortTasks,
  calcCompletionPct,
  priorityWeight,
  computeStats,
  nextAction,
  summaryStats,
  daysOverdue,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Status,
  type Priority,
  type FilterBy,
  type SortBy,
  type Task,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("project-task-tracker constants", () => {
  it("has 4 status presets", () => {
    expect(STATUS_PRESETS).toEqual(["todo", "in-progress", "blocked", "done"]);
  });
  it("has 4 priority presets", () => {
    expect(PRIORITY_PRESETS).toEqual(["low", "medium", "high", "urgent"]);
  });
  it("has 5 filter options", () => {
    expect(FILTER_OPTIONS).toHaveLength(5);
  });
  it("has 4 sort options", () => {
    expect(SORT_OPTIONS).toHaveLength(4);
  });
  it("priority weights are urgent=4 high=3 medium=2 low=1", () => {
    expect(PRIORITY_WEIGHTS.urgent).toBe(4);
    expect(PRIORITY_WEIGHTS.high).toBe(3);
    expect(PRIORITY_WEIGHTS.medium).toBe(2);
    expect(PRIORITY_WEIGHTS.low).toBe(1);
  });
  it("status order is sequential", () => {
    expect(STATUS_ORDER.todo).toBe(1);
    expect(STATUS_ORDER.done).toBe(4);
  });
  it("labels exist for every status", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(4);
  });
  it("labels exist for every priority", () => {
    expect(Object.keys(PRIORITY_LABELS)).toHaveLength(4);
  });
});

describe("project-task-tracker normalizePriority", () => {
  it("normalizes lowercase exact", () => {
    expect(normalizePriority("urgent")).toBe("urgent");
    expect(normalizePriority("high")).toBe("high");
    expect(normalizePriority("medium")).toBe("medium");
    expect(normalizePriority("low")).toBe("low");
  });
  it("normalizes aliases", () => {
    expect(normalizePriority("P1")).toBe("urgent");
    expect(normalizePriority("Critical")).toBe("urgent");
    expect(normalizePriority("P2")).toBe("high");
    expect(normalizePriority("med")).toBe("medium");
    expect(normalizePriority("normal")).toBe("medium");
  });
  it("defaults to low for unknown", () => {
    expect(normalizePriority("")).toBe("low");
    expect(normalizePriority("xyz")).toBe("low");
  });
});

describe("project-task-tracker normalizeStatus", () => {
  it("normalizes exact", () => {
    expect(normalizeStatus("todo")).toBe("todo");
    expect(normalizeStatus("in-progress")).toBe("in-progress");
    expect(normalizeStatus("blocked")).toBe("blocked");
    expect(normalizeStatus("done")).toBe("done");
  });
  it("normalizes aliases", () => {
    expect(normalizeStatus("To-Do")).toBe("todo");
    expect(normalizeStatus("backlog")).toBe("todo");
    expect(normalizeStatus("doing")).toBe("in-progress");
    expect(normalizeStatus("wip")).toBe("in-progress");
    expect(normalizeStatus("stuck")).toBe("blocked");
    expect(normalizeStatus("completed")).toBe("done");
    expect(normalizeStatus("closed")).toBe("done");
  });
  it("defaults to todo for unknown", () => {
    expect(normalizeStatus("")).toBe("todo");
    expect(normalizeStatus("xyz")).toBe("todo");
  });
});

describe("project-task-tracker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("project-task-tracker normalizeDate", () => {
  it("returns canonical YYYY-MM-DD for valid date", () => {
    expect(normalizeDate("2026-07-20")).toBe("2026-07-20");
  });
  it("returns empty for invalid date", () => {
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("not-a-date")).toBe("");
    expect(normalizeDate("2026-13-01")).toBe("");
    expect(normalizeDate("2026-02-31")).toBe("");
  });
  it("rejects wrong format", () => {
    expect(normalizeDate("20-07-2026")).toBe("");
    expect(normalizeDate("2026/07/20")).toBe("");
  });
});

describe("project-task-tracker parseTasks", () => {
  it("parses valid lines", () => {
    const text = "Design homepage,high,todo,2026-07-20,Alice\nCode API,urgent,in-progress,2026-07-15,Bob";
    const { tasks, errors } = parseTasks(text);
    expect(tasks).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(tasks[0].title).toBe("Design homepage");
    expect(tasks[0].priority).toBe("high");
    expect(tasks[0].status).toBe("todo");
    expect(tasks[0].dueDate).toBe("2026-07-20");
    expect(tasks[0].assignee).toBe("Alice");
    expect(tasks[1].priority).toBe("urgent");
  });
  it("handles missing assignee", () => {
    const { tasks, errors } = parseTasks("Task A,medium,done,2026-01-01");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assignee).toBe("");
    expect(errors).toHaveLength(0);
  });
  it("handles missing due date", () => {
    const { tasks } = parseTasks("Task A,medium,todo,,Alice");
    expect(tasks[0].dueDate).toBe("");
  });
  it("reports error for too few fields", () => {
    const { tasks, errors } = parseTasks("Only title");
    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("needs at least");
  });
  it("reports error for invalid date", () => {
    const { tasks, errors } = parseTasks("Task A,medium,todo,2026-13-99,Alice");
    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid due_date");
  });
  it("skips empty lines", () => {
    const { tasks } = parseTasks("A,l,todo,,\n\nB,l,todo,,");
    expect(tasks).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseTasks("")).toEqual({ tasks: [], errors: [] });
    expect(parseTasks("   \n  ")).toEqual({ tasks: [], errors: [] });
  });
  it("normalizes aliases when parsing", () => {
    const { tasks } = parseTasks("T,P1,completed,2026-07-20,A");
    expect(tasks[0].priority).toBe("urgent");
    expect(tasks[0].status).toBe("done");
  });
  it("handles quoted titles with commas", () => {
    const { tasks } = parseTasks('"Task, with comma",low,todo,,');
    expect(tasks[0].title).toBe("Task, with comma");
  });
});

describe("project-task-tracker isOverdue", () => {
  const today = "2026-07-25";
  it("returns true when due date is before today and not done", () => {
    expect(isOverdue({ title: "T", priority: "low", status: "todo", dueDate: "2026-07-20", assignee: "" }, today)).toBe(true);
  });
  it("returns false when due date is in the future", () => {
    expect(isOverdue({ title: "T", priority: "low", status: "todo", dueDate: "2026-08-01", assignee: "" }, today)).toBe(false);
  });
  it("returns false when task is done", () => {
    expect(isOverdue({ title: "T", priority: "low", status: "done", dueDate: "2026-07-01", assignee: "" }, today)).toBe(false);
  });
  it("returns false when no due date", () => {
    expect(isOverdue({ title: "T", priority: "low", status: "todo", dueDate: "", assignee: "" }, today)).toBe(false);
  });
  it("returns false when today is empty", () => {
    expect(isOverdue({ title: "T", priority: "low", status: "todo", dueDate: "2026-07-20", assignee: "" }, "")).toBe(false);
  });
});

describe("project-task-tracker filterTasks", () => {
  const today = "2026-07-25";
  const tasks = [
    { title: "A", priority: "high" as Priority, status: "todo" as Status, dueDate: "2026-07-20", assignee: "Alice" },
    { title: "B", priority: "low" as Priority, status: "done" as Status, dueDate: "2026-07-15", assignee: "Bob" },
    { title: "C", priority: "urgent" as Priority, status: "in-progress" as Status, dueDate: "2026-08-01", assignee: "Alice" },
  ];
  it("returns all when filter is all", () => {
    expect(filterTasks(tasks, "all", "", today)).toHaveLength(3);
  });
  it("filters by priority", () => {
    expect(filterTasks(tasks, "by-priority", "high", today)).toHaveLength(1);
    expect(filterTasks(tasks, "by-priority", "urgent", today)).toHaveLength(1);
  });
  it("filters by status", () => {
    expect(filterTasks(tasks, "by-status", "done", today)).toHaveLength(1);
    expect(filterTasks(tasks, "by-status", "todo", today)).toHaveLength(1);
  });
  it("filters by assignee (case-insensitive)", () => {
    expect(filterTasks(tasks, "by-assignee", "alice", today)).toHaveLength(2);
    expect(filterTasks(tasks, "by-assignee", "bob", today)).toHaveLength(1);
    expect(filterTasks(tasks, "by-assignee", "", today)).toHaveLength(3);
  });
  it("filters overdue", () => {
    const out = filterTasks(tasks, "overdue", "", today);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("A");
  });
});

describe("project-task-tracker sortTasks", () => {
  const tasks = [
    { title: "Zeta", priority: "low" as Priority, status: "done" as Status, dueDate: "2026-08-10", assignee: "" },
    { title: "Alpha", priority: "urgent" as Priority, status: "todo" as Status, dueDate: "2026-07-20", assignee: "" },
    { title: "Mid", priority: "high" as Priority, status: "blocked" as Status, dueDate: "", assignee: "" },
  ];
  it("sorts by due-date (no due dates last)", () => {
    const out = sortTasks(tasks, "due-date");
    expect(out[0].title).toBe("Alpha");
    expect(out[1].title).toBe("Zeta");
    expect(out[2].title).toBe("Mid");
  });
  it("sorts by priority (urgent first)", () => {
    const out = sortTasks(tasks, "priority");
    expect(out[0].priority).toBe("urgent");
    expect(out[1].priority).toBe("high");
    expect(out[2].priority).toBe("low");
  });
  it("sorts by status (todo first, done last)", () => {
    const out = sortTasks(tasks, "status");
    expect(out[0].status).toBe("todo");
    expect(out[2].status).toBe("done");
  });
  it("sorts by title alphabetically", () => {
    const out = sortTasks(tasks, "title");
    expect(out[0].title).toBe("Alpha");
    expect(out[1].title).toBe("Mid");
    expect(out[2].title).toBe("Zeta");
  });
  it("does not mutate input", () => {
    const before = tasks.map((t) => t.title);
    sortTasks(tasks, "title");
    expect(tasks.map((t) => t.title)).toEqual(before);
  });
});

describe("project-task-tracker calcCompletionPct", () => {
  it("returns 0 for empty list", () => {
    expect(calcCompletionPct([])).toBe(0);
  });
  it("returns percentage of done tasks", () => {
    const tasks: Task[] = [
      { title: "A", priority: "low", status: "done", dueDate: "", assignee: "" },
      { title: "B", priority: "low", status: "todo", dueDate: "", assignee: "" },
      { title: "C", priority: "low", status: "done", dueDate: "", assignee: "" },
      { title: "D", priority: "low", status: "todo", dueDate: "", assignee: "" },
    ];
    expect(calcCompletionPct(tasks)).toBe(50);
  });
  it("returns 100 when all done", () => {
    const tasks: Task[] = [
      { title: "A", priority: "low", status: "done", dueDate: "", assignee: "" },
      { title: "B", priority: "low", status: "done", dueDate: "", assignee: "" },
    ];
    expect(calcCompletionPct(tasks)).toBe(100);
  });
});

describe("project-task-tracker priorityWeight", () => {
  it("returns the weight for each priority", () => {
    expect(priorityWeight("urgent")).toBe(4);
    expect(priorityWeight("high")).toBe(3);
    expect(priorityWeight("medium")).toBe(2);
    expect(priorityWeight("low")).toBe(1);
  });
});

describe("project-task-tracker computeStats", () => {
  const today = "2026-07-25";
  it("computes counts and completion", () => {
    const tasks: Task[] = [
      { title: "A", priority: "urgent", status: "done", dueDate: "2026-07-10", assignee: "x" },
      { title: "B", priority: "high", status: "todo", dueDate: "2026-07-20", assignee: "y" },
      { title: "C", priority: "medium", status: "todo", dueDate: "2026-08-01", assignee: "x" },
    ];
    const stats = computeStats(tasks, today);
    expect(stats.total).toBe(3);
    expect(stats.byStatus.done).toBe(1);
    expect(stats.byStatus.todo).toBe(2);
    expect(stats.byStatus["in-progress"]).toBe(0);
    expect(stats.byPriority.urgent).toBe(1);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.medium).toBe(1);
    expect(stats.overdue).toBe(1); // B
    expect(stats.completionPct).toBe(33);
  });
  it("returns zeros for empty list", () => {
    const stats = computeStats([], today);
    expect(stats.total).toBe(0);
    expect(stats.overdue).toBe(0);
    expect(stats.completionPct).toBe(0);
  });
});

describe("project-task-tracker nextAction", () => {
  it("picks highest priority open task", () => {
    const tasks = [
      { title: "Low", priority: "low" as Priority, status: "todo" as Status, dueDate: "", assignee: "" },
      { title: "Urgent", priority: "urgent" as Priority, status: "todo" as Status, dueDate: "", assignee: "" },
      { title: "Done", priority: "urgent" as Priority, status: "done" as Status, dueDate: "", assignee: "" },
    ];
    const n = nextAction(tasks);
    expect(n?.title).toBe("Urgent");
  });
  it("breaks ties by earliest due date", () => {
    const tasks = [
      { title: "Late", priority: "high" as Priority, status: "todo" as Status, dueDate: "2026-08-10", assignee: "" },
      { title: "Early", priority: "high" as Priority, status: "todo" as Status, dueDate: "2026-07-20", assignee: "" },
    ];
    expect(nextAction(tasks)?.title).toBe("Early");
  });
  it("returns null when all done", () => {
    const tasks: Task[] = [
      { title: "A", priority: "urgent", status: "done", dueDate: "", assignee: "" },
    ];
    expect(nextAction(tasks)).toBeNull();
  });
  it("returns null for empty list", () => {
    expect(nextAction([])).toBeNull();
  });
  it("puts no-due-date tasks after due-date tasks at same priority", () => {
    const tasks = [
      { title: "NoDate", priority: "high" as Priority, status: "todo" as Status, dueDate: "", assignee: "" },
      { title: "WithDate", priority: "high" as Priority, status: "todo" as Status, dueDate: "2026-09-01", assignee: "" },
    ];
    expect(nextAction(tasks)?.title).toBe("WithDate");
  });
});

describe("project-task-tracker summaryStats", () => {
  const today = "2026-07-25";
  it("counts unique assignees and finds next due task", () => {
    const tasks: Task[] = [
      { title: "A", priority: "low", status: "done", dueDate: "2026-07-10", assignee: "Alice" },
      { title: "B", priority: "high", status: "todo", dueDate: "2026-08-01", assignee: "Bob" },
      { title: "C", priority: "medium", status: "todo", dueDate: "2026-07-28", assignee: "alice" },
    ];
    const s = summaryStats(tasks, today);
    expect(s.uniqueAssignees).toBe(2); // Alice + alice collapsed
    expect(s.nextDueTask?.title).toBe("C");
    expect(s.completionPct).toBe(33);
  });
  it("returns null nextDueTask when no open tasks with due dates", () => {
    const tasks: Task[] = [
      { title: "A", priority: "low", status: "done", dueDate: "2026-07-10", assignee: "x" },
    ];
    expect(summaryStats(tasks, today).nextDueTask).toBeNull();
  });
});

describe("project-task-tracker daysOverdue", () => {
  const today = "2026-07-25";
  it("returns 0 for not overdue", () => {
    expect(daysOverdue({ title: "T", priority: "low", status: "todo", dueDate: "2026-08-01", assignee: "" }, today)).toBe(0);
  });
  it("returns 0 for done tasks", () => {
    expect(daysOverdue({ title: "T", priority: "low", status: "done", dueDate: "2026-07-01", assignee: "" }, today)).toBe(0);
  });
  it("returns positive number of days overdue", () => {
    expect(daysOverdue({ title: "T", priority: "low", status: "todo", dueDate: "2026-07-20", assignee: "" }, today)).toBe(5);
  });
});

describe("project-task-tracker renderText", () => {
  const today = "2026-07-25";
  it("renders header, groups by status and shows next action", () => {
    const tasks: Task[] = [
      { title: "A", priority: "urgent", status: "todo", dueDate: "2026-07-20", assignee: "Alice" },
      { title: "B", priority: "low", status: "done", dueDate: "2026-07-10", assignee: "Bob" },
    ];
    const text = renderText(tasks, "My Project", today);
    expect(text).toContain("MY PROJECT");
    expect(text).toContain("[To Do] — 1");
    expect(text).toContain("[Done] — 1");
    expect(text).toContain("(Urgent) A");
    expect(text).toContain("@Alice");
    expect(text).toContain("OVERDUE");
    expect(text).toContain("Next action: A");
    expect(text).toContain("Completion: 50%");
  });
  it("handles empty task list", () => {
    const text = renderText([], "Empty Project", today);
    expect(text).toContain("EMPTY PROJECT");
    expect(text).toContain("Total: 0");
    expect(text).toContain("(none)");
  });
  it("shows celebration when all done", () => {
    const text = renderText([
      { title: "X", priority: "low", status: "done", dueDate: "", assignee: "" },
    ], "P", today);
    expect(text).toContain("all tasks done");
  });
});

describe("project-task-tracker renderCsv", () => {
  const today = "2026-07-25";
  it("renders header", () => {
    expect(renderCsv([], today)).toContain("title,priority,status,due_date,assignee,days_overdue");
  });
  it("renders task rows", () => {
    const tasks: Task[] = [
      { title: "Task A", priority: "high", status: "todo", dueDate: "2026-07-20", assignee: "Alice" },
    ];
    const csv = renderCsv(tasks, today);
    expect(csv).toContain("Task A,high,todo,2026-07-20,Alice,5");
  });
  it("escapes commas in title", () => {
    const tasks: Task[] = [
      { title: "Task, with comma", priority: "low", status: "todo", dueDate: "", assignee: "" },
    ];
    const csv = renderCsv(tasks, today);
    expect(csv).toContain('"Task, with comma"');
  });
});

describe("project-task-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, projectName: "P", taskCount: 5, completionPct: 40 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].projectName).toBe("P");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, projectName: `P${i}`, taskCount: 1, completionPct: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].projectName).toBe("P24");
  });
  it("clears", () => {
    saveHistory({ ts: 1, projectName: "P", taskCount: 1, completionPct: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("project-task-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      projectName: "Proj",
      tasksText: "A,high,todo,,",
      filterBy: "by-priority",
      filterValue: "high",
      sortBy: "due-date",
    });
    expect(url).toContain("proj=Proj");
    expect(url).toContain("filter=by-priority");
    expect(url).toContain("sort=due-date");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("proj=Proj&tasks=A%2Chigh%2Ctodo&filter=by-status&fv=todo&sort=due-date");
    expect(p.projectName).toBe("Proj");
    expect(p.tasksText).toBe("A,high,todo");
    expect(p.filterBy).toBe("by-status");
    expect(p.filterValue).toBe("todo");
    expect(p.sortBy).toBe("due-date");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.projectName).toBe("");
    expect(p.filterBy).toBe("all");
    expect(p.sortBy).toBe("priority");
  });
  it("filters unknown filter and sort values", () => {
    const p = parseShareUrl("filter=unknown&sort=weird");
    expect(p.filterBy).toBe("all");
    expect(p.sortBy).toBe("priority");
  });
  it("omits filter param when filterBy is all", () => {
    const url = buildShareUrl({
      projectName: "P", tasksText: "", filterBy: "all", filterValue: "", sortBy: "priority",
    });
    expect(url).not.toContain("filter=");
  });
});

// Suppress unused-import lint
export type _Unused = Status | Priority | FilterBy | SortBy | Task;
