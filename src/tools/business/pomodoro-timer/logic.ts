/**
 * Pomodoro Timer — pure logic.
 *
 * Compute phases, durations, sequences, beep params, and reports for the
 * Pomodoro Technique. Pure functions only — no DOM, no network. The UI
 * component owns the running timer state and plays the actual beep via
 * the Web Audio API using parameters produced by these functions.
 */

// ---- Types ----

export type Phase = "work" | "short-break" | "long-break";

export type BeepFrequency = "low" | "medium" | "high";

export interface PomodoroSettings {
  workDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;  // after N work sessions, take a long break
  totalSessions: number;   // total work sessions planned
  soundEnabled: boolean;
  autoStartNext: boolean;
  beepFrequency: BeepFrequency;
}

export interface PhaseStep {
  stepIndex: number;       // 0-based position in the sequence
  phase: Phase;
  durationMin: number;
  durationSec: number;
  sessionNum: number;      // 1-based work session number this step belongs to
                          // (for break steps: the work session that just ended)
}

export interface TimeEstimate {
  workMin: number;
  breakMin: number;
  totalMin: number;
  workCount: number;
  shortBreakCount: number;
  longBreakCount: number;
}

export interface BeepParams {
  frequency: number;
  durationMs: number;
  type: OscillatorType;
  volume: number;
}

export interface PomodoroStats {
  totalWorkMin: number;
  totalBreakMin: number;
  totalMin: number;
  sessionsCompleted: number;
  avgSessionMin: number;
}

export interface HistoryEntry {
  ts: number;
  completedSessions: number;
  totalWorkMin: number;
  totalBreakMin: number;
  settings: PomodoroSettings;
}

// ---- Constants / presets ----

export const PHASE_LABELS: Record<Phase, string> = {
  "work": "Work",
  "short-break": "Short Break",
  "long-break": "Long Break",
};

export const PHASE_COLORS: Record<Phase, string> = {
  "work": "#ef4444",       // red
  "short-break": "#22c55e", // green
  "long-break": "#3b82f6",  // blue
};

export const BEEP_FREQS: Record<BeepFrequency, number> = {
  "low": 220,
  "medium": 440,
  "high": 880,
};

export const BEEP_LABELS: Record<BeepFrequency, string> = {
  "low": "Low (220 Hz)",
  "medium": "Medium (440 Hz)",
  "high": "High (880 Hz)",
};

export const BEEP_DURATIONS: Record<Phase, number> = {
  "work": 600,             // longer beep when work ends (transition to break)
  "short-break": 300,
  "long-break": 800,       // longest beep when long break ends
};

export type PresetKey = "classic" | "long" | "short" | "custom";

export const SESSION_PRESETS: Record<PresetKey, PomodoroSettings> = {
  "classic": {
    workDurationMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    totalSessions: 8,
    soundEnabled: true,
    autoStartNext: false,
    beepFrequency: "medium",
  },
  "long": {
    workDurationMin: 50,
    shortBreakMin: 10,
    longBreakMin: 30,
    longBreakEvery: 4,
    totalSessions: 4,
    soundEnabled: true,
    autoStartNext: false,
    beepFrequency: "medium",
  },
  "short": {
    workDurationMin: 15,
    shortBreakMin: 3,
    longBreakMin: 10,
    longBreakEvery: 4,
    totalSessions: 12,
    soundEnabled: true,
    autoStartNext: false,
    beepFrequency: "high",
  },
  "custom": {
    workDurationMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    totalSessions: 8,
    soundEnabled: true,
    autoStartNext: false,
    beepFrequency: "medium",
  },
};

export const PRESET_LABELS: Record<PresetKey, string> = {
  "classic": "Classic (25/5/15)",
  "long": "Long (50/10/30)",
  "short": "Short (15/3/10)",
  "custom": "Custom",
};

export const DEFAULT_SETTINGS: PomodoroSettings = { ...SESSION_PRESETS.classic };

// ---- Helpers ----

export function clampPositiveInt(n: number, fallback: number = 1): number {
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function clampPositiveNum(n: number, fallback: number = 1): number {
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function normalizeSettings(input: Partial<PomodoroSettings>): PomodoroSettings {
  return {
    workDurationMin: clampPositiveNum(input.workDurationMin ?? DEFAULT_SETTINGS.workDurationMin, 1),
    shortBreakMin: clampPositiveNum(input.shortBreakMin ?? DEFAULT_SETTINGS.shortBreakMin, 0),
    longBreakMin: clampPositiveNum(input.longBreakMin ?? DEFAULT_SETTINGS.longBreakMin, 0),
    longBreakEvery: clampPositiveInt(input.longBreakEvery ?? DEFAULT_SETTINGS.longBreakEvery, 1),
    totalSessions: clampPositiveInt(input.totalSessions ?? DEFAULT_SETTINGS.totalSessions, 1),
    soundEnabled: typeof input.soundEnabled === "boolean" ? input.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    autoStartNext: typeof input.autoStartNext === "boolean" ? input.autoStartNext : DEFAULT_SETTINGS.autoStartNext,
    beepFrequency:
      input.beepFrequency && ["low", "medium", "high"].includes(input.beepFrequency)
        ? input.beepFrequency
        : DEFAULT_SETTINGS.beepFrequency,
  };
}

// ---- Time formatting / parsing ----

/** Format seconds → MM:SS (zero-padded). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parse MM:SS → seconds. Returns 0 for invalid input. */
export function parseTime(s: string): number {
  if (!s) return 0;
  const m = s.trim().match(/^(\d+):([0-5]?\d)$/);
  if (!m) return 0;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  return min * 60 + sec;
}

/** Convert minutes → seconds. */
export function minutesToSeconds(min: number): number {
  return clampPositiveNum(min, 0) * 60;
}

/** Convert seconds → minutes (decimal). */
export function secondsToMinutes(sec: number): number {
  return sec / 60;
}

// ---- Phase calculation ----

/**
 * Given a step index (0-based), determine the phase at that step.
 * Even indices are work sessions; odd indices are breaks.
 */
export function phaseAtStep(stepIndex: number, longBreakEvery: number): Phase {
  const idx = clampPositiveInt(stepIndex + 1, 1) - 1; // floor ≥ 0
  if (idx % 2 === 0) return "work";
  // Break step — find which work session preceded it
  const workSessionNum = (idx + 1) / 2; // 1, 2, 3, ...
  const lbe = clampPositiveInt(longBreakEvery, 1);
  if (workSessionNum % lbe === 0) return "long-break";
  return "short-break";
}

/**
 * Compute the work session number (1-based) at a given step index.
 * Returns 0 for break steps (since they happen "after" a session).
 */
export function sessionNumAtStep(stepIndex: number): number {
  const idx = clampPositiveInt(stepIndex + 1, 1) - 1;
  if (idx % 2 === 0) return idx / 2 + 1; // work step
  return (idx + 1) / 2; // break step — session that just finished
}

/** Duration (in minutes) for a phase given the settings. */
export function durationForPhase(phase: Phase, settings: PomodoroSettings): number {
  switch (phase) {
    case "work": return settings.workDurationMin;
    case "short-break": return settings.shortBreakMin;
    case "long-break": return settings.longBreakMin;
  }
}

/**
 * Generate the full phase sequence for `totalSessions` work sessions.
 * The sequence alternates work → break → work → break → ... ending with
 * the final work session (no break after the last session).
 */
export function generatePhaseSequence(settings: PomodoroSettings): PhaseStep[] {
  const total = clampPositiveInt(settings.totalSessions, 1);
  const steps: PhaseStep[] = [];
  // For N work sessions: N work + (N-1) breaks = 2N-1 steps
  const totalSteps = total * 2 - 1;
  for (let i = 0; i < totalSteps; i++) {
    const phase = phaseAtStep(i, settings.longBreakEvery);
    const durationMin = durationForPhase(phase, settings);
    const sessionNum = sessionNumAtStep(i);
    steps.push({
      stepIndex: i,
      phase,
      durationMin,
      durationSec: minutesToSeconds(durationMin),
      sessionNum,
    });
  }
  return steps;
}

/** Total step count for N work sessions = 2N-1. */
export function totalStepCount(totalSessions: number): number {
  const n = clampPositiveInt(totalSessions, 1);
  return n * 2 - 1;
}

/** Estimate total work / break / overall time for the full plan. */
export function estimateTotalTime(settings: PomodoroSettings): TimeEstimate {
  const steps = generatePhaseSequence(settings);
  let workMin = 0;
  let breakMin = 0;
  let workCount = 0;
  let shortBreakCount = 0;
  let longBreakCount = 0;
  for (const s of steps) {
    if (s.phase === "work") {
      workMin += s.durationMin;
      workCount += 1;
    } else if (s.phase === "short-break") {
      breakMin += s.durationMin;
      shortBreakCount += 1;
    } else {
      breakMin += s.durationMin;
      longBreakCount += 1;
    }
  }
  return {
    workMin,
    breakMin,
    totalMin: workMin + breakMin,
    workCount,
    shortBreakCount,
    longBreakCount,
  };
}

/** Compute progress 0..1 (elapsed / duration). */
export function computeProgress(elapsedSec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return 0;
  const p = elapsedSec / durationSec;
  if (p > 1) return 1;
  return p;
}

// ---- Beep ----

/** Build beep parameters for a phase transition (pure — UI plays the sound). */
export function beepParamsForPhase(phase: Phase, freq: BeepFrequency): BeepParams {
  return {
    frequency: BEEP_FREQS[freq],
    durationMs: BEEP_DURATIONS[phase],
    type: "sine",
    volume: 0.3,
  };
}

// ---- Stats ----

/** Compute summary stats for a completed run. */
export function summaryStats(
  sessionsCompleted: number,
  settings: PomodoroSettings,
): PomodoroStats {
  const completed = clampPositiveInt(sessionsCompleted, 0);
  const workMin = completed * settings.workDurationMin;
  // Breaks that actually happened: the breaks BETWEEN sessions, i.e. after
  // sessions 1..(completed-1). The break after the last completed session
  // hasn't happened yet (the user stopped after finishing that work session).
  const breakSteps = generatePhaseSequence(settings)
    .filter((s) => s.phase !== "work" && s.sessionNum < completed);
  const breakMin = breakSteps.reduce((acc, s) => acc + s.durationMin, 0);
  return {
    totalWorkMin: workMin,
    totalBreakMin: breakMin,
    totalMin: workMin + breakMin,
    sessionsCompleted: completed,
    avgSessionMin: completed > 0 ? workMin / completed : 0,
  };
}

// ---- Rendering ----

export function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min < 0) min = 0;
  const total = Math.round(min * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Render the phase sequence as a text report. */
export function renderText(settings: PomodoroSettings): string {
  const steps = generatePhaseSequence(settings);
  const est = estimateTotalTime(settings);
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("                  POMODORO PLAN");
  lines.push("=".repeat(60));
  lines.push(`Work duration:     ${settings.workDurationMin} min`);
  lines.push(`Short break:       ${settings.shortBreakMin} min`);
  lines.push(`Long break:        ${settings.longBreakMin} min (every ${settings.longBreakEvery} sessions)`);
  lines.push(`Total sessions:    ${settings.totalSessions}`);
  lines.push(`Sound:             ${settings.soundEnabled ? "on" : "off"} (${BEEP_LABELS[settings.beepFrequency]})`);
  lines.push(`Auto-start next:   ${settings.autoStartNext ? "yes" : "no"}`);
  lines.push("-".repeat(60));
  lines.push("ESTIMATE");
  lines.push(`  Work time:       ${formatMinutes(est.workMin)}`);
  lines.push(`  Break time:      ${formatMinutes(est.breakMin)}`);
  lines.push(`  Total time:      ${formatMinutes(est.totalMin)}`);
  lines.push(`  Breaks:          ${est.shortBreakCount} short + ${est.longBreakCount} long`);
  lines.push("-".repeat(60));
  lines.push("SESSION BREAKDOWN");
  lines.push("-".repeat(60));
  for (const s of steps) {
    const label = PHASE_LABELS[s.phase];
    if (s.phase === "work") {
      lines.push(`  [${String(s.stepIndex + 1).padStart(2)}/${String(steps.length).padStart(2)}] Session ${s.sessionNum}/${settings.totalSessions}  WORK ${formatTime(s.durationSec)}  ${label}`);
    } else {
      lines.push(`  [${String(s.stepIndex + 1).padStart(2)}/${String(steps.length).padStart(2)}]                         ${label.toUpperCase().padEnd(12)} ${formatTime(s.durationSec)}`);
    }
  }
  lines.push("-".repeat(60));
  lines.push("Generated by UnQTools Pomodoro Timer — 100% client-side.");
  lines.push("=".repeat(60));
  return lines.join("\n");
}

/** Render the phase sequence as CSV (session_num, phase, duration_min). */
export function renderCsv(settings: PomodoroSettings): string {
  const steps = generatePhaseSequence(settings);
  const lines: string[] = ["step,session_num,phase,duration_min,duration_sec"];
  for (const s of steps) {
    lines.push([
      String(s.stepIndex + 1),
      String(s.sessionNum),
      s.phase,
      s.durationMin.toFixed(2),
      String(s.durationSec),
    ].join(","));
  }
  const est = estimateTotalTime(settings);
  lines.push("");
  lines.push(`# work_min,${est.workMin.toFixed(2)}`);
  lines.push(`# break_min,${est.breakMin.toFixed(2)}`);
  lines.push(`# total_min,${est.totalMin.toFixed(2)}`);
  lines.push(`# work_sessions,${est.workCount}`);
  lines.push(`# short_breaks,${est.shortBreakCount}`);
  lines.push(`# long_breaks,${est.longBreakCount}`);
  lines.push(`# sound,${settings.soundEnabled ? "on" : "off"}`);
  lines.push(`# auto_start,${settings.autoStartNext ? "yes" : "no"}`);
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:pomodoro-timer:history";
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

const SHARE_KEYS: (keyof PomodoroSettings)[] = [
  "workDurationMin", "shortBreakMin", "longBreakMin",
  "longBreakEvery", "totalSessions",
  "soundEnabled", "autoStartNext", "beepFrequency",
];

export function buildShareUrl(settings: PomodoroSettings): string {
  const params = new URLSearchParams();
  for (const k of SHARE_KEYS) {
    const v = settings[k];
    if (typeof v === "boolean") {
      params.set(k, v ? "1" : "0");
    } else {
      params.set(k, String(v));
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PomodoroSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<PomodoroSettings> = {};
  const numKeys = new Set<keyof PomodoroSettings>([
    "workDurationMin", "shortBreakMin", "longBreakMin",
    "longBreakEvery", "totalSessions",
  ]);
  const boolKeys = new Set<keyof PomodoroSettings>(["soundEnabled", "autoStartNext"]);
  for (const k of SHARE_KEYS) {
    const v = params.get(k);
    if (v === null) continue;
    if (numKeys.has(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) (out as Record<string, unknown>)[k] = n;
    } else if (boolKeys.has(k)) {
      (out as Record<string, unknown>)[k] = v === "1" || v === "true";
    } else if (k === "beepFrequency") {
      if (["low", "medium", "high"].includes(v)) {
        (out as Record<string, unknown>)[k] = v as BeepFrequency;
      }
    }
  }
  return out;
}
