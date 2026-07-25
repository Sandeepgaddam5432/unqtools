/**
 * Image Flipper — pure logic. No DOM access.
 */
export type FlipType = "horizontal" | "vertical" | "both";

export interface FlipOptions {
  flip: FlipType;
}

export interface FlipTransform {
  /** X-axis scale factor to apply. */
  scaleX: number;
  /** Y-axis scale factor to apply. */
  scaleY: number;
  /** X-axis translation after scaling (in source pixels). */
  translateX: number;
  /** Y-axis translation after scaling (in source pixels). */
  translateY: number;
}

/** Compute the canvas transform parameters needed to flip an image. */
export function calculateFlip(width: number, height: number, flip: FlipType): FlipTransform | { error: string } {
  if (width <= 0 || height <= 0) return { error: "Width and height must be positive" };
  const scaleX = flip === "horizontal" || flip === "both" ? -1 : 1;
  const scaleY = flip === "vertical" || flip === "both" ? -1 : 1;
  const translateX = scaleX === -1 ? width : 0;
  const translateY = scaleY === -1 ? height : 0;
  return { scaleX, scaleY, translateX, translateY };
}

/** Normalize an arbitrary flip string to a FlipType. */
export function parseFlipType(value: string): FlipType | { error: string } {
  const v = value.trim().toLowerCase();
  if (v === "horizontal" || v === "h" || v === "x") return "horizontal";
  if (v === "vertical" || v === "v" || v === "y") return "vertical";
  if (v === "both" || v === "b" || v === "hv" || v === "vh") return "both";
  return { error: `Unknown flip type: ${value}` };
}
