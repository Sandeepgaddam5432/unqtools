import { describe, it, expect, beforeEach } from "vitest";
import {
  SEVEN_ZIP_SIGNATURE, SEVEN_ZIP_HEADER_SIZE,
  is7zSignature, is7zFile,
  parseSignatureHeader, parseNextHeader, parse7z,
  getMethodName,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type SevenZipSignatureHeader,
} from "./logic";

// Helper: build a minimal 7z file
function make7zFile(
  options: {
    majorVersion?: number;
    minorVersion?: number;
    nextHeaderOffset?: number;
    nextHeaderSize?: number;
    nextHeaderFirstByte?: number;
  } = {},
): Uint8Array {
  const major = options.majorVersion ?? 0;
  const minor = options.minorVersion ?? 4;
  const nextHeaderOffset = options.nextHeaderOffset ?? 0;
  const nextHeaderSize = options.nextHeaderSize ?? 1;
  const nextHeaderFirstByte = options.nextHeaderFirstByte ?? 0x01;
  const total = SEVEN_ZIP_HEADER_SIZE + nextHeaderOffset + nextHeaderSize;
  const bytes = new Uint8Array(total);
  // Signature
  bytes.set(SEVEN_ZIP_SIGNATURE, 0);
  bytes[6] = major;
  bytes[7] = minor;
  // StartHeader CRC (skip)
  bytes[8] = 0; bytes[9] = 0; bytes[10] = 0; bytes[11] = 0;
  // NextHeaderOffset (8 bytes LE)
  const dv = new DataView(bytes.buffer);
  dv.setUint32(12, nextHeaderOffset & 0xffffffff, true);
  dv.setUint32(16, Math.floor(nextHeaderOffset / 0x100000000), true);
  // NextHeaderSize (8 bytes LE)
  dv.setUint32(20, nextHeaderSize & 0xffffffff, true);
  dv.setUint32(24, Math.floor(nextHeaderSize / 0x100000000), true);
  // NextHeader CRC (skip)
  bytes[28] = 0; bytes[29] = 0; bytes[30] = 0; bytes[31] = 0;
  // NextHeader content
  bytes[SEVEN_ZIP_HEADER_SIZE + nextHeaderOffset] = nextHeaderFirstByte;
  return bytes;
}

// ===== is7zSignature / is7zFile =====

describe("7z-extractor is7zSignature", () => {
  it("returns true for 7z magic", () => {
    expect(is7zSignature(new Uint8Array(SEVEN_ZIP_SIGNATURE))).toBe(true);
  });
  it("returns false for ZIP magic", () => {
    expect(is7zSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x05, 0x06]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(is7zSignature(new Uint8Array([0x37, 0x7a]))).toBe(false);
  });
});

describe("7z-extractor is7zFile", () => {
  it("returns true for 7z magic", () => {
    expect(is7zFile(new Uint8Array(SEVEN_ZIP_SIGNATURE))).toBe(true);
  });
  it("returns false for non-7z", () => {
    expect(is7zFile(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBe(false);
  });
});

// ===== parseSignatureHeader =====

describe("7z-extractor parseSignatureHeader", () => {
  it("parses a valid 7z header", () => {
    const bytes = make7zFile({ majorVersion: 0, minorVersion: 4 });
    const header = parseSignatureHeader(bytes);
    expect(header.isValid).toBe(true);
    expect(header.majorVersion).toBe(0);
    expect(header.minorVersion).toBe(4);
    expect(header.signature).toEqual(SEVEN_ZIP_SIGNATURE);
  });
  it("parses NextHeaderOffset", () => {
    const bytes = make7zFile({ nextHeaderOffset: 100 });
    const header = parseSignatureHeader(bytes);
    expect(header.nextHeaderOffset).toBe(100);
  });
  it("parses NextHeaderSize", () => {
    const bytes = make7zFile({ nextHeaderSize: 500 });
    const header = parseSignatureHeader(bytes);
    expect(header.nextHeaderSize).toBe(500);
  });
  it("returns isValid=false for too-short input", () => {
    const header = parseSignatureHeader(new Uint8Array(10));
    expect(header.isValid).toBe(false);
  });
  it("returns isValid=false for non-7z input", () => {
    const bytes = new Uint8Array(SEVEN_ZIP_HEADER_SIZE);
    bytes.set([0x50, 0x4b, 0x03, 0x04, 0x05, 0x06], 0);
    const header = parseSignatureHeader(bytes);
    expect(header.isValid).toBe(false);
  });
  it("parses major version 1", () => {
    const bytes = make7zFile({ majorVersion: 1 });
    expect(parseSignatureHeader(bytes).majorVersion).toBe(1);
  });
});

// ===== parseNextHeader =====

describe("7z-extractor parseNextHeader", () => {
  it("detects compressed NextHeader (first byte 0x03)", () => {
    const bytes = make7zFile({ nextHeaderFirstByte: 0x03 });
    const header = parseSignatureHeader(bytes);
    const result = parseNextHeader(bytes, header);
    expect(result.isCompressed).toBe(true);
  });
  it("detects uncompressed NextHeader (first byte 0x01)", () => {
    const bytes = make7zFile({ nextHeaderFirstByte: 0x01 });
    const header = parseSignatureHeader(bytes);
    const result = parseNextHeader(bytes, header);
    expect(result.isCompressed).toBe(false);
  });
  it("returns error when NextHeader offset is out of bounds", () => {
    // Manually craft a header with nextHeaderOffset larger than the buffer
    const bytes = new Uint8Array(SEVEN_ZIP_HEADER_SIZE + 10); // small buffer
    bytes.set(SEVEN_ZIP_SIGNATURE, 0);
    bytes[6] = 0; bytes[7] = 4;
    const dv = new DataView(bytes.buffer);
    dv.setUint32(12, 99999, true); // nextHeaderOffset = 99999 (way beyond buffer)
    dv.setUint32(20, 100, true);   // nextHeaderSize = 100
    const header = parseSignatureHeader(bytes);
    const result = parseNextHeader(bytes, header);
    expect(result.error).toBeDefined();
  });
});

// ===== parse7z (top-level) =====

describe("7z-extractor parse7z", () => {
  it("returns isValid=true for 7z file", () => {
    const bytes = make7zFile();
    const result = parse7z(bytes);
    expect(result.isValid).toBe(true);
    expect(result.header).not.toBeNull();
  });
  it("returns isValid=false for non-7z", () => {
    const result = parse7z(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/signature/i);
  });
  it("detects compressed NextHeader", () => {
    const bytes = make7zFile({ nextHeaderFirstByte: 0x03 });
    const result = parse7z(bytes);
    expect(result.nextHeaderIsCompressed).toBe(true);
  });
  it("detects uncompressed NextHeader", () => {
    const bytes = make7zFile({ nextHeaderFirstByte: 0x01 });
    const result = parse7z(bytes);
    expect(result.nextHeaderIsCompressed).toBe(false);
  });
});

// ===== getMethodName =====

describe("7z-extractor getMethodName", () => {
  it("returns COPY for method 0", () => {
    expect(getMethodName(0)).toBe("COPY (stored)");
  });
  it("returns LZMA for method 0x030101", () => {
    expect(getMethodName(0x030101)).toBe("LZMA");
  });
  it("returns LZMA2 for method 0x21", () => {
    expect(getMethodName(0x21)).toBe("LZMA2");
  });
  it("returns BZIP2 for method 0x040202", () => {
    expect(getMethodName(0x040202)).toBe("BZIP2");
  });
  it("returns Unknown for null", () => {
    expect(getMethodName(null)).toBe("Unknown");
  });
  it("returns hex for unknown method", () => {
    expect(getMethodName(0x99)).toBe("Method 0x99");
  });
});

// ===== formatBytes =====

describe("7z-extractor formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History (localStorage) =====

describe("7z-extractor history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "archive.7z", fileSize: 1000000, fileCount: 5,
      nextHeaderIsCompressed: true, inspectedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `a${i}.7z`, fileSize: 100, fileCount: 1,
        nextHeaderIsCompressed: false, inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.7z", fileSize: 100, fileCount: 1,
      nextHeaderIsCompressed: false, inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("7z-extractor share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/7z-extractor",
    };
  });

  it("builds share URL", () => {
    const url = buildShareUrl();
    expect(url).toContain("https://example.com");
  });
  it("parses '#inspect' as true", () => {
    expect(parseShareUrl("#inspect")).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});
