import { describe, it, expect, beforeEach } from "vitest";
import {
  parseLzh, extractLzhEntry, hasCompressedEntries, getLzhStats,
  formatBytes, loadHistory, saveToHistory, clearHistory,
  type LzhEntry,
} from "./logic";

// Helper: build a minimal level-0 LZH archive with one stored file
function buildLzh(filename: string, content: string): Uint8Array {
  const contentBytes = new TextEncoder().encode(content);
  const nameBytes = new TextEncoder().encode(filename);
  const headerSize = 22 + nameBytes.length; // standard level 0 header
  const compressedSize = contentBytes.length;
  const buf = new Uint8Array(headerSize + 2 + compressedSize + 1);
  const dv = new DataView(buf.buffer);
  // Header size
  buf[0] = headerSize;
  // Checksum (simple sum)
  buf[1] = 0;
  // Method: -lh0- (stored)
  buf.set(new TextEncoder().encode("-lh0-"), 2);
  // Compressed size (LE)
  dv.setUint32(7, compressedSize, true);
  // Uncompressed size (LE)
  dv.setUint32(11, compressedSize, true);
  // Timestamp (LE) — current time
  dv.setUint32(15, Math.floor(Date.now() / 1000), true);
  // Attributes
  buf[19] = 0x20;
  // Level
  buf[20] = 0;
  // Name length
  buf[21] = nameBytes.length;
  // Filename
  buf.set(nameBytes, 22);
  // CRC (skip — 2 bytes at offset 22 + nameBytes.length)
  // Data
  buf.set(contentBytes, headerSize + 2);
  // End marker
  buf[headerSize + 2 + compressedSize] = 0;
  return buf;
}

describe("lzh-extractor parseLzh", () => {
  it("parses a valid LZH archive", () => {
    const archive = parseLzh(buildLzh("test.txt", "hello world"));
    expect(archive.isValid).toBe(true);
    expect(archive.entries).toHaveLength(1);
    expect(archive.entries[0].filename).toBe("test.txt");
    expect(archive.entries[0].uncompressedSize).toBe(11);
  });

  it("returns invalid for empty input", () => {
    const archive = parseLzh(new Uint8Array(0));
    expect(archive.isValid).toBe(false);
  });

  it("returns invalid for too-small input", () => {
    const archive = parseLzh(new Uint8Array(10));
    expect(archive.isValid).toBe(false);
  });

  it("parses multiple entries", () => {
    const file1 = buildLzh("a.txt", "aaa");
    const file2 = buildLzh("b.txt", "bbb");
    const combined = new Uint8Array(file1.length - 1 + file2.length); // -1 for end marker of file1
    combined.set(file1.slice(0, -1), 0); // strip end marker
    combined.set(file2, file1.length - 1);
    const archive = parseLzh(combined);
    expect(archive.entries.length).toBeGreaterThanOrEqual(1);
  });
});

describe("lzh-extractor extractLzhEntry", () => {
  it("extracts stored file content", () => {
    const bytes = buildLzh("test.txt", "hello world");
    const archive = parseLzh(bytes);
    const extracted = extractLzhEntry(bytes, archive.entries[0]);
    expect(extracted).not.toBeNull();
    expect(new TextDecoder().decode(extracted!)).toBe("hello world");
  });

  it("returns null for compressed entries", () => {
    const entry: LzhEntry = {
      filename: "test.txt", compressedSize: 10, uncompressedSize: 20,
      compressionMethod: "-lh1-", crc: 0, timestamp: new Date(), offset: 0,
    };
    expect(extractLzhEntry(new Uint8Array(100), entry)).toBeNull();
  });
});

describe("lzh-extractor hasCompressedEntries", () => {
  it("returns false for all-stored archive", () => {
    const archive = parseLzh(buildLzh("test.txt", "hello"));
    expect(hasCompressedEntries(archive)).toBe(false);
  });
});

describe("lzh-extractor getLzhStats", () => {
  it("computes stats", () => {
    const archive = parseLzh(buildLzh("test.txt", "hello world"));
    const stats = getLzhStats(archive);
    expect(stats.fileCount).toBe(1);
    expect(stats.totalUncompressed).toBe(11);
    expect(stats.compressedCount).toBe(0);
  });
});

describe("lzh-extractor formatBytes", () => {
  it("formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("lzh-extractor history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ filename: "test.lzh", fileCount: 3, extractedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ filename: "t.lzh", fileCount: 1, extractedAt: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
