/** Text Width Measurer — pure logic. */

export interface MeasureOptions {
  font: string;
  fontSize: number;
  fontWeight?: number;
  italic?: boolean;
}

export interface MeasureResult {
  width: number;
  widthPerChar: number;
  charCount: number;
  warnings: string[];
}

/**
 * Estimate text pixel width without a canvas.
 * Uses average glyph advance factors per Unicode block.
 * NOTE: UI may override this with a real canvas measurement.
 */
const AVG_FACTORS: { test: (cp: number) => boolean; factor: number }[] = [
  { test: (cp) => cp >= 0x30 && cp <= 0x39, factor: 0.55 }, // digits
  { test: (cp) => cp >= 0x41 && cp <= 0x5a, factor: 0.65 }, // uppercase
  { test: (cp) => cp >= 0x61 && cp <= 0x7a, factor: 0.5 },  // lowercase
  { test: (cp) => cp === 0x20, factor: 0.27 },              // space
  { test: (cp) => cp === 0x69 || cp === 0x6c || cp === 0x74, factor: 0.27 }, // i, l, t
  { test: (cp) => cp === 0x6d || cp === 0x77, factor: 0.85 }, // m, w
  { test: (cp) => cp >= 0x21 && cp <= 0x2f, factor: 0.4 },  // punctuation
  { test: (cp) => cp >= 0x1f600, factor: 1.2 },             // emoji-ish
  { test: () => true, factor: 0.6 },                        // fallback
];

export function estimateWidth(text: string, options: MeasureOptions): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const factor = AVG_FACTORS.find((f) => f.test(cp))?.factor ?? 0.6;
    width += factor * options.fontSize;
  }
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
    widthPerChar: charCount > 0 ? width / charCount : 0,
    charCount,
    warnings,
  };
}

export function measurePerLine(input: string, options: MeasureOptions): MeasureResult[] {
  return input.split("\n").map((line) => process(line, options));
}

export function toCsv(rows: MeasureResult[], lines: string[]): string {
  const out = ["Line,CharCount,WidthPx,WidthPerChar"];
  rows.forEach((r, i) => {
    out.push(`"${(lines[i] ?? "").replace(/"/g, '""')}",${r.charCount},${r.width},${r.widthPerChar.toFixed(2)}`);
  });
  return out.join("\n");
}
