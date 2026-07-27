import { describe, it, expect } from "vitest";
import {
  chunkPages, normalizeText, tokenize, removeStopWords, buildTFIDFIndex,
  queryToTFIDF, cosineSimilarity, retrieveTopK, buildCitations,
  generateAnswer, isNotFoundAnswer, generateSuggestedQuestions,
  exportConversationJSON, exportConversationMarkdown, simulatePdfExtraction,
  type Chunk, type PageText, type ChatMessage,
} from "./logic";

const PAGES: PageText[] = [
  { pageNumber: 1, text: "UnQTools is a privacy-first toolbox. All processing happens in the browser. No data is ever uploaded to a server." },
  { pageNumber: 2, text: "The tool collection includes PDF tools, image tools, developer tools, and more. Each tool works offline." },
  { pageNumber: 3, text: "AI Chat with PDF lets you ask questions about your document. Answers include page citations for verification." },
];

describe("normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
    expect(normalizeText("a\n\nb\t\tc")).toBe("a b c");
  });

  it("handles empty string", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("tokenize", () => {
  it("splits text into lowercase alphanumeric tokens", () => {
    expect(tokenize("Hello, World! 123")).toEqual(["hello", "world", "123"]);
  });

  it("filters single-char tokens", () => {
    expect(tokenize("a b c")).toEqual([]);
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("removeStopWords", () => {
  it("removes common English stop words", () => {
    const result = removeStopWords(["the", "quick", "brown", "fox", "is", "running"]);
    expect(result).toEqual(["quick", "brown", "fox", "running"]);
  });

  it("keeps all words if none are stop words", () => {
    expect(removeStopWords(["apple", "banana"])).toEqual(["apple", "banana"]);
  });
});

describe("chunkPages", () => {
  it("chunks pages with overlap and keeps page numbers", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 100, 20);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.pageNumber >= 1 && c.pageNumber <= 3)).toBe(true);
    expect(chunks.every((c) => c.text.length <= 100)).toBe(true);
  });

  it("assigns unique IDs to chunks", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects empty document name", () => {
    expect(() => chunkPages("", PAGES)).toThrow("Document has no name");
  });

  it("rejects chunk size < 100", () => {
    expect(() => chunkPages("doc.pdf", PAGES, 50)).toThrow("Chunk size");
  });

  it("rejects overlap >= chunk size", () => {
    expect(() => chunkPages("doc.pdf", PAGES, 200, 200)).toThrow("Overlap");
  });

  it("rejects pages with no text", () => {
    expect(() => chunkPages("doc.pdf", [{ pageNumber: 1, text: "   " }])).toThrow("No extractable text");
  });

  it("preserves startChar and endChar", () => {
    const chunks = chunkPages("doc.pdf", [{ pageNumber: 1, text: "Hello world this is a test" }], 100, 20);
    expect(chunks[0].startChar).toBe(0);
    expect(chunks[0].endChar).toBeGreaterThan(0);
  });
});

describe("buildTFIDFIndex", () => {
  it("builds an index from chunks", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    expect(index.totalChunks).toBe(chunks.length);
    expect(index.chunkIds.length).toBe(chunks.length);
    expect(index.idf.size).toBeGreaterThan(0);
  });

  it("stores TF for each chunk", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    for (const chunk of chunks) {
      expect(index.documents.has(chunk.id)).toBe(true);
    }
  });

  it("computes IDF > 0 for terms", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    for (const [, idfVal] of index.idf) {
      expect(idfVal).toBeGreaterThan(0);
    }
  });
});

describe("queryToTFIDF", () => {
  it("converts a query to TF-IDF vector", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    const vec = queryToTFIDF("What is UnQTools?", index);
    expect(vec.size).toBeGreaterThan(0);
    expect(vec.has("unqtools")).toBe(true);
  });

  it("returns empty for stop-word-only query", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    const vec = queryToTFIDF("the is a", index);
    expect(vec.size).toBe(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const vec = new Map([["a", 1], ["b", 2]]);
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1);
  });

  it("returns 0 for disjoint vectors", () => {
    const a = new Map([["a", 1]]);
    const b = new Map([["b", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity(new Map(), new Map())).toBe(0);
  });
});

describe("retrieveTopK", () => {
  it("ranks chunks by similarity", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    const results = retrieveTopK("What is UnQTools?", chunks, index, 2);
    expect(results.length).toBeLessThanOrEqual(2);
    if (results.length > 1) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });

  it("returns results with score >= minSimilarity", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    const results = retrieveTopK("privacy browser", chunks, index, 5, 0.001);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0.001);
    }
  });

  it("returns empty for stop-word-only query", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    const results = retrieveTopK("the is a", chunks, index, 5);
    expect(results).toEqual([]);
  });
});

describe("buildCitations", () => {
  it("dedupes citations by page", () => {
    const retrieved = [
      { id: 0, documentName: "doc.pdf", pageNumber: 1, text: "A".repeat(300), score: 0.9, startChar: 0, endChar: 300 },
      { id: 1, documentName: "doc.pdf", pageNumber: 1, text: "duplicate page", score: 0.8, startChar: 0, endChar: 14 },
      { id: 2, documentName: "doc.pdf", pageNumber: 2, text: "short quote", score: 0.7, startChar: 0, endChar: 11 },
    ] as any[];
    const citations = buildCitations(retrieved, 100);
    expect(citations).toHaveLength(2);
    expect(citations[0].pageNumber).toBe(1);
    expect(citations[1].pageNumber).toBe(2);
  });

  it("truncates long quotes", () => {
    const retrieved = [
      { id: 0, documentName: "doc.pdf", pageNumber: 1, text: "A".repeat(300), score: 0.9, startChar: 0, endChar: 300 },
    ] as any[];
    const citations = buildCitations(retrieved, 100);
    expect(citations[0].quote.length).toBeLessThanOrEqual(100);
    expect(citations[0].quote.endsWith("…")).toBe(true);
  });

  it("keeps short quotes as-is", () => {
    const retrieved = [
      { id: 0, documentName: "doc.pdf", pageNumber: 1, text: "short", score: 0.9, startChar: 0, endChar: 5 },
    ] as any[];
    const citations = buildCitations(retrieved, 100);
    expect(citations[0].quote).toBe("short");
  });
});

describe("generateAnswer", () => {
  it("returns not-found for empty retrieval", () => {
    const result = generateAnswer("What is X?", []);
    expect(result.answer).toContain("Not found");
    expect(result.citations).toEqual([]);
  });

  it("includes page citations in answer", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const index = buildTFIDFIndex(chunks);
    const retrieved = retrieveTopK("UnQTools privacy browser", chunks, index, 3);
    const result = generateAnswer("What is UnQTools?", retrieved);
    expect(result.answer).toBeTruthy();
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("returns relevant passage when no sentence overlap", () => {
    const retrieved = [
      { id: 0, documentName: "doc.pdf", pageNumber: 1, text: "Completely unrelated content about other things.", score: 0.5, startChar: 0, endChar: 50 },
    ] as any[];
    const result = generateAnswer("What is quantum physics?", retrieved);
    expect(result.answer).toContain("most relevant passage");
  });
});

describe("isNotFoundAnswer", () => {
  it("detects not-found answers", () => {
    expect(isNotFoundAnswer("Not found in the document.")).toBe(true);
    expect(isNotFoundAnswer("not found in the document because...")).toBe(true);
  });

  it("does not flag normal answers", () => {
    expect(isNotFoundAnswer("The answer is 42 (p. 3).")).toBe(false);
    expect(isNotFoundAnswer("Based on the document...")).toBe(false);
  });
});

describe("generateSuggestedQuestions", () => {
  it("generates questions from document content", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const questions = generateSuggestedQuestions(chunks, 3);
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => q.endsWith("?"))).toBe(true);
  });

  it("respects count limit", () => {
    const chunks = chunkPages("doc.pdf", PAGES, 200, 50);
    const questions = generateSuggestedQuestions(chunks, 2);
    expect(questions.length).toBeLessThanOrEqual(2);
  });
});

describe("exportConversation", () => {
  const messages: ChatMessage[] = [
    { role: "user", text: "What is UnQTools?", timestamp: Date.now() },
    { role: "assistant", text: "UnQTools is a toolbox.", citations: [{ documentName: "doc.pdf", pageNumber: 1, quote: "UnQTools is a toolbox" }], timestamp: Date.now() },
  ];

  it("exports as JSON", () => {
    const json = exportConversationJSON(messages);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].role).toBe("user");
  });

  it("exports as Markdown", () => {
    const md = exportConversationMarkdown(messages);
    expect(md).toContain("# PDF Chat Conversation");
    expect(md).toContain("**You**");
    expect(md).toContain("**Assistant**");
    expect(md).toContain("Citations");
  });
});

describe("simulatePdfExtraction", () => {
  it("splits text into pages", () => {
    const pages = simulatePdfExtraction("Hello world this is a test", 2);
    expect(pages).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[1].pageNumber).toBe(2);
  });

  it("handles single page", () => {
    const pages = simulatePdfExtraction("Hello world", 1);
    expect(pages).toHaveLength(1);
    expect(pages[0].text).toBe("Hello world");
  });
});
