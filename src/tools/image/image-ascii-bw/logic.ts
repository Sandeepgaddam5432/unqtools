/**
 * Image ASCII (B&W) — pure logic. No DOM / canvas access.
 *
 * Extras:
 *  1. Character ramp presets + custom ramp
 *  2. Brightness / contrast / gamma pre-adjustments
 *  3. Dithering (none, Floyd-Steinberg, Atkinson)
 *  4. Width control + aspect-corrected height
 *  5. Invert mode
 *  6. Color mode (B&W or HTML-colored output)
 *  7. Export formats: TXT / HTML / SVG
 *  8. Batch validation
 *  9. Stats + identity detection
 * 10. Luma + brightness helpers
 * 11. Ramp preset finder
 */
export interface AsciiOptions {
  width: number;
  ramp: string;
  brightness: number;
  contrast: number;
  gamma: number;
  invert: boolean;
  dither: "none" | "floyd-steinberg" | "atkinson";
  color: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Default 10-character ramp from dark to light. */
export const DEFAULT_RAMP = " .:-=+*#%@";

/** Character ramp presets. */
export const RAMP_PRESETS: { id: string; label: string; ramp: string }[] = [
  { id: "standard", label: "Standard (10)", ramp: " .:-=+*#%@" },
  { id: "blocks", label: "Blocks (10)", ramp: " ░▒▓█▓▒░ " },
  { id: "minimal", label: "Minimal (4)", ramp: " .o#" },
  { id: "binary", label: "Binary (2)", ramp: " 1" },
  { id: "shading", label: "Shading (16)", ramp: " .'`,:;!-?/|()1[]{}rx1z?+=*#" },
  { id: "extended", label: "Extended (70)", ramp: " .'`,^:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
];

export const DEFAULT_OPTIONS: AsciiOptions = {
  width: 80, ramp: DEFAULT_RAMP, brightness: 0, contrast: 1,
  gamma: 1, invert: false, dither: "none", color: false,
};

/** Escape HTML special chars. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Validate options. */
export function validateAscii(opts: AsciiOptions): AsciiOptions | { error: string } {
  if (!Number.isFinite(opts.width) || opts.width < 1 || opts.width > 400) return { error: "Width must be 1..400" };
  if (!opts.ramp || opts.ramp.length < 2) return { error: "Ramp must be at least 2 characters" };
  if (opts.brightness < -100 || opts.brightness > 100) return { error: "Brightness must be -100..100" };
  if (opts.contrast < 0 || opts.contrast > 3) return { error: "Contrast must be 0..3" };
  if (opts.gamma < 0.1 || opts.gamma > 3) return { error: "Gamma must be 0.1..3" };
  if (!["none", "floyd-steinberg", "atkinson"].includes(opts.dither)) return { error: "Unknown dither" };
  return { ...opts, width: Math.round(opts.width) };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Apply brightness, contrast, gamma, invert to a luminance value. */
export function adjustLuma(y: number, opts: Pick<AsciiOptions, "brightness" | "contrast" | "gamma" | "invert">): number {
  let v = y;
  v += opts.brightness * 2.55;
  v = (v - 128) * opts.contrast + 128;
  v = 255 * Math.pow(clamp(v, 0, 255) / 255, 1 / opts.gamma);
  v = clamp(v, 0, 255);
  return opts.invert ? 255 - v : v;
}

/** Map a luminance (0..255) to a character from the ramp. */
export function lumaToChar(y: number, ramp: string): string {
  const idx = Math.floor((clamp(y, 0, 255) / 255) * (ramp.length - 1) + 0.5);
  return ramp[clamp(idx, 0, ramp.length - 1)]!;
}

/** Map a luminance (0..255) to a hex grayscale color. */
export function lumaToColor(y: number): string {
  const v = Math.round(clamp(y, 0, 255)).toString(16).padStart(2, "0");
  return `#${v}${v}${v}`;
}

/** Compute output height (in chars) given aspect ratio. */
export function computeHeight(widthChars: number, imgW: number, imgH: number): number {
  if (imgW <= 0 || imgH <= 0) return 0;
  return Math.max(1, Math.round(widthChars * (imgH / imgW) * 0.5));
}

/** Find a ramp preset by id. */
export function findRampPreset(id: string): { id: string; label: string; ramp: string } | undefined {
  return RAMP_PRESETS.find((p) => p.id === id);
}

/** True when options produce a no-op (no adjustments active). */
export function isIdentity(opts: AsciiOptions): boolean {
  return opts.brightness === 0 && opts.contrast === 1 && opts.gamma === 1 && !opts.invert && opts.dither === "none";
}

/** Sample an image (flat RGBA) at character (ox, oy) → returns [r,g,b]. */
export function samplePixel(
  pixels: Uint8ClampedArray | number[],
  imgW: number, imgH: number, outW: number, outH: number, ox: number, oy: number,
): [number, number, number] {
  const sx = Math.floor((ox / outW) * imgW);
  const sy = Math.floor((oy / outH) * imgH);
  const i = (sy * imgW + sx) * 4;
  return [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
}

/** Build a 2-D luminance grid from RGBA pixels, with optional dithering. */
export function buildLumaGrid(
  pixels: Uint8ClampedArray | number[],
  imgW: number, imgH: number, outW: number, outH: number, opts: AsciiOptions,
): number[][] {
  const grid: number[][] = [];
  for (let oy = 0; oy < outH; oy++) {
    const row: number[] = [];
    for (let ox = 0; ox < outW; ox++) {
      const [r, g, b] = samplePixel(pixels, imgW, imgH, outW, outH, ox, oy);
      row.push(adjustLuma(luma(r, g, b), opts));
    }
    grid.push(row);
  }
  if (opts.dither === "floyd-steinberg") {
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      const old = grid[y]![x]!;
      const nw = Math.round(old / 255) * 255;
      grid[y]![x] = nw;
      const err = old - nw;
      if (x + 1 < outW) grid[y]![x + 1]! += err * 7 / 16;
      if (y + 1 < outH) {
        if (x > 0) grid[y + 1]![x - 1]! += err * 3 / 16;
        grid[y + 1]![x]! += err * 5 / 16;
        if (x + 1 < outW) grid[y + 1]![x + 1]! += err * 1 / 16;
      }
    }
  } else if (opts.dither === "atkinson") {
    const push = (x: number, y: number, e: number) => {
      if (x >= 0 && x < outW && y >= 0 && y < outH) grid[y]![x]! += e;
    };
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      const old = grid[y]![x]!;
      const nw = Math.round(old / 255) * 255;
      grid[y]![x] = nw;
      const err = (old - nw) / 8;
      push(x + 1, y, err); push(x + 2, y, err);
      push(x - 1, y + 1, err); push(x, y + 1, err); push(x + 1, y + 1, err);
      push(x, y + 2, err);
    }
  }
  return grid;
}

/** Convert a flat RGBA pixel array to ASCII text. */
export function toAscii(pixels: Uint8ClampedArray | number[], imgW: number, imgH: number, opts: AsciiOptions): string {
  const v = validateAscii(opts);
  if ("error" in v) throw new Error(v.error);
  const outW = v.width, outH = computeHeight(outW, imgW, imgH);
  const grid = buildLumaGrid(pixels, imgW, imgH, outW, outH, v);
  const lines: string[] = [];
  for (let oy = 0; oy < outH; oy++) {
    let line = "";
    for (let ox = 0; ox < outW; ox++) line += lumaToChar(grid[oy]![ox]!, v.ramp);
    lines.push(line);
  }
  return lines.join("\n");
}

/** Convert RGBA → HTML colored output (one colored span per char). */
export function toHtml(pixels: Uint8ClampedArray | number[], imgW: number, imgH: number, opts: AsciiOptions): string {
  const v = validateAscii(opts);
  if ("error" in v) throw new Error(v.error);
  const outW = v.width, outH = computeHeight(outW, imgW, imgH);
  const grid = buildLumaGrid(pixels, imgW, imgH, outW, outH, v);
  const lines: string[] = [];
  for (let oy = 0; oy < outH; oy++) {
    let line = "";
    for (let ox = 0; ox < outW; ox++) {
      const y = grid[oy]![ox]!;
      const ch = lumaToChar(y, v.ramp);
      const col = v.color ? lumaToColor(y) : "#000";
      const display = ch === " " ? "&nbsp;" : escapeHtml(ch);
      line += `<span style="color:${col}">${display}</span>`;
    }
    lines.push(line);
  }
  return `<pre style="font-family:monospace;line-height:1;background:#fff;margin:0">${lines.join("<br/>")}</pre>`;
}

/** Convert RGBA → SVG document (each char as <text>). */
export function toSvg(pixels: Uint8ClampedArray | number[], imgW: number, imgH: number, opts: AsciiOptions): string {
  const v = validateAscii(opts);
  if ("error" in v) throw new Error(v.error);
  const outW = v.width, outH = computeHeight(outW, imgW, imgH);
  const grid = buildLumaGrid(pixels, imgW, imgH, outW, outH, v);
  const cellW = 8, cellH = 12, W = outW * cellW, H = outH * cellH;
  const body: string[] = [];
  for (let oy = 0; oy < outH; oy++) for (let ox = 0; ox < outW; ox++) {
    const y = grid[oy]![ox]!;
    const ch = lumaToChar(y, v.ramp);
    if (ch === " ") continue;
    const col = v.color ? lumaToColor(y) : "#000";
    body.push(`<text x="${ox * cellW}" y="${(oy + 1) * cellH - 2}" fill="${col}" font-family="monospace" font-size="12">${escapeHtml(ch)}</text>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body.join("")}</svg>`;
}

/** Stats about the generated ASCII output. */
export function asciiStats(text: string): { lines: number; chars: number; width: number; height: number } {
  const lines = text.split("\n");
  return { lines: lines.length, chars: text.length, width: lines[0]?.length ?? 0, height: lines.length };
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: AsciiOptions): { name: string; result: AsciiOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateAscii(opts) }));
}

/** Detect format by extension. */
export function formatForFilename(name: string): "txt" | "html" | "svg" {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "svg") return "svg";
  return "txt";
}
