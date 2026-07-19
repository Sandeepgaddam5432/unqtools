import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  LEVEL_LABELS,
  DEFAULT_OPTIONS,
  SAMPLE_TEXTS,
  JARGON_DICTIONARY,
  normalizeText,
  escapeHtml,
  countWords,
  countSentences,
  countSyllables,
  countTotalSyllables,
  countLongSentences,
  computeReadability,
  findLockedTokens,
  overlapsLocked,
  buildTermRegex,
  findJargon,
  pickReplacement,
  preserveCase,
  splitLongSentence,
  splitLongSentences,
  applyReplacements,
  simplifyText,
  tokenizeWords,
  buildDiff,
  renderDiffHtml,
  renderHighlightedHtml,
  renderPlain,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  loadIgnoreList,
  saveIgnoreList,
  clearIgnoreList,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Domain,
  type ReadingLevel,
  type SimplifyOptions,
  type JargonHit,
  type SimplifyResult,
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

// ---------- Constants ----------

describe("jargon-simplifier constants", () => {
  it("has 4 domains", () => {
    expect(Object.keys(DOMAIN_LABELS)).toHaveLength(4);
  });
  it("has 4 domain colors", () => {
    expect(Object.keys(DOMAIN_COLORS)).toHaveLength(4);
  });
  it("has 4 reading levels", () => {
    expect(Object.keys(LEVEL_LABELS)).toHaveLength(4);
  });
  it("has 4 sample texts", () => {
    expect(SAMPLE_TEXTS.length).toBe(4);
  });
  it("exposes HISTORY_KEY and HISTORY_MAX", () => {
    expect(HISTORY_KEY).toContain("jargon-simplifier");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 200+ jargon entries", () => {
    expect(JARGON_DICTIONARY.length).toBeGreaterThanOrEqual(200);
  });
  it("has tech/medical/legal/financial entries", () => {
    const domains = new Set(JARGON_DICTIONARY.map((e) => e.domain));
    expect(domains.has("tech")).toBe(true);
    expect(domains.has("medical")).toBe(true);
    expect(domains.has("legal")).toBe(true);
    expect(domains.has("financial")).toBe(true);
  });
  it("default options are grade8 with lockTokens", () => {
    expect(DEFAULT_OPTIONS.level).toBe("grade8");
    expect(DEFAULT_OPTIONS.lockTokens).toBe(true);
    expect(DEFAULT_OPTIONS.splitLongSentences).toBe(true);
    expect(DEFAULT_OPTIONS.domains).toEqual([]);
    expect(DEFAULT_OPTIONS.ignored).toEqual([]);
  });
});

// ---------- Text helpers ----------

describe("jargon-simplifier normalizeText", () => {
  it("collapses internal whitespace runs", () => {
    expect(normalizeText("a    b\t\tc")).toBe("a b c");
  });
  it("normalizes newlines and trims triple+ newlines", () => {
    expect(normalizeText("a\n\n\n\nb")).toBe("a\n\nb");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("jargon-simplifier escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml(`<a href="x">O'Reilly & Co</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;O&#39;Reilly &amp; Co&lt;/a&gt;",
    );
  });
});

describe("jargon-simplifier countWords / countSentences", () => {
  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("counts sentences", () => {
    expect(countSentences("One. Two! Three?")).toBe(3);
    expect(countSentences("")).toBe(0);
  });
});

describe("jargon-simplifier countSyllables", () => {
  it("counts syllables", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("banana")).toBeGreaterThanOrEqual(2);
  });
});

describe("jargon-simplifier countTotalSyllables", () => {
  it("sums syllables across text", () => {
    const total = countTotalSyllables("cat dog apple");
    expect(total).toBeGreaterThanOrEqual(4);
  });
});

describe("jargon-simplifier countLongSentences", () => {
  it("counts sentences over 25 words", () => {
    const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ") + ".";
    expect(countLongSentences(long)).toBe(1);
  });
  it("ignores short sentences", () => {
    expect(countLongSentences("Short sentence.")).toBe(0);
  });
});

// ---------- Readability ----------

describe("jargon-simplifier computeReadability", () => {
  it("returns zeros for empty text", () => {
    const r = computeReadability("");
    expect(r.wordCount).toBe(0);
    expect(r.fleschReadingEase).toBe(0);
  });
  it("computes positive ease for simple text", () => {
    const r = computeReadability("The cat sat on the mat.");
    expect(r.wordCount).toBe(6);
    expect(r.sentenceCount).toBe(1);
    expect(r.fleschReadingEase).toBeGreaterThan(0);
  });
  it("computes lower ease for dense text", () => {
    const easy = computeReadability("The cat sat on the mat.");
    const dense = computeReadability(
      "The juxtaposition of multifaceted interdisciplinary paradigms necessitates comprehensive methodological frameworks.",
    );
    expect(dense.fleschReadingEase).toBeLessThan(easy.fleschReadingEase);
  });
});

// ---------- Locked tokens ----------

describe("jargon-simplifier findLockedTokens", () => {
  it("returns empty when disabled", () => {
    expect(findLockedTokens("10mg dose", false)).toEqual([]);
  });
  it("detects dosages", () => {
    const locked = findLockedTokens("Give 500mg twice daily", true);
    expect(locked.some((l) => l.kind === "dosage")).toBe(true);
  });
  it("detects dates", () => {
    const locked = findLockedTokens("On 2024-03-15 we met.", true);
    expect(locked.some((l) => l.kind === "date")).toBe(true);
  });
  it("detects percentages", () => {
    const locked = findLockedTokens("Up 40% YoY", true);
    expect(locked.some((l) => l.kind === "percent")).toBe(true);
  });
  it("detects currency", () => {
    const locked = findLockedTokens("$1,234.56 spent", true);
    expect(locked.some((l) => l.kind === "currency")).toBe(true);
  });
  it("detects citations (Smith v. Jones, 2020)", () => {
    const locked = findLockedTokens("See Smith v. Jones, 2020 for details.", true);
    expect(locked.some((l) => l.kind === "citation")).toBe(true);
  });
  it("detects URLs", () => {
    const locked = findLockedTokens("Visit https://example.com for info.", true);
    expect(locked.some((l) => l.kind === "url")).toBe(true);
  });
  it("detects plain figures", () => {
    const locked = findLockedTokens("There are 42 items.", true);
    expect(locked.some((l) => l.kind === "figure")).toBe(true);
  });
  it("sorts by start position", () => {
    const locked = findLockedTokens("10mg and 20mg and $5", true);
    for (let i = 1; i < locked.length; i++) {
      expect(locked[i].start).toBeGreaterThanOrEqual(locked[i - 1].start);
    }
  });
});

describe("jargon-simplifier overlapsLocked", () => {
  it("detects overlap", () => {
    const locked = [{ start: 5, end: 10, text: "500mg", kind: "dosage" as const }];
    expect(overlapsLocked(7, 9, locked)).toBe(true);
  });
  it("returns false when no overlap", () => {
    const locked = [{ start: 5, end: 10, text: "500mg", kind: "dosage" as const }];
    expect(overlapsLocked(0, 4, locked)).toBe(false);
  });
});

// ---------- Jargon detection ----------

describe("jargon-simplifier buildTermRegex", () => {
  it("matches base term", () => {
    const re = buildTermRegex("api");
    expect(re.test("call the api")).toBe(true);
  });
  it("matches plural form", () => {
    const re = buildTermRegex("api");
    expect(re.test("multiple apis")).toBe(true);
  });
  it("escapes regex metachars", () => {
    const re = buildTermRegex("p&l");
    expect(re.test("p&l statement")).toBe(true);
  });
});

describe("jargon-simplifier pickReplacement", () => {
  const entry = JARGON_DICTIONARY.find((e) => e.term === "hypertension")!;
  it("returns simple form for grade5", () => {
    expect(pickReplacement(entry, "grade5")).toBe(entry.simple);
  });
  it("returns plain form for grade8", () => {
    expect(pickReplacement(entry, "grade8")).toBe(entry.plain);
  });
  it("returns plain form for grade12", () => {
    expect(pickReplacement(entry, "grade12")).toBe(entry.plain);
  });
  it("returns term for expert", () => {
    expect(pickReplacement(entry, "expert")).toBe(entry.term);
  });
});

describe("jargon-simplifier preserveCase", () => {
  it("preserves all-caps", () => {
    expect(preserveCase("API", "app connector")).toBe("APP CONNECTOR");
  });
  it("preserves title case", () => {
    expect(preserveCase("Hypertension", "high blood pressure")).toBe("High blood pressure");
  });
  it("returns lower when input is lower", () => {
    expect(preserveCase("hypertension", "high blood pressure")).toBe("high blood pressure");
  });
});

describe("jargon-simplifier findJargon", () => {
  const opts: SimplifyOptions = { ...DEFAULT_OPTIONS };
  it("detects tech jargon", () => {
    const hits = findJargon("The API has high latency.", opts);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.entry.term === "api")).toBe(true);
    expect(hits.some((h) => h.entry.term === "latency")).toBe(true);
  });
  it("detects medical jargon", () => {
    const hits = findJargon("Patient has hypertension and needs subcutaneous injection.", opts);
    expect(hits.some((h) => h.entry.term === "hypertension")).toBe(true);
    expect(hits.some((h) => h.entry.term === "subcutaneous")).toBe(true);
  });
  it("detects legal jargon", () => {
    const hits = findJargon("Notwithstanding the above, indemnify the party.", opts);
    expect(hits.some((h) => h.entry.term === "notwithstanding")).toBe(true);
    expect(hits.some((h) => h.entry.term === "indemnify")).toBe(true);
  });
  it("detects financial jargon", () => {
    const hits = findJargon("We see deleveraging and the ETF rebalanced.", opts);
    expect(hits.some((h) => h.entry.term === "deleveraging")).toBe(true);
    expect(hits.some((h) => h.entry.term === "etf")).toBe(true);
  });
  it("respects domain filter", () => {
    const hits = findJargon("The API has hypertension.", { ...opts, domains: ["tech"] });
    expect(hits.some((h) => h.entry.term === "api")).toBe(true);
    expect(hits.some((h) => h.entry.term === "hypertension")).toBe(false);
  });
  it("respects ignored terms", () => {
    const hits = findJargon("The API has hypertension.", { ...opts, ignored: ["hypertension"] });
    expect(hits.some((h) => h.entry.term === "hypertension")).toBe(false);
  });
  it("skips jargon that overlaps a locked token", () => {
    // '500mg' should not produce a jargon hit at that position (it's a dosage lock).
    const hits = findJargon("500mg of the API", opts);
    expect(hits.some((h) => h.start >= 0 && h.start < 5)).toBe(false);
  });
  it("returns empty for empty text", () => {
    expect(findJargon("", opts)).toEqual([]);
  });
  it("picks longer-term candidate over shorter overlapping", () => {
    const hits = findJargon("the exchange-traded fund was great", opts);
    // Should match "exchange-traded fund" (longer), not just "fund"
    expect(hits.some((h) => h.entry.term === "exchange-traded fund")).toBe(true);
  });
});

// ---------- Sentence splitting ----------

describe("jargon-simplifier splitLongSentence", () => {
  it("returns short sentences unchanged", () => {
    expect(splitLongSentence("Short one.")).toBe("Short one.");
  });
  it("splits a long sentence at a comma-conjunction", () => {
    const long = Array.from({ length: 15 }, () => "word").join(" ")
      + ", and " + Array.from({ length: 15 }, () => "word").join(" ") + ".";
    const split = splitLongSentence(long);
    expect(split.split(/[.!?]\s+/).length).toBeGreaterThan(1);
  });
});

describe("jargon-simplifier splitLongSentences", () => {
  it("splits multiple sentences in text", () => {
    const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ") + ". Short.";
    const out = splitLongSentences(long);
    expect(out).toContain(". ");
  });
});

// ---------- Main simplify ----------

describe("jargon-simplifier applyReplacements", () => {
  it("returns original when no hits", () => {
    expect(applyReplacements("hello", [])).toBe("hello");
  });
  it("applies a single replacement", () => {
    const hits: JargonHit[] = [{
      id: "x",
      entry: JARGON_DICTIONARY.find((e) => e.term === "hypertension")!,
      start: 12,
      end: 24,
      original: "hypertension",
      replacement: "high blood pressure",
    }];
    expect(applyReplacements("Patient has hypertension.", hits)).toBe("Patient has high blood pressure.");
  });
});

describe("jargon-simplifier simplifyText", () => {
  it("simplifies tech text", () => {
    const result = simplifyText("The API has high latency.", { ...DEFAULT_OPTIONS, level: "grade5" });
    // grade5 uses `simple` form: api → "app connector", latency → "wait time"
    expect(result.simplified.toLowerCase()).toContain("app connector");
    expect(result.simplified.toLowerCase()).toContain("wait time");
    expect(result.stats.jargonCount).toBeGreaterThan(0);
    expect(result.stats.byDomain.tech).toBeGreaterThan(0);
  });
  it("simplifies medical text", () => {
    const result = simplifyText("Patient has hypertension.", { ...DEFAULT_OPTIONS, level: "grade5" });
    expect(result.simplified.toLowerCase()).toContain("high blood pressure");
  });
  it("expert level makes no substitution", () => {
    const result = simplifyText("The API has latency.", { ...DEFAULT_OPTIONS, level: "expert" });
    expect(result.simplified).toBe("The API has latency.");
  });
  it("locks dates verbatim", () => {
    const result = simplifyText("On 2024-03-15 the API had latency.", { ...DEFAULT_OPTIONS });
    expect(result.simplified).toContain("2024-03-15");
  });
  it("locks dosages verbatim", () => {
    const result = simplifyText("Give 500mg for hypertension.", { ...DEFAULT_OPTIONS });
    expect(result.simplified).toContain("500mg");
  });
  it("computes improvement", () => {
    const dense = "The juxtaposition of multifaceted interdisciplinary paradigms necessitates comprehensive methodological frameworks.";
    const result = simplifyText(dense, { ...DEFAULT_OPTIONS });
    expect(result.stats.originalReadability).toBeDefined();
    expect(result.stats.simplifiedReadability).toBeDefined();
    expect(typeof result.stats.improvement).toBe("number");
  });
  it("returns empty result for empty text", () => {
    const result = simplifyText("", DEFAULT_OPTIONS);
    expect(result.simplified).toBe("");
    expect(result.hits).toEqual([]);
  });
  it("produces non-empty diff for jargon text", () => {
    const result = simplifyText("Hypertension diagnosed.", { ...DEFAULT_OPTIONS, level: "grade5" });
    const diff = buildDiff(result.original, result.simplified);
    expect(diff.length).toBeGreaterThan(0);
  });
});

// ---------- Diff ----------

describe("jargon-simplifier tokenizeWords", () => {
  it("splits words and whitespace", () => {
    expect(tokenizeWords("a b c")).toEqual(["a", " ", "b", " ", "c"]);
  });
  it("returns empty for empty", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("jargon-simplifier buildDiff", () => {
  it("returns same-only diff for identical text", () => {
    const segs = buildDiff("hello world", "hello world");
    expect(segs.every((s) => s.type === "same")).toBe(true);
  });
  it("marks added segment", () => {
    const segs = buildDiff("cat", "cat dog");
    expect(segs.some((s) => s.type === "added")).toBe(true);
  });
  it("marks removed segment", () => {
    const segs = buildDiff("cat dog", "cat");
    expect(segs.some((s) => s.type === "removed")).toBe(true);
  });
});

describe("jargon-simplifier renderDiffHtml", () => {
  it("wraps added segments in span.diff-add", () => {
    const html = renderDiffHtml([{ type: "added", text: "x" }]);
    expect(html).toContain("diff-add");
    expect(html).toContain("x");
  });
  it("wraps removed segments in span.diff-remove", () => {
    const html = renderDiffHtml([{ type: "removed", text: "y" }]);
    expect(html).toContain("diff-remove");
  });
  it("escapes html in text", () => {
    const html = renderDiffHtml([{ type: "same", text: "<script>" }]);
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("jargon-simplifier renderHighlightedHtml", () => {
  it("wraps jargon in span.jargon with title tooltip", () => {
    const result = simplifyText("Hypertension.", { ...DEFAULT_OPTIONS, level: "grade5" });
    const html = renderHighlightedHtml(result);
    expect(html).toContain("jargon");
    expect(html).toContain("title=");
  });
  it("returns escaped text when no hits", () => {
    const result: SimplifyResult = {
      original: "hello",
      simplified: "hello",
      hits: [],
      locked: [],
      stats: {
        jargonCount: 0,
        byDomain: { tech: 0, medical: 0, legal: 0, financial: 0 },
        lockedCount: 0,
        originalReadability: computeReadability("hello"),
        simplifiedReadability: computeReadability("hello"),
        improvement: 0,
      },
    };
    expect(renderHighlightedHtml(result)).toBe("hello");
  });
});

// ---------- Rendering ----------

describe("jargon-simplifier renderPlain", () => {
  it("returns simplified text", () => {
    const result = simplifyText("Hypertension.", { ...DEFAULT_OPTIONS, level: "grade5" });
    expect(renderPlain(result)).toBe(result.simplified);
  });
});

describe("jargon-simplifier renderMarkdown", () => {
  it("appends a glossary table when hits exist", () => {
    const result = simplifyText("Hypertension.", { ...DEFAULT_OPTIONS, level: "grade5" });
    const md = renderMarkdown(result);
    expect(md).toContain("Glossary");
    expect(md).toContain("| Term | Plain |");
    expect(md).toContain("Hypertension");
  });
});

// ---------- History ----------

describe("jargon-simplifier history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      level: "grade8",
      domains: ["tech"],
      originalLength: 100,
      simplifiedLength: 120,
      jargonCount: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        level: "grade8",
        domains: [],
        originalLength: 1,
        simplifiedLength: 1,
        jargonCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, level: "grade8", domains: [], originalLength: 1, simplifiedLength: 1, jargonCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Ignore list ----------

describe("jargon-simplifier ignore list (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadIgnoreList()).toEqual([]);
  });
  it("saves and loads", () => {
    saveIgnoreList(["hypertension"]);
    expect(loadIgnoreList()).toEqual(["hypertension"]);
  });
  it("clears", () => {
    saveIgnoreList(["hypertension"]);
    clearIgnoreList();
    expect(loadIgnoreList()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("jargon-simplifier shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ text: "hi", level: "grade5", domains: ["tech"] });
    expect(url).toContain("text=hi");
    expect(url).toContain("level=grade5");
    expect(url).toContain("domains=tech");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hello&level=grade5&domains=tech,medical");
    expect(p.text).toBe("hello");
    expect(p.level).toBe("grade5");
    expect(p.domains).toEqual(["tech", "medical"]);
  });
  it("defaults level to grade8 when missing", () => {
    const p = parseShareUrl("text=hi");
    expect(p.level).toBe("grade8");
  });
  it("defaults level to grade8 when unknown", () => {
    const p = parseShareUrl("text=hi&level=kindergarten");
    expect(p.level).toBe("grade8");
  });
  it("filters unknown domains", () => {
    const p = parseShareUrl("text=hi&domains=tech,bogus");
    expect(p.domains).toEqual(["tech"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ text: "", level: "grade8", domains: [] });
  });
});

// ---------- LLM helpers ----------

describe("jargon-simplifier LLM helpers", () => {
  it("builds a prompt containing text and level", () => {
    const p = buildLlmPrompt("The API has latency.", "grade5");
    expect(p).toContain("Grade 5");
    expect(p).toContain("The API has latency.");
  });
  it("trims LLM result", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// ---------- Type-only export to suppress unused-import lint ----------

export type _Unused = Domain | ReadingLevel | SimplifyOptions | JargonHit | SimplifyResult;
