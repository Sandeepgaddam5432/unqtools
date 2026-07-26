import { describe, it, expect } from "vitest";
import {
  isValidForBase, parseBaseN, formatBaseN, convert, convertAll,
  customBaseToDecimal, decimalToCustomBase, asciiForByte, referenceTable,
  batchConvert, batchStats, renderReport, renderBatchCsv,
  explainConversion, digitValue, digitChar, getConversionPresets,
  type ConversionInput,
} from "./logic";

describe("binary-decimal-hex digitValue / digitChar", () => {
  it("parses digits 0-9", () => {
    expect(digitValue("0")).toBe(0);
    expect(digitValue("9")).toBe(9);
  });
  it("parses letters A-Z case-insensitively", () => {
    expect(digitValue("A")).toBe(10);
    expect(digitValue("a")).toBe(10);
    expect(digitValue("Z")).toBe(35);
  });
  it("returns 99 for non-digit characters", () => {
    expect(digitValue("!")).toBe(99);
  });
  it("digitChar is the inverse of digitValue", () => {
    for (let i = 0; i < 36; i++) {
      expect(digitValue(digitChar(i))).toBe(i);
    }
  });
});

describe("binary-decimal-hex isValidForBase", () => {
  it("accepts valid binary", () => {
    expect(isValidForBase("1010", "binary")).toBe(true);
  });
  it("rejects invalid binary", () => {
    expect(isValidForBase("1020", "binary")).toBe(false);
  });
  it("accepts valid hex with letters", () => {
    expect(isValidForBase("FFA0", "hex")).toBe(true);
  });
  it("accepts fractions", () => {
    expect(isValidForBase("1010.11", "binary")).toBe(true);
  });
  it("rejects empty", () => {
    expect(isValidForBase("", "decimal")).toBe(false);
  });
});

describe("binary-decimal-hex parseBaseN", () => {
  it("parses binary", () => {
    expect(parseBaseN("1010", 2)).toBe(10);
  });
  it("parses hex", () => {
    expect(parseBaseN("FF", 16)).toBe(255);
  });
  it("parses octal", () => {
    expect(parseBaseN("17", 8)).toBe(15);
  });
  it("parses fractional binary", () => {
    expect(parseBaseN("10.1", 2)).toBeCloseTo(2.5);
  });
  it("returns NaN for invalid digit", () => {
    expect(Number.isNaN(parseBaseN("12", 2))).toBe(true);
  });
  it("handles negative sign", () => {
    expect(parseBaseN("-FF", 16)).toBe(-255);
  });
});

describe("binary-decimal-hex formatBaseN", () => {
  it("formats decimal 10 as binary 1010", () => {
    expect(formatBaseN(10, 2)).toBe("1010");
  });
  it("formats decimal 255 as hex FF", () => {
    expect(formatBaseN(255, 16)).toBe("FF");
  });
  it("formats 0 as 0", () => {
    expect(formatBaseN(0, 2)).toBe("0");
  });
  it("formats negative numbers with sign", () => {
    expect(formatBaseN(-10, 2)).toBe("-1010");
  });
  it("formats fractions", () => {
    expect(formatBaseN(2.5, 2)).toBe("10.1");
  });
});

describe("binary-decimal-hex convert", () => {
  it("converts binary to decimal", () => {
    const r = convert({ value: "1010", from: "binary", to: "decimal" });
    expect(r.isValid).toBe(true);
    expect(r.output).toBe("10");
    expect(r.decimalValue).toBe(10);
  });
  it("converts decimal to hex", () => {
    const r = convert({ value: "255", from: "decimal", to: "hex" });
    expect(r.output).toBe("FF");
  });
  it("reports error on invalid input", () => {
    const r = convert({ value: "999", from: "binary", to: "decimal" });
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/Invalid/i);
  });
  it("adds warning when signed range exceeded", () => {
    const r = convert({ value: "255", from: "decimal", to: "binary", signed: true, bitWidth: 8 });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("binary-decimal-hex explainConversion", () => {
  it("produces step-by-step explanation", () => {
    const steps = explainConversion("FF", "hex", "binary");
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0].description).toMatch(/Parse/);
  });
  it("skips step 2 when target is decimal", () => {
    const steps = explainConversion("1010", "binary", "decimal");
    expect(steps.length).toBe(1);
  });
});

describe("binary-decimal-hex convertAll", () => {
  it("returns all four bases", () => {
    const r = convertAll("255", "decimal");
    expect(r.binary).toBe("11111111");
    expect(r.hex).toBe("FF");
    expect(r.octal).toBe("377");
    expect(r.decimal).toBe("255");
  });
  it("returns empty strings for invalid input", () => {
    const r = convertAll("xyz", "decimal");
    expect(r.binary).toBe("");
  });
});

describe("binary-decimal-hex customBase", () => {
  it("converts to/from custom base", () => {
    expect(customBaseToDecimal("z", 36)).toBe(35);
    expect(decimalToCustomBase(35, 36)).toBe("Z");
  });
  it("returns NaN for out-of-range radix", () => {
    expect(Number.isNaN(customBaseToDecimal("1", 1))).toBe(true);
  });
});

describe("binary-decimal-hex asciiForByte", () => {
  it("returns ASCII char for printable byte", () => {
    expect(asciiForByte(65)).toBe("A");
  });
  it("returns escape for control char", () => {
    expect(asciiForByte(10)).toBe("\\n");
  });
  it("returns hex escape for high byte", () => {
    expect(asciiForByte(200)).toBe("\\xc8");
  });
  it("returns dash for out-of-range", () => {
    expect(asciiForByte(300)).toBe("—");
  });
});

describe("binary-decimal-hex referenceTable", () => {
  it("produces rows for bases 2..16", () => {
    const rows = referenceTable();
    expect(rows.length).toBe(15);
    expect(rows[0].base).toBe(2);
    expect(rows[0].name).toBe("Binary");
    expect(rows[14].base).toBe(16);
  });
});

describe("binary-decimal-hex batchConvert / batchStats", () => {
  it("batch-converts multiple inputs", () => {
    const items: ConversionInput[] = [
      { value: "1010", from: "binary", to: "decimal" },
      { value: "FF", from: "hex", to: "decimal" },
    ];
    const rs = batchConvert(items);
    expect(rs.length).toBe(2);
    expect(rs[0].output).toBe("10");
    expect(rs[1].output).toBe("255");
  });
  it("batchStats aggregates counts", () => {
    const rs = batchConvert([
      { value: "1010", from: "binary", to: "decimal" },
      { value: "zzz", from: "binary", to: "decimal" },
    ]);
    const s = batchStats(rs);
    expect(s.count).toBe(2);
    expect(s.valid).toBe(1);
    expect(s.invalid).toBe(1);
  });
});

describe("binary-decimal-hex renderReport / renderBatchCsv", () => {
  it("renders a report", () => {
    const r = convert({ value: "FF", from: "hex", to: "binary" });
    const text = renderReport(r);
    expect(text).toContain("Number Base Conversion Report");
    expect(text).toContain("Input:");
  });
  it("renders CSV header", () => {
    const csv = renderBatchCsv([]);
    expect(csv.split("\n")[0]).toContain("index,from,to");
  });
});

describe("binary-decimal-hex getConversionPresets", () => {
  it("returns 4 presets", () => {
    expect(getConversionPresets().length).toBe(4);
  });
});
