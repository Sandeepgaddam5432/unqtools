/**
 * Title Tag Optimizer & CTR Estimator — pure logic.
 * Pixel-accurate preview + title-quality score + position-aware CTR estimate.
 *
 * Reference: blueprint §5 (feature set) and §10 (acceptance criteria).
 * 100% client-side, no network.
 */

export const TITLE_LIMITS = {
  desktopPx: 580,
  mobilePx: 520,
  softCharMin: 30,
  softCharMax: 60,
  hardCharMax: 200,
} as const;

/** CTR curve (% click-through by position) — AWR-style aggregate, configurable. */
export const DEFAULT_CTR_CURVE: number[] = [
  31.7,  // pos 1
  24.7,  // pos 2
  18.7,  // pos 3
  13.6,  // pos 4
  9.5,   // pos 5
  6.6,   // pos 6
  4.7,   // pos 7
  3.4,   // pos 8
  2.6,   // pos 9
  1.9,   // pos 10
];

export type BrandSeparator = "pipe" | "em-dash" | "colon" | "none";

export interface TitleVariant {
  id: string;
  label: string;
  title: string;
}

export interface TitleScore {
  id: string;
  label: string;
  title: string;
  charCount: number;
  pixelWidth: number;
  truncatedDesktop: boolean;
  truncatedMobile: boolean;
  qualityScore: number;        // 0..100
  ctrByPosition: { position: number; baseCtr: number; adjustedCtr: number }[];
  breakdown: { rule: string; points: number; reason: string }[];
  keywordAtFront: boolean;
  hasBrandSuffix: boolean;
  powerWords: string[];
  emotionWords: string[];
  hasNumber: boolean;
  uniqueness: "unique" | "duplicate";
  status: "good" | "warn" | "bad";
}

export interface ScoreResult {
  variants: TitleScore[];
  winner?: TitleScore;
  duplicates: { ids: string[]; preview: string }[];
  recommendation: string;
}

export interface BulkRow {
  url: string;
  title: string;
  charCount: number;
  pixelWidth: number;
  status: "missing" | "duplicate" | "too-long" | "too-short" | "ok";
  note: string;
}

export interface BulkResult {
  rows: BulkRow[];
  missing: number;
  duplicates: number;
  tooLong: number;
  tooShort: number;
  ok: number;
  csv: string;
}

const POWER_WORDS = [
  "best", "top", "free", "new", "now", "proven", "ultimate", "essential", "expert", "exclusive",
  "instant", "easy", "guaranteed", "complete", "simple", "powerful", "advanced", "official",
  "trusted", "verified", "premium", "limited", "save", "discount", "cheap", "fast", "secure",
];

const EMOTION_WORDS = [
  "amazing", "incredible", "stunning", "shocking", "love", "secret", "hidden", "warning",
  "danger", "breakthrough", "revolutionary", "unbelievable", "remarkable", "effortless",
  "thrilling", "worry-free", "must-have", "game-changer", "epic", "smart",
];

/** Approximate pixel width (Arial 18px title). */
export function estimatePixelWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 5;
    else if (ch === "i" || ch === "l" || ch === "1" || ch === ".") width += 5;
    else if (ch === "I" || ch === "J") width += 6;
    else if (/[mwMW@]/.test(ch)) width += 16;
    else if (/[A-Z]/.test(ch)) width += 12;
    else if (/[a-z]/.test(ch)) width += 9;
    else if (/[0-9]/.test(ch)) width += 10;
    else if (/[!,;:]/.test(ch)) width += 5;
    else width += 7;
  }
  return Math.round(width);
}

/** Truncate text to fit pixel limit with ellipsis. */
export function truncateToPixels(text: string, maxPx: number): { text: string; truncated: boolean } {
  if (estimatePixelWidth(text) <= maxPx) return { text, truncated: false };
  let lo = 0;
  let hi = text.length;
  const ellipsisPx = estimatePixelWidth("…");
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (estimatePixelWidth(text.slice(0, mid)) + ellipsisPx <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  let cut = lo;
  while (cut > 0 && /[\s.,;:!?|-]/.test(text[cut - 1]!)) cut--;
  if (cut === 0) cut = lo;
  return { text: text.slice(0, cut).trimEnd() + "…", truncated: true };
}

/** Tokenize text. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).map((t) => t.trim()).filter((t) => t.length >= 2);
}

/** Check keyword appears at front of title (within first ~40 chars). */
export function isKeywordAtFront(title: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  const front = title.toLowerCase().slice(0, Math.max(40, keyword.length + 5));
  return front.includes(keyword.toLowerCase());
}

/** Detect power/emotion/number in title. */
export function findLexicalMatches(title: string): {
  powerWords: string[];
  emotionWords: string[];
  hasNumber: boolean;
} {
  const lower = title.toLowerCase();
  const powerWords = POWER_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const emotionWords = EMOTION_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const hasNumber = /\b\d+([.,]\d+)?\b/.test(title);
  return { powerWords, emotionWords, hasNumber };
}

/** Check for brand suffix (e.g., "... | BrandName" or "... — BrandName" or "... : BrandName"). */
export function detectBrandSuffix(title: string): { has: boolean; separator: BrandSeparator; brand: string } {
  const match = title.match(/\s+([\|\u2014\u2013:—-])\s+([A-Za-z0-9 &.+]+)$/);
  if (!match) return { has: false, separator: "none", brand: "" };
  const sepChar = match[1]!;
  const brand = match[2]!.trim();
  let separator: BrandSeparator = "pipe";
  if (sepChar === "|") separator = "pipe";
  else if (sepChar === "—" || sepChar === "\u2014" || sepChar === "\u2013") separator = "em-dash";
  else if (sepChar === ":") separator = "colon";
  else separator = "none";
  return { has: true, separator, brand };
}

/** Append a brand suffix to a title with the chosen separator. */
export function appendBrandSuffix(title: string, brand: string, separator: BrandSeparator): string {
  if (!brand.trim()) return title;
  const sep = separator === "pipe" ? " | " : separator === "em-dash" ? " — " : separator === "colon" ? " : " : " ";
  return `${title}${sep}${brand.trim()}`;
}

/** Score a single variant. */
export function scoreTitle(
  variant: TitleVariant,
  keyword: string,
  allVariants: TitleVariant[],
  ctrCurve: number[] = DEFAULT_CTR_CURVE
): TitleScore {
  const breakdown: { rule: string; points: number; reason: string }[] = [];
  const text = variant.title;
  const charCount = text.length;
  const pixelWidth = estimatePixelWidth(text);
  const truncatedDesktop = pixelWidth > TITLE_LIMITS.desktopPx;
  const truncatedMobile = pixelWidth > TITLE_LIMITS.mobilePx;
  const { powerWords, emotionWords, hasNumber } = findLexicalMatches(text);
  const atFront = isKeywordAtFront(text, keyword);
  const brand = detectBrandSuffix(text);

  let score = 0;
  if (atFront) { score += 25; breakdown.push({ rule: "Keyword at front", points: 25, reason: "Keyword in first 40 chars." }); }
  else if (keyword && text.toLowerCase().includes(keyword.toLowerCase())) { score += 10; breakdown.push({ rule: "Keyword present", points: 10, reason: "Keyword found but not at front." }); }

  if (powerWords.length > 0) {
    const pts = Math.min(15, powerWords.length * 5);
    score += pts;
    breakdown.push({ rule: "Power words", points: pts, reason: powerWords.join(", ") });
  }
  if (emotionWords.length > 0) {
    const pts = Math.min(10, emotionWords.length * 5);
    score += pts;
    breakdown.push({ rule: "Emotion words", points: pts, reason: emotionWords.join(", ") });
  }
  if (hasNumber) { score += 15; breakdown.push({ rule: "Number/date", points: 15, reason: "Includes a number or year." }); }
  if (brand.has) { score += 10; breakdown.push({ rule: "Brand suffix", points: 10, reason: `Brand "${brand.brand}" via ${brand.separator}.` }); }

  if (charCount >= TITLE_LIMITS.softCharMin && charCount <= TITLE_LIMITS.softCharMax) {
    score += 15; breakdown.push({ rule: "Length in range", points: 15, reason: `${charCount} chars (ideal ${TITLE_LIMITS.softCharMin}–${TITLE_LIMITS.softCharMax}).` });
  } else if (charCount > TITLE_LIMITS.softCharMax) {
    breakdown.push({ rule: "Length in range", points: 0, reason: `Too long (${charCount} > ${TITLE_LIMITS.softCharMax}); will be truncated.` });
  } else if (charCount > 0) {
    breakdown.push({ rule: "Length in range", points: 0, reason: `Too short (${charCount} < ${TITLE_LIMITS.softCharMin}).` });
  }

  const dupes = allVariants.filter((v) => v.id !== variant.id && v.title.trim().toLowerCase() === text.trim().toLowerCase());
  if (dupes.length === 0) { score += 10; breakdown.push({ rule: "Uniqueness", points: 10, reason: "No duplicates detected." }); }
  else breakdown.push({ rule: "Uniqueness", points: 0, reason: `Duplicate of ${dupes.length} other variant(s).` });
  const uniqueness: TitleScore["uniqueness"] = dupes.length > 0 ? "duplicate" : "unique";

  let status: TitleScore["status"] = "good";
  if (truncatedDesktop || charCount > TITLE_LIMITS.softCharMax || charCount < TITLE_LIMITS.softCharMin) status = "warn";
  if (charCount === 0 || uniqueness === "duplicate") status = "bad";

  // Position-aware CTR estimate: scale base curve by quality score (50..150% multiplier).
  const qualityMultiplier = 0.5 + (score / 100);  // 0.5 .. 1.5
  const ctrByPosition = ctrCurve.map((base, i) => ({
    position: i + 1,
    baseCtr: base,
    adjustedCtr: Number((base * qualityMultiplier).toFixed(2)),
  }));

  return {
    id: variant.id,
    label: variant.label,
    title: text,
    charCount,
    pixelWidth,
    truncatedDesktop,
    truncatedMobile,
    qualityScore: Math.min(100, score),
    ctrByPosition,
    breakdown,
    keywordAtFront: atFront,
    hasBrandSuffix: brand.has,
    powerWords,
    emotionWords,
    hasNumber,
    uniqueness,
    status,
  };
}

/** Score all variants and pick a winner. */
export function scoreAllTitles(
  variants: TitleVariant[],
  keyword: string,
  ctrCurve: number[] = DEFAULT_CTR_CURVE
): ScoreResult | { error: string } {
  if (variants.length === 0) return { error: "Add at least one variant." };
  if (variants.some((v) => v.title.length > TITLE_LIMITS.hardCharMax)) {
    return { error: `Title exceeds hard limit (${TITLE_LIMITS.hardCharMax} chars).` };
  }
  const scored = variants.map((v) => scoreTitle(v, keyword, variants, ctrCurve));
  const duplicates: ScoreResult["duplicates"] = [];
  const seen = new Map<string, string[]>();
  for (const v of variants) {
    const key = v.title.trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(v.id);
  }
  for (const [preview, ids] of seen) {
    if (ids.length > 1) duplicates.push({ ids, preview: preview.slice(0, 60) + (preview.length > 60 ? "…" : "") });
  }
  const sorted = [...scored].sort((a, b) => b.qualityScore - a.qualityScore);
  const winner = sorted[0];
  const recommendation = winner
    ? `Variant "${winner.label}" scores highest (${winner.qualityScore}/100). ${winner.status === "good" ? "Ready to ship." : "Address warnings before publishing."}`
    : "Add at least one variant.";
  return { variants: scored, winner, duplicates, recommendation };
}

/** Estimate CTR for a single variant at a specific position. */
export function estimateCtrAtPosition(score: TitleScore, position: number): number {
  const idx = Math.max(0, Math.min(9, position - 1));
  return score.ctrByPosition[idx]!.adjustedCtr;
}

/** Parse a bulk paste (one entry per line; "url | title" or just "url"). */
export function parseBulkInput(input: string): { url: string; title: string }[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx === -1) return { url: line, title: "" };
      return { url: line.slice(0, idx).trim(), title: line.slice(idx + 1).trim() };
    });
}

/** Bulk audit titles. */
export function auditBulk(rows: { url: string; title: string }[]): BulkResult {
  const titles = rows.map((r) => r.title.trim().toLowerCase());
  const counts = new Map<string, number>();
  for (const t of titles) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);

  const outRows: BulkRow[] = rows.map((r) => {
    const title = r.title.trim();
    const charCount = title.length;
    const px = estimatePixelWidth(title);
    let status: BulkRow["status"] = "ok";
    let note = "Looks good.";
    if (!title) { status = "missing"; note = "No title provided."; }
    else if (charCount > TITLE_LIMITS.softCharMax) { status = "too-long"; note = `Truncated (~${px}px / ${charCount} chars).`; }
    else if (charCount < TITLE_LIMITS.softCharMin) { status = "too-short"; note = `Short (${charCount} < ${TITLE_LIMITS.softCharMin}).`; }
    else if ((counts.get(title.toLowerCase()) ?? 0) > 1) { status = "duplicate"; note = "Title is duplicated across pages."; }
    return { url: r.url, title, charCount, pixelWidth: px, status, note };
  });

  const csv = [
    "url,title,chars,pixels,status,note",
    ...outRows.map((r) =>
      [r.url, r.title, r.charCount, r.pixelWidth, r.status, r.note]
        .map((f) => `"${String(f).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  return {
    rows: outRows,
    missing: outRows.filter((r) => r.status === "missing").length,
    duplicates: outRows.filter((r) => r.status === "duplicate").length,
    tooLong: outRows.filter((r) => r.status === "too-long").length,
    tooShort: outRows.filter((r) => r.status === "too-short").length,
    ok: outRows.filter((r) => r.status === "ok").length,
    csv,
  };
}

/** Find bold ranges for query terms. */
export function findBoldRanges(text: string, terms: string[]): { start: number; end: number }[] {
  if (terms.length === 0) return [];
  const ranges: { start: number; end: number }[] = [];
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (!term) continue;
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      ranges.push({ start: idx, end: idx + term.length });
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [ranges[0]!];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1]!;
    const cur = ranges[i]!;
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else merged.push(cur);
  }
  return merged;
}

/** Encode/decode preset for sharing. */
export function encodePreset(variants: TitleVariant[], keyword: string): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify({ variants, keyword })))); }
  catch { return ""; }
}
export function decodePreset(encoded: string): { variants: TitleVariant[]; keyword: string } | { error: string } {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as { variants: TitleVariant[]; keyword: string };
    if (!Array.isArray(parsed.variants)) return { error: "Invalid preset." };
    return parsed;
  } catch { return { error: "Could not decode preset." }; }
}
