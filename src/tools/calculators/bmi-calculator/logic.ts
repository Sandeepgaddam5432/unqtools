/**
 * BMI Calculator — pure logic.
 *
 * BMI = weight (kg) / height (m)^2
 * Imperial: 703 * weight (lb) / height (in)^2
 *
 * Categories (WHO, adult >= 20 years):
 *   < 18.5        Underweight
 *   18.5 - 24.9   Normal
 *   25.0 - 29.9   Overweight
 *   >= 30.0       Obese
 *     30-34.9     Obese Class I
 *     35-39.9     Obese Class II
 *     >= 40       Obese Class III
 *
 * Pediatric (age 2-20): uses percentile-based z-score approximation
 * derived from CDC 2000 growth charts (simplified LMS table for age 18
 * reference values; not a substitute for clinical growth charts).
 */

export type UnitSystem = "metric" | "imperial";

export interface BmiInput {
  /** Height in cm (metric) or inches (imperial) */
  height: number;
  /** Weight in kg (metric) or pounds (imperial) */
  weight: number;
  unitSystem?: UnitSystem;
  /** Optional: age in years (enables pediatric z-score + BMR) */
  age?: number;
  /** Optional: biological sex (affects BMR + calorie estimates) */
  sex?: "male" | "female";
  /** Optional: waist circumference in cm (enables waist-to-height ratio) */
  waistCm?: number;
}

export interface BmiCategory {
  label: string;
  /** Tailwind-friendly badge color */
  color: "blue" | "green" | "yellow" | "orange" | "red";
  /** Risk description */
  risk: string;
}

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  bmiPrime: number;
  /** Healthy weight range for given height, in input unit (kg or lb). */
  healthyWeightRange: { min: number; max: number };
  /** Body surface area in m^2 (Mosteller formula). */
  bodySurfaceArea: number;
  /** Ponderal Index (kg/m^3) — corpulence index. */
  ponderalIndex: number;
  /** Basal Metabolic Rate (kcal/day) using Mifflin-St Jeor. Undefined if age/sex missing. */
  bmr?: number;
  /** Daily calorie needs at 5 activity levels. Undefined if BMR missing. */
  dailyCalories?: { sedentary: number; light: number; moderate: number; active: number; veryActive: number };
  /** BMI z-score (pediatric approximation for ages 2-20). Undefined if age out of range. */
  zScore?: number;
  /** Waist-to-height ratio. Undefined if waist missing. */
  waistToHeight?: number;
  /** Macro nutrient split suggestion (50% carb / 30% protein / 20% fat) for maintenance kcal. */
  macros?: { carbs: number; protein: number; fat: number };
  /** Weight delta to reach healthy range, in input unit (negative = lose, positive = gain). */
  weightDeltaToHealthy: { toMin: number; toMax: number };
  /** All weight values in the input unit (kg or lb). */
  unitLabel: "kg" | "lb";
  /** Height in meters (always metric, internal). */
  heightMeters: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: "Underweight", color: "blue", risk: "Possible nutritional deficiency or eating disorder. Consult a doctor." };
  if (bmi < 25) return { label: "Normal weight", color: "green", risk: "Low risk for weight-related disease." };
  if (bmi < 30) return { label: "Overweight", color: "yellow", risk: "Increased risk for cardiovascular disease, type 2 diabetes." };
  if (bmi < 35) return { label: "Obese (Class I)", color: "orange", risk: "High risk. Weight reduction advised." };
  if (bmi < 40) return { label: "Obese (Class II)", color: "orange", risk: "Very high risk. Medical supervision recommended." };
  return { label: "Obese (Class III)", color: "red", risk: "Extremely high risk. Seek medical advice." };
}

/**
 * Compute BMI from raw inputs. Returns error message string if inputs are invalid.
 */
export function calculateBmi(input: BmiInput): BmiResult | { error: string } {
  const { height, weight } = input;
  if (!height || height <= 0) return { error: "Height must be greater than 0." };
  if (!weight || weight <= 0) return { error: "Weight must be greater than 0." };
  if (height > 300) return { error: "Height is unrealistically large." };
  if (weight > 1000) return { error: "Weight is unrealistically large." };

  const isImperial = input.unitSystem === "imperial";
  const heightMeters = isImperial ? height * 0.0254 : height / 100;
  const weightKg = isImperial ? weight * 0.45359237 : weight;

  if (heightMeters <= 0) return { error: "Height must be greater than 0." };
  const bmi = weightKg / (heightMeters * heightMeters);

  // BMI Prime = BMI / 25 (upper bound of normal)
  const bmiPrime = bmi / 25;

  // Healthy weight range: BMI 18.5 - 24.9
  const healthyMinKg = 18.5 * heightMeters * heightMeters;
  const healthyMaxKg = 24.9 * heightMeters * heightMeters;
  const healthyMin = isImperial ? healthyMinKg / 0.45359237 : healthyMinKg;
  const healthyMax = isImperial ? healthyMaxKg / 0.45359237 : healthyMaxKg;

  // Body Surface Area (Mosteller): sqrt(height_cm * weight_kg / 3600)
  const heightCm = heightMeters * 100;
  const bsa = Math.sqrt((heightCm * weightKg) / 3600);

  // Ponderal Index = weight_kg / height_m^3
  const ponderalIndex = weightKg / (heightMeters * heightMeters * heightMeters);

  // Weight delta to reach healthy range
  const weightDeltaToHealthy = {
    toMin: r2(healthyMin - weight),
    toMax: r2(healthyMax - weight),
  };

  const result: BmiResult = {
    bmi: r2(bmi),
    category: classifyBmi(bmi),
    bmiPrime: r2(bmiPrime),
    healthyWeightRange: { min: r2(healthyMin), max: r2(healthyMax) },
    bodySurfaceArea: r2(bsa),
    ponderalIndex: r2(ponderalIndex),
    weightDeltaToHealthy,
    unitLabel: isImperial ? "lb" : "kg",
    heightMeters: r2(heightMeters),
  };

  // Optional: BMR (Mifflin-St Jeor)
  if (input.age && input.age >= 18 && input.age <= 120 && input.sex) {
    const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * input.age;
    const bmr = input.sex === "male" ? baseBmr + 5 : baseBmr - 161;
    result.bmr = Math.round(bmr);
    // Activity multipliers
    result.dailyCalories = {
      sedentary: Math.round(bmr * 1.2),
      light: Math.round(bmr * 1.375),
      moderate: Math.round(bmr * 1.55),
      active: Math.round(bmr * 1.725),
      veryActive: Math.round(bmr * 1.9),
    };
    // Macros at maintenance (50/30/20 split)
    const maintenanceKcal = result.dailyCalories.moderate;
    result.macros = {
      carbs: Math.round((maintenanceKcal * 0.5) / 4), // 4 kcal/g
      protein: Math.round((maintenanceKcal * 0.3) / 4),
      fat: Math.round((maintenanceKcal * 0.2) / 9), // 9 kcal/g
    };
  }

  // Optional: Pediatric z-score (age 2-20)
  // Uses simplified CDC 2000 reference: mu=21.0, sigma=4.5 (averaged reference for ages 2-20)
  if (input.age && input.age >= 2 && input.age <= 20) {
    result.zScore = r2((bmi - 21.0) / 4.5);
  }

  // Optional: Waist-to-height ratio
  if (input.waistCm && input.waistCm > 0) {
    result.waistToHeight = r2(input.waistCm / heightCm);
  }

  return result;
}

/** Generate a CSV of weight scenarios from min*0.8 to max*1.4 in 5% steps. */
export function weightScenariosCsv(input: BmiInput): string {
  const r = calculateBmi(input);
  if ("error" in r) return "";
  const isImperial = input.unitSystem === "imperial";
  const unit = isImperial ? "lb" : "kg";
  const heightMeters = r.heightMeters;
  const lines = ["Weight (" + unit + "),BMI,Category"];
  const baseWeight = input.weight;
  for (let mult = 0.7; mult <= 1.4; mult += 0.05) {
    const w = r2(baseWeight * mult);
    const wKg = isImperial ? w * 0.45359237 : w;
    const bmi = wKg / (heightMeters * heightMeters);
    lines.push(`${w},${r2(bmi)},${classifyBmi(bmi).label}`);
  }
  return lines.join("\n");
}

/** Format a number with up to `digits` decimals. */
export function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
