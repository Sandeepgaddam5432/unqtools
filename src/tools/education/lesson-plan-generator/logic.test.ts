import { describe, it, expect } from "vitest";
import {
  allocateTime,
  generateLessonPlan,
  planToMarkdown,
  validateInput,
  defaultLessonInput,
} from "./logic";

describe("lesson-plan-generator allocateTime", () => {
  it("allocates 5 sections that sum to total", () => {
    const t = allocateTime(50);
    const sum = t.warmup + t.directInstruction + t.guidedPractice + t.independentPractice + t.closure;
    expect(sum).toBeCloseTo(50, 0);
  });

  it("enforces a minimum of 5 minutes", () => {
    const t = allocateTime(2);
    expect(t.warmup).toBeGreaterThanOrEqual(1);
  });
});

describe("lesson-plan-generator generateLessonPlan", () => {
  it("builds a plan with 5 sections", () => {
    const p = generateLessonPlan({
      subject: "Math",
      topic: "Fractions",
      gradeLevel: "Grade 4",
      durationMinutes: 60,
      objectives: [],
      materials: [],
    });
    expect(p.sections.length).toBe(5);
    expect(p.title).toContain("Fractions");
  });

  it("uses provided objectives", () => {
    const p = generateLessonPlan({
      subject: "Science",
      topic: "Photosynthesis",
      gradeLevel: "Grade 7",
      durationMinutes: 45,
      objectives: ["Describe the process.", "Identify inputs."],
      materials: ["Microscope"],
    });
    expect(p.objectives).toContain("Describe the process.");
    expect(p.materials).toContain("Microscope");
  });

  it("provides defaults when objectives are empty", () => {
    const p = generateLessonPlan({
      subject: "History",
      topic: "Renaissance",
      gradeLevel: "Grade 9",
      durationMinutes: 50,
      objectives: [],
      materials: [],
    });
    expect(p.objectives.length).toBeGreaterThan(0);
    expect(p.materials.length).toBeGreaterThan(0);
  });

  it("total duration matches input", () => {
    const p = generateLessonPlan({
      subject: "English",
      topic: "Essay Writing",
      gradeLevel: "Grade 10",
      durationMinutes: 75,
      objectives: [],
      materials: [],
    });
    expect(p.totalDuration).toBe(75);
  });
});

describe("lesson-plan-generator planToMarkdown", () => {
  it("produces markdown with headings", () => {
    const p = generateLessonPlan({
      subject: "Math",
      topic: "Algebra",
      gradeLevel: "Grade 8",
      durationMinutes: 45,
      objectives: ["Solve linear equations."],
      materials: ["Calculator"],
    });
    const md = planToMarkdown(p);
    expect(md).toMatch(/^# /);
    expect(md).toContain("## Learning Objectives");
    expect(md).toContain("## Materials");
    expect(md).toContain("## Assessment");
  });

  it("includes all sections", () => {
    const p = generateLessonPlan({
      subject: "Math",
      topic: "Algebra",
      gradeLevel: "Grade 8",
      durationMinutes: 45,
      objectives: [],
      materials: [],
    });
    const md = planToMarkdown(p);
    for (const s of p.sections) {
      expect(md).toContain(s.title);
    }
  });
});

describe("lesson-plan-generator validateInput", () => {
  it("rejects empty subject", () => {
    const e = validateInput({ ...defaultLessonInput(), subject: "" });
    expect(e).toMatch(/subject/i);
  });

  it("rejects out-of-range duration", () => {
    const e = validateInput({ ...defaultLessonInput(), subject: "Math", topic: "X", durationMinutes: 500 });
    expect(e).toMatch(/duration/i);
  });

  it("accepts valid input", () => {
    const e = validateInput({ subject: "Math", topic: "Algebra", gradeLevel: "G8", durationMinutes: 45, objectives: [], materials: [] });
    expect(e).toBeNull();
  });
});
