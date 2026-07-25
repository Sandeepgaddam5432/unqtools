/**
 * Math Drill Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generate, generateProblem, checkAnswer, toText, withAnswers } from "./logic";

describe("math-drill generate", () => {
  it("generates the requested number of problems", () => {
    const r = generate({ operation: "add", difficulty: "easy", count: 10 });
    expect(r.problems).toHaveLength(10);
  });
  it("clamps count to [1, 100]", () => {
    const r1 = generate({ operation: "add", difficulty: "easy", count: 0 });
    expect(r1.count).toBe(1);
    const r2 = generate({ operation: "add", difficulty: "easy", count: 999 });
    expect(r2.count).toBe(100);
  });
  it("is deterministic with the same seed", () => {
    const a = generate({ operation: "mul", difficulty: "medium", count: 5, seed: 42 });
    const b = generate({ operation: "mul", difficulty: "medium", count: 5, seed: 42 });
    expect(a.problems).toEqual(b.problems);
  });
});

describe("math-drill problem generation", () => {
  it("addition answers are sums", () => {
    const r = generate({ operation: "add", difficulty: "easy", count: 5, seed: 1 });
    for (const p of r.problems) {
      expect(p.answer).toBe(p.a + p.b);
      expect(p.op).toBe("add");
    }
  });
  it("subtraction answers are non-negative for easy/medium", () => {
    const r = generate({ operation: "sub", difficulty: "easy", count: 10, seed: 2 });
    for (const p of r.problems) {
      expect(p.answer).toBeGreaterThanOrEqual(0);
    }
  });
  it("multiplication answers are products", () => {
    const r = generate({ operation: "mul", difficulty: "medium", count: 5, seed: 3 });
    for (const p of r.problems) {
      expect(p.answer).toBe(p.a * p.b);
    }
  });
  it("division answers are integers", () => {
    const r = generate({ operation: "div", difficulty: "medium", count: 10, seed: 4 });
    for (const p of r.problems) {
      expect(Number.isInteger(p.answer)).toBe(true);
      expect(p.answer).toBe(p.a / p.b);
    }
  });
  it("mixed operation produces varied problems", () => {
    const r = generate({ operation: "mixed", difficulty: "hard", count: 30, seed: 5 });
    const ops = new Set(r.problems.map((p) => p.op));
    expect(ops.size).toBeGreaterThan(1);
  });
});

describe("math-drill checkAnswer", () => {
  it("returns true for correct answer", () => {
    const p = generate({ operation: "add", difficulty: "easy", count: 1, seed: 7 }).problems[0]!;
    expect(checkAnswer(p, p.answer)).toBe(true);
  });
  it("returns false for incorrect answer", () => {
    const p = generate({ operation: "add", difficulty: "easy", count: 1, seed: 7 }).problems[0]!;
    expect(checkAnswer(p, p.answer + 1)).toBe(false);
  });
});

describe("math-drill exports", () => {
  it("toText lists problems", () => {
    const r = generate({ operation: "add", difficulty: "easy", count: 3, seed: 1 });
    const text = toText(r);
    expect(text).toContain("1.");
    expect(text).toContain("2.");
    expect(text).toContain("3.");
  });
  it("withAnswers includes answers", () => {
    const r = generate({ operation: "add", difficulty: "easy", count: 1, seed: 1 });
    const text = withAnswers(r);
    expect(text).toContain("→");
    expect(text).toContain(String(r.problems[0]!.answer));
  });
});
