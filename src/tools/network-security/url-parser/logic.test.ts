import { describe, it, expect } from "vitest";
import {
  parseUrl,
  getEffectivePort,
  isHttps,
  decodeUrlComponent,
  encodeUrlComponent,
  buildQueryString,
  DEFAULT_PORTS,
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
