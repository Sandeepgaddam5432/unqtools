import { describe, it, expect, beforeEach } from "vitest";
import {
  CAB_SIGNATURE, CAB_SIGNATURE_BYTES,
  CAB_FLAG_PREV_CABINET, CAB_FLAG_NEXT_CABINET, CAB_FLAG_RESERVE_PRESENT,
  CAB_ATTR_READONLY, CAB_ATTR_HIDDEN, CAB_ATTR_SYSTEM, CAB_ATTR_ARCH,
  isCabArchive, parseCab, extractCabFile,
  computeStats, searchFiles, filterFiles, detectMimeFromName,
  createZipBlob, buildZipFromCab,
  formatBytes, formatFatDateTime,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type CabFile, type CabFilter,
} from "./logic";

// ===== Test helpers =====

function writeUint16LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Build a minimal stored-only CAB file containing the given files.
 * All files are placed in one folder with compression method 0 (none).
 */
function buildStoredCab(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  // Compute sizes
  const fileEntries: Array<{ nameBytes: Uint8Array; size: number; offset: number; date: number; time: number; attribs: number }> = [];
  let uncomprOffset = 0;
  for (const f of files) {
    const nameBytes = new TextEncoder().encode(f.name + "\0");
    fileEntries.push({ nameBytes, size: f.data.length, offset: uncomprOffset, date: 0x5421, time: 0x8000, attribs: CAB_ATTR_ARCH });
    uncomprOffset += f.data.length;
  }
  const totalUncompressed = uncomprOffset;

  // CFDATA block: csum(4) + cbData(2) + cbUncomp(2) + data
  const cfData = new Uint8Array(8 + totalUncompressed);
  writeUint16LE(cfData, 4, totalUncompressed); // cbData
  writeUint16LE(cfData, 6, totalUncompressed); // cbUncomp
  for (let i = 0; i < totalUncompressed; i++) cfData[8 + i] = 0;
  let pos = 0;
  for (const f of files) {
    for (let i = 0; i < f.data.length; i++) cfData[8 + pos + i] = f.data[i]!;
    pos += f.data.length;
  }

  // CFFOLDER entry: coffCabStart(4) + cCFData(2) + typeCompress(2) = 8 bytes
  // CFFILE entries: 16 bytes + name
  const filesStart = 36 + 8; // header + 1 folder
  const cfDataOffset = filesStart + fileEntries.reduce((s, f) => s + 16 + f.nameBytes.length, 0);
  const totalCabSize = cfDataOffset + cfData.length;

  const out = new Uint8Array(totalCabSize);
  // Header
  out[0] = 0x4d; out[1] = 0x53; out[2] = 0x43; out[3] = 0x46; // MSCF
  writeUint32LE(out, 8, totalCabSize); // cbCabinet
  writeUint32LE(out, 16, filesStart); // coffFiles
  out[24] = 3; // versionMinor
  out[25] = 1; // versionMajor
  writeUint16LE(out, 26, 1); // cFolders
  writeUint16LE(out, 28, files.length); // cFiles
  writeUint16LE(out, 30, 0); // flags
  writeUint16LE(out, 32, 0); // setID
  writeUint16LE(out, 34, 0); // iCabinet

  // CFFOLDER
  writeUint32LE(out, 36, cfDataOffset); // coffCabStart
  writeUint16LE(out, 40, 1); // cCFData
  writeUint16LE(out, 42, 0); // typeCompress = none

  // CFFILE entries
  let p = 36 + 8;
  for (const f of fileEntries) {
    writeUint32LE(out, p, f.size);
    writeUint32LE(out, p + 4, f.offset);
    writeUint16LE(out, p + 8, 0); // iFolder
    writeUint16LE(out, p + 10, f.date);
    writeUint16LE(out, p + 12, f.time);
    writeUint16LE(out, p + 14, f.attribs);
    out.set(f.nameBytes, p + 16);
    p += 16 + f.nameBytes.length;
  }

  // CFDATA
  out.set(cfData, cfDataOffset);
  return out;
}

// ===== localStorage mock =====
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
});

// ===== isCabArchive =====

describe("cab-file-extractor isCabArchive", () => {
  it("returns true for MSCF signature", () => {
    expect(isCabArchive(CAB_SIGNATURE_BYTES)).toBe(true);
  });
  it("returns false for ZIP magic", () => {
    expect(isCabArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isCabArchive(new Uint8Array([0x4d, 0x53]))).toBe(false);
  });
});

// ===== parseCab =====

describe("cab-file-extractor parseCab", () => {
  it("parses a single-file stored CAB", () => {
    const cab = buildStoredCab([{ name: "hello.txt", data: new TextEncoder().encode("Hello, CAB!") }]);
    const info = parseCab(cab);
    expect(info.isValid).toBe(true);
    expect(info.signature).toBe("MSCF");
    expect(info.folderCount).toBe(1);
    expect(info.fileCount).toBe(1);
    expect(info.files).toHaveLength(1);
    expect(info.files[0]!.name).toBe("hello.txt");
    expect(info.files[0]!.size).toBe(11);
  });
  it("parses multiple files in a single folder", () => {
    const cab = buildStoredCab([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbb") },
      { name: "c.txt", data: new TextEncoder().encode("ccccc") },
    ]);
    const info = parseCab(cab);
    expect(info.files).toHaveLength(3);
    expect(info.files.map((f) => f.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
    expect(info.files.map((f) => f.size)).toEqual([3, 4, 5]);
  });
  it("detects folder compression as 'none' for stored CAB", () => {
    const cab = buildStoredCab([{ name: "x.txt", data: new TextEncoder().encode("x") }]);
    const info = parseCab(cab);
    expect(info.folders[0]!.compression).toBe("none");
    expect(info.folders[0]!.isStored).toBe(true);
  });
  it("parses version fields", () => {
    const cab = buildStoredCab([{ name: "x.txt", data: new TextEncoder().encode("x") }]);
    const info = parseCab(cab);
    expect(info.versionMinor).toBe(3);
    expect(info.versionMajor).toBe(1);
  });
  it("returns invalid for non-CAB bytes", () => {
    const info = parseCab(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
    expect(info.isValid).toBe(false);
    expect(info.error).toContain("MSCF");
  });
  it("parses file attributes", () => {
    const cab = buildStoredCab([{ name: "r.txt", data: new TextEncoder().encode("r") }]);
    const info = parseCab(cab);
    expect(info.files[0]!.attrFlags).toContain("ARCH");
  });
  it("parses FAT date/time", () => {
    const cab = buildStoredCab([{ name: "x.txt", data: new TextEncoder().encode("x") }]);
    const info = parseCab(cab);
    expect(info.files[0]!.date).toBe(0x5421);
    expect(info.files[0]!.time).toBe(0x8000);
  });
  it("returns empty folders/files for empty CAB header", () => {
    const empty = new Uint8Array(36);
    empty[0] = 0x4d; empty[1] = 0x53; empty[2] = 0x43; empty[3] = 0x46;
    const info = parseCab(empty);
    expect(info.isValid).toBe(true);
    expect(info.folders).toEqual([]);
    expect(info.files).toEqual([]);
  });
});

// ===== extractCabFile =====

describe("cab-file-extractor extractCabFile", () => {
  it("extracts a stored file's bytes", () => {
    const cab = buildStoredCab([{ name: "hello.txt", data: new TextEncoder().encode("Hello, CAB!") }]);
    const info = parseCab(cab);
    const result = extractCabFile(cab, info.files[0]!, info);
    expect(result).not.toBeNull();
    expect(new TextDecoder().decode(result!.bytes)).toBe("Hello, CAB!");
    expect(result!.truncated).toBe(false);
  });
  it("extracts the correct file from a multi-file CAB", () => {
    const cab = buildStoredCab([
      { name: "a.txt", data: new TextEncoder().encode("AAA") },
      { name: "b.txt", data: new TextEncoder().encode("BBBBB") },
    ]);
    const info = parseCab(cab);
    const result = extractCabFile(cab, info.files[1]!, info);
    expect(new TextDecoder().decode(result!.bytes)).toBe("BBBBB");
  });
  it("returns null for non-stored files", () => {
    const file: CabFile = {
      name: "x.txt", size: 10, uoffFolderStart: 0, iFolder: 0,
      date: 0, time: 0, attribs: 0, attrFlags: [], isExtractable: false,
    };
    const info = {
      signature: "MSCF", totalSize: 0, coffFiles: 0,
      versionMinor: 3, versionMajor: 1, folderCount: 1, fileCount: 1,
      flags: 0, setID: 0, cabinetIndex: 0, hasPrevCabinet: false,
      hasNextCabinet: false, hasReserved: false,
      folders: [{ coffCabStart: 0, cCFData: 0, typeCompress: 1, compression: "mszip" as const, isStored: false }],
      files: [file], isValid: true,
    };
    expect(extractCabFile(new Uint8Array(0), file, info)).toBeNull();
  });
});

// ===== computeStats =====

describe("cab-file-extractor computeStats", () => {
  it("computes stats for a stored CAB", () => {
    const cab = buildStoredCab([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbb") },
    ]);
    const info = parseCab(cab);
    const stats = computeStats(info, cab.length);
    expect(stats.fileCount).toBe(2);
    expect(stats.folderCount).toBe(1);
    expect(stats.storedFileCount).toBe(2);
    expect(stats.compressedFileCount).toBe(0);
    expect(stats.totalUncompressedSize).toBe(7);
    expect(stats.largestFileName).toBe("b.txt");
    expect(stats.largestFileSize).toBe(4);
  });
  it("detects compressed files in stats", () => {
    const file: CabFile = {
      name: "x.txt", size: 100, uoffFolderStart: 0, iFolder: 0,
      date: 0, time: 0, attribs: 0, attrFlags: [], isExtractable: false,
    };
    const info = {
      signature: "MSCF", totalSize: 0, coffFiles: 0,
      versionMinor: 3, versionMajor: 1, folderCount: 1, fileCount: 1,
      flags: 0, setID: 0, cabinetIndex: 0, hasPrevCabinet: false,
      hasNextCabinet: false, hasReserved: false,
      folders: [], files: [file], isValid: true,
    };
    const stats = computeStats(info, 1000);
    expect(stats.compressedFileCount).toBe(1);
    expect(stats.storedFileCount).toBe(0);
  });
  it("detects multi-volume archives", () => {
    const info = {
      signature: "MSCF", totalSize: 0, coffFiles: 0,
      versionMinor: 3, versionMajor: 1, folderCount: 0, fileCount: 0,
      flags: CAB_FLAG_NEXT_CABINET, setID: 0, cabinetIndex: 0,
      hasPrevCabinet: false, hasNextCabinet: true, hasReserved: false,
      folders: [], files: [], isValid: true,
    };
    const stats = computeStats(info, 0);
    expect(stats.hasMultiVolume).toBe(true);
  });
});

// ===== searchFiles / filterFiles =====

describe("cab-file-extractor searchFiles", () => {
  it("returns all files for empty query", () => {
    const cab = buildStoredCab([
      { name: "a.txt", data: new TextEncoder().encode("a") },
      { name: "b.txt", data: new TextEncoder().encode("b") },
    ]);
    const info = parseCab(cab);
    expect(searchFiles(info.files, "")).toHaveLength(2);
  });
  it("filters by case-insensitive substring", () => {
    const cab = buildStoredCab([
      { name: "readme.TXT", data: new TextEncoder().encode("a") },
      { name: "data.bin", data: new TextEncoder().encode("b") },
    ]);
    const info = parseCab(cab);
    expect(searchFiles(info.files, "TXT")).toHaveLength(1);
  });
});

describe("cab-file-extractor filterFiles", () => {
  it("returns all for 'all' filter", () => {
    const cab = buildStoredCab([{ name: "a.txt", data: new TextEncoder().encode("a") }]);
    const info = parseCab(cab);
    expect(filterFiles(info.files, "all")).toHaveLength(1);
  });
  it("filters stored files", () => {
    const cab = buildStoredCab([{ name: "a.txt", data: new TextEncoder().encode("a") }]);
    const info = parseCab(cab);
    expect(filterFiles(info.files, "stored")).toHaveLength(1);
    expect(filterFiles(info.files, "compressed")).toHaveLength(0);
  });
});

// ===== detectMimeFromName =====

describe("cab-file-extractor detectMimeFromName", () => {
  it("detects common types", () => {
    expect(detectMimeFromName("a.txt")).toBe("text/plain");
    expect(detectMimeFromName("a.csv")).toBe("text/csv");
    expect(detectMimeFromName("a.json")).toBe("application/json");
    expect(detectMimeFromName("a.png")).toBe("image/png");
    expect(detectMimeFromName("a.pdf")).toBe("application/pdf");
    expect(detectMimeFromName("a.exe")).toBe("application/x-msdownload");
    expect(detectMimeFromName("a.unknown")).toBe("application/octet-stream");
  });
});

// ===== createZipBlob / buildZipFromCab =====

describe("cab-file-extractor ZIP", () => {
  it("creates a non-empty ZIP blob", () => {
    const blob = createZipBlob([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/zip");
  });
  it("builds ZIP from stored CAB", () => {
    const cab = buildStoredCab([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    const info = parseCab(cab);
    const blob = buildZipFromCab(cab, info);
    expect(blob.size).toBeGreaterThan(0);
  });
  it("builds empty ZIP for compressed-only CAB", () => {
    const file: CabFile = {
      name: "x.txt", size: 100, uoffFolderStart: 0, iFolder: 0,
      date: 0, time: 0, attribs: 0, attrFlags: [], isExtractable: false,
    };
    const info = {
      signature: "MSCF", totalSize: 0, coffFiles: 0,
      versionMinor: 3, versionMajor: 1, folderCount: 1, fileCount: 1,
      flags: 0, setID: 0, cabinetIndex: 0, hasPrevCabinet: false,
      hasNextCabinet: false, hasReserved: false,
      folders: [], files: [file], isValid: true,
    };
    const blob = buildZipFromCab(new Uint8Array(0), info);
    expect(blob.size).toBe(22); // just EOCD
  });
});

// ===== Utilities =====

describe("cab-file-extractor utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("formats FAT date/time", () => {
    expect(formatFatDateTime(0, 0)).toBe("—");
    // 2021-03-01 16:00:00 UTC
    // year=2021 → (2021-1980)=41 → 41<<9 = 0x5200
    // month=3 → 3<<5 = 0x60
    // day=1 → 0x01
    // date = 0x5261
    // hours=16 → 16<<11 = 0x8000
    // minutes=0, seconds=0
    expect(formatFatDateTime(0x5261, 0x8000)).toContain("2021");
  });
  it("returns — for invalid date", () => {
    expect(formatFatDateTime(0xffff, 0xffff)).toBe("—");
  });
});

// ===== History =====

describe("cab-file-extractor history", () => {
  it("returns empty list when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.cab", archiveSize: 1000, fileCount: 3,
      folderCount: 1, storedFileCount: 3, inspectedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.cab");
  });
  it("clears history", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.cab", archiveSize: 1000, fileCount: 3,
      folderCount: 1, storedFileCount: 3, inspectedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("cab-file-extractor share URL", () => {
  it("builds URL with search and filter", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/cab-file-extractor" } };
    const url = buildShareUrl({ search: "test", filter: "stored" });
    expect(url).toContain("q=test");
    expect(url).toContain("filter=stored");
  });
  it("omits empty params", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/cab-file-extractor" } };
    const url = buildShareUrl({ search: "", filter: "all" });
    expect(url).not.toContain("q=");
    expect(url).not.toContain("filter=");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#q=data&filter=stored");
    expect(parsed).toEqual({ search: "data", filter: "stored" });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null for hash without recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to 'all' filter for invalid value", () => {
    const parsed = parseShareUrl("#filter=invalid");
    expect(parsed?.filter).toBe("all");
  });
});
