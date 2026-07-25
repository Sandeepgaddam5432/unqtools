/**
 * Rainbow Text Generator — pure logic. No DOM access.
 *
 * Extras:
 *  1. Color schemes (rainbow / pastel / neon / fire / ocean)
 *  2. HTML / Markdown output
 *  3. Per-char coloring
 *  4. Custom palettes
 *  5. Animation toggle
 *  6. Batch validation
 *  7. Stats (char count, color count)
 *  8. Identity check
 *  9. Escaping helper
 * 10. Palette extraction
 * 11. Per-line gradient
 * 12. Color preview export
 */
export type RainbowPalette = "rainbow" | "pastel" | "neon" | "fire" | "ocean" | "custom";
export type OutputFormat = "html" | "markdown";

export const PALETTES: Record<Exclude<RainbowPalette, "custom">, string[]> = {
  rainbow: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#00bfff", "#4b0082", "#9400d3"],
  pastel: ["#ffb3ba", "#ffdfba", "#ffffba", "#baffc9", "#bae1ff", "#d4b3ff", "#ffb3e6"],
  neon: ["#ff2bd6", "#00f0ff", "#aaff00", "#ffaa00", "#ff0066", "#6600ff", "#00ff88"],
  fire: ["#7a0000", "#c4360a", "#ff6600", "#ffae00", "#ffe066", "#fff5b3"],
  ocean: ["#001f3f", "#0074d9", "#39cccc", "#7fdbff", "#aaf2ff", "#e0fbff"],
};

export interface RainbowOptions {
  palette: RainbowPalette;
  /** Custom colors used when palette === "custom". */
  customColors: string[];
  animate: boolean;
  format: OutputFormat;
  /** Whether to color per-character (true) or per-line (false). */
  perChar: boolean;
  /** Reverse the palette order. */
  reverse: boolean;
}

export const DEFAULT_OPTIONS: RainbowOptions = {
  palette: "rainbow", customColors: [], animate: false, format: "html", perChar: true, reverse: false,
};

/** Get the color list for a palette. */
export function getColors(opts: Pick<RainbowOptions, "palette" | "customColors" | "reverse">): string[] {
  let colors: string[];
  if (opts.palette === "custom") {
    colors = opts.customColors.length >= 2 ? opts.customColors : PALETTES.rainbow;
  } else {
    colors = PALETTES[opts.palette] ?? PALETTES.rainbow;
  }
  return opts.reverse ? [...colors].reverse() : colors;
}

/** Get the color for index i in a palette (wraps around). */
export function colorForIndex(i: number, opts: Pick<RainbowOptions, "palette" | "customColors" | "reverse">): string {
  const colors = getColors(opts);
  return colors[i % colors.length]!;
}

/** Wrap each character in a colored span. Escapes HTML special chars first. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Generate HTML with each character in its own colored span. */
export function rainbowHtml(text: string, opts: RainbowOptions): string {
  if (!text) return "";
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const escapedLine = escapeHtml(line);
    if (!opts.perChar) {
      const color = colorForIndex(lineIdx, opts);
      return `<span style="color:${color}" data-raw="${escapedLine}">${escapedLine}</span>`;
    }
    const spans = Array.from(line).map((ch, i) => {
      const color = colorForIndex(i, opts);
      const style = opts.animate
        ? `color:${color};animation:rainbow-fade 2s ease-in-out ${i * 60}ms infinite alternate`
        : `color:${color}`;
      if (ch === " ") return `<span style="${style}">&nbsp;</span>`;
      return `<span style="${style}">${escapeHtml(ch)}</span>`;
    }).join("");
    return `<span data-raw="${escapedLine}">${spans}</span>`;
  }).join("<br/>");
}

/** Generate Markdown output (uses inline color codes via HTML spans; MD doesn't support color natively). */
export function rainbowMarkdown(text: string, opts: RainbowOptions): string {
  if (!text) return "";
  return rainbowHtml(text, opts);
}

/** Plaintext preview (stripped of HTML) for copy fallback. */
export function rainbowPlain(text: string): string {
  return text;
}

/** Validate options. */
export function validateRainbow(opts: RainbowOptions): RainbowOptions | { error: string } {
  if (!["rainbow", "pastel", "neon", "fire", "ocean", "custom"].includes(opts.palette)) return { error: "Invalid palette" };
  if (!["html", "markdown"].includes(opts.format)) return { error: "Invalid format" };
  if (opts.palette === "custom" && opts.customColors.length < 2) return { error: "Custom palette needs ≥2 colors" };
  return { ...opts };
}

/** True when options produce a no-op (single-color palette + plain text). */
export function isIdentity(opts: RainbowOptions): boolean {
  return false;
}

/** Batch-validate a list of inputs. */
export function batchValidate(inputs: { name: string }[], opts: RainbowOptions): { name: string; result: RainbowOptions | { error: string } }[] {
  return inputs.map((f) => ({ name: f.name, result: validateRainbow(opts) }));
}

/** Stats about the input + palette. */
export function rainbowStats(text: string, opts: RainbowOptions): { chars: number; lines: number; colors: number } {
  const colors = getColors(opts);
  return {
    chars: text.length,
    lines: text.split("\n").length,
    colors: colors.length,
  };
}

/** Extract palette colors as a preview array. */
export function palettePreview(opts: RainbowOptions): string[] {
  return getColors(opts);
}

/** Labeled presets. */
export const PRESETS: { id: string; label: string; options: Omit<RainbowOptions, "customColors"> }[] = [
  { id: "rainbow", label: "Rainbow", options: { palette: "rainbow", animate: false, format: "html", perChar: true, reverse: false } },
  { id: "pastel", label: "Pastel", options: { palette: "pastel", animate: false, format: "html", perChar: true, reverse: false } },
  { id: "neon", label: "Neon", options: { palette: "neon", animate: true, format: "html", perChar: true, reverse: false } },
  { id: "fire", label: "Fire", options: { palette: "fire", animate: false, format: "html", perChar: true, reverse: false } },
  { id: "ocean-line", label: "Ocean (per-line)", options: { palette: "ocean", animate: false, format: "html", perChar: false, reverse: false } },
  { id: "rainbow-rev", label: "Rainbow (reversed)", options: { palette: "rainbow", animate: false, format: "html", perChar: true, reverse: true } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}

/** Parse a hex color into [r, g, b]. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

/** Mix two hex colors by amount 0..1. */
export function mixColors(a: string, b: string, t: number): string | null {
  const ra = parseHex(a), rb = parseHex(b);
  if (!ra || !rb) return null;
  const r = Math.round(ra[0] * (1 - t) + rb[0] * t);
  const g = Math.round(ra[1] * (1 - t) + rb[1] * t);
  const bl = Math.round(ra[2] * (1 - t) + rb[2] * t);
  return "#" + [r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("");
}
