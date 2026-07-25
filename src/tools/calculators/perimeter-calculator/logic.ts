/**
 * Perimeter Calculator — pure perimeter formulas for common shapes.
 *
 * Supports:
 *  - 5 shapes: rectangle, circle, triangle, polygon (regular), ellipse
 *  - Unit selector (mm/cm/m/km/in/ft/yd/mi) with conversion factors
 *  - Formula display (returns the symbolic formula used)
 *  - Worded step-by-step derivation
 *  - Triangle inequality validation
 *  - Polygon sides range validation (≥3)
 *  - Ramanujan's first approximation for ellipse circumference
 *  - Batch mode (multiple shape computations) with CSV export
 *  - Area bonus (per-shape area formulas returned alongside)
 *  - Apothem-based regular polygon support (alternative input)
 *  - All results rounded to N significant digits
 *  - Validation of all numeric inputs
 *  - Quick reference: formula strings per shape
 */
export type Shape = "rectangle" | "circle" | "triangle" | "polygon" | "ellipse";
export type LengthUnit = "mm" | "cm" | "m" | "km" | "in" | "ft" | "yd" | "mi";

export const PI = Math.PI;

/** Conversion factors to meters (1 unit = X meters). */
export const TO_METERS: Record<LengthUnit, number> = {
  mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
};

export const UNIT_LABELS: Record<LengthUnit, string> = {
  mm: "Millimeter (mm)", cm: "Centimeter (cm)", m: "Meter (m)", km: "Kilometer (km)",
  in: "Inch (in)", ft: "Foot (ft)", yd: "Yard (yd)", mi: "Mile (mi)",
};

export const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: "Rectangle (length, width)",
  circle: "Circle (radius)",
  triangle: "Triangle (a, b, c)",
  polygon: "Polygon (side length, sides)",
  ellipse: "Ellipse (a, b)",
};

export const FORMULAS: Record<Shape, string> = {
  rectangle: "P = 2 × (length + width)",
  circle: "P = 2 × π × radius",
  triangle: "P = a + b + c",
  polygon: "P = sideLength × sides",
  ellipse: "P ≈ π × (a + b) × (1 + 3h / (10 + √(4 − 3h)))  where  h = (a − b)² / (a + b)²",
};

export interface PerimeterInput {
  shape: Shape;
  values: number[];
  unit?: LengthUnit;
}

export interface PerimeterResult {
  perimeter: number;
  area: number;
  formula: string;
  derivation: string[];
  unit: LengthUnit;
  warnings: string[];
}

export function perimeterRectangle(length: number, width: number): number {
  return 2 * (length + width);
}

export function perimeterCircle(radius: number): number {
  return 2 * PI * radius;
}

export function perimeterTriangle(a: number, b: number, c: number): number {
  return a + b + c;
}

export function perimeterPolygon(sideLength: number, sides: number): number {
  return sideLength * sides;
}

/** Ramanujan's first approximation for ellipse perimeter. */
export function perimeterEllipse(a: number, b: number): number {
  if (a === 0 || b === 0) return 2 * Math.max(a, b);
  const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
  return PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** Area for each shape. */
export function areaRectangle(length: number, width: number): number { return length * width; }
export function areaCircle(radius: number): number { return PI * radius * radius; }
export function areaTriangle(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2;
  return Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
}
export function areaPolygon(sideLength: number, sides: number): number {
  return (sides * sideLength * sideLength) / (4 * Math.tan(PI / sides));
}
export function areaEllipse(a: number, b: number): number { return PI * a * b; }

/** Triangle inequality check. */
export function satisfiesTriangleInequality(a: number, b: number, c: number): boolean {
  return a + b > c && a + c > b && b + c > a;
}

/** Convert a length from one unit to another. */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  const meters = value * TO_METERS[from];
  return meters / TO_METERS[to];
}

/** Round to N decimal places. */
export function roundTo(value: number, decimals = 6): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Validate a perimeter input. */
export function validatePerimeterInput(input: PerimeterInput): { ok: true } | { error: string } {
  if (!input.values.every((v) => Number.isFinite(v) && v >= 0)) {
    return { error: "All dimensions must be non-negative numbers" };
  }
  if (input.shape === "polygon") {
    const sides = input.values[1];
    if (!Number.isInteger(sides) || sides < 3) return { error: "Polygon needs ≥ 3 integer sides" };
  }
  if (input.shape === "triangle") {
    const [a, b, c] = input.values;
    if (a! > 0 && b! > 0 && c! > 0 && !satisfiesTriangleInequality(a!, b!, c!)) {
      return { error: "Triangle inequality violated (a+b>c, a+c>b, b+c>a)" };
    }
  }
  return { ok: true };
}

/** Build a derivation (step-by-step) for a shape's perimeter. */
export function derivePerimeter(input: PerimeterInput): string[] {
  const v = input.values;
  const u = input.unit ?? "m";
  switch (input.shape) {
    case "rectangle":
      return [`length = ${v[0]} ${u}`, `width  = ${v[1]} ${u}`, `P = 2 × (${v[0]} + ${v[1]}) = 2 × ${v[0]! + v[1]!} = ${perimeterRectangle(v[0] ?? 0, v[1] ?? 0)} ${u}`];
    case "circle":
      return [`radius = ${v[0]} ${u}`, `P = 2 × π × ${v[0]} = ${perimeterCircle(v[0] ?? 0).toFixed(6)} ${u}`];
    case "triangle":
      return [`a = ${v[0]} ${u}`, `b = ${v[1]} ${u}`, `c = ${v[2]} ${u}`, `P = ${v[0]} + ${v[1]} + ${v[2]} = ${perimeterTriangle(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0)} ${u}`];
    case "polygon":
      return [`side = ${v[0]} ${u}`, `sides = ${v[1]}`, `P = ${v[0]} × ${v[1]} = ${perimeterPolygon(v[0] ?? 0, Math.round(v[1] ?? 0))} ${u}`];
    case "ellipse":
      return [`a = ${v[0]} ${u}`, `b = ${v[1]} ${u}`, `h = (${v[0]} − ${v[1]})² / (${v[0]} + ${v[1]})²`, `P ≈ ${perimeterEllipse(v[0] ?? 0, v[1] ?? 0).toFixed(6)} ${u} (Ramanujan I)`];
    default:
      return [];
  }
}

/** Compute perimeter + area + derivation for a single input. */
export function computePerimeter(input: PerimeterInput): PerimeterResult {
  const v = input.values;
  const unit = input.unit ?? "m";
  const warnings: string[] = [];
  let perimeter = 0; let area = 0;
  switch (input.shape) {
    case "rectangle":
      perimeter = perimeterRectangle(v[0] ?? 0, v[1] ?? 0);
      area = areaRectangle(v[0] ?? 0, v[1] ?? 0);
      break;
    case "circle":
      perimeter = perimeterCircle(v[0] ?? 0);
      area = areaCircle(v[0] ?? 0);
      break;
    case "triangle":
      perimeter = perimeterTriangle(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
      area = areaTriangle(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
      if (area === 0 && (v[0]! + v[1]! + v[2]!) > 0) warnings.push("Degenerate triangle (collinear).");
      break;
    case "polygon":
      perimeter = perimeterPolygon(v[0] ?? 0, Math.round(v[1] ?? 0));
      area = areaPolygon(v[0] ?? 0, Math.round(v[1] ?? 0));
      break;
    case "ellipse":
      perimeter = perimeterEllipse(v[0] ?? 0, v[1] ?? 0);
      area = areaEllipse(v[0] ?? 0, v[1] ?? 0);
      if (v[0] !== v[1]) warnings.push("Ellipse perimeter is an approximation (Ramanujan I).");
      break;
  }
  return { perimeter: roundTo(perimeter), area: roundTo(area), formula: FORMULAS[input.shape], derivation: derivePerimeter(input), unit, warnings };
}

/** Batch mode: compute for many inputs. */
export function computeBatch(inputs: PerimeterInput[]): PerimeterResult[] {
  return inputs.map((i) => computePerimeter(i));
}

/** Convert a batch to CSV. */
export function batchToCsv(results: PerimeterResult[], inputs: PerimeterInput[]): string {
  const lines = ["Shape,Unit,Perimeter,Area,Formula"];
  for (let i = 0; i < results.length; i++) {
    lines.push(`${inputs[i]!.shape},${results[i]!.unit},${results[i]!.perimeter},${results[i]!.area},"${results[i]!.formula.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Apothem → side length conversion for regular polygons. */
export function apothemToSide(apothem: number, sides: number): number {
  if (sides < 3) return 0;
  return 2 * apothem * Math.tan(PI / sides);
}

/** Format a result as a multi-line summary. */
export function formatResult(r: PerimeterResult): string {
  return [
    `Perimeter: ${r.perimeter} ${r.unit}`,
    `Area: ${r.area} ${r.unit}²`,
    `Formula: ${r.formula}`,
    "",
    "Derivation:",
    ...r.derivation.map((d) => `  - ${d}`),
    ...(r.warnings.length > 0 ? ["", "Warnings:", ...r.warnings.map((w) => `  - ${w}`)] : []),
  ].join("\n");
}

/** Compute perimeter in ALL units (table). */
export function perimeterInAllUnits(r: PerimeterResult): { unit: LengthUnit; value: number }[] {
  return (Object.keys(TO_METERS) as LengthUnit[]).map((u) => ({ unit: u, value: roundTo(convertLength(r.perimeter, r.unit, u), 6) }));
}

/** Param labels for each shape (UI helper). */
export const PARAMS: Record<Shape, string[]> = {
  rectangle: ["length", "width"],
  circle: ["radius"],
  triangle: ["a", "b", "c"],
  polygon: ["side length", "sides"],
  ellipse: ["a (semi-major)", "b (semi-minor)"],
};
