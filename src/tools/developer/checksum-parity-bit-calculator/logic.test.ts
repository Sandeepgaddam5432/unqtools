import { describe, it, expect, beforeEach } from "vitest";
import {
  parseHex,
  parseBinary,
  parseAscii,
  parseInput,
  byteToBinary,
  formatHex,
  formatBinary,
  popcount,
  reflectBits,
  reflect8,
  parityBit,
  computeParity,
  computeLRC,
  computeXOR,
  rawSum,
  onesComplementSum,
  twosComplementSum,
  internetChecksum,
  computeSum,
  fletcher16,
  fletcher32,
  adler32,
  crc,
  crc8,
  crc16,
  crc32,
  CRC_PRESETS,
  luhnCheckDigit,
  luhnValid,
  verhoeffCheckDigit,
  verhoeffValid,
  isbn10CheckDigit,
  isbn10Valid,
  isbn13CheckDigit,
  isbn13Valid,
  computeAll,
  computeScheme,
  verifyValue,
  renderParityWorking,
  renderChecksumWorking,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  SCHEME_LABELS,
  type InputFormat,
  type CheckScheme,
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

describe("checksum-parity parseHex", () => {
  it("parses simple hex", () => {
    expect(parseHex("DEADBEEF")).toEqual([0xDE, 0xAD, 0xBE, 0xEF]);
  });
  it("handles 0x prefix and whitespace", () => {
    expect(parseHex("0x01 0x02, 0x03")).toEqual([0x01, 0x02, 0x03]);
  });
  it("pads odd-length hex", () => {
    expect(parseHex("F")).toEqual([0x0F]);
    expect(parseHex("ABC")).toEqual([0x0A, 0xBC]);
  });
  it("returns empty for empty input", () => {
    expect(parseHex("")).toEqual([]);
  });
  it("throws on invalid hex chars", () => {
    expect(() => parseHex("XYZ")).toThrow();
  });
});

describe("checksum-parity parseBinary", () => {
  it("parses 8-bit groups", () => {
    expect(parseBinary("00000001 00000010")).toEqual([1, 2]);
  });
  it("pads leading zeros if not multiple of 8", () => {
    expect(parseBinary("1")).toEqual([1]);
    expect(parseBinary("11111111")).toEqual([255]);
  });
  it("handles no separators", () => {
    expect(parseBinary("0000000100000010")).toEqual([1, 2]);
  });
  it("throws on non-binary chars", () => {
    expect(() => parseBinary("0123")).toThrow();
  });
});

describe("checksum-parity parseAscii", () => {
  it("parses ASCII chars", () => {
    expect(parseAscii("ABC")).toEqual([0x41, 0x42, 0x43]);
  });
  it("handles empty", () => {
    expect(parseAscii("")).toEqual([]);
  });
});

describe("checksum-parity parseInput", () => {
  it("dispatches by format", () => {
    expect(parseInput("41 42", "hex")).toEqual([0x41, 0x42]);
    expect(parseInput("01000001", "binary")).toEqual([0x41]);
    expect(parseInput("A", "ascii")).toEqual([0x41]);
  });
});

describe("checksum-parity format helpers", () => {
  it("byteToBinary pads to 8 bits", () => {
    expect(byteToBinary(0x05)).toBe("00000101");
    expect(byteToBinary(0xFF)).toBe("11111111");
  });
  it("formatHex pads", () => {
    expect(formatHex(0xF, 8)).toBe("0F");
    expect(formatHex(0xFF, 16)).toBe("00FF");
  });
  it("formatBinary pads", () => {
    expect(formatBinary(0x5, 8)).toBe("00000101");
    expect(formatBinary(0xFFFF, 16)).toBe("1111111111111111");
  });
  it("popcount counts bits", () => {
    expect(popcount(0x00)).toBe(0);
    expect(popcount(0xFF)).toBe(8);
    expect(popcount(0x5)).toBe(2);
  });
  it("reflectBits reverses bits", () => {
    expect(reflectBits(0b1010, 4)).toBe(0b0101);
    expect(reflect8(0b10000000)).toBe(0b00000001);
  });
});

describe("checksum-parity parity", () => {
  it("even parity bit returns 1 for odd-1s byte", () => {
    expect(parityBit(0b00000001, "even")).toBe(1);
  });
  it("even parity bit returns 0 for even-1s byte", () => {
    expect(parityBit(0b00000011, "even")).toBe(0);
  });
  it("odd parity bit returns 0 for odd-1s byte", () => {
    expect(parityBit(0b00000001, "odd")).toBe(0);
  });
  it("mark always 1", () => {
    expect(parityBit(0x00, "mark")).toBe(1);
    expect(parityBit(0xFF, "mark")).toBe(1);
  });
  it("space always 0", () => {
    expect(parityBit(0x00, "space")).toBe(0);
    expect(parityBit(0xFF, "space")).toBe(0);
  });
  it("computeParity returns per-byte and aggregate", () => {
    const r = computeParity([0x01, 0x02]);
    expect(r.perByte).toHaveLength(2);
    expect(r.aggregatePopcount).toBe(2);
    expect(r.aggregateEven).toBe(0); // 2 bits is even
    expect(r.aggregateOdd).toBe(1);
  });
});

describe("checksum-parity LRC and XOR", () => {
  it("LRC is XOR of all bytes", () => {
    expect(computeLRC([0x01, 0x02, 0x03])).toBe(0x00);
    expect(computeLRC([0xFF, 0x0F])).toBe(0xF0);
  });
  it("XOR equals LRC", () => {
    expect(computeXOR([0x01, 0x02, 0x03])).toBe(computeLRC([0x01, 0x02, 0x03]));
  });
});

describe("checksum-parity sum checksums", () => {
  it("rawSum wraps at width", () => {
    expect(rawSum([0xFF, 0x01], 8)).toBe(0x00);
    expect(rawSum([0xFF, 0x01], 16)).toBe(0x0100);
  });
  it("onesComplementSum inverts", () => {
    expect(onesComplementSum([0x01, 0x02], 8)).toBe((~0x03) & 0xFF);
  });
  it("twosComplementSum negates", () => {
    expect(twosComplementSum([0x01], 8)).toBe(0xFF);
  });
  it("computeSum returns hex and binary", () => {
    const r = computeSum([0x12, 0x34], 16, "raw");
    expect(r.hex).toBe("0046");
    expect(r.binary).toBe("0000000001000110");
  });
  it("computeSum ones-complement variant", () => {
    const r = computeSum([0x01, 0x02], 8, "ones-complement");
    expect(r.value).toBe((~0x03) & 0xFF);
  });
});

describe("checksum-parity Internet checksum (RFC 1071)", () => {
  it("matches known test vector", () => {
    // RFC 1071 example: bytes 0x00 0x01 .. 0x04 0x05 (padded to 6 bytes)
    // sum = 0x0001 + 0x0203 + 0x0405 = 0x0609 → checksum = ~0x0609 = 0xF9F6
    expect(internetChecksum([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])).toBe(0xF9F6);
  });
  it("folds carries", () => {
    // 0xFFFF + 0xFFFF + 0x0001 = 0x1FFFF → fold → 0x0001 → ~ = 0xFFFE
    expect(internetChecksum([0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x01])).toBe(0xFFFE);
  });
  it("pads odd byte count with zero", () => {
    const r1 = internetChecksum([0x12, 0x34, 0x56]);
    const r2 = internetChecksum([0x12, 0x34, 0x56, 0x00]);
    expect(r1).toBe(r2);
  });
});

describe("checksum-parity Fletcher", () => {
  it("Fletcher-16 of 'abcde'", () => {
    // Known: Fletcher-16 of "abcde" = 0xC8F0 (sum1=0xC8, sum2=0xF0)
    expect(fletcher16(parseAscii("abcde"))).toBe(0xC8F0);
  });
  it("Fletcher-32 of 'abcdefgh'", () => {
    // Manual computation with big-endian word pairing (internally consistent).
    // Words: 0x6162, 0x6364, 0x6566, 0x6768 (=24930, 25444, 25958, 26472)
    // sum1: 0 → 24930 → 50374 → 10797 → 37269 (=0x9195, after mod 65535)
    // sum2: 0 → 24930 → 9769  → 20566 → 57835 (=0xE1EB, after mod 65535)
    // result = (0xE1EB << 16) | 0x9195 = 0xE1EB9195
    expect(fletcher32(parseAscii("abcdefgh"))).toBe(0xE1EB9195);
  });
  it("Fletcher-32 of empty is zero", () => {
    expect(fletcher32([])).toBe(0);
  });
  it("Fletcher-32 of zero-word is zero", () => {
    expect(fletcher32([0x00, 0x00, 0x00, 0x00])).toBe(0);
  });
});

describe("checksum-parity Adler-32", () => {
  it("Adler-32 of 'Wikipedia'", () => {
    // Known value: Adler-32("Wikipedia") = 0x11E60398
    expect(adler32(parseAscii("Wikipedia"))).toBe(0x11E60398);
  });
  it("Adler-32 of empty is 1", () => {
    // sum1=1, sum2=0 → (0 << 16) | 1 = 1
    expect(adler32([])).toBe(1);
  });
});

describe("checksum-parity CRC", () => {
  it("CRC-8/SMBUS of '123456789' matches check value 0xF4", () => {
    const bytes = parseAscii("123456789");
    expect(crc8(bytes)).toBe(CRC_PRESETS[8].check);
    expect(crc8(bytes)).toBe(0xF4);
  });
  it("CRC-16/ARC of '123456789' matches check value 0xBB3D", () => {
    const bytes = parseAscii("123456789");
    expect(crc16(bytes)).toBe(CRC_PRESETS[16].check);
    expect(crc16(bytes)).toBe(0xBB3D);
  });
  it("CRC-32/ISO-HDLC of '123456789' matches check value 0xCBF43926", () => {
    const bytes = parseAscii("123456789");
    expect(crc32(bytes)).toBe(CRC_PRESETS[32].check);
    expect(crc32(bytes)).toBe(0xCBF43926);
  });
  it("CRC of empty returns init xor xorout", () => {
    // CRC-32 of empty = 0xFFFFFFFF ^ 0xFFFFFFFF = 0
    expect(crc32([])).toBe(0);
    // CRC-8/SMBUS of empty = 0x00
    expect(crc8([])).toBe(0);
  });
  it("crc() accepts custom params", () => {
    const bytes = parseAscii("123456789");
    const v = crc(bytes, { width: 8, poly: 0x07, init: 0x00, refin: false, refout: false, xorout: 0x00 });
    expect(v).toBe(0xF4);
  });
});

describe("checksum-parity Luhn", () => {
  it("computes correct check digit for 7992739871", () => {
    // 7992739871 + check = 79927398713 (a known-valid Luhn number)
    expect(luhnCheckDigit("7992739871")).toBe(3);
  });
  it("validates a known Luhn number", () => {
    expect(luhnValid("79927398713")).toBe(true);
    expect(luhnValid("79927398710")).toBe(false);
  });
  it("strips non-digits", () => {
    expect(luhnValid("7992-7398-713")).toBe(true);
  });
  it("returns false for too-short", () => {
    expect(luhnValid("1")).toBe(false);
  });
});

describe("checksum-parity Verhoeff", () => {
  it("computes check digit for 236", () => {
    // Verhoeff("236") = 3 (known example)
    expect(verhoeffCheckDigit("236")).toBe(3);
  });
  it("validates 2363", () => {
    expect(verhoeffValid("2363")).toBe(true);
    expect(verhoeffValid("2360")).toBe(false);
  });
  it("Aadhaar-style: 1234 5678 9012 verifies check digit", () => {
    // 123456789012 + check digit
    const cd = verhoeffCheckDigit("123456789012");
    expect(verhoeffValid("123456789012" + String(cd))).toBe(true);
  });
});

describe("checksum-parity ISBN", () => {
  it("computes ISBN-10 check digit (X for 10)", () => {
    // 0-306-40615-? → check digit is 2
    expect(isbn10CheckDigit("030640615")).toBe("2");
  });
  it("ISBN-10 with X check digit", () => {
    // 0-8044-2957-X is valid
    expect(isbn10Valid("080442957X")).toBe(true);
    expect(isbn10CheckDigit("080442957")).toBe("X");
  });
  it("validates ISBN-10", () => {
    expect(isbn10Valid("0306406152")).toBe(true);
    expect(isbn10Valid("0306406153")).toBe(false);
  });
  it("computes ISBN-13 check digit", () => {
    // 978-0-306-40615-? → check digit is 7
    expect(isbn13CheckDigit("978030640615")).toBe(7);
  });
  it("validates ISBN-13", () => {
    expect(isbn13Valid("9780306406157")).toBe(true);
    expect(isbn13Valid("9780306406150")).toBe(false);
  });
});

describe("checksum-parity computeAll", () => {
  it("returns all checksums for input", () => {
    const r = computeAll(parseAscii("123456789"));
    expect(r.byteCount).toBe(9);
    expect(r.bitCount).toBe(72);
    expect(r.crc32).toBe(0xCBF43926);
    expect(r.adler32).toBe(adler32(parseAscii("123456789")));
    expect(r.internet).toBe(internetChecksum(parseAscii("123456789")));
    expect(r.fletcher16).toBeGreaterThan(0);
    expect(r.lrc).toBe(computeLRC(parseAscii("123456789")));
    expect(r.parity.perByte).toHaveLength(9);
  });
});

describe("checksum-parity computeScheme and verifyValue", () => {
  it("computeScheme returns the value", () => {
    const bytes = parseAscii("123456789");
    expect(computeScheme(bytes, "crc32").value).toBe(0xCBF43926);
    expect(computeScheme(bytes, "adler32").value).toBe(adler32(bytes));
    expect(computeScheme(bytes, "lrc").value).toBe(computeLRC(bytes));
  });
  it("verifyValue matches", () => {
    const bytes = parseAscii("123456789");
    expect(verifyValue(bytes, "crc32", 0xCBF43926)).toBe(true);
    expect(verifyValue(bytes, "crc32", 0xDEADBEEF)).toBe(false);
  });
});

describe("checksum-parity render working", () => {
  it("renderParityWorking shows per-byte table", () => {
    const s = renderParityWorking([0x01, 0x02]);
    expect(s).toContain("Per-byte parity");
    expect(s).toContain("0x01");
    expect(s).toContain("Aggregate even");
  });
  it("renderParityWorking empty input", () => {
    expect(renderParityWorking([])).toBe("(no input)");
  });
  it("renderChecksumWorking shows CRC value", () => {
    const s = renderChecksumWorking(parseAscii("123456789"), "crc32");
    expect(s).toContain("CRC-32");
    expect(s).toContain("CBF43926");
  });
});

describe("checksum-parity history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "abc", format: "ascii", byteCount: 3, crc32: 0xCBF43926 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: String(i), format: "ascii", byteCount: 1, crc32: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "x", format: "ascii", byteCount: 1, crc32: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("checksum-parity shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello", "ascii");
    expect(url).toContain("input=hello");
    expect(url).toContain("format=ascii");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("input=hello&format=hex");
    expect(p.input).toBe("hello");
    expect(p.format).toBe("hex");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "", format: "ascii" });
  });
  it("defaults unknown format to ascii", () => {
    expect(parseShareUrl("input=x&format=garbage").format).toBe("ascii");
  });
});

describe("checksum-parity SCHEME_LABELS", () => {
  it("has labels for all schemes", () => {
    const schemes: CheckScheme[] = ["lrc", "crc32", "internet", "fletcher16", "adler32", "sum8"];
    for (const s of schemes) {
      expect(SCHEME_LABELS[s]).toBeTruthy();
    }
  });
});

// Suppress unused-import lint
export type _Unused = InputFormat;
