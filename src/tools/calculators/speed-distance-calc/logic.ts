/**
 * Speed-Distance-Time Calculator — solve for any one missing variable.
 * s = d / t
 *
 * Supports metric/imperial unit conversion, acceleration, and a
 * formula display. All functions are pure (no DOM access).
 */

export type SolveFor = "speed" | "distance" | "time";

export type SpeedUnit = "ms" | "kmh" | "mph" | "fts" | "knot";
export type DistanceUnit = "m" | "km" | "mi" | "ft" | "yd" | "nmi";
export type TimeUnit = "s" | "min" | "h" | "day";

export interface SdtInput {
  solveFor: SolveFor;
  speed?: number;
  distance?: number;
  time?: number;
  speedUnit?: SpeedUnit;
  distanceUnit?: DistanceUnit;
  timeUnit?: TimeUnit;
}

export interface SdtResult {
  speed: number;
  distance: number;
  time: number;
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  timeUnit: TimeUnit;
  formula: string;
  explanation: string;
}

export interface SdtStats {
  durationMs: number;
  solveFor: SolveFor;
  precision: number;
}

export interface AccelerationInput {
  initialSpeed: number;
  finalSpeed: number;
  time: number;
  speedUnit?: SpeedUnit;
  timeUnit?: TimeUnit;
}

export interface AccelerationResult {
  acceleration: number; // m/s²
  accelerationKmhPerS: number;
  accelerationMphPerS: number;
  formula: string;
}

export interface HistoryEntry {
  ts: number;
  solveFor: SolveFor;
  speed: number;
  distance: number;
  time: number;
  formula: string;
}

/** Conversion factors to base units (m/s, m, s). */
export const SPEED_TO_MS: Record<SpeedUnit, number> = {
  ms: 1,
  kmh: 1 / 3.6,
  mph: 0.44704,
  fts: 0.3048,
  knot: 0.514444,
};

export const DISTANCE_TO_M: Record<DistanceUnit, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  ft: 0.3048,
  yd: 0.9144,
  nmi: 1852,
};

export const TIME_TO_S: Record<TimeUnit, number> = {
  s: 1,
  min: 60,
  h: 3600,
  day: 86400,
};

const round = (n: number, p = 6) => {
  const f = Math.pow(10, Math.max(0, Math.min(10, p)));
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Solve the speed-distance-time triangle for the missing variable. */
export function solveSdt(input: SdtInput): SdtResult | { error: string } {
  const { solveFor } = input;
  const speedUnit = input.speedUnit ?? "ms";
  const distanceUnit = input.distanceUnit ?? "m";
  const timeUnit = input.timeUnit ?? "s";

  if (solveFor === "speed") {
    if (input.distance == null || input.time == null) return { error: "Need distance and time to solve for speed" };
    if (input.time === 0) return { error: "Time cannot be 0" };
    if (input.distance < 0) return { error: "Distance cannot be negative" };
    if (input.time < 0) return { error: "Time cannot be negative" };
    const distM = input.distance * DISTANCE_TO_M[distanceUnit];
    const timeS = input.time * TIME_TO_S[timeUnit];
    const speedMs = distM / timeS;
    const speed = speedMs / SPEED_TO_MS[speedUnit];
    return {
      speed: round(speed),
      distance: round(input.distance),
      time: round(input.time),
      speedUnit,
      distanceUnit,
      timeUnit,
      formula: "speed = distance ÷ time",
      explanation: `${input.distance} ${distanceUnit} ÷ ${input.time} ${timeUnit} = ${round(speed)} ${speedUnit}`,
    };
  }
  if (solveFor === "distance") {
    if (input.speed == null || input.time == null) return { error: "Need speed and time to solve for distance" };
    if (input.speed < 0) return { error: "Speed cannot be negative" };
    if (input.time < 0) return { error: "Time cannot be negative" };
    const speedMs = input.speed * SPEED_TO_MS[speedUnit];
    const timeS = input.time * TIME_TO_S[timeUnit];
    const distM = speedMs * timeS;
    const distance = distM / DISTANCE_TO_M[distanceUnit];
    return {
      speed: round(input.speed),
      distance: round(distance),
      time: round(input.time),
      speedUnit,
      distanceUnit,
      timeUnit,
      formula: "distance = speed × time",
      explanation: `${input.speed} ${speedUnit} × ${input.time} ${timeUnit} = ${round(distance)} ${distanceUnit}`,
    };
  }
  if (solveFor === "time") {
    if (input.speed == null || input.distance == null) return { error: "Need speed and distance to solve for time" };
    if (input.speed === 0) return { error: "Speed cannot be 0" };
    if (input.speed < 0) return { error: "Speed cannot be negative" };
    if (input.distance < 0) return { error: "Distance cannot be negative" };
    const speedMs = input.speed * SPEED_TO_MS[speedUnit];
    const distM = input.distance * DISTANCE_TO_M[distanceUnit];
    const timeS = distM / speedMs;
    const time = timeS / TIME_TO_S[timeUnit];
    return {
      speed: round(input.speed),
      distance: round(input.distance),
      time: round(time),
      speedUnit,
      distanceUnit,
      timeUnit,
      formula: "time = distance ÷ speed",
      explanation: `${input.distance} ${distanceUnit} ÷ ${input.speed} ${speedUnit} = ${round(time)} ${timeUnit}`,
    };
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

/** Compute acceleration: (v_final - v_initial) / t. Returns m/s². */
export function computeAcceleration(input: AccelerationInput): AccelerationResult | { error: string } {
  const { initialSpeed, finalSpeed, time } = input;
  if (time === 0) return { error: "Time cannot be 0" };
  if (time < 0) return { error: "Time cannot be negative" };
  const speedUnit = input.speedUnit ?? "ms";
  const timeUnit = input.timeUnit ?? "s";
  const v0 = initialSpeed * SPEED_TO_MS[speedUnit];
  const v1 = finalSpeed * SPEED_TO_MS[speedUnit];
  const t = time * TIME_TO_S[timeUnit];
  const a = (v1 - v0) / t;
  return {
    acceleration: round(a),
    accelerationKmhPerS: round(a * 3.6),
    accelerationMphPerS: round(a * 2.236936),
    formula: "a = (v_final - v_initial) ÷ t",
  };
}

/** Convert m/s to km/h. */
export function msToKmh(ms: number): number { return ms * 3.6; }
/** Convert km/h to m/s. */
export function kmhToMs(kmh: number): number { return kmh / 3.6; }
/** Convert km/h to mph. */
export function kmhToMph(kmh: number): number { return kmh * 0.621371; }
/** Convert mph to km/h. */
export function mphToKmh(mph: number): number { return mph / 0.621371; }
/** Convert m/s to mph. */
export function msToMph(ms: number): number { return ms * 2.236936; }
/** Convert knots to km/h. */
export function knotToKmh(kn: number): number { return kn * 1.852; }

/** Format a value with unit. */
export function formatValue(value: number, unit: string, precision = 4): string {
  return `${round(value, precision)} ${unit}`;
}

/** Serialize history to CSV. */
export function historyToCsv(history: HistoryEntry[]): string {
  const lines = ["Timestamp,SolveFor,Speed,Distance,Time,Formula"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.solveFor},${h.speed},${h.distance},${h.time},"${h.formula}"`);
  }
  return lines.join("\n");
}

/** Compute statistics about a solve operation. */
export function computeStats(input: SdtInput): SdtStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const r = solveSdt(input);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    durationMs: Math.max(0, end - start),
    solveFor: input.solveFor,
    precision: 6,
  };
}

/** Batch: solve multiple inputs. */
export function solveSdtBatch(inputs: SdtInput[]): (SdtResult | { error: string })[] {
  return inputs.map((i) => solveSdt(i));
}

/** List of supported units for display. */
export const SPEED_UNITS: { value: SpeedUnit; label: string }[] = [
  { value: "ms", label: "m/s" },
  { value: "kmh", label: "km/h" },
  { value: "mph", label: "mph" },
  { value: "fts", label: "ft/s" },
  { value: "knot", label: "knots" },
];

export const DISTANCE_UNITS: { value: DistanceUnit; label: string }[] = [
  { value: "m", label: "meters" },
  { value: "km", label: "kilometers" },
  { value: "mi", label: "miles" },
  { value: "ft", label: "feet" },
  { value: "yd", label: "yards" },
  { value: "nmi", label: "nautical miles" },
];

export const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: "s", label: "seconds" },
  { value: "min", label: "minutes" },
  { value: "h", label: "hours" },
  { value: "day", label: "days" },
];
