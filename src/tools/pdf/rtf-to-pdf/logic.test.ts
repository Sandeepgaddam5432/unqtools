import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractTextFromRtf, rtfToPdf } from "./logic";
const baseOpts = { fontSize: 12, pageSize: "a4" as const, orientation: "portrait" as const, margin: 50 };
const sampleRtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Helvetica;}} \\f0\\fs24 Hello World\\par This is bold text\\par \\b Bold\\b0 \\i Italic\\i0}';
describe("extractTextFromRtf", () => {
  it("extracts text from simple RTF", () => { const text = extractTextFromRtf(sampleRtf); expect(text).toContain("Hello World"); });
  it("strips font table", () => { const text = extractTextFromRtf(sampleRtf); expect(text).not.toContain("fonttbl"); expect(text).not.toContain("Helvetica"); });
  it("strips control words", () => { const text = extractTextFromRtf(sampleRtf); expect(text).not.toContain("\\par"); expect(text).not.toContain("\\b"); });
  it("strips braces", () => { const text = extractTextFromRtf(sampleRtf); expect(text).not.toContain("{"); expect(text).not.toContain("}"); });
  it("handles empty RTF", () => { expect(extractTextFromRtf("")).toBe(""); });
});
describe("rtfToPdf", () => {
  it("converts simple RTF to PDF", async () => { const r = await rtfToPdf(sampleRtf, baseOpts); expect(r.ok).toBe(true); if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBe(1); });
  it("errors on empty input", async () => { const r = await rtfToPdf("", baseOpts); expect(r.ok).toBe(false); });
  it("errors on non-RTF input", async () => { const r = await rtfToPdf("Just plain text", baseOpts); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain("valid RTF"); });
  it("errors on RTF with no extractable text", async () => { const r = await rtfToPdf("{\\rtf1\\ansi}", baseOpts); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain("No text content"); });
  it("handles letter page + landscape", async () => { const r = await rtfToPdf(sampleRtf, { ...baseOpts, pageSize: "letter", orientation: "landscape" }); expect(r.ok).toBe(true); });
  it("sets creator metadata", async () => { const r = await rtfToPdf(sampleRtf, baseOpts); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getCreator()).toContain("UnQTools"); } });
  it("extracts text with paragraph breaks", async () => { const r = await rtfToPdf(sampleRtf, baseOpts); expect(r.ok).toBe(true); });
});

describe("rtf extraction advanced", () => {
  it("handles unicode escapes \\uN", async () => {
    const { extractRtfText } = await import("./logic");
    const rtf = "{\\rtf1 Caf\\u233? \\u2339?}";
    const t = extractRtfText(rtf);
    expect(t).toContain("Caf\u00e9");
  });

  it("handles hex escapes \\'xx", async () => {
    const { extractRtfText } = await import("./logic");
    const rtf = "{\\rtf1 caf\\'e9}";
    expect(extractRtfText(rtf)).toContain("caf\u00e9");
  });

  it("turns \\par and \\tab into structure", async () => {
    const { extractRtfText } = await import("./logic");
    const rtf = "{\\rtf1 hello\\tab world\\par second line}";
    const t = extractRtfText(rtf);
    expect(t).toContain("\t");
    expect(t).toContain("\n");
    expect(t).toContain("second line");
  });

  it("strips formatting control words", async () => {
    const { extractRtfText } = await import("./logic");
    const rtf = "{\\rtf1\\b Bold text\\b0 normal}";
    const t = extractRtfText(rtf);
    expect(t).toContain("Bold text");
    expect(t).toContain("normal");
    expect(t).not.toContain("\\b");
  });

  it("escaped braces survive", async () => {
    const { extractRtfText } = await import("./logic");
    const rtf = "{\\rtf1 literal \\{ brace \\} end}";
    const t = extractRtfText(rtf);
    expect(t).toContain("{");
    expect(t).toContain("}");
  });

  it("rejects non-RTF input", async () => {
    const r = await rtfToPdf("plain text without rtf marker");
    expect(r.ok).toBe(false);
  });
});
