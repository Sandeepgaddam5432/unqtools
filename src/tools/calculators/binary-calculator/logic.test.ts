/**
 * Binary Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  calculateBinary, parseBinary, toBinary, toHex, toOctal, popcount,
  bitLength, reverseBits, toGrayCode, fromGrayCode, onesComplement,
  twosComplement, batchEvaluate, historyToCsv,
} from "./logic";

describe("parseBinary", () => {
  it("parses simple binary", () => {
    expect(parseBinary("1010")).toBe(10);
    expect(parseBinary("0")).toBe(0);
  });
  it("parses fractional binary", () => {
    const v = parseBinary("101.11");
    if (typeof v !== "number") throw new Error("Should be number");
    expect(v).toBeCloseTo(5.75, 5);
  });
  it("errors on invalid input", () => {
    expect(typeof parseBinary("102")).toBe("object");
  });
});

describe("calculateBinary — arithmetic", () => {
  it("adds two binary numbers", () => {
    const r = calculateBinary({ a: "1010", b: "0101", op: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(15);
    expect(r.binary).toBe("1111");
  });
  it("subtracts two binary numbers", () => {
    const r = calculateBinary({ a: "1010", b: "0011", op: "sub" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(7);
    expect(r.binary).toBe("111");
  });
  it("multiplies two binary numbers", () => {
    const r = calculateBinary({ a: "110", b: "11", op: "mul" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(18);
  });
  it("divides with integer quotient", () => {
    const r = calculateBinary({ a: "1100", b: "11", op: "div" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(4);
  });
  it("errors on division by zero", () => {
    expect("error" in calculateBinary({ a: "1010", b: "0", op: "div" })).toBe(true);
  });
});

describe("calculateBinary — bitwise ops", () => {
  it("ANDs two binary numbers", () => {
    const r = calculateBinary({ a: "1100", b: "1010", op: "and" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(8);
  });
  it("ORs two binary numbers", () => {
    const r = calculateBinary({ a: "1100", b: "1010", op: "or" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(14);
  });
  it("XORs two binary numbers", () => {
    const r = calculateBinary({ a: "1100", b: "1010", op: "xor" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(6);
  });
  it("shifts left", () => {
    const r = calculateBinary({ a: "0011", b: "010", op: "shl" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.decimal).toBe(12);
  });
});

describe("calculateBinary — bit width & metadata", () => {
  it("produces steps", () => {
    const r = calculateBinary({ a: "1010", b: "0101", op: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.steps.length).toBeGreaterThan(2);
    expect(r.steps.some((s) => s.description === "Add")).toBe(true);
  });
  it("computes popcount and parity", () => {
    const r = calculateBinary({ a: "1011", b: "0", op: "or" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.popcount).toBe(3);
    expect(r.parity).toBe("odd");
  });
  it("hex and octal outputs", () => {
    const r = calculateBinary({ a: "11111111", b: "0", op: "or" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.hex).toBe("FF");
    expect(r.octal).toBe("377");
  });
  it("warns on overflow", () => {
    const r = calculateBinary({ a: "1111", b: "0001", op: "add", bitWidth: 4 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("formatting helpers", () => {
  it("toBinary pads to bit width", () => {
    expect(toBinary(5, 8)).toBe("00000101");
  });
  it("toBinary of zero is 0", () => {
    expect(toBinary(0)).toBe("0");
  });
  it("toHex of 255 is FF", () => {
    expect(toHex(255)).toBe("FF");
  });
  it("toOctal of 64 is 100", () => {
    expect(toOctal(64)).toBe("100");
  });
  it("popcount of 7 is 3", () => {
    expect(popcount(7)).toBe(3);
  });
  it("bitLength of 0 is 1", () => {
    expect(bitLength(0)).toBe(1);
  });
  it("bitLength of 8 is 4", () => {
    expect(bitLength(8)).toBe(4);
  });
  it("reverseBits within width", () => {
    expect(reverseBits(0b1010, 4)).toBe(0b0101);
  });
  it("ones complement within width", () => {
    expect(onesComplement(0b1010, 4)).toBe(0b0101);
  });
  it("twosComplement of -1 in 8 bits", () => {
    expect(twosComplement(-1, 8)).toBe(0b11111111);
  });
});

describe("Gray code", () => {
  it("encode + decode roundtrip", () => {
    for (let i = 0; i < 32; i++) {
      expect(fromGrayCode(toGrayCode(i))).toBe(i);
    }
  });
  it("gray code of 1 is 1", () => {
    expect(toGrayCode(1)).toBe(1);
  });
  it("gray code of 2 is 3", () => {
    expect(toGrayCode(2)).toBe(3);
  });
});

describe("batchEvaluate", () => {
  it("parses CSV expressions", () => {
    const { results, errors } = batchEvaluate("1010+0101\n1100&1010");
    expect(results.length).toBe(2);
    expect(errors.length).toBe(0);
    expect(results[0]!.decimal).toBe(15);
    expect(results[1]!.decimal).toBe(8);
  });
  it("reports invalid lines", () => {
    const { errors } = batchEvaluate("invalid line\n1010+0101");
    expect(errors.length).toBe(1);
  });
});

describe("historyToCsv", () => {
  it("produces CSV with header", () => {
    const csv = historyToCsv([
      { expr: "1010+0101", binary: "1111", decimal: 15, hex: "F", ts: 1700000000000 },
    ]);
    expect(csv.split("\n")[0]).toContain("Timestamp");
    expect(csv.split("\n")[1]).toContain("1111");
  });
});
