/**
 * Hashtag Density Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { parseHashtags, analyze, suggestTags, BANNED_HASHTAGS } from "./logic";

describe("hashtag parseHashtags", () => {
  it("extracts simple hashtags", () => {
    expect(parseHashtags("hello #world #foo")).toEqual(["#world", "#foo"]);
  });
  it("is case-insensitive (lowercased output)", () => {
    expect(parseHashtags("#Hello")).toEqual(["#hello"]);
  });
  it("returns empty for no hashtags", () => {
    expect(parseHashtags("no tags here")).toEqual([]);
  });
  it("handles unicode hashtags", () => {
    const r = parseHashtags("bonjour #café");
    expect(r).toContain("#café");
  });
});

describe("hashtag analyze", () => {
  it("counts total and unique hashtags", () => {
    const r = analyze("hello #foo #bar #foo");
    expect(r.totalHashtags).toBe(3);
    expect(r.uniqueHashtags).toBe(2);
  });
  it("detects duplicates", () => {
    const r = analyze("#a #a #b #b #b");
    const dup = r.duplicateHashtags.find((d) => d.tag === "#b");
    expect(dup?.count).toBe(3);
  });
  it("flags over-limit", () => {
    const r = analyze("#a #b #c #d #e", 3);
    expect(r.overLimit).toBe(true);
  });
  it("flags banned hashtags", () => {
    const r = analyze("check #like4like out");
    expect(r.bannedTags).toContain("#like4like");
  });
  it("computes density as percentage", () => {
    const r = analyze("a #b #c #d #e #f"); // 5 tags / 14 chars
    expect(r.densityPct).toBeGreaterThan(0);
  });
  it("produces warnings for problems", () => {
    const r = analyze("#like4like #a #b #c #d #e #f #g #h #i #j", 5);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("handles empty text", () => {
    const r = analyze("");
    expect(r.totalHashtags).toBe(0);
    expect(r.densityPct).toBe(0);
  });
});

describe("hashtag suggestTags", () => {
  it("suggests tags from words", () => {
    const r = suggestTags("hello wonderful world");
    expect(r).toContain("#wonderful");
    expect(r).toContain("#world");
  });
  it("does not suggest already-used hashtags", () => {
    const r = suggestTags("hello #wonderful world");
    expect(r).not.toContain("#wonderful");
  });
  it("does not suggest banned words", () => {
    const r = suggestTags("nude picture");
    expect(r).not.toContain("#nude");
  });
  it("limits to 10 suggestions", () => {
    const r = suggestTags("alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo");
    expect(r.length).toBeLessThanOrEqual(10);
  });
});

describe("hashtag BANNED_HASHTAGS", () => {
  it("includes common banned tags", () => {
    expect(BANNED_HASHTAGS).toContain("like4like");
    expect(BANNED_HASHTAGS).toContain("nude");
  });
});
