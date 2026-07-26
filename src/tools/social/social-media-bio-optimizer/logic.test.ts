import { describe, it, expect } from "vitest";
import {
  getPlatformById,
  getAllPlatforms,
  countChars,
  countWords,
  countHashtags,
  countEmojis,
  countLineBreaks,
  countURLs,
  extractKeywords,
  keywordDensity,
  suggestOptimizations,
  truncate,
  optimizeBio,
  splitLines,
  scoreBio,
  exportAnalysisText,
  PLATFORMS,
} from "./logic";

describe("social-media-bio-optimizer getAllPlatforms / getPlatformById", () => {
  it("returns at least 6 platforms", () => {
    expect(getAllPlatforms().length).toBeGreaterThanOrEqual(6);
  });
  it("finds instagram by id", () => {
    expect(getPlatformById("instagram")?.charLimit).toBe(150);
  });
  it("returns null for unknown id", () => {
    expect(getPlatformById("nope")).toBeNull();
  });
});

describe("social-media-bio-optimizer countChars", () => {
  it("counts emoji as single character", () => {
    expect(countChars("Hi 🎉")).toBe(4);
  });
  it("counts plain text correctly", () => {
    expect(countChars("Hello")).toBe(5);
  });
});

describe("social-media-bio-optimizer countWords", () => {
  it("counts words separated by whitespace", () => {
    expect(countWords("hello world foo")).toBe(3);
  });
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("social-media-bio-optimizer countHashtags", () => {
  it("extracts hashtags", () => {
    expect(countHashtags("hi #foo and #Bar")).toEqual(["#foo", "#bar"]);
  });
  it("returns empty when no hashtags", () => {
    expect(countHashtags("no tags here")).toEqual([]);
  });
});

describe("social-media-bio-optimizer countEmojis", () => {
  it("counts emoji", () => {
    expect(countEmojis("Hi 🎉🚀")).toBe(2);
  });
  it("returns 0 for plain text", () => {
    expect(countEmojis("no emoji")).toBe(0);
  });
});

describe("social-media-bio-optimizer countLineBreaks", () => {
  it("counts newlines", () => {
    expect(countLineBreaks("line1\nline2\nline3")).toBe(2);
  });
});

describe("social-media-bio-optimizer countURLs", () => {
  it("counts http and https URLs", () => {
    expect(countURLs("see https://a.com and http://b.com")).toBe(2);
  });
  it("returns 0 when no URL", () => {
    expect(countURLs("no links")).toBe(0);
  });
});

describe("social-media-bio-optimizer extractKeywords", () => {
  it("returns top keywords excluding stop words", () => {
    const k = extractKeywords("music music music guitar guitar drums", 3);
    expect(k[0].word).toBe("music");
    expect(k[0].count).toBe(3);
  });
  it("returns empty for only stop words", () => {
    expect(extractKeywords("the a an of")).toEqual([]);
  });
});

describe("social-media-bio-optimizer keywordDensity", () => {
  it("returns percentage of word occurrences", () => {
    expect(keywordDensity("music music drums", "music")).toBeCloseTo(66.67, 1);
  });
  it("returns 0 for empty text", () => {
    expect(keywordDensity("", "music")).toBe(0);
  });
});

describe("social-media-bio-optimizer suggestOptimizations", () => {
  it("warns when bio exceeds char limit", () => {
    const p = getPlatformById("tiktok")!;
    const tips = suggestOptimizations("x".repeat(120), p);
    expect(tips.some((t) => t.includes("over the"))).toBe(true);
  });
  it("warns when too many hashtags", () => {
    const p = getPlatformById("twitter")!;
    const tips = suggestOptimizations("#a #b #c #d #e", p);
    expect(tips.some((t) => t.includes("limit"))).toBe(true);
  });
  it("suggests emoji when recommended and none present", () => {
    const p = getPlatformById("instagram")!;
    const tips = suggestOptimizations("plain text bio", p);
    expect(tips.some((t) => t.includes("emoji"))).toBe(true);
  });
});

describe("social-media-bio-optimizer truncate", () => {
  it("truncates at word boundary", () => {
    expect(truncate("hello world foo bar", 12)).toMatch(/…$/);
  });
  it("returns text unchanged if under limit", () => {
    expect(truncate("short", 100)).toBe("short");
  });
});

describe("social-media-bio-optimizer optimizeBio", () => {
  it("collapses double spaces and trims", () => {
    const p = getPlatformById("instagram")!;
    const r = optimizeBio("  hi   there   ", p);
    expect(r.optimized).toBe("hi there");
  });
  it("truncates when over limit", () => {
    const p = getPlatformById("tiktok")!;
    const r = optimizeBio("x".repeat(120), p);
    expect(r.optimizedChars).toBeLessThanOrEqual(p.charLimit);
  });
});

describe("social-media-bio-optimizer splitLines", () => {
  it("splits by newlines and removes empties", () => {
    expect(splitLines("a\n\nb\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("social-media-bio-optimizer scoreBio", () => {
  it("returns score 0-100 with breakdown", () => {
    const p = getPlatformById("instagram")!;
    const s = scoreBio("Music producer 🎧 | beats | #hiphop #producer\ndm for collabs", p);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.breakdown.length).toBe(5);
  });
  it("low score for empty bio", () => {
    const p = getPlatformById("instagram")!;
    expect(scoreBio("", p).score).toBeLessThan(20);
  });
});

describe("social-media-bio-optimizer exportAnalysisText", () => {
  it("includes chars and platform name", () => {
    const p = getPlatformById("twitter")!;
    const txt = exportAnalysisText("Hi there #foo", p);
    expect(txt).toContain("Twitter");
    expect(txt).toContain("Characters:");
  });
});

describe("social-media-bio-optimizer PLATFORMS sanity", () => {
  it("every platform has positive charLimit", () => {
    expect(PLATFORMS.every((p) => p.charLimit > 0)).toBe(true);
  });
});
