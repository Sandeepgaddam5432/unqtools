/**
 * Steps to Miles Converter — pure logic.
 *
 * Converts step counts to distance (miles / km) using stride-length
 * estimation based on sex and height, then estimates calorie burn.
 *
 * Stride length models (approximate):
 *   female: height * 0.413
 *   male:   height * 0.415
 * (height in inches → stride in inches; height in cm → stride in cm)
 *
 * Calorie burn uses METs: walking ≈ 3.5 MET, weight in kg.
 *   kcal = MET * weight_kg * duration_hours
 *   duration = distance_miles / pace (mph, default 3.0)
 */

export type Sex = "male" | "female" | "average";
export type UnitSystem = "metric" | "imperial";

export interface StepsInput {
  steps: number;
  /** Height in cm (metric) or inches (imperial). */
  height?: number;
  /** Weight in kg (metric) or pounds (imperial). Optional for calorie burn. */
  weight?: number;
  sex?: Sex;
  unitSystem?: UnitSystem;
  /** Walking pace in mph (default: 3.0). */
  paceMph?: number;
}

export interface StepsResult {
  steps: number;
  strideInches: number;
  strideCm: number;
  distanceMiles: number;
  distanceKm: number;
  distanceMeters: number;
  distanceFeet: number;
  durationMinutes: number;
  caloriesBurned: number;
  unitLabel: "metric" | "imperial";
  warnings: string[];
}

const IN_PER_MILE = 63360;
const CM_PER_MILE = 160934.4;
const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

function estimateStride(sex: Sex, heightIn?: number, heightCm?: number): { inches: number; cm: number } {
  // Default fallback stride (average adult): 26.4 in / 67.06 cm
  let inches = 26.4;
  let cm = inches * IN_TO_CM;
  if (heightIn && heightIn > 0) {
    const factor = sex === "female" ? 0.413 : sex === "male" ? 0.415 : 0.414;
    inches = heightIn * factor;
    cm = inches * IN_TO_CM;
  } else if (heightCm && heightCm > 0) {
    const factor = sex === "female" ? 0.413 : sex === "male" ? 0.415 : 0.414;
    cm = heightCm * factor;
    inches = cm / IN_TO_CM;
  }
  return { inches, cm };
}

export function convertSteps(input: StepsInput): StepsResult | { error: string } {
  const { steps } = input;
  if (!steps || steps <= 0) return { error: "Steps must be greater than 0." };
  if (steps > 1e8) return { error: "Step count is unrealistically large (> 100 million)." };

  const isImperial = input.unitSystem === "imperial";
  const sex = input.sex ?? "average";
  const heightIn = isImperial ? input.height : input.height ? input.height / IN_TO_CM : undefined;
  const stride = estimateStride(sex, heightIn);

  // Distance = steps × stride
  const distanceInches = steps * stride.inches;
  const distanceMiles = distanceInches / IN_PER_MILE;
  const distanceKm = (steps * stride.cm) / 100000;
  const distanceMeters = distanceKm * 1000;
  const distanceFeet = distanceInches / 12;

  // Pace → duration
  const paceMph = input.paceMph && input.paceMph > 0 ? input.paceMph : 3.0;
  const durationHours = distanceMiles / paceMph;
  const durationMinutes = durationHours * 60;

  // Calorie burn
  let caloriesBurned = 0;
  const weightKg = isImperial ? (input.weight ?? 0) * LB_TO_KG : input.weight ?? 0;
  if (weightKg > 0) {
    const MET = 3.5; // moderate walking
    caloriesBurned = MET * weightKg * durationHours;
  }

  const warnings: string[] = [];
  if (!input.height) warnings.push("No height provided — using average stride length. Enter height for accuracy.");
  if (!input.weight) warnings.push("No weight provided — calorie burn estimate is unavailable.");

  return {
    steps: Math.round(steps),
    strideInches: Math.round(stride.inches * 100) / 100,
    strideCm: Math.round(stride.cm * 100) / 100,
    distanceMiles: Math.round(distanceMiles * 1000) / 1000,
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    distanceMeters: Math.round(distanceMeters),
    distanceFeet: Math.round(distanceFeet),
    durationMinutes: Math.round(durationMinutes),
    caloriesBurned: Math.round(caloriesBurned),
    unitLabel: isImperial ? "imperial" : "metric",
    warnings,
  };
}

/** Generate a step-distance lookup table for typical step counts. */
export function stepsTable(input: Omit<StepsInput, "steps">): string {
  const points = [1000, 2000, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000];
  const lines = ["Steps,Miles,Km,Calories,Duration (min)"];
  for (const p of points) {
    const r = convertSteps({ ...input, steps: p });
    if ("error" in r) continue;
    lines.push(`${p},${r.distanceMiles},${r.distanceKm},${r.caloriesBurned},${r.durationMinutes}`);
  }
  return lines.join("\n");
}

/** Translate a target distance (miles) into a recommended step count. */
export function targetSteps(targetMiles: number, input: Omit<StepsInput, "steps">): number | { error: string } {
  if (!targetMiles || targetMiles <= 0) return { error: "Target miles must be greater than 0." };
  const heightIn = input.unitSystem === "imperial" ? input.height : input.height ? input.height / IN_TO_CM : undefined;
  const stride = estimateStride(input.sex ?? "average", heightIn);
  const steps = (targetMiles * IN_PER_MILE) / stride.inches;
  return Math.round(steps);
}
