import { describe, it, expect, beforeEach } from "vitest";
import {
  SYNONYMS,
  CONTRACTIONS_EXPAND,
  CONTRACTIONS_CONTRACT,
  FILLER_WORDS,
  EXPAND_PHRASES,
  splitSentences,
  tokenize,
  countWords,
  countSyllables,
  findSynonym,
  applySynonyms,
  isPassive,
  toPassiveVoice,
  toActiveVoice,
  toPastParticiple,
  fromPastParticiple,
  expandContractions,
  contractPhrases,
  removeFillers,
  addElaboration,
  paraphraseSentence,
  generateAlternatives,
  rewrite,
  fleschReadingEase,
  computeDiff,
  renderDiffHtml,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  type ParaphraseMode,
  type VoiceMode,
  type RewriteOptions,
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

describe("ai-paraphrasing-rewriter-tool constants", () => {
  it("has synonym dictionary with 50+ entries", () => {
    expect(Object.keys(SYNONYMS).length).toBeGreaterThan(50);
  });
  it("has contractions expand map", () => {
    expect(Object.keys(CONTRACTIONS_EXPAND).length).toBeGreaterThan(10);
    expect(CONTRACTIONS_EXPAND["don't"]).toBe("do not");
  });
  it("has contractions contract map", () => {
    expect(Object.keys(CONTRACTIONS_CONTRACT).length).toBeGreaterThan(10);
    expect(CONTRACTIONS_CONTRACT["do not"]).toBe("don't");
  });
  it("has filler words", () => {
    expect(FILLER_WORDS.size).toBeGreaterThan(5);
    expect(FILLER_WORDS.has("very")).toBe(true);
  });
  it("has expand phrases", () => {
    expect(EXPAND_PHRASES.length).toBeGreaterThan(3);
  });
});

describe("ai-paraphrasing-rewriter-tool text splitting", () => {
  it("splits sentences", () => {
    expect(splitSentences("Hello. World. Bye.")).toHaveLength(3);
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });
  it("tokenizes into word and non-word tokens", () => {
    const tokens = tokenize("Hello, world!");
    // Word tokens
    expect(tokens.some((t) => t.text === "Hello" && t.isWord)).toBe(true);
    expect(tokens.some((t) => t.text === "world" && t.isWord)).toBe(true);
    // Non-word tokens (punctuation)
    expect(tokens.some((t) => t.text === "," && !t.isWord)).toBe(true);
    expect(tokens.some((t) => t.text === "!" && !t.isWord)).toBe(true);
    // Re-joining produces the original string.
    expect(tokens.map((t) => t.text).join("")).toBe("Hello, world!");
  });
  it("counts words", () => {
    expect(countWords("Hello world from a test")).toBe(5);
    expect(countWords("")).toBe(0);
  });
  it("counts syllables (rough)", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("")).toBe(0);
  });
});

describe("ai-paraphrasing-rewriter-tool synonym substitution", () => {
  it("finds a synonym for known word", () => {
    const syn = findSynonym("use", 0, new Set());
    expect(syn).toBe("utilize");
  });
  it("rotates synonyms by variation", () => {
    expect(findSynonym("use", 0, new Set())).toBe("utilize");
    expect(findSynonym("use", 1, new Set())).toBe("employ");
    expect(findSynonym("use", 2, new Set())).toBe("apply");
    expect(findSynonym("use", 3, new Set())).toBe("utilize"); // wraps
  });
  it("preserves capitalization", () => {
    expect(findSynonym("Use", 0, new Set())).toBe("Utilize");
  });
  it("returns undefined for unknown word", () => {
    expect(findSynonym("xyzabc", 0, new Set())).toBeUndefined();
  });
  it("returns undefined for preserved word", () => {
    expect(findSynonym("use", 0, new Set(["use"]))).toBeUndefined();
  });
  it("applies synonyms deterministically", () => {
    const out1 = applySynonyms("I use this tool daily.", 5, 0, []);
    const out2 = applySynonyms("I use this tool daily.", 5, 0, []);
    expect(out1).toBe(out2);
  });
  it("applies synonyms with different variations", () => {
    const out0 = applySynonyms("I use this tool daily.", 5, 0, []);
    const out1 = applySynonyms("I use this tool daily.", 5, 1, []);
    expect(out0).not.toBe(out1);
  });
  it("returns input unchanged at strength 0", () => {
    expect(applySynonyms("Hello world.", 0, 0, [])).toBe("Hello world.");
  });
  it("respects preserve terms", () => {
    const out = applySynonyms("I use this tool daily.", 5, 0, ["use"]);
    expect(out).toContain("use");
  });
});

describe("ai-paraphrasing-rewriter-tool voice change", () => {
  it("detects passive voice", () => {
    expect(isPassive("The man was bitten by the dog.")).toBe(true);
    expect(isPassive("The dog bit the man.")).toBe(false);
  });
  it("converts active to passive", () => {
    const out = toPassiveVoice("John writes code.");
    expect(out).toContain("was written by");
    expect(out).toContain("John");
  });
  it("converts passive to active", () => {
    const out = toActiveVoice("The code was written by John.");
    expect(out.toLowerCase()).toContain("john");
    // The verb "written" maps back to "wrote" via irregulars table.
    expect(out).toContain("wrote");
  });
  it("toPastParticiple: regular -ed", () => {
    expect(toPastParticiple("walk")).toBe("walked");
  });
  it("toPastParticiple: -e suffix", () => {
    expect(toPastParticiple("make")).toBe("made"); // irregular
    expect(toPastParticiple("create")).toBe("created");
  });
  it("toPastParticiple: irregular", () => {
    expect(toPastParticiple("write")).toBe("written");
    expect(toPastParticiple("take")).toBe("taken");
  });
  it("fromPastParticiple: irregular", () => {
    expect(fromPastParticiple("written", "was")).toBe("wrote");
    expect(fromPastParticiple("taken", "was")).toBe("took");
  });
});

describe("ai-paraphrasing-rewriter-tool tone transformations", () => {
  it("expands contractions", () => {
    expect(expandContractions("I don't know.")).toBe("I do not know.");
    expect(expandContractions("It's a test.")).toBe("It is a test.");
  });
  it("contracts phrases", () => {
    expect(contractPhrases("I do not know.")).toBe("I don't know.");
  });
  it("removes filler words", () => {
    const out = removeFillers("This is very really quite good.");
    expect(out).not.toContain("very");
    expect(out).not.toContain("really");
    expect(out).not.toContain("quite");
    expect(out).toContain("good");
  });
  it("adds elaboration phrases", () => {
    const out = addElaboration("Sentence one. Sentence two. Sentence three.", 0);
    // Every other sentence (i=2) gets a phrase prefix from EXPAND_PHRASES.
    const matched = EXPAND_PHRASES.some((p) => out.toLowerCase().includes(p.toLowerCase()));
    expect(matched).toBe(true);
  });
});

describe("ai-paraphrasing-rewriter-tool per-sentence rewriting", () => {
  it("standard mode: rewrites a sentence", () => {
    const out = paraphraseSentence("I use this tool every day.", {
      mode: "standard", strength: 5, variation: 0,
    });
    expect(out).not.toBe("I use this tool every day.");
    expect(out.length).toBeGreaterThan(0);
  });
  it("formal mode: expands contractions", () => {
    const out = paraphraseSentence("I don't know the answer.", {
      mode: "formal", strength: 5, variation: 0,
    });
    expect(out).toContain("do not");
  });
  it("casual mode: contracts phrases", () => {
    const out = paraphraseSentence("I do not know the answer.", {
      mode: "casual", strength: 5, variation: 0,
    });
    expect(out.toLowerCase()).toContain("don't");
  });
  it("concise mode: removes fillers", () => {
    const out = paraphraseSentence("This is very really quite good.", {
      mode: "concise", strength: 3, variation: 0,
    });
    expect(out).not.toContain("very");
  });
  it("expand mode: adds elaboration", () => {
    const out = paraphraseSentence("First sentence. Second sentence. Third sentence.", {
      mode: "expand", strength: 3, variation: 0,
    });
    const matched = EXPAND_PHRASES.some((p) => out.toLowerCase().includes(p.toLowerCase()));
    expect(matched).toBe(true);
  });
  it("voice=active converts passive to active", () => {
    const out = paraphraseSentence("The code was written by John.", {
      mode: "standard", strength: 1, voice: "active", variation: 0,
    });
    expect(out.toLowerCase()).toContain("john");
  });
  it("generateAlternatives returns multiple distinct rewrites", () => {
    const alts = generateAlternatives(
      "I use this tool every day.",
      { mode: "standard", strength: 5 },
      3,
    );
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(3);
  });
});

describe("ai-paraphrasing-rewriter-tool main entry", () => {
  it("rewrites multi-sentence text", () => {
    const r = rewrite("I use this tool. It helps me work. The team builds features.", {
      mode: "standard", strength: 5, variation: 0,
    });
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.sentences).toHaveLength(3);
    expect(r.stats.originalWordCount).toBeGreaterThan(0);
    expect(r.stats.rewrittenWordCount).toBeGreaterThan(0);
    expect(r.stats.mode).toBe("standard");
    expect(r.stats.strength).toBe(5);
  });
  it("returns empty result for blank input", () => {
    const r = rewrite("", { mode: "standard" });
    expect(r.text).toBe("");
    expect(r.sentences).toEqual([]);
    expect(r.stats.originalWordCount).toBe(0);
  });
  it("clamps strength to 1..5", () => {
    const r1 = rewrite("Test sentence here.", { mode: "standard", strength: 0 });
    const r10 = rewrite("Test sentence here.", { mode: "standard", strength: 100 });
    expect(r1.stats.strength).toBe(1);
    expect(r10.stats.strength).toBe(5);
  });
  it("computes readability delta", () => {
    const r = rewrite("This is a very simple sentence. It has many words.", {
      mode: "formal", strength: 3,
    });
    expect(r.stats.originalReadability).toBeGreaterThanOrEqual(0);
    expect(r.stats.rewrittenReadability).toBeGreaterThanOrEqual(0);
    expect(typeof r.stats.readabilityDelta).toBe("number");
  });
  it("warns when voice=active but no passive sentences", () => {
    const r = rewrite("The dog bit the man. The cat ran away.", {
      mode: "standard", strength: 1, voice: "active",
    });
    expect(r.warnings.some((w) => w.includes("No passive sentences"))).toBe(true);
  });
  it("respects preserve terms", () => {
    const r = rewrite("I use this tool every day.", {
      mode: "standard", strength: 5, preserveTerms: ["use", "tool"],
    });
    expect(r.text.toLowerCase()).toContain("use");
    expect(r.text.toLowerCase()).toContain("tool");
  });
});

describe("ai-paraphrasing-rewriter-tool readability", () => {
  it("scores simple text high (easy)", () => {
    const score = fleschReadingEase("The cat sat on the mat. The dog ran fast.");
    expect(score).toBeGreaterThan(50);
  });
  it("scores empty as 0", () => {
    expect(fleschReadingEase("")).toBe(0);
  });
});

describe("ai-paraphrasing-rewriter-tool diff", () => {
  it("computes equal-only diff for identical text", () => {
    const diff = computeDiff("hello world", "hello world");
    expect(diff.every((d) => d.type === "equal")).toBe(true);
  });
  it("computes insert for added word", () => {
    const diff = computeDiff("hello", "hello there");
    expect(diff.some((d) => d.type === "insert" && d.rewritten === "there")).toBe(true);
  });
  it("computes delete for removed word", () => {
    const diff = computeDiff("hello there", "hello");
    expect(diff.some((d) => d.type === "delete" && d.original === "there")).toBe(true);
  });
  it("collapses delete+insert into replace", () => {
    const diff = computeDiff("use this", "utilize this");
    expect(diff.some((d) => d.type === "replace")).toBe(true);
  });
  it("renders diff HTML", () => {
    const html = renderDiffHtml([
      { type: "equal", original: "hello", rewritten: "hello" },
      { type: "insert", rewritten: "there" },
    ]);
    expect(html).toContain("diff-insert");
    expect(html).toContain("there");
  });
  it("escapes HTML in diff", () => {
    const html = renderDiffHtml([
      { type: "insert", rewritten: "<script>" },
    ]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("ai-paraphrasing-rewriter-tool markdown", () => {
  it("renders markdown with stats + rewritten text", () => {
    const r = rewrite("I use this tool.", { mode: "standard", strength: 5 });
    const md = renderMarkdown(r);
    expect(md).toContain("# Rewrite");
    expect(md).toContain("Words:");
    expect(md).toContain("Readability:");
    expect(md).toContain("## Rewritten");
  });
});

describe("ai-paraphrasing-rewriter-tool history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, mode: "standard", strength: 3, voice: "preserve",
      originalWordCount: 10, rewrittenWordCount: 10,
      readabilityDelta: 0, preview: "preview",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, mode: "standard", strength: 3, voice: "preserve",
        originalWordCount: 1, rewrittenWordCount: 1,
        readabilityDelta: 0, preview: `p-${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, mode: "standard", strength: 3, voice: "preserve",
      originalWordCount: 1, rewrittenWordCount: 1,
      readabilityDelta: 0, preview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-paraphrasing-rewriter-tool shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world", "formal", 4, "passive", 1);
    expect(url).toContain("text=hello+world");
    expect(url).toContain("mode=formal");
    expect(url).toContain("strength=4");
    expect(url).toContain("voice=passive");
    expect(url).toContain("variation=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hi&mode=casual&strength=2&voice=active&variation=3");
    expect(p.text).toBe("hi");
    expect(p.mode).toBe("casual");
    expect(p.strength).toBe(2);
    expect(p.voice).toBe("active");
    expect(p.variation).toBe(3);
  });
  it("handles empty hash with defaults", () => {
    expect(parseShareUrl("")).toEqual({
      text: "", mode: "standard", strength: 3, voice: "preserve", variation: 0,
    });
  });
  it("filters invalid mode/voice", () => {
    const p = parseShareUrl("text=hi&mode=invalid&voice=invalid");
    expect(p.mode).toBe("standard");
    expect(p.voice).toBe("preserve");
  });
  it("clamps invalid strength", () => {
    expect(parseShareUrl("strength=0").strength).toBe(1);
    expect(parseShareUrl("strength=999").strength).toBe(5);
    expect(parseShareUrl("strength=garbage").strength).toBe(3);
  });
});

describe("ai-paraphrasing-rewriter-tool LLM prompt builder", () => {
  it("builds system + user prompts", () => {
    const p = buildLlmPrompt("some text", "standard", 3);
    expect(p.system).toContain("paraphrasing");
    expect(p.user).toContain("some text");
    expect(p.user).toContain("moderate changes");
  });
  it("formal mode mentions formal", () => {
    expect(buildLlmPrompt("x", "formal", 3).user).toContain("formal");
  });
  it("strength 1 → minimal changes", () => {
    expect(buildLlmPrompt("x", "standard", 1).user).toContain("minimal changes");
  });
  it("strength 5 → heavy changes", () => {
    expect(buildLlmPrompt("x", "standard", 5).user).toContain("heavy changes");
  });
});

// Suppress unused-import lint
export type _Unused = ParaphraseMode | VoiceMode | RewriteOptions;
