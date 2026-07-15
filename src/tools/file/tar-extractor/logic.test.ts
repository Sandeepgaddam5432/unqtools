import { describe, it, expect, beforeEach } from "vitest";
import {
  parseOctal, decodeField, computeChecksum, formatMode, formatMtime,
  parseTarEntries, extractTarEntry, isTarArchive, validateChecksum,
  buildFileTree, computeStats, detectMimeFromName,
  previewFile, looksLikeText, searchEntries, filterByType,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  createZipBlob, buildZipFromTar,
  type TarEntry, type FileTypeFilter,
} from "./logic";
import { buildTarArchive } from "../gzip-compressor/logic";

// Helpers to build TAR header bytes manually for edge-case tests.

function buildHeader(fields: Partial<{
  name: string; mode: number; uid: number; gid: number; size: number;
  mtime: number; typeflag: string; linkname: string; magic: string;
  prefix: string;
}>): Uint8Array {
  const h = new Uint8Array(512);
  const enc = new TextEncoder();
  const writeStr = (offset: number, text: string, maxLen: number) => {
    const bytes = enc.encode(text);
    const len = Math.min(bytes.length, maxLen);
    h.set(bytes.subarray(0, len), offset);
  };
  const writeOctal = (offset: number, value: number, width: number) => {
    writeStr(offset, value.toString(8).padStart(width - 1, "0") + "\0", width);
  };
  writeStr(0, fields.name ?? "", 100);
  writeOctal(100, fields.mode ?? 0o644, 8);
  writeOctal(108, fields.uid ?? 0, 8);
  writeOctal(116, fields.gid ?? 0, 8);
  writeOctal(124, fields.size ?? 0, 12);
  writeOctal(136, fields.mtime ?? 0, 12);
  // checksum: fill with spaces for now
  for (let i = 148; i < 156; i++) h[i] = 0x20;
  writeStr(156, fields.typeflag ?? "0", 1);
  writeStr(157, fields.linkname ?? "", 100);
  if (fields.magic !== undefined) {
    writeStr(257, fields.magic, 6);
  } else {
    writeStr(257, "ustar", 6);
  }
  writeStr(263, "00", 2);
  writeStr(345, fields.prefix ?? "", 155);
  // Compute checksum
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i]!;
  writeStr(148, sum.toString(8).padStart(6, "0") + "\0 ", 8);
  return h;
}

function buildArchive(headers: Uint8Array[], dataBlocks: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < headers.length; i++) {
    parts.push(headers[i]!);
    parts.push(dataBlocks[i] ?? new Uint8Array(0));
    // Pad data to 512-byte boundary
    const data = dataBlocks[i] ?? new Uint8Array(0);
    const remainder = data.length % 512;
    if (remainder > 0) parts.push(new Uint8Array(512 - remainder));
  }
  // End-of-archive: two 512-byte zero blocks
  parts.push(new Uint8Array(1024));
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

// ===== parseOctal =====

describe("tar-extractor parseOctal", () => {
  it("parses simple octal", () => {
    const bytes = new TextEncoder().encode("0000644\0");
    expect(parseOctal(bytes, 0, 8)).toBe(0o644);
  });
  it("parses large octal size", () => {
    const bytes = new TextEncoder().encode("00000001234\0");
    expect(parseOctal(bytes, 0, 12)).toBe(0o1234);
  });
  it("returns 0 for empty field", () => {
    const bytes = new Uint8Array([0, 0, 0, 0]);
    expect(parseOctal(bytes, 0, 4)).toBe(0);
  });
  it("stops at space terminator", () => {
    const bytes = new TextEncoder().encode("644    \0");
    expect(parseOctal(bytes, 0, 8)).toBe(0o644);
  });
  it("returns 0 for non-octal chars", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(parseOctal(bytes, 0, 5)).toBe(0);
  });
});

// ===== decodeField =====

describe("tar-extractor decodeField", () => {
  it("decodes NUL-terminated string", () => {
    const bytes = new TextEncoder().encode("hello\0world");
    expect(decodeField(bytes, 0, 11)).toBe("hello");
  });
  it("returns full string when no NUL", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(decodeField(bytes, 0, 5)).toBe("hello");
  });
  it("returns empty for empty field", () => {
    const bytes = new Uint8Array([0, 0, 0]);
    expect(decodeField(bytes, 0, 3)).toBe("");
  });
  it("decodes UTF-8 multibyte chars", () => {
    const bytes = new TextEncoder().encode("héllo");
    expect(decodeField(bytes, 0, 7)).toBe("héllo");
  });
});

// ===== computeChecksum =====

describe("tar-extractor computeChecksum", () => {
  it("returns same value for all-zero header (with 8 spaces for checksum)", () => {
    const h = new Uint8Array(512);
    for (let i = 148; i < 156; i++) h[i] = 0x20;
    expect(computeChecksum(h)).toBe(8 * 0x20);
  });
  it("includes all non-checksum bytes", () => {
    const h = new Uint8Array(512);
    h[0] = 0x41; // 'A'
    for (let i = 148; i < 156; i++) h[i] = 0x20;
    expect(computeChecksum(h)).toBe(0x41 + 8 * 0x20);
  });
});

// ===== validateChecksum =====

describe("tar-extractor validateChecksum", () => {
  it("returns true for a valid header", () => {
    const h = buildHeader({ name: "f.txt", size: 5 });
    const archive = buildArchive([h], [new TextEncoder().encode("hello")]);
    expect(validateChecksum(archive, 0)).toBe(true);
  });
  it("returns false for a corrupted header", () => {
    const h = buildHeader({ name: "f.txt", size: 5 });
    // Corrupt the checksum field
    h[148] = 0x30; h[149] = 0x30; h[150] = 0x30; h[151] = 0x30;
    const archive = buildArchive([h], [new TextEncoder().encode("hello")]);
    expect(validateChecksum(archive, 0)).toBe(false);
  });
  it("returns false for offset beyond length", () => {
    expect(validateChecksum(new Uint8Array(100), 0)).toBe(false);
  });
});

// ===== formatMode =====

describe("tar-extractor formatMode", () => {
  it("formats mode as 4-digit octal", () => {
    expect(formatMode(0o644)).toBe("0644");
    expect(formatMode(0o755)).toBe("0755");
    expect(formatMode(0o777)).toBe("0777");
  });
  it("pads short modes", () => {
    expect(formatMode(0o7)).toBe("0007");
  });
  it("masks to 12 bits (0o7777)", () => {
    // For modes that exceed 0o7777, the high bits are masked off and the
    // remaining octal digits are formatted with a leading '0'.
    expect(formatMode(0o17777)).toBe("07777");
    expect(formatMode(0o7777)).toBe("07777");
  });
});

// ===== formatMtime =====

describe("tar-extractor formatMtime", () => {
  it("returns ISO date string for valid timestamp", () => {
    const s = formatMtime(1577836800); // 2020-01-01
    expect(s).toContain("2020-01-01");
  });
  it("returns — for zero timestamp", () => {
    expect(formatMtime(0)).toBe("—");
  });
});

// ===== parseTarEntries =====

describe("tar-extractor parseTarEntries", () => {
  it("parses a single regular file", () => {
    const data = new TextEncoder().encode("hello world");
    const tar = buildTarArchive([{ name: "file.txt", data }]);
    const entries = parseTarEntries(tar);
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe("file.txt");
    expect(entries[0]!.size).toBe(11);
    expect(entries[0]!.type).toBe("regular");
    expect(entries[0]!.isRegularFile).toBe(true);
    expect(entries[0]!.isUstar).toBe(true);
    expect(entries[0]!.checksumValid).toBe(true);
  });

  it("parses multiple files in order", () => {
    const tar = buildTarArchive([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbb") },
      { name: "c.txt", data: new TextEncoder().encode("ccccc") },
    ]);
    const entries = parseTarEntries(tar);
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
    expect(entries.map((e) => e.size)).toEqual([3, 4, 5]);
  });

  it("stops at end-of-archive marker", () => {
    const tar = buildTarArchive([{ name: "f.txt", data: new TextEncoder().encode("x") }]);
    expect(parseTarEntries(tar).length).toBe(1);
  });

  it("parses empty archive (just two zero blocks)", () => {
    const tar = new Uint8Array(1024);
    expect(parseTarEntries(tar)).toEqual([]);
  });

  it("parses directory entry", () => {
    const h = buildHeader({ name: "mydir/", typeflag: "5", mode: 0o755 });
    const archive = buildArchive([h], [new Uint8Array(0)]);
    const entries = parseTarEntries(archive);
    expect(entries.length).toBe(1);
    expect(entries[0]!.type).toBe("directory");
    expect(entries[0]!.isRegularFile).toBe(false);
  });

  it("parses symlink entry", () => {
    const h = buildHeader({ name: "link.txt", typeflag: "2", linkname: "target.txt" });
    const archive = buildArchive([h], [new Uint8Array(0)]);
    const entries = parseTarEntries(archive);
    expect(entries[0]!.type).toBe("symlink");
    expect(entries[0]!.linkname).toBe("target.txt");
  });

  it("parses USTAR prefix field for long paths", () => {
    const h = buildHeader({
      name: "deep/file.txt",
      prefix: "very/long/path",
    });
    const archive = buildArchive([h], [new Uint8Array(0)]);
    const entries = parseTarEntries(archive);
    expect(entries[0]!.name).toBe("very/long/path/deep/file.txt");
    expect(entries[0]!.prefix).toBe("very/long/path");
  });

  it("reads mode and mtime fields", () => {
    const tar = buildTarArchive([{
      name: "f.txt",
      data: new Uint8Array(0),
      mode: 0o755,
      mtime: 1234567890,
    }]);
    const entries = parseTarEntries(tar);
    expect(entries[0]!.mode).toBe(0o755);
    expect(entries[0]!.mtime).toBe(1234567890);
  });

  it("reads uid and gid fields", () => {
    const h = buildHeader({ name: "f.txt", uid: 1000, gid: 2000 });
    const archive = buildArchive([h], [new Uint8Array(0)]);
    const entries = parseTarEntries(archive);
    expect(entries[0]!.uid).toBe(1000);
    expect(entries[0]!.gid).toBe(2000);
  });

  it("reads uname and gname fields", () => {
    const h = buildHeader({ name: "f.txt" });
    // Set uname/gname manually
    const enc = new TextEncoder();
    const uname = enc.encode("alice");
    h.set(uname, 265);
    const gname = enc.encode("staff");
    h.set(gname, 297);
    // Recompute checksum
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += h[i]!;
    const sumStr = sum.toString(8).padStart(6, "0") + "\0 ";
    const sumBytes = enc.encode(sumStr);
    h.set(sumBytes, 148);
    const archive = buildArchive([h], [new Uint8Array(0)]);
    const entries = parseTarEntries(archive);
    expect(entries[0]!.uname).toBe("alice");
    expect(entries[0]!.gname).toBe("staff");
  });

  it("handles GNU long-name records (typeflag L)", () => {
    const longName = "very/long/path/that/exceeds/100/characters/limit/for/standard/tar/headers/and/requires/gnu/extension.txt";
    // Build GNU 'L' record containing the long name
    const longNameBytes = new TextEncoder().encode(longName + "\0");
    const longHeader = buildHeader({ name: "././@LongName", typeflag: "L", size: longNameBytes.length, magic: "ustar  " });
    // Build the actual entry header (with truncated name)
    const realHeader = buildHeader({ name: "truncated", typeflag: "0", size: 3 });
    const archive = buildArchive(
      [longHeader, realHeader],
      [longNameBytes, new TextEncoder().encode("abc")],
    );
    const entries = parseTarEntries(archive);
    // The 'L' record is consumed and not returned; the next entry gets the long name.
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe(longName);
    expect(entries[0]!.size).toBe(3);
  });

  it("skips PAX extended headers (typeflag x)", () => {
    const paxData = new TextEncoder().encode("20 path=long-name.txt\n");
    const paxHeader = buildHeader({ name: "pax", typeflag: "x", size: paxData.length });
    const realHeader = buildHeader({ name: "short.txt", typeflag: "0", size: 5 });
    const archive = buildArchive(
      [paxHeader, realHeader],
      [paxData, new TextEncoder().encode("hello")],
    );
    const entries = parseTarEntries(archive);
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe("short.txt");
  });

  it("detects corrupted checksums", () => {
    const h = buildHeader({ name: "f.txt", size: 5 });
    // Corrupt the checksum field (set to wrong value)
    h[148] = 0x30; h[149] = 0x30; h[150] = 0x30; h[151] = 0x30; h[152] = 0x30; h[153] = 0x30;
    const archive = buildArchive([h], [new TextEncoder().encode("hello")]);
    const entries = parseTarEntries(archive);
    expect(entries[0]!.checksumValid).toBe(false);
  });

  it("handles entry with zero size", () => {
    const tar = buildTarArchive([{ name: "empty.txt", data: new Uint8Array(0) }]);
    const entries = parseTarEntries(tar);
    expect(entries[0]!.size).toBe(0);
    expect(entries[0]!.isRegularFile).toBe(true);
  });

  it("handles file with embedded null bytes in name (decodes up to NUL)", () => {
    const h = new Uint8Array(512);
    const enc = new TextEncoder();
    const name = enc.encode("file.txt");
    h.set(name, 0);
    h[100] = 0; // NUL terminator
    // Fill required fields with valid values
    h.set(enc.encode("0000644\0"), 100);
    h.set(enc.encode("0000000\0"), 108);
    h.set(enc.encode("0000000\0"), 116);
    h.set(enc.encode("00000000000\0"), 124);
    h.set(enc.encode("00000000000\0"), 136);
    for (let i = 148; i < 156; i++) h[i] = 0x20;
    h[156] = 0x30; // '0'
    h.set(enc.encode("ustar"), 257);
    h.set(enc.encode("00"), 263);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += h[i]!;
    h.set(enc.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
    const archive = buildArchive([h], [new Uint8Array(0)]);
    const entries = parseTarEntries(archive);
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe("file.txt");
  });
});

// ===== extractTarEntry =====

describe("tar-extractor extractTarEntry", () => {
  it("extracts file data correctly", () => {
    const data = new TextEncoder().encode("hello world");
    const tar = buildTarArchive([{ name: "file.txt", data }]);
    const entries = parseTarEntries(tar);
    const extracted = extractTarEntry(tar, entries[0]!);
    expect(extracted).toEqual(data);
  });

  it("extracts empty file", () => {
    const tar = buildTarArchive([{ name: "empty.txt", data: new Uint8Array(0) }]);
    const entries = parseTarEntries(tar);
    const extracted = extractTarEntry(tar, entries[0]!);
    expect(extracted.length).toBe(0);
  });

  it("extracts binary data", () => {
    const data = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) data[i] = i & 0xff;
    const tar = buildTarArchive([{ name: "binary.dat", data }]);
    const entries = parseTarEntries(tar);
    const extracted = extractTarEntry(tar, entries[0]!);
    expect(extracted).toEqual(data);
  });
});

// ===== isTarArchive =====

describe("tar-extractor isTarArchive", () => {
  it("returns true for valid USTAR archive", () => {
    const tar = buildTarArchive([{ name: "f.txt", data: new Uint8Array(0) }]);
    expect(isTarArchive(tar)).toBe(true);
  });
  it("returns false for non-TAR bytes", () => {
    expect(isTarArchive(new TextEncoder().encode("hello world"))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isTarArchive(new Uint8Array(10))).toBe(false);
  });
});

// ===== buildFileTree =====

describe("tar-extractor buildFileTree", () => {
  it("builds a flat tree for single file", () => {
    const entries: TarEntry[] = [
      { name: "file.txt", baseName: "file.txt", prefix: "", size: 5, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 512, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(1);
    expect(tree.children[0]!.name).toBe("file.txt");
    expect(tree.children[0]!.isDirectory).toBe(false);
  });

  it("infers directory structure from path", () => {
    const entries: TarEntry[] = [
      { name: "dir/sub/file.txt", baseName: "file.txt", prefix: "", size: 5, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 512, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children[0]!.name).toBe("dir");
    expect(tree.children[0]!.isDirectory).toBe(true);
    expect(tree.children[0]!.children[0]!.name).toBe("sub");
    expect(tree.children[0]!.children[0]!.isDirectory).toBe(true);
    expect(tree.children[0]!.children[0]!.children[0]!.name).toBe("file.txt");
  });

  it("sorts directories first, then alphabetically", () => {
    const entries: TarEntry[] = [
      { name: "z.txt", baseName: "z.txt", prefix: "", size: 1, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
      { name: "a.txt", baseName: "a.txt", prefix: "", size: 1, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
      { name: "dir/", baseName: "dir/", prefix: "", size: 0, typeflag: "5", type: "directory", isRegularFile: false, mode: 0o755, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children[0]!.name).toBe("dir");
    expect(tree.children[1]!.name).toBe("a.txt");
    expect(tree.children[2]!.name).toBe("z.txt");
  });
});

// ===== computeStats =====

describe("tar-extractor computeStats", () => {
  it("computes file counts correctly", () => {
    const entries: TarEntry[] = [
      { name: "a.txt", baseName: "a.txt", prefix: "", size: 10, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
      { name: "dir/", baseName: "dir/", prefix: "", size: 0, typeflag: "5", type: "directory", isRegularFile: false, mode: 0o755, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
      { name: "link", baseName: "link", prefix: "", size: 0, typeflag: "2", type: "symlink", isRegularFile: false, mode: 0o777, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "target", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const stats = computeStats(entries, 2048);
    expect(stats.entryCount).toBe(3);
    expect(stats.regularFileCount).toBe(1);
    expect(stats.directoryCount).toBe(1);
    expect(stats.symlinkCount).toBe(1);
    expect(stats.otherCount).toBe(0);
  });

  it("sums total extracted size", () => {
    const entries: TarEntry[] = [
      { name: "a.txt", baseName: "a.txt", prefix: "", size: 100, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
      { name: "b.txt", baseName: "b.txt", prefix: "", size: 200, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const stats = computeStats(entries, 512);
    expect(stats.totalExtractedSize).toBe(300);
  });

  it("finds largest file", () => {
    const entries: TarEntry[] = [
      { name: "small.txt", baseName: "small.txt", prefix: "", size: 100, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
      { name: "large.txt", baseName: "large.txt", prefix: "", size: 5000, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const stats = computeStats(entries, 1024);
    expect(stats.largestFileName).toBe("large.txt");
    expect(stats.largestFileSize).toBe(5000);
  });

  it("counts invalid checksums", () => {
    const entries: TarEntry[] = [
      { name: "ok.txt", baseName: "ok.txt", prefix: "", size: 5, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 100, storedChecksum: 100, checksumValid: true },
      { name: "bad.txt", baseName: "bad.txt", prefix: "", size: 5, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 100, storedChecksum: 99, checksumValid: false },
    ];
    const stats = computeStats(entries, 1024);
    expect(stats.invalidChecksumCount).toBe(1);
  });

  it("computes ratio (extracted / archive)", () => {
    const entries: TarEntry[] = [
      { name: "a.txt", baseName: "a.txt", prefix: "", size: 1000, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    ];
    const stats = computeStats(entries, 2048); // archive has 512-byte header + 512-byte data block + 1024 EOF = 2048
    expect(stats.ratio).toBeCloseTo(1000 / 2048, 5);
  });
});

// ===== detectMimeFromName =====

describe("tar-extractor detectMimeFromName", () => {
  it("detects text files", () => {
    expect(detectMimeFromName("file.txt")).toBe("text/plain");
    expect(detectMimeFromName("README.md")).toBe("text/plain");
    expect(detectMimeFromName("app.log")).toBe("text/plain");
  });
  it("detects JSON", () => {
    expect(detectMimeFromName("data.json")).toBe("application/json");
  });
  it("detects CSV", () => {
    expect(detectMimeFromName("data.csv")).toBe("text/csv");
  });
  it("detects images", () => {
    expect(detectMimeFromName("img.png")).toBe("image/png");
    expect(detectMimeFromName("img.jpg")).toBe("image/jpeg");
    expect(detectMimeFromName("img.jpeg")).toBe("image/jpeg");
    expect(detectMimeFromName("img.gif")).toBe("image/gif");
    expect(detectMimeFromName("img.svg")).toBe("image/svg+xml");
  });
  it("detects PDF", () => {
    expect(detectMimeFromName("doc.pdf")).toBe("application/pdf");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeFromName("file.xyz")).toBe("application/octet-stream");
    expect(detectMimeFromName("file")).toBe("application/octet-stream");
  });
  it("is case-insensitive", () => {
    expect(detectMimeFromName("FILE.TXT")).toBe("text/plain");
    expect(detectMimeFromName("Photo.PNG")).toBe("image/png");
  });
});

// ===== previewFile =====

describe("tar-extractor previewFile", () => {
  it("previews text as text", () => {
    const data = new TextEncoder().encode("Hello, world!\nLine 2\n");
    const p = previewFile(data);
    expect(p.isText).toBe(true);
    expect(p.text).toContain("Hello, world!");
    expect(p.truncated).toBe(false);
  });

  it("previews binary as hex", () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const p = previewFile(data);
    expect(p.isText).toBe(false);
    expect(p.hex).toContain("00 01 02");
    expect(p.hex).toContain("00000000");
  });

  it("truncates large files", () => {
    const data = new TextEncoder().encode("a".repeat(20000));
    const p = previewFile(data, 8192);
    expect(p.previewSize).toBe(8192);
    expect(p.totalSize).toBe(20000);
    expect(p.truncated).toBe(true);
  });

  it("handles empty input", () => {
    const p = previewFile(new Uint8Array(0));
    expect(p.isText).toBe(false);
    expect(p.text).toBe("");
  });
});

// ===== looksLikeText =====

describe("tar-extractor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("hello world\n"))).toBe(true);
  });
  it("returns false for binary data", () => {
    expect(looksLikeText(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBe(false);
  });
});

// ===== searchEntries =====

describe("tar-extractor searchEntries", () => {
  const entries: TarEntry[] = [
    { name: "src/app.ts", baseName: "app.ts", prefix: "", size: 100, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    { name: "src/index.ts", baseName: "index.ts", prefix: "", size: 200, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    { name: "README.md", baseName: "README.md", prefix: "", size: 500, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
  ];
  it("returns all entries for empty query", () => {
    expect(searchEntries(entries, "").length).toBe(3);
  });
  it("filters by substring (case-insensitive)", () => {
    expect(searchEntries(entries, "APP").length).toBe(1);
    expect(searchEntries(entries, ".ts").length).toBe(2);
  });
  it("returns empty for no matches", () => {
    expect(searchEntries(entries, "nope")).toEqual([]);
  });
});

// ===== filterByType =====

describe("tar-extractor filterByType", () => {
  const entries: TarEntry[] = [
    { name: "file.txt", baseName: "file.txt", prefix: "", size: 5, typeflag: "0", type: "regular", isRegularFile: true, mode: 0o644, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    { name: "dir/", baseName: "dir/", prefix: "", size: 0, typeflag: "5", type: "directory", isRegularFile: false, mode: 0o755, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
    { name: "link", baseName: "link", prefix: "", size: 0, typeflag: "2", type: "symlink", isRegularFile: false, mode: 0o777, mtime: 0, uid: 0, gid: 0, uname: "", gname: "", linkname: "target", magic: "ustar", isUstar: true, dataOffset: 0, computedChecksum: 0, storedChecksum: 0, checksumValid: true },
  ];
  it("returns all for 'all' filter", () => {
    expect(filterByType(entries, "all").length).toBe(3);
  });
  it("filters to regular files only", () => {
    const r = filterByType(entries, "regular");
    expect(r.length).toBe(1);
    expect(r[0]!.type).toBe("regular");
  });
  it("filters to directories only", () => {
    expect(filterByType(entries, "directory").length).toBe(1);
  });
  it("filters to symlinks only", () => {
    expect(filterByType(entries, "symlink").length).toBe(1);
  });
});

// ===== formatBytes / formatRatio =====

describe("tar-extractor formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("tar-extractor formatRatio", () => {
  it("formats ratio", () => {
    expect(formatRatio(1.5)).toBe("1.50×");
  });
});

// ===== History (localStorage) =====

describe("tar-extractor history", () => {
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
      fileName: "archive.tar", archiveSize: 1024, entryCount: 5,
      regularFileCount: 4, totalExtractedSize: 800,
      extractedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `a${i}.tar`, archiveSize: 100, entryCount: 1,
        regularFileCount: 1, totalExtractedSize: 50,
        extractedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.tar", archiveSize: 100, entryCount: 1,
      regularFileCount: 1, totalExtractedSize: 50,
      extractedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("tar-extractor share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/tar-extractor",
    };
  });

  it("builds share URL with filter and search", () => {
    const url = buildShareUrl({ filter: "regular", search: "test" });
    expect(url).toContain("filter=regular");
    expect(url).toContain("q=test");
  });
  it("omits default 'all' filter", () => {
    const url = buildShareUrl({ filter: "all", search: "" });
    expect(url).not.toContain("filter=");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ filter: "symlink", search: "x" });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.filter).toBe("symlink");
    expect(parsed?.search).toBe("x");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});

// ===== createZipBlob =====

describe("tar-extractor createZipBlob", () => {
  it("creates valid ZIP signature", async () => {
    const blob = createZipBlob([
      { name: "a.txt", data: new Uint8Array([1, 2, 3]) },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ===== buildZipFromTar =====

describe("tar-extractor buildZipFromTar", () => {
  it("builds a ZIP from TAR regular files", async () => {
    const tar = buildTarArchive([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbb") },
    ]);
    const entries = parseTarEntries(tar);
    const blob = buildZipFromTar(tar, entries);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
  it("skips non-regular files", async () => {
    const dirHeader = buildHeader({ name: "dir/", typeflag: "5" });
    const fileHeader = buildHeader({ name: "file.txt", typeflag: "0", size: 3 });
    const archive = buildArchive(
      [dirHeader, fileHeader],
      [new Uint8Array(0), new TextEncoder().encode("abc")],
    );
    const entries = parseTarEntries(archive);
    const blob = buildZipFromTar(archive, entries);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Should still be a valid ZIP, but only one entry
    expect(buf[0]).toBe(0x50);
  });
});
