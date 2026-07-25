/**
 * Speed-Distance-Time Calculator — solve for any one missing variable.
 * s = d / t
 */
export type SolveFor = "speed" | "distance" | "time";

export interface SdtInput {
  solveFor: SolveFor;
  speed?: number;  // units/hr
  distance?: number; // units
  time?: number;   // hours
}

export interface SdtResult {
  speed: number;
  distance: number;
  time: number;
  formula: string;
}

export function solveSdt(input: SdtInput): SdtResult | { error: string } {
  const { solveFor, speed, distance, time } = input;
  if (solveFor === "speed") {
    if (distance == null || time == null) return { error: "Need distance and time" };
    if (time === 0) return { error: "Time cannot be 0" };
    return { speed: distance / time, distance, time, formula: "speed = distance / time" };
  }
  if (solveFor === "distance") {
    if (speed == null || time == null) return { error: "Need speed and time" };
    return { speed, distance: speed * time, time, formula: "distance = speed × time" };
  }
  if (solveFor === "time") {
    if (speed == null || distance == null) return { error: "Need speed and distance" };
    if (speed === 0) return { error: "Speed cannot be 0" };
    return { speed, distance, time: distance / speed, formula: "time = distance / speed" };
  }
  return { error: "Unknown solve target" };
}

export function validateSdtInput(input: SdtInput): { ok: true } | { error: string } {
  const vals = [input.speed, input.distance, input.time].filter((v) => v != null) as number[];
  if (!vals.every((v) => Number.isFinite(v) && v >= 0)) {
    return { error: "All values must be non-negative numbers" };
  }
  return { ok: true };
}

/** Convert m/s to km/h. */
export function msToKmh(ms: number): number { return ms * 3.6; }
/** Convert km/h to m/s. */
export function kmhToMs(kmh: number): number { return kmh / 3.6; }
/** Convert km/h to mph. */
export function kmhToMph(kmh: number): number { return kmh * 0.621371; }
