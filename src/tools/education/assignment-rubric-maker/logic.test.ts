import { describe, it, expect } from "vitest";
import {
  createRubric,
  addCriterion,
  removeCriterion,
  updateCriterion,
  totalWeight,
  computeScore,
  letterGrade,
  gpaFromPercent,
  validateRubric,
  exportRubricCSV,
  exportRubricJSON,
  exportRubricText,
  rubricStats,
  bestLevels,
  worstLevels,
  percentFromRaw,
  presetRubric,
  type StudentScore,
} from "./logic";

function buildSample() {
  let r = createRubric("Test Rubric", "English", 100);
  r = addCriterion(r, "Thesis", "Clear thesis", 2);
  r = addCriterion(r, "Evidence", "Cites sources", 1);
  return r;
}

describe("assignment-rubric-maker createRubric", () => {
  it("creates empty rubric with title", () => {
    const r = createRubric("My Rubric");
    expect(r.title).toBe("My Rubric");
    expect(r.criteria).toEqual([]);
  });
  it("defaults title to Untitled", () => {
    expect(createRubric("").title).toBe("Untitled rubric");
  });
});

describe("assignment-rubric-maker addCriterion", () => {
  it("adds criterion with default 4 levels", () => {
    const r = buildSample();
    expect(r.criteria[0].levels.length).toBe(4);
  });
  it("respects custom weight", () => {
    const r = buildSample();
    expect(r.criteria[0].weight).toBe(2);
  });
});

describe("assignment-rubric-maker removeCriterion", () => {
  it("removes by id", () => {
    const r = buildSample();
    const id = r.criteria[0].id;
    const r2 = removeCriterion(r, id);
    expect(r2.criteria.length).toBe(1);
  });
});

describe("assignment-rubric-maker updateCriterion", () => {
  it("patches fields by id", () => {
    const r = buildSample();
    const id = r.criteria[0].id;
    const r2 = updateCriterion(r, id, { weight: 3 });
    expect(r2.criteria[0].weight).toBe(3);
  });
});

describe("assignment-rubric-maker totalWeight", () => {
  it("sums all weights", () => {
    const r = buildSample();
    expect(totalWeight(r)).toBe(3);
  });
});

describe("assignment-rubric-maker computeScore", () => {
  it("computes weighted score and percent", () => {
    const r = buildSample();
    // Thesis max=4, weight=2 → 8; Evidence max=4, weight=1 → 4. Total max=12.
    const selections: StudentScore[] = [
      { criterionId: r.criteria[0].id, selectedPoints: 4 },
      { criterionId: r.criteria[1].id, selectedPoints: 2 },
    ];
    const s = computeScore(r, selections);
    expect(s.weighted).toBe(4 * 2 + 2 * 1); // 10
    expect(s.maxPossible).toBe(4 * 2 + 4 * 1); // 12
    expect(s.percent).toBeCloseTo((10 / 12) * 100, 1);
  });
  it("returns 0 percent for empty rubric", () => {
    const r = createRubric("Empty");
    expect(computeScore(r, []).percent).toBe(0);
  });
});

describe("assignment-rubric-maker letterGrade", () => {
  it("returns A for 95%", () => {
    expect(letterGrade(95)).toBe("A");
  });
  it("returns B for 85%", () => {
    expect(letterGrade(85)).toBe("B");
  });
  it("returns F for 50%", () => {
    expect(letterGrade(50)).toBe("F");
  });
});

describe("assignment-rubric-maker gpaFromPercent", () => {
  it("returns 4.0 for 95%", () => {
    expect(gpaFromPercent(95)).toBe(4.0);
  });
  it("returns 0 for 50%", () => {
    expect(gpaFromPercent(50)).toBe(0);
  });
});

describe("assignment-rubric-maker validateRubric", () => {
  it("warns when no criteria", () => {
    const r = createRubric("Empty");
    expect(validateRubric(r).some((w) => w.includes("no criteria"))).toBe(true);
  });
  it("passes for valid rubric", () => {
    expect(validateRubric(buildSample())).toEqual([]);
  });
});

describe("assignment-rubric-maker exportRubricCSV", () => {
  it("has header plus one row per (criterion × level)", () => {
    const r = buildSample();
    const csv = exportRubricCSV(r);
    const lines = csv.split("\n");
    expect(lines.length).toBe(1 + 2 * 4); // 2 criteria × 4 levels
    expect(lines[0]).toContain("criterion,description,weight");
  });
});

describe("assignment-rubric-maker exportRubricJSON", () => {
  it("produces valid JSON", () => {
    const r = buildSample();
    const json = exportRubricJSON(r);
    const parsed = JSON.parse(json);
    expect(parsed.criteria.length).toBe(2);
  });
});

describe("assignment-rubric-maker exportRubricText", () => {
  it("includes criterion name and levels", () => {
    const r = buildSample();
    const txt = exportRubricText(r);
    expect(txt).toContain("## Thesis");
    expect(txt).toContain("Excellent");
  });
});

describe("assignment-rubric-maker rubricStats", () => {
  it("computes criteriaCount and avgLevels", () => {
    const r = buildSample();
    const s = rubricStats(r);
    expect(s.criteriaCount).toBe(2);
    expect(s.avgLevels).toBe(4);
  });
  it("computes maxPossiblePoints", () => {
    const r = buildSample();
    const s = rubricStats(r);
    expect(s.maxPossiblePoints).toBe(12);
  });
});

describe("assignment-rubric-maker bestLevels / worstLevels", () => {
  it("finds highest-point level per criterion", () => {
    const r = buildSample();
    const best = bestLevels(r);
    expect(best[0].level.points).toBe(4);
  });
  it("finds lowest-point level per criterion", () => {
    const r = buildSample();
    const worst = worstLevels(r);
    expect(worst[0].level.points).toBe(1);
  });
});

describe("assignment-rubric-maker percentFromRaw", () => {
  it("computes percent of total points", () => {
    const r = buildSample();
    expect(percentFromRaw(r, 75)).toBe(75);
  });
  it("returns 0 for zero total", () => {
    const r = createRubric("X", "", 0);
    expect(percentFromRaw(r, 50)).toBe(0);
  });
});

describe("assignment-rubric-maker presetRubric", () => {
  it("essay preset has 5 criteria", () => {
    expect(presetRubric("essay").criteria.length).toBe(5);
  });
  it("presentation preset has criteria", () => {
    expect(presetRubric("presentation").criteria.length).toBeGreaterThan(0);
  });
  it("lab-report preset has criteria", () => {
    expect(presetRubric("lab-report").criteria.length).toBeGreaterThan(0);
  });
});
