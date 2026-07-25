/**
 * Image Anaglyph Maker — pure logic. No DOM/canvas access.
 * Creates red-cyan 3D from a left and right image by channel separation.
 */

export interface AnaglyphPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AnaglyphOptions {
  /** Output color mode. */
  mode?: "red-cyan" | "red-blue" | "green-magenta" | "amber-blue";
}

/** Compute a single anaglyph output pixel from left and right pixels. */
export function combinePixels(
  left: AnaglyphPixel,
  right: AnaglyphPixel,
  options: AnaglyphOptions = {},
): AnaglyphPixel {
  const mode = options.mode ?? "red-cyan";
  switch (mode) {
    case "red-cyan":
      return { r: left.r, g: right.g, b: right.b, a: Math.max(left.a, right.a) };
    case "red-blue":
      return { r: left.r, g: 0, b: right.b, a: Math.max(left.a, right.a) };
    case "green-magenta":
      return { r: right.r, g: left.g, b: right.b, a: Math.max(left.a, right.a) };
    case "amber-blue":
      return {
        r: Math.round((left.r + left.g) / 2),
        g: 0,
        b: right.b,
        a: Math.max(left.a, right.a),
      };
    default:
      return { r: left.r, g: right.g, b: right.b, a: Math.max(left.a, right.a) };
  }
}

/** Validate that left and right images share the same dimensions. */
export function validateDimensions(
  leftW: number,
  leftH: number,
  rightW: number,
  rightH: number,
): { width: number; height: number } | { error: string } {
  if (leftW <= 0 || leftH <= 0 || rightW <= 0 || rightH <= 0) {
    return { error: "Image dimensions must be positive" };
  }
  if (leftW !== rightW || leftH !== rightH) {
    return {
      error: `Left (${leftW}×${leftH}) and right (${rightW}×${rightH}) images must share dimensions`,
    };
  }
  return { width: leftW, height: leftH };
}

export const ANAGLYPH_MODES: { value: AnaglyphOptions["mode"]; label: string }[] = [
  { value: "red-cyan", label: "Red/Cyan" },
  { value: "red-blue", label: "Red/Blue" },
  { value: "green-magenta", label: "Green/Magenta" },
  { value: "amber-blue", label: "Amber/Blue" },
];
