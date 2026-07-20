import { describe, it, expect, beforeEach } from "vitest";
import {
  CATEGORY_TEMPLATES,
  CATEGORY_LABELS,
  TONE_LABELS,
  PRODUCT_PRESETS,
  profileAudience,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  type Category,
  type Tone,
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

describe("target-audience constants", () => {
  it("has 11 category templates", () => {
    expect(Object.keys(CATEGORY_TEMPLATES)).toHaveLength(11);
  });
  it("has labels for all categories", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(11);
  });
  it("has 3 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
  });
  it("has 10 product presets", () => {
    expect(PRODUCT_PRESETS).toHaveLength(10);
  });
  it("each category template has required fields", () => {
    for (const tpl of Object.values(CATEGORY_TEMPLATES)) {
      expect(tpl.label).toBeTruthy();
      expect(tpl.ageRange).toBeTruthy();
      expect(tpl.incomeRange).toBeTruthy();
      expect(tpl.topChannels.length).toBeGreaterThan(0);
      expect(tpl.topPains.length).toBeGreaterThan(0);
      expect(tpl.topGoals.length).toBeGreaterThan(0);
      expect(tpl.commonObjections.length).toBeGreaterThan(0);
      expect(tpl.buyingTriggers.length).toBeGreaterThan(0);
    }
  });
});

describe("target-audience profileAudience", () => {
  it("generates a profile with 1 segment", () => {
    const result = profileAudience({
      product: "A meditation app for busy professionals.",
      category: "consumer-app",
      tone: "casual",
      segmentCount: 1,
      seed: 42,
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].label).toBe("Primary");
    expect(result.segments[0].persona.name).toBeTruthy();
    expect(result.segments[0].persona.role).toBeTruthy();
    expect(result.segments[0].goals.length).toBeGreaterThan(0);
    expect(result.segments[0].pains.length).toBeGreaterThan(0);
    expect(result.segments[0].channels.length).toBeGreaterThan(0);
    expect(result.segments[0].icpScore).toBeGreaterThanOrEqual(0);
    expect(result.segments[0].icpScore).toBeLessThanOrEqual(100);
    expect(result.honestyNote).toContain("hypothesis");
  });

  it("generates a profile with 3 segments", () => {
    const result = profileAudience({
      product: "Project management SaaS",
      category: "b2b-saas",
      tone: "formal",
      segmentCount: 3,
      seed: 100,
    });
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0].label).toBe("Primary");
    expect(result.segments[1].label).toBe("Secondary");
    expect(result.segments[2].label).toBe("Tertiary");
  });

  it("deterministic with same seed", () => {
    const r1 = profileAudience({ product: "test", category: "dev-tool", tone: "data-driven", segmentCount: 2, seed: 7 });
    const r2 = profileAudience({ product: "test", category: "dev-tool", tone: "data-driven", segmentCount: 2, seed: 7 });
    expect(r1.segments[0].persona.name).toBe(r2.segments[0].persona.name);
    expect(r1.segments[0].goals).toEqual(r2.segments[0].goals);
  });

  it("ICP picks highest-scoring segment", () => {
    const result = profileAudience({
      product: "test",
      category: "e-commerce",
      tone: "casual",
      segmentCount: 3,
      seed: 999,
    });
    const best = result.segments.reduce((a, b) => (b.icpScore > a.icpScore ? b : a), result.segments[0]);
    expect(result.icp.bestSegmentId).toBe(best.id);
  });

  it("ICP checklist has 7 items", () => {
    const result = profileAudience({ product: "x", category: "generic", tone: "formal", segmentCount: 1, seed: 1 });
    expect(result.icp.checklist).toHaveLength(7);
  });

  it("includes messaging angles", () => {
    const result = profileAudience({ product: "x", category: "b2b-saas", tone: "formal", segmentCount: 1, seed: 1 });
    expect(result.segments[0].messagingAngles.length).toBeGreaterThan(0);
  });

  it("includes ICP breakdown with 5 criteria", () => {
    const result = profileAudience({ product: "x", category: "generic", tone: "formal", segmentCount: 1, seed: 1 });
    const b = result.segments[0].icpBreakdown;
    expect(b).toHaveProperty("fit");
    expect(b).toHaveProperty("urgency");
    expect(b).toHaveProperty("budget");
    expect(b).toHaveProperty("accessibility");
    expect(b).toHaveProperty("expansion");
  });

  it("persona has day in the life array", () => {
    const result = profileAudience({ product: "x", category: "dev-tool", tone: "formal", segmentCount: 1, seed: 1 });
    expect(result.segments[0].persona.dayInTheLife.length).toBeGreaterThan(0);
  });

  it("persona has quote", () => {
    const result = profileAudience({ product: "x", category: "generic", tone: "formal", segmentCount: 1, seed: 1 });
    expect(result.segments[0].persona.quote).toBeTruthy();
    expect(result.segments[0].persona.quote.length).toBeGreaterThan(0);
  });

  it("handles all categories", () => {
    const cats: Category[] = [
      "b2b-saas", "consumer-app", "e-commerce", "marketplace", "media-content",
      "dev-tool", "education", "healthcare", "finance-fintech", "nonprofit-community", "generic",
    ];
    for (const c of cats) {
      const r = profileAudience({ product: "x", category: c, tone: "formal", segmentCount: 1, seed: 1 });
      expect(r.segments).toHaveLength(1);
      expect(r.category).toBe(c);
    }
  });
});

describe("target-audience renderMarkdown", () => {
  it("renders markdown with all sections", () => {
    const result = profileAudience({ product: "test", category: "b2b-saas", tone: "formal", segmentCount: 1, seed: 1 });
    const md = renderMarkdown(result);
    expect(md).toContain("# Target Audience Profile");
    expect(md).toContain("**Product:**");
    expect(md).toContain("Persona:");
    expect(md).toContain("Day in the life:");
    expect(md).toContain("Demographics");
    expect(md).toContain("Psychographics");
    expect(md).toContain("Goals");
    expect(md).toContain("Pains");
    expect(md).toContain("Channels");
    expect(md).toContain("Messaging angles");
    expect(md).toContain("Objections");
    expect(md).toContain("Buying triggers");
    expect(md).toContain("ICP breakdown");
    expect(md).toContain("Ideal Customer Profile");
    expect(md).toContain("ICP checklist");
  });
  it("renders multiple segments", () => {
    const result = profileAudience({ product: "x", category: "generic", tone: "formal", segmentCount: 3, seed: 1 });
    const md = renderMarkdown(result);
    expect(md).toContain("Primary Segment");
    expect(md).toContain("Secondary Segment");
    expect(md).toContain("Tertiary Segment");
  });
});

describe("target-audience renderJson", () => {
  it("renders valid JSON", () => {
    const result = profileAudience({ product: "x", category: "generic", tone: "formal", segmentCount: 1, seed: 1 });
    const json = renderJson(result);
    const parsed = JSON.parse(json);
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.product).toBe("x");
  });
});

describe("target-audience history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, product: "x", category: "generic", segmentCount: 1, topScore: 80 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, product: `x${i}`, category: "generic", segmentCount: 1, topScore: 70 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, product: "x", category: "generic", segmentCount: 1, topScore: 70 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("target-audience share URL", () => {
  it("builds URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("my product", "b2b-saas", "formal", 2);
    expect(url).toContain("product=my+");
    expect(url).toContain("category=b2b-saas");
    expect(url).toContain("tone=formal");
    expect(url).toContain("segments=2");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses URL back", () => {
    const p = parseShareUrl("product=my+product&category=b2b-saas&tone=casual&segments=3");
    expect(p.product).toBe("my product");
    expect(p.category).toBe("b2b-saas");
    expect(p.tone).toBe("casual");
    expect(p.segmentCount).toBe(3);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.product).toBe("");
    expect(p.category).toBe("generic");
    expect(p.tone).toBe("formal");
    expect(p.segmentCount).toBe(1);
  });
  it("filters unknown categories", () => {
    const p = parseShareUrl("product=x&category=unknown-cat");
    expect(p.category).toBe("generic");
  });
  it("filters unknown tones", () => {
    const p = parseShareUrl("product=x&tone=unknown-tone");
    expect(p.tone).toBe("formal");
  });
  it("clamps invalid segment count", () => {
    const p = parseShareUrl("segments=99");
    expect(p.segmentCount).toBe(1);
  });
});

describe("target-audience buildLlmPrompt", () => {
  it("builds prompt with product and category", () => {
    const prompt = buildLlmPrompt({ product: "my app", category: "b2b-saas", tone: "formal", segmentCount: 2 });
    expect(prompt).toContain("my app");
    expect(prompt).toContain("B2B SaaS");
    expect(prompt).toContain("segments");
  });
});
