/**
 * Acceleration & Force Calculator — pure logic.
 *
 * Newton's Second Law: F = m·a
 *
 * Solves for any one of the three variables given the other two:
 *   • Force (F) given mass (m) and acceleration (a)
 *   • Mass (m) given force (F) and acceleration (a)
 *   • Acceleration (a) given force (F) and mass (m)
 *
 * Supports unit conversion for force (N, kN, lbf, dyn, kgf) and mass
 * (kg, g, lb, slug). Acceleration is in m/s² by default with a g-force
 * conversion helper.
 */

export type SolveFor = "force" | "mass" | "acceleration";

export type ForceUnit = "N" | "kN" | "lbf" | "dyn" | "kgf";
export type MassUnit = "kg" | "g" | "lb" | "slug";
export type AccelUnit = "mps2" | "g";

export interface AccelForceInput {
  solveFor: SolveFor;
  force?: { value: number; unit: ForceUnit };
  mass?: { value: number; unit: MassUnit };
  acceleration?: { value: number; unit: AccelUnit };
}

export interface AccelForceResult {
  solveFor: SolveFor;
  /** Result in canonical SI units: N, kg, m/s². */
  canonical: { forceN: number; massKg: number; accelMps2: number };
  /** Result in the requested / default display unit. */
  result: { value: number; unit: string; label: string };
  /** All-units table for the solved variable. */
  table: { unit: string; label: string; value: number }[];
  newtonsLawsRef: { name: string; statement: string }[];
  warnings: string[];
}

// Conversion factors to canonical (SI):
export const FORCE_TO_N: Record<ForceUnit, number> = {
  N: 1,
  kN: 1000,
  lbf: 4.4482216152605,
  dyn: 1e-5,
  kgf: 9.80665,
};

export const MASS_TO_KG: Record<MassUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  slug: 14.5939029372,
};

export const ACCEL_TO_MPS2: Record<AccelUnit, number> = {
  mps2: 1,
  g: 9.80665,
};

export const FORCE_LABELS: Record<ForceUnit, string> = {
  N: "Newton (N)",
  kN: "Kilonewton (kN)",
  lbf: "Pound-force (lbf)",
  dyn: "Dyne (dyn)",
  kgf: "Kilogram-force (kgf)",
};

export const MASS_LABELS: Record<MassUnit, string> = {
  kg: "Kilogram (kg)",
  g: "Gram (g)",
  lb: "Pound (lb)",
  slug: "Slug (slug)",
};

export const ACCEL_LABELS: Record<AccelUnit, string> = {
  mps2: "Metres per second² (m/s²)",
  g: "g-force (g)",
};

const round = (n: number, digits = 6) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

export const NEWTONS_LAWS = [
  { name: "First Law (Inertia)", statement: "An object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted upon by a net external force." },
  { name: "Second Law (F = ma)", statement: "The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass: F = m·a." },
  { name: "Third Law (Action–Reaction)", statement: "For every action there is an equal and opposite reaction: F_AB = −F_BA." },
];

function toCanonicalForce(f: { value: number; unit: ForceUnit }): number {
  return f.value * FORCE_TO_N[f.unit];
}
function toCanonicalMass(m: { value: number; unit: MassUnit }): number {
  return m.value * MASS_TO_KG[m.unit];
}
function toCanonicalAccel(a: { value: number; unit: AccelUnit }): number {
  return a.value * ACCEL_TO_MPS2[a.unit];
}

export function calculate(input: AccelForceInput): AccelForceResult | { error: string } {
  const warnings: string[] = [];
  let forceN = 0;
  let massKg = 0;
  let accelMps2 = 0;

  if (input.solveFor === "force") {
    if (!input.mass || !input.acceleration) return { error: "Solving for force requires mass and acceleration." };
    if (input.mass.value <= 0) return { error: "Mass must be greater than 0." };
    massKg = toCanonicalMass(input.mass);
    accelMps2 = toCanonicalAccel(input.acceleration);
    forceN = massKg * accelMps2;
  } else if (input.solveFor === "mass") {
    if (!input.force || !input.acceleration) return { error: "Solving for mass requires force and acceleration." };
    if (input.acceleration.value === 0) return { error: "Acceleration must be non-zero to solve for mass." };
    forceN = toCanonicalForce(input.force);
    accelMps2 = toCanonicalAccel(input.acceleration);
    massKg = forceN / accelMps2;
  } else {
    if (!input.force || !input.mass) return { error: "Solving for acceleration requires force and mass." };
    if (input.mass.value <= 0) return { error: "Mass must be greater than 0." };
    forceN = toCanonicalForce(input.force);
    massKg = toCanonicalMass(input.mass);
    accelMps2 = forceN / massKg;
  }

  if (!Number.isFinite(forceN) || !Number.isFinite(massKg) || !Number.isFinite(accelMps2)) {
    return { error: "Computed value is not finite — check inputs for extremes." };
  }

  // Build display + table for the solved variable.
  let result: { value: number; unit: string; label: string };
  let table: { unit: string; label: string; value: number }[] = [];
  if (input.solveFor === "force") {
    result = { value: round(forceN), unit: "N", label: FORCE_LABELS.N };
    table = (Object.keys(FORCE_TO_N) as ForceUnit[]).map((u) => ({
      unit: u,
      label: FORCE_LABELS[u],
      value: round(forceN / FORCE_TO_N[u]),
    }));
  } else if (input.solveFor === "mass") {
    result = { value: round(massKg), unit: "kg", label: MASS_LABELS.kg };
    table = (Object.keys(MASS_TO_KG) as MassUnit[]).map((u) => ({
      unit: u,
      label: MASS_LABELS[u],
      value: round(massKg / MASS_TO_KG[u]),
    }));
  } else {
    result = { value: round(accelMps2), unit: "m/s²", label: ACCEL_LABELS.mps2 };
    table = (Object.keys(ACCEL_TO_MPS2) as AccelUnit[]).map((u) => ({
      unit: u,
      label: ACCEL_LABELS[u],
      value: round(accelMps2 / ACCEL_TO_MPS2[u]),
    }));
  }

  if (Math.abs(accelMps2) > 100) warnings.push("Acceleration exceeds 10 g — extreme conditions; verify units.");
  if (massKg > 1e6) warnings.push("Very large mass — verify the source unit.");
  if (forceN > 1e9) warnings.push("Very large force — verify the source unit.");

  return {
    solveFor: input.solveFor,
    canonical: { forceN: round(forceN), massKg: round(massKg), accelMps2: round(accelMps2) },
    result,
    table,
    newtonsLawsRef: NEWTONS_LAWS,
    warnings,
  };
}

/** Format the result as plain text. */
export function resultToText(r: AccelForceResult): string {
  const lines: string[] = [];
  lines.push(`Solved for: ${r.solveFor}`);
  lines.push(`Result: ${r.result.value} ${r.result.unit}`);
  lines.push("");
  lines.push("Canonical SI:");
  lines.push(`  Force: ${r.canonical.forceN} N`);
  lines.push(`  Mass: ${r.canonical.massKg} kg`);
  lines.push(`  Acceleration: ${r.canonical.accelMps2} m/s²`);
  lines.push("");
  lines.push("All units:");
  for (const t of r.table) lines.push(`  ${t.label}: ${t.value} ${t.unit}`);
  lines.push("");
  lines.push("Newton's Laws of Motion:");
  for (const law of r.newtonsLawsRef) lines.push(`  ${law.name}: ${law.statement}`);
  return lines.join("\n");
}

/** Convert the all-units table to CSV. */
export function tableToCsv(r: AccelForceResult): string {
  const lines = ["Unit,Label,Value"];
  for (const t of r.table) lines.push(`${t.unit},"${t.label}",${t.value}`);
  return lines.join("\n");
}
