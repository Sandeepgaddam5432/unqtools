import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  toBytes, parseSizeString, formatBytes,
  stripExtension, sanitizeFilename,
  computePartCount, computePartByteSize, partFilename,
  bytesToHex, formatHexPreview,
  crc32, sha256,
  splitBytes, buildManifest, manifestFilename, mergeInstructions,
  PART_SIZE_PRESETS, UNIT_MULTIPLIERS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS, type SplitOptions,
} from "./logic";

const opts = (o: Partial<SplitOptions> = {}): SplitOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe("spl toBytes + UNIT_MULTIPLIERS", () => {
  it("converts bytes", () => { expect(toBytes(100, "B")).toBe(100); });
  it("converts KB", () => { expect(toBytes(1, "KB")).toBe(1024); });
  it("converts MB", () => { expect(toBytes(1, "MB")).toBe(1024 * 1024); });
  it("converts GB", () => { expect(toBytes(1, "GB")).toBe(1024 * 1024 * 1024); });
  it("has all 4 units", () => {
    expect(UNIT_MULTIPLIERS.B).toBe(1);
    expect(UNIT_MULTIPLIERS.KB).toBe(1024);
    expect(UNIT_MULTIPLIERS.MB).toBe(1024 * 1024);
    expect(UNIT_MULTIPLIERS.GB).toBe(1024 * 1024 * 1024);
  });
});

describe("spl parseSizeString", () => {
  it("parses bare number", () => { expect(parseSizeString("100")).toBe(100); });
  it("parses with unit", () => { expect(parseSizeString("1 MB")).toBe(1024 * 1024); });
  it("parses without space", () => { expect(parseSizeString("1MB")).toBe(1024 * 1024); });
  it("parses fractional", () => { expect(parseSizeString("1.5 KB")).toBe(1536); });
  it("returns null for invalid", () => { expect(parseSizeString("abc")).toBeNull(); });
});

describe("spl formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("spl stripExtension + sanitizeFilename", () => {
  it("strips extension", () => {
    expect(stripExtension("file.txt")).toBe("file");
    expect(stripExtension("file")).toBe("file");
  });
  it("sanitizes filename", () => {
    expect(sanitizeFilename("my file.txt")).toBe("my_file.txt");
    expect(sanitizeFilename("file@name.bin")).toBe("file_name.bin");
  });
});

describe("spl computePartCount", () => {
  it("computes from partSize", () => {
    expect(computePartCount(100, opts({ mode: "partSize", partSize: 25 }))).toBe(4);
  });
  it("handles uneven division", () => {
    expect(computePartCount(100, opts({ mode: "partSize", partSize: 30 }))).toBe(4); // 4 parts: 30+30+30+10
  });
  it("handles partSize=0 as 1", () => {
    expect(computePartCount(100, opts({ mode: "partSize", partSize: 0 }))).toBe(1);
  });
  it("computes from partCount", () => {
    expect(computePartCount(100, opts({ mode: "partCount", partCount: 5 }))).toBe(5);
  });
  it("floors fractional partCount", () => {
    expect(computePartCount(100, opts({ mode: "partCount", partCount: 2.9 }))).toBe(2);
  });
});

describe("spl computePartByteSize", () => {
  it("computes uniform part size", () => {
    expect(computePartByteSize(100, 0, 4, 25)).toBe(25);
    expect(computePartByteSize(100, 3, 4, 25)).toBe(25);
  });
  it("computes last part as remainder", () => {
    expect(computePartByteSize(100, 3, 4, 30)).toBe(10); // 30+30+30+10
  });
  it("returns 0 for out-of-range", () => {
    expect(computePartByteSize(100, 5, 4, 25)).toBe(0);
    expect(computePartByteSize(100, -1, 4, 25)).toBe(0);
  });
});

describe("spl partFilename", () => {
  it("generates HJSplit-style name with default template", () => {
    expect(partFilename("{base}.{n}", "myfile", 0, 3)).toBe("myfile.001");
    expect(partFilename("{base}.{n}", "myfile", 9, 3)).toBe("myfile.010");
  });
  it("supports {index} placeholder", () => {
    expect(partFilename("{base}.part{index}", "myfile", 0, 3)).toBe("myfile.part001");
  });
  it("respects padWidth", () => {
    expect(partFilename("{base}.{n}", "f", 0, 5)).toBe("f.00001");
  });
});

describe("spl bytesToHex + formatHexPreview", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
  it("formats into rows", () => {
    const hex = "0001020304050607";
    expect(formatHexPreview(hex, 4).split("\n")).toEqual(["00 01 02 03", "04 05 06 07"]);
  });
});

describe("spl crc32", () => {
  it("computes CRC32 of empty", () => {
    expect(crc32(new Uint8Array([]))).toBe("00000000");
  });
  it("computes CRC32 of 'Hello'", () => {
    // Known CRC32 of "Hello" (0x48 0x65 0x6c 0x6c 0x6f) is 0xF7D18982
    expect(crc32(new TextEncoder().encode("Hello"))).toBe("f7d18982");
  });
  it("computes CRC32 of 'abc'", () => {
    // Known CRC32 of "abc" is 0x352441C2
    expect(crc32(new TextEncoder().encode("abc"))).toBe("352441c2");
  });
});

describe("spl sha256", () => {
  it("computes SHA-256 of empty (known value)", async () => {
    const h = await sha256(new Uint8Array([]));
    expect(h).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("computes SHA-256 of 'abc' (known value)", async () => {
    const h = await sha256(new TextEncoder().encode("abc"));
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("returns 64-char hex", async () => {
    const h = await sha256(new TextEncoder().encode("test"));
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("spl splitBytes", () => {
  it("splits a Uint8Array into parts by partSize", async () => {
    const bytes = new Uint8Array(100);
    for (let i = 0; i < 100; i++) bytes[i] = i;
    const result = await splitBytes(bytes, "test", opts({ mode: "partSize", partSize: 25 }));
    expect(result.partCount).toBe(4);
    expect(result.parts).toHaveLength(4);
    expect(result.totalSize).toBe(100);
    expect(result.parts[0].size).toBe(25);
    expect(result.parts[3].size).toBe(25);
  });
  it("splits by partCount", async () => {
    const bytes = new Uint8Array(100);
    const result = await splitBytes(bytes, "test", opts({ mode: "partCount", partCount: 5 }));
    expect(result.partCount).toBe(5);
    expect(result.parts).toHaveLength(5);
    expect(result.parts[0].size).toBe(20);
  });
  it("handles uneven part sizes (last part smaller)", async () => {
    const bytes = new Uint8Array(100);
    const result = await splitBytes(bytes, "test", opts({ mode: "partSize", partSize: 30 }));
    expect(result.partCount).toBe(4); // 30+30+30+10
    expect(result.parts[3].size).toBe(10);
    expect(result.lastPartSize).toBe(10);
  });
  it("names parts HJSplit-style by default", async () => {
    const bytes = new Uint8Array(50);
    const result = await splitBytes(bytes, "myfile", opts({ mode: "partSize", partSize: 25 }));
    expect(result.parts[0].filename).toBe("myfile.001");
    expect(result.parts[1].filename).toBe("myfile.002");
    expect(result.parts[1].partNumber).toBe(2);
  });
  it("computes crc32 + sha256 for each part", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = await splitBytes(bytes, "test", opts({ mode: "partSize", partSize: 3 }));
    expect(result.parts[0].crc32).toMatch(/^[0-9a-f]{8}$/);
    expect(result.parts[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.parts[1].crc32).toMatch(/^[0-9a-f]{8}$/);
  });
  it("includes previewHex of first 16 bytes", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = await splitBytes(bytes, "test", opts({ mode: "partSize", partSize: 3 }));
    expect(result.parts[0].previewHex).toHaveLength(6); // 3 bytes * 2 chars
    expect(result.parts[0].previewHex).toBe("000102");
  });
  it("calls onProgress", async () => {
    const bytes = new Uint8Array(100);
    const calls: number[] = [];
    await splitBytes(bytes, "test", opts({ mode: "partSize", partSize: 25 }), (p) => calls.push(p));
    expect(calls).toContain(100);
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });
  it("generates manifest with checksums", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = await splitBytes(bytes, "myfile", opts({ mode: "partSize", partSize: 3 }));
    expect(result.manifest).toContain("myfile");
    expect(result.manifest).toContain("UnQTools File Splitter manifest");
    expect(result.manifest).toContain(result.parts[0].sha256);
    expect(result.manifest).toContain(`crc32:${result.parts[0].crc32}`);
  });
});

describe("spl buildManifest + manifestFilename + mergeInstructions", () => {
  it("manifestFilename returns <base>.sha256", () => {
    expect(manifestFilename("myfile")).toBe("myfile.sha256");
  });
  it("mergeInstructions lists 5 options", () => {
    const txt = mergeInstructions("myfile", 4);
    expect(txt).toContain("UnQTools File Merger");
    expect(txt).toContain("7-Zip");
    expect(txt).toContain("HJSplit");
    expect(txt).toContain("cat");
    expect(txt).toContain("sha256sum");
    expect(txt).toContain("4 part(s)");
  });
  it("buildManifest includes format header", () => {
    const manifest = buildManifest("test", [], 0, 0);
    expect(manifest).toContain("HJSplit-compatible");
    expect(manifest).toContain("Original file: test");
  });
});

describe("spl PART_SIZE_PRESETS", () => {
  it("includes common sizes", () => {
    const labels = PART_SIZE_PRESETS.map((p) => p.label);
    expect(labels).toContain("1 MB");
    expect(labels).toContain("100 MB");
    expect(labels).toContain("1 GB");
    expect(PART_SIZE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("spl history", () => {
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
    saveToHistory({ filename: "f.bin", totalSize: 100, partCount: 4, partSize: 25, mode: "partSize", splitAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ filename: "f.bin", totalSize: 100, partCount: 4, partSize: 25, mode: "partSize", splitAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("spl share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
      location: { origin: "https://x.io", pathname: "/tools/online-file-splitter" },
    };
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  it("builds a share URL", () => {
    const url = buildShareUrl(opts({ mode: "partSize", partSize: 1024 }));
    expect(url).toContain("#mode=partSize");
    expect(url).toContain("size=1024");
  });
  it("parses back", () => {
    const url = buildShareUrl(opts({ mode: "partCount", partCount: 5, template: "{base}.part{n}" }));
    const hash = url.slice(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.mode).toBe("partCount");
      expect(parsed.partCount).toBe(5);
      expect(parsed.template).toBe("{base}.part{n}");
    }
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});
