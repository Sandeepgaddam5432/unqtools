/**
 * Text Encoding Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { convertEncoding, generateCharsetDeclaration, type TargetEncoding } from "./logic";

function strToUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("convertEncoding — UTF-8 target", () => {
  it("converts ASCII to UTF-8 (no change)", () => {
    const r = convertEncoding(strToUtf8("hello"), { target: "utf-8", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.targetEncoding).toBe("utf-8");
    expect(r.output.length).toBe(5);
  });
  it("adds BOM when bom=add", () => {
    const r = convertEncoding(strToUtf8("hello"), { target: "utf-8", bom: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.hasBom).toBe(true);
    expect(r.output[0]).toBe(0xEF);
    expect(r.output[1]).toBe(0xBB);
    expect(r.output[2]).toBe(0xBF);
  });
  it("strips BOM when bom=strip", () => {
    const withBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...strToUtf8("hello")]);
    const r = convertEncoding(withBom, { target: "utf-8", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.hasBom).toBe(false);
    expect(r.output[0]).toBe(0x68); // 'h'
  });
});

describe("convertEncoding — UTF-16", () => {
  it("converts to UTF-16 LE", () => {
    const r = convertEncoding(strToUtf8("hi"), { target: "utf-16le", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output.length).toBe(4); // 2 chars × 2 bytes
    expect(r.output[0]).toBe(0x68); // 'h' low byte
    expect(r.output[1]).toBe(0x00);
  });
  it("converts to UTF-16 BE", () => {
    const r = convertEncoding(strToUtf8("hi"), { target: "utf-16be", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output[0]).toBe(0x00); // 'h' high byte first
    expect(r.output[1]).toBe(0x68);
  });
  it("adds UTF-16 LE BOM", () => {
    const r = convertEncoding(strToUtf8("hi"), { target: "utf-16le", bom: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output[0]).toBe(0xFF);
    expect(r.output[1]).toBe(0xFE);
  });
});

describe("convertEncoding — ASCII", () => {
  it("converts ASCII text to ASCII bytes", () => {
    const r = convertEncoding(strToUtf8("hello"), { target: "ascii", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output.length).toBe(5);
  });
  it("replaces non-ASCII chars with '?' in lossy mode", () => {
    const r = convertEncoding(strToUtf8("héllo"), { target: "ascii", bom: "strip", lossy: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("'?'"))).toBe(true);
  });
  it("errors on non-ASCII chars without lossy mode", () => {
    expect("error" in convertEncoding(strToUtf8("héllo"), { target: "ascii", bom: "strip", lossy: false })).toBe(true);
  });
});

describe("convertEncoding — Latin-1 / Windows-1252", () => {
  it("converts Latin-1 chars", () => {
    const r = convertEncoding(strToUtf8("café"), { target: "latin-1", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output.length).toBe(4);
  });
  it("errors on chars outside Latin-1 range without lossy", () => {
    expect("error" in convertEncoding(strToUtf8("世界"), { target: "latin-1", bom: "strip", lossy: false })).toBe(true);
  });
});

describe("convertEncoding — sizes", () => {
  it("computes size delta", () => {
    const r = convertEncoding(strToUtf8("hello"), { target: "utf-16le", bom: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.sizeBefore).toBe(5);
    expect(r.sizeAfter).toBe(12); // 5 chars * 2 bytes + 2 BOM bytes = 12
    expect(r.sizeDelta).toBe(7);
  });
});

describe("convertEncoding — preview", () => {
  it("returns hex preview", () => {
    const r = convertEncoding(strToUtf8("AB"), { target: "utf-8", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.hexPreview).toContain("41");
    expect(r.hexPreview).toContain("42");
  });
  it("returns text preview", () => {
    const r = convertEncoding(strToUtf8("hello"), { target: "utf-8", bom: "strip" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.textPreview).toContain("hello");
  });
});

describe("generateCharsetDeclaration", () => {
  it("generates HTML for UTF-8", () => {
    const s = generateCharsetDeclaration("utf-8");
    expect(s).toContain('charset="utf-8"');
    expect(s).toContain("<meta");
  });
  it("generates HTML for Latin-1 (iso-8859-1)", () => {
    const s = generateCharsetDeclaration("latin-1");
    expect(s).toContain("iso-8859-1");
  });
});
