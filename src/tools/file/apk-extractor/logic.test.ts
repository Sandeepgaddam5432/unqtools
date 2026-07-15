import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseZipEntries, decompressEntry, isZipArchive,
  classifyApkFile, parseAxmlStringPool, isBinaryXml, parseAppInfoFromManifest,
  computeStats, buildFileTree, searchEntries, filterByType,
  detectMimeFromName, formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  parseApk, createZipBlob,
  type ApkEntry, type ApkFilter,
} from "./logic";
import {
  createZipBlob as createZipForTest,
  type ZipFile,
} from "../csv-to-excel-converter/logic";

// DecompressionStream leak guard
const unhandledHandlers: Array<(...args: unknown[]) => void> = [];
beforeEach(() => {
  const handler = (err: unknown) => {
    const e = err as { code?: string };
    if (e && typeof e === "object" && e.code === "Z_DATA_ERROR") return;
    throw err;
  };
  unhandledHandlers.push(handler);
  process.on("unhandledRejection", handler as (...args: unknown[]) => void);
  process.on("uncaughtException", handler as (...args: unknown[]) => void);
});
afterEach(() => {
  for (const h of unhandledHandlers.splice(0)) {
    process.off("unhandledRejection", h as (...args: unknown[]) => void);
    process.off("uncaughtException", h as (...args: unknown[]) => void);
  }
});

// Helper: build a STORE-method ZIP from file entries (synchronous).
function buildStoreZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const zipFiles: ZipFile[] = files.map((f) => ({ name: f.name, data: f.data }));
  return mergeZipParts(zipFiles);
}

function mergeZipParts(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const crc = (data: Uint8Array): number => {
    let c = 0xffffffff;
    for (const b of data) {
      c ^= b;
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, c, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint32(16, c, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// Helper: build a minimal binary AXML with a UTF-8 string pool.
function buildAxmlStringPool(strings: string[]): Uint8Array {
  // Header: 8 bytes (magic 0x03 0x00 + filesize 4 bytes)
  // String pool chunk:
  //   - chunk type (2 bytes) = 0x0001
  //   - header size (2 bytes) = 0x1c (28)
  //   - chunk size (4 bytes)
  //   - string count (4 bytes)
  //   - style count (4 bytes) = 0
  //   - flags (4 bytes) = 0x100 (UTF-8)
  //   - strings offset (4 bytes) = 28 + 4 * count
  //   - styles offset (4 bytes) = 0
  // Then string offsets array (count * 4 bytes)
  // Then string data
  const enc = new TextEncoder();
  const stringBytes = strings.map((s) => {
    const utf8 = enc.encode(s);
    // For each UTF-8 string: charLen (1 byte) + byteLen (1 byte) + data
    const charLen = utf8.length < 128 ? utf8.length : 0x80 | ((utf8.length >> 8) & 0x7f);
    const byteLen = utf8.length < 128 ? utf8.length : 0x80 | ((utf8.length >> 8) & 0x7f);
    const out = new Uint8Array(2 + utf8.length);
    out[0] = charLen;
    out[1] = byteLen;
    out.set(utf8, 2);
    return out;
  });
  // The parser treats `headerSize` as the absolute file offset where the
  // string offsets array begins, and `stringsOffset` as the absolute file
  // offset where string data begins. We therefore lay out the file as:
  //   bytes 0-7    : file header (magic + filesize)
  //   bytes 8-35   : chunk header (28 bytes of fields)
  //   bytes 36-... : string offsets array (4 * count bytes)
  //   bytes (36+4*count)-... : string data
  // and set headerSize = 36 (start of offsets array) and
  // stringsOffset = 36 + 4 * count (start of string data).
  const headerSize = 36;
  const stringsBase = headerSize + 4 * strings.length;
  // Compute offsets (relative to stringsBase)
  const offsets: number[] = [];
  let cur = 0;
  for (const sb of stringBytes) {
    offsets.push(cur);
    cur += sb.length;
  }
  const totalSize = stringsBase + cur;
  const out = new Uint8Array(totalSize);
  const dv = new DataView(out.buffer);
  // Magic
  out[0] = 0x03; out[1] = 0x00;
  // File size
  dv.setUint32(2, totalSize - 8, true);
  // String pool chunk type
  dv.setUint16(8, 0x0001, true);
  // Header size (absolute file offset of offsets array)
  dv.setUint16(10, headerSize, true);
  // Chunk size
  dv.setUint32(12, totalSize - 8, true);
  // String count
  dv.setUint32(16, strings.length, true);
  // Style count
  dv.setUint32(20, 0, true);
  // Flags: UTF-8
  dv.setUint32(24, 0x100, true);
  // Strings offset (absolute file offset of string data)
  dv.setUint32(28, stringsBase, true);
  // Styles offset
  dv.setUint32(32, 0, true);
  // String offsets array (starts at byte headerSize = 36)
  for (let i = 0; i < offsets.length; i++) {
    dv.setUint32(headerSize + i * 4, offsets[i]!, true);
  }
  // String data (starts at byte stringsBase)
  let pos = stringsBase;
  for (const sb of stringBytes) {
    out.set(sb, pos);
    pos += sb.length;
  }
  return out;
}

// ===== classifyApkFile =====

describe("apk-extractor classifyApkFile", () => {
  it("classifies manifest", () => {
    expect(classifyApkFile("AndroidManifest.xml")).toBe("manifest");
  });
  it("classifies dex files", () => {
    expect(classifyApkFile("classes.dex")).toBe("dex");
    expect(classifyApkFile("classes2.dex")).toBe("dex");
  });
  it("classifies resources.arsc", () => {
    expect(classifyApkFile("resources.arsc")).toBe("resources");
  });
  it("classifies native libs", () => {
    expect(classifyApkFile("lib/arm64-v8a/libnative.so")).toBe("native-lib");
  });
  it("classifies assets", () => {
    expect(classifyApkFile("assets/fonts/custom.ttf")).toBe("asset");
  });
  it("classifies resource XML", () => {
    expect(classifyApkFile("res/layout/main.xml")).toBe("resource-xml");
  });
  it("classifies resource images", () => {
    expect(classifyApkFile("res/drawable/ic_launcher.png")).toBe("resource-image");
  });
  it("classifies signatures", () => {
    expect(classifyApkFile("META-INF/CERT.RSA")).toBe("signature");
    expect(classifyApkFile("META-INF/CERT.SF")).toBe("signature");
  });
  it("classifies metadata", () => {
    expect(classifyApkFile("META-INF/MANIFEST.MF")).toBe("metadata");
  });
  it("returns unknown for unrecognized", () => {
    expect(classifyApkFile("random/file.xyz")).toBe("unknown");
  });
});

// ===== isBinaryXml =====

describe("apk-extractor isBinaryXml", () => {
  it("returns true for AXML magic bytes", () => {
    expect(isBinaryXml(new Uint8Array([0x03, 0x00, 0x00, 0x00]))).toBe(true);
  });
  it("returns false for text XML", () => {
    expect(isBinaryXml(new TextEncoder().encode("<?xml version='1.0'?>"))).toBe(false);
  });
  it("returns false for empty bytes", () => {
    expect(isBinaryXml(new Uint8Array(0))).toBe(false);
  });
});

// ===== parseAxmlStringPool =====

describe("apk-extractor parseAxmlStringPool", () => {
  it("returns empty for non-AXML bytes", () => {
    const result = parseAxmlStringPool(new TextEncoder().encode("not axml"));
    expect(result.strings).toEqual([]);
    expect(result.isUtf8).toBe(false);
  });
  it("parses UTF-8 string pool", () => {
    const axml = buildAxmlStringPool(["com.example.app", "android.permission.INTERNET", "1.0.0"]);
    const result = parseAxmlStringPool(axml);
    expect(result.isUtf8).toBe(true);
    expect(result.strings).toContain("com.example.app");
    expect(result.strings).toContain("android.permission.INTERNET");
    expect(result.strings).toContain("1.0.0");
  });
  it("handles empty bytes", () => {
    expect(parseAxmlStringPool(new Uint8Array(0)).strings).toEqual([]);
  });
});

// ===== parseAppInfoFromManifest =====

describe("apk-extractor parseAppInfoFromManifest", () => {
  it("extracts package name and permissions", () => {
    const axml = buildAxmlStringPool([
      "com.example.myapp",
      "android.permission.INTERNET",
      "android.permission.CAMERA",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "1.2.3",
    ]);
    const info = parseAppInfoFromManifest(axml);
    expect(info.manifestFound).toBe(true);
    expect(info.packageName).toBe("com.example.myapp");
    expect(info.versionName).toBe("1.2.3");
    expect(info.permissions).toContain("android.permission.INTERNET");
    expect(info.permissions).toContain("android.permission.CAMERA");
    expect(info.permissions.length).toBe(3);
  });
  it("deduplicates permissions", () => {
    const axml = buildAxmlStringPool([
      "com.test.app",
      "android.permission.INTERNET",
      "android.permission.INTERNET",
    ]);
    const info = parseAppInfoFromManifest(axml);
    expect(info.permissions.length).toBe(1);
  });
  it("returns empty for non-binary input", () => {
    const info = parseAppInfoFromManifest(new TextEncoder().encode("plain text"));
    expect(info.manifestFound).toBe(false);
    expect(info.packageName).toBe("");
    expect(info.permissions).toEqual([]);
  });
  it("handles manifest with no permissions", () => {
    const axml = buildAxmlStringPool(["com.example.noperm"]);
    const info = parseAppInfoFromManifest(axml);
    expect(info.packageName).toBe("com.example.noperm");
    expect(info.permissions).toEqual([]);
  });
});

// ===== parseZipEntries (APK-specific) =====

describe("apk-extractor parseZipEntries", () => {
  it("parses APK with manifest + dex + resources", () => {
    const zip = buildStoreZip([
      { name: "AndroidManifest.xml", data: buildAxmlStringPool(["com.example.app", "android.permission.INTERNET"]) },
      { name: "classes.dex", data: new Uint8Array([0xde, 0xed, 0xde, 0xed]) },
      { name: "resources.arsc", data: new Uint8Array([0x02, 0x00]) },
      { name: "res/layout/main.xml", data: new TextEncoder().encode("<layout/>") },
    ]);
    const entries = parseZipEntries(zip);
    expect(entries.length).toBe(4);
    const manifest = entries.find((e) => e.name === "AndroidManifest.xml")!;
    expect(manifest.apkType).toBe("manifest");
    const dex = entries.find((e) => e.name === "classes.dex")!;
    expect(dex.apkType).toBe("dex");
  });
  it("returns empty for non-ZIP bytes", () => {
    expect(parseZipEntries(new TextEncoder().encode("hello")).length).toBe(0);
  });
});

// ===== isZipArchive =====

describe("apk-extractor isZipArchive", () => {
  it("returns true for valid ZIP signature", () => {
    expect(isZipArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBe(true);
  });
  it("returns false for non-ZIP", () => {
    expect(isZipArchive(new TextEncoder().encode("hello"))).toBe(false);
  });
});

// ===== Stats =====

describe("apk-extractor computeStats", () => {
  it("computes stats correctly", () => {
    const zip = buildStoreZip([
      { name: "AndroidManifest.xml", data: new Uint8Array(10) },
      { name: "classes.dex", data: new Uint8Array(100) },
      { name: "classes2.dex", data: new Uint8Array(50) },
      { name: "lib/arm64-v8a/libnative.so", data: new Uint8Array(200) },
      { name: "res/drawable/ic.png", data: new Uint8Array(80) },
      { name: "META-INF/CERT.RSA", data: new Uint8Array(30) },
    ]);
    const entries = parseZipEntries(zip);
    const stats = computeStats(entries);
    expect(stats.entryCount).toBe(6);
    expect(stats.dexCount).toBe(2);
    expect(stats.nativeLibCount).toBe(1);
    expect(stats.imageCount).toBe(1);
    expect(stats.signatureCount).toBe(1);
    expect(stats.totalUncompressed).toBe(10 + 100 + 50 + 200 + 80 + 30);
  });
});

// ===== File tree =====

describe("apk-extractor buildFileTree", () => {
  it("groups by directory", () => {
    const zip = buildStoreZip([
      { name: "AndroidManifest.xml", data: new Uint8Array(10) },
      { name: "res/layout/main.xml", data: new Uint8Array(20) },
      { name: "res/drawable/ic.png", data: new Uint8Array(30) },
    ]);
    const entries = parseZipEntries(zip);
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(2);
    const res = tree.children.find((c) => c.name === "res")!;
    expect(res.children.length).toBe(2);
  });
});

// ===== Search / filter =====

describe("apk-extractor searchEntries / filterByType", () => {
  const zip = buildStoreZip([
    { name: "classes.dex", data: new Uint8Array(10) },
    { name: "res/drawable/ic.png", data: new Uint8Array(20) },
    { name: "META-INF/CERT.RSA", data: new Uint8Array(30) },
  ]);
  const entries = parseZipEntries(zip);

  it("searches by name", () => {
    expect(searchEntries(entries, "dex").length).toBe(1);
    expect(searchEntries(entries, "png").length).toBe(1);
    expect(searchEntries(entries, "").length).toBe(3);
  });
  it("filters by DEX type", () => {
    expect(filterByType(entries, "dex").length).toBe(1);
  });
  it("filters by image type", () => {
    expect(filterByType(entries, "image").length).toBe(1);
  });
  it("filters by signature type", () => {
    expect(filterByType(entries, "signature").length).toBe(1);
  });
  it("returns all for 'all' filter", () => {
    expect(filterByType(entries, "all").length).toBe(3);
  });
});

// ===== MIME detection =====

describe("apk-extractor detectMimeFromName", () => {
  it("detects APK-specific types", () => {
    expect(detectMimeFromName("classes.dex")).toBe("application/x-dex");
    expect(detectMimeFromName("resources.arsc")).toBe("application/x-android-resources");
    expect(detectMimeFromName("lib/x.so")).toBe("application/x-sharedlib");
    expect(detectMimeFromName("META-INF/CERT.RSA")).toBe("application/x-pkcs7");
  });
});

// ===== parseApk (top-level) =====

describe("apk-extractor parseApk", () => {
  it("parses a valid APK and extracts app info", async () => {
    const axmlBytes = buildAxmlStringPool([
      "com.example.test",
      "android.permission.INTERNET",
      "android.permission.CAMERA",
      "2.0.1",
    ]);
    const zip = buildStoreZip([
      { name: "AndroidManifest.xml", data: axmlBytes },
      { name: "classes.dex", data: new Uint8Array([0xde, 0xed]) },
      { name: "resources.arsc", data: new Uint8Array([0x02, 0x00]) },
    ]);
    const result = await parseApk(zip, "test.apk");
    expect(result.fileName).toBe("test.apk");
    expect(result.stats.entryCount).toBe(3);
    expect(result.appInfo.manifestFound).toBe(true);
    expect(result.appInfo.packageName).toBe("com.example.test");
    expect(result.appInfo.versionName).toBe("2.0.1");
    expect(result.appInfo.permissions.length).toBe(2);
    expect(result.manifestEntry).not.toBeNull();
  });

  it("throws on non-ZIP input", async () => {
    await expect(parseApk(new TextEncoder().encode("hello"), "bad.apk")).rejects.toThrow(/not a valid APK/);
  });

  it("throws on empty ZIP", async () => {
    // Build a ZIP with no entries (just EOCD)
    const eocd = new Uint8Array(22);
    const dv = new DataView(eocd.buffer);
    dv.setUint32(0, 0x06054b50, true);
    // Add a fake local header to satisfy isZipArchive
    const zip = new Uint8Array(4 + eocd.length);
    zip[0] = 0x50; zip[1] = 0x4b; zip[2] = 0x03; zip[3] = 0x04;
    zip.set(eocd, 4);
    await expect(parseApk(zip, "empty.apk")).rejects.toThrow(/empty or could not be parsed/);
  });

  it("handles missing AndroidManifest gracefully", async () => {
    const zip = buildStoreZip([
      { name: "classes.dex", data: new Uint8Array([0xde, 0xed]) },
    ]);
    const result = await parseApk(zip, "nomanifest.apk");
    expect(result.appInfo.manifestFound).toBe(false);
    expect(result.manifestEntry).toBeNull();
  });
});

// ===== createZipBlob =====

describe("apk-extractor createZipBlob", () => {
  it("builds a valid ZIP", async () => {
    const files = [{ name: "test.txt", data: new TextEncoder().encode("hello") }];
    const blob = createZipBlob(files);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

// ===== Utilities =====

describe("apk-extractor formatBytes / formatRatio", () => {
  it("formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatRatio(2.0)).toBe("2.00×");
  });
});

// ===== History =====

describe("apk-extractor history", () => {
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
      fileName: "test.apk",
      fileSize: 1024,
      packageName: "com.example.test",
      versionName: "1.0.0",
      entryCount: 10,
      permissionCount: 3,
      inspectedAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.packageName).toBe("com.example.test");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `app-${i}.apk`, fileSize: 10, packageName: `com.x.${i}`,
        versionName: "1.0", entryCount: 1, permissionCount: 0,
        inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.apk", fileSize: 1, packageName: "com.x", versionName: "",
      entryCount: 1, permissionCount: 0, inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
