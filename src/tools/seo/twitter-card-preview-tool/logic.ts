/**
 * Twitter Card Preview Tool — pure logic.
 */

export type CardType = "summary" | "summary_large_image" | "player" | "app";

export interface TwitterCardInput {
  cardType: CardType;
  site?: string;       // @handle
  creator?: string;    // @handle
  title: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  url?: string;
  /** For player cards: */
  playerUrl?: string;
  playerWidth?: number;
  playerHeight?: number;
  /** For app cards: */
  appIphoneId?: string;
  appIpadId?: string;
  appGoogleplayId?: string;
  appCountry?: string;
}

export interface ValidationResult {
  warnings: string[];
  errors: string[];
  titleCharCount: number;
  descriptionCharCount: number;
  titlePixelWidth: number;
  descriptionPixelWidth: number;
}

const TITLE_MAX_CHARS = 70;
const DESC_MAX_CHARS = 200;
const TITLE_MAX_PX = 560;
const DESC_MAX_PX = 940;

function estimatePixelWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 4;
    else if (/[mwMW]/.test(ch)) width += 12;
    else if (/[A-Z]/.test(ch)) width += 9;
    else if (/[a-z]/.test(ch)) width += 7;
    else if (/[0-9]/.test(ch)) width += 7;
    else width += 5;
  }
  return Math.round(width);
}

export function validateCard(input: TwitterCardInput): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const titlePx = estimatePixelWidth(input.title);
  const descPx = estimatePixelWidth(input.description);

  if (!input.title) errors.push("twitter:title is required.");
  else {
    if (input.title.length > TITLE_MAX_CHARS) warnings.push(`Title is ${input.title.length} chars (recommended max ${TITLE_MAX_CHARS}).`);
    if (titlePx > TITLE_MAX_PX) warnings.push(`Title pixel width ${titlePx}px exceeds ~${TITLE_MAX_PX}px (will be truncated).`);
  }
  if (input.description.length > DESC_MAX_CHARS) warnings.push(`Description is ${input.description.length} chars (recommended max ${DESC_MAX_CHARS}).`);
  if (descPx > DESC_MAX_PX) warnings.push(`Description pixel width ${descPx}px exceeds ~${DESC_MAX_PX}px (will be truncated).`);

  if (input.cardType !== "summary" && !input.imageUrl) {
    errors.push(`${input.cardType} requires twitter:image.`);
  }
  if (input.cardType === "player") {
    if (!input.playerUrl) errors.push("Player card requires twitter:player URL.");
    if (!input.playerWidth || !input.playerHeight) errors.push("Player card requires twitter:player:width and twitter:player:height.");
  }
  if (input.cardType === "app") {
    if (!input.appIphoneId && !input.appGoogleplayId) errors.push("App card requires at least one app ID (iPhone or Google Play).");
  }
  if (input.imageUrl && input.imageAlt && input.imageAlt.length > 420) {
    warnings.push(`Image alt is ${input.imageAlt.length} chars (max 420).`);
  }

  return {
    warnings, errors,
    titleCharCount: input.title.length,
    descriptionCharCount: input.description.length,
    titlePixelWidth: titlePx,
    descriptionPixelWidth: descPx,
  };
}

export function generateTwitterTags(input: TwitterCardInput): string {
  const lines: string[] = [`<meta name="twitter:card" content="${input.cardType}">`];
  if (input.site) lines.push(`<meta name="twitter:site" content="${escapeAttr(input.site)}">`);
  if (input.title) lines.push(`<meta name="twitter:title" content="${escapeAttr(input.title)}">`);
  if (input.description) lines.push(`<meta name="twitter:description" content="${escapeAttr(input.description)}">`);
  if (input.imageUrl) lines.push(`<meta name="twitter:image" content="${escapeAttr(input.imageUrl)}">`);
  if (input.imageAlt) lines.push(`<meta name="twitter:image:alt" content="${escapeAttr(input.imageAlt)}">`);
  if (input.creator) lines.push(`<meta name="twitter:creator" content="${escapeAttr(input.creator)}">`);
  if (input.url) lines.push(`<meta name="twitter:url" content="${escapeAttr(input.url)}">`);
  if (input.cardType === "player") {
    if (input.playerUrl) lines.push(`<meta name="twitter:player" content="${escapeAttr(input.playerUrl)}">`);
    if (input.playerWidth) lines.push(`<meta name="twitter:player:width" content="${input.playerWidth}">`);
    if (input.playerHeight) lines.push(`<meta name="twitter:player:height" content="${input.playerHeight}">`);
  }
  if (input.cardType === "app") {
    if (input.appIphoneId) lines.push(`<meta name="twitter:app:id:iphone" content="${input.appIphoneId}">`);
    if (input.appIpadId) lines.push(`<meta name="twitter:app:id:ipad" content="${input.appIpadId}">`);
    if (input.appGoogleplayId) lines.push(`<meta name="twitter:app:id:googleplay" content="${input.appGoogleplayId}">`);
    if (input.appCountry) lines.push(`<meta name="twitter:app:country" content="${escapeAttr(input.appCountry)}">`);
  }
  return lines.join("\n");
}

/** Parse twitter: meta tags from raw HTML. */
export function parseTwitterTagsFromHtml(html: string): Partial<TwitterCardInput> {
  const out: Partial<TwitterCardInput> = {};
  const get = (name: string): string | undefined => {
    const m = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, "i").exec(html);
    return m?.[1];
  };
  const cardType = get("twitter:card");
  if (cardType) out.cardType = cardType as CardType;
  out.site = get("twitter:site");
  out.creator = get("twitter:creator");
  out.title = get("twitter:title");
  out.description = get("twitter:description");
  out.imageUrl = get("twitter:image");
  out.imageAlt = get("twitter:image:alt");
  out.url = get("twitter:url");
  out.playerUrl = get("twitter:player");
  const w = get("twitter:player:width"); if (w) out.playerWidth = Number(w);
  const h = get("twitter:player:height"); if (h) out.playerHeight = Number(h);
  out.appIphoneId = get("twitter:app:id:iphone");
  out.appIpadId = get("twitter:app:id:ipad");
  out.appGoogleplayId = get("twitter:app:id:googleplay");
  out.appCountry = get("twitter:app:country");
  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Card dimension recommendations. */
export const CARD_DIMENSIONS = {
  summary: { minWidth: 144, minHeight: 144, recommendedWidth: 512, recommendedHeight: 512, ratio: "1:1" },
  summary_large_image: { minWidth: 300, minHeight: 157, recommendedWidth: 1200, recommendedHeight: 628, ratio: "1.91:1" },
  player: { minWidth: 300, minHeight: 157, recommendedWidth: 1200, recommendedHeight: 628, ratio: "1.91:1" },
  app: { minWidth: 144, minHeight: 144, recommendedWidth: 512, recommendedHeight: 512, ratio: "1:1" },
} as const;

/** Save history of previews (localStorage). */
export function saveHistory(input: TwitterCardInput): void {
  try {
    const existing = JSON.parse(localStorage.getItem("twitter-card-history") ?? "[]");
    existing.unshift({ ...input, ts: Date.now() });
    localStorage.setItem("twitter-card-history", JSON.stringify(existing.slice(0, 10)));
  } catch { /* ignore */ }
}

export function loadHistory(): (TwitterCardInput & { ts: number })[] {
  try { return JSON.parse(localStorage.getItem("twitter-card-history") ?? "[]"); } catch { return []; }
}

export function clearHistory(): void {
  try { localStorage.removeItem("twitter-card-history"); } catch { /* ignore */ }
}
