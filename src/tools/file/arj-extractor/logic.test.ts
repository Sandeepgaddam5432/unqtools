import { describe, it, expect, beforeEach } from "vitest";
import {
  ARJ_MAGIC1, ARJ_MAGIC2,
  isArjMagic, isArjFile,
  getHostOsName, getMethodName,
  parseMainHeader, parseFileEntries, parseArj,
  extractStoredEntry,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
} from "./logic";

// Helper: build a minimal ARJ file with one stored file
function makeArjFile(filename: string, content: string, method: number = 0): Uint8Array {
  const contentBytes = new TextEncoder().encode(content);
  const nameBytes = new TextEncoder().encode(filename);
  // Main header: magic(2) + basicHeaderSize(2) + header data + CRC(4)
  const mainHeaderData = new Uint8Array(34); // basic main header data
  mainHeaderData[1] = 0x06; // archiver version
  mainHeaderData[2] = 0x04; // min version
  mainHeaderData[3] = 0; // host OS = MSDOS
  const mainBasicSize = mainHeaderData.length;
  // File header: magic(2) + basicHeaderSize(2) + header data + CRC(4) + data
  const fileHeaderData = new Uint8Array(25 + nameBytes.length + 1);
  fileHeaderData[0] = 0x06; // archiver version
  fileHeaderData[1] = 0x04; // min version
  fileHeaderData[2] = 0; // host OS
  fileHeaderData[3] = 0; // archive flags
  fileHeaderData[4] = method; // method (0=stored)
  fileHeaderData[5] = 0; // file type (binary)
  // dateTime (4 bytes) at offset 6 — skip
  // compressedSize (4 bytes) at offset 10
  const dv = new DataView(fileHeaderData.buffer);
  dv.setUint32(10, contentBytes.length, true);
  dv.setUint32(14, contentBytes.length, true);
  dv.setUint32(18, 0, true); // CRC
  // name starts at offset 25
  fileHeaderData.set(nameBytes, 25);
  fileHeaderData[25 + nameBytes.length] = 0; // null terminator
  const fileBasicSize = fileHeaderData.length;

  const totalLength =
    2 + 2 + mainBasicSize + 4 + // main header
    2 + 2 + fileBasicSize + 4 + contentBytes.length; // file header + data
  const bytes = new Uint8Array(totalLength);
  let pos = 0;
  // Main header magic
  bytes[pos] = ARJ_MAGIC1; bytes[pos + 1] = ARJ_MAGIC2;
  bytes[pos + 2] = mainBasicSize & 0xff; bytes[pos + 3] = (mainBasicSize >> 8) & 0xff;
  pos += 4;
  bytes.set(mainHeaderData, pos); pos += mainBasicSize;
  // CRC (skip)
  pos += 4;
  // File header magic
  bytes[pos] = ARJ_MAGIC1; bytes[pos + 1] = ARJ_MAGIC2;
  bytes[pos + 2] = fileBasicSize & 0xff; bytes[pos + 3] = (fileBasicSize >> 8) & 0xff;
  pos += 4;
  bytes.set(fileHeaderData, pos); pos += fileBasicSize;
  // CRC (skip)
  pos += 4;
  // File data
  bytes.set(contentBytes, pos);
  return bytes;
}

// ===== isArjMagic / isArjFile =====

describe("arj-extractor isArjMagic", () => {
  it("returns true for 0x60 0xEA", () => {
    expect(isArjMagic(new Uint8Array([0x60, 0xea]))).toBe(true);
  });
  it("returns false for other bytes", () => {
    expect(isArjMagic(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isArjMagic(new Uint8Array([0x60]))).toBe(false);
  });
});

describe("arj-extractor isArjFile", () => {
  it("returns true for ARJ magic", () => {
    expect(isArjFile(new Uint8Array([0x60, 0xea, 0x00, 0x00]))).toBe(true);
  });
  it("returns false for non-ARJ", () => {
    expect(isArjFile(new Uint8Array([0x00, 0x00]))).toBe(false);
  });
});

// ===== getHostOsName / getMethodName =====

describe("arj-extractor getHostOsName", () => {
  it("returns MSDOS for 0", () => {
    expect(getHostOsName(0)).toBe("MSDOS");
  });
  it("returns UNIX for 2", () => {
    expect(getHostOsName(2)).toBe("UNIX");
  });
  it("returns WIN95 for 10", () => {
    expect(getHostOsName(10)).toBe("WIN95");
  });
  it("returns Unknown for unknown code", () => {
    expect(getHostOsName(99)).toBe("Unknown (99)");
  });
});

describe("arj-extractor getMethodName", () => {
  it("returns Stored for 0", () => {
    expect(getMethodName(0)).toBe("Stored");
  });
  it("returns Most compressed for 1", () => {
    expect(getMethodName(1)).toBe("Most compressed");
  });
  it("returns Fastest for 3", () => {
    expect(getMethodName(3)).toBe("Fastest");
  });
  it("returns Unknown for unknown method", () => {
    expect(getMethodName(99)).toBe("Unknown (99)");
  });
});

// ===== parseMainHeader =====

describe("arj-extractor parseMainHeader", () => {
  it("parses a valid main header", () => {
    const bytes = makeArjFile("test.txt", "hello");
    const header = parseMainHeader(bytes);
    expect(header).not.toBeNull();
    expect(header!.archiverVersion).toBe(0x06);
    expect(header!.hostOs).toBe(0);
    expect(header!.hostOsName).toBe("MSDOS");
  });
  it("returns null for non-ARJ input", () => {
    expect(parseMainHeader(new Uint8Array([0x00, 0x00]))).toBeNull();
  });
  it("returns null for too-short input", () => {
    expect(parseMainHeader(new Uint8Array(2))).toBeNull();
  });
});

// ===== parseFileEntries =====

describe("arj-extractor parseFileEntries", () => {
  it("parses one stored file entry", () => {
    const bytes = makeArjFile("test.txt", "hello world");
    const entries = parseFileEntries(bytes);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]!.name).toBe("test.txt");
    expect(entries[0]!.originalSize).toBe(11);
    expect(entries[0]!.method).toBe(0);
    expect(entries[0]!.isStored).toBe(true);
  });
  it("returns empty for non-ARJ input", () => {
    expect(parseFileEntries(new Uint8Array(10))).toEqual([]);
  });
  it("detects non-stored method", () => {
    const bytes = makeArjFile("test.txt", "hello", 1);
    const entries = parseFileEntries(bytes);
    expect(entries[0]!.method).toBe(1);
    expect(entries[0]!.isStored).toBe(false);
  });
});

// ===== parseArj (top-level) =====

describe("arj-extractor parseArj", () => {
  it("returns isValid=true for ARJ file", () => {
    const bytes = makeArjFile("test.txt", "hello");
    const result = parseArj(bytes);
    expect(result.isValid).toBe(true);
    expect(result.mainHeader).not.toBeNull();
  });
  it("returns isValid=false for non-ARJ", () => {
    const result = parseArj(new Uint8Array([0x00, 0x00]));
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/magic/i);
  });
  it("lists file entries", () => {
    const bytes = makeArjFile("test.txt", "hello");
    const result = parseArj(bytes);
    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    expect(result.fileCount).toBeGreaterThanOrEqual(1);
  });
  it("computes total sizes", () => {
    const bytes = makeArjFile("test.txt", "hello world");
    const result = parseArj(bytes);
    expect(result.totalOriginalSize).toBe(11);
  });
  it("detects compressed entries", () => {
    const bytes = makeArjFile("test.txt", "hello", 1);
    const result = parseArj(bytes);
    expect(result.hasCompressedEntries).toBe(true);
  });
  it("marks stored entries as not compressed", () => {
    const bytes = makeArjFile("test.txt", "hello", 0);
    const result = parseArj(bytes);
    expect(result.hasCompressedEntries).toBe(false);
  });
  it("collects unique methods", () => {
    const bytes = makeArjFile("test.txt", "hello", 1);
    const result = parseArj(bytes);
    expect(result.methods).toContain(1);
  });
});

// ===== extractStoredEntry =====

describe("arj-extractor extractStoredEntry", () => {
  it("extracts content from stored entry", () => {
    const bytes = makeArjFile("test.txt", "hello world");
    const result = parseArj(bytes);
    const entry = result.entries[0]!;
    const extracted = extractStoredEntry(bytes, entry);
    expect(extracted).not.toBeNull();
    expect(new TextDecoder().decode(extracted!)).toBe("hello world");
  });
  it("returns null for compressed entries", () => {
    const bytes = makeArjFile("test.txt", "hello", 1);
    const result = parseArj(bytes);
    const entry = result.entries[0]!;
    expect(extractStoredEntry(bytes, entry)).toBeNull();
  });
});

// ===== formatBytes =====

describe("arj-extractor formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History (localStorage) =====

describe("arj-extractor history", () => {
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
      fileName: "archive.arj", fileSize: 50000, fileCount: 3,
      hasCompressedEntries: true, inspectedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `a${i}.arj`, fileSize: 100, fileCount: 1,
        hasCompressedEntries: false, inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.arj", fileSize: 100, fileCount: 1,
      hasCompressedEntries: false, inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("arj-extractor share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/arj-extractor",
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
