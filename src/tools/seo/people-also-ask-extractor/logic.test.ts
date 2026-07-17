import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_WORDS,
  ALL_TEMPLATE_NAMES,
  TEMPLATES,
  parseSeeds,
  dedupQuestions,
  generateForSeed,
  extract,
  renderCsv,
  renderMarkdown,
  renderList,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QuestionWord,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("people-also-ask-extractor constants", () => {
  it("has 7 question words", () => {
    expect(ALL_WORDS).toHaveLength(7);
    expect(ALL_WORDS).toContain("what");
    expect(ALL_WORDS).toContain("how");
  });
  it("has multiple template groups", () => {
    expect(ALL_TEMPLATE_NAMES.length).toBeGreaterThanOrEqual(5);
    expect(ALL_TEMPLATE_NAMES).toContain("basic");
    expect(ALL_TEMPLATE_NAMES).toContain("comparative");
  });
  it("each template returns non-empty string", () => {
    for (const [name, tpls] of Object.entries(TEMPLATES)) {
      for (const t of tpls) {
        expect(t.fn("SEO").length).toBeGreaterThan(0);
        expect(t.word).toBeTruthy();
      }
      expect(name).toBeTruthy();
    }
  });
});

describe("people-also-ask-extractor parseSeeds", () => {
  it("parses newline-separated", () => {
    expect(parseSeeds("SEO\nMarketing")).toEqual(["SEO", "Marketing"]);
  });
  it("parses comma-separated", () => {
    expect(parseSeeds("SEO, Marketing")).toEqual(["SEO", "Marketing"]);
  });
  it("skips blanks", () => {
    expect(parseSeeds("a\n\nb")).toEqual(["a", "b"]);
  });
  it("returns empty for empty", () => {
    expect(parseSeeds("")).toEqual([]);
  });
});

describe("people-also-ask-extractor dedupQuestions", () => {
  it("removes duplicates case-insensitive", () => {
    const { unique, removed } = dedupQuestions([
      { question: "What is SEO?", word: "what", template: "basic", seed: "SEO" },
      { question: "what is seo?", word: "what", template: "basic", seed: "SEO" },
    ]);
    expect(unique).toHaveLength(1);
    expect(removed).toBe(1);
  });
  it("collapses whitespace", () => {
    const { unique } = dedupQuestions([
      { question: "What  is SEO?", word: "what", template: "basic", seed: "SEO" },
      { question: "What is SEO?", word: "what", template: "basic", seed: "SEO" },
    ]);
    expect(unique).toHaveLength(1);
  });
});

describe("people-also-ask-extractor generateForSeed", () => {
  it("returns empty for empty seed", () => {
    expect(generateForSeed("", { words: ALL_WORDS, templates: ["basic"] })).toEqual([]);
  });
  it("filters by enabled words", () => {
    const out = generateForSeed("SEO", { words: ["what"], templates: ["basic"] });
    for (const q of out) expect(q.word).toBe("what");
  });
  it("filters by enabled templates", () => {
    const out = generateForSeed("SEO", { words: ALL_WORDS, templates: ["basic"] });
    for (const q of out) expect(q.template).toBe("basic");
  });
  it("returns questions ending with ?", () => {
    const out = generateForSeed("SEO", { words: ALL_WORDS, templates: ["basic"] });
    for (const q of out) expect(q.question.endsWith("?")).toBe(true);
  });
});

describe("people-also-ask-extractor extract", () => {
  it("generates questions for multiple seeds", () => {
    const r = extract(["SEO", "Marketing"], { words: ALL_WORDS, templates: ALL_TEMPLATE_NAMES });
    expect(r.total).toBeGreaterThan(0);
    expect(r.questions.length).toBe(r.total);
  });
  it("dedups across seeds", () => {
    const r = extract(["SEO", "SEO"], { words: ALL_WORDS, templates: ["basic"] });
    expect(r.duplicatesRemoved).toBeGreaterThan(0);
  });
  it("computes byWord counts", () => {
    const r = extract(["SEO"], { words: ["what"], templates: ["basic"] });
    expect(r.byWord.what).toBeGreaterThan(0);
    expect(r.byWord.how).toBe(0);
  });
  it("returns empty for no seeds", () => {
    expect(extract([], { words: ALL_WORDS, templates: ALL_TEMPLATE_NAMES }).total).toBe(0);
  });
  it("returns empty when no words selected", () => {
    expect(extract(["SEO"], { words: [], templates: ["basic"] }).total).toBe(0);
  });
});

describe("people-also-ask-extractor renderCsv", () => {
  it("renders CSV header", () => {
    const csv = renderCsv(extract(["SEO"], { words: ALL_WORDS, templates: ["basic"] }));
    expect(csv).toContain("question,word,template,seed");
  });
  it("escapes commas in questions", () => {
    const csv = renderCsv(extract(["SEO, tools"], { words: ["what"], templates: ["basic"] }));
    expect(csv).toContain('"What is SEO, tools?"');
  });
});

describe("people-also-ask-extractor renderMarkdown", () => {
  it("renders markdown header", () => {
    const md = renderMarkdown(extract(["SEO"], { words: ["what"], templates: ["basic"] }));
    expect(md).toContain("# People Also Ask");
    expect(md).toContain("## WHAT");
  });
  it("groups by question word", () => {
    const md = renderMarkdown(extract(["SEO"], { words: ["what", "how"], templates: ["basic"] }));
    expect(md).toContain("## WHAT");
    expect(md).toContain("## HOW");
  });
  it("omits empty groups", () => {
    const md = renderMarkdown(extract(["SEO"], { words: ["what"], templates: ["basic"] }));
    expect(md).not.toContain("## HOW");
  });
});

describe("people-also-ask-extractor renderList", () => {
  it("renders plain list", () => {
    const list = renderList(extract(["SEO"], { words: ["what"], templates: ["basic"] }));
    expect(list).toContain("What is SEO?");
  });
  it("returns empty for no questions", () => {
    expect(renderList(extract([], { words: [], templates: [] }))).toBe("");
  });
});

describe("people-also-ask-extractor history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seedCount: 2, total: 20 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, seedCount: 1, total: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, seedCount: 1, total: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("people-also-ask-extractor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      seeds: "SEO",
      words: ["what", "how"],
      templates: ["basic", "comparative"],
    });
    expect(url).toContain("seeds=SEO");
    expect(url).toContain("words=what");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seeds=SEO%2CMarketing&words=what,how&templates=basic,comparative");
    expect(p.seeds).toBe("SEO,Marketing");
    expect(p.words).toEqual(["what", "how"]);
    expect(p.templates).toEqual(["basic", "comparative"]);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.seeds).toBe("");
    expect(p.words).toEqual([]);
    expect(p.templates).toEqual([]);
  });
  it("omits empty seeds", () => {
    const url = buildShareUrl({ seeds: "", words: ["what"], templates: ["basic"] });
    expect(url).not.toContain("seeds=");
  });
  it("filters out invalid word values", () => {
    const p = parseShareUrl("seeds=x&words=what,invalidword");
    expect(p.words).toEqual(["what"]);
  });
});

describe("people-also-ask-extractor type", () => {
  it("QuestionWord is a known union", () => {
    const w: QuestionWord = "what";
    expect(ALL_WORDS).toContain(w);
  });
});
