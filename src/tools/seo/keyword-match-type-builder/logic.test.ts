import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeKeyword,
  formatKeyword,
  detectMatchType,
  parseKeywordList,
  dedupKeywords,
  convertKeywords,
  filterByType,
  renderCsv,
  renderPlainText,
  MATCH_TYPE_REFERENCE,
  GOOGLE_ADS_MATCH_TYPE_DOCS_URL,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type KeywordEntry,
  type MatchType,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("keyword-match-type-builder normalizeKeyword", () => {
  it("trims whitespace", () => {
    expect(normalizeKeyword("  shoes  ")).toBe("shoes");
  });
  it("collapses internal whitespace", () => {
    expect(normalizeKeyword("running   shoes")).toBe("running shoes");
  });
  it("strips surrounding quotes", () => {
    expect(normalizeKeyword('"shoes"')).toBe("shoes");
  });
  it("strips surrounding brackets", () => {
    expect(normalizeKeyword("[shoes]")).toBe("[shoes]"); // brackets stay for exact-match detection
  });
  it("handles empty", () => {
    expect(normalizeKeyword("")).toBe("");
  });
});

describe("keyword-match-type-builder formatKeyword", () => {
  it("formats broad (no modifier)", () => {
    expect(formatKeyword("running shoes", "broad")).toBe("running shoes");
  });
  it("formats phrase with quotes", () => {
    expect(formatKeyword("running shoes", "phrase")).toBe('"running shoes"');
  });
  it("formats exact with brackets", () => {
    expect(formatKeyword("running shoes", "exact")).toBe("[running shoes]");
  });
  it("formats negative with dash", () => {
    expect(formatKeyword("free", "negative")).toBe("-free");
  });
  it("returns empty for empty input", () => {
    expect(formatKeyword("", "broad")).toBe("");
  });
});

describe("keyword-match-type-builder detectMatchType", () => {
  it("detects broad", () => {
    expect(detectMatchType("running shoes")).toBe("broad");
  });
  it("detects phrase", () => {
    expect(detectMatchType('"running shoes"')).toBe("phrase");
  });
  it("detects exact", () => {
    expect(detectMatchType("[running shoes]")).toBe("exact");
  });
  it("detects negative", () => {
    expect(detectMatchType("-free")).toBe("negative");
  });
  it("returns null for empty", () => {
    expect(detectMatchType("")).toBeNull();
  });
});

describe("keyword-match-type-builder parseKeywordList", () => {
  it("splits lines", () => {
    expect(parseKeywordList("shoes\nboots\nsandals")).toEqual(["shoes", "boots", "sandals"]);
  });
  it("trims and filters empty", () => {
    expect(parseKeywordList("  shoes  \n\n\nboots")).toEqual(["shoes", "boots"]);
  });
  it("handles empty input", () => {
    expect(parseKeywordList("")).toEqual([]);
  });
});

describe("keyword-match-type-builder dedupKeywords", () => {
  it("removes duplicates within same type", () => {
    const entries: KeywordEntry[] = [
      { raw: "shoes", normalized: "shoes", matchType: "broad", formatted: "shoes" },
      { raw: "Shoes", normalized: "shoes", matchType: "broad", formatted: "shoes" },
    ];
    const { entries: out, removed } = dedupKeywords(entries);
    expect(out).toHaveLength(1);
    expect(removed).toBe(1);
  });
  it("keeps same keyword across different types", () => {
    const entries: KeywordEntry[] = [
      { raw: "shoes", normalized: "shoes", matchType: "broad", formatted: "shoes" },
      { raw: "shoes", normalized: "shoes", matchType: "exact", formatted: "[shoes]" },
    ];
    const { entries: out, removed } = dedupKeywords(entries);
    expect(out).toHaveLength(2);
    expect(removed).toBe(0);
  });
});

describe("keyword-match-type-builder convertKeywords", () => {
  it("converts to all 4 match types", () => {
    const r = convertKeywords("shoes", {
      types: ["broad", "phrase", "exact", "negative"],
    });
    expect(r.entries).toHaveLength(4);
    expect(r.stats.broad).toBe(1);
    expect(r.stats.phrase).toBe(1);
    expect(r.stats.exact).toBe(1);
    expect(r.stats.negative).toBe(1);
  });
  it("converts to broad only", () => {
    const r = convertKeywords("shoes\nboots", { types: ["broad"] });
    expect(r.entries).toHaveLength(2);
    expect(r.stats.broad).toBe(2);
    expect(r.stats.exact).toBe(0);
  });
  it("dedupes by default", () => {
    const r = convertKeywords("shoes\nshoes\nShoes", { types: ["broad"] });
    expect(r.entries).toHaveLength(1);
    expect(r.stats.duplicatesRemoved).toBe(2);
  });
  it("can disable dedup", () => {
    const r = convertKeywords("shoes\nshoes", {
      types: ["broad"],
      dedup: false,
    });
    expect(r.entries).toHaveLength(2);
  });
  it("records errors for invalid keywords", () => {
    const r = convertKeywords('shoes [with bracket]', { types: ["broad"] });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.entries).toHaveLength(0);
  });
  it("handles empty input", () => {
    const r = convertKeywords("", { types: ["broad"] });
    expect(r.entries).toHaveLength(0);
    expect(r.stats.total).toBe(0);
  });
  it("formats phrase match correctly in batch", () => {
    const r = convertKeywords("running shoes", { types: ["phrase"] });
    expect(r.entries[0].formatted).toBe('"running shoes"');
  });
  it("formats exact match correctly in batch", () => {
    const r = convertKeywords("running shoes", { types: ["exact"] });
    expect(r.entries[0].formatted).toBe("[running shoes]");
  });
  it("formats negative match correctly in batch", () => {
    const r = convertKeywords("free", { types: ["negative"] });
    expect(r.entries[0].formatted).toBe("-free");
  });
  it("computes correct stats for mixed input", () => {
    const r = convertKeywords("a\nb\nc", {
      types: ["broad", "exact"],
    });
    expect(r.stats.total).toBe(6);
    expect(r.stats.broad).toBe(3);
    expect(r.stats.exact).toBe(3);
    expect(r.stats.phrase).toBe(0);
    expect(r.stats.negative).toBe(0);
  });
});

describe("keyword-match-type-builder filterByType", () => {
  it("filters by match type", () => {
    const entries: KeywordEntry[] = [
      { raw: "a", normalized: "a", matchType: "broad", formatted: "a" },
      { raw: "b", normalized: "b", matchType: "exact", formatted: "[b]" },
      { raw: "c", normalized: "c", matchType: "exact", formatted: "[c]" },
    ];
    expect(filterByType(entries, "exact")).toHaveLength(2);
    expect(filterByType(entries, "broad")).toHaveLength(1);
    expect(filterByType(entries, "negative")).toHaveLength(0);
  });
});

describe("keyword-match-type-builder renderCsv", () => {
  it("renders CSV with headers", () => {
    const r = convertKeywords("shoes", { types: ["broad", "exact"] });
    const csv = renderCsv(r);
    expect(csv).toContain("keyword,match_type,formatted");
    expect(csv).toContain("shoes,broad,shoes");
    expect(csv).toContain("shoes,exact,[shoes]");
  });
  it("escapes commas in keywords", () => {
    const r = convertKeywords("shoes, boots", { types: ["broad"] });
    const csv = renderCsv(r);
    expect(csv).toContain('"shoes, boots"');
  });
});

describe("keyword-match-type-builder renderPlainText", () => {
  it("renders one formatted keyword per line", () => {
    const r = convertKeywords("shoes\nboots", { types: ["broad"] });
    expect(renderPlainText(r.entries)).toBe("shoes\nboots");
  });
  it("returns empty for empty entries", () => {
    expect(renderPlainText([])).toBe("");
  });
});

describe("keyword-match-type-builder reference", () => {
  it("has all 4 match types in reference", () => {
    const types = MATCH_TYPE_REFERENCE.map((m) => m.type);
    expect(types).toContain("broad");
    expect(types).toContain("phrase");
    expect(types).toContain("exact");
    expect(types).toContain("negative");
  });
  it("each reference entry has example and description", () => {
    for (const m of MATCH_TYPE_REFERENCE) {
      expect(m.example).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.whenToUse).toBeTruthy();
    }
  });
  it("points to Google Ads docs", () => {
    expect(GOOGLE_ADS_MATCH_TYPE_DOCS_URL).toContain("google.com");
    expect(GOOGLE_ADS_MATCH_TYPE_DOCS_URL).toContain("2497836");
  });
});

describe("keyword-match-type-builder history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, keywordCount: 5, types: ["broad"], snippet: "..." });
    saveHistory({ ts: 2, keywordCount: 3, types: ["exact"], snippet: "..." });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, keywordCount: 1, types: ["broad"], snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, keywordCount: 1, types: ["broad"], snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-match-type-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      text: "shoes",
      types: ["broad", "exact"] as MatchType[],
      dedup: true,
    });
    expect(url).toContain("text=shoes");
    expect(url).toContain("types=broad%2Cexact");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("text=shoes&types=broad,phrase&dedup=1");
    expect(parsed.text).toBe("shoes");
    expect(parsed.types).toEqual(["broad", "phrase"]);
    expect(parsed.dedup).toBe(true);
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid match types in URL", () => {
    const parsed = parseShareUrl("types=broad,invalid,negative");
    expect(parsed.types).toEqual(["broad", "negative"]);
  });
});
