/**
 * Calorie Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  calculateCalories,
  calorieTableCsv,
  activityLabel,
  mealPlan,
  ACTIVITY_FACTORS,
  ACTIVITY_LABELS,
} from "./logic";

describe("calculateCalories — validation", () => {
  it("errors on zero age", () => {
    expect("error" in calculateCalories({ age: 0, sex: "male", height: 175, weight: 80 })).toBe(true);
  });
  it("errors on zero weight", () => {
    expect("error" in calculateCalories({ age: 30, sex: "male", height: 175, weight: 0 })).toBe(true);
  });
  it("errors on unrealistic age", () => {
    expect("error" in calculateCalories({ age: 200, sex: "female", height: 165, weight: 60 })).toBe(true);
  });
});

describe("calculateCalories — BMR", () => {
  it("computes male BMR with Mifflin-St Jeor", () => {
    // 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75
    const r = calculateCalories({ age: 30, sex: "male", height: 175, weight: 80 });
    if ("error" in r) throw new Error("should not error");
    expect(r.bmr).toBeCloseTo(1749, 0);
  });
  it("computes female BMR with Mifflin-St Jeor", () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25
    const r = calculateCalories({ age: 28, sex: "female", height: 165, weight: 60 });
    if ("error" in r) throw new Error("should not error");
    expect(r.bmr).toBeCloseTo(1330, 0);
  });
  it("computes BMR using imperial units", () => {
    // 80 kg = 176.37 lb; 175 cm = 68.9 in
    const r = calculateCalories({ age: 30, sex: "male", height: 68.9, weight: 176.37, unitSystem: "imperial" });
    if ("error" in r) throw new Error("should not error");
    expect(r.bmr).toBeCloseTo(1749, -1);
    expect(r.unitLabel).toBe("lb");
  });
});

describe("calculateCalories — TDEE", () => {
  it("scales TDEE by activity factor", () => {
    const r = calculateCalories({ age: 30, sex: "male", height: 175, weight: 80 });
    if ("error" in r) throw new Error("should not error");
    expect(r.tdee.sedentary).toBeLessThan(r.tdee.light);
    expect(r.tdee.light).toBeLessThan(r.tdee.moderate);
    expect(r.tdee.moderate).toBeLessThan(r.tdee.active);
    expect(r.tdee.active).toBeLessThan(r.tdee.veryActive);
  });
  it("returns selected maintenance calories", () => {
    const r = calculateCalories({ age: 30, sex: "male", height: 175, weight: 80 }, "light");
    if ("error" in r) throw new Error("should not error");
    expect(r.maintenanceCalories).toBe(r.tdee.light);
    expect(r.selectedLevel).toBe("light");
  });
});

describe("calculateCalories — BMI", () => {
  it("classifies normal BMI", () => {
    const r = calculateCalories({ age: 30, sex: "male", height: 175, weight: 80 });
    if ("error" in r) throw new Error("should not error");
    // 80 / 1.75^2 = 26.12 → Overweight
    expect(r.bmiCategory).toBe("Overweight");
  });
  it("warns on underweight", () => {
    const r = calculateCalories({ age: 30, sex: "female", height: 170, weight: 45 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("underweight"))).toBe(true);
  });
});

describe("calculateCalories — goals", () => {
  it("computes daily deficit for weight loss", () => {
    // Current 80kg, target 75kg in 10 weeks → delta = -5 kg
    // Total kcal = 5 * 7700 = 38500; daily = 38500 / 70 = 550 kcal/day
    const r = calculateCalories({ age: 30, sex: "male", height: 175, weight: 80, targetWeight: 75, targetWeeks: 10 });
    if ("error" in r) throw new Error("should not error");
    expect(r.targetWeightDelta).toBeCloseTo(-5, 0);
    expect(r.dailyDelta).toBeCloseTo(-550, -1);
    expect(r.goalCalories).toBeLessThan(r.maintenanceCalories);
  });
  it("computes surplus for weight gain", () => {
    const r = calculateCalories({ age: 25, sex: "male", height: 180, weight: 70, targetWeight: 75, targetWeeks: 10 });
    if ("error" in r) throw new Error("should not error");
    expect(r.targetWeightDelta).toBeGreaterThan(0);
    expect(r.dailyDelta).toBeGreaterThan(0);
  });
  it("warns when goal is below safe minimum", () => {
    const r = calculateCalories({ age: 30, sex: "female", height: 165, weight: 60, targetWeight: 45, targetWeeks: 4 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("minimum"))).toBe(true);
  });
});

describe("calculateCalories — macros", () => {
  it("splits cut / maintain / bulk macros", () => {
    const r = calculateCalories({ age: 30, sex: "male", height: 175, weight: 80 });
    if ("error" in r) throw new Error("should not error");
    expect(r.macros.cut.calories).toBeLessThan(r.macros.maintain.calories);
    expect(r.macros.bulk.calories).toBeGreaterThan(r.macros.maintain.calories);
    expect(r.macros.maintain.ratio.carbs + r.macros.maintain.ratio.protein + r.macros.maintain.ratio.fat).toBe(100);
  });
});

describe("helpers", () => {
  it("activityLabel returns a friendly string", () => {
    expect(activityLabel("sedentary")).toContain("Sedentary");
  });
  it("ACTIVITY_FACTORS has 5 levels", () => {
    expect(Object.keys(ACTIVITY_FACTORS)).toHaveLength(5);
    expect(ACTIVITY_LABELS.veryActive).toBeDefined();
  });
  it("mealPlan sums roughly to target calories", () => {
    const plan = mealPlan(2000);
    const sum = plan.reduce((s, m) => s + m.kcal, 0);
    expect(sum).toBeGreaterThan(1900);
    expect(sum).toBeLessThan(2100);
  });
});

describe("calorieTableCsv", () => {
  it("generates CSV with 5 activity-level rows", () => {
    const csv = calorieTableCsv({ age: 30, sex: "male", height: 175, weight: 80 });
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Activity Level");
    expect(lines.length).toBe(6); // header + 5 levels
  });
  it("returns empty on invalid input", () => {
    expect(calorieTableCsv({ age: 0, sex: "male", height: 0, weight: 0 })).toBe("");
  });
});
