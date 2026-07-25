/**
 * Area Calculator — pure area formulas for common shapes.
 *
 * Features:
 *  - 6 shapes: rectangle, circle, triangle, trapezoid, ellipse, parallelogram
 *  - Human-readable formula strings
 *  - Unit selector (metric + imperial + acre/hectare)
 *  - Batch mode (multiple shapes in one go)
 *  - Cross-unit conversion
 *  - Stats aggregation
 *  - CSV export
 */

export type Shape =
  | "rectangle"
  | "circle"
  | "triangle"
  | "trapezoid"
  | "ellipse"
  | "parallelogram";

export type AreaUnit = "m2" | "cm2" | "mm2" | "km2" | "ft2" | "in2" | "yd2" | "acre" | "ha";

export const PI = Math.PI;

export const UNIT_LABELS: Record<AreaUnit, string> = {
  m2: "Square meter (m²)",
  cm2: "Square centimeter (cm²)",
  mm2: "Square millimeter (mm²)",
  km2: "Square kilometer (km²)",
  ft2: "Square foot (ft²)",
  in2: "Square inch (in²)",
  yd2: "Square yard (yd²)",
  acre: "Acre (ac)",
  ha: "Hectare (ha)",
};

/** Conversion factor: 1 unit = N square meters. */
export const TO_M2: Record<AreaUnit, number> = {
  m2: 1,
  cm2: 1e-4,
  mm2: 1e-6,
  km2: 1e6,
  ft2: 0.09290304,
  in2: 0.00064516,
  yd2: 0.83612736,
  acre: 4046.8564224,
  ha: 10000,
};

const round4 = (n: number): number => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

export function areaRectangle(length: number, width: number): number {
  return length * width;
}

export function areaCircle(radius: number): number {
  return PI * radius * radius;
}

export function areaTriangle(base: number, height: number): number {
  return 0.5 * base * height;
}

export function areaTrapezoid(baseA: number, baseB: number, height: number): number {
  return 0.5 * (baseA + baseB) * height;
}

export function areaEllipse(semiMajor: number, semiMinor: number): number {
  return PI * semiMajor * semiMinor;
}

export function areaParallelogram(base: number, height: number): number {
  return base * height;
}

export interface AreaInput {
  shape: Shape;
  values: number[];
}

export interface AreaResult {
  shape: Shape;
  area: number;
  unit: AreaUnit;
  formula: string;
  formulaFilled: string;
}

export const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: "Rectangle (length × width)",
  circle: "Circle (radius)",
  triangle: "Triangle (base × height)",
  trapezoid: "Trapezoid (baseA, baseB, height)",
  ellipse: "Ellipse (semi-major × semi-minor)",
  parallelogram: "Parallelogram (base × height)",
};

export const SHAPE_FORMULAS: Record<Shape, string> = {
  rectangle: "length × width",
  circle: "π × r²",
  triangle: "0.5 × base × height",
  trapezoid: "0.5 × (baseA + baseB) × height",
  ellipse: "π × a × b",
  parallelogram: "base × height",
};

export const SHAPE_PARAMS: Record<Shape, string[]> = {
  rectangle: ["length", "width"],
  circle: ["radius"],
  triangle: ["base", "height"],
  trapezoid: ["baseA", "baseB", "height"],
  ellipse: ["semi-major", "semi-minor"],
  parallelogram: ["base", "height"],
};

/** Compute raw area (in same unit² as the inputs). */
export function computeArea(input: AreaInput): number {
  const v = input.values;
  switch (input.shape) {
    case "rectangle":     return areaRectangle(v[0] ?? 0, v[1] ?? 0);
    case "circle":        return areaCircle(v[0] ?? 0);
    case "triangle":      return areaTriangle(v[0] ?? 0, v[1] ?? 0);
    case "trapezoid":     return areaTrapezoid(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
    case "ellipse":       return areaEllipse(v[0] ?? 0, v[1] ?? 0);
    case "parallelogram": return areaParallelogram(v[0] ?? 0, v[1] ?? 0);
    default:              return 0;
  }
}

/** Build a filled-in formula string for a shape + values. */
export function fillFormula(shape: Shape, values: number[]): string {
  const v = values;
  const num = (n: number | undefined) => (n == null ? "?" : String(n));
  switch (shape) {
    case "rectangle":     return `${num(v[0])} × ${num(v[1])}`;
    case "circle":        return `π × ${num(v[0])}²`;
    case "triangle":      return `0.5 × ${num(v[0])} × ${num(v[1])}`;
    case "trapezoid":     return `0.5 × (${num(v[0])} + ${num(v[1])}) × ${num(v[2])}`;
    case "ellipse":       return `π × ${num(v[0])} × ${num(v[1])}`;
    case "parallelogram": return `${num(v[0])} × ${num(v[1])}`;
    default:              return "";
  }
}

export function validateAreaInput(input: AreaInput): { ok: true } | { error: string } {
  if (!input.values.every((v) => Number.isFinite(v) && v >= 0)) {
    return { error: "All dimensions must be non-negative numbers" };
  }
  const need = input.shape === "trapezoid" ? 3 : (input.shape === "circle" ? 1 : 2);
  if (input.values.length < need) return { error: `${input.shape} needs ${need} dimension(s)` };
  return { ok: true };
}

/** Compute area + attach formula + convert to chosen unit. */
export function computeAreaWithUnit(input: AreaInput, unit: AreaUnit): AreaResult | { error: string } {
  const v = validateAreaInput(input);
  if ("error" in v) return v;
  return {
    shape: input.shape,
    area: round4(computeArea(input)),
    unit,
    formula: SHAPE_FORMULAS[input.shape],
    formulaFilled: fillFormula(input.shape, input.values),
  };
}

/** Convert an area value between two units. */
export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return round4((value * TO_M2[from]) / TO_M2[to]);
}

/** Batch compute areas for multiple inputs in the same unit. */
export function batchCompute(inputs: AreaInput[], unit: AreaUnit): AreaResult[] {
  const out: AreaResult[] = [];
  for (const i of inputs) {
    const r = computeAreaWithUnit(i, unit);
    if ("error" in r) continue;
    out.push(r);
  }
  return out;
}

/** Aggregate stats across a batch. */
export function batchStats(results: AreaResult[]): {
  count: number;
  total: number;
  mean: number;
  min: number;
  max: number;
} {
  if (!results.length) return { count: 0, total: 0, mean: 0, min: 0, max: 0 };
  const areas = results.map((r) => r.area);
  const total = areas.reduce((s, a) => s + a, 0);
  return {
    count: results.length,
    total: round4(total),
    mean: round4(total / results.length),
    min: round4(Math.min(...areas)),
    max: round4(Math.max(...areas)),
  };
}

/** Format an area value with its unit symbol. */
export function formatArea(value: number, unit: AreaUnit, digits = 4): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)} ${unit}`;
}

/** Serialize batch results to CSV. */
export function batchToCsv(results: AreaResult[]): string {
  const lines = ["Shape,Area,Unit,Formula"];
  for (const r of results) {
    lines.push(`${r.shape},${r.area},${r.unit},"${r.formulaFilled.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Serialize all-unit conversion table to CSV. */
export function convertAllToCsv(value: number, from: AreaUnit): string {
  const lines = ["Unit,Value"];
  for (const u of Object.keys(TO_M2) as AreaUnit[]) {
    lines.push(`${u},${convertArea(value, from, u)}`);
  }
  return lines.join("\n");
}
