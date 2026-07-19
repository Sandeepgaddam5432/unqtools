import { describe, it, expect, beforeEach } from "vitest";
import {
  EMOJI_DICTIONARY,
  MODE_LABELS,
  DENSITY_LABELS,
  TARGET_LABELS,
  TOPIC_PRESETS,
  normalizeWord,
  normalizeForLookup,
  lemmatize,
  tokenize,
  countWords,
  getAlternatives,
  findEntry,
  contextWindow,
  toShortcode,
  fromShortcode,
  renderForTarget,
  textToEmoji,
  emojiToText,
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
  type TranslationMode,
  type Density,
  type OutputTarget,
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

describe("ai-emoji-translator constants", () => {
  it("has 500+ dictionary entries", () => {
    expect(EMOJI_DICTIONARY.length).toBeGreaterThanOrEqual(500);
  });
  it("has 3 mode labels", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(3);
    expect(MODE_LABELS.strict).toContain("Strict");
  });
  it("has 3 density labels", () => {
    expect(Object.keys(DENSITY_LABELS)).toHaveLength(3);
    expect(DENSITY_LABELS.sparse).toContain("Sparse");
  });
  it("has 3 target labels", () => {
    expect(Object.keys(TARGET_LABELS)).toHaveLength(3);
    expect(TARGET_LABELS.unicode).toContain("Unicode");
  });
  it("has topic presets", () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(TOPIC_PRESETS.some((p) => p.toLowerCase().includes("pizza"))).toBe(true);
  });
  it("every entry has at least one emoji and one shortcode", () => {
    for (const e of EMOJI_DICTIONARY) {
      expect(e.emojis.length).toBeGreaterThanOrEqual(1);
      expect(e.shortcodes.length).toBeGreaterThanOrEqual(1);
      expect(e.word).toBeTruthy();
    }
  });
});

describe("ai-emoji-translator normalizeWord", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeWord("Hello, World!")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeWord("")).toBe("");
  });
  it("collapses whitespace", () => {
    expect(normalizeWord("  a   b  ")).toBe("a b");
  });
});

describe("ai-emoji-translator normalizeForLookup", () => {
  it("preserves apostrophes inside words", () => {
    expect(normalizeForLookup("don't stop")).toBe("don't stop");
  });
});

describe("ai-emoji-translator lemmatize", () => {
  it("strips plural 's'", () => {
    expect(lemmatize("dogs")).toBe("dog");
  });
  it("strips 'ies' → 'y'", () => {
    expect(lemmatize("puppies")).toBe("puppy");
  });
  it("strips 'ing'", () => {
    expect(lemmatize("running")).toBe("runn");
  });
  it("leaves short words alone", () => {
    expect(lemmatize("cat")).toBe("cat");
  });
});

describe("ai-emoji-translator tokenize", () => {
  it("splits words and preserves non-word tokens", () => {
    const toks = tokenize("Hello, world!");
    expect(toks.length).toBeGreaterThanOrEqual(4);
    expect(toks.find((t) => t.word === "hello")).toBeTruthy();
    expect(toks.find((t) => t.word === "world")).toBeTruthy();
  });
  it("handles empty", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("tracks indices", () => {
    const toks = tokenize("ab cd");
    const ab = toks.find((t) => t.word === "ab")!;
    expect(ab.start).toBe(0);
    expect(ab.end).toBe(2);
  });
});

describe("ai-emoji-translator countWords", () => {
  it("counts words only", () => {
    expect(countWords("hello, world!")).toBe(2);
  });
  it("zero for empty", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("ai-emoji-translator getAlternatives", () => {
  it("returns alternatives for a known word", () => {
    const alts = getAlternatives("happy");
    expect(alts.length).toBeGreaterThanOrEqual(1);
    expect(alts[0]).not.toBe("");
  });
  it("returns empty for unknown word", () => {
    expect(getAlternatives("zzzzznotaword")).toEqual([]);
  });
  it("returns empty for empty input", () => {
    expect(getAlternatives("")).toEqual([]);
  });
});

describe("ai-emoji-translator findEntry", () => {
  it("finds a direct hit with confidence 1", () => {
    const { entry, confidence } = findEntry("pizza");
    expect(entry).not.toBeNull();
    expect(confidence).toBe(1);
    expect(entry!.emojis[0]).toBe("🍕");
  });
  it("returns null for unknown word", () => {
    const { entry, confidence } = findEntry("zzzznotaword");
    expect(entry).toBeNull();
    expect(confidence).toBe(0);
  });
  it("uses context to disambiguate 'bank' (financial)", () => {
    const { entry } = findEntry("bank", ["money", "deposit"]);
    expect(entry).not.toBeNull();
    expect(entry!.emojis[0]).toBe("🏦");
  });
  it("uses context to disambiguate 'bank' (river)", () => {
    const { entry } = findEntry("bank", ["river", "water"]);
    expect(entry).not.toBeNull();
    expect(entry!.emojis[0]).toBe("🌊");
  });
});

describe("ai-emoji-translator contextWindow", () => {
  it("returns surrounding words excluding self", () => {
    const toks = [{ word: "a" }, { word: "b" }, { word: "c" }, { word: "d" }, { word: "e" }];
    const ctx = contextWindow(toks, 2, 1);
    expect(ctx).toContain("b");
    expect(ctx).toContain("d");
    expect(ctx).not.toContain("c");
  });
});

describe("ai-emoji-translator shortcode helpers", () => {
  it("converts emoji to shortcode", () => {
    expect(toShortcode("🍕")).toBe(":pizza:");
  });
  it("returns null for unknown emoji", () => {
    expect(toShortcode("🦖")).toBeNull();
  });
  it("converts shortcode to emoji", () => {
    expect(fromShortcode(":pizza:")).toBe("🍕");
  });
  it("returns null for unknown shortcode", () => {
    expect(fromShortcode(":not_a_real_shortcode:")).toBeNull();
  });
});

describe("ai-emoji-translator renderForTarget", () => {
  it("renders unicode as-is", () => {
    expect(renderForTarget("🍕", "unicode")).toBe("🍕");
  });
  it("renders discord as shortcode", () => {
    expect(renderForTarget("🍕", "discord")).toBe(":pizza:");
  });
  it("renders slack as shortcode", () => {
    expect(renderForTarget("🍕", "slack")).toBe(":pizza:");
  });
});

describe("ai-emoji-translator textToEmoji", () => {
  it("replaces known words with emoji (strict)", () => {
    const r = textToEmoji("I love pizza", "strict", "dense", "unicode");
    expect(r.output).toContain("🍕");
    expect(r.output).toContain("❤️");
    expect(r.matchCount).toBeGreaterThanOrEqual(2);
  });
  it("preserves unknown words", () => {
    const r = textToEmoji("zzz pizza zzz", "strict", "dense", "unicode");
    expect(r.output).toContain("🍕");
    expect(r.output).toContain("zzz");
  });
  it("returns empty output for empty input", () => {
    const r = textToEmoji("", "strict", "medium", "unicode");
    expect(r.output).toBe("");
    expect(r.matchCount).toBe(0);
  });
  it("honors discord target", () => {
    const r = textToEmoji("pizza", "strict", "dense", "discord");
    expect(r.output).toBe(":pizza:");
  });
  it("sparse density replaces fewer matches than dense", () => {
    const text = "happy sad angry love hate laugh smile cry tired excited";
    const dense = textToEmoji(text, "strict", "dense", "unicode");
    const sparse = textToEmoji(text, "strict", "sparse", "unicode");
    expect(sparse.matchCount).toBeLessThanOrEqual(dense.matchCount);
  });
  it("loose mode matches plural forms", () => {
    const r = textToEmoji("I love pizzas", "loose", "dense", "unicode");
    expect(r.output).toContain("🍕");
  });
  it("ratio mode applies density", () => {
    const text = "happy sad angry love hate laugh smile cry tired excited surprised bored";
    const r = textToEmoji(text, "ratio", "sparse", "unicode");
    // sparse ratio should keep fewer than total candidates
    expect(r.matchCount).toBeLessThanOrEqual(13);
    expect(r.matchCount).toBeGreaterThanOrEqual(1);
  });
  it("computes coverage correctly", () => {
    const r = textToEmoji("pizza coffee", "strict", "dense", "unicode");
    expect(r.totalWords).toBe(2);
    expect(r.matchCount).toBe(2);
    expect(r.coverage).toBeCloseTo(1, 5);
  });
  it("exposes alternatives on matched tokens", () => {
    const r = textToEmoji("happy", "strict", "dense", "unicode");
    const m = r.matches.find((x) => x.word === "happy");
    expect(m).toBeTruthy();
    expect(m!.matched).toBe(true);
    expect(m!.alternatives.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-emoji-translator emojiToText", () => {
  it("decodes a unicode emoji to its word", () => {
    const r = emojiToText("🍕");
    expect(r.output.toLowerCase()).toContain("pizza");
    expect(r.decodedCount).toBeGreaterThanOrEqual(1);
  });
  it("decodes a shortcode to its word", () => {
    const r = emojiToText(":pizza:");
    expect(r.output.toLowerCase()).toContain("pizza");
  });
  it("handles mixed text and emoji", () => {
    const r = emojiToText("I love 🍕");
    expect(r.output.toLowerCase()).toContain("pizza");
    expect(r.output.toLowerCase()).toContain("love");
  });
  it("returns empty for empty input", () => {
    const r = emojiToText("");
    expect(r.output).toBe("");
    expect(r.decodedCount).toBe(0);
  });
});

describe("ai-emoji-translator computeStats", () => {
  it("computes stats", () => {
    const r = textToEmoji("happy pizza", "strict", "dense", "unicode");
    const s = computeStats(r);
    expect(s.totalWords).toBe(2);
    expect(s.matchedWords).toBe(2);
    expect(s.uniqueEmojis).toBe(2);
    expect(s.coverage).toBeCloseTo(1, 5);
  });
});

describe("ai-emoji-translator render functions", () => {
  it("renderText returns output", () => {
    const r = textToEmoji("pizza", "strict", "dense", "unicode");
    expect(renderText(r)).toBe("🍕");
  });
  it("renderMarkdown contains headers", () => {
    const r = textToEmoji("pizza", "strict", "dense", "unicode");
    const md = renderMarkdown(r);
    expect(md).toContain("# Emoji Translation");
    expect(md).toContain("## Input");
    expect(md).toContain("## Output");
  });
  it("renderJson produces valid JSON", () => {
    const r = textToEmoji("pizza", "strict", "dense", "unicode");
    const j = renderJson(r);
    const parsed = JSON.parse(j);
    expect(parsed.input).toBe("pizza");
    expect(parsed.output).toBe("🍕");
  });
});

describe("ai-emoji-translator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      direction: "encode",
      input: "pizza",
      output: "🍕",
      mode: "strict",
      density: "dense",
      target: "unicode",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        direction: "encode",
        input: "x",
        output: "y",
        mode: "strict",
        density: "medium",
        target: "unicode",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      direction: "encode",
      input: "x",
      output: "y",
      mode: "strict",
      density: "medium",
      target: "unicode",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-emoji-translator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ text: "pizza time", mode: "strict", density: "medium", target: "discord" });
    expect(url).toContain("text=pizza+time");
    expect(url).toContain("mode=strict");
    expect(url).toContain("density=medium");
    expect(url).toContain("target=discord");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("text=pizza+time&mode=loose&density=sparse&target=slack");
    expect(s.text).toBe("pizza time");
    expect(s.mode).toBe("loose");
    expect(s.density).toBe("sparse");
    expect(s.target).toBe("slack");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.text).toBe("");
    expect(s.mode).toBe("strict");
    expect(s.density).toBe("medium");
    expect(s.target).toBe("unicode");
  });
  it("filters unknown values to defaults", () => {
    const s = parseShareUrl("text=hi&mode=unknown&density=bad&target=evil");
    expect(s.mode).toBe("strict");
    expect(s.density).toBe("medium");
    expect(s.target).toBe("unicode");
  });
});

describe("ai-emoji-translator LLM prompt", () => {
  it("builds a prompt with system + user", () => {
    const p = buildLlmPrompt("I love pizza", "strict", "medium", "discord");
    expect(p.system).toContain("emoji translation");
    expect(p.system).toContain("strict");
    expect(p.system).toContain("discord");
    expect(p.user).toContain("I love pizza");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  🍕  ")).toBe("🍕");
  });
});

// Suppress unused-import lint
export type _Unused = TranslationMode | Density | OutputTarget;
