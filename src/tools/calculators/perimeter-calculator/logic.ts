/**
 * Perimeter Calculator — pure perimeter formulas for common shapes.
 */
export type Shape = "rectangle" | "circle" | "triangle" | "polygon" | "ellipse";

export const PI = Math.PI;

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

export interface PerimeterInput {
  shape: Shape;
  values: number[];
}

export function computePerimeter(input: PerimeterInput): number {
  const v = input.values;
  switch (input.shape) {
    case "rectangle": return perimeterRectangle(v[0] ?? 0, v[1] ?? 0);
    case "circle":    return perimeterCircle(v[0] ?? 0);
    case "triangle":  return perimeterTriangle(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
    case "polygon":   return perimeterPolygon(v[0] ?? 0, Math.round(v[1] ?? 0));
    case "ellipse":   return perimeterEllipse(v[0] ?? 0, v[1] ?? 0);
    default:          return 0;
  }
}

export function validatePerimeterInput(input: PerimeterInput): { ok: true } | { error: string } {
  if (!input.values.every((v) => Number.isFinite(v) && v >= 0)) {
    return { error: "All dimensions must be non-negative numbers" };
  }
  if (input.shape === "polygon") {
    const sides = input.values[1];
    if (!Number.isInteger(sides) || sides! < 3) return { error: "Polygon needs ≥ 3 sides" };
  }
  return { ok: true };
}

export const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: "Rectangle (length, width)",
  circle: "Circle (radius)",
  triangle: "Triangle (a, b, c)",
  polygon: "Polygon (side length, sides)",
  ellipse: "Ellipse (a, b)",
};
