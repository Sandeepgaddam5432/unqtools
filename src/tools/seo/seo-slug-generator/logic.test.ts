/**
 * SEO Slug Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateSlug, generateSlugsBatch, slugToTitle, deduplicateSlug } from "./logic";

describe("generateSlug — basic", () => {
  it("lowercases and hyphenates", () => {
    const r = generateSlug({ text: "Hello World" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("hello-world");
  });
  it("errors on empty text", () => {
    expect("error" in generateSlug({ text: "" })).toBe(true);
  });
  it("errors on too-long text", () => {
    expect("error" in generateSlug({ text: "x".repeat(501) })).toBe(true);
  });
  it("strips special characters and emoji", () => {
    const r = generateSlug({ text: "Hello!!! World 🎉" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("hello-world");
  });
  it("replaces multiple spaces with single separator", () => {
    const r = generateSlug({ text: "Hello     World" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("hello-world");
  });
});

describe("generateSlug — separators", () => {
  it("uses underscore separator", () => {
    const r = generateSlug({ text: "Hello World", separator: "_" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("hello_world");
  });
  it("uses dot separator", () => {
    const r = generateSlug({ text: "Hello World", separator: "." });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("hello.world");
  });
});

describe("generateSlug — case modes", () => {
  it("preserves case when caseMode=preserve", () => {
    const r = generateSlug({ text: "HelloWorld", caseMode: "preserve" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("HelloWorld");
  });
  it("uppercases when caseMode=upper", () => {
    const r = generateSlug({ text: "Hello World", caseMode: "upper" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("HELLO-WORLD");
  });
});

describe("generateSlug — stop words", () => {
  it("removes English stop words", () => {
    const r = generateSlug({ text: "The Best Coffee in the World", removeStopWords: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("best-coffee-world");
    expect(r.wordsRemoved).toContain("the");
    expect(r.wordsRemoved).toContain("in");
  });
  it("does not remove stop words by default", () => {
    const r = generateSlug({ text: "The Best Coffee" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("the-best-coffee");
  });
  it("supports multiple languages", () => {
    const r = generateSlug({ text: "Le Chat Noir", removeStopWords: true, stopWordLang: "fr" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("chat-noir");
  });
  it("supports all-languages mode", () => {
    const r = generateSlug({ text: "El Le The", removeStopWords: true, stopWordLang: "all" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("");
  });
});

describe("generateSlug — transliteration", () => {
  it("transliterates accented characters", () => {
    const r = generateSlug({ text: "Café Résumé" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("cafe-resume");
  });
  it("transliterates Spanish ñ", () => {
    const r = generateSlug({ text: "España" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("espana");
  });
  it("transliterates German ß", () => {
    const r = generateSlug({ text: "Straße" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("strasse");
  });
  it("can be disabled", () => {
    const r = generateSlug({ text: "Café", transliterate: false });
    if ("error" in r) throw new Error("Should not error");
    // Non-ASCII gets stripped, leaving just 'caf'
    expect(r.slug).toBe("caf");
  });
});

describe("generateSlug — max length", () => {
  it("truncates on word boundary", () => {
    const r = generateSlug({ text: "Hello World Foo Bar Baz", maxLength: 15 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.truncated).toBe(true);
    expect(r.slug.length).toBeLessThanOrEqual(15);
  });
  it("warns when truncation happens", () => {
    const r = generateSlug({ text: "Hello World Foo Bar Baz", maxLength: 10 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });
});

describe("generateSlug — numbers", () => {
  it("preserves numbers by default", () => {
    const r = generateSlug({ text: "Top 10 Tools 2024" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("top-10-tools-2024");
  });
  it("strips numbers when preserveNumbers=false", () => {
    const r = generateSlug({ text: "Top 10 Tools 2024", preserveNumbers: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("top-tools");
  });
});

describe("generateSlug — custom replacements", () => {
  it("applies custom replacements before slugification", () => {
    const r = generateSlug({
      text: "C++ Programming",
      customReplacements: [{ find: "C++", replace: "Cpp" }],
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.slug).toBe("cpp-programming");
  });
});

describe("generateSlug — warnings", () => {
  it("warns when slug exceeds 75 chars", () => {
    const longText = "This Is A Very Long Title That Will Definitely Exceed The Recommended SEO Slug Length Of Seventy Five Characters";
    const r = generateSlug({ text: longText });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("75"))).toBe(true);
  });
  it("warns when slug becomes empty", () => {
    const r = generateSlug({ text: "🎉🎉🎉" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("empty"))).toBe(true);
  });
});

describe("generateSlugsBatch", () => {
  it("generates multiple slugs at once", () => {
    const r = generateSlugsBatch([{ text: "Hello World" }, { text: "Foo Bar" }]);
    if ("error" in r) throw new Error("Should not error");
    expect(r.length).toBe(2);
    expect(r[0]!.slug).toBe("hello-world");
    expect(r[1]!.slug).toBe("foo-bar");
  });
  it("errors if input is empty", () => {
    expect("error" in generateSlugsBatch([])).toBe(true);
  });
});

describe("slugToTitle", () => {
  it("converts slug to Title Case", () => {
    expect(slugToTitle("hello-world")).toBe("Hello World");
  });
  it("respects custom separator", () => {
    expect(slugToTitle("hello_world", "_")).toBe("Hello World");
  });
});

describe("deduplicateSlug", () => {
  it("returns slug unchanged if no collision", () => {
    expect(deduplicateSlug("hello-world", ["foo-bar"])).toBe("hello-world");
  });
  it("appends -1 on first collision", () => {
    expect(deduplicateSlug("hello-world", ["hello-world"])).toBe("hello-world-1");
  });
  it("increments until unique", () => {
    expect(deduplicateSlug("hello-world", ["hello-world", "hello-world-1", "hello-world-2"])).toBe("hello-world-3");
  });
});
