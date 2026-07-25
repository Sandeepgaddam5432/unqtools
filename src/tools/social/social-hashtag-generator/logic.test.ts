import { describe, it, expect } from "vitest";
import {
  normalizeHashtag,
  parseKeywords,
  generateHashtags,
  formatHashtags,
  scoreRelevance,
  sortByRelevance,
  defaultOptions,
  PLATFORM_LIMITS,
} from "./logic";

describe("social-hashtag-generator normalizeHashtag", () => {
  it("lowercases and removes spaces", () => {
    expect(normalizeHashtag("Hello World")).toBe("helloworld");
  });

  it("supports camelCase option", () => {
    expect(normalizeHashtag("Hello World", true)).toBe("helloWorld");
  });

  it("removes punctuation", () => {
    expect(normalizeHashtag("hello! world?")).toBe("helloworld");
  });

  it("returns empty for blank input", () => {
    expect(normalizeHashtag("")).toBe("");
    expect(normalizeHashtag("   ")).toBe("");
  });
});

describe("social-hashtag-generator parseKeywords", () => {
  it("splits on commas", () => {
    expect(parseKeywords("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("splits on newlines and semicolons", () => {
    expect(parseKeywords("a\nb;c")).toEqual(["a", "b", "c"]);
  });

  it("returns empty for empty input", () => {
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("social-hashtag-generator generateHashtags", () => {
  it("generates base tags from keywords", () => {
    const tags = generateHashtags(["fitness", "running"], defaultOptions());
    expect(tags).toContain("fitness");
    expect(tags).toContain("running");
  });

  it("respects platform max", () => {
    const many = generateHashtags(
      Array.from({ length: 50 }, (_, i) => `kw${i}`),
      { ...defaultOptions(), platform: "twitter", includeNiche: false, includeTrending: false }
    );
    expect(many.length).toBeLessThanOrEqual(PLATFORM_LIMITS.twitter.maxHashtags);
  });

  it("includes niche variations when option enabled", () => {
    const tags = generateHashtags(["yoga"], { ...defaultOptions(), includeNiche: true });
    expect(tags.some((t) => t.startsWith("best"))).toBe(true);
    expect(tags.some((t) => t.startsWith("top"))).toBe(true);
  });

  it("includes trending when option enabled", () => {
    const tags = generateHashtags(["travel"], { ...defaultOptions(), includeTrending: true });
    expect(tags).toContain("viral");
    expect(tags).toContain("trending");
  });

  it("omits trending when option disabled", () => {
    const tags = generateHashtags(["travel"], { ...defaultOptions(), includeTrending: false });
    expect(tags).not.toContain("viral");
  });

  it("camelCase option affects niche tags", () => {
    const tags = generateHashtags(["yoga"], { ...defaultOptions(), includeNiche: true, camelCase: true });
    expect(tags.some((t) => t.startsWith("bestYoga"))).toBe(true);
  });
});

describe("social-hashtag-generator formatHashtags", () => {
  it("joins with # prefix", () => {
    expect(formatHashtags(["a", "b"], " ")).toBe("#a #b");
  });

  it("supports custom separator", () => {
    expect(formatHashtags(["a", "b"], "\n")).toBe("#a\n#b");
  });
});

describe("social-hashtag-generator scoreRelevance", () => {
  it("gives higher score to exact match", () => {
    expect(scoreRelevance("yoga", ["yoga"])).toBeGreaterThan(scoreRelevance("bestyoga", ["yoga"]));
  });

  it("gives partial credit for substring", () => {
    expect(scoreRelevance("yogalife", ["yoga"])).toBeGreaterThan(0);
  });

  it("returns 0 for unrelated tag", () => {
    expect(scoreRelevance("pizza", ["yoga"])).toBe(0);
  });
});

describe("social-hashtag-generator sortByRelevance", () => {
  it("sorts by relevance descending", () => {
    const sorted = sortByRelevance(["pizza", "yoga", "yogalife"], ["yoga"]);
    expect(sorted[0]).toBe("yoga");
  });
});

describe("social-hashtag-generator PLATFORM_LIMITS", () => {
  it("has all platforms", () => {
    expect(PLATFORM_LIMITS.instagram.maxHashtags).toBe(30);
    expect(PLATFORM_LIMITS.twitter.recommended).toBe(2);
  });

  it("default options has instagram", () => {
    expect(defaultOptions().platform).toBe("instagram");
  });
});
