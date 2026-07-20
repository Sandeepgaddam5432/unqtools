/**
 * AI Tailwind CSS Palette Generator — pure logic.
 *
 * Generate full 11-step Tailwind 50–950 scales from a base hex color using
 * perceptual HSL/OKLCH-style shade math, plus harmony helpers
 * (complementary, analogous, triadic, monochrome), WCAG contrast checks per
 * shade, and copy-ready exports for Tailwind v3 / v4 / CSS variables / JSON.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx.
 */

// ---------- Types ----------

export type ShadeStep = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950";

export const SHADE_STEPS: ShadeStep[] = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
];

/** Target lightness (HSL L%) for each shade step (perceptually even). */
export const SHADE_LIGHTNESS: Record<ShadeStep, number> = {
  "50": 97,
  "100": 93,
  "200": 86,
  "300": 75,
  "400": 64,
  "500": 54,
  "600": 44,
  "700": 35,
  "800": 26,
  "900": 18,
  "950": 11,
};

/** Target chroma factor (relative to base) per step — darker shades keep more chroma. */
export const SHADE_CHROMA: Record<ShadeStep, number> = {
  "50": 0.55,
  "100": 0.7,
  "200": 0.85,
  "300": 0.95,
  "400": 1.0,
  "500": 1.0,
  "600": 1.0,
  "700": 0.95,
  "800": 0.85,
  "900": 0.75,
  "950": 0.65,
};

export type Harmony = "complementary" | "analogous" | "triadic" | "monochrome";

export interface Rgb { r: number; g: number; b: number; }
export interface Hsl { h: number; s: number; l: number; }

export interface Shade {
  step: ShadeStep;
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  /** Tailwind class token name, e.g. "primary-500". */
  token: string;
}

export interface Palette {
  id: string;
  name: string;
  baseHex: string;
  baseHsl: Hsl;
  shades: Shade[];
  harmony: Harmony;
  createdAt: number;
}

export interface ContrastResult {
  fg: string;
  bg: string;
  ratio: number;
  aa: boolean;       // 4.5:1
  aaa: boolean;      // 7:1
  aaLarge: boolean;  // 3:1
}

export interface PaletteStats {
  totalShades: number;
  passingAaVsWhite: number;
  passingAaVsBlack: number;
  passingAaaVsWhite: number;
  harmonyCount: number;
}

export interface SystemPalette {
  brand: Palette;
  neutral: Palette;
  success: Palette;
  warning: Palette;
  danger: Palette;
  info: Palette;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-tailwind-palette:history";
export const HISTORY_MAX = 20;
export const FAVES_KEY = "unqtools:ai-tailwind-palette:faves";
export const FAVES_MAX = 50;
export const LLM_KEY_STORAGE = "unqtools:ai-tailwind-palette:llm-key";

export const HARMONY_LABELS: Record<Harmony, string> = {
  complementary: "Complementary",
  analogous: "Analogous",
  triadic: "Triadic",
  monochrome: "Monochrome",
};

export const HARMONY_DESCRIPTIONS: Record<Harmony, string> = {
  complementary: "Opposite hues on the color wheel (180° apart). High contrast.",
  analogous: "Adjacent hues (±30°). Harmonious and calm.",
  triadic: "Three hues evenly spaced (120° apart). Vibrant and balanced.",
  monochrome: "Same hue, varied lightness/chroma. Unified and subtle.",
};

export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Sky", hex: "#0284c7" },
  { name: "Cyan", hex: "#0891b2" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Emerald", hex: "#059669" },
  { name: "Green", hex: "#16a34a" },
  { name: "Lime", hex: "#65a30d" },
  { name: "Amber", hex: "#d97706" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Red", hex: "#dc2626" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Pink", hex: "#db2777" },
  { name: "Slate", hex: "#475569" },
];

export const VIBE_PRESETS: string[] = [
  "calm fintech app",
  "energetic fitness brand",
  "premium saas dashboard",
  "playful kids education",
  "trustworthy healthcare",
  "bold gaming platform",
  "minimal design studio",
  "eco sustainability",
  "luxury fashion",
  "friendly community app",
];

export const DEFAULT_BASE = "#4f46e5";

// ---------- Color-space conversions ----------

/** Clamp a number to [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Validate a hex string (#RGB or #RRGGBB). */
export function isValidHex(hex: string): boolean {
  return /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i.test((hex || "").trim());
}

/** Normalize a hex string to #RRGGBB. Returns "" if invalid. */
export function normalizeHex(hex: string): string {
  const m = /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i.exec((hex || "").trim());
  if (!m) return "";
  let h = m[1];
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  return `#${h.toLowerCase()}`;
}

/** Convert hex (#RRGGBB) to {r,g,b} (0–255). */
export function hexToRgb(hex: string): Rgb | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return { r, g, b };
}

/** Convert {r,g,b} to #RRGGBB. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const to2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Convert {r,g,b} to {h,s,l} (h: 0–360, s,l: 0–100). */
export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

/** Convert {h,s,l} to {r,g,b}. */
export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (hn < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (hn < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (hn < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (hn < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (hn < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

/** Convert hex to {h,s,l}. */
export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb);
}

/** Convert {h,s,l} to #RRGGBB. */
export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

// ---------- Shade generation ----------

/**
 * Build one shade at a target lightness, preserving hue and modulating chroma.
 * Uses an HSL walk + a small chroma factor — closer to OKLCH than a pure
 * lightness lerp. For very dark shades we boost saturation slightly so colors
 * don't go muddy; for very light shades we soften so they don't blow out.
 */
export function buildShade(
  baseHsl: Hsl,
  step: ShadeStep,
  chromaFactor: number = SHADE_CHROMA[step],
): Shade {
  const targetL = SHADE_LIGHTNESS[step];
  // Preserve hue. Modulate saturation by chroma factor (clamped).
  // For extreme steps we taper saturation further so the lightest/darkest
  // shades stay usable.
  let s = baseHsl.s * chromaFactor;
  if (step === "50" || step === "100") s = Math.min(s, 38);
  if (step === "950") s = Math.min(s, 55);
  if (step === "900") s = Math.min(s, 65);
  s = clamp(s, 0, 100);
  const hsl: Hsl = { h: baseHsl.h, s, l: targetL };
  const rgb = hslToRgb(hsl);
  const hex = rgbToHex(rgb);
  return {
    step,
    hex,
    rgb,
    hsl,
    token: `primary-${step}`,
  };
}

/**
 * Generate a full 11-step palette from a base hex color.
 * The 500 step matches the input color's lightness, while hue is preserved
 * across all steps.
 */
export function generatePalette(
  baseHex: string,
  opts: { name?: string; harmony?: Harmony } = {},
): Palette | null {
  const baseHsl = hexToHsl(baseHex);
  if (!baseHsl) return null;
  const h = normalizeHex(baseHex);
  const shades: Shade[] = SHADE_STEPS.map((step) => buildShade(baseHsl, step));
  return {
    id: `pal-${simpleHash(h + (opts.harmony ?? "monochrome")).toString(36)}`,
    name: opts.name ?? "primary",
    baseHex: h,
    baseHsl,
    shades,
    harmony: opts.harmony ?? "monochrome",
    createdAt: Date.now(),
  };
}

/** Pick the closest shade step for a given hex lightness (helper). */
export function closestStep(hex: string): ShadeStep | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  let best: ShadeStep = "500";
  let bestDiff = Infinity;
  for (const step of SHADE_STEPS) {
    const diff = Math.abs(SHADE_LIGHTNESS[step] - hsl.l);
    if (diff < bestDiff) { bestDiff = diff; best = step; }
  }
  return best;
}

// ---------- Harmony helpers ----------

/**
 * Generate harmony palettes from a base color.
 * Returns 2–4 palettes depending on the harmony type. The base palette is
 * always included as the first entry.
 */
export function generateHarmony(baseHex: string, harmony: Harmony): Palette[] {
  const baseHsl = hexToHsl(baseHex);
  if (!baseHsl) return [];
  const base = generatePalette(baseHex, { name: "primary", harmony });
  if (!base) return [];
  if (harmony === "monochrome") return [base];

  const hues: number[] = [];
  if (harmony === "complementary") {
    hues.push(baseHsl.h, (baseHsl.h + 180) % 360);
  } else if (harmony === "analogous") {
    hues.push(
      (baseHsl.h - 30 + 360) % 360,
      baseHsl.h,
      (baseHsl.h + 30) % 360,
    );
  } else if (harmony === "triadic") {
    hues.push(
      baseHsl.h,
      (baseHsl.h + 120) % 360,
      (baseHsl.h + 240) % 360,
    );
  }
  const out: Palette[] = [base];
  const names = ["primary", "secondary", "tertiary", "accent"];
  hues.slice(1).forEach((hue, i) => {
    const shiftedHsl: Hsl = { h: hue, s: baseHsl.s, l: baseHsl.l };
    const hex = hslToHex(shiftedHsl);
    const p = generatePalette(hex, {
      name: names[i + 1] ?? `accent-${i + 1}`,
      harmony,
    });
    if (p) out.push(p);
  });
  return out;
}

/** Return one harmony-color hex (the first non-base) for a given harmony. */
export function harmonyColor(baseHex: string, harmony: Harmony): string | null {
  const ps = generateHarmony(baseHex, harmony);
  if (ps.length < 2) return null;
  return ps[1].baseHex;
}

// ---------- System palette (brand + neutral + status) ----------

/**
 * Build a coherent system palette: brand (base hue), neutral (desaturated),
 * and status colors (success=green-ish, warning=amber, danger=red, info=blue).
 * Status hues are anchored relative to the base hue so the whole system feels
 * related, but they remain clearly distinct.
 */
export function generateSystemPalette(baseHex: string): SystemPalette | null {
  const baseHsl = hexToHsl(baseHex);
  if (!baseHsl) return null;
  const brand = generatePalette(baseHex, { name: "primary", harmony: "monochrome" });
  if (!brand) return null;

  // Neutral: same hue, very low saturation, slightly cooler lightness.
  const neutralHsl: Hsl = { h: baseHsl.h, s: Math.min(15, baseHsl.s * 0.12), l: baseHsl.l };
  const neutral = generatePalette(hslToHex(neutralHsl), { name: "neutral", harmony: "monochrome" });
  if (!neutral) return null;

  // Status colors: anchored to canonical hues (independent of base hue so they
  // remain semantically clear). We do nudge hue slightly toward base for unity.
  const nudge = (canonicalHue: number): number => {
    // Pull the canonical hue 10° toward the base hue.
    const diff = ((baseHsl.h - canonicalHue + 540) % 360) - 180;
    return (canonicalHue + diff * 0.1 + 360) % 360;
  };
  const successHsl: Hsl = { h: nudge(150), s: 65, l: 45 };
  const warningHsl: Hsl = { h: nudge(38), s: 80, l: 50 };
  const dangerHsl: Hsl = { h: nudge(0), s: 70, l: 50 };
  const infoHsl: Hsl = { h: nudge(210), s: 70, l: 50 };

  const success = generatePalette(hslToHex(successHsl), { name: "success", harmony: "monochrome" });
  const warning = generatePalette(hslToHex(warningHsl), { name: "warning", harmony: "monochrome" });
  const danger = generatePalette(hslToHex(dangerHsl), { name: "danger", harmony: "monochrome" });
  const info = generatePalette(hslToHex(infoHsl), { name: "info", harmony: "monochrome" });
  if (!success || !warning || !danger || !info) return null;

  return { brand, neutral, success, warning, danger, info };
}

// ---------- WCAG contrast ----------

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

/** Contrast ratio between two hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05);
}

/** Check contrast between two hex colors. Returns AA / AAA / AA-Large booleans. */
export function checkContrast(fg: string, bg: string): ContrastResult {
  const ratio = contrastRatio(fg, bg);
  return {
    fg,
    bg,
    ratio,
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    aaLarge: ratio >= 3,
  };
}

/** Determine if white or black text reads better on a given background. */
export function readableTextOn(hex: string): string {
  const white = contrastRatio("#ffffff", hex);
  const black = contrastRatio("#000000", hex);
  return white >= black ? "#ffffff" : "#000000";
}

/** Compute contrast checks for every shade vs white and vs black. */
export function contrastMatrix(palette: Palette): {
  vsWhite: ContrastResult[];
  vsBlack: ContrastResult[];
} {
  return {
    vsWhite: palette.shades.map((s) => checkContrast("#ffffff", s.hex)),
    vsBlack: palette.shades.map((s) => checkContrast("#000000", s.hex)),
  };
}

/** Compute palette-level stats. */
export function computeStats(palette: Palette): PaletteStats {
  const m = contrastMatrix(palette);
  return {
    totalShades: palette.shades.length,
    passingAaVsWhite: m.vsWhite.filter((c) => c.aa).length,
    passingAaVsBlack: m.vsBlack.filter((c) => c.aa).length,
    passingAaaVsWhite: m.vsWhite.filter((c) => c.aaa).length,
    harmonyCount: generateHarmony(palette.baseHex, palette.harmony).length,
  };
}

// ---------- Exports ----------

/** Render a palette as a Tailwind v3 config colors object (JS). */
export function renderTailwindV3(palette: Palette, name: string = palette.name): string {
  const lines: string[] = [
    "/** tailwind.config.js — generated by UnQTools */",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    `      colors: {`,
    `        ${name}: {`,
  ];
  for (const s of palette.shades) {
    lines.push(`          ${s.step}: "${s.hex}",`);
  }
  lines.push("        },");
  lines.push("      },");
  lines.push("    },");
  lines.push("  },");
  lines.push("};");
  return lines.join("\n");
}

/** Render a palette as a Tailwind v4 @theme CSS variables block. */
export function renderTailwindV4(palette: Palette, name: string = palette.name): string {
  const lines: string[] = [
    "/* tailwind v4 — generated by UnQTools */",
    "@theme {",
  ];
  for (const s of palette.shades) {
    lines.push(`  --color-${name}-${s.step}: ${s.hex};`);
  }
  lines.push("}");
  return lines.join("\n");
}

/** Render a palette as CSS custom properties on :root. */
export function renderCssVars(palette: Palette, name: string = palette.name): string {
  const lines: string[] = [
    "/* CSS variables — generated by UnQTools */",
    ":root {",
  ];
  for (const s of palette.shades) {
    lines.push(`  --${name}-${s.step}: ${s.hex};`);
  }
  lines.push("}");
  return lines.join("\n");
}

/** Render a palette as JSON design tokens (W3C-style). */
export function renderJson(palette: Palette): string {
  const obj = {
    name: palette.name,
    baseHex: palette.baseHex,
    baseHsl: palette.baseHsl,
    harmony: palette.harmony,
    shades: palette.shades.map((s) => ({
      step: s.step,
      hex: s.hex,
      rgb: { r: Math.round(s.rgb.r), g: Math.round(s.rgb.g), b: Math.round(s.rgb.b) },
      hsl: {
        h: Math.round(s.hsl.h * 10) / 10,
        s: Math.round(s.hsl.s * 10) / 10,
        l: Math.round(s.hsl.l * 10) / 10,
      },
    })),
  };
  return JSON.stringify(obj, null, 2);
}

/** Render a complete system palette as JSON tokens. */
export function renderSystemJson(sys: SystemPalette): string {
  const obj = {
    brand: paletteToPlain(sys.brand),
    neutral: paletteToPlain(sys.neutral),
    success: paletteToPlain(sys.success),
    warning: paletteToPlain(sys.warning),
    danger: paletteToPlain(sys.danger),
    info: paletteToPlain(sys.info),
  };
  return JSON.stringify(obj, null, 2);
}

function paletteToPlain(p: Palette): Record<string, unknown> {
  return {
    name: p.name,
    baseHex: p.baseHex,
    shades: p.shades.map((s) => ({
      step: s.step,
      hex: s.hex,
      rgb: { r: Math.round(s.rgb.r), g: Math.round(s.rgb.g), b: Math.round(s.rgb.b) },
      hsl: {
        h: Math.round(s.hsl.h * 10) / 10,
        s: Math.round(s.hsl.s * 10) / 10,
        l: Math.round(s.hsl.l * 10) / 10,
      },
    })),
  };
}

/** Render a full system palette as Tailwind v3 config (all six color sets). */
export function renderSystemTailwindV3(sys: SystemPalette): string {
  const lines: string[] = [
    "/** tailwind.config.js — generated by UnQTools */",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    "      colors: {",
  ];
  for (const p of [sys.brand, sys.neutral, sys.success, sys.warning, sys.danger, sys.info]) {
    lines.push(`        ${p.name}: {`);
    for (const s of p.shades) {
      lines.push(`          ${s.step}: "${s.hex}",`);
    }
    lines.push("        },");
  }
  lines.push("      },");
  lines.push("    },");
  lines.push("  },");
  lines.push("};");
  return lines.join("\n");
}

/** Render the palette as plain text (one shade per line). */
export function renderText(palette: Palette): string {
  return [
    `${palette.name} palette — base ${palette.baseHex} (hsl(${Math.round(palette.baseHsl.h)}, ${Math.round(palette.baseHsl.s)}%, ${Math.round(palette.baseHsl.l)}%)) — harmony: ${HARMONY_LABELS[palette.harmony]}`,
    "",
    ...palette.shades.map((s) => `${s.step.padEnd(4)} ${s.hex}   rgb(${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)})   hsl(${Math.round(s.hsl.h)}, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}%)`),
  ].join("\n");
}

/** Render the palette as Markdown (with swatches as hex codes). */
export function renderMarkdown(palette: Palette): string {
  const lines: string[] = [
    `## ${palette.name} palette`,
    "",
    `Base: \`${palette.baseHex}\` · Harmony: ${HARMONY_LABELS[palette.harmony]}`,
    "",
    "| Step | Hex | RGB | HSL |",
    "| --- | --- | --- | --- |",
  ];
  for (const s of palette.shades) {
    lines.push(`| ${s.step} | \`${s.hex}\` | rgb(${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)}) | hsl(${Math.round(s.hsl.h)}, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}%) |`);
  }
  return lines.join("\n");
}

// ---------- Random + lock ----------

/** Generate a random base hex color. */
export function randomBaseHex(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 50 + Math.floor(Math.random() * 40); // 50–90
  const l = 40 + Math.floor(Math.random() * 20); // 40–60
  return hslToHex({ h, s, l });
}

/**
 * Re-roll a base hex while keeping the locked channel(s).
 * locked: "hue" | "sat" | "light" | "none"
 */
export function rerollBase(currentHex: string, locked: "hue" | "sat" | "light" | "none"): string {
  const hsl = hexToHsl(currentHex);
  if (!hsl) return randomBaseHex();
  const next: Hsl = {
    h: locked === "hue" ? hsl.h : Math.floor(Math.random() * 360),
    s: locked === "sat" ? hsl.s : 50 + Math.floor(Math.random() * 40),
    l: locked === "light" ? hsl.l : 40 + Math.floor(Math.random() * 20),
  };
  return hslToHex(next);
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  baseHex: string;
  harmony: Harmony;
  name: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Favorites (localStorage) ----------

export interface FavoriteEntry {
  id: string;
  ts: number;
  baseHex: string;
  harmony: Harmony;
  name: string;
}

export function loadFavorites(): FavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(arr) ? arr.slice(0, FAVES_MAX) : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoriteEntry): FavoriteEntry[] {
  const current = loadFavorites().filter((f) => f.id !== entry.id);
  const next = [entry, ...current].slice(0, FAVES_MAX);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(FAVES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function removeFavorite(id: string): FavoriteEntry[] {
  const next = loadFavorites().filter((f) => f.id !== id);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(FAVES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(FAVES_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  baseHex: string;
  harmony: Harmony;
  name: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.baseHex) params.set("hex", state.baseHex);
  if (state.harmony) params.set("h", state.harmony);
  if (state.name && state.name !== "primary") params.set("n", state.name);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { baseHex: DEFAULT_BASE, harmony: "monochrome", name: "primary" };
  const params = new URLSearchParams(clean);
  const hex = normalizeHex(params.get("hex") ?? "") || DEFAULT_BASE;
  const harmonyRaw = params.get("h") as Harmony | null;
  const harmony: Harmony = harmonyRaw && harmonyRaw in HARMONY_LABELS ? harmonyRaw : "monochrome";
  const name = params.get("n") ?? "primary";
  return { baseHex: hex, harmony, name };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(vibe: string): string {
  return [
    "You are a brand colorist. The user describes a product vibe and you suggest",
    "ONE base color for a Tailwind CSS palette. Return JSON with this exact shape:",
    "",
    "{",
    '  "hex": "#RRGGBB",',
    '  "name": "short color name",',
    '  "reason": "one sentence why this hue fits the vibe"',
    "}",
    "",
    "Rules:",
    "- Hex must be 6-digit #RRGGBB lowercase.",
    "- Choose a saturated mid-tone (lightness ~40–55%) so it generates a usable scale.",
    "- No markdown fences. Return raw JSON only.",
    "",
    `Vibe: ${vibe}`,
  ].join("\n");
}

export interface LlmSuggestion {
  hex: string;
  name: string;
  reason: string;
}

export function renderLlmResult(raw: string): { ok: true; suggestion: LlmSuggestion } | { ok: false; error: string } {
  let s = (raw || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON." };
  }
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const hex = typeof o.hex === "string" ? normalizeHex(o.hex) : "";
  if (!hex) return { ok: false, error: "LLM output had no valid hex field." };
  return {
    ok: true,
    suggestion: {
      hex,
      name: typeof o.name === "string" ? o.name : "primary",
      reason: typeof o.reason === "string" ? o.reason : "",
    },
  };
}

// ---------- Helpers ----------

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/** Format an RGB object as a CSS rgb() string. */
export function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Format an HSL object as a CSS hsl() string. */
export function hslToCss({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** Convert a hex string to a CSS rgb() string. */
export function hexToCssRgb(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToCss(rgb) : "";
}

/** Convert a hex string to a CSS hsl() string. */
export function hexToCssHsl(hex: string): string {
  const hsl = hexToHsl(hex);
  return hsl ? hslToCss(hsl) : "";
}

/** Render a small inline preview (button + card) using palette shades. */
export function buildPreviewHtml(palette: Palette, dark: boolean): string {
  const bg = dark ? palette.shades.find((s) => s.step === "950")?.hex ?? "#0b0b0b"
    : palette.shades.find((s) => s.step === "50")?.hex ?? "#ffffff";
  const text = dark ? "#e5e7eb" : "#111827";
  const c500 = palette.shades.find((s) => s.step === "500")?.hex ?? "#4f46e5";
  const c600 = palette.shades.find((s) => s.step === "600")?.hex ?? c500;
  const c100 = palette.shades.find((s) => s.step === "100")?.hex ?? c500;
  const c700 = palette.shades.find((s) => s.step === "700")?.hex ?? c500;
  const onC500 = readableTextOn(c500);
  const onC700 = readableTextOn(c700);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Preview</title>
<style>
  body { margin:0; padding:24px; background:${bg}; color:${text}; font-family:system-ui,-apple-system,sans-serif; }
  .row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start; margin-bottom:16px; }
  .btn { background:${c500}; color:${onC500}; border:none; padding:10px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  .btn:hover { background:${c600}; }
  .btn-out { background:transparent; color:${c700}; border:1.5px solid ${c700}; padding:10px 18px; border-radius:8px; font-weight:600; }
  .card { background:${dark ? "#1e1e26" : "#ffffff"}; color:${text}; border:1px solid ${c100}; border-radius:12px; padding:18px; max-width:320px; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
  .card h3 { margin:0 0 6px; font-size:18px; }
  .card p { margin:0 0 12px; color:${dark ? "#94a3b8" : "#6b7280"}; font-size:14px; }
  .badge { background:${c100}; color:${c700}; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:600; }
</style></head><body>
<div class="row">
  <button class="btn">Primary action</button>
  <button class="btn-out">Secondary</button>
  <span class="badge">New</span>
</div>
<div class="card">
  <h3>Card title</h3>
  <p>A short description that explains what this card is about and why it matters.</p>
  <button class="btn">Learn more</button>
</div>
</body></html>`;
}
