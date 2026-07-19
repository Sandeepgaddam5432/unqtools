import { describe, it, expect, beforeEach } from "vitest";
import {
  VIEW_MODES,
  VIEW_MODE_LABELS,
  KNOWN_TAG_TYPES,
  TAG_TYPE_DESCRIPTIONS,
  TAG_TYPE_FILTERS,
  DEFAULT_OPTIONS,
  MIN_EXPAND_DEPTH,
  MAX_EXPAND_DEPTH,
  parseTagType,
  extractTagAttributes,
  flattenTree,
  buildParsedTree,
  calculateMaxDepth,
  countTagsByType,
  countTagsByPage,
  filterByType,
  validateTags,
  checkHeadingHierarchy,
  detectMissingStructure,
  verifyReadingOrder,
  computeSummaryStats,
  renderTextTree,
  renderHtmlTree,
  renderJsonTree,
  renderCsvTags,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TagOptions,
  type RawTagNode,
  type TagTypeFilter,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

function rawTree(partial: Partial<RawTagNode> = {}): RawTagNode {
  return {
    rawType: partial.rawType ?? "Document",
    attributes: partial.attributes ?? {},
    pages: partial.pages ?? [],
    children: partial.children ?? [],
  };
}

function makeSimpleTree(): RawTagNode {
  return rawTree({
    rawType: "Document",
    pages: [1],
    children: [
      rawTree({
        rawType: "H1",
        attributes: { Alt: "Introduction" },
        pages: [1],
        children: [],
      }),
      rawTree({
        rawType: "P",
        pages: [1],
        children: [],
      }),
      rawTree({
        rawType: "L",
        pages: [2],
        children: [
          rawTree({ rawType: "LI", pages: [2], children: [] }),
          rawTree({ rawType: "LI", pages: [2], children: [] }),
        ],
      }),
      rawTree({
        rawType: "Figure",
        attributes: { Alt: "Chart of sales" },
        pages: [2],
        children: [],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
describe("tag-tree constants & defaults", () => {
  it("exposes 4 view modes", () => {
    expect(VIEW_MODES).toHaveLength(4);
    expect(VIEW_MODES).toContain("tree");
    expect(VIEW_MODES).toContain("flat-list");
    expect(VIEW_MODES).toContain("by-page");
    expect(VIEW_MODES).toContain("by-type");
  });

  it("view-mode labels cover every mode", () => {
    for (const m of VIEW_MODES) expect(typeof VIEW_MODE_LABELS[m]).toBe("string");
  });

  it("exposes 10+ known tag types", () => {
    expect(KNOWN_TAG_TYPES.length).toBeGreaterThanOrEqual(10);
    expect(KNOWN_TAG_TYPES).toContain("Document");
    expect(KNOWN_TAG_TYPES).toContain("H1");
    expect(KNOWN_TAG_TYPES).toContain("H6");
    expect(KNOWN_TAG_TYPES).toContain("Table");
    expect(KNOWN_TAG_TYPES).toContain("Figure");
    expect(KNOWN_TAG_TYPES).toContain("Link");
  });

  it("tag type descriptions cover every type", () => {
    for (const t of KNOWN_TAG_TYPES) expect(typeof TAG_TYPE_DESCRIPTIONS[t]).toBe("string");
  });

  it("tag type filters include 'all' plus known types", () => {
    expect(TAG_TYPE_FILTERS[0]).toBe("all");
    expect(TAG_TYPE_FILTERS.length).toBe(KNOWN_TAG_TYPES.length + 1);
  });

  it("provides default options", () => {
    expect(DEFAULT_OPTIONS.viewMode).toBe("tree");
    expect(DEFAULT_OPTIONS.tagTypeFilter).toBe("all");
    expect(DEFAULT_OPTIONS.includeAttributes).toBe(true);
    expect(DEFAULT_OPTIONS.expandDepth).toBe(3);
  });

  it("exposes min/max expand depth", () => {
    expect(MIN_EXPAND_DEPTH).toBe(0);
    expect(MAX_EXPAND_DEPTH).toBe(10);
  });
});

// ---------------------------------------------------------------------------
describe("tag-type detector", () => {
  it("classifies known types", () => {
    expect(parseTagType("Document")).toBe("Document");
    expect(parseTagType("/H1")).toBe("H1");
    expect(parseTagType("Figure")).toBe("Figure");
    expect(parseTagType("Link")).toBe("Link");
  });

  it("falls back to Other for unknown", () => {
    expect(parseTagType("NonStandard")).toBe("Other");
    expect(parseTagType("")).toBe("Other");
    expect(parseTagType("/CustomTag")).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
describe("attribute extractor", () => {
  it("extracts known attributes and ignores unknown ones", () => {
    const attrs = extractTagAttributes({
      S: "/H1",
      Alt: "Introduction",
      Lang: "en-US",
      Custom: "ignored",
      "/BBox": "[0 0 100 100]",
    });
    const keys = attrs.map((a) => a.key);
    expect(keys).toContain("S");
    expect(keys).toContain("Alt");
    expect(keys).toContain("Lang");
    expect(keys).toContain("BBox");
    expect(keys).not.toContain("Custom");
  });

  it("sorts attributes by key", () => {
    const attrs = extractTagAttributes({ Alt: "x", S: "/H1", Lang: "en" });
    expect(attrs.map((a) => a.key)).toEqual(["Alt", "Lang", "S"]);
  });

  it("skips empty values", () => {
    const attrs = extractTagAttributes({ Alt: "", S: "/P" });
    expect(attrs).toHaveLength(1);
    expect(attrs[0].key).toBe("S");
  });
});

// ---------------------------------------------------------------------------
describe("tree builder", () => {
  it("returns empty parsed tree when rawRoot is null", () => {
    const p = buildParsedTree(null);
    expect(p.hasStructureTree).toBe(false);
    expect(p.root).toBeNull();
    expect(p.all).toEqual([]);
    expect(p.totalTags).toBe(0);
  });

  it("builds a parsed tree with correct counts", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.hasStructureTree).toBe(true);
    expect(p.totalTags).toBe(7); // Document, H1, P, L, LI, LI, Figure
  });

  it("assigns ids in document order", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.all[0].id).toBe(0);
    expect(p.all[1].id).toBe(1);
    for (let i = 0; i < p.all.length; i++) {
      expect(p.all[i].id).toBe(i);
    }
  });

  it("computes maxDepth correctly", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.maxDepth).toBe(2); // Document(0) > L(1) > LI(2)
  });

  it("groups tags by type", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.byType["Document"]).toHaveLength(1);
    expect(p.byType["H1"]).toHaveLength(1);
    expect(p.byType["P"]).toHaveLength(1);
    expect(p.byType["L"]).toHaveLength(1);
    expect(p.byType["LI"]).toHaveLength(2);
    expect(p.byType["Figure"]).toHaveLength(1);
  });

  it("groups tags by page", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.byPage[1]).toHaveLength(3); // Document, H1, P
    expect(p.byPage[2]).toHaveLength(4); // L, LI, LI, Figure
  });

  it("populates countsByType", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.countsByType["LI"]).toBe(2);
    expect(p.countsByType["Document"]).toBe(1);
  });

  it("computes pageCount from unique page references", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.pageCount).toBe(2);
  });

  it("builds paths from root to each tag", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(p.root!.path).toBe("Document");
    expect(p.byType["H1"][0].path).toBe("Document > H1");
    expect(p.byType["LI"][0].path).toBe("Document > L > LI");
  });
});

// ---------------------------------------------------------------------------
describe("flatten & depth helpers", () => {
  it("flattenTree returns empty for null", () => {
    expect(flattenTree(null)).toEqual([]);
  });

  it("flattenTree returns depth-first list", () => {
    const p = buildParsedTree(makeSimpleTree());
    const flat = flattenTree(p.root);
    expect(flat).toHaveLength(p.totalTags);
    expect(flat[0].type).toBe("Document");
  });

  it("calculateMaxDepth handles null", () => {
    expect(calculateMaxDepth(null)).toBe(0);
  });

  it("calculateMaxDepth matches parsed.maxDepth", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(calculateMaxDepth(p.root)).toBe(p.maxDepth);
  });
});

// ---------------------------------------------------------------------------
describe("counter helpers", () => {
  it("countTagsByType returns per-type counts", () => {
    const p = buildParsedTree(makeSimpleTree());
    const counts = countTagsByType(p.all);
    expect(counts["LI"]).toBe(2);
    expect(counts["Figure"]).toBe(1);
  });

  it("countTagsByPage returns per-page counts", () => {
    const p = buildParsedTree(makeSimpleTree());
    const counts = countTagsByPage(p.all);
    expect(counts[1]).toBe(3);
    expect(counts[2]).toBe(4);
  });
});

// ---------------------------------------------------------------------------
describe("filterByType", () => {
  it("returns all when filter is 'all'", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(filterByType(p.all, "all")).toHaveLength(p.all.length);
  });

  it("filters to a single type", () => {
    const p = buildParsedTree(makeSimpleTree());
    const filtered = filterByType(p.all, "LI" as TagTypeFilter);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((t) => t.type === "LI")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("validateTags", () => {
  it("reports error when structure tree is missing", () => {
    const p = buildParsedTree(null);
    const issues = validateTags(p);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("warns when root is not Document", () => {
    const p = buildParsedTree(rawTree({ rawType: "Section" }));
    const issues = validateTags(p);
    expect(issues.some((i) => i.message.includes("expected 'Document'"))).toBe(true);
  });

  it("errors when a Figure lacks Alt", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [rawTree({ rawType: "Figure" })],
    }));
    const issues = validateTags(p);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("no Alt"))).toBe(true);
  });

  it("passes when a Figure has Alt", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [rawTree({ rawType: "Figure", attributes: { Alt: "Diagram" } })],
    }));
    const issues = validateTags(p);
    expect(issues.some((i) => i.message.includes("no Alt"))).toBe(false);
  });

  it("warns when TR is not inside Table", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [rawTree({ rawType: "TR" })],
    }));
    const issues = validateTags(p);
    expect(issues.some((i) => i.message.includes("TR") && i.message.includes("Table"))).toBe(true);
  });

  it("warns when TD is not inside TR", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [
        rawTree({
          rawType: "Table",
          children: [rawTree({ rawType: "TD" })],
        }),
      ],
    }));
    const issues = validateTags(p);
    expect(issues.some((i) => i.message.includes("TD") && i.message.includes("TR"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("heading hierarchy checker", () => {
  it("returns empty when no structure tree", () => {
    const p = buildParsedTree(null);
    expect(checkHeadingHierarchy(p)).toEqual([]);
  });

  it("reports a jump from H1 to H3", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [
        rawTree({ rawType: "H1" }),
        rawTree({ rawType: "H3" }),
      ],
    }));
    const issues = checkHeadingHierarchy(p);
    expect(issues.some((i) => i.message.includes("H1") && i.message.includes("H3"))).toBe(true);
  });

  it("does not report a clean H1 → H2 → H3 sequence", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [
        rawTree({ rawType: "H1" }),
        rawTree({ rawType: "H2" }),
        rawTree({ rawType: "H3" }),
      ],
    }));
    const issues = checkHeadingHierarchy(p).filter((i) => i.severity === "warning");
    expect(issues).toHaveLength(0);
  });

  it("reports info when no H1 exists", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      children: [rawTree({ rawType: "H2" })],
    }));
    const issues = checkHeadingHierarchy(p);
    expect(issues.some((i) => i.severity === "info" && i.message.includes("H1"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("missing-structure detector", () => {
  it("returns error when structure tree is missing", () => {
    const p = buildParsedTree(null);
    const issue = detectMissingStructure(p);
    expect(issue).not.toBeNull();
    expect(issue!.severity).toBe("error");
  });

  it("returns null when structure tree exists", () => {
    const p = buildParsedTree(makeSimpleTree());
    expect(detectMissingStructure(p)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("reading-order verifier", () => {
  it("returns empty when no structure tree", () => {
    const p = buildParsedTree(null);
    expect(verifyReadingOrder(p)).toEqual([]);
  });

  it("returns empty when page numbers are monotonic", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      pages: [1],
      children: [
        rawTree({ rawType: "P", pages: [1] }),
        rawTree({ rawType: "P", pages: [2] }),
        rawTree({ rawType: "P", pages: [3] }),
      ],
    }));
    expect(verifyReadingOrder(p)).toEqual([]);
  });

  it("warns when page numbers go backward", () => {
    const p = buildParsedTree(rawTree({
      rawType: "Document",
      pages: [1],
      children: [
        rawTree({ rawType: "P", pages: [3] }),
        rawTree({ rawType: "P", pages: [1] }), // backward
      ],
    }));
    const issues = verifyReadingOrder(p);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("summary stats", () => {
  it("computes summary stats from parsed tree", () => {
    const p = buildParsedTree(makeSimpleTree());
    const s = computeSummaryStats(p);
    expect(s.totalTags).toBe(p.totalTags);
    expect(s.maxDepth).toBe(p.maxDepth);
    expect(s.uniqueTypes).toBeGreaterThan(0);
    expect(s.pageCount).toBe(2);
    expect(s.topLevelType).toBe("Document");
    expect(s.hasStructureTree).toBe(true);
    expect(s.headingCount).toBe(1);
    expect(s.figureCount).toBe(1);
    expect(s.listCount).toBe(1);
  });

  it("handles missing structure tree", () => {
    const p = buildParsedTree(null);
    const s = computeSummaryStats(p);
    expect(s.hasStructureTree).toBe(false);
    expect(s.totalTags).toBe(0);
    expect(s.topLevelType).toBe("—");
  });
});

// ---------------------------------------------------------------------------
describe("renderers", () => {
  const opts: TagOptions = { viewMode: "tree", tagTypeFilter: "all", includeAttributes: true, expandDepth: 3 };

  it("renderTextTree produces a report when structure tree exists", () => {
    const p = buildParsedTree(makeSimpleTree());
    const text = renderTextTree(p, opts);
    expect(text).toContain("PDF Tag Tree Report");
    expect(text).toContain("Document");
    expect(text).toContain("Tree view");
    expect(text).toContain("Tag counts by type");
  });

  it("renderTextTree reports untagged PDF", () => {
    const p = buildParsedTree(null);
    const text = renderTextTree(p, opts);
    expect(text).toContain("untagged PDF");
  });

  it("renderTextTree flat-list mode lists tags with paths", () => {
    const p = buildParsedTree(makeSimpleTree());
    const text = renderTextTree(p, { ...opts, viewMode: "flat-list" });
    expect(text).toContain("Flat list view");
    expect(text).toContain("path: Document > H1");
  });

  it("renderTextTree by-page mode groups by page", () => {
    const p = buildParsedTree(makeSimpleTree());
    const text = renderTextTree(p, { ...opts, viewMode: "by-page" });
    expect(text).toContain("By-page view");
    expect(text).toContain("Page 1");
    expect(text).toContain("Page 2");
  });

  it("renderTextTree by-type mode groups by type", () => {
    const p = buildParsedTree(makeSimpleTree());
    const text = renderTextTree(p, { ...opts, viewMode: "by-type" });
    expect(text).toContain("By-type view");
    expect(text).toContain("LI (2)");
  });

  it("renderHtmlTree produces an HTML document", () => {
    const p = buildParsedTree(makeSimpleTree());
    const html = renderHtmlTree(p, opts);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<details");
    expect(html).toContain("PDF Tag Tree");
  });

  it("renderJsonTree produces valid JSON", () => {
    const p = buildParsedTree(makeSimpleTree());
    const json = renderJsonTree(p, opts);
    const parsed = JSON.parse(json);
    expect(parsed.summary.totalTags).toBe(p.totalTags);
    expect(parsed.root).toBeTruthy();
    expect(parsed.allTags).toHaveLength(p.all.length);
  });

  it("renderCsvTags produces a header and rows", () => {
    const p = buildParsedTree(makeSimpleTree());
    const csv = renderCsvTags(p, opts);
    expect(csv.split("\n")[0]).toBe("id,type,raw_type,depth,path,pages,attributes");
    expect(csv.split("\n").length).toBe(p.all.length + 1);
  });

  it("respects includeAttributes=false", () => {
    const p = buildParsedTree(makeSimpleTree());
    const text = renderTextTree(p, { ...opts, includeAttributes: false });
    // Attributes appear as ` [key=value]` — should not be present.
    expect(text).not.toContain("[Alt=Introduction]");
  });

  it("respects tagTypeFilter in flat list", () => {
    const p = buildParsedTree(makeSimpleTree());
    const text = renderTextTree(p, { ...opts, viewMode: "flat-list", tagTypeFilter: "LI" as TagTypeFilter });
    expect(text).toContain("LI");
    expect(text).not.toContain("Document (id");
  });
});

// ---------------------------------------------------------------------------
describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      pageCount: 5,
      totalTags: 42,
      maxDepth: 4,
      topLevelType: "Document",
      hasStructureTree: true,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("test.pdf");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `test-${i}.pdf`,
        pageCount: 5,
        totalTags: 10,
        maxDepth: 3,
        topLevelType: "Document",
        hasStructureTree: true,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      pageCount: 5,
      totalTags: 10,
      maxDepth: 3,
      topLevelType: "Document",
      hasStructureTree: true,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, viewMode: "by-page", tagTypeFilter: "H1", includeAttributes: false, expandDepth: 5 });
    expect(url).toContain("mode=by-page");
    expect(url).toContain("filter=H1");
    expect(url).toContain("attrs=0");
    expect(url).toContain("depth=5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("mode=tree&filter=all&attrs=1&depth=3");
    expect(p.viewMode).toBe("tree");
    expect(p.tagTypeFilter).toBe("all");
    expect(p.includeAttributes).toBe(true);
    expect(p.expandDepth).toBe(3);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("filters unknown view modes", () => {
    const p = parseShareUrl("mode=invalid");
    expect(p.viewMode).toBeUndefined();
  });

  it("filters unknown tag-type filters", () => {
    const p = parseShareUrl("filter=invalid");
    expect(p.tagTypeFilter).toBeUndefined();
  });

  it("rejects out-of-range depth", () => {
    expect(parseShareUrl("depth=99").expandDepth).toBeUndefined();
    expect(parseShareUrl("depth=-1").expandDepth).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("validateOptions", () => {
  it("validates default options", () => {
    const r = validateOptions(DEFAULT_OPTIONS);
    expect(r.ok).toBe(true);
  });

  it("rejects unknown view mode", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, viewMode: "invalid" as never });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown tag-type filter", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, tagTypeFilter: "invalid" as never });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range expand depth", () => {
    const r1 = validateOptions({ ...DEFAULT_OPTIONS, expandDepth: -1 });
    expect(r1.ok).toBe(false);
    const r2 = validateOptions({ ...DEFAULT_OPTIONS, expandDepth: 99 });
    expect(r2.ok).toBe(false);
  });
});
