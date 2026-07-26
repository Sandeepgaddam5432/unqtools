/**
 * Image Meme Generator — pure logic.
 * Computes top/bottom text positions, font sizing, outline widths, and template
 * dimensions for classic impact-style memes. No canvas/DOM access.
 */

export type MemeTemplate = "drake" | "distracted-boyfriend" | "two-buttons" | "change-my-mind" | "expanding-brain" | "custom";

export interface MemeTemplateInfo {
  id: MemeTemplate;
  name: string;
  width: number;
  height: number;
  slots: { x: number; y: number; width: number; height: number; label: string }[];
}

/** Built-in meme template metadata (no actual images, just slots). */
export const TEMPLATES: Record<MemeTemplate, MemeTemplateInfo> = {
  drake: {
    id: "drake",
    name: "Drake Hotline Bling",
    width: 600,
    height: 600,
    slots: [
      { x: 300, y: 0, width: 300, height: 300, label: "Dislike" },
      { x: 300, y: 300, width: 300, height: 300, label: "Like" },
    ],
  },
  "distracted-boyfriend": {
    id: "distracted-boyfriend",
    name: "Distracted Boyfriend",
    width: 800,
    height: 600,
    slots: [
      { x: 0, y: 200, width: 250, height: 200, label: "Current" },
      { x: 300, y: 150, width: 200, height: 250, label: "New" },
      { x: 550, y: 200, width: 250, height: 200, label: "Boyfriend" },
    ],
  },
  "two-buttons": {
    id: "two-buttons",
    name: "Two Buttons",
    width: 600,
    height: 600,
    slots: [
      { x: 50, y: 100, width: 200, height: 100, label: "Button 1" },
      { x: 350, y: 100, width: 200, height: 100, label: "Button 2" },
    ],
  },
  "change-my-mind": {
    id: "change-my-mind",
    name: "Change My Mind",
    width: 600,
    height: 600,
    slots: [{ x: 100, y: 300, width: 400, height: 100, label: "Statement" }],
  },
  "expanding-brain": {
    id: "expanding-brain",
    name: "Expanding Brain",
    width: 600,
    height: 800,
    slots: [
      { x: 0, y: 0, width: 600, height: 200, label: "Stage 1" },
      { x: 0, y: 200, width: 600, height: 200, label: "Stage 2" },
      { x: 0, y: 400, width: 600, height: 200, label: "Stage 3" },
      { x: 0, y: 600, width: 600, height: 200, label: "Stage 4" },
    ],
  },
  custom: {
    id: "custom",
    name: "Custom",
    width: 600,
    height: 600,
    slots: [],
  },
};

export interface MemeOptions {
  topText: string;
  bottomText: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  uppercase: boolean;
  letterSpacing?: number;
  lineSpacing?: number;
}

/** Compute font size that fits text within a given width. */
export function fitFontSize(text: string, maxWidth: number, baseFontSize: number, minFontSize = 12): number {
  let fs = baseFontSize;
  while (fs > minFontSize && estimateTextWidth(text.toUpperCase(), fs) > maxWidth) {
    fs -= 1;
  }
  return fs;
}

/** Rough text width estimator (Impact font ~0.55 ratio). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

/** Wrap meme text to multiple lines. */
export function wrapMemeText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (estimateTextWidth(test, fontSize) <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Compute the position of top text lines. */
export function topTextPosition(
  lines: string[],
  fontSize: number,
  canvasWidth: number,
  margin = 10,
  lineSpacing = 1.1,
): { x: number; y: number }[] {
  return lines.map((_, i) => ({
    x: canvasWidth / 2,
    y: margin + i * fontSize * lineSpacing,
  }));
}

/** Compute the position of bottom text lines (anchored to bottom). */
export function bottomTextPosition(
  lines: string[],
  fontSize: number,
  canvasWidth: number,
  canvasHeight: number,
  margin = 10,
  lineSpacing = 1.1,
): { x: number; y: number }[] {
  const totalH = lines.length * fontSize * lineSpacing;
  const startY = canvasHeight - margin - totalH;
  return lines.map((_, i) => ({
    x: canvasWidth / 2,
    y: startY + i * fontSize * lineSpacing,
  }));
}

/** Format text per meme conventions (uppercase, trim). */
export function formatMemeText(text: string, uppercase: boolean): string {
  const trimmed = text.trim();
  return uppercase ? trimmed.toUpperCase() : trimmed;
}

/** Default meme options. */
export const DEFAULT_OPTIONS: MemeOptions = {
  topText: "TOP TEXT",
  bottomText: "BOTTOM TEXT",
  fontSize: 48,
  fontFamily: "Impact",
  color: "#ffffff",
  outlineColor: "#000000",
  outlineWidth: 3,
  uppercase: true,
};

/** Validate meme options. */
export function validateOptions(opts: MemeOptions): string[] {
  const errs: string[] = [];
  if (opts.fontSize < 8) errs.push("Font size must be ≥ 8");
  if (opts.outlineWidth < 0) errs.push("Outline width cannot be negative");
  if (opts.letterSpacing && opts.letterSpacing < 0) errs.push("Letter spacing cannot be negative");
  if (!/^#[0-9a-f]{3,8}$/i.test(opts.color)) errs.push("Invalid color (must be hex)");
  if (!/^#[0-9a-f]{3,8}$/i.test(opts.outlineColor)) errs.push("Invalid outline color");
  return errs;
}

/** Compute the full layout for rendering a meme. */
export function computeMemeLayout(
  canvasWidth: number,
  canvasHeight: number,
  opts: MemeOptions,
): {
  topLines: string[];
  bottomLines: string[];
  topPositions: { x: number; y: number }[];
  bottomPositions: { x: number; y: number }[];
  topFontSize: number;
  bottomFontSize: number;
} {
  const topText = formatMemeText(opts.topText, opts.uppercase);
  const bottomText = formatMemeText(opts.bottomText, opts.uppercase);
  const maxWidth = canvasWidth - 20;
  const topFs = fitFontSize(topText, maxWidth, opts.fontSize);
  const botFs = fitFontSize(bottomText, maxWidth, opts.fontSize);
  const topLines = wrapMemeText(topText, maxWidth, topFs);
  const bottomLines = wrapMemeText(bottomText, maxWidth, botFs);
  return {
    topLines,
    bottomLines,
    topPositions: topTextPosition(topLines, topFs, canvasWidth),
    bottomPositions: bottomTextPosition(bottomLines, botFs, canvasWidth, canvasHeight),
    topFontSize: topFs,
    bottomFontSize: botFs,
  };
}

/** Serialize meme options. */
export function serialize(opts: MemeOptions): string {
  return JSON.stringify(opts, null, 2);
}

/** Deserialize meme options. */
export function deserialize(json: string): MemeOptions {
  return JSON.parse(json);
}

/** Generate a meme caption (top + bottom) string for sharing. */
export function captionString(opts: MemeOptions): string {
  const top = formatMemeText(opts.topText, opts.uppercase);
  const bottom = formatMemeText(opts.bottomText, opts.uppercase);
  return `${top} | ${bottom}`;
}

/** Estimate the visual density of a meme (text coverage percentage). */
export function textDensity(opts: MemeOptions, canvasWidth: number, canvasHeight: number): number {
  const layout = computeMemeLayout(canvasWidth, canvasHeight, opts);
  const topArea = layout.topLines.length * opts.fontSize * canvasWidth;
  const botArea = layout.bottomLines.length * opts.fontSize * canvasWidth;
  return Math.min(100, Math.round(((topArea + botArea) / (canvasWidth * canvasHeight)) * 100));
}

/** Compute the optimal outline width for a given font size. */
export function optimalOutlineWidth(fontSize: number): number {
  return Math.max(1, Math.round(fontSize / 16));
}

/** Parse a hex color to RGB. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let s = hex.replace(/^#/, "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (s.length !== 6) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

/** Compute contrast color for accessibility. */
export function contrastFor(bgHex: string): string {
  const rgb = parseHex(bgHex);
  if (!rgb) return "#ffffff";
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.5 ? "#000000" : "#ffffff";
}

/** Meme presets (classic combos). */
export const MEME_PRESETS: { name: string; top: string; bottom: string }[] = [
  { name: "Success Kid", top: "Tried once", bottom: "Succeeded" },
  { name: "Bad Luck Brian", top: "Studied all night", bottom: "Wrong subject" },
  { name: "Distracted BF", top: "Me", bottom: "New shiny framework" },
  { name: "Drake", top: "Old way", bottom: "New way" },
  { name: "Two Buttons", top: "Sleep", bottom: "One more episode" },
  { name: "Change My Mind", top: "Pineapple belongs on pizza", bottom: "" },
  { name: "Expanding Brain", top: "Doing it", bottom: "Automating it" },
  { name: "Stonks", top: "Buy high", bottom: "Sell low" },
];

/** Estimate bytes for output PNG. */
export function estimatePngBytes(width: number, height: number): number {
  // PNG compression ~30% of RGBA typically
  return Math.round(width * height * 4 * 0.3);
}

/** Suggest a font size based on text length and canvas width. */
export function suggestFontSize(text: string, canvasWidth: number): number {
  if (!text) return 48;
  const len = text.length;
  if (len > 40) return Math.max(20, canvasWidth / 15);
  if (len > 20) return 36;
  if (len > 10) return 48;
  return 64;
}

/** Split text into two halves (top + bottom) if user only provided one. */
export function autoSplit(text: string): { top: string; bottom: string } {
  const words = text.split(/\s+/);
  if (words.length < 2) return { top: text, bottom: "" };
  const mid = Math.ceil(words.length / 2);
  return { top: words.slice(0, mid).join(" "), bottom: words.slice(mid).join(" ") };
}
