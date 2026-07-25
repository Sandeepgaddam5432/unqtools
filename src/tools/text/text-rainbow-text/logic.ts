/**
 * Rainbow Text Generator — pure logic. No DOM access.
 *
 * Assigns a color from a palette to each character of the input and emits
 * HTML spans (with optional animation). Pure string functions.
 */
export type RainbowPalette = "rainbow" | "pastel" | "neon" | "fire" | "ocean";

export const PALETTES: Record<RainbowPalette, string[]> = {
  rainbow: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#00bfff", "#4b0082", "#9400d3"],
  pastel: ["#ffb3ba", "#ffdfba", "#ffffba", "#baffc9", "#bae1ff", "#d4b3ff", "#ffb3e6"],
  neon: ["#ff2bd6", "#00f0ff", "#aaff00", "#ffaa00", "#ff0066", "#6600ff", "#00ff88"],
  fire: ["#7a0000", "#c4360a", "#ff6600", "#ffae00", "#ffe066", "#fff5b3"],
  ocean: ["#001f3f", "#0074d9", "#39cccc", "#7fdbff", "#aaf2ff", "#e0fbff"],
};

/** Get the color for index i in a palette (wraps around). */
export function colorForIndex(i: number, palette: RainbowPalette): string {
  const colors = PALETTES[palette] ?? PALETTES.rainbow;
  return colors[i % colors.length]!;
}

/** Wrap each character in a colored span. Escapes HTML special chars first. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Generate HTML with each character in its own colored span. */
export function rainbowHtml(text: string, palette: RainbowPalette, animate: boolean): string {
  if (!text) return "";
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const escapedLine = escapeHtml(line);
      const spans = Array.from(line)
        .map((ch, i) => {
          const color = colorForIndex(i, palette);
          const escaped = escapeHtml(ch);
          const style = animate
            ? `color:${color};animation:rainbow-fade 2s ease-in-out ${i * 60}ms infinite alternate`
            : `color:${color}`;
          if (ch === " ") return `<span style="${style}">&nbsp;</span>`;
          return `<span style="${style}">${escaped}</span>`;
        })
        .join("");
      return `<span data-raw="${escapedLine}">${spans}</span>`;
    })
    .join("<br/>");
}

/** Plaintext preview (stripped of HTML) for copy fallback. */
export function rainbowPlain(text: string): string {
  return text;
}
