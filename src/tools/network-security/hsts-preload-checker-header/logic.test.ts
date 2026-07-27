import { describe, it, expect } from "vitest";
import { generateHSTSHeader, parseHSTSHeader, checkPreloadEligibility, getMaxAgePresets, formatDuration } from "./logic";

describe("HSTS Preload Checker", () => {
  it("generates HSTS header", () => {
    expect(generateHSTSHeader(31536000, true, true)).toContain("max-age=31536000");
    expect(generateHSTSHeader(31536000, true, true)).toContain("includeSubDomains");
    expect(generateHSTSHeader(31536000, true, true)).toContain("preload");
  });
  it("parses HSTS header", () => {
    const h = parseHSTSHeader("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
    expect(h?.maxAge).toBe(31536000);
    expect(h?.includeSubDomains).toBe(true);
    expect(h?.preload).toBe(true);
  });
  it("checks preload eligibility", () => {
    const result = checkPreloadEligibility("https://example.com");
    expect(result.isHttps).toBe(true);
    expect(result.ready).toBe(false);
  });
  it("checks preload readiness", () => {
    const hsts = { maxAge: 31536000, includeSubDomains: true, preload: true, raw: "" };
    const result = checkPreloadEligibility("https://example.com", hsts);
    expect(result.ready).toBe(true);
  });
  it("lists max-age presets", () => {
    expect(getMaxAgePresets().length).toBeGreaterThan(3);
  });
  it("formats duration", () => {
    expect(formatDuration(31536000)).toContain("year");
  });
});
