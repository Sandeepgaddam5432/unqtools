/**
 * PDF Header & Footer Adder — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF drawing lives in
 * ui.tsx; this module handles variable substitution, page-range parsing,
 * position/margin math, color parsing, multi-format rendering, history
 * (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type Position = "left" | "center" | "right";
export type PageNumberFormat = "x" | "x-of-n" | "page-x-of-n";
export type DateFormat = "yyyy-mm-dd" | "mm/dd/yyyy" | "dd/mm/yyyy";

export interface HeaderFooterOptions {
  headerText: string;
  footerText: string;
  headerPosition: Position;
  footerPosition: Position;
  fontSize: number;
  /** Hex string like "#000000". */
  textColor: string;
  /** Points from top of page. */
  marginTop: number;
  /** Points from bottom of page. */
  marginBottom: number;
  /** "all" or a spec like "1-3, 5, 8-". */
  pageRange: string;
  firstPageDifferent: boolean;
  firstPageHeader: string;
  firstPageFooter: string;
  pageNumberFormat: PageNumberFormat;
  dateFormat: DateFormat;
}

export interface VariableContext {
  /** 1-indexed. */
  page: number;
  total: number;
  title: string;
  author: string;
  /** Already-formatted date string. */
  date: string;
  filename: string;
}

export interface PageRender {
  /** 1-indexed. */
  pageNumber: number;
  /** Substituted header text (empty string if no header). */
  headerText: string;
  /** Substituted footer text (empty string if no footer). */
  footerText: string;
  headerPosition: Position;
  footerPosition: Position;
  /** True if page is outside the configured page range. */
  skipped: boolean;
}

export interface SummaryStats {
  totalPages: number;
  processedPages: number;
  skippedPages: number;
  pagesWithHeader: number;
  pagesWithFooter: number;
  byHeaderPosition: Record<Position, number>;
  byFooterPosition: Record<Position, number>;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  headerPreview: string;
  footerPreview: string;
  pagesProcessed: number;
}

export const VARIABLES = [
  "{page}",
  "{total}",
  "{title}",
  "{date}",
  "{author}",
  "{filename}",
] as const;
export type Variable = (typeof VARIABLES)[number];

export const POSITION_PRESETS: Position[] = ["left", "center", "right"];

export const POSITION_LABELS: Record<Position, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

export const PAGE_NUMBER_FORMATS: PageNumberFormat[] = ["x", "x-of-n", "page-x-of-n"];

export const PAGE_NUMBER_FORMAT_LABELS: Record<PageNumberFormat, string> = {
  "x": "1, 2, 3",
  "x-of-n": "1 of 10",
  "page-x-of-n": "Page 1 of 10",
};

export const DATE_FORMATS: DateFormat[] = ["yyyy-mm-dd", "mm/dd/yyyy", "dd/mm/yyyy"];

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  "yyyy-mm-dd": "2024-12-31",
  "mm/dd/yyyy": "12/31/2024",
  "dd/mm/yyyy": "31/12/2024",
};

export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 72;
export const MARGIN_MIN = 0;
export const MARGIN_MAX = 500;
export const PAGE_COUNT_MAX = 10000;

export const DEFAULT_OPTIONS: HeaderFooterOptions = {
  headerText: "",
  footerText: "Page {page} of {total}",
  headerPosition: "center",
  footerPosition: "center",
  fontSize: 10,
  textColor: "#000000",
  marginTop: 30,
  marginBottom: 30,
  pageRange: "all",
  firstPageDifferent: false,
  firstPageHeader: "",
  firstPageFooter: "",
  pageNumberFormat: "page-x-of-n",
  dateFormat: "yyyy-mm-dd",
};

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

export function normalizeText(s: string): string {
  return (s ?? "").replace(/\r\n/g, "\n");
}

/** Split a header/footer text into its lines (for multi-line rendering). */
export function splitMultiline(text: string): string[] {
  if (!text) return [];
  return normalizeText(text).split("\n");
}

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

/** List which variables appear in the text. */
export function parseVariablesInUse(text: string): Variable[] {
  const found: Variable[] = [];
  for (const v of VARIABLES) {
    if (text.includes(v)) found.push(v);
  }
  return found;
}

/** Substitute {page}, {total}, {title}, {date}, {author}, {filename}. */
export function substituteVariables(text: string, ctx: VariableContext): string {
  if (!text) return "";
  return text
    .replace(/\{page\}/g, String(ctx.page))
    .replace(/\{total\}/g, String(ctx.total))
    .replace(/\{title\}/g, ctx.title || "")
    .replace(/\{date\}/g, ctx.date || "")
    .replace(/\{author\}/g, ctx.author || "")
    .replace(/\{filename\}/g, ctx.filename || "");
}

/**
 * Check whether the variables in `text` can be resolved against `ctx`.
 * Returns the list of variables whose underlying value is empty/missing.
 */
export function checkVariableAvailability(text: string, ctx: VariableContext): Variable[] {
  const inUse = parseVariablesInUse(text);
  const missing: Variable[] = [];
  for (const v of inUse) {
    if (v === "{title}" && !ctx.title) missing.push(v);
    else if (v === "{author}" && !ctx.author) missing.push(v);
    else if (v === "{filename}" && !ctx.filename) missing.push(v);
    // {page}, {total}, {date} are always available
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatDate(date: Date, format: DateFormat): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  switch (format) {
    case "yyyy-mm-dd":
      return `${yyyy}-${mm}-${dd}`;
    case "mm/dd/yyyy":
      return `${mm}/${dd}/${yyyy}`;
    case "dd/mm/yyyy":
      return `${dd}/${mm}/${yyyy}`;
  }
}

export function formatPageNumber(format: PageNumberFormat, current: number, total: number): string {
  switch (format) {
    case "x":
      return `${current}`;
    case "x-of-n":
      return `${current} of ${total}`;
    case "page-x-of-n":
      return `Page ${current} of ${total}`;
  }
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateFontSize(n: number): ToolResult<number> {
  if (!Number.isFinite(n)) return { ok: false, error: "Font size must be a number." };
  if (n < FONT_SIZE_MIN || n > FONT_SIZE_MAX) {
    return { ok: false, error: `Font size must be between ${FONT_SIZE_MIN} and ${FONT_SIZE_MAX}.` };
  }
  return { ok: true, output: n };
}

export function parseHexColor(hex: string): ToolResult<{ r: number; g: number; b: number }> {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return { ok: false, error: "Color must be a 6-digit hex, e.g. #ff0000." };
  const v = m[1];
  return {
    ok: true,
    output: {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    },
  };
}

export function calculateMargin(value: number, min = MARGIN_MIN, max = MARGIN_MAX): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function validatePageCount(n: number): ToolResult<number> {
  if (!Number.isFinite(n) || n < 1) return { ok: false, error: "PDF must have at least 1 page." };
  if (n > PAGE_COUNT_MAX) return { ok: false, error: `PDF has too many pages (max ${PAGE_COUNT_MAX}).` };
  return { ok: true, output: n };
}

// ---------------------------------------------------------------------------
// Position & margin math
// ---------------------------------------------------------------------------

/** Compute the X coordinate (PDF points, from left) for a text given position. */
export function calculateX(
  position: Position,
  pageWidth: number,
  textWidth: number,
  margin: number,
): number {
  const safeMargin = Math.max(0, margin);
  switch (position) {
    case "left":
      return safeMargin;
    case "right":
      return Math.max(safeMargin, pageWidth - safeMargin - textWidth);
    case "center":
      return Math.max(safeMargin, (pageWidth - textWidth) / 2);
  }
}

/**
 * Compute the Y coordinate (PDF points, y=0 at bottom) for header or footer.
 * `lineOffset` is 0 for the first line of multi-line text; each subsequent line
 * adds `-lineHeight` (below) for header or `+lineHeight` for footer.
 */
export function calculateY(
  position: "header" | "footer",
  pageHeight: number,
  fontSize: number,
  margin: number,
  lineOffset = 0,
  lineHeight = fontSize * 1.2,
): number {
  const safeMargin = Math.max(0, margin);
  if (position === "header") {
    const base = Math.max(0, pageHeight - safeMargin - fontSize);
    return base - lineOffset * lineHeight;
  }
  const base = Math.max(0, safeMargin);
  return base + lineOffset * lineHeight;
}

// ---------------------------------------------------------------------------
// Page range
// ---------------------------------------------------------------------------

/** Resolve a page-range spec ("all" or "1-3, 5, 8-") to a set of 0-based indices. */
export function resolvePageRange(spec: string, pageCount: number): ToolResult<Set<number>> {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed || trimmed === "all") {
    const out = new Set<number>();
    for (let i = 0; i < pageCount; i++) out.add(i);
    return { ok: true, output: out };
  }
  const parsed = parsePageRanges(spec, pageCount);
  if (!parsed.ok) return parsed;
  return { ok: true, output: new Set(parsed.output) };
}

// ---------------------------------------------------------------------------
// First-page handler
// ---------------------------------------------------------------------------

/** Return the header/footer text that applies to a given 0-based page index. */
export function pickTextForPage(
  pageIndex: number,
  opts: HeaderFooterOptions,
): { headerText: string; footerText: string } {
  if (opts.firstPageDifferent && pageIndex === 0) {
    return {
      headerText: opts.firstPageHeader,
      footerText: opts.firstPageFooter,
    };
  }
  return {
    headerText: opts.headerText,
    footerText: opts.footerText,
  };
}

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

/**
 * Heuristic collision detector. Returns true if the header/footer band
 * (defined by margin + font size at top or bottom of the page) overlaps any
 * existing content band. `existingContentBands` is an array of {yMin, yMax}
 * rectangles in PDF coordinates (y from bottom).
 */
export function detectCollision(
  type: "header" | "footer",
  pageHeight: number,
  fontSize: number,
  margin: number,
  existingContentBands: { yMin: number; yMax: number }[],
): boolean {
  const safeMargin = Math.max(0, margin);
  const bandMin = type === "header" ? pageHeight - safeMargin - fontSize : safeMargin;
  const bandMax = type === "header" ? pageHeight - safeMargin : safeMargin + fontSize;
  for (const b of existingContentBands) {
    if (b.yMin < bandMax && b.yMax > bandMin) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Render computation
// ---------------------------------------------------------------------------

export interface PdfMetadata {
  title: string;
  author: string;
  filename: string;
  /** Date used for {date} substitution. */
  date: Date;
}

/** Compute the per-page render plan (without actually drawing). */
export function computeRenders(
  pageCount: number,
  opts: HeaderFooterOptions,
  metadata: PdfMetadata,
): ToolResult<PageRender[]> {
  const vc = validatePageCount(pageCount);
  if (!vc.ok) return vc;
  const rangeRes = resolvePageRange(opts.pageRange, pageCount);
  if (!rangeRes.ok) return rangeRes;
  const inRange = rangeRes.output;
  const renders: PageRender[] = [];
  for (let i = 0; i < pageCount; i++) {
    const pageNumber = i + 1;
    if (!inRange.has(i)) {
      renders.push({
        pageNumber,
        headerText: "",
        footerText: "",
        headerPosition: opts.headerPosition,
        footerPosition: opts.footerPosition,
        skipped: true,
      });
      continue;
    }
    const { headerText, footerText } = pickTextForPage(i, opts);
    const ctx: VariableContext = {
      page: pageNumber,
      total: pageCount,
      title: metadata.title,
      author: metadata.author,
      filename: metadata.filename,
      date: formatDate(metadata.date, opts.dateFormat),
    };
    renders.push({
      pageNumber,
      headerText: substituteVariables(headerText, ctx),
      footerText: substituteVariables(footerText, ctx),
      headerPosition: opts.headerPosition,
      footerPosition: opts.footerPosition,
      skipped: false,
    });
  }
  return { ok: true, output: renders };
}

export function computeSummaryStats(renders: PageRender[]): SummaryStats {
  const total = renders.length;
  let processed = 0;
  let skipped = 0;
  let withH = 0;
  let withF = 0;
  const byH: Record<Position, number> = { left: 0, center: 0, right: 0 };
  const byF: Record<Position, number> = { left: 0, center: 0, right: 0 };
  for (const r of renders) {
    if (r.skipped) {
      skipped++;
      continue;
    }
    processed++;
    if (r.headerText) {
      withH++;
      byH[r.headerPosition]++;
    }
    if (r.footerText) {
      withF++;
      byF[r.footerPosition]++;
    }
  }
  return {
    totalPages: total,
    processedPages: processed,
    skippedPages: skipped,
    pagesWithHeader: withH,
    pagesWithFooter: withF,
    byHeaderPosition: byH,
    byFooterPosition: byF,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function renderTextReport(renders: PageRender[], stats: SummaryStats): string {
  const lines: string[] = [];
  lines.push("PDF Header/Footer Report");
  lines.push("=========================");
  lines.push(`Total pages: ${stats.totalPages}`);
  lines.push(`Processed: ${stats.processedPages} • Skipped: ${stats.skippedPages}`);
  lines.push(`Pages with header: ${stats.pagesWithHeader} • Pages with footer: ${stats.pagesWithFooter}`);
  lines.push(
    `Header positions — L: ${stats.byHeaderPosition.left} C: ${stats.byHeaderPosition.center} R: ${stats.byHeaderPosition.right}`,
  );
  lines.push(
    `Footer positions — L: ${stats.byFooterPosition.left} C: ${stats.byFooterPosition.center} R: ${stats.byFooterPosition.right}`,
  );
  lines.push("");
  for (const r of renders) {
    if (r.skipped) {
      lines.push(`Page ${r.pageNumber}: skipped (outside range)`);
      continue;
    }
    lines.push(`Page ${r.pageNumber}:`);
    if (r.headerText) lines.push(`  Header [${r.headerPosition}]: ${r.headerText}`);
    if (r.footerText) lines.push(`  Footer [${r.footerPosition}]: ${r.footerText}`);
    if (!r.headerText && !r.footerText) lines.push("  (no header or footer)");
  }
  return lines.join("\n");
}

export function renderCsvReport(renders: PageRender[]): string {
  const lines = ["page,header_text,footer_text,header_position,footer_position,skipped"];
  for (const r of renders) {
    lines.push(
      [
        r.pageNumber,
        escapeCsv(r.headerText),
        escapeCsv(r.footerText),
        r.headerPosition,
        r.footerPosition,
        r.skipped,
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-header-footer-adder:history";
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

const VALID_POSITIONS = new Set<Position>(POSITION_PRESETS);
const VALID_PNF = new Set<PageNumberFormat>(PAGE_NUMBER_FORMATS);
const VALID_DF = new Set<DateFormat>(DATE_FORMATS);

export function buildShareUrl(opts: HeaderFooterOptions): string {
  const params = new URLSearchParams();
  if (opts.headerText) params.set("h", opts.headerText);
  if (opts.footerText) params.set("f", opts.footerText);
  if (opts.headerPosition !== DEFAULT_OPTIONS.headerPosition) params.set("hp", opts.headerPosition);
  if (opts.footerPosition !== DEFAULT_OPTIONS.footerPosition) params.set("fp", opts.footerPosition);
  if (opts.fontSize !== DEFAULT_OPTIONS.fontSize) params.set("fs", String(opts.fontSize));
  if (opts.textColor !== DEFAULT_OPTIONS.textColor) params.set("tc", opts.textColor);
  if (opts.marginTop !== DEFAULT_OPTIONS.marginTop) params.set("mt", String(opts.marginTop));
  if (opts.marginBottom !== DEFAULT_OPTIONS.marginBottom) params.set("mb", String(opts.marginBottom));
  if (opts.pageRange !== DEFAULT_OPTIONS.pageRange) params.set("pr", opts.pageRange);
  if (opts.firstPageDifferent) params.set("fpd", "1");
  if (opts.firstPageHeader) params.set("fph", opts.firstPageHeader);
  if (opts.firstPageFooter) params.set("fpf", opts.firstPageFooter);
  if (opts.pageNumberFormat !== DEFAULT_OPTIONS.pageNumberFormat) params.set("pnf", opts.pageNumberFormat);
  if (opts.dateFormat !== DEFAULT_OPTIONS.dateFormat) params.set("df", opts.dateFormat);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<HeaderFooterOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<HeaderFooterOptions> = {};
  const h = params.get("h");
  if (h !== null) out.headerText = h;
  const f = params.get("f");
  if (f !== null) out.footerText = f;
  const hp = params.get("hp");
  if (hp && VALID_POSITIONS.has(hp as Position)) out.headerPosition = hp as Position;
  const fp = params.get("fp");
  if (fp && VALID_POSITIONS.has(fp as Position)) out.footerPosition = fp as Position;
  const fs = params.get("fs");
  if (fs !== null) {
    const n = Number(fs);
    if (Number.isFinite(n)) out.fontSize = n;
  }
  const tc = params.get("tc");
  if (tc) out.textColor = tc;
  const mt = params.get("mt");
  if (mt !== null) {
    const n = Number(mt);
    if (Number.isFinite(n)) out.marginTop = n;
  }
  const mb = params.get("mb");
  if (mb !== null) {
    const n = Number(mb);
    if (Number.isFinite(n)) out.marginBottom = n;
  }
  const pr = params.get("pr");
  if (pr) out.pageRange = pr;
  const fpd = params.get("fpd");
  if (fpd === "1") out.firstPageDifferent = true;
  const fph = params.get("fph");
  if (fph !== null) out.firstPageHeader = fph;
  const fpf = params.get("fpf");
  if (fpf !== null) out.firstPageFooter = fpf;
  const pnf = params.get("pnf");
  if (pnf && VALID_PNF.has(pnf as PageNumberFormat)) out.pageNumberFormat = pnf as PageNumberFormat;
  const df = params.get("df");
  if (df && VALID_DF.has(df as DateFormat)) out.dateFormat = df as DateFormat;
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(
  opts: HeaderFooterOptions,
  pageCount: number,
): ToolResult<HeaderFooterOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  const fs = validateFontSize(opts.fontSize);
  if (!fs.ok) return fs;
  const color = parseHexColor(opts.textColor);
  if (!color.ok) return color;
  if (opts.marginTop < 0 || opts.marginBottom < 0) {
    return { ok: false, error: "Margins cannot be negative." };
  }
  const normalizedRange = (opts.pageRange ?? "").trim().toLowerCase();
  if (normalizedRange && normalizedRange !== "all") {
    const r = resolvePageRange(opts.pageRange, pageCount);
    if (!r.ok) return r;
  }
  if (!VALID_POSITIONS.has(opts.headerPosition)) {
    return { ok: false, error: `Invalid header position: ${opts.headerPosition}` };
  }
  if (!VALID_POSITIONS.has(opts.footerPosition)) {
    return { ok: false, error: `Invalid footer position: ${opts.footerPosition}` };
  }
  return { ok: true, output: opts };
}
