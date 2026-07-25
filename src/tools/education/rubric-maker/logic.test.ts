import { describe, it, expect } from "vitest";
import {
  defaultLevels,
  makeCriterion,
  validateRubric,
  computeTotalPoints,
  scoreRubric,
  rubricToMarkdown,
  rubricToCsv,
  type Rubric,
} from "./logic";

const sampleRubric: Rubric = {
  title: "Essay Rubric",
  totalPoints: 100,
  criteria: [
    {
      id: "c1",
      name: "Content",
      weight: 2,
      levels: [
        { label: "Excellent", points: 25, description: "Thorough, insightful." },
        { label: "Proficient", points: 20, description: "Adequate content." },
        { label: "Developing", points: 15, description: "Surface-level." },
        { label: "Beginning", points: 10, description: "Minimal content." },
      ],
    },
    {
      id: "c2",
      name: "Grammar",
      weight: 1,
      levels: [
        { label: "Excellent", points: 25, description: "No errors." },
        { label: "Proficient", points: 20, description: "Few errors." },
        { label: "Developing", points: 15, description: "Several errors." },
        { label: "Beginning", points: 10, description: "Many errors." },
      ],
    },
  ],
};

describe("rubric-maker defaultLevels", () => {
  it("creates 4 default levels", () => {
    const lv = defaultLevels(20);
    expect(lv.length).toBe(4);
    expect(lv[0].label).toBe("Excellent");
  });

  it("top level has full points", () => {
    const lv = defaultLevels(20);
    expect(lv[0].points).toBe(20);
  });

  it("points decrease across levels", () => {
    const lv = defaultLevels(20);
    for (let i = 1; i < lv.length; i++) {
      expect(lv[i].points).toBeLessThan(lv[i - 1].points);
    }
  });
});

describe("rubric-maker makeCriterion", () => {
  it("creates criterion with unique id", () => {
    const c = makeCriterion("Style", 25);
    expect(c.name).toBe("Style");
    expect(c.id).toMatch(/^crit-/);
    expect(c.levels.length).toBe(4);
  });
});

describe("rubric-maker validateRubric", () => {
  it("accepts a valid rubric", () => {
    expect(validateRubric(sampleRubric)).toBeNull();
  });

  it("rejects empty title", () => {
    expect(validateRubric({ ...sampleRubric, title: "" })).not.toBeNull();
  });

  it("rejects no criteria", () => {
    expect(validateRubric({ title: "X", totalPoints: 0, criteria: [] })).not.toBeNull();
  });

  it("rejects negative level points", () => {
    const r = { ...sampleRubric, criteria: [{ ...sampleRubric.criteria[0], levels: [{ label: "Bad", points: -1, description: "" }, { label: "OK", points: 1, description: "" }] }] };
    expect(validateRubric(r)).not.toBeNull();
  });

  it("rejects criterion with < 2 levels", () => {
    const r = { ...sampleRubric, criteria: [{ ...sampleRubric.criteria[0], levels: [{ label: "Only", points: 10, description: "" }] }] };
    expect(validateRubric(r)).not.toBeNull();
  });
});

describe("rubric-maker computeTotalPoints", () => {
  it("sums weighted max level points", () => {
    // criterion 1: 25 * 2 = 50, criterion 2: 25 * 1 = 25 -> total 75
    expect(computeTotalPoints(sampleRubric.criteria)).toBe(75);
  });
});

describe("rubric-maker scoreRubric", () => {
  it("scores all excellent selections", () => {
    const r = scoreRubric(sampleRubric, [
      { criterionId: "c1", levelIndex: 0 },
      { criterionId: "c2", levelIndex: 0 },
    ]);
    expect(r.isValid).toBe(true);
    expect(r.earnedPoints).toBe(75);
    expect(r.percentage).toBeCloseTo(100, 5);
  });

  it("scores mixed selections", () => {
    const r = scoreRubric(sampleRubric, [
      { criterionId: "c1", levelIndex: 2 }, // 15 * 2 = 30
      { criterionId: "c2", levelIndex: 1 }, // 20 * 1 = 20
    ]);
    expect(r.earnedPoints).toBe(50);
    expect(r.percentage).toBeCloseTo((50 / 75) * 100, 5);
  });

  it("flags missing selection", () => {
    const r = scoreRubric(sampleRubric, [{ criterionId: "c1", levelIndex: 0 }]);
    expect(r.isValid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("flags invalid level index", () => {
    const r = scoreRubric(sampleRubric, [
      { criterionId: "c1", levelIndex: 99 },
      { criterionId: "c2", levelIndex: 0 },
    ]);
    expect(r.isValid).toBe(false);
  });
});

describe("rubric-maker rubricToMarkdown", () => {
  it("produces markdown table", () => {
    const md = rubricToMarkdown(sampleRubric);
    expect(md).toMatch(/^# Essay Rubric/);
    expect(md).toContain("| Criterion |");
    expect(md).toContain("Content");
  });

  it("handles empty criteria", () => {
    const md = rubricToMarkdown({ title: "Empty", totalPoints: 0, criteria: [] });
    expect(md).toContain("No criteria");
  });
});

describe("rubric-maker rubricToCsv", () => {
  it("produces CSV with header", () => {
    const csv = rubricToCsv(sampleRubric);
    expect(csv.split("\n")[0]).toBe("criterion,level,points,description");
    expect(csv.split("\n").length).toBeGreaterThan(2);
  });

  it("escapes quotes in descriptions", () => {
    const r: Rubric = {
      title: "X",
      totalPoints: 10,
      criteria: [{ id: "c1", name: "A", weight: 1, levels: [{ label: "Top", points: 10, description: 'say "hi"' }] }],
    };
    const csv = rubricToCsv(r);
    expect(csv).toContain('""hi""');
  });
});
