import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  bytesToHex, sha256, groupBySize, groupByHash,
  filterByMinSize, sortFiles, sortGroupMembers,
  findDuplicates, formatBytes, groupsToCsv, groupsToJson,
  generateFileId, buildFileEntries,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type FileEntry, type DuplicateGroup, type ScanOptions, type ScanStats,
} from "./logic";

function mockFile(name: string, content: string, lastModified: number = 0): File {
  const bytes = new TextEncoder().encode(content);
  const blob = new Blob([bytes as BlobPart]);
  // Stub a File-like object with .slice, .arrayBuffer, .size, .name, .lastModified
  return {
    name,
    size: bytes.length,
    lastModified,
    type: "",
    arrayBuffer: async () => bytes.buffer,
    text: async () => content,
    slice: (start: number, end?: number) => blob.slice(start, end),
  } as unknown as File;
}

function entry(name: string, size: number, hash?: string, partialHash?: string, lastModified: number = 0, file?: File): FileEntry {
  return {
    id: `${name}-${size}-${lastModified}`,
    name, size, lastModified,
    file: file ?? mockFile(name, "x".repeat(size)),
    fullHash: hash, partialHash,
  };
}

describe("dup-finder bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 255, 16]))).toBe("00ff10");
  });
});

describe("dup-finder sha256", () => {
  it("hashes empty string to known value", async () => {
    const h = await sha256(new Uint8Array([]));
    expect(h).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("hashes 'abc' to known value", async () => {
    const h = await sha256(new TextEncoder().encode("abc"));
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("dup-finder groupBySize", () => {
  it("groups files by size", () => {
    const files = [entry("a", 10), entry("b", 10), entry("c", 20)];
    const map = groupBySize(files);
    expect(map.get(10)).toHaveLength(2);
    expect(map.get(20)).toHaveLength(1);
  });
  it("handles empty input", () => {
    expect(groupBySize([]).size).toBe(0);
  });
});

describe("dup-finder groupByHash", () => {
  it("groups files by full hash", () => {
    const files = [
      entry("a", 10, "h1"),
      entry("b", 10, "h1"),
      entry("c", 10, "h2"),
    ];
    const map = groupByHash(files);
    expect(map.get("h1")).toHaveLength(2);
    expect(map.get("h2")).toHaveLength(1);
  });
  it("skips files without full hash", () => {
    const files = [entry("a", 10), entry("b", 10, "h1")];
    expect(groupByHash(files).size).toBe(1);
  });
});

describe("dup-finder filterByMinSize", () => {
  it("filters files below minimum", () => {
    const files = [entry("a", 100), entry("b", 50), entry("c", 200)];
    const { kept, skipped } = filterByMinSize(files, 100);
    expect(kept).toHaveLength(2);
    expect(skipped).toHaveLength(1);
  });
  it("zero minimum keeps all", () => {
    const files = [entry("a", 0), entry("b", 100)];
    expect(filterByMinSize(files, 0).kept).toHaveLength(2);
  });
});

describe("dup-finder sortFiles", () => {
  it("sorts by size desc", () => {
    const files = [entry("a", 10), entry("b", 30), entry("c", 20)];
    const sorted = sortFiles(files, "size", "desc");
    expect(sorted.map((f) => f.size)).toEqual([30, 20, 10]);
  });
  it("sorts by name asc", () => {
    const files = [entry("c", 1), entry("a", 1), entry("b", 1)];
    const sorted = sortFiles(files, "name", "asc");
    expect(sorted.map((f) => f.name)).toEqual(["a", "b", "c"]);
  });
  it("sorts by date asc", () => {
    const files = [entry("a", 1, undefined, undefined, 200), entry("b", 1, undefined, undefined, 100)];
    const sorted = sortFiles(files, "date", "asc");
    expect(sorted[0].name).toBe("b");
  });
  it("no sort key returns same order", () => {
    const files = [entry("a", 1), entry("b", 1)];
    expect(sortFiles(files, "none", "asc")).toHaveLength(2);
  });
});

describe("dup-finder sortGroupMembers", () => {
  it("sorts members within a group", () => {
    const group: DuplicateGroup = {
      hash: "h", size: 10,
      members: [entry("c", 10), entry("a", 10), entry("b", 10)],
      spaceSaved: 20,
    };
    const sorted = sortGroupMembers(group, "name", "asc");
    expect(sorted.members.map((m) => m.name)).toEqual(["a", "b", "c"]);
  });
});

describe("dup-finder findDuplicates", () => {
  beforeEach(() => {
    // Use real WebCrypto (available in vitest node 20+).
  });

  it("returns no groups for unique files", async () => {
    const files = [
      entry("a", 5, undefined, undefined, 0, mockFile("a", "aaaaa")),
      entry("b", 5, undefined, undefined, 0, mockFile("b", "bbbbb")),
    ];
    const opts: ScanOptions = { minSizeBytes: 0, sortKey: "size", sortDir: "desc" };
    const { groups, stats } = await findDuplicates(files, opts);
    expect(groups).toHaveLength(0);
    expect(stats.duplicateGroups).toBe(0);
  });

  it("returns groups for identical files", async () => {
    const files = [
      entry("a", 5, undefined, undefined, 0, mockFile("a", "hello")),
      entry("b", 5, undefined, undefined, 0, mockFile("b", "hello")),
    ];
    const opts: ScanOptions = { minSizeBytes: 0, sortKey: "size", sortDir: "desc" };
    const { groups, stats } = await findDuplicates(files, opts);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    expect(stats.spaceSaved).toBe(5);
  });

  it("filters by min size", async () => {
    const files = [
      entry("a", 1, undefined, undefined, 0, mockFile("a", "x")),
      entry("b", 1, undefined, undefined, 0, mockFile("b", "x")),
    ];
    const opts: ScanOptions = { minSizeBytes: 10, sortKey: "size", sortDir: "desc" };
    const { stats } = await findDuplicates(files, opts);
    expect(stats.skippedBySize).toBe(2);
    expect(stats.duplicateGroups).toBe(0);
  });

  it("calls onProgress", async () => {
    const files = [
      entry("a", 5, undefined, undefined, 0, mockFile("a", "hello")),
      entry("b", 5, undefined, undefined, 0, mockFile("b", "hello")),
    ];
    const opts: ScanOptions = { minSizeBytes: 0, sortKey: "size", sortDir: "desc" };
    const phases: string[] = [];
    await findDuplicates(files, opts, (pct, phase) => { phases.push(phase); });
    expect(phases.length).toBeGreaterThan(0);
    expect(phases).toContain("Done");
  });
});

describe("dup-finder formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("dup-finder groupsToCsv", () => {
  it("generates CSV with header", () => {
    const groups: DuplicateGroup[] = [{
      hash: "abc", size: 10,
      members: [entry("file1.txt", 10), entry("file2.txt", 10)],
      spaceSaved: 10,
    }];
    const csv = groupsToCsv(groups);
    expect(csv).toContain("group_hash,file_name");
    expect(csv).toContain("file1.txt");
    expect(csv).toContain("file2.txt");
  });
  it("escapes quotes in filenames", () => {
    const groups: DuplicateGroup[] = [{
      hash: "h", size: 5,
      members: [entry('file"quote.txt', 5)],
      spaceSaved: 0,
    }];
    const csv = groupsToCsv(groups);
    expect(csv).toContain('"file""quote.txt"');
  });
});

describe("dup-finder groupsToJson", () => {
  it("generates valid JSON with stats", () => {
    const groups: DuplicateGroup[] = [{
      hash: "abc", size: 10,
      members: [entry("file1.txt", 10)],
      spaceSaved: 0,
    }];
    const stats: ScanStats = {
      totalFiles: 1, totalSize: 10, duplicateGroups: 1,
      duplicateFileCount: 1, spaceSaved: 0, skippedBySize: 0, skippedByPartial: 0,
    };
    const json = groupsToJson(groups, stats);
    const parsed = JSON.parse(json);
    expect(parsed.stats.totalFiles).toBe(1);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].members[0].name).toBe("file1.txt");
  });
});

describe("dup-finder generateFileId + buildFileEntries", () => {
  it("generates stable id", () => {
    const id1 = generateFileId("a.txt", 10, 1000, 0);
    const id2 = generateFileId("a.txt", 10, 1000, 0);
    expect(id1).toBe(id2);
  });
  it("builds entries from File list", () => {
    const files = [mockFile("a.txt", "hello"), mockFile("b.txt", "world")];
    const entries = buildFileEntries(files);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe("a.txt");
    expect(entries[0].size).toBe(5);
  });
});

describe("dup-finder history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileCount: 10, duplicateGroups: 2, spaceSaved: 1024, scannedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileCount: 10, duplicateGroups: 2, spaceSaved: 1024, scannedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("dup-finder buildShareUrl", () => {
  it("builds share URL with params", () => {
    (globalThis as any).window = { location: { origin: "https://x.io", pathname: "/tools/dup" } };
    const url = buildShareUrl({ minSizeBytes: 1024, sortKey: "size", sortDir: "desc" });
    expect(url).toContain("#min=1024");
    expect(url).toContain("sort=size");
    expect(url).toContain("dir=desc");
    delete (globalThis as any).window;
  });
});
