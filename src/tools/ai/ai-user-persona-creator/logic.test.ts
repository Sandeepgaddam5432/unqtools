import { describe, it, expect, beforeEach } from "vitest";
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  AUDIENCE_PRESETS,
  SAMPLE_INPUT,
  hashSeed,
  makeRng,
  generatePersonaName,
  generateDemographics,
  generateGoals,
  generatePains,
  generateBehaviors,
  generateMotivations,
  generateFrustrations,
  generateChannels,
  generateTechSavviness,
  generateQuote,
  generateDayInTheLife,
  generateEmpathyMap,
  generateJTBD,
  generateScenario,
  generateTagline,
  generateConfidence,
  buildPersona,
  buildMultiplePersonas,
  renderPersonaMarkdown,
  renderPersonasMarkdown,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ProductType,
  type PersonaInput,
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

describe("ai-user-persona-creator constants", () => {
  it("has 8 product types", () => {
    expect(PRODUCT_TYPES).toHaveLength(8);
    expect(PRODUCT_TYPES).toContain("b2b-saas");
    expect(PRODUCT_TYPES).toContain("b2c-mobile");
    expect(PRODUCT_TYPES).toContain("ecommerce");
    expect(PRODUCT_TYPES).toContain("marketplace");
    expect(PRODUCT_TYPES).toContain("content-media");
    expect(PRODUCT_TYPES).toContain("education");
    expect(PRODUCT_TYPES).toContain("fintech");
    expect(PRODUCT_TYPES).toContain("healthtech");
  });
  it("has labels for every product type", () => {
    for (const p of PRODUCT_TYPES) expect(PRODUCT_TYPE_LABELS[p]).toBeTruthy();
  });
  it("has audience presets", () => {
    expect(AUDIENCE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(AUDIENCE_PRESETS.some((a) => a.id === "startup-founders")).toBe(true);
  });
  it("has a sample input", () => {
    expect(SAMPLE_INPUT.productType).toBeTruthy();
    expect(SAMPLE_INPUT.productName).toBeTruthy();
    expect(SAMPLE_INPUT.count).toBeGreaterThan(0);
  });
});

describe("ai-user-persona-creator RNG", () => {
  it("hashSeed is deterministic", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
  it("hashSeed handles empty string", () => {
    // Empty input returns the FNV-1a offset basis (loop body never runs)
    expect(hashSeed("")).toBe(2166136261);
  });
  it("makeRng produces deterministic next()", () => {
    const a = makeRng("seed-1");
    const b = makeRng("seed-1");
    expect(a.next()).toBe(b.next());
  });
  it("makeRng nextInt stays in range", () => {
    const rng = makeRng("range");
    for (let i = 0; i < 20; i++) {
      const n = rng.nextInt(5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
  });
  it("makeRng nextInt(0) returns 0", () => {
    expect(makeRng("zero").nextInt(0)).toBe(0);
  });
  it("makeRng pick returns an element", () => {
    const rng = makeRng("pick");
    const arr = ["a", "b", "c"];
    expect(arr).toContain(rng.pick(arr));
  });
  it("makeRng pickN returns N unique items", () => {
    const rng = makeRng("pickn");
    const arr = ["a", "b", "c", "d", "e"];
    const out = rng.pickN(arr, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });
  it("makeRng pickN handles n > arr.length", () => {
    const rng = makeRng("pickn2");
    const arr = ["a", "b"];
    const out = rng.pickN(arr, 5);
    expect(out).toHaveLength(2);
  });
  it("makeRng pick throws on empty array", () => {
    expect(() => makeRng("x").pick([])).toThrow();
  });
});

describe("ai-user-persona-creator generators", () => {
  it("generates a persona name", () => {
    const n = generatePersonaName("seed-1");
    expect(n.first.length).toBeGreaterThan(0);
    expect(n.last.length).toBeGreaterThan(0);
  });
  it("persona name is deterministic per seed", () => {
    expect(generatePersonaName("seed-1")).toEqual(generatePersonaName("seed-1"));
  });
  it("persona name differs for different seeds", () => {
    // Statistically very likely to differ
    const a = generatePersonaName("seed-1");
    const b = generatePersonaName("seed-2-zzz");
    expect(a).not.toEqual(b);
  });
  it("generates demographics for b2b-saas", () => {
    const d = generateDemographics("b2b-saas", "audience", "seed-1");
    expect(d.ageRange).toBeTruthy();
    expect(d.occupation).toBeTruthy();
    expect(d.industry).toBeTruthy();
    expect(d.location).toBeTruthy();
    expect(d.incomeRange).toBeTruthy();
    expect(d.education).toBeTruthy();
    expect(d.household).toBeTruthy();
    expect(d.gender.length).toBeGreaterThan(0);
  });
  it("generates goals per product type", () => {
    for (const p of PRODUCT_TYPES) {
      const goals = generateGoals(p, "seed-1", 3);
      expect(goals.length).toBeGreaterThan(0);
      expect(goals.length).toBeLessThanOrEqual(3);
    }
  });
  it("generates pains per product type", () => {
    for (const p of PRODUCT_TYPES) {
      const pains = generatePains(p, "seed-1", 3);
      expect(pains.length).toBeGreaterThan(0);
    }
  });
  it("generates behaviors per product type", () => {
    for (const p of PRODUCT_TYPES) {
      const b = generateBehaviors(p, "seed-1", 3);
      expect(b.length).toBeGreaterThan(0);
    }
  });
  it("generates motivations per product type", () => {
    for (const p of PRODUCT_TYPES) {
      const m = generateMotivations(p, "seed-1", 3);
      expect(m.length).toBeGreaterThan(0);
    }
  });
  it("generates frustrations per product type", () => {
    for (const p of PRODUCT_TYPES) {
      const f = generateFrustrations(p, "seed-1", 3);
      expect(f.length).toBeGreaterThan(0);
    }
  });
  it("generates channels per product type", () => {
    for (const p of PRODUCT_TYPES) {
      const c = generateChannels(p, "seed-1", 3);
      expect(c.length).toBeGreaterThan(0);
    }
  });
  it("generates tech savviness", () => {
    const t = generateTechSavviness("b2b-saas", "seed-1");
    expect(["low", "medium", "high"]).toContain(t);
  });
  it("generates a quote", () => {
    const partial = {
      demographics: generateDemographics("b2b-saas", "aud", "s"),
      goals: generateGoals("b2b-saas", "s"),
      pains: generatePains("b2b-saas", "s"),
    };
    const q = generateQuote(partial, "b2b-saas", "seed-1");
    expect(q.length).toBeGreaterThan(10);
    expect(q.startsWith('"')).toBe(true);
  });
  it("generates day in the life with 4 moments", () => {
    const partial = {
      demographics: generateDemographics("b2b-saas", "aud", "s"),
      goals: generateGoals("b2b-saas", "s"),
      behaviors: generateBehaviors("b2b-saas", "s"),
    };
    const d = generateDayInTheLife(partial, "b2b-saas", "seed-1");
    expect(d).toHaveLength(4);
    expect(d.every((s) => s.length > 0)).toBe(true);
  });
  it("generates an empathy map with all 4 quadrants", () => {
    const partial = {
      demographics: generateDemographics("b2b-saas", "aud", "s"),
      goals: generateGoals("b2b-saas", "s"),
      pains: generatePains("b2b-saas", "s"),
      motivations: generateMotivations("b2b-saas", "s"),
      frustrations: generateFrustrations("b2b-saas", "s"),
    };
    const e = generateEmpathyMap(partial, "seed-1");
    expect(e.says.length).toBeGreaterThan(0);
    expect(e.thinks.length).toBeGreaterThan(0);
    expect(e.does.length).toBeGreaterThan(0);
    expect(e.feels.length).toBeGreaterThan(0);
  });
  it("generates JTBD with all 3 dimensions", () => {
    const partial = {
      demographics: generateDemographics("b2b-saas", "aud", "s"),
      goals: generateGoals("b2b-saas", "s"),
      motivations: generateMotivations("b2b-saas", "s"),
    };
    const j = generateJTBD(partial, "b2b-saas", "seed-1");
    expect(j.functional).toBeTruthy();
    expect(j.emotional).toBeTruthy();
    expect(j.social).toBeTruthy();
  });
  it("generates a scenario narrative", () => {
    const p = buildPersona(SAMPLE_INPUT, 0);
    const s = generateScenario(p, "b2b-saas", SAMPLE_INPUT.productName, "seed-1");
    expect(s).toContain(p.fullName);
    expect(s).toContain(SAMPLE_INPUT.productName);
    expect(s.length).toBeGreaterThan(50);
  });
  it("generates a tagline", () => {
    const t = generateTagline("b2b-saas", "seed-1");
    expect(t.length).toBeGreaterThan(0);
  });
  it("generates confidence and assumptions", () => {
    const { confidence, assumptions } = generateConfidence(SAMPLE_INPUT, "seed-1");
    expect(["low", "medium", "high"]).toContain(confidence);
    expect(assumptions.length).toBeGreaterThan(0);
  });
  it("flags low confidence for thin inputs", () => {
    const thin: PersonaInput = {
      productType: "b2b-saas",
      productName: "X",
      productDescription: "short",
      audience: "thin",
      count: 1,
    };
    const { confidence } = generateConfidence(thin, "seed-1");
    expect(confidence).toBe("low");
  });
});

describe("ai-user-persona-creator buildPersona + buildMultiplePersonas", () => {
  it("builds a complete persona", () => {
    const p = buildPersona(SAMPLE_INPUT, 0);
    expect(p.fullName).toContain(" ");
    expect(p.role).toBeTruthy();
    expect(p.goals.length).toBeGreaterThan(0);
    expect(p.pains.length).toBeGreaterThan(0);
    expect(p.behaviors.length).toBeGreaterThan(0);
    expect(p.motivations.length).toBeGreaterThan(0);
    expect(p.frustrations.length).toBeGreaterThan(0);
    expect(p.preferredChannels.length).toBeGreaterThan(0);
    expect(p.quote).toBeTruthy();
    expect(p.dayInTheLife.length).toBe(4);
    expect(p.empathyMap).toBeDefined();
    expect(p.jobsToBeDone.length).toBeGreaterThan(0);
    expect(p.scenario).toBeTruthy();
    expect(["low", "medium", "high"]).toContain(p.confidence);
    expect(p.assumptions.length).toBeGreaterThan(0);
    expect(p.productType).toBe(SAMPLE_INPUT.productType);
    expect(p.tagline).toBeTruthy();
  });
  it("builds the same persona deterministically for the same input + index", () => {
    expect(buildPersona(SAMPLE_INPUT, 0)).toEqual(buildPersona(SAMPLE_INPUT, 0));
  });
  it("produces different personas for different indices", () => {
    const a = buildPersona(SAMPLE_INPUT, 0);
    const b = buildPersona(SAMPLE_INPUT, 1);
    expect(a.fullName).not.toBe(b.fullName);
  });
  it("buildMultiplePersonas returns the requested count", () => {
    const input = { ...SAMPLE_INPUT, count: 3 };
    const list = buildMultiplePersonas(input);
    expect(list).toHaveLength(3);
  });
  it("buildMultiplePersonas clamps to 1-4", () => {
    expect(buildMultiplePersonas({ ...SAMPLE_INPUT, count: 0 })).toHaveLength(1);
    expect(buildMultiplePersonas({ ...SAMPLE_INPUT, count: 99 })).toHaveLength(4);
  });
  it("buildMultiplePersonas produces distinct names", () => {
    const list = buildMultiplePersonas({ ...SAMPLE_INPUT, count: 4 });
    const names = list.map((p) => p.fullName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("ai-user-persona-creator rendering", () => {
  it("renderPersonaMarkdown includes all sections", () => {
    const p = buildPersona(SAMPLE_INPUT, 0);
    const md = renderPersonaMarkdown(p, SAMPLE_INPUT);
    expect(md).toContain(`# ${p.fullName}`);
    expect(md).toContain("## Demographics");
    expect(md).toContain("## Goals");
    expect(md).toContain("## Pains");
    expect(md).toContain("## Behaviors");
    expect(md).toContain("## Motivations");
    expect(md).toContain("## Frustrations");
    expect(md).toContain("## Preferred channels");
    expect(md).toContain("## Day in the life");
    expect(md).toContain("## Empathy map");
    expect(md).toContain("## Jobs to be done");
    expect(md).toContain("## Scenario");
    expect(md).toContain("## Honesty");
    expect(md).toContain(SAMPLE_INPUT.productName);
  });
  it("renderPersonaMarkdown includes confidence and assumptions", () => {
    const p = buildPersona(SAMPLE_INPUT, 0);
    const md = renderPersonaMarkdown(p, SAMPLE_INPUT);
    expect(md).toContain(`**Confidence:** ${p.confidence}`);
    for (const a of p.assumptions) expect(md).toContain(a);
  });
  it("renderPersonasMarkdown joins personas with separator", () => {
    const list = buildMultiplePersonas({ ...SAMPLE_INPUT, count: 3 });
    const md = renderPersonasMarkdown(list, SAMPLE_INPUT);
    const sepCount = (md.match(/^---$/gm) || []).length;
    expect(sepCount).toBeGreaterThanOrEqual(2);
  });
});

describe("ai-user-persona-creator computeStats", () => {
  it("computes stats for a list of personas", () => {
    const list = buildMultiplePersonas({ ...SAMPLE_INPUT, count: 3 });
    const stats = computeStats(list);
    expect(stats.total).toBe(3);
    expect(stats.byConfidence.low + stats.byConfidence.medium + stats.byConfidence.high).toBe(3);
    expect(stats.byTechSavviness.low + stats.byTechSavviness.medium + stats.byTechSavviness.high).toBe(3);
    expect(stats.avgGoals).toBeGreaterThan(0);
    expect(stats.avgPains).toBeGreaterThan(0);
    expect(stats.distinctRoles).toBeGreaterThan(0);
    expect(stats.distinctRoles).toBeLessThanOrEqual(3);
  });
  it("returns zeros for empty list", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgGoals).toBe(0);
    expect(stats.distinctRoles).toBe(0);
  });
});

describe("ai-user-persona-creator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, productType: "b2b-saas", productName: "X", count: 2, personaNames: ["A B", "C D"] });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, productType: "b2b-saas", productName: "X", count: 1, personaNames: ["A B"] });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, productType: "b2b-saas", productName: "X", count: 1, personaNames: ["A B"] });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-user-persona-creator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(SAMPLE_INPUT);
    expect(url).toContain("pt=b2b-saas");
    expect(url).toContain("n=3");
    expect(url).toContain("pn=");
    expect(url).toContain("pd=");
    expect(url).toContain("au=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(SAMPLE_INPUT);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const { input } = parseShareUrl(hash);
    expect(input.productType).toBe("b2b-saas");
    expect(input.productName).toBe(SAMPLE_INPUT.productName);
    expect(input.count).toBe(3);
    expect(input.productDescription).toBe(SAMPLE_INPUT.productDescription);
    expect(input.audience).toBe(SAMPLE_INPUT.audience);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: {} });
  });
  it("filters unknown product types", () => {
    const { input } = parseShareUrl("pt=unknown&n=2");
    expect(input.productType).toBeUndefined();
    expect(input.count).toBe(2);
  });
  it("clamps count to 1-4", () => {
    const { input: a } = parseShareUrl("pt=b2b-saas&n=0");
    expect(a.count).toBe(1);
    const { input: b } = parseShareUrl("pt=b2b-saas&n=99");
    expect(b.count).toBe(4);
  });
  it("handles missing count", () => {
    const { input } = parseShareUrl("pt=b2b-saas");
    expect(input.count).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = ProductType | PersonaInput;
