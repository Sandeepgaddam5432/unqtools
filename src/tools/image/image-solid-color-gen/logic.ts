/**
 * Solid Color Image Generator — pure logic. No DOM/canvas access.
 *
 * Extras (10+):
 *   1. Hex / RGB input parsing
 *   2. HSL → RGB conversion
 *   3. HSV → RGB conversion
 *   4. RGB → HSL / HSV conversion
 *   5. Alpha support for PNG output
 *   6. Color history management (max N entries, dedup)
 *   7. Palette export (JSON, ASE-style string, CSS vars)
 *   8. CSS variable string builder
 *   9. Random color generator
 *  10. Width/height validation
 *  11. Format selection (PNG/JPEG/WebP)
 *  12. Complementary & analogous color helpers
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RGB { r: number; g: number; b: number; }
export interface RGBA extends RGB { a: number; }
export interface HSL { h: number; s: number; l: number; }
export interface HSV { h: number; s: number; v: number; }

const clampB = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const clampA = (n: number) => Math.max(0, Math.min(1, n));
const clampD = (n: number) => Math.max(1, Math.min(8000, Math.round(n)));

/** Parse hex string (#rgb or #rrggbb, optional #rrggbb or #rrggbbaa) into RGB(A). */
export function parseHex(hex: string): RGBA | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (/^[0-9a-fA-F]{6}$/.test(h)) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  if (/^[0-9a-fA-F]{8}$/.test(h)) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
  return null;
}

export function toHex(c: RGBA): string {
  const c2 = (n: number) => clampB(n).toString(16).padStart(2, "0");
  let s = `#${c2(c.r)}${c2(c.g)}${c2(c.b)}`;
  if (c.a < 1) s += c2(c.a * 255);
  return s;
}

export function toRgbString(c: RGBA): string {
  return c.a < 1 ? `rgba(${clampB(c.r)}, ${clampB(c.g)}, ${clampB(c.b)}, ${c.a.toFixed(2)})` : `rgb(${clampB(c.r)}, ${clampB(c.g)}, ${clampB(c.b)})`;
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hn = ((h % 360) + 360) % 360 / 360, sn = s / 100, ln = l / 100;
  if (sn === 0) { const v = Math.round(ln * 255); return { r: v, g: v, b: v }; }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: Math.round(hue(hn + 1 / 3) * 255), g: Math.round(hue(hn) * 255), b: Math.round(hue(hn - 1 / 3) * 255) };
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hn = ((h % 360) + 360) % 360 / 360, sn = s / 100, vn = v / 100;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = vn; g = t; b = p; break;
    case 1: r = q; g = vn; b = p; break;
    case 2: r = p; g = vn; b = t; break;
    case 3: r = p; g = q; b = vn; break;
    case 4: r = t; g = p; b = vn; break;
    case 5: r = vn; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/** Complementary (180° rotation in HSL). */
export function complementary(c: RGB): RGB {
  const hsl = rgbToHsl(c.r, c.g, c.b);
  return hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
}

/** Analogous (±30° in HSL). */
export function analogous(c: RGB): [RGB, RGB] {
  const hsl = rgbToHsl(c.r, c.g, c.b);
  return [
    hslToRgb((hsl.h + 330) % 360, hsl.s, hsl.l),
    hslToRgb((hsl.h + 30) % 360, hsl.s, hsl.l),
  ];
}

/** Add a color to history, dedup & cap at maxLen. */
export function addToHistory(history: RGBA[], c: RGBA, maxLen = 12): RGBA[] {
  const key = toHex(c);
  const filtered = history.filter((h) => toHex(h) !== key);
  return [c, ...filtered].slice(0, maxLen);
}

/** Build CSS variable string. */
export function toCssVar(c: RGBA, varName = "--color"): string {
  return `${varName}: ${toRgbString(c)};`;
}

/** Build palette JSON export. */
export function paletteToJson(colors: RGBA[], names?: string[]): string {
  const arr = colors.map((c, i) => ({ name: names?.[i] ?? `color-${i + 1}`, hex: toHex(c), rgb: toRgbString(c) }));
  return JSON.stringify(arr, null, 2);
}

/** Build palette CSS export. */
export function paletteToCss(colors: RGBA[], names?: string[]): string {
  return ":root {\n" + colors.map((c, i) => `  --${names?.[i] ?? `color-${i + 1}`}: ${toRgbString(c)};`).join("\n") + "\n}";
}

/** Random color. */
export function randomColor(): RGBA {
  return { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256), a: 1 };
}

/** Validate generation input. */
export function validateInput(width: number, height: number, format: OutputFormat, alpha: number): { ok: true } | { error: string } {
  if (!Number.isFinite(width) || width <= 0) return { error: "Width must be positive" };
  if (!Number.isFinite(height) || height <= 0) return { error: "Height must be positive" };
  if (width > 8000 || height > 8000) return { error: "Dimensions must be ≤ 8000" };
  if (alpha < 0 || alpha > 1) return { error: "Alpha must be 0-1" };
  if (format === "image/jpeg" && alpha < 1) return { error: "JPEG does not support alpha" };
  return { ok: true };
}

export function clampDimension(n: number): number {
  return clampD(n);
}

export function buildFilename(width: number, height: number, format: OutputFormat): string {
  const ext = format.split("/")[1];
  return `solid-color-${width}x${height}.${ext}`;
}
