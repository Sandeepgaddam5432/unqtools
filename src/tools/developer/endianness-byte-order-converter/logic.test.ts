import { describe, it, expect, beforeEach } from "vitest";
import {
  WORD_SIZES,
  ENDIANNESS_LABELS,
  ENDIANNESS_SHORT,
  parseHexInput,
  parseInteger,
  bytesBEToBigInt,
  bigIntToBytesBE,
  maskToWidth,
  asSigned,
  reverseBytes,
  toPdpBytes,
  convertEndiannessBytes,
  decodeAsFloat32,
  decodeAsFloat64,
  encodeAsFloat32,
  encodeAsFloat64,
  convertEndianness,
  batchConvert,
  groupBytes,
  formatCArray,
  buildByteCells,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WordSize,
  type Endianness,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("endianness-byte-order-converter constants", () => {
  it("exposes 3 word sizes", () => {
    expect(WORD_SIZES).toEqual([16, 32, 64]);
  });
  it("has labels for all endiannesses", () => {
    expect(ENDIANNESS_LABELS.be).toMatch(/Big-endian/);
    expect(ENDIANNESS_LABELS.le).toMatch(/Little-endian/);
    expect(ENDIANNESS_LABELS.pdp).toMatch(/Middle-endian|PDP/);
  });
  it("has short codes for endiannesses", () => {
    expect(ENDIANNESS_SHORT.be).toBe("BE");
    expect(ENDIANNESS_SHORT.le).toBe("LE");
    expect(ENDIANNESS_SHORT.pdp).toBe("PDP");
  });
});

describe("endianness-byte-order-converter parseHexInput", () => {
  it("parses simple hex string", () => {
    expect(parseHexInput("0A0B0C0D")).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
  });
  it("parses with 0x prefix", () => {
    expect(parseHexInput("0x0A0B")).toEqual([0x0A, 0x0B]);
  });
  it("parses with separators (space, colon, dash)", () => {
    expect(parseHexInput("0A 0B:0C-0D")).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
    expect(parseHexInput("0A_0B_0C_0D")).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
  });
  it("accepts lowercase hex", () => {
    expect(parseHexInput("deadbeef")).toEqual([0xDE, 0xAD, 0xBE, 0xEF]);
  });
  it("throws on empty input", () => {
    expect(() => parseHexInput("")).toThrow();
    expect(() => parseHexInput("   ")).toThrow();
  });
  it("throws on odd-length hex", () => {
    expect(() => parseHexInput("ABC")).toThrow(/odd/i);
  });
  it("throws on invalid hex characters", () => {
    expect(() => parseHexInput("0xZZ")).toThrow(/invalid/i);
  });
});

describe("endianness-byte-order-converter parseInteger", () => {
  it("parses decimal", () => { expect(parseInteger("255")).toBe(255n); });
  it("parses hex with 0x", () => { expect(parseInteger("0xff")).toBe(255n); });
  it("parses binary with 0b", () => { expect(parseInteger("0b1010")).toBe(10n); });
  it("parses octal with 0o", () => { expect(parseInteger("0o17")).toBe(15n); });
  it("handles negatives", () => { expect(parseInteger("-1")).toBe(-1n); });
  it("throws on empty", () => { expect(() => parseInteger("")).toThrow(); });
});

describe("endianness-byte-order-converter bytesBEToBigInt", () => {
  it("converts BE bytes to bigint", () => {
    expect(bytesBEToBigInt([0x0A, 0x0B, 0x0C, 0x0D])).toBe(0x0A0B0C0Dn);
    expect(bytesBEToBigInt([0xFF, 0xFF, 0xFF, 0xFF])).toBe(0xFFFFFFFFn);
  });
  it("empty bytes = 0", () => {
    expect(bytesBEToBigInt([])).toBe(0n);
  });
});

describe("endianness-byte-order-converter bigIntToBytesBE", () => {
  it("converts bigint to BE bytes (padded)", () => {
    expect(bigIntToBytesBE(0x0A0B0C0Dn, 4)).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
    expect(bigIntToBytesBE(0xFFn, 4)).toEqual([0x00, 0x00, 0x00, 0xFF]);
  });
  it("zero-pads 64-bit", () => {
    expect(bigIntToBytesBE(0x100000000n, 8)).toEqual([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
  });
  it("throws on overflow", () => {
    expect(() => bigIntToBytesBE(0x100n, 1)).toThrow(/exceeds/);
  });
  it("throws on negative", () => {
    expect(() => bigIntToBytesBE(-1n, 4)).toThrow(/non-negative/);
  });
});

describe("endianness-byte-order-converter maskToWidth", () => {
  it("masks to 16-bit", () => {
    expect(maskToWidth(0x1FFFn, 16)).toBe(0x1FFFn); // 0x1FFF < 0xFFFF, unchanged
    expect(maskToWidth(0x1FFFFn, 16)).toBe(0xFFFFn); // truncate high bit
    expect(maskToWidth(0xFFFFn, 16)).toBe(0xFFFFn);
  });
  it("masks to 64-bit", () => {
    const big = (1n << 64n) - 1n;
    expect(maskToWidth((1n << 70n), 64)).toBe(0n); // top bits truncated
    expect(maskToWidth(big, 64)).toBe(big);
  });
});

describe("endianness-byte-order-converter asSigned", () => {
  it("reinterprets 0xFFFF as -1 at 16-bit", () => {
    expect(asSigned(0xFFFFn, 16)).toBe(-1n);
  });
  it("leaves positive values alone", () => {
    expect(asSigned(0x7FFFn, 16)).toBe(0x7FFFn);
  });
  it("reinterprets 0x80000000 as -2147483648 at 32-bit", () => {
    expect(asSigned(0x80000000n, 32)).toBe(-2147483648n);
  });
  it("reinterprets 64-bit high bit set", () => {
    expect(asSigned((1n << 63n), 64)).toBe(-(1n << 63n));
  });
});

describe("endianness-byte-order-converter reverseBytes", () => {
  it("reverses bytes", () => {
    expect(reverseBytes([0x0A, 0x0B, 0x0C, 0x0D])).toEqual([0x0D, 0x0C, 0x0B, 0x0A]);
  });
  it("does not mutate input", () => {
    const arr = [0x0A, 0x0B];
    reverseBytes(arr);
    expect(arr).toEqual([0x0A, 0x0B]);
  });
});

describe("endianness-byte-order-converter toPdpBytes", () => {
  it("PDP for 16-bit = LE (reverse)", () => {
    expect(toPdpBytes([0x0A, 0x0B])).toEqual([0x0B, 0x0A]);
  });
  it("PDP for 32-bit swaps halves within 16-bit words", () => {
    // [b0,b1,b2,b3] → [b1,b0,b3,b2]
    expect(toPdpBytes([0x0A, 0x0B, 0x0C, 0x0D])).toEqual([0x0B, 0x0A, 0x0D, 0x0C]);
  });
  it("PDP for 64-bit swaps each 32-bit word's 16-bit halves", () => {
    const input = [0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11];
    const expected = [0x0B, 0x0A, 0x0D, 0x0C, 0x0F, 0x0E, 0x11, 0x10];
    expect(toPdpBytes(input)).toEqual(expected);
  });
  it("PDP for general 4-byte-aligned array", () => {
    expect(toPdpBytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]))
      .toEqual([0x02, 0x01, 0x04, 0x03, 0x06, 0x05, 0x08, 0x07]);
  });
});

describe("endianness-byte-order-converter convertEndiannessBytes", () => {
  it("BE → LE reverses bytes", () => {
    expect(convertEndiannessBytes([0x0A, 0x0B, 0x0C, 0x0D], "be", "le"))
      .toEqual([0x0D, 0x0C, 0x0B, 0x0A]);
  });
  it("BE → PDP for 32-bit", () => {
    expect(convertEndiannessBytes([0x0A, 0x0B, 0x0C, 0x0D], "be", "pdp"))
      .toEqual([0x0B, 0x0A, 0x0D, 0x0C]);
  });
  it("LE → PDP for 32-bit", () => {
    // LE bytes [0D,0C,0B,0A] = value 0x0A0B0C0D. PDP bytes of 0x0A0B0C0D = [0B,0A,0D,0C]
    expect(convertEndiannessBytes([0x0D, 0x0C, 0x0B, 0x0A], "le", "pdp"))
      .toEqual([0x0B, 0x0A, 0x0D, 0x0C]);
  });
  it("same endianness returns copy", () => {
    const out = convertEndiannessBytes([0x0A, 0x0B], "be", "be");
    expect(out).toEqual([0x0A, 0x0B]);
    expect(out).not.toBe([0x0A, 0x0B]); // not the same reference
  });
});

describe("endianness-byte-order-converter float decode/encode", () => {
  it("decodes float32 BE", () => {
    // 0x3F800000 = 1.0
    expect(decodeAsFloat32([0x3F, 0x80, 0x00, 0x00], "be")).toBeCloseTo(1.0, 7);
  });
  it("decodes float32 LE", () => {
    // 0x3F800000 in LE bytes = [00,00,80,3F]
    expect(decodeAsFloat32([0x00, 0x00, 0x80, 0x3F], "le")).toBeCloseTo(1.0, 7);
  });
  it("decodes float64 BE", () => {
    // 0x3FF0000000000000 = 1.0
    expect(decodeAsFloat64([0x3F, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], "be")).toBeCloseTo(1.0, 15);
  });
  it("encodes float32 BE round-trip", () => {
    const bytes = encodeAsFloat32(1.5, "be");
    expect(decodeAsFloat32(bytes, "be")).toBeCloseTo(1.5, 7);
  });
  it("encodes float64 LE round-trip", () => {
    const bytes = encodeAsFloat64(3.14159, "le");
    expect(decodeAsFloat64(bytes, "le")).toBeCloseTo(3.14159, 10);
  });
  it("returns null for wrong byte count", () => {
    expect(decodeAsFloat32([0x3F, 0x80], "be")).toBeNull();
    expect(decodeAsFloat64([0x3F, 0xF0, 0x00], "be")).toBeNull();
  });
  it("handles NaN/Infinity", () => {
    const nanBytes = encodeAsFloat32(NaN, "be");
    expect(Number.isNaN(decodeAsFloat32(nanBytes, "be"))).toBe(true);
    const infBytes = encodeAsFloat32(Infinity, "be");
    expect(decodeAsFloat32(infBytes, "be")).toBe(Infinity);
  });
});

describe("endianness-byte-order-converter convertEndianness (main)", () => {
  it("decodes 0x0A0B0C0D as BE/LE/PDP for 32-bit", () => {
    const r = convertEndianness([0x0A, 0x0B, 0x0C, 0x0D], 32);
    expect(r.bigEndian.asIntUnsigned).toBe("168496141");  // 0x0A0B0C0D
    expect(r.littleEndian.asIntUnsigned).toBe("218893066"); // 0x0D0C0B0A
    expect(r.pdpMiddle.asIntUnsigned).toBe("185208076");   // 0x0B0A0D0C
  });
  it("decodes signed 0xFFFF as -1 for 16-bit BE", () => {
    const r = convertEndianness([0xFF, 0xFF], 16);
    expect(r.bigEndian.asIntSigned).toBe("-1");
    expect(r.bigEndian.asIntUnsigned).toBe("65535");
  });
  it("decodes 0x8000 as -32768 for 16-bit BE (signed)", () => {
    const r = convertEndianness([0x80, 0x00], 16);
    expect(r.bigEndian.asIntSigned).toBe("-32768");
  });
  it("handles 64-bit values", () => {
    const r = convertEndianness([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0], 64);
    expect(r.bigEndian.asIntUnsigned).toBe("1311768467463790320");    // 0x123456789ABCDEF0
    expect(r.littleEndian.asIntUnsigned).toBe("17356517385562371090"); // 0xF0DEBC9A78563412
  });
  it("handles float32 decoding for 4-byte input", () => {
    const r = convertEndianness([0x3F, 0x80, 0x00, 0x00], 32);
    expect(r.bigEndian.asFloat32).toBeCloseTo(1.0, 7);
  });
  it("handles float64 decoding for 8-byte input", () => {
    const r = convertEndianness([0x3F, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 64);
    expect(r.bigEndian.asFloat64).toBeCloseTo(1.0, 15);
  });
  it("returns null float when byte count doesn't match", () => {
    const r = convertEndianness([0x3F, 0x80], 16);
    expect(r.bigEndian.asFloat32).toBeNull();
    expect(r.bigEndian.asFloat64).toBeNull();
  });
  it("pads short input (left-padded with zeros)", () => {
    const r = convertEndianness([0xCD], 32);
    expect(r.warnings.length).toBeGreaterThan(0);
    // Padded to [00,00,00,CD] = 0x000000CD
    expect(r.bigEndian.asIntUnsigned).toBe("205");           // 0x000000CD
    expect(r.littleEndian.asIntUnsigned).toBe("3439329280"); // 0xCD000000
  });
  it("truncates long input (keeps low bytes)", () => {
    const r = convertEndianness([0xAA, 0xBB, 0xCC, 0xDD, 0xEE], 32);
    expect(r.warnings.length).toBeGreaterThan(0);
    // 5 bytes → keep last 4 = [BB,CC,DD,EE]
    // BE = 0xBBCCDDEE = 3150765550
    expect(r.bigEndian.asIntUnsigned).toBe("3150765550");
  });
  it("errors on empty input", () => {
    const r = convertEndianness([], 32);
    expect(r.error).toBeDefined();
  });
  it("original bytes are the same across orderings (decode model)", () => {
    const r = convertEndianness([0x0A, 0x0B, 0x0C, 0x0D], 32);
    expect(r.bigEndian.bytes).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
    expect(r.littleEndian.bytes).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
    expect(r.pdpMiddle.bytes).toEqual([0x0A, 0x0B, 0x0C, 0x0D]);
  });
});

describe("endianness-byte-order-converter batchConvert", () => {
  it("splits byte array into words and converts each", () => {
    const r = batchConvert([0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F], 16);
    expect(r.words).toHaveLength(3);
    expect(r.words[0].bigEndian.asIntUnsigned).toBe("2571");  // 0x0A0B = 10*256+11
    expect(r.words[1].bigEndian.asIntUnsigned).toBe("3085");  // 0x0C0D = 12*256+13
    expect(r.words[2].bigEndian.asIntUnsigned).toBe("3599");  // 0x0E0F
  });
  it("warns on non-aligned input (zero-pads last word)", () => {
    const r = batchConvert([0x0A, 0x0B, 0x0C], 16);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.words).toHaveLength(2);
    // Second word was [0x0C, 0x00] after padding
    expect(r.words[1].bigEndian.asIntUnsigned).toBe("3072"); // 0x0C00
  });
  it("errors on empty input", () => {
    const r = batchConvert([], 16);
    expect(r.error).toBeDefined();
  });
});

describe("endianness-byte-order-converter display helpers", () => {
  it("groupBytes joins as space-separated hex pairs", () => {
    expect(groupBytes([0x0A, 0x0B, 0x0C, 0x0D])).toBe("0A 0B 0C 0D");
  });
  it("groupBytes with groupSize=2 groups pairs", () => {
    expect(groupBytes([0x0A, 0x0B, 0x0C, 0x0D], 2)).toBe("0A0B 0C0D");
  });
  it("formatCArray emits C array literal", () => {
    const c = formatCArray([0x0A, 0x0B], "data");
    expect(c).toContain("uint8_t data[2]");
    expect(c).toContain("0x0A");
    expect(c).toContain("0x0B");
    expect(c).toContain("};");
  });
  it("buildByteCells labels each byte with endianness roles", () => {
    const cells = buildByteCells([0x0A, 0x0B, 0x0C, 0x0D], 32);
    expect(cells).toHaveLength(4);
    expect(cells[0].endianRole.be).toBe("B3"); // first byte = MSB for BE
    expect(cells[0].endianRole.le).toBe("B0"); // first byte = LSB for LE
    expect(cells[0].endianRole.pdp).toBe("B1"); // PDP swap
    expect(cells[3].endianRole.be).toBe("B0");
    expect(cells[3].endianRole.le).toBe("B3");
  });
});

describe("endianness-byte-order-converter history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, inputHex: "0A0B0C0D", wordSize: 32, beUnsigned: "168496141", leUnsigned: "218893066" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].inputHex).toBe("0A0B0C0D");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, inputHex: String(i), wordSize: 16, beUnsigned: "0", leUnsigned: "0" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, inputHex: "0A", wordSize: 16, beUnsigned: "0", leUnsigned: "0" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("endianness-byte-order-converter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ inputHex: "0A0B0C0D", wordSize: 32 });
    expect(url).toContain("h=0A0B0C0D");
    expect(url).toContain("w=32");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("h=0A0B0C0D&w=64");
    expect(s?.inputHex).toBe("0A0B0C0D");
    expect(s?.wordSize).toBe(64);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("sanitizes invalid word size to default 32", () => {
    const s = parseShareUrl("h=0A&w=7");
    expect(s?.wordSize).toBe(32);
  });
  it("handles hash without # prefix", () => {
    const s = parseShareUrl("#h=0A0B&w=16");
    expect(s?.inputHex).toBe("0A0B");
    expect(s?.wordSize).toBe(16);
  });
});

// Suppress unused-import lint
export type _Unused = WordSize | Endianness;
