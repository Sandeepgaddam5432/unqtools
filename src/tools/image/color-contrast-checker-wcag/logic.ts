/**
 * Color Contrast Checker (WCAG) — pure logic.
 */

export interface RGB { r: number; g: number; b: number; }

export interface ContrastResult {
  ratio: number;
  aa: boolean;
  aaLarge: boolean;
  aaa: boolean;
  aaaLarge: boolean;
  level: string;
}

export function hexToRgb(hex: string): RGB | null {
  const m = hex.match(/^#?([a-f0-9]{6}|[a-f0-9]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex(rgb: RGB): string {
  return "#" + [rgb.r, rgb.g, rgb.b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("");
}

function luminance(rgb: RGB): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

export function getContrastRatio(fg: RGB, bg: RGB): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function checkContrast(fg: RGB, bg: RGB): ContrastResult {
  const ratio = getContrastRatio(fg, bg);
  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    level: ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "Fail",
  };
}

export function suggestFix(fg: RGB, bg: RGB, target: number): RGB {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const neededRatio = target;
  const neededDarker = (lighter + 0.05) / neededRatio - 0.05;
  if (l1 > l2) {
    const factor = Math.max(0, Math.min(1, neededDarker / l1));
    return { r: Math.round(fg.r * factor), g: Math.round(fg.g * factor), b: Math.round(fg.b * factor) };
  } else {
    const factor = Math.min(255 / Math.max(fg.r, 1), Math.min(255 / Math.max(fg.g, 1), 255 / Math.max(fg.b, 1)));
    return { r: Math.min(255, Math.round(fg.r * (1 / factor))), g: Math.min(255, Math.round(fg.g * (1 / factor))), b: Math.min(255, Math.round(fg.b * (1 / factor))) };
  }
}

export function getWcagLevels(): { level: string; normalText: number; largeText: number }[] {
  return [{ level: "AA", normalText: 4.5, largeText: 3 }, { level: "AAA", normalText: 7, largeText: 4.5 }];
}
