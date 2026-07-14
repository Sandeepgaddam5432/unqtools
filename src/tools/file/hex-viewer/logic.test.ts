import { describe, it, expect, beforeEach } from "vitest";
import {
  bytesToHex, formatByte, formatOffset, byteToAscii, hexDump, hexRows,
  searchHex, searchAscii, parseOffset, swapEndian,
  shannonEntropy, entropyPerChunk, entropyHint, detectSignature, computeStats,
  formatBytes, hexDumpToText,
  loadHistory, saveToHistory, clearHistory, readFileSlice,
  DEFAULT_OPTIONS, type HexOptions,
} from "./logic";

const opts = (overrides: Partial<HexOptions> = {}): HexOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe("hexv bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
  it("handles empty", () => {
    expect(bytesToHex(new Uint8Array([]))).toBe("");
  });
});

describe("hexv formatByte", () => {
  it("pads to 2 chars lowercase", () => {
    expect(formatByte(0)).toBe("00");
    expect(formatByte(255)).toBe("ff");
  });
  it("upperCase option", () => {
    expect(formatByte(255, true)).toBe("FF");
  });
});

describe("hexv formatOffset", () => {
  it("pads to 8 chars hex", () => {
    expect(formatOffset(0)).toBe("00000000");
    expect(formatOffset(255)).toBe("000000ff");
    expect(formatOffset(4096)).toBe("00001000");
  });
});

describe("hexv byteToAscii", () => {
  it("returns printable ASCII", () => {
    expect(byteToAscii(65)).toBe("A");
    expect(byteToAscii(126)).toBe("~");
  });
  it("returns dot for non-printable", () => {
    expect(byteToAscii(0)).toBe(".");
    expect(byteToAscii(31)).toBe(".");
    expect(byteToAscii(127)).toBe(".");
    expect(byteToAscii(200)).toBe(".");
  });
});

describe("hexv hexDump", () => {
  it("generates single-line dump", () => {
    const dump = hexDump(new Uint8Array([72, 101, 108, 108, 111]), opts(), 16);
    expect(dump).toContain("00000000");
    expect(dump).toContain("48 65 6c 6c 6f");
    expect(dump).toContain("|Hello|");
  });
  it("respects bytesPerLine", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const dump = hexDump(bytes, opts({ bytesPerLine: 8 }), 16);
    expect(dump.split("\n").length).toBe(2);
  });
  it("respects upperCase", () => {
    const dump = hexDump(new Uint8Array([255]), opts({ upperCase: true }), 16);
    expect(dump).toContain("FF");
  });
  it("hides ASCII when disabled", () => {
    const dump = hexDump(new Uint8Array([65]), opts({ showAscii: false }), 16);
    expect(dump).not.toContain("|A|");
  });
  it("truncates with maxLines", () => {
    const bytes = new Uint8Array(64);
    const dump = hexDump(bytes, opts({ bytesPerLine: 8 }), 2);
    expect(dump).toContain("more bytes truncated");
  });
});

describe("hexv hexRows", () => {
  it("returns structured rows", () => {
    const rows = hexRows(new Uint8Array([0, 1, 2]), opts(), 16);
    expect(rows).toHaveLength(1);
    expect(rows[0].bytes).toEqual([0, 1, 2]);
    expect(rows[0].hex).toEqual(["00", "01", "02"]);
    expect(rows[0].ascii).toEqual([".", ".", "."]);
  });
  it("splits across rows by bytesPerLine", () => {
    const bytes = new Uint8Array(20);
    const rows = hexRows(bytes, opts({ bytesPerLine: 8 }), 16);
    expect(rows).toHaveLength(3);
    expect(rows[0].bytes.length).toBe(8);
    expect(rows[1].bytes.length).toBe(8);
    expect(rows[2].bytes.length).toBe(4);
  });
});

describe("hexv searchHex", () => {
  it("finds hex matches", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff, 0xd8]);
    const matches = searchHex(bytes, "FFD8");
    expect(matches).toEqual([0, 5]);
  });
  it("handles spaces in query", () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03]);
    expect(searchHex(bytes, "01 02")).toEqual([0]);
  });
  it("returns empty for odd-length query", () => {
    expect(searchHex(new Uint8Array([1]), "1")).toEqual([]);
  });
  it("returns empty for no match", () => {
    expect(searchHex(new Uint8Array([1, 2, 3]), "FFFF")).toEqual([]);
  });
  it("returns empty for invalid hex", () => {
    expect(searchHex(new Uint8Array([1]), "XX")).toEqual([]);
  });
});

describe("hexv searchAscii", () => {
  it("finds ASCII matches", () => {
    const bytes = new TextEncoder().encode("Hello, World!");
    const matches = searchAscii(bytes, "World");
    expect(matches).toEqual([7]);
  });
  it("finds multiple matches", () => {
    const bytes = new TextEncoder().encode("ab ab ab");
    expect(searchAscii(bytes, "ab")).toEqual([0, 3, 6]);
  });
  it("returns empty for no match", () => {
    expect(searchAscii(new TextEncoder().encode("abc"), "xyz")).toEqual([]);
  });
});

describe("hexv parseOffset", () => {
  it("parses decimal", () => {
    expect(parseOffset("100", 1000)).toBe(100);
  });
  it("parses hex with 0x prefix", () => {
    expect(parseOffset("0xff", 1000)).toBe(255);
  });
  it("parses hex without prefix (uppercase)", () => {
    expect(parseOffset("0xFF", 1000)).toBe(255);
  });
  it("returns null for negative", () => {
    expect(parseOffset("-5", 1000)).toBeNull();
  });
  it("returns null for out of range", () => {
    expect(parseOffset("9999", 1000)).toBeNull();
  });
  it("returns null for empty", () => {
    expect(parseOffset("", 1000)).toBeNull();
  });
  it("returns null for non-numeric", () => {
    expect(parseOffset("xyz", 1000)).toBeNull();
  });
});

describe("hexv swapEndian", () => {
  it("swaps 32-bit words", () => {
    const bytes = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const swapped = swapEndian(bytes, 4);
    expect(Array.from(swapped)).toEqual([0x78, 0x56, 0x34, 0x12]);
  });
  it("swaps 16-bit words", () => {
    const bytes = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const swapped = swapEndian(bytes, 2);
    expect(Array.from(swapped)).toEqual([0x34, 0x12, 0x78, 0x56]);
  });
  it("preserves original", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const swapped = swapEndian(bytes, 4);
    expect(Array.from(swapped)).toEqual([4, 3, 2, 1]);
  });
  it("handles leftover bytes", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const swapped = swapEndian(bytes, 4);
    expect(Array.from(swapped)).toEqual([4, 3, 2, 1, 5]);
  });
});

describe("hexv shannonEntropy", () => {
  it("returns 0 for empty", () => {
    expect(shannonEntropy(new Uint8Array([]))).toBe(0);
  });
  it("returns 0 for single repeated byte", () => {
    expect(shannonEntropy(new Uint8Array(100).fill(0))).toBe(0);
  });
  it("returns max entropy (~8) for uniform random bytes", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect(shannonEntropy(bytes)).toBeCloseTo(8, 1);
  });
  it("returns moderate entropy for text", () => {
    const bytes = new TextEncoder().encode("Hello, World!");
    const e = shannonEntropy(bytes);
    expect(e).toBeGreaterThan(2);
    expect(e).toBeLessThan(5);
  });
});

describe("hexv entropyPerChunk", () => {
  it("returns one chunk for small input", () => {
    const out = entropyPerChunk(new Uint8Array(100), 1024);
    expect(out).toHaveLength(1);
    expect(out[0].offset).toBe(0);
  });
  it("returns multiple chunks for large input", () => {
    const out = entropyPerChunk(new Uint8Array(2048), 1024);
    expect(out).toHaveLength(2);
    expect(out[1].offset).toBe(1024);
  });
});

describe("hexv entropyHint", () => {
  it("returns hint for low entropy", () => {
    expect(entropyHint(0.5)).toContain("Very low");
  });
  it("returns hint for high entropy", () => {
    expect(entropyHint(7.5)).toContain("Very high");
  });
});

describe("hexv detectSignature", () => {
  it("detects PNG", () => {
    const sig = detectSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(sig?.ext).toBe("png");
  });
  it("detects JPEG", () => {
    const sig = detectSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
    expect(sig?.ext).toBe("jpg");
  });
  it("returns null for unknown bytes", () => {
    expect(detectSignature(new Uint8Array([0, 0, 0, 0]))).toBeNull();
  });
});

describe("hexv computeStats", () => {
  it("computes stats for a PNG", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const stats = computeStats(bytes);
    expect(stats.size).toBe(8);
    expect(stats.ext).toBe("png");
    expect(stats.mime).toBe("image/png");
    expect(stats.uniqueBytes).toBe(7); // 0x0a appears twice
  });
  it("handles empty input", () => {
    const stats = computeStats(new Uint8Array([]));
    expect(stats.size).toBe(0);
    expect(stats.entropy).toBe(0);
  });
});

describe("hexv formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("hexv hexDumpToText", () => {
  it("generates full dump", () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const text = hexDumpToText(bytes, opts({ bytesPerLine: 4 }));
    expect(text).toContain("00000000");
    expect(text).toContain("00 01 02 03");
    expect(text).not.toContain("truncated");
  });
});

describe("hexv history", () => {
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
    saveToHistory({ filename: "a.bin", size: 100, ext: "bin", entropy: 7.2, inspectedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ filename: "a.bin", size: 100, ext: "bin", entropy: 7.2, inspectedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("hexv readFileSlice", () => {
  it("reads a slice of a File", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5])], "test.bin", { type: "application/octet-stream" });
    const slice = await readFileSlice(file, 1, 4);
    expect(Array.from(slice)).toEqual([1, 2, 3]);
  });
});
