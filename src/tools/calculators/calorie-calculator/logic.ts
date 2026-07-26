/**
 * Calorie Calculator — pure logic.
 *
 * Computes Basal Metabolic Rate (BMR) using the Mifflin-St Jeor
 * equation, then derives Total Daily Energy Expenditure (TDEE) for
 * five activity levels. Optionally projects a calorie deficit or
 * surplus to reach a target weight and suggests macro splits.
 *
 * Formulas:
 *   Male BMR   = 10·kg + 6.25·cm − 5·age + 5
 *   Female BMR = 10·kg + 6.25·cm − 5·age − 161
 *   TDEE       = BMR × activityFactor
 *
 * This is a screening estimate, not medical advice.
 */

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "veryActive";

export type UnitSystem = "metric" | "imperial";

export interface CalorieInput {
  age: number;
  sex: Sex;
  height: number; // cm (metric) or inches (imperial)
  weight: number; // kg (metric) or pounds (imperial)
  unitSystem?: UnitSystem;
  /** Optional target weight in input unit. */
  targetWeight?: number;
  /** Target weeks to reach goal. */
  targetWeeks?: number;
}

export interface MacroSplit {
  carbs: number; // grams
  protein: number; // grams
  fat: number; // grams
  calories: number;
  ratio: { carbs: number; protein: number; fat: number }; // percentages (sum = 100)
}

export interface CalorieResult {
  bmr: number;
  tdee: Record<ActivityLevel, number>;
  selectedLevel: ActivityLevel;
  maintenanceCalories: number;
  bmi: number;
  bmiCategory: string;
  targetWeightDelta: number; // kg, positive = gain, negative = lose
  dailyDelta: number; // kcal/day to hit goal in targetWeeks
  goalCalories: number; // maintenance + dailyDelta
  projectedWeeksAtRate: number;
  macros: {
    cut: MacroSplit;
    maintain: MacroSplit;
    bulk: MacroSplit;
  };
  unitLabel: "kg" | "lb";
  warnings: string[];
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little/no exercise)",
  light: "Light (1-3 days/week)",
  moderate: "Moderate (3-5 days/week)",
  active: "Active (6-7 days/week)",
  veryActive: "Very Active (physical job + exercise)",
};

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;
const KCAL_PER_KG_FAT = 7700; // approx kcal per kg of body mass change

function classifyBmi(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obese (Class I)";
  if (bmi < 40) return "Obese (Class II)";
  return "Obese (Class III)";
}

function buildMacroSplit(calories: number, carbs: number, protein: number, fat: number): MacroSplit {
  return {
    carbs: Math.round((calories * carbs) / 4),
    protein: Math.round((calories * protein) / 4),
    fat: Math.round((calories * fat) / 9),
    calories: Math.round(calories),
    ratio: { carbs: Math.round(carbs * 100), protein: Math.round(protein * 100), fat: Math.round(fat * 100) },
  };
}

export function calculateCalories(
  input: CalorieInput,
  selectedLevel: ActivityLevel = "moderate",
): CalorieResult | { error: string } {
  const { age, sex, height, weight } = input;
  if (!age || age <= 0) return { error: "Age must be greater than 0." };
  if (age > 120) return { error: "Age is unrealistically large." };
  if (!height || height <= 0) return { error: "Height must be greater than 0." };
  if (!weight || weight <= 0) return { error: "Weight must be greater than 0." };
  if (weight > 1000) return { error: "Weight is unrealistically large." };

  const isImperial = input.unitSystem === "imperial";
  const heightCm = isImperial ? height * IN_TO_CM : height;
  const weightKg = isImperial ? weight * LB_TO_KG : weight;

  const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex === "male" ? baseBmr + 5 : baseBmr - 161;
  if (bmr <= 0) return { error: "Computed BMR is non-positive; check inputs." };

  const tdee: Record<ActivityLevel, number> = {
    sedentary: Math.round(bmr * ACTIVITY_FACTORS.sedentary),
    light: Math.round(bmr * ACTIVITY_FACTORS.light),
    moderate: Math.round(bmr * ACTIVITY_FACTORS.moderate),
    active: Math.round(bmr * ACTIVITY_FACTORS.active),
    veryActive: Math.round(bmr * ACTIVITY_FACTORS.veryActive),
  };
  const maintenanceCalories = tdee[selectedLevel];
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const warnings: string[] = [];

  // Target weight handling
  let targetWeightDelta = 0;
  let dailyDelta = 0;
  let goalCalories = maintenanceCalories;
  let projectedWeeksAtRate = 0;
  if (input.targetWeight && input.targetWeight > 0) {
    const targetKg = isImperial ? input.targetWeight * LB_TO_KG : input.targetWeight;
    targetWeightDelta = Math.round((targetKg - weightKg) * 100) / 100;
    if (input.targetWeeks && input.targetWeeks > 0) {
      const totalKcalDelta = targetWeightDelta * KCAL_PER_KG_FAT;
      dailyDelta = Math.round(totalKcalDelta / (input.targetWeeks * 7));
      goalCalories = maintenanceCalories + dailyDelta;
      // Safety: don't drop below 1200 (women) / 1500 (men) without warning
      const minSafe = sex === "male" ? 1500 : 1200;
      if (goalCalories < minSafe) {
        warnings.push(`Goal of ${goalCalories} kcal/day is below the suggested minimum (${minSafe} kcal). Consult a doctor.`);
      }
      // Projection at current daily delta (weeks needed to reach goal)
      const weeklyDelta = Math.abs(dailyDelta) * 7;
      if (weeklyDelta > 0) {
        projectedWeeksAtRate = Math.ceil(Math.abs(totalKcalDelta) / weeklyDelta);
      }
    }
  }

  if (bmi < 18.5) warnings.push("BMI is in the underweight range — weight gain may be advisable.");
  if (bmi >= 30) warnings.push("BMI is in the obese range — consult a healthcare professional.");

  return {
    bmr: Math.round(bmr),
    tdee,
    selectedLevel,
    maintenanceCalories,
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory: classifyBmi(bmi),
    targetWeightDelta,
    dailyDelta,
    goalCalories,
    projectedWeeksAtRate,
    macros: {
      cut: buildMacroSplit(maintenanceCalories * 0.8, 0.4, 0.4, 0.2),
      maintain: buildMacroSplit(maintenanceCalories, 0.5, 0.3, 0.2),
      bulk: buildMacroSplit(maintenanceCalories * 1.1, 0.5, 0.3, 0.2),
    },
    unitLabel: isImperial ? "lb" : "kg",
    warnings,
  };
}

/** Format an activity level as a friendly label. */
export function activityLabel(level: ActivityLevel): string {
  return ACTIVITY_LABELS[level];
}

/** Generate a CSV table of activity levels × calorie targets. */
export function calorieTableCsv(input: CalorieInput): string {
  const r = calculateCalories(input);
  if ("error" in r) return "";
  const lines = ["Activity Level,Factor,Maintenance (kcal),Cut -20% (kcal),Bulk +10% (kcal)"];
  for (const level of Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]) {
    const maint = r.tdee[level];
    lines.push(
      [
        ACTIVITY_LABELS[level],
        ACTIVITY_FACTORS[level],
        maint,
        Math.round(maint * 0.8),
        Math.round(maint * 1.1),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Weekly meal-plan suggestion (very simple): split maintenance into 3 meals + 2 snacks. */
export function mealPlan(calories: number): { meal: string; kcal: number }[] {
  return [
    { meal: "Breakfast", kcal: Math.round(calories * 0.25) },
    { meal: "Snack", kcal: Math.round(calories * 0.1) },
    { meal: "Lunch", kcal: Math.round(calories * 0.3) },
    { meal: "Snack", kcal: Math.round(calories * 0.1) },
    { meal: "Dinner", kcal: Math.round(calories * 0.25) },
  ];
}
