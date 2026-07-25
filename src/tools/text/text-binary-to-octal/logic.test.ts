import { describe, it, expect } from "vitest";
import {
  normalizeBinary, isValidBinary, splitGroups, binaryGroupToOctal,
  binaryToOctal, validateOptions, octalToBinary, binaryGroupToDecimal,
  binaryGroupToHex, autoDetectBits, batchConvert, batchToCsv, fmt,
} from "./logic";

describe("normalizeBinary", () => {
  it("strips non-binary chars", () => {
    expect(normalizeBinary("0100 1000")).toBe("01001000");
  });
  it("preserves only 0s and 1s", () => {
    expect(normalizeBinary("abc0101xyz")).toBe("0101");
  });
  it("returns empty string for no binary", () => {
    expect(normalizeBinary("hello")).toBe("");
  });
});

describe("isValidBinary", () => {
  it("accepts clean binary", () => {
    expect(isValidBinary("0101")).toBe(true);
  });
  it("rejects other digits", () => {
    expect(isValidBinary("012")).toBe(false);
  });
  it("accepts empty string", () => {
    expect(isValidBinary("")).toBe(true);
  });
});

describe("splitGroups", () => {
  it("splits into chunks of N bits", () => {
    expect(splitGroups("01001000", 3)).toEqual(["010", "010", "000"]);
  });
  it("pads the last group on the left with zeros", () => {
    const g = splitGroups("0100100", 3);
    expect(g[g.length - 1]!.length).toBe(3);
  });
  it("returns empty array for bits ≤ 0", () => {
    expect(splitGroups("01010101", 0)).toEqual([]);
  });
});

describe("binaryGroupToOctal", () => {
  it("converts 3-bit binary to octal", () => {
    expect(binaryGroupToOctal("111")).toBe("7");
  });
  it("converts 6-bit binary to 2-digit octal", () => {
    expect(binaryGroupToOctal("000111")).toBe("07");
  });
  it("returns empty for invalid binary", () => {
    expect(binaryGroupToOctal("012")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(binaryGroupToOctal("")).toBe("");
  });
});

describe("binaryToOctal", () => {
  it("converts binary to octal", () => {
    const r = binaryToOctal("111", { separator: " ", bits: 3 });
    expect(r.output).toBe("7");
  });
  it("handles multiple groups with separator", () => {
    const r = binaryToOctal("111000", { separator: "-", bits: 3 });
    expect(r.output).toBe("7-0");
  });
  it("handles empty input", () => {
    const r = binaryToOctal("", { separator: " ", bits: 3 });
    expect(r.output).toBe("");
    expect(r.groupCount).toBe(0);
  });
  it("supports prefix option", () => {
    const r = binaryToOctal("111", { separator: " ", bits: 3, prefix: "0o" });
    expect(r.output).toBe("0o7");
  });
  it("collects octalGroups array", () => {
    const r = binaryToOctal("111000", { separator: "-", bits: 3 });
    expect(r.octalGroups).toEqual(["7", "0"]);
  });
  it("reports per-group errors", () => {
    const r = binaryToOctal("01001000", { separator: " ", bits: 3 });
    expect(r.groupCount).toBeGreaterThan(0);
  });
});

describe("octalToBinary (reverse)", () => {
  it("converts octal back to binary", () => {
    const r = octalToBinary("7", 3);
    expect(r).toBe("111");
  });
  it("handles multiple groups with separator", () => {
    const r = octalToBinary("7-0", 3, "-");
    expect(r).toBe("111-000");
  });
  it("errors on invalid octal", () => {
    expect(octalToBinary("89", 3)).toHaveProperty("error");
  });
  it("returns empty for empty input", () => {
    expect(octalToBinary("", 3)).toBe("");
  });
  it("strips 0o prefix", () => {
    const r = octalToBinary("0o7", 3);
    expect(r).toBe("111");
  });
});

describe("binaryGroupToDecimal / binaryGroupToHex", () => {
  it("converts to decimal", () => {
    expect(binaryGroupToDecimal("111")).toBe(7);
  });
  it("returns NaN for invalid", () => {
    expect(binaryGroupToDecimal("abc")).toBeNaN();
  });
  it("converts to hex", () => {
    expect(binaryGroupToHex("1111")).toBe("F");
  });
  it("returns empty for invalid hex", () => {
    expect(binaryGroupToHex("xyz")).toBe("");
  });
});

describe("autoDetectBits", () => {
  it("returns 3 for non-multiple", () => {
    expect(autoDetectBits("0100100")).toBe(3);
  });
  it("returns 6 for multiple of 6", () => {
    expect(autoDetectBits("010011")).toBe(6);
  });
  it("returns 9 for multiple of 9", () => {
    expect(autoDetectBits("010011001")).toBe(9);
  });
  it("returns 12 for multiple of 12", () => {
    expect(autoDetectBits("010011001100")).toBe(12);
  });
  it("returns 3 for empty", () => {
    expect(autoDetectBits("")).toBe(3);
  });
});

describe("validateOptions", () => {
  it("accepts valid bits", () => {
    expect(validateOptions({ separator: " ", bits: 3 })).toEqual({ ok: true });
    expect(validateOptions({ separator: " ", bits: 12 })).toEqual({ ok: true });
  });
  it("rejects invalid bits", () => {
    expect(validateOptions({ separator: " ", bits: 5 })).toHaveProperty("error");
  });
});

describe("batchConvert / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchConvert(["111", "000"], { separator: " ", bits: 3 });
    expect(r).toHaveLength(2);
    expect(r[0]!.result.output).toBe("7");
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchConvert(["111"], { separator: " ", bits: 3 }));
    expect(csv.split("\n")[0]).toBe("index,groupCount,outputLength,invalidGroups,output");
    expect(csv).toContain("7");
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
