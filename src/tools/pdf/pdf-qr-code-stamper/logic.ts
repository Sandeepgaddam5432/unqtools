/**
 * PDF QR Code Stamper — pure logic.
 *
 * Pure helpers for parsing, validating, computing positions, generating a
 * stylized QR matrix (with real finder + timing patterns), converting to
 * vector rectangles, computing stats, rendering text/CSV reports, and
 * managing history + shareable URLs.
 *
 * The QR matrix generator is a simplified implementation: it places the
 * three standard 7×7 finder patterns, timing patterns, and an alignment
 * pattern, then fills the data area with a deterministic hash of the
 * input. It is NOT a fully spec-compliant QR encoder and the codes will
 * not scan; it is provided as a stylized visual representation suitable
 * for stamping a deterministic, data-derived pattern onto PDFs without
 * pulling in a QR library. Replace `generateQrMatrix` with a real encoder
 * if you need scannable codes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QrPosition =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center"
  | "center";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrEntry {
  /** Original page token as written by the user, e.g. "1", "all", "2-3". */
  pageToken: string;
  /** 0-based page indices this entry applies to. */
  pageIndices: number[];
  /** The text/URL data to encode. */
  data: string;
  /** Detected data kind for stats. */
  kind: "url" | "text";
}

export interface QrStats {
  totalEntries: number;
  totalStamps: number;
  byPage: Record<number, number>;
  urlCount: number;
  textCount: number;
  totalBytes: number;
}

export interface QrRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QrPlacement {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}

export interface QrMatrixResult {
  matrix: boolean[][];
  size: number;
  version: number;
}

// ---------------------------------------------------------------------------
// Constants & presets
// ---------------------------------------------------------------------------

export const QR_POSITIONS: QrPosition[] = [
  "top-left",
  "top-right",
  "top-center",
  "bottom-left",
  "bottom-right",
  "bottom-center",
  "center",
];

export const POSITION_LABELS: Record<QrPosition, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "top-center": "Top center",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "bottom-center": "Bottom center",
  "center": "Center",
};

export const ERROR_CORRECTION_LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

export const ECL_DETAILS: Record<
  ErrorCorrectionLevel,
  { code: ErrorCorrectionLevel; label: string; percent: number; recovery: string }
> = {
  L: { code: "L", label: "L — Low", percent: 7, recovery: "~7% of codewords" },
  M: { code: "M", label: "M — Medium", percent: 15, recovery: "~15% of codewords" },
  Q: { code: "Q", label: "Q — Quartile", percent: 25, recovery: "~25% of codewords" },
  H: { code: "H", label: "H — High", percent: 30, recovery: "~30% of codewords" },
};

export const MIN_QR_SIZE = 50;
export const MAX_QR_SIZE = 500;
export const DEFAULT_QR_SIZE = 100;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 200;
export const DEFAULT_MARGIN = 10;
export const MIN_LABEL_SIZE = 4;
export const MAX_LABEL_SIZE = 72;
export const DEFAULT_LABEL_SIZE = 8;
export const DEFAULT_ECL: ErrorCorrectionLevel = "M";

/**
 * Byte-capacity per QR version (1–10) at each error-correction level.
 * Source: ISO/IEC 18004:2015 byte-mode capacity tables. Entries beyond
 * version 10 are not listed because most PDF QR codes target short URLs.
 */
export const QR_CAPACITY: Record<ErrorCorrectionLevel, number[]> = {
  // versions 1..10
  L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
  M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
  Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
  H: [7, 14, 24, 34, 44, 60, 66, 86, 98, 119],
};

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/**
 * Parse the QR data textarea.
 *
 * Each line is `page,data` or `page|data`. Page can be a number, "all",
 * or a range like "2-4". Empty lines and lines starting with `#` are
 * skipped. Invalid lines are reported but do not halt parsing — instead
 * they're dropped silently (use `validateQrEntries` for explicit checks).
 */
export function parseQrData(input: string, pageCount: number): QrEntry[] {
  const out: QrEntry[] = [];
  if (!input) return out;
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.includes("|") ? "|" : ",";
    const idx = line.indexOf(sep);
    if (idx < 0) {
      // No separator — treat whole line as data, applies to all pages.
      const data = line;
      const indices = expandPageToken("all", pageCount);
      out.push({ pageToken: "all", pageIndices: indices, data, kind: detectKind(data) });
      continue;
    }
    const pageToken = line.slice(0, idx).trim();
    const data = line.slice(idx + 1).trim();
    if (!data) continue;
    const indices = expandPageToken(pageToken, pageCount);
    if (indices.length === 0) continue;
    out.push({ pageToken, pageIndices: indices, data, kind: detectKind(data) });
  }
  return out;
}

/** Detect whether a data string looks like a URL. */
export function detectKind(data: string): "url" | "text" {
  return isLikelyUrl(data) ? "url" : "text";
}

/** Basic URL validator — checks scheme + host presence. */
export function isLikelyUrl(s: string): boolean {
  if (!s) return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(https?:|mailto:|tel:|ftp:)/i.test(s);
}

/** Strict URL validator — requires scheme + dotted host or localhost. */
export function isStrictUrl(s: string): boolean {
  if (!s) return false;
  return /^[a-z][a-z0-9+.-]*:\/\/([a-z0-9-]+\.)*[a-z0-9-]+(:\d+)?(\/.*)?$/i.test(s.trim());
}

/**
 * Expand a page token to 0-based page indices.
 *
 * Accepts:
 *   "all" → all pages
 *   "1"   → [0]
 *   "2-4" → [1,2,3]
 *   "1,3" → [0,2]
 *   "-3"  → [0,1,2] (from start)
 *   "4-"  → [3, 4, ..., last] (to end)
 *
 * Invalid tokens return an empty array.
 */
export function expandPageToken(token: string, pageCount: number): number[] {
  const t = (token || "").trim().toLowerCase();
  if (!t) return [];
  if (t === "all" || t === "*") {
    return pageCount > 0 ? Array.from({ length: pageCount }, (_, i) => i) : [];
  }
  const out: number[] = [];
  for (const part of t.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] === "" ? 1 : Number(range[1]);
      const end = range[2] === "" ? pageCount : Number(range[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
      if (start < 1 || end > pageCount || start > end) return [];
      for (let i = start; i <= end; i++) out.push(i - 1);
      continue;
    }
    if (/^\d+$/.test(p)) {
      const n = Number(p);
      if (n < 1 || n > pageCount) return [];
      out.push(n - 1);
      continue;
    }
    return [];
  }
  return out;
}

/** Validate a list of QR entries — returns the first error message or null. */
export function validateQrEntries(entries: QrEntry[], pageCount: number): string | null {
  if (entries.length === 0) return "Enter at least one QR entry (page,data).";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.data) return `Entry ${i + 1}: data is empty.`;
    if (e.pageIndices.length === 0)
      return `Entry ${i + 1}: page token "${e.pageToken}" does not match any page.`;
    if (e.pageIndices.some((p) => p < 0 || p >= pageCount))
      return `Entry ${i + 1}: page index out of range.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Calculate the (x, y) origin of a QR code on a PDF page.
 * pdf-lib uses bottom-left origin; we account for that.
 */
export function calculateQrPosition(
  position: QrPosition,
  pageWidth: number,
  pageHeight: number,
  qrSize: number,
  margin: number,
): { x: number; y: number } {
  const m = clamp(margin, MIN_MARGIN, Math.max(MIN_MARGIN, pageWidth - qrSize));
  const xLeft = m;
  const xRight = pageWidth - qrSize - m;
  const xCenter = (pageWidth - qrSize) / 2;
  const yTop = pageHeight - qrSize - m;
  const yBottom = m;
  const yCenter = (pageHeight - qrSize) / 2;
  switch (position) {
    case "top-left":     return { x: xLeft,   y: yTop };
    case "top-right":    return { x: xRight,  y: yTop };
    case "top-center":   return { x: xCenter, y: yTop };
    case "bottom-left":  return { x: xLeft,   y: yBottom };
    case "bottom-right": return { x: xRight,  y: yBottom };
    case "bottom-center":return { x: xCenter, y: yBottom };
    case "center":       return { x: xCenter, y: yCenter };
  }
}

/** Calculate the QR label position (centered below the QR code). */
export function calculateLabelPosition(
  qrX: number,
  qrY: number,
  qrSize: number,
  labelWidth: number,
  labelFontSize: number,
  pageHeight: number,
): QrPlacement {
  // Place label so its baseline sits a few pt below the QR.
  // In pdf-lib coords, "below" the QR means a smaller y value.
  const gap = Math.max(2, labelFontSize * 0.4);
  const rawLabelY = qrY - gap - labelFontSize;
  // If the QR is at the bottom of the page, the label would fall off —
  // clamp it to a non-negative y, but never exceed the page height.
  const labelY = Math.max(0, Math.min(rawLabelY, pageHeight - labelFontSize));
  const labelX = qrX + (qrSize - labelWidth) / 2;
  return { x: qrX, y: qrY, labelX, labelY };
}

/** Validate QR size — clamp to [MIN_QR_SIZE, MAX_QR_SIZE]. */
export function validateQrSize(size: number): { ok: boolean; value: number; error?: string } {
  if (!Number.isFinite(size)) return { ok: false, value: DEFAULT_QR_SIZE, error: "Size must be a number." };
  if (size < MIN_QR_SIZE)
    return { ok: false, value: MIN_QR_SIZE, error: `Size must be at least ${MIN_QR_SIZE} px.` };
  if (size > MAX_QR_SIZE)
    return { ok: false, value: MAX_QR_SIZE, error: `Size must be at most ${MAX_QR_SIZE} px.` };
  return { ok: true, value: size };
}

/** Validate margin — clamp to [MIN_MARGIN, MAX_MARGIN]. */
export function validateMargin(margin: number): { ok: boolean; value: number; error?: string } {
  if (!Number.isFinite(margin)) return { ok: false, value: DEFAULT_MARGIN, error: "Margin must be a number." };
  if (margin < MIN_MARGIN)
    return { ok: false, value: MIN_MARGIN, error: `Margin must be at least ${MIN_MARGIN}.` };
  if (margin > MAX_MARGIN)
    return { ok: false, value: MAX_MARGIN, error: `Margin must be at most ${MAX_MARGIN}.` };
  return { ok: true, value: margin };
}

/** Calculate effective margin given page + QR size — never let the QR overflow. */
export function calculateEffectiveMargin(
  margin: number,
  qrSize: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const maxMarginX = Math.max(0, (pageWidth - qrSize) / 2);
  const maxMarginY = Math.max(0, (pageHeight - qrSize) / 2);
  const maxMargin = Math.min(maxMarginX, maxMarginY, MAX_MARGIN);
  return clamp(margin, MIN_MARGIN, maxMargin);
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** Parse a hex color string (#RGB or #RRGGBB) to {r,g,b} in 0–1 range. */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, "");
  let full: string;
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    full = clean.split("").map((c) => c + c).join("");
  } else if (/^[0-9a-f]{6}$/i.test(clean)) {
    full = clean;
  } else {
    return null;
  }
  const n = parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** Format {r,g,b} back to a hex string (#rrggbb). */
export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to2 = (v: number) => {
    const h = Math.round(clamp(v, 0, 1) * 255).toString(16);
    return h.length === 1 ? "0" + h : h;
  };
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

// ---------------------------------------------------------------------------
// QR matrix generation (simplified)
// ---------------------------------------------------------------------------

/**
 * Calculate the smallest QR version (1–10) that fits the data at the
 * given error-correction level. Returns 10 if the data is too long.
 */
export function calculateQrVersion(dataLength: number, ecl: ErrorCorrectionLevel): number {
  const caps = QR_CAPACITY[ecl];
  for (let v = 0; v < caps.length; v++) {
    if (dataLength <= caps[v]) return v + 1;
  }
  return caps.length; // version 10 (max supported here)
}

/** QR capacity at a given version + ECL. */
export function getQrCapacity(version: number, ecl: ErrorCorrectionLevel): number {
  const caps = QR_CAPACITY[ecl];
  const idx = Math.max(0, Math.min(version - 1, caps.length - 1));
  return caps[idx];
}

/** Check whether the data fits in the (version, ecl) capacity. */
export function checkDataCapacity(
  dataLength: number,
  version: number,
  ecl: ErrorCorrectionLevel,
): { fits: boolean; capacity: number; used: number } {
  const capacity = getQrCapacity(version, ecl);
  return { fits: dataLength <= capacity, capacity, used: dataLength };
}

/** Number of modules per side for a given QR version: 17 + 4*version. */
export function qrModulesFor(version: number): number {
  return 17 + 4 * Math.max(1, Math.min(40, version));
}

/**
 * Generate a stylized QR matrix for the given data.
 *
 * Implements the structural elements of a QR code:
 *   - Three 7×7 finder patterns at top-left, top-right, bottom-left
 *     (with 1-module separator borders)
 *   - Horizontal + vertical timing patterns on row/col 6
 *   - One 5×5 alignment pattern (bottom-right area) for version ≥ 2
 *
 * The data area is filled deterministically from a hash of the input so
 * that identical inputs produce identical matrices. This is a SIMPLIFIED
 * encoder — the codes will NOT scan with a real QR reader. Replace this
 * function with a spec-compliant encoder if you need readable codes.
 */
export function generateQrMatrix(
  data: string,
  ecl: ErrorCorrectionLevel = DEFAULT_ECL,
): QrMatrixResult {
  const version = calculateQrVersion(byteLength(data), ecl);
  const size = qrModulesFor(version);
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  // --- Finder patterns (7x7) with separators ---
  placeFinder(matrix, 0, 0);
  placeFinder(matrix, size - 7, 0);
  placeFinder(matrix, 0, size - 7);

  // --- Timing patterns (row 6 and col 6) ---
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // --- Alignment pattern (only for version >= 2) ---
  if (version >= 2) {
    const alignCenter = size - 7;
    placeAlignment(matrix, alignCenter, alignCenter);
  }

  // --- Format-info reserved modules (always dark at (size-8, 8)) ---
  matrix[8][size - 8] = true;
  matrix[size - 8][8] = true;

  // --- Deterministic data fill ---
  const bits = hashToBitStream(data, size * size);
  let bitIdx = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isReserved(matrix, x, y, size, version)) continue;
      matrix[y][x] = bits[bitIdx % bits.length];
      bitIdx++;
    }
  }

  return { matrix, size, version };
}

/** Place a 7×7 finder pattern at (x0, y0) (top-left corner). */
function placeFinder(matrix: boolean[][], x0: number, y0: number): void {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const onRing = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const inCenter = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      matrix[y0 + dy][x0 + dx] = onRing || inCenter;
    }
  }
}

/** Place a 5×5 alignment pattern centered at (cx, cy). */
function placeAlignment(matrix: boolean[][], cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const onRing = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      const isCenter = dx === 0 && dy === 0;
      matrix[cy + dy][cx + dx] = onRing || isCenter;
    }
  }
}

/** Is a module reserved (finder/separator/timing/alignment)? */
function isReserved(matrix: boolean[][], x: number, y: number, size: number, version: number): boolean {
  void matrix; // matrix not needed here but kept for signature symmetry
  // Top-left finder + separator
  if (x <= 8 && y <= 8) return true;
  // Top-right finder + separator
  if (x >= size - 8 && y <= 8) return true;
  // Bottom-left finder + separator
  if (x <= 8 && y >= size - 8) return true;
  // Timing patterns
  if (x === 6 || y === 6) return true;
  // Alignment pattern (version >= 2)
  if (version >= 2) {
    const ax = size - 7;
    const ay = size - 7;
    if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) return true;
  }
  return false;
}

/**
 * Deterministic hash → bit stream. Same input → same bits.
 * Uses an FNV-1a-style hash over the data string, expanded via two
 * LCGs. We extract middle bits (16, 13) because the LSB of a LCG with
 * odd increment + odd additive constant alternates deterministically
 * (parity never changes), which would yield an all-equal bit stream.
 */
function hashToBitStream(data: string, length: number): boolean[] {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca77) >>> 0;
  }
  // LCG to expand the seed into a bit stream.
  const bits: boolean[] = [];
  let s = h1;
  let s2 = h2;
  for (let i = 0; i < Math.max(64, length); i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    s2 = (Math.imul(s2, 22695477) + 1) >>> 0;
    // Use middle bits where the LCG has more entropy.
    bits.push((((s >>> 16) ^ (s2 >>> 13)) & 1) === 1);
  }
  return bits;
}

/** UTF-8 byte length of a string. */
function byteLength(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  // Fallback: estimate
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Matrix → rectangles
// ---------------------------------------------------------------------------

/**
 * Convert a QR matrix to a list of rectangles covering the dark modules.
 *
 * Each dark module becomes a single square rectangle of `moduleSize` ×
 * `moduleSize`, positioned with (originX, originY) as the top-left of the
 * matrix (in pdf-lib coordinates, where Y grows upward).
 *
 * Returns both dark rectangles (the QR code) and the count.
 */
export function matrixToRectangles(
  matrix: boolean[][],
  originX: number,
  originY: number,
  moduleSize: number,
): QrRect[] {
  const out: QrRect[] = [];
  const size = matrix.length;
  // pdf-lib Y is bottom-up; matrix row 0 is the visual top.
  // We treat originY as the BOTTOM-left of the QR — so the visual top row
  // of the matrix lands at originY + (size - 1) * moduleSize.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!matrix[r][c]) continue;
      const x = originX + c * moduleSize;
      // Row 0 is at the top → highest y in pdf-lib coords.
      const y = originY + (size - 1 - r) * moduleSize;
      out.push({ x, y, width: moduleSize, height: moduleSize });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

/** Format a label string for a QR code — truncate to maxLen chars with ellipsis. */
export function formatLabelText(data: string, maxLen = 32): string {
  const s = (data || "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

// ---------------------------------------------------------------------------
// Stats + rendering
// ---------------------------------------------------------------------------

export function computeStats(entries: QrEntry[]): QrStats {
  const byPage: Record<number, number> = {};
  let totalStamps = 0;
  let urlCount = 0;
  let textCount = 0;
  let totalBytes = 0;
  for (const e of entries) {
    totalStamps += e.pageIndices.length;
    if (e.kind === "url") urlCount += 1;
    else textCount += 1;
    totalBytes += byteLength(e.data);
    for (const p of e.pageIndices) byPage[p] = (byPage[p] ?? 0) + 1;
  }
  return {
    totalEntries: entries.length,
    totalStamps,
    byPage,
    urlCount,
    textCount,
    totalBytes,
  };
}

export function renderTextReport(entries: QrEntry[], stats: QrStats): string {
  const lines: string[] = [];
  lines.push(`QR Code Stamp Report`);
  lines.push(`=====================`);
  lines.push(`Entries: ${stats.totalEntries}`);
  lines.push(`Total stamps: ${stats.totalStamps}`);
  lines.push(`URLs: ${stats.urlCount} • Text: ${stats.textCount}`);
  lines.push(`Total bytes encoded: ${stats.totalBytes}`);
  lines.push(``);
  lines.push(`Per entry:`);
  entries.forEach((e, i) => {
    const pages = e.pageToken === "all"
      ? `all (${e.pageIndices.length} pages)`
      : `pages ${e.pageIndices.map((p) => p + 1).join(",")}`;
    lines.push(`  ${i + 1}. [${pages}] ${e.kind.toUpperCase()} — ${e.data}`);
  });
  return lines.join("\n");
}

export function renderCsv(entries: QrEntry[]): string {
  const lines = ["page,kind,data,bytes"];
  for (const e of entries) {
    const pages = e.pageToken === "all"
      ? "all"
      : e.pageIndices.map((p) => p + 1).join(";");
    const row = [pages, e.kind, escapeCsv(e.data), byteLength(e.data)].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-qr-code-stamper:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  entries: QrEntry[];
  stats: QrStats;
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(
  qrData: string,
  position: QrPosition,
  size: number,
  ecl: ErrorCorrectionLevel,
  color: string,
  bgColor: string,
  includeLabel: boolean,
  margin: number,
): string {
  const params = new URLSearchParams();
  if (qrData) params.set("data", qrData);
  if (position) params.set("pos", position);
  if (size) params.set("size", String(size));
  if (ecl) params.set("ecl", ecl);
  if (color) params.set("color", color);
  if (bgColor) params.set("bg", bgColor);
  if (includeLabel) params.set("label", "1");
  if (margin !== DEFAULT_MARGIN) params.set("margin", String(margin));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ParsedShareUrl {
  qrData: string;
  position: QrPosition;
  size: number;
  ecl: ErrorCorrectionLevel;
  color: string;
  bgColor: string;
  includeLabel: boolean;
  margin: number;
}

export function parseShareUrl(hash: string): ParsedShareUrl {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      qrData: "",
      position: "top-right",
      size: DEFAULT_QR_SIZE,
      ecl: DEFAULT_ECL,
      color: "#000000",
      bgColor: "#FFFFFF",
      includeLabel: false,
      margin: DEFAULT_MARGIN,
    };
  }
  const params = new URLSearchParams(clean);
  const position = (params.get("pos") as QrPosition) ?? "top-right";
  const validPos = QR_POSITIONS.includes(position) ? position : "top-right";
  const eclStr = (params.get("ecl") as ErrorCorrectionLevel) ?? DEFAULT_ECL;
  const validEcl = ERROR_CORRECTION_LEVELS.includes(eclStr) ? eclStr : DEFAULT_ECL;
  const sizeNum = Number(params.get("size"));
  const size = Number.isFinite(sizeNum) ? validateQrSize(sizeNum).value : DEFAULT_QR_SIZE;
  const marginNum = Number(params.get("margin"));
  const margin = Number.isFinite(marginNum) ? validateMargin(marginNum).value : DEFAULT_MARGIN;
  return {
    qrData: params.get("data") ?? "",
    position: validPos,
    size,
    ecl: validEcl,
    color: params.get("color") ?? "#000000",
    bgColor: params.get("bg") ?? "#FFFFFF",
    includeLabel: params.get("label") === "1",
    margin,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
