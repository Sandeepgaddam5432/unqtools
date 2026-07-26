/**
 * Meta Description A/B Tester — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  estimatePixelWidth,
  truncateToPixels,
  tokenize,
  isKeywordAtFront,
  findLexicalMatches,
  scoreVariant,
  scoreAllVariants,
  generateDraftFromContent,
  parseBulkInput,
  auditBulk,
  findBoldRanges,
  encodePreset,
  decodePreset,
  META_LIMITS,
  type Variant,
} from "./logic";

const V1: Variant = { id: "a", label: "A", description: "Best running shoes 2026 — tested for 200+ miles. See our top picks now." };
const V2: Variant = { id: "b", label: "B", description: "Discover the best running shoes of 2026 with expert reviews and buying tips. Free guide." };
const V3: Variant = { id: "c", label: "C", description: "Best running shoes 2026 — tested for 200+ miles. See our top picks now." };

describe("estimatePixelWidth + truncateToPixels", () => {
  it("returns 0 for empty string", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("weights uppercase wider than lowercase", () => {
    expect(estimatePixelWidth("AAA")).toBeGreaterThan(estimatePixelWidth("aaa"));
  });
  it("truncates over-limit text with ellipsis", () => {
    const t = truncateToPixels("a".repeat(300), 100);
    expect(t.truncated).toBe(true);
    expect(t.text.endsWith("…")).toBe(true);
  });
  it("keeps short text as-is", () => {
    expect(truncateToPixels("hi", 1000).text).toBe("hi");
  });
});

describe("tokenize + isKeywordAtFront", () => {
  it("tokenizes to lowercase terms >=2 chars", () => {
    expect(tokenize("Best Running Shoes 2026")).toEqual(["best", "running", "shoes", "2026"]);
  });
  it("detects keyword at front", () => {
    expect(isKeywordAtFront("Best running shoes for men", "best running shoes")).toBe(true);
  });
  it("returns false when keyword absent", () => {
    expect(isKeywordAtFront("A totally different description", "running shoes")).toBe(false);
  });
  it("returns false for empty keyword", () => {
    expect(isKeywordAtFront("any text", "")).toBe(false);
  });
});

describe("findLexicalMatches", () => {
  it("detects power words", () => {
    const r = findLexicalMatches("Best free guide for new runners");
    expect(r.powerWords).toContain("best");
    expect(r.powerWords).toContain("free");
    expect(r.powerWords).toContain("new");
  });
  it("detects emotion words", () => {
    const r = findLexicalMatches("An amazing breakthrough in shoe design");
    expect(r.emotionWords).toContain("amazing");
    expect(r.emotionWords).toContain("breakthrough");
  });
  it("detects CTA", () => {
    expect(findLexicalMatches("Read more and discover the best").hasCta).toBe(true);
  });
  it("detects numbers", () => {
    expect(findLexicalMatches("Tested for 200 miles in 2026").hasNumber).toBe(true);
  });
});

describe("scoreVariant", () => {
  it("awards points for keyword at front", () => {
    const s = scoreVariant(V1, "best running shoes", [V1]);
    expect(s.keywordAtFront).toBe(true);
    expect(s.breakdown.some((b) => b.rule === "Keyword at front" && b.points === 25)).toBe(true);
  });
  it("deducts uniqueness for duplicates", () => {
    const s = scoreVariant(V1, "best running shoes", [V1, V3]);
    expect(s.uniqueness).toBe("duplicate");
    expect(s.status).toBe("bad");
  });
  it("caps score at 100", () => {
    const v: Variant = { id: "x", label: "X", description: "Best free ultimate guide 2026 — proven, exclusive, essential. Discover now! Save 50% today." };
    const s = scoreVariant(v, "best", [v]);
    expect(s.score).toBeLessThanOrEqual(100);
  });
  it("flags truncated descriptions", () => {
    const v: Variant = { id: "long", label: "Long", description: "x".repeat(250) };
    const s = scoreVariant(v, "", [v]);
    expect(s.truncatedDesktop).toBe(true);
    expect(s.truncatedMobile).toBe(true);
    expect(s.status).toBe("warn");
  });
});

describe("scoreAllVariants", () => {
  it("returns winner with highest score", () => {
    const r = scoreAllVariants([V1, V2], "best running shoes");
    if ("error" in r) throw new Error("should not error");
    expect(r.winner).toBeDefined();
    expect(r.winner!.score).toBeGreaterThanOrEqual(r.variants[0]!.score);
  });
  it("reports duplicate groups", () => {
    const r = scoreAllVariants([V1, V3], "best running shoes");
    if ("error" in r) throw new Error("should not error");
    expect(r.duplicates.length).toBe(1);
  });
  it("errors on empty list", () => {
    expect("error" in scoreAllVariants([], "kw")).toBe(true);
  });
  it("errors on too-long description", () => {
    const longV: Variant = { id: "l", label: "L", description: "x".repeat(META_LIMITS.hardCharMax + 1) };
    expect("error" in scoreAllVariants([longV], "")).toBe(true);
  });
  it("includes a recommendation string", () => {
    const r = scoreAllVariants([V1], "best running shoes");
    if ("error" in r) throw new Error("should not error");
    expect(r.recommendation.length).toBeGreaterThan(0);
  });
});

describe("generateDraftFromContent", () => {
  it("extracts a draft from page content", () => {
    const draft = generateDraftFromContent("Looking for the best running shoes? We tested 47 pairs in 2026. Here are our top picks for road, trail, and racing.", "best running shoes");
    expect(draft.length).toBeGreaterThan(0);
    expect(draft.length).toBeLessThanOrEqual(160);
  });
  it("prepends keyword when missing", () => {
    const draft = generateDraftFromContent("This is a generic page about various topics with no specific keyword mentioned.", "best running shoes");
    expect(draft.toLowerCase()).toContain("best running shoes");
  });
  it("returns empty for empty input", () => {
    expect(generateDraftFromContent("", "")).toBe("");
  });
});

describe("parseBulkInput + auditBulk", () => {
  it("parses pipe-separated url | description", () => {
    const rows = parseBulkInput("https://a.com | First description\nhttps://b.com | Second");
    expect(rows.length).toBe(2);
    expect(rows[0]!.url).toBe("https://a.com");
    expect(rows[0]!.description).toBe("First description");
  });
  it("parses url-only lines", () => {
    const rows = parseBulkInput("https://a.com\nhttps://b.com");
    expect(rows[0]!.description).toBe("");
  });
  it("audits missing descriptions", () => {
    const r = auditBulk([{ url: "https://a.com", description: "" }]);
    expect(r.missing).toBe(1);
    expect(r.rows[0]!.status).toBe("missing");
  });
  it("audits duplicates", () => {
    const r = auditBulk([
      { url: "https://a.com", description: "Same description here" },
      { url: "https://b.com", description: "Same description here" },
    ]);
    expect(r.duplicates).toBe(2);
  });
  it("audits too-long descriptions", () => {
    const r = auditBulk([{ url: "https://a.com", description: "x".repeat(200) }]);
    expect(r.tooLong).toBe(1);
  });
  it("audits too-short descriptions", () => {
    const r = auditBulk([{ url: "https://a.com", description: "short" }]);
    expect(r.tooShort).toBe(1);
  });
  it("marks ok rows as ok", () => {
    const r = auditBulk([{ url: "https://a.com", description: "A good description that meets the ideal length range of 70 to 160 characters easily." }]);
    expect(r.ok).toBe(1);
  });
  it("produces CSV with header", () => {
    const r = auditBulk([{ url: "https://a.com", description: "test" }]);
    expect(r.csv.startsWith("url,description,chars,pixels,status,note")).toBe(true);
  });
});

describe("findBoldRanges", () => {
  it("finds ranges for query terms", () => {
    const r = findBoldRanges("best running shoes for men", ["running", "shoes"]);
    expect(r.length).toBe(2);
  });
  it("merges overlapping", () => {
    const r = findBoldRanges("aaa", ["a", "aa"]);
    expect(r.length).toBe(1);
  });
});

describe("encodePreset / decodePreset roundtrip", () => {
  it("round-trips variants + keyword", () => {
    const encoded = encodePreset([V1, V2], "best running shoes");
    const decoded = decodePreset(encoded);
    expect("error" in decoded).toBe(false);
    if (!("error" in decoded)) {
      expect(decoded.variants.length).toBe(2);
      expect(decoded.keyword).toBe("best running shoes");
    }
  });
  it("errors on invalid input", () => {
    expect("error" in decodePreset("!!!not base64!!!")).toBe(true);
  });
});
