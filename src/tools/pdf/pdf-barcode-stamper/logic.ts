/**
 * PDF Barcode Stamper — pure logic.
 *
 * Pure helpers for parsing, validating, generating bar/space patterns for
 * five barcode types (CODE128, EAN-13, UPC-A, CODE39, ITF), computing
 * checksums, converting patterns to vector rectangles, formatting text
 * labels, computing stats, rendering text/CSV reports, and managing
 * history + shareable URLs.
 *
 * Encoders implemented:
 *   - CODE128 (Code Set B — printable ASCII 32..126)
 *   - EAN-13 (12 digits + checksum digit, with L/G/R parity)
 *   - UPC-A (EAN-13 with first digit 0 — 11 digits + checksum)
 *   - CODE39 (alphanumeric + - . $ / + % space, with * start/stop)
 *   - ITF (Interleaved 2 of 5 — even digit count)
 *
 * Patterns use spec-compliant bar/space widths. The "Bar" type alternates
 * bar/space; widths are in module units (1 = narrow). The barsToRectangles
 * helper scales these to actual PDF coordinates.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BarcodeType = "CODE128" | "EAN13" | "UPC" | "CODE39" | "ITF";

export type BarcodePosition =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

export interface BarcodeEntry {
  pageToken: string;
  pageIndices: number[];
  type: BarcodeType;
  data: string;
  valid: boolean;
  error?: string;
  /** Final data actually encoded (e.g. with checksum digit appended). */
  encodedData: string;
  /** Bars/spaces pattern in module units. */
  pattern: Bar[];
}

export interface Bar {
  /** Width in modules (1 = narrow). */
  width: number;
  /** true = bar (dark), false = space (light). */
  isBar: boolean;
}

export interface BarcodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BarcodeStats {
  totalEntries: number;
  totalStamps: number;
  validCount: number;
  invalidCount: number;
  byType: Record<BarcodeType, number>;
  byPage: Record<number, number>;
}

export interface BarcodePlacement {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}

// ---------------------------------------------------------------------------
// Constants & presets
// ---------------------------------------------------------------------------

export const BARCODE_TYPES: BarcodeType[] = ["CODE128", "EAN13", "UPC", "CODE39", "ITF"];

export const BARCODE_TYPE_LABELS: Record<BarcodeType, string> = {
  CODE128: "CODE128 (any ASCII)",
  EAN13: "EAN-13 (13 digits)",
  UPC: "UPC-A (12 digits)",
  CODE39: "Code39 (alphanumeric)",
  ITF: "ITF (Interleaved 2 of 5)",
};

export const BARCODE_POSITIONS: BarcodePosition[] = [
  "top-left",
  "top-right",
  "top-center",
  "bottom-left",
  "bottom-right",
  "bottom-center",
];

export const POSITION_LABELS: Record<BarcodePosition, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "top-center": "Top center",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "bottom-center": "Bottom center",
};

export const MIN_BAR_WIDTH = 50;
export const MAX_BAR_WIDTH = 800;
export const DEFAULT_BAR_WIDTH = 200;
export const MIN_BAR_HEIGHT = 20;
export const MAX_BAR_HEIGHT = 300;
export const DEFAULT_BAR_HEIGHT = 60;
export const DEFAULT_MARGIN = 10;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 200;
export const DEFAULT_TEXT_SIZE = 8;
export const MAX_BATCH = 500;

// ---------------------------------------------------------------------------
// CODE128 — Code Set B patterns (107 entries × 6 elements each).
// Each 6-digit string = bar,space,bar,space,bar,space widths in modules.
// Sum = 11 modules per character. Index 106 (STOP) has 7 elements.
// ---------------------------------------------------------------------------

const CODE128_PATTERNS: string[] = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213", // 0-9
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132", // 10-19
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211", // 20-29
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313", // 30-39
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331", // 40-49
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111", // 50-59
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214", // 60-69
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111", // 70-79
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141", // 80-89
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141", // 90-99
  "114131","311141","411131","211412","211214","211232","2331112",                            // 100-106
];

const CODE128_START_B = 104;
const CODE128_STOP = 106;
const CODE128_MOD = 103;

// ---------------------------------------------------------------------------
// EAN-13 / UPC-A patterns
// ---------------------------------------------------------------------------

// Left-hand odd-parity (L), left-hand even-parity (G), right-hand (R).
// Each digit = 7 modules: bar-space-bar-space-bar-space-bar.
const EAN_L: string[] = [
  "0001011","0011001","0010011","0111101","0100011",
  "0110001","0101111","0111011","0110111","0001011",
];
const EAN_G: string[] = [
  "0100111","0110011","0011011","0100001","0011101",
  "0111001","0001011","0010001","0001001","0010111",
];
const EAN_R: string[] = [
  "1110010","1100110","1101100","1000010","1011100",
  "1001110","1010000","1000100","1001000","1110100",
];
// First-digit parity pattern for EAN-13 (which of the next 6 are G vs L).
// Index = first digit; entry = 6 chars of 'L' or 'G' for digits 2-7.
const EAN_PARITY: string[] = [
  "LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG",
  "LGGLLG","LGGGGL","LGLGLG","LGLGGL","LGGLGL",
];

const EAN_START_GUARD = "101"; // bar-space-bar (1-1-1)
const EAN_CENTER_GUARD = "01010"; // space-bar-space-bar-space (1-1-1-1-1)
const EAN_END_GUARD = "101"; // bar-space-bar (1-1-1)

// ---------------------------------------------------------------------------
// Code39 patterns — 9 elements (5 bars + 4 spaces) per char + 1-module gap.
// Each pattern string is 9 chars of 'N' (narrow=1) or 'W' (wide=3).
// ---------------------------------------------------------------------------

const CODE39_PATTERNS: Record<string, string> = {
  "0": "NNNWWNWNN", "1": "WNNWNNNNW", "2": "NNWWNNNNW", "3": "WNWWNNNNN",
  "4": "NNNWWNNNW", "5": "WNNWWNNNN", "6": "NNWWWNNNN", "7": "NNNWNWNNW",
  "8": "WNNWNWNNN", "9": "NNWWNWNNN", "A": "WNNNNWNNW", "B": "NNWNNWNNW",
  "C": "WNWNNWNNN", "D": "NNNNWWNNW", "E": "WNNNWWNNN", "F": "NNWNWWNNN",
  "G": "NNNNNWWNW", "H": "WNNNNWWNN", "I": "NNWNNWWNN", "J": "NNNNWWWWN",
  "K": "WNNNNNNWW", "L": "NNWNNNNWW", "M": "WNWNNNNWN", "N": "NNNNWNNWW",
  "O": "WNNNWNNWN", "P": "NNWNWNNWN", "Q": "NNNNNNWWW", "R": "WNNNNNWWN",
  "S": "NNWNNNWWN", "T": "NNNNWNWWN", "U": "WWNNNNNNW", "V": "NWWNNNNNW",
  "W": "WWWNNNNNN", "X": "NWNNWNNNW", "Y": "WWNNWNNNN", "Z": "NWWNWNNNN",
  "-": "NWNNNNWNW", ".": "WWNNNNWNN", " ": "NWWNNNWNN", "$": "NWNWNWNNN",
  "/": "NWNWNNNWN", "+": "NWNNNWNWN", "%": "NNNWNWNWN", "*": "NWNNWNWNN",
};

// ---------------------------------------------------------------------------
// ITF (Interleaved 2 of 5) patterns — 5 modules per digit, 2 wide + 3 narrow.
// Each pattern string is 5 chars of 'N' (1) or 'W' (3).
// ---------------------------------------------------------------------------

const ITF_PATTERNS: string[] = [
  "NNWWN","WNNNW","NWNNW","WWNNN","NNWNW", // 0-4
  "WNNWN","NWNWN","NWWNN","WNWNN","NWWNN", // 5-9
];

const ITF_START = "NNNN"; // 4 narrow modules: bar-space-bar-space
const ITF_END = "WNN";    // wide bar, narrow space, narrow bar (last is termination bar)

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/**
 * Parse the barcode data textarea.
 *
 * Each line is `page,TYPE,data` or `page|TYPE|data`. Page can be a number,
 * "all", or a range like "2-4". Empty lines and `#`-comments are skipped.
 */
export function parseBarcodeData(input: string, pageCount: number): BarcodeEntry[] {
  const out: BarcodeEntry[] = [];
  if (!input) return out;
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = splitThree(line);
    if (!parts) {
      // No separator — treat whole line as CODE128 data on all pages
      const data = line;
      const pageIndices = expandPageToken("all", pageCount);
      out.push(makeEntry("all", pageIndices, "CODE128", data));
      continue;
    }
    const [pageToken, typeStr, data] = parts;
    const type = normalizeType(typeStr);
    if (!type) continue;
    const pageIndices = expandPageToken(pageToken, pageCount);
    if (pageIndices.length === 0) continue;
    out.push(makeEntry(pageToken, pageIndices, type, data));
  }
  return out;
}

/** Split a line into 3 parts by the first `,` or `|`. */
function splitThree(line: string): [string, string, string] | null {
  const sep1 = line.indexOf("|");
  const sep2 = line.indexOf(",");
  let sep: number;
  if (sep1 < 0 && sep2 < 0) return null;
  if (sep1 < 0) sep = sep2;
  else if (sep2 < 0) sep = sep1;
  else sep = Math.min(sep1, sep2);
  const rest = line.slice(sep + 1);
  const sepB = rest.indexOf("|");
  const sepC = rest.indexOf(",");
  let sep2Final: number;
  if (sepB < 0 && sepC < 0) return null;
  if (sepB < 0) sep2Final = sepC;
  else if (sepC < 0) sep2Final = sepB;
  else sep2Final = Math.min(sepB, sepC);
  return [
    line.slice(0, sep).trim(),
    rest.slice(0, sep2Final).trim(),
    rest.slice(sep2Final + 1).trim(),
  ];
}

/** Normalize a type string ("code128", "CODE-128", etc.) to a BarcodeType. */
export function normalizeType(s: string): BarcodeType | null {
  const t = (s || "").trim().toUpperCase().replace(/[-_\s]/g, "");
  if (t === "CODE128" || t === "C128") return "CODE128";
  if (t === "EAN13" || t === "EAN") return "EAN13";
  if (t === "UPC" || t === "UPCA") return "UPC";
  if (t === "CODE39" || t === "C39") return "CODE39";
  if (t === "ITF" || t === "I25" || t === "INTERLEAVED25") return "ITF";
  return null;
}

/** Expand a page token to 0-based page indices. Same semantics as QR tool. */
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

// ---------------------------------------------------------------------------
// Per-type validators
// ---------------------------------------------------------------------------

export function validateBarcode(type: BarcodeType, data: string): { ok: boolean; error?: string } {
  switch (type) {
    case "CODE128": return validateCode128(data);
    case "EAN13": return validateEan13(data);
    case "UPC": return validateUpc(data);
    case "CODE39": return validateCode39(data);
    case "ITF": return validateItf(data);
  }
}

export function validateCode128(data: string): { ok: boolean; error?: string } {
  if (!data) return { ok: false, error: "CODE128: data is empty." };
  // Code Set B supports ASCII 32..126
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    if (c < 32 || c > 126) {
      return { ok: false, error: `CODE128: character '${data[i]}' (code ${c}) is outside printable ASCII.` };
    }
  }
  if (data.length > 80) return { ok: false, error: "CODE128: data too long (max 80 chars)." };
  return { ok: true };
}

export function validateEan13(data: string): { ok: boolean; error?: string } {
  if (!/^\d+$/.test(data)) return { ok: false, error: "EAN-13: data must be all digits." };
  if (data.length !== 12 && data.length !== 13) {
    return { ok: false, error: "EAN-13: data must be 12 or 13 digits." };
  }
  return { ok: true };
}

export function validateUpc(data: string): { ok: boolean; error?: string } {
  if (!/^\d+$/.test(data)) return { ok: false, error: "UPC-A: data must be all digits." };
  if (data.length !== 11 && data.length !== 12) {
    return { ok: false, error: "UPC-A: data must be 11 or 12 digits." };
  }
  return { ok: true };
}

export function validateCode39(data: string): { ok: boolean; error?: string } {
  if (!data) return { ok: false, error: "Code39: data is empty." };
  const allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
  for (const c of data) {
    if (!allowed.includes(c)) {
      return { ok: false, error: `Code39: character '${c}' is not in the Code39 charset.` };
    }
  }
  return { ok: true };
}

export function validateItf(data: string): { ok: boolean; error?: string } {
  if (!/^\d+$/.test(data)) return { ok: false, error: "ITF: data must be all digits." };
  if (data.length === 0) return { ok: false, error: "ITF: data is empty." };
  if (data.length % 2 !== 0) return { ok: false, error: "ITF: data must have an even number of digits." };
  if (data.length > 80) return { ok: false, error: "ITF: data too long (max 80 digits)." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Checksums
// ---------------------------------------------------------------------------

/** Compute the EAN-13 checksum digit for the first 12 digits. */
export function calculateEan13Checksum(data12: string): number {
  if (!/^\d{12}$/.test(data12)) return -1;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(data12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Compute the UPC-A checksum digit for the first 11 digits. */
export function calculateUpcChecksum(data11: string): number {
  if (!/^\d{11}$/.test(data11)) return -1;
  return calculateEan13Checksum("0" + data11);
}

// ---------------------------------------------------------------------------
// Encoders — each returns an array of Bar (bar/space alternating).
// ---------------------------------------------------------------------------

/** Build a Bar[] from a width-pattern string of digits, alternating bar/space. */
function patternToBars(pattern: string, startIsBar = true): Bar[] {
  const out: Bar[] = [];
  let isBar = startIsBar;
  for (let i = 0; i < pattern.length; i++) {
    const w = pattern[i];
    if (w < "0" || w > "9") continue;
    out.push({ width: Number(w), isBar });
    isBar = !isBar;
  }
  return out;
}

/**
 * Build a Bar[] from a binary pattern string where each char is 1 module wide
 * and '0' = space, '1' = bar. Used for EAN-13 / UPC-A digit + guard patterns.
 */
function binaryToBars(pattern: string, startIsBar?: boolean): Bar[] {
  const out: Bar[] = [];
  let isBar = startIsBar ?? true;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c !== "0" && c !== "1") continue;
    const isModuleBar = c === "1";
    // Merge consecutive same-color modules into a single Bar entry.
    if (out.length > 0 && out[out.length - 1].isBar === isModuleBar) {
      out[out.length - 1].width += 1;
    } else {
      out.push({ width: 1, isBar: isModuleBar });
    }
    isBar = !isBar; // (kept for symmetry, not actually used after first iter)
  }
  // Reset isBar tracking — binaryToBars reads color from pattern char.
  void isBar;
  return out;
}

/** Encode ASCII string as CODE128 (Code Set B). */
export function encodeCode128(data: string): Bar[] {
  const bars: Bar[] = [];
  // Start B
  bars.push(...patternToBars(CODE128_PATTERNS[CODE128_START_B], true));
  // Compute checksum
  let checksum = CODE128_START_B;
  for (let i = 0; i < data.length; i++) {
    const value = data.charCodeAt(i) - 32;
    checksum += value * (i + 1);
  }
  checksum = checksum % CODE128_MOD;
  // Data
  for (let i = 0; i < data.length; i++) {
    const value = data.charCodeAt(i) - 32;
    bars.push(...patternToBars(CODE128_PATTERNS[value], true));
  }
  // Checksum
  bars.push(...patternToBars(CODE128_PATTERNS[checksum], true));
  // Stop (7-element pattern)
  bars.push(...patternToBars(CODE128_PATTERNS[CODE128_STOP], true));
  // Termination bar (2 modules)
  bars.push({ width: 2, isBar: true });
  return bars;
}

/** Encode 12 or 13 digits as EAN-13. Returns full bar pattern with checksum. */
export function encodeEan13(data: string): Bar[] {
  const d12 = data.length === 13 ? data.slice(0, 12) : data;
  const check = calculateEan13Checksum(d12);
  const full = d12 + String(check);
  const bars: Bar[] = [];
  // Start guard (binary pattern)
  bars.push(...binaryToBars(EAN_START_GUARD));
  // First digit determines parity of next 6
  const firstDigit = Number(d12[0]);
  const parity = EAN_PARITY[firstDigit] ?? "LLLLLL";
  // Left 6 digits (binary patterns, alternating bar/space naturally)
  for (let i = 0; i < 6; i++) {
    const digit = Number(d12[i + 1]);
    const useG = parity[i] === "G";
    const pat = useG ? EAN_G[digit] : EAN_L[digit];
    bars.push(...binaryToBars(pat));
  }
  // Center guard
  bars.push(...binaryToBars(EAN_CENTER_GUARD));
  // Right 6 digits (always R, binary patterns)
  for (let i = 0; i < 6; i++) {
    const digit = Number(full[i + 7]);
    bars.push(...binaryToBars(EAN_R[digit]));
  }
  // End guard
  bars.push(...binaryToBars(EAN_END_GUARD));
  return bars;
}

/** Encode UPC-A (12 digits) — equivalent to EAN-13 with leading 0. */
export function encodeUpc(data: string): Bar[] {
  const d11 = data.length === 12 ? data.slice(0, 11) : data;
  return encodeEan13("0" + d11);
}

/** Encode Code39 with start/stop * and inter-character gap. */
export function encodeCode39(data: string): Bar[] {
  const bars: Bar[] = [];
  const chars = `*${data}*`.toUpperCase();
  for (let i = 0; i < chars.length; i++) {
    const pat = CODE39_PATTERNS[chars[i]];
    if (!pat) continue;
    // Convert N/W pattern to width digits: N=1, W=3
    const widthPat = pat.split("").map((c) => (c === "W" ? "3" : "1")).join("");
    bars.push(...patternToBars(widthPat, true));
    // Inter-character gap (narrow space) between chars
    if (i < chars.length - 1) {
      bars.push({ width: 1, isBar: false });
    }
  }
  return bars;
}

/** Encode ITF (Interleaved 2 of 5). */
export function encodeItf(data: string): Bar[] {
  const bars: Bar[] = [];
  // Start guard — convert N/W pattern to widths then to bars.
  // ITF_START = "NNNN" (4 narrow: bar-space-bar-space).
  const startPat = ITF_START.split("").map((c) => (c === "W" ? "3" : "1")).join("");
  bars.push(...patternToBars(startPat, true));
  // Pairs of digits — first digit's bars, second digit's spaces (interleaved)
  for (let i = 0; i < data.length; i += 2) {
    const d1 = Number(data[i]);
    const d2 = Number(data[i + 1]);
    const p1 = ITF_PATTERNS[d1].split("").map((c) => (c === "W" ? 3 : 1));
    const p2 = ITF_PATTERNS[d2].split("").map((c) => (c === "W" ? 3 : 1));
    for (let j = 0; j < 5; j++) {
      bars.push({ width: p1[j], isBar: true });
      bars.push({ width: p2[j], isBar: false });
    }
  }
  // End guard — ITF_END = "WNN" (wide bar, narrow space, narrow bar).
  const endPat = ITF_END.split("").map((c) => (c === "W" ? "3" : "1")).join("");
  bars.push(...patternToBars(endPat, true));
  return bars;
}

/** Encode data with the right encoder for the type. */
export function encodeBarcode(type: BarcodeType, data: string): Bar[] {
  switch (type) {
    case "CODE128": return encodeCode128(data);
    case "EAN13": return encodeEan13(data);
    case "UPC": return encodeUpc(data);
    case "CODE39": return encodeCode39(data);
    case "ITF": return encodeItf(data);
  }
}

// ---------------------------------------------------------------------------
// Geometry — bars → rectangles, position calc, label
// ---------------------------------------------------------------------------

/**
 * Convert a bar pattern to a list of rectangles for vector drawing.
 *
 * @param bars       Bar pattern (alternating bar/space).
 * @param originX    Left edge of the barcode in PDF coords.
 * @param originY    Bottom edge of the barcode in PDF coords.
 * @param moduleSize Width of one module in PDF points.
 * @param height     Height of each bar in PDF points.
 * @returns Rectangles for the dark bars only.
 */
export function barsToRectangles(
  bars: Bar[],
  originX: number,
  originY: number,
  moduleSize: number,
  height: number,
): BarcodeRect[] {
  const out: BarcodeRect[] = [];
  let x = originX;
  for (const b of bars) {
    const w = b.width * moduleSize;
    if (b.isBar) {
      out.push({ x, y: originY, width: w, height });
    }
    x += w;
  }
  return out;
}

/** Calculate total barcode width (in modules × moduleSize). */
export function calculateBarcodeWidth(bars: Bar[], moduleSize: number): number {
  let modules = 0;
  for (const b of bars) modules += b.width;
  return modules * moduleSize;
}

/** Calculate (x, y) of a barcode at a given position. */
export function calculateBarcodePosition(
  position: BarcodePosition,
  pageWidth: number,
  pageHeight: number,
  barcodeWidth: number,
  barcodeHeight: number,
  margin: number,
): { x: number; y: number } {
  const m = clamp(margin, MIN_MARGIN, Math.max(MIN_MARGIN, pageWidth - barcodeWidth));
  const xLeft = m;
  const xRight = pageWidth - barcodeWidth - m;
  const xCenter = (pageWidth - barcodeWidth) / 2;
  const yTop = pageHeight - barcodeHeight - m;
  const yBottom = m;
  switch (position) {
    case "top-left":      return { x: xLeft,   y: yTop };
    case "top-right":     return { x: xRight,  y: yTop };
    case "top-center":    return { x: xCenter, y: yTop };
    case "bottom-left":   return { x: xLeft,   y: yBottom };
    case "bottom-right":  return { x: xRight,  y: yBottom };
    case "bottom-center": return { x: xCenter, y: yBottom };
  }
}

/** Calculate the position of the text label below the barcode. */
export function calculateTextPosition(
  barX: number,
  barY: number,
  barWidth: number,
  barHeight: number,
  textWidth: number,
  textSize: number,
  pageHeight: number,
): BarcodePlacement {
  const gap = Math.max(2, textSize * 0.4);
  const rawY = barY - gap - textSize;
  const labelY = Math.max(0, Math.min(rawY, pageHeight - textSize));
  const labelX = barX + (barWidth - textWidth) / 2;
  return { x: barX, y: barY, labelX, labelY };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

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

export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to2 = (v: number) => {
    const h = Math.round(clamp(v, 0, 1) * 255).toString(16);
    return h.length === 1 ? "0" + h : h;
  };
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

// ---------------------------------------------------------------------------
// Stats + rendering
// ---------------------------------------------------------------------------

export function computeStats(entries: BarcodeEntry[]): BarcodeStats {
  const byType: Record<BarcodeType, number> = {
    CODE128: 0, EAN13: 0, UPC: 0, CODE39: 0, ITF: 0,
  };
  const byPage: Record<number, number> = {};
  let totalStamps = 0;
  let validCount = 0;
  let invalidCount = 0;
  for (const e of entries) {
    byType[e.type] += 1;
    totalStamps += e.pageIndices.length;
    if (e.valid) validCount += 1;
    else invalidCount += 1;
    for (const p of e.pageIndices) byPage[p] = (byPage[p] ?? 0) + 1;
  }
  return {
    totalEntries: entries.length,
    totalStamps,
    validCount,
    invalidCount,
    byType,
    byPage,
  };
}

export function renderTextReport(entries: BarcodeEntry[], stats: BarcodeStats): string {
  const lines: string[] = [];
  lines.push(`Barcode Stamp Report`);
  lines.push(`====================`);
  lines.push(`Entries: ${stats.totalEntries}`);
  lines.push(`Total stamps: ${stats.totalStamps}`);
  lines.push(`Valid: ${stats.validCount} • Invalid: ${stats.invalidCount}`);
  lines.push(`By type: ${BARCODE_TYPES.map((t) => `${t}=${stats.byType[t]}`).join(", ")}`);
  lines.push(``);
  lines.push(`Per entry:`);
  entries.forEach((e, i) => {
    const pages = e.pageToken === "all"
      ? `all (${e.pageIndices.length} pages)`
      : `pages ${e.pageIndices.map((p) => p + 1).join(",")}`;
    const status = e.valid ? "OK" : `INVALID: ${e.error ?? "unknown"}`;
    lines.push(`  ${i + 1}. [${pages}] ${e.type} — ${e.data} (${status})`);
  });
  return lines.join("\n");
}

export function renderCsv(entries: BarcodeEntry[]): string {
  const lines = ["page,type,data,encoded,valid,error"];
  for (const e of entries) {
    const pages = e.pageToken === "all" ? "all" : e.pageIndices.map((p) => p + 1).join(";");
    const row = [
      pages,
      e.type,
      escapeCsv(e.data),
      escapeCsv(e.encodedData),
      e.valid ? "1" : "0",
      escapeCsv(e.error ?? ""),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Type suggester
// ---------------------------------------------------------------------------

/** Suggest the best-fit barcode type for a data string. */
export function suggestBarcodeType(data: string): BarcodeType {
  if (!data) return "CODE128";
  // 12 digits → UPC
  if (/^\d{12}$/.test(data)) return "UPC";
  // 13 digits → EAN-13
  if (/^\d{13}$/.test(data)) return "EAN13";
  // Even digits, length ≥ 4 → ITF
  if (/^\d+$/.test(data) && data.length >= 4 && data.length % 2 === 0) return "ITF";
  // All chars in Code39 charset → Code39
  const c39 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
  if (data.length > 0 && [...data].every((c) => c39.includes(c.toUpperCase()))) return "CODE39";
  // Default: CODE128
  return "CODE128";
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-barcode-stamper:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  entries: BarcodeEntry[];
  stats: BarcodeStats;
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
  data: string,
  position: BarcodePosition,
  width: number,
  height: number,
  includeText: boolean,
  color: string,
  bgColor: string,
  margin: number,
): string {
  const params = new URLSearchParams();
  if (data) params.set("data", data);
  if (position) params.set("pos", position);
  if (width) params.set("w", String(width));
  if (height) params.set("h", String(height));
  if (includeText) params.set("text", "1");
  if (color) params.set("color", color);
  if (bgColor) params.set("bg", bgColor);
  if (margin !== DEFAULT_MARGIN) params.set("margin", String(margin));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ParsedShareUrl {
  data: string;
  position: BarcodePosition;
  width: number;
  height: number;
  includeText: boolean;
  color: string;
  bgColor: string;
  margin: number;
}

export function parseShareUrl(hash: string): ParsedShareUrl {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      data: "",
      position: "bottom-center",
      width: DEFAULT_BAR_WIDTH,
      height: DEFAULT_BAR_HEIGHT,
      includeText: true,
      color: "#000000",
      bgColor: "#FFFFFF",
      margin: DEFAULT_MARGIN,
    };
  }
  const params = new URLSearchParams(clean);
  const position = (params.get("pos") as BarcodePosition) ?? "bottom-center";
  const validPos = BARCODE_POSITIONS.includes(position) ? position : "bottom-center";
  const widthNum = Number(params.get("w"));
  const width = Number.isFinite(widthNum) ? clamp(widthNum, MIN_BAR_WIDTH, MAX_BAR_WIDTH) : DEFAULT_BAR_WIDTH;
  const heightNum = Number(params.get("h"));
  const height = Number.isFinite(heightNum) ? clamp(heightNum, MIN_BAR_HEIGHT, MAX_BAR_HEIGHT) : DEFAULT_BAR_HEIGHT;
  const marginNum = Number(params.get("margin"));
  const margin = Number.isFinite(marginNum) ? clamp(marginNum, MIN_MARGIN, MAX_MARGIN) : DEFAULT_MARGIN;
  return {
    data: params.get("data") ?? "",
    position: validPos,
    width,
    height,
    includeText: params.get("text") === "1",
    color: params.get("color") ?? "#000000",
    bgColor: params.get("bg") ?? "#FFFFFF",
    margin,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeEntry(
  pageToken: string,
  pageIndices: number[],
  type: BarcodeType,
  data: string,
): BarcodeEntry {
  const validation = validateBarcode(type, data);
  let encodedData = data;
  let pattern: Bar[] = [];
  if (validation.ok) {
    pattern = encodeBarcode(type, data);
    // For EAN/UPC, the encodedData includes the checksum
    if (type === "EAN13") {
      const d12 = data.length === 13 ? data.slice(0, 12) : data;
      const check = calculateEan13Checksum(d12);
      encodedData = d12 + String(check);
    } else if (type === "UPC") {
      const d11 = data.length === 12 ? data.slice(0, 11) : data;
      const check = calculateUpcChecksum(d11);
      encodedData = d11 + String(check);
    }
  }
  return {
    pageToken,
    pageIndices,
    type,
    data,
    valid: validation.ok,
    error: validation.error,
    encodedData,
    pattern,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
