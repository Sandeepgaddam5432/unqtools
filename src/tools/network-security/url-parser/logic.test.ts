import { describe, it, expect, beforeEach } from "vitest";
import {
  parseUrl,
  getEffectivePort,
  isHttps,
  decodeUrlComponent,
  encodeUrlComponent,
  buildQueryString,
  DEFAULT_PORTS,
  hasPunycode,
  decodePunycode,
  getScheme,
  isSpecialScheme,
  normalizeUrl,
  DEFAULT_NORMALIZE,
  buildQrDataUrl,
  buildUrl,
  loadUrlHistory,
  saveUrlToHistory,
  clearUrlHistory,
  checkUrlSafety,
  detectRedirectHints,
  findEncodedChars,
  getSchemeInfo,
  SCHEME_REFERENCE,
  parseMailto,
  parseTel,
  diffUrls,
  type UrlBuilderParts,
} from "./logic";

describe("url-parser parseUrl", () => {
  it("parses a complete HTTPS URL", () => {
    const r = parseUrl("https://user:pass@example.com:8443/path/to/page?a=1&b=two#section");
    expect(r.isValid).toBe(true);
    expect(r.protocol).toBe("https:");
    expect(r.username).toBe("user");
    expect(r.password).toBe("pass");
    expect(r.hostname).toBe("example.com");
    expect(r.port).toBe("8443");
    expect(r.pathname).toBe("/path/to/page");
    expect(r.search).toBe("?a=1&b=two");
    expect(r.hash).toBe("#section");
    expect(r.searchParams).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "two" },
    ]);
  });

  it("parses a simple HTTPS URL without explicit port", () => {
    const r = parseUrl("https://example.com/foo");
    expect(r.isValid).toBe(true);
    expect(r.hostname).toBe("example.com");
    expect(r.port).toBe("");
    expect(r.pathname).toBe("/foo");
  });

  it("auto-prepends https:// if missing", () => {
    const r = parseUrl("example.com/path");
    expect(r.isValid).toBe(true);
    expect(r.protocol).toBe("https:");
    expect(r.hostname).toBe("example.com");
  });

  it("handles protocol-relative URLs", () => {
    const r = parseUrl("//example.com/path");
    expect(r.isValid).toBe(true);
    expect(r.hostname).toBe("example.com");
  });

  it("parses URL-encoded query params", () => {
    const r = parseUrl("https://example.com/?q=hello%20world&path=%2Ffoo%2Fbar");
    expect(r.searchParams).toEqual([
      { key: "q", value: "hello world" },
      { key: "path", value: "/foo/bar" },
    ]);
  });

  it("handles multiple values for the same key", () => {
    const r = parseUrl("https://example.com/?tag=a&tag=b&tag=c");
    expect(r.searchParams).toEqual([
      { key: "tag", value: "a" },
      { key: "tag", value: "b" },
      { key: "tag", value: "c" },
    ]);
  });

  it("returns invalid for empty input", () => {
    expect(parseUrl("").isValid).toBe(false);
    expect(parseUrl("   ").isValid).toBe(false);
  });

  it("returns invalid for malformed input", () => {
    expect(parseUrl("not a url at all :::::").isValid).toBe(false);
  });

  it("preserves the hash fragment", () => {
    const r = parseUrl("https://example.com/page#chapter-2");
    expect(r.hash).toBe("#chapter-2");
  });

  it("handles localhost URLs", () => {
    const r = parseUrl("http://localhost:3000/api/users");
    expect(r.hostname).toBe("localhost");
    expect(r.port).toBe("3000");
    expect(r.pathname).toBe("/api/users");
  });
});

describe("url-parser getEffectivePort", () => {
  it("returns explicit port if present", () => {
    const r = parseUrl("https://example.com:8443/");
    expect(getEffectivePort(r)).toBe(8443);
  });

  it("returns default port 443 for HTTPS without explicit port", () => {
    const r = parseUrl("https://example.com/");
    expect(getEffectivePort(r)).toBe(443);
  });

  it("returns default port 80 for HTTP without explicit port", () => {
    const r = parseUrl("http://example.com/");
    expect(getEffectivePort(r)).toBe(80);
  });

  it("returns null for unknown protocol without explicit port", () => {
    const r = parseUrl("foo:bar");
    expect(getEffectivePort(r)).toBe(null);
  });
});

describe("url-parser isHttps", () => {
  it("returns true for https:", () => {
    expect(isHttps(parseUrl("https://example.com/"))).toBe(true);
  });

  it("returns true for wss:", () => {
    expect(isHttps(parseUrl("wss://example.com/ws"))).toBe(true);
  });

  it("returns false for http:", () => {
    expect(isHttps(parseUrl("http://example.com/"))).toBe(false);
  });
});

describe("url-parser decodeUrlComponent / encodeUrlComponent", () => {
  it("decodes percent-encoded strings", () => {
    expect(decodeUrlComponent("hello%20world")).toBe("hello world");
    expect(decodeUrlComponent("%2Fpath%2Fto%2F")).toBe("/path/to/");
  });

  it("returns input as-is on invalid input", () => {
    expect(decodeUrlComponent("%")).toBe("%");
    expect(decodeUrlComponent("%ZZ")).toBe("%ZZ");
  });

  it("encodes special characters", () => {
    expect(encodeUrlComponent("hello world")).toBe("hello%20world");
    expect(encodeUrlComponent("/path?")).toBe("%2Fpath%3F");
  });

  it("round-trips encode/decode", () => {
    const original = "Héllo Wörld /path?a=1&b=2";
    expect(decodeUrlComponent(encodeUrlComponent(original))).toBe(original);
  });
});

describe("url-parser buildQueryString", () => {
  it("returns empty string for empty params", () => {
    expect(buildQueryString([])).toBe("");
  });

  it("builds a query string from key-value pairs", () => {
    const qs = buildQueryString([
      { key: "a", value: "1" },
      { key: "b", value: "two" },
    ]);
    expect(qs).toBe("?a=1&b=two");
  });

  it("handles multiple values for the same key", () => {
    const qs = buildQueryString([
      { key: "tag", value: "a" },
      { key: "tag", value: "b" },
    ]);
    expect(qs).toBe("?tag=a&tag=b");
  });

  it("encodes special characters in keys and values", () => {
    const qs = buildQueryString([{ key: "q", value: "hello world" }]);
    expect(qs).toBe("?q=hello+world");
  });
});

describe("url-parser DEFAULT_PORTS", () => {
  it("contains standard ports for http, https, ftp, ws, wss", () => {
    expect(DEFAULT_PORTS["http:"]).toBe(80);
    expect(DEFAULT_PORTS["https:"]).toBe(443);
    expect(DEFAULT_PORTS["ftp:"]).toBe(21);
    expect(DEFAULT_PORTS["ws:"]).toBe(80);
    expect(DEFAULT_PORTS["wss:"]).toBe(443);
  });
});

// ===== New feature tests (v8.1 upgrade) =====

describe("url-parser hasPunycode", () => {
  it("detects xn-- prefix", () => {
    expect(hasPunycode("xn--mnchen-3ya.de")).toBe(true);
    expect(hasPunycode("example.com")).toBe(false);
  });
});

describe("url-parser decodePunycode", () => {
  it("returns as-is if no punycode", () => {
    expect(decodePunycode("example.com")).toBe("example.com");
  });
  it("returns punycode as-is (no full decode impl)", () => {
    expect(decodePunycode("xn--mnchen-3ya.de")).toBe("xn--mnchen-3ya.de");
  });
});

describe("url-parser getScheme", () => {
  it("returns typed scheme for known protocols", () => {
    expect(getScheme("https:")).toBe("https");
    expect(getScheme("http:")).toBe("http");
    expect(getScheme("mailto:")).toBe("mailto");
    expect(getScheme("tel:")).toBe("tel");
  });
  it("returns 'other' for unknown", () => {
    expect(getScheme("ftp://")).toBe("other"); // has :// not :
    expect(getScheme("custom:")).toBe("other");
  });
});

describe("url-parser isSpecialScheme", () => {
  it("returns true for http/https/ftp/ws/wss/file", () => {
    expect(isSpecialScheme("http:")).toBe(true);
    expect(isSpecialScheme("https:")).toBe(true);
    expect(isSpecialScheme("ftp:")).toBe(true);
    expect(isSpecialScheme("file:")).toBe(true);
  });
  it("returns false for mailto/tel/data", () => {
    expect(isSpecialScheme("mailto:")).toBe(false);
    expect(isSpecialScheme("tel:")).toBe(false);
  });
});

describe("url-parser normalizeUrl", () => {
  it("lowercases host", () => {
    const n = normalizeUrl("HTTPS://EXAMPLE.COM/path");
    expect(n).toMatch(/example\.com/);
    expect(n).not.toMatch(/EXAMPLE\.COM/);
  });
  it("strips default port", () => {
    expect(normalizeUrl("https://example.com:443/")).toMatch(/example\.com\//);
    expect(normalizeUrl("http://example.com:80/")).toMatch(/example\.com\//);
  });
  it("sorts query params", () => {
    const n = normalizeUrl("https://example.com/?b=2&a=1");
    expect(n).toContain("a=1&b=2");
  });
  it("removes duplicate slashes", () => {
    const n = normalizeUrl("https://example.com//path///to");
    expect(n).toContain("/path/to");
    // Should not contain 3+ slashes in the path (only the // after https: is allowed)
    expect(n).not.toMatch(/\/{3,}/);
  });
  it("removes trailing slash when requested", () => {
    const n = normalizeUrl("https://example.com/path/", { ...DEFAULT_NORMALIZE, removeTrailingSlash: true });
    expect(n).not.toMatch(/\/$/);
  });
});

describe("url-parser buildUrl", () => {
  it("builds a simple URL", () => {
    const parts: UrlBuilderParts = {
      protocol: "https:",
      hostname: "example.com",
      pathname: "/path",
      searchParams: [],
      hash: "",
    };
    expect(buildUrl(parts)).toBe("https://example.com/path");
  });
  it("builds with auth and query", () => {
    const parts: UrlBuilderParts = {
      protocol: "https:",
      username: "user",
      password: "pass",
      hostname: "example.com",
      port: "8443",
      pathname: "api",
      searchParams: [{ key: "q", value: "1" }],
      hash: "section",
    };
    expect(buildUrl(parts)).toBe("https://user:pass@example.com:8443/api?q=1#section");
  });
});

describe("url-parser history (localStorage mock)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("starts empty", () => {
    expect(loadUrlHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveUrlToHistory("https://example.com");
    const h = loadUrlHistory();
    expect(h).toHaveLength(1);
    expect(h[0].url).toBe("https://example.com/");
  });
  it("deduplicates", () => {
    saveUrlToHistory("https://example.com");
    saveUrlToHistory("https://example.com");
    expect(loadUrlHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveUrlToHistory("https://example.com");
    clearUrlHistory();
    expect(loadUrlHistory()).toEqual([]);
  });
});

describe("url-parser checkUrlSafety", () => {
  it("flags IP hostnames", () => {
    const p = parseUrl("http://192.168.1.1/path");
    const f = checkUrlSafety(p);
    expect(f.some((x) => x.code === "ip-host")).toBe(true);
  });
  it("flags insecure HTTP", () => {
    const p = parseUrl("http://example.com");
    const f = checkUrlSafety(p);
    expect(f.some((x) => x.code === "insecure-http")).toBe(true);
  });
  it("flags URL shorteners", () => {
    const p = parseUrl("https://bit.ly/abc");
    const f = checkUrlSafety(p);
    expect(f.some((x) => x.code === "url-shortener")).toBe(true);
  });
  it("flags non-ASCII hostnames", () => {
    const p = parseUrl("https://пример.рф");
    const f = checkUrlSafety(p);
    expect(f.some((x) => x.code === "non-ascii-host" || x.code === "punycode")).toBe(true);
  });
  it("returns no findings for clean HTTPS URL", () => {
    const p = parseUrl("https://example.com/path");
    const f = checkUrlSafety(p);
    expect(f.filter((x) => x.severity === "high" || x.severity === "medium")).toHaveLength(0);
  });
});

describe("url-parser detectRedirectHints", () => {
  it("detects shortener", () => {
    const p = parseUrl("https://bit.ly/abc");
    expect(detectRedirectHints(p).some((h) => h.type === "shortener")).toBe(true);
  });
  it("detects redirect params", () => {
    const p = parseUrl("https://example.com/?redirect=https://evil.com");
    expect(detectRedirectHints(p).some((h) => h.type === "location-header")).toBe(true);
  });
  it("returns empty for clean URL", () => {
    const p = parseUrl("https://example.com/path");
    expect(detectRedirectHints(p)).toHaveLength(0);
  });
});

describe("url-parser findEncodedChars", () => {
  it("finds encoded chars in pathname", () => {
    const p = parseUrl("https://example.com/hello%20world");
    const e = findEncodedChars(p);
    expect(e.some((x) => x.encoded === "%20" && x.decoded === " ")).toBe(true);
  });
  it("finds encoded chars in search", () => {
    const p = parseUrl("https://example.com/?q=%2Fpath");
    const e = findEncodedChars(p);
    expect(e.some((x) => x.decoded === "/")).toBe(true);
  });
});

describe("url-parser getSchemeInfo", () => {
  it("returns info for known schemes", () => {
    const info = getSchemeInfo("https:");
    expect(info?.name).toMatch(/HTTP Secure/i);
    expect(info?.defaultPort).toBe(443);
  });
  it("returns undefined for unknown", () => {
    expect(getSchemeInfo("custom:")).toBeUndefined();
  });
});

describe("url-parser parseMailto", () => {
  it("parses simple mailto", () => {
    const m = parseMailto("mailto:user@example.com");
    expect(m?.to).toEqual(["user@example.com"]);
  });
  it("parses mailto with subject and body", () => {
    const m = parseMailto("mailto:user@example.com?subject=Hello&body=World");
    expect(m?.to).toEqual(["user@example.com"]);
    expect(m?.subject).toBe("Hello");
    expect(m?.body).toBe("World");
  });
  it("parses multiple recipients", () => {
    const m = parseMailto("mailto:a@x.com,b@y.com");
    expect(m?.to).toEqual(["a@x.com", "b@y.com"]);
  });
  it("returns null for non-mailto", () => {
    expect(parseMailto("https://example.com")).toBeNull();
  });
});

describe("url-parser parseTel", () => {
  it("parses simple tel", () => {
    const t = parseTel("tel:+15551234567");
    expect(t?.number).toBe("+15551234567");
  });
  it("parses tel with comment", () => {
    const t = parseTel("tel:+15551234567#office");
    expect(t?.number).toBe("+15551234567");
    expect(t?.comment).toBe("office");
  });
  it("returns null for non-tel", () => {
    expect(parseTel("https://example.com")).toBeNull();
  });
});

describe("url-parser diffUrls", () => {
  it("finds differences", () => {
    const left = parseUrl("https://example.com/path?a=1");
    const right = parseUrl("https://example.com/path?a=2");
    const d = diffUrls(left, right);
    const searchDiff = d.find((x) => x.field === "search");
    expect(searchDiff?.same).toBe(false);
    const hostDiff = d.find((x) => x.field === "hostname");
    expect(hostDiff?.same).toBe(true);
  });
});
