import { describe, it, expect, beforeEach } from "vitest";
import {
  parseRar, isRarFile, detectRarVersion,
  isRar4Signature, isRar5Signature,
  getRarMethodName,
  inspectRar,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
} from "./logic";
import {
  RAR4_SIGNATURE, RAR5_SIGNATURE,
} from "../cbr-comic-book-reader/logic";

// ===== Re-exports from CBR logic =====

describe("rar-extractor re-exports", () => {
  it("isRar4Signature works", () => {
    expect(isRar4Signature(new Uint8Array(RAR4_SIGNATURE))).toBe(true);
  });
  it("isRar5Signature works", () => {
    expect(isRar5Signature(new Uint8Array(RAR5_SIGNATURE))).toBe(true);
  });
  it("isRarFile returns true for RAR4", () => {
    expect(isRarFile(new Uint8Array(RAR4_SIGNATURE))).toBe(true);
  });
  it("isRarFile returns true for RAR5", () => {
    expect(isRarFile(new Uint8Array(RAR5_SIGNATURE))).toBe(true);
  });
  it("isRarFile returns false for ZIP", () => {
    expect(isRarFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });
  it("detectRarVersion returns 'rar4' for RAR4", () => {
    expect(detectRarVersion(new Uint8Array(RAR4_SIGNATURE))).toBe("rar4");
  });
  it("detectRarVersion returns 'rar5' for RAR5", () => {
    expect(detectRarVersion(new Uint8Array(RAR5_SIGNATURE))).toBe("rar5");
  });
  it("detectRarVersion returns null for non-RAR", () => {
    expect(detectRarVersion(new Uint8Array([0x00, 0x00]))).toBeNull();
  });
});

// ===== parseRar (top-level) =====

describe("rar-extractor parseRar", () => {
  it("returns isValid=true for RAR4", () => {
    const result = parseRar(new Uint8Array(RAR4_SIGNATURE));
    expect(result.isValid).toBe(true);
    expect(result.version).toBe("rar4");
  });
  it("returns isValid=true for RAR5", () => {
    const result = parseRar(new Uint8Array(RAR5_SIGNATURE));
    expect(result.isValid).toBe(true);
    expect(result.version).toBe("rar5");
  });
  it("returns isValid=false for non-RAR", () => {
    const result = parseRar(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/signature/i);
  });
  it("returns empty entries for signature-only RAR4", () => {
    const result = parseRar(new Uint8Array(RAR4_SIGNATURE));
    expect(result.entries.length).toBe(0);
  });
});

// ===== getRarMethodName =====

describe("rar-extractor getRarMethodName", () => {
  it("returns 'Stored' for RAR4 method 0x30", () => {
    expect(getRarMethodName(0x30, "rar4")).toBe("Stored");
  });
  it("returns 'Fastest' for RAR4 method 0x31", () => {
    expect(getRarMethodName(0x31, "rar4")).toBe("Fastest");
  });
  it("returns 'Best' for RAR4 method 0x35", () => {
    expect(getRarMethodName(0x35, "rar4")).toBe("Best");
  });
  it("returns 'Stored' for RAR5 method 0", () => {
    expect(getRarMethodName(0, "rar5")).toBe("Stored");
  });
  it("returns 'Fastest' for RAR5 method 1", () => {
    expect(getRarMethodName(1, "rar5")).toBe("Fastest");
  });
  it("returns 'Best' for RAR5 method 5", () => {
    expect(getRarMethodName(5, "rar5")).toBe("Best");
  });
  it("returns 'Unknown' for null method", () => {
    expect(getRarMethodName(null, "rar4")).toBe("Unknown");
  });
  it("returns hex for unknown RAR4 method", () => {
    expect(getRarMethodName(0x99, "rar4")).toBe("Method 0x99");
  });
});

// ===== inspectRar =====

describe("rar-extractor inspectRar", () => {
  it("returns archive info and file size", () => {
    const bytes = new Uint8Array(RAR4_SIGNATURE);
    const result = inspectRar(bytes);
    expect(result.archive).toBeDefined();
    expect(result.fileSize).toBe(7);
  });
  it("detects RAR4", () => {
    const result = inspectRar(new Uint8Array(RAR4_SIGNATURE));
    expect(result.archive.version).toBe("rar4");
  });
  it("detects RAR5", () => {
    const result = inspectRar(new Uint8Array(RAR5_SIGNATURE));
    expect(result.archive.version).toBe("rar5");
  });
  it("returns isValid=false for non-RAR", () => {
    const result = inspectRar(new Uint8Array([0x00, 0x00]));
    expect(result.archive.isValid).toBe(false);
  });
});

// ===== formatBytes =====

describe("rar-extractor formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

// ===== History (localStorage) =====

describe("rar-extractor history", () => {
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
      fileName: "archive.rar", fileSize: 1000000, version: "rar5",
      fileCount: 10, isEncrypted: false, isSolid: true,
      inspectedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `a${i}.rar`, fileSize: 100, version: "rar4",
        fileCount: 1, isEncrypted: false, isSolid: false,
        inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.rar", fileSize: 100, version: "rar4",
      fileCount: 1, isEncrypted: false, isSolid: false,
      inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("rar-extractor share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/rar-extractor",
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
