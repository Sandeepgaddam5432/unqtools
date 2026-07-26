/**
 * Color Mixer Blender — pure logic.
 * Implements RGB and HSL blend modes (normal, multiply, screen, overlay, etc.)
 * and palette generators (shades, tints, complementary, analogous, triadic).
 */

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "addition"
  | "subtract";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function parseHex(hex: string): RGB | null {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

export function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r1: h = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
      case g1: h = (b1 - r1) / d + 2; break;
      case b1: h = (r1 - g1) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hue = ((h % 360) + 360) % 360 / 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lit = Math.max(0, Math.min(100, l)) / 100;
  if (sat === 0) {
    const v = Math.round(lit * 255);
    return { r: v, g: v, b: v };
  }
  const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat;
  const p = 2 * lit - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(hue + 1 / 3) * 255),
    g: Math.round(hue2rgb(hue) * 255),
    b: Math.round(hue2rgb(hue - 1 / 3) * 255),
  };
}

const clamp = (n: number, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, n));

/** Per-channel blend for one component (0..255). */
function blendChannel(a: number, b: number, mode: BlendMode): number {
  const a1 = a / 255;
  const b1 = b / 255;
  switch (mode) {
    case "normal": return b;
    case "multiply": return Math.round(a1 * b1 * 255);
    case "screen": return Math.round((1 - (1 - a1) * (1 - b1)) * 255);
    case "overlay":
      return a1 < 0.5 ? Math.round(2 * a1 * b1 * 255) : Math.round((1 - 2 * (1 - a1) * (1 - b1)) * 255);
    case "darken": return Math.min(a, b);
    case "lighten": return Math.max(a, b);
    case "color-dodge":
      return b === 0 ? 0 : b === 255 ? 255 : clamp(Math.round(((a1) / (1 - b1)) * 255));
    case "color-burn":
      return b === 0 ? 0 : b === 255 ? 255 : clamp(Math.round((1 - (1 - a1) / b1) * 255));
    case "hard-light":
      return b1 < 0.5 ? Math.round(2 * a1 * b1 * 255) : Math.round((1 - 2 * (1 - a1) * (1 - b1)) * 255);
    case "soft-light":
      return clamp(Math.round((1 - 2 * b1) * a1 * a1 + 2 * b1 * a1) * 255 / 255 * 255);
    case "difference": return Math.abs(a - b);
    case "exclusion": return clamp(Math.round((a1 + b1 - 2 * a1 * b1) * 255));
    case "addition": return clamp(a + b);
    case "subtract": return clamp(a - b);
  }
}

/** Blend two colors with the given mode. */
export function blend(a: RGB, b: RGB, mode: BlendMode): RGB {
  if (mode === "normal") return { ...b };
  return {
    r: blendChannel(a.r, b.r, mode),
    g: blendChannel(a.g, b.g, mode),
    b: blendChannel(a.b, b.b, mode),
  };
}

/** Blend with alpha (opacity 0..1) for normal mode. */
export function blendWithAlpha(a: RGB, b: RGB, alpha: number): RGB {
  const a1 = Math.max(0, Math.min(1, alpha));
  return {
    r: Math.round(a.r * (1 - a1) + b.r * a1),
    g: Math.round(a.g * (1 - a1) + b.g * a1),
    b: Math.round(a.b * (1 - a1) + b.b * a1),
  };
}

/** Generate tints (mix with white) and shades (mix with black). */
export function generateShadesTints(base: RGB, steps = 5): { tints: RGB[]; shades: RGB[] } {
  const white: RGB = { r: 255, g: 255, b: 255 };
  const black: RGB = { r: 0, g: 0, b: 0 };
  const tints: RGB[] = [];
  const shades: RGB[] = [];
  for (let i = 1; i <= steps; i++) {
    const a = i / (steps + 1);
    tints.push(blendWithAlpha(base, white, a));
    shades.push(blendWithAlpha(base, black, a));
  }
  return { tints, shades };
}

/** Generate analogous colors (±30° on the color wheel). */
export function analogous(base: RGB, count = 5, spread = 30): RGB[] {
  const hsl = rgbToHsl(base);
  const out: RGB[] = [];
  const half = Math.floor(count / 2);
  for (let i = -half; i <= half; i++) {
    if (i === 0) {
      out.push({ ...base });
    } else {
      out.push(hslToRgb({ ...hsl, h: (hsl.h + i * spread + 360) % 360 }));
    }
  }
  return out;
}

/** Generate complementary (180°), split-complementary (±150°), triadic (±120°), tetradic (±90°, ±180°). */
export function harmony(base: RGB, type: "complementary" | "split" | "triadic" | "tetradic"): RGB[] {
  const hsl = rgbToHsl(base);
  const add = (deg: number) => hslToRgb({ ...hsl, h: (hsl.h + deg + 360) % 360 });
  switch (type) {
    case "complementary": return [base, add(180)];
    case "split": return [base, add(150), add(210)];
    case "triadic": return [base, add(120), add(240)];
    case "tetradic": return [base, add(90), add(180), add(270)];
  }
}

/** Build a gradient palette from base color (mono / pastel / vibrant). */
export function palette(base: RGB, type: "mono" | "pastel" | "vibrant" | "muted", count = 6): RGB[] {
  const hsl = rgbToHsl(base);
  const out: RGB[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    switch (type) {
      case "mono": {
        const l = Math.round(15 + t * 70);
        out.push(hslToRgb({ ...hsl, l }));
        break;
      }
      case "pastel": {
        const h = (hsl.h + i * 30) % 360;
        out.push(hslToRgb({ h, s: 50, l: 75 }));
        break;
      }
      case "vibrant": {
        const h = (hsl.h + i * 45) % 360;
        out.push(hslToRgb({ h, s: 90, l: 55 }));
        break;
      }
      case "muted": {
        const h = (hsl.h + i * 20) % 360;
        out.push(hslToRgb({ h, s: 30, l: 50 }));
        break;
      }
    }
  }
  return out;
}

/** Format an array of colors as a CSV for export. */
export function colorsToCsv(colors: RGB[]): string {
  const rows = ["hex,r,g,b"];
  for (const c of colors) {
    rows.push(`${toHex(c)},${c.r},${c.g},${c.b}`);
  }
  return rows.join("\n");
}

/** Convert a list of colors to a CSS gradient string. */
export function toCssGradient(colors: RGB[], direction = "90deg"): string {
  if (colors.length === 0) return "";
  const stops = colors.map((c, i) => `${toHex(c)} ${Math.round((i / (colors.length - 1)) * 100)}%`);
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

/** List of available blend modes. */
export const BLEND_MODES: BlendMode[] = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light",
  "difference", "exclusion", "addition", "subtract",
];
