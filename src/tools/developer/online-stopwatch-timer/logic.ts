/**
 * Online Stopwatch & Timer — pure logic.
 *
 * Drift-free stopwatch, countdown timer and Tabata interval timer. All
 * timing is anchored to wall-clock timestamps (Date.now()) so elapsed time
 * stays correct even when the tab is throttled or backgrounded. Multiple
 * named timers can run simultaneously. Lap times, analytics, Pomodoro &
 * Tabata presets, Web Audio beep alarm, keyboard shortcuts, shareable URL
 * and localStorage history (max 20).
 *
 * Pure functions only — no JSX, no DOM events. `playBeep` is the single
 * side-effecting helper (guarded so it no-ops outside the browser) and
 * `localStorage` access is guarded the same way.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TimerKind = "stopwatch" | "countdown" | "tabata";
export type TimerStatus = "idle" | "running" | "paused" | "done";
export type TabataPhase = "work" | "rest" | "done";

export interface Lap {
  index: number;
  lapTimeMs: number; // split: duration since previous lap (or start)
  totalTimeMs: number; // cumulative elapsed at the moment of the lap
  ts: number;
}

export interface TabataConfig {
  workMs: number;
  restMs: number;
  rounds: number;
}

export interface TimerState {
  id: string;
  name: string;
  kind: TimerKind;
  status: TimerStatus;
  /** Wall-clock ms timestamp at which the current running segment started. */
  anchorMs: number;
  /** Elapsed ms accumulated across previous run/pause cycles. */
  accumulatedMs: number;
  /** Countdown total duration in ms (0 for stopwatch). */
  durationMs: number;
  /** Tabata configuration (only when kind === "tabata"). */
  tabata: TabataConfig | null;
  /** Current Tabata round (1-based; 0 before start). */
  currentRound: number;
  /** Current Tabata phase. */
  currentPhase: TabataPhase;
  /** Recorded laps (stopwatch only). */
  laps: Lap[];
  /** Cumulative time at the previous lap (for split computation). */
  lastLapTotalMs: number;
  /** Color token used by the UI card. */
  color: string;
  /** Whether the beep alarm has already fired for the most recent completion. */
  alarmFired: boolean;
}

export interface TimerSnapshot {
  elapsedMs: number;
  remainingMs: number; // for countdown/tabata; -1 for stopwatch
  progress: number; // 0..1 for countdown/tabata; 0 for stopwatch
  phase: TabataPhase | null;
  round: number;
  totalRounds: number;
  remainingInPhaseMs: number; // for tabata; -1 otherwise
  alarmDue: boolean;
  done: boolean;
}

export interface LapStats {
  count: number;
  fastestMs: number;
  slowestMs: number;
  averageMs: number;
  totalMs: number;
}

export interface BeepConfig {
  frequency: number;
  durationMs: number;
  repeats: number;
  intervalMs: number;
  volume: number;
}

export interface HistoryEntry {
  ts: number;
  kind: TimerKind;
  name: string;
  durationMs: number;
  elapsedMs: number;
  lapCount: number;
}

export interface TimerInit {
  kind: TimerKind;
  name?: string;
  durationMs?: number;
  tabata?: TabataConfig;
  color?: string;
}

// ---------------------------------------------------------------------------
// Constants & presets
// ---------------------------------------------------------------------------

export const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export const ALARM_BEEP: BeepConfig = {
  frequency: 880,
  durationMs: 220,
  repeats: 3,
  intervalMs: 140,
  volume: 0.35,
};

export interface NamedPreset {
  id: string;
  label: string;
  kind: TimerKind;
  durationMs?: number;
  tabata?: TabataConfig;
}

export const POMODORO_PRESETS: NamedPreset[] = [
  { id: "pomo-25-5", label: "Pomodoro 25/5", kind: "countdown", durationMs: 25 * 60_000 },
  { id: "pomo-50-10", label: "Deep Work 50/10", kind: "countdown", durationMs: 50 * 60_000 },
  { id: "pomo-90-20", label: "Ultradian 90/20", kind: "countdown", durationMs: 90 * 60_000 },
  { id: "pomo-15-3", label: "Sprint 15/3", kind: "countdown", durationMs: 15 * 60_000 },
];

export const TABATA_PRESETS: NamedPreset[] = [
  { id: "tabata-classic", label: "Tabata 20/10 ×8", kind: "tabata", tabata: { workMs: 20_000, restMs: 10_000, rounds: 8 } },
  { id: "tabata-30-15", label: "HIIT 30/15 ×8", kind: "tabata", tabata: { workMs: 30_000, restMs: 15_000, rounds: 8 } },
  { id: "tabata-40-20", label: "EMOM-ish 40/20 ×6", kind: "tabata", tabata: { workMs: 40_000, restMs: 20_000, rounds: 6 } },
  { id: "tabata-60-30", label: "Long 60/30 ×5", kind: "tabata", tabata: { workMs: 60_000, restMs: 30_000, rounds: 5 } },
];

export const COUNTDOWN_PRESETS: NamedPreset[] = [
  { id: "cd-1m", label: "1 minute", kind: "countdown", durationMs: 60_000 },
  { id: "cd-3m", label: "3 minutes", kind: "countdown", durationMs: 3 * 60_000 },
  { id: "cd-5m", label: "5 minutes", kind: "countdown", durationMs: 5 * 60_000 },
  { id: "cd-10m", label: "10 minutes", kind: "countdown", durationMs: 10 * 60_000 },
];

export const ALL_PRESETS: NamedPreset[] = [
  ...POMODORO_PRESETS,
  ...TABATA_PRESETS,
  ...COUNTDOWN_PRESETS,
];

export interface KeyboardShortcut {
  key: string;
  label: string;
  description: string;
}

export const KBD_SHORTCUTS: KeyboardShortcut[] = [
  { key: "Space", label: "Space", description: "Start / pause the focused timer" },
  { key: "L", label: "L", description: "Record a lap on the focused stopwatch" },
  { key: "R", label: "R", description: "Reset the focused timer" },
  { key: "N", label: "N", description: "Add a new timer" },
  { key: "B", label: "B", description: "Test the beep alarm" },
  { key: "Escape", label: "Esc", description: "Dismiss the alarm banner" },
];

// ---------------------------------------------------------------------------
// ID & color helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

/** Generate a unique timer id (purely local, no crypto). */
export function makeTimerId(): string {
  _idCounter += 1;
  return `t-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

/** Pick the next color in the rotation (wraps negative indices too). */
export function pickColor(index: number): string {
  if (COLORS.length === 0) return "#3b82f6";
  const n = COLORS.length;
  return COLORS[((index % n) + n) % n];
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function createStopwatch(name: string, color?: string): TimerState {
  return {
    id: makeTimerId(),
    name: name || "Stopwatch",
    kind: "stopwatch",
    status: "idle",
    anchorMs: 0,
    accumulatedMs: 0,
    durationMs: 0,
    tabata: null,
    currentRound: 0,
    currentPhase: "done",
    laps: [],
    lastLapTotalMs: 0,
    color: color ?? pickColor(0),
    alarmFired: false,
  };
}

export function createCountdown(name: string, durationMs: number, color?: string): TimerState {
  return {
    id: makeTimerId(),
    name: name || "Countdown",
    kind: "countdown",
    status: "idle",
    anchorMs: 0,
    accumulatedMs: 0,
    durationMs: Math.max(0, Math.floor(durationMs)),
    tabata: null,
    currentRound: 0,
    currentPhase: "done",
    laps: [],
    lastLapTotalMs: 0,
    color: color ?? pickColor(1),
    alarmFired: false,
  };
}

export function createTabata(name: string, config: TabataConfig, color?: string): TimerState {
  const safe: TabataConfig = {
    workMs: Math.max(0, Math.floor(config.workMs)),
    restMs: Math.max(0, Math.floor(config.restMs)),
    rounds: Math.max(1, Math.floor(config.rounds)),
  };
  return {
    id: makeTimerId(),
    name: name || "Tabata",
    kind: "tabata",
    status: "idle",
    anchorMs: 0,
    accumulatedMs: 0,
    durationMs: (safe.workMs + safe.restMs) * safe.rounds,
    tabata: safe,
    currentRound: 0,
    currentPhase: "done",
    laps: [],
    lastLapTotalMs: 0,
    color: color ?? pickColor(2),
    alarmFired: false,
  };
}

export function createTimer(init: TimerInit, color?: string): TimerState {
  switch (init.kind) {
    case "stopwatch":
      return createStopwatch(init.name ?? "Stopwatch", init.color ?? color);
    case "countdown":
      return createCountdown(init.name ?? "Countdown", init.durationMs ?? 0, init.color ?? color);
    case "tabata":
      return init.tabata
        ? createTabata(init.name ?? "Tabata", init.tabata, init.color ?? color)
        : createCountdown(init.name ?? "Countdown", init.durationMs ?? 0, init.color ?? color);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: start / pause / reset / lap
// ---------------------------------------------------------------------------

export function startTimer(state: TimerState, nowMs: number): TimerState {
  if (state.status === "running") return state;
  if (state.status === "done") return state;
  return { ...state, status: "running", anchorMs: nowMs, alarmFired: false };
}

export function pauseTimer(state: TimerState, nowMs: number): TimerState {
  if (state.status !== "running") return state;
  const delta = Math.max(0, nowMs - state.anchorMs);
  return {
    ...state,
    status: "paused",
    accumulatedMs: state.accumulatedMs + delta,
    anchorMs: 0,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    status: "idle",
    anchorMs: 0,
    accumulatedMs: 0,
    currentRound: 0,
    currentPhase: state.kind === "tabata" ? "done" : state.currentPhase,
    laps: [],
    lastLapTotalMs: 0,
    alarmFired: false,
  };
}

export function addLap(state: TimerState, nowMs: number): TimerState {
  if (state.kind !== "stopwatch") return state;
  if (state.status !== "running") return state;
  const total = getElapsedMs(state, nowMs);
  const lapTime = total - state.lastLapTotalMs;
  const lap: Lap = {
    index: state.laps.length + 1,
    lapTimeMs: lapTime,
    totalTimeMs: total,
    ts: nowMs,
  };
  return {
    ...state,
    laps: [...state.laps, lap],
    lastLapTotalMs: total,
  };
}

/** Toggle between running and paused. */
export function toggleTimer(state: TimerState, nowMs: number): TimerState {
  if (state.status === "running") return pauseTimer(state, nowMs);
  if (state.status === "idle" || state.status === "paused") return startTimer(state, nowMs);
  return state;
}

// ---------------------------------------------------------------------------
// Time computation
// ---------------------------------------------------------------------------

/** Total elapsed time of the timer at instant `nowMs`. */
export function getElapsedMs(state: TimerState, nowMs: number): number {
  if (state.status === "running") {
    return state.accumulatedMs + Math.max(0, nowMs - state.anchorMs);
  }
  return state.accumulatedMs;
}

/** Remaining time for countdown/tabata; -1 for stopwatch. */
export function getRemainingMs(state: TimerState, nowMs: number): number {
  if (state.kind === "stopwatch") return -1;
  const elapsed = getElapsedMs(state, nowMs);
  return Math.max(0, state.durationMs - elapsed);
}

/** Compute the Tabata phase + round + remaining in phase at the given instant. */
export function computeTabataProgress(
  state: TimerState,
  nowMs: number,
): { phase: TabataPhase; round: number; remainingInPhaseMs: number; elapsedInPhaseMs: number } {
  if (state.kind !== "tabata" || !state.tabata) {
    return { phase: "done", round: 0, remainingInPhaseMs: -1, elapsedInPhaseMs: 0 };
  }
  const { workMs, restMs, rounds } = state.tabata;
  const total = getElapsedMs(state, nowMs);
  const cycle = workMs + restMs;
  if (cycle <= 0) return { phase: "done", round: 0, remainingInPhaseMs: 0, elapsedInPhaseMs: 0 };
  const completedCycles = Math.floor(total / cycle);
  if (completedCycles >= rounds) {
    return { phase: "done", round: rounds, remainingInPhaseMs: 0, elapsedInPhaseMs: 0 };
  }
  const intoCycle = total - completedCycles * cycle;
  const round = completedCycles + 1;
  if (intoCycle < workMs) {
    return { phase: "work", round, remainingInPhaseMs: workMs - intoCycle, elapsedInPhaseMs: intoCycle };
  }
  const intoRest = intoCycle - workMs;
  return { phase: "rest", round, remainingInPhaseMs: restMs - intoRest, elapsedInPhaseMs: intoRest };
}

/** Full snapshot at the given instant. */
export function getSnapshot(state: TimerState, nowMs: number): TimerSnapshot {
  const elapsed = getElapsedMs(state, nowMs);
  if (state.kind === "stopwatch") {
    return {
      elapsedMs: elapsed,
      remainingMs: -1,
      progress: 0,
      phase: null,
      round: 0,
      totalRounds: 0,
      remainingInPhaseMs: -1,
      alarmDue: false,
      done: false,
    };
  }
  const remaining = Math.max(0, state.durationMs - elapsed);
  const progress = state.durationMs > 0 ? Math.min(1, elapsed / state.durationMs) : 1;
  const done = elapsed >= state.durationMs && state.durationMs > 0;
  let phase: TabataPhase | null = null;
  let round = 0;
  let totalRounds = 0;
  let remainingInPhaseMs = -1;
  if (state.kind === "tabata" && state.tabata) {
    const p = computeTabataProgress(state, nowMs);
    phase = p.phase;
    round = p.round;
    totalRounds = state.tabata.rounds;
    remainingInPhaseMs = p.remainingInPhaseMs;
  }
  return {
    elapsedMs: elapsed,
    remainingMs: remaining,
    progress,
    phase,
    round,
    totalRounds,
    remainingInPhaseMs,
    alarmDue: done && !state.alarmFired,
    done,
  };
}

/**
 * Advance the state to "done" if the timer has expired. Returns the same
 * state object if not due. Clears alarmFired flag caller-side via
 * `markAlarmFired`.
 */
export function advanceIfDone(state: TimerState, nowMs: number): TimerState {
  if (state.kind === "stopwatch") return state;
  if (state.status !== "running") return state;
  const elapsed = getElapsedMs(state, nowMs);
  if (elapsed >= state.durationMs && state.durationMs > 0) {
    const acc = state.durationMs;
    if (state.kind === "tabata") {
      const rounds = state.tabata?.rounds ?? 0;
      return {
        ...state,
        status: "done",
        accumulatedMs: acc,
        anchorMs: 0,
        currentRound: rounds,
        currentPhase: "done",
      };
    }
    return {
      ...state,
      status: "done",
      accumulatedMs: acc,
      anchorMs: 0,
    };
  }
  return state;
}

export function markAlarmFired(state: TimerState): TimerState {
  if (state.alarmFired) return state;
  return { ...state, alarmFired: true };
}

/** Compute the absolute wall-clock ms at which the alarm should fire, or null. */
export function computeAlarmAt(state: TimerState): number | null {
  if (state.kind === "stopwatch") return null;
  if (state.status !== "running") return null;
  if (state.durationMs <= 0) return null;
  return state.anchorMs + (state.durationMs - state.accumulatedMs);
}

// ---------------------------------------------------------------------------
// Lap analytics & rendering
// ---------------------------------------------------------------------------

export function computeLapStats(laps: Lap[]): LapStats {
  if (laps.length === 0) {
    return { count: 0, fastestMs: 0, slowestMs: 0, averageMs: 0, totalMs: 0 };
  }
  const splits = laps.map((l) => l.lapTimeMs);
  const total = splits.reduce((a, b) => a + b, 0);
  const fastest = Math.min(...splits);
  const slowest = Math.max(...splits);
  return {
    count: laps.length,
    fastestMs: fastest,
    slowestMs: slowest,
    averageMs: total / laps.length,
    totalMs: total,
  };
}

export function renderLapsText(laps: Lap[]): string {
  if (laps.length === 0) return "";
  const lines = laps.map((l) => {
    return `Lap ${l.index}\t${formatStopwatch(l.lapTimeMs)}\t${formatStopwatch(l.totalTimeMs)}`;
  });
  lines.unshift("Lap\tSplit\tTotal");
  return lines.join("\n");
}

export function renderLapsCsv(laps: Lap[]): string {
  const lines = ["index,split_ms,total_ms,split_label,total_label,timestamp"];
  for (const l of laps) {
    lines.push(
      [
        l.index,
        l.lapTimeMs,
        l.totalTimeMs,
        csvEscape(formatStopwatch(l.lapTimeMs)),
        csvEscape(formatStopwatch(l.totalTimeMs)),
        l.ts,
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Formatting & parsing
// ---------------------------------------------------------------------------

/** Format a duration in ms as `HH:MM:SS.cs` (centiseconds for stopwatch). */
export function formatStopwatch(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalCs = Math.floor(safe / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(safe / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hr = Math.floor(totalMin / 60);
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  if (hr > 0) return `${pad(hr)}:${pad(min)}:${pad(sec)}.${pad(cs)}`;
  return `${pad(min)}:${pad(sec)}.${pad(cs)}`;
}

/** Format a duration in ms as `HH:MM:SS` (no centiseconds) for countdowns. */
export function formatCountdown(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safe / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hr = Math.floor(totalMin / 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hr > 0) return `${pad(hr)}:${pad(min)}:${pad(sec)}`;
  return `${pad(min)}:${pad(sec)}`;
}

/** Generic formatter; switches centiseconds on for stopwatches. */
export function formatTime(ms: number, opts: { withCentiseconds?: boolean } = {}): string {
  return opts.withCentiseconds ? formatStopwatch(ms) : formatCountdown(ms);
}

export interface ParseResult {
  ok: boolean;
  ms: number;
  error?: string;
}

const DURATION_REGEX = /^(?:(\d+)y)?(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?$/i;

/** Parse a human duration string like "25m", "1h30m", "90s", "500ms", "1d2h" into ms. */
export function parseDuration(input: string): ParseResult {
  const s = (input || "").trim().toLowerCase();
  if (!s) return { ok: false, ms: 0, error: "empty" };
  // bare number → seconds
  if (/^\d+$/.test(s)) return { ok: true, ms: parseInt(s, 10) * 1000 };
  // decimal seconds like "1.5"
  if (/^\d+\.\d+$/.test(s)) return { ok: true, ms: Math.round(parseFloat(s) * 1000) };
  const m = DURATION_REGEX.exec(s);
  if (!m) return { ok: false, ms: 0, error: "unrecognized format" };
  const y = m[1] ? parseInt(m[1], 10) : 0;
  const w = m[2] ? parseInt(m[2], 10) : 0;
  const d = m[3] ? parseInt(m[3], 10) : 0;
  const h = m[4] ? parseInt(m[4], 10) : 0;
  const mn = m[5] ? parseInt(m[5], 10) : 0;
  const sec = m[6] ? parseInt(m[6], 10) : 0;
  const ms = m[7] ? parseInt(m[7], 10) : 0;
  if (y === 0 && w === 0 && d === 0 && h === 0 && mn === 0 && sec === 0 && ms === 0) {
    return { ok: false, ms: 0, error: "no units matched" };
  }
  const total =
    y * 365 * 86_400_000 +
    w * 7 * 86_400_000 +
    d * 86_400_000 +
    h * 3_600_000 +
    mn * 60_000 +
    sec * 1000 +
    ms;
  return { ok: true, ms: total };
}

/** Inverse of parseDuration: pick the largest sensible unit. */
export function serializeDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const msPart = ms % 1000;
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ""}`;
  if (m > 0) return `${m}m${sec > 0 ? `${sec}s` : ""}`;
  if (sec > 0) return `${sec}s`;
  return `${msPart}ms`;
}

// ---------------------------------------------------------------------------
// Web Audio beep alarm (guarded side effect)
// ---------------------------------------------------------------------------

/**
 * Play a beep using the Web Audio API. Returns true if a beep was actually
 * played, false otherwise (e.g. no AudioContext available). Pure-safe: this
 * is the only side-effecting function in this module and it no-ops cleanly
 * in non-browser environments.
 */
export function playBeep(config: BeepConfig = ALARM_BEEP): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return false;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return false;
  }
  const now = ctx.currentTime;
  for (let i = 0; i < config.repeats; i++) {
    const start = now + (i * (config.durationMs + config.intervalMs)) / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = config.frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(config.volume, start + 0.005);
    gain.gain.linearRampToValueAtTime(config.volume, start + config.durationMs / 1000 - 0.01);
    gain.gain.linearRampToValueAtTime(0, start + config.durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + config.durationMs / 1000 + 0.01);
  }
  // Close the context after the beeps finish to free resources.
  const totalMs = config.repeats * (config.durationMs + config.intervalMs) + 200;
  setTimeout(() => {
    try { void ctx.close(); } catch { /* ignore */ }
  }, totalMs);
  return true;
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:online-stopwatch-timer:history";
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

/**
 * Build a `?d=25m` style shareable URL for a timer configuration. The hash
 * fragment encodes kind/duration/tabata so it is never sent to the server.
 */
export function buildShareUrl(init: TimerInit): string {
  const params = new URLSearchParams();
  params.set("k", init.kind);
  if (init.name) params.set("n", init.name);
  if (init.kind === "countdown" && init.durationMs !== undefined) {
    params.set("d", serializeDuration(init.durationMs));
  }
  if (init.kind === "tabata" && init.tabata) {
    params.set("w", String(init.tabata.workMs));
    params.set("r", String(init.tabata.restMs));
    params.set("c", String(init.tabata.rounds));
  }
  if (init.color) params.set("c0", init.color);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): TimerInit | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const k = (params.get("k") ?? "").toLowerCase();
  if (k !== "stopwatch" && k !== "countdown" && k !== "tabata") return null;
  const init: TimerInit = { kind: k };
  const n = params.get("n");
  if (n) init.name = n;
  const color = params.get("c0");
  if (color) init.color = color;
  if (k === "countdown") {
    const d = params.get("d");
    if (d) {
      const parsed = parseDuration(d);
      if (parsed.ok) init.durationMs = parsed.ms;
    }
  }
  if (k === "tabata") {
    const w = parseInt(params.get("w") ?? "0", 10);
    const r = parseInt(params.get("r") ?? "0", 10);
    const c = parseInt(params.get("c") ?? "0", 10);
    if (w > 0 || r > 0) {
      init.tabata = {
        workMs: w > 0 ? w : 20_000,
        restMs: r > 0 ? r : 10_000,
        rounds: c > 0 ? c : 8,
      };
    }
  }
  return init;
}
