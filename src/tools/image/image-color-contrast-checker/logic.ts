/**
 * Color Contrast Checker (WCAG) — pure logic.
 * Computes WCAG 2.x contrast ratios, AA/AAA pass/fail, APCA perceptual
 * contrast, and suggests darker/lighter color variants to meet a target ratio.
 */

export type WCAGLevel = "AA" | "AAA";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ContrastResult {
  ratio: number; // 1..21
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  aaUiComponents: boolean;
  luminance1: number;
  luminance2: number;
  summary: string;
}

export interface ApcResult {
  value: number; // -108..106 (Lc)
  level: "Cannot Read" | "Fluent" | "Spot Reading" | "Minimum" | "Best";
  pass: boolean;
  summary: string;
}

export interface ColorSuggestion {
  hex: string;
  ratio: number;
  delta: number;
}

export interface SuggestionResult {
  lighter: ColorSuggestion[];
  darker: ColorSuggestion[];
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Parse a hex string into RGB. Supports #RGB and #RRGGBB. */
export function parseHex(hex: string): RGB | null {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

/** Convert RGB back to a #RRGGBB string. */
export function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance per WCAG 2.x. */
export function relativeLuminance({ r, g, b }: RGB): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio between two colors. Returns 1..21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Determine WCAG pass/fail for the standard 4 thresholds. */
export function evaluateContrast(a: RGB, b: RGB): ContrastResult {
  const ratio = contrastRatio(a, b);
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const result: ContrastResult = {
    ratio: Math.round(ratio * 100) / 100,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    aaUiComponents: ratio >= 3,
    luminance1: Math.round(l1 * 10000) / 10000,
    luminance2: Math.round(l2 * 10000) / 10000,
    summary: "",
  };
  const passes = [
    result.aaNormal ? "AA Normal" : null,
    result.aaLarge ? "AA Large" : null,
    result.aaaNormal ? "AAA Normal" : null,
    result.aaaLarge ? "AAA Large" : null,
  ].filter(Boolean);
  result.summary = `Ratio ${result.ratio}:1 — ${passes.length ? passes.join(", ") : "Fails WCAG"}`;
  return result;
}

/** SAPC/APCA perceptual contrast (approximation of W3 draft). */
export function apcaContrast(fg: RGB, bg: RGB): ApcResult {
  const clampLc = (n: number) => Math.max(-108, Math.min(106, n));
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  // Soft clamp luminance
  const softBg = lBg >= 0.22 ? lBg : lBg + Math.pow(0.22 - lBg, 1.4) * 0.4;
  const softFg = lFg >= 0.22 ? lFg : lFg + Math.pow(0.22 - lFg, 1.4) * 0.4;
  const diff = softBg - softFg;
  let lc = 0;
  if (Math.abs(diff) < 0.02) {
    lc = 0;
  } else {
    lc = diff >= 0 ? diff * 100 * 1.0 : diff * 100 * 1.1;
  }
  lc = clampLc(Math.round(lc * 10) / 10);
  let level: ApcResult["level"] = "Cannot Read";
  const abs = Math.abs(lc);
  if (abs >= 90) level = "Best";
  else if (abs >= 75) level = "Minimum";
  else if (abs >= 60) level = "Spot Reading";
  else if (abs >= 45) level = "Fluent";
  const pass = abs >= 45;
  return {
    value: lc,
    level,
    pass,
    summary: `Lc ${lc} — ${level}${pass ? " (passes)" : " (fails APCA minimum)"}`,
  };
}

/** Adjust RGB lightness by a delta (-255..255). */
export function adjustLightness(c: RGB, delta: number): RGB {
  return { r: c.r + delta, g: c.g + delta, b: c.b + delta };
}

/** Generate a list of suggestions that meet the target ratio by lightening/darkening one color. */
export function suggestColors(base: RGB, other: RGB, targetRatio = 4.5, maxSteps = 24): SuggestionResult {
  const lighter: ColorSuggestion[] = [];
  const darker: ColorSuggestion[] = [];
  const otherLum = relativeLuminance(other);
  const isOtherLighter = otherLum > relativeLuminance(base);
  for (let step = 1; step <= maxSteps; step++) {
    const delta = step * 8;
    // Lighten base
    const up = adjustLightness(base, delta);
    if (up.r <= 255 && up.g <= 255 && up.b <= 255) {
      const ratio = contrastRatio(up, other);
      if (ratio >= targetRatio && (isOtherLighter || ratio >= contrastRatio(base, other) + 0.05)) {
        lighter.push({ hex: toHex(up), ratio: Math.round(ratio * 100) / 100, delta });
      }
    }
    // Darken base
    const down = adjustLightness(base, -delta);
    if (down.r >= 0 && down.g >= 0 && down.b >= 0) {
      const ratio = contrastRatio(down, other);
      if (ratio >= targetRatio && (!isOtherLighter || ratio >= contrastRatio(base, other) + 0.05)) {
        darker.push({ hex: toHex(down), ratio: Math.round(ratio * 100) / 100, delta });
      }
    }
  }
  // Sort by minimal delta (best match)
  lighter.sort((a, b) => a.delta - b.delta);
  darker.sort((a, b) => a.delta - b.delta);
  return {
    lighter: lighter.slice(0, 5),
    darker: darker.slice(0, 5),
  };
}

/** Validate that a hex string is parseable. */
export function isValidHex(hex: string): boolean {
  return parseHex(hex) !== null;
}

/** Format a contrast result as a multi-line report. */
export function formatReport(a: RGB, b: RGB): string {
  const r = evaluateContrast(a, b);
  const apc = apcaContrast(a, b);
  return [
    `Foreground: ${toHex(a)}`,
    `Background: ${toHex(b)}`,
    `Luminance (fg): ${r.luminance1}`,
    `Luminance (bg): ${r.luminance2}`,
    `WCAG contrast: ${r.ratio}:1`,
    `AA Normal: ${r.aaNormal ? "PASS" : "FAIL"} (>=4.5)`,
    `AA Large: ${r.aaLarge ? "PASS" : "FAIL"} (>=3)`,
    `AAA Normal: ${r.aaaNormal ? "PASS" : "FAIL"} (>=7)`,
    `AAA Large: ${r.aaaLarge ? "PASS" : "FAIL"} (>=4.5)`,
    `APCA: Lc ${apc.value} — ${apc.level}`,
  ].join("\n");
}

/** Convert RGB to HSL (h in 0-360, s/l in 0-100). */
export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
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

/** Determine which color (fg or bg) should be the text for best contrast. */
export function recommendTextRole(a: RGB, b: RGB): "first-as-fg" | "second-as-fg" {
  return relativeLuminance(a) < relativeLuminance(b) ? "first-as-fg" : "second-as-fg";
}
