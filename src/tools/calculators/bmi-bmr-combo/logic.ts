/**
 * BMI + BMR (Mifflin-St Jeor / Harris-Benedict) + TDEE + daily calories.
 *
 * Extras beyond the original thin tool (10+):
 *   1. BMI computation
 *   2. BMI category (WHO classification)
 *   3. BMR via Mifflin-St Jeor
 *   4. BMR via Harris-Benedict (alternative)
 *   5. TDEE with 5 activity levels
 *   6. Daily calories for maintain / lose / gain
 *   7. Macro split (protein/carb/fat) calculator
 *   8. Imperial / metric unit conversion
 *   9. Batch processing for multiple people
 *  10. CSV export
 *  11. Validation with detailed error messages
 *  12. Ideal weight (Devine formula)
 */
export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";
export type UnitSystem = "metric" | "imperial";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Little or no exercise",
  light: "Light exercise 1-3 days/week",
  moderate: "Moderate exercise 3-5 days/week",
  active: "Hard exercise 6-7 days/week",
  "very-active": "Very hard exercise / physical job",
};

export interface BmiBmrInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activity: ActivityLevel;
}

export interface MacroSplit {
  protein: { grams: number; kcal: number };
  carbs: { grams: number; kcal: number };
  fat: { grams: number; kcal: number };
}

export interface BmiBmrResult {
  bmi: number;
  bmiCategory: string;
  bmr: number;       // Mifflin-St Jeor
  bmrHarris: number; // Harris-Benedict
  tdee: number;
  maintain: number;
  loseHalfKg: number;
  gainHalfKg: number;
  idealWeightKg: number;
  macros: MacroSplit;
}

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;

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

/** Compute BMR using Harris-Benedict (revised). */
export function computeBmrHarris(input: BmiBmrInput): number {
  if (input.sex === "male") {
    return 88.362 + 13.397 * input.weightKg + 4.799 * input.heightCm - 5.677 * input.ageYears;
  }
  return 447.593 + 9.247 * input.weightKg + 3.098 * input.heightCm - 4.330 * input.ageYears;
}

/** Compute ideal weight via Devine formula. */
export function idealWeightDevine(heightCm: number, sex: Sex): number {
  const inchesOver5ft = Math.max(0, (heightCm - 152.4) / 2.54);
  return sex === "male" ? 50 + 2.3 * inchesOver5ft : 45.5 + 2.3 * inchesOver5ft;
}

/** Compute macro split given total calories and ratio. */
export function computeMacros(
  totalKcal: number,
  proteinPct = 0.30, carbPct = 0.40, fatPct = 0.30,
): MacroSplit | { error: string } {
  if (Math.abs(proteinPct + carbPct + fatPct - 1) > 0.01) return { error: "Macro percentages must sum to 1" };
  if (!isPos(totalKcal)) return { error: "Total kcal must be positive" };
  const proteinKcal = totalKcal * proteinPct;
  const carbKcal = totalKcal * carbPct;
  const fatKcal = totalKcal * fatPct;
  return {
    protein: { grams: proteinKcal / 4, kcal: proteinKcal },
    carbs: { grams: carbKcal / 4, kcal: carbKcal },
    fat: { grams: fatKcal / 9, kcal: fatKcal },
  };
}

/** Full results. */
export function compute(input: BmiBmrInput): BmiBmrResult {
  const bmi = computeBmi(input.weightKg, input.heightCm);
  const bmr = computeBmr(input);
  const bmrHarris = computeBmrHarris(input);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activity];
  const macros = computeMacros(tdee);
  if ("error" in macros) throw new Error(macros.error);
  return {
    bmi,
    bmiCategory: bmiCategory(bmi),
    bmr,
    bmrHarris,
    tdee,
    maintain: tdee,
    loseHalfKg: tdee - 500,
    gainHalfKg: tdee + 500,
    idealWeightKg: idealWeightDevine(input.heightCm, input.sex),
    macros,
  };
}

/** Convert pounds to kilograms. */
export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

/** Convert kilograms to pounds. */
export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}

/** Convert inches to centimetres. */
export function inToCm(inches: number): number {
  return inches * 2.54;
}

/** Convert centimetres to inches. */
export function cmToIn(cm: number): number {
  return cm / 2.54;
}

/** Convert feet+inches to centimetres. */
export function ftInToCm(ft: number, inches = 0): number {
  return (ft * 12 + inches) * 2.54;
}

export function validateInput(input: BmiBmrInput): { ok: true } | { error: string } {
  if (!isPos(input.weightKg) || !isPos(input.heightCm) || !isPos(input.ageYears)) {
    return { error: "Weight, height, and age must be positive" };
  }
  if (input.ageYears > 120) return { error: "Age seems unrealistic" };
  if (!["male", "female"].includes(input.sex)) return { error: "Invalid sex" };
  if (!Object.keys(ACTIVITY_MULTIPLIERS).includes(input.activity)) return { error: "Invalid activity level" };
  return { ok: true };
}

/** Batch-compute results for multiple inputs. */
export function batchCompute(
  inputs: BmiBmrInput[],
): { i: number; result: BmiBmrResult | { error: string } }[] {
  return inputs.map((input, i) => {
    const v = validateInput(input);
    if ("error" in v) return { i, result: v };
    try {
      return { i, result: compute(input) };
    } catch (e) {
      return { i, result: { error: (e as Error).message } };
    }
  });
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: BmiBmrResult | { error: string } }[],
): string {
  const lines = ["index,bmi,category,bmr,tdee,maintain,lose,gain"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,,,,error,`);
    else {
      const x = r.result;
      lines.push(`${r.i},${x.bmi.toFixed(2)},${x.bmiCategory},${x.bmr.toFixed(0)},${x.tdee.toFixed(0)},${x.maintain.toFixed(0)},${x.loseHalfKg.toFixed(0)},${x.gainHalfKg.toFixed(0)}`);
    }
  }
  return lines.join("\n");
}

/** Pretty-print helper. */
export function fmt(n: number, p = 1): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
