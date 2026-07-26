/**
 * Headline Analyzer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { analyzeHeadline, batchAnalyze, toCsv } from "./logic";

describe("analyzeHeadline — validation", () => {
  it("errors on empty", () => {
    expect("error" in analyzeHeadline("")).toBe(true);
    expect("error" in analyzeHeadline("   ")).toBe(true);
  });
  it("errors on too long", () => {
    expect("error" in analyzeHeadline("x".repeat(600))).toBe(true);
  });
});

describe("analyzeHeadline — counts", () => {
  it("counts characters and words", () => {
    const r = analyzeHeadline("How to Train Your Dragon");
    if ("error" in r) throw new Error("err");
    expect(r.characters).toBe(24);
    expect(r.words).toBe(5);
  });
  it("counts syllables", () => {
    const r = analyzeHeadline("Amazing new tips for you");
    if ("error" in r) throw new Error("err");
    expect(r.syllables).toBeGreaterThan(5);
  });
  it("estimates reading time", () => {
    const r = analyzeHeadline("Quick brown fox");
    if ("error" in r) throw new Error("err");
    expect(r.readingTimeSec).toBeGreaterThanOrEqual(1);
  });
});

describe("analyzeHeadline — type detection", () => {
  it("detects How-to", () => {
    const r = analyzeHeadline("How to Lose Weight Fast");
    if ("error" in r) throw new Error("err");
    expect(r.type).toBe("How-to");
  });
  it("detects Listicle", () => {
    const r = analyzeHeadline("10 Ways to Save Money");
    if ("error" in r) throw new Error("err");
    expect(r.type).toBe("Listicle");
  });
  it("detects Question", () => {
    const r = analyzeHeadline("Why Is the Sky Blue?");
    if ("error" in r) throw new Error("err");
    expect(r.type).toBe("Question");
    expect(r.hasQuestion).toBe(true);
  });
  it("detects colon (Direct)", () => {
    const r = analyzeHeadline("Marketing 2024: The Complete Guide");
    if ("error" in r) throw new Error("err");
    expect(r.hasColon).toBe(true);
  });
});

describe("analyzeHeadline — feature detection", () => {
  it("detects number presence", () => {
    const r = analyzeHeadline("5 Best Laptops");
    if ("error" in r) throw new Error("err");
    expect(r.hasNumber).toBe(true);
  });
  it("detects brackets", () => {
    const r = analyzeHeadline("New Study [2024] Reveals Truth");
    if ("error" in r) throw new Error("err");
    expect(r.hasBracket).toBe(true);
  });
  it("detects quotes", () => {
    const r = analyzeHeadline("\"Best\" Tips for Success");
    if ("error" in r) throw new Error("err");
    expect(r.hasQuote).toBe(true);
  });
});

describe("analyzeHeadline — word databases", () => {
  it("finds power words", () => {
    const r = analyzeHeadline("10 Secret Ways to Win");
    if ("error" in r) throw new Error("err");
    expect(r.powerWords.length).toBeGreaterThan(0);
    expect(r.powerWords).toContain("secret");
    expect(r.powerWords).toContain("win");
  });
  it("finds positive emotion words", () => {
    const r = analyzeHeadline("Amazing Beautiful Day");
    if ("error" in r) throw new Error("err");
    expect(r.emotionWords.length).toBeGreaterThan(0);
    expect(r.sentimentScore).toBeGreaterThan(0);
  });
  it("finds negative emotion words", () => {
    const r = analyzeHeadline("Terrible Disaster Strikes");
    if ("error" in r) throw new Error("err");
    expect(r.sentimentScore).toBeLessThan(0);
  });
  it("counts common vs uncommon", () => {
    const r = analyzeHeadline("The Cat in the Hat");
    if ("error" in r) throw new Error("err");
    expect(r.commonWords).toBeGreaterThan(r.uncommonWords);
  });
});

describe("analyzeHeadline — scores", () => {
  it("computes SEO score 0-100", () => {
    const r = analyzeHeadline("10 Best Tips for Marketing Success in 2024");
    if ("error" in r) throw new Error("err");
    expect(r.seoScore).toBeGreaterThanOrEqual(0);
    expect(r.seoScore).toBeLessThanOrEqual(100);
  });
  it("overall score is in valid range", () => {
    const r = analyzeHeadline("How to Save Money Fast");
    if ("error" in r) throw new Error("err");
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(100);
  });
  it("gives a letter grade", () => {
    const r = analyzeHeadline("10 Amazing Secrets to Win Today — The Ultimate Guide");
    if ("error" in r) throw new Error("err");
    expect(r.grade).toMatch(/^[A-F]\+?$/);
  });
  it("long sweet-spot headline scores high on length", () => {
    const r = analyzeHeadline("10 Amazing Tips for Marketing Your Small Business Online");
    if ("error" in r) throw new Error("err");
    expect(r.characters).toBeGreaterThanOrEqual(50);
    expect(r.characters).toBeLessThanOrEqual(70);
  });
});

describe("analyzeHeadline — suggestions", () => {
  it("suggests adding power words when absent", () => {
    const r = analyzeHeadline("The Table Has Food");
    if ("error" in r) throw new Error("err");
    expect(r.suggestions.some((s) => s.type === "power")).toBe(true);
  });
  it("praises good length", () => {
    const r = analyzeHeadline("10 Best Tips for Marketing Your Small Business in 2024");
    if ("error" in r) throw new Error("err");
    expect(r.suggestions.some((s) => s.type === "length" && s.severity === "good")).toBe(true);
  });
  it("warns on short headline", () => {
    const r = analyzeHeadline("Hi");
    if ("error" in r) throw new Error("err");
    expect(r.suggestions.some((s) => s.type === "length" && s.severity === "warn")).toBe(true);
  });
});

describe("analyzeHeadline — Flesch readability", () => {
  it("computes flesch score", () => {
    const r = analyzeHeadline("The Cat Sat on the Mat");
    if ("error" in r) throw new Error("err");
    expect(r.fleschScore).toBeGreaterThan(0);
  });
});

describe("batchAnalyze", () => {
  it("processes multiple headlines", () => {
    const { results, errors } = batchAnalyze("10 Best Tips\nHow to Win");
    expect(results.length).toBe(2);
    expect(errors.length).toBe(0);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = analyzeHeadline("10 Best Tips");
    if ("error" in r) throw new Error("err");
    const csv = toCsv([r]);
    expect(csv.split("\n")[0]).toContain("Headline");
    expect(csv).toContain("SEO");
  });
});
