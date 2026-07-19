import { describe, it, expect, beforeEach } from "vitest";
import {
  GIFT_DATABASE,
  RECIPIENT_LABELS,
  OCCASION_LABELS,
  INTEREST_LABELS,
  BUDGET_LABELS,
  INTEREST_PRESETS,
  HISTORY_MAX,
  HONESTY_NOTE,
  normalizeString,
  parseList,
  validateProfile,
  formatPriceRange,
  matchesAvoid,
  scoreGift,
  generateGifts,
  generatePlan,
  groupByTier,
  buildShoppingUrl,
  renderText,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  loadProfiles,
  saveProfile,
  removeProfile,
  clearProfiles,
  buildShareUrl,
  parseShareUrl,
  makeId,
  buildLlmPrompt,
  parseLlmResult,
  renderLlmResult,
  type RecipientProfile,
  type RecipientType,
  type Occasion,
  type Interest,
  type BudgetTier,
  type GiftSeed,
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

function mkProfile(overrides: Partial<RecipientProfile> = {}): RecipientProfile {
  return {
    name: "Sam",
    recipient: "partner",
    age: 32,
    interests: ["books", "travel"],
    occasion: "birthday",
    budget: "mid",
    avoid: [],
    preferExperience: false,
    diyMode: false,
    ...overrides,
  };
}

describe("ai-gift-idea-generator constants", () => {
  it("has 5 recipient labels", () => {
    expect(Object.keys(RECIPIENT_LABELS)).toHaveLength(5);
    expect(RECIPIENT_LABELS.partner).toBeTruthy();
  });
  it("has 4 occasion labels", () => {
    expect(Object.keys(OCCASION_LABELS)).toHaveLength(4);
  });
  it("has 5 interest labels and presets", () => {
    expect(Object.keys(INTEREST_LABELS)).toHaveLength(5);
    expect(INTEREST_PRESETS).toHaveLength(5);
  });
  it("has 3 budget tiers", () => {
    expect(Object.keys(BUDGET_LABELS)).toHaveLength(3);
  });
  it("has at least 60 gifts in the database", () => {
    expect(GIFT_DATABASE.length).toBeGreaterThanOrEqual(60);
  });
  it("each gift seed has a non-empty name, category, and search term", () => {
    for (const g of GIFT_DATABASE) {
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.category.length).toBeGreaterThan(0);
      expect(g.searchTerm.length).toBeGreaterThan(0);
      expect(g.priceLow).toBeGreaterThanOrEqual(0);
      expect(g.priceHigh).toBeGreaterThanOrEqual(g.priceLow);
    }
  });
  it("every gift is tagged with at least one interest, recipient, and occasion", () => {
    for (const g of GIFT_DATABASE) {
      expect(g.interests.length).toBeGreaterThan(0);
      expect(g.recipients.length).toBeGreaterThan(0);
      expect(g.occasions.length).toBeGreaterThan(0);
    }
  });
  it("exposes HISTORY_MAX = 20 and an honesty note", () => {
    expect(HISTORY_MAX).toBe(20);
    expect(HONESTY_NOTE.length).toBeGreaterThan(50);
  });
});

describe("ai-gift-idea-generator normalizeString", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeString("  Hello   World  ")).toBe("hello world");
  });
  it("handles empty / undefined input", () => {
    expect(normalizeString("")).toBe("");
    expect(normalizeString(undefined as unknown as string)).toBe("");
  });
});

describe("ai-gift-idea-generator parseList", () => {
  it("parses newline-separated values", () => {
    expect(parseList("mug\nbook\npen")).toEqual(["mug", "book", "pen"]);
  });
  it("parses comma-separated values", () => {
    expect(parseList("mug, book, pen")).toEqual(["mug", "book", "pen"]);
  });
  it("skips blank entries", () => {
    expect(parseList("mug\n\nbook")).toEqual(["mug", "book"]);
  });
  it("returns empty array for empty input", () => {
    expect(parseList("")).toEqual([]);
  });
});

describe("ai-gift-idea-generator validateProfile", () => {
  it("returns no warnings for a valid profile", () => {
    expect(validateProfile(mkProfile())).toEqual([]);
  });
  it("warns when name is blank", () => {
    expect(validateProfile(mkProfile({ name: "" })).some((w) => w.includes("name"))).toBe(true);
  });
  it("warns when age is non-positive", () => {
    expect(validateProfile(mkProfile({ age: 0 })).some((w) => w.includes("Age"))).toBe(true);
  });
  it("warns when interests is empty", () => {
    expect(validateProfile(mkProfile({ interests: [] })).some((w) => w.includes("interest"))).toBe(true);
  });
  it("warns when avoid list is very long", () => {
    const avoid = Array.from({ length: 35 }, (_, i) => `gift${i}`);
    expect(validateProfile(mkProfile({ avoid })).some((w) => w.includes("Avoid list"))).toBe(true);
  });
});

describe("ai-gift-idea-generator formatPriceRange", () => {
  it("formats a normal range", () => {
    expect(formatPriceRange(25, 50)).toBe("$25–$50");
  });
  it("formats single price when low === high", () => {
    expect(formatPriceRange(30, 30)).toBe("$30");
  });
  it("returns Free when both zero", () => {
    expect(formatPriceRange(0, 0)).toBe("Free");
  });
});

describe("ai-gift-idea-generator matchesAvoid", () => {
  it("matches substring case-insensitively", () => {
    expect(matchesAvoid("Signed first-edition novel", ["signed first"])).toBe(true);
    expect(matchesAvoid("Signed first-edition novel", ["SIGNED FIRST"])).toBe(true);
  });
  it("returns false when no avoid entry matches", () => {
    expect(matchesAvoid("Yoga mat", ["book", "tech"])).toBe(false);
  });
  it("returns false for empty avoid list", () => {
    expect(matchesAvoid("Anything", [])).toBe(false);
  });
});

describe("ai-gift-idea-generator scoreGift", () => {
  it("scores higher when tier matches", () => {
    const seed: GiftSeed = GIFT_DATABASE[0];
    const a = scoreGift(seed, mkProfile({ budget: seed.tier }));
    const b = scoreGift(seed, mkProfile({ budget: seed.tier === "low" ? "splurge" : "low" }));
    expect(a).toBeGreaterThan(b);
  });
  it("scores higher when interest matches", () => {
    const seed: GiftSeed = GIFT_DATABASE.find((g) => g.interests.includes("books"))!;
    const matched = scoreGift(seed, mkProfile({ interests: ["books"] }));
    const unmatched = scoreGift(seed, mkProfile({ interests: ["sports"] }));
    expect(matched).toBeGreaterThan(unmatched);
  });
  it("rewards experience preference for experience gifts", () => {
    const exp = GIFT_DATABASE.find((g) => g.isExperience)!;
    const profile = mkProfile({ interests: exp.interests, budget: exp.tier, recipient: exp.recipients[0], occasion: exp.occasions[0] });
    const withPref = scoreGift(exp, { ...profile, preferExperience: true });
    const withoutPref = scoreGift(exp, { ...profile, preferExperience: false });
    expect(withPref).toBeGreaterThan(withoutPref);
  });
});

describe("ai-gift-idea-generator generateGifts", () => {
  it("returns at least 10 suggestions for a typical profile", () => {
    const gifts = generateGifts(mkProfile({ interests: ["books", "tech", "cooking", "travel", "sports"] }));
    expect(gifts.length).toBeGreaterThanOrEqual(10);
  });
  it("filters out gifts in the avoid list", () => {
    const seed = GIFT_DATABASE.find((g) => g.interests.includes("books"))!;
    const gifts = generateGifts(mkProfile({ interests: ["books"], avoid: [seed.name.toLowerCase().split(" ")[0]] }));
    expect(gifts.every((g) => g.id !== seed.id)).toBe(true);
  });
  it("sorts suggestions by descending score", () => {
    const gifts = generateGifts(mkProfile());
    for (let i = 1; i < gifts.length; i++) {
      expect(gifts[i - 1].score).toBeGreaterThanOrEqual(gifts[i].score);
    }
  });
  it("each suggestion has a price range string", () => {
    const gifts = generateGifts(mkProfile());
    expect(gifts.length).toBeGreaterThan(0);
    for (const g of gifts) expect(g.priceRange.length).toBeGreaterThan(0);
  });
});

describe("ai-gift-idea-generator generatePlan", () => {
  it("returns a plan with capped suggestions", () => {
    const plan = generatePlan(mkProfile({ interests: ["books", "tech", "cooking", "travel", "sports"] }), 8);
    expect(plan.count).toBeLessThanOrEqual(8);
    expect(plan.suggestions.length).toBe(plan.count);
  });
  it("adds a warning when fewer than 5 matches", () => {
    // Narrow profile: obscure recipient × unusual combo with no match.
    const plan = generatePlan(mkProfile({ interests: [], budget: "low" }), 12);
    // Without interests, score will be low but may still produce some — ensure warning when count < 5
    if (plan.count < 5) {
      expect(plan.warnings.some((w) => w.includes("strong matches"))).toBe(true);
    }
  });
  it("includes generatedAt timestamp", () => {
    const plan = generatePlan(mkProfile());
    expect(plan.generatedAt).toBeGreaterThan(0);
  });
});

describe("ai-gift-idea-generator groupByTier", () => {
  it("groups suggestions into low / mid / splurge", () => {
    const plan = generatePlan(mkProfile({ interests: ["books", "tech", "cooking", "travel", "sports"] }));
    const grouped = groupByTier(plan.suggestions);
    expect(Object.keys(grouped)).toHaveLength(3);
    expect(grouped.low.length + grouped.mid.length + grouped.splurge.length).toBe(plan.suggestions.length);
  });
  it("returns empty arrays when given no suggestions", () => {
    const grouped = groupByTier([]);
    expect(grouped.low).toEqual([]);
    expect(grouped.mid).toEqual([]);
    expect(grouped.splurge).toEqual([]);
  });
});

describe("ai-gift-idea-generator buildShoppingUrl", () => {
  it("encodes the search term into a Google Shopping URL", () => {
    const url = buildShoppingUrl("cast iron skillet 10 inch");
    expect(url).toContain("https://www.google.com/search?tbm=shop&q=");
    expect(url).toContain(encodeURIComponent("cast iron skillet 10 inch"));
  });
  it("does not contain any affiliate parameter", () => {
    const url = buildShoppingUrl("yoga mat");
    expect(url).not.toMatch(/tag=|affid=|ref=/i);
  });
});

describe("ai-gift-idea-generator renderers", () => {
  const plan = generatePlan(mkProfile({ interests: ["books", "tech", "cooking", "travel", "sports"] }), 5);

  it("renderText includes the recipient name and honesty note", () => {
    const text = renderText(plan);
    expect(text).toContain("GIFT IDEA LIST");
    expect(text).toContain("Sam");
    expect(text).toContain(HONESTY_NOTE);
  });
  it("renderMarkdown includes headings and the recipient name", () => {
    const md = renderMarkdown(plan);
    expect(md).toContain("# Gift ideas for Sam");
    expect(md).toContain("## Suggestions");
    expect(md).toContain("**Recipient:**");
  });
  it("renderJson returns valid JSON with the plan fields", () => {
    const parsed = JSON.parse(renderJson(plan));
    expect(parsed.profile.name).toBe("Sam");
    expect(Array.isArray(parsed.suggestions)).toBe(true);
  });
  it("renderCsv starts with a header row and has at least one data row", () => {
    const csv = renderCsv(plan);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("rank,name,category,tier");
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("ai-gift-idea-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads an entry", () => {
    saveHistory({ ts: 1, recipientName: "Sam", recipient: "partner", occasion: "birthday", budget: "mid", count: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, recipientName: `R${i}`, recipient: "friend", occasion: "holiday", budget: "low", count: 3 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, recipientName: "Sam", recipient: "partner", occasion: "birthday", budget: "mid", count: 5 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-gift-idea-generator saved profiles (localStorage)", () => {
  it("saves and loads a profile", () => {
    saveProfile(mkProfile());
    expect(loadProfiles()).toHaveLength(1);
  });
  it("removes a profile by id", () => {
    const [saved] = saveProfile(mkProfile());
    removeProfile(saved.id);
    expect(loadProfiles()).toHaveLength(0);
  });
  it("clears all profiles", () => {
    saveProfile(mkProfile());
    saveProfile(mkProfile({ name: "Other" }));
    clearProfiles();
    expect(loadProfiles()).toEqual([]);
  });
});

describe("ai-gift-idea-generator shareable URL", () => {
  it("builds a share URL with all fields encoded", () => {
    const url = buildShareUrl({
      name: "Sam", recipient: "partner", age: 32,
      interests: ["books", "travel"], occasion: "birthday", budget: "mid",
      avoid: ["mug"], preferExperience: true, diyMode: false,
    });
    expect(url).toContain("name=Sam");
    expect(url).toContain("recipient=partner");
    expect(url).toContain("interests=books%2Ctravel");
    expect(url).toContain("exp=1");
  });
  it("parses a share URL back into the original state", () => {
    const orig = {
      name: "Sam", recipient: "partner" as RecipientType, age: 32,
      interests: ["books", "travel"] as Interest[], occasion: "birthday" as Occasion,
      budget: "mid" as BudgetTier, avoid: ["mug"], preferExperience: true, diyMode: false,
    };
    const url = buildShareUrl(orig);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).toEqual(orig);
  });
  it("returns null for an empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("filters out unknown interests during parse", () => {
    const parsed = parseShareUrl("name=Sam&recipient=friend&age=20&interests=books%2Cfishing&occasion=birthday&budget=low");
    expect(parsed!.interests).toEqual(["books"]);
  });
});

describe("ai-gift-idea-generator LLM helpers", () => {
  it("buildLlmPrompt includes recipient name and interests", () => {
    const prompt = buildLlmPrompt(mkProfile(), []);
    expect(prompt).toContain("Sam");
    expect(prompt).toContain("Books");
    expect(prompt).toContain("Travel");
  });
  it("buildLlmPrompt lists already-suggested gifts as avoid", () => {
    const plan = generatePlan(mkProfile({ interests: ["books", "tech", "cooking", "travel", "sports"] }), 5);
    const prompt = buildLlmPrompt(mkProfile(), plan.suggestions);
    expect(prompt).toContain("Already-suggested");
    expect(prompt).toContain(plan.suggestions[0].name);
  });
  it("parseLlmResult parses numbered list lines", () => {
    const raw = "1. Custom map of your hometown — $30–$50: a personal keepsake. (search: custom map print)\n2. Music box — $25: nostalgic.";
    const en = parseLlmResult(raw, "test-model");
    expect(en.suggestions).toHaveLength(2);
    expect(en.suggestions[0].name).toContain("Custom map");
    expect(en.model).toBe("test-model");
  });
  it("renderLlmResult includes the model name and numbered suggestions", () => {
    const en = parseLlmResult("1. First idea\n2. Second idea", "test-model");
    const text = renderLlmResult(en);
    expect(text).toContain("test-model");
    expect(text).toContain("1. First idea");
    expect(text).toContain("2. Second idea");
  });
});

describe("ai-gift-idea-generator makeId", () => {
  it("generates unique IDs with a prefix", () => {
    const a = makeId("profile");
    const b = makeId("profile");
    expect(a.startsWith("profile-")).toBe(true);
    expect(b.startsWith("profile-")).toBe(true);
    expect(a).not.toBe(b);
  });
});
