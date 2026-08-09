import { describe, it, expect } from "vitest";
import { formatXml, minifyXml, validateXml } from "./logic";

const SAMPLE = `<?xml version="1.0"?>
<root><item id="1">Hello</item><item id="2">World</item></root>`;

describe("xml-formatter", () => {
  it("validates well-formed XML", () => {
    const r = validateXml(SAMPLE);
    expect(r.ok).toBe(true);
  });

  it("rejects empty input", () => {
    const r = validateXml("   ");
    expect(r.ok).toBe(false);
  });

  it("rejects mismatched tags", () => {
    const r = validateXml("<a><b></a></b>");
    expect(r.ok).toBe(false);
  });

  it("rejects unclosed tags", () => {
    const r = validateXml("<a><b>text</a>");
    expect(r.ok).toBe(false);
  });

  it("formats with indentation", () => {
    const r = formatXml(SAMPLE, 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("\n  <item id=\"1\">");
      expect(r.output).toContain("\n  <item id=\"2\">");
      // root children indented
      expect(r.output.split("\n").length).toBeGreaterThan(3);
    }
  });

  it("minifies to compact form", () => {
    const r = minifyXml(SAMPLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).not.toContain(">\n<");
      expect(r.output).toContain("><item");
    }
  });

  it("handles self-closing and comments", () => {
    const r = formatXml(`<a><!-- c --><b/><c x="1"/></a>`, 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<b/>");
      expect(r.output).toContain("<!-- c -->");
    }
  });

  it("reports stats (lines, bytes, chars)", () => {
    const r = formatXml(`<a><b>x</b></a>`, 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stats.chars).toBeGreaterThan(0);
      expect(r.stats.bytes).toBeGreaterThan(0);
      expect(r.stats.lines).toBeGreaterThanOrEqual(1);
    }
  });
});
