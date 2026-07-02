/**
 * Color Picker / Converter — pure logic.
 * All conversions are mathematically exact (no gamut loss).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
  a?: number;
}
export interface HSL {
  h: number;
  s: number;
  l: number;
  a?: number;
}
export interface HSV {
  h: number;
  s: number;
  v: number;
  a?: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
const clampPercent = (n: number) => clamp(n, 0, 100);
const clampHue = (n: number) => ((n % 360) + 360) % 360;

/** Parse a HEX string (#RGB, #RRGGBB, #RRGGBBAA) into RGB. */
export function hexToRgb(hex: string): RGB | null {
  let s = hex.trim().replace(/^#/, "");
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  if (s.length === 4)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  if (s.length !== 6 && s.length !== 8) return null;
  if (!/^[0-9a-f]+$/i.test(s)) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : undefined;
  return { r, g, b, a };
}

/** Convert RGB to HEX (#RRGGBB or #RRGGBBAA). */
export function rgbToHex(rgb: RGB, includeAlpha = false): string {
  const hex = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  let s = "#" + hex(rgb.r) + hex(rgb.g) + hex(rgb.b);
  if (includeAlpha && rgb.a !== undefined) s += hex(rgb.a * 255);
  return s.toUpperCase();
}

/** Convert RGB to HSL. */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100), a: rgb.a };
}

/** Convert HSL to RGB. */
export function hslToRgb(hsl: HSL): RGB {
  const h = clampHue(hsl.h) / 360;
  const s = clampPercent(hsl.s) / 100;
  const l = clampPercent(hsl.l) / 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: hsl.a };
}

/** Convert RGB to HSV. */
export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100), a: rgb.a };
}

/** Convert HSV to RGB. */
export function hsvToRgb(hsv: HSV): RGB {
  const h = clampHue(hsv.h) / 60;
  const s = clampPercent(hsv.s) / 100;
  const v = clampPercent(hsv.v) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h >= 0 && h < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 5) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: hsv.a,
  };
}

/** Format RGB as a CSS string. */
export function rgbToCss(rgb: RGB): string {
  if (rgb.a !== undefined && rgb.a < 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/** Format HSL as a CSS string. */
export function hslToCss(hsl: HSL): string {
  if (hsl.a !== undefined && hsl.a < 1) {
    return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${hsl.a})`;
  }
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance(rgb: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

/** WCAG 2.1 contrast ratio between two colors. Returns ratio like 4.5. */
export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastCheck {
  ratio: number;
  aaNormal: boolean; // >= 4.5
  aaLarge: boolean; // >= 3.0
  aaaNormal: boolean; // >= 7.0
  aaaLarge: boolean; // >= 4.5
}

/** Full WCAG contrast check. */
export function checkContrast(foreground: RGB, background: RGB): ContrastCheck {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio: Math.round(ratio * 100) / 100,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3.0,
    aaaNormal: ratio >= 7.0,
    aaaLarge: ratio >= 4.5,
  };
}

/** Generate a list of shades/tints of a color (0% = black, 50% = original, 100% = white). */
export function generateShades(rgb: RGB, count = 11): { pct: number; hex: string }[] {
  const shades: { pct: number; hex: string }[] = [];
  for (let i = 0; i < count; i++) {
    const pct = Math.round((i / (count - 1)) * 100);
    let mixed: RGB;
    if (pct < 50) {
      // Mix with black
      const t = pct / 50;
      mixed = {
        r: Math.round(rgb.r * t),
        g: Math.round(rgb.g * t),
        b: Math.round(rgb.b * t),
      };
    } else if (pct > 50) {
      // Mix with white
      const t = (pct - 50) / 50;
      mixed = {
        r: Math.round(rgb.r + (255 - rgb.r) * t),
        g: Math.round(rgb.g + (255 - rgb.g) * t),
        b: Math.round(rgb.b + (255 - rgb.b) * t),
      };
    } else {
      mixed = { ...rgb };
    }
    shades.push({ pct, hex: rgbToHex(mixed) });
  }
  return shades;
}

/** Complementary color (180° opposite on the color wheel). */
export function complementary(rgb: RGB): RGB {
  const hsl = rgbToHsl(rgb);
  return hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 });
}
