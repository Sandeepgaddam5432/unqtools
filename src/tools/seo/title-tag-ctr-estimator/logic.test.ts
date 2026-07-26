/**
 * Title Tag Optimizer & CTR Estimator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  estimatePixelWidth,
  truncateToPixels,
  tokenize,
  isKeywordAtFront,
  findLexicalMatches,
  detectBrandSuffix,
  appendBrandSuffix,
  scoreTitle,
  scoreAllTitles,
  estimateCtrAtPosition,
  parseBulkInput,
  auditBulk,
  findBoldRanges,
  encodePreset,
  decodePreset,
  DEFAULT_CTR_CURVE,
  TITLE_LIMITS,
  type TitleVariant,
  type BrandSeparator,
} from "./logic";

const V1: TitleVariant = { id: "a", label: "A", title: "Best Running Shoes 2026 — Reviews & Buying Guide" };
const V2: TitleVariant = { id: "b", label: "B", title: "Best Running Shoes 2026: Top Picks for Road & Trail | RunFit" };
const V3: TitleVariant = { id: "c", label: "C", title: "Best Running Shoes 2026 — Reviews & Buying Guide" };

describe("estimatePixelWidth + truncateToPixels", () => {
  it("returns 0 for empty string", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("weights uppercase wider than lowercase", () => {
    expect(estimatePixelWidth("AAA")).toBeGreaterThan(estimatePixelWidth("aaa"));
  });
  it("truncates over-limit text with ellipsis", () => {
    const t = truncateToPixels("a".repeat(200), 100);
    expect(t.truncated).toBe(true);
    expect(t.text.endsWith("…")).toBe(true);
  });
  it("keeps short text as-is", () => {
    expect(truncateToPixels("hi", 1000).text).toBe("hi");
  });
});

describe("tokenize + isKeywordAtFront", () => {
  it("tokenizes lowercase terms >=2 chars", () => {
    expect(tokenize("Best Running Shoes 2026")).toEqual(["best", "running", "shoes", "2026"]);
  });
  it("detects keyword at front", () => {
    expect(isKeywordAtFront("Best running shoes for men", "best running shoes")).toBe(true);
  });
  it("returns false when keyword absent", () => {
    expect(isKeywordAtFront("A totally different title", "running shoes")).toBe(false);
  });
  it("returns false for empty keyword", () => {
    expect(isKeywordAtFront("any title", "")).toBe(false);
  });
});

describe("findLexicalMatches", () => {
  it("detects power words", () => {
    expect(findLexicalMatches("Best free guide 2026").powerWords).toContain("best");
  });
  it("detects emotion words", () => {
    expect(findLexicalMatches("An amazing breakthrough").emotionWords).toContain("amazing");
  });
  it("detects numbers", () => {
    expect(findLexicalMatches("Top 10 picks 2026").hasNumber).toBe(true);
  });
});

describe("detectBrandSuffix + appendBrandSuffix", () => {
  it("detects pipe separator", () => {
    const r = detectBrandSuffix("Best Shoes | RunFit");
    expect(r.has).toBe(true);
    expect(r.separator).toBe("pipe");
    expect(r.brand).toBe("RunFit");
  });
  it("detects em-dash separator", () => {
    const r = detectBrandSuffix("Best Shoes — RunFit");
    expect(r.has).toBe(true);
    expect(r.separator).toBe("em-dash");
  });
  it("detects colon separator", () => {
    const r = detectBrandSuffix("Best Shoes: RunFit");
    expect(r.has).toBe(true);
    expect(r.separator).toBe("colon");
  });
  it("returns none when no suffix", () => {
    const r = detectBrandSuffix("Best Shoes for Running");
    expect(r.has).toBe(false);
    expect(r.separator).toBe("none");
  });
  it("appends brand suffix with pipe", () => {
    const t: BrandSeparator = "pipe";
    expect(appendBrandSuffix("Best Shoes", "RunFit", t)).toBe("Best Shoes | RunFit");
  });
  it("appends brand suffix with em-dash", () => {
    expect(appendBrandSuffix("Best Shoes", "RunFit", "em-dash")).toBe("Best Shoes — RunFit");
  });
  it("returns title unchanged when brand empty", () => {
    expect(appendBrandSuffix("Best Shoes", "", "pipe")).toBe("Best Shoes");
  });
});

describe("scoreTitle", () => {
  it("awards points for keyword at front", () => {
    const s = scoreTitle(V1, "best running shoes", [V1]);
    expect(s.keywordAtFront).toBe(true);
    expect(s.breakdown.some((b) => b.rule === "Keyword at front" && b.points === 25)).toBe(true);
  });
  it("deducts uniqueness for duplicates", () => {
    const s = scoreTitle(V1, "best running shoes", [V1, V3]);
    expect(s.uniqueness).toBe("duplicate");
    expect(s.status).toBe("bad");
  });
  it("detects brand suffix", () => {
    const s = scoreTitle(V2, "best running shoes", [V2]);
    expect(s.hasBrandSuffix).toBe(true);
    expect(s.breakdown.some((b) => b.rule === "Brand suffix")).toBe(true);
  });
  it("caps quality score at 100", () => {
    const v: TitleVariant = { id: "x", label: "X", title: "Best Free Ultimate 2026 Guide — Proven, Exclusive, Essential | Brand" };
    const s = scoreTitle(v, "best", [v]);
    expect(s.qualityScore).toBeLessThanOrEqual(100);
  });
  it("flags truncation when over pixel limit", () => {
    const v: TitleVariant = { id: "long", label: "L", title: "A".repeat(150) };
    const s = scoreTitle(v, "", [v]);
    expect(s.truncatedDesktop).toBe(true);
    expect(s.status).toBe("warn");
  });
  it("computes CTR for all 10 positions", () => {
    const s = scoreTitle(V1, "best running shoes", [V1]);
    expect(s.ctrByPosition.length).toBe(10);
    expect(s.ctrByPosition[0]!.position).toBe(1);
    expect(s.ctrByPosition[0]!.adjustedCtr).toBeGreaterThan(0);
  });
});

describe("scoreAllTitles", () => {
  it("returns winner with highest score", () => {
    const r = scoreAllTitles([V1, V2], "best running shoes");
    if ("error" in r) throw new Error("should not error");
    expect(r.winner).toBeDefined();
    expect(r.winner!.qualityScore).toBeGreaterThanOrEqual(r.variants[0]!.qualityScore);
  });
  it("reports duplicates", () => {
    const r = scoreAllTitles([V1, V3], "best running shoes");
    if ("error" in r) throw new Error("should not error");
    expect(r.duplicates.length).toBe(1);
  });
  it("errors on empty list", () => {
    expect("error" in scoreAllTitles([], "kw")).toBe(true);
  });
  it("errors on too-long title", () => {
    const longV: TitleVariant = { id: "l", label: "L", title: "x".repeat(TITLE_LIMITS.hardCharMax + 1) };
    expect("error" in scoreAllTitles([longV], "")).toBe(true);
  });
});

describe("estimateCtrAtPosition", () => {
  it("returns adjusted CTR for position 1", () => {
    const s = scoreTitle(V1, "best running shoes", [V1]);
    expect(estimateCtrAtPosition(s, 1)).toBeCloseTo(s.ctrByPosition[0]!.adjustedCtr, 2);
  });
  it("clamps out-of-range positions", () => {
    const s = scoreTitle(V1, "best running shoes", [V1]);
    expect(estimateCtrAtPosition(s, 99)).toBe(s.ctrByPosition[9]!.adjustedCtr);
    expect(estimateCtrAtPosition(s, -5)).toBe(s.ctrByPosition[0]!.adjustedCtr);
  });
  it("higher quality score yields higher CTR at same position", () => {
    const low = scoreTitle({ id: "low", label: "Low", title: "ok" }, "", [{ id: "low", label: "Low", title: "ok" }]);
    const high = scoreTitle(V1, "best running shoes", [V1]);
    expect(estimateCtrAtPosition(high, 1)).toBeGreaterThan(estimateCtrAtPosition(low, 1));
  });
});

describe("parseBulkInput + auditBulk", () => {
  it("parses pipe-separated url | title", () => {
    const rows = parseBulkInput("https://a.com | Best Title\nhttps://b.com | Second");
    expect(rows.length).toBe(2);
    expect(rows[0]!.url).toBe("https://a.com");
  });
  it("parses url-only lines", () => {
    expect(parseBulkInput("https://a.com")[0]!.title).toBe("");
  });
  it("audits missing titles", () => {
    const r = auditBulk([{ url: "https://a.com", title: "" }]);
    expect(r.missing).toBe(1);
  });
  it("audits duplicates", () => {
    const r = auditBulk([
      { url: "https://a.com", title: "Same title" },
      { url: "https://b.com", title: "Same title" },
    ]);
    expect(r.duplicates).toBe(2);
  });
  it("audits too-long titles", () => {
    const r = auditBulk([{ url: "https://a.com", title: "x".repeat(100) }]);
    expect(r.tooLong).toBe(1);
  });
  it("audits too-short titles", () => {
    const r = auditBulk([{ url: "https://a.com", title: "ok" }]);
    expect(r.tooShort).toBe(1);
  });
  it("marks ok rows as ok", () => {
    const r = auditBulk([{ url: "https://a.com", title: "A great page title that is within range" }]);
    expect(r.ok).toBe(1);
  });
  it("produces CSV with header", () => {
    expect(auditBulk([{ url: "https://a.com", title: "test" }]).csv.startsWith("url,title,chars,pixels,status,note")).toBe(true);
  });
});

describe("findBoldRanges", () => {
  it("finds ranges for query terms", () => {
    expect(findBoldRanges("best running shoes", ["running", "shoes"]).length).toBe(2);
  });
  it("merges overlapping", () => {
    expect(findBoldRanges("aaa", ["a", "aa"]).length).toBe(1);
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

describe("DEFAULT_CTR_CURVE", () => {
  it("has 10 positions", () => {
    expect(DEFAULT_CTR_CURVE.length).toBe(10);
  });
  it("is monotonically decreasing", () => {
    for (let i = 1; i < DEFAULT_CTR_CURVE.length; i++) {
      expect(DEFAULT_CTR_CURVE[i]).toBeLessThanOrEqual(DEFAULT_CTR_CURVE[i - 1]!);
    }
  });
});
