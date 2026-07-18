import { describe, it, expect, beforeEach } from "vitest";
import {
  FOOTPRINTS,
  NICHE_PRESETS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  normalizeNiche,
  buildGoogleUrl,
  generateQueries,
  generateAllQueries,
  makeId,
  buildProspect,
  dedupProspects,
  updateStatus,
  updatePriority,
  updateNotes,
  updateUrl,
  removeProspect,
  filterProspects,
  computeStats,
  renderCsv,
  parseCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  loadProspects,
  saveProspects,
  clearProspects,
  buildShareUrl,
  parseShareUrl,
  type Prospect,
  type FootprintCategory,
  type OutreachStatus,
  type Priority,
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

describe("link-prospecting-builder constants", () => {
  it("has 6 footprint categories", () => {
    expect(Object.keys(FOOTPRINTS)).toHaveLength(6);
  });
  it("has footprints for guest-post", () => {
    expect(FOOTPRINTS["guest-post"].length).toBeGreaterThan(3);
    expect(FOOTPRINTS["guest-post"]).toContain('"write for us"');
  });
  it("has niche presets", () => {
    expect(NICHE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(NICHE_PRESETS).toContain("seo");
  });
  it("has status labels", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(5);
  });
  it("has priority labels", () => {
    expect(Object.keys(PRIORITY_LABELS)).toHaveLength(3);
  });
});

describe("link-prospecting-builder normalizeNiche", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeNiche("  Best   SEO  ")).toBe("best seo");
  });
  it("handles empty", () => {
    expect(normalizeNiche("")).toBe("");
  });
});

describe("link-prospecting-builder buildGoogleUrl", () => {
  it("encodes query", () => {
    const url = buildGoogleUrl('seo "write for us"');
    expect(url).toContain("https://www.google.com/search?q=");
    expect(url).toContain(encodeURIComponent('seo "write for us"'));
  });
});

describe("link-prospecting-builder generateQueries", () => {
  it("generates queries for a niche + category", () => {
    const queries = generateQueries("seo", "guest-post");
    expect(queries.length).toBe(FOOTPRINTS["guest-post"].length);
    expect(queries[0].query).toContain("seo");
    expect(queries[0].query).toContain('"write for us"');
  });
  it("includes google url", () => {
    const queries = generateQueries("seo", "guest-post");
    expect(queries[0].googleUrl).toContain("google.com");
  });
  it("returns empty for empty niche", () => {
    expect(generateQueries("", "guest-post")).toEqual([]);
  });
});

describe("link-prospecting-builder generateAllQueries", () => {
  it("generates for multiple categories", () => {
    const all = generateAllQueries("seo", ["guest-post", "resource"]);
    expect(all.length).toBe(FOOTPRINTS["guest-post"].length + FOOTPRINTS["resource"].length);
  });
  it("returns empty for no categories", () => {
    expect(generateAllQueries("seo", [])).toEqual([]);
  });
});

describe("link-prospecting-builder makeId / buildProspect", () => {
  it("builds stable ID", () => {
    const id1 = makeId("seo write for us", "seo");
    const id2 = makeId("seo write for us", "seo");
    expect(id1).toBe(id2);
  });
  it("builds prospect with defaults", () => {
    const q = generateQueries("seo", "guest-post")[0];
    const p = buildProspect(q);
    expect(p.status).toBe("pending");
    expect(p.priority).toBe("medium");
    expect(p.notes).toBe("");
  });
  it("builds prospect with overrides", () => {
    const q = generateQueries("seo", "guest-post")[0];
    const p = buildProspect(q, "contacted", "high", "note");
    expect(p.status).toBe("contacted");
    expect(p.priority).toBe("high");
    expect(p.notes).toBe("note");
  });
});

describe("link-prospecting-builder dedupProspects", () => {
  it("removes duplicates by id", () => {
    const q = generateQueries("seo", "guest-post")[0];
    const p1 = buildProspect(q);
    const p2 = buildProspect(q);
    const { unique, removed } = dedupProspects([p1, p2]);
    expect(unique).toHaveLength(1);
    expect(removed).toBe(1);
  });
  it("keeps distinct prospects", () => {
    const q1 = generateQueries("seo", "guest-post")[0];
    const q2 = generateQueries("seo", "resource")[0];
    const { unique } = dedupProspects([buildProspect(q1), buildProspect(q2)]);
    expect(unique).toHaveLength(2);
  });
});

describe("link-prospecting-builder update functions", () => {
  const q = generateQueries("seo", "guest-post")[0];
  const p = buildProspect(q);
  const list = [p];
  it("updates status", () => {
    const out = updateStatus(list, p.id, "yes");
    expect(out[0].status).toBe("yes");
  });
  it("updates priority", () => {
    const out = updatePriority(list, p.id, "high");
    expect(out[0].priority).toBe("high");
  });
  it("updates notes", () => {
    const out = updateNotes(list, p.id, "new note");
    expect(out[0].notes).toBe("new note");
  });
  it("updates url", () => {
    const out = updateUrl(list, p.id, "https://example.com");
    expect(out[0].url).toBe("https://example.com");
  });
  it("removes prospect", () => {
    expect(removeProspect(list, p.id)).toHaveLength(0);
  });
  it("does not mutate original", () => {
    updateStatus(list, p.id, "yes");
    expect(list[0].status).toBe("pending");
  });
});

describe("link-prospecting-builder filterProspects", () => {
  const prospects: Prospect[] = [
    { id: "1", niche: "seo", category: "guest-post", query: "q1", status: "pending", priority: "high", notes: "" },
    { id: "2", niche: "seo", category: "resource", query: "q2", status: "contacted", priority: "medium", notes: "" },
    { id: "3", niche: "seo", category: "guest-post", query: "q3", status: "yes", priority: "low", notes: "won!" },
  ];
  it("filters by category", () => {
    expect(filterProspects(prospects, { category: "guest-post" })).toHaveLength(2);
  });
  it("filters by status", () => {
    expect(filterProspects(prospects, { status: "yes" })).toHaveLength(1);
  });
  it("filters by priority", () => {
    expect(filterProspects(prospects, { priority: "high" })).toHaveLength(1);
  });
  it("filters by query substring", () => {
    expect(filterProspects(prospects, { query: "won" })).toHaveLength(1);
  });
  it("returns all when no filter", () => {
    expect(filterProspects(prospects, {})).toHaveLength(3);
  });
});

describe("link-prospecting-builder computeStats", () => {
  const prospects: Prospect[] = [
    { id: "1", niche: "seo", category: "guest-post", query: "q1", status: "pending", priority: "high", notes: "" },
    { id: "2", niche: "seo", category: "resource", query: "q2", status: "contacted", priority: "medium", notes: "" },
    { id: "3", niche: "seo", category: "guest-post", query: "q3", status: "yes", priority: "low", notes: "" },
    { id: "4", niche: "seo", category: "guest-post", query: "q4", status: "no", priority: "low", notes: "" },
  ];
  const stats = computeStats(prospects);
  it("computes total", () => {
    expect(stats.total).toBe(4);
  });
  it("computes byStatus", () => {
    expect(stats.byStatus.pending).toBe(1);
    expect(stats.byStatus.contacted).toBe(1);
    expect(stats.byStatus.yes).toBe(1);
    expect(stats.byStatus.no).toBe(1);
  });
  it("computes byPriority", () => {
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.medium).toBe(1);
    expect(stats.byPriority.low).toBe(2);
  });
  it("computes byCategory", () => {
    expect(stats.byCategory["guest-post"]).toBe(3);
    expect(stats.byCategory["resource"]).toBe(1);
  });
  it("computes successRate", () => {
    expect(stats.successRate).toBe(25); // 1/4 = 25%
  });
  it("computes contactRate", () => {
    expect(stats.contactRate).toBe(75); // 3/4 = 75%
  });
  it("returns zeros for empty", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.successRate).toBe(0);
  });
});

describe("link-prospecting-builder splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("link-prospecting-builder renderCsv / parseCsv round-trip", () => {
  it("renders header", () => {
    expect(renderCsv([])).toContain("id,niche,category,query,status,priority,notes,url");
  });
  it("renders prospect rows", () => {
    const p: Prospect = { id: "1", niche: "seo", category: "guest-post", query: "q", status: "pending", priority: "high", notes: "n" };
    expect(renderCsv([p])).toContain("seo,guest-post,q,pending,high");
  });
  it("parses rendered CSV back", () => {
    const original: Prospect[] = [
      { id: "1", niche: "seo", category: "guest-post", query: "q", status: "pending", priority: "high", notes: "n", url: "https://example.com" },
    ];
    const csv = renderCsv(original);
    const { prospects, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(prospects).toHaveLength(1);
    expect(prospects[0].niche).toBe("seo");
    expect(prospects[0].url).toBe("https://example.com");
  });
  it("parses headerless", () => {
    const input = "1,seo,guest-post,q,pending,high,note,";
    const { prospects } = parseCsv(input);
    expect(prospects).toHaveLength(1);
  });
});

describe("link-prospecting-builder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, niche: "seo", totalProspects: 5, successRate: 20 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, niche: "x", totalProspects: 1, successRate: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, niche: "x", totalProspects: 1, successRate: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("link-prospecting-builder persisted prospects (localStorage)", () => {
  it("loads empty initially", () => { expect(loadProspects()).toEqual([]); });
  it("saves and loads", () => {
    const p: Prospect[] = [{ id: "1", niche: "seo", category: "guest-post", query: "q", status: "pending", priority: "medium", notes: "" }];
    saveProspects(p);
    expect(loadProspects()).toHaveLength(1);
  });
  it("clears", () => {
    saveProspects([{ id: "1", niche: "x", category: "guest-post", query: "q", status: "pending", priority: "medium", notes: "" }]);
    clearProspects();
    expect(loadProspects()).toEqual([]);
  });
});

describe("link-prospecting-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("seo", ["guest-post", "resource"]);
    expect(url).toContain("niche=seo");
    expect(url).toContain("cats=guest-post%2Cresource");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("niche=seo&cats=guest-post%2Cresource");
    expect(p.niche).toBe("seo");
    expect(p.categories).toEqual(["guest-post", "resource"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ niche: "", categories: [] });
  });
  it("filters unknown categories", () => {
    const p = parseShareUrl("niche=seo&cats=guest-post%2Cunknown");
    expect(p.categories).toEqual(["guest-post"]);
  });
});

// Suppress unused-import lint by referencing types
export type _Unused = { c: FootprintCategory; s: OutreachStatus; p: Priority };
