/**
 * Scientific Notation Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  convertNotation, parseNotation, toScientific, toEngineering, toENotation,
  toSIPrefixed, toWordForm, toIEEE754, toBinaryScientific, compareNotation,
  batchConvert, toCsv,
} from "./logic";

describe("parseNotation", () => {
  it("parses plain decimals", () => {
    expect(parseNotation("1234")).toBe(1234);
    expect(parseNotation("-5.5")).toBe(-5.5);
  });
  it("parses E-notation", () => {
    expect(parseNotation("1.5e3")).toBe(1500);
    expect(parseNotation("1.5E3")).toBe(1500);
  });
  it("parses ×10^ format", () => {
    expect(parseNotation("1.5×10^3")).toBe(1500);
    expect(parseNotation("1.5 x 10^3")).toBe(1500);
  });
  it("errors on invalid", () => {
    expect(typeof parseNotation("abc")).toBe("object");
  });
  it("errors on empty", () => {
    expect(typeof parseNotation("")).toBe("object");
  });
});

describe("toScientific", () => {
  it("formats 1234 as 1.234 × 10^3", () => {
    const s = toScientific(1234);
    expect(s.mantissa).toBeCloseTo(1.234, 5);
    expect(s.exponent).toBe(3);
  });
  it("handles 0", () => {
    const s = toScientific(0);
    expect(s.mantissa).toBe(0);
    expect(s.exponent).toBe(0);
  });
  it("handles negatives", () => {
    const s = toScientific(-1500);
    expect(s.mantissa).toBeCloseTo(-1.5, 5);
    expect(s.exponent).toBe(3);
  });
  it("respects significant figures", () => {
    const s = toScientific(1234, 2);
    expect(s.mantissa).toBeCloseTo(1.2, 5);
  });
  it("produces unicode-superscript text", () => {
    const s = toScientific(1000);
    expect(s.text).toContain("10");
    expect(s.ascii).toContain("10^3");
  });
});

describe("toEngineering", () => {
  it("exponent is multiple of 3", () => {
    const e = toEngineering(1500);
    expect(e.exponent % 3).toBe(0);
    expect(e.exponent).toBe(3);
    expect(e.mantissa).toBeCloseTo(1.5, 5);
  });
  it("mantissa in [1, 1000) or (-1000, -1]", () => {
    const e = toEngineering(15000);
    expect(Math.abs(e.mantissa)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(e.mantissa)).toBeLessThan(1000);
    expect(e.exponent).toBe(3);
  });
  it("small numbers", () => {
    const e = toEngineering(0.0015);
    expect(e.exponent).toBe(-3);
    expect(e.mantissa).toBeCloseTo(1.5, 5);
  });
});

describe("toENotation", () => {
  it("formats 1500 as 1.5e+3", () => {
    expect(toENotation(1500, 2)).toBe("1.5e+3");
  });
  it("0 returns 0e+0", () => {
    expect(toENotation(0)).toBe("0e+0");
  });
});

describe("convertNotation — end-to-end", () => {
  it("converts decimal to all formats", () => {
    const r = convertNotation({ value: "1500", sigFigs: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe("1500");
    expect(r.exponent).toBe(3);
    expect(r.eNotation).toContain("e+3");
    expect(r.wordForm).toContain("thousand");
  });
  it("computes order of magnitude", () => {
    const r = convertNotation({ value: "12345" });
    if ("error" in r) throw new Error("err");
    expect(r.orderOfMagnitude).toBe(4);
  });
  it("computes digit count and leading zeros", () => {
    const r = convertNotation({ value: "0.0015" });
    if ("error" in r) throw new Error("err");
    expect(r.leadingZeros).toBe(2);
    expect(r.digitCount).toBe(-2);
  });
});

describe("toSIPrefixed", () => {
  it("1500 → k", () => {
    const s = toSIPrefixed(1500);
    expect(s?.prefix).toBe("k");
    expect(s?.value).toBeCloseTo(1.5, 5);
  });
  it("0.0015 → m", () => {
    const s = toSIPrefixed(0.0015);
    expect(s?.prefix).toBe("m");
  });
  it("0 returns null", () => {
    expect(toSIPrefixed(0)).toBeNull();
  });
});

describe("toWordForm", () => {
  it("1.5 million", () => {
    expect(toWordForm(1_500_000)).toBe("1.5 million");
  });
  it("1 billion", () => {
    expect(toWordForm(1_000_000_000)).toBe("1 billion");
  });
  it("0 returns null", () => {
    expect(toWordForm(0)).toBeNull();
  });
});

describe("toIEEE754", () => {
  it("1.0 has known hex", () => {
    const r = toIEEE754(1.0);
    expect(r.float64Hex).toBe("3FF0000000000000");
  });
  it("Infinity", () => {
    const r = toIEEE754(Number.POSITIVE_INFINITY);
    expect(r.float64Hex).toBe("7FF0000000000000");
  });
  it("float32 hex for 1.0", () => {
    const r = toIEEE754(1.0);
    expect(r.float32Hex).toBe("3F800000");
  });
});

describe("toBinaryScientific", () => {
  it("8 = 1 × 2^3", () => {
    expect(toBinaryScientific(8)).toContain("2");
  });
  it("0 returns 0 × 2⁰", () => {
    expect(toBinaryScientific(0)).toBe("0 × 2⁰");
  });
});

describe("compareNotation", () => {
  it("returns -1 when a < b", () => {
    expect(compareNotation("1e2", "1e3")).toBe(-1);
  });
  it("returns 1 when a > b", () => {
    expect(compareNotation("1e3", "1e2")).toBe(1);
  });
  it("returns 0 when equal", () => {
    expect(compareNotation("100", "1e2")).toBe(0);
  });
  it("errors on invalid", () => {
    expect(typeof compareNotation("abc", "1")).toBe("object");
  });
});

describe("batchConvert", () => {
  it("processes multiple values", () => {
    const { results, errors } = batchConvert("100\n200\nabc", 3);
    expect(results.length).toBe(2);
    expect(errors.length).toBe(1);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = convertNotation({ value: "1500" });
    if ("error" in r) throw new Error("err");
    const csv = toCsv([r]);
    expect(csv.split("\n")[0]).toContain("Input");
    expect(csv).toContain("Scientific");
  });
});
