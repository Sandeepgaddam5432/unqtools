import { describe, it, expect } from "vitest";
import { parseHeaders, analyzeHeaders, getScoreLabel } from "./logic";

describe("HTTP Headers Analyzer", () => {
  it("parses headers", () => {
    const headers = parseHeaders("Content-Type: text/html\nServer: nginx");
    expect(headers.length).toBe(2);
    expect(headers[0].name).toBe("Content-Type");
  });
  it("analyzes security headers", () => {
    const headers = parseHeaders("Content-Security-Policy: default-src 'self'\nStrict-Transport-Security: max-age=31536000");
    const result = analyzeHeaders(headers);
    expect(result.securityHeaders.length).toBeGreaterThan(0);
  });
  it("detects missing security headers", () => {
    const headers = parseHeaders("Content-Type: text/html");
    const result = analyzeHeaders(headers);
    expect(result.missingSecurityHeaders.length).toBeGreaterThan(0);
  });
  it("warns about server header", () => {
    const headers = parseHeaders("Server: nginx");
    const result = analyzeHeaders(headers);
    expect(result.warnings.some(w => w.includes("Server"))).toBe(true);
  });
  it("gets score label", () => {
    expect(getScoreLabel(95)).toBe("A+");
    expect(getScoreLabel(40)).toBe("F");
  });
});
