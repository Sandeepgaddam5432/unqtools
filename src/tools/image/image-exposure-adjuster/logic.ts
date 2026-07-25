/**
 * Image Exposure Adjuster — pure math. Exposure factor = 2^stops.
 */
export interface ExposureOptions {
  /** -2..+2 — exposure stops. */
  stops: number;
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Convert stops to a multiplicative exposure factor. */
export function stopsToFactor(stops: number): number {
  return Math.pow(2, stops);
}

/** Apply exposure to a single channel value. */
export function applyExposureChannel(value: number, stops: number): number {
  return clampByte(value * stopsToFactor(stops));
}

/** Apply exposure to an RGB pixel. */
export function applyExposure(rgb: { r: number; g: number; b: number }, stops: number): { r: number; g: number; b: number } {
  const f = stopsToFactor(stops);
  return {
    r: clampByte(rgb.r * f),
    g: clampByte(rgb.g * f),
    b: clampByte(rgb.b * f),
  };
}

export function validateExposureOptions(o: ExposureOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(o.stops) || o.stops < -5 || o.stops > 5) {
    return { error: "Stops must be between -5 and +5" };
  }
  return { ok: true };
}

/** Convert stops to EV (exposure value) string for display. */
export function formatStops(stops: number): string {
  const sign = stops > 0 ? "+" : "";
  return `${sign}${stops.toFixed(2)} EV`;
}
