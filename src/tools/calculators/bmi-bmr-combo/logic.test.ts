import { describe, it, expect } from "vitest";
import {
  computeBmi, bmiCategory, computeBmr, computeBmrHarris, compute,
  validateInput, ACTIVITY_MULTIPLIERS, ACTIVITY_DESCRIPTIONS,
  idealWeightDevine, computeMacros, lbToKg, kgToLb, inToCm, cmToIn,
  ftInToCm, batchCompute, batchToCsv, fmt,
} from "./logic";

describe("computeBmi", () => {
  it("computes correct BMI", () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.86, 1);
  });
  it("returns 0 for zero height", () => {
    expect(computeBmi(70, 0)).toBe(0);
  });
});

describe("bmiCategory", () => {
  it("classifies underweight", () => expect(bmiCategory(17)).toBe("Underweight"));
  it("classifies normal", () => expect(bmiCategory(22)).toBe("Normal weight"));
  it("classifies overweight", () => expect(bmiCategory(27)).toBe("Overweight"));
  it("classifies obese", () => expect(bmiCategory(35)).toBe("Obese"));
  it("classifies boundary 25 as Overweight", () => expect(bmiCategory(25)).toBe("Overweight"));
});

describe("computeBmr (Mifflin-St Jeor)", () => {
  it("computes BMR for male", () => {
    const bmr = computeBmr({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" });
    expect(bmr).toBeCloseTo(1648.75, 1);
  });
  it("computes BMR for female", () => {
    const bmr = computeBmr({ weightKg: 60, heightCm: 165, ageYears: 30, sex: "female", activity: "sedentary" });
    expect(bmr).toBeCloseTo(1320.25, 1);
  });
});

describe("computeBmrHarris", () => {
  it("computes Harris-Benedict for male", () => {
    const bmr = computeBmrHarris({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" });
    expect(bmr).toBeGreaterThan(1600);
    expect(bmr).toBeLessThan(1700);
  });
  it("computes Harris-Benedict for female", () => {
    const bmr = computeBmrHarris({ weightKg: 60, heightCm: 165, ageYears: 30, sex: "female", activity: "sedentary" });
    expect(bmr).toBeGreaterThan(1300);
    expect(bmr).toBeLessThan(1400);
  });
});

describe("idealWeightDevine", () => {
  it("computes ideal weight for male 175cm", () => {
    // 175cm = 5'8.9" → 8.9 inches over 5' → 50 + 8.9*2.3 ≈ 70.5
    expect(idealWeightDevine(175, "male")).toBeCloseTo(70.46, 1);
  });
  it("computes ideal weight for female 165cm", () => {
    expect(idealWeightDevine(165, "female")).toBeCloseTo(57.0, 0);
  });
});

describe("computeMacros", () => {
  it("computes macros for 2000 kcal default split", () => {
    const m = computeMacros(2000);
    if ("error" in m) throw new Error("err");
    expect(m.protein.kcal).toBeCloseTo(600, 1);
    expect(m.fat.grams).toBeCloseTo(66.67, 1);
  });
  it("errors on bad percentages", () => {
    expect(computeMacros(2000, 0.5, 0.4, 0.3)).toHaveProperty("error");
  });
  it("errors on non-positive kcal", () => {
    expect(computeMacros(0)).toHaveProperty("error");
  });
});

describe("compute (full)", () => {
  it("computes full results", () => {
    const r = compute({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "moderate" });
    expect(r.bmi).toBeCloseTo(22.86, 1);
    expect(r.tdee).toBeCloseTo(r.bmr * 1.55, 1);
    expect(r.loseHalfKg).toBeCloseTo(r.tdee - 500, 1);
    expect(r.gainHalfKg).toBeCloseTo(r.tdee + 500, 1);
    expect(r.bmrHarris).toBeGreaterThan(0);
    expect(r.macros.protein.grams).toBeGreaterThan(0);
  });
});

describe("Unit conversions", () => {
  it("lbToKg / kgToLb round-trip", () => {
    expect(kgToLb(lbToKg(150))).toBeCloseTo(150, 3);
  });
  it("1 lb = 0.4536 kg", () => {
    expect(lbToKg(1)).toBeCloseTo(0.4536, 3);
  });
  it("inToCm / cmToIn round-trip", () => {
    expect(cmToIn(inToCm(70))).toBeCloseTo(70, 3);
  });
  it("ftInToCm converts feet+inches", () => {
    expect(ftInToCm(5, 9)).toBeCloseTo(175.26, 1);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" })).toEqual({ ok: true });
  });
  it("rejects zero values", () => {
    expect(validateInput({ weightKg: 0, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" })).toHaveProperty("error");
  });
  it("rejects unrealistic age", () => {
    expect(validateInput({ weightKg: 70, heightCm: 175, ageYears: 200, sex: "male", activity: "sedentary" })).toHaveProperty("error");
  });
  it("rejects invalid sex", () => {
    expect(validateInput({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "bogus" as never, activity: "sedentary" })).toHaveProperty("error");
  });
  it("rejects invalid activity", () => {
    expect(validateInput({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "bogus" as never })).toHaveProperty("error");
  });
});

describe("ACTIVITY_MULTIPLIERS / DESCRIPTIONS", () => {
  it("has 5 levels", () => {
    expect(Object.keys(ACTIVITY_MULTIPLIERS).length).toBe(5);
  });
  it("sedentary is 1.2", () => {
    expect(ACTIVITY_MULTIPLIERS.sedentary).toBe(1.2);
  });
  it("descriptions cover all levels", () => {
    expect(Object.keys(ACTIVITY_DESCRIPTIONS).length).toBe(5);
  });
});

describe("batchCompute / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchCompute([
      { weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" },
      { weightKg: 0, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" },
    ]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchCompute([
      { weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" },
    ]));
    expect(csv.split("\n")[0]).toBe("index,bmi,category,bmr,tdee,maintain,lose,gain");
    expect(csv).toContain("22.86");
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
