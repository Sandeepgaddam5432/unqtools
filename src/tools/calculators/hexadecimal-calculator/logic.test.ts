/**
 * Hexadecimal Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  calculateHex, parseHex, toHex, toBinary, toOctal, popcount, bitLength,
  swapEndian, reverseBits, toAsciiChar, hexToRgb, batchEvaluate, historyToCsv,
} from "./logic";

describe("parseHex", () => {
  it("parses simple hex", () => {
    expect(parseHex("FF")).toBe(255);
    expect(parseHex("0xFF")).toBe(255);
    expect(parseHex("0")).toBe(0);
  });
  it("errors on invalid", () => {
    expect(typeof parseHex("XY")).toBe("object");
  });
  it("handles big values via BigInt", () => {
    const v = parseHex("FFFFFFFFFFFF");
    expect(typeof v).toBe("number");
  });
});

describe("calculateHex — arithmetic", () => {
  it("adds", () => {
    const r = calculateHex({ a: "FF", b: "01", op: "add" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(256);
    expect(r.hex).toBe("100");
  });
  it("subtracts", () => {
    const r = calculateHex({ a: "100", b: "10", op: "sub" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(240);
  });
  it("multiplies", () => {
    const r = calculateHex({ a: "10", b: "10", op: "mul" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(256);
  });
  it("divides (integer)", () => {
    const r = calculateHex({ a: "100", b: "10", op: "div" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(16);
  });
  it("errors on divide by zero", () => {
    expect("error" in calculateHex({ a: "10", b: "0", op: "div" })).toBe(true);
  });
  it("modulo", () => {
    const r = calculateHex({ a: "FF", b: "10", op: "mod" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(15);
  });
});

describe("calculateHex — bitwise", () => {
  it("AND", () => {
    const r = calculateHex({ a: "FF", b: "0F", op: "and" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(15);
  });
  it("OR", () => {
    const r = calculateHex({ a: "F0", b: "0F", op: "or" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(255);
  });
  it("XOR", () => {
    const r = calculateHex({ a: "FF", b: "0F", op: "xor" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(240);
  });
  it("Shift left", () => {
    const r = calculateHex({ a: "01", b: "08", op: "shl" });
    if ("error" in r) throw new Error("err");
    expect(r.decimal).toBe(256);
  });
});

describe("calculateHex — metadata & display", () => {
  it("produces steps", () => {
    const r = calculateHex({ a: "FF", b: "01", op: "add" });
    if ("error" in r) throw new Error("err");
    expect(r.steps.length).toBeGreaterThan(2);
  });
  it("computes popcount and parity", () => {
    const r = calculateHex({ a: "FF", b: "00", op: "or" });
    if ("error" in r) throw new Error("err");
    expect(r.popcount).toBe(8);
    expect(r.parity).toBe("odd");
  });
  it("ascii preview for 0x41", () => {
    const r = calculateHex({ a: "41", b: "00", op: "or" });
    if ("error" in r) throw new Error("err");
    expect(r.ascii).toBe("A");
  });
  it("RGB preview for 6-digit hex", () => {
    const r = calculateHex({ a: "FF8800", b: "00", op: "or" });
    if ("error" in r) throw new Error("err");
    expect(r.rgb).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("warns on bit-width overflow", () => {
    const r = calculateHex({ a: "FF", b: "01", op: "add", bitWidth: 8 });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("formatting helpers", () => {
  it("toHex pads", () => {
    expect(toHex(5, 16)).toBe("0005");
  });
  it("toBinary pads", () => {
    expect(toBinary(5, 8)).toBe("00000101");
  });
  it("toOctal converts", () => {
    expect(toOctal(64)).toBe("100");
  });
  it("popcount of 7 is 3", () => {
    expect(popcount(7)).toBe(3);
  });
  it("bitLength of 8 is 4", () => {
    expect(bitLength(8)).toBe(4);
  });
  it("swapEndian swaps bytes", () => {
    expect(swapEndian(0x12345678, 4)).toBe(0x78563412);
  });
  it("reverseBits within width", () => {
    expect(reverseBits(0b1010, 4)).toBe(0b0101);
  });
  it("toAsciiChar of 0x42 is B", () => {
    expect(toAsciiChar(0x42)).toBe("B");
  });
  it("toAsciiChar of control char is null", () => {
    expect(toAsciiChar(0x01)).toBeNull();
  });
  it("hexToRgb of 0xFFFFFF", () => {
    expect(hexToRgb(0xffffff)).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("hexToRgb of out-of-range", () => {
    expect(hexToRgb(0x1000000)).toBeNull();
  });
});

describe("batchEvaluate", () => {
  it("parses CSV expressions", () => {
    const { results, errors } = batchEvaluate("FF+01\n10&0F");
    expect(results.length).toBe(2);
    expect(errors.length).toBe(0);
    expect(results[0]!.decimal).toBe(256);
  });
  it("reports invalid lines", () => {
    const { errors } = batchEvaluate("invalid\nFF+01");
    expect(errors.length).toBe(1);
  });
});

describe("historyToCsv", () => {
  it("produces CSV with header", () => {
    const csv = historyToCsv([{ expr: "FF+01", hex: "100", decimal: 256, binary: "100000000", ts: 1700000000000 }]);
    expect(csv.split("\n")[0]).toContain("Timestamp");
    expect(csv.split("\n")[1]).toContain("100");
  });
});
