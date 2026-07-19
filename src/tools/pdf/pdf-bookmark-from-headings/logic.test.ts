import { describe, it, expect, beforeEach } from "vitest";
import {
  DETECTION_METHODS,
  DETECTION_METHOD_LABELS,
  DEFAULT_OPTIONS,
  DEFAULT_THRESHOLDS,
  HEADING_LEVELS,
  HEADING_LEVEL_LABELS,
  normalizeText,
  cleanHeadingText,
  classifyFontSize,
  isBoldText,
  parseTextPatterns,
  matchRegexPatterns,
  detectHeadings,
  buildBookmarkTree,
  formatBookmarkTitle,
  validateBookmarkLevel,
  extractHeadingCoordinate,
  detectOrphanHeadings,
  removeDuplicateBookmarks,
  analyzeHeadingDistribution,
  computeSummaryStats,
  validateBookmarkDestinations,
  flattenTree,
  renderTextTree,
  renderCsvTree,
  renderJsonTree,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type DetectionMethod,
  type HeadingLevel,
  type TextItem,
  type FontSizeThresholds,
  type BookmarkOptions,
  type HistoryEntry,
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

function item(
  text: string,
  fontSize: number,
  pageNumber: number,
  overrides: Partial<TextItem> = {},
): TextItem {
  return {
    text,
    fontSize,
    isBold: false,
    pageNumber,
    x: 50,
    y: 700,
    ...overrides,
  };
}

function opts(overrides: Partial<BookmarkOptions> = {}): BookmarkOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings constants", () => {
  it("has 4 detection methods", () => {
    expect(DETECTION_METHODS).toHaveLength(4);
    expect(DETECTION_METHODS).toContain("by-font-size");
    expect(DETECTION_METHODS).toContain("by-bold-text");
    expect(DETECTION_METHODS).toContain("by-text-pattern");
    expect(DETECTION_METHODS).toContain("manual");
  });

  it("has 4 method labels", () => {
    expect(Object.keys(DETECTION_METHOD_LABELS)).toHaveLength(4);
  });

  it("has 3 heading levels and labels", () => {
    expect(HEADING_LEVELS).toEqual([1, 2, 3]);
    expect(Object.keys(HEADING_LEVEL_LABELS)).toHaveLength(3);
  });

  it("has sensible default thresholds", () => {
    expect(DEFAULT_THRESHOLDS.h1).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.h2);
    expect(DEFAULT_THRESHOLDS.h2).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.h3);
  });

  it("default options are valid", () => {
    expect(DEFAULT_OPTIONS.detectionMethod).toBe("by-font-size");
    expect(DEFAULT_OPTIONS.maxHeadingLevel).toBe(3);
    expect(DEFAULT_OPTIONS.includePageNumbers).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings normalizeText / cleanHeadingText", () => {
  it("normalizes CRLF to LF", () => {
    expect(normalizeText("a\r\nb")).toBe("a\nb");
  });

  it("collapses whitespace", () => {
    expect(cleanHeadingText("  Hello   World  ")).toBe("Hello World");
  });

  it("returns empty for empty input", () => {
    expect(cleanHeadingText("")).toBe("");
  });

  it("handles tabs and newlines inside text", () => {
    expect(cleanHeadingText("Hello\t\nWorld")).toBe("Hello World");
  });
});

// ---------------------------------------------------------------------------
// Font-size classifier
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings classifyFontSize", () => {
  const t: FontSizeThresholds = { h1: 24, h2: 18, h3: 14 };

  it("classifies H1 at threshold", () => {
    expect(classifyFontSize(24, t)).toBe(1);
    expect(classifyFontSize(30, t)).toBe(1);
  });
  it("classifies H2 between h2 and h1", () => {
    expect(classifyFontSize(18, t)).toBe(2);
    expect(classifyFontSize(22, t)).toBe(2);
  });
  it("classifies H3 between h3 and h2", () => {
    expect(classifyFontSize(14, t)).toBe(3);
    expect(classifyFontSize(17, t)).toBe(3);
  });
  it("returns null below h3", () => {
    expect(classifyFontSize(12, t)).toBeNull();
    expect(classifyFontSize(8, t)).toBeNull();
  });
  it("returns null for non-positive sizes", () => {
    expect(classifyFontSize(0, t)).toBeNull();
    expect(classifyFontSize(-5, t)).toBeNull();
    expect(classifyFontSize(NaN, t)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bold text detector
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings isBoldText", () => {
  it("returns true for bold items", () => {
    expect(isBoldText(item("x", 12, 1, { isBold: true }))).toBe(true);
  });
  it("returns false for non-bold items", () => {
    expect(isBoldText(item("x", 12, 1, { isBold: false }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regex pattern matcher
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings parseTextPatterns", () => {
  it("parses bare regex as H1", () => {
    const r = parseTextPatterns("^Chapter");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toHaveLength(1);
      expect(r.output[0].level).toBe(1);
      expect(r.output[0].regex.test("Chapter 1")).toBe(true);
    }
  });

  it("parses H1:/H2:/H3: prefixes", () => {
    const r = parseTextPatterns("H1: ^Chapter\nH2: ^\\d+\\.\\d+\nH3: ^Note:");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toHaveLength(3);
      expect(r.output[0].level).toBe(1);
      expect(r.output[1].level).toBe(2);
      expect(r.output[2].level).toBe(3);
    }
  });

  it("parses 1:/2:/3: numeric prefixes", () => {
    const r = parseTextPatterns("2: ^Section");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output[0].level).toBe(2);
  });

  it("skips blank lines", () => {
    const r = parseTextPatterns("\nH1: ^A\n\nH2: ^B\n");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(2);
  });

  it("returns error for invalid regex", () => {
    const r = parseTextPatterns("[unclosed");
    expect(r.ok).toBe(false);
  });

  it("returns empty for empty input", () => {
    const r = parseTextPatterns("");
    expect(r.ok ? r.output : []).toEqual([]);
  });
});

describe("pdf-bookmark-from-headings matchRegexPatterns", () => {
  const parsedPatterns = parseTextPatterns("H1: ^Chapter\nH2: ^\\d+\\.\\d+ ");
  if (!parsedPatterns.ok) throw new Error("test setup failed: bad patterns");
  const patterns = parsedPatterns.output;

  it("matches H1", () => {
    expect(matchRegexPatterns("Chapter 1: Intro", patterns)).toBe(1);
  });

  it("matches H2", () => {
    expect(matchRegexPatterns("1.1 Background ", patterns)).toBe(2);
  });

  it("returns null when no pattern matches", () => {
    expect(matchRegexPatterns("Just body text", patterns)).toBeNull();
  });

  it("returns null for empty patterns list", () => {
    expect(matchRegexPatterns("Chapter 1", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Heading detection
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings detectHeadings", () => {
  it("detects by font size", () => {
    const items = [
      item("Chapter 1", 28, 1), // H1
      item("Body text", 11, 1), // ignored
      item("Section 1.1", 20, 1), // H2
    ];
    const r = detectHeadings(items, "by-font-size", { thresholds: DEFAULT_THRESHOLDS });
    expect(r).toHaveLength(2);
    expect(r[0].level).toBe(1);
    expect(r[1].level).toBe(2);
  });

  it("detects by bold text", () => {
    const items = [
      // fontSize 12 is below all thresholds; bold + >= minBoldSize(14) → fallback H2
      item("Heading", 12, 1, { isBold: true }),
      item("Body", 12, 1, { isBold: false }), // not bold
      item("Title", 28, 1, { isBold: true }), // H1 (28 >= h1 threshold 24)
    ];
    const r = detectHeadings(items, "by-bold-text", { thresholds: DEFAULT_THRESHOLDS, minBoldSize: 10 });
    expect(r).toHaveLength(2);
    expect(r.find((h) => h.text === "Title")?.level).toBe(1);
    expect(r.find((h) => h.text === "Heading")?.level).toBe(2);
  });

  it("bold detection respects minBoldSize cutoff", () => {
    const items = [
      item("Small", 12, 1, { isBold: true }), // 12 < minBoldSize(14) → skipped
      item("Big", 16, 1, { isBold: true }), // 16 >= 14 → H3 (16 >= h3=14)
    ];
    const r = detectHeadings(items, "by-bold-text", { thresholds: DEFAULT_THRESHOLDS, minBoldSize: 14 });
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe("Big");
    expect(r[0].level).toBe(3);
  });

  it("detects by text pattern", () => {
    const parsedPatterns = parseTextPatterns("H1: ^Chapter\nH2: ^Section");
    if (!parsedPatterns.ok) throw new Error("test setup failed: bad patterns");
    const patterns = parsedPatterns.output;
    const items = [
      item("Chapter 1", 12, 1),
      item("Section A", 12, 2),
      item("Body text", 12, 2),
    ];
    const r = detectHeadings(items, "by-text-pattern", { patterns });
    expect(r).toHaveLength(2);
    expect(r[0].level).toBe(1);
    expect(r[1].level).toBe(2);
  });

  it("manual method returns no headings", () => {
    const items = [item("Chapter", 28, 1)];
    expect(detectHeadings(items, "manual", {})).toEqual([]);
  });

  it("skips empty text", () => {
    const items = [item("   ", 28, 1)];
    expect(detectHeadings(items, "by-font-size", { thresholds: DEFAULT_THRESHOLDS })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bookmark tree builder
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings buildBookmarkTree", () => {
  it("builds a flat tree of H1s", () => {
    const headings = [
      { text: "A", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 },
      { text: "B", level: 1 as HeadingLevel, pageNumber: 2, fontSize: 24, isBold: false, x: 0, y: 0 },
    ];
    const tree = buildBookmarkTree(headings, 3);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(0);
  });

  it("nests H2 under H1", () => {
    const headings = [
      { text: "H1a", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 },
      { text: "H2a", level: 2 as HeadingLevel, pageNumber: 1, fontSize: 18, isBold: false, x: 0, y: 0 },
      { text: "H2b", level: 2 as HeadingLevel, pageNumber: 2, fontSize: 18, isBold: false, x: 0, y: 0 },
    ];
    const tree = buildBookmarkTree(headings, 3);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
  });

  it("nests H3 under H2 under H1", () => {
    const headings = [
      { text: "H1", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 },
      { text: "H2", level: 2 as HeadingLevel, pageNumber: 1, fontSize: 18, isBold: false, x: 0, y: 0 },
      { text: "H3", level: 3 as HeadingLevel, pageNumber: 1, fontSize: 14, isBold: false, x: 0, y: 0 },
    ];
    const tree = buildBookmarkTree(headings, 3);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].title).toBe("H3");
  });

  it("respects maxLevel filter", () => {
    const headings = [
      { text: "H1", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 },
      { text: "H2", level: 2 as HeadingLevel, pageNumber: 1, fontSize: 18, isBold: false, x: 0, y: 0 },
      { text: "H3", level: 3 as HeadingLevel, pageNumber: 1, fontSize: 14, isBold: false, x: 0, y: 0 },
    ];
    const tree = buildBookmarkTree(headings, 2);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe("H2");
  });

  it("handles H2 appearing before any H1 (becomes root)", () => {
    const headings = [
      { text: "H2-orphan", level: 2 as HeadingLevel, pageNumber: 1, fontSize: 18, isBold: false, x: 0, y: 0 },
      { text: "H1", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 },
    ];
    const tree = buildBookmarkTree(headings, 3);
    expect(tree).toHaveLength(2);
  });

  it("handles empty input", () => {
    expect(buildBookmarkTree([], 3)).toEqual([]);
  });
});

describe("pdf-bookmark-from-headings formatBookmarkTitle", () => {
  it("cleans heading text", () => {
    const h = { text: "  Hello   World  ", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 };
    expect(formatBookmarkTitle(h)).toBe("Hello World");
  });
});

describe("pdf-bookmark-from-headings validateBookmarkLevel", () => {
  it("accepts valid levels", () => {
    expect(validateBookmarkLevel(1, 3).ok).toBe(true);
    expect(validateBookmarkLevel(2, 3).ok).toBe(true);
    expect(validateBookmarkLevel(3, 3).ok).toBe(true);
  });
  it("rejects level above max", () => {
    expect(validateBookmarkLevel(3, 2).ok).toBe(false);
  });
  it("rejects invalid level", () => {
    expect(validateBookmarkLevel(0, 3).ok).toBe(false);
    expect(validateBookmarkLevel(4, 3).ok).toBe(false);
  });
});

describe("pdf-bookmark-from-headings extractHeadingCoordinate", () => {
  it("extracts x and y", () => {
    const i = item("x", 12, 1, { x: 100, y: 200 });
    expect(extractHeadingCoordinate(i)).toEqual({ x: 100, y: 200 });
  });
});

// ---------------------------------------------------------------------------
// Orphan & duplicate detection
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings detectOrphanHeadings", () => {
  it("detects H3 without H2 parent", () => {
    // Tree: H1 -> H3 (skipping H2)
    const tree: BookmarkNodeT[] = [
      {
        title: "H1", level: 1, page: 1, x: 0, y: 0,
        children: [
          { title: "H3", level: 3, page: 1, x: 0, y: 0, children: [] },
        ],
      },
    ];
    const orphans = detectOrphanHeadings(tree);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].node.title).toBe("H3");
  });

  it("returns empty for clean hierarchy", () => {
    const tree: BookmarkNodeT[] = [
      {
        title: "H1", level: 1, page: 1, x: 0, y: 0,
        children: [
          { title: "H2", level: 2, page: 1, x: 0, y: 0, children: [
            { title: "H3", level: 3, page: 1, x: 0, y: 0, children: [] },
          ] },
        ],
      },
    ];
    expect(detectOrphanHeadings(tree)).toEqual([]);
  });

  it("detects top-level H2 as orphan", () => {
    const tree: BookmarkNodeT[] = [
      { title: "H2", level: 2, page: 1, x: 0, y: 0, children: [] },
    ];
    expect(detectOrphanHeadings(tree)).toHaveLength(1);
  });
});

describe("pdf-bookmark-from-headings removeDuplicateBookmarks", () => {
  it("removes same-level + page + title duplicates", () => {
    const tree: BookmarkNodeT[] = [
      { title: "Dup", level: 1, page: 1, x: 0, y: 0, children: [] },
      { title: "dup", level: 1, page: 1, x: 0, y: 0, children: [] }, // case-insensitive
      { title: "Unique", level: 1, page: 1, x: 0, y: 0, children: [] },
    ];
    const r = removeDuplicateBookmarks(tree);
    expect(r.tree).toHaveLength(2);
    expect(r.removed).toBe(1);
  });

  it("does not dedupe across levels", () => {
    const tree: BookmarkNodeT[] = [
      { title: "Same", level: 1, page: 1, x: 0, y: 0, children: [] },
      { title: "Same", level: 2, page: 1, x: 0, y: 0, children: [] },
    ];
    const r = removeDuplicateBookmarks(tree);
    expect(r.removed).toBe(0);
  });

  it("does not dedupe across pages", () => {
    const tree: BookmarkNodeT[] = [
      { title: "Same", level: 1, page: 1, x: 0, y: 0, children: [] },
      { title: "Same", level: 1, page: 2, x: 0, y: 0, children: [] },
    ];
    const r = removeDuplicateBookmarks(tree);
    expect(r.removed).toBe(0);
  });

  it("dedupes nested children too", () => {
    const tree: BookmarkNodeT[] = [
      {
        title: "A", level: 1, page: 1, x: 0, y: 0,
        children: [
          { title: "B", level: 2, page: 1, x: 0, y: 0, children: [] },
          { title: "B", level: 2, page: 1, x: 0, y: 0, children: [] },
        ],
      },
    ];
    const r = removeDuplicateBookmarks(tree);
    expect(r.removed).toBe(1);
    expect(r.tree[0].children).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Distribution & summary
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings analyzeHeadingDistribution", () => {
  it("counts headings per page", () => {
    const headings = [
      { text: "A", level: 1 as HeadingLevel, pageNumber: 1, fontSize: 24, isBold: false, x: 0, y: 0 },
      { text: "B", level: 2 as HeadingLevel, pageNumber: 1, fontSize: 18, isBold: false, x: 0, y: 0 },
      { text: "C", level: 1 as HeadingLevel, pageNumber: 3, fontSize: 24, isBold: false, x: 0, y: 0 },
    ];
    const dist = analyzeHeadingDistribution(headings);
    expect(dist[1]).toBe(2);
    expect(dist[3]).toBe(1);
    expect(dist[2]).toBeUndefined();
  });

  it("returns empty object for empty input", () => {
    expect(analyzeHeadingDistribution([])).toEqual({});
  });
});

describe("pdf-bookmark-from-headings computeSummaryStats", () => {
  it("computes stats", () => {
    const tree: BookmarkNodeT[] = [
      {
        title: "H1", level: 1, page: 1, x: 0, y: 0,
        children: [
          { title: "H2", level: 2, page: 1, x: 0, y: 0, children: [
            { title: "H3", level: 3, page: 1, x: 0, y: 0, children: [] },
          ] },
        ],
      },
    ];
    const stats = computeSummaryStats(tree);
    expect(stats.totalBookmarks).toBe(3);
    expect(stats.byLevel[1]).toBe(1);
    expect(stats.byLevel[2]).toBe(1);
    expect(stats.byLevel[3]).toBe(1);
    expect(stats.byPage[1]).toBe(3);
    expect(stats.maxDepth).toBe(3);
    expect(stats.orphanCount).toBe(0);
  });

  it("reports orphan count", () => {
    const tree: BookmarkNodeT[] = [
      {
        title: "H1", level: 1, page: 1, x: 0, y: 0,
        children: [
          { title: "H3", level: 3, page: 1, x: 0, y: 0, children: [] }, // orphan (H2 skipped)
        ],
      },
    ];
    const stats = computeSummaryStats(tree);
    expect(stats.orphanCount).toBe(1);
  });

  it("handles empty tree", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalBookmarks).toBe(0);
    expect(stats.maxDepth).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Destination validation
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings validateBookmarkDestinations", () => {
  it("accepts valid destinations", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 1, x: 0, y: 0, children: [
        { title: "B", level: 2, page: 5, x: 0, y: 0, children: [] },
      ] },
    ];
    expect(validateBookmarkDestinations(tree, 10).ok).toBe(true);
  });

  it("rejects out-of-range page", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 11, x: 0, y: 0, children: [] },
    ];
    expect(validateBookmarkDestinations(tree, 10).ok).toBe(false);
  });

  it("rejects page 0", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 0, x: 0, y: 0, children: [] },
    ];
    expect(validateBookmarkDestinations(tree, 10).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Flatten
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings flattenTree", () => {
  it("flattens with parent links", () => {
    const tree: BookmarkNodeT[] = [
      {
        title: "A", level: 1, page: 1, x: 0, y: 0,
        children: [
          { title: "B", level: 2, page: 1, x: 0, y: 0, children: [] },
        ],
      },
    ];
    const flat = flattenTree(tree);
    expect(flat).toEqual([
      { title: "A", level: 1, page: 1, parent: null },
      { title: "B", level: 2, page: 1, parent: "A" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings renderTextTree", () => {
  it("renders ASCII tree with page numbers", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 1, x: 0, y: 0, children: [
        { title: "B", level: 2, page: 2, x: 0, y: 0, children: [] },
      ] },
    ];
    const text = renderTextTree(tree, true);
    expect(text).toContain("# A  (p.1)");
    expect(text).toContain("  ## B  (p.2)");
  });

  it("omits page numbers when includePageNumbers=false", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 1, x: 0, y: 0, children: [] },
    ];
    expect(renderTextTree(tree, false)).toBe("# A");
  });

  it("returns empty for empty tree", () => {
    expect(renderTextTree([], true)).toBe("");
  });
});

describe("pdf-bookmark-from-headings renderCsvTree", () => {
  it("renders header + rows", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 1, x: 0, y: 0, children: [
        { title: "B", level: 2, page: 2, x: 0, y: 0, children: [] },
      ] },
    ];
    const csv = renderCsvTree(tree);
    expect(csv).toContain("level,title,page,parent");
    expect(csv).toContain("H1,A,1,");
    expect(csv).toContain("H2,B,2,A");
  });

  it("escapes commas in titles", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A, B", level: 1, page: 1, x: 0, y: 0, children: [] },
    ];
    expect(renderCsvTree(tree)).toContain('"A, B"');
  });
});

describe("pdf-bookmark-from-headings renderJsonTree", () => {
  it("renders valid JSON", () => {
    const tree: BookmarkNodeT[] = [
      { title: "A", level: 1, page: 1, x: 0, y: 0, children: [] },
    ];
    const json = renderJsonTree(tree);
    const parsed = JSON.parse(json);
    expect(parsed[0].title).toBe("A");
    expect(parsed[0].level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      fileName: "a.pdf",
      pageCount: 5,
      bookmarkCount: 3,
      detectionMethod: "by-font-size",
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `f${i}.pdf`,
        pageCount: 1,
        bookmarkCount: 1,
        detectionMethod: "by-font-size",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, bookmarkCount: 1, detectionMethod: "by-font-size" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings shareable URL", () => {
  it("builds URL with non-default options", () => {
    const o = opts({
      detectionMethod: "by-text-pattern",
      textPatterns: "H1: ^Chapter",
      maxHeadingLevel: 2,
      thresholds: { h1: 28, h2: 22, h3: 16 },
    });
    const url = buildShareUrl(o);
    expect(url).toContain("method=by-text-pattern");
    // URLSearchParams encodes space as "+", so "H1: ^Chapter" → "H1%3A+%5EChapter"
    expect(url).toContain("pat=H1%3A+%5EChapter");
    expect(url).toContain("ml=2");
    expect(url).toContain("h1=28");
  });

  it("builds minimal URL when all defaults", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    expect(buildShareUrl(DEFAULT_OPTIONS)).toBe("?");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses URL back", () => {
    // Use "+" for space (as produced by URLSearchParams) in the input hash.
    const hash = "method=by-text-pattern&h1=28&h2=22&h3=16&pat=H1%3A+%5EChapter&ml=2&pn=0";
    const p = parseShareUrl(hash);
    expect(p.detectionMethod).toBe("by-text-pattern");
    expect(p.thresholds?.h1).toBe(28);
    expect(p.textPatterns).toBe("H1: ^Chapter");
    expect(p.maxHeadingLevel).toBe(2);
    expect(p.includePageNumbers).toBe(false);
  });

  it("filters unknown methods", () => {
    const p = parseShareUrl("method=unknown");
    expect(p.detectionMethod).toBeUndefined();
  });

  it("filters invalid levels", () => {
    const p = parseShareUrl("ml=5");
    expect(p.maxHeadingLevel).toBeUndefined();
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validateOptions
// ---------------------------------------------------------------------------

describe("pdf-bookmark-from-headings validateOptions", () => {
  it("accepts valid options", () => {
    expect(validateOptions(DEFAULT_OPTIONS).ok).toBe(true);
  });
  it("rejects unknown method", () => {
    expect(validateOptions(opts({ detectionMethod: "bogus" as DetectionMethod })).ok).toBe(false);
  });
  it("rejects non-positive thresholds", () => {
    expect(validateOptions(opts({ thresholds: { h1: 0, h2: 0, h3: 0 } })).ok).toBe(false);
  });
  it("rejects non-monotonic thresholds", () => {
    expect(validateOptions(opts({ thresholds: { h1: 14, h2: 18, h3: 24 } })).ok).toBe(false);
  });
  it("rejects invalid maxHeadingLevel", () => {
    expect(validateOptions(opts({ maxHeadingLevel: 5 as HeadingLevel })).ok).toBe(false);
  });
  it("rejects invalid regex patterns", () => {
    expect(validateOptions(opts({ detectionMethod: "by-text-pattern", textPatterns: "[bad" })).ok).toBe(false);
  });
});

// Local type alias to keep test bodies readable.
type BookmarkNodeT = {
  title: string;
  level: HeadingLevel;
  page: number;
  x: number;
  y: number;
  children: BookmarkNodeT[];
};

// Suppress unused-import lint
export type _Unused = DetectionMethod | FontSizeThresholds;
