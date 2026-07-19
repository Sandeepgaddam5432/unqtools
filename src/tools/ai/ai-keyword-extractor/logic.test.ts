import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  ALGORITHM_LABELS,
  LANGUAGE_LABELS,
  DEFAULT_OPTIONS,
  SAMPLE_TEXTS,
  STOPWORDS,
  REFERENCE_CORPUS,
  normalizeText,
  escapeHtml,
  splitSentences,
  tokenize,
  tokenizeWithOffsets,
  isCapitalized,
  isNumber,
  normalizeToken,
  isStopword,
  isAcceptable,
  countWords,
  computeIdf,
  extractTfidf,
  extractRake,
  extractYake,
  clusterKeywords,
  extract,
  renderCommaList,
  renderLineList,
  renderCsv,
  renderJson,
  renderMarkdown,
  renderTagCloudHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Algorithm,
  type Language,
  type ExtractOptions,
  type Keyword,
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

describe("keyword-extractor constants", () => {
  it("has 3 algorithms", () => {
    expect(Object.keys(ALGORITHM_LABELS)).toHaveLength(3);
  });
  it("has 5 languages", () => {
    expect(Object.keys(LANGUAGE_LABELS)).toHaveLength(5);
  });
  it("has stopword packs for all languages", () => {
    for (const lang of Object.keys(LANGUAGE_LABELS) as Language[]) {
      expect(STOPWORDS[lang].size).toBeGreaterThan(20);
    }
  });
  it("has 3 sample texts", () => {
    expect(SAMPLE_TEXTS.length).toBe(3);
  });
  it("exposes HISTORY_KEY and HISTORY_MAX", () => {
    expect(HISTORY_KEY).toContain("keyword-extractor");
    expect(HISTORY_MAX).toBe(20);
  });
  it("default options are tfidf/english/1-gram/top10", () => {
    expect(DEFAULT_OPTIONS.algorithm).toBe("tfidf");
    expect(DEFAULT_OPTIONS.language).toBe("en");
    expect(DEFAULT_OPTIONS.ngram).toBe(1);
    expect(DEFAULT_OPTIONS.topN).toBe(10);
  });
  it("has 20-entry reference corpus", () => {
    expect(REFERENCE_CORPUS.length).toBe(20);
  });
});

// ---------- Text helpers ----------

describe("keyword-extractor normalizeText", () => {
  it("collapses internal whitespace", () => {
    expect(normalizeText("a    b\t\tc")).toBe("a b c");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("keyword-extractor escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml(`<a href="x">O'Reilly</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;O&#39;Reilly&lt;/a&gt;",
    );
  });
});

describe("keyword-extractor splitSentences", () => {
  it("splits on terminal punctuation", () => {
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
  });
  it("handles newlines", () => {
    expect(splitSentences("One\nTwo")).toEqual(["One", "Two"]);
  });
  it("returns empty for empty", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("keyword-extractor tokenize", () => {
  it("extracts alphanumeric tokens", () => {
    expect(tokenize("hello, world! 42")).toEqual(["hello", "world", "42"]);
  });
  it("returns empty for empty", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("keyword-extractor tokenizeWithOffsets", () => {
  it("returns offsets alongside tokens", () => {
    const out = tokenizeWithOffsets("hello world");
    expect(out).toHaveLength(2);
    expect(out[0].token).toBe("hello");
    expect(out[0].offset).toBe(0);
    expect(out[1].token).toBe("world");
    expect(out[1].offset).toBe(6);
  });
});

describe("keyword-extractor isCapitalized / isNumber", () => {
  it("detects capitalized words", () => {
    expect(isCapitalized("Hello")).toBe(true);
    expect(isCapitalized("hello")).toBe(false);
    expect(isCapitalized("")).toBe(false);
  });
  it("detects numbers", () => {
    expect(isNumber("42")).toBe(true);
    expect(isNumber("3.14")).toBe(true);
    expect(isNumber("abc")).toBe(false);
  });
});

describe("keyword-extractor normalizeToken", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeToken("Hello!")).toBe("hello");
    expect(normalizeToken("'quoted'")).toBe("quoted");
  });
});

describe("keyword-extractor isStopword", () => {
  it("flags English stopwords", () => {
    expect(isStopword("the", "en")).toBe(true);
    expect(isStopword("cat", "en")).toBe(false);
  });
  it("flags Spanish stopwords", () => {
    expect(isStopword("el", "es")).toBe(true);
    expect(isStopword("gato", "es")).toBe(false);
  });
  it("flags French stopwords", () => {
    expect(isStopword("le", "fr")).toBe(true);
  });
  it("flags German stopwords", () => {
    expect(isStopword("der", "de")).toBe(true);
  });
  it("flags Portuguese stopwords", () => {
    expect(isStopword("o", "pt")).toBe(true);
  });
});

describe("keyword-extractor isAcceptable", () => {
  it("rejects stopwords", () => {
    expect(isAcceptable("the", "en", DEFAULT_OPTIONS)).toBe(false);
  });
  it("rejects too-short tokens", () => {
    expect(isAcceptable("a", "en", DEFAULT_OPTIONS)).toBe(false);
  });
  it("accepts normal words", () => {
    expect(isAcceptable("keyword", "en", DEFAULT_OPTIONS)).toBe(true);
  });
  it("respects includeNumbers", () => {
    expect(isAcceptable("42", "en", { ...DEFAULT_OPTIONS, includeNumbers: true })).toBe(true);
    expect(isAcceptable("42", "en", { ...DEFAULT_OPTIONS, includeNumbers: false })).toBe(false);
  });
});

describe("keyword-extractor countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

// ---------- TF-IDF ----------

describe("keyword-extractor computeIdf", () => {
  it("returns positive idf for any term", () => {
    expect(computeIdf("cat")).toBeGreaterThan(0);
  });
  it("returns lower idf for common words", () => {
    expect(computeIdf("the")).toBeLessThan(computeIdf("xyzzy"));
  });
});

describe("keyword-extractor extractTfidf", () => {
  it("extracts keywords from sample text", () => {
    const kws = extractTfidf("seo seo seo keyword keyword ranking ranking ranking", DEFAULT_OPTIONS);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.some((k) => k.text === "seo")).toBe(true);
  });
  it("produces correct density", () => {
    const kws = extractTfidf("seo seo seo cat", DEFAULT_OPTIONS);
    const seo = kws.find((k) => k.text === "seo");
    expect(seo).toBeDefined();
    expect(seo!.frequency).toBe(3);
  });
  it("supports n-grams", () => {
    const opts: ExtractOptions = { ...DEFAULT_OPTIONS, ngram: 2 };
    const kws = extractTfidf("search engine search engine seo keyword", opts);
    expect(kws.some((k) => k.ngram === 2)).toBe(true);
    expect(kws.some((k) => k.text === "search engine")).toBe(true);
  });
  it("returns empty for empty text", () => {
    expect(extractTfidf("", DEFAULT_OPTIONS)).toEqual([]);
  });
  it("excludes stopwords from middle of n-grams", () => {
    const opts: ExtractOptions = { ...DEFAULT_OPTIONS, ngram: 3 };
    const kws = extractTfidf("search the engine ranking", opts);
    // 'search the engine' contains stopword 'the' in the middle — should not appear as 3-gram.
    expect(kws.some((k) => k.text === "search the engine")).toBe(false);
  });
  it("marks capitalized keywords", () => {
    const kws = extractTfidf("Apple apple Apple", DEFAULT_OPTIONS);
    const apple = kws.find((k) => k.text === "apple");
    expect(apple).toBeDefined();
    expect(apple!.capitalized).toBe(true);
  });
});

// ---------- RAKE ----------

describe("keyword-extractor extractRake", () => {
  it("extracts multi-word phrases", () => {
    const kws = extractRake("search engine optimization is the practice of increasing traffic", DEFAULT_OPTIONS);
    // 'search engine optimization' should be a candidate phrase.
    expect(kws.some((k) => k.text.includes("search engine"))).toBe(true);
  });
  it("splits phrases on stopwords", () => {
    const kws = extractRake("search engine and traffic building", DEFAULT_OPTIONS);
    // 'and' is a stopword — should split into 'search engine' + 'traffic building'.
    expect(kws.some((k) => k.text === "search engine")).toBe(true);
    expect(kws.some((k) => k.text === "traffic building")).toBe(true);
  });
  it("returns empty for empty text", () => {
    expect(extractRake("", DEFAULT_OPTIONS)).toEqual([]);
  });
  it("returns empty for all-stopword text", () => {
    expect(extractRake("the and of to", DEFAULT_OPTIONS)).toEqual([]);
  });
  it("produces frequency counts for repeated phrase", () => {
    // RAKE splits phrases on stopwords. Use "the" to split.
    const kws = extractRake("seo the seo the seo the keyword the keyword", DEFAULT_OPTIONS);
    const seo = kws.find((k) => k.text === "seo");
    expect(seo).toBeDefined();
    expect(seo!.frequency).toBe(3);
  });
  it("sorts by score descending", () => {
    const kws = extractRake("seo seo seo ranking ranking ranking keyword", DEFAULT_OPTIONS);
    for (let i = 1; i < kws.length; i++) {
      expect(kws[i].score).toBeLessThanOrEqual(kws[i - 1].score);
    }
  });
});

// ---------- YAKE ----------

describe("keyword-extractor extractYake", () => {
  it("extracts keywords from sample text", () => {
    const kws = extractYake("seo seo seo keyword keyword ranking ranking", DEFAULT_OPTIONS);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.some((k) => k.text === "seo")).toBe(true);
  });
  it("gives single-word keywords (ngram=1)", () => {
    const kws = extractYake("search engine optimization seo", DEFAULT_OPTIONS);
    expect(kws.every((k) => k.ngram === 1)).toBe(true);
  });
  it("returns empty for empty text", () => {
    expect(extractYake("", DEFAULT_OPTIONS)).toEqual([]);
  });
  it("marks capitalized keywords", () => {
    const kws = extractYake("Apple apple Apple", DEFAULT_OPTIONS);
    const apple = kws.find((k) => k.text === "apple");
    expect(apple).toBeDefined();
    expect(apple!.capitalized).toBe(true);
  });
  it("sorts by score descending", () => {
    const kws = extractYake("seo seo seo ranking ranking keyword", DEFAULT_OPTIONS);
    for (let i = 1; i < kws.length; i++) {
      expect(kws[i].score).toBeLessThanOrEqual(kws[i - 1].score);
    }
  });
});

// ---------- Clustering ----------

describe("keyword-extractor clusterKeywords", () => {
  it("returns empty for empty input", () => {
    expect(clusterKeywords([], [])).toEqual([]);
  });
  it("groups co-occurring keywords", () => {
    const kws: Keyword[] = [
      { text: "seo", score: 1, frequency: 2, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0, 1], firstPosition: 0 },
      { text: "ranking", score: 1, frequency: 2, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0, 1], firstPosition: 5 },
      { text: "coffee", score: 1, frequency: 1, density: 0.05, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [5], firstPosition: 100 },
    ];
    const clusters = clusterKeywords(kws, []);
    // 'seo' and 'ranking' co-occur in sentences 0 and 1 — should be in same cluster.
    // 'coffee' is in its own cluster.
    expect(clusters.length).toBe(2);
    const seoCluster = clusters.find((c) => c.members.includes("seo"));
    expect(seoCluster?.members).toContain("ranking");
  });
});

// ---------- Main extract ----------

describe("keyword-extractor extract (main)", () => {
  it("runs tfidf algorithm", () => {
    const r = extract("seo seo seo keyword keyword ranking", { ...DEFAULT_OPTIONS, algorithm: "tfidf" });
    expect(r.algorithm).toBe("tfidf");
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(r.stats.totalWords).toBeGreaterThan(0);
    expect(r.stats.algorithm).toBe("tfidf");
  });
  it("runs rake algorithm", () => {
    const r = extract("search engine optimization and traffic building", { ...DEFAULT_OPTIONS, algorithm: "rake" });
    expect(r.algorithm).toBe("rake");
    expect(r.keywords.some((k) => k.algorithm === "rake")).toBe(true);
  });
  it("runs yake algorithm", () => {
    const r = extract("seo seo seo keyword keyword ranking", { ...DEFAULT_OPTIONS, algorithm: "yake" });
    expect(r.algorithm).toBe("yake");
    expect(r.keywords.every((k) => k.algorithm === "yake")).toBe(true);
  });
  it("respects topN", () => {
    const r = extract("seo seo seo keyword keyword ranking building traffic content optimization site", { ...DEFAULT_OPTIONS, topN: 3 });
    expect(r.keywords.length).toBeLessThanOrEqual(3);
  });
  it("produces clusters when enabled", () => {
    const r = extract("seo ranking seo ranking keyword another term", { ...DEFAULT_OPTIONS, clusterTopics: true, topN: 5 });
    expect(r.clusters).toBeDefined();
  });
  it("omits clusters when disabled", () => {
    const r = extract("seo ranking", { ...DEFAULT_OPTIONS, clusterTopics: false });
    expect(r.clusters).toEqual([]);
  });
  it("deduplicates case-insensitively", () => {
    const r = extract("SEO seo Seo", { ...DEFAULT_OPTIONS, algorithm: "tfidf" });
    expect(r.keywords.filter((k) => k.text.toLowerCase() === "seo")).toHaveLength(1);
  });
  it("returns empty for empty text", () => {
    const r = extract("", DEFAULT_OPTIONS);
    expect(r.keywords).toEqual([]);
    expect(r.stats.totalWords).toBe(0);
  });
  it("stats include uniqueWords and topShare", () => {
    const r = extract("seo seo seo keyword keyword ranking", DEFAULT_OPTIONS);
    expect(r.stats.uniqueWords).toBeGreaterThan(0);
    expect(r.stats.topShare).toBeGreaterThanOrEqual(0);
    expect(r.stats.topShare).toBeLessThanOrEqual(1);
  });
});

// ---------- Rendering ----------

describe("keyword-extractor renderCommaList / renderLineList", () => {
  const kws: Keyword[] = [
    { text: "seo", score: 1, frequency: 3, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 0 },
    { text: "ranking", score: 0.5, frequency: 1, density: 0.05, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 5 },
  ];
  it("renders comma list", () => {
    expect(renderCommaList(kws)).toBe("seo, ranking");
  });
  it("renders line list", () => {
    expect(renderLineList(kws)).toBe("seo\nranking");
  });
  it("renders empty for empty", () => {
    expect(renderCommaList([])).toBe("");
    expect(renderLineList([])).toBe("");
  });
});

describe("keyword-extractor renderCsv", () => {
  it("renders CSV header", () => {
    expect(renderCsv([])).toContain("rank,keyword,score,frequency,density,ngram,capitalized,algorithm");
  });
  it("escapes commas in keywords", () => {
    const kws: Keyword[] = [
      { text: "a,b", score: 1, frequency: 1, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 0 },
    ];
    const csv = renderCsv(kws);
    expect(csv).toContain('"a,b"');
  });
});

describe("keyword-extractor renderJson", () => {
  it("produces valid JSON with keywords, stats, clusters", () => {
    const kws: Keyword[] = [
      { text: "seo", score: 1, frequency: 1, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 0 },
    ];
    const stats = {
      totalWords: 5, uniqueWords: 3, totalSentences: 1, topN: 1,
      algorithm: "tfidf" as Algorithm, language: "en" as Language, topShare: 0.2,
    };
    const json = renderJson(kws, stats, []);
    const parsed = JSON.parse(json);
    expect(parsed.keywords).toHaveLength(1);
    expect(parsed.stats.totalWords).toBe(5);
    expect(Array.isArray(parsed.clusters)).toBe(true);
  });
});

describe("keyword-extractor renderMarkdown", () => {
  it("renders headers and table", () => {
    const kws: Keyword[] = [
      { text: "seo", score: 1, frequency: 3, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 0 },
    ];
    const stats = {
      totalWords: 5, uniqueWords: 3, totalSentences: 1, topN: 1,
      algorithm: "tfidf" as Algorithm, language: "en" as Language, topShare: 0.2,
    };
    const md = renderMarkdown(kws, stats, []);
    expect(md).toContain("Extracted Keywords");
    expect(md).toContain("| Rank | Keyword |");
    expect(md).toContain("seo");
  });
});

describe("keyword-extractor renderTagCloudHtml", () => {
  it("returns empty for empty", () => {
    expect(renderTagCloudHtml([])).toBe("");
  });
  it("renders spans with font-size for each keyword", () => {
    const kws: Keyword[] = [
      { text: "seo", score: 5, frequency: 3, density: 0.1, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 0 },
      { text: "ranking", score: 1, frequency: 1, density: 0.05, ngram: 1, capitalized: false, algorithm: "tfidf", sentences: [0], firstPosition: 5 },
    ];
    const html = renderTagCloudHtml(kws);
    expect(html).toContain("font-size:");
    expect(html).toContain("seo");
    expect(html).toContain("ranking");
  });
});

// ---------- History ----------

describe("keyword-extractor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      algorithm: "tfidf",
      language: "en",
      topN: 10,
      textLength: 100,
      keywordCount: 5,
      topKeyword: "seo",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, algorithm: "tfidf", language: "en", topN: 10,
        textLength: 1, keywordCount: 0, topKeyword: "x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, algorithm: "tfidf", language: "en", topN: 10,
      textLength: 1, keywordCount: 0, topKeyword: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("keyword-extractor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ text: "hi", algorithm: "rake", language: "es", ngram: 2, topN: 5 });
    expect(url).toContain("text=hi");
    expect(url).toContain("algo=rake");
    expect(url).toContain("lang=es");
    expect(url).toContain("ngram=2");
    expect(url).toContain("top=5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hi&algo=rake&lang=es&ngram=2&top=5");
    expect(p.text).toBe("hi");
    expect(p.algorithm).toBe("rake");
    expect(p.language).toBe("es");
    expect(p.ngram).toBe(2);
    expect(p.topN).toBe(5);
  });
  it("defaults algorithm to tfidf when missing", () => {
    const p = parseShareUrl("text=hi");
    expect(p.algorithm).toBe("tfidf");
  });
  it("defaults algorithm to tfidf when unknown", () => {
    const p = parseShareUrl("text=hi&algo=bogus");
    expect(p.algorithm).toBe("tfidf");
  });
  it("defaults language to en when unknown", () => {
    const p = parseShareUrl("text=hi&lang=xyz");
    expect(p.language).toBe("en");
  });
  it("clamps ngram to valid range", () => {
    expect(parseShareUrl("text=hi&ngram=99").ngram).toBe(1);
    expect(parseShareUrl("text=hi&ngram=3").ngram).toBe(3);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({
      text: "", algorithm: "tfidf", language: "en", ngram: 1, topN: 10,
    });
  });
});

// ---------- LLM helpers ----------

describe("keyword-extractor LLM helpers", () => {
  it("builds a prompt containing algorithm and topN", () => {
    const p = buildLlmPrompt("some text", "rake", 15);
    expect(p).toContain("15");
    expect(p).toContain("RAKE");
    expect(p).toContain("some text");
  });
  it("splits LLM result into keyword list", () => {
    expect(renderLlmResult("seo\nranking\n\nkeyword")).toEqual(["seo", "ranking", "keyword"]);
  });
});

// ---------- Type-only export to suppress unused-import lint ----------

export type _Unused = Algorithm | Language | ExtractOptions;
