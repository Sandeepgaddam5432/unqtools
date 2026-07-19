/**
 * Gantt Chart Maker — pure logic.
 *
 * Parse tasks, compute offsets/durations/overlaps, render ASCII + HTML charts.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export interface GanttTask {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  progress: number;  // 0..100
  /** Computed: offset days from project start (can be negative if task starts before project). */
  offsetDays: number;
  /** Computed: duration in days inclusive. */
  durationDays: number;
}

export interface ParseResult {
  tasks: GanttTask[];
  errors: string[];
}

export type ColorPreset = "rainbow" | "blue-scale" | "priority-based";

export interface GanttOverlap {
  taskA: number;
  taskB: number;
  titleA: string;
  titleB: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface GanttInput {
  projectStartDate: string;
  projectEndDate: string;
  tasksText: string;
  showProgress: boolean;
  showToday: boolean;
  colorPreset: ColorPreset;
}

export interface GanttStats {
  totalTasks: number;
  projectDurationDays: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  overlapCount: number;
  avgProgress: number;
}

export interface HistoryEntry {
  ts: number;
  projectStartDate: string;
  projectEndDate: string;
  taskCount: number;
  projectDurationDays: number;
}

export interface RenderOptions {
  showProgress: boolean;
  showToday: boolean;
  showWeekends: boolean;
  colorPreset: ColorPreset;
  today: string;
}

// ---- Constants ----

export const COLOR_PRESETS: ColorPreset[] = ["rainbow", "blue-scale", "priority-based"];

export const COLOR_PRESET_LABELS: Record<ColorPreset, string> = {
  rainbow: "Rainbow",
  "blue-scale": "Blue scale",
  "priority-based": "Priority based",
};

/** Max width (in characters) of the ASCII chart's day-axis. */
export const ASCII_MAX_WIDTH = 60;

/** Color palette for "priority-based" preset (cycled). */
export const PRIORITY_PALETTE = [
  "#ef4444", // red (urgent)
  "#f97316", // orange (high)
  "#eab308", // yellow (medium)
  "#64748b", // slate (low)
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

// ---- Date helpers ----

/** Validate YYYY-MM-DD date string. Returns canonical form or "". */
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

/** Days between two YYYY-MM-DD dates (a - b). */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = new Date(a + "T00:00:00Z").getTime();
  const tb = new Date(b + "T00:00:00Z").getTime();
  if (isNaN(ta) || isNaN(tb)) return 0;
  return Math.round((ta - tb) / 86_400_000);
}

/** Add N days to a YYYY-MM-DD date. Returns YYYY-MM-DD. */
export function addDays(date: string, n: number): string {
  if (!date) return "";
  const dt = new Date(date + "T00:00:00Z");
  if (isNaN(dt.getTime())) return "";
  dt.setUTCDate(dt.getUTCDate() + Math.floor(n));
  return dt.toISOString().slice(0, 10);
}

/** Day of week (0=Sun..6=Sat) for a YYYY-MM-DD date. */
export function dayOfWeek(date: string): number {
  if (!date) return -1;
  const dt = new Date(date + "T00:00:00Z");
  if (isNaN(dt.getTime())) return -1;
  return dt.getUTCDay();
}

/** Is the given YYYY-MM-DD a Saturday or Sunday? */
export function isWeekend(date: string): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

// ---- Parsing ----

/** Split CSV row honoring quoted values. */
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

/** Parse `title,start_date,end_date,progress` lines. Returns parsed tasks (offset/duration NOT yet computed). */
export function parseTasks(text: string): ParseResult {
  const tasks: GanttTask[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { tasks, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 3) {
      errors.push(`Line ${idx + 1}: needs title,start_date,end_date[,progress]`);
      return;
    }
    const [title, startStr, endStr, progressStr] = parts;
    if (!title) {
      errors.push(`Line ${idx + 1}: title is required`);
      return;
    }
    const startDate = normalizeDate(startStr);
    if (!startDate) {
      errors.push(`Line ${idx + 1}: invalid start_date "${startStr}" (use YYYY-MM-DD)`);
      return;
    }
    const endDate = normalizeDate(endStr);
    if (!endDate) {
      errors.push(`Line ${idx + 1}: invalid end_date "${endStr}" (use YYYY-MM-DD)`);
      return;
    }
    if (endDate < startDate) {
      errors.push(`Line ${idx + 1}: end_date ${endStr} is before start_date ${startStr}`);
      return;
    }
    let progress = 0;
    if (progressStr) {
      progress = Number(progressStr);
      if (!Number.isFinite(progress)) progress = 0;
      progress = Math.max(0, Math.min(100, Math.round(progress)));
    }
    tasks.push({
      title,
      startDate,
      endDate,
      progress,
      offsetDays: 0,
      durationDays: 0,
    });
  });
  return { tasks, errors };
}

// ---- Calculations ----

/** Project duration in days (inclusive of start and end). */
export function calcProjectDurationDays(start: string, end: string): number {
  if (!start || !end) return 0;
  if (end < start) return 0;
  return daysBetween(end, start) + 1;
}

/** Days from project start to task start. Can be negative if task starts before project. */
export function calcTaskOffsetDays(taskStartDate: string, projectStartDate: string): number {
  if (!taskStartDate || !projectStartDate) return 0;
  return daysBetween(taskStartDate, projectStartDate);
}

/** Task duration in days (inclusive). */
export function calcTaskDurationDays(taskStartDate: string, taskEndDate: string): number {
  if (!taskStartDate || !taskEndDate) return 0;
  if (taskEndDate < taskStartDate) return 0;
  return daysBetween(taskEndDate, taskStartDate) + 1;
}

/** Compute offsets and durations for all tasks (mutates copies). */
export function computeTaskTimings(tasks: GanttTask[], projectStartDate: string): GanttTask[] {
  return tasks.map((t) => ({
    ...t,
    offsetDays: calcTaskOffsetDays(t.startDate, projectStartDate),
    durationDays: calcTaskDurationDays(t.startDate, t.endDate),
  }));
}

/** Validate that all tasks fall within the project range. Returns error strings. */
export function validateDateRanges(
  tasks: GanttTask[],
  projectStartDate: string,
  projectEndDate: string,
): string[] {
  const errors: string[] = [];
  if (!projectStartDate || !projectEndDate) {
    errors.push("Project start and end dates are required");
    return errors;
  }
  if (projectEndDate < projectStartDate) {
    errors.push("Project end date is before start date");
    return errors;
  }
  tasks.forEach((t, i) => {
    if (t.startDate < projectStartDate) {
      errors.push(`Task ${i + 1} "${t.title}" starts before project start`);
    }
    if (t.endDate > projectEndDate) {
      errors.push(`Task ${i + 1} "${t.title}" ends after project end`);
    }
  });
  return errors;
}

/** Detect overlapping task ranges. Returns a list of overlap pairs. */
export function detectOverlaps(tasks: GanttTask[]): GanttOverlap[] {
  const out: GanttOverlap[] = [];
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i]; const b = tasks[j];
      // Overlap if a.start <= b.end && b.start <= a.end
      if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
        const rangeStart = a.startDate < b.startDate ? b.startDate : a.startDate;
        const rangeEnd = a.endDate < b.endDate ? a.endDate : b.endDate;
        out.push({
          taskA: i,
          taskB: j,
          titleA: a.title,
          titleB: b.title,
          rangeStart,
          rangeEnd,
        });
      }
    }
  }
  return out;
}

// ---- Color ----

/** Get a color for a task given the preset and index. */
export function getTaskColor(preset: ColorPreset, index: number, total: number): string {
  const i = Math.max(0, index);
  if (preset === "rainbow") {
    const hue = total <= 1 ? 200 : Math.round((i / (total - 1)) * 300); // 0..300
    return `hsl(${hue}, 70%, 55%)`;
  }
  if (preset === "blue-scale") {
    const light = total <= 1 ? 50 : Math.round(35 + (i / Math.max(1, total - 1)) * 40); // 35..75
    return `hsl(210, 70%, ${light}%)`;
  }
  // priority-based: cycle through palette
  return PRIORITY_PALETTE[i % PRIORITY_PALETTE.length];
}

// ---- Renderers ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render an ASCII Gantt chart.
 * Each row = one task; the day axis is scaled to ASCII_MAX_WIDTH chars.
 */
export function renderAsciiGantt(
  tasks: GanttTask[],
  projectStart: string,
  projectEnd: string,
  opts: RenderOptions,
): string {
  if (!projectStart || !projectEnd) return "(set project start and end dates)";
  const projDuration = calcProjectDurationDays(projectStart, projectEnd);
  if (projDuration <= 0) return "(invalid project range)";
  if (tasks.length === 0) return "(no tasks)";

  const timed = computeTaskTimings(tasks, projectStart);
  const width = Math.min(ASCII_MAX_WIDTH, Math.max(projDuration, 10));
  // scale: column index = round((dayOffset / (projDuration-1)) * (width-1))
  const scale = (dayOffset: number): number => {
    if (projDuration <= 1) return 0;
    return Math.round((dayOffset / (projDuration - 1)) * (width - 1));
  };

  const L: string[] = [];
  L.push(`Project: ${projectStart} → ${projectEnd}  (${projDuration} days, ${tasks.length} tasks)`);
  L.push("");

  // Day axis (top ruler)
  const todayCol = opts.showToday && opts.today && opts.today >= projectStart && opts.today <= projectEnd
    ? scale(daysBetween(opts.today, projectStart))
    : -1;

  // Build weekend column set
  const weekendCols = new Set<number>();
  if (opts.showWeekends) {
    for (let d = 0; d < projDuration; d++) {
      if (isWeekend(addDays(projectStart, d))) weekendCols.add(scale(d));
    }
  }

  // Header ruler
  let ruler = "          |";
  for (let c = 0; c < width; c++) {
    ruler += (todayCol === c) ? "▼" : (weekendCols.has(c) ? "·" : "-");
  }
  L.push(ruler);
  L.push("          |" + "=".repeat(width));

  // Each task row
  for (const t of timed) {
    const startCol = Math.max(0, scale(t.offsetDays));
    const endCol = Math.min(width - 1, scale(t.offsetDays + t.durationDays - 1));
    const title = t.title.length > 9 ? t.title.slice(0, 8) + "…" : t.title.padEnd(9);
    let row = `${title} |`;
    for (let c = 0; c < width; c++) {
      if (c < startCol || c > endCol) {
        row += weekendCols.has(c) ? "·" : " ";
      } else {
        // Inside task bar
        const span = Math.max(1, endCol - startCol + 1);
        const progressCols = opts.showProgress ? Math.round((t.progress / 100) * span) : span;
        const relPos = c - startCol;
        if (opts.showProgress && relPos < progressCols) row += "█";
        else if (opts.showProgress) row += "░";
        else row += weekendCols.has(c) ? "▒" : "█";
      }
    }
    row += `  ${t.progress}%`;
    L.push(row);
  }

  // Today marker line
  if (todayCol >= 0) {
    let mark = "          |";
    for (let c = 0; c < width; c++) {
      mark += c === todayCol ? "T" : " ";
    }
    L.push(mark);
    L.push(`          Today: ${opts.today}`);
  }

  // Legend
  L.push("");
  L.push("Legend: █ = task / progress done   ░ = remaining   · = weekend   T = today   ▼ = today (ruler)");
  return L.join("\n");
}

/** Render a printable HTML Gantt chart with inline CSS. */
export function renderHtmlGantt(
  tasks: GanttTask[],
  projectStart: string,
  projectEnd: string,
  opts: RenderOptions,
): string {
  if (!projectStart || !projectEnd) return "<p>Set project start and end dates.</p>";
  const projDuration = calcProjectDurationDays(projectStart, projectEnd);
  if (projDuration <= 0) return "<p>Invalid project range.</p>";

  const timed = computeTaskTimings(tasks, projectStart);
  const total = timed.length;

  // Build day header (limit columns for readability — group by week if > 31 days)
  const dayHeaders: string[] = [];
  const weekendCols = new Set<number>();
  for (let d = 0; d < projDuration; d++) {
    const dateStr = addDays(projectStart, d);
    const dd = dateStr.slice(8, 10);
    dayHeaders.push(dd);
    if (opts.showWeekends && isWeekend(dateStr)) weekendCols.add(d);
  }

  const todayIdx = opts.showToday && opts.today && opts.today >= projectStart && opts.today <= projectEnd
    ? daysBetween(opts.today, projectStart)
    : -1;

  const cellW = projDuration > 60 ? 8 : projDuration > 30 ? 12 : 18;
  const colGroup = dayHeaders
    .map((_, i) => `<col style="width:${cellW}px${weekendCols.has(i) ? ";background:#f1f5f9" : ""}">`)
    .join("");

  const headerRow = `<tr><th style="min-width:140px;text-align:left">Task</th>${dayHeaders
    .map((dd, i) => `<th class="dh${weekendCols.has(i) ? " we" : ""}${i === todayIdx ? " today" : ""}">${dd}</th>`)
    .join("")}</tr>`;

  const taskRows = timed.map((t, idx) => {
    const color = getTaskColor(opts.colorPreset, idx, total);
    const offset = Math.max(0, t.offsetDays);
    const end = Math.min(projDuration - 1, t.offsetDays + t.durationDays - 1);
    const span = Math.max(1, end - offset + 1);
    const progressSpan = opts.showProgress ? Math.max(0, Math.round((t.progress / 100) * span)) : span;

    // Empty leading cells
    const lead = offset > 0 ? `<td colspan="${offset}" class="empty"></td>` : "";
    // Empty trailing cells
    const trail = end < projDuration - 1 ? `<td colspan="${projDuration - 1 - end}" class="empty"></td>` : "";

    // Bar cell with progress overlay
    let barCell: string;
    if (opts.showProgress) {
      barCell = `<td colspan="${span}" class="bar" style="background:${color};position:relative">
        <div class="progress-overlay" style="width:${Math.round((progressSpan / span) * 100)}%"></div>
        <span class="bar-label">${escapeHtml(t.title)} (${t.progress}%)</span>
      </td>`;
    } else {
      barCell = `<td colspan="${span}" class="bar" style="background:${color}">
        <span class="bar-label">${escapeHtml(t.title)}</span>
      </td>`;
    }
    return `<tr><td class="task-name">${escapeHtml(t.title)}<div class="muted">${t.startDate} → ${t.endDate} · ${t.durationDays}d</div></td>${lead}${barCell}${trail}</tr>`;
  }).join("");

  const todayMarker = todayIdx >= 0
    ? `<div class="today-marker" style="left:${140 + todayIdx * cellW + cellW / 2}px" title="Today: ${opts.today}"></div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Gantt — ${escapeHtml(projectStart)} to ${escapeHtml(projectEnd)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:24px}
  h1{font-size:20px;margin:0 0 4px}
  .muted{color:#666;font-size:11px}
  .chart-wrap{position:relative;overflow-x:auto;margin-top:16px}
  table{border-collapse:collapse;table-layout:fixed;font-size:11px}
  th,td{border:1px solid #e5e7eb;padding:4px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  th.dh{font-size:9px;text-align:center;background:#f9fafb;color:#555}
  th.dh.we{background:#e2e8f0;color:#94a3b8}
  th.dh.today{background:#fef3c7;color:#92400e;font-weight:bold}
  td.task-name{font-weight:500;min-width:140px;background:#fafafa}
  td.empty{background:transparent}
  td.bar{color:#fff;font-size:10px;position:relative;overflow:hidden}
  .progress-overlay{position:absolute;top:0;left:0;height:100%;background:rgba(0,0,0,.35)}
  .bar-label{position:relative;z-index:1;display:block;text-shadow:0 1px 1px rgba(0,0,0,.4)}
  .today-marker{position:absolute;top:24px;bottom:0;width:2px;background:#dc2626;opacity:.7;pointer-events:none}
  .legend{margin-top:12px;font-size:11px;color:#666}
</style></head><body>
<h1>Gantt Chart</h1>
<div class="muted">Project: ${escapeHtml(projectStart)} → ${escapeHtml(projectEnd)} · ${projDuration} days · ${total} task(s)</div>
<div class="chart-wrap">
  ${todayMarker}
  <table>
    <colgroup><col style="min-width:140px">${colGroup}</colgroup>
    <thead>${headerRow}</thead>
    <tbody>${taskRows}</tbody>
  </table>
</div>
<div class="legend">
  ${opts.showWeekends ? "<strong>·</strong> gray columns = weekends&nbsp;&nbsp;" : ""}
  ${opts.showToday ? "<strong style='color:#dc2626'>|</strong> = today" : ""}
  ${opts.showProgress ? "<strong>▓</strong> darker overlay = completed progress" : ""}
</div>
</body></html>`;
}

/** Render a text report of tasks (offset, duration, progress, range). */
export function renderText(
  tasks: GanttTask[],
  projectStart: string,
  projectEnd: string,
): string {
  const L: string[] = [];
  L.push("=".repeat(70));
  L.push("GANTT CHART REPORT");
  L.push("=".repeat(70));
  L.push(`Project: ${projectStart || "?"} → ${projectEnd || "?"}`);
  L.push(`Duration: ${calcProjectDurationDays(projectStart, projectEnd)} days`);
  L.push(`Tasks: ${tasks.length}`);
  L.push("-".repeat(70));
  const timed = computeTaskTimings(tasks, projectStart);
  timed.forEach((t, i) => {
    L.push(`#${i + 1} ${t.title}`);
    L.push(`    Range:     ${t.startDate} → ${t.endDate}`);
    L.push(`    Offset:    ${t.offsetDays} day(s) from project start`);
    L.push(`    Duration:  ${t.durationDays} day(s)`);
    L.push(`    Progress:  ${t.progress}%`);
  });
  const overlaps = detectOverlaps(timed);
  L.push("-".repeat(70));
  if (overlaps.length === 0) {
    L.push("Overlaps: none");
  } else {
    L.push(`Overlaps: ${overlaps.length}`);
    overlaps.forEach((o) => {
      L.push(`  • "${o.titleA}" ⨯ "${o.titleB}" (${o.rangeStart} → ${o.rangeEnd})`);
    });
  }
  L.push("=".repeat(70));
  return L.join("\n");
}

/** Render tasks as CSV (title, start, end, duration_days, progress). */
export function renderCsv(tasks: GanttTask[], projectStart: string): string {
  const timed = computeTaskTimings(tasks, projectStart);
  const lines = ["title,start_date,end_date,duration_days,offset_days,progress"];
  for (const t of timed) {
    lines.push([
      escapeCsv(t.title),
      t.startDate,
      t.endDate,
      String(t.durationDays),
      String(t.offsetDays),
      String(t.progress),
    ].join(","));
  }
  return lines.join("\n");
}

// ---- Summary stats ----

export function summaryStats(
  tasks: GanttTask[],
  projectStart: string,
  projectEnd: string,
): GanttStats {
  const timed = computeTaskTimings(tasks, projectStart);
  const completed = tasks.filter((t) => t.progress >= 100).length;
  const inProgress = tasks.filter((t) => t.progress > 0 && t.progress < 100).length;
  const notStarted = tasks.filter((t) => t.progress <= 0).length;
  const overlaps = detectOverlaps(timed);
  const avg = tasks.length === 0 ? 0
    : Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length);
  return {
    totalTasks: tasks.length,
    projectDurationDays: calcProjectDurationDays(projectStart, projectEnd),
    completedTasks: completed,
    inProgressTasks: inProgress,
    notStartedTasks: notStarted,
    overlapCount: overlaps.length,
    avgProgress: avg,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:gantt-chart-maker:history";
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

export function buildShareUrl(input: GanttInput): string {
  const params = new URLSearchParams();
  if (input.projectStartDate) params.set("start", input.projectStartDate);
  if (input.projectEndDate) params.set("end", input.projectEndDate);
  if (input.tasksText) params.set("tasks", input.tasksText);
  if (input.showProgress) params.set("progress", "1");
  if (input.showToday) params.set("today", "1");
  if (input.colorPreset) params.set("color", input.colorPreset);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<GanttInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<GanttInput> = {};
  if (params.get("start")) out.projectStartDate = params.get("start")!;
  if (params.get("end")) out.projectEndDate = params.get("end")!;
  if (params.get("tasks")) out.tasksText = params.get("tasks")!;
  out.showProgress = params.get("progress") === "1";
  out.showToday = params.get("today") === "1";
  const c = params.get("color") as ColorPreset | null;
  if (c && COLOR_PRESETS.includes(c)) out.colorPreset = c;
  return out;
}
