import { describe, it, expect, beforeEach } from "vitest";
import {
  PHASE_LABELS,
  PHASE_COLORS,
  BEEP_FREQS,
  BEEP_LABELS,
  BEEP_DURATIONS,
  SESSION_PRESETS,
  PRESET_LABELS,
  DEFAULT_SETTINGS,
  clampPositiveInt,
  clampPositiveNum,
  normalizeSettings,
  formatTime,
  parseTime,
  minutesToSeconds,
  secondsToMinutes,
  phaseAtStep,
  sessionNumAtStep,
  durationForPhase,
  generatePhaseSequence,
  totalStepCount,
  estimateTotalTime,
  computeProgress,
  beepParamsForPhase,
  summaryStats,
  formatMinutes,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Phase,
  type BeepFrequency,
  type PomodoroSettings,
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

describe("pomodoro-timer constants", () => {
  it("has 3 phase labels", () => {
    expect(Object.keys(PHASE_LABELS)).toHaveLength(3);
    expect(PHASE_LABELS["work"]).toBe("Work");
    expect(PHASE_LABELS["short-break"]).toBe("Short Break");
    expect(PHASE_LABELS["long-break"]).toBe("Long Break");
  });
  it("has 3 phase colors", () => {
    expect(Object.keys(PHASE_COLORS)).toHaveLength(3);
  });
  it("has 3 beep frequencies", () => {
    expect(BEEP_FREQS["low"]).toBe(220);
    expect(BEEP_FREQS["medium"]).toBe(440);
    expect(BEEP_FREQS["high"]).toBe(880);
    expect(Object.keys(BEEP_LABELS)).toHaveLength(3);
  });
  it("has 3 beep durations per phase", () => {
    expect(Object.keys(BEEP_DURATIONS)).toHaveLength(3);
    expect(BEEP_DURATIONS["work"]).toBeGreaterThan(0);
    expect(BEEP_DURATIONS["long-break"]).toBeGreaterThan(BEEP_DURATIONS["short-break"]);
  });
  it("has 4 session presets", () => {
    expect(Object.keys(SESSION_PRESETS)).toHaveLength(4);
    expect(SESSION_PRESETS.classic.workDurationMin).toBe(25);
    expect(SESSION_PRESETS.long.workDurationMin).toBe(50);
    expect(SESSION_PRESETS.short.workDurationMin).toBe(15);
    expect(SESSION_PRESETS.custom.workDurationMin).toBe(25);
    expect(Object.keys(PRESET_LABELS)).toHaveLength(4);
  });
  it("default settings equal classic preset", () => {
    expect(DEFAULT_SETTINGS.workDurationMin).toBe(25);
    expect(DEFAULT_SETTINGS.shortBreakMin).toBe(5);
    expect(DEFAULT_SETTINGS.longBreakMin).toBe(15);
    expect(DEFAULT_SETTINGS.longBreakEvery).toBe(4);
    expect(DEFAULT_SETTINGS.totalSessions).toBe(8);
    expect(DEFAULT_SETTINGS.soundEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.autoStartNext).toBe(false);
    expect(DEFAULT_SETTINGS.beepFrequency).toBe("medium");
  });
});

describe("pomodoro-timer helpers", () => {
  it("clampPositiveInt floors and rejects invalid", () => {
    expect(clampPositiveInt(5, 1)).toBe(5);
    expect(clampPositiveInt(5.7, 1)).toBe(5);
    expect(clampPositiveInt(0, 1)).toBe(1);
    expect(clampPositiveInt(-3, 1)).toBe(1);
    expect(clampPositiveInt(NaN, 7)).toBe(7);
  });
  it("clampPositiveNum rejects invalid (keeps 0)", () => {
    expect(clampPositiveNum(5.5, 1)).toBe(5.5);
    expect(clampPositiveNum(0, 1)).toBe(0);
    expect(clampPositiveNum(-1, 1)).toBe(1);
    expect(clampPositiveNum(NaN, 3)).toBe(3);
  });
  it("normalizeSettings fills defaults and clamps", () => {
    const s = normalizeSettings({ workDurationMin: 30, totalSessions: 4.9 });
    expect(s.workDurationMin).toBe(30);
    expect(s.totalSessions).toBe(4);
    expect(s.shortBreakMin).toBe(5); // default
    expect(s.soundEnabled).toBe(true); // default
    expect(s.beepFrequency).toBe("medium"); // default
  });
  it("normalizeSettings rejects invalid beepFrequency", () => {
    const s = normalizeSettings({ beepFrequency: "ultra" as unknown as BeepFrequency });
    expect(s.beepFrequency).toBe("medium");
  });
});

describe("pomodoro-timer time formatting", () => {
  it("formatTime formats seconds to MM:SS", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(1500)).toBe("25:00");
    expect(formatTime(-5)).toBe("00:00");
    expect(formatTime(NaN)).toBe("00:00");
  });
  it("parseTime parses MM:SS", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("01:05")).toBe(65);
    expect(parseTime("25:00")).toBe(1500);
    expect(parseTime("bad")).toBe(0);
    expect(parseTime("")).toBe(0);
  });
  it("parseTime rejects out-of-range seconds", () => {
    expect(parseTime("01:60")).toBe(0);
    expect(parseTime("01:99")).toBe(0);
  });
  it("minutesToSeconds converts", () => {
    expect(minutesToSeconds(1)).toBe(60);
    expect(minutesToSeconds(25)).toBe(1500);
    expect(minutesToSeconds(-5)).toBe(0);
  });
  it("secondsToMinutes converts", () => {
    expect(secondsToMinutes(60)).toBe(1);
    expect(secondsToMinutes(1500)).toBe(25);
  });
  it("formatMinutes formats compactly", () => {
    expect(formatMinutes(0)).toBe("0m 00s");
    expect(formatMinutes(5)).toBe("5m 00s");
    expect(formatMinutes(25)).toBe("25m 00s");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(-1)).toBe("0m 00s");
  });
});

describe("pomodoro-timer phaseAtStep", () => {
  it("returns work for even step indices", () => {
    expect(phaseAtStep(0, 4)).toBe("work");
    expect(phaseAtStep(2, 4)).toBe("work");
    expect(phaseAtStep(4, 4)).toBe("work");
  });
  it("returns short-break for non-multiple-of-longBreakEvery", () => {
    expect(phaseAtStep(1, 4)).toBe("short-break");
    expect(phaseAtStep(3, 4)).toBe("short-break");
    expect(phaseAtStep(5, 4)).toBe("short-break");
  });
  it("returns long-break at multiples of longBreakEvery", () => {
    expect(phaseAtStep(7, 4)).toBe("long-break"); // after session 4
    expect(phaseAtStep(15, 4)).toBe("long-break"); // after session 8
  });
  it("handles longBreakEvery=1 (long break every session)", () => {
    expect(phaseAtStep(1, 1)).toBe("long-break");
    expect(phaseAtStep(3, 1)).toBe("long-break");
  });
  it("handles longBreakEvery=2", () => {
    expect(phaseAtStep(1, 2)).toBe("short-break");
    expect(phaseAtStep(3, 2)).toBe("long-break"); // after session 2
    expect(phaseAtStep(5, 2)).toBe("short-break");
    expect(phaseAtStep(7, 2)).toBe("long-break"); // after session 4
  });
});

describe("pomodoro-timer sessionNumAtStep", () => {
  it("returns session number for work steps", () => {
    expect(sessionNumAtStep(0)).toBe(1);
    expect(sessionNumAtStep(2)).toBe(2);
    expect(sessionNumAtStep(4)).toBe(3);
    expect(sessionNumAtStep(14)).toBe(8);
  });
  it("returns the preceding session number for break steps", () => {
    expect(sessionNumAtStep(1)).toBe(1);
    expect(sessionNumAtStep(3)).toBe(2);
    expect(sessionNumAtStep(7)).toBe(4);
  });
});

describe("pomodoro-timer durationForPhase", () => {
  it("returns correct duration per phase", () => {
    const s: PomodoroSettings = { ...DEFAULT_SETTINGS };
    expect(durationForPhase("work", s)).toBe(25);
    expect(durationForPhase("short-break", s)).toBe(5);
    expect(durationForPhase("long-break", s)).toBe(15);
  });
});

describe("pomodoro-timer generatePhaseSequence", () => {
  it("generates 2N-1 steps for N work sessions", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 8 };
    const seq = generatePhaseSequence(s);
    expect(seq).toHaveLength(15); // 2*8-1
  });
  it("places long breaks at the right positions", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 8 };
    const seq = generatePhaseSequence(s);
    // Long breaks at step indices 7 (after session 4) and 15 (after session 8)
    // But total steps is 15 (indices 0-14), so step 15 doesn't exist.
    // Step 7 = after session 4 → long-break
    expect(seq[7].phase).toBe("long-break");
    // Final step (14) is work session 8
    expect(seq[14].phase).toBe("work");
    expect(seq[14].sessionNum).toBe(8);
  });
  it("alternates work and break correctly", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 5 };
    const seq = generatePhaseSequence(s);
    // For N=5: 2N-1 = 9 steps (indices 0..8)
    // 0 work, 1 short, 2 work, 3 short, 4 work, 5 short, 6 work, 7 LONG (after session 4), 8 work
    expect(seq[0].phase).toBe("work");
    expect(seq[1].phase).toBe("short-break");
    expect(seq[2].phase).toBe("work");
    expect(seq[3].phase).toBe("short-break");
    expect(seq[4].phase).toBe("work");
    expect(seq[5].phase).toBe("short-break");
    expect(seq[6].phase).toBe("work");
    expect(seq[7].phase).toBe("long-break"); // 4 % 4 === 0
    expect(seq[8].phase).toBe("work");
    expect(seq[8].sessionNum).toBe(5);
  });
  it("for N=4 lbe=4 ends with work (no break after last)", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 4 };
    const seq = generatePhaseSequence(s);
    expect(seq).toHaveLength(7); // 2*4-1
    expect(seq[6].phase).toBe("work");
    expect(seq[6].sessionNum).toBe(4);
  });
  it("handles totalSessions=1 (no breaks)", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 1 };
    const seq = generatePhaseSequence(s);
    expect(seq).toHaveLength(1);
    expect(seq[0].phase).toBe("work");
  });
  it("computes durationSec correctly", () => {
    const s = { ...DEFAULT_SETTINGS };
    const seq = generatePhaseSequence(s);
    expect(seq[0].durationSec).toBe(1500); // 25 min
    expect(seq[1].durationSec).toBe(300);  // 5 min
  });
});

describe("pomodoro-timer totalStepCount", () => {
  it("returns 2N-1", () => {
    expect(totalStepCount(1)).toBe(1);
    expect(totalStepCount(4)).toBe(7);
    expect(totalStepCount(8)).toBe(15);
  });
});

describe("pomodoro-timer estimateTotalTime", () => {
  it("computes total work + break for classic preset", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 8 };
    const est = estimateTotalTime(s);
    expect(est.workCount).toBe(8);
    expect(est.workMin).toBe(200); // 8 × 25
    expect(est.shortBreakCount).toBe(6);
    expect(est.longBreakCount).toBe(1);
    expect(est.breakMin).toBe(6 * 5 + 15); // 45
    expect(est.totalMin).toBe(245); // 200 + 45
  });
  it("handles single session", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 1 };
    const est = estimateTotalTime(s);
    expect(est.workMin).toBe(25);
    expect(est.breakMin).toBe(0);
    expect(est.totalMin).toBe(25);
  });
});

describe("pomodoro-timer computeProgress", () => {
  it("returns 0 for 0 elapsed", () => {
    expect(computeProgress(0, 1500)).toBe(0);
  });
  it("returns 0.5 at halfway", () => {
    expect(computeProgress(750, 1500)).toBeCloseTo(0.5, 4);
  });
  it("returns 1 when elapsed > duration", () => {
    expect(computeProgress(2000, 1500)).toBe(1);
  });
  it("returns 0 for invalid duration", () => {
    expect(computeProgress(100, 0)).toBe(0);
    expect(computeProgress(100, NaN)).toBe(0);
  });
});

describe("pomodoro-timer beepParamsForPhase", () => {
  it("returns frequency for selected preset", () => {
    const p = beepParamsForPhase("work", "medium");
    expect(p.frequency).toBe(440);
    expect(p.durationMs).toBe(BEEP_DURATIONS["work"]);
    expect(p.type).toBe("sine");
    expect(p.volume).toBeGreaterThan(0);
  });
  it("uses phase-specific duration", () => {
    const work = beepParamsForPhase("work", "low");
    const longBreak = beepParamsForPhase("long-break", "low");
    expect(longBreak.durationMs).toBeGreaterThan(work.durationMs);
  });
});

describe("pomodoro-timer summaryStats", () => {
  it("computes stats for completed sessions", () => {
    const s = { ...DEFAULT_SETTINGS };
    const stats = summaryStats(4, s);
    // 4 work sessions completed → breaks between sessions: after 1, 2, 3
    // All 3 are short-breaks (3 % 4 !== 0) → 3 × 5 = 15 min
    expect(stats.sessionsCompleted).toBe(4);
    expect(stats.totalWorkMin).toBe(100); // 4 × 25
    expect(stats.totalBreakMin).toBe(15); // 3 short
    expect(stats.totalMin).toBe(115);
    expect(stats.avgSessionMin).toBe(25);
  });
  it("includes long break for 5 completed sessions", () => {
    const s = { ...DEFAULT_SETTINGS };
    const stats = summaryStats(5, s);
    // 5 work + breaks after 1, 2, 3, 4 (long since 4 % 4 = 0) = 3 short + 1 long = 30 min
    expect(stats.totalWorkMin).toBe(125);
    expect(stats.totalBreakMin).toBe(30); // 15 + 15
    expect(stats.totalMin).toBe(155);
  });
  it("handles 0 completed sessions", () => {
    const s = { ...DEFAULT_SETTINGS };
    const stats = summaryStats(0, s);
    expect(stats.totalWorkMin).toBe(0);
    expect(stats.totalBreakMin).toBe(0);
    expect(stats.avgSessionMin).toBe(0);
  });
});

describe("pomodoro-timer renderText", () => {
  it("renders a plan report", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 4 };
    const text = renderText(s);
    expect(text).toContain("POMODORO PLAN");
    expect(text).toContain("Work duration:     25 min");
    expect(text).toContain("SESSION BREAKDOWN");
    expect(text).toContain("Session 1/4");
    expect(text).toContain("25:00");
    expect(text).toContain("ESTIMATE");
  });
});

describe("pomodoro-timer renderCsv", () => {
  it("renders header and rows", () => {
    const s = { ...DEFAULT_SETTINGS, totalSessions: 2 };
    const csv = renderCsv(s);
    expect(csv).toContain("step,session_num,phase,duration_min,duration_sec");
    expect(csv).toContain("1,1,work,25.00,1500");
    expect(csv).toContain("2,1,short-break,5.00,300");
    expect(csv).toContain("# work_min,50.00");
    expect(csv).toContain("# total_min,55.00");
  });
});

describe("pomodoro-timer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      completedSessions: 4,
      totalWorkMin: 100,
      totalBreakMin: 25,
      settings: { ...DEFAULT_SETTINGS },
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].completedSessions).toBe(4);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        completedSessions: i + 1,
        totalWorkMin: 25 * (i + 1),
        totalBreakMin: 0,
        settings: { ...DEFAULT_SETTINGS },
      });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].completedSessions).toBe(25);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      completedSessions: 4,
      totalWorkMin: 100,
      totalBreakMin: 25,
      settings: { ...DEFAULT_SETTINGS },
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pomodoro-timer shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_SETTINGS);
    expect(url).toContain("workDurationMin=25");
    expect(url).toContain("shortBreakMin=5");
    expect(url).toContain("longBreakMin=15");
    expect(url).toContain("longBreakEvery=4");
    expect(url).toContain("totalSessions=8");
    expect(url).toContain("soundEnabled=1");
    expect(url).toContain("autoStartNext=0");
    expect(url).toContain("beepFrequency=medium");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_SETTINGS);
    (globalThis as Record<string, unknown>).window = origWindow;
    const parsed = parseShareUrl(url);
    expect(parsed.workDurationMin).toBe(25);
    expect(parsed.shortBreakMin).toBe(5);
    expect(parsed.longBreakMin).toBe(15);
    expect(parsed.longBreakEvery).toBe(4);
    expect(parsed.totalSessions).toBe(8);
    expect(parsed.soundEnabled).toBe(true);
    expect(parsed.autoStartNext).toBe(false);
    expect(parsed.beepFrequency).toBe("medium");
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("filters invalid beepFrequency", () => {
    const parsed = parseShareUrl("beepFrequency=ultra&workDurationMin=30");
    expect(parsed.beepFrequency).toBeUndefined();
    expect(parsed.workDurationMin).toBe(30);
  });

  it("parses booleans correctly (1/0 and true/false)", () => {
    const parsed = parseShareUrl("soundEnabled=0&autoStartNext=true");
    expect(parsed.soundEnabled).toBe(false);
    expect(parsed.autoStartNext).toBe(true);
  });

  it("ignores non-numeric numeric params", () => {
    const parsed = parseShareUrl("workDurationMin=abc");
    expect(parsed.workDurationMin).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = Phase;
