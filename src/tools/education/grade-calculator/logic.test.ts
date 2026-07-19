import { describe, it, expect, beforeEach } from "vitest";
import {
  STANDARD_10_POINT,
  PLUS_MINUS,
  PASS_FAIL,
  GPA_5_0_THRESHOLDS,
  GRADING_SCALE_OPTIONS,
  GRADING_SCALE_LABELS,
  GPA_SCALE_OPTIONS,
  GPA_SCALE_LABELS,
  DEFAULTS,
  SAMPLE_ASSIGNMENTS,
  splitCsvLine,
  parseAssignments,
  parseCustomThresholds,
  validateAssignments,
  computeWeightedScore,
  computeTotalWeight,
  computeAttemptedWeight,
  computeRemainingWeight,
  computeCumulativeEarned,
  computeCurrentGrade,
  computeGradeNeeded,
  computeLetterGrade,
  computeGpa,
  projectFinalGrade,
  computeWhatIf,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Assignment,
  type GradingScale,
  type GpaScale,
  type HistoryEntry,
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

describe("grade-calculator constants", () => {
  it("has 4 grading scale options", () => {
    expect(GRADING_SCALE_OPTIONS).toHaveLength(4);
    expect(GRADING_SCALE_OPTIONS).toContain("standard-10-point");
    expect(GRADING_SCALE_OPTIONS).toContain("custom");
  });
  it("has 4 GPA scale options", () => {
    expect(GPA_SCALE_OPTIONS).toHaveLength(4);
    expect(GPA_SCALE_OPTIONS).toContain("4.0");
    expect(GPA_SCALE_OPTIONS).toContain("100-percentage");
  });
  it("has labels for all scales", () => {
    GRADING_SCALE_OPTIONS.forEach((s) => {
      expect(typeof GRADING_SCALE_LABELS[s]).toBe("string");
    });
    GPA_SCALE_OPTIONS.forEach((s) => {
      expect(typeof GPA_SCALE_LABELS[s]).toBe("string");
    });
  });
  it("standard-10-point has 5 thresholds", () => {
    expect(STANDARD_10_POINT).toHaveLength(5);
    expect(STANDARD_10_POINT[0].letter).toBe("A");
  });
  it("plus-minus has 13 thresholds", () => {
    expect(PLUS_MINUS).toHaveLength(13);
    expect(PLUS_MINUS[0].letter).toBe("A+");
    expect(PLUS_MINUS[PLUS_MINUS.length - 1].letter).toBe("F");
  });
  it("pass-fail has 2 thresholds", () => {
    expect(PASS_FAIL).toHaveLength(2);
    expect(PASS_FAIL[0].letter).toBe("P");
    expect(PASS_FAIL[1].letter).toBe("F");
  });
  it("5.0 GPA scale has 5 thresholds", () => {
    expect(GPA_5_0_THRESHOLDS).toHaveLength(5);
    expect(GPA_5_0_THRESHOLDS[0].gpa).toBe(5.0);
  });
  it("has defaults and a sample input", () => {
    expect(DEFAULTS.targetGrade).toBe(90);
    expect(SAMPLE_ASSIGNMENTS.length).toBeGreaterThan(0);
    expect(SAMPLE_ASSIGNMENTS).toContain("Midterm");
  });
});

describe("grade-calculator splitCsvLine", () => {
  it("splits simple", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvLine('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("grade-calculator parseAssignments", () => {
  it("parses basic CSV-style assignments", () => {
    const text = "Midterm,85,100,25\nFinal,,100,40";
    const a = parseAssignments(text);
    expect(a).toHaveLength(2);
    expect(a[0].name).toBe("Midterm");
    expect(a[0].score).toBe(85);
    expect(a[0].maxScore).toBe(100);
    expect(a[0].weightPercent).toBe(25);
    expect(a[1].score).toBeNull(); // unattempted
  });
  it("skips comment lines", () => {
    const text = "# Comment\nMidterm,85,100,25";
    expect(parseAssignments(text)).toHaveLength(1);
  });
  it("skips empty lines", () => {
    const text = "\n\nMidterm,85,100,25\n\n";
    expect(parseAssignments(text)).toHaveLength(1);
  });
  it("skips lines with too few fields", () => {
    const text = "Midterm\nMidterm,85\nMidterm,85,100,25";
    expect(parseAssignments(text)).toHaveLength(1);
  });
  it("skips invalid maxScore (<=0 or non-numeric)", () => {
    const text = "A,85,0,25\nB,85,abc,25\nC,85,100,25";
    expect(parseAssignments(text)).toHaveLength(1);
    expect(parseAssignments(text)[0].name).toBe("C");
  });
  it("skips scores outside 0-maxScore range", () => {
    const text = "A,150,100,25\nB,-5,100,25\nC,85,100,25";
    expect(parseAssignments(text)).toHaveLength(1);
    expect(parseAssignments(text)[0].name).toBe("C");
  });
  it("handles quoted names with commas", () => {
    const a = parseAssignments('"Quiz, Week 1",18,20,10');
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("Quiz, Week 1");
  });
  it("handles missing weight (defaults to 0)", () => {
    const a = parseAssignments("Midterm,85,100");
    expect(a).toHaveLength(1);
    expect(a[0].weightPercent).toBe(0);
  });
  it("returns empty for empty input", () => {
    expect(parseAssignments("")).toEqual([]);
  });
  it("parses the sample input", () => {
    const a = parseAssignments(SAMPLE_ASSIGNMENTS);
    expect(a).toHaveLength(5);
    expect(a.filter((x) => x.score == null)).toHaveLength(2);
  });
});

describe("grade-calculator parseCustomThresholds", () => {
  it("parses custom thresholds", () => {
    const t = parseCustomThresholds("90,A,4.0\n80,B,3.0\n0,F,0.0");
    expect(t).toHaveLength(3);
    expect(t[0].minPercent).toBe(90); // sorted descending
    expect(t[2].minPercent).toBe(0);
  });
  it("skips invalid lines", () => {
    const t = parseCustomThresholds("90,A,4.0\ninvalid\n80,B,3.0");
    expect(t).toHaveLength(2);
  });
  it("skips comments", () => {
    const t = parseCustomThresholds("# comment\n90,A,4.0");
    expect(t).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseCustomThresholds("")).toEqual([]);
  });
});

describe("grade-calculator validateAssignments", () => {
  it("returns ok for valid assignments", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 50 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 50 },
    ];
    const v = validateAssignments(a);
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
    expect(v.assignmentCount).toBe(2);
    expect(v.totalWeight).toBe(100);
  });
  it("warns when weights don't sum to 100", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    const v = validateAssignments(a);
    expect(v.ok).toBe(true);
    expect(v.warnings.length).toBeGreaterThan(0);
    expect(v.totalWeight).toBe(65);
  });
  it("errors on empty list", () => {
    const v = validateAssignments([]);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("No assignments entered");
  });
  it("errors on weight=0", () => {
    const a: Assignment[] = [
      { name: "A", score: 50, maxScore: 100, weightPercent: 0 },
    ];
    const v = validateAssignments(a);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("0"))).toBe(true);
  });
});

describe("grade-calculator computeWeightedScore", () => {
  it("computes weighted score for attempted assignment", () => {
    const a: Assignment = { name: "M", score: 85, maxScore: 100, weightPercent: 25 };
    expect(computeWeightedScore(a)).toBeCloseTo(21.25, 2);
  });
  it("returns null for unattempted", () => {
    const a: Assignment = { name: "M", score: null, maxScore: 100, weightPercent: 25 };
    expect(computeWeightedScore(a)).toBeNull();
  });
  it("handles maxScore != 100", () => {
    const a: Assignment = { name: "Q", score: 18, maxScore: 20, weightPercent: 10 };
    expect(computeWeightedScore(a)).toBeCloseTo(9, 2);
  });
});

describe("grade-calculator weight aggregators", () => {
  const assignments: Assignment[] = [
    { name: "A", score: 85, maxScore: 100, weightPercent: 25 },
    { name: "B", score: null, maxScore: 100, weightPercent: 40 },
    { name: "C", score: 90, maxScore: 100, weightPercent: 35 },
  ];
  it("computeTotalWeight sums all", () => {
    expect(computeTotalWeight(assignments)).toBe(100);
  });
  it("computeAttemptedWeight sums only attempted", () => {
    expect(computeAttemptedWeight(assignments)).toBe(60);
  });
  it("computeRemainingWeight sums only unattempted", () => {
    expect(computeRemainingWeight(assignments)).toBe(40);
  });
  it("computeCumulativeEarned sums weighted scores", () => {
    // 21.25 + 0 (B unattempted) + 31.5 = 52.75
    expect(computeCumulativeEarned(assignments)).toBeCloseTo(52.75, 2);
  });
});

describe("grade-calculator computeCurrentGrade", () => {
  it("computes % on attempted work", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    // attempted: 21.25 / 25 * 100 = 85
    expect(computeCurrentGrade(a)).toBe(85);
  });
  it("returns 0 for no attempted assignments", () => {
    const a: Assignment[] = [
      { name: "Final", score: null, maxScore: 100, weightPercent: 100 },
    ];
    expect(computeCurrentGrade(a)).toBe(0);
  });
  it("weights across multiple attempted", () => {
    const a: Assignment[] = [
      { name: "A", score: 90, maxScore: 100, weightPercent: 30 }, // 27
      { name: "B", score: 80, maxScore: 100, weightPercent: 20 }, // 16
      { name: "C", score: null, maxScore: 100, weightPercent: 50 }, // unattempted
    ];
    // (27 + 16) / 50 * 100 = 86
    expect(computeCurrentGrade(a)).toBe(86);
  });
});

describe("grade-calculator computeGradeNeeded", () => {
  it("computes grade needed to reach target", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    // totalWeight=65, currentWeighted=21.25, remainingWeight=40, target=90
    // needed = ((90*65/100) - 21.25) * 100 / 40 = (58.5 - 21.25) * 100 / 40 = 93.125
    expect(computeGradeNeeded(a, 90)).toBeCloseTo(93.13, 1);
  });
  it("returns null when no remaining work", () => {
    const a: Assignment[] = [
      { name: "M", score: 85, maxScore: 100, weightPercent: 100 },
    ];
    expect(computeGradeNeeded(a, 90)).toBeNull();
  });
  it("returns target grade itself when current = target", () => {
    const a: Assignment[] = [
      { name: "M", score: 85, maxScore: 100, weightPercent: 50 },
      { name: "F", score: null, maxScore: 100, weightPercent: 50 },
    ];
    // currentWeighted = 42.5, total=100, remaining=50, target=85
    // needed = ((85*100/100) - 42.5) * 100 / 50 = (85 - 42.5) * 2 = 85
    expect(computeGradeNeeded(a, 85)).toBe(85);
  });
  it("can exceed 100% when target is unreachable", () => {
    const a: Assignment[] = [
      { name: "M", score: 50, maxScore: 100, weightPercent: 50 },
      { name: "F", score: null, maxScore: 100, weightPercent: 50 },
    ];
    // currentWeighted = 25, target = 100
    // needed = ((100*100/100) - 25) * 100 / 50 = (100 - 25) * 2 = 150
    expect(computeGradeNeeded(a, 100)).toBe(150);
  });
});

describe("grade-calculator computeLetterGrade", () => {
  it("standard-10-point thresholds", () => {
    expect(computeLetterGrade(95, "standard-10-point")).toBe("A");
    expect(computeLetterGrade(90, "standard-10-point")).toBe("A");
    expect(computeLetterGrade(89.99, "standard-10-point")).toBe("B");
    expect(computeLetterGrade(85, "standard-10-point")).toBe("B");
    expect(computeLetterGrade(75, "standard-10-point")).toBe("C");
    expect(computeLetterGrade(65, "standard-10-point")).toBe("D");
    expect(computeLetterGrade(55, "standard-10-point")).toBe("F");
  });
  it("plus-minus thresholds", () => {
    expect(computeLetterGrade(98, "plus-minus")).toBe("A+");
    expect(computeLetterGrade(95, "plus-minus")).toBe("A");
    expect(computeLetterGrade(91, "plus-minus")).toBe("A-");
    expect(computeLetterGrade(88, "plus-minus")).toBe("B+");
    expect(computeLetterGrade(84, "plus-minus")).toBe("B");
    expect(computeLetterGrade(81, "plus-minus")).toBe("B-");
    expect(computeLetterGrade(50, "plus-minus")).toBe("F");
  });
  it("pass-fail thresholds", () => {
    expect(computeLetterGrade(95, "pass-fail")).toBe("P");
    expect(computeLetterGrade(60, "pass-fail")).toBe("P");
    expect(computeLetterGrade(59, "pass-fail")).toBe("F");
  });
  it("custom thresholds", () => {
    const custom = [
      { minPercent: 85, letter: "HD", gpa: 4.0 },
      { minPercent: 75, letter: "D", gpa: 3.0 },
      { minPercent: 65, letter: "C", gpa: 2.0 },
      { minPercent: 50, letter: "P", gpa: 1.0 },
      { minPercent: 0, letter: "F", gpa: 0.0 },
    ];
    expect(computeLetterGrade(90, "custom", custom)).toBe("HD");
    expect(computeLetterGrade(80, "custom", custom)).toBe("D");
    expect(computeLetterGrade(70, "custom", custom)).toBe("C");
    expect(computeLetterGrade(55, "custom", custom)).toBe("P");
    expect(computeLetterGrade(40, "custom", custom)).toBe("F");
  });
  it("custom with no thresholds falls back to standard", () => {
    expect(computeLetterGrade(95, "custom", [])).toBe("A");
  });
  it("clamps percent to 0-100", () => {
    expect(computeLetterGrade(150, "standard-10-point")).toBe("A");
    expect(computeLetterGrade(-10, "standard-10-point")).toBe("F");
  });
});

describe("grade-calculator computeGpa", () => {
  it("4.0 scale", () => {
    expect(computeGpa(95, "4.0")).toBe(4.0);
    expect(computeGpa(85, "4.0")).toBe(3.0);
    expect(computeGpa(75, "4.0")).toBe(2.0);
    expect(computeGpa(65, "4.0")).toBe(1.0);
    expect(computeGpa(55, "4.0")).toBe(0.0);
  });
  it("5.0 scale", () => {
    expect(computeGpa(95, "5.0")).toBe(5.0);
    expect(computeGpa(85, "5.0")).toBe(4.0);
    expect(computeGpa(55, "5.0")).toBe(0.0);
  });
  it("10.0 scale = percent/10", () => {
    expect(computeGpa(95, "10.0")).toBe(9.5);
    expect(computeGpa(82, "10.0")).toBe(8.2);
  });
  it("100-percentage scale = percent", () => {
    expect(computeGpa(95, "100-percentage")).toBe(95);
    expect(computeGpa(82.5, "100-percentage")).toBe(82.5);
  });
  it("clamps percent to 0-100", () => {
    expect(computeGpa(150, "4.0")).toBe(4.0);
    expect(computeGpa(-10, "4.0")).toBe(0.0);
  });
});

describe("grade-calculator projectFinalGrade", () => {
  it("projects final grade assuming a score on remaining", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    // totalWeight=65, currentWeighted=21.25, remainingWeight=40
    // assumed 90: (21.25 + 36) / 65 * 100 = 88.08
    expect(projectFinalGrade(a, 90)).toBeCloseTo(88.08, 1);
    // assumed 100: (21.25 + 40) / 65 * 100 = 94.23
    expect(projectFinalGrade(a, 100)).toBeCloseTo(94.23, 1);
  });
  it("returns current grade when no remaining work", () => {
    const a: Assignment[] = [
      { name: "M", score: 85, maxScore: 100, weightPercent: 100 },
    ];
    // currentWeighted=85, total=100, remaining=0
    // projected = (85 + 0) / 100 * 100 = 85
    expect(projectFinalGrade(a, 50)).toBe(85);
  });
});

describe("grade-calculator computeWhatIf", () => {
  it("computes what-if scenario with letter + gpa", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    const sc = computeWhatIf(a, 90, "standard-10-point", "4.0");
    expect(sc.assumedScore).toBe(90);
    expect(sc.projectedFinalGrade).toBeCloseTo(88.08, 1);
    expect(sc.projectedLetter).toBe("B");
    expect(sc.projectedGpa).toBe(3.0);
  });
});

describe("grade-calculator computeSummaryStats (integration)", () => {
  it("computes full summary", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    const s = computeSummaryStats(a, 90, "standard-10-point", "4.0");
    expect(s.currentGrade).toBe(85);
    expect(s.targetGrade).toBe(90);
    expect(s.gradeNeeded).toBeCloseTo(93.13, 1);
    expect(s.currentLetter).toBe("B");
    expect(s.currentGpa).toBe(3.0);
    expect(s.targetLetter).toBe("A");
    expect(s.targetGpa).toBe(4.0);
    expect(s.neededLetter).toBe("A");
    expect(s.totalWeight).toBe(65);
    expect(s.attemptedWeight).toBe(25);
    expect(s.remainingWeight).toBe(40);
    expect(s.attemptedCount).toBe(1);
    expect(s.remainingCount).toBe(1);
  });
  it("handles no remaining (gradeNeeded is null)", () => {
    const a: Assignment[] = [
      { name: "M", score: 85, maxScore: 100, weightPercent: 100 },
    ];
    const s = computeSummaryStats(a, 90, "standard-10-point", "4.0");
    expect(s.gradeNeeded).toBeNull();
    expect(s.neededLetter).toBe("—");
    expect(s.remainingCount).toBe(0);
  });
  it("weightedScores includes per-assignment breakdown", () => {
    const a: Assignment[] = [
      { name: "M", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "F", score: null, maxScore: 100, weightPercent: 40 },
    ];
    const s = computeSummaryStats(a, 90, "standard-10-point", "4.0");
    expect(s.weightedScores).toHaveLength(2);
    expect(s.weightedScores[0].weightedScore).toBeCloseTo(21.25, 2);
    expect(s.weightedScores[0].attempted).toBe(true);
    expect(s.weightedScores[0].percent).toBe(85);
    expect(s.weightedScores[1].attempted).toBe(false);
    expect(s.weightedScores[1].weightedScore).toBeNull();
    expect(s.weightedScores[1].percent).toBeNull();
  });
});

describe("grade-calculator renderText", () => {
  it("renders summary + breakdown", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    const s = computeSummaryStats(a, 90, "standard-10-point", "4.0");
    const text = renderText(a, s, "standard-10-point", "4.0");
    expect(text).toContain("Grade Calculator Report");
    expect(text).toContain("Target grade:");
    expect(text).toContain("Current grade:");
    expect(text).toContain("Grade needed:");
    expect(text).toContain("Midterm");
    expect(text).toContain("Assignment Breakdown");
    expect(text).toContain("85/100 (85%)");
    expect(text).toContain("not yet attempted");
  });
});

describe("grade-calculator renderCsv", () => {
  it("renders header row", () => {
    expect(renderCsv([])).toBe(
      "name,score,max_score,weight_percent,weighted_score,percent,attempted",
    );
  });
  it("renders one row per assignment", () => {
    const a: Assignment[] = [
      { name: "Midterm", score: 85, maxScore: 100, weightPercent: 25 },
      { name: "Final", score: null, maxScore: 100, weightPercent: 40 },
    ];
    const csv = renderCsv(a);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Midterm,85,100,25");
    expect(lines[1]).toContain(",yes");
    expect(lines[2]).toContain("Final,,100,40");
    expect(lines[2]).toContain(",no");
  });
  it("escapes commas in names", () => {
    const a: Assignment[] = [
      { name: "Quiz, Week 1", score: 18, maxScore: 20, weightPercent: 10 },
    ];
    const csv = renderCsv(a);
    expect(csv).toContain('"Quiz, Week 1"');
  });
});

describe("grade-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1000, currentGrade: 85, targetGrade: 90,
      gradeNeeded: 93.13, currentGpa: 3.0, assignmentCount: 2,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].currentGrade).toBe(85);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, currentGrade: i, targetGrade: 90, gradeNeeded: 90,
        currentGpa: 3.0, assignmentCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, currentGrade: 85, targetGrade: 90, gradeNeeded: 90,
      currentGpa: 3.0, assignmentCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("grade-calculator shareable URL", () => {
  const sampleText = "Midterm,85,100,25\nFinal,,100,40";
  const target = 90;
  const scale: GradingScale = "plus-minus";
  const gpa: GpaScale = "5.0";

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleText, target, scale, gpa);
    expect(url).toContain("target=90");
    expect(url).toContain("scale=plus-minus");
    expect(url).toContain("gpa=5.0");
    expect(url).toContain("d=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleText, target, scale, gpa);
    const sepIdx = Math.min(
      url.indexOf("#") === -1 ? Infinity : url.indexOf("#"),
      url.indexOf("?") === -1 ? Infinity : url.indexOf("?"),
    );
    const hash = sepIdx === Infinity ? url : url.slice(sepIdx + 1);
    const p = parseShareUrl(hash);
    expect(p.assignmentsText).toBe(sampleText);
    expect(p.targetGrade).toBe(target);
    expect(p.gradingScale).toBe(scale);
    expect(p.gpaScale).toBe(gpa);
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("handles empty hash by returning defaults", () => {
    const p = parseShareUrl("");
    expect(p.assignmentsText).toBe("");
    expect(p.targetGrade).toBe(DEFAULTS.targetGrade);
    expect(p.gradingScale).toBe(DEFAULTS.gradingScale);
    expect(p.gpaScale).toBe(DEFAULTS.gpaScale);
  });

  it("filters unknown scales to default", () => {
    const p = parseShareUrl("target=85&scale=unknown&gpa=invalid");
    expect(p.targetGrade).toBe(85);
    expect(p.gradingScale).toBe(DEFAULTS.gradingScale);
    expect(p.gpaScale).toBe(DEFAULTS.gpaScale);
  });

  it("clamps target to 0-100", () => {
    const p = parseShareUrl("target=150");
    expect(p.targetGrade).toBe(100);
    const p2 = parseShareUrl("target=-5");
    expect(p2.targetGrade).toBe(0);
  });
});

// Suppress unused-import lint
export type _Unused = HistoryEntry;
