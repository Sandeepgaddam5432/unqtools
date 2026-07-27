import { describe, it, expect } from "vitest";
import { generateCSP, defaultConfig, validateCSP, getPresets } from "./logic";

describe("CSP Generator", () => {
  it("generates CSP header from default config", () => {
    const csp = generateCSP(defaultConfig());
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });
  it("generates report-only header", () => {
    const config = { ...defaultConfig(), reportOnly: true };
    expect(generateCSP(config)).toContain("Report-Only");
  });
  it("validates CSP config", () => {
    const result = validateCSP(defaultConfig());
    expect(result.issues).not.toContain("Missing default-src directive");
  });
  it("flags missing default-src", () => {
    const config = { ...defaultConfig(), directives: defaultConfig().directives.filter(d => d.name !== "default-src") };
    expect(validateCSP(config).issues).toContain("Missing default-src directive");
  });
  it("warns about unsafe-inline in script-src", () => {
    const config = { ...defaultConfig(), directives: defaultConfig().directives.map(d => d.name === "script-src" ? { ...d, sources: ["'self'", "'unsafe-inline'"] } : d) };
    expect(validateCSP(config).warnings).toContain("script-src contains 'unsafe-inline' — consider using nonces or hashes");
  });
  it("provides presets", () => {
    expect(getPresets().length).toBeGreaterThan(0);
    expect(getPresets().some(p => p.name === "Strict")).toBe(true);
  });
});
