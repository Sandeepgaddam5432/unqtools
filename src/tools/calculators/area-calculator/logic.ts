/**
 * Area Calculator — pure area formulas for common shapes.
 */
export type Shape = "rectangle" | "circle" | "triangle" | "trapezoid" | "ellipse" | "parallelogram";

export const PI = Math.PI;

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

export function validateAreaInput(input: AreaInput): { ok: true } | { error: string } {
  if (!input.values.every((v) => Number.isFinite(v) && v >= 0)) {
    return { error: "All dimensions must be non-negative numbers" };
  }
  const need = input.shape === "trapezoid" ? 3 : (input.shape === "circle" ? 1 : 2);
  if (input.values.length < need) return { error: `${input.shape} needs ${need} dimension(s)` };
  return { ok: true };
}

export const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: "Rectangle (length × width)",
  circle: "Circle (radius)",
  triangle: "Triangle (base × height)",
  trapezoid: "Trapezoid (baseA, baseB, height)",
  ellipse: "Ellipse (semi-major × semi-minor)",
  parallelogram: "Parallelogram (base × height)",
};
