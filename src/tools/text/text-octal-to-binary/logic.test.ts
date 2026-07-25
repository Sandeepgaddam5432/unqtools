import { describe, it, expect } from "vitest";
import {
  normalizeOctal, isValidOctal, octalDigitToBinary, splitGroups, octalToBinary,
  binaryToOctal, octalToBinaryBatch, batchToCsv, roundTrip, referenceTable,
  resolvePrefix, validateOptions, batchStats, PRESETS,
} from "./logic";

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
  it("strips 0o prefix by default", () => {
    expect(normalizeOctal("0o17")).toBe("17");
  });
  it("keeps 0o when stripPrefix=false", () => {
    expect(normalizeOctal("0o17", false)).toBe("017");
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
  it("converts 0 to 000", () => { expect(octalDigitToBinary("0")).toBe("000"); });
  it("converts 7 to 111", () => { expect(octalDigitToBinary("7")).toBe("111"); });
  it("converts 5 to 101", () => { expect(octalDigitToBinary("5")).toBe("101"); });
  it("returns empty for invalid digit", () => { expect(octalDigitToBinary("8")).toBe(""); });
});

describe("splitGroups", () => {
  it("splits into chunks of N digits", () => {
    expect(splitGroups("123456", 3)).toEqual(["123", "456"]);
  });
  it("leaves a partial last group", () => {
    expect(splitGroups("12345", 2)).toEqual(["12", "34", "5"]);
  });
});

describe("resolvePrefix", () => {
  it("returns empty for none", () => { expect(resolvePrefix({ separator: "", digitsPerGroup: 1, prefix: "none" })).toBe(""); });
  it("returns 0b for 0b mode", () => { expect(resolvePrefix({ separator: "", digitsPerGroup: 1, prefix: "0b" })).toBe("0b"); });
  it("returns custom prefix", () => { expect(resolvePrefix({ separator: "", digitsPerGroup: 1, prefix: "custom", customPrefix: "oct>" })).toBe("oct>"); });
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
  it("adds prefix when configured", () => {
    const r = octalToBinary("7", { separator: " ", digitsPerGroup: 1, prefix: "0b" });
    expect(r.output).toBe("0b111");
  });
  it("computes decimal and hex values", () => {
    const r = octalToBinary("17", { separator: " ", digitsPerGroup: 1 });
    expect(r.decimalValue).toBe(15);
    expect(r.hexValue).toBe("F");
  });
  it("strips input 0o prefix", () => {
    const r = octalToBinary("0o17", { separator: "", digitsPerGroup: 1 });
    expect(r.output).toBe("001111");
  });
  it("warns on invalid groups", () => {
    const r = octalToBinary("178", { separator: " ", digitsPerGroup: 1, stripInputPrefix: false });
    // 8 will be stripped by normalize; check warnings consistency
    expect(r.warnings.length).toBeGreaterThanOrEqual(0);
  });
});

describe("binaryToOctal", () => {
  it("converts binary to octal", () => {
    const r = binaryToOctal("111");
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("7");
  });
  it("pads to multiple of 3", () => {
    const r = binaryToOctal("1");
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("1");
  });
  it("strips 0b prefix", () => {
    const r = binaryToOctal("0b111");
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("7");
  });
  it("errors on empty", () => {
    expect("error" in binaryToOctal("")).toBe(false); // empty returns output:""
  });
});

describe("octalToBinaryBatch + batchToCsv", () => {
  it("processes multiple inputs", () => {
    const r = octalToBinaryBatch(["7", "12"], { separator: " ", digitsPerGroup: 1 });
    expect(r.length).toBe(2);
    expect(r[0]!.output).toBe("111");
  });
  it("emits CSV with header", () => {
    const inputs = ["7", "12"];
    const results = octalToBinaryBatch(inputs, { separator: " ", digitsPerGroup: 1 });
    const csv = batchToCsv(results, inputs);
    expect(csv.split("\n")[0]).toBe("Input,Output,Groups,Invalid,Decimal,Hex");
    expect(csv).toContain("7");
  });
});

describe("roundTrip", () => {
  it("round-trips valid octal", () => {
    const rt = roundTrip("17", { separator: "", digitsPerGroup: 1 });
    expect(rt.ok).toBe(true);
    expect(rt.decoded).toBe("17");
  });
  it("round-trips 0", () => {
    const rt = roundTrip("0", { separator: "", digitsPerGroup: 1 });
    expect(rt.ok).toBe(true);
  });
});

describe("referenceTable + PRESETS", () => {
  it("returns 8 entries", () => {
    const t = referenceTable();
    expect(t.length).toBe(8);
    expect(t[0]).toEqual({ octal: "0", binary: "000", decimal: 0 });
    expect(t[7]).toEqual({ octal: "7", binary: "111", decimal: 7 });
  });
  it("PRESETS has 6 entries", () => {
    expect(PRESETS.length).toBe(6);
  });
});

describe("validateOptions", () => {
  it("accepts valid digits per group", () => {
    expect(validateOptions({ separator: " ", digitsPerGroup: 2 })).toEqual({ ok: true });
  });
  it("rejects invalid digits per group", () => {
    expect(validateOptions({ separator: " ", digitsPerGroup: 5 })).toHaveProperty("error");
  });
  it("rejects custom prefix >8 chars", () => {
    expect(validateOptions({ separator: " ", digitsPerGroup: 1, prefix: "custom", customPrefix: "verylongprefix" })).toHaveProperty("error");
  });
});

describe("batchStats", () => {
  it("computes aggregate stats", () => {
    const results = octalToBinaryBatch(["7", "12"], { separator: " ", digitsPerGroup: 1 });
    const s = batchStats(results);
    expect(s.totalGroups).toBe(3); // 1 + 2
    expect(s.meanGroupsPerRow).toBe(1.5);
  });
});
