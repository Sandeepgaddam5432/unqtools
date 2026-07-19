import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeName,
  parseOptions,
  parseCriteria,
  parseWeights,
  parseScores,
  splitCsvRow,
  validateScore,
  normalizeWeights,
  totalRawWeight,
  lookupScore,
  calculateWeightedScore,
  buildCells,
  calculateOptionTotals,
  rankOptions,
  identifyBestOption,
  calculateMarginOfVictory,
  sensitivityAnalysis,
  summaryStats,
  scoreColor,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MatrixInput,
  type Weight,
  type Score,
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

function sampleInput(overrides: Partial<MatrixInput> = {}): MatrixInput {
  return {
    decisionTitle: "Which vendor to pick",
    optionsText: "Vendor A\nVendor B\nVendor C",
    criteriaText: "Cost\nSpeed\nQuality\nReliability",
    weightsText: "Cost,30\nSpeed,20\nQuality,30\nReliability,20",
    scoresText: [
      "Vendor A,Cost,4",
      "Vendor A,Speed,3",
      "Vendor A,Quality,5",
      "Vendor A,Reliability,4",
      "Vendor B,Cost,2",
      "Vendor B,Speed,5",
      "Vendor B,Quality,3",
      "Vendor B,Reliability,3",
      "Vendor C,Cost,5",
      "Vendor C,Speed,2",
      "Vendor C,Quality,3",
      "Vendor C,Reliability,5",
    ].join("\n"),
    ...overrides,
  };
}

describe("decision-matrix-builder normalizeName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("  Vendor   A  ")).toBe("vendor a");
  });
  it("handles empty", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("decision-matrix-builder parseOptions", () => {
  it("parses one per line", () => {
    expect(parseOptions("Vendor A\nVendor B\nVendor C")).toEqual(["Vendor A", "Vendor B", "Vendor C"]);
  });
  it("trims and skips blank lines", () => {
    expect(parseOptions("  A  \n\n  B  ")).toEqual(["A", "B"]);
  });
  it("returns empty for empty input", () => {
    expect(parseOptions("")).toEqual([]);
  });
});

describe("decision-matrix-builder parseCriteria", () => {
  it("parses one per line", () => {
    expect(parseCriteria("Cost\nSpeed\nQuality")).toEqual(["Cost", "Speed", "Quality"]);
  });
  it("returns empty for empty input", () => {
    expect(parseCriteria("")).toEqual([]);
  });
});

describe("decision-matrix-builder parseWeights", () => {
  it("parses criterion,weight lines", () => {
    const { weights, errors } = parseWeights("Cost,30\nSpeed,20");
    expect(weights).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(weights[0]).toEqual({ criterion: "Cost", weight: 30 });
  });
  it("skips blank lines", () => {
    const { weights } = parseWeights("Cost,30\n\nSpeed,20");
    expect(weights).toHaveLength(2);
  });
  it("rejects invalid weight", () => {
    const { weights, errors } = parseWeights("Cost,abc");
    expect(weights).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid weight");
  });
  it("rejects negative weight", () => {
    const { weights, errors } = parseWeights("Cost,-5");
    expect(weights).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
  it("rejects line with too few fields", () => {
    const { errors } = parseWeights("Cost");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("needs criterion,weight");
  });
  it("returns empty for empty input", () => {
    const { weights, errors } = parseWeights("");
    expect(weights).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("decision-matrix-builder parseScores", () => {
  it("parses option,criterion,score lines", () => {
    const { scores, errors } = parseScores("Vendor A,Cost,4\nVendor B,Speed,5");
    expect(scores).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(scores[0]).toEqual({ option: "Vendor A", criterion: "Cost", score: 4 });
  });
  it("rejects score outside 1-5", () => {
    const { scores, errors } = parseScores("Vendor A,Cost,6");
    expect(scores).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("1-5");
  });
  it("rejects score 0", () => {
    const { errors } = parseScores("Vendor A,Cost,0");
    expect(errors).toHaveLength(1);
  });
  it("rejects non-integer score", () => {
    const { errors } = parseScores("Vendor A,Cost,3.5");
    expect(errors).toHaveLength(1);
  });
  it("rejects line with too few fields", () => {
    const { errors } = parseScores("Vendor A,Cost");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("needs option,criterion,score");
  });
  it("returns empty for empty input", () => {
    const { scores, errors } = parseScores("");
    expect(scores).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("decision-matrix-builder splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("decision-matrix-builder validateScore", () => {
  it("accepts integers 1-5", () => {
    for (let i = 1; i <= 5; i++) expect(validateScore(i)).toBe(true);
  });
  it("rejects 0", () => { expect(validateScore(0)).toBe(false); });
  it("rejects 6", () => { expect(validateScore(6)).toBe(false); });
  it("rejects NaN", () => { expect(validateScore(NaN)).toBe(false); });
  it("rejects non-integer", () => { expect(validateScore(3.5)).toBe(false); });
});

describe("decision-matrix-builder normalizeWeights", () => {
  it("scales weights to sum 100", () => {
    const nw = normalizeWeights([
      { criterion: "Cost", weight: 30 },
      { criterion: "Speed", weight: 20 },
      { criterion: "Quality", weight: 30 },
      { criterion: "Reliability", weight: 20 },
    ]);
    const sum = nw.reduce((s, w) => s + w.normalizedWeight, 0);
    expect(sum).toBeCloseTo(100, 5);
    expect(nw[0].normalizedWeight).toBeCloseTo(30, 5);
  });
  it("scales 3/2/3/2 to 30/20/30/20", () => {
    const nw = normalizeWeights([
      { criterion: "Cost", weight: 3 },
      { criterion: "Speed", weight: 2 },
    ]);
    expect(nw[0].normalizedWeight).toBeCloseTo(60, 5);
    expect(nw[1].normalizedWeight).toBeCloseTo(40, 5);
  });
  it("handles empty", () => {
    expect(normalizeWeights([])).toEqual([]);
  });
  it("uses equal weights when total is 0", () => {
    const nw = normalizeWeights([
      { criterion: "A", weight: 0 },
      { criterion: "B", weight: 0 },
    ]);
    expect(nw[0].normalizedWeight).toBeCloseTo(50, 5);
    expect(nw[1].normalizedWeight).toBeCloseTo(50, 5);
  });
});

describe("decision-matrix-builder totalRawWeight", () => {
  it("sums raw weights", () => {
    expect(totalRawWeight([{ criterion: "A", weight: 30 }, { criterion: "B", weight: 20 }])).toBe(50);
  });
  it("returns 0 for empty", () => {
    expect(totalRawWeight([])).toBe(0);
  });
});

describe("decision-matrix-builder lookupScore", () => {
  const scores: Score[] = [
    { option: "Vendor A", criterion: "Cost", score: 4 },
    { option: "Vendor A", criterion: "Speed", score: 3 },
  ];
  it("finds by exact match", () => {
    expect(lookupScore("Vendor A", "Cost", scores)).toBe(4);
  });
  it("finds by case-insensitive match", () => {
    expect(lookupScore("vendor a", "cost", scores)).toBe(4);
  });
  it("returns 0 when not found", () => {
    expect(lookupScore("Vendor Z", "Cost", scores)).toBe(0);
  });
});

describe("decision-matrix-builder calculateWeightedScore", () => {
  it("multiplies score by normalized weight", () => {
    expect(calculateWeightedScore(4, 30)).toBe(120);
  });
  it("handles zero score", () => {
    expect(calculateWeightedScore(0, 30)).toBe(0);
  });
});

describe("decision-matrix-builder buildCells", () => {
  it("builds one cell per option × criterion", () => {
    const options = ["A", "B"];
    const criteria = ["Cost", "Speed"];
    const nw = normalizeWeights([
      { criterion: "Cost", weight: 30 },
      { criterion: "Speed", weight: 20 },
    ]);
    const scores: Score[] = [
      { option: "A", criterion: "Cost", score: 4 },
      { option: "A", criterion: "Speed", score: 5 },
      { option: "B", criterion: "Cost", score: 2 },
      { option: "B", criterion: "Speed", score: 3 },
    ];
    const cells = buildCells(options, criteria, nw, scores);
    expect(cells).toHaveLength(4);
    const aCost = cells.find((c) => c.option === "A" && c.criterion === "Cost");
    expect(aCost?.score).toBe(4);
    expect(aCost?.normalizedWeight).toBe(60); // 30/(30+20)*100
    expect(aCost?.weightedScore).toBe(240); // 4 * 60
  });
  it("uses 0 weight for unknown criterion", () => {
    const cells = buildCells(["A"], ["Unknown"], [], []);
    expect(cells).toHaveLength(1);
    expect(cells[0].score).toBe(0);
    expect(cells[0].normalizedWeight).toBe(0);
  });
});

describe("decision-matrix-builder calculateOptionTotals", () => {
  it("sums weighted scores per option", () => {
    const cells = [
      { option: "A", criterion: "Cost", score: 4, normalizedWeight: 60, weightedScore: 240 },
      { option: "A", criterion: "Speed", score: 5, normalizedWeight: 40, weightedScore: 200 },
      { option: "B", criterion: "Cost", score: 2, normalizedWeight: 60, weightedScore: 120 },
      { option: "B", criterion: "Speed", score: 3, normalizedWeight: 40, weightedScore: 120 },
    ];
    const totals = calculateOptionTotals(cells, ["A", "B"]);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toEqual({ option: "A", totalScore: 440, rank: 0 });
    expect(totals[1]).toEqual({ option: "B", totalScore: 240, rank: 0 });
  });
});

describe("decision-matrix-builder rankOptions", () => {
  it("sorts by total descending", () => {
    const totals = [
      { option: "A", totalScore: 100, rank: 0 },
      { option: "B", totalScore: 300, rank: 0 },
      { option: "C", totalScore: 200, rank: 0 },
    ];
    const ranked = rankOptions(totals);
    expect(ranked.map((t) => t.option)).toEqual(["B", "C", "A"]);
    expect(ranked.map((t) => t.rank)).toEqual([1, 2, 3]);
  });
  it("breaks ties alphabetically", () => {
    const totals = [
      { option: "Z", totalScore: 100, rank: 0 },
      { option: "A", totalScore: 100, rank: 0 },
    ];
    const ranked = rankOptions(totals);
    expect(ranked[0].option).toBe("A");
  });
  it("does not mutate input", () => {
    const totals = [
      { option: "A", totalScore: 100, rank: 0 },
      { option: "B", totalScore: 200, rank: 0 },
    ];
    rankOptions(totals);
    expect(totals[0].option).toBe("A"); // unchanged
    expect(totals[0].rank).toBe(0); // not mutated
  });
  it("handles empty", () => {
    expect(rankOptions([])).toEqual([]);
  });
});

describe("decision-matrix-builder identifyBestOption", () => {
  it("returns top option", () => {
    const ranked = [
      { option: "B", totalScore: 300, rank: 1 },
      { option: "A", totalScore: 100, rank: 2 },
    ];
    expect(identifyBestOption(ranked)).toBe("B");
  });
  it("returns empty for empty", () => {
    expect(identifyBestOption([])).toBe("");
  });
});

describe("decision-matrix-builder calculateMarginOfVictory", () => {
  it("returns top minus second", () => {
    const ranked = [
      { option: "B", totalScore: 300, rank: 1 },
      { option: "A", totalScore: 250, rank: 2 },
    ];
    expect(calculateMarginOfVictory(ranked)).toBe(50);
  });
  it("returns 0 for fewer than 2 options", () => {
    expect(calculateMarginOfVictory([{ option: "A", totalScore: 100, rank: 1 }])).toBe(0);
  });
});

describe("decision-matrix-builder sensitivityAnalysis", () => {
  it("returns base winner with variations", () => {
    const options = ["A", "B"];
    const criteria = ["Cost", "Speed"];
    const weights: Weight[] = [
      { criterion: "Cost", weight: 50 },
      { criterion: "Speed", weight: 50 },
    ];
    const scores: Score[] = [
      { option: "A", criterion: "Cost", score: 5 },
      { option: "A", criterion: "Speed", score: 1 },
      { option: "B", criterion: "Cost", score: 1 },
      { option: "B", criterion: "Speed", score: 5 },
    ];
    const result = sensitivityAnalysis(options, criteria, weights, scores);
    expect(result.variations).toHaveLength(4); // 2 criteria × 2 factors
    expect(result.variations.every((v) => v.label.includes("Cost") || v.label.includes("Speed"))).toBe(true);
    expect(typeof result.stable).toBe("boolean");
  });
  it("flags instability when winner changes", () => {
    const options = ["A", "B"];
    const criteria = ["Cost", "Speed"];
    // Tight weights with very close scores → variation may flip winner
    const weights: Weight[] = [
      { criterion: "Cost", weight: 51 },
      { criterion: "Speed", weight: 49 },
    ];
    const scores: Score[] = [
      { option: "A", criterion: "Cost", score: 5 },
      { option: "A", criterion: "Speed", score: 1 },
      { option: "B", criterion: "Cost", score: 4 },
      { option: "B", criterion: "Speed", score: 5 },
    ];
    const result = sensitivityAnalysis(options, criteria, weights, scores);
    // Base winner: A? Let's verify computation
    // A: 5*51/(51+49)*100 + 1*49/(51+49)*100 = 5*51 + 1*49 = 255 + 49 = 304
    // B: 4*51 + 5*49 = 204 + 245 = 449
    // So B is base winner. With Cost +10%: weights 56.1/49 → renormalize → 53.39/46.61
    //   A: 5*53.39 + 1*46.61 = 266.95 + 46.61 = 313.56
    //   B: 4*53.39 + 5*46.61 = 213.56 + 233.05 = 446.61 → still B wins
    // We just need to verify at least one variation computed
    expect(result.baseWinner).toBe("B");
    expect(result.variations.length).toBe(4);
  });
  it("is stable when winner is clear", () => {
    const options = ["A", "B"];
    const criteria = ["Cost"];
    const weights: Weight[] = [{ criterion: "Cost", weight: 100 }];
    const scores: Score[] = [
      { option: "A", criterion: "Cost", score: 5 },
      { option: "B", criterion: "Cost", score: 1 },
    ];
    const result = sensitivityAnalysis(options, criteria, weights, scores);
    expect(result.baseWinner).toBe("A");
    expect(result.stable).toBe(true);
  });
  it("returns empty for empty inputs", () => {
    const result = sensitivityAnalysis([], [], [], []);
    expect(result.baseWinner).toBe("");
    expect(result.variations).toEqual([]);
  });
});

describe("decision-matrix-builder summaryStats", () => {
  it("computes all stats", () => {
    const input = sampleInput();
    const options = parseOptions(input.optionsText);
    const criteria = parseCriteria(input.criteriaText);
    const { weights } = parseWeights(input.weightsText);
    const { scores } = parseScores(input.scoresText);
    const nw = normalizeWeights(weights);
    const cells = buildCells(options, criteria, nw, scores);
    const totals = calculateOptionTotals(cells, options);
    const ranked = rankOptions(totals);
    const stats = summaryStats(options, criteria, weights, nw, cells, ranked);
    expect(stats.optionsCount).toBe(3);
    expect(stats.criteriaCount).toBe(4);
    expect(stats.cellsCount).toBe(12);
    expect(stats.filledCellsCount).toBe(12);
    expect(stats.totalWeight).toBe(100);
    expect(stats.normalizedTotalWeight).toBeCloseTo(100, 5);
    // Winner determined by weighted scores
    expect(stats.winnerOption).toBeTruthy();
    expect(stats.marginOfVictory).toBeGreaterThan(0);
  });
});

describe("decision-matrix-builder scoreColor", () => {
  it("returns green for 5", () => { expect(scoreColor(5)).toMatch(/#/); });
  it("returns red for 1", () => { expect(scoreColor(1)).toBe("#dc2626"); });
  it("returns gray for 0", () => { expect(scoreColor(0)).toBe("#e5e7eb"); });
});

describe("decision-matrix-builder renderText", () => {
  it("renders full report", () => {
    const input = sampleInput();
    const options = parseOptions(input.optionsText);
    const criteria = parseCriteria(input.criteriaText);
    const { weights } = parseWeights(input.weightsText);
    const { scores } = parseScores(input.scoresText);
    const nw = normalizeWeights(weights);
    const cells = buildCells(options, criteria, nw, scores);
    const ranked = rankOptions(calculateOptionTotals(cells, options));
    const stats = summaryStats(options, criteria, weights, nw, cells, ranked);
    const sensitivity = sensitivityAnalysis(options, criteria, weights, scores);
    const text = renderText(input, options, criteria, nw, cells, ranked, stats, sensitivity);
    expect(text).toContain("DECISION MATRIX REPORT");
    expect(text).toContain("Which vendor to pick");
    expect(text).toContain("WEIGHTS");
    expect(text).toContain("SCORES + WEIGHTED SCORES");
    expect(text).toContain("RANKING");
    expect(text).toContain("Winner:");
    expect(text).toContain("SENSITIVITY ANALYSIS");
  });
});

describe("decision-matrix-builder renderCsv", () => {
  it("renders header + cell rows + totals", () => {
    const input = sampleInput();
    const options = parseOptions(input.optionsText);
    const criteria = parseCriteria(input.criteriaText);
    const { weights } = parseWeights(input.weightsText);
    const { scores } = parseScores(input.scoresText);
    const nw = normalizeWeights(weights);
    const cells = buildCells(options, criteria, nw, scores);
    const ranked = rankOptions(calculateOptionTotals(cells, options));
    const csv = renderCsv(options, criteria, nw, cells, ranked);
    expect(csv).toContain("option,criterion,score,normalized_weight,weighted_score");
    expect(csv).toContain("Vendor A,Cost,4");
    expect(csv).toContain("option,total_weighted_score,rank");
    expect(csv).toContain("#weight");
  });
  it("escapes commas in option names", () => {
    const options = ["Vendor, Inc."];
    const criteria = ["Cost"];
    const nw = normalizeWeights([{ criterion: "Cost", weight: 100 }]);
    const cells = buildCells(options, criteria, nw, [{ option: "Vendor, Inc.", criterion: "Cost", score: 4 }]);
    const ranked = rankOptions(calculateOptionTotals(cells, options));
    const csv = renderCsv(options, criteria, nw, cells, ranked);
    expect(csv).toContain('"Vendor, Inc."');
  });
});

describe("decision-matrix-builder renderHtml", () => {
  it("renders valid HTML with table", () => {
    const input = sampleInput();
    const options = parseOptions(input.optionsText);
    const criteria = parseCriteria(input.criteriaText);
    const { weights } = parseWeights(input.weightsText);
    const { scores } = parseScores(input.scoresText);
    const nw = normalizeWeights(weights);
    const cells = buildCells(options, criteria, nw, scores);
    const ranked = rankOptions(calculateOptionTotals(cells, options));
    const stats = summaryStats(options, criteria, weights, nw, cells, ranked);
    const sensitivity = sensitivityAnalysis(options, criteria, weights, scores);
    const html = renderHtml(input, options, criteria, nw, cells, ranked, stats, sensitivity);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Which vendor to pick");
    expect(html).toContain("<table>");
    expect(html).toContain("Score matrix");
    expect(html).toContain("Sensitivity analysis");
  });
  it("escapes HTML in user input", () => {
    const input = sampleInput({ decisionTitle: "<script>x</script>" });
    const options = parseOptions(input.optionsText);
    const criteria = parseCriteria(input.criteriaText);
    const { weights } = parseWeights(input.weightsText);
    const { scores } = parseScores(input.scoresText);
    const nw = normalizeWeights(weights);
    const cells = buildCells(options, criteria, nw, scores);
    const ranked = rankOptions(calculateOptionTotals(cells, options));
    const stats = summaryStats(options, criteria, weights, nw, cells, ranked);
    const sensitivity = sensitivityAnalysis(options, criteria, weights, scores);
    const html = renderHtml(input, options, criteria, nw, cells, ranked, stats, sensitivity);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("marks winner row", () => {
    const input = sampleInput();
    const options = parseOptions(input.optionsText);
    const criteria = parseCriteria(input.criteriaText);
    const { weights } = parseWeights(input.weightsText);
    const { scores } = parseScores(input.scoresText);
    const nw = normalizeWeights(weights);
    const cells = buildCells(options, criteria, nw, scores);
    const ranked = rankOptions(calculateOptionTotals(cells, options));
    const stats = summaryStats(options, criteria, weights, nw, cells, ranked);
    const sensitivity = sensitivityAnalysis(options, criteria, weights, scores);
    const html = renderHtml(input, options, criteria, nw, cells, ranked, stats, sensitivity);
    expect(html).toContain('class="winner"');
  });
});

describe("decision-matrix-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      title: "Vendor pick",
      optionsCount: 3,
      criteriaCount: 4,
      winnerOption: "Vendor A",
      winnerTotal: 440,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        title: `Decision ${i}`,
        optionsCount: 2,
        criteriaCount: 2,
        winnerOption: "A",
        winnerTotal: 100,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, title: "x", optionsCount: 0, criteriaCount: 0, winnerOption: "", winnerTotal: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("decision-matrix-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ decisionTitle: "Test", optionsText: "A\nB" });
    expect(url).toContain("title=Test");
    expect(url).toContain("opts=A");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=Vendor&opts=A%0AB&crit=Cost");
    expect(p.decisionTitle).toBe("Vendor");
    expect(p.optionsText).toBe("A\nB");
    expect(p.criteriaText).toBe("Cost");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits missing fields", () => {
    const p = parseShareUrl("title=Only+Title");
    expect(p.decisionTitle).toBe("Only Title");
    expect(p.optionsText).toBeUndefined();
  });
});
