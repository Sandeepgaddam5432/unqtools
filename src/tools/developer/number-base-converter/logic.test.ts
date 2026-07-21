import { describe, it, expect, beforeEach } from "vitest";
import {
  BASE_PRESETS,
  BASE_LABELS,
  COMMON_BASES,
  BIT_WIDTHS,
  MAX_FRACTION_DIGITS,
  BASE58_ALPHABET,
  digitToChar,
  charToDigit,
  validateDigits,
  detectBase,
  parseNumber,
  formatBigIntInBase,
  convertFractionToBase,
  groupDigits,
  toTwosComplement,
  fromTwosComplement,
  buildExpansion,
  convertBase,
  convertAllBases,
  encodeBase58,
  decodeBase58,
  encodeBase64,
  decodeBase64,
  batchConvert,
  parseBatchInput,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SignedBitWidth,
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

describe("number-base-converter constants", () => {
  it("has 6 base presets", () => {
    expect(BASE_PRESETS).toHaveLength(6);
  });
  it("presets include binary, octal, decimal, hex, base32, base36", () => {
    const bases = BASE_PRESETS.map((p) => p.base);
    expect(bases).toEqual([2, 8, 10, 16, 32, 36]);
  });
  it("has labels for common bases", () => {
    expect(BASE_LABELS[2]).toBe("Binary");
    expect(BASE_LABELS[16]).toBe("Hexadecimal");
    expect(BASE_LABELS[36]).toBe("Base36");
  });
  it("exposes 4 bit widths for signed mode", () => {
    expect(BIT_WIDTHS).toEqual([8, 16, 32, 64]);
  });
  it("has a default max fraction digit count", () => {
    expect(MAX_FRACTION_DIGITS).toBeGreaterThan(8);
  });
  it("base58 alphabet has 58 chars and excludes 0, O, I, l", () => {
    expect(BASE58_ALPHABET).toHaveLength(58);
    expect(BASE58_ALPHABET).not.toContain("0");
    expect(BASE58_ALPHABET).not.toContain("O");
    expect(BASE58_ALPHABET).not.toContain("I");
    expect(BASE58_ALPHABET).not.toContain("l");
  });
});

describe("number-base-converter digit helpers", () => {
  it("digitToChar maps 0–9 and 10–15", () => {
    expect(digitToChar(0)).toBe("0");
    expect(digitToChar(9)).toBe("9");
    expect(digitToChar(10)).toBe("a");
    expect(digitToChar(15)).toBe("f");
  });
  it("digitToChar throws out of range", () => {
    expect(() => digitToChar(36)).toThrow();
  });
  it("charToDigit handles lowercase and uppercase hex", () => {
    expect(charToDigit("a")).toBe(10);
    expect(charToDigit("F")).toBe(15);
    expect(charToDigit("0")).toBe(0);
  });
  it("charToDigit returns -1 for invalid", () => {
    expect(charToDigit("z")).toBe(35);
    expect(charToDigit("!")).toBe(-1);
    expect(charToDigit("")).toBe(-1);
  });
});

describe("number-base-converter validateDigits", () => {
  it("accepts valid digits", () => {
    expect(validateDigits("1011", 2).valid).toBe(true);
    expect(validateDigits("ff", 16).valid).toBe(true);
  });
  it("rejects invalid digits for base", () => {
    const r = validateDigits("8", 8);
    expect(r.valid).toBe(false);
    expect(r.invalidChars).toContain("8");
  });
  it("allows radix point", () => {
    expect(validateDigits("1.5", 10).valid).toBe(true);
  });
});

describe("number-base-converter detectBase", () => {
  it("detects 0x prefix as hex", () => {
    expect(detectBase("0xff")).toEqual({ base: 16, cleaned: "ff" });
  });
  it("detects 0b prefix as binary", () => {
    expect(detectBase("0b1010")).toEqual({ base: 2, cleaned: "1010" });
  });
  it("detects 0o prefix as octal", () => {
    expect(detectBase("0o17")).toEqual({ base: 8, cleaned: "17" });
  });
  it("preserves negative sign after prefix strip", () => {
    expect(detectBase("-0xff")).toEqual({ base: 16, cleaned: "-ff" });
  });
  it("returns null for no prefix", () => {
    expect(detectBase("123")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(detectBase("")).toBeNull();
  });
});

describe("number-base-converter parseNumber", () => {
  it("parses binary 1011 as 11", () => {
    expect(parseNumber("1011", 2).intPart).toBe(11n);
  });
  it("parses hex ff as 255", () => {
    expect(parseNumber("ff", 16).intPart).toBe(255n);
  });
  it("handles negative sign", () => {
    expect(parseNumber("-10", 10).sign).toBe(-1);
    expect(parseNumber("-10", 10).intPart).toBe(10n);
  });
  it("handles fractional part", () => {
    const p = parseNumber("1.5", 10);
    expect(p.intPart).toBe(1n);
    expect(p.fracPart).toBe(5n);
    expect(p.fracLen).toBe(1);
  });
  it("throws on invalid digit for base", () => {
    expect(() => parseNumber("8", 8)).toThrow();
  });
  it("throws on multiple radix points", () => {
    expect(() => parseNumber("1.2.3", 10)).toThrow();
  });
  it("throws on empty input", () => {
    expect(() => parseNumber("", 10)).toThrow();
  });
});

describe("number-base-converter formatBigIntInBase", () => {
  it("formats 11 as 1011 in base 2", () => {
    expect(formatBigIntInBase(11n, 2)).toBe("1011");
  });
  it("formats 255 as ff in base 16", () => {
    expect(formatBigIntInBase(255n, 16)).toBe("ff");
  });
  it("formats 0 as 0", () => {
    expect(formatBigIntInBase(0n, 16)).toBe("0");
  });
  it("handles BigInt precision", () => {
    const big = 2n ** 64n; // 18446744073709551616
    expect(formatBigIntInBase(big, 16)).toBe("10000000000000000");
  });
});

describe("number-base-converter convertFractionToBase", () => {
  it("converts 0.5 (base 10) to 1 (base 2)", () => {
    // fracPart=5, fracLen=1, denominator=10
    const r = convertFractionToBase(5n, 1, 10, 2);
    expect(r.digits).toBe("1");
    expect(r.repeating).toBe(false);
  });
  it("marks 1/3 in base 2 as repeating", () => {
    // 1/3 → fracPart=1, fracLen=1 (0.1 in base 10 is 1/10, not 1/3)
    // Use fracPart=3333, fracLen=4 → 0.3333 base 10 ≈ 1/3
    const r = convertFractionToBase(3333n, 4, 10, 2, 24);
    expect(r.repeating).toBe(true);
  });
  it("returns empty for zero fraction", () => {
    expect(convertFractionToBase(0n, 0, 10, 2)).toEqual({ digits: "", repeating: false });
  });
});

describe("number-base-converter groupDigits", () => {
  it("groups binary into nibbles", () => {
    expect(groupDigits("11111111", 4, " ")).toBe("1111 1111");
  });
  it("groups from the right for integer part", () => {
    expect(groupDigits("10101", 4, " ")).toBe("1 0101");
  });
  it("preserves radix point", () => {
    expect(groupDigits("1111.10101", 4, " ")).toBe("1111.1010 1");
  });
  it("returns input unchanged for groupSize 0", () => {
    expect(groupDigits("1111", 0, " ")).toBe("1111");
  });
});

describe("number-base-converter two's complement", () => {
  it("converts -1 at 8-bit to 255", () => {
    expect(toTwosComplement(-1n, 8)).toBe(255n);
  });
  it("converts -1 at 8-bit to FF in hex via convertBase signed", () => {
    const r = convertBase("-1", 10, 16, { signed: true, bitWidth: 8 });
    expect(r.value.toUpperCase()).toBe("FF");
  });
  it("reinterprets FF as -1 at 8-bit", () => {
    expect(fromTwosComplement(255n, 8)).toBe(-1n);
  });
  it("positive value passes through masked", () => {
    expect(toTwosComplement(42n, 8)).toBe(42n);
  });
});

describe("number-base-converter buildExpansion", () => {
  it("builds expansion for 1011 base 2", () => {
    const e = buildExpansion("1011", 2);
    expect(e.terms).toEqual(["1×8", "0×4", "1×2", "1×1"]);
    expect(e.sum).toBe("11");
    expect(e.text).toContain("1×8 + 0×4 + 1×2 + 1×1 = 11");
  });
  it("builds expansion for hex ff", () => {
    const e = buildExpansion("ff", 16);
    expect(e.sum).toBe("255");
  });
  it("returns empty for invalid digits", () => {
    const e = buildExpansion("8", 8);
    expect(e.terms).toEqual([]);
  });
});

describe("number-base-converter convertBase", () => {
  it("converts binary 1011 to decimal 11", () => {
    const r = convertBase("1011", 2, 10);
    expect(r.value).toBe("11");
    expect(r.error).toBeUndefined();
  });
  it("converts decimal 255 to hex ff (lowercase internally)", () => {
    const r = convertBase("255", 10, 16, { uppercase: false });
    expect(r.value).toBe("ff");
  });
  it("uppercases hex by default", () => {
    const r = convertBase("255", 10, 16);
    expect(r.value).toBe("FF");
  });
  it("preserves negative sign in non-signed mode", () => {
    const r = convertBase("-10", 10, 16);
    expect(r.value).toBe("-A");
  });
  it("handles fractional 0.5 base 10 → 0.1 base 2", () => {
    const r = convertBase("0.5", 10, 2);
    expect(r.value).toBe("0.1");
    expect(r.repeating).toBe(false);
  });
  it("returns error for invalid digit", () => {
    const r = convertBase("8", 8, 10);
    expect(r.error).toBeDefined();
  });
  it("returns error for out-of-range base", () => {
    const r = convertBase("1", 1, 10);
    expect(r.error).toContain("2–36");
  });
  it("uses BigInt precision for >2^53", () => {
    const r = convertBase("9007199254740993", 10, 16); // 2^53 + 1
    // 2^53 = 0x20000000000000, so 2^53 + 1 = 0x20000000000001 (not 0x20000000000000 — Number would lose precision)
    expect(r.value).toBe("20000000000001");
  });
  it("includes expansion in result", () => {
    const r = convertBase("1011", 2, 10);
    expect(r.expansion).toContain("1×8");
  });
});

describe("number-base-converter convertAllBases", () => {
  it("returns all common bases + 58 + 64", () => {
    const out = convertAllBases("255", 10);
    expect(out["2"]).toBe("11111111");
    expect(out["10"]).toBe("255");
    expect(out["16"]).toBe("FF");
    expect(out["58"]).toBeTruthy();
    expect(out["64"]).toBe("/w==");
  });
  it("returns empty base58/64 for fractional input", () => {
    const out = convertAllBases("0.5", 10);
    expect(out["58"]).toBe("");
    expect(out["64"]).toBe("");
  });
});

describe("number-base-converter base58", () => {
  it("encodes 0 as empty", () => {
    expect(encodeBase58(0n)).toBe("");
  });
  it("encodes 1234 as NH", () => {
    expect(encodeBase58(1234n)).toBe("NH");
  });
  it("round-trips a large value", () => {
    const v = 12345678901234567890n;
    expect(decodeBase58(encodeBase58(v))).toBe(v);
  });
  it("decodes round-trip back to original", () => {
    const v = 42n;
    expect(decodeBase58(encodeBase58(v))).toBe(v);
  });
  it("throws on invalid char", () => {
    expect(() => decodeBase58("0")).toThrow();
    expect(() => decodeBase58("O")).toThrow();
  });
});

describe("number-base-converter base64", () => {
  it("encodes 0 as empty", () => {
    expect(encodeBase64(0n)).toBe("");
  });
  it("encodes 255 as /w==", () => {
    expect(encodeBase64(255n)).toBe("/w==");
  });
  it("encodes 1 as AQ==", () => {
    expect(encodeBase64(1n)).toBe("AQ==");
  });
  it("round-trips a large value", () => {
    const v = 0xdeadbeefcafen;
    expect(decodeBase64(encodeBase64(v))).toBe(v);
  });
  it("throws on invalid char", () => {
    expect(() => decodeBase64("!")).toThrow();
  });
});

describe("number-base-converter batch", () => {
  it("parses multiline input", () => {
    expect(parseBatchInput("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("parses comma-separated input", () => {
    expect(parseBatchInput("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("converts a list of inputs", () => {
    const results = batchConvert(["10", "20", "30"], 10, 16);
    expect(results).toHaveLength(3);
    expect(results[0].outputs[0]?.value).toBe("A");
    expect(results[1].outputs[0]?.value).toBe("14");
    expect(results[2].outputs[0]?.value).toBe("1E");
  });
  it("reports per-line errors", () => {
    const results = batchConvert(["10", "8", "10"], 8, 10);
    expect(results[1].error).toBeDefined();
    expect(results[0].outputs[0]?.value).toBe("8");
  });
});

describe("number-base-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "255", fromBase: 10, toBase: 16, result: "FF" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].result).toBe("FF");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: String(i), fromBase: 10, toBase: 16, result: String(i) });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "1", fromBase: 10, toBase: 16, result: "1" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("number-base-converter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      input: "255",
      fromBase: 10,
      toBase: 16,
      signed: true,
      bitWidth: 8 as SignedBitWidth,
    });
    expect(url).toContain("input=255");
    expect(url).toContain("from=10");
    expect(url).toContain("to=16");
    expect(url).toContain("signed=1");
    expect(url).toContain("width=8");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("input=255&from=10&to=16&signed=1&width=8");
    expect(s.input).toBe("255");
    expect(s.fromBase).toBe(10);
    expect(s.toBase).toBe(16);
    expect(s.signed).toBe(true);
    expect(s.bitWidth).toBe(8);
  });
  it("handles empty hash", () => {
    const s = parseShareUrl("");
    expect(s.input).toBe("");
    expect(s.fromBase).toBe(10);
    expect(s.toBase).toBe(16);
  });
  it("sanitizes out-of-range base", () => {
    const s = parseShareUrl("input=1&from=99&to=1");
    expect(s.fromBase).toBe(10);
    expect(s.toBase).toBe(16);
  });
  it("ignores invalid bit width", () => {
    const s = parseShareUrl("input=1&from=10&to=16&width=7");
    expect(s.bitWidth).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = SignedBitWidth;
