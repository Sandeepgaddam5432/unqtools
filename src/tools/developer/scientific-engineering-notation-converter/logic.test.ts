import { describe, it, expect, beforeEach } from "vitest";
import {
  SI_PREFIXES,
  BINARY_PREFIXES,
  ENGINEERING_PREFIXES,
  ROUNDING_MODES,
  detectInputForm,
  parseDecimal,
  parseNumber,
  normalizeBigDec,
  countSigFigs,
  roundToSigFigs,
  formatDecimal,
  formatScientific,
  formatEngineering,
  formatENotation,
  formatSIPrefixed,
  formatBinaryPrefixed,
  convertAll,
  parseBatchInput,
  batchConvert,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BigDec,
  type RoundingMode,
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

describe("scientific-notation constants", () => {
  it("has 25 SI prefixes (incl. empty + µ/u aliases)", () => {
    expect(SI_PREFIXES.length).toBeGreaterThanOrEqual(24);
    expect(SI_PREFIXES.find((p) => p.name === "quetta")?.exp).toBe(30);
    expect(SI_PREFIXES.find((p) => p.name === "quecto")?.exp).toBe(-30);
  });
  it("has 8 binary IEC prefixes from Ki to Yi", () => {
    expect(BINARY_PREFIXES).toHaveLength(8);
    expect(BINARY_PREFIXES[0].prefix).toBe("Ki");
    expect(BINARY_PREFIXES[7].prefix).toBe("Yi");
    expect(BINARY_PREFIXES[7].exp).toBe(80);
  });
  it("engineering prefixes are multiples of 3", () => {
    expect(ENGINEERING_PREFIXES.length).toBeGreaterThan(0);
    for (const p of ENGINEERING_PREFIXES) {
      expect(p.exp % 3 === 0).toBe(true);
    }
  });
  it("has 5 rounding modes", () => {
    expect(ROUNDING_MODES).toEqual([
      "half-up",
      "half-even",
      "half-down",
      "up",
      "down",
    ]);
  });
});

describe("scientific-notation detectInputForm", () => {
  it("detects plain decimal", () => {
    expect(detectInputForm("1234")).toBe("decimal");
    expect(detectInputForm("-0.001")).toBe("decimal");
  });
  it("detects scientific with × 10^", () => {
    expect(detectInputForm("1.234 × 10^5")).toBe("scientific");
    expect(detectInputForm("1.234x10^5")).toBe("scientific");
  });
  it("detects E-notation", () => {
    expect(detectInputForm("1.5e-9")).toBe("e-notation");
    expect(detectInputForm("1.5E9")).toBe("e-notation");
  });
  it("detects SI-prefixed", () => {
    expect(detectInputForm("12.3k")).toBe("si-prefixed");
    expect(detectInputForm("4.7µ")).toBe("si-prefixed");
    expect(detectInputForm("2.5Yi")).toBe("binary-prefixed");
  });
  it("detects unknown", () => {
    expect(detectInputForm("hello")).toBe("unknown");
    expect(detectInputForm("")).toBe("unknown");
  });
});

describe("scientific-notation parseDecimal", () => {
  it("parses integer", () => {
    expect(parseDecimal("1234")).toEqual({ sign: 1, digits: 1234n, exp: 0 });
  });
  it("parses decimal with fraction", () => {
    expect(parseDecimal("1.234")).toEqual({ sign: 1, digits: 1234n, exp: -3 });
  });
  it("parses negative", () => {
    expect(parseDecimal("-0.001")).toEqual({ sign: -1, digits: 1n, exp: -3 });
  });
  it("parses zero variants", () => {
    expect(parseDecimal("0")).toEqual({ sign: 1, digits: 0n, exp: 0 });
    expect(parseDecimal("-0")).toEqual({ sign: 1, digits: 0n, exp: 0 });
    expect(parseDecimal("0.000")).toEqual({ sign: 1, digits: 0n, exp: 0 });
  });
  it("strips leading zeros", () => {
    expect(parseDecimal("000123")).toEqual({ sign: 1, digits: 123n, exp: 0 });
    expect(parseDecimal("000.001")).toEqual({ sign: 1, digits: 1n, exp: -3 });
  });
  it("throws on empty", () => {
    expect(() => parseDecimal("")).toThrow();
    expect(() => parseDecimal("   ")).toThrow();
  });
  it("throws on invalid", () => {
    expect(() => parseDecimal("abc")).toThrow();
    expect(() => parseDecimal("1.2.3")).toThrow();
  });
});

describe("scientific-notation parseNumber (auto-detect)", () => {
  it("parses scientific with × 10^", () => {
    expect(parseNumber("1.234 × 10^5")).toEqual({ sign: 1, digits: 1234n, exp: 2 });
  });
  it("parses E-notation with negative exponent", () => {
    expect(parseNumber("1.5e-9")).toEqual({ sign: 1, digits: 15n, exp: -10 });
  });
  it("parses SI prefix kilo", () => {
    expect(parseNumber("12.3k")).toEqual({ sign: 1, digits: 123n, exp: 2 });
  });
  it("parses SI prefix micro (µ)", () => {
    expect(parseNumber("4.7µ")).toEqual({ sign: 1, digits: 47n, exp: -7 });
  });
  it("parses SI prefix micro (u alias)", () => {
    expect(parseNumber("4.7u")).toEqual({ sign: 1, digits: 47n, exp: -7 });
  });
  it("parses binary IEC prefix kibi", () => {
    // 1 Ki = 1024 = 2^10
    expect(parseNumber("1Ki")).toEqual({ sign: 1, digits: 1024n, exp: 0 });
  });
  it("parses binary IEC prefix mebi with mantissa", () => {
    // 2 Mi = 2 * 2^20 = 2097152
    expect(parseNumber("2Mi")).toEqual({ sign: 1, digits: 2097152n, exp: 0 });
  });
  it("parses zero in scientific form", () => {
    expect(parseNumber("0 × 10^100")).toEqual({ sign: 1, digits: 0n, exp: 0 });
  });
  it("throws on completely invalid", () => {
    expect(() => parseNumber("hello world")).toThrow();
  });
});

describe("scientific-notation normalizeBigDec & countSigFigs", () => {
  it("strips trailing zeros and adjusts exp", () => {
    // 12300 × 10^-2 = 123.00 = 123 → strip 2 trailing zeros: 123 × 10^0.
    expect(normalizeBigDec({ sign: 1, digits: 12300n, exp: -2 }))
      .toEqual({ sign: 1, digits: 123n, exp: 0 });
  });
  it("leaves zero as zero", () => {
    expect(normalizeBigDec({ sign: -1, digits: 0n, exp: 5 }))
      .toEqual({ sign: 1, digits: 0n, exp: 0 });
  });
  it("counts sig figs", () => {
    expect(countSigFigs({ sign: 1, digits: 1234n, exp: 0 })).toBe(4);
    expect(countSigFigs({ sign: 1, digits: 0n, exp: 0 })).toBe(0);
  });
});

describe("scientific-notation roundToSigFigs", () => {
  it("returns input unchanged when sigFigs=0", () => {
    const d: BigDec = { sign: 1, digits: 1234n, exp: 0 };
    expect(roundToSigFigs(d, 0)).toEqual(d);
  });
  it("returns zero unchanged", () => {
    const d: BigDec = { sign: 1, digits: 0n, exp: 0 };
    expect(roundToSigFigs(d, 3)).toEqual(d);
  });
  it("pads with trailing zeros when increasing sig figs", () => {
    expect(roundToSigFigs({ sign: 1, digits: 12n, exp: 0 }, 4))
      .toEqual({ sign: 1, digits: 1200n, exp: -2 });
  });
  it("rounds 1234 to 2 sig figs (half-up)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 1234n, exp: 0 }, 2, "half-up"))
      .toEqual({ sign: 1, digits: 12n, exp: 2 });
  });
  it("rounds 1250 to 2 sig figs (half-up rounds up)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 1250n, exp: 0 }, 2, "half-up"))
      .toEqual({ sign: 1, digits: 13n, exp: 2 });
  });
  it("rounds 1250 to 2 sig figs (half-even rounds to even)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 1250n, exp: 0 }, 2, "half-even"))
      .toEqual({ sign: 1, digits: 12n, exp: 2 });
  });
  it("rounds 1350 to 2 sig figs (half-even rounds to even 14)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 1350n, exp: 0 }, 2, "half-even"))
      .toEqual({ sign: 1, digits: 14n, exp: 2 });
  });
  it("rounds 1234 to 2 sig figs (down truncates)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 1299n, exp: 0 }, 2, "down"))
      .toEqual({ sign: 1, digits: 12n, exp: 2 });
  });
  it("rounds 1201 to 2 sig figs (up rounds away from zero)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 1201n, exp: 0 }, 2, "up"))
      .toEqual({ sign: 1, digits: 13n, exp: 2 });
  });
  it("handles 999 → 1 sig fig (rounding overflow)", () => {
    expect(roundToSigFigs({ sign: 1, digits: 999n, exp: 0 }, 1, "half-up"))
      .toEqual({ sign: 1, digits: 1n, exp: 3 });
  });
  it("preserves sign on negative", () => {
    expect(roundToSigFigs({ sign: -1, digits: 1234n, exp: 0 }, 2, "half-up"))
      .toEqual({ sign: -1, digits: 12n, exp: 2 });
  });
});

describe("scientific-notation formatDecimal", () => {
  it("formats integer", () => {
    expect(formatDecimal({ sign: 1, digits: 1234n, exp: 0 })).toBe("1234");
  });
  it("formats with appended zeros for positive exp", () => {
    expect(formatDecimal({ sign: 1, digits: 123n, exp: 2 })).toBe("12300");
  });
  it("formats with decimal point for negative exp", () => {
    expect(formatDecimal({ sign: 1, digits: 1234n, exp: -2 })).toBe("12.34");
  });
  it("formats with leading zeros for very negative exp", () => {
    expect(formatDecimal({ sign: 1, digits: 1n, exp: -3 })).toBe("0.001");
  });
  it("formats zero", () => {
    expect(formatDecimal({ sign: 1, digits: 0n, exp: 0 })).toBe("0");
  });
  it("formats negative", () => {
    expect(formatDecimal({ sign: -1, digits: 1234n, exp: -3 })).toBe("-1.234");
  });
});

describe("scientific-notation formatScientific", () => {
  it("formats 1234 as 1.234 × 10^3", () => {
    expect(formatScientific({ sign: 1, digits: 1234n, exp: 0 })).toBe("1.234 × 10^3");
  });
  it("formats 0.001 as 1 × 10^-3", () => {
    expect(formatScientific({ sign: 1, digits: 1n, exp: -3 })).toBe("1 × 10^-3");
  });
  it("formats zero", () => {
    expect(formatScientific({ sign: 1, digits: 0n, exp: 0 })).toBe("0 × 10^0");
  });
  it("handles negative", () => {
    expect(formatScientific({ sign: -1, digits: 15n, exp: -10 }))
      .toBe("-1.5 × 10^-9");
  });
  it("supports no-space variant", () => {
    expect(formatScientific({ sign: 1, digits: 1234n, exp: 0 }, false))
      .toBe("1.234×10^3");
  });
});

describe("scientific-notation formatEngineering", () => {
  it("formats 1234 as 1.234 × 10^3 (exp multiple of 3)", () => {
    expect(formatEngineering({ sign: 1, digits: 1234n, exp: 0 })).toBe("1.234 × 10^3");
  });
  it("formats 12300 as 12.3 × 10^3", () => {
    expect(formatEngineering({ sign: 1, digits: 123n, exp: 2 })).toBe("12.3 × 10^3");
  });
  it("formats 123000 as 123 × 10^3", () => {
    expect(formatEngineering({ sign: 1, digits: 123n, exp: 3 })).toBe("123 × 10^3");
  });
  it("formats 0.00123 as 1.23 × 10^-3", () => {
    expect(formatEngineering({ sign: 1, digits: 123n, exp: -5 })).toBe("1.23 × 10^-3");
  });
  it("formats 0.00000123 as 1.23 × 10^-6", () => {
    expect(formatEngineering({ sign: 1, digits: 123n, exp: -8 })).toBe("1.23 × 10^-6");
  });
  it("formats zero", () => {
    expect(formatEngineering({ sign: 1, digits: 0n, exp: 0 })).toBe("0 × 10^0");
  });
  it("exponent is always a multiple of 3", () => {
    for (let i = -10; i <= 10; i++) {
      const s = formatEngineering({ sign: 1, digits: 12345n, exp: i });
      const m = s.match(/10\^(-?\d+)/);
      expect(m).toBeTruthy();
      const e = parseInt(m![1], 10);
      expect(e % 3 === 0).toBe(true);
    }
  });
});

describe("scientific-notation formatENotation", () => {
  it("formats 1234 as 1.234e3", () => {
    expect(formatENotation({ sign: 1, digits: 1234n, exp: 0 })).toBe("1.234e3");
  });
  it("formats 0.001 as 1e-3", () => {
    expect(formatENotation({ sign: 1, digits: 1n, exp: -3 })).toBe("1e-3");
  });
  it("formats zero", () => {
    expect(formatENotation({ sign: 1, digits: 0n, exp: 0 })).toBe("0e0");
  });
  it("handles negative", () => {
    expect(formatENotation({ sign: -1, digits: 15n, exp: -10 })).toBe("-1.5e-9");
  });
});

describe("scientific-notation formatSIPrefixed", () => {
  it("formats 12300 as 12.3k", () => {
    expect(formatSIPrefixed({ sign: 1, digits: 123n, exp: 2 })).toBe("12.3k");
  });
  it("formats 4.7e-7 as 470n", () => {
    // 4.7 × 10^-7 = 47 × 10^-8 → 470 × 10^-9 = 470n
    expect(formatSIPrefixed({ sign: 1, digits: 47n, exp: -8 })).toBe("470n");
  });
  it("formats 0.001 as 1m", () => {
    expect(formatSIPrefixed({ sign: 1, digits: 1n, exp: -3 })).toBe("1m");
  });
  it("formats zero", () => {
    expect(formatSIPrefixed({ sign: 1, digits: 0n, exp: 0 })).toBe("0");
  });
  it("falls back to scientific when out of SI range", () => {
    // 10^40 — beyond quetta (10^30)
    const out = formatSIPrefixed({ sign: 1, digits: 1n, exp: 40 });
    expect(out).toContain("× 10^40");
  });
  it("falls back to scientific for very small", () => {
    // 10^-35 — beyond quecto (10^-30)
    const out = formatSIPrefixed({ sign: 1, digits: 1n, exp: -35 });
    expect(out).toContain("× 10^-35");
  });
});

describe("scientific-notation formatBinaryPrefixed", () => {
  it("formats 1024 as 1Ki", () => {
    expect(formatBinaryPrefixed({ sign: 1, digits: 1024n, exp: 0 })).toBe("1Ki");
  });
  it("formats 2097152 as 2Mi", () => {
    expect(formatBinaryPrefixed({ sign: 1, digits: 2097152n, exp: 0 })).toBe("2Mi");
  });
  it("formats 1500 as 1.464Ki (with fraction)", () => {
    // 1500 / 1024 = 1.46484375, 3 frac digits → 1464 → 1.464Ki (trailing 0 stripped)
    expect(formatBinaryPrefixed({ sign: 1, digits: 1500n, exp: 0 })).toBe("1.464Ki");
  });
  it("formats 512 as plain decimal (below Ki threshold)", () => {
    expect(formatBinaryPrefixed({ sign: 1, digits: 512n, exp: 0 })).toBe("512");
  });
  it("falls back for non-integer BigDec", () => {
    expect(formatBinaryPrefixed({ sign: 1, digits: 15n, exp: -10 }))
      .toContain("× 10^");
  });
  it("falls back for negative", () => {
    expect(formatBinaryPrefixed({ sign: -1, digits: 1024n, exp: 0 }))
      .toContain("× 10^");
  });
});

describe("scientific-notation convertAll", () => {
  it("converts decimal input to all forms", () => {
    const r = convertAll("12300");
    expect(r.decimal).toBe("12300");
    expect(r.scientific).toBe("1.23 × 10^4");
    expect(r.engineering).toBe("12.3 × 10^3");
    expect(r.eNotation).toBe("1.23e4");
    expect(r.siPrefixed).toBe("12.3k");
    expect(r.form).toBe("decimal");
    expect(r.error).toBeUndefined();
  });
  it("converts E-notation input", () => {
    const r = convertAll("1.5e-9");
    expect(r.decimal).toBe("0.0000000015");
    expect(r.eNotation).toBe("1.5e-9");
    expect(r.scientific).toBe("1.5 × 10^-9");
    expect(r.engineering).toBe("1.5 × 10^-9");
    expect(r.siPrefixed).toBe("1.5n");
    expect(r.form).toBe("e-notation");
  });
  it("applies sig-figs rounding", () => {
    const r = convertAll("1234", { sigFigs: 2 });
    expect(r.scientific).toBe("1.2 × 10^3");
    expect(r.decimal).toBe("1200");
  });
  it("returns error for invalid input", () => {
    const r = convertAll("hello");
    expect(r.error).toBeDefined();
    expect(r.decimal).toBe("");
  });
  it("preserves trailing zeros for sig-fig display when requested", () => {
    const r = convertAll("1200", { sigFigs: 4 });
    expect(r.scientific).toBe("1.200 × 10^3");
  });
  it("respects rounding mode (half-even)", () => {
    const rUp = convertAll("1250", { sigFigs: 2, roundingMode: "half-up" });
    const rEven = convertAll("1250", { sigFigs: 2, roundingMode: "half-even" });
    expect(rUp.scientific).toBe("1.3 × 10^3");
    expect(rEven.scientific).toBe("1.2 × 10^3");
  });
  it("handles zero input", () => {
    const r = convertAll("0");
    expect(r.decimal).toBe("0");
    expect(r.scientific).toBe("0 × 10^0");
    expect(r.eNotation).toBe("0e0");
  });
  it("handles very large Avogadro number", () => {
    const r = convertAll("6.02214076e23");
    expect(r.decimal).toBe("602214076000000000000000");
    // 6.022e23 = 602.2 × 10^21 → 602.214076 Z (zetta, 10^21)
    expect(r.siPrefixed).toBe("602.214076Z");
    expect(r.scientific).toBe("6.02214076 × 10^23");
  });
});

describe("scientific-notation batchConvert", () => {
  it("parses batch input", () => {
    expect(parseBatchInput("1\n2\n3")).toEqual(["1", "2", "3"]);
    expect(parseBatchInput("1;2;3")).toEqual(["1", "2", "3"]);
    expect(parseBatchInput("1\n\n2")).toEqual(["1", "2"]);
    expect(parseBatchInput("")).toEqual([]);
  });
  it("converts each line", () => {
    const results = batchConvert(["1234", "1.5e-9"]);
    expect(results).toHaveLength(2);
    expect(results[0].result.decimal).toBe("1234");
    expect(results[1].result.eNotation).toBe("1.5e-9");
  });
});

describe("scientific-notation history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      input: "1234",
      sigFigs: 0,
      roundingMode: "half-up",
      form: "decimal",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].input).toBe("1234");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        input: String(i),
        sigFigs: 0,
        roundingMode: "half-up",
        form: "decimal",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      input: "x",
      sigFigs: 0,
      roundingMode: "half-up",
      form: "decimal",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("scientific-notation share URL", () => {
  it("builds share URL with no window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      input: "1.5e-9",
      sigFigs: 4,
      roundingMode: "half-even",
      binaryPrefixes: true,
    });
    expect(url).toContain("input=1.5e-9");
    expect(url).toContain("sig=4");
    expect(url).toContain("mode=half-even");
    expect(url).toContain("bin=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("input=1.5e-9&sig=4&mode=half-even&bin=1");
    expect(s.input).toBe("1.5e-9");
    expect(s.sigFigs).toBe(4);
    expect(s.roundingMode).toBe("half-even");
    expect(s.binaryPrefixes).toBe(true);
  });
  it("returns defaults for empty hash", () => {
    const s = parseShareUrl("");
    expect(s.input).toBe("");
    expect(s.sigFigs).toBe(0);
    expect(s.roundingMode).toBe("half-up");
    expect(s.binaryPrefixes).toBe(false);
  });
  it("ignores invalid rounding mode", () => {
    const s = parseShareUrl("input=1&mode=bogus");
    expect(s.roundingMode).toBe("half-up");
  });
});

// Suppress unused-import lint
export type _Unused = RoundingMode;
