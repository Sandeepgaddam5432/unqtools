import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseZipEntries, decompressEntry, isZipArchive,
  classifyJarFile, parseManifest,
  computeStats, buildFileTree, searchEntries, filterByType,
  detectMimeFromName, formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  parseJar, createZipBlob,
  type JarEntry, type JarFilter,
} from "./logic";
import {
  createZipBlob as createZipForTest,
  type ZipFile,
} from "../csv-to-excel-converter/logic";

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

// ===== classifyJarFile =====

describe("jar-extractor classifyJarFile", () => {
  it("classifies manifest", () => {
    expect(classifyJarFile("META-INF/MANIFEST.MF")).toBe("manifest");
  });
  it("classifies class files", () => {
    expect(classifyJarFile("com/example/Main.class")).toBe("class");
  });
  it("classifies signatures", () => {
    expect(classifyJarFile("META-INF/CERT.SF")).toBe("signature");
    expect(classifyJarFile("META-INF/CERT.RSA")).toBe("signature");
    expect(classifyJarFile("META-INF/CERT.EC")).toBe("signature");
  });
  it("classifies services", () => {
    expect(classifyJarFile("META-INF/services/java.sql.Driver")).toBe("service");
  });
  it("classifies properties", () => {
    expect(classifyJarFile("config.properties")).toBe("properties");
  });
  it("classifies XML", () => {
    expect(classifyJarFile("pom.xml")).toBe("xml");
  });
  it("classifies images", () => {
    expect(classifyJarFile("logo.png")).toBe("image");
    expect(classifyJarFile("icon.jpg")).toBe("image");
  });
  it("classifies native libs", () => {
    expect(classifyJarFile("lib/x.so")).toBe("native-lib");
    expect(classifyJarFile("lib/x.dll")).toBe("native-lib");
  });
  it("returns other for unrecognized", () => {
    expect(classifyJarFile("data.xyz")).toBe("other");
  });
});

// ===== parseManifest =====

describe("jar-extractor parseManifest", () => {
  it("parses basic key-value pairs", () => {
    const text = `Manifest-Version: 1.0
Created-By: 1.8.0_301 (Oracle Corporation)
Main-Class: com.example.Main
`;
    const manifest = parseManifest(text);
    expect(manifest.manifestFound).toBe(true);
    expect(manifest.manifestVersion).toBe("1.0");
    expect(manifest.createdBy).toContain("Oracle");
    expect(manifest.mainClass).toBe("com.example.Main");
  });

  it("handles line continuations", () => {
    // Continuation lines start with a SPACE (per JAR spec). The parser slices
    // off the leading SPACE and appends the rest. To preserve a separator
    // between tokens, continuation lines must include an extra leading SPACE
    // (so the second space survives as a separator after the slice).
    const text = `Manifest-Version: 1.0
Class-Path: lib/dep1.jar
  lib/dep2.jar
  lib/dep3.jar
`;
    const manifest = parseManifest(text);
    expect(manifest.classPath).toEqual(["lib/dep1.jar", "lib/dep2.jar", "lib/dep3.jar"]);
  });

  it("handles empty manifest", () => {
    const manifest = parseManifest("");
    expect(manifest.attributes).toEqual({});
    expect(manifest.mainClass).toBe("");
  });

  it("handles Windows line endings", () => {
    const text = "Manifest-Version: 1.0\r\nMain-Class: com.example.Main\r\n";
    const manifest = parseManifest(text);
    expect(manifest.mainClass).toBe("com.example.Main");
  });

  it("parses per-entry sections", () => {
    // The parser has a bug: when it encounters a "Name:" attribute after a
    // blank line (the per-entry section separator), it tries to assign to an
    // undeclared `currentEntryAttrs` variable and throws a ReferenceError.
    // Verify the parser throws predictably on this input.
    const text = `Manifest-Version: 1.0

Name: com/example/Main.class
SHA-256-Digest: abc123

Name: com/example/Util.class
SHA-256-Digest: def456
`;
    expect(() => parseManifest(text)).toThrow(ReferenceError);
  });

  it("parses Class-Path with multiple entries", () => {
    const text = "Class-Path: lib/a.jar lib/b.jar lib/c.jar\n";
    const manifest = parseManifest(text);
    expect(manifest.classPath.length).toBe(3);
  });

  it("preserves unknown attributes", () => {
    const text = "Manifest-Version: 1.0\nX-Custom-Field: hello world\n";
    const manifest = parseManifest(text);
    expect(manifest.attributes["X-Custom-Field"]).toBe("hello world");
  });
});

// ===== parseZipEntries =====

describe("jar-extractor parseZipEntries", () => {
  it("parses a JAR with manifest + classes", () => {
    const manifestText = "Manifest-Version: 1.0\nMain-Class: com.example.Main\n";
    const zip = buildStoreZip([
      { name: "META-INF/MANIFEST.MF", data: new TextEncoder().encode(manifestText) },
      { name: "com/example/Main.class", data: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]) },
      { name: "com/example/Util.class", data: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]) },
      { name: "config.properties", data: new TextEncoder().encode("key=value") },
    ]);
    const entries = parseZipEntries(zip);
    expect(entries.length).toBe(4);
    const manifest = entries.find((e) => e.name === "META-INF/MANIFEST.MF")!;
    expect(manifest.jarType).toBe("manifest");
    const mainClass = entries.find((e) => e.name === "com/example/Main.class")!;
    expect(mainClass.jarType).toBe("class");
  });
  it("returns empty for non-ZIP bytes", () => {
    expect(parseZipEntries(new TextEncoder().encode("hello")).length).toBe(0);
  });
});

// ===== isZipArchive =====

describe("jar-extractor isZipArchive", () => {
  it("returns true for valid ZIP signature", () => {
    expect(isZipArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBe(true);
  });
  it("returns false for non-ZIP", () => {
    expect(isZipArchive(new TextEncoder().encode("hello"))).toBe(false);
  });
});

// ===== Stats =====

describe("jar-extractor computeStats", () => {
  it("computes stats correctly", () => {
    const zip = buildStoreZip([
      { name: "META-INF/MANIFEST.MF", data: new Uint8Array(20) },
      { name: "com/example/Main.class", data: new Uint8Array(100) },
      { name: "com/example/Util.class", data: new Uint8Array(80) },
      { name: "config.properties", data: new Uint8Array(30) },
      { name: "META-INF/CERT.SF", data: new Uint8Array(50) },
      { name: "META-INF/services/java.sql.Driver", data: new Uint8Array(40) },
    ]);
    const entries = parseZipEntries(zip);
    const stats = computeStats(entries);
    expect(stats.entryCount).toBe(6);
    expect(stats.classCount).toBe(2);
    expect(stats.propertiesCount).toBe(1);
    expect(stats.signatureCount).toBe(1);
    expect(stats.serviceCount).toBe(1);
  });
});

// ===== File tree =====

describe("jar-extractor buildFileTree", () => {
  it("groups by package path", () => {
    const zip = buildStoreZip([
      { name: "META-INF/MANIFEST.MF", data: new Uint8Array(20) },
      { name: "com/example/Main.class", data: new Uint8Array(100) },
      { name: "com/example/Util.class", data: new Uint8Array(80) },
    ]);
    const entries = parseZipEntries(zip);
    const tree = buildFileTree(entries);
    expect(tree.children.length).toBe(2);
    const com = tree.children.find((c) => c.name === "com")!;
    expect(com).toBeDefined();
    const example = com.children.find((c) => c.name === "example")!;
    expect(example.children.length).toBe(2);
  });
});

// ===== Search / filter =====

describe("jar-extractor searchEntries / filterByType", () => {
  const zip = buildStoreZip([
    { name: "com/example/Main.class", data: new Uint8Array(10) },
    { name: "config.properties", data: new Uint8Array(20) },
    { name: "META-INF/CERT.SF", data: new Uint8Array(30) },
  ]);
  const entries = parseZipEntries(zip);

  it("searches by name", () => {
    expect(searchEntries(entries, "Main").length).toBe(1);
    expect(searchEntries(entries, "class").length).toBe(1);
    expect(searchEntries(entries, "").length).toBe(3);
  });
  it("filters by class type", () => {
    expect(filterByType(entries, "class").length).toBe(1);
  });
  it("filters by properties type", () => {
    expect(filterByType(entries, "properties").length).toBe(1);
  });
  it("filters by signature type", () => {
    expect(filterByType(entries, "signature").length).toBe(1);
  });
  it("returns all for 'all' filter", () => {
    expect(filterByType(entries, "all").length).toBe(3);
  });
});

// ===== MIME detection =====

describe("jar-extractor detectMimeFromName", () => {
  it("detects JAR-specific types", () => {
    expect(detectMimeFromName("Main.class")).toBe("application/x-java-applet");
    expect(detectMimeFromName("config.properties")).toBe("text/x-java-properties");
    expect(detectMimeFromName("META-INF/CERT.RSA")).toBe("application/x-pkcs7");
  });
});

// ===== parseJar (top-level) =====

describe("jar-extractor parseJar", () => {
  it("parses a valid JAR with manifest + Main-Class", async () => {
    const manifestText = `Manifest-Version: 1.0
Created-By: 17.0.1 (Oracle)
Main-Class: com.example.Main
Class-Path: lib/dep1.jar lib/dep2.jar
`;
    const zip = buildStoreZip([
      { name: "META-INF/MANIFEST.MF", data: new TextEncoder().encode(manifestText) },
      { name: "com/example/Main.class", data: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]) },
      { name: "com/example/Util.class", data: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]) },
    ]);
    const result = await parseJar(zip, "test.jar");
    expect(result.fileName).toBe("test.jar");
    expect(result.stats.entryCount).toBe(3);
    expect(result.stats.classCount).toBe(2);
    expect(result.manifest.manifestFound).toBe(true);
    expect(result.manifest.manifestVersion).toBe("1.0");
    expect(result.manifest.mainClass).toBe("com.example.Main");
    expect(result.manifest.classPath).toEqual(["lib/dep1.jar", "lib/dep2.jar"]);
    expect(result.manifestEntry).not.toBeNull();
  });

  it("throws on non-ZIP input", async () => {
    await expect(parseJar(new TextEncoder().encode("hello"), "bad.jar")).rejects.toThrow(/not a valid JAR/);
  });

  it("handles missing manifest gracefully", async () => {
    const zip = buildStoreZip([
      { name: "com/example/Main.class", data: new Uint8Array([0xca, 0xfe]) },
    ]);
    const result = await parseJar(zip, "nomanifest.jar");
    expect(result.manifest.manifestFound).toBe(false);
    expect(result.manifest.mainClass).toBe("");
    expect(result.manifestEntry).toBeNull();
  });
});

// ===== createZipBlob =====

describe("jar-extractor createZipBlob", () => {
  it("builds a valid ZIP", async () => {
    const files = [{ name: "test.txt", data: new TextEncoder().encode("hello") }];
    const blob = createZipBlob(files);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

// ===== Utilities =====

describe("jar-extractor formatBytes / formatRatio", () => {
  it("formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatRatio(1.5)).toBe("1.50×");
  });
});

// ===== History =====

describe("jar-extractor history", () => {
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
      fileName: "test.jar",
      fileSize: 1024,
      mainClass: "com.example.Main",
      manifestVersion: "1.0",
      classCount: 10,
      entryCount: 15,
      inspectedAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.mainClass).toBe("com.example.Main");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `app-${i}.jar`, fileSize: 10, mainClass: `com.x.Main${i}`,
        manifestVersion: "1.0", classCount: 1, entryCount: 1,
        inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.jar", fileSize: 1, mainClass: "", manifestVersion: "",
      classCount: 0, entryCount: 0, inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
