/**
 * Title Tag Optimizer — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export const TITLE_MAX_CHARS = 60;
export const TITLE_MAX_PX = 580; // desktop pixel budget for title tag

export interface TitleStats {
  value: string;
  charCount: number;
  remaining: number;
  isOver: boolean;
  isWarn: boolean;
  pixelWidth: number;
  pixelTruncated: boolean;
  wordCount: number;
}

export interface PowerWordHit {
  word: string;
  position: number; // index in title
  category: "emotional" | "urgency" | "value" | "trust" | "curiosity";
}

export interface TitleAnalysis {
  stats: TitleStats;
  keywordPresent: boolean;
  keywordPosition: number; // word index, -1 if not present
  keywordNearFront: boolean;
  powerWords: PowerWordHit[];
  hasDigits: boolean;
  isQuestion: boolean;
  hasBrackets: boolean;
  hasCTA: boolean;
  isAllCaps: boolean;
  ctrScore: number;
  recommendations: string[];
}

/** HTML-escape. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pixel width estimate at 18-20px Arial title size. */
export function estimatePixelWidth(value: string): number {
  if (!value) return 0;
  const base = 9.5;
  let width = 0;
  for (const ch of value) {
    if (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7A3\u{1F000}-\u{1FAFF}]/u.test(ch)) {
      width += base * 2;
    } else if (ch === "i" || ch === "l" || ch === "1" || ch === ".") {
      width += base * 0.5;
    } else if (ch === "W" || ch === "M" || ch === "O" || ch === "0") {
      width += base * 1.4;
    } else if (ch === " ") {
      width += base * 0.35;
    } else {
      width += base;
    }
  }
  return Math.round(width);
}

export function computeStats(value: string): TitleStats {
  const v = value ?? "";
  const charCount = v.length;
  const pixelWidth = estimatePixelWidth(v);
  return {
    value: v,
    charCount,
    remaining: TITLE_MAX_CHARS - charCount,
    isOver: charCount > TITLE_MAX_CHARS,
    isWarn: charCount > TITLE_MAX_CHARS * 0.9 && charCount <= TITLE_MAX_CHARS,
    pixelWidth,
    pixelTruncated: pixelWidth > TITLE_MAX_PX,
    wordCount: v.trim() ? v.trim().split(/\s+/).length : 0,
  };
}

const POWER_WORDS: Record<string, PowerWordHit["category"]> = {
  // emotional
  amazing: "emotional", awesome: "emotional", incredible: "emotional", secret: "emotional",
  remarkable: "emotional", stunning: "emotional", powerful: "emotional", brilliant: "emotional",
  // urgency
  now: "urgency", today: "urgency", urgent: "urgency", limited: "urgency", hurry: "urgency",
  quickly: "urgency", soon: "urgency", last: "urgency",
  // value
  free: "value", best: "value", top: "value", proven: "value", easy: "value",
  cheap: "value", affordable: "value", ultimate: "value", complete: "value",
  // trust
  guaranteed: "trust", official: "trust", trusted: "trust", certified: "trust",
  expert: "trust", professional: "trust", reliable: "trust",
  // curiosity
  why: "curiosity", how: "curiosity", what: "curiosity", hidden: "curiosity",
  surprising: "curiosity", shocking: "curiosity", revealed: "curiosity",
};

const CTA_VERBS = ["learn", "discover", "find", "get", "try", "buy", "shop", "start", "read", "explore", "download", "join"];

/** Detect power words in a title (case-insensitive). */
export function detectPowerWords(title: string): PowerWordHit[] {
  if (!title) return [];
  const lower = title.toLowerCase();
  const hits: PowerWordHit[] = [];
  for (const [word, category] of Object.entries(POWER_WORDS)) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      hits.push({ word, position: m.index, category });
    }
  }
  return hits;
}

/** Find the position of keyword (word index, -1 if not present). */
export function findKeywordPosition(title: string, keyword: string): number {
  if (!title || !keyword) return -1;
  const lower = title.toLowerCase();
  const k = keyword.toLowerCase().trim();
  const idx = lower.indexOf(k);
  if (idx === -1) return -1;
  // Convert char index to word index
  const before = lower.slice(0, idx).trim();
  return before ? before.split(/\s+/).length : 0;
}

/** Build the title tag. */
export function buildTitleTag(title: string): string {
  if (!title || !title.trim()) return "";
  return `<title>${escapeHtml(title)}</title>`;
}

/** Truncate at pixel limit on word boundary. */
export function truncateForPixelLimit(value: string, maxPx = TITLE_MAX_PX): string {
  if (!value) return "";
  const ellipsis = "…";
  const reserve = estimatePixelWidth(ellipsis);
  let out = "";
  let width = 0;
  for (const ch of value) {
    const w = estimatePixelWidth(ch);
    if (width + w > maxPx - reserve) {
      const lastSpace = out.lastIndexOf(" ");
      if (lastSpace > 0) return out.slice(0, lastSpace) + ellipsis;
      return out + ellipsis;
    }
    out += ch;
    width += w;
  }
  return out;
}

/** Full analysis of a title. */
export function analyzeTitle(title: string, keyword?: string): TitleAnalysis {
  const stats = computeStats(title);
  const lower = (title || "").toLowerCase();
  const keywordPresent = !!(keyword && lower.includes(keyword.toLowerCase().trim()));
  const keywordPosition = keyword ? findKeywordPosition(title, keyword) : -1;
  const keywordNearFront = keywordPosition >= 0 && keywordPosition <= 1;
  const powerWords = detectPowerWords(title);
  const hasDigits = /\d/.test(title);
  const isQuestion = (title || "").includes("?");
  const hasBrackets = /[\[\(].*?[\]\)]/.test(title || "");
  const hasCTA = new RegExp(`\\b(${CTA_VERBS.join("|")})\\b`, "i").test(title || "");
  const isAllCaps = !!(title || "").trim() && (title || "") === (title || "").toUpperCase() && /[A-Z]/.test(title || "");

  let ctrScore = 50;
  if (stats.charCount >= 50 && stats.charCount <= 60) ctrScore += 10;
  else if (stats.charCount >= 40 && stats.charCount < 50) ctrScore += 5;
  else if (stats.charCount > TITLE_MAX_CHARS) ctrScore -= 8;
  if (keywordPresent) ctrScore += 8;
  if (keywordNearFront) ctrScore += 5;
  if (hasDigits) ctrScore += 4;
  if (powerWords.length > 0) ctrScore += Math.min(8, powerWords.length * 2);
  if (hasCTA) ctrScore += 4;
  if (isQuestion) ctrScore += 2;
  if (hasBrackets) ctrScore += 3;
  if (isAllCaps) ctrScore -= 6;
  if (stats.pixelTruncated) ctrScore -= 5;
  ctrScore = Math.max(0, Math.min(100, ctrScore));

  const recommendations: string[] = [];
  if (stats.isOver) recommendations.push(`Title is ${stats.charCount} chars — trim to ${TITLE_MAX_CHARS} to avoid truncation.`);
  if (stats.pixelTruncated) recommendations.push(`Pixel width ${stats.pixelWidth}px exceeds the ${TITLE_MAX_PX}px desktop budget.`);
  if (keyword && !keywordPresent) recommendations.push(`Add the keyword "${keyword}" to the title.`);
  else if (keyword && !keywordNearFront) recommendations.push(`Move keyword "${keyword}" closer to the start of the title.`);
  if (powerWords.length === 0) recommendations.push("Add a power word (best, proven, ultimate, free, …) to boost CTR.");
  if (!hasDigits) recommendations.push("Consider adding a number (e.g. 10, 7, 2026) — numbered lists get more clicks.");
  if (!hasBrackets) recommendations.push("Brackets like [Updated] or (2026) can lift CTR.");
  if (isAllCaps) recommendations.push("Avoid ALL CAPS — it looks like shouting and gets penalized.");
  if (recommendations.length === 0) recommendations.push("Title looks well-optimized. Ship it!");

  return {
    stats,
    keywordPresent,
    keywordPosition,
    keywordNearFront,
    powerWords,
    hasDigits,
    isQuestion,
    hasBrackets,
    hasCTA,
    isAllCaps,
    ctrScore,
    recommendations,
  };
}

/** Generate optimized title suggestions from a base title + keyword. */
export function generateSuggestions(title: string, keyword?: string): string[] {
  if (!title && !keyword) return [];
  const base = (title || keyword || "").trim();
  const kw = (keyword || "").trim();
  const suggestions: string[] = [];
  // Front-loaded keyword
  if (kw) suggestions.push(`${kw}: ${base}`.slice(0, TITLE_MAX_CHARS));
  // Number + keyword
  if (kw) suggestions.push(`10 Best ${kw} in 2026`.slice(0, TITLE_MAX_CHARS));
  // Power-word + keyword
  if (kw) suggestions.push(`Ultimate Guide to ${kw} [Updated 2026]`.slice(0, TITLE_MAX_CHARS));
  // Question
  if (kw) suggestions.push(`Why ${kw} Matters (and How to Get Started)`.slice(0, TITLE_MAX_CHARS));
  // Just trimmed base
  if (base) suggestions.push(truncateForPixelLimit(base, TITLE_MAX_PX));
  // Dedup + filter empty
  return Array.from(new Set(suggestions.filter(Boolean)));
}

/** Compare two titles side-by-side. */
export function compareTitles(
  a: string,
  b: string,
  keyword?: string,
): { a: TitleAnalysis; b: TitleAnalysis; winner: "A" | "B" | "tie" } {
  const aA = analyzeTitle(a, keyword);
  const aB = analyzeTitle(b, keyword);
  let winner: "A" | "B" | "tie" = "tie";
  if (aA.ctrScore > aB.ctrScore + 3) winner = "A";
  else if (aB.ctrScore > aA.ctrScore + 3) winner = "B";
  return { a: aA, b: aB, winner };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:title-tag-optimizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  keyword: string;
  ctrScore: number;
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
  keyword: string;
  versionA: string;
  versionB: string;
  url: string;
}): string {
  const params = new URLSearchParams();
  if (input.title) params.set("title", input.title);
  if (input.keyword) params.set("keyword", input.keyword);
  if (input.versionA) params.set("a", input.versionA);
  if (input.versionB) params.set("b", input.versionB);
  if (input.url) params.set("url", input.url);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  title: string;
  keyword: string;
  versionA: string;
  versionB: string;
  url: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const out = { title: "", keyword: "", versionA: "", versionB: "", url: "" };
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  return {
    title: params.get("title") ?? "",
    keyword: params.get("keyword") ?? "",
    versionA: params.get("a") ?? "",
    versionB: params.get("b") ?? "",
    url: params.get("url") ?? "",
  };
}
