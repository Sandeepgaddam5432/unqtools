import { describe, it, expect, beforeEach } from "vitest";
import {
  RPM_LEAD_MAGIC, RPM_HEADER_MAGIC, CPIO_MAGIC,
  RPM_TAG_NAME, RPM_TAG_VERSION, RPM_TAG_RELEASE, RPM_TAG_SUMMARY, RPM_TAG_ARCH,
  RPM_TAG_BASENAMES,
  isRpmFile, parseLead, parseHeader, readTagString, readTagStringArray,
  extractMetadata, parseCpio, extractCpioEntry, computeStats,
  buildFileTree, searchEntries, filterByType, detectMimeFromName,
  previewFile, looksLikeText, buildZipFromCpio,
  formatBytes, formatMode, formatMtime,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  extractRpm,
  type RpmHeader,
} from "./logic";

// ===== Helpers =====

function writeU16BE(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function writeU32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function writeCString(s: string, length: number): number[] {
  const bytes = new Array(length).fill(0);
  for (let i = 0; i < s.length && i < length - 1; i++) {
    bytes[i] = s.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
}

/** Build a CPIO newc archive from a list of files. Pads name+data to 4-byte
 * boundaries based on absolute position (matching the cpio spec). */
function buildCpioBytes(files: Array<{ name: string; data: Uint8Array; mode?: number }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const writeHex = (value: number, width: number) => {
    const hex = value.toString(16).padStart(width, "0").slice(0, width);
    return new TextEncoder().encode(hex);
  };
  let absPos = 0;
  const pushPad = (n: number) => {
    if (n > 0) { parts.push(new Uint8Array(n)); absPos += n; }
  };
  for (const file of files) {
    const mode = file.mode ?? 0o100644;
    const nameBytes = new TextEncoder().encode(file.name + "\0");
    const namesize = nameBytes.length;
    const header = new Uint8Array(110);
    header.set(new TextEncoder().encode(CPIO_MAGIC), 0);
    header.set(writeHex(1, 8), 6);        // ino
    header.set(writeHex(mode, 8), 14);    // mode
    header.set(writeHex(0, 8), 22);       // uid
    header.set(writeHex(0, 8), 30);       // gid
    header.set(writeHex(1, 8), 38);       // nlink
    header.set(writeHex(0, 8), 46);       // mtime
    header.set(writeHex(file.data.length, 8), 54); // filesize
    header.set(writeHex(0, 8), 62);       // devmajor
    header.set(writeHex(0, 8), 70);       // devminor
    header.set(writeHex(0, 8), 78);       // rdevmajor
    header.set(writeHex(0, 8), 86);       // rdevminor
    header.set(writeHex(namesize, 8), 94); // namesize
    header.set(writeHex(0, 8), 102);      // check
    parts.push(header); absPos += 110;
    parts.push(nameBytes); absPos += namesize;
    // Pad name to next 4-byte boundary (absolute)
    pushPad((4 - (absPos % 4)) % 4);
    parts.push(file.data); absPos += file.data.length;
    // Pad data to next 4-byte boundary (absolute)
    pushPad((4 - (absPos % 4)) % 4);
  }
  // Trailer
  const trailerName = new TextEncoder().encode("TRAILER!!!\0");
  const trailerHeader = new Uint8Array(110);
  trailerHeader.set(new TextEncoder().encode(CPIO_MAGIC), 0);
  trailerHeader.set(writeHex(0, 8), 6);
  trailerHeader.set(writeHex(0, 8), 14);
  trailerHeader.set(writeHex(0, 8), 22);
  trailerHeader.set(writeHex(0, 8), 30);
  trailerHeader.set(writeHex(1, 8), 38);
  trailerHeader.set(writeHex(0, 8), 46);
  trailerHeader.set(writeHex(0, 8), 54);
  trailerHeader.set(writeHex(0, 8), 62);
  trailerHeader.set(writeHex(0, 8), 70);
  trailerHeader.set(writeHex(0, 8), 78);
  trailerHeader.set(writeHex(0, 8), 86);
  trailerHeader.set(writeHex(trailerName.length, 8), 94);
  trailerHeader.set(writeHex(0, 8), 102);
  parts.push(trailerHeader); absPos += 110;
  parts.push(trailerName); absPos += trailerName.length;
  pushPad((4 - (absPos % 4)) % 4);

  const outLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(outLen);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

/** Build an RPM file with the given metadata + cpio payload. */
function buildRpmBytes(opts: {
  name?: string;
  version?: string;
  release?: string;
  summary?: string;
  arch?: string;
  basenames?: string[];
  cpioFiles?: Array<{ name: string; data: Uint8Array; mode?: number }>;
}): Uint8Array {
  // 1. Lead header (96 bytes)
  const lead: number[] = [];
  lead.push(...RPM_LEAD_MAGIC);
  lead.push(3); // major
  lead.push(0); // minor
  lead.push(...writeU16BE(0)); // type=binary
  lead.push(...writeU16BE(1)); // archnum
  lead.push(...writeCString(opts.name ?? "test-pkg", 66));
  lead.push(...writeU16BE(1)); // osnum
  lead.push(...writeU16BE(5)); // signature_type
  lead.push(...new Array(16).fill(0)); // reserved

  // 2. Signature header (minimal): 16-byte header + 0 index entries + 0 data
  const sigHeader: number[] = [];
  sigHeader.push(...RPM_HEADER_MAGIC);
  sigHeader.push(1); // version
  sigHeader.push(...new Array(4).fill(0)); // reserved
  sigHeader.push(...writeU32BE(0)); // nindex
  sigHeader.push(...writeU32BE(0)); // hsize
  // Pad to 8-byte boundary (already 16 bytes — already aligned)

  // 3. Regular header with metadata tags
  // Build data section: each string is NUL-terminated
  const dataStore: number[] = [];
  const indexEntries: Array<{ tag: number; type: number; offset: number; count: number }> = [];
  const addString = (tag: number, value: string) => {
    if (!value) return;
    indexEntries.push({ tag, type: 6, offset: dataStore.length, count: 1 });
    for (const c of value) dataStore.push(c.charCodeAt(0) & 0xff);
    dataStore.push(0); // NUL terminator
  };
  const addStringArray = (tag: number, values: string[]) => {
    if (values.length === 0) return;
    indexEntries.push({ tag, type: 8, offset: dataStore.length, count: values.length });
    for (const v of values) {
      for (const c of v) dataStore.push(c.charCodeAt(0) & 0xff);
      dataStore.push(0);
    }
  };
  addString(RPM_TAG_NAME, opts.name ?? "test-pkg");
  addString(RPM_TAG_VERSION, opts.version ?? "1.0");
  addString(RPM_TAG_RELEASE, opts.release ?? "1");
  addString(RPM_TAG_SUMMARY, opts.summary ?? "Test package");
  addString(RPM_TAG_ARCH, opts.arch ?? "x86_64");
  addStringArray(RPM_TAG_BASENAMES, opts.basenames ?? []);

  const regHeader: number[] = [];
  regHeader.push(...RPM_HEADER_MAGIC);
  regHeader.push(1);
  regHeader.push(...new Array(4).fill(0));
  regHeader.push(...writeU32BE(indexEntries.length));
  regHeader.push(...writeU32BE(dataStore.length));
  for (const e of indexEntries) {
    regHeader.push(...writeU32BE(e.tag));
    regHeader.push(...writeU32BE(e.type));
    regHeader.push(...writeU32BE(e.offset));
    regHeader.push(...writeU32BE(e.count));
  }
  regHeader.push(...dataStore);
  // Pad to 8-byte boundary
  while (regHeader.length % 8 !== 0) regHeader.push(0);

  // 4. CPIO payload (uncompressed)
  const cpio = buildCpioBytes(opts.cpioFiles ?? []);

  const total = lead.length + sigHeader.length + regHeader.length + cpio.length;
  const out = new Uint8Array(total);
  let pos = 0;
  out.set(new Uint8Array(lead), pos); pos += lead.length;
  out.set(new Uint8Array(sigHeader), pos); pos += sigHeader.length;
  out.set(new Uint8Array(regHeader), pos); pos += regHeader.length;
  out.set(cpio, pos);
  return out;
}

// ===== localStorage mock =====
let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => k in store ? store[k]! : null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: Object.keys(store).length,
  } as Storage;
});

// ===== isRpmFile =====

describe("rpm-extractor isRpmFile", () => {
  it("returns true for a valid RPM lead magic", () => {
    const bytes = buildRpmBytes({});
    expect(isRpmFile(bytes)).toBe(true);
  });
  it("returns false for a corrupted magic", () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0]);
    expect(isRpmFile(bytes)).toBe(false);
  });
  it("returns false for too-small input", () => {
    expect(isRpmFile(new Uint8Array(2))).toBe(false);
  });
});

// ===== parseLead =====

describe("rpm-extractor parseLead", () => {
  it("parses name, version, type from lead", () => {
    const bytes = buildRpmBytes({ name: "my-package" });
    const lead = parseLead(bytes);
    expect(lead.major).toBe(3);
    expect(lead.minor).toBe(0);
    expect(lead.type).toBe(0);
    expect(lead.name).toBe("my-package");
    expect(lead.signatureType).toBe(5);
  });
  it("throws on too-small input", () => {
    expect(() => parseLead(new Uint8Array(50))).toThrow(/too small/);
  });
  it("throws on bad magic", () => {
    const bytes = new Uint8Array(96);
    bytes[0] = 0xff;
    expect(() => parseLead(bytes)).toThrow(/missing lead magic/);
  });
});

// ===== parseHeader =====

describe("rpm-extractor parseHeader", () => {
  it("parses signature header with 0 entries", () => {
    const bytes = buildRpmBytes({});
    const sig = parseHeader(bytes, 96);
    expect(sig.nindex).toBe(0);
    expect(sig.hsize).toBe(0);
    expect(sig.nextOffset).toBe(112); // 96 + 16 = 112
  });
  it("parses regular header with metadata entries", () => {
    const bytes = buildRpmBytes({ name: "my-package", version: "2.5" });
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    expect(reg.nindex).toBeGreaterThan(0);
    expect(reg.index.length).toBe(reg.nindex);
  });
  it("throws on truncated header", () => {
    const bytes = new Uint8Array(10);
    bytes[0] = 0x8e; bytes[1] = 0xad; bytes[2] = 0xe8;
    expect(() => parseHeader(bytes, 0)).toThrow(/truncated/);
  });
  it("throws on bad header magic", () => {
    const bytes = new Uint8Array(20);
    bytes[0] = 0xff;
    expect(() => parseHeader(bytes, 0)).toThrow(/Invalid RPM header magic/);
  });
});

// ===== readTagString =====

describe("rpm-extractor readTagString", () => {
  it("reads the NAME tag", () => {
    const bytes = buildRpmBytes({ name: "my-test-pkg" });
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    expect(readTagString(reg, bytes, RPM_TAG_NAME)).toBe("my-test-pkg");
  });
  it("reads VERSION and RELEASE", () => {
    const bytes = buildRpmBytes({ version: "3.1.4", release: "2.el9" });
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    expect(readTagString(reg, bytes, RPM_TAG_VERSION)).toBe("3.1.4");
    expect(readTagString(reg, bytes, RPM_TAG_RELEASE)).toBe("2.el9");
  });
  it("returns empty string for missing tag", () => {
    const bytes = buildRpmBytes({});
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    expect(readTagString(reg, bytes, 99999)).toBe("");
  });
});

// ===== readTagStringArray =====

describe("rpm-extractor readTagStringArray", () => {
  it("reads BASENAMES array", () => {
    const bytes = buildRpmBytes({ basenames: ["usr/bin/foo", "usr/lib/bar.so"] });
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    const names = readTagStringArray(reg, bytes, RPM_TAG_BASENAMES);
    expect(names.length).toBe(2);
    expect(names[0]).toBe("usr/bin/foo");
    expect(names[1]).toBe("usr/lib/bar.so");
  });
  it("returns empty array for missing tag", () => {
    const bytes = buildRpmBytes({});
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    expect(readTagStringArray(reg, bytes, 99999)).toEqual([]);
  });
});

// ===== extractMetadata =====

describe("rpm-extractor extractMetadata", () => {
  it("extracts all metadata fields", () => {
    const bytes = buildRpmBytes({
      name: "mypkg", version: "1.2.3", release: "4",
      summary: "A test package", arch: "noarch",
      basenames: ["foo.txt"],
    });
    const sig = parseHeader(bytes, 96);
    const reg = parseHeader(bytes, sig.nextOffset);
    const meta = extractMetadata(reg, bytes);
    expect(meta.name).toBe("mypkg");
    expect(meta.version).toBe("1.2.3");
    expect(meta.release).toBe("4");
    expect(meta.summary).toBe("A test package");
    expect(meta.architecture).toBe("noarch");
    expect(meta.fileNames).toEqual(["foo.txt"]);
  });
});

// ===== parseCpio =====

describe("rpm-extractor parseCpio", () => {
  it("parses a cpio archive with one file", () => {
    const text = "Hello, World!";
    const cpio = buildCpioBytes([{ name: "hello.txt", data: new TextEncoder().encode(text) }]);
    const entries = parseCpio(cpio);
    expect(entries.length).toBe(1);
    expect(entries[0]!.name).toBe("hello.txt");
    expect(entries[0]!.fileSize).toBe(text.length);
    expect(entries[0]!.type).toBe("regular");
    expect(entries[0]!.isRegularFile).toBe(true);
  });
  it("parses multiple files", () => {
    const cpio = buildCpioBytes([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbb") },
      { name: "c.txt", data: new TextEncoder().encode("c") },
    ]);
    const entries = parseCpio(cpio);
    expect(entries.length).toBe(3);
    expect(entries[0]!.name).toBe("a.txt");
    expect(entries[1]!.name).toBe("b.txt");
    expect(entries[2]!.name).toBe("c.txt");
  });
  it("handles directory entries", () => {
    const cpio = buildCpioBytes([
      { name: "mydir", data: new Uint8Array(0), mode: 0o040755 },
    ]);
    const entries = parseCpio(cpio);
    expect(entries.length).toBe(1);
    expect(entries[0]!.type).toBe("directory");
  });
  it("handles symlink entries", () => {
    const cpio = buildCpioBytes([
      { name: "link", data: new TextEncoder().encode("target.txt"), mode: 0o120755 },
    ]);
    const entries = parseCpio(cpio);
    expect(entries.length).toBe(1);
    expect(entries[0]!.type).toBe("symlink");
  });
  it("stops at TRAILER!!! marker", () => {
    const cpio = buildCpioBytes([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
    ]);
    const entries = parseCpio(cpio);
    expect(entries.length).toBe(1);
  });
  it("returns empty array for non-cpio input", () => {
    expect(parseCpio(new Uint8Array(100))).toEqual([]);
  });
});

// ===== extractCpioEntry =====

describe("rpm-extractor extractCpioEntry", () => {
  it("extracts file data correctly", () => {
    const text = "Hello, World!";
    const cpio = buildCpioBytes([{ name: "hello.txt", data: new TextEncoder().encode(text) }]);
    const entries = parseCpio(cpio);
    const data = extractCpioEntry(cpio, entries[0]!);
    expect(new TextDecoder().decode(data)).toBe(text);
  });
});

// ===== computeStats =====

describe("rpm-extractor computeStats", () => {
  it("computes file/dir/symlink counts and sizes", () => {
    const cpio = buildCpioBytes([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbbbbb") },
      { name: "mydir", data: new Uint8Array(0), mode: 0o040755 },
      { name: "link", data: new TextEncoder().encode("target"), mode: 0o120755 },
    ]);
    const entries = parseCpio(cpio);
    const stats = computeStats(entries, 1000, false);
    expect(stats.fileCount).toBe(2);
    expect(stats.directoryCount).toBe(1);
    expect(stats.symlinkCount).toBe(1);
    expect(stats.totalExtractedSize).toBe(9);
    expect(stats.largestFileSize).toBe(6);
    expect(stats.largestFileName).toBe("b.txt");
    expect(stats.payloadCompressed).toBe(false);
  });
});

// ===== buildFileTree =====

describe("rpm-extractor buildFileTree", () => {
  it("builds a tree from flat paths", () => {
    const cpio = buildCpioBytes([
      { name: "usr/bin/foo", data: new Uint8Array(0) },
      { name: "usr/lib/bar.so", data: new Uint8Array(0) },
      { name: "etc/foo.conf", data: new Uint8Array(0) },
    ]);
    const entries = parseCpio(cpio);
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(2); // usr, etc
    const usr = tree.children.find((c) => c.name === "usr");
    expect(usr).toBeDefined();
    expect(usr!.children.length).toBe(2); // bin, lib
  });
});

// ===== searchEntries / filterByType =====

describe("rpm-extractor searchEntries", () => {
  it("filters by query", () => {
    const entries = [
      { name: "usr/bin/foo", mode: 0, fileSize: 0, uid: 0, gid: 0, mtime: 0, nlink: 1, type: "regular" as const, isRegularFile: true, dataOffset: 0 },
      { name: "usr/lib/bar.so", mode: 0, fileSize: 0, uid: 0, gid: 0, mtime: 0, nlink: 1, type: "regular" as const, isRegularFile: true, dataOffset: 0 },
    ];
    expect(searchEntries(entries, "foo").length).toBe(1);
    expect(searchEntries(entries, "").length).toBe(2);
  });
});

describe("rpm-extractor filterByType", () => {
  it("filters by regular", () => {
    const entries = [
      { name: "a", mode: 0, fileSize: 0, uid: 0, gid: 0, mtime: 0, nlink: 1, type: "regular" as const, isRegularFile: true, dataOffset: 0 },
      { name: "b", mode: 0, fileSize: 0, uid: 0, gid: 0, mtime: 0, nlink: 1, type: "directory" as const, isRegularFile: false, dataOffset: 0 },
    ];
    expect(filterByType(entries, "all").length).toBe(2);
    expect(filterByType(entries, "regular").length).toBe(1);
    expect(filterByType(entries, "directory").length).toBe(1);
  });
});

// ===== detectMimeFromName =====

describe("rpm-extractor detectMimeFromName", () => {
  it("detects common types", () => {
    expect(detectMimeFromName("foo.txt")).toBe("text/plain");
    expect(detectMimeFromName("foo.json")).toBe("application/json");
    expect(detectMimeFromName("foo.png")).toBe("image/png");
    expect(detectMimeFromName("foo.pdf")).toBe("application/pdf");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeFromName("foo.xyz")).toBe("application/octet-stream");
  });
});

// ===== previewFile / looksLikeText =====

describe("rpm-extractor previewFile", () => {
  it("returns text preview for text files", () => {
    const data = new TextEncoder().encode("Hello, World!");
    const preview = previewFile(data);
    expect(preview.isText).toBe(true);
    expect(preview.text).toBe("Hello, World!");
    expect(preview.truncated).toBe(false);
  });
  it("returns hex preview for binary files", () => {
    const data = new Uint8Array([0, 1, 2, 3, 0xff, 0xfe, 0xfd, 0xfc]);
    const preview = previewFile(data);
    expect(preview.isText).toBe(false);
    expect(preview.hex).toContain("00 01 02 03");
  });
});

describe("rpm-extractor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("Hello, World!"))).toBe(true);
  });
  it("returns false for binary", () => {
    expect(looksLikeText(new Uint8Array([0, 1, 2, 3, 0xff, 0xfe]))).toBe(false);
  });
});

// ===== buildZipFromCpio =====

describe("rpm-extractor buildZipFromCpio", () => {
  it("builds a ZIP from cpio entries", () => {
    const cpio = buildCpioBytes([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbb") },
    ]);
    const entries = parseCpio(cpio);
    const blob = buildZipFromCpio(cpio, entries);
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ===== formatBytes / formatMode / formatMtime =====

describe("rpm-extractor formatters", () => {
  it("formatBytes works", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formatMode works", () => {
    expect(formatMode(0o100644)).toBe("0644");
  });
  it("formatMtime works", () => {
    expect(formatMtime(0)).toBe("—");
    expect(formatMtime(1700000000)).toMatch(/2023/);
  });
});

// ===== extractRpm (top-level) =====

describe("rpm-extractor extractRpm", () => {
  it("extracts a valid RPM file", async () => {
    const bytes = buildRpmBytes({
      name: "test-pkg", version: "1.0", release: "1",
      cpioFiles: [
        { name: "usr/bin/foo", data: new TextEncoder().encode("#!/bin/sh\necho hi") },
        { name: "usr/share/doc/foo/README", data: new TextEncoder().encode("This is a readme.") },
      ],
    });
    const result = await extractRpm(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.lead.name).toBe("test-pkg");
      expect(result.output.metadata.name).toBe("test-pkg");
      expect(result.output.metadata.version).toBe("1.0");
      expect(result.output.entries.length).toBe(2);
      expect(result.output.stats.fileCount).toBe(2);
    }
  });
  it("fails on bad magic", async () => {
    const result = await extractRpm(new Uint8Array(100));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/missing lead magic/);
  });
});

// ===== History =====

describe("rpm-extractor history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.rpm", rpmSize: 100,
      packageName: "test", packageVersion: "1.0",
      fileCount: 5, totalExtractedSize: 500,
      extractedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.packageName).toBe("test");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.rpm`, rpmSize: i,
        packageName: `p${i}`, packageVersion: "1.0",
        fileCount: 1, totalExtractedSize: 1,
        extractedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.rpm", rpmSize: 1,
      packageName: "p", packageVersion: "1.0",
      fileCount: 1, totalExtractedSize: 1,
      extractedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("rpm-extractor shareUrl", () => {
  it("builds a URL with filter and search", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/rpm-extractor" },
    };
    const url = buildShareUrl({ filter: "regular", search: "foo" });
    expect(url).toContain("filter=regular");
    expect(url).toContain("q=foo");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const opts = parseShareUrl("#filter=regular&q=foo");
    expect(opts).not.toBeNull();
    expect(opts!.filter).toBe("regular");
    expect(opts!.search).toBe("foo");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns all filter when filter is invalid", () => {
    const opts = parseShareUrl("#filter=invalid");
    expect(opts!.filter).toBe("all");
  });
});
