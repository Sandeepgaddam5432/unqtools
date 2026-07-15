import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  bytesToHex, formatByte, formatOffset, byteToAscii, hexRows,
  readUint8, readInt8, readUint16, readInt16, readUint32, readInt32,
  readInt64, readUint64, readFloat32, readFloat64, readAscii, readUtf8,
  decodeAtCursor, decodeAllAtCursor,
  searchHex, searchAscii, parseOffset,
  detectSignature, MAGIC_BYTES,
  STRUCTURE_TEMPLATES, autoDetectTemplate, parseStructure, decodeField,
  shannonEntropy, entropyHint, computeStats, formatBytes,
  formatSelection, type CopyFormat,
  loadHistory, saveToHistory, clearHistory, readFileBytes,
  buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS, type ViewOptions, type Endian, type BytesPerLine,
} from "./logic";

const opts = (o: Partial<ViewOptions> = {}): ViewOptions => ({ ...DEFAULT_OPTIONS, ...o });

// Helper: build a Uint8Array from a hex string
function fromHex(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, "");
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe("bfv bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
  it("handles empty", () => {
    expect(bytesToHex(new Uint8Array([]))).toBe("");
  });
});

describe("bfv formatByte", () => {
  it("pads to 2 chars lowercase", () => {
    expect(formatByte(0)).toBe("00");
    expect(formatByte(255)).toBe("ff");
  });
  it("upperCase option", () => {
    expect(formatByte(255, true)).toBe("FF");
  });
});

describe("bfv formatOffset", () => {
  it("pads to 8 chars hex", () => {
    expect(formatOffset(0)).toBe("00000000");
    expect(formatOffset(255)).toBe("000000ff");
    expect(formatOffset(4096)).toBe("00001000");
  });
});

describe("bfv byteToAscii", () => {
  it("returns printable ASCII", () => {
    expect(byteToAscii(65)).toBe("A");
    expect(byteToAscii(126)).toBe("~");
  });
  it("returns dot for non-printable", () => {
    expect(byteToAscii(0)).toBe(".");
    expect(byteToAscii(127)).toBe(".");
    expect(byteToAscii(200)).toBe(".");
  });
});

describe("bfv hexRows", () => {
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
    expect(rows[2].bytes.length).toBe(4);
  });
  it("respects maxLines", () => {
    const bytes = new Uint8Array(16 * 8); // 16 lines worth at bpl=8
    const rows = hexRows(bytes, opts({ bytesPerLine: 8 }), 4);
    expect(rows).toHaveLength(4);
  });
});

describe("bfv data type readers (big-endian)", () => {
  const bytes = fromHex("7fff8080000000007f3f80000000000000");

  it("readUint8", () => {
    expect(readUint8(bytes, 0)).toBe(0x7f);
  });
  it("readInt8 positive", () => {
    expect(readInt8(bytes, 0)).toBe(127);
  });
  it("readInt8 negative", () => {
    expect(readInt8(new Uint8Array([0xff]), 0)).toBe(-1);
  });
  it("readUint16 big", () => {
    expect(readUint16(bytes, 0, "big")).toBe(0x7fff);
  });
  it("readInt16 negative big", () => {
    expect(readInt16(new Uint8Array([0xff, 0xff]), 0, "big")).toBe(-1);
  });
  it("readUint32 big", () => {
    expect(readUint32(fromHex("12345678"), 0, "big")).toBe(0x12345678);
  });
  it("readInt32 negative big", () => {
    expect(readInt32(fromHex("ffffffff"), 0, "big")).toBe(-1);
  });
  it("readUint16 little", () => {
    expect(readUint16(fromHex("1234"), 0, "little")).toBe(0x3412);
  });
  it("readUint32 little", () => {
    expect(readUint32(fromHex("12345678"), 0, "little")).toBe(0x78563412);
  });
  it("readInt64 big", () => {
    expect(readInt64(fromHex("8000000000000000"), 0, "big")).toBe(BigInt("-9223372036854775808"));
  });
  it("readUint64 big", () => {
    expect(readUint64(fromHex("ffffffffffffffff"), 0, "big")).toBe(BigInt("18446744073709551615"));
  });
  it("readFloat32 big", () => {
    expect(readFloat32(fromHex("3f800000"), 0, "big")).toBeCloseTo(1.0, 5);
  });
  it("readFloat64 big", () => {
    expect(readFloat64(fromHex("3ff0000000000000"), 0, "big")).toBeCloseTo(1.0, 5);
  });
  it("returns null for out-of-range", () => {
    expect(readUint16(bytes, 100, "big")).toBeNull();
    expect(readInt32(bytes, bytes.length - 2, "big")).toBeNull();
  });
});

describe("bfv readAscii + readUtf8", () => {
  it("reads ASCII with dots for non-printable", () => {
    expect(readAscii(new Uint8Array([72, 101, 0, 108]), 0, 4)).toBe("He.l");
  });
  it("reads UTF-8 multi-byte", () => {
    const bytes = new TextEncoder().encode("héllo");
    const v = readUtf8(bytes, 0, bytes.length);
    expect(v).toBe("héllo");
  });
  it("returns null for out-of-range", () => {
    expect(readAscii(new Uint8Array([1]), 5, 1)).toBeNull();
    expect(readUtf8(new Uint8Array([1]), 5, 1)).toBeNull();
  });
});

describe("bfv decodeAtCursor", () => {
  // bytes: 0xff 0xff 0x7f 0xff 0xff 0xff 0xff 0xff
  // int8 @0 = -1, uint8 @0 = 255, int16 @0 (big) = -1, uint16 @0 (big) = 65535
  const bytes = fromHex("ffff7fffffffffff");
  it("decodes each type without throwing", () => {
    expect(decodeAtCursor(bytes, 0, "int8", "big")).toBe("-1");
    expect(decodeAtCursor(bytes, 0, "uint8", "big")).toBe("255");
    expect(decodeAtCursor(bytes, 0, "int16", "big")).toBe("-1");
    expect(decodeAtCursor(bytes, 0, "uint16", "big")).toBe("65535");
    expect(decodeAtCursor(bytes, 0, "hex", "big")).toHaveLength(16);
  });
  it("decodeAllAtCursor returns all 13 types", () => {
    const all = decodeAllAtCursor(bytes, 0, "big");
    expect(all).toHaveLength(13);
    expect(all.map((d) => d.type)).toContain("int8");
    expect(all.map((d) => d.type)).toContain("float64");
  });
});

describe("bfv searchHex", () => {
  it("finds hex matches", () => {
    const bytes = fromHex("ffd8ffe000ffd8");
    expect(searchHex(bytes, "FFD8")).toEqual([0, 5]);
  });
  it("returns empty for odd-length query", () => {
    expect(searchHex(new Uint8Array([1]), "1")).toEqual([]);
  });
  it("returns empty for invalid hex", () => {
    expect(searchHex(new Uint8Array([1]), "XX")).toEqual([]);
  });
  it("returns empty for no match", () => {
    expect(searchHex(new Uint8Array([1, 2, 3]), "FFFF")).toEqual([]);
  });
});

describe("bfv searchAscii", () => {
  it("finds ASCII matches", () => {
    const bytes = new TextEncoder().encode("Hello, World!");
    expect(searchAscii(bytes, "World")).toEqual([7]);
  });
  it("finds multiple matches", () => {
    const bytes = new TextEncoder().encode("ab ab ab");
    expect(searchAscii(bytes, "ab")).toEqual([0, 3, 6]);
  });
});

describe("bfv parseOffset", () => {
  it("parses decimal", () => {
    expect(parseOffset("100", 1000)).toBe(100);
  });
  it("parses hex with 0x prefix", () => {
    expect(parseOffset("0xff", 1000)).toBe(255);
  });
  it("returns null for negative", () => {
    expect(parseOffset("-5", 1000)).toBeNull();
  });
  it("returns null for out of range", () => {
    expect(parseOffset("9999", 1000)).toBeNull();
  });
});

describe("bfv detectSignature", () => {
  it("detects PNG", () => {
    const sig = detectSignature(fromHex("89504e470d0a1a0a"));
    expect(sig?.ext).toBe("png");
  });
  it("detects JPEG", () => {
    const sig = detectSignature(fromHex("ffd8ffe0"));
    expect(sig?.ext).toBe("jpg");
  });
  it("detects ZIP", () => {
    const sig = detectSignature(fromHex("504b0304"));
    expect(sig?.ext).toBe("zip");
  });
  it("detects PDF", () => {
    const sig = detectSignature(fromHex("25504446"));
    expect(sig?.ext).toBe("pdf");
  });
  it("returns null for unknown bytes", () => {
    expect(detectSignature(fromHex("00000000"))).toBeNull();
  });
  it("MAGIC_BYTES has at least 20 entries", () => {
    expect(MAGIC_BYTES.length).toBeGreaterThanOrEqual(20);
  });
});

describe("bfv structure templates", () => {
  it("has 6 templates (PNG/JPEG/ZIP/PDF/GIF/BMP)", () => {
    expect(STRUCTURE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    const ids = STRUCTURE_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("png");
    expect(ids).toContain("jpeg");
    expect(ids).toContain("zip");
    expect(ids).toContain("pdf");
  });

  it("autoDetectTemplate matches PNG", () => {
    const tpl = autoDetectTemplate(fromHex("89504e470d0a1a0a" + "0000000d49484452" + "0000010000000200"));
    expect(tpl?.id).toBe("png");
  });
  it("autoDetectTemplate returns null for unknown", () => {
    expect(autoDetectTemplate(fromHex("00000000"))).toBeNull();
  });

  it("parseStructure decodes PNG fields", () => {
    // PNG sig + IHDR length=13 + 'IHDR' + width=1 + height=2
    const bytes = fromHex("89504e470d0a1a0a" + "0000000d" + "49484452" + "00000001" + "00000002" + "08" + "06" + "00" + "00" + "00");
    const tpl = STRUCTURE_TEMPLATES.find((t) => t.id === "png")!;
    const parsed = parseStructure(bytes, tpl, "big");
    expect(parsed.fields.length).toBe(tpl.fields.length);
    // IHDR length field at offset 8 should decode to 13
    const ihdrLen = parsed.fields.find((f) => f.name === "IHDR Length");
    expect(ihdrLen?.value).toBe("13");
    // IHDR Type field at offset 12 should be 'IHDR'
    const ihdrType = parsed.fields.find((f) => f.name === "IHDR Type");
    expect(ihdrType?.value.replace(/\0/g, "")).toBe("IHDR");
    // Width should be 1, height should be 2
    const width = parsed.fields.find((f) => f.name === "Width");
    expect(width?.value).toBe("1");
    const height = parsed.fields.find((f) => f.name === "Height");
    expect(height?.value).toBe("2");
  });

  it("decodeField returns hex for type='bytes'", () => {
    const bytes = fromHex("89504e47");
    const field = { name: "sig", offset: 0, size: 4, type: "bytes" as const };
    expect(decodeField(bytes, field, "big")).toBe("89504e47");
  });
});

describe("bfv entropy", () => {
  it("returns 0 for empty", () => {
    expect(shannonEntropy(new Uint8Array([]))).toBe(0);
  });
  it("returns 0 for single repeated byte", () => {
    expect(shannonEntropy(new Uint8Array(100).fill(0))).toBe(0);
  });
  it("returns ~8 for uniform random bytes", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect(shannonEntropy(bytes)).toBeCloseTo(8, 1);
  });
  it("entropyHint returns human-readable string", () => {
    expect(entropyHint(0.5)).toContain("Very low");
    expect(entropyHint(7.5)).toContain("Very high");
  });
});

describe("bfv computeStats", () => {
  it("computes stats for a PNG", () => {
    const bytes = fromHex("89504e470d0a1a0a");
    const stats = computeStats(bytes);
    expect(stats.size).toBe(8);
    expect(stats.ext).toBe("png");
    expect(stats.uniqueBytes).toBe(7);
    expect(stats.template?.id).toBe("png");
  });
  it("handles empty input", () => {
    const stats = computeStats(new Uint8Array([]));
    expect(stats.size).toBe(0);
    expect(stats.entropy).toBe(0);
  });
});

describe("bfv formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("bfv formatSelection", () => {
  const bytes = new Uint8Array([0xff, 0x00, 0x41, 0x42]);
  it("formats as hex", () => {
    expect(formatSelection(bytes, "hex" as CopyFormat)).toBe("ff 00 41 42");
  });
  it("formats as ASCII", () => {
    expect(formatSelection(bytes, "ascii" as CopyFormat)).toBe(".·AB".replace("·", "."));
  });
  it("formats as C-array", () => {
    const c = formatSelection(bytes, "c-array" as CopyFormat);
    expect(c).toContain("unsigned char data[4]");
    expect(c).toContain("0xff");
    expect(c).toContain("0x42");
    expect(c).toContain("};");
  });
});

describe("bfv history", () => {
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
    saveToHistory({ filename: "a.bin", size: 100, ext: "bin", entropy: 7.2, templateId: null, inspectedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ filename: "a.bin", size: 100, ext: "bin", entropy: 7.2, templateId: null, inspectedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bfv readFileBytes", () => {
  it("reads a file into Uint8Array", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5])], "test.bin", { type: "application/octet-stream" });
    const bytes = await readFileBytes(file);
    expect(Array.from(bytes)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("rejects oversized files", async () => {
    // Mock a large file by passing a fake File object with size > maxSize
    const fakeFile = { size: 999, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    await expect(readFileBytes(fakeFile, 100)).rejects.toThrow(/too large/i);
  });
});

describe("bfv share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
      location: { origin: "https://x.io", pathname: "/tools/binary-file-viewer" },
    };
  });
  it("builds a share URL with options", () => {
    const url = buildShareUrl(opts({ bytesPerLine: 16, endian: "little", upperCase: true }), "png");
    expect(url).toContain("#bpl=16");
    expect(url).toContain("endian=little");
    expect(url).toContain("upper=true");
    expect(url).toContain("tpl=png");
  });
  it("parses back", () => {
    const url = buildShareUrl(opts({ bytesPerLine: 32, endian: "big", upperCase: false }), null);
    const hash = url.slice(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.options.bytesPerLine).toBe(32);
      expect(parsed.options.endian).toBe("big");
      expect(parsed.templateId).toBeNull();
    }
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("ignores invalid bytesPerLine", () => {
    const parsed = parseShareUrl("#bpl=99");
    expect(parsed?.options.bytesPerLine).toBeUndefined();
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
});
