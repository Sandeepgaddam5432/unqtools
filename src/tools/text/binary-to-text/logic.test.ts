import { describe, it, expect } from "vitest";
import {
  normalizeBinary, splitGroups, binaryToCode, binaryToText,
  validateOptions, autoDetectBits, textToBinary, batchConvert,
  batchToCsv, codePointsToHex, codePointsToDec, isValidBinary, fmt,
} from "./logic";

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
  it("returns NaN for non binary", () => {
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
  it("decodes unicode with 16-bit groups", () => {
    const r = binaryToText("0000000001000001", { bits: 16 });
    expect(r.output).toBe("A");
  });
  it("supports UTF-8 decoding (8-bit)", () => {
    // "é" in UTF-8 = 0xC3 0xA9 = 11000011 10101001
    const r = binaryToText("1100001110101001", { bits: 8, utf8: true });
    expect(r.output).toBe("é");
  });
  it("reports per-group errors in strict mode", () => {
    const r = binaryToText("0000000001000001", { bits: 16, strict: true });
    expect(r.groupCount).toBe(1);
  });
  it("records code points", () => {
    const r = binaryToText("01000001", { bits: 8 });
    expect(r.codePoints).toContain(65);
  });
});

describe("autoDetectBits", () => {
  it("returns 8 for multiple of 8", () => {
    expect(autoDetectBits("01000001")).toBe(8);
  });
  it("returns 7 for multiple of 7", () => {
    expect(autoDetectBits("1000001")).toBe(7);
  });
  it("returns 16 for multiple of 16", () => {
    expect(autoDetectBits("0000000001000001")).toBe(16);
  });
  it("returns 8 by default for empty", () => {
    expect(autoDetectBits("")).toBe(8);
  });
});

describe("textToBinary", () => {
  it("encodes 8-bit ASCII", () => {
    expect(textToBinary("A", 8)).toBe("01000001");
  });
  it("encodes 7-bit ASCII", () => {
    expect(textToBinary("A", 7)).toBe("1000001");
  });
  it("encodes 16-bit code points", () => {
    expect(textToBinary("A", 16)).toBe("0000000001000001");
  });
  it("round-trips 8-bit with binaryToText", () => {
    const enc = textToBinary("Hi", 8);
    const r = binaryToText(enc, { bits: 8 });
    expect(r.output).toBe("Hi");
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
  it("rejects UTF-8 with non-8-bit groups", () => {
    expect(validateOptions({ bits: 16, utf8: true })).toHaveProperty("error");
  });
});

describe("batchConvert / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchConvert(["01000001", "01101001"], { bits: 8 });
    expect(r).toHaveLength(2);
    expect(r[0]!.result.output).toBe("A");
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchConvert(["01000001"], { bits: 8 }));
    expect(csv.split("\n")[0]).toBe("index,groupCount,outputLength,invalidGroups,output");
    expect(csv).toContain("A");
  });
});

describe("codePointsToHex / codePointsToDec", () => {
  it("formats as U+XXXX hex", () => {
    expect(codePointsToHex([65, 66])).toContain("U+0041");
  });
  it("formats as decimal", () => {
    expect(codePointsToDec([65, 66])).toBe("65 66");
  });
});

describe("isValidBinary / fmt", () => {
  it("validates pure binary", () => {
    expect(isValidBinary("01010101")).toBe(true);
  });
  it("rejects non-binary", () => {
    expect(isValidBinary("010a0101")).toBe(false);
  });
  it("fmt trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("fmt em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
