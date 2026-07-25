import { describe, it, expect } from "vitest";
import {
  process, convertAll, convertBatch, toCsv, batchToCsv, swap, bestFitUnit,
  formatSize, transferTime, formatDuration, validateOptions, unitsBySystem,
  sumStorage, roundTo, TO_BITS, UNIT_LABELS, UNIT_SYSTEM, PRESETS, ALL_UNITS,
} from "./logic";

describe("process — bytes and bits", () => {
  it("converts byte to bits", () => {
    const r = process(1, { from: "byte", to: "bit" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(8);
  });
  it("converts bits to bytes", () => {
    const r = process(16, { from: "bit", to: "byte" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(2);
  });
  it("returns system flag", () => {
    const r = process(1, { from: "kib", to: "kib" });
    if ("error" in r) throw new Error("err");
    expect(r.system).toBe("binary");
  });
});

describe("process — decimal", () => {
  it("converts KB to bytes", () => {
    const r = process(1, { from: "kb", to: "byte" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts MB to KB", () => {
    const r = process(1, { from: "mb", to: "kb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts GB to MB", () => {
    const r = process(1, { from: "gb", to: "mb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts TB to GB", () => {
    const r = process(1, { from: "tb", to: "gb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts PB to TB", () => {
    const r = process(1, { from: "pb", to: "tb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
});

describe("process — binary", () => {
  it("converts KiB to bytes", () => {
    const r = process(1, { from: "kib", to: "byte" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1024);
  });
  it("converts GiB to MiB", () => {
    const r = process(1, { from: "gib", to: "mib" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1024);
  });
  it("converts TiB to GiB", () => {
    const r = process(1, { from: "tib", to: "gib" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1024);
  });
  it("converts PiB to TiB", () => {
    const r = process(1, { from: "pib", to: "tib" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1024);
  });
});

describe("process — mixed", () => {
  it("converts KB to KiB (decimal to binary)", () => {
    const r = process(1, { from: "kb", to: "kib" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(0.9766, 3);
  });
});

describe("process — edge", () => {
  it("warns on negative input", () => {
    const r = process(-1, { from: "byte", to: "bit" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on NaN", () => {
    expect("error" in process(NaN, { from: "byte", to: "bit" })).toBe(true);
  });
  it("errors on Infinity", () => {
    expect("error" in process(Infinity, { from: "byte", to: "bit" })).toBe(true);
  });
  it("warns on huge value", () => {
    const r = process(1e300, { from: "pb", to: "bit" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("convertAll", () => {
  it("returns all 12 unit conversions", () => {
    const all = convertAll(1, "byte");
    expect(all.length).toBe(12);
  });
  it("byte → bit = 8", () => {
    const all = convertAll(1, "byte");
    const bits = all.find((r) => r.unit === "bit")!;
    expect(bits.value).toBe(8);
  });
});

describe("convertBatch", () => {
  it("processes multiple inputs", () => {
    const r = convertBatch([1, 2, 3], "kb", "byte");
    expect(r.length).toBe(3);
    const first = r[0]!;
    if ("error" in first) throw new Error("err");
    expect(first.output).toBe(1000);
  });
  it("propagates errors", () => {
    const r = convertBatch([1, NaN], "kb", "byte");
    expect("error" in r[1]!).toBe(true);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv(convertAll(1, "byte"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("bit,8");
  });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const inputs = [1, 2];
    const results = convertBatch(inputs, "kb", "byte");
    const csv = batchToCsv(inputs, "kb", "byte", results);
    expect(csv.split("\n")[0]).toBe("Input,From,Output,Unit,System,Warnings");
    expect(csv).toContain("kb");
  });
});

describe("swap", () => {
  it("swaps from and to", () => {
    expect(swap({ from: "byte", to: "bit" })).toEqual({ from: "bit", to: "byte" });
  });
});

describe("bestFitUnit", () => {
  it("returns byte for small", () => { expect(bestFitUnit(80)).toBe("byte"); });
  it("returns kib for ~1KiB", () => { expect(bestFitUnit(8 * 1024)).toBe("kib"); });
  it("returns mib for ~1MiB", () => { expect(bestFitUnit(8 * 1024 * 1024)).toBe("mib"); });
  it("returns pib for huge", () => { expect(bestFitUnit(8 * 1024 ** 6)).toBe("pib"); });
  it("returns byte for 0", () => { expect(bestFitUnit(0)).toBe("byte"); });
});

describe("formatSize", () => {
  it("formats bytes", () => { expect(formatSize(8)).toBe("1.00 B"); });
  it("formats KiB", () => { expect(formatSize(8 * 1024)).toBe("1.00 KiB"); });
  it("formats 0", () => { expect(formatSize(0)).toBe("0 B"); });
  it("handles negative", () => { expect(formatSize(-8)).toBe("-1.00 B"); });
});

describe("transferTime + formatDuration", () => {
  it("computes transfer time", () => {
    const t = transferTime(8000, 1000);
    if (typeof t === "object") throw new Error("err");
    expect(t).toBe(8);
  });
  it("errors on zero bandwidth", () => {
    expect("error" in transferTime(100, 0)).toBe(true);
  });
  it("formats ms", () => { expect(formatDuration(0.5)).toBe("500 ms"); });
  it("formats seconds", () => { expect(formatDuration(30)).toBe("30.0 s"); });
  it("formats minutes", () => { expect(formatDuration(120)).toBe("2.0 min"); });
  it("formats hours", () => { expect(formatDuration(7200)).toBe("2.0 h"); });
  it("formats days", () => { expect(formatDuration(86400 * 3)).toBe("3.0 d"); });
  it("formats n/a for invalid", () => { expect(formatDuration(-1)).toBe("n/a"); });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions({ from: "byte", to: "bit" })).toEqual({ ok: true }); });
  it("rejects invalid from", () => {
    expect(validateOptions({ from: "bogus" as never, to: "byte" })).toHaveProperty("error");
  });
});

describe("unitsBySystem", () => {
  it("lists binary units", () => {
    const bin = unitsBySystem("binary");
    expect(bin).toContain("kib"); expect(bin).toContain("mib"); expect(bin).toContain("gib"); expect(bin).toContain("tib"); expect(bin).toContain("pib");
  });
  it("lists decimal units", () => {
    const dec = unitsBySystem("decimal");
    expect(dec).toContain("bit"); expect(dec).toContain("byte"); expect(dec).toContain("kb");
  });
});

describe("sumStorage", () => {
  it("sums across units", () => {
    const s = sumStorage([{ value: 1, unit: "kib" }, { value: 1024, unit: "byte" }], "byte");
    expect(s).toBe(2048);
  });
});

describe("roundTo", () => {
  it("rounds to significant digits", () => { expect(roundTo(3.14159265, 4)).toBe(3.142); });
});

describe("constants", () => {
  it("TO_BITS has 12 units", () => { expect(Object.keys(TO_BITS).length).toBe(12); });
  it("UNIT_LABELS has 12 units", () => { expect(Object.keys(UNIT_LABELS).length).toBe(12); });
  it("UNIT_SYSTEM has 12 units", () => { expect(Object.keys(UNIT_SYSTEM).length).toBe(12); });
  it("ALL_UNITS has 12 units", () => { expect(ALL_UNITS.length).toBe(12); });
  it("PRESETS has 8 entries", () => { expect(PRESETS.length).toBe(8); });
});
