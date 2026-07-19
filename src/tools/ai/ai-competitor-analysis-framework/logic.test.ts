import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  FRAMEWORK_LABELS,
  PORTER_FORCE_LABELS,
  FORCE_LEVEL_LABELS,
  AXIS_LABELS,
  FIELD_HINTS,
  validateInputs,
  splitLines,
  normalizeName,
  deriveSwot,
  buildSwots,
  buildFeatureMatrix,
  buildPorter,
  estimateAxis,
  buildPositioningMap,
  deriveWhiteSpace,
  generate,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type AnalysisInputs,
  type CompetitorInputs,
  type PositioningAxis,
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

const COMP_A: CompetitorInputs = {
  name: "Acme Analytics",
  strengths: "Strong enterprise brand\n200+ integrations\nISO 27001 certified",
  weaknesses: "Slow UI\nNo free tier\nPricey for SMBs",
  pricing: "$$$",
  features: "Dashboards\nFunnels\nCohorts\nSQL explorer",
};

const COMP_B: CompetitorInputs = {
  name: "Beta Insights",
  strengths: "Easy to use\nAffordable\nGreat docs",
  weaknesses: "Limited enterprise features\nFew integrations",
  pricing: "$",
  features: "Dashboards\nFunnels\nAlerts",
};

const YOUR_CO: CompetitorInputs = {
  name: "UnQlytics",
  strengths: "Fast UI\nNo-code dashboards\nFree tier",
  weaknesses: "Fewer integrations than Acme\nNewer brand",
  pricing: "$$",
  features: "Dashboards\nFunnels\nCohorts\nNo-code builder\nLive collaboration",
};

const FULL_INPUTS: AnalysisInputs = {
  yourCompany: YOUR_CO,
  competitors: [COMP_A, COMP_B],
  industry: "B2B product analytics SaaS",
  marketNotes: "Market growing 18% YoY\nMid-market segment underserved\nConsolidation wave underway",
};

describe("competitor-analysis constants & hints", () => {
  it("has 4 frameworks", () => {
    expect(Object.keys(FRAMEWORK_LABELS)).toHaveLength(4);
  });
  it("has 5 Porter forces", () => {
    expect(Object.keys(PORTER_FORCE_LABELS)).toHaveLength(5);
  });
  it("has 3 force levels", () => {
    expect(Object.keys(FORCE_LEVEL_LABELS)).toHaveLength(3);
  });
  it("has 5 positioning axes", () => {
    expect(Object.keys(AXIS_LABELS)).toHaveLength(5);
  });
  it("has hints for all expected fields", () => {
    const expected = [
      "industry", "marketNotes", "competitorName",
      "strengths", "weaknesses", "pricing", "features",
    ];
    for (const k of expected) {
      expect(FIELD_HINTS[k]).toBeTruthy();
      expect(FIELD_HINTS[k].hint.length).toBeGreaterThan(5);
    }
  });
  it("exposes storage constants", () => {
    expect(HISTORY_KEY).toContain("ai-competitor-analysis-framework");
    expect(HISTORY_MAX).toBe(20);
    expect(LLM_KEY_STORAGE).toContain("ai-competitor-analysis-framework");
  });
});

describe("competitor-analysis helpers", () => {
  it("splitLines returns empty for empty input", () => {
    expect(splitLines("")).toEqual([]);
  });
  it("splitLines trims and filters blanks", () => {
    expect(splitLines("  a  \n\nb\n  ")).toEqual(["a", "b"]);
  });
  it("normalizeName collapses whitespace", () => {
    expect(normalizeName("  Acme   Analytics  ")).toBe("Acme Analytics");
  });
  it("normalizeName returns empty for empty", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("competitor-analysis validation", () => {
  it("flags missing your-company name", () => {
    const w = validateInputs({
      yourCompany: { ...YOUR_CO, name: "" },
      competitors: [COMP_A],
      industry: "X",
      marketNotes: "",
    });
    expect(w.some((x) => x.includes("Your company name"))).toBe(true);
  });
  it("flags no competitors", () => {
    const w = validateInputs({
      yourCompany: YOUR_CO,
      competitors: [],
      industry: "X",
      marketNotes: "",
    });
    expect(w.some((x) => x.includes("at least one competitor"))).toBe(true);
  });
  it("flags competitor with no name but content", () => {
    const w = validateInputs({
      yourCompany: YOUR_CO,
      competitors: [{ name: "", strengths: "x", weaknesses: "", pricing: "", features: "" }],
      industry: "X",
      marketNotes: "",
    });
    expect(w.some((x) => x.includes("competitor needs a name"))).toBe(true);
  });
  it("flags competitor with no notes", () => {
    const w = validateInputs({
      yourCompany: YOUR_CO,
      competitors: [{ name: "Ghost", strengths: "", weaknesses: "", pricing: "", features: "" }],
      industry: "X",
      marketNotes: "",
    });
    expect(w.some((x) => x.includes("Ghost"))).toBe(true);
  });
  it("passes clean inputs with no warnings", () => {
    expect(validateInputs(FULL_INPUTS)).toEqual([]);
  });
});

describe("competitor-analysis SWOT", () => {
  it("deriveSwot produces strengths, weaknesses, opportunities, threats", () => {
    const s = deriveSwot(COMP_A, "Market growing 18%");
    expect(s.strengths).toContain("Strong enterprise brand");
    expect(s.weaknesses).toContain("Slow UI");
    expect(s.opportunities.length).toBe(3); // one per weakness
    expect(s.opportunities[0]).toContain("Slow UI");
    expect(s.threats.length).toBe(1);
    expect(s.threats[0]).toContain("Market growing");
  });
  it("deriveSwot adds placeholder threat when no market notes", () => {
    const s = deriveSwot(COMP_A, "");
    expect(s.threats.length).toBe(1);
    expect(s.threats[0]).toContain("market notes");
  });
  it("buildSwots includes your company + competitors", () => {
    const swots = buildSwots(FULL_INPUTS);
    expect(swots).toHaveLength(3);
    expect(swots[0].name).toBe("UnQlytics");
    expect(swots[1].name).toBe("Acme Analytics");
    expect(swots[2].name).toBe("Beta Insights");
  });
  it("buildSwots skips competitors with no name", () => {
    const swots = buildSwots({
      yourCompany: YOUR_CO,
      competitors: [{ name: "", strengths: "x", weaknesses: "", pricing: "", features: "" }, COMP_B],
      industry: "X",
      marketNotes: "",
    });
    expect(swots).toHaveLength(2); // you + Beta only
  });
});

describe("competitor-analysis feature matrix", () => {
  it("builds matrix with union of features", () => {
    const m = buildFeatureMatrix(FULL_INPUTS);
    expect(m.rows).toHaveLength(3);
    // union: dashboards, funnels, cohorts, sql explorer, alerts, no-code builder, live collaboration
    expect(m.featureNames.length).toBeGreaterThanOrEqual(6);
    expect(m.featureNames).toContain("dashboards");
    expect(m.featureNames).toContain("sql explorer");
    expect(m.featureNames).toContain("alerts");
  });
  it("marks feature presence correctly", () => {
    const m = buildFeatureMatrix(FULL_INPUTS);
    const acmeRow = m.rows.find((r) => r.competitor === "Acme Analytics")!;
    expect(acmeRow.features["dashboards"]).toBe(true);
    expect(acmeRow.features["no-code builder"]).toBeUndefined();
    expect(acmeRow.pricing).toBe("$$$");
  });
  it("includes pricing column", () => {
    const m = buildFeatureMatrix(FULL_INPUTS);
    expect(m.rows.every((r) => r.pricing.length > 0)).toBe(true);
  });
});

describe("competitor-analysis Porter", () => {
  it("produces 5 forces with levels", () => {
    const p = buildPorter(FULL_INPUTS);
    expect(p.forces).toHaveLength(5);
    for (const f of p.forces) {
      expect(["low", "medium", "high"]).toContain(f.level);
      expect(f.notes.length).toBeGreaterThan(0);
    }
  });
  it("rates rivalry based on competitor count (medium for 2)", () => {
    const p = buildPorter(FULL_INPUTS);
    const r = p.forces.find((f) => f.force === "rivalry")!;
    expect(r.level).toBe("medium");
  });
  it("rates rivalry high for 5+ competitors", () => {
    const comps = Array.from({ length: 5 }, (_, i) => ({ ...COMP_A, name: `C${i}` }));
    const p = buildPorter({ ...FULL_INPUTS, competitors: comps });
    expect(p.forces.find((f) => f.force === "rivalry")!.level).toBe("high");
  });
  it("overall attractiveness is computed", () => {
    const p = buildPorter(FULL_INPUTS);
    expect(["high", "medium", "low"]).toContain(p.overallAttractiveness);
    expect(p.summary.length).toBeGreaterThan(10);
  });
  it("references weaknesses in substitutes notes", () => {
    const p = buildPorter(FULL_INPUTS);
    const sub = p.forces.find((f) => f.force === "substitutes")!;
    expect(sub.notes.toLowerCase()).toContain("weakness");
  });
});

describe("competitor-analysis positioning map", () => {
  it("estimateAxis returns 0..100", () => {
    const v = estimateAxis(COMP_A, "price");
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
  it("estimateAxis returns high price for $$$", () => {
    expect(estimateAxis({ ...COMP_A, pricing: "$$$" }, "price")).toBe(70);
    expect(estimateAxis({ ...COMP_A, pricing: "$$$$" }, "price")).toBe(90);
    expect(estimateAxis({ ...COMP_A, pricing: "$" }, "price")).toBe(25);
    expect(estimateAxis({ ...COMP_A, pricing: "free" }, "price")).toBe(10);
  });
  it("estimateAxis boosts quality for 'quality' in strengths", () => {
    const v = estimateAxis({ ...COMP_A, strengths: "High quality\nPremium", weaknesses: "" }, "quality");
    expect(v).toBeGreaterThan(50);
  });
  it("estimateAxis penalizes ease-of-use for 'complex' weakness", () => {
    const v = estimateAxis({ ...COMP_A, weaknesses: "Complex\nClunky" }, "ease-of-use");
    expect(v).toBeLessThan(50);
  });
  it("estimateAxis enterprise-smb returns high for enterprise strengths", () => {
    const v = estimateAxis({ ...COMP_A, strengths: "Enterprise\nFortune 500" }, "enterprise-smb");
    expect(v).toBeGreaterThan(70);
  });
  it("buildPositioningMap plots you + competitors", () => {
    const m = buildPositioningMap(FULL_INPUTS, "price", "quality");
    expect(m.points).toHaveLength(3);
    expect(m.points[0].isYou).toBe(true);
    expect(m.points[0].name).toBe("UnQlytics");
  });
  it("buildPositioningMap produces white-space callouts", () => {
    const m = buildPositioningMap(FULL_INPUTS, "price", "quality");
    expect(m.whiteSpace.length).toBeGreaterThan(0);
  });
  it("buildPositioningMap uses axis labels", () => {
    const m = buildPositioningMap(FULL_INPUTS, "ease-of-use", "niche-breadth");
    expect(m.xAxis).toBe("ease-of-use");
    expect(m.yAxis).toBe("niche-breadth");
  });
});

describe("competitor-analysis white space", () => {
  it("derives opportunities from matrix and positioning", () => {
    const m = buildFeatureMatrix(FULL_INPUTS);
    const p = buildPositioningMap(FULL_INPUTS, "price", "quality");
    const ws = deriveWhiteSpace(m, p);
    expect(ws.length).toBeGreaterThan(0);
    const sources = new Set(ws.map((w) => w.source));
    expect(sources.has("positioning")).toBe(true);
  });
  it("each opportunity cites a rationale", () => {
    const m = buildFeatureMatrix(FULL_INPUTS);
    const p = buildPositioningMap(FULL_INPUTS, "price", "quality");
    const ws = deriveWhiteSpace(m, p);
    for (const w of ws) {
      expect(w.title.length).toBeGreaterThan(0);
      expect(w.rationale.length).toBeGreaterThan(10);
    }
  });
});

describe("competitor-analysis generate (top-level)", () => {
  it("returns all sections", () => {
    const out = generate(FULL_INPUTS);
    expect(out.swots).toHaveLength(3);
    expect(out.featureMatrix.rows).toHaveLength(3);
    expect(out.porter.forces).toHaveLength(5);
    expect(out.positioningMap.points).toHaveLength(3);
    expect(out.whiteSpace.length).toBeGreaterThan(0);
    expect(out.warnings).toEqual([]);
  });
  it("returns warnings for thin inputs", () => {
    const out = generate({
      yourCompany: { name: "", strengths: "", weaknesses: "", pricing: "", features: "" },
      competitors: [],
      industry: "",
      marketNotes: "",
    });
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});

describe("competitor-analysis render functions", () => {
  it("renderMarkdown includes all sections", () => {
    const out = generate(FULL_INPUTS);
    const md = renderMarkdown(out, FULL_INPUTS);
    expect(md).toContain("# Competitive Analysis");
    expect(md).toContain("## SWOT (per company)");
    expect(md).toContain("## Feature / Pricing Matrix");
    expect(md).toContain("## Porter's Five Forces");
    expect(md).toContain("## Positioning Map");
    expect(md).toContain("## White-space opportunities");
    expect(md).toContain("cannot browse");
  });
  it("renderJson is valid JSON", () => {
    const out = generate(FULL_INPUTS);
    const j = renderJson(out, FULL_INPUTS);
    const parsed = JSON.parse(j);
    expect(parsed.inputs).toBeTruthy();
    expect(parsed.output).toBeTruthy();
  });
  it("renderMarkdown handles no-feature case", () => {
    const out = generate({
      yourCompany: { name: "X", strengths: "s", weaknesses: "", pricing: "$", features: "" },
      competitors: [],
      industry: "Y",
      marketNotes: "",
    });
    const md = renderMarkdown(out, {
      yourCompany: { name: "X", strengths: "s", weaknesses: "", pricing: "$", features: "" },
      competitors: [],
      industry: "Y",
      marketNotes: "",
    });
    expect(md).toContain("No features provided");
  });
});

describe("competitor-analysis history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, yourCompany: "UnQlytics", competitorCount: 2, industry: "SaaS" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].yourCompany).toBe("UnQlytics");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, yourCompany: `c${i}`, competitorCount: 1, industry: "x" } as HistoryEntry);
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, yourCompany: "x", competitorCount: 0, industry: "y" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("competitor-analysis shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(FULL_INPUTS);
    expect(url).toContain("yname=UnQlytics");
    expect(url).toContain("ind=B2B");
    expect(url).toContain("comps=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(FULL_INPUTS);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p.inputs.yourCompany?.name).toBe("UnQlytics");
    expect(p.inputs.industry).toBe("B2B product analytics SaaS");
    expect(p.inputs.competitors).toBeTruthy();
    expect(p.inputs.competitors!.length).toBe(2);
    expect(p.inputs.competitors![0].name).toBe("Acme Analytics");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ inputs: {} });
  });
  it("ignores invalid comps JSON", () => {
    const p = parseShareUrl("comps=not-json");
    expect(p.inputs.competitors).toBeUndefined();
  });
  it("filters non-array comps", () => {
    const p = parseShareUrl("comps=%7B%22a%22%3A1%7D"); // {"a":1}
    expect(p.inputs.competitors).toBeUndefined();
  });
});

describe("competitor-analysis LLM prompt & result", () => {
  it("buildLlmPrompt includes company and competitor details", () => {
    const p = buildLlmPrompt(FULL_INPUTS);
    expect(p).toContain("UnQlytics");
    expect(p).toContain("Acme Analytics");
    expect(p).toContain("Beta Insights");
    expect(p).toContain("JSON");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      polishedSummary: "The market is consolidating.",
      polishedSwots: [{ name: "UnQlytics", opportunities: ["X"], threats: ["Y"] }],
      polishedPorterNotes: ["n1", "n2", "n3", "n4", "n5"],
      whiteSpaceIdeas: ["w1", "w2"],
      suggestions: ["s1"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedSummary).toContain("consolidating");
      expect(r.result.polishedSwots).toHaveLength(1);
      expect(r.result.polishedPorterNotes).toHaveLength(5);
      expect(r.result.whiteSpaceIdeas).toHaveLength(2);
    }
  });
  it("renderLlmResult handles ```json fences", () => {
    const raw = "```json\n" + JSON.stringify({ polishedSummary: "x", polishedSwots: [], polishedPorterNotes: [], whiteSpaceIdeas: [], suggestions: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult errors on bad JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
  it("renderLlmResult errors on non-object", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = PositioningAxis | HistoryEntry | CompetitorInputs;
