/**
 * Periodic Table Quiz — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  ELEMENTS,
  generateQuiz,
  scoreQuiz,
  gradeFor,
  resultToText,
  worksheetToText,
  answerKey,
  type QuizMode,
} from "./logic";

// Deterministic RNG for reproducible tests
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("ELEMENTS data", () => {
  it("contains H as the first element", () => {
    expect(ELEMENTS[0]!.symbol).toBe("H");
    expect(ELEMENTS[0]!.number).toBe(1);
  });
  it("contains at least 36 elements", () => {
    expect(ELEMENTS.length).toBeGreaterThanOrEqual(36);
  });
  it("has unique atomic numbers", () => {
    const numbers = ELEMENTS.map((e) => e.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("generateQuiz", () => {
  it("produces the requested number of questions", () => {
    const rng = makeRng(42);
    const q = generateQuiz(10, "symbol-to-name", rng);
    expect(q.length).toBe(10);
  });
  it("caps count to element pool size", () => {
    const q = generateQuiz(9999, "name-to-symbol");
    expect(q.length).toBeLessThanOrEqual(ELEMENTS.length);
  });
  it("each question has 4 options including the answer", () => {
    const q = generateQuiz(5, "number-to-symbol");
    for (const question of q) {
      expect(question.options.length).toBe(4);
      expect(question.options).toContain(question.answer);
    }
  });
  it("symbol-to-name mode asks for the element name", () => {
    const q = generateQuiz(1, "symbol-to-name");
    expect(q[0]!.prompt).toContain("name");
  });
  it("name-to-symbol mode asks for the symbol", () => {
    const q = generateQuiz(1, "name-to-symbol");
    expect(q[0]!.prompt).toContain("symbol");
  });
  it("number-to-symbol mode includes the atomic number in prompt", () => {
    const q = generateQuiz(1, "number-to-symbol");
    expect(q[0]!.prompt).toMatch(/\d+/);
  });
  it("assigns unique question ids", () => {
    const q = generateQuiz(8, "symbol-to-name");
    const ids = q.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("scoreQuiz", () => {
  it("scores a perfect result", () => {
    const q = generateQuiz(5, "symbol-to-name", makeRng(7));
    const answers = new Map<string, string>();
    for (const question of q) answers.set(question.id, question.answer);
    const r = scoreQuiz(q, answers);
    expect(r.correct).toBe(5);
    expect(r.incorrect).toBe(0);
    expect(r.percent).toBe(100);
    expect(r.grade).toBe("A");
  });
  it("scores a zero result", () => {
    const q = generateQuiz(5, "symbol-to-name", makeRng(7));
    const answers = new Map<string, string>();
    for (const question of q) answers.set(question.id, "__wrong__");
    const r = scoreQuiz(q, answers);
    expect(r.correct).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.grade).toBe("F");
  });
  it("handles partial credit", () => {
    const q = generateQuiz(4, "symbol-to-name", makeRng(7));
    const answers = new Map<string, string>();
    answers.set(q[0]!.id, q[0]!.answer);
    answers.set(q[1]!.id, q[1]!.answer);
    answers.set(q[2]!.id, "__wrong__");
    answers.set(q[3]!.id, "__wrong__");
    const r = scoreQuiz(q, answers);
    expect(r.correct).toBe(2);
    expect(r.incorrect).toBe(2);
    expect(r.percent).toBe(50);
  });
});

describe("gradeFor", () => {
  it("returns A for 90+", () => { expect(gradeFor(90)).toBe("A"); expect(gradeFor(100)).toBe("A"); });
  it("returns B for 80-89", () => { expect(gradeFor(80)).toBe("B"); expect(gradeFor(89)).toBe("B"); });
  it("returns C for 70-79", () => { expect(gradeFor(70)).toBe("C"); expect(gradeFor(79)).toBe("C"); });
  it("returns D for 60-69", () => { expect(gradeFor(60)).toBe("D"); expect(gradeFor(69)).toBe("D"); });
  it("returns F below 60", () => { expect(gradeFor(59)).toBe("F"); expect(gradeFor(0)).toBe("F"); });
});

describe("exports", () => {
  it("resultToText contains score and grade", () => {
    const q = generateQuiz(3, "symbol-to-name");
    const r = scoreQuiz(q, new Map());
    const text = resultToText(r);
    expect(text).toContain("Score");
    expect(text).toContain("Grade");
  });
  it("worksheetToText lists numbered questions", () => {
    const q = generateQuiz(3, "symbol-to-name");
    const text = worksheetToText(q);
    expect(text).toContain("1.");
    expect(text).toContain("A)");
  });
  it("answerKey lists the correct answers", () => {
    const q = generateQuiz(3, "symbol-to-name");
    const key = answerKey(q);
    expect(key).toContain("Answer Key");
    expect(key.split("\n").length).toBe(q.length + 1);
  });
});
