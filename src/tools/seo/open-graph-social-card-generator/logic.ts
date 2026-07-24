/**
 * Open Graph Social Card Generator — pure logic.
 * Canvas drawing happens in ui.tsx. This module handles layout math + export helpers.
 */

export type CardSize = "og-1200x630" | "square-1200x1200" | "instagram-1080x1080" | "pinterest-1000x1500" | "twitter-1200x600";

export interface CardSizeInfo {
  id: CardSize;
  name: string;
  width: number;
  height: number;
  ratio: string;
  platforms: string[];
}

export const CARD_SIZES: CardSizeInfo[] = [
  { id: "og-1200x630", name: "Open Graph (standard)", width: 1200, height: 630, ratio: "1.91:1", platforms: ["Facebook", "LinkedIn", "Twitter (large)", "Slack"] },
  { id: "twitter-1200x600", name: "Twitter summary", width: 1200, height: 600, ratio: "2:1", platforms: ["Twitter"] },
  { id: "square-1200x1200", name: "Square (universal)", width: 1200, height: 1200, ratio: "1:1", platforms: ["Instagram", "LinkedIn", "Twitter"] },
  { id: "instagram-1080x1080", name: "Instagram post", width: 1080, height: 1080, ratio: "1:1", platforms: ["Instagram"] },
  { id: "pinterest-1000x1500", name: "Pinterest pin", width: 1000, height: 1500, ratio: "2:3", platforms: ["Pinterest"] },
];

export type FontFamily = "inter" | "helvetica" | "georgia" | "courier" | "system-ui" | "arial" | "verdana" | "tahoma";

export interface CardConfig {
  size: CardSize;
  title: string;
  subtitle: string;
  brandName: string;
  brandLogoUrl?: string;
  backgroundImageUrl?: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: FontFamily;
  titleFontSize: number;
  subtitleFontSize: number;
  brandFontSize: number;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  padding: number;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle: number;
  template: "minimal" | "centered-bold" | "left-bottom" | "with-image-bg" | "gradient-overlay";
}

export const DEFAULT_CONFIG: CardConfig = {
  size: "og-1200x630",
  title: "Your Compelling Title Goes Here",
  subtitle: "A short subtitle that supports the title",
  brandName: "YourBrand",
  backgroundColor: "#0a0a0a",
  textColor: "#ffffff",
  accentColor: "#f97316",
  fontFamily: "inter",
  titleFontSize: 64,
  subtitleFontSize: 32,
  brandFontSize: 24,
  textAlign: "left",
  verticalAlign: "middle",
  padding: 80,
  gradientAngle: 135,
  template: "minimal",
};

/** Draw card to a canvas element. */
export function drawCard(ctx: CanvasRenderingContext2D, config: CardConfig): void {
  const size = CARD_SIZES.find((s) => s.id === config.size)!;
  ctx.canvas.width = size.width;
  ctx.canvas.height = size.height;

  // Background: gradient or solid
  if (config.gradientFrom && config.gradientTo) {
    const angle = (config.gradientAngle * Math.PI) / 180;
    const x1 = size.width / 2 - Math.cos(angle) * size.width / 2;
    const y1 = size.height / 2 - Math.sin(angle) * size.height / 2;
    const x2 = size.width / 2 + Math.cos(angle) * size.width / 2;
    const y2 = size.height / 2 + Math.sin(angle) * size.height / 2;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, config.gradientFrom);
    grad.addColorStop(1, config.gradientTo);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = config.backgroundColor;
  }
  ctx.fillRect(0, 0, size.width, size.height);

  // Title (multi-line wrap)
  ctx.fillStyle = config.textColor;
  ctx.font = `bold ${config.titleFontSize}px ${config.fontFamily}`;
  ctx.textBaseline = "top";
  const lines = wrapText(ctx, config.title, size.width - 2 * config.padding);
  const subtitleLines = config.subtitle ? wrapText(ctx, config.subtitle, size.width - 2 * config.padding) : [];

  // Compute total height
  const lineHeight = config.titleFontSize * 1.2;
  const subtitleLineHeight = config.subtitleFontSize * 1.3;
  const brandHeight = config.brandFontSize + 20;
  const totalHeight = lines.length * lineHeight + (subtitleLines.length > 0 ? 20 + subtitleLines.length * subtitleLineHeight : 0) + brandHeight;

  let startY: number;
  switch (config.verticalAlign) {
    case "top": startY = config.padding; break;
    case "bottom": startY = size.height - config.padding - totalHeight; break;
    case "middle":
    default: startY = (size.height - totalHeight) / 2;
  }

  let x: number;
  switch (config.textAlign) {
    case "left": x = config.padding; ctx.textAlign = "left"; break;
    case "right": x = size.width - config.padding; ctx.textAlign = "right"; break;
    case "center":
    default: x = size.width / 2; ctx.textAlign = "center";
  }

  // Brand name (top)
  ctx.font = `bold ${config.brandFontSize}px ${config.fontFamily}`;
  ctx.fillStyle = config.accentColor;
  ctx.fillText(config.brandName, x, startY);
  startY += brandHeight;

  // Title
  ctx.fillStyle = config.textColor;
  ctx.font = `bold ${config.titleFontSize}px ${config.fontFamily}`;
  for (const line of lines) {
    ctx.fillText(line, x, startY);
    startY += lineHeight;
  }

  // Subtitle
  if (subtitleLines.length > 0) {
    startY += 20;
    ctx.font = `${config.subtitleFontSize}px ${config.fontFamily}`;
    ctx.globalAlpha = 0.8;
    for (const line of subtitleLines) {
      ctx.fillText(line, x, startY);
      startY += subtitleLineHeight;
    }
    ctx.globalAlpha = 1;
  }
}

/** Word-wrap text to fit within maxWidth. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Trigger download of canvas as PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: "png" | "jpeg" = "png", quality = 0.92): void {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const url = canvas.toDataURL(mime, quality);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Get canvas as data URL. */
export function canvasToDataUrl(canvas: HTMLCanvasElement, format: "png" | "jpeg" = "png", quality = 0.92): string {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, quality);
}

/** Save config to localStorage. */
export function saveConfig(config: CardConfig): void {
  try { localStorage.setItem("og-card-config", JSON.stringify(config)); } catch { /* ignore */ }
}

/** Load config from localStorage. */
export function loadConfig(): CardConfig | null {
  try {
    const s = localStorage.getItem("og-card-config");
    if (!s) return null;
    return { ...DEFAULT_CONFIG, ...JSON.parse(s) };
  } catch { return null; }
}

/** Generate OG meta tags for a published card. */
export function generateOgTags(cardUrl: string, title: string, description: string, imageUrl: string): string {
  return [
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:url" content="${escapeAttr(cardUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}">`,
  ].join("\n");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
