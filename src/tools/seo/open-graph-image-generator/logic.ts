/**
 * Open Graph Image Generator — pure logic.
 *
 * Generate OG images as SVG (1200×630). Pure functions only — no DOM, no
 * network.
 */

export type Template = "solid" | "gradient" | "pattern";
export type TextAlign = "left" | "center" | "right";

export interface OgImageInput {
  title: string;
  subtitle?: string;
  bgColor: string;
  bgColor2?: string; // for gradient template
  textColor: string;
  fontSize: number; // px
  subtitleFontSize?: number;
  logoUrl?: string;
  template: Template;
  textAlign: TextAlign;
  padding?: number;
}

export const WIDTH = 1200;
export const HEIGHT = 630;

export function isValidHex(color: string): boolean {
  if (!color) return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

export function normalizeHex(color: string): string {
  if (!color) return "#000000";
  if (!isValidHex(color)) return "#000000";
  if (color.length === 4) {
    // Expand #abc → #aabbcc
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return color.toLowerCase();
}

/** Convert hex to {r, g, b}. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex);
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

/** Determine if a color is "dark" (for choosing readable text defaults). */
export function isDarkColor(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  // YIQ formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128;
}

/** Escape SVG text content. */
export function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap text into multiple lines for SVG (no native wrapping). */
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + " " + w).length <= maxCharsPerLine) {
      current = current + " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Compute the X anchor for text alignment. */
export function anchorForAlign(align: TextAlign, padding: number): { x: number; anchor: string } {
  if (align === "left") return { x: padding, anchor: "start" };
  if (align === "right") return { x: WIDTH - padding, anchor: "end" };
  return { x: WIDTH / 2, anchor: "middle" };
}

/** Build SVG <text> elements for title + subtitle. */
export function buildTextElements(input: OgImageInput): string {
  const padding = input.padding ?? 80;
  const { x, anchor } = anchorForAlign(input.textAlign, padding);
  const elements: string[] = [];
  const titleLines = wrapText(input.title, 28);
  const subtitleLines = input.subtitle ? wrapText(input.subtitle, 50) : [];
  const titleFs = input.fontSize;
  const subtitleFs = input.subtitleFontSize ?? Math.round(titleFs * 0.55);
  const lineHeight = titleFs * 1.2;
  const subtitleLineHeight = subtitleFs * 1.3;
  // Vertically center
  const totalHeight = titleLines.length * lineHeight + (subtitleLines.length > 0 ? 20 + subtitleLines.length * subtitleLineHeight : 0);
  let y = (HEIGHT - totalHeight) / 2 + titleFs;
  for (const line of titleLines) {
    elements.push(
      `<text x="${x}" y="${y.toFixed(0)}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" font-size="${titleFs}" font-weight="700" fill="${normalizeHex(input.textColor)}" text-anchor="${anchor}">${escapeXml(line)}</text>`,
    );
    y += lineHeight;
  }
  if (subtitleLines.length > 0) {
    y += 20 - lineHeight + subtitleFs;
    for (const line of subtitleLines) {
      elements.push(
        `<text x="${x}" y="${y.toFixed(0)}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" font-size="${subtitleFs}" font-weight="400" fill="${normalizeHex(input.textColor)}" opacity="0.85" text-anchor="${anchor}">${escapeXml(line)}</text>`,
      );
      y += subtitleLineHeight;
    }
  }
  return elements.join("\n  ");
}

/** Build the background element(s) for the chosen template. */
export function buildBackground(input: OgImageInput): string {
  const bg = normalizeHex(input.bgColor);
  if (input.template === "gradient") {
    const bg2 = normalizeHex(input.bgColor2 || input.bgColor);
    return `<defs><linearGradient id="ogGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#ogGrad)"/>`;
  }
  if (input.template === "pattern") {
    const dotColor = isDarkColor(bg) ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    return `<rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/><pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="2" fill="${dotColor}"/></pattern><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>`;
  }
  return `<rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>`;
}

/** Build the logo element (if logo URL is provided). */
export function buildLogo(input: OgImageInput): string {
  if (!input.logoUrl) return "";
  const padding = input.padding ?? 80;
  const logoSize = 80;
  // Top-left placement regardless of text alignment
  return `<image href="${escapeXml(input.logoUrl)}" x="${padding}" y="${padding}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
}

/** Build the full SVG string. */
export function buildSvg(input: OgImageInput): string {
  const bg = buildBackground(input);
  const logo = buildLogo(input);
  const text = buildTextElements(input);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(input.title)}">
  ${bg}
  ${logo}
  ${text}
</svg>`;
}

/** Validate the input. */
export function validate(input: OgImageInput): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.title || !input.title.trim()) errors.push("Title is required");
  if (!isValidHex(input.bgColor)) errors.push("Background color must be a valid hex (e.g. #1a1a1a)");
  if (!isValidHex(input.textColor)) errors.push("Text color must be a valid hex");
  if (input.template === "gradient" && input.bgColor2 && !isValidHex(input.bgColor2)) {
    errors.push("Gradient second color must be valid hex");
  }
  if (input.fontSize < 20 || input.fontSize > 120) {
    errors.push("Font size must be between 20 and 120");
  }
  return { ok: errors.length === 0, errors };
}

/** Full pipeline. */
export function generate(input: OgImageInput): string {
  const v = validate(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  return buildSvg(input);
}

/** Default input. */
export function defaultInput(): OgImageInput {
  return {
    title: "",
    subtitle: "",
    bgColor: "#1a1a2e",
    bgColor2: "#16213e",
    textColor: "#eaeaea",
    fontSize: 64,
    subtitleFontSize: 32,
    logoUrl: "",
    template: "gradient",
    textAlign: "left",
    padding: 80,
  };
}

// ---- History ----

const HISTORY_KEY = "unqtools:open-graph-image-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  template: Template;
  bgColor: string;
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
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: OgImageInput): string {
  const params = new URLSearchParams();
  if (input.title) params.set("title", input.title);
  if (input.subtitle) params.set("subtitle", input.subtitle);
  params.set("bg", input.bgColor);
  if (input.bgColor2) params.set("bg2", input.bgColor2);
  params.set("fg", input.textColor);
  params.set("fs", String(input.fontSize));
  if (input.logoUrl) params.set("logo", input.logoUrl);
  params.set("t", input.template);
  params.set("align", input.textAlign);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OgImageInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<OgImageInput> = {};
  if (params.get("title")) out.title = params.get("title")!;
  if (params.get("subtitle")) out.subtitle = params.get("subtitle")!;
  if (params.get("bg")) out.bgColor = params.get("bg")!;
  if (params.get("bg2")) out.bgColor2 = params.get("bg2")!;
  if (params.get("fg")) out.textColor = params.get("fg")!;
  const fs = params.get("fs");
  if (fs) out.fontSize = parseInt(fs, 10);
  if (params.get("logo")) out.logoUrl = params.get("logo")!;
  if (params.get("t")) out.template = params.get("t") as Template;
  if (params.get("align")) out.textAlign = params.get("align") as TextAlign;
  return out;
}
