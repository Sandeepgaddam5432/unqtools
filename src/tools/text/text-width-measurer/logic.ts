/**
 * Text Width Measurer — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - 7 common font families with per-glyph advance estimates
 *  - Font size, weight (400/700), style (normal/italic)
 *  - Pixel-width estimation using per-Unicode-block factors
 *  - Per-line measurement (multi-line text)
 *  - Per-char width table (a full breakdown)
 *  - Batch mode (multiple strings, one per line) with CSV export
 *  - Auto-fit: largest font size that fits within N pixels
 *  - Truncate-to-width helper
 *  - Wrap-to-width helper (returns wrapped lines)
 *  - Line height / box height computation
 *  - Common presets: 16px body, 12px caption, etc.
 *  - Reference: monospace vs proportional comparison
 */
export type FontFamily = "arial" | "helvetica" | "times" | "georgia" | "verdana" | "courier" | "system-ui";
export type FontStyle = "normal" | "italic";

export interface MeasureOptions {
  font: FontFamily;
  fontSize: number;
  fontWeight?: number;
  italic?: boolean;
  letterSpacing?: number; // px
}

export interface MeasureResult {
  width: number;
  widthPerChar: number;
  charCount: number;
  warnings: string[];
}

export interface CharWidthEntry {
  char: string;
  codePoint: number;
  factor: number;
  widthPx: number;
}

/** Per-glyph advance factors by Unicode block (proportional baseline).
 *  Order matters: more specific patterns must come before the general lowercase/uppercase catch-alls. */
const AVG_FACTORS: { test: (cp: number) => boolean; factor: number }[] = [
  { test: (cp) => cp === 0x20, factor: 0.27 },              // space
  { test: (cp) => cp === 0x69 || cp === 0x6c || cp === 0x74 || cp === 0x66, factor: 0.27 }, // i, l, t, f
  { test: (cp) => cp === 0x6d || cp === 0x77 || cp === 0x4d || cp === 0x57, factor: 0.85 }, // m, w, M, W
  { test: (cp) => cp >= 0x30 && cp <= 0x39, factor: 0.55 }, // digits
  { test: (cp) => cp >= 0x21 && cp <= 0x2f, factor: 0.4 },  // punctuation
  { test: (cp) => cp >= 0x3a && cp <= 0x40, factor: 0.4 },  // more punctuation
  { test: (cp) => cp >= 0x5b && cp <= 0x60, factor: 0.4 },  // brackets
  { test: (cp) => cp >= 0x7b && cp <= 0x7e, factor: 0.4 },  // more brackets
  { test: (cp) => cp >= 0x1f600, factor: 1.2 },             // emoji-ish
  { test: (cp) => cp >= 0x4e00 && cp <= 0x9fff, factor: 1.0 }, // CJK
  { test: (cp) => cp >= 0x3040 && cp <= 0x30ff, factor: 1.0 }, // Japanese kana
  { test: (cp) => cp >= 0x41 && cp <= 0x5a, factor: 0.65 }, // uppercase (after specific M/W)
  { test: (cp) => cp >= 0x61 && cp <= 0x7a, factor: 0.5 },  // lowercase (after specific i/l/t/f/m/w)
  { test: () => true, factor: 0.6 },                        // fallback
];

/** Font-family correction multipliers. */
export const FONT_MULTIPLIER: Record<FontFamily, number> = {
  arial: 1.0, helvetica: 1.0, "system-ui": 1.0,
  times: 0.95, georgia: 1.0,
  verdana: 1.15, // wider
  courier: 1.0,  // monospace — overridden in glyphFactorFor
};

export const FONT_LABELS: Record<FontFamily, string> = {
  arial: "Arial", helvetica: "Helvetica", times: "Times New Roman",
  georgia: "Georgia", verdana: "Verdana", courier: "Courier (monospace)",
  "system-ui": "System UI",
};

export const PRESETS: { label: string; font: FontFamily; fontSize: number; fontWeight: number }[] = [
  { label: "Body 16px", font: "system-ui", fontSize: 16, fontWeight: 400 },
  { label: "Caption 12px", font: "system-ui", fontSize: 12, fontWeight: 400 },
  { label: "Heading 24px bold", font: "arial", fontSize: 24, fontWeight: 700 },
  { label: "Code 14px mono", font: "courier", fontSize: 14, fontWeight: 400 },
  { label: "Title 32px bold", font: "helvetica", fontSize: 32, fontWeight: 700 },
  { label: "Small 10px", font: "verdana", fontSize: 10, fontWeight: 400 },
];

/** Return the glyph advance factor for a code point + font family. */
export function glyphFactorFor(cp: number, font: FontFamily): number {
  if (font === "courier") return 0.6; // monospace: every glyph same width
  const base = AVG_FACTORS.find((f) => f.test(cp))?.factor ?? 0.6;
  return base * (FONT_MULTIPLIER[font] ?? 1);
}

/** Estimate text pixel width without a canvas. */
export function estimateWidth(text: string, options: MeasureOptions): number {
  let width = 0;
  const chars = Array.from(text);
  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    width += glyphFactorFor(cp, options.font) * options.fontSize;
  }
  if (options.letterSpacing) width += options.letterSpacing * Math.max(0, chars.length - 1);
  if (options.fontWeight && options.fontWeight >= 700) width *= 1.05;
  if (options.italic) width *= 1.02;
  return Math.round(width);
}

export function process(input: string, options: MeasureOptions): MeasureResult {
  const warnings: string[] = [];
  const charCount = Array.from(input).length;
  if (charCount === 0) warnings.push("Input is empty — width is 0.");
  const width = estimateWidth(input, options);
  return {
    width,
    widthPerChar: charCount > 0 ? Math.round((width / charCount) * 100) / 100 : 0,
    charCount,
    warnings,
  };
}

/** Per-char breakdown table. */
export function charWidthTable(text: string, options: MeasureOptions): CharWidthEntry[] {
  return Array.from(text).map((ch) => {
    const cp = ch.codePointAt(0)!;
    const factor = glyphFactorFor(cp, options.font);
    let widthPx = factor * options.fontSize;
    if (options.fontWeight && options.fontWeight >= 700) widthPx *= 1.05;
    if (options.italic) widthPx *= 1.02;
    return { char: ch, codePoint: cp, factor, widthPx: Math.round(widthPx * 100) / 100 };
  });
}

/** Per-line measurement. */
export function measurePerLine(input: string, options: MeasureOptions): MeasureResult[] {
  return input.split("\n").map((line) => process(line, options));
}

/** Convert per-line rows to CSV. */
export function toCsv(rows: MeasureResult[], lines: string[]): string {
  const out = ["Line,CharCount,WidthPx,WidthPerChar"];
  rows.forEach((r, i) => {
    out.push(`"${(lines[i] ?? "").replace(/"/g, '""')}",${r.charCount},${r.width},${r.widthPerChar.toFixed(2)}`);
  });
  return out.join("\n");
}

/** Batch: measure multiple strings (array form). */
export function measureBatch(inputs: string[], options: MeasureOptions): MeasureResult[] {
  return inputs.map((s) => process(s, options));
}

/** Largest font size that fits text within maxWidthPx. */
export function autoFitFontSize(text: string, font: FontFamily, maxWidthPx: number, maxSize = 200): number {
  if (!text) return maxSize;
  for (let s = maxSize; s >= 6; s--) {
    const w = estimateWidth(text, { font, fontSize: s });
    if (w <= maxWidthPx) return s;
  }
  return 6;
}

/** Truncate text to fit within maxWidthPx, adding ellipsis if cut. */
export function truncateToWidth(text: string, options: MeasureOptions, maxWidthPx: number): string {
  if (estimateWidth(text, options) <= maxWidthPx) return text;
  const ellipsis = "…";
  const ellipsisWidth = estimateWidth(ellipsis, options);
  const target = maxWidthPx - ellipsisWidth;
  let result = "";
  for (const ch of Array.from(text)) {
    const candidate = result + ch;
    if (estimateWidth(candidate, options) > target) break;
    result = candidate;
  }
  return result + ellipsis;
}

/** Word-wrap text to fit within maxWidthPx. */
export function wrapToWidth(text: string, options: MeasureOptions, maxWidthPx: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? current + " " + w : w;
    if (estimateWidth(candidate, options) <= maxWidthPx) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Compute line height (typography: 1.2× font size by default). */
export function lineHeight(options: MeasureOptions, factor = 1.2): number {
  return Math.round(options.fontSize * factor);
}

/** Total box height for N lines of text. */
export function boxHeight(lineCount: number, options: MeasureOptions, factor = 1.2): number {
  return lineCount * lineHeight(options, factor);
}

export function validateOptions(opts: MeasureOptions): { ok: true } | { error: string } {
  if (!FONT_MULTIPLIER[opts.font]) return { error: "Invalid font family" };
  if (opts.fontSize < 4 || opts.fontSize > 400) return { error: "Font size must be 4–400 px" };
  if (opts.fontWeight && ![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(opts.fontWeight)) {
    return { error: "Font weight must be 100–900 (multiples of 100)" };
  }
  return { ok: true };
}

/** List of all font families. */
export const ALL_FONTS = Object.keys(FONT_MULTIPLIER) as FontFamily[];
