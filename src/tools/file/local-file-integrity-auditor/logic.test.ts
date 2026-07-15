import { describe, it, expect, beforeEach } from "vitest";
import {
  globToRegExp, parsePatterns, applyExcludePatterns, applyIncludePatterns,
  normalizePath, stripBaseFolder,
  hashFile, bufToHex,
  manifestToJson, parseManifest, manifestToCsv,
  createManifest, verifyManifests, computeManifestStats,
  formatBytes, diffToPlainText,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type Manifest, type HashAlgorithm,
} from "./logic";

// ===== Helper: build a File with webkitRelativePath =====

function makeFile(name: string, content: string, relPath?: string): File {
  const file = new File([content], name);
  if (relPath) {
    Object.defineProperty(file, "webkitRelativePath", { value: relPath, writable: false });
  }
  return file;
}

// ===== globToRegExp + parsePatterns =====

describe("integrity globToRegExp", () => {
  it("matches exact string", () => {
    const re = globToRegExp("foo.txt");
    expect(re.test("foo.txt")).toBe(true);
    expect(re.test("bar.txt")).toBe(false);
  });
  it("matches single * (any chars)", () => {
    const re = globToRegExp("*.log");
    expect(re.test("app.log")).toBe(true);
    expect(re.test("error.log")).toBe(true);
    expect(re.test("app.txt")).toBe(false);
  });
  it("matches ? as single char", () => {
    const re = globToRegExp("file?.txt");
    expect(re.test("file1.txt")).toBe(true);
    expect(re.test("file12.txt")).toBe(false);
  });
  it("matches path with slash", () => {
    const re = globToRegExp("node_modules/*");
    expect(re.test("node_modules/react")).toBe(true);
    expect(re.test("node_modules/react/index.js")).toBe(true);
    expect(re.test("src/app.ts")).toBe(false);
  });
  it("escapes regex metacharacters", () => {
    const re = globToRegExp("file.txt");
    // . should match literal dot, not any char
    expect(re.test("fileXtxt")).toBe(false);
    expect(re.test("file.txt")).toBe(true);
  });
});

describe("integrity parsePatterns", () => {
  it("parses comma-separated", () => {
    const re = parsePatterns("*.log, *.tmp, .git/*");
    expect(re).toHaveLength(3);
  });
  it("parses newline-separated", () => {
    const re = parsePatterns("*.log\n*.tmp\n.git/*");
    expect(re).toHaveLength(3);
  });
  it("ignores empty entries", () => {
    expect(parsePatterns(",,")).toEqual([]);
    expect(parsePatterns("")).toEqual([]);
  });
  it("trims whitespace", () => {
    const re = parsePatterns("  *.log  ,  *.tmp  ");
    expect(re).toHaveLength(2);
  });
});

describe("integrity applyExcludePatterns", () => {
  it("filters out excluded paths", () => {
    const paths = ["app.log", "main.ts", "error.log", "node_modules/react/index.js"];
    const patterns = parsePatterns("*.log, node_modules/*");
    const kept = applyExcludePatterns(paths, patterns);
    expect(kept).toEqual(["main.ts"]);
  });
  it("returns all paths when no patterns", () => {
    const paths = ["a.txt", "b.log"];
    expect(applyExcludePatterns(paths, [])).toEqual(paths);
  });
});

describe("integrity applyIncludePatterns", () => {
  it("keeps only matching paths", () => {
    const paths = ["app.log", "main.ts", "error.log", "main.js"];
    const patterns = parsePatterns("*.ts, *.js");
    expect(applyIncludePatterns(paths, patterns)).toEqual(["main.ts", "main.js"]);
  });
  it("returns all when no patterns", () => {
    const paths = ["a.txt"];
    expect(applyIncludePatterns(paths, [])).toEqual(paths);
  });
});

describe("integrity normalizePath + stripBaseFolder", () => {
  it("uses webkitRelativePath if present", () => {
    const file = makeFile("index.js", "x", "src/app/index.js");
    expect(normalizePath(file)).toBe("src/app/index.js");
  });
  it("falls back to name", () => {
    const file = new File(["x"], "hello.txt");
    expect(normalizePath(file)).toBe("hello.txt");
  });
  it("strips first path segment", () => {
    expect(stripBaseFolder("project/src/app.ts")).toBe("src/app.ts");
    expect(stripBaseFolder("app.ts")).toBe("app.ts");
  });
});

// ===== Hashing =====

describe("integrity bufToHex", () => {
  it("converts bytes to hex", () => {
    expect(bufToHex(new Uint8Array([0, 1, 255, 16]))).toBe("0001ff10");
  });
});

describe("integrity hashFile", () => {
  it("hashes with SHA-256", async () => {
    const file = makeFile("a.txt", "hello");
    const hash = await hashFile(file, "SHA-256");
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
  it("hashes empty file with SHA-256", async () => {
    const file = makeFile("empty.txt", "");
    const hash = await hashFile(file, "SHA-256");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("hashes with SHA-512", async () => {
    const file = makeFile("a.txt", "abc");
    const hash = await hashFile(file, "SHA-512");
    expect(hash).toBe("ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
  });
  it("hashes with SHA-1", async () => {
    const file = makeFile("a.txt", "abc");
    const hash = await hashFile(file, "SHA-1");
    expect(hash).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
  it("hashes with MD5 (pure-JS)", async () => {
    const file = makeFile("a.txt", "abc");
    const hash = await hashFile(file, "MD5");
    expect(hash).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("MD5 of empty string", async () => {
    const file = makeFile("a.txt", "");
    const hash = await hashFile(file, "MD5");
    expect(hash).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });
});

// ===== Manifest serialization =====

describe("integrity manifestToJson + parseManifest", () => {
  const manifest: Manifest = {
    version: 1, algorithm: "SHA-256", createdAt: "2026-01-01T00:00:00Z", basePath: "project",
    files: [{ path: "src/app.ts", size: 100, mtime: 1700000000, hash: "abc123" }],
  };
  it("round-trips JSON", () => {
    const json = manifestToJson(manifest);
    const parsed = parseManifest(json);
    expect(parsed).toEqual(manifest);
  });
  it("throws on invalid version", () => {
    expect(() => parseManifest('{"version":99,"algorithm":"SHA-256","files":[]}')).toThrow();
  });
  it("throws on missing algorithm", () => {
    expect(() => parseManifest('{"version":1,"files":[]}')).toThrow();
  });
  it("throws on non-array files", () => {
    expect(() => parseManifest('{"version":1,"algorithm":"SHA-256","files":"not array"}')).toThrow();
  });
  it("throws on malformed JSON", () => {
    expect(() => parseManifest("{not json")).toThrow();
  });
});

describe("integrity manifestToCsv", () => {
  it("generates CSV with header", () => {
    const manifest: Manifest = {
      version: 1, algorithm: "SHA-256", createdAt: "2026-01-01T00:00:00Z", basePath: "",
      files: [{ path: "a.txt", size: 10, mtime: 1700000000, hash: "abc" }],
    };
    const csv = manifestToCsv(manifest);
    expect(csv).toContain("path,size,mtime,hash");
    expect(csv).toContain("a.txt,10,1700000000,abc");
  });
  it("quotes paths containing commas", () => {
    const manifest: Manifest = {
      version: 1, algorithm: "SHA-256", createdAt: "2026-01-01T00:00:00Z", basePath: "",
      files: [{ path: "hello,world.txt", size: 10, mtime: 0, hash: "x" }],
    };
    expect(manifestToCsv(manifest)).toContain('"hello,world.txt"');
  });
  it("escapes quotes in paths", () => {
    const manifest: Manifest = {
      version: 1, algorithm: "SHA-256", createdAt: "2026-01-01T00:00:00Z", basePath: "",
      files: [{ path: 'say "hi".txt', size: 10, mtime: 0, hash: "x" }],
    };
    expect(manifestToCsv(manifest)).toContain('"say ""hi"".txt"');
  });
});

// ===== createManifest =====

describe("integrity createManifest", () => {
  it("creates a manifest from files", async () => {
    const files = [
      makeFile("a.txt", "hello", "project/a.txt"),
      makeFile("b.txt", "world", "project/b.txt"),
    ];
    const manifest = await createManifest(files, "SHA-256", "", "", "project");
    expect(manifest.algorithm).toBe("SHA-256");
    expect(manifest.files).toHaveLength(2);
    expect(manifest.files[0].path).toBe("a.txt");
    expect(manifest.files[1].path).toBe("b.txt");
    expect(manifest.files[0].hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
  it("sorts entries by path", async () => {
    const files = [
      makeFile("z.txt", "1", "project/z.txt"),
      makeFile("a.txt", "1", "project/a.txt"),
    ];
    const manifest = await createManifest(files, "SHA-256", "");
    expect(manifest.files[0].path).toBe("a.txt");
    expect(manifest.files[1].path).toBe("z.txt");
  });
  it("applies exclude patterns", async () => {
    const files = [
      makeFile("a.txt", "1", "project/a.txt"),
      makeFile("a.log", "1", "project/a.log"),
    ];
    const manifest = await createManifest(files, "SHA-256", "*.log");
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0].path).toBe("a.txt");
  });
  it("applies include patterns", async () => {
    const files = [
      makeFile("a.ts", "1", "project/a.ts"),
      makeFile("a.js", "1", "project/a.js"),
    ];
    const manifest = await createManifest(files, "SHA-256", "", "*.ts");
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0].path).toBe("a.ts");
  });
  it("calls onProgress callback", async () => {
    const files = [makeFile("a.txt", "1", "p/a.txt"), makeFile("b.txt", "1", "p/b.txt")];
    const calls: Array<[number, number]> = [];
    await createManifest(files, "SHA-256", "", "", "", (c, t) => calls.push([c, t]));
    expect(calls).toEqual([[1, 2], [2, 2]]);
  });
});

// ===== verifyManifests =====

describe("integrity verifyManifests", () => {
  const baseline: Manifest = {
    version: 1, algorithm: "SHA-256", createdAt: "2026-01-01T00:00:00Z", basePath: "",
    files: [
      { path: "unchanged.txt", size: 5, mtime: 0, hash: "abc" },
      { path: "modified.txt", size: 5, mtime: 0, hash: "old" },
      { path: "deleted.txt", size: 5, mtime: 0, hash: "del" },
    ],
  };
  const current: Manifest = {
    version: 1, algorithm: "SHA-256", createdAt: "2026-01-02T00:00:00Z", basePath: "",
    files: [
      { path: "unchanged.txt", size: 5, mtime: 0, hash: "abc" },
      { path: "modified.txt", size: 6, mtime: 0, hash: "new" },
      { path: "added.txt", size: 5, mtime: 0, hash: "add" },
    ],
  };
  const { diff, stats } = verifyManifests(baseline, current);

  it("detects added files", () => {
    expect(diff.added.map((e) => e.path)).toEqual(["added.txt"]);
  });
  it("detects modified files", () => {
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].entry.path).toBe("modified.txt");
    expect(diff.modified[0].oldHash).toBe("old");
    expect(diff.modified[0].entry.hash).toBe("new");
  });
  it("detects deleted files", () => {
    expect(diff.deleted.map((e) => e.path)).toEqual(["deleted.txt"]);
  });
  it("detects unchanged files", () => {
    expect(diff.unchanged.map((e) => e.path)).toEqual(["unchanged.txt"]);
  });
  it("computes correct stats", () => {
    expect(stats.added).toBe(1);
    expect(stats.modified).toBe(1);
    expect(stats.deleted).toBe(1);
    expect(stats.unchanged).toBe(1);
    expect(stats.totalBefore).toBe(3);
    expect(stats.totalAfter).toBe(3);
  });
  it("returns empty diff for identical manifests", () => {
    const { diff, stats } = verifyManifests(baseline, baseline);
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.deleted).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(3);
    expect(stats.unchanged).toBe(3);
  });
});

// ===== computeManifestStats =====

describe("integrity computeManifestStats", () => {
  it("computes stats from entries", () => {
    const entries = [
      { path: "a.txt", size: 100, mtime: 0, hash: "x" },
      { path: "b.log", size: 200, mtime: 0, hash: "y" },
      { path: "c.TXT", size: 300, mtime: 0, hash: "z" },
    ];
    const stats = computeManifestStats(entries);
    expect(stats.fileCount).toBe(3);
    expect(stats.totalSize).toBe(600);
    expect(stats.avgSize).toBe(200);
    expect(stats.minSize).toBe(100);
    expect(stats.maxSize).toBe(300);
    expect(stats.byExtension["txt"]).toBe(2);
    expect(stats.byExtension["log"]).toBe(1);
  });
  it("handles empty entries", () => {
    const stats = computeManifestStats([]);
    expect(stats.fileCount).toBe(0);
    expect(stats.totalSize).toBe(0);
  });
});

// ===== formatBytes + diffToPlainText =====

describe("integrity formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("integrity diffToPlainText", () => {
  it("formats added/modified/deleted sections", () => {
    const diff = {
      added: [{ path: "new.txt", size: 10, mtime: 0, hash: "n" }],
      modified: [{ entry: { path: "mod.txt", size: 20, mtime: 0, hash: "m2" }, oldHash: "m1", oldSize: 15 }],
      deleted: [{ path: "gone.txt", size: 30, mtime: 0, hash: "g" }],
      unchanged: [],
    };
    const text = diffToPlainText(diff);
    expect(text).toContain("=== ADDED ===");
    expect(text).toContain("new.txt");
    expect(text).toContain("=== MODIFIED ===");
    expect(text).toContain("mod.txt");
    expect(text).toContain("=== DELETED ===");
    expect(text).toContain("gone.txt");
  });
  it("returns 'no changes' for empty diff", () => {
    const text = diffToPlainText({ added: [], modified: [], deleted: [], unchanged: [] });
    expect(text).toBe("No changes detected.");
  });
});

// ===== History =====

describe("integrity history (localStorage)", () => {
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
      basePath: "project", algorithm: "SHA-256",
      fileCount: 5, totalSize: 1000,
      added: 1, modified: 0, deleted: 0,
      auditedAt: new Date().toISOString(),
    });
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].basePath).toBe("project");
  });

  it("caps history at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        basePath: `p${i}`, algorithm: "SHA-256",
        fileCount: 1, totalSize: 1,
        added: 0, modified: 0, deleted: 0,
        auditedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });

  it("clears history", () => {
    saveToHistory({
      basePath: "x", algorithm: "SHA-256",
      fileCount: 1, totalSize: 1,
      added: 0, modified: 0, deleted: 0,
      auditedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("integrity share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/local-file-integrity-auditor",
    };
  });

  it("builds share URL", () => {
    const url = buildShareUrl("SHA-256", "*.log, .git/*");
    expect(url).toContain("alg=SHA-256");
    expect(url).toContain("exclude=");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("SHA-512", "*.tmp");
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.algorithm).toBe("SHA-512");
    expect(parsed?.excludePatterns).toBe("*.tmp");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});
