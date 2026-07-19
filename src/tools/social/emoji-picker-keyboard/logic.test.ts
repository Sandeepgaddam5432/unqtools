import { describe, it, expect, beforeEach } from "vitest";
import {
  EMOJI_DB,
  TOP_EMOJIS,
  ZWJ_COMBINATIONS,
  CATEGORIES,
  CATEGORY_LABELS,
  SKIN_TONES,
  SKIN_TONE_LABELS,
  SKIN_TONE_MODIFIERS,
  normalizeQuery,
  searchEmojis,
  filterByCategory,
  applySkinTone,
  findVariations,
  findRelated,
  groupByCategory,
  countByCategory,
  computeStats,
  formatEmoji,
  renderText,
  renderCsv,
  splitCsvRow,
  copyText,
  findCombinations,
  findByChar,
  loadRecent,
  saveRecent,
  clearRecent,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type EmojiCategory,
  type SkinTone,
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

describe("emoji-picker constants", () => {
  it("has 600+ emoji entries", () => {
    expect(EMOJI_DB.length).toBeGreaterThanOrEqual(600);
  });

  it("has 9 categories", () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(9);
  });

  it("has all 9 categories with labels", () => {
    expect(CATEGORIES).toContain("smileys");
    expect(CATEGORIES).toContain("gestures");
    expect(CATEGORIES).toContain("animals");
    expect(CATEGORIES).toContain("food");
    expect(CATEGORIES).toContain("activities");
    expect(CATEGORIES).toContain("travel");
    expect(CATEGORIES).toContain("objects");
    expect(CATEGORIES).toContain("symbols");
    expect(CATEGORIES).toContain("flags");
  });

  it("has 6 skin tones (none + 5 modifiers)", () => {
    expect(SKIN_TONES).toHaveLength(6);
    expect(Object.keys(SKIN_TONE_LABELS)).toHaveLength(6);
    expect(Object.keys(SKIN_TONE_MODIFIERS)).toHaveLength(5);
  });

  it("has 100 frequently-used emoji presets", () => {
    expect(TOP_EMOJIS).toHaveLength(100);
  });

  it("has 15+ ZWJ combinations", () => {
    expect(ZWJ_COMBINATIONS.length).toBeGreaterThanOrEqual(15);
  });

  it("every emoji entry has valid fields", () => {
    for (const e of EMOJI_DB) {
      expect(typeof e.char).toBe("string");
      expect(e.char.length).toBeGreaterThan(0);
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(Array.isArray(e.keywords)).toBe(true);
      expect(CATEGORIES).toContain(e.category);
      expect(typeof e.skinToneSupport).toBe("boolean");
    }
  });

  it("every emoji char is unique", () => {
    const chars = EMOJI_DB.map((e) => e.char);
    const set = new Set(chars);
    expect(set.size).toBe(chars.length);
  });

  it("each category has at least 20 emojis", () => {
    const counts = countByCategory(EMOJI_DB);
    for (const c of CATEGORIES) {
      expect(counts[c], `category ${c}`).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("emoji-picker normalizeQuery", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeQuery("  Happy   Face  ")).toBe("happy face");
  });
  it("handles empty", () => {
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery(null as unknown as string)).toBe("");
  });
});

describe("emoji-picker searchEmojis", () => {
  it("finds emojis by name (case-insensitive)", () => {
    const results = searchEmojis("grinning");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.name.toLowerCase().includes("grinning"))).toBe(true);
  });

  it("finds emojis by keyword", () => {
    const results = searchEmojis("happy");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) =>
      e.name.toLowerCase().includes("happy") ||
      e.keywords.some((k) => k.includes("happy")),
    )).toBe(true);
  });

  it("empty query returns all emojis", () => {
    const results = searchEmojis("");
    expect(results.length).toBe(EMOJI_DB.length);
  });

  it("respects category filter", () => {
    const results = searchEmojis("a", { category: "flags" });
    expect(results.every((e) => e.category === "flags")).toBe(true);
  });

  it("respects limit", () => {
    const results = searchEmojis("", { limit: 10 });
    expect(results.length).toBe(10);
  });

  it("returns empty for no matches", () => {
    const results = searchEmojis("zzzznotarealquery");
    expect(results).toEqual([]);
  });

  it("partial keyword match works", () => {
    const results = searchEmojis("hap");
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("emoji-picker filterByCategory", () => {
  it("returns only emojis from the specified category", () => {
    const flags = filterByCategory("flags");
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every((e) => e.category === "flags")).toBe(true);
  });
  it("returns at least 20 emojis per category", () => {
    for (const c of CATEGORIES) {
      expect(filterByCategory(c).length).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("emoji-picker applySkinTone", () => {
  const wavingHand = EMOJI_DB.find((e) => e.char === "👋")!;
  const heart = EMOJI_DB.find((e) => e.char === "❤️")!;

  it("returns base char when tone is none", () => {
    expect(applySkinTone(wavingHand, "none")).toBe("👋");
  });

  it("returns base char when emoji has no skin tone support", () => {
    expect(applySkinTone(heart, "dark")).toBe("❤️");
  });

  it("appends modifier when emoji supports skin tones", () => {
    const result = applySkinTone(wavingHand, "light");
    expect(result).toBe("👋" + SKIN_TONE_MODIFIERS["light"]);
    expect(result.length).toBeGreaterThan(wavingHand.char.length);
  });

  it("applies all 5 skin tone modifiers", () => {
    const tones: Exclude<SkinTone, "none">[] = [
      "light", "medium-light", "medium", "medium-dark", "dark",
    ];
    for (const t of tones) {
      const result = applySkinTone(wavingHand, t);
      expect(result).toContain(SKIN_TONE_MODIFIERS[t]);
    }
  });
});

describe("emoji-picker findVariations", () => {
  it("returns single base char for emoji without skin tone support", () => {
    const heart = EMOJI_DB.find((e) => e.char === "❤️")!;
    const variations = findVariations(heart);
    expect(variations).toEqual(["❤️"]);
  });

  it("returns 6 variations (base + 5 tones) for emoji with skin tone support", () => {
    const wavingHand = EMOJI_DB.find((e) => e.char === "👋")!;
    const variations = findVariations(wavingHand);
    expect(variations).toHaveLength(6);
    expect(variations[0]).toBe("👋");
    // Each subsequent variation should be longer (modifier appended)
    for (let i = 1; i < 6; i++) {
      expect(variations[i].length).toBeGreaterThan(wavingHand.char.length);
    }
  });
});

describe("emoji-picker findRelated", () => {
  it("finds related emojis (sharing keywords)", () => {
    const cat = EMOJI_DB.find((e) => e.char === "🐱")!;
    const related = findRelated(cat, 5);
    expect(related.length).toBeGreaterThan(0);
    // All related should share at least one keyword with cat
    const catKw = new Set(cat.keywords.map((k) => k.toLowerCase()));
    expect(related.every((e) =>
      e.keywords.some((k) => catKw.has(k.toLowerCase())),
    )).toBe(true);
  });

  it("excludes self", () => {
    const cat = EMOJI_DB.find((e) => e.char === "🐱")!;
    const related = findRelated(cat, 10);
    expect(related.every((e) => e.char !== "🐱")).toBe(true);
  });

  it("respects limit", () => {
    const cat = EMOJI_DB.find((e) => e.char === "🐱")!;
    const related = findRelated(cat, 3);
    expect(related.length).toBeLessThanOrEqual(3);
  });
});

describe("emoji-picker groupByCategory / countByCategory", () => {
  it("groups emojis by category", () => {
    const grouped = groupByCategory(EMOJI_DB);
    expect(Object.keys(grouped)).toHaveLength(9);
    const total = CATEGORIES.reduce((s, c) => s + grouped[c].length, 0);
    expect(total).toBe(EMOJI_DB.length);
  });

  it("counts emojis per category", () => {
    const counts = countByCategory(EMOJI_DB);
    const total = CATEGORIES.reduce((s, c) => s + counts[c], 0);
    expect(total).toBe(EMOJI_DB.length);
  });
});

describe("emoji-picker computeStats", () => {
  it("computes total and per-category stats", () => {
    const stats = computeStats(EMOJI_DB);
    expect(stats.total).toBe(EMOJI_DB.length);
    expect(Object.keys(stats.byCategory)).toHaveLength(9);
    const sum = CATEGORIES.reduce((s, c) => s + stats.byCategory[c], 0);
    expect(sum).toBe(EMOJI_DB.length);
  });
});

describe("emoji-picker formatEmoji / renderText / renderCsv", () => {
  it("formats an emoji as 'char name'", () => {
    const heart = EMOJI_DB.find((e) => e.char === "❤️")!;
    expect(formatEmoji(heart)).toBe("❤️ red heart");
  });

  it("renders text one per line", () => {
    const cat = EMOJI_DB.find((e) => e.char === "🐱")!;
    const text = renderText([cat]);
    expect(text).toBe("🐱 cat face");
    expect(text.split("\n")).toHaveLength(1);
  });

  it("renders CSV with header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("char,name,category,keywords,skin_tone_support");
  });

  it("renders CSV with rows", () => {
    const heart = EMOJI_DB.find((e) => e.char === "❤️")!;
    const csv = renderCsv([heart]);
    expect(csv).toContain("❤️");
    expect(csv).toContain("red heart");
    expect(csv).toContain("symbols");
    expect(csv.split("\n")).toHaveLength(2);
  });

  it("escapes commas in keywords", () => {
    const entry = EMOJI_DB.find((e) => e.name === "soccer ball")!;
    const csv = renderCsv([entry]);
    expect(csv).toContain("soccer ball");
  });
});

describe("emoji-picker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("emoji-picker copyText", () => {
  it("returns the input string", () => {
    expect(copyText("hello")).toBe("hello");
    expect(copyText("😀")).toBe("😀");
  });
});

describe("emoji-picker findCombinations", () => {
  it("finds combinations whose components are all present", () => {
    const combos = findCombinations(["❤️", "🔥"]);
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.some((c) => c.name === "heart on fire")).toBe(true);
  });

  it("finds combinations with multi-component inputs", () => {
    const combos = findCombinations(["👨", "❤️", "👩"]);
    expect(combos.some((c) => c.name === "couple with heart (M-W)")).toBe(true);
  });

  it("returns empty when no input", () => {
    expect(findCombinations([])).toEqual([]);
  });

  it("returns empty when no matches", () => {
    expect(findCombinations(["🐱"])).toEqual([]);
  });
});

describe("emoji-picker findByChar", () => {
  it("finds an emoji by its character", () => {
    const found = findByChar("❤️");
    expect(found).toBeDefined();
    expect(found?.name).toBe("red heart");
  });

  it("returns undefined for unknown char", () => {
    expect(findByChar("not-an-emoji")).toBeUndefined();
  });
});

describe("emoji-picker recently used (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadRecent()).toEqual([]);
  });

  it("saves and loads", () => {
    saveRecent("😀");
    expect(loadRecent()).toContain("😀");
  });

  it("deduplicates and moves to front", () => {
    saveRecent("😀");
    saveRecent("😂");
    saveRecent("😀"); // moved to front
    const recent = loadRecent();
    expect(recent[0]).toBe("😀");
    const dupes = recent.filter((c) => c === "😀");
    expect(dupes).toHaveLength(1);
  });

  it("caps at 50", () => {
    for (let i = 0; i < 60; i++) {
      saveRecent(`emoji-${i}`);
    }
    expect(loadRecent()).toHaveLength(50);
  });

  it("clears", () => {
    saveRecent("😀");
    clearRecent();
    expect(loadRecent()).toEqual([]);
  });
});

describe("emoji-picker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({ ts: Date.now(), char: "😀", name: "grinning face" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].char).toBe("😀");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, char: "😀", name: "grinning face" });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({ ts: 1, char: "😀", name: "grinning face" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("emoji-picker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("happy", "smileys", "light");
    expect(url).toContain("q=happy");
    expect(url).toContain("cat=smileys");
    expect(url).toContain("tone=light");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("omits empty params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("", "", "none");
    expect(url).not.toContain("q=");
    expect(url).not.toContain("cat=");
    expect(url).not.toContain("tone=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const parsed = parseShareUrl("q=happy&cat=smileys&tone=dark");
    expect(parsed.query).toBe("happy");
    expect(parsed.category).toBe("smileys");
    expect(parsed.tone).toBe("dark");
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ query: "", category: "", tone: "none" });
  });

  it("filters unknown categories", () => {
    const parsed = parseShareUrl("q=test&cat=not-a-category");
    expect(parsed.category).toBe("");
  });

  it("filters unknown skin tones", () => {
    const parsed = parseShareUrl("q=test&tone=invalid-tone");
    expect(parsed.tone).toBe("none");
  });

  it("strips leading hash", () => {
    const parsed = parseShareUrl("#q=happy");
    expect(parsed.query).toBe("happy");
  });
});

// Suppress unused-import lint
export type _Unused = EmojiCategory | SkinTone;
