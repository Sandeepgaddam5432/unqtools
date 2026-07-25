/**
 * Image Screen Tone — pure logic for dot grid pattern generation. No DOM/canvas.
 *
 * Generates manga-style screen tone dot patterns with configurable spacing,
 * radius, threshold, angle, pattern type (round/square/ellipse), and intensity.
 */

export type DotPattern = "round" | "square" | "ellipse";

export interface ScreenToneOptions {
  /** Spacing between dot centers (pixels). */
  spacing: number;
  /** Base dot radius (pixels). */
  radius: number;
  /** Density threshold 0-255: darker source → denser dots. */
  threshold: number;
  /** Dot grid rotation in degrees. */
  angle: number;
  /** Dot pattern shape. */
  pattern?: DotPattern;
  /** Intensity multiplier 0-1 (scales final dot size). */
  intensity?: number;
  /** For ellipse pattern: width-to-height ratio. */
  ellipseRatio?: number;
}

export interface ScreenToneStats {
  dotCount: number;
  drawnDots: number;
  skippedDots: number;
  averageRadius: number;
  maxRadius: number;
  minRadius: number;
  coverage: number;
  durationMs: number;
}

/** Clamp a number to [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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
  if (width <= 0 || height <= 0) return [];
  const out: { x: number; y: number }[] = [];
  // Expand the bounding box to cover the rotated grid.
  const diag = Math.sqrt(width * width + height * height);
  const cols = Math.ceil(diag / opts.spacing) + 6;
  const rows = Math.ceil(diag / opts.spacing) + 6;
  const cx = width / 2;
  const cy = height / 2;
  for (let r = -Math.floor(rows / 2); r <= Math.floor(rows / 2); r++) {
    for (let c = -Math.floor(cols / 2); c <= Math.floor(cols / 2); c++) {
      const lx = c * opts.spacing + opts.spacing / 2;
      const ly = r * opts.spacing + opts.spacing / 2;
      // Translate to center, rotate, translate back
      const dx = lx - cx;
      const dy = ly - cy;
      const p = rotatePoint(dx, dy, opts.angle);
      out.push({ x: p.x + cx, y: p.y + cy });
    }
  }
  return out;
}

/** Decide if a dot should be drawn given source brightness. */
export function shouldDrawDot(brightness: number, opts: ScreenToneOptions): boolean {
  const intensity = opts.intensity ?? 1;
  if (intensity <= 0) return false;
  return brightness <= opts.threshold;
}

/** Compute dot radius scaled by brightness (darker = larger). */
export function scaledDotRadius(brightness: number, opts: ScreenToneOptions): number {
  const t = 1 - clamp(brightness, 0, 255) / 255;
  const intensity = clamp(opts.intensity ?? 1, 0, 1);
  return opts.radius * (0.3 + 0.7 * t) * intensity;
}

/** Compute the area of a dot given the pattern type. */
export function dotArea(radius: number, opts: ScreenToneOptions): number {
  const pattern = opts.pattern ?? "round";
  if (pattern === "square") {
    return (radius * 2) * (radius * 2);
  }
  if (pattern === "ellipse") {
    const ratio = opts.ellipseRatio ?? 1.5;
    return Math.PI * radius * (radius * ratio);
  }
  return Math.PI * radius * radius;
}

/** Compute the SVG path 'd' for a single dot. */
export function dotPath(cx: number, cy: number, radius: number, opts: ScreenToneOptions): string {
  const pattern = opts.pattern ?? "round";
  if (pattern === "square") {
    const r = radius;
    return `M ${cx - r} ${cy - r} h ${r * 2} v ${r * 2} h ${-r * 2} z`;
  }
  if (pattern === "ellipse") {
    const ratio = opts.ellipseRatio ?? 1.5;
    const rx = radius;
    const ry = radius * ratio;
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 z`;
  }
  return `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 z`;
}

export function validateScreenToneOptions(opts: ScreenToneOptions): { ok: true } | { error: string } {
  if (opts.spacing < 2 || opts.spacing > 64) return { error: "Spacing must be 2-64" };
  if (opts.radius < 0.5 || opts.radius > opts.spacing / 2) return { error: "Radius must be 0.5-spacing/2" };
  if (opts.threshold < 0 || opts.threshold > 255) return { error: "Threshold must be 0-255" };
  if (opts.angle < -180 || opts.angle > 180) return { error: "Angle must be -180 to 180" };
  if (opts.intensity != null && (opts.intensity < 0 || opts.intensity > 1)) return { error: "Intensity must be 0-1" };
  if (opts.ellipseRatio != null && opts.ellipseRatio <= 0) return { error: "Ellipse ratio must be > 0" };
  return { ok: true };
}

/** Generate a small preview dot grid for visual reference. */
export function generatePreview(opts: ScreenToneOptions, size = 200): { x: number; y: number; radius: number }[] {
  const out: { x: number; y: number; radius: number }[] = [];
  const pts = generateGrid(size, size, opts);
  for (const p of pts) {
    if (p.x < 0 || p.y < 0 || p.x > size || p.y > size) continue;
    // Sample brightness based on distance from center (for preview).
    const dx = p.x - size / 2;
    const dy = p.y - size / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const brightness = clamp((dist / (size / 2)) * 255, 0, 255);
    if (!shouldDrawDot(brightness, opts)) continue;
    out.push({ x: p.x, y: p.y, radius: scaledDotRadius(brightness, opts) });
  }
  return out;
}

/** Compute statistics for a screen-tone render. */
export function computeStats(dots: { x: number; y: number; radius: number }[], drawn: { x: number; y: number; radius: number }[], opts: ScreenToneOptions, area: number): ScreenToneStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let totalArea = 0;
  let maxR = 0;
  let minR = Infinity;
  for (const d of drawn) {
    totalArea += dotArea(d.radius, opts);
    maxR = Math.max(maxR, d.radius);
    minR = Math.min(minR, d.radius);
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    dotCount: dots.length,
    drawnDots: drawn.length,
    skippedDots: Math.max(0, dots.length - drawn.length),
    averageRadius: drawn.length > 0 ? drawn.reduce((s, d) => s + d.radius, 0) / drawn.length : 0,
    maxRadius: maxR,
    minRadius: drawn.length > 0 ? minR : 0,
    coverage: area > 0 ? totalArea / area : 0,
    durationMs: Math.max(0, end - start),
  };
}

/** Compute the brightness of an RGB pixel using the standard luminance formula. */
export function brightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Generate a uniform-density dot grid (no source image; uses threshold). */
export function generateUniform(width: number, height: number, opts: ScreenToneOptions): { x: number; y: number; radius: number }[] {
  const pts = generateGrid(width, height, opts);
  const out: { x: number; y: number; radius: number }[] = [];
  for (const p of pts) {
    if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) continue;
    // Pretend the source pixel is mid-gray for uniform tone.
    const b = 128;
    if (!shouldDrawDot(b, opts)) continue;
    out.push({ x: p.x, y: p.y, radius: scaledDotRadius(b, opts) });
  }
  return out;
}

/** Convert dot list to SVG markup (for preview without canvas). */
export function toSvg(dots: { x: number; y: number; radius: number }[], width: number, height: number, opts: ScreenToneOptions): string {
  const paths = dots.map((d) => `<path d="${dotPath(d.x, d.y, d.radius, opts)}" fill="black"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/>${paths}</svg>`;
}

/** List supported pattern types for UI. */
export const PATTERNS: { value: DotPattern; label: string }[] = [
  { value: "round", label: "Round dots" },
  { value: "square", label: "Square dots" },
  { value: "ellipse", label: "Ellipse dots" },
];
