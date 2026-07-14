import { describe, it, expect, beforeEach } from "vitest";
import {
  STATUS_CODES,
  lookup,
  byCategory,
  search,
  count,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type StatusCodeCategory,
} from "./logic";

describe("http-status STATUS_CODES", () => {
  it("has at least 50 status codes", () => {
    expect(STATUS_CODES.length).toBeGreaterThan(50);
  });

  it("every code has all required fields", () => {
    for (const s of STATUS_CODES) {
      expect(s.code).toBeGreaterThan(99);
      expect(s.code).toBeLessThan(1000);
      expect(s.name).toBeTruthy();
      expect(s.category).toMatch(/^[1-5]xx$/);
      expect(s.description).toBeTruthy();
      expect(s.useCase).toBeTruthy();
      expect(typeof s.isOfficial).toBe("boolean");
    }
  });

  it("has no duplicate codes", () => {
    const codes = STATUS_CODES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("category matches the code prefix", () => {
    for (const s of STATUS_CODES) {
      const expectedCat = `${String(s.code)[0]}xx` as StatusCodeCategory;
      expect(s.category).toBe(expectedCat);
    }
  });
});

describe("http-status lookup", () => {
  it("finds 200", () => {
    const r = lookup(200);
    expect(r).toBeDefined();
    expect(r?.name).toBe("OK");
    expect(r?.category).toBe("2xx");
  });

  it("finds 404", () => {
    const r = lookup(404);
    expect(r).toBeDefined();
    expect(r?.name).toBe("Not Found");
  });

  it("finds 500", () => {
    const r = lookup(500);
    expect(r).toBeDefined();
    expect(r?.name).toBe("Internal Server Error");
  });

  it("finds unofficial code 418 (teapot)", () => {
    const r = lookup(418);
    expect(r).toBeDefined();
    expect(r?.name).toMatch(/teapot/i);
    expect(r?.isOfficial).toBe(false);
  });

  it("finds Cloudflare 524", () => {
    const r = lookup(524);
    expect(r).toBeDefined();
    expect(r?.isOfficial).toBe(false);
  });

  it("returns undefined for unknown code", () => {
    expect(lookup(999)).toBeUndefined();
    expect(lookup(0)).toBeUndefined();
  });
});

describe("http-status byCategory", () => {
  it("returns only 1xx codes", () => {
    const r = byCategory("1xx");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.code >= 100 && s.code < 200)).toBe(true);
  });

  it("returns only 2xx codes", () => {
    const r = byCategory("2xx");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((s) => s.code >= 200 && s.code < 300)).toBe(true);
  });

  it("returns only 4xx codes", () => {
    const r = byCategory("4xx");
    expect(r.length).toBeGreaterThan(10);
    expect(r.every((s) => s.code >= 400 && s.code < 500)).toBe(true);
  });

  it("returns only 5xx codes", () => {
    const r = byCategory("5xx");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((s) => s.code >= 500 && s.code < 600)).toBe(true);
  });

  it("all 4 categories have entries", () => {
    expect(byCategory("1xx").length).toBeGreaterThan(0);
    expect(byCategory("2xx").length).toBeGreaterThan(0);
    expect(byCategory("3xx").length).toBeGreaterThan(0);
    expect(byCategory("4xx").length).toBeGreaterThan(0);
    expect(byCategory("5xx").length).toBeGreaterThan(0);
  });
});

describe("http-status search", () => {
  it("returns all codes for empty query", () => {
    expect(search("")).toHaveLength(STATUS_CODES.length);
    expect(search("   ")).toHaveLength(STATUS_CODES.length);
  });

  it("finds by code number", () => {
    const r = search("404");
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((s) => s.code === 404)).toBe(true);
    // Also matches 1404? No, but partial matches are fine
  });

  it("finds by name", () => {
    const r = search("not found");
    expect(r.some((s) => s.code === 404)).toBe(true);
  });

  it("finds by category label", () => {
    const r = search("client error");
    expect(r.every((s) => s.category === "4xx")).toBe(true);
    expect(r.length).toBeGreaterThan(5);
  });

  it("is case-insensitive", () => {
    const lower = search("not found");
    const upper = search("NOT FOUND");
    expect(lower).toEqual(upper);
  });

  it("finds by partial description", () => {
    const r = search("rate");
    expect(r.some((s) => s.code === 429)).toBe(true);
  });
});

describe("http-status count", () => {
  it("matches the array length", () => {
    expect(count()).toBe(STATUS_CODES.length);
  });
});

describe("http-status CATEGORY_LABELS", () => {
  it("has labels for all 5 categories", () => {
    expect(CATEGORY_LABELS["1xx"]).toBe("Informational");
    expect(CATEGORY_LABELS["2xx"]).toBe("Success");
    expect(CATEGORY_LABELS["3xx"]).toBe("Redirection");
    expect(CATEGORY_LABELS["4xx"]).toBe("Client Error");
    expect(CATEGORY_LABELS["5xx"]).toBe("Server Error");
  });
});

describe("http-status CATEGORY_COLORS", () => {
  it("has color classes for all 5 categories", () => {
    for (const cat of ["1xx", "2xx", "3xx", "4xx", "5xx"] as StatusCodeCategory[]) {
      expect(CATEGORY_COLORS[cat]).toBeTruthy();
      expect(CATEGORY_COLORS[cat]).toContain("text-");
    }
  });
});

// ===== v8.1 upgrade tests =====

import {
  getCodeDetails,
  toCurlCommand,
  buildDeepLink,
  extractCodeFromFragment,
  loadHttpHistory,
  saveHttpToHistory,
  clearHttpHistory,
  loadFavorites,
  toggleFavorite,
  filterByServer,
  SUPPORTED_SERVERS,
  exportAsCsv,
  exportAsMarkdown,
  getHttpVersionDiff,
  generateQuizQuestion,
  getRelatedCodes,
  codeToJson,
  CHEAT_SHEET_CODES,
  getCheatSheet,
} from "./logic";

describe("http getCodeDetails", () => {
  it("returns details for 404", () => {
    const d = getCodeDetails(404);
    expect(d).toBeDefined();
    expect(d?.commonCauses.length).toBeGreaterThan(0);
    expect(d?.howToFix.length).toBeGreaterThan(0);
  });
  it("returns undefined for unknown code", () => {
    expect(getCodeDetails(999)).toBeUndefined();
  });
});

describe("http toCurlCommand", () => {
  it("generates a curl command", () => {
    const cmd = toCurlCommand(404);
    expect(cmd).toContain("curl");
    expect(cmd).toContain("404");
  });
});

describe("http buildDeepLink", () => {
  it("builds a deep link", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = { location: { origin: "https://x.com", pathname: "/tools/http-status-code-reference" } };
    const url = buildDeepLink(418);
    expect(url).toContain("#code=418");
    (globalThis as any).window = origWindow;
  });
});

describe("http extractCodeFromFragment", () => {
  it("extracts code from fragment", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = { location: { hash: "#code=418" } };
    expect(extractCodeFromFragment()).toBe(418);
    (globalThis as any).window = origWindow;
  });
});

describe("http history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveHttpToHistory(404);
    const h = loadHttpHistory();
    expect(h).toHaveLength(1);
    expect(h[0].code).toBe(404);
  });
  it("clears", () => {
    saveHttpToHistory(200);
    clearHttpHistory();
    expect(loadHttpHistory()).toEqual([]);
  });
});

describe("http favorites", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("toggles favorites", () => {
    expect(loadFavorites()).toEqual([]);
    toggleFavorite(404);
    expect(loadFavorites()).toContain(404);
    toggleFavorite(404);
    expect(loadFavorites()).toEqual([]);
  });
});

describe("http filterByServer", () => {
  it("filters by Cloudflare", () => {
    const cf = filterByServer("Cloudflare");
    expect(cf.length).toBeGreaterThan(0);
    expect(cf.some((c) => c.code === 502)).toBe(true);
  });
});

describe("http SUPPORTED_SERVERS", () => {
  it("includes common servers", () => {
    expect(SUPPORTED_SERVERS).toContain("nginx");
    expect(SUPPORTED_SERVERS).toContain("Cloudflare");
  });
});

describe("http exportAsCsv", () => {
  it("generates CSV with header", () => {
    const csv = exportAsCsv();
    expect(csv).toContain("code,name,category");
    expect(csv.split("\n").length).toBeGreaterThan(10);
  });
});

describe("http exportAsMarkdown", () => {
  it("generates Markdown table", () => {
    const md = exportAsMarkdown();
    expect(md).toContain("| Code | Name |");
  });
});

describe("http getHttpVersionDiff", () => {
  it("returns diff for 421", () => {
    const diff = getHttpVersionDiff(421);
    expect(diff).toBeDefined();
    expect(diff?.http2Behavior).toContain("HTTP/2");
  });
  it("returns undefined for codes with no diff", () => {
    expect(getHttpVersionDiff(200)).toBeUndefined();
  });
});

describe("http generateQuizQuestion", () => {
  it("generates a question with 4 choices", () => {
    const q = generateQuizQuestion();
    expect(q.choices).toHaveLength(4);
    expect(q.correctIndex).toBeGreaterThanOrEqual(0);
    expect(q.correctIndex).toBeLessThan(4);
  });
});

describe("http getRelatedCodes", () => {
  it("returns codes in same category", () => {
    const related = getRelatedCodes(404);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((c) => c.category === "4xx")).toBe(true);
    expect(related.every((c) => c.code !== 404)).toBe(true);
  });
});

describe("http codeToJson", () => {
  it("formats code as JSON", () => {
    const json = codeToJson(404);
    const parsed = JSON.parse(json);
    expect(parsed.code).toBe(404);
    expect(parsed.details).toBeDefined();
  });
});

describe("http getCheatSheet", () => {
  it("returns common codes", () => {
    const cs = getCheatSheet();
    expect(cs.length).toBeGreaterThan(10);
    expect(cs.some((c) => c.code === 200)).toBe(true);
    expect(cs.some((c) => c.code === 404)).toBe(true);
  });
});
