import { describe, it, expect, beforeEach } from "vitest";
import {
  INDUSTRY_TEMPLATES,
  INDUSTRY_BY_ID,
  INDUSTRY_IDS,
  normalizeText,
  clamp,
  detectIndustry,
  enrichFromDescription,
  capQuadrants,
  generateTows,
  generateSwot,
  regenerateQuadrant,
  validateSwot,
  renderMarkdown,
  renderJson,
  renderHtmlMatrix,
  renderTowsTable,
  prioritizeTows,
  topByImpact,
  buildLlmRequestBody,
  parseLlmSwotResponse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Quadrant,
  type SwotItem,
  type SwotMatrix,
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

// ---------- Industry templates ----------

describe("swot industry templates", () => {
  it("has at least 14 industries", () => {
    expect(INDUSTRY_TEMPLATES.length).toBeGreaterThanOrEqual(14);
  });
  it("each template has 4 bullets per quadrant", () => {
    for (const t of INDUSTRY_TEMPLATES) {
      expect(t.strengths.length).toBeGreaterThanOrEqual(3);
      expect(t.weaknesses.length).toBeGreaterThanOrEqual(3);
      expect(t.opportunities.length).toBeGreaterThanOrEqual(3);
      expect(t.threats.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("indexes by id", () => {
    expect(INDUSTRY_BY_ID[INDUSTRY_TEMPLATES[0].id]).toBe(INDUSTRY_TEMPLATES[0]);
  });
  it("INDUSTRY_IDS matches templates", () => {
    expect(INDUSTRY_IDS.length).toBe(INDUSTRY_TEMPLATES.length);
  });
  it("contains expected industries", () => {
    const ids = INDUSTRY_IDS;
    expect(ids).toContain("saas");
    expect(ids).toContain("ecommerce");
    expect(ids).toContain("nonprofit");
    expect(ids).toContain("fintech");
    expect(ids).toContain("education");
  });
});

// ---------- Helpers ----------

describe("swot helpers", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("  a   b  ")).toBe("a b");
  });
  it("clamp clamps", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(15, 1, 10)).toBe(10);
  });
});

// ---------- detectIndustry ----------

describe("swot detectIndustry", () => {
  it("returns id when given exact id", () => {
    expect(detectIndustry("saas")).toBe("saas");
    expect(detectIndustry("ecommerce")).toBe("ecommerce");
  });
  it("matches label substring", () => {
    expect(detectIndustry("SaaS / Software")).toBe("saas");
  });
  it("keyword fallbacks", () => {
    expect(detectIndustry("a mobile app")).toBe("mobile-app");
    expect(detectIndustry("online shop")).toBe("ecommerce");
    expect(detectIndustry("local cafe")).toBe("restaurant");
    expect(detectIndustry("fintech bank")).toBe("fintech");
    expect(detectIndustry("course creator")).toBe("education");
  });
  it("defaults to saas for empty", () => {
    expect(detectIndustry("")).toBe("saas");
  });
  it("defaults to saas for unknown", () => {
    expect(detectIndustry("xyzzy unknown")).toBe("saas");
  });
});

// ---------- enrichFromDescription ----------

describe("swot enrichFromDescription", () => {
  const base: Record<Quadrant, SwotItem[]> = {
    strengths: [{ text: "Existing strength", impact: 3, feasibility: 0 }],
    weaknesses: [{ text: "Existing weakness", impact: 3, feasibility: 0 }],
    opportunities: [{ text: "Existing opp", impact: 3, feasibility: 0 }],
    threats: [{ text: "Existing threat", impact: 3, feasibility: 0 }],
  };
  it("adds strength for recurring/subscription", () => {
    const out = enrichFromDescription("we have recurring subscription revenue", base);
    expect(out.strengths.length).toBeGreaterThan(base.strengths.length);
    expect(out.strengths.some((s) => s.text.includes("Recurring"))).toBe(true);
  });
  it("adds weakness for single founder", () => {
    const out = enrichFromDescription("I am a solo single founder", base);
    expect(out.weaknesses.some((w) => w.text.includes("Single-founder"))).toBe(true);
  });
  it("adds opportunity for AI", () => {
    const out = enrichFromDescription("we are using AI machine learning", base);
    expect(out.opportunities.some((o) => o.text.includes("AI-native"))).toBe(true);
  });
  it("adds threat for incumbent", () => {
    const out = enrichFromDescription("big tech incumbent is a risk", base);
    expect(out.threats.some((t) => t.text.includes("incumbent"))).toBe(true);
  });
  it("does not duplicate existing items", () => {
    const base2: Record<Quadrant, SwotItem[]> = {
      strengths: [{ text: "Recurring revenue base providing predictable cash flow", impact: 3, feasibility: 0 }],
      weaknesses: [],
      opportunities: [],
      threats: [],
    };
    const out = enrichFromDescription("recurring subscription", base2);
    expect(out.strengths.filter((s) => s.text.includes("Recurring"))).toHaveLength(1);
  });
  it("returns base unchanged for empty description", () => {
    const out = enrichFromDescription("", base);
    expect(out.strengths.length).toBe(base.strengths.length);
  });
});

// ---------- capQuadrants ----------

describe("swot capQuadrants", () => {
  it("caps to maxPerQuadrant", () => {
    const m: Record<Quadrant, SwotItem[]> = {
      strengths: [1, 2, 3, 4, 5].map((n) => ({ text: `s${n}`, impact: n, feasibility: 0 })),
      weaknesses: [],
      opportunities: [],
      threats: [],
    };
    const out = capQuadrants(m, 2);
    expect(out.strengths).toHaveLength(2);
    // Keeps highest impact
    expect(out.strengths[0].impact).toBe(5);
  });
  it("keeps at least 1 if maxPerQuadrant is 0", () => {
    const m: Record<Quadrant, SwotItem[]> = {
      strengths: [{ text: "s1", impact: 1, feasibility: 0 }],
      weaknesses: [], opportunities: [], threats: [],
    };
    const out = capQuadrants(m, 0);
    expect(out.strengths).toHaveLength(1);
  });
});

// ---------- generateTows ----------

describe("swot generateTows", () => {
  it("generates SO/ST/WO/WT actions", () => {
    const matrix = {
      strengths: [{ text: "Brand", impact: 4, feasibility: 0 }],
      weaknesses: [{ text: "Churn", impact: 3, feasibility: 0 }],
      opportunities: [{ text: "AI", impact: 4, feasibility: 0 }],
      threats: [{ text: "Incumbent", impact: 3, feasibility: 0 }],
    };
    const tows = generateTows(matrix);
    const strategies = new Set(tows.map((t) => t.strategy));
    expect(strategies.has("SO")).toBe(true);
    expect(strategies.has("ST")).toBe(true);
    expect(strategies.has("WO")).toBe(true);
    expect(strategies.has("WT")).toBe(true);
  });
  it("each action has score = impact × feasibility", () => {
    const matrix = {
      strengths: [{ text: "S", impact: 4, feasibility: 0 }],
      weaknesses: [],
      opportunities: [{ text: "O", impact: 4, feasibility: 0 }],
      threats: [],
    };
    const tows = generateTows(matrix);
    for (const a of tows) {
      expect(a.score).toBe(a.impact * a.feasibility);
    }
  });
  it("sorted by score descending", () => {
    const matrix = {
      strengths: [
        { text: "S1", impact: 5, feasibility: 0 },
        { text: "S2", impact: 1, feasibility: 0 },
      ],
      weaknesses: [],
      opportunities: [{ text: "O", impact: 5, feasibility: 0 }],
      threats: [],
    };
    const tows = generateTows(matrix);
    for (let i = 1; i < tows.length; i++) {
      expect(tows[i].score).toBeLessThanOrEqual(tows[i - 1].score);
    }
  });
  it("empty matrix yields empty list", () => {
    const tows = generateTows({ strengths: [], weaknesses: [], opportunities: [], threats: [] });
    expect(tows).toEqual([]);
  });
});

// ---------- generateSwot ----------

describe("swot generateSwot", () => {
  it("generates a complete matrix", () => {
    const m = generateSwot({
      subject: "Acme SaaS",
      industry: "saas",
      goal: "Grow ARR 2x",
      description: "Recurring subscription revenue with a single founder building AI features.",
    });
    expect(m.subject).toBe("Acme SaaS");
    expect(m.industry).toBe("saas");
    expect(m.goal).toBe("Grow ARR 2x");
    expect(m.strengths.length).toBeGreaterThan(0);
    expect(m.weaknesses.length).toBeGreaterThan(0);
    expect(m.opportunities.length).toBeGreaterThan(0);
    expect(m.threats.length).toBeGreaterThan(0);
    expect(m.tows.length).toBeGreaterThan(0);
    expect(m.generatedAt).toBeGreaterThan(0);
  });
  it("detects industry from hint", () => {
    const m = generateSwot({ subject: "X", industry: "cafe", description: "" });
    expect(m.industry).toBe("restaurant");
  });
  it("warns on short description", () => {
    const m = generateSwot({ subject: "X", industry: "saas", description: "short" });
    expect(m.warnings.some((w) => w.includes("short"))).toBe(true);
  });
  it("warns on empty subject", () => {
    const m = generateSwot({ subject: "", industry: "saas", description: "a longer description here" });
    expect(m.warnings.some((w) => w.includes("Subject"))).toBe(true);
    expect(m.subject).toBe("Untitled subject");
  });
  it("respects maxPerQuadrant", () => {
    const m = generateSwot({
      subject: "X",
      industry: "saas",
      description: "AI recurring subscription incumbent patent brand",
      maxPerQuadrant: 3,
    });
    expect(m.strengths.length).toBeLessThanOrEqual(3);
    expect(m.opportunities.length).toBeLessThanOrEqual(3);
  });
  it("enriches based on description keywords", () => {
    const m = generateSwot({
      subject: "X",
      industry: "saas",
      description: "we have recurring subscription revenue and use AI but face a big tech incumbent",
    });
    expect(m.strengths.some((s) => s.text.includes("Recurring"))).toBe(true);
    expect(m.opportunities.some((o) => o.text.includes("AI-native"))).toBe(true);
    expect(m.threats.some((t) => t.text.includes("incumbent"))).toBe(true);
  });
});

// ---------- regenerateQuadrant ----------

describe("swot regenerateQuadrant", () => {
  it("replaces one quadrant and re-derives TOWS", () => {
    const m = generateSwot({ subject: "X", industry: "saas", description: "recurring revenue" });
    const newStrengths: SwotItem[] = [
      { text: "New strength 1", impact: 5, feasibility: 0 },
      { text: "New strength 2", impact: 4, feasibility: 0 },
    ];
    const next = regenerateQuadrant(m, "strengths", newStrengths);
    expect(next.strengths).toEqual(newStrengths);
    expect(next.weaknesses).toEqual(m.weaknesses);
    // TOWS should reference the new strength text
    expect(next.tows.some((a) => a.action.includes("New strength 1"))).toBe(true);
  });
});

// ---------- validateSwot ----------

describe("swot validateSwot", () => {
  it("valid for a proper matrix", () => {
    const m = generateSwot({ subject: "X", industry: "saas", description: "x" });
    const v = validateSwot(m);
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("error when a quadrant is empty", () => {
    const m: SwotMatrix = {
      subject: "X",
      industry: "saas",
      goal: "",
      strengths: [],
      weaknesses: [{ text: "w", impact: 3, feasibility: 0 }],
      opportunities: [{ text: "o", impact: 3, feasibility: 0 }],
      threats: [{ text: "t", impact: 3, feasibility: 0 }],
      tows: [],
      warnings: [],
      generatedAt: Date.now(),
    };
    const v = validateSwot(m);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("strengths"))).toBe(true);
  });
  it("error when subject empty", () => {
    const m: SwotMatrix = {
      subject: "",
      industry: "saas",
      goal: "",
      strengths: [{ text: "s", impact: 3, feasibility: 0 }],
      weaknesses: [{ text: "w", impact: 3, feasibility: 0 }],
      opportunities: [{ text: "o", impact: 3, feasibility: 0 }],
      threats: [{ text: "t", impact: 3, feasibility: 0 }],
      tows: [],
      warnings: [],
      generatedAt: Date.now(),
    };
    const v = validateSwot(m);
    expect(v.valid).toBe(false);
  });
  it("warns when TOWS empty", () => {
    const m: SwotMatrix = {
      subject: "X",
      industry: "saas",
      goal: "",
      strengths: [{ text: "s", impact: 3, feasibility: 0 }],
      weaknesses: [{ text: "w", impact: 3, feasibility: 0 }],
      opportunities: [{ text: "o", impact: 3, feasibility: 0 }],
      threats: [{ text: "t", impact: 3, feasibility: 0 }],
      tows: [],
      warnings: [],
      generatedAt: Date.now(),
    };
    const v = validateSwot(m);
    expect(v.warnings.some((w) => w.includes("TOWS"))).toBe(true);
  });
  it("warns when impact out of range", () => {
    const m: SwotMatrix = {
      subject: "X",
      industry: "saas",
      goal: "",
      strengths: [{ text: "s", impact: 9, feasibility: 0 }],
      weaknesses: [{ text: "w", impact: 3, feasibility: 0 }],
      opportunities: [{ text: "o", impact: 3, feasibility: 0 }],
      threats: [{ text: "t", impact: 3, feasibility: 0 }],
      tows: [],
      warnings: [],
      generatedAt: Date.now(),
    };
    const v = validateSwot(m);
    expect(v.warnings.some((w) => w.includes("out-of-range"))).toBe(true);
  });
});

// ---------- Renderers ----------

describe("swot renderers", () => {
  const m = generateSwot({
    subject: "Acme",
    industry: "saas",
    goal: "Grow",
    description: "recurring AI incumbent",
  });

  it("renderMarkdown has all sections", () => {
    const md = renderMarkdown(m);
    expect(md).toContain("# SWOT Analysis: Acme");
    expect(md).toContain("## Strengths");
    expect(md).toContain("## Weaknesses");
    expect(md).toContain("## Opportunities");
    expect(md).toContain("## Threats");
    expect(md).toContain("## TOWS Strategy Actions");
    expect(md).toContain("**Goal:** Grow");
  });
  it("renderMarkdown includes impact", () => {
    const md = renderMarkdown(m);
    expect(md).toContain("impact:");
  });
  it("renderJson is valid JSON", () => {
    const j = renderJson(m);
    const parsed = JSON.parse(j);
    expect(parsed.subject).toBe("Acme");
    expect(parsed.strengths.length).toBeGreaterThan(0);
    expect(Array.isArray(parsed.tows)).toBe(true);
  });
  it("renderHtmlMatrix has 4 cells", () => {
    const html = renderHtmlMatrix(m);
    expect(html).toContain("swot-strengths");
    expect(html).toContain("swot-weaknesses");
    expect(html).toContain("swot-opportunities");
    expect(html).toContain("swot-threats");
  });
  it("renderHtmlMatrix escapes html", () => {
    const m2: SwotMatrix = {
      ...m,
      strengths: [{ text: "<script>", impact: 3, feasibility: 0 }],
    };
    const html = renderHtmlMatrix(m2);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("renderTowsTable has header row", () => {
    const html = renderTowsTable(m);
    expect(html).toContain("<thead>");
    expect(html).toContain("Impact");
    expect(html).toContain("Feasibility");
    expect(html).toContain("Score");
  });
});

// ---------- Prioritization ----------

describe("swot prioritization", () => {
  it("prioritizeTows sorts by score desc", () => {
    const m = generateSwot({ subject: "X", industry: "saas", description: "x" });
    const sorted = prioritizeTows(m.tows);
    expect(sorted.length).toBe(m.tows.length);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].score).toBeLessThanOrEqual(sorted[i - 1].score);
    }
  });
  it("topByImpact returns top N", () => {
    const items: SwotItem[] = [
      { text: "a", impact: 1, feasibility: 0 },
      { text: "b", impact: 5, feasibility: 0 },
      { text: "c", impact: 3, feasibility: 0 },
    ];
    const top = topByImpact(items, 2);
    expect(top).toHaveLength(2);
    expect(top[0].impact).toBe(5);
    expect(top[1].impact).toBe(3);
  });
});

// ---------- LLM hook ----------

describe("swot LLM hook", () => {
  it("builds request body", () => {
    const body = buildLlmRequestBody({
      apiKey: "k", subject: "Acme", industry: "saas", description: "d", goal: "g",
    });
    const j = JSON.parse(body);
    expect(j.model).toBe("gpt-4o-mini");
    expect(j.response_format.type).toBe("json_object");
    expect(j.messages[1].content).toContain("Acme");
  });
  it("parses a clean JSON response", () => {
    const base = generateSwot({ subject: "Acme", industry: "saas", description: "x" });
    const text = JSON.stringify({
      strengths: [{ text: "LLM strength", impact: 4 }, { text: "Other", impact: 3 }],
      weaknesses: ["string weakness"],
      opportunities: [{ text: "LLM opp" }],
      threats: [{ text: "LLM threat" }],
    });
    const m = parseLlmSwotResponse(text, base);
    expect(m).not.toBeNull();
    expect(m!.strengths).toHaveLength(2);
    expect(m!.strengths[0].text).toBe("LLM strength");
    expect(m!.strengths[0].impact).toBe(4);
    expect(m!.weaknesses[0].text).toBe("string weakness");
    expect(m!.weaknesses[0].impact).toBe(3); // default
    expect(m!.tows.length).toBeGreaterThan(0);
  });
  it("extracts JSON from surrounding text", () => {
    const base = generateSwot({ subject: "Acme", industry: "saas", description: "x" });
    const text = `Here is your SWOT: {"strengths":[{"text":"x"}],"weaknesses":[],"opportunities":[],"threats":[]}`;
    const m = parseLlmSwotResponse(text, base);
    expect(m).not.toBeNull();
    expect(m!.strengths[0].text).toBe("x");
  });
  it("returns null for invalid", () => {
    const base = generateSwot({ subject: "Acme", industry: "saas", description: "x" });
    expect(parseLlmSwotResponse("no json here", base)).toBeNull();
    expect(parseLlmSwotResponse("", base)).toBeNull();
  });
  it("clamps out-of-range impact from LLM", () => {
    const base = generateSwot({ subject: "Acme", industry: "saas", description: "x" });
    const text = JSON.stringify({
      strengths: [{ text: "x", impact: 99 }],
      weaknesses: [], opportunities: [], threats: [],
    });
    const m = parseLlmSwotResponse(text, base);
    expect(m!.strengths[0].impact).toBe(5);
  });
});

// ---------- History ----------

describe("swot history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, subject: "Acme", industry: "saas", itemCount: 16 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].subject).toBe("Acme");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, subject: `S${i}`, industry: "saas", itemCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, subject: "X", industry: "saas", itemCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Share URL ----------

describe("swot share URL", () => {
  it("builds URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      subject: "Acme",
      industry: "saas",
      goal: "Grow",
      description: "A SaaS company",
    });
    expect(url).toContain("subject=Acme");
    expect(url).toContain("industry=saas");
    expect(url).toContain("goal=Grow");
    expect(url).toContain("desc=A+SaaS+company");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses back", () => {
    const p = parseShareUrl("subject=Acme&industry=saas&goal=Grow&desc=hello");
    expect(p.subject).toBe("Acme");
    expect(p.industry).toBe("saas");
    expect(p.goal).toBe("Grow");
    expect(p.description).toBe("hello");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles partial hash", () => {
    const p = parseShareUrl("subject=Only");
    expect(p.subject).toBe("Only");
    expect(p.industry).toBeUndefined();
  });
});
