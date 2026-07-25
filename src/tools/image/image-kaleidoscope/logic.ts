/**
 * Image Kaleidoscope — pure logic. No DOM/canvas access.
 * Computes segment angles, polar mirror mappings, and blend helpers.
 *
 * Extras:
 *  1. N segments (2-16)
 *  2. Rotation offset (degrees)
 *  3. Mirror on/off toggle
 *  4. Blend mode (overwrite / average / additive)
 *  5. Batch validation
 *  6. Presets (2/4/6/8/12/16)
 *  7. Identity check
 *  8. Polar ↔ cartesian helpers
 *  9. Format-preserving transparency
 * 10. Center offset
 * 11. Stats (transformed pixel count)
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type BlendMode = "overwrite" | "average" | "additive";

export interface KaleidoscopeOptions {
  segments: number;
  rotation: number;
  mirror: boolean;
  blend: BlendMode;
  /** Center offset relative to image center, -0.5..0.5 of size. */
  offsetX: number;
  offsetY: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Angle of a single wedge in radians. */
export function segmentAngle(segments: number): number {
  return (2 * Math.PI) / Math.max(2, segments);
}

/** Convert cartesian (x, y) relative to center to polar (r, theta). */
export function toPolar(x: number, y: number, cx: number, cy: number): { r: number; theta: number } {
  const dx = x - cx, dy = y - cy;
  return { r: Math.sqrt(dx * dx + dy * dy), theta: Math.atan2(dy, dx) };
}

/** Convert polar back to cartesian relative to center. */
export function toCartesian(r: number, theta: number, cx: number, cy: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

/**
 * Mirror a polar angle into the first wedge of a kaleidoscope.
 * Returns the equivalent theta in the canonical segment [0, angle).
 */
export function mirrorToWedge(theta: number, segments: number, rotation = 0): { theta: number; r: number } {
  const angle = segmentAngle(segments);
  let t = theta - rotation;
  t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const wedge = Math.floor(t / angle);
  const local = t - wedge * angle;
  const mirrored = wedge % 2 === 0 ? local : angle - local;
  return { theta: mirrored, r: 1 };
}

/** Map a destination angle to source angle: with mirror, uses wedge reflection; without, just repeats the wedge. */
export function mapAngle(theta: number, segments: number, rotation: number, mirror: boolean): number {
  if (mirror) return mirrorToWedge(theta, segments, rotation).theta;
  const angle = segmentAngle(segments);
  let t = theta - rotation;
  t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return t % angle;
}

/** Blend two RGB triplets according to mode. */
export function blendPixels(a: [number, number, number], b: [number, number, number], mode: BlendMode): [number, number, number] {
  switch (mode) {
    case "average":
      return [clampByte((a[0] + b[0]) / 2), clampByte((a[1] + b[1]) / 2), clampByte((a[2] + b[2]) / 2)];
    case "additive":
      return [clampByte(a[0] + b[0]), clampByte(a[1] + b[1]), clampByte(a[2] + b[2])];
    case "overwrite":
    default:
      return b;
  }
}

/** Validate segment count. */
export function validateSegments(segments: number): number | { error: string } {
  if (typeof segments !== "number" || Number.isNaN(segments)) return { error: "Segments must be a number" };
  if (!Number.isInteger(segments) || segments < 2 || segments > 16) return { error: "Segments must be an integer between 2 and 16" };
  return segments;
}

/** Validate full options. */
export function validateKaleidoscope(opts: KaleidoscopeOptions): KaleidoscopeOptions | { error: string } {
  const s = validateSegments(opts.segments);
  if (typeof s === "object" && "error" in s) return s;
  if (!Number.isFinite(opts.rotation)) return { error: "Rotation must be a number" };
  if (!["overwrite", "average", "additive"].includes(opts.blend)) return { error: "Invalid blend mode" };
  if (opts.offsetX < -0.5 || opts.offsetX > 0.5) return { error: "offsetX must be -0.5..0.5" };
  if (opts.offsetY < -0.5 || opts.offsetY > 0.5) return { error: "offsetY must be -0.5..0.5" };
  return { ...opts };
}

/** True when options produce a no-op (1 segment-like; impossible here). */
export function isIdentity(opts: KaleidoscopeOptions): boolean {
  return false;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: KaleidoscopeOptions): { name: string; result: KaleidoscopeOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateKaleidoscope(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Compute center coords given image size and offset. */
export function computeCenter(size: number, offsetX: number, offsetY: number): { cx: number; cy: number } {
  return { cx: size / 2 + offsetX * size, cy: size / 2 + offsetY * size };
}

/** Convert rotation degrees → radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export const KALEIDOSCOPE_PRESETS = [2, 4, 6, 8, 12, 16];

/** Labeled presets. */
export const PRESETS: { id: string; label: string; options: Omit<KaleidoscopeOptions, "offsetX" | "offsetY"> }[] = [
  { id: "p2", label: "2-fold", options: { segments: 2, rotation: 0, mirror: true, blend: "overwrite" } },
  { id: "p4", label: "4-fold", options: { segments: 4, rotation: 0, mirror: true, blend: "overwrite" } },
  { id: "p6", label: "6-fold (snowflake)", options: { segments: 6, rotation: 0, mirror: true, blend: "overwrite" } },
  { id: "p8", label: "8-fold", options: { segments: 8, rotation: 0, mirror: true, blend: "overwrite" } },
  { id: "p12", label: "12-fold", options: { segments: 12, rotation: 0, mirror: true, blend: "overwrite" } },
  { id: "p16", label: "16-fold", options: { segments: 16, rotation: 0, mirror: true, blend: "overwrite" } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}

/** Normalize an angle to [0, 2π). */
export function normalizeAngle(theta: number): number {
  return ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/** Compute the radial mask weight: 1 inside innerR, 0 outside outerR, linear between. */
export function radialMask(r: number, innerR: number, outerR: number): number {
  if (r <= innerR) return 1;
  if (r >= outerR) return 0;
  return 1 - (r - innerR) / (outerR - innerR);
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Stats: ratio of transformed pixels (non-transparent output). */
export function transformedRatio(data: Uint8ClampedArray): number {
  let n = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! > 0) n++;
    total++;
  }
  return total === 0 ? 0 : n / total;
}

/** Mean absolute delta between two RGBA pixel arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}
