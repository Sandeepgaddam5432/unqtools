import { describe, it, expect, beforeEach } from "vitest";
import {
  COLORS,
  ALARM_BEEP,
  POMODORO_PRESETS,
  TABATA_PRESETS,
  COUNTDOWN_PRESETS,
  KBD_SHORTCUTS,
  createStopwatch,
  createCountdown,
  createTabata,
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  addLap,
  toggleTimer,
  getElapsedMs,
  getRemainingMs,
  computeTabataProgress,
  getSnapshot,
  advanceIfDone,
  markAlarmFired,
  computeAlarmAt,
  computeLapStats,
  renderLapsText,
  renderLapsCsv,
  formatStopwatch,
  formatCountdown,
  formatTime,
  parseDuration,
  serializeDuration,
  playBeep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  pickColor,
  makeTimerId,
  type TimerState,
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

describe("online-stopwatch-timer constants & presets", () => {
  it("exposes a non-empty COLORS palette", () => {
    expect(COLORS.length).toBeGreaterThanOrEqual(4);
    expect(COLORS[0]).toMatch(/^#/);
  });

  it("exposes ALARM_BEEP with sane defaults", () => {
    expect(ALARM_BEEP.frequency).toBeGreaterThan(200);
    expect(ALARM_BEEP.repeats).toBeGreaterThanOrEqual(1);
    expect(ALARM_BEEP.durationMs).toBeGreaterThan(50);
  });

  it("has 4 Pomodoro presets", () => {
    expect(POMODORO_PRESETS).toHaveLength(4);
    expect(POMODORO_PRESETS.every((p) => p.kind === "countdown")).toBe(true);
  });

  it("has 4 Tabata presets", () => {
    expect(TABATA_PRESETS).toHaveLength(4);
    expect(TABATA_PRESETS.every((p) => p.kind === "tabata" && !!p.tabata)).toBe(true);
  });

  it("has 4 countdown presets", () => {
    expect(COUNTDOWN_PRESETS).toHaveLength(4);
  });

  it("exposes keyboard shortcuts", () => {
    expect(KBD_SHORTCUTS.length).toBeGreaterThanOrEqual(4);
    expect(KBD_SHORTCUTS.some((s) => s.key === "Space")).toBe(true);
  });
});

describe("online-stopwatch-timer pickColor & makeTimerId", () => {
  it("wraps the color index", () => {
    expect(pickColor(0)).toBe(COLORS[0]);
    expect(pickColor(COLORS.length)).toBe(COLORS[0]);
    expect(pickColor(-1)).toBe(COLORS[COLORS.length - 1]);
  });

  it("generates unique ids", () => {
    const a = makeTimerId();
    const b = makeTimerId();
    expect(a).not.toBe(b);
    expect(a.startsWith("t-")).toBe(true);
  });
});

describe("online-stopwatch-timer factory functions", () => {
  it("createStopwatch returns a sane idle stopwatch", () => {
    const t = createStopwatch("Run");
    expect(t.kind).toBe("stopwatch");
    expect(t.status).toBe("idle");
    expect(t.name).toBe("Run");
    expect(t.laps).toEqual([]);
    expect(t.accumulatedMs).toBe(0);
  });

  it("createCountdown clamps duration to non-negative", () => {
    const t = createCountdown("Tea", -1000);
    expect(t.kind).toBe("countdown");
    expect(t.durationMs).toBe(0);
    expect(t.status).toBe("idle");
  });

  it("createTabata clamps rounds to >= 1", () => {
    const t = createTabata("HIIT", { workMs: 20_000, restMs: 10_000, rounds: 0 });
    expect(t.kind).toBe("tabata");
    expect(t.tabata).not.toBeNull();
    expect(t.tabata!.rounds).toBe(1);
    expect(t.durationMs).toBe(30_000);
  });

  it("createTimer dispatches by kind", () => {
    const sw = createTimer({ kind: "stopwatch", name: "A" });
    const cd = createTimer({ kind: "countdown", name: "B", durationMs: 5000 });
    const tb = createTimer({ kind: "tabata", name: "C", tabata: { workMs: 1000, restMs: 500, rounds: 3 } });
    expect(sw.kind).toBe("stopwatch");
    expect(cd.kind).toBe("countdown");
    expect(cd.durationMs).toBe(5000);
    expect(tb.kind).toBe("tabata");
    expect(tb.tabata!.workMs).toBe(1000);
  });
});

describe("online-stopwatch-timer start / pause / resume", () => {
  it("start sets anchor and status running", () => {
    const t = createStopwatch("X");
    const started = startTimer(t, 1000);
    expect(started.status).toBe("running");
    expect(started.anchorMs).toBe(1000);
  });

  it("pause accumulates elapsed and clears anchor", () => {
    let t: TimerState = createStopwatch("X");
    t = startTimer(t, 1000);
    t = pauseTimer(t, 2500);
    expect(t.status).toBe("paused");
    expect(t.anchorMs).toBe(0);
    expect(t.accumulatedMs).toBe(1500);
  });

  it("resume continues from accumulated time (drift-free)", () => {
    let t: TimerState = createStopwatch("X");
    t = startTimer(t, 1000);
    t = pauseTimer(t, 2500); // 1500 elapsed
    t = startTimer(t, 5000); // resume
    expect(getElapsedMs(t, 6000)).toBe(2500); // 1500 + 1000
  });

  it("getElapsedMs is correct while running, paused, idle, done", () => {
    let t: TimerState = createCountdown("X", 5000);
    expect(getElapsedMs(t, 0)).toBe(0);
    t = startTimer(t, 1000);
    expect(getElapsedMs(t, 2000)).toBe(1000);
    t = pauseTimer(t, 3000);
    expect(getElapsedMs(t, 9999)).toBe(2000);
  });

  it("toggleTimer switches running <-> paused", () => {
    let t: TimerState = createStopwatch("X");
    t = toggleTimer(t, 100);
    expect(t.status).toBe("running");
    t = toggleTimer(t, 200);
    expect(t.status).toBe("paused");
    t = toggleTimer(t, 300);
    expect(t.status).toBe("running");
  });
});

describe("online-stopwatch-timer reset", () => {
  it("reset clears everything but keeps kind/name", () => {
    let t: TimerState = createCountdown("Tea", 5000);
    t = startTimer(t, 100);
    t = pauseTimer(t, 1100); // 1000 elapsed
    t = addLap(t, 1100); // ignored — not stopwatch
    t = resetTimer(t);
    expect(t.status).toBe("idle");
    expect(t.accumulatedMs).toBe(0);
    expect(t.laps).toEqual([]);
    expect(t.durationMs).toBe(5000); // duration preserved
    expect(t.name).toBe("Tea");
  });
});

describe("online-stopwatch-timer laps", () => {
  it("addLap records split and total", () => {
    let t: TimerState = createStopwatch("Lap test");
    t = startTimer(t, 0);
    t = addLap(t, 1500);
    t = addLap(t, 3500);
    expect(t.laps).toHaveLength(2);
    expect(t.laps[0].lapTimeMs).toBe(1500);
    expect(t.laps[0].totalTimeMs).toBe(1500);
    expect(t.laps[1].lapTimeMs).toBe(2000); // 3500 - 1500
    expect(t.laps[1].totalTimeMs).toBe(3500);
    expect(t.laps[1].index).toBe(2);
  });

  it("addLap is a no-op on countdown", () => {
    let t: TimerState = createCountdown("X", 5000);
    t = startTimer(t, 0);
    t = addLap(t, 1000);
    expect(t.laps).toHaveLength(0);
  });

  it("addLap is a no-op when paused", () => {
    let t: TimerState = createStopwatch("X");
    t = startTimer(t, 0);
    t = pauseTimer(t, 1000);
    t = addLap(t, 1500);
    expect(t.laps).toHaveLength(0);
  });

  it("computeLapStats returns zeros for empty", () => {
    const stats = computeLapStats([]);
    expect(stats.count).toBe(0);
    expect(stats.fastestMs).toBe(0);
  });

  it("computeLapStats computes min/max/avg", () => {
    const laps = [
      { index: 1, lapTimeMs: 1500, totalTimeMs: 1500, ts: 0 },
      { index: 2, lapTimeMs: 2000, totalTimeMs: 3500, ts: 0 },
      { index: 3, lapTimeMs: 1000, totalTimeMs: 4500, ts: 0 },
    ];
    const stats = computeLapStats(laps);
    expect(stats.count).toBe(3);
    expect(stats.fastestMs).toBe(1000);
    expect(stats.slowestMs).toBe(2000);
    expect(stats.averageMs).toBeCloseTo(1500, 5);
    expect(stats.totalMs).toBe(4500);
  });

  it("renderLapsText includes header and rows", () => {
    let t: TimerState = createStopwatch("X");
    t = startTimer(t, 0);
    t = addLap(t, 1500);
    const text = renderLapsText(t.laps);
    expect(text.split("\n")[0]).toBe("Lap\tSplit\tTotal");
    expect(text).toContain("Lap 1");
  });

  it("renderLapsCsv includes header and escaped rows", () => {
    let t: TimerState = createStopwatch("X");
    t = startTimer(t, 0);
    t = addLap(t, 1500);
    const csv = renderLapsCsv(t.laps);
    expect(csv.split("\n")[0]).toBe("index,split_ms,total_ms,split_label,total_label,timestamp");
    expect(csv.split("\n")[1]).toContain("1,1500,1500");
  });

  it("renderLapsText/renderLapsCsv are empty for no laps", () => {
    expect(renderLapsText([])).toBe("");
    expect(renderLapsCsv([])).toBe("index,split_ms,total_ms,split_label,total_label,timestamp");
  });
});

describe("online-stopwatch-timer countdown", () => {
  it("getRemainingMs counts down", () => {
    let t: TimerState = createCountdown("X", 10_000);
    t = startTimer(t, 0);
    expect(getRemainingMs(t, 3000)).toBe(7000);
  });

  it("getRemainingMs returns -1 for stopwatch", () => {
    const t = createStopwatch("X");
    expect(getRemainingMs(t, 0)).toBe(-1);
  });

  it("getSnapshot marks done when elapsed >= duration", () => {
    let t: TimerState = createCountdown("X", 2000);
    t = startTimer(t, 0);
    const snap = getSnapshot(t, 2500);
    expect(snap.done).toBe(true);
    expect(snap.alarmDue).toBe(true);
    expect(snap.progress).toBeCloseTo(1, 5);
  });

  it("advanceIfDone transitions to done", () => {
    let t: TimerState = createCountdown("X", 2000);
    t = startTimer(t, 0);
    t = advanceIfDone(t, 2500);
    expect(t.status).toBe("done");
    expect(t.accumulatedMs).toBe(2000);
    expect(t.anchorMs).toBe(0);
  });

  it("markAlarmFired clears alarmDue", () => {
    let t: TimerState = createCountdown("X", 2000);
    t = startTimer(t, 0);
    t = advanceIfDone(t, 2500);
    let snap = getSnapshot(t, 2500);
    expect(snap.alarmDue).toBe(true);
    t = markAlarmFired(t);
    snap = getSnapshot(t, 2500);
    expect(snap.alarmDue).toBe(false);
  });

  it("computeAlarmAt returns the wall-clock deadline", () => {
    let t: TimerState = createCountdown("X", 5000);
    t = startTimer(t, 1000);
    expect(computeAlarmAt(t)).toBe(6000);
  });

  it("computeAlarmAt returns null for stopwatch", () => {
    const t = createStopwatch("X");
    expect(computeAlarmAt(t)).toBeNull();
  });
});

describe("online-stopwatch-timer tabata", () => {
  it("computeTabataProgress reports work phase in round 1", () => {
    let t: TimerState = createTabata("X", { workMs: 20_000, restMs: 10_000, rounds: 8 });
    t = startTimer(t, 0);
    const p = computeTabataProgress(t, 5000);
    expect(p.phase).toBe("work");
    expect(p.round).toBe(1);
    expect(p.remainingInPhaseMs).toBe(15_000);
  });

  it("computeTabataProgress reports rest phase", () => {
    let t: TimerState = createTabata("X", { workMs: 20_000, restMs: 10_000, rounds: 8 });
    t = startTimer(t, 0);
    const p = computeTabataProgress(t, 25_000); // 20s work + 5s rest
    expect(p.phase).toBe("rest");
    expect(p.round).toBe(1);
    expect(p.remainingInPhaseMs).toBe(5000);
  });

  it("computeTabataProgress advances rounds", () => {
    let t: TimerState = createTabata("X", { workMs: 20_000, restMs: 10_000, rounds: 8 });
    t = startTimer(t, 0);
    const p = computeTabataProgress(t, 35_000); // 30s = 1 cycle + 5s work
    expect(p.phase).toBe("work");
    expect(p.round).toBe(2);
  });

  it("computeTabataProgress reports done after all rounds", () => {
    let t: TimerState = createTabata("X", { workMs: 20_000, restMs: 10_000, rounds: 8 });
    t = startTimer(t, 0);
    const total = 8 * 30_000;
    const p = computeTabataProgress(t, total + 100);
    expect(p.phase).toBe("done");
    expect(p.round).toBe(8);
  });

  it("tabata snapshot includes round & phase", () => {
    let t: TimerState = createTabata("X", { workMs: 20_000, restMs: 10_000, rounds: 8 });
    t = startTimer(t, 0);
    const snap = getSnapshot(t, 25_000);
    expect(snap.phase).toBe("rest");
    expect(snap.round).toBe(1);
    expect(snap.totalRounds).toBe(8);
    expect(snap.remainingInPhaseMs).toBe(5000);
  });

  it("advanceIfDone on tabata sets currentRound/phase", () => {
    let t: TimerState = createTabata("X", { workMs: 1000, restMs: 500, rounds: 2 });
    t = startTimer(t, 0);
    t = advanceIfDone(t, 3500); // total = 3000
    expect(t.status).toBe("done");
    expect(t.currentRound).toBe(2);
    expect(t.currentPhase).toBe("done");
  });
});

describe("online-stopwatch-timer formatting", () => {
  it("formatStopwatch renders MM:SS.cs for small durations", () => {
    expect(formatStopwatch(0)).toBe("00:00.00");
    expect(formatStopwatch(1500)).toBe("00:01.50");
    expect(formatStopwatch(65_500)).toBe("01:05.50");
  });

  it("formatStopwatch renders HH:MM:SS.cs past an hour", () => {
    expect(formatStopwatch(3_661_500)).toBe("01:01:01.50");
  });

  it("formatCountdown renders MM:SS", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(3_661_000)).toBe("01:01:01");
  });

  it("formatTime toggles centiseconds", () => {
    expect(formatTime(1500, { withCentiseconds: true })).toBe("00:01.50");
    expect(formatTime(1500, { withCentiseconds: false })).toBe("00:01");
    expect(formatTime(1500)).toBe("00:01");
  });

  it("formatStopwatch clamps negative to zero", () => {
    expect(formatStopwatch(-1000)).toBe("00:00.00");
  });
});

describe("online-stopwatch-timer parseDuration / serializeDuration", () => {
  it("parses simple seconds", () => {
    expect(parseDuration("90s").ms).toBe(90_000);
  });

  it("parses minutes", () => {
    expect(parseDuration("25m").ms).toBe(25 * 60_000);
  });

  it("parses compound durations", () => {
    expect(parseDuration("1h30m").ms).toBe(5_400_000);
    expect(parseDuration("1d2h").ms).toBe(26 * 3_600_000);
    expect(parseDuration("1w2d3h4m5s").ms).toBe(
      7 * 86_400_000 + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5000,
    );
  });

  it("parses milliseconds", () => {
    expect(parseDuration("500ms").ms).toBe(500);
  });

  it("parses bare integers as seconds", () => {
    expect(parseDuration("60").ms).toBe(60_000);
  });

  it("parses decimal seconds", () => {
    expect(parseDuration("1.5").ms).toBe(1500);
  });

  it("rejects garbage", () => {
    expect(parseDuration("").ok).toBe(false);
    expect(parseDuration("abc").ok).toBe(false);
  });

  it("serializeDuration picks the largest unit", () => {
    expect(serializeDuration(0)).toBe("0s");
    expect(serializeDuration(500)).toBe("500ms");
    expect(serializeDuration(1500)).toBe("1s");
    expect(serializeDuration(60_000)).toBe("1m");
    expect(serializeDuration(3_600_000)).toBe("1h");
    expect(serializeDuration(5_400_000)).toBe("1h30m");
  });

  it("parseDuration + serializeDuration round-trip-ish for 25m", () => {
    const parsed = parseDuration("25m");
    expect(serializeDuration(parsed.ms)).toBe("25m");
  });
});

describe("online-stopwatch-timer playBeep", () => {
  it("returns false when window is undefined", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      expect(playBeep()).toBe(false);
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });

  it("returns false when AudioContext is unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = {};
    try {
      expect(playBeep()).toBe(false);
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });

  it("ALARM_BEEP config is well-formed", () => {
    expect(ALARM_BEEP.frequency).toBeGreaterThan(0);
    expect(ALARM_BEEP.durationMs).toBeGreaterThan(0);
    expect(ALARM_BEEP.repeats).toBeGreaterThan(0);
    expect(ALARM_BEEP.volume).toBeGreaterThan(0);
    expect(ALARM_BEEP.volume).toBeLessThanOrEqual(1);
  });
});

describe("online-stopwatch-timer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({ ts: 1, kind: "stopwatch", name: "Run", durationMs: 0, elapsedMs: 5000, lapCount: 3 });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].name).toBe("Run");
    expect(h[0].lapCount).toBe(3);
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, kind: "countdown", name: `T${i}`, durationMs: 1000, elapsedMs: 1000, lapCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({ ts: 1, kind: "stopwatch", name: "x", durationMs: 0, elapsedMs: 0, lapCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("online-stopwatch-timer shareable URL", () => {
  it("builds share URL for countdown when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      const url = buildShareUrl({ kind: "countdown", durationMs: 25 * 60_000, name: "Pomodoro" });
      expect(url).toContain("k=countdown");
      expect(url).toContain("d=25m");
      expect(url).toContain("n=Pomodoro");
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });

  it("builds share URL for tabata", () => {
    const url = buildShareUrl({
      kind: "tabata",
      tabata: { workMs: 20_000, restMs: 10_000, rounds: 8 },
      name: "Tabata",
    });
    expect(url).toContain("k=tabata");
    expect(url).toContain("w=20000");
    expect(url).toContain("r=10000");
    expect(url).toContain("c=8");
  });

  it("builds share URL for stopwatch (kind only)", () => {
    const url = buildShareUrl({ kind: "stopwatch" });
    expect(url).toContain("k=stopwatch");
  });

  it("parses countdown share URL back", () => {
    const init = parseShareUrl("k=countdown&d=25m&n=Pomodoro");
    expect(init).not.toBeNull();
    expect(init!.kind).toBe("countdown");
    expect(init!.durationMs).toBe(25 * 60_000);
    expect(init!.name).toBe("Pomodoro");
  });

  it("parses tabata share URL back", () => {
    const init = parseShareUrl("k=tabata&w=20000&r=10000&c=8");
    expect(init).not.toBeNull();
    expect(init!.kind).toBe("tabata");
    expect(init!.tabata!.workMs).toBe(20_000);
    expect(init!.tabata!.restMs).toBe(10_000);
    expect(init!.tabata!.rounds).toBe(8);
  });

  it("parses stopwatch share URL back", () => {
    const init = parseShareUrl("k=stopwatch&n=Run");
    expect(init).not.toBeNull();
    expect(init!.kind).toBe("stopwatch");
    expect(init!.name).toBe("Run");
  });

  it("returns null for empty / unknown kind", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("k=unknown")).toBeNull();
  });

  it("round-trips a countdown via build + parse", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      const url = buildShareUrl({ kind: "countdown", durationMs: 5 * 60_000 });
      const hash = url.substring(url.indexOf("?") + 1);
      const init = parseShareUrl(hash);
      expect(init!.kind).toBe("countdown");
      expect(init!.durationMs).toBe(5 * 60_000);
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
});
