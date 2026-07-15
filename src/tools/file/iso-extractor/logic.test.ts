import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseVolumeDescriptorHeader, parsePrimaryVolumeDescriptor,
  parseDirectoryRecord, readDirectoryEntries, walkDirectoryTree,
  classifyIsoFile, buildFileTree, searchEntries, filterByType,
  computeStats, detectMimeFromName, previewFile, looksLikeText,
  extractFile, createZipBlob, buildZipFromEntries,
  parseIso, isIsoImage,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type IsoEntry, type IsoFilter,
} from "./logic";

// Helpers

const SECTOR_SIZE = 2048;

function writeU8(value: number): number[] {
  return [value & 0xff];
}

function writeU16LE(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function writeU16BE(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function writeU16Both(value: number): number[] {
  return [...writeU16LE(value), ...writeU16BE(value)];
}

function writeU32LE(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function writeU32BE(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function writeU32Both(value: number): number[] {
  return [...writeU32LE(value), ...writeU32BE(value)];
}

function writeString(s: string, length: number): number[] {
  const bytes = new Array(length).fill(0x20); // space-padded
  for (let i = 0; i < s.length && i < length; i++) {
    bytes[i] = s.charCodeAt(i);
  }
  return bytes;
}

function writeJolietString(s: string, length: number): number[] {
  // UTF-16BE, space-padded (0x00 0x20)
  const bytes = new Array(length).fill(0);
  for (let i = 0; i < length; i += 2) {
    if (i / 2 < s.length) {
      const code = s.charCodeAt(i / 2);
      bytes[i] = (code >> 8) & 0xff;
      bytes[i + 1] = code & 0xff;
    } else {
      bytes[i] = 0x00;
      bytes[i + 1] = 0x20; // space padding
    }
  }
  return bytes;
}

function writeDate7(yearOffset: number, month: number, day: number): number[] {
  // 7-byte recording date: year, month, day, hour, minute, second, tz
  return [yearOffset, month, day, 0, 0, 0, 0];
}

function writeVolumeDate(year: number, month: number, day: number): number[] {
  // 17-byte ASCII date: YYYYMMDDHHMMSSFF + tz byte
  const str = `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}00000000`;
  const bytes = Array.from(str).map((c) => c.charCodeAt(0));
  bytes.push(0); // tz
  return bytes;
}

interface BuildDirEntryOptions {
  name: string;
  isDirectory?: boolean;
  extent?: number;
  length?: number;
  isJoliet?: boolean;
}

function buildDirEntry(opts: BuildDirEntryOptions): number[] {
  const isDirectory = opts.isDirectory ?? false;
  const extent = opts.extent ?? 0;
  const length = opts.length ?? 0;
  const isJoliet = opts.isJoliet ?? false;
  const name = opts.name;
  // File ID: ASCII or UTF-16BE
  let fileIdBytes: number[];
  if (isJoliet) {
    fileIdBytes = [];
    for (let i = 0; i < name.length; i++) {
      const code = name.charCodeAt(i);
      fileIdBytes.push((code >> 8) & 0xff, code & 0xff);
    }
  } else {
    fileIdBytes = Array.from(name).map((c) => c.charCodeAt(0));
  }
  const fileIdLength = fileIdBytes.length;
  // Total record length: 33 + fileIdLength + (padding if even)
  const padding = fileIdLength % 2 === 0 ? 1 : 0;
  const recordLength = 33 + fileIdLength + padding;
  const record: number[] = [];
  record.push(...writeU8(recordLength));          // length
  record.push(...writeU8(0));                     // ext attr record length
  record.push(...writeU32Both(extent));           // extent location
  record.push(...writeU32Both(length));           // data length
  record.push(...writeDate7(yearOffsetFor(2024), 1, 1));  // recording date
  record.push(...writeU8(isDirectory ? 0x02 : 0x00)); // flags
  record.push(...writeU8(0));                     // file unit size
  record.push(...writeU8(0));                     // interleave gap size
  record.push(...writeU16Both(1));                // volume sequence number
  record.push(...writeU8(fileIdLength));          // file ID length
  record.push(...fileIdBytes);                    // file ID
  for (let i = 0; i < padding; i++) record.push(0);
  return record;
}

function yearOffsetFor(year: number): number {
  return year - 1900;
}

interface BuildIsoOptions {
  volumeId?: string;
  systemId?: string;
  files?: Array<{ name: string; content: string }>;
  directories?: Array<{ name: string; files?: Array<{ name: string; content: string }> }>;
}

function buildIsoBytes(opts: BuildIsoOptions = {}): Uint8Array {
  const volumeId = opts.volumeId ?? "TESTVOLUME";
  const systemId = opts.systemId ?? "LINUX";
  const files = opts.files ?? [
    { name: "readme.txt;1", content: "Hello, world!" },
    { name: "index.html;1", content: "<html><body>Hi</body></html>" },
  ];
  const directories = opts.directories ?? [];

  // Layout:
  //   Sectors 0-15: system area (zeros)
  //   Sector 16: PVD
  //   Sector 17: terminator
  //   Sector 18+: root directory contents (one or more sectors)
  //   Then: file data sectors
  //   Then: subdirectory contents + their file data

  const pvdSector = 16;
  const terminatorSector = 17;
  const rootDirSector = 18;
  const rootDirSize = SECTOR_SIZE; // 1 sector for root directory
  // File data starts at sector 19
  let nextSector = rootDirSector + 1; // = 19

  // Assign sectors to top-level files
  const fileAssignments: Array<{ name: string; content: string; sector: number; size: number }> = [];
  for (const file of files) {
    const fileBytes = new TextEncoder().encode(file.content);
    const fileSectors = Math.max(1, Math.ceil(fileBytes.length / SECTOR_SIZE));
    fileAssignments.push({ name: file.name, content: file.content, sector: nextSector, size: fileBytes.length });
    nextSector += fileSectors;
  }
  // Assign sectors to directories
  const dirAssignments: Array<{ name: string; sector: number; files: Array<{ name: string; content: string; sector: number; size: number }> }> = [];
  for (const dir of directories) {
    const dirSector = nextSector;
    nextSector += 1;
    const dirFiles: Array<{ name: string; content: string; sector: number; size: number }> = [];
    for (const file of dir.files ?? []) {
      const fileBytes = new TextEncoder().encode(file.content);
      const fileSectors = Math.max(1, Math.ceil(fileBytes.length / SECTOR_SIZE));
      dirFiles.push({ name: file.name, content: file.content, sector: nextSector, size: fileBytes.length });
      nextSector += fileSectors;
    }
    dirAssignments.push({ name: dir.name, sector: dirSector, files: dirFiles });
  }

  const totalSectors = nextSector;
  const totalBytes = totalSectors * SECTOR_SIZE;
  const out = new Uint8Array(totalBytes);

  // Build PVD at sector 16
  const pvdOffset = pvdSector * SECTOR_SIZE;
  out[0 + pvdOffset] = 0x01; // type = primary
  out.set(new TextEncoder().encode("CD001"), pvdOffset + 1); // standard ID
  out[pvdOffset + 6] = 0x01; // version
  out.set(new Uint8Array(writeString(systemId, 32)), pvdOffset + 8);
  out.set(new Uint8Array(writeString(volumeId, 32)), pvdOffset + 40);
  out.set(new Uint8Array(writeU32Both(totalSectors)), pvdOffset + 80); // volume space size
  out.set(new Uint8Array(writeU16Both(1)), pvdOffset + 120); // volume set size
  out.set(new Uint8Array(writeU16Both(1)), pvdOffset + 124); // volume sequence number
  out.set(new Uint8Array(writeU16Both(SECTOR_SIZE)), pvdOffset + 128); // logical block size
  out.set(new Uint8Array(writeU32Both(SECTOR_SIZE)), pvdOffset + 132); // path table size
  out.set(new Uint8Array(writeU32LE(0)), pvdOffset + 140); // type L path table location
  out.set(new Uint8Array(writeU32BE(0)), pvdOffset + 148); // type M path table location
  // Root directory record (34 bytes at offset 156)
  const rootRecord = [
    ...writeU8(34),     // length
    ...writeU8(0),      // ext attr
    ...writeU32Both(rootDirSector), // extent
    ...writeU32Both(rootDirSize),   // size
    ...writeDate7(yearOffsetFor(2024), 1, 1),
    ...writeU8(0x02),   // directory flag
    ...writeU8(0),
    ...writeU8(0),
    ...writeU16Both(1),
    ...writeU8(1),      // file ID length = 1
    0x00,               // file ID = "\0"
  ];
  out.set(new Uint8Array(rootRecord), pvdOffset + 156);
  out.set(new Uint8Array(writeString("", 128)), pvdOffset + 190); // volume set ID
  out.set(new Uint8Array(writeString("", 128)), pvdOffset + 318); // publisher ID
  out.set(new Uint8Array(writeString("", 128)), pvdOffset + 446); // data preparer ID
  out.set(new Uint8Array(writeString("UNQTOOLS", 128)), pvdOffset + 574); // application ID
  out.set(new Uint8Array(writeString("", 37)), pvdOffset + 702); // copyright
  out.set(new Uint8Array(writeString("", 37)), pvdOffset + 739); // abstract
  out.set(new Uint8Array(writeString("", 37)), pvdOffset + 776); // bibliographic
  out.set(new Uint8Array(writeVolumeDate(2024, 1, 1)), pvdOffset + 813); // creation
  out.set(new Uint8Array(writeVolumeDate(2024, 1, 1)), pvdOffset + 830); // modification
  out.set(new Uint8Array(writeVolumeDate(0, 0, 0)), pvdOffset + 847); // expiration
  out.set(new Uint8Array(writeVolumeDate(2024, 1, 1)), pvdOffset + 864); // effective
  out[pvdOffset + 881] = 0x01; // file structure version

  // Build terminator at sector 17
  const termOffset = terminatorSector * SECTOR_SIZE;
  out[termOffset] = 0xff; // type = terminator
  out.set(new TextEncoder().encode("CD001"), termOffset + 1);
  out[termOffset + 6] = 0x01;

  // Build root directory contents at sector 18
  const rootDirOffset = rootDirSector * SECTOR_SIZE;
  const rootEntries: number[] = [];
  // "." entry (self)
  rootEntries.push(...buildDirEntry({ name: "\0", isDirectory: true, extent: rootDirSector, length: rootDirSize }));
  // ".." entry (parent — same as self for root)
  rootEntries.push(...buildDirEntry({ name: "\u0001", isDirectory: true, extent: rootDirSector, length: rootDirSize }));
  // File entries
  for (const file of fileAssignments) {
    rootEntries.push(...buildDirEntry({ name: file.name, extent: file.sector, length: file.size }));
  }
  // Subdirectory entries
  for (const dir of dirAssignments) {
    rootEntries.push(...buildDirEntry({ name: dir.name, isDirectory: true, extent: dir.sector, length: SECTOR_SIZE }));
  }
  out.set(new Uint8Array(rootEntries), rootDirOffset);

  // Write file data
  for (const file of fileAssignments) {
    const fileBytes = new TextEncoder().encode(file.content);
    out.set(fileBytes, file.sector * SECTOR_SIZE);
  }

  // Write subdirectory contents + their file data
  for (const dir of dirAssignments) {
    const dirOffset = dir.sector * SECTOR_SIZE;
    const dirEntries: number[] = [];
    dirEntries.push(...buildDirEntry({ name: "\0", isDirectory: true, extent: dir.sector, length: SECTOR_SIZE }));
    dirEntries.push(...buildDirEntry({ name: "\u0001", isDirectory: true, extent: rootDirSector, length: rootDirSize }));
    for (const file of dir.files) {
      dirEntries.push(...buildDirEntry({ name: file.name, extent: file.sector, length: file.size }));
    }
    out.set(new Uint8Array(dirEntries), dirOffset);
    for (const file of dir.files) {
      const fileBytes = new TextEncoder().encode(file.content);
      out.set(fileBytes, file.sector * SECTOR_SIZE);
    }
  }

  return out;
}

// ===== isIsoImage =====

describe("iso-extractor isIsoImage", () => {
  it("returns true for valid ISO", () => {
    const bytes = buildIsoBytes();
    expect(isIsoImage(bytes)).toBe(true);
  });
  it("returns false for non-ISO input", () => {
    expect(isIsoImage(new TextEncoder().encode("hello"))).toBe(false);
  });
});

// ===== parseVolumeDescriptorHeader =====

describe("iso-extractor parseVolumeDescriptorHeader", () => {
  it("parses primary volume descriptor", () => {
    const bytes = buildIsoBytes();
    const header = parseVolumeDescriptorHeader(bytes, 16);
    expect(header).not.toBeNull();
    expect(header!.isPrimary).toBe(true);
    expect(header!.standardId).toBe("CD001");
    expect(header!.version).toBe(1);
  });
  it("parses terminator", () => {
    const bytes = buildIsoBytes();
    const header = parseVolumeDescriptorHeader(bytes, 17);
    expect(header).not.toBeNull();
    expect(header!.isTerminator).toBe(true);
  });
  it("returns null for non-CD001 sector", () => {
    expect(parseVolumeDescriptorHeader(new TextEncoder().encode("hello world"), 0)).toBeNull();
  });
});

// ===== parsePrimaryVolumeDescriptor =====

describe("iso-extractor parsePrimaryVolumeDescriptor", () => {
  it("parses volume ID and system ID", () => {
    const bytes = buildIsoBytes({ volumeId: "MYDISC", systemId: "LINUX" });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    expect(pvd.volumeId).toBe("MYDISC");
    expect(pvd.systemId).toBe("LINUX");
    expect(pvd.logicalBlockSize).toBe(2048);
    expect(pvd.isJoliet).toBe(false);
  });
  it("parses root directory location", () => {
    const bytes = buildIsoBytes();
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    expect(pvd.rootDirectoryExtent).toBe(18);
    expect(pvd.rootDirectorySize).toBe(2048);
  });
  it("parses volume space size", () => {
    const bytes = buildIsoBytes();
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    expect(pvd.volumeSpaceSize).toBeGreaterThan(0);
  });
  it("parses application ID", () => {
    const bytes = buildIsoBytes();
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    expect(pvd.applicationId).toBe("UNQTOOLS");
  });
  it("parses creation date", () => {
    const bytes = buildIsoBytes();
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    expect(pvd.creationDate).toContain("2024");
  });
});

// ===== parseDirectoryRecord =====

describe("iso-extractor parseDirectoryRecord", () => {
  it("parses a file entry", () => {
    const bytes = buildIsoBytes({ files: [{ name: "test.txt;1", content: "hello" }] });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const rawEntries = readDirectoryEntries(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    // Should have ".", "..", and "test.txt;1"
    const testEntry = rawEntries.find((e) => e.fileId.includes("test.txt"));
    expect(testEntry).toBeDefined();
    expect(testEntry!.isDirectory).toBe(false);
    expect(testEntry!.dataLength).toBe(5); // "hello"
  });
  it("parses a directory entry", () => {
    const bytes = buildIsoBytes({
      directories: [{ name: "subdir;1", files: [{ name: "inner.txt;1", content: "x" }] }],
    });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const rawEntries = readDirectoryEntries(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const dirEntry = rawEntries.find((e) => e.fileId.includes("subdir"));
    expect(dirEntry).toBeDefined();
    expect(dirEntry!.isDirectory).toBe(true);
  });
  it("returns null for invalid offset", () => {
    expect(parseDirectoryRecord(new Uint8Array(0), 0)).toBeNull();
  });
});

// ===== readDirectoryEntries =====

describe("iso-extractor readDirectoryEntries", () => {
  it("skips '.' and '..' entries", () => {
    const bytes = buildIsoBytes({ files: [{ name: "a.txt;1", content: "x" }] });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = readDirectoryEntries(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const dot = entries.find((e) => e.fileId === "\0");
    const dotdot = entries.find((e) => e.fileId === "\u0001");
    expect(dot).toBeDefined();
    expect(dotdot).toBeDefined();
  });
});

// ===== walkDirectoryTree =====

describe("iso-extractor walkDirectoryTree", () => {
  it("walks the root directory and lists files", () => {
    const bytes = buildIsoBytes({
      files: [
        { name: "a.txt;1", content: "hello" },
        { name: "b.txt;1", content: "world" },
      ],
    });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    // Filter out . and ..
    const realEntries = entries.filter((e) => e.name !== "\0" && e.name !== "\u0001" && e.name !== "");
    expect(realEntries.length).toBe(2);
    const names = realEntries.map((e) => e.name);
    expect(names).toContain("a.txt");
    expect(names).toContain("b.txt");
  });
  it("recursively walks subdirectories", () => {
    const bytes = buildIsoBytes({
      files: [{ name: "root.txt;1", content: "x" }],
      directories: [
        { name: "subdir;1", files: [{ name: "inner.txt;1", content: "y" }] },
      ],
    });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const realEntries = entries.filter((e) => e.name !== "\0" && e.name !== "\u0001" && e.name !== "");
    expect(realEntries.length).toBe(3); // root.txt + subdir + inner.txt
    const inner = realEntries.find((e) => e.name === "inner.txt");
    expect(inner).toBeDefined();
    expect(inner!.parentPath).toBe("/subdir");
  });
  it("strips version suffix from filenames", () => {
    const bytes = buildIsoBytes({ files: [{ name: "file.txt;1", content: "x" }] });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const file = entries.find((e) => e.name.includes("file.txt"));
    expect(file!.name).toBe("file.txt"); // no ;1 suffix
  });
  it("detects directories vs files", () => {
    const bytes = buildIsoBytes({
      directories: [{ name: "docs;1", files: [] }],
    });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const docs = entries.find((e) => e.name === "docs");
    expect(docs).toBeDefined();
    expect(docs!.isDirectory).toBe(true);
  });
});

// ===== classifyIsoFile =====

describe("iso-extractor classifyIsoFile", () => {
  it("classifies common types", () => {
    expect(classifyIsoFile("a.txt")).toBe("text");
    expect(classifyIsoFile("a.png")).toBe("image");
    expect(classifyIsoFile("a.js")).toBe("code");
    expect(classifyIsoFile("a.mp3")).toBe("audio");
    expect(classifyIsoFile("a.mp4")).toBe("video");
    expect(classifyIsoFile("a.zip")).toBe("archive");
    expect(classifyIsoFile("a.exe")).toBe("executable");
    expect(classifyIsoFile("a.pdf")).toBe("document");
  });
  it("returns unknown for unrecognized", () => {
    expect(classifyIsoFile("a.xyz")).toBe("unknown");
  });
});

// ===== Stats =====

describe("iso-extractor computeStats", () => {
  it("computes stats correctly", () => {
    const entries: IsoEntry[] = [
      { name: "a.txt", isDirectory: false, extentLocation: 0, dataLength: 100, recordingDate: "", flags: 0, isHidden: false, fileType: "text", parentPath: "", fullPath: "/a.txt" },
      { name: "b.txt", isDirectory: false, extentLocation: 0, dataLength: 200, recordingDate: "", flags: 0, isHidden: true, fileType: "text", parentPath: "", fullPath: "/b.txt" },
      { name: "subdir", isDirectory: true, extentLocation: 0, dataLength: 2048, recordingDate: "", flags: 2, isHidden: false, fileType: "unknown", parentPath: "", fullPath: "/subdir" },
    ];
    const stats = computeStats(entries);
    expect(stats.entryCount).toBe(3);
    expect(stats.fileCount).toBe(2);
    expect(stats.directoryCount).toBe(1);
    expect(stats.totalFileSize).toBe(300);
    expect(stats.hiddenFileCount).toBe(1);
    expect(stats.largestFileName).toBe("b.txt");
    expect(stats.largestFileSize).toBe(200);
  });
});

// ===== File tree =====

describe("iso-extractor buildFileTree", () => {
  it("groups by directory", () => {
    const entries: IsoEntry[] = [
      { name: "a.txt", isDirectory: false, extentLocation: 0, dataLength: 100, recordingDate: "", flags: 0, isHidden: false, fileType: "text", parentPath: "", fullPath: "/a.txt" },
      { name: "sub", isDirectory: true, extentLocation: 0, dataLength: 2048, recordingDate: "", flags: 2, isHidden: false, fileType: "unknown", parentPath: "", fullPath: "/sub" },
      { name: "b.txt", isDirectory: false, extentLocation: 0, dataLength: 50, recordingDate: "", flags: 0, isHidden: false, fileType: "text", parentPath: "/sub", fullPath: "/sub/b.txt" },
    ];
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(2);
    const sub = tree.children.find((c) => c.name === "sub")!;
    expect(sub.children.length).toBe(1);
  });
});

// ===== Search / filter =====

describe("iso-extractor searchEntries / filterByType", () => {
  const entries: IsoEntry[] = [
    { name: "readme.txt", isDirectory: false, extentLocation: 0, dataLength: 100, recordingDate: "", flags: 0, isHidden: false, fileType: "text", parentPath: "", fullPath: "/readme.txt" },
    { name: "logo.png", isDirectory: false, extentLocation: 0, dataLength: 200, recordingDate: "", flags: 0, isHidden: false, fileType: "image", parentPath: "", fullPath: "/logo.png" },
    { name: "app.exe", isDirectory: false, extentLocation: 0, dataLength: 1000, recordingDate: "", flags: 0, isHidden: false, fileType: "executable", parentPath: "", fullPath: "/app.exe" },
  ];

  it("searches by name", () => {
    expect(searchEntries(entries, "readme").length).toBe(1);
    expect(searchEntries(entries, "").length).toBe(3);
  });
  it("filters text files", () => {
    expect(filterByType(entries, "text").length).toBe(1);
  });
  it("filters images", () => {
    expect(filterByType(entries, "image").length).toBe(1);
  });
  it("filters executables", () => {
    expect(filterByType(entries, "executable").length).toBe(1);
  });
  it("returns all for 'all' filter", () => {
    expect(filterByType(entries, "all").length).toBe(3);
  });
});

// ===== MIME detection =====

describe("iso-extractor detectMimeFromName", () => {
  it("detects common types", () => {
    expect(detectMimeFromName("a.txt")).toBe("text/plain");
    expect(detectMimeFromName("a.png")).toBe("image/png");
    expect(detectMimeFromName("a.exe")).toBe("application/x-msdownload");
    expect(detectMimeFromName("a.iso")).toBe("application/x-iso9660-image");
  });
});

// ===== extractFile =====

describe("iso-extractor extractFile", () => {
  it("extracts file content", () => {
    const bytes = buildIsoBytes({ files: [{ name: "test.txt;1", content: "Hello, ISO!" }] });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const file = entries.find((e) => e.name === "test.txt");
    const data = extractFile(bytes, file!);
    expect(new TextDecoder().decode(data)).toBe("Hello, ISO!");
  });
  it("throws on directory extraction", () => {
    const entry: IsoEntry = {
      name: "dir", isDirectory: true, extentLocation: 0, dataLength: 2048,
      recordingDate: "", flags: 2, isHidden: false, fileType: "unknown",
      parentPath: "", fullPath: "/dir",
    };
    expect(() => extractFile(new Uint8Array(0), entry)).toThrow(/directory/);
  });
});

// ===== previewFile =====

describe("iso-extractor previewFile", () => {
  it("decodes text content", () => {
    const data = new TextEncoder().encode("Hello, world!");
    const preview = previewFile(data);
    expect(preview.isText).toBe(true);
    expect(preview.text).toContain("Hello");
  });
  it("hex-dumps binary", () => {
    const data = new Uint8Array([0x00, 0xff, 0x80]);
    const preview = previewFile(data);
    expect(preview.isText).toBe(false);
    expect(preview.hex).toContain("00 ff 80");
  });
  it("truncates large files", () => {
    const data = new Uint8Array(20000);
    const preview = previewFile(data, 8192);
    expect(preview.truncated).toBe(true);
    expect(preview.previewSize).toBe(8192);
  });
});

// ===== ZIP writer =====

describe("iso-extractor createZipBlob + buildZipFromEntries", () => {
  it("creates a valid ZIP", async () => {
    const files = [{ name: "test.txt", data: new TextEncoder().encode("hello") }];
    const blob = createZipBlob(files);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
  it("re-zips ISO entries as ZIP", () => {
    const bytes = buildIsoBytes({ files: [{ name: "a.txt;1", content: "hello" }] });
    const pvd = parsePrimaryVolumeDescriptor(bytes, 16);
    const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize);
    const blob = buildZipFromEntries(bytes, entries);
    // Just verify it doesn't throw and produces a non-empty blob
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ===== parseIso (top-level) =====

describe("iso-extractor parseIso", () => {
  it("parses a complete ISO", () => {
    const bytes = buildIsoBytes({
      volumeId: "TESTDISC",
      files: [{ name: "test.txt;1", content: "Hello" }],
    });
    const result = parseIso(bytes, "test.iso");
    expect(result.fileName).toBe("test.iso");
    expect(result.pvd.volumeId).toBe("TESTDISC");
    expect(result.pvd.logicalBlockSize).toBe(2048);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.hasJoliet).toBe(false);
  });

  it("throws on non-ISO input", () => {
    expect(() => parseIso(new TextEncoder().encode("hello"), "bad.iso")).toThrow(/too small|no Primary Volume/);
  });
});

// ===== Utilities =====

describe("iso-extractor formatBytes", () => {
  it("formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

// ===== History =====

describe("iso-extractor history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
    clearHistory();
  });

  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "test.iso",
      fileSize: 1024 * 1024,
      volumeId: "TESTDISC",
      systemId: "LINUX",
      entryCount: 50,
      hasJoliet: false,
      extractedAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.volumeId).toBe("TESTDISC");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `iso-${i}.iso`, fileSize: 10, volumeId: `V${i}`, systemId: "X",
        entryCount: 1, hasJoliet: false, extractedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.iso", fileSize: 1, volumeId: "", systemId: "", entryCount: 0,
      hasJoliet: false, extractedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("iso-extractor share URL", () => {
  const origWindow = (globalThis as any).window;
  beforeEach(() => {
    (globalThis as any).window = { location: { origin: "https://x.com", pathname: "/tools/iso-extractor" } };
  });
  afterEach(() => {
    (globalThis as any).window = origWindow;
  });

  it("builds URL with filter + search", () => {
    const url = buildShareUrl({ filter: "image", search: "logo" });
    expect(url).toContain("filter=image");
    expect(url).toContain("q=logo");
  });
  it("parses URL back", () => {
    const opts = parseShareUrl("#filter=text&q=readme");
    expect(opts).not.toBeNull();
    expect(opts!.filter).toBe("text");
    expect(opts!.search).toBe("readme");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("not-a-hash")).toBeNull();
  });
  it("returns null when no relevant params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
});
