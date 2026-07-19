import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  TEXT_TYPES,
  TEXT_TYPE_LABELS,
  DEFAULT_SETTINGS,
  TIMED_MODE_DURATIONS_MS,
  COMMON_WORDS_POOL,
  QUOTES_POOL,
  CODE_SNIPPETS_POOL,
  shuffle,
  pickRandom,
  randomDigits,
  generateText,
  normalizeTarget,
  normalizeInput,
  computeDiff,
  calculateWpm,
  calculateAccuracy,
  countErrors,
  calculateNetWpm,
  formatTime,
  getCursorIndex,
  getRemainingChars,
  initTestState,
  startTest,
  finishTest,
  resetTest,
  isFinished,
  isRunning,
  computeDuration,
  renderTextReport,
  renderCsv,
  renderSummaryText,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TypingResult,
  type PracticeMode,
  type TextType,
  type Settings,
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

function makeResult(overrides: Partial<TypingResult> = {}): TypingResult {
  return {
    id: overrides.id ?? "r1",
    ts: overrides.ts ?? 1700000000000,
    mode: overrides.mode ?? "timed-1min",
    textType: overrides.textType ?? "common-words",
    wpm: overrides.wpm ?? 50,
    netWpm: overrides.netWpm ?? 48,
    accuracy: overrides.accuracy ?? 95,
    errors: overrides.errors ?? 3,
    durationMs: overrides.durationMs ?? 60_000,
    correctChars: overrides.correctChars ?? 250,
    totalTyped: overrides.totalTyped ?? 260,
    targetTextLength: overrides.targetTextLength ?? 300,
    caseSensitive: overrides.caseSensitive ?? false,
  };
}

describe("typing-practice constants", () => {
  it("exposes HISTORY_KEY + HISTORY_MAX=20", () => {
    expect(HISTORY_KEY).toContain("typing-practice");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 5 practice modes", () => {
    expect(PRACTICE_MODES).toHaveLength(5);
    expect(PRACTICE_MODES).toContain("timed-1min");
    expect(PRACTICE_MODES).toContain("word-count");
  });
  it("has labels for every mode", () => {
    for (const m of PRACTICE_MODES) {
      expect(PRACTICE_MODE_LABELS[m]).toBeTruthy();
    }
  });
  it("has 5 text types", () => {
    expect(TEXT_TYPES).toHaveLength(5);
    expect(TEXT_TYPES).toContain("common-words");
    expect(TEXT_TYPES).toContain("code-snippets");
  });
  it("has labels for every text type", () => {
    for (const t of TEXT_TYPES) {
      expect(TEXT_TYPE_LABELS[t]).toBeTruthy();
    }
  });
  it("has default settings", () => {
    expect(DEFAULT_SETTINGS.practiceMode).toBe("timed-1min");
    expect(DEFAULT_SETTINGS.textType).toBe("common-words");
    expect(DEFAULT_SETTINGS.wordCount).toBe(50);
    expect(DEFAULT_SETTINGS.caseSensitive).toBe(false);
  });
  it("has timed mode durations", () => {
    expect(TIMED_MODE_DURATIONS_MS["timed-1min"]).toBe(60_000);
    expect(TIMED_MODE_DURATIONS_MS["timed-3min"]).toBe(180_000);
    expect(TIMED_MODE_DURATIONS_MS["timed-5min"]).toBe(300_000);
  });
  it("has 200+ common words in pool", () => {
    expect(COMMON_WORDS_POOL.length).toBeGreaterThanOrEqual(200);
  });
  it("has 20+ quotes in pool", () => {
    expect(QUOTES_POOL.length).toBeGreaterThanOrEqual(20);
  });
  it("has 10+ code snippets in pool", () => {
    expect(CODE_SNIPPETS_POOL.length).toBeGreaterThanOrEqual(10);
  });
});

describe("typing-practice shuffle / pickRandom / randomDigits", () => {
  it("shuffle preserves elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, () => 0.5);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("shuffle does not mutate input", () => {
    const arr = [1, 2, 3];
    const before = [...arr];
    shuffle(arr);
    expect(arr).toEqual(before);
  });
  it("pickRandom returns N elements", () => {
    const out = pickRandom([1, 2, 3], 5, () => 0.5);
    expect(out).toHaveLength(5);
  });
  it("pickRandom returns empty for empty array", () => {
    expect(pickRandom([], 5)).toEqual([]);
  });
  it("pickRandom returns empty for n <= 0", () => {
    expect(pickRandom([1, 2, 3], 0)).toEqual([]);
  });
  it("randomDigits generates string of given length (ignoring spaces)", () => {
    const out = randomDigits(9, () => 0.5);
    expect(out.replace(/\s/g, "").length).toBe(9);
  });
  it("randomDigits includes spaces every 3 digits", () => {
    const out = randomDigits(9, () => 0.5);
    expect(out).toContain(" ");
  });
});

describe("typing-practice generateText", () => {
  it("returns custom text as-is", () => {
    const text = generateText("custom", "custom-text", "Hello world", 0);
    expect(text).toBe("Hello world");
  });
  it("returns empty for custom without text", () => {
    expect(generateText("custom", "custom-text", "", 0)).toBe("");
  });
  it("generates common-words text with N words for word-count mode", () => {
    const text = generateText("common-words", "word-count", "", 10, () => 0.5);
    expect(text.split(" ").length).toBe(10);
  });
  it("generates quotes text (non-empty)", () => {
    const text = generateText("quotes", "timed-1min", "", 80, () => 0.5);
    expect(text.length).toBeGreaterThan(0);
  });
  it("generates code-snippets text (non-empty)", () => {
    const text = generateText("code-snippets", "timed-1min", "", 80, () => 0.5);
    expect(text.length).toBeGreaterThan(0);
  });
  it("generates numbers text (non-empty, digits present)", () => {
    const text = generateText("numbers", "timed-1min", "", 80, () => 0.5);
    expect(/\d/.test(text)).toBe(true);
  });
  it("generates longer text for 3min vs 1min", () => {
    const short = generateText("common-words", "timed-1min", "", 0, () => 0.5);
    const long = generateText("common-words", "timed-3min", "", 0, () => 0.5);
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe("typing-practice normalizeTarget / normalizeInput", () => {
  it("normalizeTarget lowercases when not case-sensitive", () => {
    expect(normalizeTarget("Hello World", false)).toBe("hello world");
  });
  it("normalizeTarget preserves case when case-sensitive", () => {
    expect(normalizeTarget("Hello World", true)).toBe("Hello World");
  });
  it("normalizeInput lowercases when not case-sensitive", () => {
    expect(normalizeInput("HELLO", false)).toBe("hello");
  });
  it("normalizeInput preserves case when case-sensitive", () => {
    expect(normalizeInput("HELLO", true)).toBe("HELLO");
  });
});

describe("typing-practice computeDiff", () => {
  it("marks all correct for identical input", () => {
    const d = computeDiff("hello", "hello");
    expect(d.correctCount).toBe(5);
    expect(d.incorrectCount).toBe(0);
    expect(d.missedCount).toBe(0);
    expect(d.extraCount).toBe(0);
    expect(d.chars).toHaveLength(5);
    expect(d.chars.every((c) => c.status === "correct")).toBe(true);
  });
  it("marks incorrect for wrong characters", () => {
    const d = computeDiff("hello", "hEllo");
    expect(d.correctCount).toBe(4);
    expect(d.incorrectCount).toBe(1);
    expect(d.chars[1].status).toBe("incorrect");
  });
  it("marks missed when input is shorter", () => {
    const d = computeDiff("hello", "hi");
    expect(d.correctCount).toBe(1); // 'h'
    expect(d.incorrectCount).toBe(1); // 'i' vs 'e'
    expect(d.missedCount).toBe(3); // 'l', 'l', 'o'
    expect(d.extraCount).toBe(0);
  });
  it("marks extra when input is longer", () => {
    const d = computeDiff("hi", "hello");
    expect(d.correctCount).toBe(1);
    expect(d.incorrectCount).toBe(1);
    expect(d.missedCount).toBe(0);
    expect(d.extraCount).toBe(3);
  });
  it("handles empty input", () => {
    const d = computeDiff("hello", "");
    expect(d.correctCount).toBe(0);
    expect(d.missedCount).toBe(5);
  });
  it("handles empty target", () => {
    const d = computeDiff("", "hello");
    expect(d.extraCount).toBe(5);
    expect(d.correctCount).toBe(0);
  });
});

describe("typing-practice WPM / accuracy / errors / net WPM", () => {
  it("calculateWpm uses standard formula", () => {
    // 250 correct chars / 5 = 50 words; 1 minute → 50 WPM
    expect(calculateWpm(250, 60_000)).toBe(50);
  });
  it("calculateWpm returns 0 for zero duration", () => {
    expect(calculateWpm(250, 0)).toBe(0);
  });
  it("calculateWpm scales with duration", () => {
    // Same chars but 2 minutes → half the WPM
    expect(calculateWpm(250, 120_000)).toBe(25);
  });
  it("calculateAccuracy computes correct/total", () => {
    expect(calculateAccuracy(95, 100)).toBe(95);
  });
  it("calculateAccuracy returns 100 for zero typed", () => {
    expect(calculateAccuracy(0, 0)).toBe(100);
  });
  it("countErrors sums incorrect + extra", () => {
    const d = computeDiff("hello", "hEllox");
    expect(countErrors(d)).toBe(2); // 'E' incorrect + 'x' extra
  });
  it("calculateNetWpm subtracts penalty", () => {
    // gross = 50, 5 errors in 1 min → penalty = 1, net = 49
    const net = calculateNetWpm(250, 5, 60_000);
    expect(net).toBe(49);
  });
  it("calculateNetWpm never goes negative", () => {
    expect(calculateNetWpm(10, 1000, 60_000)).toBe(0);
  });
});

describe("typing-practice formatTime", () => {
  it("formats 0 ms as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });
  it("formats 60 seconds as 00:60", () => {
    expect(formatTime(60_000)).toBe("01:00");
  });
  it("formats 3 minutes", () => {
    expect(formatTime(180_000)).toBe("03:00");
  });
  it("formats 5 min 30 sec", () => {
    expect(formatTime(330_000)).toBe("05:30");
  });
  it("treats negative as 0", () => {
    expect(formatTime(-100)).toBe("00:00");
  });
});

describe("typing-practice cursor tracker", () => {
  it("getCursorIndex caps at target length", () => {
    expect(getCursorIndex(20, 10)).toBe(10);
  });
  it("getCursorIndex returns input length if within target", () => {
    expect(getCursorIndex(5, 10)).toBe(5);
  });
  it("getRemainingChars returns remaining count", () => {
    expect(getRemainingChars(5, 10)).toBe(5);
  });
  it("getRemainingChars returns 0 if input >= target", () => {
    expect(getRemainingChars(15, 10)).toBe(0);
  });
});

describe("typing-practice test state machine", () => {
  it("initTestState returns idle", () => {
    const s = initTestState();
    expect(s.state).toBe("idle");
    expect(s.startedAt).toBeNull();
    expect(s.endedAt).toBeNull();
  });
  it("startTest transitions idle → running", () => {
    const s = startTest(initTestState(), 1000);
    expect(s.state).toBe("running");
    expect(s.startedAt).toBe(1000);
  });
  it("startTest is no-op if already running", () => {
    const running = startTest(initTestState(), 1000);
    const s = startTest(running, 2000);
    expect(s).toBe(running);
  });
  it("finishTest transitions running → finished", () => {
    const running = startTest(initTestState(), 1000);
    const s = finishTest(running, 5000);
    expect(s.state).toBe("finished");
    expect(s.endedAt).toBe(5000);
  });
  it("finishTest is no-op if already finished", () => {
    const finished = finishTest(startTest(initTestState(), 1000), 5000);
    const s = finishTest(finished, 6000);
    expect(s).toBe(finished);
  });
  it("resetTest returns to idle", () => {
    const finished = finishTest(startTest(initTestState(), 1000), 5000);
    const s = resetTest();
    expect(s.state).toBe("idle");
    expect(s).not.toBe(finished);
  });
  it("isFinished / isRunning", () => {
    expect(isFinished(initTestState())).toBe(false);
    expect(isRunning(initTestState())).toBe(false);
    expect(isRunning(startTest(initTestState()))).toBe(true);
    expect(isFinished(finishTest(startTest(initTestState())))).toBe(true);
  });
  it("computeDuration returns 0 if not started", () => {
    expect(computeDuration(initTestState(), 5000)).toBe(0);
  });
  it("computeDuration returns elapsed since start if running", () => {
    const running = startTest(initTestState(), 1000);
    expect(computeDuration(running, 5000)).toBe(4000);
  });
  it("computeDuration returns end - start if finished", () => {
    const finished = finishTest(startTest(initTestState(), 1000), 5000);
    expect(computeDuration(finished, 9999)).toBe(4000);
  });
});

describe("typing-practice renderers", () => {
  it("renderTextReport includes all stats", () => {
    const r = makeResult({ wpm: 65, accuracy: 92 });
    const t = renderTextReport(r);
    expect(t).toContain("Typing Test Result");
    expect(t).toContain("Gross WPM: 65");
    expect(t).toContain("Accuracy: 92%");
    expect(t).toContain("Errors: 3");
  });
  it("renderCsv has header + rows", () => {
    const csv = renderCsv([makeResult({ id: "r1" }), makeResult({ id: "r2" })]);
    expect(csv.split("\n")[0]).toBe("test_id,ts,wpm,net_wpm,accuracy,errors,duration_ms,mode,text_type");
    expect(csv.split("\n").length).toBe(3);
    expect(csv).toContain("r1");
    expect(csv).toContain("r2");
  });
  it("renderCsv escapes commas/quotes", () => {
    const csv = renderCsv([makeResult({ id: 'has,comma' })]);
    expect(csv).toContain('"has,comma"');
  });
  it("renderSummaryText includes summary stats", () => {
    const stats = computeSummaryStats([makeResult({ wpm: 50 }), makeResult({ wpm: 70 })]);
    const t = renderSummaryText(stats);
    expect(t).toContain("Total tests: 2");
    expect(t).toContain("Best WPM: 70");
    expect(t).toContain("Average WPM: 60");
  });
});

describe("typing-practice computeSummaryStats", () => {
  it("returns zeros for empty input", () => {
    const s = computeSummaryStats([]);
    expect(s.totalTests).toBe(0);
    expect(s.bestWpm).toBe(0);
    expect(s.avgWpm).toBe(0);
  });
  it("computes best/avg/total across multiple results", () => {
    const s = computeSummaryStats([
      makeResult({ wpm: 40, netWpm: 38, accuracy: 90, errors: 5, durationMs: 60_000 }),
      makeResult({ wpm: 60, netWpm: 58, accuracy: 95, errors: 3, durationMs: 60_000 }),
      makeResult({ wpm: 50, netWpm: 48, accuracy: 92, errors: 4, durationMs: 60_000 }),
    ]);
    expect(s.totalTests).toBe(3);
    expect(s.bestWpm).toBe(60);
    expect(s.avgWpm).toBe(50);
    expect(s.avgAccuracy).toBe(92.3);
    expect(s.totalErrors).toBe(12);
    expect(s.totalDurationMs).toBe(180_000);
  });
  it("recentTrend returns last 10 in oldest→newest order", () => {
    // Build results in newest→first order (as history.loadHistory returns them).
    // The most recent (highest WPM) is first; trend should show oldest→newest of first 10.
    const results: TypingResult[] = [];
    for (let i = 15; i >= 1; i--) {
      results.push(makeResult({ id: `r${i}`, wpm: i * 10 }));
    }
    const s = computeSummaryStats(results);
    // results are newest first; trend should be oldest→newest of first 10 = results 6..15 (WPM 60..150)
    expect(s.recentTrend).toEqual([60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
  });
});

describe("typing-practice history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "timed-1min", textType: "common-words", wpm: 50, accuracy: 95, errors: 3, durationMs: 60_000 });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].wpm).toBe(50);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "timed-1min", textType: "common-words", wpm: i, accuracy: 90, errors: 1, durationMs: 60_000 });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "timed-1min", textType: "common-words", wpm: 50, accuracy: 95, errors: 3, durationMs: 60_000 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("typing-practice shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      settings: {
        practiceMode: "word-count",
        textType: "quotes",
        customText: "",
        wordCount: 30,
        caseSensitive: true,
      },
    });
    expect(url).toContain("mode=word-count");
    expect(url).toContain("type=quotes");
    expect(url).toContain("count=30");
    expect(url).toContain("case=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("mode=word-count&type=quotes&count=30&case=1");
    expect(parsed.settings.practiceMode).toBe("word-count");
    expect(parsed.settings.textType).toBe("quotes");
    expect(parsed.settings.wordCount).toBe(30);
    expect(parsed.settings.caseSensitive).toBe(true);
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  });
  it("falls back to defaults for unknown mode/type", () => {
    const parsed = parseShareUrl("mode=invalid&type=invalid");
    expect(parsed.settings.practiceMode).toBe(DEFAULT_SETTINGS.practiceMode);
    expect(parsed.settings.textType).toBe(DEFAULT_SETTINGS.textType);
  });
  it("includes custom text in URL when present", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      settings: { practiceMode: "custom-text", textType: "custom", customText: "hello world", wordCount: 50, caseSensitive: false },
    });
    expect(url).toContain("text=hello+world");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = PracticeMode | TextType | Settings;
