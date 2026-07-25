import { describe, it, expect } from "vitest";
import { charToBinary, textToBinary, textToBinaryBatch, batchToCsv, validateOptions } from "./logic";

describe("charToBinary", () => {
  it("converts 'A' to 8-bit binary", () => {
    expect(charToBinary(65, 8)).toBe("01000001");
  });
  it("converts 'A' to 7-bit binary", () => {
    expect(charToBinary(65, 7)).toBe("1000001");
  });
  it("pads with leading zeros", () => {
    expect(charToBinary(1, 8)).toBe("00000001");
  });
  it("truncates overlong codes to bit width", () => {
    expect(charToBinary(255, 8)).toBe("11111111");
  });
  it("handles 16-bit width", () => {
    expect(charToBinary(65, 16)).toBe("0000000001000001");
  });
  it("returns empty for bits <= 0", () => {
    expect(charToBinary(65, 0)).toBe("");
  });
});

describe("textToBinary", () => {
  it("converts 'Hi' to binary with space separator", () => {
    const r = textToBinary("Hi", { bits: 8, separator: " ", uppercase: false });
    expect(r.output).toBe("01001000 01101001");
    expect(r.groupCount).toBe(2);
  });
  it("handles empty input", () => {
    const r = textToBinary("", { bits: 8, separator: " ", uppercase: false });
    expect(r.output).toBe("");
    expect(r.groupCount).toBe(0);
  });
  it("handles unicode via codePointAt", () => {
    const r = textToBinary("🎉", { bits: 16, separator: " ", uppercase: false });
    expect(r.output).not.toBe("");
    expect(r.groupCount).toBe(1);
  });
  it("uppercase has no effect on 0/1 output", () => {
    const r1 = textToBinary("A", { bits: 8, separator: " ", uppercase: false });
    const r2 = textToBinary("A", { bits: 8, separator: " ", uppercase: true });
    expect(r1.output).toBe(r2.output);
  });
});

describe("textToBinaryBatch", () => {
  it("processes multiple lines", () => {
    const r = textToBinaryBatch(["A", "B"], { bits: 8, separator: " ", uppercase: false });
    expect(r.length).toBe(2);
    expect(r[0]!.output).toBe("01000001");
    expect(r[1]!.output).toBe("01000010");
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const r = textToBinaryBatch(["A"], { bits: 8, separator: " ", uppercase: false });
    const csv = batchToCsv(r, ["A"]);
    expect(csv.split("\n")[0]).toBe("Input,Binary,Groups");
    expect(csv).toContain("01000001");
  });
  it("escapes quotes", () => {
    const r = textToBinaryBatch(['has "quote"'], { bits: 8, separator: " ", uppercase: false });
    const csv = batchToCsv(r, ['has "quote"']);
    expect(csv).toContain('""quote""');
  });
});

describe("validateOptions", () => {
  it("accepts 7, 8, 16 bits", () => {
    expect(validateOptions({ bits: 7, separator: " ", uppercase: false })).toEqual({ ok: true });
    expect(validateOptions({ bits: 8, separator: " ", uppercase: false })).toEqual({ ok: true });
    expect(validateOptions({ bits: 16, separator: " ", uppercase: false })).toEqual({ ok: true });
  });
  it("rejects other bit widths", () => {
    // @ts-expect-error testing invalid input
    expect(validateOptions({ bits: 9, separator: " ", uppercase: false })).toHaveProperty("error");
  });
});
