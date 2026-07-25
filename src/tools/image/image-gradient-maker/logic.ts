/**
 * Image Gradient Maker — pure color math. No DOM/canvas access.
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type GradientType = "linear" | "radial";
export type GradientDirection =
  | "horizontal"
  | "vertical"
  | "diagonal"
  | "diagonal-rev"
  | "radial";

export interface GradientStop {
  /** 0-1 position. */
  offset: number;
  color: RgbColor;
}

export interface GradientOptions {
  type: GradientType;
  direction: GradientDirection;
  stops: GradientStop[];
  width: number;
  height: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Parse #rgb / #rrggbb hex strings. Returns null on invalid. */
export function parseHex(hex: string): RgbColor | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Convert a color to a CSS hex string. */
export function toHex(c: RgbColor): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** Linear interpolation between two colors. t in [0,1]. */
export function lerpColor(a: RgbColor, b: RgbColor, t: number): RgbColor {
  const tt = clamp(t, 0, 1);
  return {
    r: a.r + (b.r - a.r) * tt,
    g: a.g + (b.g - a.g) * tt,
    b: a.b + (b.b - a.b) * tt,
  };
}

/** Sample a multi-stop gradient at position t (0-1). */
export function sampleGradient(stops: GradientStop[], t: number): RgbColor {
  if (stops.length === 0) return { r: 0, g: 0, b: 0 };
  if (stops.length === 1) return stops[0]!.color;
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const tt = clamp(t, 0, 1);
  if (tt <= sorted[0]!.offset) return sorted[0]!.color;
  if (tt >= sorted[sorted.length - 1]!.offset) return sorted[sorted.length - 1]!.color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (tt >= a.offset && tt <= b.offset) {
      const range = b.offset - a.offset;
      const localT = range === 0 ? 0 : (tt - a.offset) / range;
      return lerpColor(a.color, b.color, localT);
    }
  }
  return sorted[sorted.length - 1]!.color;
}

/** Compute the gradient position t for a given pixel based on direction. */
export function gradientT(
  x: number,
  y: number,
  width: number,
  height: number,
  direction: GradientDirection,
): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  switch (direction) {
    case "horizontal":
      return x / (w - 1);
    case "vertical":
      return y / (h - 1);
    case "diagonal":
      return (x / (w - 1) + y / (h - 1)) / 2;
    case "diagonal-rev":
      return (x / (w - 1) + (h - 1 - y) / (h - 1)) / 2;
    case "radial": {
      const cx = w / 2;
      const cy = h / 2;
      const dx = (x - cx) / (w / 2);
      const dy = (y - cy) / (h / 2);
      return Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
    }
    default:
      return 0;
  }
}

export function validateGradientOptions(opts: GradientOptions): { ok: true } | { error: string } {
  if (opts.width < 1 || opts.width > 4096) return { error: "Width must be 1-4096" };
  if (opts.height < 1 || opts.height > 4096) return { error: "Height must be 1-4096" };
  if (opts.stops.length < 2) return { error: "At least 2 gradient stops required" };
  for (const s of opts.stops) {
    if (s.offset < 0 || s.offset > 1) return { error: "Stop offset must be 0-1" };
  }
  return { ok: true };
}
