import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  parsePartNumber, extractBaseName, sortParts, detectMissingParts,
  bytesToHex, formatBytes, crc32, sha256,
  parseManifest, manifestMap, formatHexPreview,
  verifyPart, concatBytes, mergeParts,
  loadHistory, saveToHistory, clearHistory, buildShareUrl, parseShareUrl,
  type PartEntry, type ManifestEntry,
} from "./logic";

function part(name: string, size: number = 100): PartEntry {
  return {
    id: `${name}-${size}`,
    name, size,
    partNumber: parsePartNumber(name),
    lastModified: 0,
    file: new File(["x"], name),
  };
}

describe("mrg parsePartNumber", () => {
  it("parses 3-digit extension", () => {
    expect(parsePartNumber("file.001")).toBe(1);
    expect(parsePartNumber("file.010")).toBe(10);
    expect(parsePartNumber("file.999")).toBe(999);
  });
  it("parses 5-digit extension", () => {
    expect(parsePartNumber("file.00001")).toBe(1);
  });
  it("returns NaN for non-numeric extension", () => {
    expect(Number.isNaN(parsePartNumber("file.txt"))).toBe(true);
    expect(Number.isNaN(parsePartNumber("file.001.txt"))).toBe(true);
  });
  it("returns NaN for no extension", () => {
    expect(Number.isNaN(parsePartNumber("file"))).toBe(true);
  });
});

describe("mrg extractBaseName", () => {
  it("extracts base name from .001 file", () => {
    expect(extractBaseName("myfile.001")).toBe("myfile");
    expect(extractBaseName("archive.tar.001")).toBe("archive.tar");
  });
  it("returns full name if no part extension", () => {
    expect(extractBaseName("file.txt")).toBe("file.txt");
  });
});

describe("mrg sortParts", () => {
  it("sorts by part number ascending", () => {
    const parts = [part("f.003"), part("f.001"), part("f.002")];
    const sorted = sortParts(parts);
    expect(sorted.map((p) => p.name)).toEqual(["f.001", "f.002", "f.003"]);
  });
  it("places unparseable parts at end", () => {
    const parts = [part("f.002"), part("f.unknown"), part("f.001")];
    const sorted = sortParts(parts);
    expect(sorted[0].name).toBe("f.001");
    expect(sorted[1].name).toBe("f.002");
    expect(sorted[2].name).toBe("f.unknown");
  });
  it("does not mutate original", () => {
    const parts = [part("f.002"), part("f.001")];
    sortParts(parts);
    expect(parts[0].name).toBe("f.002");
  });
});

describe("mrg detectMissingParts", () => {
  it("returns empty for contiguous sequence", () => {
    const parts = [part("f.001"), part("f.002"), part("f.003")];
    expect(detectMissingParts(parts)).toEqual([]);
  });
  it("detects single gap", () => {
    const parts = [part("f.001"), part("f.003")];
    expect(detectMissingParts(parts)).toEqual([2]);
  });
  it("detects multiple gaps", () => {
    const parts = [part("f.001"), part("f.004"), part("f.007")];
    expect(detectMissingParts(parts)).toEqual([2, 3, 5, 6]);
  });
  it("returns empty for unparseable parts only", () => {
    const parts = [part("f.txt"), part("g.bin")];
    expect(detectMissingParts(parts)).toEqual([]);
  });
});

describe("mrg bytesToHex + formatBytes", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("mrg crc32", () => {
  it("computes CRC32 of 'Hello'", () => {
    expect(crc32(new TextEncoder().encode("Hello"))).toBe("f7d18982");
  });
  it("computes CRC32 of empty", () => {
    expect(crc32(new Uint8Array([]))).toBe("00000000");
  });
});

describe("mrg sha256", () => {
  it("computes SHA-256 of 'abc' (known value)", async () => {
    expect(await sha256(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("computes SHA-256 of empty (known value)", async () => {
    expect(await sha256(new Uint8Array([]))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("returns 64-char hex", async () => {
    const h = await sha256(new TextEncoder().encode("test"));
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("mrg parseManifest", () => {
  it("parses sha256 + crc32 lines", () => {
    const content = `# manifest
abc123def456abc123def456abc123def456abc123def456abc123def456abc1  myfile.001
crc32:deadbeef  myfile.001
abc123def456abc123def456abc123def456abc123def456abc123def456abc2  myfile.002
crc32:cafebabe  myfile.002
`;
    const entries = parseManifest(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].filename).toBe("myfile.001");
    expect(entries[0].sha256).toBe("abc123def456abc123def456abc123def456abc123def456abc123def456abc1");
    expect(entries[0].crc32).toBe("deadbeef");
    expect(entries[1].crc32).toBe("cafebabe");
  });
  it("ignores comment lines", () => {
    const content = `# header
# another comment
`;
    expect(parseManifest(content)).toEqual([]);
  });
  it("handles asterisk prefix (binary mode)", () => {
    const content = `${"a".repeat(64)}  *myfile.001`;
    const entries = parseManifest(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].filename).toBe("myfile.001");
  });
  it("manifestMap builds filename → entry map", () => {
    const entries: ManifestEntry[] = [{ filename: "f.001", sha256: "a".repeat(64) }];
    const map = manifestMap(entries);
    expect(map.get("f.001")?.sha256).toBe("a".repeat(64));
    expect(map.get("nonexistent")).toBeUndefined();
  });
});

describe("mrg formatHexPreview", () => {
  it("formats into rows", () => {
    const hex = "0001020304050607";
    expect(formatHexPreview(hex, 4).split("\n")).toEqual(["00 01 02 03", "04 05 06 07"]);
  });
});

describe("mrg verifyPart", () => {
  it("returns null when no manifest entry", async () => {
    expect(await verifyPart(new Uint8Array([1, 2, 3]), undefined)).toBeNull();
  });
  it("returns null when SHA-256 matches", async () => {
    const bytes = new TextEncoder().encode("abc");
    const sha = await sha256(bytes);
    const entry: ManifestEntry = { filename: "f.001", sha256: sha };
    expect(await verifyPart(bytes, entry)).toBeNull();
  });
  it("returns error when SHA-256 mismatches", async () => {
    const entry: ManifestEntry = { filename: "f.001", sha256: "0".repeat(64) };
    const err = await verifyPart(new TextEncoder().encode("abc"), entry);
    expect(err).toContain("SHA-256 mismatch");
  });
  it("returns error when CRC32 mismatches", async () => {
    const entry: ManifestEntry = { filename: "f.001", crc32: "00000000" };
    const err = await verifyPart(new TextEncoder().encode("abc"), entry);
    expect(err).toContain("CRC32 mismatch");
  });
});

describe("mrg concatBytes", () => {
  it("concatenates multiple Uint8Arrays", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    const c = concatBytes([a, b]);
    expect(Array.from(c)).toEqual([1, 2, 3, 4, 5]);
  });
  it("handles empty list", () => {
    const c = concatBytes([]);
    expect(c.length).toBe(0);
  });
});

describe("mrg mergeParts", () => {
  it("merges sorted parts in order", async () => {
    const parts = [
      { entry: part("f.001", 3), bytes: new Uint8Array([1, 2, 3]) },
      { entry: part("f.002", 3), bytes: new Uint8Array([4, 5, 6]) },
    ];
    const result = await mergeParts(parts, new Map());
    expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.stats.partCount).toBe(2);
    expect(result.stats.mergedSize).toBe(6);
    expect(result.stats.baseName).toBe("f");
    expect(result.stats.missingParts).toEqual([]);
    expect(result.stats.verified).toBe(true);
  });
  it("detects missing parts", async () => {
    const parts = [
      { entry: part("f.001", 3), bytes: new Uint8Array([1, 2, 3]) },
      { entry: part("f.003", 3), bytes: new Uint8Array([7, 8, 9]) },
    ];
    const result = await mergeParts(parts, new Map());
    expect(result.stats.missingParts).toEqual([2]);
  });
  it("verifies with manifest", async () => {
    const bytes1 = new Uint8Array([1, 2, 3]);
    const bytes2 = new Uint8Array([4, 5, 6]);
    const parts = [
      { entry: part("f.001", 3), bytes: bytes1 },
      { entry: part("f.002", 3), bytes: bytes2 },
    ];
    const manifest = manifestMap([
      { filename: "f.001", sha256: await sha256(bytes1), crc32: crc32(bytes1) },
      { filename: "f.002", sha256: "0".repeat(64) }, // Wrong on purpose
    ]);
    const result = await mergeParts(parts, manifest);
    expect(result.stats.verified).toBe(false);
    expect(result.stats.verificationErrors.length).toBeGreaterThan(0);
    expect(result.stats.verificationErrors[0]).toContain("f.002");
  });
  it("calls onProgress", async () => {
    const parts = [
      { entry: part("f.001", 1), bytes: new Uint8Array([1]) },
      { entry: part("f.002", 1), bytes: new Uint8Array([2]) },
    ];
    const calls: number[] = [];
    await mergeParts(parts, new Map(), (p) => calls.push(p));
    expect(calls).toContain(100);
  });
});

describe("mrg history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (_i: number) => null,
      length: 0,
    } as Storage;
  });
  it("saves and loads", () => {
    saveToHistory({ baseName: "myfile", partCount: 3, mergedSize: 100, verified: true, errorCount: 0, mergedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ baseName: "myfile", partCount: 3, mergedSize: 100, verified: true, errorCount: 0, mergedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("mrg share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
      location: { origin: "https://x.io", pathname: "/tools/online-file-merger" },
    };
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  it("builds a share URL", () => {
    const url = buildShareUrl({ outputName: "myfile.bin", verify: true });
    expect(url).toContain("#out=myfile.bin");
    expect(url).toContain("verify=true");
  });
  it("parses back", () => {
    const url = buildShareUrl({ outputName: "test.dat", verify: false });
    const hash = url.slice(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.outputName).toBe("test.dat");
      expect(parsed.verify).toBe(false);
    }
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});
