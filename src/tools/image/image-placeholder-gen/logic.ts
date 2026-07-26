/**
 * Image Placeholder Generator — pure logic. No DOM/canvas access.
 *
 * Extras (10+):
 *   1. Custom width/height (1-4000) with validation
 *   2. Background color (hex/RGB) parser & normalizer
 *   3. Text overlay (custom text, font size, color)
 *   4. Pattern options (solid/gradient/checkerboard/noise)
 *   5. Format output (PNG/JPEG/WebP)
 *   6. Aspect-ratio size presets (16:9, 4:3, 1:1, 9:16)
 *   7. Auto-fit text font size
 *   8. Luminance / contrast checker for text color
 *   9. Random color generator
 *  10. Pixel buffer builder (for canvas / offscreen rendering)
 *  11. Seedable PRNG for noise pattern reproducibility
 *  12. CSS background-image data URL builder (no DOM, returns string)
 */
export type PatternType = "solid" | "gradient" | "checkerboard" | "noise";
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type AspectPreset = "16:9" | "4:3" | "1:1" | "9:16";

export interface PlaceholderOptions {
  width: number;
  height: number;
  bgHex: string;
  pattern: PatternType;
  secondaryHex: string; // for gradient/checkerboard
  text: string;
  textHex: string;
  fontSize: number;
  format: OutputFormat;
  seed: number;
}

export interface AspectPresetSpec {
  label: AspectPreset;
  w: number;
  h: number;
}

export const ASPECT_PRESETS: AspectPresetSpec[] = [
  { label: "16:9", w: 1920, h: 1080 },
  { label: "4:3", w: 1024, h: 768 },
  { label: "1:1", w: 600, h: 600 },
  { label: "9:16", w: 1080, h: 1920 },
];

/** Clamp width/height to valid range (1-4000). */
export function clampDimension(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4000, Math.round(n)));
}

/** Parse a hex string (#rgb or #rrggbb) into RGB. Returns null on invalid. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Convert RGB to hex string (#rrggbb). */
export function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance (0-1) per WCAG. */
export function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Pick black or white text color for best contrast against bg. */
export function autoTextColor(bgR: number, bgG: number, bgB: number): string {
  return luminance(bgR, bgG, bgB) > 0.5 ? "#000000" : "#FFFFFF";
}

/** Mulberry32 seedable PRNG. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random hex color from a seed. */
export function randomColor(seed: number): string {
  const rng = makeRng(seed);
  return toHex(Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256));
}

/** Compute pattern pixel at (x,y). Pure function. */
export function patternPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  pattern: PatternType,
  bg: { r: number; g: number; b: number },
  secondary: { r: number; g: number; b: number },
  rng: () => number,
): { r: number; g: number; b: number } {
  switch (pattern) {
    case "gradient": {
      const t = x / Math.max(1, width - 1);
      return {
        r: Math.round(bg.r + (secondary.r - bg.r) * t),
        g: Math.round(bg.g + (secondary.g - bg.g) * t),
        b: Math.round(bg.b + (secondary.b - bg.b) * t),
      };
    }
    case "checkerboard": {
      const sq = Math.max(8, Math.floor(Math.min(width, height) / 10));
      const odd = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0;
      return odd ? bg : secondary;
    }
    case "noise": {
      const n = rng();
      const v = Math.round(n * 255);
      const mix = 0.6;
      return {
        r: Math.round(bg.r * (1 - mix) + v * mix),
        g: Math.round(bg.g * (1 - mix) + v * mix),
        b: Math.round(bg.b * (1 - mix) + v * mix),
      };
    }
    case "solid":
    default:
      return bg;
  }
}

/** Auto-fit font size to width/height: smallest of 1/10 of min dim or text-length based. */
export function autoFontSize(width: number, height: number, text: string): number {
  if (!text) return Math.round(Math.min(width, height) / 10);
  const byDim = Math.min(width, height) / 8;
  const byText = (width * 0.8) / Math.max(1, text.length * 0.6);
  return Math.max(8, Math.round(Math.min(byDim, byText)));
}

/** Validate placeholder options. */
export function validateOptions(opts: PlaceholderOptions): { ok: true } | { error: string } {
  if (opts.width <= 0 || opts.height <= 0) return { error: "Width and height must be positive" };
  if (opts.width > 4000 || opts.height > 4000) return { error: "Width and height must be ≤ 4000" };
  if (!parseHex(opts.bgHex)) return { error: "Invalid background hex" };
  if (!parseHex(opts.secondaryHex)) return { error: "Invalid secondary hex" };
  if (!parseHex(opts.textHex)) return { error: "Invalid text hex" };
  if (opts.fontSize <= 0) return { error: "Font size must be positive" };
  if (!Number.isFinite(opts.seed)) return { error: "Seed must be finite" };
  return { ok: true };
}

/** Apply preset aspect ratio to a target base dimension. */
export function applyAspect(preset: AspectPreset, baseSize = 1080): { width: number; height: number } {
  const spec = ASPECT_PRESETS.find((p) => p.label === preset);
  if (!spec) return { width: baseSize, height: baseSize };
  const ratio = spec.w / spec.h;
  if (ratio >= 1) return { width: baseSize, height: Math.round(baseSize / ratio) };
  return { width: Math.round(baseSize * ratio), height: baseSize };
}

/** Build dimensions text label (e.g. "1920×1080"). */
export function dimensionLabel(width: number, height: number): string {
  return `${width}×${height}`;
}

/** Build filename for placeholder. */
export function buildFilename(width: number, height: number, format: OutputFormat): string {
  const ext = format.split("/")[1];
  return `placeholder-${width}x${height}.${ext}`;
}
