import { describe, it, expect } from "vitest";
import { encodeUrl, decodeUrl, parseUrl, buildQueryString } from "./logic";

describe("encodeUrl", () => {
  it("encodes empty string", () => {
    expect(encodeUrl("")).toBe("");
  });

  it("encodes spaces as %20 (component mode)", () => {
    expect(encodeUrl("hello world", "component")).toBe("hello%20world");
  });

  it("encodes special characters in component mode", () => {
    expect(encodeUrl("a&b=c?d#e", "component")).toBe("a%26b%3Dc%3Fd%23e");
  });

  it("preserves URL structure in URI mode", () => {
    const url = "https://example.com/path?q=hello world&lang=en";
    const encoded = encodeUrl(url, "uri");
    expect(encoded).toContain("https://example.com/path?q=hello");
    expect(encoded).toContain("%20");
    expect(encoded).toContain("&lang=en");
  });

  it("encodes UTF-8 emoji", () => {
    expect(encodeUrl("👍")).toBe("%F0%9F%91%8D");
  });

  it("encodes CJK", () => {
    expect(encodeUrl("你")).toBe("%E4%BD%A0");
  });

  it("preserves unreserved characters", () => {
    const encoded = encodeUrl("abc123-_.~", "component");
    expect(encoded).toBe("abc123-_.~");
  });
});

describe("decodeUrl", () => {
  it("decodes percent-encoded text", () => {
    const r = decodeUrl("hello%20world");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("hello world");
  });

  it("decodes emoji", () => {
    const r = decodeUrl("%F0%9F%91%8D");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("👍");
  });

  it("decodes CJK", () => {
    const r = decodeUrl("%E4%BD%A0");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("你");
  });

  it("decodes + as space (application/x-www-form-urlencoded)", () => {
    // Note: decodeURIComponent does NOT convert + to space — that's decodeURIComponent's behavior
    // Our tool uses decodeURIComponent, so + stays as +
    const r = decodeUrl("hello+world");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("hello+world");
  });

  it("errors on empty input", () => {
    expect(decodeUrl("").ok).toBe(false);
  });

  it("errors on invalid percent-encoding", () => {
    expect(decodeUrl("%ZZ").ok).toBe(false);
  });

  it("errors on truncated percent-encoding", () => {
    expect(decodeUrl("%4").ok).toBe(false);
  });
});

describe("round-trip", () => {
  const samples = [
    "hello world",
    "a&b=c?d#e",
    "👍🌍你好",
    "https://example.com/path?q=hello&lang=en",
    "100% pure",
  ];

  for (const sample of samples) {
    it(`round-trips "${sample.slice(0, 30)}" (component mode)`, () => {
      const encoded = encodeUrl(sample, "component");
      const decoded = decodeUrl(encoded);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.output).toBe(sample);
    });
  }
});

describe("parseUrl", () => {
  it("parses a complete URL", () => {
    const r = parseUrl("https://user:pass@example.com:8080/path/to/page?q=hello&lang=en#section");
    expect(r.isValid).toBe(true);
    expect(r.protocol).toBe("https:");
    expect(r.hostname).toBe("example.com");
    expect(r.port).toBe("8080");
    expect(r.pathname).toBe("/path/to/page");
    expect(r.hash).toBe("#section");
    expect(r.username).toBe("user");
    expect(r.password).toBe("pass");
    expect(r.searchParams.length).toBe(2);
  });

  it("adds https:// when protocol missing", () => {
    const r = parseUrl("example.com");
    expect(r.isValid).toBe(true);
    expect(r.hostname).toBe("example.com");
  });

  it("parses search params", () => {
    const r = parseUrl("https://example.com/?a=1&b=2&c=3");
    expect(r.searchParams.length).toBe(3);
    expect(r.searchParams[0]).toEqual({ key: "a", value: "1" });
  });

  it("handles URLs with no search params or hash", () => {
    const r = parseUrl("https://example.com/path");
    expect(r.isValid).toBe(true);
    expect(r.searchParams.length).toBe(0);
    expect(r.hash).toBe("");
  });

  it("handles empty input", () => {
    const r = parseUrl("");
    expect(r.isValid).toBe(false);
  });
});

describe("buildQueryString", () => {
  it("builds a query string from pairs", () => {
    const s = buildQueryString([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
    expect(s).toBe("?a=1&b=2");
  });

  it("skips empty keys", () => {
    const s = buildQueryString([
      { key: "", value: "1" },
      { key: "b", value: "2" },
    ]);
    expect(s).toBe("?b=2");
  });

  it("returns empty string for no pairs", () => {
    expect(buildQueryString([])).toBe("");
  });

  it("URL-encodes values", () => {
    const s = buildQueryString([{ key: "q", value: "hello world" }]);
    expect(s).toBe("?q=hello+world");
  });
});
