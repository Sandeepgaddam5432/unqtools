import { describe, it, expect } from "vitest";
import { generateHtaccess, validateHtaccess, DEFAULTS } from "./logic";

describe("Apache .htaccess Generator", () => {
  it("generates basic htaccess", () => {
    const r = generateHtaccess(DEFAULTS);
    expect(r).toContain("Options -Indexes");
    expect(r).toContain("mod_deflate");
  });
  it("generates HTTPS redirect", () => {
    const r = generateHtaccess({ ...DEFAULTS, forceHttps: true });
    expect(r).toContain("RewriteCond %{HTTPS} off");
  });
  it("generates IP blocks", () => {
    const r = generateHtaccess({ ...DEFAULTS, blockIps: ["1.2.3.4"] });
    expect(r).toContain("Require not ip 1.2.3.4");
  });
  it("generates CORS headers", () => {
    const r = generateHtaccess({ ...DEFAULTS, enableCors: true, corsOrigin: "https://example.com" });
    expect(r).toContain("https://example.com");
  });
  it("generates redirects", () => {
    const r = generateHtaccess({ ...DEFAULTS, redirectRules: [{ from: "/old", to: "/new", type: "301" }] });
    expect(r).toContain("Redirect 301 /old /new");
  });
  it("validates content", () => {
    const v = validateHtaccess("RewriteEngine On\nRewriteEngine On\nRewriteEngine On\nRewriteEngine On");
    expect(v.warnings.length).toBeGreaterThan(0);
  });
});
