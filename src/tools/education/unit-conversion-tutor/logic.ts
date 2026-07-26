/**
 * Unit Conversion Tutor — pure logic.
 *
 * A step-by-step tutor for unit conversion. The tutor presents problems
 * across categories (length, mass, volume, temperature, time, speed),
 * shows worked solutions using the factor-label method, and can
 * generate fresh practice problems with hidden answers.
 */

export type Category = "length" | "mass" | "volume" | "temperature" | "time" | "speed";

export interface UnitDef {
  symbol: string;
  name: string;
  /** Factor relative to the category's canonical unit. */
  toCanonical: number;
}

export interface CategoryDef {
  category: Category;
  label: string;
  canonical: string;
  units: UnitDef[];
}

export interface ConversionStep {
  description: string;
  expression: string;
  result: number;
}

export interface WorkedSolution {
  input: { value: number; unit: string };
  output: { value: number; unit: string };
  canonical: { value: number; unit: string };
  steps: ConversionStep[];
  formula: string;
}

export interface PracticeProblem {
  id: string;
  category: Category;
  prompt: string;
  fromUnit: string;
  toUnit: string;
  fromValue: number;
  answer: number;
  solution: WorkedSolution;
}

export const CATEGORIES: CategoryDef[] = [
  {
    category: "length",
    label: "Length",
    canonical: "m",
    units: [
      { symbol: "mm", name: "Millimetre", toCanonical: 0.001 },
      { symbol: "cm", name: "Centimetre", toCanonical: 0.01 },
      { symbol: "m", name: "Metre", toCanonical: 1 },
      { symbol: "km", name: "Kilometre", toCanonical: 1000 },
      { symbol: "in", name: "Inch", toCanonical: 0.0254 },
      { symbol: "ft", name: "Foot", toCanonical: 0.3048 },
      { symbol: "mi", name: "Mile", toCanonical: 1609.344 },
    ],
  },
  {
    category: "mass",
    label: "Mass",
    canonical: "kg",
    units: [
      { symbol: "mg", name: "Milligram", toCanonical: 0.000001 },
      { symbol: "g", name: "Gram", toCanonical: 0.001 },
      { symbol: "kg", name: "Kilogram", toCanonical: 1 },
      { symbol: "t", name: "Tonne", toCanonical: 1000 },
      { symbol: "lb", name: "Pound", toCanonical: 0.45359237 },
      { symbol: "oz", name: "Ounce", toCanonical: 0.028349523125 },
    ],
  },
  {
    category: "volume",
    label: "Volume",
    canonical: "L",
    units: [
      { symbol: "mL", name: "Millilitre", toCanonical: 0.001 },
      { symbol: "L", name: "Litre", toCanonical: 1 },
      { symbol: "m³", name: "Cubic metre", toCanonical: 1000 },
      { symbol: "gal", name: "US gallon", toCanonical: 3.785411784 },
      { symbol: "qt", name: "US quart", toCanonical: 0.946352946 },
      { symbol: "cup", name: "US cup", toCanonical: 0.2365882365 },
    ],
  },
  {
    category: "time",
    label: "Time",
    canonical: "s",
    units: [
      { symbol: "ms", name: "Millisecond", toCanonical: 0.001 },
      { symbol: "s", name: "Second", toCanonical: 1 },
      { symbol: "min", name: "Minute", toCanonical: 60 },
      { symbol: "h", name: "Hour", toCanonical: 3600 },
      { symbol: "day", name: "Day", toCanonical: 86400 },
      { symbol: "week", name: "Week", toCanonical: 604800 },
    ],
  },
  {
    category: "speed",
    label: "Speed",
    canonical: "m/s",
    units: [
      { symbol: "m/s", name: "Metres per second", toCanonical: 1 },
      { symbol: "km/h", name: "Kilometres per hour", toCanonical: 0.2777777778 },
      { symbol: "mph", name: "Miles per hour", toCanonical: 0.44704 },
      { symbol: "ft/s", name: "Feet per second", toCanonical: 0.3048 },
      { symbol: "knot", name: "Knot", toCanonical: 0.5144444444 },
    ],
  },
];

export function getCategory(cat: Category): CategoryDef {
  const c = CATEGORIES.find((x) => x.category === cat);
  if (!c) throw new Error("Unknown category: " + cat);
  return c;
}

const round = (n: number, digits = 6) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

/** Solve a linear (factor-label) conversion, returning a worked solution. */
export function solveConversion(value: number, fromUnit: string, toUnit: string, cat: Category): WorkedSolution | { error: string } {
  if (!Number.isFinite(value)) return { error: "Value must be a finite number." };
  const def = getCategory(cat);
  const from = def.units.find((u) => u.symbol === fromUnit);
  const to = def.units.find((u) => u.symbol === toUnit);
  if (!from) return { error: `Unknown source unit: ${fromUnit}` };
  if (!to) return { error: `Unknown target unit: ${toUnit}` };

  const canonicalValue = value * from.toCanonical;
  const result = canonicalValue / to.toCanonical;
  const steps: ConversionStep[] = [
    {
      description: `Convert ${value} ${from.symbol} to the canonical unit (${def.canonical}).`,
      expression: `${value} × ${from.toCanonical}`,
      result: round(canonicalValue, 8),
    },
    {
      description: `Convert ${round(canonicalValue, 8)} ${def.canonical} to ${to.symbol}.`,
      expression: `${round(canonicalValue, 8)} ÷ ${to.toCanonical}`,
      result: round(result, 8),
    },
  ];
  return {
    input: { value, unit: from.symbol },
    output: { value: round(result), unit: to.symbol },
    canonical: { value: round(canonicalValue), unit: def.canonical },
    steps,
    formula: `${value} ${from.symbol} × (${from.toCanonical} / ${to.toCanonical}) = ${round(result)} ${to.symbol}`,
  };
}

/** Solve a temperature conversion (special-cased because °C ↔ °F are affine). */
export function solveTemperature(value: number, from: "C" | "F" | "K", to: "C" | "F" | "K"): WorkedSolution | { error: string } {
  if (!Number.isFinite(value)) return { error: "Value must be a finite number." };
  let celsius: number;
  let step1 = "";
  if (from === "C") { celsius = value; step1 = `${value} °C stays as ${value} °C.`; }
  else if (from === "F") { celsius = (value - 32) * (5 / 9); step1 = `(${value} − 32) × 5/9 = ${round(celsius, 6)} °C`; }
  else { celsius = value - 273.15; step1 = `${value} K − 273.15 = ${round(celsius, 6)} °C`; }

  let result: number;
  let step2 = "";
  if (to === "C") { result = celsius; step2 = `${round(celsius, 6)} °C stays as ${round(result)} °C.`; }
  else if (to === "F") { result = celsius * (9 / 5) + 32; step2 = `${round(celsius, 6)} × 9/5 + 32 = ${round(result)} °F`; }
  else { result = celsius + 273.15; step2 = `${round(celsius, 6)} + 273.15 = ${round(result)} K`; }

  return {
    input: { value, unit: `°${from}` },
    output: { value: round(result), unit: `°${to}` },
    canonical: { value: round(celsius), unit: "°C" },
    steps: [
      { description: `Convert ${value} °${from} to °C (canonical).`, expression: step1, result: round(celsius) },
      { description: `Convert ${round(celsius)} °C to °${to}.`, expression: step2, result: round(result) },
    ],
    formula: `${value} °${from} → ${round(result)} °${to}`,
  };
}

/** Generate a fresh practice problem for the given category. */
export function generatePractice(cat: Category, rng: () => number = Math.random): PracticeProblem | { error: string } {
  const def = getCategory(cat);
  if (def.units.length < 2) return { error: "Category needs at least two units." };
  const fromIdx = Math.floor(rng() * def.units.length);
  let toIdx = Math.floor(rng() * def.units.length);
  while (toIdx === fromIdx) toIdx = Math.floor(rng() * def.units.length);
  const from = def.units[fromIdx]!;
  const to = def.units[toIdx]!;
  const value = Math.floor(rng() * 100) + 1;
  const sol = solveConversion(value, from.symbol, to.symbol, cat);
  if ("error" in sol) return sol;
  return {
    id: `practice-${cat}-${Math.floor(rng() * 100000)}`,
    category: cat,
    prompt: `Convert ${value} ${from.symbol} to ${to.symbol}.`,
    fromUnit: from.symbol,
    toUnit: to.symbol,
    fromValue: value,
    answer: sol.output.value,
    solution: sol,
  };
}

/** Check a user's answer against a problem. */
export function checkAnswer(problem: PracticeProblem, userAnswer: number, tolerance = 0.01): boolean {
  return Math.abs(userAnswer - problem.answer) <= tolerance;
}

/** Convert a worked solution to a step-by-step plain-text walkthrough. */
export function solutionToText(s: WorkedSolution): string {
  const lines: string[] = [];
  lines.push(`Problem: convert ${s.input.value} ${s.input.unit} to ${s.output.unit}`);
  lines.push(`Answer: ${s.output.value} ${s.output.unit}`);
  lines.push("");
  lines.push("Steps:");
  s.steps.forEach((step, i) => {
    lines.push(`  ${i + 1}. ${step.description}`);
    lines.push(`     ${step.expression} = ${step.result}`);
  });
  lines.push("");
  lines.push(`Formula: ${s.formula}`);
  return lines.join("\n");
}
