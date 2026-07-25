import { describe, it, expect } from "vitest";
import {
  charToBinary,
  textToBinary,
  textToBinaryBatch,
  batchToCsv,
  validateOptions,
  binaryToText,
  resolvePrefix,
  encodeToCodes,
  historyToCsv,
  batchStats,
  asciiReferenceTable,
} from "./logic";

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
  it("returns zeros for negative code", () => {
    expect(charToBinary(-5, 8)).toBe("00000000");
  });
});

describe("resolvePrefix", () => {
  it("returns empty for none", () => {
    expect(resolvePrefix({ bits: 8, separator: " ", uppercase: false })).toBe("");
  });
  it("returns 0b for prefixMode 0b", () => {
    expect(resolvePrefix({ bits: 8, separator: " ", uppercase: false, prefixMode: "0b" })).toBe("0b");
  });
  it("returns custom prefix", () => {
    expect(resolvePrefix({ bits: 8, separator: " ", uppercase: false, prefixMode: "custom", customPrefix: "B:" })).toBe("B:");
  });
  it("returns empty when custom mode has no value", () => {
    expect(resolvePrefix({ bits: 8, separator: " ", uppercase: false, prefixMode: "custom" })).toBe("");
  });
});

describe("encodeToCodes", () => {
  it("encodes ASCII as single codes", () => {
    expect(encodeToCodes("AB", { bits: 8, separator: " ", uppercase: false })).toEqual([65, 66]);
  });
  it("encodes UTF-8 multi-byte", () => {
    const codes = encodeToCodes("€", { bits: 8, separator: " ", uppercase: false, encoding: "utf8" });
    expect(codes).toEqual([0xe2, 0x82, 0xac]);
  });
  it("masks to 7 bits in 7-bit mode", () => {
    expect(encodeToCodes("ÿ", { bits: 7, separator: " ", uppercase: false })).toEqual([0x7f]);
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
  it("prepends 0b prefix when configured", () => {
    const r = textToBinary("AB", { bits: 8, separator: " ", uppercase: false, prefixMode: "0b" });
    expect(r.output).toBe("0b01000001 0b01000010");
  });
  it("encodes multi-byte as UTF-8 bytes", () => {
    const r = textToBinary("€", { bits: 8, separator: " ", uppercase: false, encoding: "utf8" });
    expect(r.groupCount).toBe(3);
    expect(r.output).toBe("11100010 10000010 10101100");
  });
  it("warns when 7-bit masks non-ASCII", () => {
    const r = textToBinary("é", { bits: 7, separator: " ", uppercase: false });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("reports totalBits and density", () => {
    const r = textToBinary("AB", { bits: 8, separator: " ", uppercase: false });
    expect(r.totalBits).toBe(16);
    expect(r.density).toBeGreaterThan(0);
  });
});

describe("binaryToText", () => {
  it("reverses simple ASCII", () => {
    const r = binaryToText("01000001 01000010", { bits: 8, separator: " ", uppercase: false });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("AB");
    expect(r.groups).toBe(2);
  });
  it("strips 0b prefix when reversing", () => {
    const r = binaryToText("0b01000001 0b01000010", { bits: 8, separator: " ", uppercase: false, prefixMode: "0b" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("AB");
  });
  it("chunks by bit width when no separator", () => {
    const r = binaryToText("0100000101000010", { bits: 8, separator: "", uppercase: false });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("AB");
  });
  it("errors on invalid token", () => {
    const r = binaryToText("01000001 nope", { bits: 8, separator: " ", uppercase: false });
    expect("error" in r).toBe(true);
  });
  it("empty input gives empty output", () => {
    const r = binaryToText("   ", { bits: 8, separator: " ", uppercase: false });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("");
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
    expect(csv.split("\n")[0]).toBe("Input,Binary,Groups,Bits");
    expect(csv).toContain("01000001");
  });
  it("escapes quotes", () => {
    const r = textToBinaryBatch(['has "quote"'], { bits: 8, separator: " ", uppercase: false });
    const csv = batchToCsv(r, ['has "quote"']);
    expect(csv).toContain('""quote""');
  });
});

describe("batchStats", () => {
  it("aggregates batch metrics", () => {
    const r = textToBinaryBatch(["A", "AB"], { bits: 8, separator: " ", uppercase: false });
    const s = batchStats(r);
    expect(s.totalGroups).toBe(3);
    expect(s.totalBits).toBe(24);
  });
  it("returns zero for empty batch", () => {
    const s = batchStats([]);
    expect(s.totalGroups).toBe(0);
    expect(s.meanGroupsPerRow).toBe(0);
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([{ ts: 1700000000000, input: "A", bits: 8, groupCount: 1, outputLength: 8 }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Bits,Input,GroupCount,OutputLength");
    expect(csv).toContain("A");
  });
});

describe("asciiReferenceTable", () => {
  it("includes A-Z, a-z, 0-9", () => {
    const t = asciiReferenceTable();
    expect(t.length).toBeGreaterThan(50);
    const a = t.find((e) => e.char === "A")!;
    expect(a.code).toBe(65);
    expect(a.bits7).toBe("1000001");
    expect(a.bits8).toBe("01000001");
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
  it("rejects custom prefix longer than 8 chars", () => {
    expect(validateOptions({ bits: 8, separator: " ", uppercase: false, prefixMode: "custom", customPrefix: "0b0b0b0b0" })).toHaveProperty("error");
  });
  it("rejects utf8 encoding with 7-bit", () => {
    expect(validateOptions({ bits: 7, separator: " ", uppercase: false, encoding: "utf8" })).toHaveProperty("error");
  });
});
