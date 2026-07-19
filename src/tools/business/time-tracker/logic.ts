/**
 * Time Tracker — pure logic.
 *
 * Track time entries for tasks and projects. Pure functions only —
 * no DOM, no network. The UI component owns the running timer state;
 * these functions handle formatting, parsing, validation, grouping,
 * summarizing, rendering, history, and shareable URLs.
 */

// ---- Types ----

export type RoundingPreset = "none" | "6min" | "15min" | "30min";

export interface TimeEntry {
  id: string;
  taskName: string;
  projectName: string;
  billable: boolean;
  hourlyRate: number;
  notes: string;
  startMs: number;
  endMs: number;
  durationMs: number; // = endMs - startMs (excludes paused time)
  date: string; // YYYY-MM-DD (from startMs)
  rounding: RoundingPreset;
}

export interface TimerState {
  status: "idle" | "running" | "paused";
  startMs: number; // session start (when first Start clicked)
  accumulatedMs: number; // time accumulated before pause
  lastResumeMs: number; // when the timer last resumed (0 if paused/idle)
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProjectSummary {
  project: string;
  entryCount: number;
  totalMs: number;
  totalHours: number;
  billableMs: number;
  cost: number;
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  entries: TimeEntry[];
  totalMs: number;
  totalHours: number;
  cost: number;
}

export interface WeekGroup {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekKey: string; // e.g. "2024-W23"
  entries: TimeEntry[];
  totalMs: number;
  totalHours: number;
  cost: number;
}

export interface BillableSummary {
  billableEntries: number;
  billableMs: number;
  billableHours: number;
  totalCost: number;
  avgRate: number;
}

export interface TotalStats {
  entryCount: number;
  totalMs: number;
  totalHours: number;
  billableEntries: number;
  billableHours: number;
  totalCost: number;
  uniqueProjects: number;
}

// ---- Constants / presets ----

export const ROUNDING_PRESETS: RoundingPreset[] = ["none", "6min", "15min", "30min"];

export const ROUNDING_LABELS: Record<RoundingPreset, string> = {
  "none": "No rounding",
  "6min": "6 min (1/10 hr)",
  "15min": "15 min (1/4 hr)",
  "30min": "30 min (1/2 hr)",
};

export const ROUNDING_MS: Record<RoundingPreset, number> = {
  "none": 0,
  "6min": 6 * 60 * 1000,
  "15min": 15 * 60 * 1000,
  "30min": 30 * 60 * 1000,
};

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// ---- Time formatting / parsing ----

/** Format ms → HH:MM:SS (zero-padded). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / MS_PER_SECOND);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parse HH:MM:SS → ms. Returns 0 for invalid input. */
export function parseDuration(s: string): number {
  if (!s) return 0;
  const m = s.trim().match(/^(\d+):([0-5]?\d):([0-5]?\d)$/);
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  return (h * 3600 + min * 60 + sec) * MS_PER_SECOND;
}

/** Convert ms → hours (decimal). */
export function msToHours(ms: number): number {
  return ms / MS_PER_HOUR;
}

/** Convert hours → ms. */
export function hoursToMs(h: number): number {
  return h * MS_PER_HOUR;
}

/** Compute duration between two timestamps, clamped to non-negative. */
export function computeDuration(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, endMs - startMs);
}

// ---- Time rounding ----

/** Round ms up to the nearest rounding interval (None = no change). */
export function roundMsUp(ms: number, preset: RoundingPreset): number {
  const unit = ROUNDING_MS[preset];
  if (unit <= 0) return ms;
  return Math.ceil(ms / unit) * unit;
}

/** Round ms to nearest interval (banker's not used; round half up). */
export function roundMsNearest(ms: number, preset: RoundingPreset): number {
  const unit = ROUNDING_MS[preset];
  if (unit <= 0) return ms;
  return Math.round(ms / unit) * unit;
}

// ---- Billable amount ----

/** Compute billable cost = (rounded ms in hours) × rate. */
export function computeBillableAmount(
  durationMs: number,
  rate: number,
  billable: boolean,
  rounding: RoundingPreset = "none",
): number {
  if (!billable) return 0;
  const r = clampNonNegative(rate);
  const roundedMs = roundMsUp(durationMs, rounding);
  return msToHours(roundedMs) * r;
}

// ---- Validation ----

export function validateEntry(
  taskName: string,
  durationMs: number,
): ValidationResult {
  const errors: string[] = [];
  if (!taskName || !taskName.trim()) errors.push("Task name is required");
  if (!Number.isFinite(durationMs) || durationMs <= 0) errors.push("Duration must be greater than 0");
  return { valid: errors.length === 0, errors };
}

// ---- Helpers ----

export function normalizeTaskName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function normalizeProjectName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO week number (1-53) and year (per ISO 8601). */
export function getIsoWeek(d: Date): { year: number; week: number; weekStart: string } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7; // Mon = 1, Sun = 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  // weekStart = Monday of that week
  const monday = new Date(tmp);
  monday.setUTCDate(monday.getUTCDate() - 3);
  return {
    year: tmp.getUTCFullYear(),
    week: weekNum,
    weekStart: formatDate(monday.getTime()),
  };
}

export function weekKey(d: Date): string {
  const { year, week } = getIsoWeek(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function generateId(): string {
  return `tt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Build entry ----

export interface EntryDraft {
  taskName: string;
  projectName: string;
  billable: boolean;
  hourlyRate: number;
  notes: string;
  startMs: number;
  endMs: number;
  rounding: RoundingPreset;
}

export function buildEntry(draft: EntryDraft): TimeEntry {
  const durationMs = computeDuration(draft.startMs, draft.endMs);
  return {
    id: generateId(),
    taskName: normalizeTaskName(draft.taskName) || "(untitled)",
    projectName: normalizeProjectName(draft.projectName),
    billable: draft.billable,
    hourlyRate: clampNonNegative(draft.hourlyRate),
    notes: draft.notes ?? "",
    startMs: draft.startMs,
    endMs: draft.endMs,
    durationMs,
    date: formatDate(draft.startMs),
    rounding: draft.rounding,
  };
}

// ---- Grouping / summaries ----

export function groupByDay(entries: TimeEntry[]): DayGroup[] {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  const out: DayGroup[] = [];
  for (const [date, list] of map) {
    const totalMs = list.reduce((acc, e) => acc + e.durationMs, 0);
    const cost = list.reduce((acc, e) => acc + computeBillableAmount(e.durationMs, e.hourlyRate, e.billable, e.rounding), 0);
    out.push({
      date,
      entries: list,
      totalMs,
      totalHours: msToHours(totalMs),
      cost,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function groupByWeek(entries: TimeEntry[]): WeekGroup[] {
  const map = new Map<string, TimeEntry[]>();
  const meta = new Map<string, { weekStart: string }>();
  for (const e of entries) {
    const d = new Date(e.startMs);
    const k = weekKey(d);
    const arr = map.get(k) ?? [];
    arr.push(e);
    map.set(k, arr);
    if (!meta.has(k)) {
      meta.set(k, { weekStart: getIsoWeek(d).weekStart });
    }
  }
  const out: WeekGroup[] = [];
  for (const [k, list] of map) {
    const totalMs = list.reduce((acc, e) => acc + e.durationMs, 0);
    const cost = list.reduce((acc, e) => acc + computeBillableAmount(e.durationMs, e.hourlyRate, e.billable, e.rounding), 0);
    out.push({
      weekStart: meta.get(k)!.weekStart,
      weekKey: k,
      entries: list,
      totalMs,
      totalHours: msToHours(totalMs),
      cost,
    });
  }
  out.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  return out;
}

export function projectSummary(entries: TimeEntry[]): ProjectSummary[] {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const key = e.projectName || "(no project)";
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  const out: ProjectSummary[] = [];
  for (const [project, list] of map) {
    const totalMs = list.reduce((acc, e) => acc + e.durationMs, 0);
    const billableMs = list.filter((e) => e.billable).reduce((acc, e) => acc + e.durationMs, 0);
    const cost = list.reduce((acc, e) => acc + computeBillableAmount(e.durationMs, e.hourlyRate, e.billable, e.rounding), 0);
    out.push({
      project,
      entryCount: list.length,
      totalMs,
      totalHours: msToHours(totalMs),
      billableMs,
      cost,
    });
  }
  out.sort((a, b) => b.totalMs - a.totalMs);
  return out;
}

export function billableSummary(entries: TimeEntry[]): BillableSummary {
  const billableEntries = entries.filter((e) => e.billable);
  const billableMs = billableEntries.reduce((acc, e) => acc + e.durationMs, 0);
  const totalCost = billableEntries.reduce(
    (acc, e) => acc + computeBillableAmount(e.durationMs, e.hourlyRate, e.billable, e.rounding),
    0,
  );
  const rates = billableEntries.map((e) => e.hourlyRate).filter((r) => r > 0);
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  return {
    billableEntries: billableEntries.length,
    billableMs,
    billableHours: msToHours(billableMs),
    totalCost,
    avgRate,
  };
}

export function summaryStats(entries: TimeEntry[]): TotalStats {
  const bill = billableSummary(entries);
  const totalMs = entries.reduce((acc, e) => acc + e.durationMs, 0);
  const projects = new Set(entries.map((e) => e.projectName || "(no project)"));
  return {
    entryCount: entries.length,
    totalMs,
    totalHours: msToHours(totalMs),
    billableEntries: bill.billableEntries,
    billableHours: bill.billableHours,
    totalCost: bill.totalCost,
    uniqueProjects: projects.size,
  };
}

/** Suggest project tags from previous entries (top N, alphabetically sorted). */
export function suggestProjects(entries: TimeEntry[], limit: number = 10): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const p = e.projectName.trim();
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.keys())
    .sort((a, b) => counts.get(b)! - counts.get(a)!)
    .slice(0, limit)
    .sort((a, b) => a.localeCompare(b));
}

// ---- Rendering ----

export function formatCost(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function renderText(entries: TimeEntry[]): string {
  if (entries.length === 0) return "No time entries yet.";
  const lines: string[] = [];
  const stats = summaryStats(entries);
  lines.push("=".repeat(60));
  lines.push("                   TIME TRACKER REPORT");
  lines.push("=".repeat(60));
  lines.push(`Total entries:    ${stats.entryCount}`);
  lines.push(`Total time:       ${formatDuration(stats.totalMs)} (${stats.totalHours.toFixed(2)} hrs)`);
  lines.push(`Billable entries: ${stats.billableEntries}`);
  lines.push(`Billable hours:   ${stats.billableHours.toFixed(2)}`);
  lines.push(`Total cost:       ${formatCost(stats.totalCost)}`);
  lines.push(`Unique projects:  ${stats.uniqueProjects}`);
  lines.push("");

  const days = groupByDay(entries);
  lines.push("-".repeat(60));
  lines.push("BY DAY");
  lines.push("-".repeat(60));
  for (const d of days) {
    lines.push(`${d.date}  ${formatDuration(d.totalMs)}  ${d.totalHours.toFixed(2)} hrs  ${formatCost(d.cost)}`);
    for (const e of d.entries) {
      const tag = e.billable ? `[$${e.hourlyRate}/hr]` : "[non-bill]";
      lines.push(`    ${formatDuration(e.durationMs).padStart(8)}  ${tag.padEnd(10)}  ${e.taskName}${e.projectName ? `  (${e.projectName})` : ""}`);
    }
  }

  const weeks = groupByWeek(entries);
  if (weeks.length > 1) {
    lines.push("");
    lines.push("-".repeat(60));
    lines.push("BY WEEK");
    lines.push("-".repeat(60));
    for (const w of weeks) {
      lines.push(`${w.weekKey}  (wk of ${w.weekStart})  ${formatDuration(w.totalMs)}  ${w.totalHours.toFixed(2)} hrs  ${formatCost(w.cost)}`);
    }
  }

  const projects = projectSummary(entries);
  if (projects.length > 0) {
    lines.push("");
    lines.push("-".repeat(60));
    lines.push("BY PROJECT");
    lines.push("-".repeat(60));
    for (const p of projects) {
      lines.push(`${p.project.padEnd(28)} ${p.entryCount} entries  ${p.totalHours.toFixed(2)} hrs  ${formatCost(p.cost)}`);
    }
  }

  lines.push("");
  lines.push("=".repeat(60));
  lines.push("Generated by UnQTools Time Tracker — 100% client-side.");
  lines.push("=".repeat(60));
  return lines.join("\n");
}

export function renderCsv(entries: TimeEntry[]): string {
  const lines: string[] = [
    "date,task,project,duration_hours,duration_hms,billable,rate,cost,notes",
  ];
  for (const e of entries) {
    const hours = msToHours(e.durationMs).toFixed(4);
    const hms = formatDuration(e.durationMs);
    const cost = computeBillableAmount(e.durationMs, e.hourlyRate, e.billable, e.rounding).toFixed(2);
    lines.push([
      e.date,
      csv(e.taskName),
      csv(e.projectName),
      hours,
      hms,
      e.billable ? "yes" : "no",
      e.billable ? e.hourlyRate.toFixed(2) : "0.00",
      cost,
      csv(e.notes),
    ].join(","));
  }
  return lines.join("\n");
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:time-tracker:entries";
const HISTORY_MAX = 100;

export function loadEntries(): TimeEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TimeEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

export function saveEntries(entries: TimeEntry[]): TimeEntry[] {
  const next = entries.slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function addEntry(entry: TimeEntry): TimeEntry[] {
  const next = [entry, ...loadEntries()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeEntry(id: string): TimeEntry[] {
  const next = loadEntries().filter((e) => e.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearEntries(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(entries: TimeEntry[]): string {
  const params = new URLSearchParams();
  if (entries.length > 0) {
    params.set("entries", JSON.stringify(entries));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): TimeEntry[] {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return [];
  const params = new URLSearchParams(clean);
  const raw = params.get("entries");
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as TimeEntry[];
    if (!Array.isArray(arr)) return [];
    // Sanitize: keep only known fields
    return arr
      .filter((e) => e && typeof e.taskName === "string" && Number.isFinite(e.startMs) && Number.isFinite(e.endMs))
      .map((e) => ({
        id: typeof e.id === "string" ? e.id : generateId(),
        taskName: String(e.taskName ?? ""),
        projectName: String(e.projectName ?? ""),
        billable: Boolean(e.billable),
        hourlyRate: Number.isFinite(e.hourlyRate) ? e.hourlyRate : 0,
        notes: String(e.notes ?? ""),
        startMs: Number(e.startMs),
        endMs: Number(e.endMs),
        durationMs: Number.isFinite(e.durationMs) ? e.durationMs : computeDuration(Number(e.startMs), Number(e.endMs)),
        date: typeof e.date === "string" ? e.date : formatDate(Number(e.startMs)),
        rounding: (["none", "6min", "15min", "30min"].includes(e.rounding) ? e.rounding : "none") as RoundingPreset,
      }))
      .slice(0, 100);
  } catch {
    return [];
  }
}
