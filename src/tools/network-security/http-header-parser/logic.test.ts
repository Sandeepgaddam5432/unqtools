import { describe, it, expect } from "vitest";
import { parseHeaders, normalizeHeaderName, isStandardHeader, analyzeHeaders, formatReport } from "./logic";

describe("parseHeaders", () => {
  it("parses name:value lines", () => {
    const h = parseHeaders("Content-Type: application/json\nContent-Length: 42");
    expect(h.length).toBe(2);
    expect(h[0]).toEqual({ name: "Content-Type", value: "application/json" });
  });
  it("skips blank lines", () => {
    expect(parseHeaders("\n  \nX: y").length).toBe(1);
  });
  it("skips invalid lines", () => {
    expect(parseHeaders("not a header").length).toBe(0);
  });
});

describe("normalizeHeaderName", () => {
  it("lowercases", () => {
    expect(normalizeHeaderName("Content-Type")).toBe("content-type");
  });
  it("trims", () => {
    expect(normalizeHeaderName("  X-Frame  ")).toBe("x-frame");
  });
});

describe("isStandardHeader", () => {
  it("accepts standard header", () => {
    expect(isStandardHeader("Content-Type")).toBe(true);
    expect(isStandardHeader("X-Custom-Header")).toBe(false);
  });
});

describe("analyzeHeaders", () => {
  it("flags missing security headers", () => {
    const a = analyzeHeaders([{ name: "Server", value: "nginx/1.0" }]);
    expect(a.issues.length).toBeGreaterThan(0);
    expect(a.issues.some((i) => i.message.includes("HSTS"))).toBe(true);
  });
  it("passes for fully secured headers", () => {
    const a = analyzeHeaders([
      { name: "Strict-Transport-Security", value: "max-age=31536000" },
      { name: "Content-Security-Policy", value: "default-src 'self'" },
      { name: "X-Frame-Options", value: "DENY" },
      { name: "X-Content-Type-Options", value: "nosniff" },
      { name: "Referrer-Policy", value: "no-referrer" },
    ]);
    expect(a.issues.length).toBe(0);
  });
  it("warns when server header exposes version", () => {
    const a = analyzeHeaders([
      { name: "Strict-Transport-Security", value: "max-age=31536000" },
      { name: "Content-Security-Policy", value: "default-src 'self'" },
      { name: "X-Content-Type-Options", value: "nosniff" },
      { name: "Server", value: "Apache/2.4.1" },
    ]);
    expect(a.issues.some((i) => i.message.includes("exposes version"))).toBe(true);
  });
});

describe("formatReport", () => {
  it("includes header values", () => {
    const r = formatReport(analyzeHeaders([{ name: "Content-Type", value: "text/html" }]));
    expect(r).toContain("Content-Type: text/html");
    expect(r).toContain("Recommendations");
  });
});
