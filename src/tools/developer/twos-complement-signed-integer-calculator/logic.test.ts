import { describe, it, expect, beforeEach } from "vitest";
import {
  WIDTH_PRESETS,
  MIN_CUSTOM_WIDTH,
  MAX_CUSTOM_WIDTH,
  isValidWidth,
  normalizeWidth,
  getRange,
  maskWidth,
  signExtend,
  toBinaryString,
  groupNibbles,
  parseInput,
  buildRepresentation,
  onesComplement,
  signMagnitude,
  buildBitGrid,
  toggleBit,
  setBit,
  computeNegation,
  changeWidth,
  convert,
  convertValue,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("twos-complement constants", () => {
  it("exposes preset widths 4/8/16/32/64", () => {
    expect(WIDTH_PRESETS).toEqual([4, 8, 16, 32, 64]);
  });
  it("exposes min/max custom width bounds", () => {
    expect(MIN_CUSTOM_WIDTH).toBe(4);
    expect(MAX_CUSTOM_WIDTH).toBe(256);
  });
  it("isValidWidth accepts 4..256, rejects others", () => {
    expect(isValidWidth(4)).toBe(true);
    expect(isValidWidth(256)).toBe(true);
    expect(isValidWidth(3)).toBe(false);
    expect(isValidWidth(257)).toBe(false);
    expect(isValidWidth(8.5)).toBe(false);
  });
  it("normalizeWidth falls back to 32 on invalid", () => {
    expect(normalizeWidth(8)).toBe(8);
    expect(normalizeWidth(3)).toBe(32);
    expect(normalizeWidth(1000)).toBe(32);
  });
});

describe("twos-complement getRange", () => {
  it("8-bit range is -128..127", () => {
    const r = getRange(8);
    expect(r.min).toBe(-128n);
    expect(r.max).toBe(127n);
    expect(r.minBin).toBe("10000000");
    expect(r.maxBin).toBe("01111111");
  });
  it("4-bit range is -8..7", () => {
    const r = getRange(4);
    expect(r.min).toBe(-8n);
    expect(r.max).toBe(7n);
  });
  it("64-bit range matches INT64_MIN/MAX", () => {
    const r = getRange(64);
    expect(r.min).toBe(-(2n ** 63n));
    expect(r.max).toBe(2n ** 63n - 1n);
  });
});

describe("twos-complement width helpers", () => {
  it("maskWidth clips negatives to two's-complement pattern", () => {
    expect(maskWidth(-1n, 8)).toBe(0xFFn);
    expect(maskWidth(-128n, 8)).toBe(0x80n);
    expect(maskWidth(256n, 8)).toBe(0x00n);
  });
  it("signExtend reinterprets MSB as sign", () => {
    expect(signExtend(0xFFn, 8)).toBe(-1n);
    expect(signExtend(0x80n, 8)).toBe(-128n);
    expect(signExtend(0x7Fn, 8)).toBe(127n);
  });
  it("toBinaryString pads to width with leading zeros", () => {
    expect(toBinaryString(5n, 8)).toBe("00000101");
    expect(toBinaryString(-5n, 8)).toBe("11111011");
    expect(toBinaryString(0n, 16)).toBe("0000000000000000");
  });
  it("groupNibbles groups in 4-bit chunks", () => {
    expect(groupNibbles("11111011")).toBe("1111 1011");
    expect(groupNibbles("1")).toBe("0001");
  });
});

describe("twos-complement parseInput", () => {
  it("parses signed decimal", () => {
    const p = parseInput("-5");
    expect(p.value).toBe(-5n);
    expect(p.base).toBe(10);
    expect(p.isBitPattern).toBe(false);
  });
  it("parses hex bit-pattern", () => {
    const p = parseInput("0xFF");
    expect(p.value).toBe(255n);
    expect(p.isBitPattern).toBe(true);
  });
  it("parses binary bit-pattern", () => {
    const p = parseInput("0b11111011");
    expect(p.value).toBe(251n);
    expect(p.isBitPattern).toBe(true);
  });
  it("parses octal bit-pattern", () => {
    const p = parseInput("0o17");
    expect(p.value).toBe(15n);
    expect(p.isBitPattern).toBe(true);
  });
  it("allows underscores and + sign", () => {
    expect(parseInput("+1_000").value).toBe(1000n);
    expect(parseInput("0xFF_FF").value).toBe(65535n);
  });
  it("throws on empty / invalid", () => {
    expect(() => parseInput("")).toThrow();
    expect(() => parseInput("   ")).toThrow();
    expect(() => parseInput("0xZZ")).toThrow();
    expect(() => parseInput("0b2")).toThrow();
  });
});

describe("twos-complement representations", () => {
  it("buildRepresentation returns bin/hex/oct/dec", () => {
    const r = buildRepresentation(0xFBn, 8, -5n);
    expect(r.bin).toBe("11111011");
    expect(r.hex).toBe("FB");
    expect(r.oct).toBe("373");
    expect(r.dec).toBe("-5");
  });
  it("two's complement of -5 in 8-bit is 11111011", () => {
    const c = convertValue(-5n, 8);
    expect(c.twos.bin).toBe("11111011");
    expect(c.twos.hex).toBe("FB");
    expect(c.twos.dec).toBe("-5");
  });
  it("one's complement of -5 in 8-bit is 11111010 (no +1)", () => {
    const o = onesComplement(-5n, 8);
    expect(o.bin).toBe("11111010");
    expect(o.dec).toBe("-5");
  });
  it("sign-magnitude of -5 in 8-bit is 10000101", () => {
    const s = signMagnitude(-5n, 8);
    expect(s.bin).toBe("10000101");
    expect(s.dec).toBe("-5");
  });
  it("sign-magnitude of +5 in 8-bit is 00000101", () => {
    const s = signMagnitude(5n, 8);
    expect(s.bin).toBe("00000101");
  });
  it("zero is 0000...0 in all three representations", () => {
    const c = convertValue(0n, 8);
    expect(c.twos.bin).toBe("00000000");
    expect(c.ones.bin).toBe("00000000");
    expect(c.signMag.bin).toBe("00000000");
  });
  it("most-negative value -128 (8-bit) round-trips", () => {
    const c = convertValue(-128n, 8);
    expect(c.twos.bin).toBe("10000000");
    expect(c.twos.dec).toBe("-128");
    expect(c.overflow).toBe(false);
    expect(c.negation.isMostNegative).toBe(true);
    expect(c.negation.result).toBe(-128n); // negation overflows back to itself
  });
});

describe("twos-complement bit grid & toggling", () => {
  it("buildBitGrid marks the MSB as sign bit", () => {
    const g = buildBitGrid(0x80n, 8);
    expect(g.width).toBe(8);
    expect(g.cells).toHaveLength(8);
    expect(g.cells[0].isSign).toBe(true); // MSB
    expect(g.cells[0].value).toBe(1);
    expect(g.cells[0].position).toBe(7);
    expect(g.cells[0].weight).toBe(128n);
    expect(g.cells[7].position).toBe(0);
    expect(g.cells[7].weight).toBe(1n);
  });
  it("toggleBit flips the chosen bit", () => {
    // Toggle bit 0 of 0 (0000_0000) → 1.
    expect(toggleBit(0n, 0, 8)).toBe(1n);
    // Toggle bit 7 (MSB) of 5 → 5 + 128 = ... but signExtend makes it -123.
    expect(toggleBit(5n, 7, 8)).toBe(-123n);
  });
  it("setBit explicitly sets to 0 or 1", () => {
    expect(setBit(0n, 3, 1, 8)).toBe(8n);
    // 0xFF (= -1 signed in 8-bit) with bit 0 cleared → 0xFE (= -2 signed).
    expect(setBit(-1n, 0, 0, 8)).toBe(-2n);
    // Setting a sign bit on a positive value makes it negative.
    expect(setBit(5n, 7, 1, 8)).toBe(-123n);
    // Out-of-range position is a no-op.
    expect(setBit(0n, 100, 1, 8)).toBe(0n);
  });
});

describe("twos-complement negation steps", () => {
  it("invert + add 1 produces the correct negation for -5", () => {
    const n = computeNegation(-5n, 8);
    // -5 = 11111011; invert = 00000100; +1 = 00000101 = 5.
    expect(n.originalBin).toBe("11111011");
    expect(n.invertedBin).toBe("00000100");
    expect(n.plusOneBin).toBe("00000101");
    expect(n.result).toBe(5n);
    expect(n.isMostNegative).toBe(false);
    expect(n.steps).toHaveLength(4);
  });
  it("flags most-negative value (8-bit -128)", () => {
    const n = computeNegation(-128n, 8);
    expect(n.isMostNegative).toBe(true);
    // -128 = 10000000; invert = 01111111; +1 = 10000000 = -128 again.
    expect(n.result).toBe(-128n);
    expect(n.steps[n.steps.length - 1]).toContain("most-negative");
  });
});

describe("twos-complement width change (sign-extension / truncation)", () => {
  it("sign-extends -5 from 8 to 16 bits", () => {
    const c = changeWidth(-5n, 8, 16);
    expect(c.truncated).toBe(false);
    expect(c.preserved).toBe(true);
    expect(c.fromBin).toBe("11111011");
    expect(c.toBin).toBe("1111111111111011");
    expect(c.description).toContain("Sign-extended");
  });
  it("sign-extends +5 from 8 to 16 bits", () => {
    const c = changeWidth(5n, 8, 16);
    expect(c.toBin).toBe("0000000000000101");
    expect(c.preserved).toBe(true);
  });
  it("truncation preserves when dropped bits match new sign bit", () => {
    // -5 in 16-bit = 1111111111111011; truncate to 8 → 11111011 = -5 (preserved).
    const c = changeWidth(-5n, 16, 8);
    expect(c.truncated).toBe(false);
    expect(c.preserved).toBe(true);
    expect(c.toBin).toBe("11111011");
  });
  it("truncation flags overflow when dropped bits differ", () => {
    // 200 in 16-bit (signed) = 0000000011001000; truncate to 8 → 11001000.
    // New MSB is 1, so signed value becomes -56 — overflow.
    const c = changeWidth(200n, 16, 8);
    expect(c.truncated).toBe(true);
    expect(c.preserved).toBe(false);
    expect(c.description).toContain("changed");
  });
});

describe("twos-complement convert (top-level)", () => {
  it("converts signed decimal -5 to all representations", () => {
    const c = convert("-5", 8);
    expect(c.error).toBeUndefined();
    expect(c.input).toBe(-5n);
    expect(c.twos.bin).toBe("11111011");
    expect(c.ones.bin).toBe("11111010");
    expect(c.signMag.bin).toBe("10000101");
    expect(c.overflow).toBe(false);
  });
  it("interprets 0xFF as bit-pattern (-1 at 8-bit)", () => {
    const c = convert("0xFF", 8);
    expect(c.input).toBe(-1n);
    expect(c.twos.dec).toBe("-1");
    expect(c.overflow).toBe(false);
  });
  it("interprets 0x0F as bit-pattern (+15 at 8-bit)", () => {
    const c = convert("0x0F", 8);
    expect(c.input).toBe(15n);
    expect(c.twos.dec).toBe("15");
  });
  it("flags overflow for signed decimal out of range", () => {
    const c = convert("200", 8);
    expect(c.overflow).toBe(true);
    // Still masks to a bit pattern (200 = 0xC8 = -56 signed).
    expect(c.twos.bin).toBe("11001000");
  });
  it("flags overflow for very negative value", () => {
    const c = convert("-200", 8);
    expect(c.overflow).toBe(true);
  });
  it("errors on invalid input", () => {
    const c = convert("0xZZ", 8);
    expect(c.error).toBeDefined();
  });
  it("round-trips the most-negative value", () => {
    const c = convert("-128", 8);
    expect(c.input).toBe(-128n);
    expect(c.twos.bin).toBe("10000000");
    expect(c.twos.dec).toBe("-128");
    expect(c.overflow).toBe(false);
  });
  it("round-trips the max positive value", () => {
    const c = convert("127", 8);
    expect(c.input).toBe(127n);
    expect(c.twos.bin).toBe("01111111");
  });
  it("handles 64-bit values", () => {
    const c = convert("9223372036854775807", 64); // INT64_MAX
    expect(c.overflow).toBe(false);
    expect(c.twos.hex).toBe("7FFFFFFFFFFFFFFF");
  });
  it("handles custom width (12-bit)", () => {
    const c = convert("-1", 12);
    expect(c.twos.bin).toBe("111111111111");
    expect(c.range.min).toBe(-2048n);
    expect(c.range.max).toBe(2047n);
  });
});

describe("twos-complement convertValue", () => {
  it("converts bigint directly", () => {
    const c = convertValue(-1n, 8);
    expect(c.twos.bin).toBe("11111111");
    expect(c.twos.dec).toBe("-1");
  });
});

describe("twos-complement history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "-5", width: 8, dec: "-5", hex: "FB" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].input).toBe("-5");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: String(i), width: 8, dec: String(i), hex: "00" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "1", width: 8, dec: "1", hex: "01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("twos-complement shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ input: "-5", width: 8 });
    expect(url).toContain("v=-5");
    expect(url).toContain("w=8");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("v=-5&w=8");
    expect(s.input).toBe("-5");
    expect(s.width).toBe(8);
  });
  it("defaults to width 32 on empty hash", () => {
    const s = parseShareUrl("");
    expect(s.input).toBe("");
    expect(s.width).toBe(32);
  });
  it("sanitizes invalid width", () => {
    const s = parseShareUrl("v=1&w=3");
    expect(s.width).toBe(32); // 3 is below MIN_CUSTOM_WIDTH
  });
  it("accepts custom width (e.g. 12)", () => {
    const s = parseShareUrl("v=1&w=12");
    expect(s.width).toBe(12);
  });
});
