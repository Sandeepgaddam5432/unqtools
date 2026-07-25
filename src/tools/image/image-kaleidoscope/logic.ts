/**
 * Image Kaleidoscope — pure logic. No DOM/canvas access.
 * Computes segment angles and polar mirror mappings.
 */

export interface KaleidoscopeOptions {
  /** Number of segments (2-16). */
  segments: number;
  /** Rotation angle in radians. */
  rotation?: number;
}

/** Angle of a single wedge in radians. */
export function segmentAngle(segments: number): number {
  return (2 * Math.PI) / Math.max(2, segments);
}

/** Convert cartesian (x, y) relative to center to polar (r, theta). */
export function toPolar(
  x: number,
  y: number,
  cx: number,
  cy: number,
): { r: number; theta: number } {
  const dx = x - cx;
  const dy = y - cy;
  return { r: Math.sqrt(dx * dx + dy * dy), theta: Math.atan2(dy, dx) };
}

/** Convert polar back to cartesian relative to center. */
export function toCartesian(
  r: number,
  theta: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

/**
 * Mirror a polar angle into the first wedge of a kaleidoscope.
 * Returns the equivalent (theta, r) in the canonical segment [0, angle).
 */
export function mirrorToWedge(
  theta: number,
  segments: number,
  rotation = 0,
): { theta: number; r: number } {
  const angle = segmentAngle(segments);
  let t = theta - rotation;
  // Normalize to [0, 2π).
  t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Find which wedge we're in (0..segments-1).
  const wedge = Math.floor(t / angle);
  const local = t - wedge * angle;
  // Even wedges keep the angle; odd wedges mirror it for reflection.
  const mirrored = wedge % 2 === 0 ? local : angle - local;
  return { theta: mirrored, r: 1 };
}

/** Validate segment count. */
export function validateSegments(segments: number): number | { error: string } {
  if (typeof segments !== "number" || Number.isNaN(segments)) {
    return { error: "Segments must be a number" };
  }
  if (!Number.isInteger(segments) || segments < 2 || segments > 16) {
    return { error: "Segments must be an integer between 2 and 16" };
  }
  return segments;
}

export const KALEIDOSCOPE_PRESETS = [2, 4, 6, 8, 12, 16];
