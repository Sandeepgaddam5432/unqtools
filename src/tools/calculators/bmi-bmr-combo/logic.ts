/**
 * BMI + BMR (Mifflin-St Jeor) + TDEE + daily calories.
 */
export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

export interface BmiBmrInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activity: ActivityLevel;
}

export interface BmiBmrResult {
  bmi: number;
  bmiCategory: string;
  bmr: number;       // Mifflin-St Jeor
  tdee: number;      // BMR × activity
  maintain: number;
  loseHalfKg: number;  // -500 kcal/day
  gainHalfKg: number;  // +500 kcal/day
}

/** Compute BMI = weight / height² (kg/m²). */
export function computeBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  if (m <= 0) return 0;
  return weightKg / (m * m);
}

/** Categorize BMI per WHO. */
export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

/** Compute BMR using Mifflin-St Jeor. */
export function computeBmr(input: BmiBmrInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return input.sex === "male" ? base + 5 : base - 161;
}

/** Full results. */
export function compute(input: BmiBmrInput): BmiBmrResult {
  const bmi = computeBmi(input.weightKg, input.heightCm);
  const bmr = computeBmr(input);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activity];
  return {
    bmi,
    bmiCategory: bmiCategory(bmi),
    bmr,
    tdee,
    maintain: tdee,
    loseHalfKg: tdee - 500,
    gainHalfKg: tdee + 500,
  };
}

export function validateInput(input: BmiBmrInput): { ok: true } | { error: string } {
  if (input.weightKg <= 0 || input.heightCm <= 0 || input.ageYears <= 0) {
    return { error: "Weight, height, and age must be positive" };
  }
  if (!["male", "female"].includes(input.sex)) return { error: "Invalid sex" };
  if (!Object.keys(ACTIVITY_MULTIPLIERS).includes(input.activity)) return { error: "Invalid activity level" };
  return { ok: true };
}
