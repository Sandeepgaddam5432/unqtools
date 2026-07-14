import { describe, it, expect, beforeEach } from "vitest";
import {
  bytesToHex, bytesToBase64, formatBytes, hexDump, shannonEntropy, entropyHint,
  detectEncoding, lookupSignature, parseJpegExif, hasSensitiveExif,
  metadataToJson, loadHistory, saveToHistory, clearHistory, buildShareUrl,
  FILE_SIGNATURES,
} from "./logic";

describe("file-metadata bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
});

describe("file-metadata bytesToBase64", () => {
  it("converts bytes to base64", () => {
    expect(bytesToBase64(new Uint8Array([72, 101, 108, 108, 111]))).toBe("SGVsbG8=");
  });
});

describe("file-metadata formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("file-metadata hexDump", () => {
  it("generates hex dump with offset", () => {
    const dump = hexDump(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    expect(dump).toContain("00000000");
    expect(dump).toContain("48 65 6c 6c 6f");
    expect(dump).toContain("|Hello|");
  });
  it("respects maxLines (2 hex lines + optional truncation)", () => {
    const dump = hexDump(new Uint8Array(64), 2);
    const lines = dump.split("\n");
    // 2 hex lines + 1 truncation message line
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^00000000/);
    expect(lines[1]).toMatch(/^00000010/);
    expect(lines[2]).toContain("truncated");
  });
  it("returns exact line count for input fitting in maxLines", () => {
    const dump = hexDump(new Uint8Array(32), 2);
    const lines = dump.split("\n");
    expect(lines.length).toBe(2);
  });
  it("truncates long input", () => {
    const dump = hexDump(new Uint8Array(512), 4);
    expect(dump).toContain("more bytes truncated");
  });
});

describe("file-metadata shannonEntropy", () => {
  it("returns 0 for empty input", () => {
    expect(shannonEntropy(new Uint8Array())).toBe(0);
  });
  it("returns 0 for single repeated byte", () => {
    expect(shannonEntropy(new Uint8Array([0, 0, 0, 0]))).toBe(0);
  });
  it("returns ~8 for uniform random distribution", () => {
    const arr = new Uint8Array(256);
    for (let i = 0; i < 256; i++) arr[i] = i;
    const e = shannonEntropy(arr);
    expect(e).toBeCloseTo(8, 1);
  });
  it("returns low entropy for plain text", () => {
    const text = new TextEncoder().encode("hello world hello world");
    expect(shannonEntropy(text)).toBeLessThan(4);
  });
});

describe("file-metadata entropyHint", () => {
  it("very low", () => {
    expect(entropyHint(0.5)).toMatch(/Very low/);
  });
  it("low", () => {
    expect(entropyHint(2)).toMatch(/Low/);
  });
  it("moderate", () => {
    expect(entropyHint(4)).toMatch(/Moderate/);
  });
  it("high", () => {
    expect(entropyHint(6)).toMatch(/High/);
  });
  it("very high", () => {
    expect(entropyHint(7.5)).toMatch(/Very high/);
  });
});

describe("file-metadata detectEncoding", () => {
  it("detects UTF-8 BOM", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toEqual({ encoding: "UTF-8", hasBom: true });
  });
  it("detects UTF-16LE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x41]))).toEqual({ encoding: "UTF-16LE", hasBom: true });
  });
  it("detects UTF-16BE BOM", () => {
    expect(detectEncoding(new Uint8Array([0xfe, 0xff, 0x41]))).toEqual({ encoding: "UTF-16BE", hasBom: true });
  });
  it("defaults to UTF-8 without BOM", () => {
    expect(detectEncoding(new Uint8Array([0x41]))).toEqual({ encoding: "UTF-8 (assumed)", hasBom: false });
  });
});

describe("file-metadata lookupSignature", () => {
  it("detects PNG", () => {
    const sig = lookupSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(sig?.ext).toBe("png");
  });
  it("detects JPEG (EXIF)", () => {
    const sig = lookupSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00]));
    expect(sig?.ext).toBe("jpg");
  });
  it("detects PDF", () => {
    const sig = lookupSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
    expect(sig?.ext).toBe("pdf");
  });
  it("detects ZIP (or OOXML format that shares ZIP magic bytes)", () => {
    const sig = lookupSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    // ZIP, DOCX, XLSX, PPTX, EPUB, JAR all share the same magic bytes
    expect(["zip", "docx", "xlsx", "pptx", "epub", "jar"]).toContain(sig?.ext);
    expect(sig?.bytes).toBe("504b0304");
  });
  it("detects Windows executable", () => {
    const sig = lookupSignature(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]));
    expect(sig?.ext).toBe("exe");
  });
  it("returns null for unknown bytes", () => {
    expect(lookupSignature(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBeNull();
  });
  it("returns null for short input", () => {
    expect(lookupSignature(new Uint8Array([0x00, 0x01]))).toBeNull();
  });
});

describe("file-metadata parseJpegExif", () => {
  it("returns empty for non-JPEG", () => {
    expect(parseJpegExif(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toEqual([]);
  });
  it("returns empty for JPEG without EXIF", () => {
    // FFD8 + FFE0 (JFIF marker, not APP1)
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(parseJpegExif(bytes)).toEqual([]);
  });
  it("returns empty for JPEG with EXIF marker but no Exif header", () => {
    // FFD8 + FFE1 + len + non-Exif data
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(parseJpegExif(bytes)).toEqual([]);
  });
});

describe("file-metadata hasSensitiveExif", () => {
  it("detects device info as sensitive", () => {
    const r = hasSensitiveExif([{ tag: "Make", value: "Canon" }]);
    expect(r.sensitive).toBe(true);
    expect(r.reasons).toContain("device info");
  });
  it("detects date as sensitive", () => {
    const r = hasSensitiveExif([{ tag: "DateTimeOriginal", value: "2026:01:01 12:00:00" }]);
    expect(r.sensitive).toBe(true);
  });
  it("returns not sensitive for empty exif", () => {
    expect(hasSensitiveExif([]).sensitive).toBe(false);
  });
});

describe("file-metadata metadataToJson", () => {
  it("serializes metadata", () => {
    const meta = {
      name: "test.png", size: 1024, sizeHuman: "1.0 KB", type: "image/png",
      lastModified: 1700000000000, lastModifiedISO: "2023-11-14T22:13:20.000Z",
      detectedType: FILE_SIGNATURES[0], encoding: { encoding: "UTF-8", hasBom: false },
      entropy: 5.5, entropyHint: "Moderate", magicBytesHex: "89504e47",
      hexDump: "test", base64Preview: "abc", exif: [], sensitiveExif: { sensitive: false, reasons: [] },
    };
    const json = metadataToJson(meta as any);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("test.png");
    expect(parsed.size).toBe(1024);
    expect(parsed.detectedType.ext).toBe("png");
  });
});

describe("file-metadata history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ name: "test.png", size: 1024, type: "image/png", detectedExt: "png", inspectedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ name: "test.png", size: 1024, type: "image/png", detectedExt: "png", inspectedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("file-metadata FILE_SIGNATURES", () => {
  it("contains 50+ entries", () => {
    expect(FILE_SIGNATURES.length).toBeGreaterThanOrEqual(50);
  });
  it("includes common formats", () => {
    const exts = FILE_SIGNATURES.map((s) => s.ext);
    expect(exts).toContain("png");
    expect(exts).toContain("jpg");
    expect(exts).toContain("pdf");
    expect(exts).toContain("zip");
    expect(exts).toContain("mp3");
    expect(exts).toContain("mp4");
  });
});

describe("file-metadata buildShareUrl", () => {
  it("builds URL with signature ext", () => {
    (globalThis as any).window = { location: { origin: "https://x.com", pathname: "/tools/file-metadata-viewer" } };
    const url = buildShareUrl(FILE_SIGNATURES[0]);
    expect(url).toContain("#sig=");
    delete (globalThis as any).window;
  });
  it("builds URL without signature", () => {
    (globalThis as any).window = { location: { origin: "https://x.com", pathname: "/tools/x" } };
    const url = buildShareUrl();
    expect(url).toContain("#signatures");
    delete (globalThis as any).window;
  });
});
