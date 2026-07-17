import { describe, it, expect, beforeEach } from "vitest";
import {
  parseUrl,
  isValidUrl,
  analyzeChain,
  renderChainText,
  renderReport,
  parseBulkHops,
  REDIRECT_TYPES,
  REDIRECT_TYPE_LIST,
  LONG_CHAIN_THRESHOLD,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RedirectHop,
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

describe("redirect-chain-checker parseUrl", () => {
  it("returns invalid for empty URL", () => {
    const r = parseUrl("");
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it("parses a valid https URL", () => {
    const r = parseUrl("https://example.com/path?q=1#hash");
    expect(r.valid).toBe(true);
    expect(r.protocol).toBe("https:");
    expect(r.hostname).toBe("example.com");
    expect(r.pathname).toBe("/path");
    expect(r.search).toBe("?q=1");
    expect(r.hash).toBe("#hash");
  });
  it("parses a URL with port", () => {
    const r = parseUrl("http://localhost:3000/api");
    expect(r.valid).toBe(true);
    expect(r.port).toBe("3000");
  });
  it("returns invalid for non-URL string", () => {
    const r = parseUrl("not-a-url");
    expect(r.valid).toBe(false);
  });
  it("trims whitespace", () => {
    const r = parseUrl("  https://example.com  ");
    expect(r.valid).toBe(true);
    expect(r.hostname).toBe("example.com");
  });
});

describe("redirect-chain-checker isValidUrl", () => {
  it("returns true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });
  it("returns false for invalid", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("redirect-chain-checker REDIRECT_TYPES", () => {
  it("has 7 redirect types", () => {
    expect(Object.keys(REDIRECT_TYPES)).toHaveLength(7);
  });
  it("each type has required fields", () => {
    for (const info of Object.values(REDIRECT_TYPES)) {
      expect(info.code).toBeTruthy();
      expect(info.name).toBeTruthy();
      expect(typeof info.permanent).toBe("boolean");
      expect(info.description).toBeTruthy();
      expect(info.useCase).toBeTruthy();
      expect(info.seoImpact).toBeTruthy();
    }
  });
  it("marks 301 and 308 as permanent", () => {
    expect(REDIRECT_TYPES["301"].permanent).toBe(true);
    expect(REDIRECT_TYPES["308"].permanent).toBe(true);
  });
  it("marks 302, 303, 307 as temporary", () => {
    expect(REDIRECT_TYPES["302"].permanent).toBe(false);
    expect(REDIRECT_TYPES["303"].permanent).toBe(false);
    expect(REDIRECT_TYPES["307"].permanent).toBe(false);
  });
  it("REDIRECT_TYPE_LIST is an array", () => {
    expect(Array.isArray(REDIRECT_TYPE_LIST)).toBe(true);
    expect(REDIRECT_TYPE_LIST.length).toBe(7);
  });
});

describe("redirect-chain-checker analyzeChain", () => {
  it("returns empty stats for no hops", () => {
    const s = analyzeChain([]);
    expect(s.hopCount).toBe(0);
    expect(s.finalUrl).toBe("");
    expect(s.warnings.length).toBeGreaterThan(0);
  });
  it("counts hops correctly", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
      { step: 2, fromUrl: "https://b.com", toUrl: "https://c.com", redirectType: "301" },
    ];
    expect(analyzeChain(hops).hopCount).toBe(2);
  });
  it("identifies final URL", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
    ];
    expect(analyzeChain(hops).finalUrl).toBe("https://b.com");
  });
  it("flags temporary redirects", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "302" },
    ];
    const s = analyzeChain(hops);
    expect(s.hasTemporary).toBe(true);
    expect(s.allPermanent).toBe(false);
    expect(s.warnings.some((w) => /temporary/i.test(w))).toBe(true);
  });
  it("flags meta refresh", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "meta-refresh" },
    ];
    const s = analyzeChain(hops);
    expect(s.hasMetaRefresh).toBe(true);
    expect(s.warnings.some((w) => /meta refresh/i.test(w))).toBe(true);
  });
  it("flags javascript redirects", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "javascript" },
    ];
    const s = analyzeChain(hops);
    expect(s.hasJavascript).toBe(true);
    expect(s.warnings.some((w) => /javascript/i.test(w))).toBe(true);
  });
  it("flags long chains over threshold", () => {
    const hops: RedirectHop[] = Array.from({ length: LONG_CHAIN_THRESHOLD + 1 }, (_, i) => ({
      step: i + 1,
      fromUrl: `https://a${i}.com`,
      toUrl: `https://a${i + 1}.com`,
      redirectType: "301" as const,
    }));
    const s = analyzeChain(hops);
    expect(s.isLongChain).toBe(true);
    expect(s.warnings.some((w) => /long/i.test(w))).toBe(true);
  });
  it("detects redirect loops", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
      { step: 2, fromUrl: "https://b.com", toUrl: "https://a.com", redirectType: "301" },
    ];
    const s = analyzeChain(hops);
    expect(s.warnings.some((w) => /loop/i.test(w))).toBe(true);
  });
  it("returns allPermanent=true for 301/308 only", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
      { step: 2, fromUrl: "https://b.com", toUrl: "https://c.com", redirectType: "308" },
    ];
    expect(analyzeChain(hops).allPermanent).toBe(true);
  });
});

describe("redirect-chain-checker renderChainText", () => {
  it("returns empty for no hops", () => {
    expect(renderChainText([])).toBe("");
  });
  it("renders START / arrows / END", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
    ];
    const out = renderChainText(hops);
    expect(out).toContain("START: https://a.com");
    expect(out).toContain("[301]");
    expect(out).toContain("→ https://b.com");
    expect(out).toContain("END: https://b.com");
  });
  it("includes notes when present", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301", note: "Domain migration" },
    ];
    expect(renderChainText(hops)).toContain("note: Domain migration");
  });
});

describe("redirect-chain-checker renderReport", () => {
  it("produces a markdown report", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
    ];
    const stats = analyzeChain(hops);
    const md = renderReport("https://a.com", hops, stats);
    expect(md).toContain("# Redirect Chain Report");
    expect(md).toContain("**Start URL:** https://a.com");
    expect(md).toContain("**Final URL:** https://b.com");
    expect(md).toContain("## How to verify live");
  });
  it("includes warnings section when warnings exist", () => {
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://a.com", redirectType: "302" },
    ];
    const stats = analyzeChain(hops);
    const md = renderReport("https://a.com", hops, stats);
    expect(md).toContain("## Warnings");
  });
});

describe("redirect-chain-checker parseBulkHops", () => {
  it("returns empty for empty text", () => {
    expect(parseBulkHops("")).toEqual([]);
  });
  it("parses 'from | type | to' lines", () => {
    const out = parseBulkHops("https://a.com | 301 | https://b.com\nhttps://b.com | 302 | https://c.com");
    expect(out).toHaveLength(2);
    expect(out[0].fromUrl).toBe("https://a.com");
    expect(out[0].redirectType).toBe("301");
    expect(out[1].redirectType).toBe("302");
  });
  it("defaults to 301 for unknown type", () => {
    const out = parseBulkHops("https://a.com | unknown | https://b.com");
    expect(out[0].redirectType).toBe("301");
  });
  it("skips invalid lines", () => {
    const out = parseBulkHops("invalid line\nhttps://a.com | 301 | https://b.com");
    expect(out).toHaveLength(1);
  });
  it("captures optional 4th column as note", () => {
    const out = parseBulkHops("https://a.com | 301 | https://b.com | migration note");
    expect(out[0].note).toBe("migration note");
  });
});

describe("redirect-chain-checker history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, startUrl: "https://a.com", hopCount: 2, warningCount: 1, snippet: "x" });
    saveHistory({ ts: 2, startUrl: "https://b.com", hopCount: 3, warningCount: 0, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].startUrl).toBe("https://b.com");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, startUrl: "x", hopCount: 1, warningCount: 0, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, startUrl: "x", hopCount: 1, warningCount: 0, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("redirect-chain-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
    ];
    const url = buildShareUrl("https://a.com", hops);
    expect(url).toContain("url=");
    expect(url).toContain("hops=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to inputs", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const hops: RedirectHop[] = [
      { step: 1, fromUrl: "https://a.com", toUrl: "https://b.com", redirectType: "301" },
      { step: 2, fromUrl: "https://b.com", toUrl: "https://c.com", redirectType: "302" },
    ];
    const url = buildShareUrl("https://a.com", hops);
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash);
    expect(parsed.url).toBe("https://a.com");
    expect(parsed.hops).toHaveLength(2);
    expect(parsed.hops?.[0].redirectType).toBe("301");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("returns empty for malformed JSON hops", () => {
    expect(parseShareUrl("url=https://a.com&hops=notjson")).toEqual({ url: "https://a.com" });
  });
});

describe("redirect-chain-checker constants", () => {
  it("has LONG_CHAIN_THRESHOLD of 5", () => {
    expect(LONG_CHAIN_THRESHOLD).toBe(5);
  });
});
