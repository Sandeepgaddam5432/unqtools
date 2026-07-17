/**
 * Meta Description Generator — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export const DESCRIPTION_MAX = 160;
export const PIXEL_MAX_DESKTOP = 920; // px — Google desktop snippet
export const PIXEL_MAX_MOBILE = 680; // px — mobile snippet

export interface DescriptionInput {
  title: string;
  content: string;
  keyword?: string;
  brand?: string;
}

export interface DescriptionStats {
  value: string;
  charCount: number;
  remaining: number;
  isOver: boolean;
  isWarn: boolean;
  pixelWidth: number;
  pixelTruncated: boolean;
  wordCount: number;
}

export interface SuggestionResult {
  text: string;
  template: string;
  stats: DescriptionStats;
}

export interface ABComparison {
  a: DescriptionStats;
  b: DescriptionStats;
  winner: "A" | "B" | "tie";
  reasons: string[];
  ctrA: number;
  ctrB: number;
}

/** HTML-escape a string for safe rendering. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Estimate pixel width of a string at typical SERP description size (~14px Arial). */
export function estimatePixelWidth(value: string): number {
  if (!value) return 0;
  // ~7.2px per char average for 14px Arial on desktop
  const basePx = 7.2;
  let width = 0;
  for (const ch of value) {
    if (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7A3\u{1F000}-\u{1FAFF}]/u.test(ch)) {
      width += basePx * 1.8;
    } else if (ch === "i" || ch === "l" || ch === "1" || ch === ".") {
      width += basePx * 0.55;
    } else if (ch === "W" || ch === "M" || ch === "m" || ch === "O" || ch === "0") {
      width += basePx * 1.3;
    } else if (ch === " ") {
      width += basePx * 0.35;
    } else {
      width += basePx;
    }
  }
  return Math.round(width);
}

/** Compute stats for a single description string. */
export function computeStats(value: string): DescriptionStats {
  const v = value ?? "";
  const charCount = v.length;
  const pixelWidth = estimatePixelWidth(v);
  return {
    value: v,
    charCount,
    remaining: DESCRIPTION_MAX - charCount,
    isOver: charCount > DESCRIPTION_MAX,
    isWarn: charCount > DESCRIPTION_MAX * 0.9 && charCount <= DESCRIPTION_MAX,
    pixelWidth,
    pixelTruncated: pixelWidth > PIXEL_MAX_DESKTOP,
    wordCount: v.trim() ? v.trim().split(/\s+/).length : 0,
  };
}

/** Truncate at the pixel limit, breaking on a word boundary. */
export function truncateForPixelLimit(value: string, maxPx = PIXEL_MAX_DESKTOP): string {
  if (!value) return "";
  const ellipsis = "…";
  const reserve = estimatePixelWidth(ellipsis);
  let out = "";
  let width = 0;
  for (const ch of value) {
    const w = estimatePixelWidth(ch);
    if (width + w > maxPx - reserve) {
      // back up to last space
      const lastSpace = out.lastIndexOf(" ");
      if (lastSpace > 0) return out.slice(0, lastSpace) + ellipsis;
      return out + ellipsis;
    }
    out += ch;
    width += w;
  }
  return out;
}

/** Build a meta description tag. */
export function buildDescriptionTag(description: string): string {
  if (!description || !description.trim()) return "";
  return `<meta name="description" content="${escapeHtml(description)}" />`;
}

/** Compute a simple CTR estimate (0-100) based on length, keyword presence, power words, digits. */
export function estimateCtr(value: string, keyword?: string): number {
  if (!value || !value.trim()) return 0;
  let score = 50;
  // Length sweet spot 120-160
  const len = value.length;
  if (len >= 120 && len <= 160) score += 12;
  else if (len >= 90 && len < 120) score += 6;
  else if (len > 160) score -= 8;
  // Keyword presence
  if (keyword && value.toLowerCase().includes(keyword.toLowerCase())) score += 10;
  // Power words
  const POWER = ["free", "best", "new", "now", "easy", "save", "proven", "guaranteed", "top", "exclusive", "limited", "fast", "today", "ultimate"];
  const lower = value.toLowerCase();
  for (const p of POWER) {
    if (lower.includes(p)) {
      score += 2;
      break;
    }
  }
  // Number presence boosts CTR
  if (/\d/.test(value)) score += 4;
  // Call to action
  if (/\b(learn|discover|read|get|try|buy|shop|start|find)\b/i.test(value)) score += 4;
  // Question
  if (value.includes("?")) score += 2;
  // Clamp
  return Math.max(0, Math.min(100, score));
}

const TEMPLATES: Record<string, (input: DescriptionInput) => string> = {
  concise: (i) => `${i.keyword ? i.keyword + " — " : ""}${stripToSentences(i.content, 1)}`.trim(),
  descriptive: (i) => `${i.keyword ? i.keyword + ": " : ""}${stripToSentences(i.content, 2)}`.trim(),
  question: (i) => `Looking for ${i.keyword || "the best solution"}? ${stripToSentences(i.content, 1)}`.trim(),
  list: (i) => `${i.keyword ? i.keyword + ": " : ""}Top tips and ideas — ${stripToSentences(i.content, 1)}`.trim(),
  howto: (i) => `How to ${i.keyword || "get started"}: ${stripToSentences(i.content, 1)}`.trim(),
  transactional: (i) => `${i.keyword ? i.keyword + " — " : ""}Shop the best deals today. ${i.brand ? i.brand + ". " : ""}Fast delivery.`.trim(),
};

function stripToSentences(text: string, maxSentences: number): string {
  if (!text) return "";
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  return sentences.slice(0, maxSentences).join(" ").trim();
}

/** Generate multiple description suggestions from input. */
export function generateSuggestions(input: DescriptionInput): SuggestionResult[] {
  const out: SuggestionResult[] = [];
  for (const [template, fn] of Object.entries(TEMPLATES)) {
    let text = fn(input);
    // Cap at 160 chars on word boundary
    if (text.length > DESCRIPTION_MAX) {
      text = truncateForPixelLimit(text, PIXEL_MAX_DESKTOP);
    }
    out.push({ text, template, stats: computeStats(text) });
  }
  return out;
}

/** Compare two description variants (A/B). */
export function compareAB(a: string, b: string, keyword?: string): ABComparison {
  const statsA = computeStats(a);
  const statsB = computeStats(b);
  const ctrA = estimateCtr(a, keyword);
  const ctrB = estimateCtr(b, keyword);
  const reasons: string[] = [];
  if (ctrA !== ctrB) {
    reasons.push(
      `${ctrA > ctrB ? "A" : "B"} has a higher estimated CTR (${Math.max(ctrA, ctrB)} vs ${Math.min(ctrA, ctrB)})`,
    );
  }
  if (statsA.pixelTruncated !== statsB.pixelTruncated) {
    reasons.push(
      `${statsA.pixelTruncated ? "B" : "A"} fits within the pixel limit; the other is truncated`,
    );
  }
  if (statsA.isOver !== statsB.isOver) {
    reasons.push(`${statsA.isOver ? "B" : "A"} stays within the character limit`);
  }
  let winner: "A" | "B" | "tie" = "tie";
  if (ctrA > ctrB + 3) winner = "A";
  else if (ctrB > ctrA + 3) winner = "B";
  else if (statsA.pixelTruncated && !statsB.pixelTruncated) winner = "B";
  else if (statsB.pixelTruncated && !statsA.pixelTruncated) winner = "A";
  return { a: statsA, b: statsB, winner, reasons, ctrA, ctrB };
}

/** Build SERP preview data. */
export function buildSerpPreview(
  description: string,
  title: string,
  url: string,
): { title: string; url: string; truncatedDescription: string; breadcrumb: string } {
  return {
    title: title || "Sample Page Title",
    url: url || "https://example.com/page",
    truncatedDescription: truncateForPixelLimit(description, PIXEL_MAX_DESKTOP),
    breadcrumb: url ? url.replace(/^https?:\/\//, "").replace(/\//g, " › ") : "example.com › page",
  };
}

/** Render suggestions + stats as CSV. */
export function renderCsv(suggestions: SuggestionResult[]): string {
  const lines = ["template,text,char_count,pixel_width,word_count"];
  for (const s of suggestions) {
    lines.push(
      `${s.template},${escapeCsv(s.text)},${s.stats.charCount},${s.stats.pixelWidth},${s.stats.wordCount}`,
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:meta-description-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  description: string;
  keyword: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

export function buildShareUrl(input: {
  title: string;
  content: string;
  keyword: string;
  brand: string;
  versionA: string;
  versionB: string;
}): string {
  const params = new URLSearchParams();
  if (input.title) params.set("title", input.title);
  if (input.content) params.set("content", input.content);
  if (input.keyword) params.set("keyword", input.keyword);
  if (input.brand) params.set("brand", input.brand);
  if (input.versionA) params.set("a", input.versionA);
  if (input.versionB) params.set("b", input.versionB);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  title: string;
  content: string;
  keyword: string;
  brand: string;
  versionA: string;
  versionB: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const out = { title: "", content: "", keyword: "", brand: "", versionA: "", versionB: "" };
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  return {
    title: params.get("title") ?? "",
    content: params.get("content") ?? "",
    keyword: params.get("keyword") ?? "",
    brand: params.get("brand") ?? "",
    versionA: params.get("a") ?? "",
    versionB: params.get("b") ?? "",
  };
}
