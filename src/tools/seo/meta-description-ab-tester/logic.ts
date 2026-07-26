/**
 * Meta Description Generator & A/B Tester — pure logic.
 * Pixel-accurate SERP preview, CTR-heuristic scoring, bulk audit,
 * on-device draft generator, keyword bolding.
 *
 * Reference: blueprint §5 (feature set) and §10 (acceptance criteria).
 * 100% client-side, no network.
 */

export const META_LIMITS = {
  desktopPx: 920,
  mobilePx: 990,
  softCharMin: 70,
  softCharMax: 160,
  hardCharMax: 300,
} as const;

export interface Variant {
  id: string;
  label: string;
  description: string;
}

export interface VariantScore {
  id: string;
  label: string;
  charCount: number;
  pixelWidth: number;
  truncatedDesktop: boolean;
  truncatedMobile: boolean;
  score: number;
  breakdown: { rule: string; points: number; reason: string }[];
  keywordAtFront: boolean;
  powerWords: string[];
  emotionWords: string[];
  hasNumber: boolean;
  hasCta: boolean;
  uniqueness: "unique" | "duplicate";
  status: "good" | "warn" | "bad";
}

export interface ScoreResult {
  variants: VariantScore[];
  winner?: VariantScore;
  duplicates: { ids: string[]; preview: string }[];
  recommendation: string;
}

export interface BulkRow {
  url: string;
  description: string;
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
  "free", "new", "now", "best", "top", "proven", "exclusive", "instant", "easy", "guaranteed",
  "ultimate", "essential", "expert", "limited", "save", "discount", "cheap", "fast", "secure",
  "official", "trusted", "verified", "premium", "advanced", "complete", "simple", "powerful",
];

const EMOTION_WORDS = [
  "amazing", "incredible", "stunning", "shocking", "love", "hate", "fear", "win", "lose",
  "secret", "hidden", "warning", "danger", "breakthrough", "revolutionary", "game-changer",
  "unbelievable", "remarkable", "effortless", "joy", "worry", "thrilled", "confident",
];

const CTA_PHRASES = [
  "learn more", "read more", "discover", "explore", "get started", "sign up", "buy now",
  "shop now", "try", "download", "find out", "see", "compare", "browse", "start", "join",
  "click", "view", "check out", "today", "now", "free",
];

/** Approximate pixel width (Arial 16px). */
export function estimatePixelWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 4;
    else if (ch === "i" || ch === "l" || ch === "1" || ch === ".") width += 4;
    else if (ch === "I" || ch === "J") width += 5;
    else if (/[mwMW@]/.test(ch)) width += 13;
    else if (/[A-Z]/.test(ch)) width += 10;
    else if (/[a-z]/.test(ch)) width += 7.5;
    else if (/[0-9]/.test(ch)) width += 8;
    else if (/[!,;:]/.test(ch)) width += 4;
    else width += 6;
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
  while (cut > 0 && /[\s.,;:!?-]/.test(text[cut - 1]!)) cut--;
  if (cut === 0) cut = lo;
  return { text: text.slice(0, cut).trimEnd() + "…", truncated: true };
}

/** Tokenize keyword/query into lowercase terms (>=2 chars). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).map((t) => t.trim()).filter((t) => t.length >= 2);
}

/** Check if keyword phrase appears at the front of description (first ~30 chars). */
export function isKeywordAtFront(description: string, keyword: string): boolean {
  if (!keyword) return false;
  const front = description.toLowerCase().slice(0, Math.max(30, keyword.length + 5));
  return front.includes(keyword.toLowerCase());
}

/** Find power/emotion/CTA words present in description. */
export function findLexicalMatches(description: string): {
  powerWords: string[];
  emotionWords: string[];
  hasCta: boolean;
  hasNumber: boolean;
} {
  const lower = description.toLowerCase();
  const powerWords = POWER_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const emotionWords = EMOTION_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const hasCta = CTA_PHRASES.some((p) => lower.includes(p));
  const hasNumber = /\b\d+([.,]\d+)?\b/.test(description);
  return { powerWords, emotionWords, hasCta, hasNumber };
}

/** Score a single variant against a keyword. */
export function scoreVariant(variant: Variant, keyword: string, allVariants: Variant[]): VariantScore {
  const breakdown: { rule: string; points: number; reason: string }[] = [];
  const text = variant.description;
  const charCount = text.length;
  const pixelWidth = estimatePixelWidth(text);
  const truncatedDesktop = pixelWidth > META_LIMITS.desktopPx;
  const truncatedMobile = pixelWidth > META_LIMITS.mobilePx;

  const { powerWords, emotionWords, hasCta, hasNumber } = findLexicalMatches(text);
  const atFront = isKeywordAtFront(text, keyword);

  let score = 0;
  if (atFront) { score += 25; breakdown.push({ rule: "Keyword at front", points: 25, reason: "Keyword appears in first 30 chars." }); }
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
  if (hasNumber) { score += 15; breakdown.push({ rule: "Numbers/dates", points: 15, reason: "Includes a number or date." }); }
  if (hasCta) { score += 15; breakdown.push({ rule: "Call-to-action", points: 15, reason: "Includes a CTA phrase." }); }

  if (charCount >= META_LIMITS.softCharMin && charCount <= META_LIMITS.softCharMax) {
    score += 10;
    breakdown.push({ rule: "Length in range", points: 10, reason: `${charCount} chars (ideal ${META_LIMITS.softCharMin}–${META_LIMITS.softCharMax}).` });
  } else if (charCount > 0 && charCount < META_LIMITS.softCharMin) {
    breakdown.push({ rule: "Length in range", points: 0, reason: `Too short (${charCount} < ${META_LIMITS.softCharMin}).` });
  } else if (charCount > META_LIMITS.softCharMax) {
    breakdown.push({ rule: "Length in range", points: 0, reason: `Too long (${charCount} > ${META_LIMITS.softCharMax}); will be truncated.` });
  }

  const dupes = allVariants.filter((v) => v.id !== variant.id && v.description.trim().toLowerCase() === text.trim().toLowerCase());
  if (dupes.length === 0) { score += 10; breakdown.push({ rule: "Uniqueness", points: 10, reason: "No duplicates detected." }); }
  else breakdown.push({ rule: "Uniqueness", points: 0, reason: `Duplicate of ${dupes.length} other variant(s).` });

  const uniqueness: VariantScore["uniqueness"] = dupes.length > 0 ? "duplicate" : "unique";
  let status: VariantScore["status"] = "good";
  if (truncatedDesktop || charCount > META_LIMITS.softCharMax || charCount < META_LIMITS.softCharMin) status = "warn";
  if (charCount === 0 || uniqueness === "duplicate") status = "bad";

  return {
    id: variant.id,
    label: variant.label,
    charCount,
    pixelWidth,
    truncatedDesktop,
    truncatedMobile,
    score: Math.min(100, score),
    breakdown,
    keywordAtFront: atFront,
    powerWords,
    emotionWords,
    hasNumber,
    hasCta,
    uniqueness,
    status,
  };
}

/** Score all variants and pick a winner. */
export function scoreAllVariants(variants: Variant[], keyword: string): ScoreResult | { error: string } {
  if (variants.length === 0) return { error: "Add at least one variant." };
  if (variants.some((v) => v.description.length > META_LIMITS.hardCharMax)) {
    return { error: `Description exceeds hard limit (${META_LIMITS.hardCharMax} chars).` };
  }
  const scored = variants.map((v) => scoreVariant(v, keyword, variants));
  const duplicates: ScoreResult["duplicates"] = [];
  const seen = new Map<string, string[]>();
  for (const v of variants) {
    const key = v.description.trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(v.id);
  }
  for (const [preview, ids] of seen) {
    if (ids.length > 1) duplicates.push({ ids, preview: preview.slice(0, 80) + (preview.length > 80 ? "…" : "") });
  }
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const recommendation = winner
    ? `Variant "${winner.label}" scores highest (${winner.score}/100). ${winner.status === "good" ? "Ready to ship." : "Address warnings before publishing."}`
    : "Add at least one variant.";
  return { variants: scored, winner, duplicates, recommendation };
}

/** Generate a draft description from pasted page content (extractive). */
export function generateDraftFromContent(content: string, keyword: string, maxChars = 155): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  const kwLower = keyword.toLowerCase();
  // Prefer sentences that contain the keyword.
  const scored = sentences.map((s, i) => {
    let sScore = 0;
    if (s.toLowerCase().includes(kwLower)) sScore += 10;
    if (i === 0) sScore += 3;
    if (/\d/.test(s)) sScore += 2;
    return { s, sScore };
  }).sort((a, b) => b.sScore - a.sScore);
  let draft = "";
  for (const { s } of scored) {
    const candidate = draft ? draft + " " + s : s;
    if (candidate.length > maxChars) {
      // Truncate cleanly.
      let cut = maxChars;
      while (cut > 0 && !/[\s.,;:!?-]/.test(candidate[cut - 1]!)) cut--;
      if (cut < maxChars - 30) cut = maxChars;  // no good break point; hard cut
      draft = candidate.slice(0, Math.max(0, cut)).trimEnd();
      if (draft.length < maxChars - 1) draft += "…";
      break;
    }
    draft = candidate;
    if (draft.length >= maxChars - 30) break;
  }
  // Optionally prepend keyword if not present.
  if (keyword && draft && !draft.toLowerCase().includes(kwLower)) {
    draft = `${keyword}: ${draft}`.slice(0, maxChars);
  }
  return draft;
}

/** Parse a bulk paste (one entry per line; "url | description" or just "url"). */
export function parseBulkInput(input: string): { url: string; description: string }[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx === -1) return { url: line, description: "" };
      return { url: line.slice(0, idx).trim(), description: line.slice(idx + 1).trim() };
    });
}

/** Run a bulk audit on a list of URL + description rows. */
export function auditBulk(rows: { url: string; description: string }[]): BulkResult {
  const descriptions = rows.map((r) => r.description.trim().toLowerCase());
  const counts = new Map<string, number>();
  for (const d of descriptions) if (d) counts.set(d, (counts.get(d) ?? 0) + 1);

  const outRows: BulkRow[] = rows.map((r) => {
    const desc = r.description.trim();
    const charCount = desc.length;
    const px = estimatePixelWidth(desc);
    let status: BulkRow["status"] = "ok";
    let note = "Looks good.";
    if (!desc) { status = "missing"; note = "No description provided."; }
    else if (charCount > META_LIMITS.softCharMax) { status = "too-long"; note = `Truncated (~${px}px / ${charCount} chars).`; }
    else if (charCount < META_LIMITS.softCharMin) { status = "too-short"; note = `Short (${charCount} < ${META_LIMITS.softCharMin}); consider expanding.`; }
    else if ((counts.get(desc.toLowerCase()) ?? 0) > 1) { status = "duplicate"; note = "Description is duplicated across pages."; }
    return { url: r.url, description: desc, charCount, pixelWidth: px, status, note };
  });

  const csv = [
    "url,description,chars,pixels,status,note",
    ...outRows.map((r) =>
      [r.url, r.description, r.charCount, r.pixelWidth, r.status, r.note]
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

/** Find bold ranges for query terms in a text. */
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

/** Encode/decode preset (base64 JSON) for sharing variant sets. */
export function encodePreset(variants: Variant[], keyword: string): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify({ variants, keyword })))); }
  catch { return ""; }
}
export function decodePreset(encoded: string): { variants: Variant[]; keyword: string } | { error: string } {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as { variants: Variant[]; keyword: string };
    if (!Array.isArray(parsed.variants)) return { error: "Invalid preset." };
    return parsed;
  } catch { return { error: "Could not decode preset." }; }
}
