import { describe, it, expect } from "vitest";
import {
  percentOf,
  whatPercent,
  percentChange,
  reversePercent,
  addPercent,
  subtractPercent,
  compoundGrowth,
  tipCalc,
  discountCalc,
  batchPercent,
  fractionToPercent,
  decimalToPercent,
  ppmToPercent,
  validateNumber,
  gradeCalc,
  percentToAngle,
  percentToRadians,
  fmt,
} from "./logic";

describe("percentOf", () => {
  it("computes X% of Y", () => {
    expect(percentOf(10, 200).value).toBe(20);
    expect(percentOf(50, 80).value).toBe(40);
  });
  it("handles zero", () => {
    expect(percentOf(0, 100).value).toBe(0);
    expect(percentOf(100, 0).value).toBe(0);
  });
  it("includes formula", () => {
    expect(percentOf(25, 80).formula).toContain("25% × 80");
  });
});

describe("whatPercent", () => {
  it("X is what % of Y", () => {
    expect(whatPercent(20, 200).value).toBe(10);
    expect(whatPercent(50, 50).value).toBe(100);
  });
  it("handles division by zero", () => {
    expect(isNaN(whatPercent(5, 0).value)).toBe(true);
  });
});

describe("percentChange", () => {
  it("detects increase", () => {
    const r = percentChange(100, 150);
    expect(r.value).toBe(50);
    expect(r.formatted).toContain("increase");
  });
  it("detects decrease", () => {
    const r = percentChange(100, 75);
    expect(r.value).toBe(-25);
    expect(r.formatted).toContain("decrease");
  });
  it("handles zero baseline", () => {
    expect(isNaN(percentChange(0, 100).value)).toBe(true);
  });
  it("uses abs in denominator for negative baseline", () => {
    const r = percentChange(-100, 50);
    // ((50 - -100) / |-100|) * 100 = 150
    expect(r.value).toBe(150);
  });
});

describe("reversePercent", () => {
  it("undoes a markup", () => {
    // $120 includes 20% markup → original = 100
    expect(reversePercent(120, 20).value).toBe(100);
  });
  it("handles negative markup (discount)", () => {
    // $80 includes -20% (discount) → original = 100
    expect(reversePercent(80, -20).value).toBe(100);
  });
});

describe("addPercent & subtractPercent", () => {
  it("adds 10% to 100", () => {
    expect(addPercent(100, 10).value).toBe(110);
  });
  it("subtracts 25% from 80", () => {
    expect(subtractPercent(80, 25).value).toBe(60);
  });
  it("subtracts 100% gives zero", () => {
    expect(subtractPercent(50, 100).value).toBe(0);
  });
});

describe("compoundGrowth", () => {
  it("compounds 10% over 3 periods", () => {
    // 1000 * 1.1^3 = 1331
    expect(compoundGrowth(1000, 10, 3).value).toBe(1331);
  });
  it("handles 0 periods", () => {
    expect(compoundGrowth(500, 10, 0).value).toBe(500);
  });
});

describe("tipCalc", () => {
  it("splits bill across people", () => {
    const r = tipCalc(100, 20, 4);
    expect(r.tip).toBe(20);
    expect(r.total).toBe(120);
    expect(r.perPerson).toBe(30);
  });
  it("defaults to 1 person", () => {
    expect(tipCalc(50, 18).perPerson).toBeCloseTo(59, 5);
  });
});

describe("discountCalc", () => {
  it("applies discount", () => {
    const r = discountCalc(200, 25);
    expect(r.saved).toBe(50);
    expect(r.final).toBe(150);
  });
});

describe("batchPercent", () => {
  it("applies 'of' mode", () => {
    const out = batchPercent("100\n200", 10, "of");
    expect(out).toContain("10");
    expect(out).toContain("20");
  });
  it("applies 'add' mode", () => {
    const out = batchPercent("100", 10, "add");
    expect(out).toContain("110");
  });
  it("marks invalid", () => {
    const out = batchPercent("hello", 10, "of");
    expect(out).toContain("INVALID");
  });
});

describe("fraction & decimal conversions", () => {
  it("fractionToPercent", () => {
    expect(fractionToPercent(1, 4).value).toBe(25);
  });
  it("decimalToPercent", () => {
    expect(decimalToPercent(0.42).value).toBe(42);
  });
  it("ppmToPercent", () => {
    expect(ppmToPercent(10000).value).toBe(1);
  });
});

describe("validateNumber", () => {
  it("accepts valid", () => {
    expect(validateNumber("42").value).toBe(42);
  });
  it("rejects empty", () => {
    expect(validateNumber("").error).toBeTruthy();
  });
  it("rejects non-numbers", () => {
    expect(validateNumber("abc").error).toBeTruthy();
  });
});

describe("gradeCalc", () => {
  it("assigns A for ≥93%", () => {
    expect(gradeCalc(93, 100).letter).toBe("A");
    expect(gradeCalc(93, 100).gpa).toBe(4.0);
  });
  it("assigns F for <60%", () => {
    expect(gradeCalc(50, 100).letter).toBe("F");
    expect(gradeCalc(50, 100).gpa).toBe(0);
  });
  it("computes percentage", () => {
    expect(gradeCalc(17, 20).pct).toBe(85);
  });
});

describe("angle & radians", () => {
  it("percentToAngle", () => {
    expect(percentToAngle(25)).toBe(90);
    expect(percentToAngle(100)).toBe(360);
  });
  it("percentToRadians", () => {
    expect(percentToRadians(50)).toBeCloseTo(Math.PI, 5);
  });
});

describe("fmt", () => {
  it("formats with thousands separators", () => {
    expect(fmt(1234567)).toBe("1,234,567");
  });
  it("returns dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
