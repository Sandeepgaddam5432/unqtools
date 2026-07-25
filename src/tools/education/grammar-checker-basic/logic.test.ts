/**
 * Basic Grammar Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { checkGrammar, applyFix, summary } from "./logic";

describe("grammar capitalization", () => {
  it("flags lowercase sentence start", () => {
    const issues = checkGrammar("hello world.");
    const cap = issues.filter((i) => i.type === "capitalization");
    expect(cap.length).toBeGreaterThan(0);
  });
  it("flags lowercase pronoun 'i'", () => {
    const issues = checkGrammar("i went home.");
    expect(issues.some((i) => i.message.includes("pronoun 'i'"))).toBe(true);
  });
  it("passes correct capitalization", () => {
    const issues = checkGrammar("Hello world. I went home.");
    expect(issues.filter((i) => i.type === "capitalization")).toHaveLength(0);
  });
});

describe("grammar spacing", () => {
  it("flags double spaces", () => {
    const issues = checkGrammar("hello  world");
    expect(issues.some((i) => i.type === "spacing")).toBe(true);
  });
  it("passes single spaces", () => {
    expect(checkGrammar("hello world").some((i) => i.type === "spacing")).toBe(false);
  });
});

describe("grammar punctuation", () => {
  it("flags space before punctuation", () => {
    const issues = checkGrammar("hello , world");
    expect(issues.some((i) => i.type === "punctuation")).toBe(true);
  });
  it("passes correct punctuation", () => {
    expect(checkGrammar("hello, world").some((i) => i.type === "punctuation")).toBe(false);
  });
});

describe("grammar spelling", () => {
  it("detects 'teh' → 'the'", () => {
    const issues = checkGrammar("i saw teh cat.");
    expect(issues.some((i) => i.type === "spelling" && i.excerpt === "teh")).toBe(true);
  });
  it("detects 'recieve' → 'receive'", () => {
    const issues = checkGrammar("please recieve the package.");
    expect(issues.some((i) => i.type === "spelling" && i.excerpt === "recieve")).toBe(true);
  });
  it("does not flag correctly-spelled words", () => {
    expect(checkGrammar("the package arrived.").some((i) => i.type === "spelling")).toBe(false);
  });
});

describe("grammar double-word", () => {
  it("detects doubled words", () => {
    const issues = checkGrammar("I went to the the store.");
    expect(issues.some((i) => i.type === "double-word" && i.excerpt === "the the")).toBe(true);
  });
});

describe("grammar applyFix", () => {
  it("fixes double spaces", () => {
    const issues = checkGrammar("hello  world");
    const sp = issues.find((i) => i.type === "spacing")!;
    const fixed = applyFix("hello  world", sp);
    expect(fixed).toBe("hello world");
  });
  it("fixes misspelling", () => {
    const issues = checkGrammar("teh cat");
    const sp = issues.find((i) => i.type === "spelling")!;
    const fixed = applyFix("teh cat", sp);
    expect(fixed).toBe("the cat");
  });
});

describe("grammar summary", () => {
  it("counts issues by type", () => {
    const issues = checkGrammar("teh  cat , i see");
    const s = summary(issues);
    expect(s.spelling).toBeGreaterThanOrEqual(1);
    expect(s.spacing).toBeGreaterThanOrEqual(1);
    expect(s.punctuation).toBeGreaterThanOrEqual(1);
    expect(s.capitalization).toBeGreaterThanOrEqual(1);
  });
  it("returns zeros for clean text", () => {
    const s = summary(checkGrammar("Hello world. I am fine."));
    expect(s.spelling).toBe(0);
    expect(s.spacing).toBe(0);
  });
});
