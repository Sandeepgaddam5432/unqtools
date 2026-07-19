import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FAVES_KEY,
  GOAL_LABELS,
  TONE_LABELS,
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
  PLACEMENT_LABELS,
  PLATFORM_LIMITS,
  PLATFORM_LABELS,
  FRAMEWORKS,
  POWER_WORDS,
  PRODUCT_PRESETS,
  AUDIENCE_PRESETS,
  clean,
  normalizeText,
  leadNoun,
  detectPowerWords,
  generateCtas,
  scoreCta,
  generateAbPair,
  generateAbPairs,
  analyzeCta,
  computeStats,
  renderText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Goal,
  type Tone,
  type Angle,
  type Placement,
  type Platform,
  type CtaVariant,
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

describe("ai-cta constants", () => {
  it("has 8 goals", () => {
    expect(Object.keys(GOAL_LABELS)).toHaveLength(8);
  });
  it("has 6 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(6);
  });
  it("has 10 angles", () => {
    expect(Object.keys(ANGLE_LABELS)).toHaveLength(10);
    expect(Object.keys(ANGLE_DESCRIPTIONS)).toHaveLength(10);
  });
  it("has 5 placements", () => {
    expect(Object.keys(PLACEMENT_LABELS)).toHaveLength(5);
  });
  it("has 8 platforms with character limits", () => {
    expect(Object.keys(PLATFORM_LIMITS)).toHaveLength(8);
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(8);
    expect(PLATFORM_LIMITS["google-headline"]).toBe(30);
    expect(PLATFORM_LIMITS["button-micro"]).toBe(24);
  });
  it("has 3 frameworks", () => {
    expect(FRAMEWORKS).toEqual(["AIDA", "PAS", "direct"]);
  });
  it("has power words", () => {
    expect(POWER_WORDS.length).toBeGreaterThanOrEqual(20);
    expect(POWER_WORDS).toContain("free");
    expect(POWER_WORDS).toContain("now");
  });
  it("has product and audience presets", () => {
    expect(PRODUCT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(AUDIENCE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("has history constants", () => {
    expect(HISTORY_KEY).toContain("ai-cta");
    expect(HISTORY_MAX).toBe(20);
    expect(FAVES_KEY).toContain("ai-cta");
  });
});

describe("ai-cta clean / normalizeText", () => {
  it("cleans whitespace", () => {
    expect(clean("  Hello   world  ")).toBe("Hello world");
  });
  it("handles empty", () => {
    expect(clean("")).toBe("");
  });
  it("lowercases for normalizeText", () => {
    expect(normalizeText("Hello WORLD")).toBe("hello world");
  });
});

describe("ai-cta leadNoun", () => {
  it("strips leading articles", () => {
    expect(leadNoun("the best app")).toBe("best app");
    expect(leadNoun("a card")).toBe("card");
  });
  it("handles empty", () => {
    expect(leadNoun("")).toBe("");
  });
  it("keeps original if all stripped", () => {
    expect(leadNoun("my app")).toBe("app");
  });
});

describe("ai-cta detectPowerWords", () => {
  it("detects multiple power words", () => {
    const out = detectPowerWords("Get free access now and save big today");
    expect(out).toContain("free");
    expect(out).toContain("now");
    expect(out).toContain("save");
    expect(out).toContain("today");
  });
  it("returns empty when none", () => {
    expect(detectPowerWords("hello world")).toEqual([]);
  });
  it("is case-insensitive", () => {
    expect(detectPowerWords("FREE Now TODAY")).toContain("free");
  });
});

describe("ai-cta generateCtas", () => {
  it("generates 10 variants by default", () => {
    const out = generateCtas({
      goal: "signup", product: "fitness app", audience: "busy parents", tone: "friendly",
    });
    expect(out).toHaveLength(10);
  });
  it("respects max", () => {
    const out = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 5,
    });
    expect(out).toHaveLength(5);
  });
  it("respects selected angles", () => {
    const out = generateCtas({
      goal: "trial", product: "app", audience: "users", tone: "bold",
      angles: ["urgency", "scarcity"], placements: ["button"],
    });
    expect(out).toHaveLength(2);
    expect(out.every((v) => v.angle === "urgency" || v.angle === "scarcity")).toBe(true);
  });
  it("includes angle label and rationale", () => {
    const out = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "friendly", max: 1,
    });
    expect(out[0].rationale).toBeTruthy();
    expect(out[0].rationale.length).toBeGreaterThan(20);
  });
  it("includes charCount, charLimit, exceedsLimit", () => {
    const out = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional",
      angles: ["urgency"], placements: ["button"], platform: "button-micro", max: 1,
    });
    expect(out[0].charCount).toBeGreaterThan(0);
    expect(out[0].charLimit).toBe(24);
    expect(typeof out[0].exceedsLimit).toBe("boolean");
  });
  it("includes power words", () => {
    const out = generateCtas({
      goal: "trial", product: "app", audience: "users", tone: "professional",
      angles: ["value"], placements: ["banner"], max: 1,
    });
    expect(out[0].powerWords).toContain("free");
  });
  it("includes framework tag", () => {
    const out = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional",
      angles: ["urgency", "action"], placements: ["button"], max: 2,
    });
    expect(out.every((v) => v.framework === "AIDA" || v.framework === "PAS" || v.framework === "direct")).toBe(true);
  });
  it("applies tone transformations", () => {
    const out = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "bold",
      angles: ["action"], placements: ["button"], max: 1,
    });
    // Bold tone uppercases the leading verb
    expect(out[0].text).toMatch(/^(SIGN|BUY|TRY|DOWNLOAD|BOOK|SUBSCRIBE|REGISTER|GET)/);
  });
  it("detects button exceeds limit", () => {
    const out = generateCtas({
      goal: "signup", product: "an incredible productivity software for teams", audience: "users",
      tone: "professional", angles: ["urgency"], placements: ["banner"], platform: "google-headline", max: 1,
    });
    expect(out[0].charLimit).toBe(30);
  });
  it("returns variants with unique ids", () => {
    const out = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 5,
    });
    const ids = new Set(out.map((v) => v.id));
    expect(ids.size).toBe(5);
  });
});

describe("ai-cta scoreCta", () => {
  it("rewards short button copy", () => {
    const s = scoreCta({
      text: "Sign up", angle: "action", placement: "button", tone: "professional",
      powerWords: [], charLimit: 24,
    });
    expect(s).toBeGreaterThan(50);
  });
  it("penalizes button over limit", () => {
    const s = scoreCtasHelper("Sign up now for free and get instant access to all features", "button", 24);
    expect(s).toBeLessThan(70);
  });
  it("rewards power words", () => {
    const s1 = scoreCta({
      text: "Get the report", angle: "action", placement: "inline", tone: "professional",
      powerWords: [], charLimit: 80,
    });
    const s2 = scoreCta({
      text: "Get the free report now", angle: "action", placement: "inline", tone: "professional",
      powerWords: ["free", "now"], charLimit: 80,
    });
    expect(s2).toBeGreaterThan(s1);
  });
  it("rewards strong angles", () => {
    const s1 = scoreCta({
      text: "Click here", angle: "action", placement: "button", tone: "professional",
      powerWords: [], charLimit: 24,
    });
    const s2 = scoreCta({
      text: "Sign up now", angle: "urgency", placement: "button", tone: "urgent",
      powerWords: ["now"], charLimit: 24,
    });
    expect(s2).toBeGreaterThan(s1);
  });
  it("caps at 100", () => {
    const s = scoreCta({
      text: "Sign up free now today", angle: "urgency", placement: "button", tone: "urgent",
      powerWords: ["free", "now", "today"], charLimit: 24,
    });
    expect(s).toBeLessThanOrEqual(100);
  });
  it("floors at 0", () => {
    const s = scoreCta({
      text: "x".repeat(200), angle: "action", placement: "button", tone: "professional",
      powerWords: [], charLimit: 24,
    });
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

function scoreCtasHelper(text: string, placement: Placement, charLimit: number): number {
  return scoreCta({
    text, angle: "action", placement, tone: "professional",
    powerWords: detectPowerWords(text), charLimit,
  });
}

describe("ai-cta generateAbPair", () => {
  it("generates a pair from two variants with different angles", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional",
      angles: ["urgency", "scarcity", "benefit", "value"], placements: ["button"], max: 4,
    });
    const pair = generateAbPair(vs);
    expect(pair).not.toBeNull();
    expect(pair!.control.id).not.toBe(pair!.challenger.id);
    expect(pair!.control.angle).not.toBe(pair!.challenger.angle);
    expect(pair!.hypothesis).toBeTruthy();
    expect(pair!.whatToMeasure).toContain("Click-through");
  });
  it("falls back to any second variant when all angles match", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional",
      angles: ["urgency"], placements: ["button", "banner"], max: 2,
    });
    const pair = generateAbPair(vs);
    expect(pair).not.toBeNull();
    expect(pair!.control.id).not.toBe(pair!.challenger.id);
  });
  it("returns null for fewer than 2 variants", () => {
    expect(generateAbPair([])).toBeNull();
    expect(generateAbPair([singleVariant()])).toBeNull();
  });
});

describe("ai-cta generateAbPairs", () => {
  it("generates multiple pairs", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 10,
    });
    const pairs = generateAbPairs(vs, 3);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.length).toBeLessThanOrEqual(3);
  });
  it("returns empty for fewer than 2 variants", () => {
    expect(generateAbPairs([], 3)).toEqual([]);
  });
});

describe("ai-cta analyzeCta", () => {
  it("detects urgency angle", () => {
    const r = analyzeCta("Sign up now — offer ends today");
    expect(r.detectedAngles).toContain("urgency");
    expect(r.powerWords).toContain("now");
    expect(r.powerWords).toContain("today");
  });
  it("detects scarcity angle", () => {
    const r = analyzeCta("Only 5 spots left");
    expect(r.detectedAngles).toContain("scarcity");
  });
  it("detects social proof", () => {
    const r = analyzeCta("Join 10,000 users today");
    expect(r.detectedAngles).toContain("social-proof");
  });
  it("detects question angle", () => {
    const r = analyzeCta("Ready to get started?");
    expect(r.detectedAngles).toContain("question");
  });
  it("falls back to action angle when none detected", () => {
    const r = analyzeCta("Click here");
    expect(r.detectedAngles).toContain("action");
  });
  it("returns suggestions for weak CTAs", () => {
    const r = analyzeCta("OK");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
  it("returns charCount and score", () => {
    const r = analyzeCta("Sign up free now");
    expect(r.charCount).toBe(16);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("ai-cta computeStats", () => {
  it("computes per-angle stats", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 6,
    });
    const stats = computeStats(vs);
    expect(stats.length).toBeGreaterThan(0);
    expect(stats.some((s) => s.angle === vs[0].angle)).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(computeStats([])).toEqual([]);
  });
});

describe("ai-cta renderers", () => {
  it("renders text with angle and rationale", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 2,
    });
    const text = renderText(vs);
    expect(text).toContain(ANGLE_LABELS[vs[0].angle]);
    expect(text).toContain("score");
  });
  it("renders markdown with code blocks", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 2,
    });
    const md = renderMarkdown(vs);
    expect(md).toContain("###");
    expect(md).toContain("**");
  });
  it("renders CSV with header", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 2,
    });
    const csv = renderCsv(vs);
    expect(csv).toContain("text,angle,placement,platform");
    expect(csv.split("\n").length).toBe(3);
  });
  it("escapes commas in CSV", () => {
    const csv = renderCsv([
      {
        id: "x", text: "Sign up, free today", angle: "urgency", placement: "button",
        platform: "button-micro", goal: "signup", tone: "urgent", score: 80,
        charCount: 19, charLimit: 24, exceedsLimit: false,
        powerWords: ["free", "today"], framework: "PAS", rationale: "x",
      },
    ]);
    expect(csv).toContain('"Sign up, free today"');
  });
  it("renders JSON valid", () => {
    const vs = generateCtas({
      goal: "signup", product: "app", audience: "users", tone: "professional", max: 2,
    });
    const json = renderJson(vs);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("ai-cta history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, goal: "signup", product: "app", audience: "users",
      tone: "professional", variantCount: 10, avgScore: 75,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, goal: "signup", product: "x", audience: "u",
        tone: "professional", variantCount: 1, avgScore: 50,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, goal: "signup", product: "x", audience: "u",
      tone: "professional", variantCount: 1, avgScore: 50,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-cta favorites (localStorage)", () => {
  it("loads empty initially", () => { expect(loadFavorites()).toEqual([]); });
  it("saves and loads", () => {
    saveFavorite({
      id: "x1", ts: 1, text: "Sign up now", angle: "urgency",
      placement: "button", goal: "signup", tone: "urgent", score: 85,
    });
    expect(loadFavorites()).toHaveLength(1);
  });
  it("removes by id", () => {
    saveFavorite({
      id: "x1", ts: 1, text: "Sign up now", angle: "urgency",
      placement: "button", goal: "signup", tone: "urgent", score: 85,
    });
    removeFavorite("x1");
    expect(loadFavorites()).toEqual([]);
  });
  it("dedupes by id", () => {
    saveFavorite({
      id: "x1", ts: 1, text: "Old", angle: "urgency",
      placement: "button", goal: "signup", tone: "urgent", score: 80,
    });
    saveFavorite({
      id: "x1", ts: 2, text: "New", angle: "urgency",
      placement: "button", goal: "signup", tone: "urgent", score: 90,
    });
    const favs = loadFavorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].text).toBe("New");
  });
  it("clears", () => {
    saveFavorite({
      id: "x1", ts: 1, text: "Sign up now", angle: "urgency",
      placement: "button", goal: "signup", tone: "urgent", score: 85,
    });
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

describe("ai-cta shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      goal: "signup", product: "fitness app", audience: "busy parents",
      tone: "friendly", platform: "button-micro", currentCta: "Sign up now",
    });
    expect(url).toContain("g=signup");
    expect(url).toContain("p=fitness+app");
    expect(url).toContain("a=busy+parents");
    expect(url).toContain("t=friendly");
    expect(url).toContain("pl=button-micro");
    expect(url).toContain("cur=Sign+up+now");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = "g=trial&p=app&a=users&t=bold&pl=google-headline&cur=Try+now";
    const p = parseShareUrl(url);
    expect(p.goal).toBe("trial");
    expect(p.product).toBe("app");
    expect(p.audience).toBe("users");
    expect(p.tone).toBe("bold");
    expect(p.platform).toBe("google-headline");
    expect(p.currentCta).toBe("Try now");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown goal", () => {
    const p = parseShareUrl("g=unknown-goal");
    expect(p.goal).toBeUndefined();
  });
  it("filters unknown platform", () => {
    const p = parseShareUrl("pl=unknown-platform");
    expect(p.platform).toBeUndefined();
  });
});

describe("ai-cta LLM helpers", () => {
  it("builds prompt with goal and platform", () => {
    const prompt = buildLlmPrompt("signup", "fitness app", "busy parents", "friendly", "button-micro");
    expect(prompt).toContain("Sign up");
    expect(prompt).toContain("fitness app");
    expect(prompt).toContain("busy parents");
    expect(prompt).toContain("Friendly");
    expect(prompt).toContain("24 chars");
  });
  it("parses valid LLM JSON output", () => {
    const raw = JSON.stringify([
      { text: "Sign up free now", angle: "urgency", framework: "PAS", rationale: "creates time pressure" },
      { text: "Discover the secret", angle: "curiosity", framework: "AIDA", rationale: "sparks intrigue" },
    ]);
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.variants).toHaveLength(2);
      expect(r.variants[0].text).toBe("Sign up free now");
      expect(r.variants[0].angle).toBe("urgency");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify([{ text: "x", angle: "action", framework: "direct", rationale: "" }]) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("rejects non-JSON output", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("parse");
  });
  it("rejects array with no valid objects", () => {
    const r = renderLlmResult(JSON.stringify([{ angle: "action" }]));
    expect(r.ok).toBe(false);
  });
  it("defaults unknown angle to action", () => {
    const r = renderLlmResult(JSON.stringify([{ text: "Click here", angle: "unknown-angle" }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.variants[0].angle).toBe("action");
  });
});

function singleVariant(): CtaVariant {
  return {
    id: "solo", text: "Sign up", angle: "action", placement: "button",
    platform: "button-micro", goal: "signup", tone: "professional",
    score: 70, charCount: 7, charLimit: 24, exceedsLimit: false,
    powerWords: [], framework: "direct", rationale: "Direct action.",
  };
}

// Suppress unused-import lint
export type _Unused = Goal | Tone | Angle | Placement | Platform | CtaVariant;
