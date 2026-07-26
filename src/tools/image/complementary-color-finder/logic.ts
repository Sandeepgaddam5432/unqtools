/**
 * Complementary Color Finder — pure logic.
 * Color conversion and analysis utilities.
 */

export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }
export interface HSV { h: number; s: number; v: number; }

export function hexToRgb(hex: string): RGB | null {
  const m = hex.match(/^#?([a-f0-9]{6}|[a-f0-9]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): string {
  return "#" + [rgb.r, rgb.g, rgb.b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
    .join("");
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360, s = hsl.s / 100, l = hsl.l / 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export function getContrastRatio(fg: RGB, bg: RGB): number {
  const luminance = (rgb: RGB) => {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getWcagGrade(ratio: number): { aa: boolean; aaa: boolean; large: boolean } {
  return {
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    large: ratio >= 3,
  };
}

export function complementary(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHex({ r: 255 - rgb.r, g: 255 - rgb.g, b: 255 - rgb.b });
}

export function analogous(hex: string): string[] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  return [
    rgbToHex(hslToRgb({ ...hsl, h: (hsl.h + 330) % 360 })),
    rgbToHex(hslToRgb({ ...hsl, h: (hsl.h + 30) % 360 })),
  ];
}

export function triadic(hex: string): string[] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  return [
    rgbToHex(hslToRgb({ ...hsl, h: (hsl.h + 120) % 360 })),
    rgbToHex(hslToRgb({ ...hsl, h: (hsl.h + 240) % 360 })),
  ];
}

export function shades(hex: string, steps = 10): string[] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  const result: string[] = [];
  for (let i = 0; i < steps; i++) {
    const l = Math.round((i / (steps - 1)) * 100);
    result.push(rgbToHex(hslToRgb({ ...hsl, l })));
  }
  return result;
}

export function randomColor(): string {
  return rgbToHex({
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  });
}

export function isValidHex(hex: string): boolean {
  return /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i.test(hex);
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
  blue: "#0000ff", yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", maroon: "#800000",
  olive: "#808000", purple: "#800080", teal: "#008080", navy: "#000080",
  orange: "#ffa500", pink: "#ffc0cb", brown: "#a52a2a", lime: "#00ff00",
};

export function namedToHex(name: string): string | null {
  return NAMED_COLORS[name.toLowerCase()] || null;
}

export function getAllNamedColors(): { name: string; hex: string }[] {
  return Object.entries(NAMED_COLORS).map(([name, hex]) => ({ name, hex }));
}
