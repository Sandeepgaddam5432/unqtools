import { describe, it, expect } from "vitest";
import { XML_ESCAPES, XML_UNESCAPES, xmlEscape, xmlUnescape, escapeChar, validateInput } from "./logic";

describe("XML_ESCAPES", () => {
  it("maps all 5 special chars", () => {
    expect(Object.keys(XML_ESCAPES).sort()).toEqual(['"', "&", "'", "<", ">"]);
  });
});

describe("XML_UNESCAPES", () => {
  it("is the inverse of XML_ESCAPES", () => {
    for (const [k, v] of Object.entries(XML_ESCAPES)) {
      expect(XML_UNESCAPES[v]).toBe(k);
    }
  });
});

describe("escapeChar", () => {
  it("escapes a single special char", () => {
    expect(escapeChar("<")).toBe("&lt;");
  });
  it("returns the char unchanged if not special", () => {
    expect(escapeChar("x")).toBe("x");
  });
});

describe("xmlEscape", () => {
  it("escapes all special chars", () => {
    const r = xmlEscape(`<a attr="x">Tom & Jerry</a>`, { escapeQuotes: true });
    expect(r.output).toBe("&lt;a attr=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;");
  });
  it("skips quotes when escapeQuotes is false", () => {
    const r = xmlEscape(`<a attr="x">`, { escapeQuotes: false });
    expect(r.output).toBe("&lt;a attr=\"x\"&gt;");
  });
  it("counts replacements", () => {
    const r = xmlEscape("<>&", { escapeQuotes: true });
    expect(r.replacements).toBe(3);
  });
  it("handles empty input", () => {
    const r = xmlEscape("", { escapeQuotes: true });
    expect(r.output).toBe("");
    expect(r.replacements).toBe(0);
  });
  it("always escapes & first when adjacent to another special char", () => {
    const r = xmlEscape("&amp;", { escapeQuotes: false });
    // Note: this is the typical naive-escape behavior — & becomes &amp;
    expect(r.output).toBe("&amp;amp;");
  });
});

describe("xmlUnescape", () => {
  it("unescapes named entities", () => {
    const r = xmlUnescape("&lt;a&gt;Tom &amp; Jerry&lt;/a&gt;");
    expect(r.output).toBe("<a>Tom & Jerry</a>");
  });
  it("unescapes numeric entities", () => {
    const r = xmlUnescape("&#65;&#x42;");
    expect(r.output).toBe("AB");
  });
  it("counts replacements", () => {
    const r = xmlUnescape("&lt;&gt;");
    expect(r.replacements).toBe(2);
  });
  it("round-trips through escape", () => {
    const orig = `<a attr="x">Tom & Jerry</a>`;
    const escaped = xmlEscape(orig, { escapeQuotes: true }).output;
    const back = xmlUnescape(escaped).output;
    expect(back).toBe(orig);
  });
});

describe("validateInput", () => {
  it("accepts string input", () => {
    expect(validateInput("hello")).toEqual({ ok: true });
  });
  it("rejects non-string input", () => {
    expect(validateInput(42 as unknown as string)).toHaveProperty("error");
  });
});
