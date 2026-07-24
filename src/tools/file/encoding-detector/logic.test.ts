/**
 * File Encoding Detector — unit tests.
 */
import { describe, it, expect } from "vitest";
import { detectEncoding, decodeWithEncoding, detectionToCsv } from "./logic";

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("detectEncoding", () => {
  it("detects UTF-8 with BOM", () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...strToBytes("hello")]);
    const r = detectEncoding(bytes);
    expect(r.bom.present).toBe(true);
    expect(r.bom.type).toBe("utf-8");
    expect(r.detected).toBe("utf-8");
    expect(r.confidence).toBe(1.0);
  });
  it("detects UTF-16 LE with BOM", () => {
    const bytes = new Uint8Array([0xFF, 0xFE, 0x68, 0x00, 0x69, 0x00]); // "hi" in UTF-16 LE
    const r = detectEncoding(bytes);
    expect(r.bom.type).toBe("utf-16le");
    expect(r.detected).toBe("utf-16le");
  });
  it("detects UTF-16 BE with BOM", () => {
    const bytes = new Uint8Array([0xFE, 0xFF, 0x00, 0x68, 0x00, 0x69]); // "hi" in UTF-16 BE
    const r = detectEncoding(bytes);
    expect(r.bom.type).toBe("utf-16be");
  });
  it("detects pure ASCII", () => {
    const r = detectEncoding(strToBytes("Hello world"));
    expect(r.detected).toBe("ascii");
    expect(r.printableAsciiRatio).toBeGreaterThan(0.99);
  });
  it("detects UTF-8 with multibyte chars", () => {
    const r = detectEncoding(strToBytes("Hello — 世界 🎉"));
    expect(r.detected).toBe("utf-8");
    expect(r.confidence).toBeGreaterThan(0.9);
  });
  it("flags binary content with null bytes", () => {
    const bytes = new Uint8Array(100);
    bytes.fill(0, 0, 50); // half null bytes
    const r = detectEncoding(bytes);
    expect(r.nullByteCount).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes("binary"))).toBe(true);
  });
  it("computes byte histogram", () => {
    const r = detectEncoding(strToBytes("aaabbc"));
    expect(r.byteHistogram.length).toBeGreaterThan(0);
    expect(r.byteHistogram[0]!.count).toBe(3); // 'a' appears 3 times
  });
  it("returns first 4 bytes as hex", () => {
    const r = detectEncoding(strToBytes("Hello"));
    expect(r.firstFourBytes).toBe("48 65 6c 6c");
  });
  it("detects line endings", () => {
    const r = detectEncoding(strToBytes("a\nb\nc\n"));
    expect(r.lineEndings).toBe("lf");
  });
  it("returns preview hex and printable", () => {
    const r = detectEncoding(strToBytes("ABC"));
    expect(r.preview.hex).toContain("41");
    expect(r.preview.printable).toContain("A");
  });
});

describe("decodeWithEncoding", () => {
  it("decodes UTF-8 bytes", () => {
    const bytes = strToBytes("hello");
    expect(decodeWithEncoding(bytes, "utf-8")).toBe("hello");
  });
  it("handles invalid encoding gracefully", () => {
    const bytes = strToBytes("test");
    expect(decodeWithEncoding(bytes, "binary")).toBe("test");
  });
});

describe("detectionToCsv", () => {
  it("generates CSV with header", () => {
    const r = detectEncoding(strToBytes("hello"));
    const csv = detectionToCsv([{ fileName: "test.txt", result: r }]);
    expect(csv.split("\n")[0]).toContain("FileName");
    expect(csv).toContain("test.txt");
    expect(csv).toContain("ascii");
  });
});
