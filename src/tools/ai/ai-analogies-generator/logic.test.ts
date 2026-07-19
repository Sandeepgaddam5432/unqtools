import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  DOMAIN_LABELS,
  STYLE_LABELS,
  COMPLEXITY_LABELS,
  AUDIENCE_LABELS,
  CONCEPT_PRESETS,
  DOMAIN_LIBRARY,
  normalizeConcept,
  extractAcronym,
  extractKeywords,
  renderTemplate,
  pickBestEntry,
  generateAnalogies,
  scoreAnalogy,
  expandExplainer,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  randomDomains,
  type AnalogyDomain,
  type AnalogyStyle,
  type Complexity,
  type Audience,
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

describe("ai-analogies constants", () => {
  it("has history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-analogies:history");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 10 domains", () => {
    expect(Object.keys(DOMAIN_LABELS)).toHaveLength(10);
  });
  it("has 3 styles", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(3);
  });
  it("has 3 complexity levels", () => {
    expect(Object.keys(COMPLEXITY_LABELS)).toHaveLength(3);
  });
  it("has 4 audiences", () => {
    expect(Object.keys(AUDIENCE_LABELS)).toHaveLength(4);
  });
  it("has 4 entries per domain (40 total)", () => {
    for (const d of Object.keys(DOMAIN_LIBRARY) as AnalogyDomain[]) {
      expect(DOMAIN_LIBRARY[d]).toHaveLength(4);
    }
  });
  it("has concept presets", () => {
    expect(CONCEPT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(CONCEPT_PRESETS.some((p) => /DNS/i.test(p))).toBe(true);
  });
});

describe("ai-analogies normalizeConcept", () => {
  it("collapses whitespace", () => {
    expect(normalizeConcept("  quantum    computing  ")).toBe("quantum computing");
  });
  it("handles empty", () => {
    expect(normalizeConcept("")).toBe("");
  });
});

describe("ai-analogies extractAcronym", () => {
  it("extracts DNS form", () => {
    const r = extractAcronym("DNS (Domain Name System)");
    expect(r).toEqual({ short: "DNS", long: "Domain Name System" });
  });
  it("extracts bare acronym", () => {
    expect(extractAcronym("DNS")).toEqual({ short: "DNS", long: "" });
  });
  it("returns null for non-acronym", () => {
    expect(extractAcronym("quantum computing")).toBeNull();
  });
});

describe("ai-analogies extractKeywords", () => {
  it("extracts meaningful words, drops stopwords", () => {
    const kw = extractKeywords("How does the DNS work?");
    expect(kw).toContain("dns");
    expect(kw).toContain("work");
    expect(kw).not.toContain("how");
    expect(kw).not.toContain("the");
  });
  it("includes a phrase form", () => {
    const kw = extractKeywords("compound interest");
    expect(kw).toContain("compound");
    expect(kw).toContain("interest");
    expect(kw).toContain("compound interest");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("strips parenthetical content for keyword extraction", () => {
    const kw = extractKeywords("DNS (Domain Name System)");
    expect(kw).toContain("dns");
    expect(kw).not.toContain("domain");
    expect(kw).not.toContain("system");
  });
});

describe("ai-analogies renderTemplate", () => {
  it("substitutes concept, kw, kwList", () => {
    const out = renderTemplate("{concept} is like {kw} ({kwList})", {
      concept: "DNS",
      kw: "phonebook",
      kwList: "dns, phonebook",
    });
    expect(out).toBe("DNS is like phonebook (dns, phonebook)");
  });
});

describe("ai-analogies pickBestEntry", () => {
  it("matches keywords when present", () => {
    // 'cache' should match the technology domain cache entry
    const e = pickBestEntry("technology", ["cache"]);
    expect(e.goodForKeywords).toContain("cache");
  });
  it("returns first entry when no keywords", () => {
    const e = pickBestEntry("cooking", []);
    expect(e.headlineTpl).toContain("recipe");
  });
  it("returns first entry when keywords don't match", () => {
    const e = pickBestEntry("cooking", ["zzzznotakeyword"]);
    // Falls back to first entry
    expect(e.headlineTpl).toBeTruthy();
  });
});

describe("ai-analogies generateAnalogies", () => {
  it("generates variations for one domain × one style", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["technology"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "expert",
    });
    expect(v).toHaveLength(1);
    expect(v[0].concept).toBe("DNS");
    expect(v[0].domain).toBe("technology");
    expect(v[0].style).toBe("metaphor");
    expect(v[0].headline).toBeTruthy();
    expect(v[0].body).toBeTruthy();
    expect(v[0].breakdown).toBeTruthy();
    expect(v[0].score).toBeGreaterThan(0);
    expect(v[0].id).toMatch(/^a-/);
  });
  it("generates N×M variations for N domains × M styles (under cap)", () => {
    const v = generateAnalogies({
      concept: "Compound interest",
      domains: ["nature", "cooking", "sports"],
      styles: ["metaphor", "simile"],
      complexity: "standard",
      audience: "executive",
    });
    expect(v).toHaveLength(6);
  });
  it("respects max cap", () => {
    const v = generateAnalogies({
      concept: "Recursion",
      domains: ["cooking", "sports", "nature", "technology", "music"],
      styles: ["metaphor", "simile", "story"],
      complexity: "standard",
      audience: "expert",
      max: 4,
    });
    expect(v).toHaveLength(4);
  });
  it("returns empty for empty concept", () => {
    expect(generateAnalogies({
      concept: "",
      domains: ["cooking"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "kid",
    })).toEqual([]);
  });
  it("returns empty for empty domains", () => {
    expect(generateAnalogies({
      concept: "DNS",
      domains: [],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "kid",
    })).toEqual([]);
  });
  it("returns empty for empty styles", () => {
    expect(generateAnalogies({
      concept: "DNS",
      domains: ["cooking"],
      styles: [],
      complexity: "standard",
      audience: "kid",
    })).toEqual([]);
  });
  it("metaphor style removes 'is like'", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["cooking"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "kid",
    });
    expect(v[0].headline).not.toContain("is like");
  });
  it("simile style keeps 'is like'", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["cooking"],
      styles: ["simile"],
      complexity: "standard",
      audience: "kid",
    });
    expect(v[0].headline).toContain("is like");
  });
  it("story style includes narrative frame in body", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["cooking"],
      styles: ["story"],
      complexity: "standard",
      audience: "kid",
    });
    expect(v[0].body.toLowerCase()).toContain("picture this");
  });
  it("variation keywords match concept keywords", () => {
    const v = generateAnalogies({
      concept: "Compound interest",
      domains: ["cooking"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "expert",
    });
    expect(v[0].keywords).toContain("compound");
    expect(v[0].keywords).toContain("interest");
  });
});

describe("ai-analogies scoreAnalogy", () => {
  it("scores in 0-100 range", () => {
    const s = scoreAnalogy({
      headline: "DNS is like a phonebook for the internet.",
      body: "You give it a name, it returns a number. That's the basic flow.",
      breakdown: "Unlike a phonebook, DNS has caching, TTLs, and recursive resolvers.",
      keywords: ["dns", "phonebook"],
      domain: "technology",
      style: "metaphor",
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
  it("penalizes very short headlines", () => {
    const s = scoreAnalogy({
      headline: "X.",
      body: "Body that is long enough to satisfy the sweet spot, with at least eighty characters in total.",
      breakdown: "Breakdown that is at least forty characters long to qualify as substantive.",
      keywords: [],
      domain: "cooking",
      style: "metaphor",
    });
    expect(s).toBeLessThan(80);
  });
  it("story style gets a small bonus", () => {
    const base = scoreAnalogy({
      headline: "DNS is like a phonebook for the internet, mapping names to numbers.",
      body: "Body that is long enough to satisfy the sweet spot, with at least eighty characters in total.",
      breakdown: "Breakdown that is at least forty characters long to qualify as substantive.",
      keywords: [],
      domain: "technology",
      style: "metaphor",
    });
    const story = scoreAnalogy({
      headline: "DNS is like a phonebook for the internet, mapping names to numbers.",
      body: "Body that is long enough to satisfy the sweet spot, with at least eighty characters in total.",
      breakdown: "Breakdown that is at least forty characters long to qualify as substantive.",
      keywords: [],
      domain: "technology",
      style: "story",
    });
    expect(story - base).toBe(3);
  });
});

describe("ai-analogies expandExplainer", () => {
  it("produces multi-paragraph explainer", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["technology"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "expert",
    })[0];
    const e = expandExplainer(v);
    expect(e.concept).toBe("DNS");
    expect(e.fullText).toContain(v.headline);
    expect(e.fullText).toContain(v.body);
    expect(e.fullText).toContain(v.breakdown);
    expect(e.fullText.split(/\n\n+/).length).toBeGreaterThanOrEqual(4);
    expect(e.wordCount).toBeGreaterThan(0);
    expect(e.readingTimeMin).toBeGreaterThanOrEqual(1);
  });
  it("adds advanced note for advanced complexity", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["technology"],
      styles: ["metaphor"],
      complexity: "advanced",
      audience: "expert",
    })[0];
    const e = expandExplainer(v);
    expect(e.fullText).toContain("Advanced note");
  });
  it("adds kid note for kid audience", () => {
    const v = generateAnalogies({
      concept: "DNS",
      domains: ["technology"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "kid",
    })[0];
    const e = expandExplainer(v);
    expect(e.fullText).toContain("For kids");
  });
});

describe("ai-analogies computeStats", () => {
  it("groups by domain and averages scores", () => {
    const variations = generateAnalogies({
      concept: "Recursion",
      domains: ["cooking", "sports"],
      styles: ["metaphor", "simile"],
      complexity: "standard",
      audience: "expert",
    });
    const stats = computeStats(variations);
    expect(stats).toHaveLength(2);
    for (const s of stats) {
      expect(s.count).toBe(2);
      expect(s.avgScore).toBeGreaterThanOrEqual(0);
      expect(s.avgScore).toBeLessThanOrEqual(100);
    }
  });
  it("returns empty for empty input", () => {
    expect(computeStats([])).toEqual([]);
  });
  it("sorts by avgScore descending", () => {
    const variations = generateAnalogies({
      concept: "Recursion",
      domains: ["cooking", "sports"],
      styles: ["metaphor", "simile", "story"],
      complexity: "standard",
      audience: "expert",
    });
    const stats = computeStats(variations);
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i - 1].avgScore).toBeGreaterThanOrEqual(stats[i].avgScore);
    }
  });
});

describe("ai-analogies renderers", () => {
  const variations = generateAnalogies({
    concept: "DNS",
    domains: ["cooking"],
    styles: ["metaphor"],
    complexity: "standard",
    audience: "expert",
  });
  it("renderText includes headline + body + breakdown + score", () => {
    const t = renderText(variations);
    expect(t).toContain(variations[0].headline);
    expect(t).toContain(variations[0].body);
    expect(t).toContain(variations[0].breakdown);
    expect(t).toContain("Score:");
  });
  it("renderText returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });
  it("renderMarkdown includes headline as bold", () => {
    const m = renderMarkdown(variations);
    expect(m).toContain(`**${variations[0].headline}**`);
    expect(m).toContain("Where it breaks");
  });
  it("renderJson is valid JSON", () => {
    const j = renderJson(variations);
    const parsed = JSON.parse(j);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].concept).toBe("DNS");
  });
});

describe("ai-analogies history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      concept: "DNS",
      domainCount: 2,
      styleCount: 3,
      variationCount: 6,
      avgScore: 72,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].concept).toBe("DNS");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, concept: "x", domainCount: 1, styleCount: 1, variationCount: 1, avgScore: 50 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, concept: "x", domainCount: 1, styleCount: 1, variationCount: 1, avgScore: 50 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-analogies shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      concept: "DNS",
      domains: ["cooking", "sports"],
      styles: ["metaphor"],
      complexity: "standard",
      audience: "expert",
    });
    expect(url).toContain("c=DNS");
    expect(url).toContain("d=cooking%2Csports");
    expect(url).toContain("s=metaphor");
    expect(url).toContain("cx=standard");
    expect(url).toContain("a=expert");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("c=DNS&d=cooking%2Csports&s=metaphor&cx=standard&a=expert");
    expect(p.concept).toBe("DNS");
    expect(p.domains).toEqual(["cooking", "sports"]);
    expect(p.styles).toEqual(["metaphor"]);
    expect(p.complexity).toBe("standard");
    expect(p.audience).toBe("expert");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown domains", () => {
    const p = parseShareUrl("c=DNS&d=cooking%2Cunknown-domain");
    expect(p.domains).toEqual(["cooking"]);
  });
  it("filters unknown styles", () => {
    const p = parseShareUrl("c=DNS&s=metaphor%2Cunknown-style");
    expect(p.styles).toEqual(["metaphor"]);
  });
  it("filters unknown complexity", () => {
    const p = parseShareUrl("c=DNS&cx=unknown");
    expect(p.complexity).toBeUndefined();
  });
  it("filters unknown audience", () => {
    const p = parseShareUrl("c=DNS&a=unknown");
    expect(p.audience).toBeUndefined();
  });
});

describe("ai-analogies LLM prompt builder", () => {
  it("includes concept, domains, styles, complexity, audience", () => {
    const p = buildLlmPrompt("DNS", ["cooking"], ["metaphor"], "standard", "expert");
    expect(p).toContain("DNS");
    expect(p).toContain("Cooking");
    expect(p).toContain("Metaphor");
    expect(p).toContain("Standard");
    expect(p).toContain("Expert");
  });
  it("asks for JSON array", () => {
    const p = buildLlmPrompt("DNS", ["cooking"], ["metaphor"], "standard", "expert");
    expect(p).toContain("JSON array");
  });
});

describe("ai-analogies renderLlmResult", () => {
  it("parses valid JSON array", () => {
    const raw = JSON.stringify([
      { headline: "A", body: "B", breakdown: "C" },
      { headline: "X", body: "Y", breakdown: "Z" },
    ]);
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.variations).toHaveLength(2);
      expect(r.variations[0].headline).toBe("A");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify([{ headline: "A", body: "B", breakdown: "C" }]) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.variations).toHaveLength(1);
  });
  it("errors on invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Could not parse");
  });
  it("errors on non-array JSON", () => {
    const r = renderLlmResult(JSON.stringify({ foo: "bar" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not a JSON array");
  });
  it("errors when no valid items", () => {
    const r = renderLlmResult(JSON.stringify([{ foo: "bar" }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no valid analogy");
  });
  it("skips items without headline and body", () => {
    const r = renderLlmResult(JSON.stringify([
      { headline: "A", body: "B", breakdown: "C" },
      { headline: "", body: "", breakdown: "C" },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.variations).toHaveLength(1);
  });
});

describe("ai-analogies randomDomains", () => {
  it("returns N unique domains", () => {
    const ds = randomDomains(3, 42);
    expect(ds).toHaveLength(3);
    expect(new Set(ds).size).toBe(3);
  });
  it("is deterministic with seed", () => {
    expect(randomDomains(3, 42)).toEqual(randomDomains(3, 42));
  });
  it("caps at total domain count", () => {
    const ds = randomDomains(100, 1);
    expect(ds.length).toBeLessThanOrEqual(10);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused =
  | AnalogyDomain
  | AnalogyStyle
  | Complexity
  | Audience;
