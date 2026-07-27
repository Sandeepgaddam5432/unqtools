import { describe, it, expect } from "vitest";
import { generateMockup, defaultOptions, getBrowserPresets } from "./logic";

describe("Browser Frame Mockup", () => {
  it("generates Chrome frame", () => {
    const html = generateMockup({ ...defaultOptions(), browser: "chrome" });
    expect(html).toContain("div");
    expect(html).toContain("example.com");
  });
  it("generates Safari frame", () => {
    const html = generateMockup({ ...defaultOptions(), browser: "safari" });
    expect(html).toContain("div");
  });
  it("lists browser presets", () => {
    expect(getBrowserPresets().length).toBe(4);
  });
});
