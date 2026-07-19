import { describe, it, expect, beforeEach } from "vitest";
import {
  WORD_EMOJI_DICT,
  PHRASE_EMOJI_DICT,
  EMOJI_ART_TEMPLATES,
  ZWJ_SEQUENCES,
  EMOJI_TONE_MAP,
  TRANSLATION_MODES,
  DENSITY_OPTIONS,
  MODE_LABELS,
  DENSITY_LABELS,
  normalizeText,
  parseInput,
  splitSentences,
  lookupWord,
  lookupPhrase,
  findPhrases,
  suggestEmojis,
  getAlternativeEmojis,
  applyDensity,
  translateTextToEmoji,
  translateEmojiToText,
  generateEmojiArt,
  generateMixed,
  computeStats,
  countByCategory,
  coverageReport,
  detectTone,
  generateZwjSequence,
  findZwjByComponents,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TranslationMode,
  type EmojiDensity,
  type EmojiTone,
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

describe("emoji-translator constants", () => {
  it("has 1000+ word-to-emoji entries", () => {
    expect(Object.keys(WORD_EMOJI_DICT).length).toBeGreaterThanOrEqual(1000);
  });
  it("has 50+ phrase-to-emoji entries", () => {
    expect(Object.keys(PHRASE_EMOJI_DICT).length).toBeGreaterThanOrEqual(50);
  });
  it("has 10+ emoji art templates", () => {
    expect(Object.keys(EMOJI_ART_TEMPLATES).length).toBeGreaterThanOrEqual(10);
  });
  it("has 15+ ZWJ sequences", () => {
    expect(ZWJ_SEQUENCES.length).toBeGreaterThanOrEqual(15);
  });
  it("has 4 translation modes", () => {
    expect(TRANSLATION_MODES).toHaveLength(4);
    expect(TRANSLATION_MODES).toContain("text-to-emoji");
    expect(TRANSLATION_MODES).toContain("emoji-to-text");
    expect(TRANSLATION_MODES).toContain("emoji-art");
    expect(TRANSLATION_MODES).toContain("mixed");
  });
  it("has 4 density levels", () => {
    expect(DENSITY_OPTIONS).toHaveLength(4);
    expect(DENSITY_OPTIONS).toContain("sparse");
    expect(DENSITY_OPTIONS).toContain("medium");
    expect(DENSITY_OPTIONS).toContain("dense");
    expect(DENSITY_OPTIONS).toContain("ultra-dense");
  });
  it("has labels for all modes", () => {
    expect(Object.keys(MODE_LABELS).length).toBe(4);
  });
  it("has labels for all densities", () => {
    expect(Object.keys(DENSITY_LABELS).length).toBe(4);
  });
  it("has 6 emoji tones", () => {
    expect(Object.keys(EMOJI_TONE_MAP).length).toBe(6);
  });
  it("maps happy emoji to happy tone", () => {
    expect(EMOJI_TONE_MAP.happy).toContain("😊");
  });
});

describe("emoji-translator normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty input", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("emoji-translator parseInput", () => {
  it("tokenizes words", () => {
    expect(parseInput("Hello, world!")).toEqual(["hello", "world"]);
  });
  it("handles empty input", () => {
    expect(parseInput("")).toEqual([]);
  });
  it("handles punctuation", () => {
    expect(parseInput("I love dogs. And cats!")).toEqual(["i", "love", "dogs", "and", "cats"]);
  });
});

describe("emoji-translator splitSentences", () => {
  it("splits on . ! ?", () => {
    expect(splitSentences("Hello. World! How?")).toEqual(["Hello", "World", "How"]);
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("emoji-translator lookupWord", () => {
  it("looks up happy", () => {
    expect(lookupWord("happy")).toBe("😊");
  });
  it("looks up cat", () => {
    expect(lookupWord("cat")).toBe("🐱");
  });
  it("returns null for unmapped word", () => {
    expect(lookupWord("xyzzz")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(lookupWord("")).toBeNull();
  });
  it("handles case-insensitively", () => {
    expect(lookupWord("HAPPY")).toBe("😊");
  });
});

describe("emoji-translator lookupPhrase", () => {
  it("looks up good morning", () => {
    expect(lookupPhrase("good morning")).toBe("☀️🌅");
  });
  it("looks up happy birthday", () => {
    expect(lookupPhrase("happy birthday")).toBe("🎉🎂");
  });
  it("returns null for unknown phrase", () => {
    expect(lookupPhrase("nonsensical phrase")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(lookupPhrase("")).toBeNull();
  });
});

describe("emoji-translator findPhrases", () => {
  it("finds phrases in text", () => {
    const found = findPhrases("good morning everyone happy birthday to you");
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.some((p) => p.phrase === "good morning")).toBe(true);
    expect(found.some((p) => p.phrase === "happy birthday")).toBe(true);
  });
  it("returns empty for text without phrases", () => {
    expect(findPhrases("the quick brown fox")).toEqual([]);
  });
  it("sorts by start position", () => {
    const found = findPhrases("good morning happy birthday");
    expect(found[0].phrase).toBe("good morning");
    expect(found[1].phrase).toBe("happy birthday");
  });
  it("does not overlap matches", () => {
    const found = findPhrases("good morning");
    expect(found).toHaveLength(1);
    // Ensure no overlapping entries
    for (let i = 1; i < found.length; i++) {
      expect(found[i].start).toBeGreaterThanOrEqual(found[i - 1].end);
    }
  });
});

describe("emoji-translator suggestEmojis", () => {
  it("returns similar emojis for unmapped word", () => {
    const suggestions = suggestEmojis("happiness");
    expect(suggestions.length).toBeGreaterThan(0);
  });
  it("returns empty for empty input", () => {
    expect(suggestEmojis("")).toEqual([]);
  });
  it("limits to 5 suggestions", () => {
    const suggestions = suggestEmojis("happiness");
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });
});

describe("emoji-translator getAlternativeEmojis", () => {
  it("includes primary emoji for known word", () => {
    const alts = getAlternativeEmojis("happy");
    expect(alts).toContain("😊");
  });
  it("returns empty for empty input", () => {
    expect(getAlternativeEmojis("")).toEqual([]);
  });
  it("includes suggestions for unknown word", () => {
    const alts = getAlternativeEmojis("happiness");
    expect(alts.length).toBeGreaterThan(0);
  });
});

describe("emoji-translator applyDensity", () => {
  it("sparse: skips words (less than total)", () => {
    const idxs = applyDensity(10, "sparse");
    expect(idxs.length).toBeLessThan(10);
  });
  it("medium: skips some words", () => {
    const idxs = applyDensity(10, "medium");
    expect(idxs.length).toBeLessThan(10);
  });
  it("dense: every word", () => {
    const idxs = applyDensity(5, "dense");
    expect(idxs).toEqual([0, 1, 2, 3, 4]);
  });
  it("ultra-dense: more entries than words", () => {
    const idxs = applyDensity(5, "ultra-dense");
    expect(idxs.length).toBeGreaterThan(5);
  });
  it("returns empty for 0 words", () => {
    expect(applyDensity(0, "dense")).toEqual([]);
  });
});

describe("emoji-translator translateTextToEmoji", () => {
  it("translates simple text", () => {
    const result = translateTextToEmoji("happy cat", "dense", false);
    expect(result.output).toContain("😊");
    expect(result.output).toContain("🐱");
    expect(result.stats.totalWords).toBe(2);
  });
  it("translates phrases first", () => {
    const result = translateTextToEmoji("good morning", "dense", false);
    expect(result.output).toContain("☀️");
    expect(result.output).toContain("🌅");
  });
  it("preserves original when requested", () => {
    const result = translateTextToEmoji("hello world", "dense", true);
    expect(result.original).toBe("hello world");
  });
  it("does not preserve original when not requested", () => {
    const result = translateTextToEmoji("hello world", "dense", false);
    expect(result.original).toBeNull();
  });
  it("returns empty for empty input", () => {
    const result = translateTextToEmoji("", "dense", true);
    expect(result.output).toBe("");
  });
  it("includes coverage report", () => {
    const result = translateTextToEmoji("happy xyzzy", "dense", false);
    expect(result.coverage.covered).toContain("happy");
    expect(result.coverage.uncovered).toContain("xyzzy");
  });
  it("includes tone detection", () => {
    const result = translateTextToEmoji("happy", "dense", false);
    expect(result.tone).toBe("happy");
  });
  it("includes category counts", () => {
    const result = translateTextToEmoji("happy cat pizza", "dense", false);
    expect(result.categoryCounts.smileys).toBeGreaterThanOrEqual(1);
  });
  it("dense mode covers more than sparse", () => {
    const dense = translateTextToEmoji("happy cat dog bird", "dense", false);
    const sparse = translateTextToEmoji("happy cat dog bird", "sparse", false);
    expect(dense.stats.totalEmojis).toBeGreaterThanOrEqual(sparse.stats.totalEmojis);
  });
});

describe("emoji-translator translateEmojiToText", () => {
  it("translates emoji back to text", () => {
    const result = translateEmojiToText("I am 😊 today");
    expect(result.output).toContain("happy");
  });
  it("handles text without emojis", () => {
    const result = translateEmojiToText("just plain text");
    expect(result.output).toBe("just plain text");
  });
  it("handles empty input", () => {
    const result = translateEmojiToText("");
    expect(result.output).toBe("");
  });
  it("translates multiple emojis", () => {
    const result = translateEmojiToText("🐱 and 🐶");
    expect(result.stats.totalEmojis).toBeGreaterThanOrEqual(2);
  });
});

describe("emoji-translator generateEmojiArt", () => {
  it("generates heart art", () => {
    const art = generateEmojiArt("heart");
    expect(art).toContain("❤️");
    expect(art.split("\n").length).toBeGreaterThan(3);
  });
  it("generates christmas-tree art", () => {
    const art = generateEmojiArt("christmas-tree");
    expect(art).toContain("🎄");
  });
  it("handles spaces in name", () => {
    const art = generateEmojiArt("Christmas Tree");
    expect(art).toContain("🎄");
  });
  it("returns empty for unknown art", () => {
    expect(generateEmojiArt("nonexistent-art")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(generateEmojiArt("")).toBe("");
  });
});

describe("emoji-translator generateMixed", () => {
  it("interleaves text and emojis", () => {
    const result = generateMixed("happy cat", "dense");
    expect(result.output).toContain("happy");
    expect(result.output).toContain("😊");
    expect(result.output).toContain("cat");
    expect(result.output).toContain("🐱");
  });
  it("returns empty for empty input", () => {
    const result = generateMixed("", "dense");
    expect(result.output).toBe("");
  });
});

describe("emoji-translator computeStats", () => {
  it("computes totalWords and totalEmojis", () => {
    const stats = computeStats(["hello", "world"], ["👋", "🌍"]);
    expect(stats.totalWords).toBe(2);
    expect(stats.totalEmojis).toBe(2);
  });
  it("computes coveragePct", () => {
    const stats = computeStats(["hello", "world"], ["👋"]);
    expect(stats.coveragePct).toBe(50);
  });
  it("handles empty inputs", () => {
    const stats = computeStats([], []);
    expect(stats.coveragePct).toBe(0);
    expect(stats.avgEmojisPerWord).toBe(0);
  });
});

describe("emoji-translator countByCategory", () => {
  it("counts emojis by category", () => {
    const counts = countByCategory(["😊", "😢", "🐱"]);
    expect(counts.smileys).toBeGreaterThanOrEqual(2);
  });
  it("handles empty input", () => {
    const counts = countByCategory([]);
    expect(counts.smileys).toBe(0);
  });
});

describe("emoji-translator coverageReport", () => {
  it("dedupes covered words", () => {
    const report = coverageReport(["happy", "happy", "cat"], []);
    expect(report.covered.length).toBe(2);
  });
  it("removes words present in both lists (covered wins)", () => {
    const report = coverageReport(["happy"], ["happy", "cat"]);
    expect(report.covered).toContain("happy");
    expect(report.uncovered).toEqual(["cat"]);
  });
  it("computes coverage percentage", () => {
    const report = coverageReport(["happy", "cat"], ["dog"]);
    expect(report.coveragePct).toBe(Math.round((2 / 3) * 100));
  });
});

describe("emoji-translator detectTone", () => {
  it("detects happy tone", () => {
    expect(detectTone(["😊", "😄", "😍"])).toBe("happy");
  });
  it("detects sad tone", () => {
    expect(detectTone(["😢", "😭", "😔"])).toBe("sad");
  });
  it("detects love tone", () => {
    expect(detectTone(["❤️", "💖", "💕"])).toBe("love");
  });
  it("returns neutral for empty list", () => {
    expect(detectTone([])).toBe("neutral");
  });
  it("returns neutral for unknown emojis", () => {
    expect(detectTone(["🪑"])).toBe("neutral");
  });
});

describe("emoji-translator ZWJ combinations", () => {
  it("generates ZWJ by name", () => {
    expect(generateZwjSequence("heart on fire")).toBe("❤️‍🔥");
  });
  it("returns null for unknown name", () => {
    expect(generateZwjSequence("nonexistent combo")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(generateZwjSequence("")).toBeNull();
  });
  it("finds combo by components", () => {
    const combo = findZwjByComponents(["🧑", "🌾"]);
    expect(combo).not.toBeNull();
    expect(combo!.result).toBe("🧑‍🌾");
  });
  it("returns null for unknown components", () => {
    expect(findZwjByComponents(["🪑", "🛋️"])).toBeNull();
  });
});

describe("emoji-translator renderText", () => {
  it("renders stats section", () => {
    const result = translateTextToEmoji("happy cat", "dense", false);
    const text = renderText(result);
    expect(text).toContain("Total words:");
    expect(text).toContain("Total emojis:");
    expect(text).toContain("Coverage:");
  });
  it("includes original when preserved", () => {
    const result = translateTextToEmoji("happy", "dense", true);
    const text = renderText(result);
    expect(text).toContain("Original:");
  });
  it("renders uncovered words section", () => {
    const result = translateTextToEmoji("happy xyzzz", "dense", false);
    const text = renderText(result);
    expect(text).toContain("Uncovered words");
  });
});

describe("emoji-translator renderCsv", () => {
  it("renders header", () => {
    const result = translateTextToEmoji("happy cat", "dense", true);
    const csv = renderCsv(result);
    expect(csv).toContain("word,emoji,alternative_emojis");
  });
  it("renders word rows", () => {
    const result = translateTextToEmoji("happy cat", "dense", true);
    const csv = renderCsv(result);
    expect(csv).toContain("happy");
    expect(csv).toContain("cat");
    expect(csv).toContain("😊");
    expect(csv).toContain("🐱");
  });
});

describe("emoji-translator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      mode: "text-to-emoji",
      density: "medium",
      inputPreview: "happy",
      outputPreview: "😊",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        mode: "text-to-emoji",
        density: "medium",
        inputPreview: "x",
        outputPreview: "y",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      mode: "text-to-emoji",
      density: "medium",
      inputPreview: "x",
      outputPreview: "y",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("emoji-translator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("happy cat", "text-to-emoji", "dense", true);
    expect(url).toContain("input=");
    expect(url).toContain("happy");
    expect(url).toContain("mode=text-to-emoji");
    expect(url).toContain("density=dense");
    expect(url).toContain("keep=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("input=happy+cat&mode=text-to-emoji&density=dense&keep=1");
    expect(p.input).toBe("happy cat");
    expect(p.mode).toBe("text-to-emoji");
    expect(p.density).toBe("dense");
    expect(p.preserveOriginal).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({
      input: "",
      mode: "text-to-emoji",
      density: "medium",
      preserveOriginal: true,
    });
  });
  it("filters unknown mode", () => {
    const p = parseShareUrl("input=x&mode=unknown-mode&density=medium&keep=0");
    expect(p.mode).toBe("text-to-emoji");
  });
  it("filters unknown density", () => {
    const p = parseShareUrl("input=x&mode=mixed&density=unknown-density&keep=1");
    expect(p.density).toBe("medium");
  });
  it("handles keep=0 as preserveOriginal false", () => {
    const p = parseShareUrl("input=x&mode=mixed&density=medium&keep=0");
    expect(p.preserveOriginal).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = TranslationMode | EmojiDensity | EmojiTone;
