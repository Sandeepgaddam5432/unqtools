/**
 * Image Text Caption — pure logic.
 * Computes caption position (9-grid), font metrics, text wrapping,
 * outline/shadow effects, and background box dimensions.
 */

export type CaptionPosition = "top-left" | "top-center" | "top-right" | "middle-left" | "middle-center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right";

export interface CaptionOptions {
  text: string;
  position: CaptionPosition;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  color: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  padding?: number;
  margin?: number;
  maxWidth?: number; // for wrapping
  align: "left" | "center" | "right";
  lineHeight?: number; // multiplier
}

/** Compute the (x, y) anchor point for a caption position on a WxH canvas. */
export function computeAnchor(
  position: CaptionPosition,
  canvasWidth: number,
  canvasHeight: number,
  margin = 20,
): { x: number; y: number } {
  const xMap: Record<string, number> = {
    left: margin,
    center: canvasWidth / 2,
    right: canvasWidth - margin,
  };
  const yMap: Record<string, number> = {
    top: margin,
    middle: canvasHeight / 2,
    bottom: canvasHeight - margin,
  };
  const [v, h] = position.split("-");
  return { x: xMap[h], y: yMap[v] };
}

/** Estimate text width for a given font (rough heuristic). */
export function estimateTextWidth(text: string, fontSize: number, fontWeight: string = "normal"): number {
  const factor = fontWeight === "bold" ? 0.62 : 0.55;
  return text.length * fontSize * factor;
}

/** Wrap text to fit within maxWidth. Returns lines. */
export function wrapText(text: string, maxWidth: number, fontSize: number, fontWeight = "normal"): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (estimateTextWidth(test, fontSize, fontWeight) <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Compute the bounding box of the rendered text (with padding). */
export function computeTextBox(
  lines: string[],
  fontSize: number,
  padding = 8,
  lineHeight = 1.2,
  fontWeight = "normal",
): { width: number; height: number } {
  let maxW = 0;
  for (const line of lines) {
    const w = estimateTextWidth(line, fontSize, fontWeight);
    if (w > maxW) maxW = w;
  }
  const height = lines.length * fontSize * lineHeight;
  return { width: maxW + padding * 2, height: height + padding * 2 };
}

/** Compute the render position (top-left of text box) for a given anchor. */
export function computeRenderPosition(
  anchor: { x: number; y: number },
  position: CaptionPosition,
  box: { width: number; height: number },
): { x: number; y: number } {
  const [v, h] = position.split("-");
  let x = anchor.x;
  let y = anchor.y;
  if (h === "center") x -= box.width / 2;
  else if (h === "right") x -= box.width;
  if (v === "middle") y -= box.height / 2;
  else if (v === "bottom") y -= box.height;
  return { x, y };
}

/** Parse a hex color (#RRGGBB or #RGB) into RGB components. */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  let s = hex.replace(/^#/, "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (s.length !== 6) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** Convert hex + alpha to rgba string. */
export function hexToRgba(hex: string, alpha = 1): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Compute contrast color (black or white) for a given background. */
export function contrastColor(bgHex: string): string {
  const rgb = parseHexColor(bgHex);
  if (!rgb) return "#000000";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

/** Caption presets. */
export const CAPTION_PRESETS: { name: string; options: Partial<CaptionOptions> }[] = [
  { name: "Title (bottom center, white)", options: { position: "bottom-center", color: "#ffffff", fontSize: 36, fontWeight: "bold", align: "center", outlineColor: "#000000", outlineWidth: 3 } },
  { name: "Watermark (bottom right)", options: { position: "bottom-right", color: "rgba(255,255,255,0.7)", fontSize: 14, align: "right" } },
  { name: "Meme (top + bottom)", options: { position: "top-center", color: "#ffffff", fontSize: 48, fontWeight: "bold", fontFamily: "Impact", outlineColor: "#000000", outlineWidth: 4 } },
  { name: "News banner (bottom-left, bg)", options: { position: "bottom-left", color: "#ffffff", backgroundColor: "#cc0000", fontSize: 18, fontWeight: "bold", padding: 8, align: "left" } },
  { name: "Subtitle (bottom-center, box)", options: { position: "bottom-center", color: "#ffffff", backgroundColor: "#000000", backgroundOpacity: 0.7, fontSize: 22, padding: 6, align: "center" } },
  { name: "Quote (middle-center, italic)", options: { position: "middle-center", color: "#ffffff", fontStyle: "italic", fontSize: 28, align: "center", outlineColor: "#000000", outlineWidth: 2 } },
  { name: "Tag (top-left, small)", options: { position: "top-left", color: "#ffffff", backgroundColor: "#3b82f6", fontSize: 12, padding: 4, align: "left" } },
  { name: "Signature (bottom-right, italic)", options: { position: "bottom-right", color: "rgba(255,255,255,0.8)", fontStyle: "italic", fontSize: 16, align: "right" } },
  { name: "Bold header (top-center, shadow)", options: { position: "top-center", color: "#ffffff", fontSize: 40, fontWeight: "bold", shadowColor: "rgba(0,0,0,0.8)", shadowBlur: 8, align: "center" } },
  { name: "Caption (top-left, outline)", options: { position: "top-left", color: "#ffffff", fontSize: 18, outlineColor: "#000000", outlineWidth: 2, align: "left" } },
];

/** Compute all render parameters for a caption. */
export function computeCaptionLayout(
  canvasWidth: number,
  canvasHeight: number,
  opts: CaptionOptions,
): {
  anchor: { x: number; y: number };
  lines: string[];
  box: { width: number; height: number };
  renderPos: { x: number; y: number };
  lineHeight: number;
} {
  const margin = opts.margin ?? 20;
  const anchor = computeAnchor(opts.position, canvasWidth, canvasHeight, margin);
  const maxW = opts.maxWidth ?? canvasWidth - margin * 2;
  const lines = wrapText(opts.text, maxW, opts.fontSize, opts.fontWeight);
  const box = computeTextBox(lines, opts.fontSize, opts.padding ?? 8, opts.lineHeight ?? 1.2, opts.fontWeight);
  const renderPos = computeRenderPosition(anchor, opts.position, box);
  return { anchor, lines, box, renderPos, lineHeight: opts.lineHeight ?? 1.2 };
}

/** Validate caption options. */
export function validateOptions(opts: CaptionOptions): string[] {
  const errs: string[] = [];
  if (!opts.text) errs.push("Text is required");
  if (opts.fontSize <= 0) errs.push("Font size must be > 0");
  if (opts.outlineWidth && opts.outlineWidth < 0) errs.push("Outline width cannot be negative");
  if (opts.padding && opts.padding < 0) errs.push("Padding cannot be negative");
  if (!parseHexColor(opts.color) && !opts.color.startsWith("rgba")) errs.push("Invalid color");
  return errs;
}

/** Compute the total height needed for a multi-line caption. */
export function totalTextHeight(lines: string[], fontSize: number, lineHeight = 1.2): number {
  return lines.length * fontSize * lineHeight;
}

/** Estimate the byte size of a caption (for memory planning). */
export function estimateBytes(lines: string[], fontSize: number): number {
  return lines.reduce((sum, l) => sum + l.length, 0) * fontSize * 4;
}

/** Get a human-readable description of a caption position. */
export function positionDescription(pos: CaptionPosition): string {
  const [v, h] = pos.split("-");
  const vDesc = v === "top" ? "top" : v === "middle" ? "center (vertical)" : "bottom";
  const hDesc = h === "left" ? "left" : h === "center" ? "center (horizontal)" : "right";
  return `${vDesc} ${hDesc}`;
}

/** Auto-size font to fit text within a given width. */
export function autoFitFontSize(text: string, maxWidth: number, baseFontSize = 32, minFontSize = 10): number {
  let fs = baseFontSize;
  while (fs > minFontSize && estimateTextWidth(text, fs) > maxWidth) {
    fs -= 1;
  }
  return fs;
}

/** Serialize caption options to JSON. */
export function serialize(opts: CaptionOptions): string {
  return JSON.stringify(opts, null, 2);
}

/** Parse JSON back to caption options. */
export function deserialize(json: string): CaptionOptions {
  return JSON.parse(json);
}

/** Compute the shadow offset for a 3D effect. */
export function shadowOffset3D(depth = 3): { x: number; y: number } {
  return { x: depth, y: depth };
}

/** Generate a CSS text-shadow string from options. */
export function toCssTextShadow(opts: CaptionOptions): string {
  const parts: string[] = [];
  if (opts.outlineWidth && opts.outlineColor) {
    // Simulate outline with 8 shadows
    const o = opts.outlineWidth;
    parts.push(`-${o}px 0 0 ${opts.outlineColor}`, `${o}px 0 0 ${opts.outlineColor}`, `0 -${o}px 0 ${opts.outlineColor}`, `0 ${o}px 0 ${opts.outlineColor}`);
  }
  if (opts.shadowBlur && opts.shadowColor) {
    parts.push(`2px 2px ${opts.shadowBlur}px ${opts.shadowColor}`);
  }
  return parts.join(", ") || "none";
}
