import { describe, it, expect, beforeEach } from "vitest";
import {
  validatePair,
  validateInput,
  parseBulkPairs,
  buildJsonLd,
  buildScriptTag,
  generateFaqSchema,
  generateMultiFaq,
  buildGoogleRichResultsLink,
  countChars,
  escapeJsonString,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  QUESTION_MAX,
  ANSWER_MAX,
  type FaqInput,
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

describe("faq-schema-generator validatePair", () => {
  it("errors on empty question", () => {
    const r = validatePair({ question: "", answer: "x" }, 0);
    expect(r.errors.some((e) => /question/i.test(e))).toBe(true);
  });
  it("errors on empty answer", () => {
    const r = validatePair({ question: "Q?", answer: "" }, 0);
    expect(r.errors.some((e) => /answer/i.test(e))).toBe(true);
  });
  it("warns on long question", () => {
    const r = validatePair({ question: "x".repeat(QUESTION_MAX + 50) + "?", answer: "a" }, 0);
    expect(r.warnings.some((w) => /question/i.test(w))).toBe(true);
  });
  it("warns on long answer", () => {
    const r = validatePair({ question: "Q?", answer: "x".repeat(ANSWER_MAX + 100) }, 0);
    expect(r.warnings.some((w) => /answer/i.test(w))).toBe(true);
  });
  it("warns on question without question mark", () => {
    const r = validatePair({ question: "What is this", answer: "x" }, 0);
    expect(r.warnings.some((w) => /question.*\?|does not end/i.test(w))).toBe(true);
  });
  it("passes for valid pair", () => {
    const r = validatePair({ question: "What is X?", answer: "X is Y." }, 0);
    expect(r.errors).toHaveLength(0);
  });
});

describe("faq-schema-generator validateInput", () => {
  it("errors on empty pairs", () => {
    const r = validateInput({ pairs: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /at least one/i.test(e))).toBe(true);
  });
  it("passes for valid input", () => {
    const r = validateInput({
      pairs: [{ question: "Q?", answer: "A" }],
    });
    expect(r.ok).toBe(true);
  });
  it("warns on duplicate questions", () => {
    const r = validateInput({
      pairs: [
        { question: "Same?", answer: "A1" },
        { question: "Same?", answer: "A2" },
      ],
    });
    expect(r.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });
  it("aggregates errors across pairs", () => {
    const r = validateInput({
      pairs: [
        { question: "", answer: "" },
        { question: "Q?", answer: "A" },
      ],
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("faq-schema-generator parseBulkPairs", () => {
  it("parses Q:/A: format", () => {
    const out = parseBulkPairs("Q: What is X?\nA: X is Y.\n\nQ: How?\nA: Like this.");
    expect(out).toHaveLength(2);
    expect(out[0].question).toBe("What is X?");
    expect(out[0].answer).toBe("X is Y.");
  });
  it("parses Q:/A: with multi-line answers", () => {
    const out = parseBulkPairs("Q: What?\nA: First line\nSecond line");
    expect(out).toHaveLength(1);
    expect(out[0].answer).toContain("First line");
    expect(out[0].answer).toContain("Second line");
  });
  it("parses pipe-separated", () => {
    const out = parseBulkPairs("Question?|Answer here");
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe("Question?");
    expect(out[0].answer).toBe("Answer here");
  });
  it("parses alternating lines as fallback", () => {
    const out = parseBulkPairs("Question?\nAnswer");
    expect(out).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseBulkPairs("")).toEqual([]);
    expect(parseBulkPairs("   ")).toEqual([]);
  });
  it("skips invalid pipe entries", () => {
    const out = parseBulkPairs("Question?|\nQ2?|A2");
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe("Q2?");
  });
});

describe("faq-schema-generator buildJsonLd", () => {
  it("produces FAQPage with @context and @type", () => {
    const out = buildJsonLd({ pairs: [{ question: "Q?", answer: "A" }] }) as Record<string, unknown>;
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("FAQPage");
  });
  it("builds mainEntity array", () => {
    const out = buildJsonLd({
      pairs: [
        { question: "Q1?", answer: "A1" },
        { question: "Q2?", answer: "A2" },
      ],
    }) as Record<string, unknown[]>;
    expect(out.mainEntity).toHaveLength(2);
  });
  it("each entity is Question with acceptedAnswer", () => {
    const out = buildJsonLd({ pairs: [{ question: "Q?", answer: "A" }] }) as {
      mainEntity: Array<{ "@type": string; acceptedAnswer: { "@type": string } }>;
    };
    expect(out.mainEntity[0]["@type"]).toBe("Question");
    expect(out.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });
  it("throws on invalid input", () => {
    expect(() => buildJsonLd({ pairs: [] })).toThrow();
    expect(() => buildJsonLd({ pairs: [{ question: "", answer: "" }] })).toThrow();
  });
});

describe("faq-schema-generator buildScriptTag", () => {
  it("wraps JSON in script tag", () => {
    const tag = buildScriptTag({ "@type": "FAQPage" });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });
  it("contains valid JSON inside", () => {
    const tag = buildScriptTag({ hello: "world" });
    const json = tag.replace(/<\/?script[^>]*>/g, "").trim();
    expect(JSON.parse(json)).toEqual({ hello: "world" });
  });
});

describe("faq-schema-generator generateFaqSchema", () => {
  it("returns a complete script tag string", () => {
    const out = generateFaqSchema({
      pairs: [{ question: "What is X?", answer: "X is Y." }],
    });
    expect(out).toContain("FAQPage");
    expect(out).toContain("What is X?");
  });
});

describe("faq-schema-generator generateMultiFaq", () => {
  it("wraps multiple FAQPage blocks in @graph", () => {
    const out = generateMultiFaq([
      { pairs: [{ question: "Q1?", answer: "A1" }] },
      { pairs: [{ question: "Q2?", answer: "A2" }] },
    ]);
    expect(out).toContain("@graph");
    expect(out).toContain("Q1?");
    expect(out).toContain("Q2?");
  });
  it("throws on empty array", () => {
    expect(() => generateMultiFaq([])).toThrow();
  });
});

describe("faq-schema-generator links and utils", () => {
  it("builds Google Rich Results link", () => {
    const link = buildGoogleRichResultsLink("https://example.com");
    expect(link).toContain("search.google.com/test/rich-results");
  });
  it("countChars returns expected values", () => {
    const c = countChars("Hello", 100);
    expect(c.value).toBe(5);
    expect(c.isOver).toBe(false);
  });
  it("countChars flags over-limit", () => {
    expect(countChars("x".repeat(110), 100).isOver).toBe(true);
  });
  it("escapeJsonString wraps in quotes", () => {
    expect(escapeJsonString("hello")).toBe('"hello"');
  });
  it("escapeJsonString escapes special chars", () => {
    expect(escapeJsonString('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe("faq-schema-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, pairCount: 3, snippet: "x" });
    saveHistory({ ts: 2, pairCount: 5, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].pairCount).toBe(5);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, pairCount: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, pairCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("faq-schema-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ pairs: [{ question: "Q?", answer: "A" }] });
    expect(url).toContain("pairs=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to pairs", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      pairs: [{ question: "Q?", answer: "A" }, { question: "Q2?", answer: "A2" }],
    });
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash) as FaqInput;
    expect(parsed.pairs).toHaveLength(2);
    expect(parsed.pairs?.[0].question).toBe("Q?");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("returns empty for malformed JSON", () => {
    expect(parseShareUrl("pairs=notjson")).toEqual({});
  });
});
