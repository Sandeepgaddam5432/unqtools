import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  TYPE_FAMILIES,
  FAMILY_LABELS,
  BUILD_MODES,
  BUILD_MODE_LABELS,
  OVERFLOW_BEHAVIOR_LABELS,
  INTEGER_TYPES,
  OVERFLOW_PRESETS,
  getTypeById,
  getTypesByLanguage,
  getTypesByFamily,
  filterTypes,
  compareAcrossLanguages,
  formatBigint,
  toDecimal,
  toHex,
  toBinary,
  toOctal,
  parseInput,
  simulateOverflow,
  valueFits,
  buildBitGrid,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Language,
  type BuildMode,
  type IntegerType,
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

describe("int-range constants", () => {
  it("exposes 7 languages", () => {
    expect(LANGUAGES).toHaveLength(7);
    expect(LANGUAGE_LABELS.rust).toBe("Rust");
  });
  it("has type families with labels", () => {
    expect(TYPE_FAMILIES.length).toBeGreaterThanOrEqual(10);
    expect(FAMILY_LABELS.int64).toContain("64");
  });
  it("has build modes and behavior labels", () => {
    expect(BUILD_MODES).toContain("checked");
    expect(BUILD_MODE_LABELS.checked).toBe("Checked");
    expect(OVERFLOW_BEHAVIOR_LABELS.ub).toBe("Undefined behavior");
  });
  it("has a curated dataset of at least 40 integer types", () => {
    expect(INTEGER_TYPES.length).toBeGreaterThanOrEqual(40);
  });
  it("includes the canonical C fixed-width types", () => {
    for (const id of ["c-int8_t", "c-uint8_t", "c-int16_t", "c-uint16_t", "c-int32_t", "c-uint32_t", "c-int64_t", "c-uint64_t"]) {
      expect(getTypeById(id)).toBeDefined();
    }
  });
  it("includes size_t, intptr_t, uintptr_t, ptrdiff_t", () => {
    expect(getTypeById("c-size_t")).toBeDefined();
    expect(getTypeById("c-intptr_t")).toBeDefined();
    expect(getTypeById("c-uintptr_t")).toBeDefined();
    expect(getTypeById("c-ptrdiff_t")).toBeDefined();
  });
  it("includes rust i128 / u128 / isize / usize", () => {
    expect(getTypeById("rust-i128")).toBeDefined();
    expect(getTypeById("rust-u128")).toBeDefined();
    expect(getTypeById("rust-isize")).toBeDefined();
    expect(getTypeById("rust-usize")).toBeDefined();
  });
  it("has at least 10 overflow presets", () => {
    expect(OVERFLOW_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("int-range lookups", () => {
  it("filters by language", () => {
    const goTypes = getTypesByLanguage("go");
    expect(goTypes.length).toBeGreaterThan(0);
    expect(goTypes.every((t) => t.language === "go")).toBe(true);
  });
  it("filters by family", () => {
    const int32Family = getTypesByFamily("int32");
    expect(int32Family.some((t) => t.id === "c-int32_t")).toBe(true);
    expect(int32Family.some((t) => t.id === "rust-i32")).toBe(true);
    expect(int32Family.some((t) => t.id === "java-int")).toBe(true);
  });
  it("free-text filter matches name", () => {
    const matches = filterTypes("uint8");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((t) => t.id === "c-uint8_t")).toBe(true);
  });
  it("free-text filter combined with language", () => {
    const matches = filterTypes("int", "rust");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((t) => t.language === "rust")).toBe(true);
  });
  it("empty query returns all (optionally filtered by language)", () => {
    expect(filterTypes("")).toHaveLength(INTEGER_TYPES.length);
    expect(filterTypes("", "java").length).toBeGreaterThan(0);
  });
  it("compareAcrossLanguages returns all types in a family", () => {
    const cmp = compareAcrossLanguages("int64");
    expect(cmp.some((t) => t.id === "c-int64_t")).toBe(true);
    expect(cmp.some((t) => t.id === "rust-i64")).toBe(true);
    expect(cmp.some((t) => t.id === "go-int64")).toBe(true);
    expect(cmp.some((t) => t.id === "java-long")).toBe(true);
    expect(cmp.some((t) => t.id === "csharp-long")).toBe(true);
  });
});

describe("int-range exact min/max", () => {
  it("int8 min/max are exact", () => {
    const t = getTypeById("c-int8_t") as IntegerType;
    expect(t.min).toBe(-128n);
    expect(t.max).toBe(127n);
  });
  it("uint8 max is 255", () => {
    const t = getTypeById("c-uint8_t") as IntegerType;
    expect(t.max).toBe(255n);
    expect(t.min).toBe(0n);
  });
  it("int32 min/max are exact", () => {
    const t = getTypeById("c-int32_t") as IntegerType;
    expect(t.min).toBe(-2147483648n);
    expect(t.max).toBe(2147483647n);
  });
  it("uint64 max is 2^64-1", () => {
    const t = getTypeById("c-uint64_t") as IntegerType;
    expect(t.max).toBe(18446744073709551615n);
  });
  it("int128 min/max are exact (Rust)", () => {
    const t = getTypeById("rust-i128") as IntegerType;
    expect(t.min).toBe(-(2n ** 127n));
    expect(t.max).toBe(2n ** 127n - 1n);
  });
  it("JS Number safe-int range is ±(2^53 - 1)", () => {
    const t = getTypeById("js-number-safe") as IntegerType;
    expect(t.max).toBe(2n ** 53n - 1n);
    expect(t.min).toBe(-(2n ** 53n - 1n));
  });
});

describe("int-range formatting", () => {
  it("formatBigint groups with underscores", () => {
    expect(formatBigint(1234567n)).toBe("1_234_567");
    expect(formatBigint(-1000000n)).toBe("-1_000_000");
    expect(formatBigint(0n)).toBe("0");
  });
  it("toDecimal returns plain string", () => {
    expect(toDecimal(255n)).toBe("255");
    expect(toDecimal(-7n)).toBe("-7");
  });
  it("toHex returns 0x-prefixed uppercase", () => {
    expect(toHex(255n)).toBe("0xFF");
    expect(toHex(0n)).toBe("0x0");
    expect(toHex(-1n)).toBe("-0x1");
  });
  it("toBinary returns 0b-prefixed", () => {
    expect(toBinary(10n)).toBe("0b1010");
    expect(toBinary(0n)).toBe("0b0");
  });
  it("toOctal returns 0o-prefixed", () => {
    expect(toOctal(8n)).toBe("0o10");
    expect(toOctal(0n)).toBe("0o0");
  });
});

describe("int-range parseInput", () => {
  it("parses decimal", () => {
    const r = parseInput("12345");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(12345n);
    expect(r.base).toBe(10);
  });
  it("parses negative", () => {
    const r = parseInput("-42");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(-42n);
  });
  it("parses hex", () => {
    const r = parseInput("0xFF");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(255n);
    expect(r.base).toBe(16);
  });
  it("parses binary", () => {
    const r = parseInput("0b1010");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(10n);
  });
  it("parses octal", () => {
    const r = parseInput("0o17");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(15n);
  });
  it("accepts underscores", () => {
    const r = parseInput("1_000_000");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(1000000n);
  });
  it("rejects empty", () => {
    expect(parseInput("").ok).toBe(false);
    expect(parseInput("   ").ok).toBe(false);
  });
  it("rejects invalid hex digits", () => {
    expect(parseInput("0xZZ").ok).toBe(false);
  });
});

describe("int-range simulateOverflow", () => {
  it("fits when value is within range", () => {
    const r = simulateOverflow(100n, "c-int8_t");
    expect(r.fits).toBe(true);
    expect(r.wrapped).toBe(100n);
    expect(r.behavior).toBe("ub"); // signed C → UB if it didn't fit; here it does fit so behavior label still UB-by-type
  });
  it("uint8 wraps mod 256", () => {
    const r = simulateOverflow(300n, "c-uint8_t");
    expect(r.fits).toBe(false);
    expect(r.wrapped).toBe(44n);
    expect(r.behavior).toBe("wrap");
  });
  it("int8 wraps to negative for 200", () => {
    const r = simulateOverflow(200n, "c-int8_t");
    expect(r.fits).toBe(false);
    expect(r.wrapped).toBe(-56n);
    expect(r.behavior).toBe("ub");
  });
  it("int32 MAX+1 wraps to MIN", () => {
    const r = simulateOverflow(2147483648n, "rust-i32", "release");
    expect(r.fits).toBe(false);
    expect(r.wrapped).toBe(-2147483648n);
    expect(r.behavior).toBe("wrap");
  });
  it("Rust debug mode panics on overflow", () => {
    const r = simulateOverflow(2147483648n, "rust-i32", "debug");
    expect(r.behavior).toBe("panic");
    expect(r.fits).toBe(false);
  });
  it("Java long wraps on MAX+1", () => {
    const r = simulateOverflow(9223372036854775808n, "java-long");
    expect(r.fits).toBe(false);
    expect(r.wrapped).toBe(-9223372036854775808n);
    expect(r.behavior).toBe("wrap");
  });
  it("C# checked mode throws", () => {
    const r = simulateOverflow(300n, "csharp-byte", "checked");
    expect(r.behavior).toBe("throw");
  });
  it("C# unchecked mode wraps", () => {
    const r = simulateOverflow(300n, "csharp-byte", "unchecked");
    expect(r.behavior).toBe("wrap");
    expect(r.wrapped).toBe(44n);
  });
  it("Go uint8 wraps", () => {
    const r = simulateOverflow(300n, "go-uint8");
    expect(r.wrapped).toBe(44n);
    expect(r.behavior).toBe("wrap");
  });
  it("JS Number is lossy beyond 2^53-1", () => {
    const r = simulateOverflow(2n ** 53n, "js-number-safe");
    expect(r.fits).toBe(false);
    expect(r.behavior).toBe("lossy");
    expect(r.lossy).toBe(true);
  });
  it("Python int never overflows", () => {
    const huge = 2n ** 1000n;
    const r = simulateOverflow(huge, "python-int");
    expect(r.unbounded).toBe(true);
    expect(r.behavior).toBe("none");
    expect(r.wrapped).toBe(huge);
  });
  it("BigInt never overflows", () => {
    const huge = 2n ** 200n;
    const r = simulateOverflow(huge, "js-bigint");
    expect(r.unbounded).toBe(true);
    expect(r.behavior).toBe("none");
  });
  it("throws on unknown type id", () => {
    expect(() => simulateOverflow(1n, "nope-not-a-type")).toThrow();
  });
  it("provides hex/binary of wrapped value", () => {
    const r = simulateOverflow(300n, "c-uint8_t");
    expect(r.wrappedDec).toBe("44");
    expect(r.wrappedHex).toBe("0x2C");
    expect(r.wrappedBin).toBe("0b101100");
  });
});

describe("int-range valueFits", () => {
  it("true within range", () => {
    expect(valueFits(100n, "c-int8_t")).toBe(true);
  });
  it("false outside range", () => {
    expect(valueFits(200n, "c-int8_t")).toBe(false);
  });
  it("true for unbounded types", () => {
    expect(valueFits(2n ** 1000n, "python-int")).toBe(true);
  });
  it("false for unknown type", () => {
    expect(valueFits(0n, "nope")).toBe(false);
  });
});

describe("int-range buildBitGrid", () => {
  it("builds 8 cells for 8-bit width", () => {
    const cells = buildBitGrid(0b10110001n, 8);
    expect(cells).toHaveLength(8);
    expect(cells[0].isSign).toBe(true); // MSB first
    expect(cells[0].value).toBe(1);
  });
  it("sign bit flagged on MSB only", () => {
    const cells = buildBitGrid(0n, 16);
    expect(cells.filter((c) => c.isSign)).toHaveLength(1);
    expect(cells[0].isSign).toBe(true);
  });
  it("weights are powers of two", () => {
    const cells = buildBitGrid(1n, 8);
    expect(cells[cells.length - 1].weight).toBe(1n);
    expect(cells[0].weight).toBe(128n);
  });
});

describe("int-range history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "300", typeId: "c-uint8_t", mode: "default", fits: false, wrappedDec: "44" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: String(i), typeId: "c-int32_t", mode: "default", fits: true, wrappedDec: String(i) });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "1", typeId: "c-int32_t", mode: "default", fits: true, wrappedDec: "1" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("int-range shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("300", "c-uint8_t", "default");
    expect(url).toContain("v=300");
    expect(url).toContain("t=c-uint8_t");
    // default mode should not be encoded
    expect(url).not.toContain("m=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("encodes non-default mode", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("300", "rust-i32", "debug");
    expect(url).toContain("m=debug");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("v=300&t=c-uint8_t&m=release");
    expect(p.input).toBe("300");
    expect(p.typeId).toBe("c-uint8_t");
    expect(p.mode).toBe("release");
  });
  it("uses defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.input).toBe("");
    expect(p.typeId).toBe("c-int32_t");
    expect(p.mode).toBe("default");
  });
  it("falls back to default for unknown mode", () => {
    const p = parseShareUrl("v=1&t=c-int8_t&m=bogus");
    expect(p.mode).toBe("default");
  });
});

// Suppress unused-import lint
export type _Unused = Language | BuildMode | IntegerType;
