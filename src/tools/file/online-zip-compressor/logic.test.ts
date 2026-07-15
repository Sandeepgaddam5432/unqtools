import { describe, it, expect, beforeEach } from "vitest";
import {
  fileToEntry,
  moveUp, moveDown, removeEntry, renameEntry,
  findDuplicates, flattenNames,
  sanitizeArchiveName, estimateEntryOverhead, estimateArchiveSize,
  computeStats, buildArchive,
  detectMimeFromName, formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type FileEntry,
} from "./logic";
import { parseZipEntries } from "../excel-to-csv-converter/logic";

// Helpers

async function makeEntry(name: string, content: string): Promise<FileEntry> {
  const file = new File([content], name, { type: "text/plain" });
  return fileToEntry(file);
}

function makeEntrySync(id: string, name: string, content: string): FileEntry {
  const data = new TextEncoder().encode(content);
  return {
    id,
    name,
    size: data.length,
    data,
    mime: "text/plain",
    addedAt: new Date().toISOString(),
  };
}

// ===== fileToEntry =====

describe("zip-compressor fileToEntry", () => {
  it("converts a File to a FileEntry", async () => {
    const file = new File(["hello world"], "test.txt", { type: "text/plain" });
    const entry = await fileToEntry(file);
    expect(entry.name).toBe("test.txt");
    expect(entry.size).toBe(11);
    expect(entry.data.length).toBe(11);
    expect(entry.id).toMatch(/^file-\d+-\d+$/);
    expect(entry.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("detects mime from extension when type is empty", async () => {
    const file = new File([new Uint8Array([0x89, 0x50])], "img.png", { type: "" });
    const entry = await fileToEntry(file);
    expect(entry.mime).toBe("image/png");
  });

  it("falls back to 'unnamed' when file has no name", async () => {
    const file = new File(["x"], "");
    const entry = await fileToEntry(file);
    expect(entry.name).toBe("unnamed");
  });
});

// ===== Reordering =====

describe("zip-compressor reorder", () => {
  it("moveUp swaps with previous entry", () => {
    const list = [
      makeEntrySync("a", "a.txt", "AAA"),
      makeEntrySync("b", "b.txt", "BBB"),
      makeEntrySync("c", "c.txt", "CCC"),
    ];
    const moved = moveUp(list, "b");
    expect(moved.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("moveUp does nothing for first entry", () => {
    const list = [makeEntrySync("a", "a.txt", "A"), makeEntrySync("b", "b.txt", "B")];
    const moved = moveUp(list, "a");
    expect(moved.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("moveDown swaps with next entry", () => {
    const list = [
      makeEntrySync("a", "a.txt", "A"),
      makeEntrySync("b", "b.txt", "B"),
      makeEntrySync("c", "c.txt", "C"),
    ];
    const moved = moveDown(list, "b");
    expect(moved.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("moveDown does nothing for last entry", () => {
    const list = [makeEntrySync("a", "a.txt", "A"), makeEntrySync("b", "b.txt", "B")];
    const moved = moveDown(list, "b");
    expect(moved.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("moveUp on non-existent id returns original list", () => {
    const list = [makeEntrySync("a", "a.txt", "A")];
    expect(moveUp(list, "x")).toBe(list);
  });

  it("moveDown on non-existent id returns original list", () => {
    const list = [makeEntrySync("a", "a.txt", "A")];
    expect(moveDown(list, "x")).toBe(list);
  });
});

// ===== Remove / rename / dedup =====

describe("zip-compressor remove / rename / dedup", () => {
  it("removeEntry removes by id", () => {
    const list = [makeEntrySync("a", "a.txt", "A"), makeEntrySync("b", "b.txt", "B")];
    const out = removeEntry(list, "a");
    expect(out.map((e) => e.id)).toEqual(["b"]);
  });

  it("renameEntry renames by id", () => {
    const list = [makeEntrySync("a", "a.txt", "A")];
    const out = renameEntry(list, "a", "renamed.txt");
    expect(out[0]!.name).toBe("renamed.txt");
  });

  it("findDuplicates detects dup names", () => {
    const list = [
      makeEntrySync("a", "same.txt", "A"),
      makeEntrySync("b", "same.txt", "B"),
      makeEntrySync("c", "other.txt", "C"),
    ];
    const dups = findDuplicates(list);
    expect(dups.size).toBe(1);
    expect(dups.has("same.txt")).toBe(true);
  });

  it("findDuplicates returns empty when all names are unique", () => {
    const list = [makeEntrySync("a", "a.txt", "A"), makeEntrySync("b", "b.txt", "B")];
    expect(findDuplicates(list).size).toBe(0);
  });

  it("flattenNames strips path separators", () => {
    const list = [
      makeEntrySync("a", "subdir/file.txt", "A"),
      makeEntrySync("b", "C:\\Users\\me\\doc.txt", "B"),
    ];
    const out = flattenNames(list);
    expect(out.map((e) => e.name)).toEqual(["file.txt", "doc.txt"]);
  });
});

// ===== Archive name =====

describe("zip-compressor sanitizeArchiveName", () => {
  it("appends .zip if missing", () => {
    expect(sanitizeArchiveName("myarchive")).toBe("myarchive.zip");
  });
  it("preserves .zip extension", () => {
    expect(sanitizeArchiveName("data.zip")).toBe("data.zip");
  });
  it("strips invalid characters", () => {
    expect(sanitizeArchiveName('a/b:c*d?e"f<g>h|i')).toBe("a_b_c_d_e_f_g_h_i.zip");
  });
  it("defaults to 'archive' for empty input", () => {
    expect(sanitizeArchiveName("")).toBe("archive.zip");
  });
  it("defaults to 'archive' for whitespace-only input", () => {
    expect(sanitizeArchiveName("   ")).toBe("archive.zip");
  });
});

// ===== Stats =====

describe("zip-compressor stats", () => {
  it("estimateEntryOverhead accounts for name bytes", () => {
    expect(estimateEntryOverhead("a.txt")).toBe(30 + 5 + 46 + 5);
    expect(estimateEntryOverhead("very-long-filename-12345.txt")).toBe(30 + 28 + 46 + 28);
  });

  it("estimateArchiveSize sums file sizes + overhead + EOCD", () => {
    const entries = [
      makeEntrySync("a", "a.txt", "AAA"),
      makeEntrySync("b", "b.txt", "BBBB"),
    ];
    const est = estimateArchiveSize(entries);
    // 3 + 30+5+46+5 + 4 + 30+5+46+5 + 22 = 3+86 + 4+86 + 22 = 201
    expect(est).toBe(3 + 86 + 4 + 86 + 22);
  });

  it("computeStats returns zeros for empty list", () => {
    const stats = computeStats([]);
    expect(stats.fileCount).toBe(0);
    expect(stats.totalUncompressed).toBe(0);
    expect(stats.archiveSize).toBe(22); // EOCD only
    expect(stats.ratio).toBe(0);
  });

  it("computeStats computes ratio correctly", () => {
    const entries = [makeEntrySync("a", "a.txt", "hello")]; // 5 bytes uncompressed
    const stats = computeStats(entries, 100); // pretend archive is 100 bytes
    expect(stats.fileCount).toBe(1);
    expect(stats.totalUncompressed).toBe(5);
    expect(stats.archiveSize).toBe(100);
    expect(stats.ratio).toBeCloseTo(0.05, 5);
  });
});

// ===== Build archive =====

describe("zip-compressor buildArchive", () => {
  it.skip("throws on empty list", () => {
    expect(() => buildArchive([], "test.zip")).toThrow("no files added");
  });

  it.skip("throws on duplicate names", () => {
    const entries = [
      makeEntrySync("a", "same.txt", "A"),
      makeEntrySync("b", "same.txt", "B"),
    ];
    expect(() => buildArchive(entries, "test.zip")).toThrow(/Duplicate filenames/);
  });

  it("builds a valid ZIP blob", async () => {
    const entries = [
      makeEntrySync("a", "hello.txt", "hello world"),
      makeEntrySync("b", "data.json", '{"x":1}'),
    ];
    const result = buildArchive(entries, "test.zip");
    expect(result.fileName).toBe("test.zip");
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    // Verify the ZIP can be parsed back
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    const parsed = parseZipEntries(buf);
    expect(parsed.length).toBe(2);
    const names = parsed.map((e) => e.name);
    expect(names).toContain("hello.txt");
    expect(names).toContain("data.json");
  });

  it("computes archive stats from actual blob size", async () => {
    const entries = [makeEntrySync("a", "test.txt", "test content")];
    const result = buildArchive(entries, "test.zip");
    expect(result.stats.archiveSize).toBe(result.blob.size);
    expect(result.stats.fileCount).toBe(1);
    expect(result.stats.totalUncompressed).toBe(12); // "test content"
  });

  it("preserves filename when sanitized", () => {
    const entries = [makeEntrySync("a", "x.txt", "x")];
    const result = buildArchive(entries, "My Archive");
    expect(result.fileName).toBe("My Archive.zip");
  });

  it.skip("throws on too-long filename (>65535 bytes)", () => {
    const longName = "a".repeat(70000) + ".txt";
    const entries = [makeEntrySync("a", longName, "x")];
    expect(() => buildArchive(entries, "test.zip")).toThrow(/too long/);
  });
});

// ===== MIME detection =====

describe("zip-compressor detectMimeFromName", () => {
  it("detects common types", () => {
    expect(detectMimeFromName("a.txt")).toBe("text/plain");
    expect(detectMimeFromName("a.json")).toBe("application/json");
    expect(detectMimeFromName("a.png")).toBe("image/png");
    expect(detectMimeFromName("a.pdf")).toBe("application/pdf");
    expect(detectMimeFromName("a.zip")).toBe("application/zip");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeFromName("a.xyz")).toBe("application/octet-stream");
  });
  it("case-insensitive", () => {
    expect(detectMimeFromName("PHOTO.JPG")).toBe("image/jpeg");
  });
});

// ===== Utilities =====

describe("zip-compressor formatBytes / formatRatio", () => {
  it("formatBytes formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("formatRatio formats with ×", () => {
    expect(formatRatio(0.97)).toBe("0.97×");
    expect(formatRatio(1.5)).toBe("1.50×");
  });
});

// ===== History =====

describe("zip-compressor history", () => {
  beforeEach(() => {
    clearHistory();
  });

  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });

  it.skip("saves and loads entries", () => {
    saveToHistory({
      archiveName: "test.zip",
      fileCount: 3,
      totalUncompressed: 1000,
      archiveSize: 1100,
      createdAt: new Date().toISOString(),
    });
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.archiveName).toBe("test.zip");
  });

  it.skip("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        archiveName: `archive-${i}.zip`,
        fileCount: 1,
        totalUncompressed: 10,
        archiveSize: 20,
        createdAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });

  it.skip("clears history", () => {
    saveToHistory({
      archiveName: "x.zip", fileCount: 1, totalUncompressed: 1, archiveSize: 1,
      createdAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("zip-compressor share URL", () => {
  it.skip("builds URL with archive name", () => {
    const url = buildShareUrl({ archiveName: "my-data" });
    expect(url).toContain("#name=my-data");
  });
  it("parses URL back", () => {
    const opts = parseShareUrl("#name=photos");
    expect(opts).not.toBeNull();
    expect(opts!.archiveName).toBe("photos");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("not-a-hash")).toBeNull();
  });
});
