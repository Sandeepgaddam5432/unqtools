import { describe, it, expect } from "vitest";
import { computeBmi, bmiCategory, computeBmr, compute, validateInput, ACTIVITY_MULTIPLIERS } from "./logic";

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
});

describe("computeBmr", () => {
  it("computes BMR for male", () => {
    const bmr = computeBmr({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" });
    expect(bmr).toBeCloseTo(1648.75, 1);
  });
  it("computes BMR for female", () => {
    const bmr = computeBmr({ weightKg: 60, heightCm: 165, ageYears: 30, sex: "female", activity: "sedentary" });
    expect(bmr).toBeCloseTo(1320.25, 1);
  });
});

describe("compute", () => {
  it("computes full results", () => {
    const r = compute({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "moderate" });
    expect(r.bmi).toBeCloseTo(22.86, 1);
    expect(r.tdee).toBeCloseTo(r.bmr * 1.55, 1);
    expect(r.loseHalfKg).toBeCloseTo(r.tdee - 500, 1);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" })).toEqual({ ok: true });
  });
  it("rejects zero values", () => {
    expect(validateInput({ weightKg: 0, heightCm: 175, ageYears: 30, sex: "male", activity: "sedentary" })).toHaveProperty("error");
  });
});

describe("ACTIVITY_MULTIPLIERS", () => {
  it("has 5 levels", () => {
    expect(Object.keys(ACTIVITY_MULTIPLIERS).length).toBe(5);
  });
  it("sedentary is 1.2", () => {
    expect(ACTIVITY_MULTIPLIERS.sedentary).toBe(1.2);
  });
});
