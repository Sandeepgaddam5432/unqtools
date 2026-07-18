import { describe, it, expect, beforeEach } from "vitest";
import {
  DIRECTORIES,
  NICHE_PRESETS,
  COUNTRY_OPTIONS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  normalizeInput,
  parseInputs,
  buildGoogleSearchUrl,
  buildSubmissionUrl,
  matchesNiche,
  matchesCountry,
  generateCitations,
  filterCitations,
  computeSummaryStats,
  formatMinutes,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Priority,
  type DirectoryCategory,
  type FilterOptions,
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

describe("citation-finder constants", () => {
  it("has 50+ directories", () => {
    expect(DIRECTORIES.length).toBeGreaterThanOrEqual(50);
  });
  it("has 10 general directories", () => {
    expect(DIRECTORIES.filter((d) => d.category === "general")).toHaveLength(10);
  });
  it("has 25+ niche directories", () => {
    expect(DIRECTORIES.filter((d) => d.category === "niche").length).toBeGreaterThanOrEqual(25);
  });
  it("has 8+ country directories", () => {
    expect(DIRECTORIES.filter((d) => d.category === "country").length).toBeGreaterThanOrEqual(8);
  });
  it("every directory has a non-empty domain and required fields", () => {
    for (const d of DIRECTORIES) {
      expect(d.domain).toBeTruthy();
      expect(d.requiredFields.length).toBeGreaterThan(0);
      expect(d.timeMinutes).toBeGreaterThan(0);
    }
  });
  it("priority labels cover high/medium/low", () => {
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual(["high", "low", "medium"]);
  });
  it("category labels cover general/niche/country", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual(["country", "general", "niche"]);
  });
  it("niche presets include plumber, restaurant, lawyer", () => {
    expect(NICHE_PRESETS).toContain("plumber");
    expect(NICHE_PRESETS).toContain("restaurant");
    expect(NICHE_PRESETS).toContain("lawyer");
  });
  it("country options include US, UK, CA, AU, IN", () => {
    expect(COUNTRY_OPTIONS).toEqual(expect.arrayContaining(["US", "UK", "CA", "AU", "IN"]));
  });
});

describe("citation-finder normalizeInput", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeInput("  Best   Plumbing   ")).toBe("Best Plumbing");
  });
  it("lowercases when asked", () => {
    expect(normalizeInput("Plumbing", true)).toBe("plumbing");
  });
  it("preserves case by default", () => {
    expect(normalizeInput("Plumbing")).toBe("Plumbing");
  });
  it("handles empty", () => {
    expect(normalizeInput("")).toBe("");
  });
});

describe("citation-finder parseInputs", () => {
  it("normalizes all fields", () => {
    const r = parseInputs({
      businessName: "  Acme  Plumbing ",
      niche: "  PLUMBING ",
      city: " Austin ",
      state: " TX ",
      country: "us",
    });
    expect(r).toEqual({
      businessName: "Acme Plumbing",
      niche: "plumbing",
      city: "Austin",
      state: "TX",
      country: "US",
    });
  });
  it("defaults country to US", () => {
    expect(parseInputs({}).country).toBe("US");
  });
  it("uppercases country", () => {
    expect(parseInputs({ country: "uk" }).country).toBe("UK");
  });
});

describe("citation-finder buildGoogleSearchUrl", () => {
  it("encodes query", () => {
    const url = buildGoogleSearchUrl("Yelp add business Austin US");
    expect(url).toContain("https://www.google.com/search?q=");
    expect(url).toContain(encodeURIComponent("Yelp add business Austin US"));
  });
});

describe("citation-finder buildSubmissionUrl", () => {
  it("returns direct URL when known", () => {
    const dir = DIRECTORIES.find((d) => d.id === "yelp")!;
    const url = buildSubmissionUrl(dir, parseInputs({}));
    expect(url).toBe(dir.submitUrl);
  });
  it("returns Google search fallback when no submit URL", () => {
    const dir = { ...DIRECTORIES[0], submitUrl: undefined };
    const inputs = parseInputs({ city: "Austin", country: "US" });
    const url = buildSubmissionUrl(dir, inputs);
    expect(url).toContain("google.com/search?q=");
  });
});

describe("citation-finder matchesNiche", () => {
  it("matches exact niche", () => {
    const dir = DIRECTORIES.find((d) => d.id === "avvo")!;
    expect(matchesNiche(dir, "lawyer")).toBe("lawyer");
  });
  it("returns null for general directory", () => {
    const dir = DIRECTORIES.find((d) => d.id === "yelp")!;
    expect(matchesNiche(dir, "plumber")).toBeNull();
  });
  it("returns null when no niche provided", () => {
    const dir = DIRECTORIES.find((d) => d.id === "avvo")!;
    expect(matchesNiche(dir, "")).toBeNull();
  });
  it("partial match: plumbing matches plumber", () => {
    const dir = DIRECTORIES.find((d) => d.id === "angi")!;
    expect(matchesNiche(dir, "plumbing")).toBeTruthy();
  });
});

describe("citation-finder matchesCountry", () => {
  it("matches country", () => {
    const dir = DIRECTORIES.find((d) => d.id === "yell-com")!;
    expect(matchesCountry(dir, "UK")).toBe(true);
  });
  it("case-insensitive match", () => {
    const dir = DIRECTORIES.find((d) => d.id === "yell-com")!;
    expect(matchesCountry(dir, "uk")).toBe(true);
  });
  it("returns false for general directory", () => {
    const dir = DIRECTORIES.find((d) => d.id === "yelp")!;
    expect(matchesCountry(dir, "US")).toBe(false);
  });
  it("returns false when country does not match", () => {
    const dir = DIRECTORIES.find((d) => d.id === "yell-com")!;
    expect(matchesCountry(dir, "US")).toBe(false);
  });
});

describe("citation-finder generateCitations", () => {
  it("always returns 10 general directories", () => {
    const cits = generateCitations(parseInputs({}));
    const generalCount = cits.filter((c) => c.category === "general").length;
    expect(generalCount).toBe(10);
  });
  it("includes niche matches for plumber", () => {
    const cits = generateCitations(parseInputs({ niche: "plumber" }));
    const ids = cits.map((c) => c.id);
    expect(ids).toContain("angi");
    expect(ids).toContain("homeadvisor");
    expect(ids).toContain("porch");
  });
  it("includes country matches for UK", () => {
    const cits = generateCitations(parseInputs({ country: "UK" }));
    const ids = cits.map((c) => c.id);
    expect(ids).toContain("yell-com");
    expect(ids).toContain("thomson-local");
    expect(ids).toContain("scoot");
  });
  it("includes BOTH general AND niche for plumbing+US", () => {
    const cits = generateCitations(parseInputs({ niche: "plumbing", country: "US" }));
    expect(cits.length).toBeGreaterThanOrEqual(10);
    expect(cits.some((c) => c.category === "general")).toBe(true);
    expect(cits.some((c) => c.category === "niche")).toBe(true);
  });
  it("returns submissionUrl for every citation", () => {
    const cits = generateCitations(parseInputs({ niche: "lawyer", country: "UK" }));
    expect(cits.every((c) => c.submissionUrl.startsWith("http"))).toBe(true);
  });
  it("includes matchedNiche for niche directories", () => {
    const cits = generateCitations(parseInputs({ niche: "lawyer" }));
    const avvo = cits.find((c) => c.id === "avvo");
    expect(avvo?.matchedNiche).toBe("lawyer");
  });
  it("returns only general when niche/country unmatchable", () => {
    const cits = generateCitations(parseInputs({ niche: "qqqqqqqqqq", country: "ZZ" }));
    expect(cits.length).toBe(10);
    expect(cits.every((c) => c.category === "general")).toBe(true);
  });
});

describe("citation-finder filterCitations", () => {
  const sample = generateCitations(parseInputs({ niche: "lawyer", country: "UK" }));

  it("filters by priority", () => {
    const filtered = filterCitations(sample, { priority: "high" });
    expect(filtered.every((c) => c.priority === "high")).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });
  it("filters by category", () => {
    const filtered = filterCitations(sample, { category: "niche" });
    expect(filtered.every((c) => c.category === "niche")).toBe(true);
  });
  it("filters by both priority and category", () => {
    const filtered = filterCitations(sample, { priority: "high", category: "country" });
    expect(filtered.every((c) => c.priority === "high" && c.category === "country")).toBe(true);
  });
  it("empty filter returns all", () => {
    expect(filterCitations(sample, {})).toHaveLength(sample.length);
  });
  it("empty priority string returns all", () => {
    expect(filterCitations(sample, { priority: "" })).toHaveLength(sample.length);
  });
});

describe("citation-finder computeSummaryStats", () => {
  it("computes stats correctly", () => {
    const cits = generateCitations(parseInputs({ niche: "lawyer", country: "UK" }));
    const stats = computeSummaryStats(cits);
    expect(stats.total).toBe(cits.length);
    expect(stats.byPriority.high + stats.byPriority.medium + stats.byPriority.low).toBe(cits.length);
    expect(stats.byCategory.general + stats.byCategory.niche + stats.byCategory.country).toBe(cits.length);
    const sumTime = cits.reduce((s, c) => s + c.timeMinutes, 0);
    expect(stats.totalTimeMinutes).toBe(sumTime);
  });
  it("handles empty list", () => {
    const stats = computeSummaryStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byPriority).toEqual({ high: 0, medium: 0, low: 0 });
    expect(stats.totalTimeMinutes).toBe(0);
  });
});

describe("citation-finder formatMinutes", () => {
  it("formats minutes only", () => {
    expect(formatMinutes(45)).toBe("45m");
  });
  it("formats hours only", () => {
    expect(formatMinutes(60)).toBe("1h");
  });
  it("formats hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(150)).toBe("2h 30m");
  });
  it("handles zero", () => {
    expect(formatMinutes(0)).toBe("0m");
  });
});

describe("citation-finder renderText", () => {
  it("includes header and summary", () => {
    const cits = generateCitations(parseInputs({ businessName: "Acme", niche: "lawyer", city: "Austin", country: "US" }));
    const txt = renderText(cits, parseInputs({ businessName: "Acme", niche: "lawyer", city: "Austin", country: "US" }));
    expect(txt).toContain("LOCAL CITATION FINDINGS");
    expect(txt).toContain("Business: Acme");
    expect(txt).toContain("SUMMARY");
    expect(txt).toContain("Total citation opportunities:");
    expect(txt).toContain("CITATION SOURCES");
  });
  it("handles empty citations list", () => {
    const txt = renderText([], parseInputs({}));
    expect(txt).toContain("Total citation opportunities: 0");
  });
});

describe("citation-finder renderCsv", () => {
  it("has header", () => {
    expect(renderCsv([])).toContain("directory,url,priority,category,time_minutes,required_fields");
  });
  it("has rows for each citation", () => {
    const cits = generateCitations(parseInputs({ niche: "lawyer", country: "US" }));
    const csv = renderCsv(cits);
    const lines = csv.split("\n");
    expect(lines.length).toBe(cits.length + 1);
  });
  it("escapes commas in required fields", () => {
    const cits = generateCitations(parseInputs({}));
    const csv = renderCsv(cits);
    // At least one row should contain quoted values for required fields list
    expect(csv).toContain('"');
  });
});

describe("citation-finder splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("citation-finder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      businessName: "Acme",
      niche: "plumber",
      city: "Austin",
      country: "US",
      totalCitations: 12,
      totalTimeMinutes: 120,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].businessName).toBe("Acme");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        businessName: `B${i}`,
        niche: "plumber",
        city: "Austin",
        country: "US",
        totalCitations: 1,
        totalTimeMinutes: 5,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, businessName: "x", niche: "x", city: "x", country: "US",
      totalCitations: 1, totalTimeMinutes: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("citation-finder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(parseInputs({
      businessName: "Acme", niche: "plumber", city: "Austin", state: "TX", country: "US",
    }));
    expect(url).toContain("name=Acme");
    expect(url).toContain("niche=plumber");
    expect(url).toContain("city=Austin");
    expect(url).toContain("state=TX");
    // Country defaults to US, should be omitted from params
    expect(url).not.toContain("country=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("includes country when not US", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(parseInputs({ country: "UK" }));
    expect(url).toContain("country=UK");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("name=Acme&niche=plumber&city=Austin&state=TX&country=UK");
    expect(p).toEqual({
      businessName: "Acme",
      niche: "plumber",
      city: "Austin",
      state: "TX",
      country: "UK",
    });
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles hash prefix", () => {
    const p = parseShareUrl("#name=Acme&niche=plumber");
    expect(p.businessName).toBe("Acme");
    expect(p.niche).toBe("plumber");
  });
});

// Suppress unused-import lints for type-only imports used in tests
export type _Unused = Priority | DirectoryCategory | FilterOptions;
