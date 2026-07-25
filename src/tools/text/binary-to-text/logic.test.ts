import { describe, it, expect } from "vitest";
import { normalizeBinary, splitGroups, binaryToCode, binaryToText, validateOptions } from "./logic";

describe("normalizeBinary", () => {
  it("strips whitespace and separators", () => {
    expect(normalizeBinary("01000001 01101001")).toBe("0100000101101001");
  });
  it("strips non-binary characters", () => {
    expect(normalizeBinary("0100.0001,0110/1001")).toBe("0100000101101001");
  });
  it("handles empty input", () => {
    expect(normalizeBinary("")).toBe("");
  });
  it("preserves only 0 and 1", () => {
    expect(normalizeBinary("0a1b2c3")).toBe("01");
  });
});

describe("splitGroups", () => {
  it("splits into 8-bit groups", () => {
    expect(splitGroups("0100000101101001", 8)).toEqual(["01000001", "01101001"]);
  });
  it("pads the last group with zeros", () => {
    expect(splitGroups("01000001", 8)).toEqual(["01000001"]);
    expect(splitGroups("0100001", 8)).toEqual(["01000010"]);
  });
  it("returns empty array for bits <= 0", () => {
    expect(splitGroups("01010101", 0)).toEqual([]);
  });
});

describe("binaryToCode", () => {
  it("converts binary string to code", () => {
    expect(binaryToCode("01000001")).toBe(65);
    expect(binaryToCode("01101001")).toBe(105);
  });
  it("returns NaN for non-binary", () => {
    expect(binaryToCode("abc")).toBeNaN();
  });
  it("handles empty string", () => {
    expect(binaryToCode("")).toBeNaN();
  });
});

describe("binaryToText", () => {
  it("converts 8-bit binary to 'Hi'", () => {
    const r = binaryToText("01001000 01101001", { bits: 8 });
    expect(r.output).toBe("Hi");
    expect(r.groupCount).toBe(2);
    expect(r.invalidGroups).toBe(0);
  });
  it("handles empty input", () => {
    const r = binaryToText("", { bits: 8 });
    expect(r.output).toBe("");
    expect(r.groupCount).toBe(0);
  });
  it("handles 7-bit ASCII", () => {
    const r = binaryToText("1000001", { bits: 7 });
    expect(r.output).toBe("A");
  });
  it("counts invalid groups", () => {
    // Padded last group should still be valid; only NaN codes count as invalid
    const r = binaryToText("01000001", { bits: 8 });
    expect(r.invalidGroups).toBe(0);
  });
  it("decodes unicode with 16-bit groups", () => {
    const r = binaryToText("0000000001000001", { bits: 16 });
    expect(r.output).toBe("A");
  });
});

describe("validateOptions", () => {
  it("accepts 7, 8, 16", () => {
    expect(validateOptions({ bits: 7 })).toEqual({ ok: true });
    expect(validateOptions({ bits: 8 })).toEqual({ ok: true });
    expect(validateOptions({ bits: 16 })).toEqual({ ok: true });
  });
  it("rejects other widths", () => {
    // @ts-expect-error testing invalid input
    expect(validateOptions({ bits: 12 })).toHaveProperty("error");
  });
});
