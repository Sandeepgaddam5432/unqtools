import { describe, it, expect, beforeEach } from "vitest";
import {
  FORMAT_INFO,
  PRECISION_ORDER,
  PRESETS,
  mask,
  getBit,
  toggleBit,
  toBinaryString,
  toHexString,
  parseBits,
  decodeFields,
  bigIntTimesPowerOfTwo,
  exactDecimalValue,
  parseDecimalString,
  parseHexFloat,
  formatHexFloat,
  decimalToBinary128Bits,
  parseInput,
  encodeBits,
  bitsToJsNumber,
  computeRoundingError,
  convert,
  convertAllPrecisions,
  nextUlp,
  prevUlp,
  subtractDecimalStrings,
  divideDecimalStrings,
  fractionToDecimalString,
  splitFieldBits,
  bitFieldLabel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Precision,
  type ValueClass,
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

describe("ieee-754 format constants", () => {
  it("has four precisions in order", () => {
    expect(PRECISION_ORDER).toEqual(["binary16", "binary32", "binary64", "binary128"]);
  });
  it("binary16 has 16 total bits, 5 exp, 10 mantissa, bias 15", () => {
    const f = FORMAT_INFO.binary16;
    expect(f.totalBits).toBe(16);
    expect(f.expBits).toBe(5);
    expect(f.mantBits).toBe(10);
    expect(f.bias).toBe(15);
  });
  it("binary32 has 32 total bits, 8 exp, 23 mantissa, bias 127", () => {
    const f = FORMAT_INFO.binary32;
    expect(f.totalBits).toBe(32);
    expect(f.expBits).toBe(8);
    expect(f.mantBits).toBe(23);
    expect(f.bias).toBe(127);
  });
  it("binary64 has 64 total bits, 11 exp, 52 mantissa, bias 1023", () => {
    const f = FORMAT_INFO.binary64;
    expect(f.totalBits).toBe(64);
    expect(f.expBits).toBe(11);
    expect(f.mantBits).toBe(52);
    expect(f.bias).toBe(1023);
  });
  it("binary128 has 128 total bits, 15 exp, 112 mantissa, bias 16383", () => {
    const f = FORMAT_INFO.binary128;
    expect(f.totalBits).toBe(128);
    expect(f.expBits).toBe(15);
    expect(f.mantBits).toBe(112);
    expect(f.bias).toBe(16383);
  });
  it("has at least 9 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(9);
  });
});

describe("ieee-754 bit helpers", () => {
  it("mask(n) returns n low bits set", () => {
    expect(mask(8)).toBe(0xFFn);
    expect(mask(0)).toBe(0n);
  });
  it("getBit returns LSB", () => {
    expect(getBit(0b1010n, 0)).toBe(0);
    expect(getBit(0b1010n, 1)).toBe(1);
    expect(getBit(0b1010n, 3)).toBe(1);
  });
  it("toggleBit flips a bit", () => {
    expect(toggleBit(0b1010n, 0)).toBe(0b1011n);
    expect(toggleBit(0b1010n, 1)).toBe(0b1000n);
  });
  it("toBinaryString pads to width", () => {
    expect(toBinaryString(0xAn, 8)).toBe("00001010");
    expect(toBinaryString(0n, 4)).toBe("0000");
  });
  it("toHexString pads to width", () => {
    expect(toHexString(0xAn, 16)).toBe("000A");
  });
  it("parseBits parses hex with 0x prefix", () => {
    expect(parseBits("0x3F80", 16)).toBe(0x3F80n);
  });
  it("parseBits parses binary with 0b prefix", () => {
    expect(parseBits("0b1010", 8)).toBe(0b1010n);
  });
  it("parseBits parses plain binary of exact width", () => {
    expect(parseBits("0011111000000000", 16)).toBe(0x3E00n);
  });
  it("parseBits parses decimal", () => {
    expect(parseBits("12345", 32)).toBe(12345n);
  });
});

describe("ieee-754 decodeFields & classification", () => {
  it("classifies positive zero", () => {
    const f = decodeFields(0x00000000n, "binary32");
    expect(f.class).toBe("zero");
    expect(f.sign).toBe(0);
  });
  it("classifies negative zero", () => {
    const f = decodeFields(0x80000000n, "binary32");
    expect(f.class).toBe("zero");
    expect(f.sign).toBe(1);
  });
  it("classifies positive infinity", () => {
    const f = decodeFields(0x7F800000n, "binary32");
    expect(f.class).toBe("inf");
    expect(f.sign).toBe(0);
  });
  it("classifies negative infinity", () => {
    const f = decodeFields(0xFF800000n, "binary32");
    expect(f.class).toBe("inf");
    expect(f.sign).toBe(1);
  });
  it("classifies quiet NaN (MSB of mantissa set)", () => {
    const f = decodeFields(0x7FC00000n, "binary32");
    expect(f.class).toBe("qnan");
  });
  it("classifies signaling NaN (MSB of mantissa clear)", () => {
    const f = decodeFields(0x7FA00000n, "binary32");
    expect(f.class).toBe("snan");
  });
  it("classifies subnormal", () => {
    const f = decodeFields(0x00000001n, "binary32");
    expect(f.class).toBe("subnormal");
    expect(f.unbiasedExp).toBe(-126);
  });
  it("classifies normal and computes unbiased exponent", () => {
    const f = decodeFields(0x3F800000n, "binary32");
    expect(f.class).toBe("normal");
    expect(f.sign).toBe(0);
    expect(f.exponent).toBe(127);
    expect(f.unbiasedExp).toBe(0);
    expect(f.mantissa).toBe(0n);
  });
});

describe("ieee-754 bigIntTimesPowerOfTwo", () => {
  it("computes 1 * 2^0 = 1", () => {
    expect(bigIntTimesPowerOfTwo(1n, 0n)).toBe("1");
  });
  it("computes 1 * 2^-1 = 0.5", () => {
    expect(bigIntTimesPowerOfTwo(1n, -1n)).toBe("0.5");
  });
  it("computes 1 * 2^-4 = 0.0625", () => {
    expect(bigIntTimesPowerOfTwo(1n, -4n)).toBe("0.0625");
  });
  it("computes 3 * 2^2 = 12", () => {
    expect(bigIntTimesPowerOfTwo(3n, 2n)).toBe("12");
  });
  it("handles negative mantissa", () => {
    expect(bigIntTimesPowerOfTwo(-5n, -1n)).toBe("-2.5");
  });
});

describe("ieee-754 parseDecimalString", () => {
  it("parses integer", () => {
    expect(parseDecimalString("42")).toEqual({ num: 42n, den: 1n, isZero: false, sign: 0 });
  });
  it("parses decimal with fractional part", () => {
    expect(parseDecimalString("1.5")).toEqual({ num: 15n, den: 10n, isZero: false, sign: 0 });
  });
  it("parses negative", () => {
    expect(parseDecimalString("-0.25")).toEqual({ num: 25n, den: 100n, isZero: false, sign: 1 });
  });
  it("parses scientific notation", () => {
    const r = parseDecimalString("1.5e2");
    expect(r.num).toBe(150n);
    expect(r.den).toBe(1n);
    expect(r.sign).toBe(0);
  });
  it("parses zero", () => {
    expect(parseDecimalString("0").isZero).toBe(true);
  });
  it("parses negative zero", () => {
    const r = parseDecimalString("-0");
    expect(r.isZero).toBe(true);
    expect(r.sign).toBe(1);
  });
});

describe("ieee-754 parseHexFloat", () => {
  it("parses 0x1.8p+3 = 12.0", () => {
    expect(parseHexFloat("0x1.8p+3")).toBe(12);
  });
  it("parses 0x1p+0 = 1.0", () => {
    expect(parseHexFloat("0x1p+0")).toBe(1);
  });
  it("parses 0xA.bp2 = 42.75", () => {
    expect(parseHexFloat("0xA.bp2")).toBeCloseTo(42.75, 10);
  });
  it("returns NaN for non-hex", () => {
    expect(Number.isNaN(parseHexFloat("1.5"))).toBe(true);
  });
});

describe("ieee-754 formatHexFloat", () => {
  it("formats 12.0 as 0x1.8p+3", () => {
    expect(formatHexFloat(12, "binary32")).toBe("0x1.8p+3");
  });
  it("formats 0 as 0x0p+0", () => {
    expect(formatHexFloat(0, "binary32")).toBe("0x0p+0");
  });
  it("formats Infinity", () => {
    expect(formatHexFloat(Infinity, "binary32")).toBe("Infinity");
  });
});

describe("ieee-754 parseInput", () => {
  it("parses empty", () => {
    expect(parseInput("").kind).toBe("empty");
  });
  it("parses inf", () => {
    const r = parseInput("inf");
    expect(r.kind).toBe("inf");
    expect(r.sign).toBe(0);
    expect(r.jsValue).toBe(Infinity);
  });
  it("parses -inf", () => {
    const r = parseInput("-inf");
    expect(r.kind).toBe("inf");
    expect(r.sign).toBe(1);
  });
  it("parses nan", () => {
    const r = parseInput("nan");
    expect(r.kind).toBe("nan");
  });
  it("parses decimal", () => {
    const r = parseInput("1.5");
    expect(r.kind).toBe("decimal");
    expect(r.sign).toBe(0);
    expect(r.jsValue).toBe(1.5);
  });
  it("parses hex float", () => {
    const r = parseInput("0x1.8p+3");
    expect(r.kind).toBe("hexfloat");
    expect(r.jsValue).toBe(12);
  });
});

describe("ieee-754 encodeBits for binary32", () => {
  it("encodes 1.0 as 0x3F800000", () => {
    const bits = encodeBits(parseInput("1.0"), "binary32");
    expect(bits).toBe(0x3F800000n);
  });
  it("encodes 0.1 as 0x3DCCCCCD", () => {
    const bits = encodeBits(parseInput("0.1"), "binary32");
    expect(bits).toBe(0x3DCCCCCDn);
  });
  it("encodes -1.5 as 0xBFC00000", () => {
    const bits = encodeBits(parseInput("-1.5"), "binary32");
    expect(bits).toBe(0xBFC00000n);
  });
  it("encodes 0 as 0x00000000", () => {
    const bits = encodeBits(parseInput("0"), "binary32");
    expect(bits).toBe(0x00000000n);
  });
  it("encodes -0 as 0x80000000", () => {
    const bits = encodeBits(parseInput("-0"), "binary32");
    expect(bits).toBe(0x80000000n);
  });
  it("encodes inf as 0x7F800000", () => {
    const bits = encodeBits(parseInput("inf"), "binary32");
    expect(bits).toBe(0x7F800000n);
  });
  it("encodes -inf as 0xFF800000", () => {
    const bits = encodeBits(parseInput("-inf"), "binary32");
    expect(bits).toBe(0xFF800000n);
  });
  it("encodes nan as 0x7FC00000 (qNaN)", () => {
    const bits = encodeBits(parseInput("nan"), "binary32");
    expect(bits).toBe(0x7FC00000n);
  });
});

describe("ieee-754 encodeBits for binary64", () => {
  it("encodes 1.0 as 0x3FF0000000000000", () => {
    const bits = encodeBits(parseInput("1.0"), "binary64");
    expect(bits).toBe(0x3FF0000000000000n);
  });
  it("encodes 0.1 as 0x3FB999999999999A", () => {
    const bits = encodeBits(parseInput("0.1"), "binary64");
    expect(bits).toBe(0x3FB999999999999An);
  });
  it("encodes 2.0 as 0x4000000000000000", () => {
    const bits = encodeBits(parseInput("2.0"), "binary64");
    expect(bits).toBe(0x4000000000000000n);
  });
  it("encodes 0.5 as 0x3FE0000000000000", () => {
    const bits = encodeBits(parseInput("0.5"), "binary64");
    expect(bits).toBe(0x3FE0000000000000n);
  });
  it("encodes -0 as 0x8000000000000000", () => {
    const bits = encodeBits(parseInput("-0"), "binary64");
    expect(bits).toBe(0x8000000000000000n);
  });
});

describe("ieee-754 encodeBits for binary16", () => {
  it("encodes 1.0 as 0x3C00", () => {
    const bits = encodeBits(parseInput("1.0"), "binary16");
    expect(bits).toBe(0x3C00n);
  });
  it("encodes 1.5 as 0x3E00", () => {
    const bits = encodeBits(parseInput("1.5"), "binary16");
    expect(bits).toBe(0x3E00n);
  });
  it("encodes -1.5 as 0xBE00", () => {
    const bits = encodeBits(parseInput("-1.5"), "binary16");
    expect(bits).toBe(0xBE00n);
  });
  it("encodes inf as 0x7C00", () => {
    const bits = encodeBits(parseInput("inf"), "binary16");
    expect(bits).toBe(0x7C00n);
  });
  it("encodes nan as 0x7E00 (qNaN)", () => {
    const bits = encodeBits(parseInput("nan"), "binary16");
    expect(bits).toBe(0x7E00n);
  });
  it("encodes -0 as 0x8000", () => {
    const bits = encodeBits(parseInput("-0"), "binary16");
    expect(bits).toBe(0x8000n);
  });
});

describe("ieee-754 encodeBits for binary128", () => {
  it("encodes 1.0 as 0x3FFF0000000000000000000000000000", () => {
    const bits = encodeBits(parseInput("1.0"), "binary128");
    expect(bits).toBe(0x3FFF0000000000000000000000000000n);
  });
  it("encodes 0.5 as 0x3FFE0000000000000000000000000000", () => {
    const bits = encodeBits(parseInput("0.5"), "binary128");
    expect(bits).toBe(0x3FFE0000000000000000000000000000n);
  });
  it("encodes 2.0 as 0x40000000000000000000000000000000", () => {
    const bits = encodeBits(parseInput("2.0"), "binary128");
    expect(bits).toBe(0x40000000000000000000000000000000n);
  });
  it("encodes 0.1 as 0x3FFB999999999999999999999999999A", () => {
    const bits = encodeBits(parseInput("0.1"), "binary128");
    expect(bits).toBe(0x3FFB999999999999999999999999999An);
  });
  it("encodes inf as 0x7FFF0000000000000000000000000000", () => {
    const bits = encodeBits(parseInput("inf"), "binary128");
    expect(bits).toBe(0x7FFF0000000000000000000000000000n);
  });
  it("encodes nan as 0x7FFF8000000000000000000000000000 (qNaN)", () => {
    const bits = encodeBits(parseInput("nan"), "binary128");
    expect(bits).toBe(0x7FFF8000000000000000000000000000n);
  });
  it("encodes 0 as zero", () => {
    const bits = encodeBits(parseInput("0"), "binary128");
    expect(bits).toBe(0n);
  });
});

describe("ieee-754 exactDecimalValue", () => {
  it("exact value of 0.1 in binary64", () => {
    const bits = 0x3FB999999999999An;
    expect(exactDecimalValue(bits, "binary64")).toBe("0.1000000000000000055511151231257827021181583404541015625");
  });
  it("exact value of 1.0 in binary64", () => {
    expect(exactDecimalValue(0x3FF0000000000000n, "binary64")).toBe("1");
  });
  it("exact value of 0.5 in binary128", () => {
    expect(exactDecimalValue(0x3FFE0000000000000000000000000000n, "binary128")).toBe("0.5");
  });
  it("exact value of inf is Infinity", () => {
    expect(exactDecimalValue(0x7F800000n, "binary32")).toBe("Infinity");
  });
  it("exact value of -inf is -Infinity", () => {
    expect(exactDecimalValue(0xFF800000n, "binary32")).toBe("-Infinity");
  });
  it("exact value of NaN", () => {
    expect(exactDecimalValue(0x7FC00000n, "binary32")).toBe("NaN");
  });
  it("exact value of -0 in binary32", () => {
    expect(exactDecimalValue(0x80000000n, "binary32")).toBe("-0");
  });
  it("exact value of smallest binary32 subnormal", () => {
    // 2^-149 has 149 fractional digits in its exact decimal expansion.
    const v = exactDecimalValue(0x00000001n, "binary32");
    expect(v.startsWith("0.0000000000000000000000000000000000000000000014012984643248170")).toBe(true);
    expect(v.endsWith("212158203125")).toBe(true);
    expect(v.length).toBe(151); // "0." + 149 digits
  });
});

describe("ieee-754 bitsToJsNumber round-trip", () => {
  it("round-trips binary32 of 1.0", () => {
    const bits = 0x3F800000n;
    expect(bitsToJsNumber(bits, "binary32")).toBe(1);
  });
  it("round-trips binary16 of 1.5", () => {
    const bits = 0x3E00n;
    expect(bitsToJsNumber(bits, "binary16")).toBe(1.5);
  });
  it("round-trips binary64 of 0.5", () => {
    const bits = 0x3FE0000000000000n;
    expect(bitsToJsNumber(bits, "binary64")).toBe(0.5);
  });
  it("round-trips binary128 of 1.0 via parseFloat", () => {
    const bits = 0x3FFF0000000000000000000000000000n;
    expect(bitsToJsNumber(bits, "binary128")).toBe(1);
  });
});

describe("ieee-754 convert (top-level)", () => {
  it("converts 1.0 at binary32 with all fields", () => {
    const r = convert("1.0", "binary32");
    expect(r.precision).toBe("binary32");
    expect(r.hex).toBe("3F800000");
    expect(r.binary).toBe("00111111100000000000000000000000");
    expect(r.fields.sign).toBe(0);
    expect(r.fields.exponent).toBe(127);
    expect(r.fields.mantissa).toBe(0n);
    expect(r.fields.class).toBe("normal");
    expect(r.storedValue).toBe("1");
  });
  it("converts 0.1 at binary64 with exact stored value", () => {
    const r = convert("0.1", "binary64");
    expect(r.hex).toBe("3FB999999999999A");
    expect(r.storedValue).toBe("0.1000000000000000055511151231257827021181583404541015625");
    expect(r.roundingError.absolute).not.toBe("0");
  });
  it("converts inf at binary16", () => {
    const r = convert("inf", "binary16");
    expect(r.fields.class).toBe("inf");
    expect(r.hex).toBe("7C00");
  });
  it("converts nan at binary64", () => {
    const r = convert("nan", "binary64");
    expect(r.fields.class).toBe("qnan");
    expect(r.hex).toBe("7FF8000000000000");
  });
});

describe("ieee-754 convertAllPrecisions", () => {
  it("returns all four precisions", () => {
    const all = convertAllPrecisions("1.0");
    expect(Object.keys(all)).toHaveLength(4);
    expect(all.binary16.hex).toBe("3C00");
    expect(all.binary32.hex).toBe("3F800000");
    expect(all.binary64.hex).toBe("3FF0000000000000");
    expect(all.binary128.hex).toBe("3FFF0000000000000000000000000000");
  });
});

describe("ieee-754 computeRoundingError", () => {
  it("returns 0 for exact representable values", () => {
    const bits = encodeBits(parseInput("1.0"), "binary32");
    const err = computeRoundingError("1.0", bits, "binary32");
    expect(err.absolute).toBe("0");
    expect(err.relative).toBe("0");
  });
  it("returns non-zero for 0.1 in binary32", () => {
    const bits = encodeBits(parseInput("0.1"), "binary32");
    const err = computeRoundingError("0.1", bits, "binary32");
    expect(err.absolute).not.toBe("0");
    expect(err.relative).not.toBe(null);
  });
  it("returns null relative for inf", () => {
    const bits = encodeBits(parseInput("inf"), "binary32");
    const err = computeRoundingError("inf", bits, "binary32");
    expect(err.relative).toBe(null);
  });
});

describe("ieee-754 ULP stepping", () => {
  it("nextUlp of 1.0 in binary32 increments by 1 ULP", () => {
    const bits = 0x3F800000n;
    const next = nextUlp(bits, "binary32");
    expect(next).toBe(0x3F800001n);
  });
  it("prevUlp of 1.0+ULP in binary32 returns 1.0", () => {
    const bits = 0x3F800001n;
    const prev = prevUlp(bits, "binary32");
    expect(prev).toBe(0x3F800000n);
  });
  it("prevUlp of 0 stays at 0", () => {
    expect(prevUlp(0n, "binary32")).toBe(0n);
  });
  it("nextUlp of all-ones stays at all-ones", () => {
    const max = (1n << 32n) - 1n;
    expect(nextUlp(max, "binary32")).toBe(max);
  });
});

describe("ieee-754 decimal arithmetic", () => {
  it("subtracts 0.1 from 0.2", () => {
    const r = subtractDecimalStrings("0.2", "0.1");
    expect(r).toBe("0.1");
  });
  it("subtracts stored from input for 0.1 binary64", () => {
    const bits = encodeBits(parseInput("0.1"), "binary64");
    const stored = exactDecimalValue(bits, "binary64");
    const diff = subtractDecimalStrings("0.1", stored);
    expect(diff.startsWith("-")).toBe(true);
    expect(diff.length).toBeGreaterThan(20);
  });
  it("divides 1 by 3 to 100 digits", () => {
    const r = divideDecimalStrings("1", "3");
    expect(r.startsWith("0.3333")).toBe(true);
    expect(r.length).toBeGreaterThan(50);
  });
  it("fractionToDecimalString handles zero", () => {
    expect(fractionToDecimalString(0n, 5n)).toBe("0");
  });
});

describe("ieee-754 splitFieldBits", () => {
  it("splits binary32 of 1.0 into sign/exp/mantissa", () => {
    const f = splitFieldBits(0x3F800000n, "binary32");
    expect(f.sign).toBe("0");
    expect(f.exponent).toBe("01111111");
    expect(f.mantissa).toBe("00000000000000000000000");
  });
  it("splits binary16 of -1.5", () => {
    const f = splitFieldBits(0xBE00n, "binary16");
    expect(f.sign).toBe("1");
    expect(f.exponent).toBe("01111");
    expect(f.mantissa).toBe("1000000000");
  });
  it("bitFieldLabel identifies sign / exp / mantissa", () => {
    expect(bitFieldLabel(31, "binary32")).toBe("sign");
    expect(bitFieldLabel(30, "binary32")).toBe("exponent");
    expect(bitFieldLabel(22, "binary32")).toBe("mantissa");
  });
});

describe("ieee-754 history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "1.0", precision: "binary32", hex: "3F800000", class: "normal" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: `${i}.0`, precision: "binary32", hex: "00000000", class: "normal" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "1.0", precision: "binary32", hex: "3F800000", class: "normal" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ieee-754 shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("0.1", "binary64");
    expect(url).toContain("v=0.1");
    expect(url).toContain("p=binary64");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("v=0.1&p=binary64");
    expect(p.input).toBe("0.1");
    expect(p.precision).toBe("binary64");
  });
  it("handles empty hash with default precision", () => {
    const p = parseShareUrl("");
    expect(p.input).toBe("");
    expect(p.precision).toBe("binary32");
  });
  it("filters unknown precision", () => {
    const p = parseShareUrl("v=1.0&p=binary256");
    expect(p.precision).toBe("binary32");
  });
});

// Suppress unused-import lint
export type _Unused = Precision | ValueClass;
