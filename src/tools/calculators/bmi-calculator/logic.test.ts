/**
 * BMI Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateBmi, classifyBmi, weightScenariosCsv, fmt } from "./logic";

describe("classifyBmi", () => {
  it("classifies underweight", () => {
    expect(classifyBmi(17.5).label).toBe("Underweight");
    expect(classifyBmi(17.5).color).toBe("blue");
  });
  it("classifies normal", () => {
    expect(classifyBmi(22).label).toBe("Normal weight");
    expect(classifyBmi(22).color).toBe("green");
  });
  it("classifies overweight", () => {
    expect(classifyBmi(27).label).toBe("Overweight");
    expect(classifyBmi(27).color).toBe("yellow");
  });
  it("classifies obese class I", () => {
    expect(classifyBmi(32).label).toBe("Obese (Class I)");
  });
  it("classifies obese class II", () => {
    expect(classifyBmi(37).label).toBe("Obese (Class II)");
  });
  it("classifies obese class III", () => {
    expect(classifyBmi(45).label).toBe("Obese (Class III)");
    expect(classifyBmi(45).color).toBe("red");
  });
  it("handles boundary values", () => {
    expect(classifyBmi(18.5).label).toBe("Normal weight");
    expect(classifyBmi(24.9).label).toBe("Normal weight");
    expect(classifyBmi(25).label).toBe("Overweight");
    expect(classifyBmi(29.9).label).toBe("Overweight");
    expect(classifyBmi(30).label).toBe("Obese (Class I)");
  });
});

describe("calculateBmi — metric", () => {
  it("errors on zero height", () => {
    expect("error" in calculateBmi({ height: 0, weight: 70 })).toBe(true);
  });
  it("errors on zero weight", () => {
    expect("error" in calculateBmi({ height: 170, weight: 0 })).toBe(true);
  });
  it("errors on negative inputs", () => {
    expect("error" in calculateBmi({ height: -10, weight: 70 })).toBe(true);
  });
  it("errors on unrealistically large height", () => {
    expect("error" in calculateBmi({ height: 500, weight: 70 })).toBe(true);
  });
  it("computes correct BMI for 70kg / 170cm", () => {
    // 70 / (1.7^2) = 24.22
    const r = calculateBmi({ height: 170, weight: 70 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.bmi).toBeCloseTo(24.22, 1);
    expect(r.category.label).toBe("Normal weight");
    expect(r.unitLabel).toBe("kg");
  });
  it("computes healthy weight range for 170cm", () => {
    const r = calculateBmi({ height: 170, weight: 70 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.healthyWeightRange.min).toBeCloseTo(53.5, 0); // 18.5 * 1.7^2
    expect(r.healthyWeightRange.max).toBeCloseTo(71.9, 0); // 24.9 * 1.7^2
  });
  it("computes BMI Prime (bmi/25)", () => {
    const r = calculateBmi({ height: 170, weight: 70 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.bmiPrime).toBeCloseTo(r.bmi / 25, 2);
  });
  it("computes body surface area via Mosteller", () => {
    const r = calculateBmi({ height: 170, weight: 70 });
    if ("error" in r) throw new Error("Should not error");
    // sqrt(170 * 70 / 3600) = sqrt(3.3055) = 1.818
    expect(r.bodySurfaceArea).toBeCloseTo(1.82, 1);
  });
  it("computes ponderal index", () => {
    const r = calculateBmi({ height: 170, weight: 70 });
    if ("error" in r) throw new Error("Should not error");
    // 70 / 1.7^3 = 70 / 4.913 = 14.25
    expect(r.ponderalIndex).toBeCloseTo(14.25, 1);
  });
  it("computes weight delta to healthy range", () => {
    const r = calculateBmi({ height: 170, weight: 70 });
    if ("error" in r) throw new Error("Should not error");
    // 70 is in healthy range (53.5-71.9), so toMin = -16.5, toMax = +1.9
    expect(r.weightDeltaToHealthy.toMin).toBeLessThan(0);
    expect(r.weightDeltaToHealthy.toMax).toBeGreaterThan(0);
  });
});

describe("calculateBmi — imperial", () => {
  it("computes BMI in imperial units", () => {
    // 70 inches, 154 lb = 178 cm, 70 kg ≈ BMI 22.1
    const r = calculateBmi({ height: 70, weight: 154, unitSystem: "imperial" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.bmi).toBeCloseTo(22.1, 1);
    expect(r.unitLabel).toBe("lb");
  });
  it("healthy range is in pounds for imperial", () => {
    const r = calculateBmi({ height: 70, weight: 154, unitSystem: "imperial" });
    if ("error" in r) throw new Error("Should not error");
    // Healthy range in kg: 18.5-24.9 * 1.778^2 = 58.5-78.7 kg → 128.9-173.5 lb
    expect(r.healthyWeightRange.min).toBeGreaterThan(120);
    expect(r.healthyWeightRange.min).toBeLessThan(140);
  });
});

describe("calculateBmi — optional extras", () => {
  it("computes BMR for adult male", () => {
    const r = calculateBmi({ height: 175, weight: 80, age: 30, sex: "male" });
    if ("error" in r) throw new Error("Should not error");
    // Mifflin: 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75
    expect(r.bmr).toBeCloseTo(1749, 0);
    expect(r.dailyCalories?.sedentary).toBeCloseTo(2099, 0);
    expect(r.dailyCalories?.veryActive).toBeGreaterThan(r.dailyCalories?.sedentary ?? 0);
  });
  it("computes BMR for adult female", () => {
    const r = calculateBmi({ height: 165, weight: 60, age: 28, sex: "female" });
    if ("error" in r) throw new Error("Should not error");
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25
    expect(r.bmr).toBeCloseTo(1330, 0);
  });
  it("computes macros from maintenance kcal", () => {
    const r = calculateBmi({ height: 175, weight: 80, age: 30, sex: "male" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.macros).toBeDefined();
    if (r.macros) {
      expect(r.macros.carbs).toBeGreaterThan(0);
      expect(r.macros.protein).toBeGreaterThan(0);
      expect(r.macros.fat).toBeGreaterThan(0);
    }
  });
  it("computes pediatric z-score for age 10", () => {
    const r = calculateBmi({ height: 140, weight: 35, age: 10 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.zScore).toBeDefined();
    // 35 / 1.4^2 = 17.86; (17.86 - 21) / 4.5 = -0.7
    expect(r.zScore).toBeCloseTo(-0.7, 1);
  });
  it("does not compute z-score for age > 20", () => {
    const r = calculateBmi({ height: 170, weight: 70, age: 30 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.zScore).toBeUndefined();
  });
  it("computes waist-to-height ratio", () => {
    const r = calculateBmi({ height: 170, weight: 70, waistCm: 85 });
    if ("error" in r) throw new Error("Should not error");
    // 85 / 170 = 0.5
    expect(r.waistToHeight).toBeCloseTo(0.5, 2);
  });
});

describe("weightScenariosCsv", () => {
  it("generates CSV with header + multiple rows", () => {
    const csv = weightScenariosCsv({ height: 170, weight: 70 });
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Weight");
    expect(lines[0]).toContain("BMI");
    expect(lines.length).toBeGreaterThan(5);
  });
  it("returns empty on invalid input", () => {
    expect(weightScenariosCsv({ height: 0, weight: 0 })).toBe("");
  });
});

describe("fmt helper", () => {
  it("formats numbers with default 1 digit", () => {
    expect(fmt(3.14159)).toBe("3.1");
  });
  it("formats with custom digits", () => {
    expect(fmt(3.14159, 3)).toBe("3.142");
  });
  it("handles zero", () => {
    expect(fmt(0)).toBe("0");
  });
});
