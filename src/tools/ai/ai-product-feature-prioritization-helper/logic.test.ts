import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  FRAMEWORKS,
  IMPACT_VALUES,
  CONFIDENCE_PRESETS,
  MOSCOW_CATEGORIES,
  MOSCOW_RANK,
  SENSITIVITY_FIELDS,
  HONESTY_NOTES,
  SAMPLE_BACKLOGS,
  DEFAULT_FEATURE,
  newFeatureId,
  createFeature,
  clampNum,
  validateFeature,
  calculateRice,
  calculateIce,
  calculateWsjf,
  scoreFeature,
  rankFeatures,
  sortScored,
  computeStats,
  sensitivityAnalysis,
  renderCsv,
  renderMarkdown,
  parseFeaturesCsv,
  splitCsvRow,
  buildLlmPrompt,
  renderLlmResult,
  applyLlmDraft,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Feature,
  type Framework,
  type Impact,
  type MoscowCategory,
  type SortKey,
  type SortDir,
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

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return { ...DEFAULT_FEATURE, id: newFeatureId(), name: "Test feature", ...overrides };
}

const SAMPLE_BACKLOG = SAMPLE_BACKLOGS[0].features;

describe("ai-product-feature-prioritization-helper constants", () => {
  it("has 4 frameworks with formulas", () => {
    expect(FRAMEWORKS).toHaveLength(4);
    expect(FRAMEWORKS.map((f) => f.value)).toEqual(["rice", "ice", "moscow", "wsjf"]);
    expect(FRAMEWORKS.every((f) => f.formula.length > 0)).toBe(true);
  });
  it("has 5 impact values (0.25–3)", () => {
    expect(IMPACT_VALUES).toHaveLength(5);
    expect(IMPACT_VALUES.map((i) => i.value)).toEqual([0.25, 0.5, 1, 2, 3]);
  });
  it("has 3 confidence presets", () => {
    expect(CONFIDENCE_PRESETS).toEqual([50, 80, 100]);
  });
  it("has 4 MoSCoW categories", () => {
    expect(MOSCOW_CATEGORIES).toHaveLength(4);
    expect(MOSCOW_CATEGORIES.map((c) => c.value)).toEqual(["must", "should", "could", "wont"]);
  });
  it("MoSCoW rank order is must < should < could < wont", () => {
    expect(MOSCOW_RANK.must).toBeLessThan(MOSCOW_RANK.should);
    expect(MOSCOW_RANK.should).toBeLessThan(MOSCOW_RANK.could);
    expect(MOSCOW_RANK.could).toBeLessThan(MOSCOW_RANK.wont);
  });
  it("has 4 sensitivity fields", () => {
    expect(SENSITIVITY_FIELDS).toHaveLength(4);
  });
  it("has honesty notes", () => {
    expect(HONESTY_NOTES.length).toBeGreaterThanOrEqual(3);
  });
  it("has 3 sample backlogs", () => {
    expect(SAMPLE_BACKLOGS).toHaveLength(3);
  });
  it("sample SaaS backlog has 5 features", () => {
    expect(SAMPLE_BACKLOGS[0].features).toHaveLength(5);
  });
  it("HISTORY_MAX is 20", () => { expect(HISTORY_MAX).toBe(20); });
  it("DEFAULT_FEATURE has sensible defaults", () => {
    expect(DEFAULT_FEATURE.impact).toBe(1);
    expect(DEFAULT_FEATURE.confidence).toBe(80);
    expect(DEFAULT_FEATURE.effort).toBe(5);
    expect(DEFAULT_FEATURE.moscow).toBe("should");
  });
});

describe("ai-product-feature-prioritization-helper newFeatureId", () => {
  it("generates unique IDs", () => {
    const a = newFeatureId();
    const b = newFeatureId();
    expect(a).not.toBe(b);
  });
  it("creates a feature with defaults", () => {
    const f = createFeature("Dark mode", "Toggle dark theme");
    expect(f.name).toBe("Dark mode");
    expect(f.description).toBe("Toggle dark theme");
    expect(f.id).toBeTruthy();
    expect(f.impact).toBe(1);
  });
});

describe("ai-product-feature-prioritization-helper clampNum", () => {
  it("clamps to min", () => { expect(clampNum(-5, 0, 10)).toBe(0); });
  it("clamps to max", () => { expect(clampNum(15, 0, 10)).toBe(10); });
  it("preserves in-range value", () => { expect(clampNum(5, 0, 10)).toBe(5); });
  it("handles NaN by returning min", () => { expect(clampNum(NaN, 0, 10)).toBe(0); });
});

describe("ai-product-feature-prioritization-helper validateFeature", () => {
  it("accepts a valid feature", () => {
    expect(validateFeature(makeFeature())).toEqual([]);
  });
  it("flags missing name", () => {
    const errs = validateFeature(makeFeature({ name: "" }));
    expect(errs.some((e) => e.includes("Name"))).toBe(true);
  });
  it("flags negative reach", () => {
    const errs = validateFeature(makeFeature({ reach: -1 }));
    expect(errs.some((e) => e.includes("Reach"))).toBe(true);
  });
  it("flags invalid impact", () => {
    const errs = validateFeature(makeFeature({ impact: 7 as unknown as Impact }));
    expect(errs.some((e) => e.includes("Impact"))).toBe(true);
  });
  it("flags confidence > 100", () => {
    const errs = validateFeature(makeFeature({ confidence: 150 }));
    expect(errs.some((e) => e.includes("Confidence"))).toBe(true);
  });
  it("flags negative effort", () => {
    const errs = validateFeature(makeFeature({ effort: -2 }));
    expect(errs.some((e) => e.includes("Effort"))).toBe(true);
  });
  it("flags invalid MoSCoW", () => {
    const errs = validateFeature(makeFeature({ moscow: "banana" as unknown as MoscowCategory }));
    expect(errs.some((e) => e.includes("MoSCoW"))).toBe(true);
  });
  it("flags non-positive jobSize", () => {
    const errs = validateFeature(makeFeature({ jobSize: 0 }));
    expect(errs.some((e) => e.includes("Job size"))).toBe(true);
  });
});

describe("ai-product-feature-prioritization-helper calculateRice", () => {
  it("computes RICE = (R × I × C) ÷ E", () => {
    const f = makeFeature({ reach: 1000, impact: 1, confidence: 80, effort: 5 });
    // (1000 × 1 × 0.8) ÷ 5 = 160
    expect(calculateRice(f)).toBe(160);
  });
  it("uses 0.5 impact correctly", () => {
    const f = makeFeature({ reach: 1000, impact: 0.5, confidence: 100, effort: 5 });
    // (1000 × 0.5 × 1) ÷ 5 = 100
    expect(calculateRice(f)).toBe(100);
  });
  it("uses 3 impact correctly", () => {
    const f = makeFeature({ reach: 100, impact: 3, confidence: 100, effort: 4 });
    // (100 × 3 × 1) ÷ 4 = 75
    expect(calculateRice(f)).toBe(75);
  });
  it("returns 0 when effort is 0 (divide-by-zero guard)", () => {
    const f = makeFeature({ reach: 1000, impact: 3, confidence: 100, effort: 0 });
    expect(calculateRice(f)).toBe(0);
  });
  it("returns 0 when effort is negative", () => {
    const f = makeFeature({ reach: 1000, impact: 3, confidence: 100, effort: -1 });
    expect(calculateRice(f)).toBe(0);
  });
  it("scales with reach", () => {
    const a = calculateRice(makeFeature({ reach: 500, impact: 1, confidence: 100, effort: 5 }));
    const b = calculateRice(makeFeature({ reach: 1000, impact: 1, confidence: 100, effort: 5 }));
    expect(b).toBeGreaterThan(a);
  });
  it("scales inversely with effort", () => {
    const a = calculateRice(makeFeature({ reach: 1000, impact: 1, confidence: 100, effort: 10 }));
    const b = calculateRice(makeFeature({ reach: 1000, impact: 1, confidence: 100, effort: 2 }));
    expect(b).toBeGreaterThan(a);
  });
});

describe("ai-product-feature-prioritization-helper calculateIce", () => {
  it("computes ICE = Impact × Confidence × Ease", () => {
    // effort=5 → ease=11-5=6; impact=1, confidence=0.8 → 1×0.8×6 = 4.8
    const f = makeFeature({ reach: 1000, impact: 1, confidence: 80, effort: 5 });
    expect(calculateIce(f)).toBe(4.8);
  });
  it("low effort → high ease → higher ICE", () => {
    const highEffort = calculateIce(makeFeature({ effort: 9, impact: 1, confidence: 100 }));
    const lowEffort = calculateIce(makeFeature({ effort: 1, impact: 1, confidence: 100 }));
    expect(lowEffort).toBeGreaterThan(highEffort);
  });
  it("clamps effort to 1–10 for ease calc", () => {
    // effort=20 → clamped to 10 → ease=1; impact=1, conf=1 → 1
    const f = makeFeature({ effort: 20, impact: 1, confidence: 100 });
    expect(calculateIce(f)).toBe(1);
  });
});

describe("ai-product-feature-prioritization-helper calculateWsjf", () => {
  it("computes WSJF = Cost of Delay ÷ Job Size", () => {
    const f = makeFeature({ costOfDelay: 30, jobSize: 5 });
    // 30 ÷ 5 = 6
    expect(calculateWsjf(f)).toBe(6);
  });
  it("returns 0 when jobSize is 0", () => {
    expect(calculateWsjf(makeFeature({ costOfDelay: 30, jobSize: 0 }))).toBe(0);
  });
  it("returns 0 when jobSize is negative", () => {
    expect(calculateWsjf(makeFeature({ costOfDelay: 30, jobSize: -2 }))).toBe(0);
  });
});

describe("ai-product-feature-prioritization-helper scoreFeature", () => {
  it("returns all three scores", () => {
    const s = scoreFeature(makeFeature({ reach: 1000, impact: 1, confidence: 100, effort: 5, costOfDelay: 10, jobSize: 5 }));
    expect(s.rice).toBeGreaterThan(0);
    expect(s.ice).toBeGreaterThan(0);
    expect(s.wsjf).toBeGreaterThan(0);
  });
});

describe("ai-product-feature-prioritization-helper rankFeatures", () => {
  it("ranks by RICE desc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    expect(ranked).toHaveLength(SAMPLE_BACKLOG.length);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    // Higher RICE first.
    expect(ranked[0].rice).toBeGreaterThanOrEqual(ranked[1].rice);
  });
  it("ranks by ICE desc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "ice");
    expect(ranked[0].ice).toBeGreaterThanOrEqual(ranked[1].ice);
  });
  it("ranks by WSJF desc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "wsjf");
    expect(ranked[0].wsjf).toBeGreaterThanOrEqual(ranked[1].wsjf);
  });
  it("ranks by MoSCoW order (must first, wont last)", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "moscow");
    // First must be must, last must be wont (or lowest MoSCoW).
    expect(ranked[0].feature.moscow).toBe("must");
  });
  it("assigns sequential ranks 1..N", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    for (let i = 0; i < ranked.length; i++) {
      expect(ranked[i].rank).toBe(i + 1);
    }
  });
  it("returns empty for empty list", () => {
    expect(rankFeatures([], "rice")).toEqual([]);
  });
  it("ranks single feature as rank 1", () => {
    const ranked = rankFeatures([SAMPLE_BACKLOG[0]], "rice");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
  });
});

describe("ai-product-feature-prioritization-helper sortScored", () => {
  it("sorts by name asc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    const sorted = sortScored(ranked, "name", "asc");
    expect(sorted[0].feature.name.toLowerCase() <= sorted[1].feature.name.toLowerCase()).toBe(true);
  });
  it("sorts by effort asc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    const sorted = sortScored(ranked, "effort", "asc");
    expect(sorted[0].feature.effort).toBeLessThanOrEqual(sorted[1].feature.effort);
  });
  it("sorts by effort desc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    const sorted = sortScored(ranked, "effort", "desc");
    expect(sorted[0].feature.effort).toBeGreaterThanOrEqual(sorted[1].feature.effort);
  });
  it("preserves length", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    const sorted = sortScored(ranked, "ice", "desc");
    expect(sorted).toHaveLength(ranked.length);
  });
  it("sorts by rank asc", () => {
    const ranked = rankFeatures(SAMPLE_BACKLOG, "rice");
    const sorted = sortScored(ranked, "rank", "asc");
    expect(sorted[0].rank).toBe(1);
    expect(sorted[sorted.length - 1].rank).toBe(ranked.length);
  });
});

describe("ai-product-feature-prioritization-helper computeStats", () => {
  it("computes count and totals", () => {
    const stats = computeStats(SAMPLE_BACKLOG, "rice");
    expect(stats.count).toBe(SAMPLE_BACKLOG.length);
    expect(stats.totalEffort).toBeGreaterThan(0);
    expect(stats.avgRice).toBeGreaterThan(0);
  });
  it("identifies top and bottom features", () => {
    const stats = computeStats(SAMPLE_BACKLOG, "rice");
    expect(stats.topFeature).toBeTruthy();
    expect(stats.bottomFeature).toBeTruthy();
    expect(stats.topFeature).not.toBe(stats.bottomFeature);
  });
  it("counts MoSCoW categories", () => {
    const stats = computeStats(SAMPLE_BACKLOG, "rice");
    const total = stats.mustCount + stats.shouldCount + stats.couldCount + stats.wontCount;
    expect(total).toBe(SAMPLE_BACKLOG.length);
  });
  it("returns zeros for empty list", () => {
    const stats = computeStats([], "rice");
    expect(stats.count).toBe(0);
    expect(stats.avgRice).toBe(0);
    expect(stats.topFeature).toBeNull();
    expect(stats.bottomFeature).toBeNull();
  });
});

describe("ai-product-feature-prioritization-helper sensitivityAnalysis", () => {
  it("returns base rank order", () => {
    const result = sensitivityAnalysis(SAMPLE_BACKLOG, "rice", "reach", [100, 1000, 5000]);
    expect(result.baseRankOrder).toHaveLength(SAMPLE_BACKLOG.length);
    expect(result.variations).toHaveLength(3);
  });
  it("detects rank changes when varying effort", () => {
    // Varying effort from 1 to 50 should change rank order.
    const result = sensitivityAnalysis(SAMPLE_BACKLOG, "rice", "effort", [1, 5, 20, 50]);
    expect(result.variations.some((v) => v.changed)).toBe(true);
  });
  it("variations with equal values produce equal rank orders", () => {
    // When we set every feature to the same reach value, both variations produce the same rank order.
    const result = sensitivityAnalysis(SAMPLE_BACKLOG, "rice", "reach", [100, 100]);
    expect(result.variations[0].rankOrder).toEqual(result.variations[1].rankOrder);
  });
  it("returns empty base for empty features", () => {
    const result = sensitivityAnalysis([], "rice", "reach", [100]);
    expect(result.baseRankOrder).toEqual([]);
    expect(result.variations).toHaveLength(1);
  });
});

describe("ai-product-feature-prioritization-helper renderCsv", () => {
  it("renders header + rows", () => {
    const csv = renderCsv(SAMPLE_BACKLOG, "rice");
    expect(csv.split("\n")[0]).toContain("rank,name,framework_score");
    expect(csv.split("\n").length).toBe(SAMPLE_BACKLOG.length + 1);
  });
  it("includes rank and name", () => {
    const csv = renderCsv(SAMPLE_BACKLOG, "rice");
    const firstRow = csv.split("\n")[1];
    expect(firstRow.startsWith("1,")).toBe(true);
  });
  it("escapes commas in description", () => {
    const features = [makeFeature({ name: "Test", description: "Has, comma" })];
    const csv = renderCsv(features, "rice");
    expect(csv).toContain('"Has, comma"');
  });
  it("handles empty list", () => {
    const csv = renderCsv([], "rice");
    expect(csv.split("\n").length).toBe(1); // just header
  });
});

describe("ai-product-feature-prioritization-helper renderMarkdown", () => {
  it("includes framework title and formula", () => {
    const md = renderMarkdown(SAMPLE_BACKLOG, "rice");
    expect(md).toContain("# Feature Prioritization — RICE");
    expect(md).toContain("Reach × Impact × Confidence");
  });
  it("includes table header", () => {
    const md = renderMarkdown(SAMPLE_BACKLOG, "ice");
    expect(md).toContain("| Rank | Name | Score |");
  });
  it("includes one row per feature plus header", () => {
    const md = renderMarkdown(SAMPLE_BACKLOG, "wsjf");
    // Filter rows that start with "| " (header + data, but not the separator "|---").
    const rows = md.split("\n").filter((l) => l.startsWith("| "));
    // 1 header row + N data rows.
    expect(rows.length).toBe(SAMPLE_BACKLOG.length + 1);
  });
});

describe("ai-product-feature-prioritization-helper parseFeaturesCsv / splitCsvRow", () => {
  const CSV = `rank,name,reach,impact,confidence,effort,moscow,description
1,Dark mode,5000,0.5,100,3,should,Toggle theme
2,SSO,200,3,80,8,must,SAML login`;

  it("parses CSV with header", () => {
    const features = parseFeaturesCsv(CSV);
    expect(features).toHaveLength(2);
    expect(features[0].name).toBe("Dark mode");
    expect(features[1].name).toBe("SSO");
  });
  it("parses reach and impact", () => {
    const features = parseFeaturesCsv(CSV);
    expect(features[0].reach).toBe(5000);
    expect(features[0].impact).toBe(0.5);
    expect(features[1].impact).toBe(3);
  });
  it("coerces invalid impact to 1", () => {
    const csv = `rank,name,reach,impact,confidence,effort,moscow
1,X,100,99,80,5,should`;
    const features = parseFeaturesCsv(csv);
    expect(features[0].impact).toBe(1);
  });
  it("coerces invalid MoSCoW to should", () => {
    const csv = `rank,name,reach,impact,confidence,effort,moscow
1,X,100,1,80,5,banana`;
    const features = parseFeaturesCsv(csv);
    expect(features[0].moscow).toBe("should");
  });
  it("clamps confidence to 0-100", () => {
    const csv = `rank,name,reach,impact,confidence,effort,moscow
1,X,100,1,150,5,should`;
    const features = parseFeaturesCsv(csv);
    expect(features[0].confidence).toBe(100);
  });
  it("returns empty for empty CSV", () => {
    expect(parseFeaturesCsv("")).toEqual([]);
  });
  it("splitCsvRow handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("splitCsvRow handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("ai-product-feature-prioritization-helper buildLlmPrompt", () => {
  it("includes feature name and description", () => {
    const f = makeFeature({ name: "SSO", description: "SAML login for enterprise" });
    const prompt = buildLlmPrompt(f);
    expect(prompt).toContain("SSO");
    expect(prompt).toContain("SAML login");
  });
  it("specifies exact response format", () => {
    const prompt = buildLlmPrompt(makeFeature());
    expect(prompt).toContain("Reach:");
    expect(prompt).toContain("Impact:");
    expect(prompt).toContain("Confidence:");
    expect(prompt).toContain("Effort:");
  });
});

describe("ai-product-feature-prioritization-helper renderLlmResult", () => {
  it("parses well-formed LLM output", () => {
    const out = `Reach: 2500
Impact: 2
Confidence: 80
Effort: 6
Rationale: High reach for enterprise customers, mid confidence due to SAML complexity.`;
    const r = renderLlmResult(out);
    expect(r.reach).toBe(2500);
    expect(r.impact).toBe(2);
    expect(r.confidence).toBe(80);
    expect(r.effort).toBe(6);
    expect(r.rationale).toContain("High reach");
    expect(r.warnings).toEqual([]);
  });
  it("flags invalid impact value", () => {
    const out = `Reach: 1000\nImpact: 99\nConfidence: 80\nEffort: 5`;
    const r = renderLlmResult(out);
    expect(r.impact).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("clamps confidence above 100", () => {
    const out = `Reach: 1000\nImpact: 1\nConfidence: 150\nEffort: 5`;
    const r = renderLlmResult(out);
    expect(r.confidence).toBe(100);
  });
  it("warns on missing fields", () => {
    const out = `Rationale: nothing parsed.`;
    const r = renderLlmResult(out);
    expect(r.reach).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.effort).toBeNull();
    expect(r.warnings.length).toBe(3);
  });
  it("handles empty output", () => {
    const r = renderLlmResult("");
    expect(r.reach).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-product-feature-prioritization-helper applyLlmDraft", () => {
  it("applies draft values to feature", () => {
    const f = makeFeature({ reach: 100, impact: 0.5, confidence: 50, effort: 10 });
    const draft = {
      reach: 2000, impact: 2 as Impact, confidence: 80, effort: 5,
      rationale: "test", warnings: [],
    };
    const updated = applyLlmDraft(f, draft);
    expect(updated.reach).toBe(2000);
    expect(updated.impact).toBe(2);
    expect(updated.confidence).toBe(80);
    expect(updated.effort).toBe(5);
  });
  it("preserves existing values when draft is null", () => {
    const f = makeFeature({ reach: 100, impact: 1, confidence: 80, effort: 5 });
    const draft = {
      reach: null, impact: null, confidence: null, effort: null,
      rationale: "", warnings: [],
    };
    const updated = applyLlmDraft(f, draft);
    expect(updated.reach).toBe(100);
    expect(updated.impact).toBe(1);
  });
});

describe("ai-product-feature-prioritization-helper history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, framework: "rice", featureCount: 5,
      topFeature: "Dark mode", avgRice: 100,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].topFeature).toBe("Dark mode");
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i, framework: "rice", featureCount: 1,
        topFeature: `F${i}`, avgRice: 50,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, framework: "rice", featureCount: 1,
      topFeature: "X", avgRice: 50,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry is first", () => {
    saveHistory({
      ts: 100, framework: "rice", featureCount: 1,
      topFeature: "First", avgRice: 50,
    });
    saveHistory({
      ts: 200, framework: "rice", featureCount: 1,
      topFeature: "Second", avgRice: 50,
    });
    const h = loadHistory();
    expect(h[0].topFeature).toBe("Second");
  });
});

describe("ai-product-feature-prioritization-helper share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(SAMPLE_BACKLOG, "rice");
    expect(url).toContain("fw=rice");
    expect(url).toContain("items=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips share URL", () => {
    const url = buildShareUrl(SAMPLE_BACKLOG, "wsjf");
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.framework).toBe("wsjf");
    expect(parsed.features).toHaveLength(SAMPLE_BACKLOG.length);
    expect(parsed.features[0].name).toBe(SAMPLE_BACKLOG[0].name);
    expect(parsed.features[0].reach).toBe(SAMPLE_BACKLOG[0].reach);
    expect(parsed.features[0].impact).toBe(SAMPLE_BACKLOG[0].impact);
    expect(parsed.features[0].moscow).toBe(SAMPLE_BACKLOG[0].moscow);
  });
  it("parses empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.framework).toBe("rice");
    expect(parsed.features).toEqual([]);
  });
  it("filters invalid framework to rice", () => {
    const parsed = parseShareUrl("fw=banana");
    expect(parsed.framework).toBe("rice");
  });
  it("filters invalid impact to 1", () => {
    const parsed = parseShareUrl("fw=rice&items=Test|1000|99|80|5|should");
    expect(parsed.features[0].impact).toBe(1);
  });
  it("filters invalid MoSCoW to should", () => {
    const parsed = parseShareUrl("fw=rice&items=Test|1000|1|80|5|banana");
    expect(parsed.features[0].moscow).toBe("should");
  });
  it("empty items returns empty features list", () => {
    const parsed = parseShareUrl("fw=ice");
    expect(parsed.features).toEqual([]);
  });
  it("skips malformed item entries", () => {
    const parsed = parseShareUrl("fw=rice&items=Test|1000"); // only 2 cols, < 6
    expect(parsed.features).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = Framework | SortKey | SortDir | Impact | MoscowCategory;
