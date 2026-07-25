/**
 * Image Screen Tone — pure logic for dot grid pattern generation. No DOM/canvas.
 */
export interface ScreenToneOptions {
  /** Spacing between dot centers (pixels). */
  spacing: number;
  /** Base dot radius (pixels). */
  radius: number;
  /** Density threshold 0-255: darker source → denser dots. */
  threshold: number;
  /** Dot grid rotation in degrees. */
  angle: number;
}

/** Rotate a point about origin by angle (degrees). */
export function rotatePoint(x: number, y: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Generate the list of dot centers covering a width×height area. */
export function generateGrid(width: number, height: number, opts: ScreenToneOptions): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const cols = Math.ceil(width / opts.spacing) + 2;
  const rows = Math.ceil(height / opts.spacing) + 2;
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const lx = c * opts.spacing + opts.spacing / 2;
      const ly = r * opts.spacing + opts.spacing / 2;
      const p = rotatePoint(lx, ly, opts.angle);
      // Inverse rotate to ensure coverage
      const ir = rotatePoint(p.x, p.y, -opts.angle);
      out.push(ir);
    }
  }
  return out;
}

/** Decide if a dot should be drawn given source brightness. */
export function shouldDrawDot(brightness: number, opts: ScreenToneOptions): boolean {
  return brightness <= opts.threshold;
}

/** Compute dot radius scaled by brightness (darker = larger). */
export function scaledDotRadius(brightness: number, opts: ScreenToneOptions): number {
  const t = 1 - clamp(brightness, 0, 255) / 255;
  return opts.radius * (0.3 + 0.7 * t);
}

export function validateScreenToneOptions(opts: ScreenToneOptions): { ok: true } | { error: string } {
  if (opts.spacing < 2 || opts.spacing > 64) return { error: "Spacing must be 2-64" };
  if (opts.radius < 0.5 || opts.radius > opts.spacing / 2) return { error: "Radius must be 0.5-spacing/2" };
  if (opts.threshold < 0 || opts.threshold > 255) return { error: "Threshold must be 0-255" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
