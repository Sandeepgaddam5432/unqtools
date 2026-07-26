/**
 * 3D Shape Constructor — pure logic.
 *
 * Computes surface area, volume, and a 2D net-layout description for
 * the five common 3D shapes taught in school geometry:
 *
 *   • Cube              — side s
 *   • Sphere            — radius r
 *   • Cylinder          — radius r, height h
 *   • Cone              — radius r, height h
 *   • Square pyramid    — base b, height h
 *
 * Net layouts are returned as a list of labelled 2D faces with their
 * dimensions so a UI can render a flattened unfolding schematic.
 */

export type ShapeType = "cube" | "sphere" | "cylinder" | "cone" | "pyramid";

export interface ShapeInput {
  shape: ShapeType;
  /** Side (cube) / base (pyramid) length in units. */
  side?: number;
  /** Radius (sphere, cylinder, cone). */
  radius?: number;
  /** Height (cylinder, cone, pyramid). */
  height?: number;
}

export interface NetFace {
  /** Shape of the 2D face. */
  face: "square" | "circle" | "rectangle" | "triangle" | "sector";
  label: string;
  /** Dimensions in 2D (length × width, or radius for circles/sectors). */
  dimensions: { a: number; b: number; r?: number; angle?: number };
  /** Count of this face in the net (e.g. cube has 6 squares). */
  count: number;
}

export interface ShapeResult {
  shape: ShapeType;
  inputs: Record<string, number>;
  surfaceArea: number;
  volume: number;
  /** Additional helpful derived properties (e.g. slant height). */
  properties: { name: string; value: number; unit: string }[];
  net: NetFace[];
  formulas: { surface: string; volume: string };
  warnings: string[];
}

const round = (n: number, digits = 6) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

export function calculateShape(input: ShapeInput): ShapeResult | { error: string } {
  const warnings: string[] = [];
  const s = input.side ?? 0;
  const r = input.radius ?? 0;
  const h = input.height ?? 0;

  if (input.shape === "cube") {
    if (s <= 0) return { error: "Cube side must be greater than 0." };
    return {
      shape: "cube",
      inputs: { side: s },
      surfaceArea: round(6 * s * s),
      volume: round(s * s * s),
      properties: [
        { name: "Face area", value: round(s * s), unit: "u²" },
        { name: "Diagonal (face)", value: round(s * Math.SQRT2), unit: "u" },
        { name: "Diagonal (space)", value: round(s * Math.sqrt(3)), unit: "u" },
        { name: "Perimeter", value: round(12 * s), unit: "u" },
      ],
      net: [
        { face: "square", label: "Face", dimensions: { a: s, b: s }, count: 6 },
      ],
      formulas: { surface: "6s²", volume: "s³" },
      warnings,
    };
  }

  if (input.shape === "sphere") {
    if (r <= 0) return { error: "Sphere radius must be greater than 0." };
    return {
      shape: "sphere",
      inputs: { radius: r },
      surfaceArea: round(4 * Math.PI * r * r),
      volume: round((4 / 3) * Math.PI * r * r * r),
      properties: [
        { name: "Diameter", value: round(2 * r), unit: "u" },
        { name: "Circumference", value: round(2 * Math.PI * r), unit: "u" },
        { name: "Great-circle area", value: round(Math.PI * r * r), unit: "u²" },
      ],
      net: [
        { face: "circle", label: "Great circle (reference)", dimensions: { a: 2 * r, b: 2 * r, r }, count: 1 },
      ],
      formulas: { surface: "4πr²", volume: "(4/3)πr³" },
      warnings: ["Spheres have no flat net — shown as a great-circle reference."],
    };
  }

  if (input.shape === "cylinder") {
    if (r <= 0) return { error: "Cylinder radius must be greater than 0." };
    if (h <= 0) return { error: "Cylinder height must be greater than 0." };
    return {
      shape: "cylinder",
      inputs: { radius: r, height: h },
      surfaceArea: round(2 * Math.PI * r * (r + h)),
      volume: round(Math.PI * r * r * h),
      properties: [
        { name: "Base area", value: round(Math.PI * r * r), unit: "u²" },
        { name: "Lateral area", value: round(2 * Math.PI * r * h), unit: "u²" },
        { name: "Circumference", value: round(2 * Math.PI * r), unit: "u" },
      ],
      net: [
        { face: "circle", label: "Base", dimensions: { a: 2 * r, b: 2 * r, r }, count: 2 },
        { face: "rectangle", label: "Lateral", dimensions: { a: round(2 * Math.PI * r), b: h }, count: 1 },
      ],
      formulas: { surface: "2πr(r + h)", volume: "πr²h" },
      warnings,
    };
  }

  if (input.shape === "cone") {
    if (r <= 0) return { error: "Cone radius must be greater than 0." };
    if (h <= 0) return { error: "Cone height must be greater than 0." };
    const slant = Math.sqrt(r * r + h * h);
    const sectorAngle = (2 * Math.PI * r) / slant; // radians
    return {
      shape: "cone",
      inputs: { radius: r, height: h },
      surfaceArea: round(Math.PI * r * (r + slant)),
      volume: round((1 / 3) * Math.PI * r * r * h),
      properties: [
        { name: "Slant height", value: round(slant), unit: "u" },
        { name: "Base area", value: round(Math.PI * r * r), unit: "u²" },
        { name: "Lateral area", value: round(Math.PI * r * slant), unit: "u²" },
        { name: "Sector angle", value: round((sectorAngle * 180) / Math.PI), unit: "°" },
      ],
      net: [
        { face: "circle", label: "Base", dimensions: { a: 2 * r, b: 2 * r, r }, count: 1 },
        { face: "sector", label: "Lateral (sector)", dimensions: { a: slant, b: slant, r: slant, angle: round((sectorAngle * 180) / Math.PI) }, count: 1 },
      ],
      formulas: { surface: "πr(r + ℓ)  where ℓ = √(r² + h²)", volume: "(1/3)πr²h" },
      warnings,
    };
  }

  if (input.shape === "pyramid") {
    if (s <= 0) return { error: "Pyramid base side must be greater than 0." };
    if (h <= 0) return { error: "Pyramid height must be greater than 0." };
    const slant = Math.sqrt((s / 2) * (s / 2) + h * h);
    const triArea = (s * slant) / 2;
    return {
      shape: "pyramid",
      inputs: { side: s, height: h },
      surfaceArea: round(s * s + 4 * triArea),
      volume: round((1 / 3) * s * s * h),
      properties: [
        { name: "Slant height", value: round(slant), unit: "u" },
        { name: "Base area", value: round(s * s), unit: "u²" },
        { name: "Triangle face area", value: round(triArea), unit: "u²" },
        { name: "Lateral area", value: round(4 * triArea), unit: "u²" },
      ],
      net: [
        { face: "square", label: "Base", dimensions: { a: s, b: s }, count: 1 },
        { face: "triangle", label: "Side", dimensions: { a: s, b: slant }, count: 4 },
      ],
      formulas: { surface: "b² + 2bℓ  where ℓ = √((b/2)² + h²)", volume: "(1/3)b²h" },
      warnings,
    };
  }

  return { error: "Unknown shape." };
}

/** Format the result as plain text. */
export function resultToText(r: ShapeResult): string {
  const lines: string[] = [];
  lines.push(`Shape: ${r.shape}`);
  lines.push(`Inputs: ${Object.entries(r.inputs).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  lines.push(`Surface area: ${r.surfaceArea} u²`);
  lines.push(`Volume: ${r.volume} u³`);
  lines.push(`Formulas: S=${r.formulas.surface}  V=${r.formulas.volume}`);
  lines.push("");
  lines.push("Properties:");
  for (const p of r.properties) lines.push(`  ${p.name}: ${p.value} ${p.unit}`);
  lines.push("");
  lines.push("Net layout:");
  for (const n of r.net) lines.push(`  ${n.label} (${n.face}) × ${n.count}`);
  for (const w of r.warnings) lines.push(`⚠️ ${w}`);
  return lines.join("\n");
}

/** Convert the result to CSV. */
export function resultToCsv(r: ShapeResult): string {
  const lines = ["Property,Value,Unit"];
  lines.push(`Surface area,${r.surfaceArea},u²`);
  lines.push(`Volume,${r.volume},u³`);
  for (const p of r.properties) lines.push(`${p.name},${p.value},${p.unit}`);
  for (const n of r.net) lines.push(`Net: ${n.label} (${n.face}),×${n.count},-`);
  return lines.join("\n");
}

/** Describe the net layout as a numbered build plan. */
export function netBuildPlan(r: ShapeResult): string {
  const lines: string[] = [`Net build plan for ${r.shape}:`];
  let step = 1;
  for (const n of r.net) {
    const dimDesc = n.face === "circle" || n.face === "sector"
      ? `radius ${n.dimensions.r}${n.dimensions.angle ? `, angle ${n.dimensions.angle}°` : ""}`
      : `${n.dimensions.a} × ${n.dimensions.b}`;
    lines.push(`${step}. Cut ${n.count} ${n.face}(s) — ${dimDesc} — for the ${n.label.toLowerCase()}.`);
    step++;
  }
  lines.push(`${step}. Tape/assemble the faces along their shared edges to form the ${r.shape}.`);
  return lines.join("\n");
}
