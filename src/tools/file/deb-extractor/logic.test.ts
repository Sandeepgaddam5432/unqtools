import { describe, it, expect, beforeEach } from "vitest";
import {
  AR_MAGIC, AR_MAGIC_BYTES, AR_HEADER_SIZE, AR_FMAG,
  isArArchive, parseArMembers, extractArMember, parseDeb,
  detectCompression, parseControl,
  parseTarEntries, findControlFile,
  computeStats, searchMembers, previewMember, looksLikeText,
  detectMimeFromName, createZipBlob, buildZipFromDeb,
  formatBytes, formatMode, formatMtime,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type ArMember,
} from "./logic";

// ===== Test helpers =====

function buildArHeader(fields: Partial<{
  name: string; mtime: number; uid: number; gid: number; mode: number; size: number;
}>): Uint8Array {
  const h = new Uint8Array(AR_HEADER_SIZE);
  const enc = new TextEncoder();
  const writeStr = (offset: number, text: string, width: number) => {
    const bytes = enc.encode(text);
    const len = Math.min(bytes.length, width);
    h.set(bytes.subarray(0, len), offset);
  };
  writeStr(0, (fields.name ?? "name").padEnd(16).slice(0, 16), 16);
  writeStr(16, String(fields.mtime ?? 0).padStart(12, " "), 12);
  writeStr(28, String(fields.uid ?? 0).padStart(6, " "), 6);
  writeStr(34, String(fields.gid ?? 0).padStart(6, " "), 6);
  writeStr(40, (fields.mode ?? 0o644).toString(8).padStart(8, " "), 8);
  writeStr(48, String(fields.size ?? 0).padStart(10, " "), 10);
  writeStr(58, AR_FMAG, 2);
  return h;
}

function buildArArchive(members: Array<{ name: string; data: Uint8Array; mode?: number; mtime?: number }>): Uint8Array {
  const parts: Uint8Array[] = [AR_MAGIC_BYTES];
  for (const m of members) {
    parts.push(buildArHeader({ name: m.name, size: m.data.length, mode: m.mode ?? 0o644, mtime: m.mtime ?? 0 }));
    parts.push(m.data);
    if (m.data.length % 2 === 1) parts.push(new Uint8Array([0x0a])); // padding
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

function buildDebArchive(debianBinary: string, controlData: Uint8Array, dataData: Uint8Array): Uint8Array {
  return buildArArchive([
    { name: "debian-binary", data: new TextEncoder().encode(debianBinary) },
    { name: "control.tar.gz", data: controlData },
    { name: "data.tar.gz", data: dataData },
  ]);
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

// ===== isArArchive =====

describe("deb-extractor isArArchive", () => {
  it("returns true for valid AR magic", () => {
    expect(isArArchive(AR_MAGIC_BYTES)).toBe(true);
  });
  it("returns false for ZIP magic", () => {
    expect(isArArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });
  it("returns false for too-short input", () => {
    expect(isArArchive(new Uint8Array([0x21, 0x3c]))).toBe(false);
  });
});

// ===== parseArMembers =====

describe("deb-extractor parseArMembers", () => {
  it("throws on non-AR input", () => {
    expect(() => parseArMembers(new Uint8Array([1, 2, 3]))).toThrow();
  });
  it("parses a single-member archive", () => {
    const data = new TextEncoder().encode("2.0\n");
    const archive = buildArArchive([{ name: "debian-binary", data }]);
    const members = parseArMembers(archive);
    expect(members).toHaveLength(1);
    expect(members[0]!.name).toBe("debian-binary");
    expect(members[0]!.size).toBe(4);
    expect(members[0]!.mode).toBe(0o644);
    expect(members[0]!.fmagValid).toBe(true);
  });
  it("parses multiple members and skips padding", () => {
    const archive = buildArArchive([
      { name: "debian-binary", data: new TextEncoder().encode("2.0\n") },
      { name: "control.tar.gz", data: new Uint8Array(11) }, // odd length → padded
      { name: "data.tar.gz", data: new Uint8Array(20) },
    ]);
    const members = parseArMembers(archive);
    expect(members).toHaveLength(3);
    expect(members[0]!.name).toBe("debian-binary");
    expect(members[1]!.name).toBe("control.tar.gz");
    expect(members[2]!.name).toBe("data.tar.gz");
  });
  it("parses mtime, uid, gid fields", () => {
    const archive = buildArArchive([{ name: "test", data: new Uint8Array(0), mtime: 1700000000 }]);
    const members = parseArMembers(archive);
    expect(members[0]!.mtime).toBe(1700000000);
    expect(members[0]!.uid).toBe(0);
    expect(members[0]!.gid).toBe(0);
  });
  it("handles empty AR archive (only magic)", () => {
    const members = parseArMembers(AR_MAGIC_BYTES);
    expect(members).toHaveLength(0);
  });
});

// ===== extractArMember =====

describe("deb-extractor extractArMember", () => {
  it("extracts member data", () => {
    const data = new TextEncoder().encode("Hello, AR!");
    const archive = buildArArchive([{ name: "hello.txt", data }]);
    const members = parseArMembers(archive);
    const extracted = extractArMember(archive, members[0]!);
    expect(new TextDecoder().decode(extracted)).toBe("Hello, AR!");
  });
  it("extracts exact byte slice", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const archive = buildArArchive([{ name: "bin", data }]);
    const members = parseArMembers(archive);
    const extracted = extractArMember(archive, members[0]!);
    expect(Array.from(extracted)).toEqual([1, 2, 3, 4, 5]);
  });
});

// ===== parseDeb =====

describe("deb-extractor parseDeb", () => {
  it("identifies debian-binary, control.tar.gz, data.tar.gz", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const info = parseDeb(archive);
    expect(info.debianBinary).not.toBeNull();
    expect(info.controlArchive).not.toBeNull();
    expect(info.dataArchive).not.toBeNull();
    expect(info.debFormatVersion).toBe("2.0");
  });
  it("detects gzip compression from name", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const info = parseDeb(archive);
    expect(info.controlCompression).toBe("gzip");
    expect(info.dataCompression).toBe("gzip");
  });
  it("detects xz compression from name", () => {
    const archive = buildArArchive([
      { name: "debian-binary", data: new TextEncoder().encode("2.0\n") },
      { name: "control.tar.xz", data: new Uint8Array(10) },
      { name: "data.tar.xz", data: new Uint8Array(20) },
    ]);
    const info = parseDeb(archive);
    expect(info.controlCompression).toBe("xz");
    expect(info.dataCompression).toBe("xz");
  });
  it("returns all members in info.members", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const info = parseDeb(archive);
    expect(info.members.length).toBe(3);
  });
});

// ===== detectCompression =====

describe("deb-extractor detectCompression", () => {
  it("returns gzip for .gz", () => {
    expect(detectCompression("control.tar.gz")).toBe("gzip");
  });
  it("returns xz for .xz", () => {
    expect(detectCompression("data.tar.xz")).toBe("xz");
  });
  it("returns zst for .zst", () => {
    expect(detectCompression("data.tar.zst")).toBe("zst");
  });
  it("returns none for plain .tar", () => {
    expect(detectCompression("data.tar")).toBe("none");
  });
});

// ===== parseControl =====

describe("deb-extractor parseControl", () => {
  it("parses basic fields", () => {
    const text = `Package: hello
Version: 2.10-2
Architecture: amd64
Maintainer: Bug Squad <debian-bugs@lists.debian.org>
Description: example program
 This is the long description.
 .
 Continues here.
Depends: libc6, libgcc1
Section: utils
Priority: optional
Homepage: https://www.gnu.org/software/hello/`;
    const c = parseControl(text);
    expect(c.package).toBe("hello");
    expect(c.version).toBe("2.10-2");
    expect(c.architecture).toBe("amd64");
    expect(c.maintainer).toContain("Bug Squad");
    expect(c.section).toBe("utils");
    expect(c.priority).toBe("optional");
    expect(c.homepage).toContain("gnu.org");
    expect(c.depends).toBe("libc6, libgcc1");
    expect(c.description).toContain("example program");
    expect(c.description).toContain("long description");
  });
  it("handles line continuations (leading space)", () => {
    const text = `Package: foo
Description: short
 long line 1
 long line 2`;
    const c = parseControl(text);
    expect(c.description).toContain("long line 1");
    expect(c.description).toContain("long line 2");
  });
  it("preserves field order in fields array", () => {
    const text = `Package: foo
Version: 1.0
Architecture: all`;
    const c = parseControl(text);
    expect(c.fields.map((f) => f.key)).toEqual(["Package", "Version", "Architecture"]);
  });
  it("returns empty result for empty input", () => {
    const c = parseControl("");
    expect(c.package).toBe("");
    expect(c.fields).toHaveLength(0);
  });
  it("skips lines without a colon", () => {
    const text = `Package: foo
this line has no colon
Version: 1.0`;
    const c = parseControl(text);
    expect(c.package).toBe("foo");
    expect(c.version).toBe("1.0");
    expect(c.fields).toHaveLength(2);
  });
});

// ===== parseTarEntries (re-implemented) =====

describe("deb-extractor parseTarEntries", () => {
  it("returns empty list for empty input", () => {
    expect(parseTarEntries(new Uint8Array(0))).toEqual([]);
  });
  it("returns empty list for all-zero block", () => {
    expect(parseTarEntries(new Uint8Array(1024))).toEqual([]);
  });
});

// ===== findControlFile =====

describe("deb-extractor findControlFile", () => {
  it("finds control entry by name", () => {
    const entries = [
      { name: "./control", size: 100, typeflag: "0", dataOffset: 512 },
      { name: "./md5sums", size: 50, typeflag: "0", dataOffset: 1024 },
    ];
    expect(findControlFile(entries)).toBe(entries[0]);
  });
  it("finds control without ./ prefix", () => {
    const entries = [{ name: "control", size: 100, typeflag: "0", dataOffset: 512 }];
    expect(findControlFile(entries)).toBe(entries[0]);
  });
  it("returns null if no control entry", () => {
    const entries = [{ name: "md5sums", size: 50, typeflag: "0", dataOffset: 512 }];
    expect(findControlFile(entries)).toBeNull();
  });
});

// ===== computeStats =====

describe("deb-extractor computeStats", () => {
  it("computes member count and total size", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const info = parseDeb(archive);
    const stats = computeStats(info);
    expect(stats.memberCount).toBe(3);
    expect(stats.debianBinaryFound).toBe(true);
    expect(stats.controlArchiveFound).toBe(true);
    expect(stats.dataArchiveFound).toBe(true);
  });
  it("detects XZ archives", () => {
    const archive = buildArArchive([
      { name: "debian-binary", data: new TextEncoder().encode("2.0\n") },
      { name: "control.tar.xz", data: new Uint8Array(10) },
      { name: "data.tar.xz", data: new Uint8Array(20) },
    ]);
    const info = parseDeb(archive);
    const stats = computeStats(info);
    expect(stats.hasXz).toBe(true);
  });
  it("reports largest member", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(2000));
    const info = parseDeb(archive);
    const stats = computeStats(info);
    expect(stats.largestMemberName).toBe("data.tar.gz");
    expect(stats.largestMemberSize).toBe(2000);
  });
  it("handles missing debian-binary", () => {
    const archive = buildArArchive([{ name: "data.tar.gz", data: new Uint8Array(20) }]);
    const info = parseDeb(archive);
    const stats = computeStats(info);
    expect(stats.debianBinaryFound).toBe(false);
  });
});

// ===== searchMembers =====

describe("deb-extractor searchMembers", () => {
  it("returns all members for empty query", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const members = parseArMembers(archive);
    expect(searchMembers(members, "")).toHaveLength(members.length);
  });
  it("filters by case-insensitive substring", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const members = parseArMembers(archive);
    const result = searchMembers(members, "CONTROL");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("control.tar.gz");
  });
});

// ===== previewMember / looksLikeText =====

describe("deb-extractor previewMember", () => {
  it("previews text members", () => {
    const archive = buildArArchive([{ name: "debian-binary", data: new TextEncoder().encode("2.0\n") }]);
    const members = parseArMembers(archive);
    const p = previewMember(archive, members[0]!);
    expect(p.isText).toBe(true);
    expect(p.text).toBe("2.0\n");
    expect(p.truncated).toBe(false);
  });
  it("marks binary members as non-text", () => {
    const bin = new Uint8Array(64);
    for (let i = 0; i < bin.length; i++) bin[i] = i % 256;
    const archive = buildArArchive([{ name: "bin.dat", data: bin }]);
    const members = parseArMembers(archive);
    const p = previewMember(archive, members[0]!);
    expect(p.isText).toBe(false);
  });
});

describe("deb-extractor looksLikeText", () => {
  it("returns true for ASCII text", () => {
    expect(looksLikeText(new TextEncoder().encode("Hello, world!"))).toBe(true);
  });
  it("returns false for binary data", () => {
    const bin = new Uint8Array(100);
    for (let i = 0; i < bin.length; i++) bin[i] = 0;
    expect(looksLikeText(bin)).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(looksLikeText(new Uint8Array(0))).toBe(false);
  });
});

// ===== detectMimeFromName =====

describe("deb-extractor detectMimeFromName", () => {
  it("returns text/plain for debian-binary", () => {
    expect(detectMimeFromName("debian-binary")).toBe("text/plain");
  });
  it("returns application/gzip for .tar.gz", () => {
    expect(detectMimeFromName("control.tar.gz")).toBe("application/gzip");
  });
  it("returns application/x-xz for .tar.xz", () => {
    expect(detectMimeFromName("data.tar.xz")).toBe("application/x-xz");
  });
  it("returns application/zstd for .tar.zst", () => {
    expect(detectMimeFromName("data.tar.zst")).toBe("application/zstd");
  });
  it("returns application/octet-stream for unknown", () => {
    expect(detectMimeFromName("binary.dat")).toBe("application/octet-stream");
  });
});

// ===== createZipBlob / buildZipFromDeb =====

describe("deb-extractor ZIP", () => {
  it("creates a non-empty ZIP blob", () => {
    const blob = createZipBlob([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/zip");
  });
  it("builds ZIP from deb archive", () => {
    const archive = buildDebArchive("2.0\n", new Uint8Array(10), new Uint8Array(20));
    const info = parseDeb(archive);
    const blob = buildZipFromDeb(archive, info);
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ===== Utilities =====

describe("deb-extractor utilities", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("formats octal mode", () => {
    expect(formatMode(0o644)).toBe("0644");
    expect(formatMode(0o755)).toBe("0755");
  });
  it("formats mtime", () => {
    expect(formatMtime(0)).toBe("—");
    expect(formatMtime(1700000000)).toContain("T");
  });
});

// ===== History =====

describe("deb-extractor history", () => {
  it("returns empty list when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    const items: string[] = [];
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => items.find((s) => s.startsWith(k + "="))?.slice(k.length + 1) ?? null,
      setItem: (k: string, v: string) => { items.push(`${k}=${v}`); },
      removeItem: () => {},
      clear: () => { items.length = 0; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.deb", archiveSize: 1000, memberCount: 3,
      packageName: "hello", packageVersion: "1.0", architecture: "amd64",
      extractedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.deb");
    expect(loaded[0]!.packageName).toBe("hello");
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
      fileName: "test.deb", archiveSize: 1000, memberCount: 3,
      packageName: "", packageVersion: "", architecture: "",
      extractedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("deb-extractor share URL", () => {
  it("builds URL with search query", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/deb-extractor" } };
    const url = buildShareUrl({ search: "control" });
    expect(url).toContain("#q=control");
    expect(url).toContain("/tools/deb-extractor");
  });
  it("omits query when search is empty", () => {
    (globalThis as { window?: unknown }).window = { origin: "https://example.com", location: { pathname: "/tools/deb-extractor" } };
    const url = buildShareUrl({ search: "" });
    expect(url).not.toContain("q=");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#q=data.tar");
    expect(parsed).toEqual({ search: "data.tar" });
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no q param", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
});
