/**
 * Image Crosshatch — pure logic. No DOM/canvas.
 * Determines hatch line direction from brightness gradient.
 */
export interface CrosshatchOptions {
  /** Spacing between hatch lines (pixels). */
  spacing: number;
  /** Brightness threshold for first hatch layer (0-255). */
  threshold1: number;
  /** Brightness threshold for second hatch layer (0-255). */
  threshold2: number;
  /** Brightness threshold for third hatch layer (0-255). */
  threshold3: number;
}

export interface LineSegment { x1: number; y1: number; x2: number; y2: number; }

/** Compute brightness gradient direction (radians) at a point. */
export function gradientDirection(
  data: Uint8ClampedArray, x: number, y: number, w: number, h: number,
): number {
  const at = (px: number, py: number): number => {
    const xx = Math.max(0, Math.min(w - 1, px));
    const yy = Math.max(0, Math.min(h - 1, py));
    const i = (yy * w + xx) * 4;
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  };
  const gx = at(x + 1, y) - at(x - 1, y);
  const gy = at(x, y + 1) - at(x, y - 1);
  // Return angle measured from the y-axis so that a horizontal gradient
  // (gy=0, gx≠0) yields a non-zero angle.
  return Math.atan2(gx, gy);
}

/** Compute hatch line direction perpendicular to the brightness gradient. */
export function hatchDirection(data: Uint8ClampedArray, x: number, y: number, w: number, h: number): number {
  const g = gradientDirection(data, x, y, w, h);
  return g + Math.PI / 2;
}

/** Decide which hatch layers apply given a brightness value. */
export function hatchLayers(brightness: number, opts: CrosshatchOptions): number[] {
  const layers: number[] = [];
  if (brightness < opts.threshold1) layers.push(0);
  if (brightness < opts.threshold2) layers.push(1);
  if (brightness < opts.threshold3) layers.push(2);
  return layers;
}

/** Default angle (radians) for hatch layer index. */
export function layerAngle(layer: number): number {
  return [0, Math.PI / 4, Math.PI / 2][layer] ?? 0;
}

/** Generate hatch line segments for a width×height area. */
export function generateHatchLines(w: number, h: number, opts: CrosshatchOptions): LineSegment[] {
  const lines: LineSegment[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const angle = layerAngle(layer);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const diagonal = Math.ceil(Math.sqrt(w * w + h * h));
    for (let offset = -diagonal; offset < diagonal; offset += opts.spacing) {
      const cx = offset * cos;
      const cy = offset * sin;
      // Line direction perpendicular to (cos, sin) → (-sin, cos)
      const dx = -sin;
      const dy = cos;
      // Extend to image edges.
      const len = diagonal;
      lines.push({
        x1: cx - dx * len, y1: cy - dy * len,
        x2: cx + dx * len, y2: cy + dy * len,
      });
    }
  }
  return lines;
}

export function validateCrosshatchOptions(opts: CrosshatchOptions): { ok: true } | { error: string } {
  if (opts.spacing < 1 || opts.spacing > 64) return { error: "Spacing must be 1-64" };
  if (opts.threshold1 < 0 || opts.threshold1 > 255) return { error: "Threshold1 must be 0-255" };
  if (opts.threshold2 < 0 || opts.threshold2 > 255) return { error: "Threshold2 must be 0-255" };
  if (opts.threshold3 < 0 || opts.threshold3 > 255) return { error: "Threshold3 must be 0-255" };
  if (opts.threshold2 > opts.threshold1 || opts.threshold3 > opts.threshold2) {
    return { error: "Thresholds must be t1 >= t2 >= t3" };
  }
  return { ok: true };
}
