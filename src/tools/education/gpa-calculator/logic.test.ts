import { describe, it, expect } from "vitest";
import {
  letterToGradePoint,
  validateCourse,
  computeGpa,
  classifyGpa,
  makeEmptyCourse,
} from "./logic";

describe("gpa-calculator letterToGradePoint", () => {
  it("converts standard letters", () => {
    expect(letterToGradePoint("A")).toBe(4.0);
    expect(letterToGradePoint("B+")).toBe(3.3);
    expect(letterToGradePoint("C")).toBe(2.0);
    expect(letterToGradePoint("F")).toBe(0.0);
  });

  it("is case-insensitive", () => {
    expect(letterToGradePoint("a")).toBe(4.0);
    expect(letterToGradePoint("b+")).toBe(3.3);
  });

  it("returns -1 for unknown letter", () => {
    expect(letterToGradePoint("Z")).toBe(-1);
    expect(letterToGradePoint("")).toBe(-1);
  });
});

describe("gpa-calculator validateCourse", () => {
  it("rejects empty name", () => {
    expect(validateCourse({ name: "", credits: 3, gradePoint: 4.0, term: "T" })).not.toBeNull();
  });

  it("rejects non-positive credits", () => {
    expect(validateCourse({ name: "X", credits: 0, gradePoint: 4.0, term: "T" })).not.toBeNull();
  });

  it("rejects out-of-range grade point", () => {
    expect(validateCourse({ name: "X", credits: 3, gradePoint: 5.0, term: "T" })).not.toBeNull();
    expect(validateCourse({ name: "X", credits: 3, gradePoint: -0.1, term: "T" })).not.toBeNull();
  });

  it("accepts a valid course", () => {
    expect(validateCourse({ name: "Math", credits: 3, gradePoint: 3.7, term: "Fall 2024" })).toBeNull();
  });
});

describe("gpa-calculator computeGpa", () => {
  it("returns invalid for empty list", () => {
    const r = computeGpa([]);
    expect(r.isValid).toBe(false);
  });

  it("computes single-semester GPA", () => {
    const r = computeGpa([
      { name: "A", credits: 3, gradePoint: 4.0, term: "Fall 2024" },
      { name: "B", credits: 3, gradePoint: 3.0, term: "Fall 2024" },
    ]);
    expect(r.isValid).toBe(true);
    expect(r.cumulativeGpa).toBeCloseTo(3.5, 5);
    expect(r.cumulativeCredits).toBe(6);
  });

  it("weights by credits correctly", () => {
    const r = computeGpa([
      { name: "A", credits: 4, gradePoint: 4.0, term: "T" },
      { name: "B", credits: 1, gradePoint: 0.0, term: "T" },
    ]);
    // (4*4 + 1*0) / 5 = 3.2
    expect(r.cumulativeGpa).toBeCloseTo(3.2, 5);
  });

  it("groups by semester", () => {
    const r = computeGpa([
      { name: "A", credits: 3, gradePoint: 4.0, term: "Fall" },
      { name: "B", credits: 3, gradePoint: 3.0, term: "Spring" },
    ]);
    expect(r.semesters.length).toBe(2);
  });

  it("computes cumulative across semesters", () => {
    const r = computeGpa([
      { name: "A", credits: 3, gradePoint: 4.0, term: "Fall" },
      { name: "B", credits: 3, gradePoint: 3.0, term: "Spring" },
    ]);
    expect(r.cumulativeCredits).toBe(6);
    expect(r.cumulativeGpa).toBeCloseTo(3.5, 5);
  });

  it("returns error for invalid course", () => {
    const r = computeGpa([{ name: "", credits: 3, gradePoint: 4.0, term: "T" }]);
    expect(r.isValid).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe("gpa-calculator classifyGpa", () => {
  it("classifies high GPA as summa cum laude", () => {
    expect(classifyGpa(3.8).label).toBe("Summa cum laude");
  });

  it("classifies mid GPA as good standing", () => {
    expect(classifyGpa(2.5).label).toBe("Good standing");
  });

  it("classifies low GPA as probation", () => {
    expect(classifyGpa(1.5).label).toBe("Academic probation");
  });
});

describe("gpa-calculator makeEmptyCourse", () => {
  it("returns a course with default credits", () => {
    const c = makeEmptyCourse();
    expect(c.credits).toBe(3);
    expect(c.gradePoint).toBe(4.0);
  });
});
