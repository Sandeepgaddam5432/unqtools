import { describe, it, expect } from "vitest";
import { normalizeOctal, isValidOctal, octalDigitToBinary, splitGroups, octalToBinary, validateOptions } from "./logic";

describe("normalizeOctal", () => {
  it("strips non-octal chars", () => {
    expect(normalizeOctal("17 24")).toBe("1724");
  });
  it("removes digits 8 and 9", () => {
    expect(normalizeOctal("89a1")).toBe("1");
  });
  it("returns empty string for no octal", () => {
    expect(normalizeOctal("xyz")).toBe("");
  });
});

describe("isValidOctal", () => {
  it("accepts clean octal", () => {
    expect(isValidOctal("1724")).toBe(true);
  });
  it("rejects digits 8 or 9", () => {
    expect(isValidOctal("8")).toBe(false);
  });
  it("accepts empty string", () => {
    expect(isValidOctal("")).toBe(true);
  });
});

describe("octalDigitToBinary", () => {
  it("converts 0 to 000", () => {
    expect(octalDigitToBinary("0")).toBe("000");
  });
  it("converts 7 to 111", () => {
    expect(octalDigitToBinary("7")).toBe("111");
  });
  it("returns empty for invalid digit", () => {
    expect(octalDigitToBinary("8")).toBe("");
  });
});

describe("splitGroups", () => {
  it("splits into chunks of N digits", () => {
    expect(splitGroups("123456", 3)).toEqual(["123", "456"]);
  });
  it("leaves a partial last group", () => {
    expect(splitGroups("12345", 2)).toEqual(["12", "34", "5"]);
  });
});

describe("octalToBinary", () => {
  it("converts octal to binary", () => {
    const r = octalToBinary("7", { separator: " ", digitsPerGroup: 1 });
    expect(r.output).toBe("111");
  });
  it("handles multiple groups with separator", () => {
    const r = octalToBinary("12", { separator: "-", digitsPerGroup: 1 });
    expect(r.output).toBe("001-010");
  });
  it("handles empty input", () => {
    const r = octalToBinary("", { separator: " ", digitsPerGroup: 1 });
    expect(r.output).toBe("");
    expect(r.groupCount).toBe(0);
  });
  it("groups multiple digits per chunk", () => {
    const r = octalToBinary("123", { separator: " ", digitsPerGroup: 3 });
    expect(r.output).toBe("001010011");
  });
});

describe("validateOptions", () => {
  it("accepts valid digits per group", () => {
    expect(validateOptions({ separator: " ", digitsPerGroup: 2 })).toEqual({ ok: true });
  });
  it("rejects invalid digits per group", () => {
    expect(validateOptions({ separator: " ", digitsPerGroup: 5 })).toHaveProperty("error");
  });
});
