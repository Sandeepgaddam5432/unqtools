import { describe, it, expect } from "vitest";
import {
  convert,
  convertAll,
  formatNumber,
  parseDataString,
  autoFormat,
  transferTime,
  humanizeDuration,
  binaryVsDecimal,
  batchConvert,
  validateInput,
  mediaEstimate,
  usableCapacity,
  UNITS,
  UNIT_LIST,
} from "./logic";

describe("data-unit-converter core", () => {
  it("converts bytes to bits", () => {
    expect(convert(1, "byte", "bit")).toBe(8);
    expect(convert(1, "bit", "byte")).toBe(0.125);
  });

  it("converts KiB to bytes (binary, 1024)", () => {
    expect(convert(1, "kib", "byte")).toBe(1024);
    expect(convert(2, "kib", "byte")).toBe(2048);
  });

  it("converts KB to bytes (decimal, 1000)", () => {
    expect(convert(1, "kb", "byte")).toBe(1000);
  });

  it("converts between binary and decimal (1 KiB → KB)", () => {
    // 1 KiB = 1024 B; in KB = 1.024
    expect(convert(1, "kib", "kb")).toBeCloseTo(1.024, 6);
  });

  it("converts GiB to GB", () => {
    expect(convert(1, "gib", "gb")).toBeCloseTo(1.073741824, 6);
  });

  it("round-trips conversions", () => {
    const v = convert(42.5, "mib", "gib");
    expect(convert(v, "gib", "mib")).toBeCloseTo(42.5, 6);
  });

  it("returns NaN for invalid units", () => {
    // @ts-expect-error - testing runtime guard
    expect(convert(1, "nonsense", "byte")).toBeNaN();
  });
});

describe("formatNumber", () => {
  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
  it("handles integers", () => {
    expect(formatNumber(1024)).toBe("1,024");
  });
  it("trims trailing zeros", () => {
    expect(formatNumber(1.5, 6)).toBe("1.5");
  });
  it("uses exponential for huge numbers", () => {
    expect(formatNumber(1e20, 4)).toMatch(/e\+/i);
  });
});

describe("convertAll", () => {
  it("returns entries for every unit", () => {
    const table = convertAll(1, "kib");
    expect(table).toHaveLength(UNIT_LIST.length);
    expect(table.find((r) => r.unit.id === "byte")?.value).toBe(1024);
  });
  it("includes formatted strings", () => {
    const table = convertAll(1, "mib");
    const bytes = table.find((r) => r.unit.id === "byte");
    expect(bytes?.formatted).toBeTruthy();
  });
});

describe("parseDataString", () => {
  it("parses '1.5 GiB'", () => {
    const r = parseDataString("1.5 GiB");
    expect(r?.value).toBe(1.5);
    expect(r?.unit).toBe("gib");
  });
  it("parses '1024B' (no space)", () => {
    const r = parseDataString("1024B");
    expect(r?.value).toBe(1024);
    expect(r?.unit).toBe("byte");
  });
  it("returns null for invalid input", () => {
    expect(parseDataString("hello world")).toBeNull();
    expect(parseDataString("10 XB")).toBeNull();
  });
  it("is case-insensitive on symbol", () => {
    expect(parseDataString("1 mib")?.unit).toBe("mib");
    expect(parseDataString("1 MIB")?.unit).toBe("mib");
  });
});

describe("autoFormat", () => {
  it("formats bytes", () => {
    expect(autoFormat(500, "byte")).toMatch(/B$/);
  });
  it("formats KiB as MiB when large", () => {
    expect(autoFormat(2048, "kib")).toMatch(/MiB$/);
  });
  it("formats bits for sub-byte values", () => {
    expect(autoFormat(0.5, "byte")).toMatch(/b$/);
  });
});

describe("transferTime & humanizeDuration", () => {
  it("computes transfer time", () => {
    const r = transferTime(1, "gib", 100, "mb");
    // 1 GiB = 1024^3 bytes = 8*1024^3 bits; 100 MB/s = 100*1e6*8 bits/s
    const expected = (8 * 1024 ** 3) / (100 * 1e6 * 8);
    expect(r.seconds).toBeCloseTo(expected, 4);
  });
  it("handles zero bandwidth", () => {
    expect(transferTime(1, "gib", 0, "mb").seconds).toBe(Infinity);
  });
  it("humanizes seconds", () => {
    expect(humanizeDuration(65)).toBe("1m 5s");
    expect(humanizeDuration(3600)).toBe("1h");
    expect(humanizeDuration(90061)).toBe("1d 1h 1m 1s");
  });
  it("humanizes milliseconds", () => {
    expect(humanizeDuration(0.5)).toBe("500 ms");
  });
});

describe("binaryVsDecimal", () => {
  it("returns ratio > 1 (binary > decimal)", () => {
    const r = binaryVsDecimal("g");
    expect(r.ratio).toBeGreaterThan(1);
    expect(r.pct).toBeGreaterThan(7);
  });
  it("maps prefixes to correct units", () => {
    expect(binaryVsDecimal("k").binary).toBe("kib");
    expect(binaryVsDecimal("k").decimal).toBe("kb");
    expect(binaryVsDecimal("p").binary).toBe("pib");
  });
});

describe("batchConvert", () => {
  it("converts multiple rows", () => {
    const out = batchConvert("1 KiB\n2 KB", "byte");
    expect(out).toContain("1,024 B");
    expect(out).toContain("2,000 B");
  });
  it("marks invalid rows", () => {
    const out = batchConvert("1 KiB\nhello", "byte");
    expect(out).toContain("INVALID");
  });
});

describe("validateInput", () => {
  it("accepts valid numbers", () => {
    expect(validateInput("42").value).toBe(42);
    expect(validateInput("3.14").value).toBeCloseTo(3.14);
  });
  it("rejects empty", () => {
    expect(validateInput("").error).toBeTruthy();
  });
  it("rejects negatives", () => {
    expect(validateInput("-5").error).toBeTruthy();
  });
  it("rejects non-numbers", () => {
    expect(validateInput("abc").error).toBeTruthy();
  });
});

describe("mediaEstimate", () => {
  it("estimates songs that fit", () => {
    // 1 GiB / 5 MB ≈ 214
    const r = mediaEstimate(1, "gib", 5);
    expect(r.count).toBeGreaterThan(200);
    expect(r.count).toBeLessThan(220);
  });
  it("handles zero size", () => {
    expect(mediaEstimate(1, "gib", 0).count).toBe(0);
  });
});

describe("usableCapacity", () => {
  it("applies overhead percentage", () => {
    const r = usableCapacity(1000, "gb", 10);
    // 10% overhead → 900 GB
    expect(r.bytes).toBeCloseTo(900 * 1e9, 0);
    expect(r.human).toBeTruthy();
  });
});

describe("UNITS metadata", () => {
  it("exposes 12 units", () => {
    expect(UNIT_LIST).toHaveLength(12);
  });
  it("marks systems correctly", () => {
    expect(UNITS.kib.system).toBe("binary");
    expect(UNITS.kb.system).toBe("decimal");
    expect(UNITS.bit.system).toBe("base");
  });
});
