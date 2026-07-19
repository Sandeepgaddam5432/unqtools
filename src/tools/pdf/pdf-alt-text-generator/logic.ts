/**
 * PDF Alt Text Generator — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF page/image scanning
 * and /Alt entry writing lives in ui.tsx; this module handles alt-text parsing,
 * validation, decorative marking, summary stats, multi-format rendering, history
 * (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface AltTextOptions {
  /** Page-range spec, e.g. "all" or "1-3, 5". */
  pageRange: string;
  /** Auto-generate placeholder alt text for images with none. */
  autoGenerate: boolean;
  /** Mark images without user-provided alt text as decorative (Alt=""). */
  markAsDecorative: boolean;
}

export const DEFAULT_OPTIONS: AltTextOptions = {
  pageRange: "all",
  autoGenerate: false,
  markAsDecorative: false,
};

/** WCAG 2.1 SC 1.1.1 — maximum recommended alt text length. */
export const WCAG_MAX_ALT_LENGTH = 125;
/** Minimum alt text length to be considered "descriptive". */
export const MIN_DESCRIPTIVE_ALT_LENGTH = 4;
/** Hard upper limit (PDF readers may truncate extremely long alt text). */
export const HARD_MAX_ALT_LENGTH = 1000;

/** Image types the heuristic detector can guess. */
export type ImageType = "photo" | "diagram" | "chart" | "decorative" | "unknown";

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  photo: "Photograph",
  diagram: "Diagram",
  chart: "Chart",
  decorative: "Decorative",
  unknown: "Unknown",
};

/** Raw per-image data extracted from the PDF by ui.tsx. */
export interface ImageEntry {
  /** 1-based page number. */
  page: number;
  /** 0-based index of the image within the page's XObject dictionary. */
  imageIndex: number;
  /** XObject resource name, e.g. "Im1". */
  name: string;
  /** Width in pixels (if available). */
  width: number;
  /** Height in pixels (if available). */
  height: number;
  /** Color space name, e.g. "DeviceRGB". */
  colorSpace: string;
  /** Bits per component. */
  bitsPerComponent: number;
  /** True if the image already has /Alt or /ActualText. */
  hasAlt: boolean;
  /** Existing alt text (if any). */
  existingAlt: string;
  /** True if the image is already marked as decorative (empty /Alt or /Artifact). */
  isDecorative: boolean;
  /** True if the image is a Form XObject (used as a container, not a raster). */
  isForm: boolean;
}

export interface ParsedAltEntry {
  page: number;
  imageIndex: number;
  altText: string;
}

export type AltAction = "applied" | "skipped" | "marked-decorative" | "unchanged" | "error";

export interface ApplyResult {
  page: number;
  imageIndex: number;
  altText: string;
  action: AltAction;
  message: string;
}

export interface AltQualityScore {
  /** 0–100 overall quality score. */
  score: number;
  /** Length penalty flags. */
  tooShort: boolean;
  tooLong: boolean;
  /** Heuristic content flags. */
  looksLikeFilename: boolean;
  looksLikePlaceholder: boolean;
  /** Descriptive word count. */
  wordCount: number;
  /** Suggested improvement (empty when none). */
  suggestion: string;
}

export interface WcagComplianceResult {
  /** SC 1.1.1 reference. */
  criterion: string;
  /** Total informative (non-decorative) images. */
  totalImages: number;
  /** Images with alt text present (non-empty). */
  withAlt: number;
  /** Images marked decorative. */
  decorative: number;
  /** Images missing alt text entirely. */
  missing: number;
  /** Compliance percentage 0–100. */
  compliancePct: number;
  /** True when all informative images have alt text. */
  passed: boolean;
  /** List of issues (page, imageIndex, reason). */
  issues: { page: number; imageIndex: number; reason: string }[];
}

export interface SummaryStats {
  totalPages: number;
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  decorativeCount: number;
  appliedCount: number;
  skippedCount: number;
  unchangedCount: number;
  errorCount: number;
  /** Alt-text coverage percentage (including decorative as compliant). */
  coveragePct: number;
  /** WCAG compliance percentage. */
  wcagPct: number;
  byPage: { page: number; total: number; withAlt: number; decorative: number; missing: number }[];
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  totalImages: number;
  appliedCount: number;
  decorativeCount: number;
  wcagPct: number;
}

// ---------------------------------------------------------------------------
// Page-range normalization
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Alt-text textarea parser
// ---------------------------------------------------------------------------

/**
 * Parse a textarea of pipe-separated alt-text entries.
 *
 * Format per line: `page|image_index|alt_text`
 *  - Lines starting with # are comments and skipped.
 *  - Empty lines are skipped.
 *  - Lines without two pipes are skipped (with the count returned).
 *  - The alt_text field may contain spaces, commas, and other punctuation.
 *  - Whitespace around page/imageIndex/altText is trimmed.
 *  - page and image_index must be non-negative integers.
 *
 * Returns a ToolResult so callers can surface parse-error counts.
 */
export function parseAltTextData(input: string): ToolResult<{
  entries: ParsedAltEntry[];
  skipped: number;
  skippedExamples: string[];
}> {
  const lines = (input ?? "").split(/\r?\n/);
  const entries: ParsedAltEntry[] = [];
  let skipped = 0;
  const skippedExamples: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    const firstPipe = line.indexOf("|");
    const lastPipe = line.lastIndexOf("|");
    if (firstPipe === -1 || firstPipe === lastPipe) {
      skipped += 1;
      if (skippedExamples.length < 3) skippedExamples.push(line);
      continue;
    }
    const pageStr = line.slice(0, firstPipe).trim();
    const indexStr = line.slice(firstPipe + 1, lastPipe).trim();
    const altText = line.slice(lastPipe + 1).trim();
    const page = Number(pageStr);
    const imageIndex = Number(indexStr);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(imageIndex) || imageIndex < 0) {
      skipped += 1;
      if (skippedExamples.length < 3) skippedExamples.push(line);
      continue;
    }
    entries.push({ page, imageIndex, altText });
  }
  if (entries.length === 0 && skipped > 0) {
    return {
      ok: false,
      error: `Could not parse any alt-text entries. Skipped ${skipped} line(s). Use the format: page|image_index|alt_text`,
    };
  }
  return { ok: true, output: { entries, skipped, skippedExamples } };
}

/** Render a list of ParsedAltEntry back to a textarea-compatible string. */
export function serializeAltTextData(entries: ParsedAltEntry[]): string {
  return entries
    .map((e) => `${e.page}|${e.imageIndex}|${e.altText}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Alt-text validation
// ---------------------------------------------------------------------------

export function validateAltText(altText: string): { valid: boolean; reason: string } {
  const trimmed = (altText ?? "").trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "Alt text is empty." };
  }
  if (trimmed.length > HARD_MAX_ALT_LENGTH) {
    return { valid: false, reason: `Alt text exceeds ${HARD_MAX_ALT_LENGTH} characters (may be truncated by readers).` };
  }
  return { valid: true, reason: "" };
}

/** Score alt-text quality on a 0–100 scale. */
export function scoreAltText(altText: string): AltQualityScore {
  const trimmed = (altText ?? "").trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_DESCRIPTIVE_ALT_LENGTH;
  const tooLong = trimmed.length > WCAG_MAX_ALT_LENGTH;
  const looksLikeFilename = /\.(png|jpg|jpeg|gif|bmp|tiff?|webp|svg|pdf)$/i.test(trimmed) || /^img[_-]?\d/i.test(trimmed);
  const looksLikePlaceholder = /^(image|img|figure|fig|photo|picture)[ _-]?\d+$/i.test(trimmed) || /^(untitled|placeholder|alt text|none)$/i.test(trimmed);

  let score = 100;
  if (tooShort) score -= 40;
  if (tooLong) score -= 20;
  if (looksLikeFilename) score -= 30;
  if (looksLikePlaceholder) score -= 25;
  if (wordCount < 3 && trimmed.length > 0) score -= 15;
  if (wordCount > 30) score -= 5;
  score = Math.max(0, Math.min(100, score));

  const suggestionParts: string[] = [];
  if (looksLikeFilename) suggestionParts.push("Avoid filenames — describe what the image shows.");
  if (looksLikePlaceholder) suggestionParts.push("Avoid generic labels — describe the image content.");
  if (tooShort) suggestionParts.push(`Add at least ${MIN_DESCRIPTIVE_ALT_LENGTH} characters of description.`);
  if (tooLong) suggestionParts.push(`Shorten to under ${WCAG_MAX_ALT_LENGTH} characters for screen readers.`);
  if (wordCount > 0 && wordCount < 3 && !looksLikeFilename && !looksLikePlaceholder) {
    suggestionParts.push("Add more detail — aim for 5–20 words.");
  }

  return {
    score,
    tooShort,
    tooLong,
    looksLikeFilename,
    looksLikePlaceholder,
    wordCount,
    suggestion: suggestionParts.join(" "),
  };
}

// ---------------------------------------------------------------------------
// Auto-alt-text generator
// ---------------------------------------------------------------------------

/** Generate a placeholder alt text like "Image 1 on page 2". */
export function generateAutoAltText(imageIndex: number, page: number): string {
  return `Image ${imageIndex + 1} on page ${page}`;
}

/** Generate auto alt text for every image missing one. */
export function generateAutoAltEntries(images: ImageEntry[]): ParsedAltEntry[] {
  return images
    .filter((img) => !img.hasAlt && !img.isDecorative)
    .map((img) => ({
      page: img.page,
      imageIndex: img.imageIndex,
      altText: generateAutoAltText(img.imageIndex, img.page),
    }));
}

// ---------------------------------------------------------------------------
// Missing-alt finder & image list formatting
// ---------------------------------------------------------------------------

export function findMissingAlt(images: ImageEntry[]): ImageEntry[] {
  return images.filter((img) => !img.hasAlt && !img.isDecorative);
}

export function formatImageList(images: ImageEntry[]): string[] {
  return images.map((img) => {
    const status = img.isDecorative
      ? "[decorative]"
      : img.hasAlt
        ? "[has alt]"
        : "[missing alt]";
    const dims = img.width > 0 && img.height > 0 ? ` ${img.width}×${img.height}` : "";
    const alt = img.existingAlt ? ` alt="${truncate(img.existingAlt, 60)}"` : "";
    return `Page ${img.page} • Image #${img.imageIndex} (${img.name})${dims} ${status}${alt}`;
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// ---------------------------------------------------------------------------
// Apply-plan builder (the ui.tsx walks images, calls this to know what to do)
// ---------------------------------------------------------------------------

export interface ApplyPlan {
  page: number;
  imageIndex: number;
  altText: string;
  action: Exclude<AltAction, "unchanged" | "error">;
}

/**
 * Compute the apply plan given the image list and the parsed alt-text entries.
 *
 * - For each user-provided entry that targets an existing image, action = "applied".
 * - If markAsDecorative is true and an image has no user-provided alt and no existing
 *   alt, action = "marked-decorative".
 * - If autoGenerate is true and an image has no user-provided alt and no existing
 *   alt and markAsDecorative is false, action = "applied" with auto-generated text.
 * - Images with existing alt not overridden are left alone (no entry in the plan).
 */
export function buildApplyPlan(
  images: ImageEntry[],
  userEntries: ParsedAltEntry[],
  opts: AltTextOptions,
): ApplyPlan[] {
  const byKey = new Map<string, ParsedAltEntry>();
  for (const e of userEntries) byKey.set(`${e.page}:${e.imageIndex}`, e);
  const plan: ApplyPlan[] = [];
  for (const img of images) {
    const userEntry = byKey.get(`${img.page}:${img.imageIndex}`);
    if (userEntry) {
      plan.push({
        page: img.page,
        imageIndex: img.imageIndex,
        altText: userEntry.altText,
        action: "applied",
      });
      continue;
    }
    if (img.hasAlt || img.isDecorative) continue;
    if (opts.markAsDecorative) {
      plan.push({
        page: img.page,
        imageIndex: img.imageIndex,
        altText: "",
        action: "marked-decorative",
      });
    } else if (opts.autoGenerate) {
      plan.push({
        page: img.page,
        imageIndex: img.imageIndex,
        altText: generateAutoAltText(img.imageIndex, img.page),
        action: "applied",
      });
    }
  }
  return plan;
}

/** Build a summary of ApplyResult objects after execution. */
export function summarizeApplyResults(results: ApplyResult[]): {
  applied: number;
  skipped: number;
  markedDecorative: number;
  unchanged: number;
  error: number;
} {
  const out = { applied: 0, skipped: 0, markedDecorative: 0, unchanged: 0, error: 0 };
  for (const r of results) {
    if (r.action === "applied") out.applied += 1;
    else if (r.action === "skipped") out.skipped += 1;
    else if (r.action === "marked-decorative") out.markedDecorative += 1;
    else if (r.action === "unchanged") out.unchanged += 1;
    else out.error += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Image type detector (heuristic — based on metadata, not pixels)
// ---------------------------------------------------------------------------

/**
 * Heuristic image-type classifier based on metadata hints.
 * Real classification would need pixel analysis; this uses dimensions,
 * color space, and name as a rough triage.
 */
export function detectImageType(img: ImageEntry): ImageType {
  if (img.isDecorative) return "decorative";
  const name = (img.name ?? "").toLowerCase();
  const cs = (img.colorSpace ?? "").toLowerCase();
  // Tiny images are often decorative spacers or bullets.
  if (img.width > 0 && img.height > 0 && img.width <= 32 && img.height <= 32) return "decorative";
  // Names often hint at content.
  if (/chart|graph|plot/.test(name)) return "chart";
  if (/diagram|schema|figure|fig/.test(name)) return "diagram";
  if (/decor|spacer|bullet|bg|background/.test(name)) return "decorative";
  // 1-bpc = line art, almost always a diagram.
  if (img.bitsPerComponent === 1) return "diagram";
  // Grayscale + low-bpc images are often diagrams; RGB photographs.
  if (cs.includes("gray") || cs.includes("cmyk")) return "diagram";
  if (cs.includes("rgb") || cs.includes("calrgb")) return "photo";
  return "unknown";
}

// ---------------------------------------------------------------------------
// WCAG compliance checker
// ---------------------------------------------------------------------------

export function checkWcagCompliance(images: ImageEntry[]): WcagComplianceResult {
  const total = images.length;
  let withAlt = 0;
  let decorative = 0;
  let missing = 0;
  const issues: { page: number; imageIndex: number; reason: string }[] = [];
  for (const img of images) {
    if (img.isDecorative) {
      decorative += 1;
      continue;
    }
    if (img.hasAlt && img.existingAlt.trim().length > 0) {
      withAlt += 1;
    } else {
      missing += 1;
      issues.push({
        page: img.page,
        imageIndex: img.imageIndex,
        reason: "Informative image has no alt text.",
      });
    }
  }
  const informative = total - decorative;
  const compliancePct = informative > 0
    ? Math.round((withAlt / informative) * 1000) / 10
    : 100;
  return {
    criterion: "WCAG 2.1 SC 1.1.1 Non-text Content",
    totalImages: total,
    withAlt,
    decorative,
    missing,
    compliancePct,
    passed: missing === 0,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Page-by-page image count
// ---------------------------------------------------------------------------

export function countImagesPerPage(images: ImageEntry[]): { page: number; total: number; withAlt: number; decorative: number; missing: number }[] {
  const byPage = new Map<number, { total: number; withAlt: number; decorative: number; missing: number }>();
  for (const img of images) {
    const entry = byPage.get(img.page) ?? { total: 0, withAlt: 0, decorative: 0, missing: 0 };
    entry.total += 1;
    if (img.isDecorative) entry.decorative += 1;
    else if (img.hasAlt && img.existingAlt.trim().length > 0) entry.withAlt += 1;
    else entry.missing += 1;
    byPage.set(img.page, entry);
  }
  return Array.from(byPage.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([page, e]) => ({ page, ...e }));
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(
  images: ImageEntry[],
  applyResults: ApplyResult[],
  totalPages: number,
): SummaryStats {
  const totalImages = images.length;
  const imagesWithAlt = images.filter((i) => i.hasAlt && i.existingAlt.trim().length > 0).length
    + applyResults.filter((r) => r.action === "applied").length;
  const decorativeCount = images.filter((i) => i.isDecorative).length
    + applyResults.filter((r) => r.action === "marked-decorative").length;
  const informative = totalImages - decorativeCount;
  const imagesWithoutAlt = Math.max(0, informative - imagesWithAlt);
  const summary = summarizeApplyResults(applyResults);
  const coveragePct = totalImages > 0
    ? Math.round(((imagesWithAlt + decorativeCount) / totalImages) * 1000) / 10
    : 100;
  const wcag = checkWcagCompliance(images);
  return {
    totalPages,
    totalImages,
    imagesWithAlt,
    imagesWithoutAlt,
    decorativeCount,
    appliedCount: summary.applied,
    skippedCount: summary.skipped,
    unchangedCount: summary.unchanged,
    errorCount: summary.error,
    coveragePct,
    wcagPct: wcag.compliancePct,
    byPage: countImagesPerPage(images),
  };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeJson(s: string): string {
  return JSON.stringify(s);
}

export function renderTextReport(
  images: ImageEntry[],
  applyResults: ApplyResult[],
  summary: SummaryStats,
  wcag: WcagComplianceResult,
): string {
  const lines: string[] = [];
  lines.push("PDF Alt Text Report");
  lines.push("==================");
  lines.push("");
  lines.push(`Pages: ${summary.totalPages}`);
  lines.push(`Images: ${summary.totalImages}`);
  lines.push(`  With alt text: ${summary.imagesWithAlt}`);
  lines.push(`  Without alt text: ${summary.imagesWithoutAlt}`);
  lines.push(`  Decorative: ${summary.decorativeCount}`);
  lines.push(`  Coverage: ${summary.coveragePct}%`);
  lines.push(`  WCAG compliance: ${summary.wcagPct}%`);
  lines.push("");
  lines.push(`${wcag.criterion}: ${wcag.passed ? "PASS" : "FAIL"}`);
  lines.push(`  Informative images: ${wcag.totalImages - wcag.decorative}`);
  lines.push(`  With alt: ${wcag.withAlt}`);
  lines.push(`  Missing: ${wcag.missing}`);
  if (wcag.issues.length > 0) {
    lines.push("  Issues:");
    for (const issue of wcag.issues.slice(0, 50)) {
      lines.push(`    - Page ${issue.page} image #${issue.imageIndex}: ${issue.reason}`);
    }
    if (wcag.issues.length > 50) {
      lines.push(`    ... and ${wcag.issues.length - 50} more`);
    }
  }
  lines.push("");
  if (applyResults.length > 0) {
    lines.push("Apply results");
    lines.push("-------------");
    const sum = summarizeApplyResults(applyResults);
    lines.push(`  Applied: ${sum.applied}`);
    lines.push(`  Marked decorative: ${sum.markedDecorative}`);
    lines.push(`  Skipped: ${sum.skipped}`);
    lines.push(`  Unchanged: ${sum.unchanged}`);
    lines.push(`  Errors: ${sum.error}`);
    lines.push("");
  }
  lines.push("Images per page");
  lines.push("---------------");
  for (const p of summary.byPage) {
    lines.push(`  Page ${p.page}: ${p.total} image(s) — ${p.withAlt} with alt, ${p.decorative} decorative, ${p.missing} missing`);
  }
  lines.push("");
  lines.push("Image list");
  lines.push("----------");
  for (const line of formatImageList(images)) {
    lines.push(`  ${line}`);
  }
  return lines.join("\n");
}

export function renderCsvReport(images: ImageEntry[]): string {
  const rows: string[] = [];
  rows.push("page,image_index,name,width,height,color_space,has_alt,is_decorative,alt_text");
  for (const img of images) {
    rows.push([
      img.page,
      img.imageIndex,
      escapeCsv(img.name),
      img.width,
      img.height,
      escapeCsv(img.colorSpace),
      img.hasAlt ? "yes" : "no",
      img.isDecorative ? "yes" : "no",
      escapeCsv(img.existingAlt),
    ].join(","));
  }
  return rows.join("\n");
}

export function renderJsonReport(
  images: ImageEntry[],
  applyResults: ApplyResult[],
  summary: SummaryStats,
  wcag: WcagComplianceResult,
): string {
  return JSON.stringify(
    {
      summary: {
        totalPages: summary.totalPages,
        totalImages: summary.totalImages,
        imagesWithAlt: summary.imagesWithAlt,
        imagesWithoutAlt: summary.imagesWithoutAlt,
        decorativeCount: summary.decorativeCount,
        appliedCount: summary.appliedCount,
        skippedCount: summary.skippedCount,
        unchangedCount: summary.unchangedCount,
        errorCount: summary.errorCount,
        coveragePct: summary.coveragePct,
        wcagPct: summary.wcagPct,
      },
      wcag: {
        criterion: wcag.criterion,
        totalImages: wcag.totalImages,
        withAlt: wcag.withAlt,
        decorative: wcag.decorative,
        missing: wcag.missing,
        compliancePct: wcag.compliancePct,
        passed: wcag.passed,
        issues: wcag.issues,
      },
      byPage: summary.byPage,
      applyResults: applyResults.map((r) => ({
        page: r.page,
        imageIndex: r.imageIndex,
        altText: r.altText,
        action: r.action,
        message: r.message,
      })),
      images: images.map((i) => ({
        page: i.page,
        imageIndex: i.imageIndex,
        name: i.name,
        width: i.width,
        height: i.height,
        colorSpace: i.colorSpace,
        bitsPerComponent: i.bitsPerComponent,
        hasAlt: i.hasAlt,
        existingAlt: i.existingAlt,
        isDecorative: i.isDecorative,
        isForm: i.isForm,
      })),
    },
    null,
    2,
  );
}

/** Suggest alt text based on basic context (heuristic — wraps the auto generator). */
export function suggestAltText(img: ImageEntry, surroundingText?: string): string {
  if (surroundingText && surroundingText.trim().length > 0) {
    const firstSentence = surroundingText.trim().split(/[.\n]/)[0].trim();
    if (firstSentence.length > 0 && firstSentence.length <= WCAG_MAX_ALT_LENGTH) {
      return firstSentence;
    }
  }
  return generateAutoAltText(img.imageIndex, img.page);
}

// Suppress unused-export lint for escapeJson (kept for future CSV-JSON renderer parity).
void escapeJson;

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-alt-text-generator:history";
const HISTORY_MAX = 20;

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
      // ignore quota errors
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: AltTextOptions): string {
  const params = new URLSearchParams();
  if (opts.pageRange && opts.pageRange !== DEFAULT_OPTIONS.pageRange) params.set("range", opts.pageRange);
  if (opts.autoGenerate !== DEFAULT_OPTIONS.autoGenerate) params.set("auto", opts.autoGenerate ? "1" : "0");
  if (opts.markAsDecorative !== DEFAULT_OPTIONS.markAsDecorative) params.set("decorative", opts.markAsDecorative ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<AltTextOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<AltTextOptions> = {};
  const range = params.get("range");
  if (range) out.pageRange = range;
  const auto = params.get("auto");
  if (auto !== null) out.autoGenerate = auto === "1";
  const decorative = params.get("decorative");
  if (decorative !== null) out.markAsDecorative = decorative === "1";
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: AltTextOptions, pageCount: number): ToolResult<AltTextOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  if (opts.autoGenerate && opts.markAsDecorative) {
    return { ok: false, error: "Cannot auto-generate alt text and mark images as decorative at the same time. Choose one." };
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
