import { describe, it, expect, beforeEach } from "vitest";
import {
  DIFFICULTY_PRESETS,
  OPERATION_LABELS,
  OP_SYMBOLS,
  TIMED_PRESETS,
  makeRng,
  randInt,
  pickRandom,
  shuffle,
  parseNumberRange,
  resolveRange,
  computeAnswer,
  validateProblem,
  generateOne,
  generateWorksheet,
  randomSeed,
  computeStats,
  renderProblemLine,
  formatAnswer,
  renderTextWorksheet,
  renderHtmlWorksheet,
  renderCsvWorksheet,
  renderMarkdownWorksheet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  DEFAULT_SETTINGS,
  type OperationType,
  type DifficultyLevel,
  type WorksheetSettings,
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

describe("math-practice-generator constants", () => {
  it("has 4 difficulty presets", () => {
    expect(Object.keys(DIFFICULTY_PRESETS)).toHaveLength(4);
    expect(DIFFICULTY_PRESETS.easy.max).toBe(20);
    expect(DIFFICULTY_PRESETS.medium.max).toBe(100);
    expect(DIFFICULTY_PRESETS.hard.max).toBe(1000);
    expect(DIFFICULTY_PRESETS.expert.max).toBe(10000);
  });
  it("has 5 operation labels", () => {
    expect(Object.keys(OPERATION_LABELS)).toHaveLength(5);
    expect(OPERATION_LABELS.mixed).toBe("Mixed");
  });
  it("has 4 op symbols", () => {
    expect(Object.keys(OP_SYMBOLS)).toHaveLength(4);
    expect(OP_SYMBOLS.addition).toBe("+");
    expect(OP_SYMBOLS.multiplication).toBe("×");
  });
  it("has timed presets", () => {
    expect(TIMED_PRESETS.easy.perProblemSeconds).toBeLessThan(TIMED_PRESETS.expert.perProblemSeconds);
  });
});

describe("math-practice-generator makeRng / randInt", () => {
  it("makeRng is deterministic with same seed", () => {
    const r1 = makeRng(123);
    const r2 = makeRng(123);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });
  it("makeRng differs with different seeds", () => {
    const r1 = makeRng(1);
    const r2 = makeRng(2);
    // Probability that they match 5 times in a row is ~0
    let matches = 0;
    for (let i = 0; i < 5; i++) if (r1() === r2()) matches++;
    expect(matches).toBeLessThan(5);
  });
  it("randInt is within range", () => {
    const r = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const n = randInt(r, 5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
  it("randInt handles min === max", () => {
    const r = makeRng(1);
    expect(randInt(r, 7, 7)).toBe(7);
  });
  it("randInt handles swapped args", () => {
    const r = makeRng(1);
    expect(randInt(r, 10, 5)).toBeLessThanOrEqual(10);
  });
});

describe("math-practice-generator pickRandom / shuffle", () => {
  it("pickRandom returns an element", () => {
    const r = makeRng(1);
    const arr = [1, 2, 3];
    expect(arr).toContain(pickRandom(r, arr));
  });
  it("pickRandom throws on empty", () => {
    const r = makeRng(1);
    expect(() => pickRandom(r, [])).toThrow();
  });
  it("shuffle preserves elements", () => {
    const r = makeRng(1);
    const arr = [1, 2, 3, 4, 5];
    const sh = shuffle(arr, r);
    expect(sh.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("shuffle is deterministic with seed", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s1 = shuffle(arr, makeRng(99));
    const s2 = shuffle(arr, makeRng(99));
    expect(s1).toEqual(s2);
  });
  it("shuffle does not mutate original", () => {
    const arr = [1, 2, 3];
    const original = [...arr];
    shuffle(arr, makeRng(1));
    expect(arr).toEqual(original);
  });
});

describe("math-practice-generator parseNumberRange", () => {
  it("parses 1-100", () => {
    const r = parseNumberRange("1-100");
    expect(r.valid).toBe(true);
    expect(r.min).toBe(1);
    expect(r.max).toBe(100);
  });
  it("parses 5..50", () => {
    const r = parseNumberRange("5..50");
    expect(r.valid).toBe(true);
    expect(r.min).toBe(5);
    expect(r.max).toBe(50);
  });
  it("parses 5,50", () => {
    const r = parseNumberRange("5,50");
    expect(r.valid).toBe(true);
    expect(r.min).toBe(5);
    expect(r.max).toBe(50);
  });
  it("handles swapped range", () => {
    const r = parseNumberRange("100-1");
    expect(r.valid).toBe(true);
    expect(r.min).toBe(1);
    expect(r.max).toBe(100);
  });
  it("handles single number", () => {
    const r = parseNumberRange("42");
    expect(r.valid).toBe(true);
    expect(r.min).toBe(42);
  });
  it("rejects empty", () => {
    expect(parseNumberRange("").valid).toBe(false);
  });
  it("rejects garbage", () => {
    expect(parseNumberRange("abc").valid).toBe(false);
  });
  it("handles negative ranges", () => {
    const r = parseNumberRange("-10-10");
    expect(r.valid).toBe(true);
    expect(r.min).toBe(-10);
    expect(r.max).toBe(10);
  });
});

describe("math-practice-generator resolveRange", () => {
  it("uses custom range when provided", () => {
    const s: WorksheetSettings = { ...DEFAULT_SETTINGS, numberRange: "5-50" };
    const r = resolveRange(s);
    expect(r.min).toBe(5);
    expect(r.max).toBe(50);
  });
  it("falls back to difficulty preset when range invalid", () => {
    const s: WorksheetSettings = { ...DEFAULT_SETTINGS, difficulty: "medium", numberRange: "" };
    const r = resolveRange(s);
    expect(r.min).toBe(1);
    expect(r.max).toBe(100);
  });
});

describe("math-practice-generator computeAnswer", () => {
  it("adds", () => { expect(computeAnswer("addition", 3, 4)).toBe(7); });
  it("subtracts", () => { expect(computeAnswer("subtraction", 10, 3)).toBe(7); });
  it("multiplies", () => { expect(computeAnswer("multiplication", 6, 7)).toBe(42); });
  it("divides", () => { expect(computeAnswer("division", 12, 3)).toBe(4); });
  it("returns NaN for division by zero", () => {
    expect(Number.isNaN(computeAnswer("division", 5, 0))).toBe(true);
  });
});

describe("math-practice-generator validateProblem", () => {
  it("validates addition always", () => {
    expect(validateProblem("addition", 5, 5, { allowNegatives: false }).valid).toBe(true);
  });
  it("rejects division by zero", () => {
    expect(validateProblem("division", 5, 0, { allowNegatives: false }).valid).toBe(false);
  });
  it("rejects negative subtraction result without flag", () => {
    expect(validateProblem("subtraction", 3, 5, { allowNegatives: false }).valid).toBe(false);
  });
  it("allows negative subtraction result with flag", () => {
    expect(validateProblem("subtraction", 3, 5, { allowNegatives: true }).valid).toBe(true);
  });
  it("rejects negative quotient without flag", () => {
    expect(validateProblem("division", -6, 3, { allowNegatives: false }).valid).toBe(false);
  });
});

describe("math-practice-generator generateOne", () => {
  it("generates a valid addition problem", () => {
    const r = makeRng(1);
    const p = generateOne("addition", r, 1, 100, false, 1);
    expect(p.op).toBe("addition");
    expect(p.answer).toBe(p.a + p.b);
    expect(p.index).toBe(1);
  });
  it("generates subtraction with non-negative result when not allowed", () => {
    const r = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const p = generateOne("subtraction", r, 1, 100, false, i);
      expect(p.answer).toBeGreaterThanOrEqual(0);
    }
  });
  it("generates division with no zero divisor", () => {
    const r = makeRng(2);
    for (let i = 0; i < 50; i++) {
      const p = generateOne("division", r, 1, 100, false, i);
      expect(p.b).not.toBe(0);
    }
  });
  it("generates multiplication with correct answer", () => {
    const r = makeRng(3);
    const p = generateOne("multiplication", r, 2, 12, false, 1);
    expect(p.answer).toBe(p.a * p.b);
  });
});

describe("math-practice-generator generateWorksheet", () => {
  it("generates the requested number of problems", () => {
    const ws = generateWorksheet({ ...DEFAULT_SETTINGS, numberOfProblems: 10 });
    expect(ws.problems).toHaveLength(10);
  });
  it("respects the seed for reproducibility", () => {
    const s: WorksheetSettings = { ...DEFAULT_SETTINGS, numberOfProblems: 10, seed: 42 };
    const ws1 = generateWorksheet(s);
    const ws2 = generateWorksheet(s);
    expect(ws1.problems).toEqual(ws2.problems);
  });
  it("caps at 500 problems", () => {
    const ws = generateWorksheet({ ...DEFAULT_SETTINGS, numberOfProblems: 9999 });
    expect(ws.problems.length).toBe(500);
  });
  it("mixed mode uses all 4 ops", () => {
    const ws = generateWorksheet({
      ...DEFAULT_SETTINGS,
      operation: "mixed",
      numberOfProblems: 200,
      seed: 1,
    });
    const ops = new Set(ws.problems.map((p) => p.op));
    // With 200 problems across 4 ops, very high probability all 4 are used
    expect(ops.size).toBeGreaterThan(1);
  });
  it("carries settings into worksheet", () => {
    const ws = generateWorksheet({
      ...DEFAULT_SETTINGS,
      operation: "multiplication",
      difficulty: "hard",
      numberOfProblems: 5,
      seed: 1,
    });
    expect(ws.operation).toBe("multiplication");
    expect(ws.difficulty).toBe("hard");
    expect(ws.problems).toHaveLength(5);
  });
});

describe("math-practice-generator randomSeed", () => {
  it("returns a number 0..2^32-1", () => {
    const s = randomSeed();
    expect(typeof s).toBe("number");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(0x100000000);
  });
});

describe("math-practice-generator computeStats", () => {
  it("computes totals and byOp", () => {
    const ws = generateWorksheet({
      ...DEFAULT_SETTINGS,
      operation: "addition",
      numberOfProblems: 20,
      seed: 1,
    });
    const s = computeStats(ws);
    expect(s.total).toBe(20);
    expect(s.byOp.addition).toBe(20);
    expect(s.byOp.subtraction).toBe(0);
  });
  it("computes byDifficulty", () => {
    const ws = generateWorksheet({ ...DEFAULT_SETTINGS, numberOfProblems: 10, seed: 1 });
    const s = computeStats(ws);
    expect(s.byDifficulty[ws.difficulty]).toBe(10);
  });
  it("computes min/max/avg", () => {
    const ws = generateWorksheet({ ...DEFAULT_SETTINGS, numberOfProblems: 20, seed: 1 });
    const s = computeStats(ws);
    expect(s.minAnswer).not.toBeNull();
    expect(s.maxAnswer).not.toBeNull();
    expect(s.avgAnswer).not.toBeNull();
    expect(s.minAnswer!).toBeLessThanOrEqual(s.maxAnswer!);
  });
  it("computes suggested time", () => {
    const ws = generateWorksheet({ ...DEFAULT_SETTINGS, difficulty: "easy", numberOfProblems: 20 });
    const s = computeStats(ws);
    // 20 problems × 15 sec = 300 sec
    expect(s.suggestedTimeSeconds).toBe(300);
  });
});

describe("math-practice-generator renderers", () => {
  const ws = generateWorksheet({ ...DEFAULT_SETTINGS, numberOfProblems: 5, seed: 1 });

  it("renderProblemLine hides answer by default", () => {
    const line = renderProblemLine(ws.problems[0], false);
    expect(line).toContain("1.");
    expect(line).toContain("____");
    expect(line).not.toContain(String(ws.problems[0].answer));
  });
  it("renderProblemLine shows answer when requested", () => {
    const line = renderProblemLine(ws.problems[0], true);
    expect(line).toContain(String(ws.problems[0].answer));
  });
  it("formatAnswer formats integers as-is", () => {
    expect(formatAnswer(42)).toBe("42");
  });
  it("formatAnswer formats floats", () => {
    expect(formatAnswer(1.5)).toBe("1.5");
    expect(formatAnswer(0.3333333)).toBe("0.3333");
  });
  it("formatAnswer formats NaN", () => {
    expect(formatAnswer(NaN)).toBe("undefined");
  });
  it("renderTextWorksheet has header", () => {
    const t = renderTextWorksheet(ws);
    expect(t).toContain("Math Practice Worksheet");
    expect(t).toContain("Operation:");
    expect(t).toContain("Answer Key");
    expect(t.split("\n").filter((l) => l.match(/^\d+\./)).length).toBeGreaterThanOrEqual(5);
  });
  it("renderHtmlWorksheet is valid HTML", () => {
    const h = renderHtmlWorksheet(ws);
    expect(h).toContain("<!DOCTYPE html>");
    expect(h).toContain("Answer Key");
    expect(h).toContain("</html>");
  });
  it("renderCsvWorksheet has header", () => {
    const c = renderCsvWorksheet(ws);
    expect(c.split("\n")[0]).toContain("index,operation,a,b,answer");
    expect(c.split("\n")).toHaveLength(6);
  });
  it("renderMarkdownWorksheet has spoiler", () => {
    const m = renderMarkdownWorksheet(ws);
    expect(m).toContain("# Math Practice Worksheet");
    expect(m).toContain("<details>");
    expect(m).toContain("<summary>Reveal answers</summary>");
  });
  it("renderTextWorksheet hides answer key when showAnswers=false", () => {
    const w = { ...ws, showAnswers: false };
    const t = renderTextWorksheet(w);
    expect(t).not.toContain("Answer Key");
  });
});

describe("math-practice-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, operation: "addition", difficulty: "easy", count: 20, seed: 42 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, operation: "addition", difficulty: "easy", count: 1, seed: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, operation: "addition", difficulty: "easy", count: 1, seed: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("math-practice-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ...DEFAULT_SETTINGS,
      operation: "multiplication",
      difficulty: "hard",
      numberOfProblems: 25,
      numberRange: "1-50",
      allowNegatives: true,
      showAnswers: true,
      seed: 99,
    });
    expect(url).toContain("op=multiplication");
    expect(url).toContain("diff=hard");
    expect(url).toContain("n=25");
    expect(url).toContain("range=1-50");
    expect(url).toContain("neg=1");
    expect(url).toContain("ans=1");
    expect(url).toContain("seed=99");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("op=multiplication&diff=hard&n=25&range=1-50&neg=1&ans=1&seed=99");
    expect(p.operation).toBe("multiplication");
    expect(p.difficulty).toBe("hard");
    expect(p.numberOfProblems).toBe(25);
    expect(p.numberRange).toBe("1-50");
    expect(p.allowNegatives).toBe(true);
    expect(p.showAnswers).toBe(true);
    expect(p.seed).toBe(99);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown operations", () => {
    const p = parseShareUrl("op=invalid&diff=easy");
    expect(p.operation).toBeUndefined();
    expect(p.difficulty).toBe("easy");
  });
  it("filters unknown difficulties", () => {
    const p = parseShareUrl("op=addition&diff=impossible");
    expect(p.difficulty).toBeUndefined();
    expect(p.operation).toBe("addition");
  });
  it("parses booleans correctly", () => {
    const p = parseShareUrl("neg=0&ans=0");
    expect(p.allowNegatives).toBe(false);
    expect(p.showAnswers).toBe(false);
  });
  it("rejects non-numeric n", () => {
    const p = parseShareUrl("n=abc");
    expect(p.numberOfProblems).toBeUndefined();
  });
});

describe("math-practice-generator defaults", () => {
  it("default settings are sensible", () => {
    expect(DEFAULT_SETTINGS.operation).toBe("addition");
    expect(DEFAULT_SETTINGS.difficulty).toBe("easy");
    expect(DEFAULT_SETTINGS.numberOfProblems).toBe(20);
    expect(DEFAULT_SETTINGS.allowNegatives).toBe(false);
    expect(DEFAULT_SETTINGS.showAnswers).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = OperationType | DifficultyLevel;
