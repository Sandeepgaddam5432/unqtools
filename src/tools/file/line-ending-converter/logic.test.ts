/**
 * Line Ending Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { detectLineEndings, convertLineEndings, generateGitattributes, generateEditorConfig, previewLines } from "./logic";

describe("detectLineEndings", () => {
  it("detects LF-only text", () => {
    const r = detectLineEndings("a\nb\nc\n");
    expect(r.detected).toBe("lf");
    expect(r.lfCount).toBe(3);
    expect(r.crlfCount).toBe(0);
    expect(r.crCount).toBe(0);
  });
  it("detects CRLF-only text", () => {
    const r = detectLineEndings("a\r\nb\r\nc\r\n");
    expect(r.detected).toBe("crlf");
    expect(r.crlfCount).toBe(3);
    expect(r.lfCount).toBe(0);
  });
  it("detects CR-only text", () => {
    const r = detectLineEndings("a\rb\rc\r");
    expect(r.detected).toBe("cr");
    expect(r.crCount).toBe(3);
  });
  it("detects mixed line endings", () => {
    const r = detectLineEndings("a\nb\r\nc\rd\n");
    expect(r.detected).toBe("mixed");
    expect(r.warnings.some((w) => w.includes("Mixed"))).toBe(true);
  });
  it("detects no line endings", () => {
    const r = detectLineEndings("single line");
    expect(r.detected).toBe("none");
    expect(r.totalLines).toBe(0);
  });
  it("detects BOM", () => {
    const r = detectLineEndings("\uFEFFhello\n");
    expect(r.hasBom).toBe(true);
    expect(r.warnings.some((w) => w.includes("BOM"))).toBe(true);
  });
});

describe("convertLineEndings", () => {
  it("converts LF to CRLF", () => {
    const r = convertLineEndings("a\nb\nc\n", { target: "crlf" });
    expect(r.output).toBe("a\r\nb\r\nc\r\n");
    expect(r.source.detected).toBe("lf");
    expect(r.target).toBe("crlf");
  });
  it("converts CRLF to LF", () => {
    const r = convertLineEndings("a\r\nb\r\nc\r\n", { target: "lf" });
    expect(r.output).toBe("a\nb\nc\n");
  });
  it("converts mixed to LF", () => {
    const r = convertLineEndings("a\nb\r\nc\rd\n", { target: "lf" });
    expect(r.output).toBe("a\nb\nc\nd\n");
  });
  it("converts to CR", () => {
    const r = convertLineEndings("a\nb\n", { target: "cr" });
    expect(r.output).toBe("a\rb\r");
  });
  it("computes size delta", () => {
    const r = convertLineEndings("a\nb\nc\n", { target: "crlf" });
    expect(r.sizeBefore).toBe(6);
    expect(r.sizeAfter).toBe(9); // 3 extra \r bytes
    expect(r.sizeDelta).toBe(3);
  });
  it("counts converted lines", () => {
    const r = convertLineEndings("a\nb\nc\n", { target: "crlf" });
    expect(r.convertedCount).toBe(3);
  });
  it("strips BOM when requested", () => {
    const r = convertLineEndings("\uFEFFhello\n", { target: "lf", stripBom: true });
    expect(r.output.startsWith("\uFEFF")).toBe(false);
  });
  it("preserves BOM by default", () => {
    const r = convertLineEndings("\uFEFFhello\n", { target: "lf" });
    expect(r.output.startsWith("\uFEFF")).toBe(true);
  });
});

describe("generateGitattributes", () => {
  it("generates LF config", () => {
    const s = generateGitattributes("lf");
    expect(s).toContain("eol=lf");
    expect(s).toContain("text=auto");
    expect(s).toContain("*.png binary");
  });
  it("generates CRLF config", () => {
    const s = generateGitattributes("crlf");
    expect(s).toContain("eol=crlf");
  });
});

describe("generateEditorConfig", () => {
  it("generates LF config", () => {
    const s = generateEditorConfig("lf");
    expect(s).toContain("end_of_line = lf");
    expect(s).toContain("root = true");
  });
  it("generates CRLF config", () => {
    const s = generateEditorConfig("crlf");
    expect(s).toContain("end_of_line = crlf");
  });
});

describe("previewLines", () => {
  it("returns first N lines of both", () => {
    const r = previewLines("a\nb\nc\nd\ne\nf\n", "a\r\nb\r\nc\r\nd\r\ne\r\nf\r\n", 3);
    expect(r.before.length).toBe(3);
    expect(r.after.length).toBe(3);
    expect(r.before[0]).toBe("a");
    expect(r.after[0]).toBe("a");
  });
});
