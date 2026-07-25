/**
 * Hashtag Density Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  parseHashtags, analyze, suggestTags, BANNED_HASHTAGS, normalizeTag,
  parseTrailingBlock, remainingBudget, analyzeBatch, batchToCsv, formatSummary,
  isValidHashtag, bannedHashtagCount, PLATFORM_LIMITS, ALL_PLATFORMS,
} from "./logic";

describe("parseHashtags", () => {
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
  it("handles CJK hashtags", () => {
    const r = parseHashtags("hello #标签");
    expect(r).toContain("#标签");
  });
});

describe("normalizeTag", () => {
  it("lowercases and strips non-alnum", () => {
    expect(normalizeTag("Hello!")).toBe("#hello");
  });
  it("removes leading # before re-adding", () => {
    expect(normalizeTag("#World")).toBe("#world");
  });
});

describe("analyze", () => {
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
    const r = analyze("a #b #c #d #e #f");
    expect(r.densityPct).toBeGreaterThan(0);
  });
  it("computes charsPerTag", () => {
    const r = analyze("a #b #c");
    expect(r.charsPerTag).toBeGreaterThan(0);
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
  it("computes platform status", () => {
    const r = analyze("#a #b #c #d #e #f");
    expect(r.platformStatus.length).toBe(5);
    const ig = r.platformStatus.find((p) => p.platform === "instagram")!;
    expect(ig.accepted).toBe(true);
  });
  it("flags platform rejection on too many tags", () => {
    const r = analyze(Array.from({ length: 6 }, (_, i) => `#tag${i}`).join(" "));
    const li = r.platformStatus.find((p) => p.platform === "linkedin")!;
    expect(li.accepted).toBe(false);
  });
  it("detects trailing block", () => {
    const r = analyze("hello world\n\n#a #b #c");
    expect(r.trailingBlockCount).toBe(3);
    expect(r.inlineCount).toBe(0);
  });
  it("detects inline hashtags", () => {
    const r = analyze("loving #sunset vibes today");
    expect(r.inlineCount).toBe(1);
  });
});

describe("parseTrailingBlock", () => {
  it("returns trailing block tags", () => {
    const r = parseTrailingBlock("hello\n\n#foo #bar");
    expect(r).toEqual(["#foo", "#bar"]);
  });
  it("returns empty when last line is prose", () => {
    expect(parseTrailingBlock("hello #foo world")).toEqual([]);
  });
});

describe("suggestTags", () => {
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
  it("ignores short words (<5 chars)", () => {
    const r = suggestTags("hi ok hello");
    expect(r).not.toContain("#hi");
    expect(r).not.toContain("#ok");
  });
});

describe("remainingBudget", () => {
  it("returns remaining tags for instagram", () => {
    expect(remainingBudget("#a #b #c", "instagram")).toBe(27);
  });
  it("returns 0 when over limit", () => {
    expect(remainingBudget(Array.from({ length: 35 }, (_, i) => `#t${i}`).join(" "), "instagram")).toBe(0);
  });
});

describe("analyzeBatch + batchToCsv", () => {
  it("analyzes multiple lines", () => {
    const r = analyzeBatch(["#a #b", "#c"]);
    expect(r.length).toBe(2);
    expect(r[0]!.totalHashtags).toBe(2);
  });
  it("emits CSV with header", () => {
    const lines = ["#a #b", "#c"];
    const csv = batchToCsv(analyzeBatch(lines), lines);
    expect(csv.split("\n")[0]).toBe("Input,Total,Unique,Duplicates,DensityPct,Banned,Warnings");
    expect(csv).toContain("#a #b");
  });
});

describe("formatSummary", () => {
  it("includes key metrics", () => {
    const a = analyze("#foo #bar #foo");
    const s = formatSummary(a);
    expect(s).toContain("Total hashtags: 3");
    expect(s).toContain("Platform status:");
    expect(s).toContain("Instagram");
  });
});

describe("isValidHashtag", () => {
  it("accepts valid hashtag", () => { expect(isValidHashtag("#hello")).toBe(true); });
  it("rejects missing #", () => { expect(isValidHashtag("hello")).toBe(false); });
  it("rejects empty after #", () => { expect(isValidHashtag("#")).toBe(false); });
});

describe("constants", () => {
  it("BANNED_HASHTAGS has 17 entries", () => { expect(bannedHashtagCount()).toBe(17); });
  it("BANNED_HASHTAGS includes common terms", () => {
    expect(BANNED_HASHTAGS).toContain("like4like");
    expect(BANNED_HASHTAGS).toContain("nude");
  });
  it("PLATFORM_LIMITS has 5 entries", () => { expect(PLATFORM_LIMITS.length).toBe(5); });
  it("ALL_PLATFORMS has 5 entries", () => { expect(ALL_PLATFORMS.length).toBe(5); });
});
