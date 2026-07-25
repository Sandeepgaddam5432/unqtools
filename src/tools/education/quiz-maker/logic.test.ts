/**
 * Quiz Maker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { newQuestion, gradeQuiz, validateQuiz, shuffle, toCsv, type Quiz } from "./logic";

const sampleQuiz: Quiz = {
  id: "quiz-1",
  title: "Sample Quiz",
  questions: [
    newQuestion("2 + 2?", ["3", "4", "5"], 1, 1),
    newQuestion("Capital of France?", ["Berlin", "Madrid", "Paris"], 2, 2),
    newQuestion("H2O is?", ["Water", "Salt", "Sugar"], 0, 1),
  ],
};

describe("quiz newQuestion", () => {
  it("creates a question with an id", () => {
    const q = newQuestion("Test?", ["a", "b"], 0);
    expect(q.id).toBeTruthy();
    expect(q.prompt).toBe("Test?");
    expect(q.choices).toEqual(["a", "b"]);
    expect(q.correctIndex).toBe(0);
    expect(q.points).toBe(1);
  });
});

describe("quiz gradeQuiz", () => {
  it("scores a perfect attempt", () => {
    const answers: Record<string, number> = {
      [sampleQuiz.questions[0].id]: 1,
      [sampleQuiz.questions[1].id]: 2,
      [sampleQuiz.questions[2].id]: 0,
    };
    const r = gradeQuiz(sampleQuiz, answers);
    expect(r.correct).toBe(3);
    expect(r.answered).toBe(3);
    expect(r.earnedPoints).toBe(4);
    expect(r.scorePct).toBe(100);
    expect(r.grade).toBe("A");
  });
  it("scores 0 for all-wrong answers", () => {
    const answers: Record<string, number> = {
      [sampleQuiz.questions[0].id]: 0,
      [sampleQuiz.questions[1].id]: 0,
      [sampleQuiz.questions[2].id]: 1,
    };
    const r = gradeQuiz(sampleQuiz, answers);
    expect(r.correct).toBe(0);
    expect(r.scorePct).toBe(0);
    expect(r.grade).toBe("F");
  });
  it("handles partial answers (skipped questions)", () => {
    const answers: Record<string, number> = {
      [sampleQuiz.questions[0].id]: 1,
    };
    const r = gradeQuiz(sampleQuiz, answers);
    expect(r.answered).toBe(1);
    expect(r.correct).toBe(1);
    expect(r.scorePct).toBe(25); // 1 of 4 points
  });
  it("handles empty answers", () => {
    const r = gradeQuiz(sampleQuiz, {});
    expect(r.answered).toBe(0);
    expect(r.scorePct).toBe(0);
  });
  it("assigns correct grade based on percentage", () => {
    const quiz: Quiz = { id: "x", title: "T", questions: [newQuestion("q", ["a", "b"], 0, 10)] };
    const r = gradeQuiz(quiz, { [quiz.questions[0].id]: 0 });
    expect(r.grade).toBe("A");
    const r2 = gradeQuiz(quiz, { [quiz.questions[0].id]: 1 });
    expect(r2.grade).toBe("F");
  });
});

describe("quiz validateQuiz", () => {
  it("passes for a valid quiz", () => {
    expect(validateQuiz(sampleQuiz)).toEqual([]);
  });
  it("reports missing title", () => {
    const r = validateQuiz({ ...sampleQuiz, title: "" });
    expect(r.some((e) => e.includes("title"))).toBe(true);
  });
  it("reports empty questions array", () => {
    const r = validateQuiz({ ...sampleQuiz, questions: [] });
    expect(r.some((e) => e.includes("at least one"))).toBe(true);
  });
  it("reports out-of-range correctIndex", () => {
    const r = validateQuiz({ ...sampleQuiz, questions: [{ ...sampleQuiz.questions[0]!, correctIndex: 99 }] });
    expect(r.some((e) => e.includes("correctIndex"))).toBe(true);
  });
});

describe("quiz shuffle", () => {
  it("preserves elements", () => {
    const a = [1, 2, 3, 4, 5];
    const s = shuffle(a);
    expect(s.sort()).toEqual(a);
  });
  it("returns a new array", () => {
    const a = [1, 2, 3];
    const s = shuffle(a);
    expect(s).not.toBe(a);
  });
});

describe("quiz toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(sampleQuiz);
    expect(csv.split("\n")[0]).toBe("id,prompt,choices,correctIndex,points");
    expect(csv).toContain("2 + 2?");
  });
});
