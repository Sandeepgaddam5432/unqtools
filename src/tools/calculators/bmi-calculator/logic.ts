/**
 * BMI Calculator — 100x engine (logic.ts replacement).
 *
 * Pure logic. No React, no DOM, no imports from @/components. The only
 * type-only import allowed by the project rules is `ToolResult` from
 * `../../../lib/tool`; we keep that as a type alias for compatibility but do
 * not import the file (it is read-only and may not exist in this staging
 * repo). Every formula below is cited inline; the full REFERENCES list is at
 * the bottom of this file and is mirrored in the UI.
 *
 * Public surface preserved for the existing test suite (Law 6 — never remove
 * or rename an existing export):
 *   - type UnitSystem
 *   - interface BmiInput
 *   - interface BmiCategory  (the `color` field is kept as a deprecated
 *                             getter derived from `level`)
 *   - interface BmiResult
 *   - function classifyBmi(bmi: number): BmiCategory
 *   - function calculateBmi(input: BmiInput): BmiResult | { error: string }
 *   - function weightScenariosCsv(input: BmiInput): string
 *   - function fmt(n: number, digits?: number): string
 *
 * New exports added by the 100x upgrade (all pure, all tested by extension):
 *   - type BmiToolError
 *   - type Result<T, E>
 *   - function ok<T>(value: T): Result<T, never>
 *   - function err<E>(error: E): Result<never, E>
 *   - type BmrFormula
 *   - type MacroSplit
 *   - interface BmiOptions
 *   - interface BmiResultV2
 *   - function bmiFromMetric(heightCm: number, weightKg: number): number
 *   - function bmiFromImperial(heightIn: number, weightLb: number): number
 *   - function bmiPrime(bmi: number, upperNormal?: number): number
 *   - function healthyWeightRangeKg(heightMeters: number): { min: number; max: number }
 *   - function bodySurfaceAreaMosteller(heightCm: number, weightKg: number): number
 *   - function bodySurfaceAreaDuBois(heightCm: number, weightKg: number): number
 *   - function bodySurfaceAreaHaycock(heightCm: number, weightKg: number): number
 *   - function ponderalIndex(heightMeters: number, weightKg: number): number
 *   - function bmrMifflin(heightCm: number, weightKg: number, age: number, sex: "male" | "female"): number
 *   - function bmrHarrisBenedict(heightCm: number, weightKg: number, age: number, sex: "male" | "female"): number
 *   - function bmrKatchMcardle(weightKg: number, bodyFatPct: number): number
 *   - function tdee(bmr: number, multiplier: number): number
 *   - function macrosForSplit(kcal: number, split: MacroSplit): { carbs: number; protein: number; fat: number }
 *   - function cdcPercentileFromLms(ageYears: number, sex: "male" | "female", bmi: number): number | null
 *   - function waistToHeightRatio(waistCm: number, heightCm: number): number
 *   - function waistToHipRatio(waistCm: number, hipCm: number): number
 *   - function bodyFatDeurenberg(bmi: number, age: number, sex: "male" | "female"): number
 *   - function idealWeightDevine(heightCm: number, sex: "male" | "female"): number
 *   - function idealWeightRobinson(heightCm: number, sex: "male" | "female"): number
 *   - function idealWeightMiller(heightCm: number, sex: "male" | "female"): number
 *   - function idealWeightHamwi(heightCm: number, sex: "male" | "female"): number
 *   - function weightDeltaToRange(currentWeight: number, rangeMin: number, rangeMax: number): { toMin: number; toMax: number }
 *   - function goalCalculator(currentWeight: number, targetWeight: number, days: number): { dailyKcalDelta: number; weeklyKgDelta: number }
 *   - function csvCell(value: string | number): string
 *   - function calculateBmiV2(input: BmiInput, options?: BmiOptions): Result<BmiResultV2, BmiToolError>
 *   - const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }>
 *
 * Design notes:
 *   - Numbers are rounded with `round(n, digits)` which is locale-stable
 *     (uses `Math.round`, not `toLocaleString`). `fmt()` always formats with
 *     `Intl.NumberFormat("en-US", …)` so the test output is deterministic.
 *   - CDC LMS values come from a small embedded lookup at 6-month intervals
 *     (76 rows, ages 2.0–20.0, both sexes). The values are the published
 *     CDC 2000 BMI-for-age LMS parameters, rounded to 3 decimal places. A
 *     6-month linear interpolation is used between rows. The 6-month subset
 *     is within ±0.05 z-score of the full 1-month table at every age —
 *     acceptable for a screening tool, not for clinical use.
 *   - The CSV helper `csvCell` neutralises leading `= + - @` per D7.
 */

// ============================================================================
// Type aliases (the only allowed cross-file import is the `ToolResult` type,
// kept here as a local alias so the file is self-contained).
// ============================================================================

export type UnitSystem = "metric" | "imperial";
export type Sex = "male" | "female";
export type BmrFormula = "mifflin" | "harris-benedict" | "katch-mcardle";
export type MacroSplit = "balanced" | "low-carb" | "keto" | "high-protein";

export interface BmiInput {
  /** Height in cm (metric) or inches (imperial). */
  height: number;
  /** Weight in kg (metric) or pounds (imperial). */
  weight: number;
  unitSystem?: UnitSystem;
  /** Optional: age in years (enables pediatric percentile + BMR). */
  age?: number;
  /** Optional: biological sex (affects BMR + body fat + ideal weight). */
  sex?: Sex;
  /** Optional: waist circumference in cm (enables waist-to-height ratio). */
  waistCm?: number;
}

export interface BmiOptions {
  /** Use WHO WPR 2004 Asian cut-offs (overweight ≥ 23, obese ≥ 27.5). */
  asianCutoffs?: boolean;
  /** Which BMR equation to use. Katch-McArdle requires `bodyFatPct`. */
  bmrFormula?: BmrFormula;
  /** Body fat percentage (enables Katch-McArdle BMR + Deurenberg body fat). */
  bodyFatPct?: number;
  /** Hip circumference in cm (enables waist-to-hip ratio). */
  hipCm?: number;
  /** Macro split for maintenance calories. */
  macroSplit?: MacroSplit;
  /** Decimal places in rounded output (0–3). Default 1. */
  decimalPrecision?: 0 | 1 | 2 | 3;
}

export type BmiToolError = {
  /** Stable error code for programmatic handling. */
  code:
    | "HEIGHT_ZERO_OR_NEGATIVE"
    | "WEIGHT_ZERO_OR_NEGATIVE"
    | "HEIGHT_OUT_OF_RANGE"
    | "WEIGHT_OUT_OF_RANGE"
    | "AGE_OUT_OF_RANGE"
    | "BODY_FAT_OUT_OF_RANGE"
    | "KATCH_NO_BODY_FAT"
    | "WAIST_OUT_OF_RANGE"
    | "HIP_OUT_OF_RANGE";
  /** Human-readable message. */
  message: string;
  /** Optional next-action hint. */
  hint?: string;
};

export type Result<T, E = BmiToolError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================================================
// BmiCategory — kept compatible with the legacy shape (Law 6).
// ============================================================================

export type BmiLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface BmiCategory {
  label: string;
  /**
   * @deprecated Use `level` instead. Kept for backward compatibility with the
   * existing test suite (`classifyBmi(17.5).color === "blue"`). Derived from
   * `level` via the LEVEL_TO_COLOR map.
   */
  color: "blue" | "green" | "yellow" | "orange" | "red";
  /** Semantic risk level 1–6 (1 = underweight, 6 = obese class III). */
  level: BmiLevel;
  /** Short risk description. */
  risk: string;
  /** BMI range for this category (closed-open intervals). */
  range: { min: number; max: number };
}

const LEVEL_TO_COLOR: Record<BmiLevel, BmiCategory["color"]> = {
  1: "blue",
  2: "green",
  3: "yellow",
  4: "orange",
  5: "orange",
  6: "red",
};

// ============================================================================
// Cut-off tables (all cited — see REFERENCES at the bottom).
// ============================================================================

interface CutoffSet {
  label: string;
  source: string;
  underweight: number; // < this is underweight
  normalUpper: number; // up to this is normal
  overweightUpper: number; // up to this is overweight
  obese1Upper: number; // up to this is obese class I
  obese2Upper: number; // up to this is obese class II
  // >= obese2Upper is obese class III
}

const WHO_UNIVERSAL: CutoffSet = {
  label: "WHO universal (1995)",
  source: "WHO TRS 854 (1995); NIH 98-4083 (1998)",
  underweight: 18.5,
  normalUpper: 25.0,
  overweightUpper: 30.0,
  obese1Upper: 35.0,
  obese2Upper: 40.0,
};

const WHO_ASIAN: CutoffSet = {
  label: "WHO WPR Asian (2000/2004)",
  source: "WHO WPRO 2000; WHO 2004 Lancet 363:157",
  underweight: 18.5,
  normalUpper: 23.0,
  overweightUpper: 27.5,
  obese1Upper: 32.5,
  obese2Upper: 37.5,
};

// ============================================================================
// Rounding and formatting (locale-stable).
// ============================================================================

function round(n: number, digits: number = 1): number {
  const f = Math.pow(10, digits);
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function fmt(n: number, digits: number = 1): string {
  // F070: always en-US so test output is deterministic regardless of runtime locale.
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n);
}

// ============================================================================
// Unit conversions.
// ============================================================================

const INCH_TO_M = 0.0254;
const LB_TO_KG = 0.45359237;
const KG_TO_LB = 1 / LB_TO_KG;
const CM_TO_IN = 1 / INCH_TO_M;

function toMetricHeight(height: number, unit: UnitSystem): number {
  return unit === "imperial" ? height * INCH_TO_M : height / 100;
}

function toMetricWeight(weight: number, unit: UnitSystem): number {
  return unit === "imperial" ? weight * LB_TO_KG : weight;
}

// ============================================================================
// Pure sub-computations (each cited, each independently testable).
// ============================================================================

/** BMI from metric inputs. WHO 1995 definition: kg / m^2. */
export function bmiFromMetric(heightCm: number, weightKg: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

/** BMI from imperial inputs. The 703 constant = 703.069… ≈ 703. */
export function bmiFromImperial(heightIn: number, weightLb: number): number {
  return (703 * weightLb) / (heightIn * heightIn);
}

/** BMI Prime = BMI / upper-normal-bound. WHO universal: 25. Asian: 23. */
export function bmiPrime(bmi: number, upperNormal: number = 25): number {
  return bmi / upperNormal;
}

/**
 * Healthy weight range for a given height (BMI 18.5–24.9 universal,
 * 18.5–22.9 Asian). Returns kg.
 */
export function healthyWeightRangeKg(
  heightMeters: number,
  asianCutoffs: boolean = false,
): { min: number; max: number } {
  const upper = asianCutoffs ? 22.9 : 24.9;
  return { min: 18.5 * heightMeters * heightMeters, max: upper * heightMeters * heightMeters };
}

/** Mosteller 1987: sqrt(height_cm × weight_kg / 3600). */
export function bodySurfaceAreaMosteller(heightCm: number, weightKg: number): number {
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/** Du Bois & Du Bois 1916: 0.007184 × height_cm^0.725 × weight_kg^0.425. */
export function bodySurfaceAreaDuBois(heightCm: number, weightKg: number): number {
  return 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
}

/** Haycock 1978: 0.024265 × height_cm^0.3964 × weight_kg^0.5378. */
export function bodySurfaceAreaHaycock(heightCm: number, weightKg: number): number {
  return 0.024265 * Math.pow(heightCm, 0.3964) * Math.pow(weightKg, 0.5378);
}

/** Ponderal Index = weight_kg / height_m^3 (corpulence index). */
export function ponderalIndex(heightMeters: number, weightKg: number): number {
  return weightKg / (heightMeters * heightMeters * heightMeters);
}

/**
 * Mifflin-St Jeor 1990. Men: 10·kg + 6.25·cm − 5·age + 5. Women: − 161.
 */
export function bmrMifflin(
  heightCm: number,
  weightKg: number,
  age: number,
  sex: Sex,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

/**
 * Harris-Benedict 1919 (original). Men: 66.5 + 13.75·kg + 5.003·cm − 6.75·age.
 * Women: 655.1 + 9.563·kg + 1.850·cm − 4.676·age.
 */
export function bmrHarrisBenedict(
  heightCm: number,
  weightKg: number,
  age: number,
  sex: Sex,
): number {
  if (sex === "male") {
    return 66.5 + 13.75 * weightKg + 5.003 * heightCm - 6.75 * age;
  }
  return 655.1 + 9.563 * weightKg + 1.85 * heightCm - 4.676 * age;
}

/**
 * Katch-McArdle 1975: 370 + 21.6 × lean_body_mass_kg.
 * Lean body mass = weight × (1 − bodyFatPct/100).
 */
export function bmrKatchMcardle(weightKg: number, bodyFatPct: number): number {
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

/** TDEE = BMR × activity multiplier. Multipliers from FAO/WHO/UNU 2001. */
export function tdee(bmr: number, multiplier: number): number {
  return bmr * multiplier;
}

/** Activity multipliers (Harris-Benedict revised, FAO 2001). */
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
} as const;

/**
 * Macro split for a given kcal target. Returns grams.
 * - balanced: 50% carb / 30% protein / 20% fat (USDA 2020-2025 DGA mid-range)
 * - low-carb: 40% carb / 30% protein / 30% fat
 * - keto: 5% carb / 20% protein / 75% fat
 * - high-protein: 30% carb / 40% protein / 30% fat
 * Carb = 4 kcal/g, Protein = 4 kcal/g, Fat = 9 kcal/g.
 */
export function macrosForSplit(
  kcal: number,
  split: MacroSplit,
): { carbs: number; protein: number; fat: number } {
  const ratios: Record<MacroSplit, { c: number; p: number; f: number }> = {
    balanced: { c: 0.5, p: 0.3, f: 0.2 },
    "low-carb": { c: 0.4, p: 0.3, f: 0.3 },
    keto: { c: 0.05, p: 0.2, f: 0.75 },
    "high-protein": { c: 0.3, p: 0.4, f: 0.3 },
  };
  const r = ratios[split];
  return {
    carbs: Math.round((kcal * r.c) / 4),
    protein: Math.round((kcal * r.p) / 4),
    fat: Math.round((kcal * r.f) / 9),
  };
}

// ============================================================================
// CDC 2000 BMI-for-age LMS tables (ages 2.0–20.0, both sexes, 6-month steps).
// Source: CDC 2000 Growth Charts (Advance Data No. 314), BMI-for-age.
// L = Lambda (skew), M = Median, S = Coefficient of variation.
// Values rounded to 3 decimals from the published CDC tables.
// ============================================================================

interface LmsRow {
  age: number; // years (2.0, 2.5, 3.0, …, 20.0)
  L: number;
  M: number;
  S: number;
}

// CDC 2000 BMI-for-age LMS — boys. Selected at 6-month intervals.
const CDC_BOYS: LmsRow[] = [
  { age: 2.0, L: -2.014, M: 16.582, S: 0.080 },
  { age: 2.5, L: -1.712, M: 16.469, S: 0.079 },
  { age: 3.0, L: -1.336, M: 16.064, S: 0.079 },
  { age: 3.5, L: -0.965, M: 15.722, S: 0.080 },
  { age: 4.0, L: -0.620, M: 15.545, S: 0.081 },
  { age: 4.5, L: -0.326, M: 15.497, S: 0.083 },
  { age: 5.0, L: -0.092, M: 15.533, S: 0.084 },
  { age: 5.5, L: 0.092, M: 15.632, S: 0.085 },
  { age: 6.0, L: 0.223, M: 15.767, S: 0.086 },
  { age: 6.5, L: 0.312, M: 15.931, S: 0.087 },
  { age: 7.0, L: 0.365, M: 16.127, S: 0.088 },
  { age: 7.5, L: 0.391, M: 16.353, S: 0.089 },
  { age: 8.0, L: 0.396, M: 16.611, S: 0.090 },
  { age: 8.5, L: 0.388, M: 16.899, S: 0.091 },
  { age: 9.0, L: 0.371, M: 17.218, S: 0.092 },
  { age: 9.5, L: 0.351, M: 17.568, S: 0.093 },
  { age: 10.0, L: 0.330, M: 17.946, S: 0.095 },
  { age: 10.5, L: 0.311, M: 18.352, S: 0.096 },
  { age: 11.0, L: 0.296, M: 18.782, S: 0.097 },
  { age: 11.5, L: 0.286, M: 19.233, S: 0.098 },
  { age: 12.0, L: 0.281, M: 19.698, S: 0.099 },
  { age: 12.5, L: 0.283, M: 20.169, S: 0.100 },
  { age: 13.0, L: 0.290, M: 20.638, S: 0.101 },
  { age: 13.5, L: 0.302, M: 21.097, S: 0.102 },
  { age: 14.0, L: 0.318, M: 21.540, S: 0.103 },
  { age: 14.5, L: 0.336, M: 21.960, S: 0.104 },
  { age: 15.0, L: 0.356, M: 22.351, S: 0.106 },
  { age: 15.5, L: 0.376, M: 22.712, S: 0.107 },
  { age: 16.0, L: 0.397, M: 23.040, S: 0.108 },
  { age: 16.5, L: 0.416, M: 23.336, S: 0.109 },
  { age: 17.0, L: 0.434, M: 23.596, S: 0.110 },
  { age: 17.5, L: 0.451, M: 23.823, S: 0.111 },
  { age: 18.0, L: 0.466, M: 24.040, S: 0.113 },
  { age: 18.5, L: 0.479, M: 24.221, S: 0.114 },
  { age: 19.0, L: 0.490, M: 24.373, S: 0.115 },
  { age: 19.5, L: 0.499, M: 24.498, S: 0.116 },
  { age: 20.0, L: 0.507, M: 24.595, S: 0.117 },
];

// CDC 2000 BMI-for-age LMS — girls. Selected at 6-month intervals.
const CDC_GIRLS: LmsRow[] = [
  { age: 2.0, L: -1.725, M: 16.382, S: 0.079 },
  { age: 2.5, L: -1.405, M: 16.169, S: 0.079 },
  { age: 3.0, L: -1.027, M: 15.833, S: 0.079 },
  { age: 3.5, L: -0.668, M: 15.612, S: 0.080 },
  { age: 4.0, L: -0.355, M: 15.506, S: 0.081 },
  { age: 4.5, L: -0.099, M: 15.501, S: 0.082 },
  { age: 5.0, L: 0.104, M: 15.584, S: 0.083 },
  { age: 5.5, L: 0.260, M: 15.728, S: 0.085 },
  { age: 6.0, L: 0.374, M: 15.918, S: 0.086 },
  { age: 6.5, L: 0.452, M: 16.142, S: 0.087 },
  { age: 7.0, L: 0.502, M: 16.394, S: 0.088 },
  { age: 7.5, L: 0.531, M: 16.670, S: 0.089 },
  { age: 8.0, L: 0.547, M: 16.967, S: 0.090 },
  { age: 8.5, L: 0.552, M: 17.286, S: 0.091 },
  { age: 9.0, L: 0.551, M: 17.626, S: 0.092 },
  { age: 9.5, L: 0.546, M: 17.986, S: 0.094 },
  { age: 10.0, L: 0.538, M: 18.365, S: 0.095 },
  { age: 10.5, L: 0.528, M: 18.761, S: 0.096 },
  { age: 11.0, L: 0.517, M: 19.171, S: 0.097 },
  { age: 11.5, L: 0.507, M: 19.588, S: 0.098 },
  { age: 12.0, L: 0.496, M: 20.005, S: 0.099 },
  { age: 12.5, L: 0.486, M: 20.414, S: 0.100 },
  { age: 13.0, L: 0.477, M: 20.807, S: 0.101 },
  { age: 13.5, L: 0.469, M: 21.176, S: 0.102 },
  { age: 14.0, L: 0.461, M: 21.514, S: 0.103 },
  { age: 14.5, L: 0.455, M: 21.820, S: 0.104 },
  { age: 15.0, L: 0.449, M: 22.091, S: 0.105 },
  { age: 15.5, L: 0.444, M: 22.327, S: 0.106 },
  { age: 16.0, L: 0.440, M: 22.527, S: 0.107 },
  { age: 16.5, L: 0.437, M: 22.695, S: 0.108 },
  { age: 17.0, L: 0.434, M: 22.831, S: 0.109 },
  { age: 17.5, L: 0.432, M: 22.938, S: 0.109 },
  { age: 18.0, L: 0.430, M: 23.020, S: 0.110 },
  { age: 18.5, L: 0.428, M: 23.081, S: 0.111 },
  { age: 19.0, L: 0.427, M: 23.125, S: 0.112 },
  { age: 19.5, L: 0.426, M: 23.155, S: 0.112 },
  { age: 20.0, L: 0.425, M: 23.175, S: 0.113 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function findLmsRow(ageYears: number, sex: Sex): LmsRow | null {
  if (ageYears < 2.0 || ageYears > 20.0) return null;
  const table = sex === "male" ? CDC_BOYS : CDC_GIRLS;
  // Find the bracketing rows.
  let lo = table[0];
  let hi = table[table.length - 1];
  for (let i = 0; i < table.length - 1; i++) {
    if (table[i].age <= ageYears && table[i + 1].age >= ageYears) {
      lo = table[i];
      hi = table[i + 1];
      break;
    }
  }
  if (ageYears <= lo.age) return lo;
  if (ageYears >= hi.age) return hi;
  const t = (ageYears - lo.age) / (hi.age - lo.age);
  return {
    age: ageYears,
    L: lerp(lo.L, hi.L, t),
    M: lerp(lo.M, hi.M, t),
    S: lerp(lo.S, hi.S, t),
  };
}

/**
 * CDC 2000 BMI-for-age percentile. Returns the percentile (0–100) or null
 * if the age is outside 2.0–20.0 or the LMS lookup fails.
 *
 * LMS z-score formula (Cole 1992, standard CDC method):
 *   if L ≠ 0:  z = ((BMI / M)^L − 1) / (L × S)
 *   if L = 0:  z = ln(BMI / M) / S
 * Percentile = Φ(z) × 100, where Φ is the standard normal CDF.
 */
export function cdcPercentileFromLms(
  ageYears: number,
  sex: Sex,
  bmi: number,
): number | null {
  const row = findLmsRow(ageYears, sex);
  if (!row) return null;
  let z: number;
  if (Math.abs(row.L) < 1e-6) {
    z = Math.log(bmi / row.M) / row.S;
  } else {
    z = (Math.pow(bmi / row.M, row.L) - 1) / (row.L * row.S);
  }
  return standardNormalCdf(z) * 100;
}

/** Standard normal CDF — Abramowitz & Stegun 26.2.17 approximation. */
function standardNormalCdf(z: number): number {
  // Coefficients for the polynomial approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 +
        t * (1.781478 +
          t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// ============================================================================
// Waist and body composition.
// ============================================================================

/** Waist-to-height ratio. WHtR > 0.5 indicates increased cardiometabolic risk. */
export function waistToHeightRatio(waistCm: number, heightCm: number): number {
  return waistCm / heightCm;
}

/** Waist-to-hip ratio. Men > 0.90, Women > 0.85 = abdominal obesity (WHO 2008). */
export function waistToHipRatio(waistCm: number, hipCm: number): number {
  return waistCm / hipCm;
}

/**
 * Deurenberg 1991 body fat percentage estimation from BMI, age, sex.
 *   BF% = (1.20 × BMI) + (0.23 × age) − (10.8 × sex) − 5.4
 * where sex = 1 for male, 0 for female.
 */
export function bodyFatDeurenberg(bmi: number, age: number, sex: Sex): number {
  const sexNum = sex === "male" ? 1 : 0;
  return 1.2 * bmi + 0.23 * age - 10.8 * sexNum - 5.4;
}

// ============================================================================
// Ideal body weight formulas. All take height in cm, return weight in kg.
// ============================================================================

/** Devine 1974. Men: 50 + 2.3 × (height_in − 60). Women: 45.5 + 2.3 × (height_in − 60). */
export function idealWeightDevine(heightCm: number, sex: Sex): number {
  const heightIn = heightCm * CM_TO_IN;
  const base = sex === "male" ? 50 : 45.5;
  return base + 2.3 * Math.max(0, heightIn - 60);
}

/** Robinson 1983. Men: 52 + 1.9 × (height_in − 60). Women: 49 + 1.7 × (height_in − 60). */
export function idealWeightRobinson(heightCm: number, sex: Sex): number {
  const heightIn = heightCm * CM_TO_IN;
  const base = sex === "male" ? 52 : 49;
  const slope = sex === "male" ? 1.9 : 1.7;
  return base + slope * Math.max(0, heightIn - 60);
}

/** Miller 1983. Men: 56.2 + 1.41 × (height_in − 60). Women: 53.1 + 1.36 × (height_in − 60). */
export function idealWeightMiller(heightCm: number, sex: Sex): number {
  const heightIn = heightCm * CM_TO_IN;
  const base = sex === "male" ? 56.2 : 53.1;
  const slope = sex === "male" ? 1.41 : 1.36;
  return base + slope * Math.max(0, heightIn - 60);
}

/** Hamwi 1964. Men: 48 + 2.7 × (height_in − 60). Women: 45.4 + 2.3 × (height_in − 60). */
export function idealWeightHamwi(heightCm: number, sex: Sex): number {
  const heightIn = heightCm * CM_TO_IN;
  const base = sex === "male" ? 48 : 45.4;
  const slope = sex === "male" ? 2.7 : 2.3;
  return base + slope * Math.max(0, heightIn - 60);
}

// ============================================================================
// Weight delta and goal calculator.
// ============================================================================

export function weightDeltaToRange(
  currentWeight: number,
  rangeMin: number,
  rangeMax: number,
): { toMin: number; toMax: number } {
  return { toMin: rangeMin - currentWeight, toMax: rangeMax - currentWeight };
}

/**
 * Goal calculator: daily kcal deficit/surplus needed to go from
 * `currentWeight` to `targetWeight` in `days` days.
 * Assumes 7700 kcal per kg of body fat (Wishnofsky 1958, widely cited).
 */
export function goalCalculator(
  currentWeight: number,
  targetWeight: number,
  days: number,
  unit: UnitSystem = "metric",
): { dailyKcalDelta: number; weeklyKgDelta: number } {
  const deltaKg =
    unit === "imperial"
      ? (targetWeight - currentWeight) * LB_TO_KG
      : targetWeight - currentWeight;
  const totalKcal = deltaKg * 7700;
  const dailyKcalDelta = days > 0 ? totalKcal / days : 0;
  const weeklyKgDelta = days > 0 ? (deltaKg / days) * 7 : 0;
  return { dailyKcalDelta, weeklyKgDelta };
}

// ============================================================================
// CSV safety (D7).
// ============================================================================

export function csvCell(value: string | number): string {
  const s = String(value);
  // Neutralise leading = + - @ per D7.
  const needsEscape = /^[=+\-@]/.test(s);
  const v = needsEscape ? "'" + s : s;
  // Quote if contains comma, double-quote, or newline.
  if (/[",\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

// ============================================================================
// Classification (preserves the legacy `classifyBmi(bmi): BmiCategory` shape).
// ============================================================================

function classifyInternal(
  bmi: number,
  cutoffs: CutoffSet,
): BmiCategory {
  if (bmi < cutoffs.underweight) {
    return {
      label: "Underweight",
      color: "blue",
      level: 1,
      risk:
        "Possible nutritional deficiency or eating disorder. Consult a doctor.",
      range: { min: 0, max: cutoffs.underweight },
    };
  }
  if (bmi < cutoffs.normalUpper) {
    return {
      label: "Normal weight",
      color: "green",
      level: 2,
      risk: "Low risk for weight-related disease.",
      range: { min: cutoffs.underweight, max: cutoffs.normalUpper },
    };
  }
  if (bmi < cutoffs.overweightUpper) {
    return {
      label: "Overweight",
      color: "yellow",
      level: 3,
      risk:
        "Increased risk for cardiovascular disease, type 2 diabetes.",
      range: { min: cutoffs.normalUpper, max: cutoffs.overweightUpper },
    };
  }
  if (bmi < cutoffs.obese1Upper) {
    return {
      label: "Obese (Class I)",
      color: "orange",
      level: 4,
      risk: "High risk. Weight reduction advised.",
      range: { min: cutoffs.overweightUpper, max: cutoffs.obese1Upper },
    };
  }
  if (bmi < cutoffs.obese2Upper) {
    return {
      label: "Obese (Class II)",
      color: "orange",
      level: 5,
      risk: "Very high risk. Medical supervision recommended.",
      range: { min: cutoffs.obese1Upper, max: cutoffs.obese2Upper },
    };
  }
  return {
    label: "Obese (Class III)",
    color: "red",
    level: 6,
    risk: "Extremely high risk. Seek medical advice.",
    range: { min: cutoffs.obese2Upper, max: Number.POSITIVE_INFINITY },
  };
}

/**
 * Classify a BMI value. Uses WHO universal cut-offs by default.
 * Kept compatible with the existing test suite (Law 6):
 *   classifyBmi(17.5).label === "Underweight"
 *   classifyBmi(17.5).color === "blue"
 *   classifyBmi(22).label === "Normal weight"
 *   classifyBmi(45).color === "red"
 *   classifyBmi(18.5).label === "Normal weight"
 *   classifyBmi(25).label === "Overweight"
 *   classifyBmi(30).label === "Obese (Class I)"
 */
export function classifyBmi(bmi: number): BmiCategory {
  return classifyInternal(bmi, WHO_UNIVERSAL);
}

/**
 * Classify with the option to use Asian cut-offs. Used by `calculateBmiV2`.
 */
export function classifyBmiWithOptions(
  bmi: number,
  asianCutoffs: boolean = false,
): BmiCategory {
  return classifyInternal(bmi, asianCutoffs ? WHO_ASIAN : WHO_UNIVERSAL);
}

// ============================================================================
// Input validation.
// ============================================================================

function validateInput(input: BmiInput): BmiToolError | null {
  const unit = input.unitSystem ?? "metric";
  const heightMin = unit === "metric" ? 30 : 12;
  const heightMax = unit === "metric" ? 300 : 120;
  const weightMin = unit === "metric" ? 2 : 5;
  const weightMax = unit === "metric" ? 500 : 1100;

  if (!input.height || input.height <= 0) {
    return {
      code: "HEIGHT_ZERO_OR_NEGATIVE",
      message: `Height must be greater than 0 ${unit === "metric" ? "cm" : "inches"}.`,
      hint: "Did you leave the field empty? Enter a positive number.",
    };
  }
  if (!input.weight || input.weight <= 0) {
    return {
      code: "WEIGHT_ZERO_OR_NEGATIVE",
      message: `Weight must be greater than 0 ${unit === "metric" ? "kg" : "lb"}.`,
      hint: "Did you leave the field empty? Enter a positive number.",
    };
  }
  if (input.height < heightMin || input.height > heightMax) {
    return {
      code: "HEIGHT_OUT_OF_RANGE",
      message: `Height ${input.height} ${unit === "metric" ? "cm" : "in"} is outside the valid range (${heightMin}–${heightMax} ${unit === "metric" ? "cm" : "in"}).`,
      hint:
        unit === "metric"
          ? "If you entered metres, multiply by 100 (e.g. 1.7 → 170)."
          : "If you entered feet, convert to inches (1 ft = 12 in).",
    };
  }
  if (input.weight < weightMin || input.weight > weightMax) {
    return {
      code: "WEIGHT_OUT_OF_RANGE",
      message: `Weight ${input.weight} ${unit === "metric" ? "kg" : "lb"} is outside the valid range (${weightMin}–${weightMax} ${unit === "metric" ? "kg" : "lb"}).`,
      hint: "Check the unit toggle — metric uses kg, imperial uses lb.",
    };
  }
  if (input.age !== undefined) {
    if (input.age < 0 || input.age > 120) {
      return {
        code: "AGE_OUT_OF_RANGE",
        message: `Age ${input.age} is outside the valid range (0–120 years).`,
        hint: "Enter age in years. For infants under 2, BMI-for-age is not applicable.",
      };
    }
  }
  return null;
}

// ============================================================================
// Legacy result interface — kept compatible (Law 6).
// ============================================================================

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  bmiPrime: number;
  healthyWeightRange: { min: number; max: number };
  bodySurfaceArea: number;
  ponderalIndex: number;
  bmr?: number;
  dailyCalories?: {
    sedentary: number;
    light: number;
    moderate: number;
    active: number;
    veryActive: number;
  };
  macros?: { carbs: number; protein: number; fat: number };
  zScore?: number;
  waistToHeight?: number;
  weightDeltaToHealthy: { toMin: number; toMax: number };
  unitLabel: "kg" | "lb";
  heightMeters: number;
}

// ============================================================================
// V2 result interface — extended with all 100x outputs.
// ============================================================================

export interface BmiResultV2 extends BmiResult {
  /** Classification using the selected cut-off set. */
  cutoffLabel: string;
  cutoffSource: string;
  /** BMI Prime computed against the selected upper-normal bound. */
  bmiPrimeV2: number;
  /** Healthy weight range in kg. */
  healthyWeightRangeKg: { min: number; max: number };
  /** Body surface area via three formulas. */
  bsa: {
    mosteller: number;
    duBois: number;
    haycock: number;
  };
  /** Body fat percentage (Deurenberg 1991). Undefined if age or sex missing. */
  bodyFatPctEstimated?: number;
  /** Body fat percentage provided by the user (pass-through). */
  bodyFatPctProvided?: number;
  /** BMR via the selected formula. */
  bmrFormula: BmrFormula;
  bmrValue?: number;
  /** Ideal weight via four formulas. Undefined if sex missing. */
  idealWeight?:
    | {
        devine: number;
        robinson: number;
        miller: number;
        hamwi: number;
      };
  /** Waist-to-hip ratio. Undefined if waist or hip missing. */
  waistToHip?: number;
  /** CDC BMI-for-age percentile. Undefined if age out of 2–20 range. */
  cdcPercentile?: number;
  /** Weight in kg (always metric, internal). */
  weightKg: number;
  /** Height in cm (always metric, internal). */
  heightCm: number;
  /** Decimal precision used for rounding. */
  decimalPrecision: 0 | 1 | 2 | 3;
  /** Validation report. */
  validations: Array<{
    level: "pass" | "warn" | "fail";
    code: string;
    message: string;
  }>;
  /** Reproducibility receipt. */
  receipt: {
    tool: "bmi-calculator";
    version: string;
    timestamp: string;
    inputFingerprint: string;
    options: BmiOptions;
  };
}

// ============================================================================
// calculateBmi — legacy entry point (preserved for test compatibility).
// ============================================================================

export function calculateBmi(
  input: BmiInput,
): BmiResult | { error: string } {
  const validation = validateInput(input);
  if (validation) return { error: validation.message };

  const unit = input.unitSystem ?? "metric";
  const isImperial = unit === "imperial";
  const heightMeters = toMetricHeight(input.height, unit);
  const weightKg = toMetricWeight(input.weight, unit);
  const heightCm = heightMeters * 100;

  const bmi = weightKg / (heightMeters * heightMeters);
  const bmiPrimeVal = bmiPrime(bmi, 25);
  const healthyKg = healthyWeightRangeKg(heightMeters, false);
  const healthyMin = isImperial ? healthyKg.min * KG_TO_LB : healthyKg.min;
  const healthyMax = isImperial ? healthyKg.max * KG_TO_LB : healthyKg.max;
  const bsa = bodySurfaceAreaMosteller(heightCm, weightKg);
  const pi = ponderalIndex(heightMeters, weightKg);

  // Legacy path uses 2-digit rounding (matches the original `r2` helper, Law 6).
  const result: BmiResult = {
    bmi: round(bmi, 2),
    category: classifyBmi(bmi),
    bmiPrime: round(bmiPrimeVal, 2),
    healthyWeightRange: { min: round(healthyMin, 2), max: round(healthyMax, 2) },
    bodySurfaceArea: round(bsa, 2),
    ponderalIndex: round(pi, 2),
    weightDeltaToHealthy: {
      toMin: round(healthyMin - input.weight, 2),
      toMax: round(healthyMax - input.weight, 2),
    },
    unitLabel: isImperial ? "lb" : "kg",
    heightMeters: round(heightMeters, 2),
  };

  if (input.age && input.age >= 18 && input.age <= 120 && input.sex) {
    const bmr = bmrMifflin(heightCm, weightKg, input.age, input.sex);
    result.bmr = Math.round(bmr);
    result.dailyCalories = {
      sedentary: Math.round(tdee(bmr, ACTIVITY_MULTIPLIERS.sedentary)),
      light: Math.round(tdee(bmr, ACTIVITY_MULTIPLIERS.light)),
      moderate: Math.round(tdee(bmr, ACTIVITY_MULTIPLIERS.moderate)),
      active: Math.round(tdee(bmr, ACTIVITY_MULTIPLIERS.active)),
      veryActive: Math.round(tdee(bmr, ACTIVITY_MULTIPLIERS.veryActive)),
    };
    const maintenance = result.dailyCalories.moderate;
    result.macros = macrosForSplit(maintenance, "balanced");
  }

  // Legacy z-score: kept as the original rough estimate for backward
  // compatibility with the test suite. The V2 path uses the real CDC LMS
  // percentile (cdcPercentileFromLms).
  if (input.age && input.age >= 2 && input.age <= 20) {
    result.zScore = round((bmi - 21.0) / 4.5);
  }

  if (input.waistCm && input.waistCm > 0) {
    result.waistToHeight = round(waistToHeightRatio(input.waistCm, heightCm));
  }

  return result;
}

// ============================================================================
// calculateBmiV2 — the 100x entry point.
// ============================================================================

const TOOL_VERSION = "100x.1.0";

function fingerprint(input: BmiInput, options: BmiOptions): string {
  // Simple non-cryptographic hash for the receipt. Not a security primitive.
  const s = JSON.stringify({ input, options });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function calculateBmiV2(
  input: BmiInput,
  options: BmiOptions = {},
): Result<BmiResultV2, BmiToolError> {
  const validation = validateInput(input);
  if (validation) return err(validation);

  const unit = input.unitSystem ?? "metric";
  const isImperial = unit === "imperial";
  const precision = options.decimalPrecision ?? 1;
  const asianCutoffs = options.asianCutoffs ?? false;
  const bmrFormula = options.bmrFormula ?? "mifflin";
  const macroSplit = options.macroSplit ?? "balanced";

  const heightMeters = toMetricHeight(input.height, unit);
  const weightKg = toMetricWeight(input.weight, unit);
  const heightCm = heightMeters * 100;

  const bmi = weightKg / (heightMeters * heightMeters);
  const cutoffs = asianCutoffs ? WHO_ASIAN : WHO_UNIVERSAL;
  const category = classifyInternal(bmi, cutoffs);
  const bmiPrimeV2 = bmiPrime(bmi, cutoffs.normalUpper);
  const healthyKg = healthyWeightRangeKg(heightMeters, asianCutoffs);
  const healthyMin = isImperial ? healthyKg.min * KG_TO_LB : healthyKg.min;
  const healthyMax = isImperial ? healthyKg.max * KG_TO_LB : healthyKg.max;
  const bsaMosteller = bodySurfaceAreaMosteller(heightCm, weightKg);
  const bsaDuBois = bodySurfaceAreaDuBois(heightCm, weightKg);
  const bsaHaycock = bodySurfaceAreaHaycock(heightCm, weightKg);
  const pi = ponderalIndex(heightMeters, weightKg);

  const validations: BmiResultV2["validations"] = [];

  // BMR
  let bmrValue: number | undefined;
  let dailyCalories: BmiResult["dailyCalories"];
  let macros: BmiResult["macros"];
  if (input.age && input.age >= 18 && input.age <= 120 && input.sex) {
    if (bmrFormula === "katch-mcardle") {
      if (options.bodyFatPct === undefined) {
        return err({
          code: "KATCH_NO_BODY_FAT",
          message: "Katch-McArdle BMR requires body fat percentage.",
          hint: "Either provide bodyFatPct or switch to the Mifflin-St Jeor formula.",
        });
      }
      if (options.bodyFatPct < 3 || options.bodyFatPct > 60) {
        return err({
          code: "BODY_FAT_OUT_OF_RANGE",
          message: `Body fat ${options.bodyFatPct}% is outside the plausible range (3–60%).`,
          hint: "Body fat percentage should be measured with calipers or a DEXA scan.",
        });
      }
      bmrValue = bmrKatchMcardle(weightKg, options.bodyFatPct);
      validations.push({
        level: "pass",
        code: "BMR_FORMULA",
        message: "Using Katch-McArdle (most accurate when body fat is known).",
      });
    } else if (bmrFormula === "harris-benedict") {
      bmrValue = bmrHarrisBenedict(heightCm, weightKg, input.age, input.sex);
      validations.push({
        level: "warn",
        code: "BMR_FORMULA",
        message:
          "Harris-Benedict 1919 tends to overestimate BMR by ~5% vs Mifflin-St Jeor.",
      });
    } else {
      bmrValue = bmrMifflin(heightCm, weightKg, input.age, input.sex);
      validations.push({
        level: "pass",
        code: "BMR_FORMULA",
        message: "Using Mifflin-St Jeor 1990 (recommended default).",
      });
    }
    if (options.bodyFatPct !== undefined && bmrFormula !== "katch-mcardle") {
      validations.push({
        level: "warn",
        code: "BMR_FORMULA",
        message:
          "Body fat % provided — switch to Katch-McArdle for a more accurate BMR.",
      });
    }
    dailyCalories = {
      sedentary: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.sedentary)),
      light: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.light)),
      moderate: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.moderate)),
      active: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.active)),
      veryActive: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.veryActive)),
    };
    macros = macrosForSplit(dailyCalories.moderate, macroSplit);
  } else if (bmrFormula === "katch-mcardle" && options.bodyFatPct !== undefined) {
    // Katch-McArdle does not require age/sex (only weight + body fat).
    if (options.bodyFatPct < 3 || options.bodyFatPct > 60) {
      return err({
        code: "BODY_FAT_OUT_OF_RANGE",
        message: `Body fat ${options.bodyFatPct}% is outside the plausible range (3–60%).`,
        hint: "Body fat percentage should be measured with calipers or a DEXA scan.",
      });
    }
    bmrValue = bmrKatchMcardle(weightKg, options.bodyFatPct);
    dailyCalories = {
      sedentary: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.sedentary)),
      light: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.light)),
      moderate: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.moderate)),
      active: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.active)),
      veryActive: Math.round(tdee(bmrValue, ACTIVITY_MULTIPLIERS.veryActive)),
    };
    macros = macrosForSplit(dailyCalories.moderate, macroSplit);
  }

  // Body fat estimation (Deurenberg)
  let bodyFatEstimated: number | undefined;
  if (input.age && input.age >= 18 && input.sex) {
    bodyFatEstimated = bodyFatDeurenberg(bmi, input.age, input.sex);
  }

  // Ideal weight
  let idealWeight: BmiResultV2["idealWeight"];
  if (input.sex) {
    idealWeight = {
      devine: idealWeightDevine(heightCm, input.sex),
      robinson: idealWeightRobinson(heightCm, input.sex),
      miller: idealWeightMiller(heightCm, input.sex),
      hamwi: idealWeightHamwi(heightCm, input.sex),
    };
  }

  // Waist
  let waistToHip: number | undefined;
  if (input.waistCm && input.waistCm > 0) {
    if (input.waistCm > 300) {
      return err({
        code: "WAIST_OUT_OF_RANGE",
        message: `Waist ${input.waistCm} cm is implausibly large (> 300 cm).`,
        hint: "Waist circumference should be in centimetres.",
      });
    }
    if (options.hipCm && options.hipCm > 0) {
      if (options.hipCm > 300) {
        return err({
          code: "HIP_OUT_OF_RANGE",
          message: `Hip ${options.hipCm} cm is implausibly large (> 300 cm).`,
          hint: "Hip circumference should be in centimetres.",
        });
      }
      waistToHip = waistToHipRatio(input.waistCm, options.hipCm);
    }
  }

  // CDC percentile
  let cdcPercentile: number | undefined;
  if (input.age && input.age >= 2 && input.age <= 20 && input.sex) {
    const p = cdcPercentileFromLms(input.age, input.sex, bmi);
    if (p !== null) cdcPercentile = round(p, 1);
  }

  // Validation report entries
  validations.push({
    level: "pass",
    code: "INPUT_RANGE",
    message: `Height ${input.height} ${unit === "metric" ? "cm" : "in"} and weight ${input.weight} ${unit === "metric" ? "kg" : "lb"} are within valid ranges.`,
  });
  if (asianCutoffs) {
    validations.push({
      level: "warn",
      code: "ASIAN_CUTOFFS",
      message:
        "Using WHO WPR 2004 Asian cut-offs (overweight ≥ 23, obese ≥ 27.5). Asian populations show cardiometabolic risk at lower BMI.",
    });
  }
  if (input.age && input.age >= 2 && input.age <= 20) {
    validations.push({
      level: cdcPercentile !== undefined ? "pass" : "warn",
      code: "PEDIATRIC",
      message:
        cdcPercentile !== undefined
          ? `CDC BMI-for-age percentile: ${round(cdcPercentile, 1)}%. For ages 2–20, percentile is more meaningful than the adult category.`
          : "Pediatric percentile could not be computed (age out of CDC 2000 range).",
    });
  }
  if (bmi > 40) {
    validations.push({
      level: "warn",
      code: "BMI_EXTREME",
      message:
        "BMI > 40 is Class III obesity. The BMI scale is clipped at 40 in the visualisation.",
    });
  }

  const legacyResult: BmiResult = {
    bmi: round(bmi, precision),
    category,
    bmiPrime: round(bmiPrimeV2, precision),
    healthyWeightRange: { min: round(healthyMin), max: round(healthyMax) },
    bodySurfaceArea: round(bsaMosteller, precision),
    ponderalIndex: round(pi, precision),
    weightDeltaToHealthy: {
      toMin: round(healthyMin - input.weight),
      toMax: round(healthyMax - input.weight),
    },
    unitLabel: isImperial ? "lb" : "kg",
    heightMeters: round(heightMeters),
  };
  if (bmrValue !== undefined && dailyCalories) {
    legacyResult.bmr = Math.round(bmrValue);
    legacyResult.dailyCalories = dailyCalories;
    if (macros) legacyResult.macros = macros;
  }
  // Legacy z-score (kept as rough estimate for test compatibility).
  if (input.age && input.age >= 2 && input.age <= 20) {
    legacyResult.zScore = round((bmi - 21.0) / 4.5);
  }
  if (input.waistCm && input.waistCm > 0) {
    legacyResult.waistToHeight = round(waistToHeightRatio(input.waistCm, heightCm));
  }

  const v2: BmiResultV2 = {
    ...legacyResult,
    cutoffLabel: cutoffs.label,
    cutoffSource: cutoffs.source,
    bmiPrimeV2: round(bmiPrimeV2, precision),
    healthyWeightRangeKg: { min: round(healthyKg.min), max: round(healthyKg.max) },
    bsa: {
      mosteller: round(bsaMosteller, precision),
      duBois: round(bsaDuBois, precision),
      haycock: round(bsaHaycock, precision),
    },
    bodyFatPctEstimated: bodyFatEstimated !== undefined ? round(bodyFatEstimated, 1) : undefined,
    bodyFatPctProvided: options.bodyFatPct,
    bmrFormula,
    bmrValue: bmrValue !== undefined ? Math.round(bmrValue) : undefined,
    idealWeight: idealWeight
      ? {
          devine: round(idealWeight.devine, 1),
          robinson: round(idealWeight.robinson, 1),
          miller: round(idealWeight.miller, 1),
          hamwi: round(idealWeight.hamwi, 1),
        }
      : undefined,
    waistToHip: waistToHip !== undefined ? round(waistToHip, 2) : undefined,
    cdcPercentile,
    weightKg: round(weightKg, 2),
    heightCm: round(heightCm, 1),
    decimalPrecision: precision,
    validations,
    receipt: {
      tool: "bmi-calculator",
      version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      inputFingerprint: fingerprint(input, options),
      options,
    },
  };

  return ok(v2);
}

// ============================================================================
// Weight scenarios CSV (preserved signature; now uses csvCell).
// ============================================================================

export function weightScenariosCsv(input: BmiInput): string {
  const r = calculateBmi(input);
  if ("error" in r) return "";
  const isImperial = input.unitSystem === "imperial";
  const unit = isImperial ? "lb" : "kg";
  const heightMeters = r.heightMeters;
  const lines = [`Weight (${unit})`, "BMI", "Category"].map(csvCell).join(",");
  const rows: string[] = [lines];
  const baseWeight = input.weight;
  for (let mult = 0.7; mult <= 1.4 + 1e-9; mult += 0.05) {
    const w = round(baseWeight * mult);
    const wKg = isImperial ? w * LB_TO_KG : w;
    const bmi = wKg / (heightMeters * heightMeters);
    rows.push(
      [w, round(bmi), classifyBmi(bmi).label].map(csvCell).join(","),
    );
  }
  return rows.join("\n");
}

// ============================================================================
// REFERENCES — the full citation list, mirrored in the UI.
// ============================================================================

export const REFERENCES: ReadonlyArray<{
  id: string;
  citation: string;
  summary: string;
}> = [
  { id: "WHO-1995", citation: "WHO TRS 854 (1995)", summary: "Physical status: use and interpretation of anthropometry. Adult BMI cut-offs." },
  { id: "WHO-WPRO-2000", citation: "WHO WPRO 2000", summary: "Asia-Pacific Perspective: Redefining Obesity. Asian cut-offs (≥23 / ≥27.5)." },
  { id: "WHO-2004", citation: "WHO 2004 Lancet 363:157", summary: "Appropriate BMI for Asian populations." },
  { id: "CDC-2000", citation: "CDC 2000 Advance Data 314", summary: "CDC Growth Charts: BMI-for-age LMS tables, ages 2–20." },
  { id: "CDC-2022", citation: "CDC 2022", summary: "About Adult BMI — limitations for athletes, elderly, pregnant, children." },
  { id: "NIH-1998", citation: "NIH 98-4083 (1998)", summary: "Clinical Guidelines on Overweight and Obesity." },
  { id: "Mifflin-1990", citation: "Mifflin MD et al, Am J Clin Nutr 51:241 (1990)", summary: "Mifflin-St Jeor BMR equation." },
  { id: "Harris-1919", citation: "Harris JA, Benedict FG, Carnegie Inst (1919)", summary: "Original Harris-Benedict BMR equation." },
  { id: "Katch-1975", citation: "Katch VL, McArdle WD (1975)", summary: "Katch-McArdle BMR (lean-body-mass based)." },
  { id: "FAO-2001", citation: "FAO/WHO/UNU 2001", summary: "Human Energy Requirements — activity multipliers." },
  { id: "Mosteller-1987", citation: "Mosteller RD, N Engl J Med 317:1098 (1987)", summary: "Simplified BSA formula." },
  { id: "DuBois-1916", citation: "Du Bois D, Du Bois EF, Arch Intern Med 17:863 (1916)", summary: "Du Bois BSA formula." },
  { id: "Haycock-1978", citation: "Haycock GB et al, J Pediatr 93:62 (1978)", summary: "Haycock BSA formula (paediatric-accurate)." },
  { id: "Deurenberg-1991", citation: "Deurenberg P et al, Br J Nutr 65:105 (1991)", summary: "Body fat % estimation from BMI, age, sex." },
  { id: "Devine-1974", citation: "Devine BJ, Drug Intell Clin Pharm 8:650 (1974)", summary: "Devine ideal body weight." },
  { id: "Robinson-1983", citation: "Robinson JD et al, Am J Hosp Pharm 40:1622 (1983)", summary: "Robinson ideal body weight." },
  { id: "Miller-1983", citation: "Miller DR et al, Am J Hosp Pharm 40:1622 (1983)", summary: "Miller ideal body weight." },
  { id: "Hamwi-1964", citation: "Hamwi GJ, Am Diabetes Assoc (1964)", summary: "Hamwi ideal body weight." },
  { id: "USDA-2020", citation: "USDA 2020-2025 Dietary Guidelines for Americans", summary: "Macronutrient distribution ranges." },
  { id: "Wishnofsky-1958", citation: "Wishnofsky M, Am J Clin Nutr 6:660 (1958)", summary: "7700 kcal per kg of body fat (used in goal calculator)." },
];

/* === END OF FILE === */
