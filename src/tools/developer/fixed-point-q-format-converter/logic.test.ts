import { describe, it, expect, beforeEach } from "vitest";
import {
  PRESETS,
  ROUNDING_LABELS,
  OVERFLOW_LABELS,
  MAX_TOTAL_BITS,
  MIN_M,
  MIN_N,
  isValidConfig,
  getFormatInfo,
  bigIntTimesPowerOfTwo,
  parseDecimalString,
  mask,
  getBit,
  toggleBit,
  toBinaryString,
  toHexString,
  signedToRaw,
  rawToSigned,
  parseRawInt,
  roundFraction,
  applyOverflow,
  realToQ,
  qToReal,
  subtractDecimalStrings,
  fractionToDecimalString,
  splitFieldBits,
  bitFieldLabel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QConfig,
  type RoundingMode,
  type OverflowMode,
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

describe("q-format constants & validation", () => {
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("has 3 rounding modes", () => {
    expect(Object.keys(ROUNDING_LABELS)).toHaveLength(3);
  });
  it("has 2 overflow modes", () => {
    expect(Object.keys(OVERFLOW_LABELS)).toHaveLength(2);
  });
  it("isValidConfig accepts Q1.15", () => {
    expect(isValidConfig({ m: 1, n: 15, signed: true })).toBe(true);
  });
  it("isValidConfig rejects m=0", () => {
    expect(isValidConfig({ m: 0, n: 15, signed: true })).toBe(false);
  });
  it("isValidConfig rejects n=-1", () => {
    expect(isValidConfig({ m: 1, n: -1, signed: true })).toBe(false);
  });
  it("isValidConfig rejects total > MAX_TOTAL_BITS", () => {
    expect(isValidConfig({ m: 1, n: MAX_TOTAL_BITS, signed: true })).toBe(false);
  });
  it("exposes MIN_M, MIN_N, MAX_TOTAL_BITS", () => {
    expect(MIN_M).toBe(1);
    expect(MIN_N).toBe(0);
    expect(MAX_TOTAL_BITS).toBeGreaterThan(64);
  });
});

describe("q-format getFormatInfo", () => {
  it("computes Q1.15 format info", () => {
    const info = getFormatInfo({ m: 1, n: 15, signed: true });
    expect(info.totalBits).toBe(16);
    expect(info.minRaw).toBe(-32768n);
    expect(info.maxRaw).toBe(32767n);
    expect(info.resolution).toBe("0.000030517578125"); // 2^-15
    expect(info.minValue).toBe("-1");
    expect(info.maxValue).toBe("0.999969482421875");
  });
  it("computes UQ8.8 format info (unsigned)", () => {
    const info = getFormatInfo({ m: 8, n: 8, signed: false });
    expect(info.totalBits).toBe(16);
    expect(info.minRaw).toBe(0n);
    expect(info.maxRaw).toBe(65535n);
    expect(info.resolution).toBe("0.00390625"); // 2^-8
    expect(info.minValue).toBe("0");
    expect(info.maxValue).toBe("255.99609375");
  });
  it("computes Q1.31 format info", () => {
    const info = getFormatInfo({ m: 1, n: 31, signed: true });
    expect(info.totalBits).toBe(32);
    expect(info.minRaw).toBe(-2147483648n);
    expect(info.maxRaw).toBe(2147483647n);
  });
  it("handles n=0 (pure integer)", () => {
    const info = getFormatInfo({ m: 8, n: 0, signed: true });
    expect(info.totalBits).toBe(8);
    expect(info.resolution).toBe("1");
    expect(info.minValue).toBe("-128");
    expect(info.maxValue).toBe("127");
  });
});

describe("q-format bigIntTimesPowerOfTwo", () => {
  it("computes 1 * 2^0 = 1", () => {
    expect(bigIntTimesPowerOfTwo(1n, 0n)).toBe("1");
  });
  it("computes 1 * 2^-4 = 0.0625", () => {
    expect(bigIntTimesPowerOfTwo(1n, -4n)).toBe("0.0625");
  });
  it("computes 3 * 2^-15 = 0.000091552734375", () => {
    expect(bigIntTimesPowerOfTwo(3n, -15n)).toBe("0.000091552734375");
  });
  it("handles negative values", () => {
    expect(bigIntTimesPowerOfTwo(-5n, -1n)).toBe("-2.5");
  });
});

describe("q-format parseDecimalString", () => {
  it("parses 1.5", () => {
    expect(parseDecimalString("1.5")).toEqual({ num: 15n, den: 10n, isZero: false, sign: 0 });
  });
  it("parses -0.25", () => {
    expect(parseDecimalString("-0.25")).toEqual({ num: 25n, den: 100n, isZero: false, sign: 1 });
  });
  it("parses scientific notation 1.5e2 = 150", () => {
    const r = parseDecimalString("1.5e2");
    expect(r.num).toBe(150n);
    expect(r.den).toBe(1n);
  });
  it("parses 0", () => {
    expect(parseDecimalString("0").isZero).toBe(true);
  });
});

describe("q-format bit helpers", () => {
  it("mask returns low bits", () => {
    expect(mask(8)).toBe(0xFFn);
  });
  it("getBit returns bit value", () => {
    expect(getBit(0b1010n, 1)).toBe(1);
    expect(getBit(0b1010n, 0)).toBe(0);
  });
  it("toggleBit flips a bit", () => {
    expect(toggleBit(0b1010n, 0)).toBe(0b1011n);
    expect(toggleBit(0b1010n, 1)).toBe(0b1000n);
  });
  it("toBinaryString pads to width", () => {
    expect(toBinaryString(0xAn, 8)).toBe("00001010");
  });
  it("toHexString pads to width", () => {
    expect(toHexString(0xAn, 16)).toBe("000A");
  });
  it("signedToRaw / rawToSigned round-trip for positive", () => {
    const raw = signedToRaw(42n, 8);
    expect(raw).toBe(42n);
    expect(rawToSigned(raw, 8, true)).toBe(42n);
  });
  it("signedToRaw / rawToSigned round-trip for negative", () => {
    const raw = signedToRaw(-5n, 8);
    expect(raw).toBe(0xFBn); // 256 - 5 = 251
    expect(rawToSigned(raw, 8, true)).toBe(-5n);
  });
  it("signedToRaw / rawToSigned round-trip for -128 (min of 8-bit signed)", () => {
    const raw = signedToRaw(-128n, 8);
    expect(raw).toBe(0x80n);
    expect(rawToSigned(raw, 8, true)).toBe(-128n);
  });
});

describe("q-format parseRawInt", () => {
  it("parses hex", () => {
    expect(parseRawInt("0x7FFF", 16)).toBe(0x7FFFn);
  });
  it("parses binary with 0b prefix", () => {
    expect(parseRawInt("0b1010", 8)).toBe(0b1010n);
  });
  it("parses plain binary of exact width", () => {
    expect(parseRawInt("0111111111111111", 16)).toBe(0x7FFFn);
  });
  it("parses positive decimal", () => {
    expect(parseRawInt("32767", 16)).toBe(32767n);
  });
  it("parses negative decimal as two's-complement", () => {
    expect(parseRawInt("-1", 8)).toBe(0xFFn);
  });
  it("parses -32768 as 0x8000 in 16-bit", () => {
    expect(parseRawInt("-32768", 16)).toBe(0x8000n);
  });
});

describe("q-format roundFraction", () => {
  it("round-half-up: 0.5 → 1 (away from zero)", () => {
    expect(roundFraction(1n, 2n, "round-half-up")).toBe(1n);
  });
  it("round-half-up: -0.5 → -1 (away from zero)", () => {
    expect(roundFraction(-1n, 2n, "round-half-up")).toBe(-1n);
  });
  it("round-half-up: 1.5 → 2", () => {
    expect(roundFraction(3n, 2n, "round-half-up")).toBe(2n);
  });
  it("round-half-up: 2.5 → 3 (away from zero)", () => {
    expect(roundFraction(5n, 2n, "round-half-up")).toBe(3n);
  });
  it("round-to-even: 0.5 → 0 (even)", () => {
    expect(roundFraction(1n, 2n, "round-to-even")).toBe(0n);
  });
  it("round-to-even: 1.5 → 2 (even)", () => {
    expect(roundFraction(3n, 2n, "round-to-even")).toBe(2n);
  });
  it("round-to-even: 2.5 → 2 (even)", () => {
    expect(roundFraction(5n, 2n, "round-to-even")).toBe(2n);
  });
  it("round-to-even: -0.5 → 0 (even)", () => {
    expect(roundFraction(-1n, 2n, "round-to-even")).toBe(0n);
  });
  it("round-to-even: -1.5 → -2 (even)", () => {
    expect(roundFraction(-3n, 2n, "round-to-even")).toBe(-2n);
  });
  it("truncate: 0.5 → 0 (floor)", () => {
    expect(roundFraction(1n, 2n, "truncate")).toBe(0n);
  });
  it("truncate: -0.5 → -1 (floor)", () => {
    expect(roundFraction(-1n, 2n, "truncate")).toBe(-1n);
  });
  it("truncate: 1.5 → 1", () => {
    expect(roundFraction(3n, 2n, "truncate")).toBe(1n);
  });
  it("truncate: -1.5 → -2 (floor)", () => {
    expect(roundFraction(-3n, 2n, "truncate")).toBe(-2n);
  });
  it("no rounding needed for exact values", () => {
    expect(roundFraction(6n, 3n, "round-to-even")).toBe(2n);
  });
});

describe("q-format realToQ for Q1.15 (signed)", () => {
  const config: QConfig = { m: 1, n: 15, signed: true };
  it("converts 0.5 to raw 0x4000", () => {
    const r = realToQ("0.5", config, "round-to-even", "saturate");
    expect(r.rawInt).toBe(0x4000n);
    expect(r.rawSigned).toBe(0x4000n);
    expect(r.hex).toBe("4000");
    expect(r.reconstructed).toBe("0.5");
    expect(r.overflowed).toBe(false);
  });
  it("converts 0.1 to raw 0x0CCD with round-to-even", () => {
    const r = realToQ("0.1", config, "round-to-even", "saturate");
    expect(r.rawInt).toBe(0x0CCDn);
    expect(r.reconstructed).toBe("0.100006103515625");
    expect(r.quantError).toBe("-0.000006103515625");
  });
  it("converts 0.1 to raw 0x0CCD with round-half-up too (same result here)", () => {
    const r = realToQ("0.1", config, "round-half-up", "saturate");
    expect(r.rawInt).toBe(0x0CCDn);
  });
  it("converts -1.0 to raw 0x8000 (exact min)", () => {
    const r = realToQ("-1.0", config, "round-to-even", "saturate");
    expect(r.rawInt).toBe(0x8000n);
    expect(r.rawSigned).toBe(-32768n);
    expect(r.reconstructed).toBe("-1");
    expect(r.overflowed).toBe(false);
  });
  it("saturates 2.0 to 0x7FFF", () => {
    const r = realToQ("2.0", config, "round-to-even", "saturate");
    expect(r.rawInt).toBe(0x7FFFn);
    expect(r.overflowed).toBe(true);
    expect(r.reconstructed).toBe("0.999969482421875");
  });
  it("wraps 3.0 to 0x8000 (3*32768 mod 65536 = 32768)", () => {
    const r = realToQ("3.0", config, "round-to-even", "wrap");
    expect(r.rawInt).toBe(0x8000n);
    expect(r.rawSigned).toBe(-32768n);
    expect(r.overflowed).toBe(true);
    expect(r.reconstructed).toBe("-1");
  });
  it("truncate mode on 0.1 gives 0x0CCC (floor)", () => {
    const r = realToQ("0.1", config, "truncate", "saturate");
    expect(r.rawInt).toBe(0x0CCCn);
    expect(r.reconstructed).toBe("0.0999755859375");
  });
});

describe("q-format realToQ for UQ8.8 (unsigned)", () => {
  const config: QConfig = { m: 8, n: 8, signed: false };
  it("converts 1.5 to raw 0x0180", () => {
    const r = realToQ("1.5", config, "round-to-even", "saturate");
    expect(r.rawInt).toBe(0x0180n);
    expect(r.rawSigned).toBe(0x180n);
    expect(r.reconstructed).toBe("1.5");
    expect(r.overflowed).toBe(false);
  });
  it("saturates 300.0 to 0xFFFF (max)", () => {
    const r = realToQ("300.0", config, "round-to-even", "saturate");
    expect(r.rawInt).toBe(0xFFFFn);
    expect(r.overflowed).toBe(true);
    expect(r.reconstructed).toBe("255.99609375");
  });
  it("wraps 257.0 to 0x0100 (256 wraps to 0)", () => {
    const r = realToQ("257.0", config, "round-to-even", "wrap");
    expect(r.rawInt).toBe(0x0100n);
    expect(r.overflowed).toBe(true);
    expect(r.reconstructed).toBe("1");
  });
  it("rejects negative input with wrap (still wraps)", () => {
    const r = realToQ("-0.5", config, "round-to-even", "wrap");
    expect(r.overflowed).toBe(true);
    // -0.5 * 256 = -128 → wrap → 65536 - 128 = 65408 = 0xFF80
    expect(r.rawInt).toBe(0xFF80n);
  });
});

describe("q-format qToReal round-trip", () => {
  it("reconstructs Q1.15 raw 0x4000 as 0.5", () => {
    expect(qToReal(0x4000n, { m: 1, n: 15, signed: true })).toBe("0.5");
  });
  it("reconstructs Q1.15 raw 0x8000 as -1", () => {
    expect(qToReal(0x8000n, { m: 1, n: 15, signed: true })).toBe("-1");
  });
  it("reconstructs UQ8.8 raw 0x0180 as 1.5", () => {
    expect(qToReal(0x0180n, { m: 8, n: 8, signed: false })).toBe("1.5");
  });
  it("reconstructs UQ8.8 raw 0xFFFF as 255.99609375", () => {
    expect(qToReal(0xFFFFn, { m: 8, n: 8, signed: false })).toBe("255.99609375");
  });
});

describe("q-format applyOverflow", () => {
  it("saturate does not flag in-range values", () => {
    const r = applyOverflow(0n, { m: 1, n: 15, signed: true }, "saturate");
    expect(r.overflowed).toBe(false);
    expect(r.raw).toBe(0n);
  });
  it("saturate clamps above max", () => {
    const r = applyOverflow(50000n, { m: 1, n: 15, signed: true }, "saturate");
    expect(r.overflowed).toBe(true);
    expect(r.raw).toBe(0x7FFFn);
  });
  it("saturate clamps below min", () => {
    const r = applyOverflow(-50000n, { m: 1, n: 15, signed: true }, "saturate");
    expect(r.overflowed).toBe(true);
    expect(r.raw).toBe(0x8000n);
  });
  it("wrap returns wrapped bit pattern", () => {
    const r = applyOverflow(70000n, { m: 1, n: 15, signed: true }, "wrap");
    expect(r.overflowed).toBe(true);
    // 70000 mod 65536 = 4464
    expect(r.raw).toBe(4464n);
  });
});

describe("q-format subtractDecimalStrings", () => {
  it("subtracts two decimals", () => {
    expect(subtractDecimalStrings("0.5", "0.25")).toBe("0.25");
  });
  it("returns 0 for equal values", () => {
    expect(subtractDecimalStrings("1.5", "1.5")).toBe("0");
  });
  it("handles negative result", () => {
    expect(subtractDecimalStrings("0.1", "0.5")).toBe("-0.4");
  });
  it("handles fraction inputs", () => {
    expect(subtractDecimalStrings("1/2", "1/4")).toBe("0.25");
  });
});

describe("q-format fractionToDecimalString", () => {
  it("handles zero", () => {
    expect(fractionToDecimalString(0n, 5n)).toBe("0");
  });
  it("divides 1 by 3 to 100 digits", () => {
    const r = fractionToDecimalString(1n, 3n);
    expect(r.startsWith("0.3333")).toBe(true);
    expect(r.length).toBeGreaterThan(50);
  });
  it("handles exact division", () => {
    expect(fractionToDecimalString(6n, 3n)).toBe("2");
  });
});

describe("q-format splitFieldBits & bitFieldLabel", () => {
  it("splits Q1.15 raw 0x4000 into integer (0) and fraction (1000000000000000)", () => {
    const f = splitFieldBits(0x4000n, { m: 1, n: 15, signed: true });
    expect(f.integer).toBe("0");
    expect(f.fraction).toBe("100000000000000");
  });
  it("splits UQ8.8 raw 0x0180 into integer (00000001) and fraction (10000000)", () => {
    const f = splitFieldBits(0x0180n, { m: 8, n: 8, signed: false });
    expect(f.integer).toBe("00000001");
    expect(f.fraction).toBe("10000000");
  });
  it("bitFieldLabel identifies sign bit for signed", () => {
    expect(bitFieldLabel(15, { m: 1, n: 15, signed: true })).toBe("sign");
  });
  it("bitFieldLabel identifies integer bit for unsigned", () => {
    expect(bitFieldLabel(15, { m: 8, n: 8, signed: false })).toBe("integer");
  });
  it("bitFieldLabel identifies fraction bit", () => {
    expect(bitFieldLabel(0, { m: 1, n: 15, signed: true })).toBe("fraction");
  });
});

describe("q-format history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, input: "0.5",
      config: { m: 1, n: 15, signed: true },
      rounding: "round-to-even", overflow: "saturate",
      hex: "4000", reconstructed: "0.5",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, input: `${i}.0`,
        config: { m: 1, n: 15, signed: true },
        rounding: "round-to-even", overflow: "saturate",
        hex: "0000", reconstructed: "0",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, input: "0.5",
      config: { m: 1, n: 15, signed: true },
      rounding: "round-to-even", overflow: "saturate",
      hex: "4000", reconstructed: "0.5",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("q-format shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("0.5", { m: 1, n: 15, signed: true }, "round-to-even", "saturate");
    expect(url).toContain("v=0.5");
    expect(url).toContain("m=1");
    expect(url).toContain("n=15");
    expect(url).toContain("signed=1");
    expect(url).toContain("r=round-to-even");
    expect(url).toContain("o=saturate");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("v=0.5&m=1&n=15&signed=1&r=round-to-even&o=saturate");
    expect(p.input).toBe("0.5");
    expect(p.config).toEqual({ m: 1, n: 15, signed: true });
    expect(p.rounding).toBe("round-to-even");
    expect(p.overflow).toBe("saturate");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.input).toBe("");
    expect(p.config).toEqual({ m: 1, n: 15, signed: true });
    expect(p.rounding).toBe("round-to-even");
    expect(p.overflow).toBe("saturate");
  });
  it("filters unknown rounding mode", () => {
    const p = parseShareUrl("v=1.0&m=1&n=15&signed=1&r=invalid&o=saturate");
    expect(p.rounding).toBe("round-to-even");
  });
  it("filters unknown overflow mode", () => {
    const p = parseShareUrl("v=1.0&m=1&n=15&signed=1&r=truncate&o=invalid");
    expect(p.overflow).toBe("saturate");
  });
});

// Suppress unused-import lint
export type _Unused = QConfig | RoundingMode | OverflowMode;
