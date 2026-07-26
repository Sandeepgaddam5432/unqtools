import { describe, it, expect } from "vitest";
import {
  getThreadPlatform,
  getAllThreadPlatforms,
  splitSentences,
  packSentences,
  hardSplit,
  generateThread,
  totalThreadChars,
  validateThread,
  suggestHook,
  exportThreadText,
  exportThreadJSON,
  exportThreadCSV,
  readingTimeSec,
  longestPost,
  mergeThread,
  optimizePosts,
  suggestCTA,
} from "./logic";

describe("social-thread-generator getThreadPlatform", () => {
  it("finds twitter", () => {
    expect(getThreadPlatform("twitter")?.charLimit).toBe(280);
  });
  it("returns null for unknown", () => {
    expect(getThreadPlatform("nope")).toBeNull();
  });
  it("returns at least 4 platforms", () => {
    expect(getAllThreadPlatforms().length).toBeGreaterThanOrEqual(4);
  });
});

describe("social-thread-generator splitSentences", () => {
  it("splits on sentence boundaries", () => {
    const s = splitSentences("Hello world. This is a test! Is it working?");
    expect(s.length).toBe(3);
  });
  it("returns single item for one sentence", () => {
    expect(splitSentences("Just one sentence.").length).toBe(1);
  });
});

describe("social-thread-generator packSentences", () => {
  it("packs sentences under limit", () => {
    const chunks = packSentences(["short one", "another short"], 50);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("short one");
  });
  it("creates new chunk when over limit", () => {
    const chunks = packSentences(["a very long sentence with many words", "another long sentence"], 30);
    expect(chunks.length).toBe(2);
  });
});

describe("social-thread-generator hardSplit", () => {
  it("splits long text at word boundaries", () => {
    const chunks = hardSplit("the quick brown fox jumps over the lazy dog", 15);
    expect(chunks.length).toBeGreaterThan(1);
  });
  it("slices words longer than limit", () => {
    const chunks = hardSplit("pneumonoultramicroscopicsilicovolcanoconiosis", 10);
    expect(chunks.length).toBe(5);
  });
});

describe("social-thread-generator generateThread", () => {
  it("generates numbered posts", () => {
    const p = getThreadPlatform("twitter")!;
    const text = "This is sentence one. This is sentence two. This is sentence three. " + "x ".repeat(200);
    const thread = generateThread(text, p);
    expect(thread.length).toBeGreaterThan(1);
    expect(thread[0].text.startsWith("1/")).toBe(true);
    expect(thread[thread.length - 1].isLast).toBe(true);
  });
  it("respects platform max length", () => {
    const p = getThreadPlatform("twitter")!;
    const long = "a ".repeat(2000);
    const thread = generateThread(long, p);
    expect(thread.length).toBeLessThanOrEqual(p.maxThreadLength);
  });
  it("single post when text fits", () => {
    const p = getThreadPlatform("twitter")!;
    const thread = generateThread("short", p);
    expect(thread.length).toBe(1);
  });
});

describe("social-thread-generator totalThreadChars", () => {
  it("sums char counts", () => {
    const posts = [
      { index: 1, total: 2, text: "abc", charCount: 3, isLast: false },
      { index: 2, total: 2, text: "defg", charCount: 4, isLast: true },
    ];
    expect(totalThreadChars(posts)).toBe(7);
  });
});

describe("social-thread-generator validateThread", () => {
  it("warns when thread exceeds max length", () => {
    const p = getThreadPlatform("twitter")!;
    const posts = Array.from({ length: 30 }, (_, i) => ({ index: i + 1, total: 30, text: "x", charCount: 1, isLast: i === 29 }));
    const w = validateThread(posts, p);
    expect(w.some((x) => x.includes("max length"))).toBe(true);
  });
  it("warns on empty thread", () => {
    const p = getThreadPlatform("twitter")!;
    expect(validateThread([], p).some((x) => x.includes("empty"))).toBe(true);
  });
  it("passes for valid thread", () => {
    const p = getThreadPlatform("twitter")!;
    const posts = [{ index: 1, total: 1, text: "hello", charCount: 5, isLast: true }];
    expect(validateThread(posts, p)).toEqual([]);
  });
});

describe("social-thread-generator suggestHook", () => {
  it("returns at least 3 hooks containing topic", () => {
    const hooks = suggestHook("AI tools");
    expect(hooks.length).toBeGreaterThanOrEqual(3);
    expect(hooks[0]).toContain("AI tools");
  });
});

describe("social-thread-generator suggestCTA", () => {
  it("returns at least 3 CTA options", () => {
    expect(suggestCTA().length).toBeGreaterThanOrEqual(3);
  });
});

describe("social-thread-generator exportThreadText", () => {
  it("separates posts with --- markers", () => {
    const posts = [
      { index: 1, total: 2, text: "first", charCount: 5, isLast: false },
      { index: 2, total: 2, text: "second", charCount: 6, isLast: true },
    ];
    expect(exportThreadText(posts)).toContain("--- Post 1/2");
  });
});

describe("social-thread-generator exportThreadJSON", () => {
  it("outputs valid JSON", () => {
    const posts = [{ index: 1, total: 1, text: "x", charCount: 1, isLast: true }];
    const json = exportThreadJSON(posts);
    expect(JSON.parse(json).length).toBe(1);
  });
});

describe("social-thread-generator exportThreadCSV", () => {
  it("has header plus rows", () => {
    const posts = [
      { index: 1, total: 2, text: "first", charCount: 5, isLast: false },
      { index: 2, total: 2, text: "second", charCount: 6, isLast: true },
    ];
    const csv = exportThreadCSV(posts);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("index,total,char_count");
  });
});

describe("social-thread-generator readingTimeSec", () => {
  it("returns positive for non-empty thread", () => {
    const posts = [{ index: 1, total: 1, text: "the quick brown fox", charCount: 19, isLast: true }];
    expect(readingTimeSec(posts)).toBeGreaterThan(0);
  });
  it("returns 0 for empty thread", () => {
    expect(readingTimeSec([])).toBe(0);
  });
});

describe("social-thread-generator longestPost", () => {
  it("returns the post with the most chars", () => {
    const posts = [
      { index: 1, total: 2, text: "short", charCount: 5, isLast: false },
      { index: 2, total: 2, text: "this is much longer", charCount: 20, isLast: true },
    ];
    expect(longestPost(posts)?.index).toBe(2);
  });
  it("returns null for empty array", () => {
    expect(longestPost([])).toBeNull();
  });
});

describe("social-thread-generator mergeThread", () => {
  it("merges posts into a single string", () => {
    const posts = [
      { index: 1, total: 2, text: "1/2 hello", charCount: 9, isLast: false },
      { index: 2, total: 2, text: "2/2 world", charCount: 9, isLast: true },
    ];
    expect(mergeThread(posts)).toBe("hello world");
  });
});

describe("social-thread-generator optimizePosts", () => {
  it("collapses internal whitespace", () => {
    const posts = [{ index: 1, total: 1, text: "1/1 hello    world", charCount: 19, isLast: true }];
    const opt = optimizePosts(posts);
    expect(opt[0].text).toBe("1/1 hello world");
  });
});
