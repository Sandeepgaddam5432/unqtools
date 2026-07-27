import { describe, it, expect } from "vitest";
import { FAVICON_SIZES, generateHtmlTags, generateWebmanifest, getSizes } from "./logic";

describe("Favicon Generator", () => {
  it("lists favicon sizes", () => {
    expect(FAVICON_SIZES.length).toBeGreaterThan(5);
    expect(FAVICON_SIZES.some(s => s.size === 16)).toBe(true);
  });
  it("generates HTML tags", () => {
    const tags = generateHtmlTags();
    expect(tags).toContain("rel="icon"");
    expect(tags).toContain("apple-touch-icon");
  });
  it("generates webmanifest", () => {
    const manifest = generateWebmanifest("My App");
    expect(JSON.parse(manifest).name).toBe("My App");
  });
  it("gets sizes list", () => {
    expect(getSizes()).toContain(16);
    expect(getSizes()).toContain(512);
  });
});
