import { describe, it, expect } from "vitest";
import { normalizeBinary, isValidBinary, splitGroups, binaryGroupToOctal, binaryToOctal, validateOptions } from "./logic";

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
  it("reports invalid groups", () => {
    const r = binaryToOctal("01001000", { separator: " ", bits: 3 });
    expect(r.groupCount).toBeGreaterThan(0);
  });
});

describe("validateOptions", () => {
  it("accepts valid bits", () => {
    expect(validateOptions({ separator: " ", bits: 3 })).toEqual({ ok: true });
  });
  it("rejects invalid bits", () => {
    expect(validateOptions({ separator: " ", bits: 5 })).toHaveProperty("error");
  });
});
