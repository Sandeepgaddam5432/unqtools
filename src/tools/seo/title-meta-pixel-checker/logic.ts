/**
 * Title & Meta Description Pixel Checker — pure logic.
 *
 * Estimate pixel width of titles and meta descriptions for SERP truncation.
 * Pure functions only — no DOM, no network.
 */

export type Field = "title" | "description";
export type Device = "desktop" | "mobile";
export type SortField = "pixelWidth" | "charCount" | "wordCount" | "text";
export type SortDir = "asc" | "desc";

export const PIXEL_PER_CHAR = 9; // average Arial char width
export const TITLE_LIMITS: Record<Device, { px: number; chars: number }> = {
  desktop: { px: 568, chars: 60 },
  mobile: { px: 485, chars: 55 },
};
export const DESCRIPTION_LIMITS: Record<Device, { px: number; chars: number }> = {
  desktop: { px: 980, chars: 160 },
  mobile: { px: 685, chars: 130 },
};

export interface PixelResult {
  text: string;
  pixelWidth: number;
  charCount: number;
  wordCount: number;
  truncatedText: string;
  truncatedAtPx: number;
  isOverLimit: boolean;
  isWarn: boolean;
  limitPx: number;
  limitChars: number;
}

export interface BatchResult {
  field: Field;
  device: Device;
  results: PixelResult[];
  total: number;
  overLimitCount: number;
  averagePixelWidth: number;
}

/** Estimate pixel width of a single character. */
export function charPixelWidth(ch: string): number {
  if (!ch) return 0;
  // CJK and emoji — double width
  if (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7A3\u{1F000}-\u{1FAFF}]/u.test(ch)) return PIXEL_PER_CHAR * 2;
  // Narrow chars
  if (["i", "l", "1", "|", ".", ",", ";", ":", "'", "!", "j", "f", "t", "r"].includes(ch)) return PIXEL_PER_CHAR * 0.5;
  // Wide chars
  if (["W", "M", "O", "0", "@", "D", "G", "H", "N", "Q", "R", "S", "U", "V"].includes(ch)) return PIXEL_PER_CHAR * 1.4;
  // Space
  if (ch === " ") return PIXEL_PER_CHAR * 0.5;
  return PIXEL_PER_CHAR;
}

/** Estimate pixel width of an entire string. */
export function estimatePixelWidth(text: string): number {
  if (!text) return 0;
  let width = 0;
  for (const ch of text) width += charPixelWidth(ch);
  return Math.round(width);
}

/** Truncate text at pixel boundary, appending ellipsis. */
export function truncateAtPixel(text: string, maxPx: number): { text: string; truncatedAtPx: number } {
  if (!text) return { text: "", truncatedAtPx: 0 };
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const w = charPixelWidth(text[i]);
    if (width + w > maxPx - 12) {
      return { text: text.slice(0, i) + "…", truncatedAtPx: width };
    }
    width += w;
  }
  return { text, truncatedAtPx: width };
}

/** Count words. */
export function countWords(text: string): number {
  if (!text) return 0;
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Analyze a single title/description against a device limit. */
export function analyze(
  text: string,
  field: Field,
  device: Device,
): PixelResult {
  const limit = field === "title" ? TITLE_LIMITS[device] : DESCRIPTION_LIMITS[device];
  const pixelWidth = estimatePixelWidth(text);
  const charCount = text.length;
  const wordCount = countWords(text);
  const { text: truncatedText, truncatedAtPx } = truncateAtPixel(text, limit.px);
  const isOverLimit = pixelWidth > limit.px;
  const isWarn = pixelWidth > limit.px * 0.9 && pixelWidth <= limit.px;
  return {
    text,
    pixelWidth,
    charCount,
    wordCount,
    truncatedText,
    truncatedAtPx,
    isOverLimit,
    isWarn,
    limitPx: limit.px,
    limitChars: limit.chars,
  };
}

/** Parse batch input (one entry per line). */
export function parseBatch(input: string): string[] {
  if (!input) return [];
  return input.split(/\n/).map((s) => s.trim()).filter(Boolean);
}

/** Sort results. */
export function sortResults(results: PixelResult[], field: SortField, dir: SortDir): PixelResult[] {
  const sorted = [...results];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === "pixelWidth") cmp = a.pixelWidth - b.pixelWidth;
    else if (field === "charCount") cmp = a.charCount - b.charCount;
    else if (field === "wordCount") cmp = a.wordCount - b.wordCount;
    else cmp = a.text.localeCompare(b.text);
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/** Analyze a batch. */
export function analyzeBatch(
  texts: string[],
  field: Field,
  device: Device,
): BatchResult {
  const results = texts.map((t) => analyze(t, field, device));
  const overLimitCount = results.filter((r) => r.isOverLimit).length;
  const averagePixelWidth = results.length > 0
    ? Math.round(results.reduce((acc, r) => acc + r.pixelWidth, 0) / results.length)
    : 0;
  return { field, device, results, total: results.length, overLimitCount, averagePixelWidth };
}

/** Render as CSV. */
export function renderCsv(result: BatchResult): string {
  const lines = ["text,pixel_width,char_count,word_count,limit_px,is_over_limit,truncated_text"];
  for (const r of result.results) {
    lines.push(
      [
        escapeCsv(r.text),
        r.pixelWidth,
        r.charCount,
        r.wordCount,
        r.limitPx,
        r.isOverLimit ? "yes" : "no",
        escapeCsv(r.truncatedText),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History ----

const HISTORY_KEY = "unqtools:title-meta-pixel-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  field: Field;
  device: Device;
  count: number;
  overLimit: number;
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

export function buildShareUrl(input: { field: Field; device: Device; text: string }): string {
  const params = new URLSearchParams();
  params.set("field", input.field);
  params.set("device", input.device);
  if (input.text) params.set("text", input.text);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { field?: Field; device?: Device; text: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "" };
  const params = new URLSearchParams(clean);
  const field = params.get("field") as Field | null;
  const device = params.get("device") as Device | null;
  const text = params.get("text") ?? "";
  return {
    field: field ?? undefined,
    device: device ?? undefined,
    text,
  };
}
