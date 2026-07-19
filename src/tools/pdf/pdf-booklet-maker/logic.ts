/**
 * PDF Booklet Maker — pure logic.
 *
 * Arrange PDF pages for booklet printing:
 *  - Saddle-stitch: classic fold-and-staple, 2 pages per side, nested sheets
 *  - Perfect-bound: signatures of N sheets each, then glued at spine
 *  - Gate-fold: 3 panels per side (6 pages per sheet)
 *
 * Pure functions only — no DOM, no network, no pdf-lib imports.
 */

// ---- Types ----

export type BookletType = "saddle-stitch" | "perfect-bound" | "gate-fold";

export type PaperSizeId =
  | "a4-portrait"
  | "a4-landscape"
  | "letter-portrait"
  | "letter-landscape"
  | "a3-portrait"
  | "a3-landscape";

export interface PaperSize {
  id: PaperSizeId;
  label: string;
  /** Width in points (1/72 inch). */
  width: number;
  /** Height in points. */
  height: number;
  orientation: "portrait" | "landscape";
}

export interface BookletSide {
  /** 0-indexed sheet number. */
  sheetNum: number;
  side: "front" | "back";
  /**
   * Source page indices (1-indexed). 0 means a blank padding page.
   * 2 entries for saddle-stitch/perfect-bound, 3 for gate-fold.
   */
  pages: number[];
}

export interface BookletLayout {
  type: BookletType;
  /** Original page count from source PDF. */
  sourcePageCount: number;
  /** Padded page count (next multiple of 4 for saddle-stitch, 6 for gate-fold). */
  paddedPageCount: number;
  /** Number of sheets of paper. */
  sheetCount: number;
  /** Number of signatures (1 for saddle-stitch and gate-fold). */
  signatureCount: number;
  /** Ordered list of sides (front/back per sheet). */
  sides: BookletSide[];
  /** Number of blank padding pages added. */
  blankPages: number;
}

export interface BookletSummary {
  sourcePageCount: number;
  paddedPageCount: number;
  blankPages: number;
  sheetCount: number;
  signatureCount: number;
  bookletType: BookletType;
  paperSizeLabel: string;
  duplex: boolean;
  cropMarks: boolean;
  spineWidthPt: number;
  spineWidthMm: number;
  bindingMarginPt: number;
}

// ---- Constants ----

// Paper dimensions in points (1/72 inch). A4=210x297mm, A3=420x297mm, Letter=8.5x11in, etc.
export const PAPER_SIZES: PaperSize[] = [
  { id: "a4-portrait", label: "A4 Portrait (210×297mm)", width: 595.28, height: 841.89, orientation: "portrait" },
  { id: "a4-landscape", label: "A4 Landscape (297×210mm)", width: 841.89, height: 595.28, orientation: "landscape" },
  { id: "letter-portrait", label: "US Letter Portrait (8.5×11in)", width: 612, height: 792, orientation: "portrait" },
  { id: "letter-landscape", label: "US Letter Landscape (11×8.5in)", width: 792, height: 612, orientation: "landscape" },
  { id: "a3-portrait", label: "A3 Portrait (297×420mm)", width: 841.89, height: 1190.55, orientation: "portrait" },
  { id: "a3-landscape", label: "A3 Landscape (420×297mm)", width: 1190.55, height: 841.89, orientation: "landscape" },
];

export const PAPER_SIZE_LABELS: Record<PaperSizeId, string> = PAPER_SIZES.reduce(
  (acc, p) => {
    acc[p.id] = p.label;
    return acc;
  },
  {} as Record<PaperSizeId, string>,
);

export const BOOKLET_TYPE_LABELS: Record<BookletType, string> = {
  "saddle-stitch": "Saddle-stitch (fold + staple)",
  "perfect-bound": "Perfect-bound (signatures + glue)",
  "gate-fold": "Gate-fold (3 panels per side)",
};

// Default sheets per signature for perfect-bound (4 sheets = 16 pages per signature)
export const DEFAULT_SHEETS_PER_SIGNATURE = 4;

// Spine width: ~0.05mm per sheet of 80gsm paper (rough estimate)
export const SPINE_WIDTH_PER_SHEET_MM = 0.1;

// Binding margin (inner gutter for hole-punch / staple)
export const BINDING_MARGIN_PT = 18; // 1/4 inch

// ---- Math helpers ----

/** Round n up to the next multiple of m. */
export function padToMultiple(n: number, m: number): number {
  if (n <= 0) return 0;
  if (m <= 0) return n;
  return Math.ceil(n / m) * m;
}

/** Pad page count to a multiple of 4 (saddle-stitch / perfect-bound). */
export function padToMultipleOf4(n: number): number {
  return padToMultiple(n, 4);
}

/** Convert a 1-indexed page number to 0 (blank) if it's out of range. */
function toBlank(p: number, pageCount: number): number {
  if (p < 1 || p > pageCount) return 0;
  return p;
}

// ---- Paper sizes ----

export function getPaperSize(id: PaperSizeId): PaperSize {
  const p = PAPER_SIZES.find((s) => s.id === id);
  if (!p) throw new Error(`Unknown paper size: ${id}`);
  return p;
}

export function isPaperSizeId(s: string): s is PaperSizeId {
  return PAPER_SIZES.some((p) => p.id === s);
}

// ---- Page order algorithms ----

/**
 * Saddle-stitch page order.
 * For N pages (padded to multiple of 4), sheet i (0-indexed):
 *   front = [N-2i, 2i+1]
 *   back  = [2i+2, N-(2i+1)]
 * Pages beyond sourcePageCount are returned as 0 (blank).
 */
export function saddleStitchOrder(sourcePageCount: number): BookletSide[] {
  if (sourcePageCount <= 0) return [];
  const N = padToMultipleOf4(sourcePageCount);
  const sheets = N / 4;
  const out: BookletSide[] = [];
  for (let i = 0; i < sheets; i++) {
    out.push({
      sheetNum: i,
      side: "front",
      pages: [toBlank(N - 2 * i, sourcePageCount), toBlank(2 * i + 1, sourcePageCount)],
    });
    out.push({
      sheetNum: i,
      side: "back",
      pages: [toBlank(2 * i + 2, sourcePageCount), toBlank(N - (2 * i + 1), sourcePageCount)],
    });
  }
  return out;
}

/**
 * Perfect-bound page order.
 * Group pages into signatures of `sheetsPerSignature * 4` pages,
 * then apply saddle-stitch within each signature.
 */
export function perfectBoundOrder(
  sourcePageCount: number,
  sheetsPerSignature: number = DEFAULT_SHEETS_PER_SIGNATURE,
): BookletSide[] {
  if (sourcePageCount <= 0) return [];
  const sheetsPerSig = Math.max(1, Math.floor(sheetsPerSignature));
  const pagesPerSig = sheetsPerSig * 4;
  const out: BookletSide[] = [];
  let sigStart = 1; // 1-indexed start of current signature
  let sheetOffset = 0;
  while (sigStart <= sourcePageCount) {
    const sigEnd = sigStart + pagesPerSig - 1;
    const sigPages = sigEnd - sigStart + 1; // pages in this signature (before padding)
    const sigN = padToMultipleOf4(sigPages);
    const sigSheets = sigN / 4;
    for (let i = 0; i < sigSheets; i++) {
      const localFrontLeft = sigN - 2 * i;
      const localFrontRight = 2 * i + 1;
      const localBackLeft = 2 * i + 2;
      const localBackRight = sigN - (2 * i + 1);
      const absFrontLeft = toBlank(sigStart + localFrontLeft - 1, sourcePageCount);
      const absFrontRight = toBlank(sigStart + localFrontRight - 1, sourcePageCount);
      const absBackLeft = toBlank(sigStart + localBackLeft - 1, sourcePageCount);
      const absBackRight = toBlank(sigStart + localBackRight - 1, sourcePageCount);
      out.push({
        sheetNum: sheetOffset + i,
        side: "front",
        pages: [absFrontLeft, absFrontRight],
      });
      out.push({
        sheetNum: sheetOffset + i,
        side: "back",
        pages: [absBackLeft, absBackRight],
      });
    }
    sigStart = sigEnd + 1;
    sheetOffset += sigSheets;
  }
  return out;
}

/**
 * Gate-fold page order (3 panels per side, 6 pages per sheet).
 * For N pages (padded to multiple of 6), sheet i:
 *   front = [N-6i, 6i+1, 6i+2]
 *   back  = [N-6i-1, 6i+4, 6i+3]
 */
export function gateFoldOrder(sourcePageCount: number): BookletSide[] {
  if (sourcePageCount <= 0) return [];
  const N = padToMultiple(sourcePageCount, 6);
  const sheets = N / 6;
  const out: BookletSide[] = [];
  for (let i = 0; i < sheets; i++) {
    out.push({
      sheetNum: i,
      side: "front",
      pages: [
        toBlank(N - 6 * i, sourcePageCount),
        toBlank(6 * i + 1, sourcePageCount),
        toBlank(6 * i + 2, sourcePageCount),
      ],
    });
    out.push({
      sheetNum: i,
      side: "back",
      pages: [
        toBlank(N - 6 * i - 1, sourcePageCount),
        toBlank(6 * i + 4, sourcePageCount),
        toBlank(6 * i + 3, sourcePageCount),
      ],
    });
  }
  return out;
}

// ---- Layout assembly ----

export interface BookletOptions {
  type: BookletType;
  sheetsPerSignature?: number;
}

export function computeLayout(sourcePageCount: number, options: BookletOptions): BookletLayout {
  const { type, sheetsPerSignature = DEFAULT_SHEETS_PER_SIGNATURE } = options;
  if (sourcePageCount <= 0) {
    return {
      type,
      sourcePageCount: 0,
      paddedPageCount: 0,
      sheetCount: 0,
      signatureCount: 0,
      sides: [],
      blankPages: 0,
    };
  }
  let sides: BookletSide[] = [];
  let paddedPageCount = 0;
  let signatureCount = 1;
  if (type === "saddle-stitch") {
    sides = saddleStitchOrder(sourcePageCount);
    paddedPageCount = padToMultipleOf4(sourcePageCount);
    signatureCount = 1;
  } else if (type === "perfect-bound") {
    sides = perfectBoundOrder(sourcePageCount, sheetsPerSignature);
    const sigs = Math.ceil(sourcePageCount / (Math.max(1, sheetsPerSignature) * 4));
    signatureCount = sigs;
    paddedPageCount = sigs * Math.max(1, sheetsPerSignature) * 4;
  } else {
    sides = gateFoldOrder(sourcePageCount);
    paddedPageCount = padToMultiple(sourcePageCount, 6);
    signatureCount = 1;
  }
  return {
    type,
    sourcePageCount,
    paddedPageCount,
    sheetCount: Math.ceil(sides.length / 2),
    signatureCount,
    sides,
    blankPages: paddedPageCount - sourcePageCount,
  };
}

// ---- Sheet / signature calculators ----

export function sheetCount(sourcePageCount: number, type: BookletType): number {
  if (sourcePageCount <= 0) return 0;
  if (type === "gate-fold") return Math.ceil(padToMultiple(sourcePageCount, 6) / 6);
  return Math.ceil(padToMultipleOf4(sourcePageCount) / 4);
}

export function signatureCount(
  sourcePageCount: number,
  type: BookletType,
  sheetsPerSignature: number = DEFAULT_SHEETS_PER_SIGNATURE,
): number {
  if (type !== "perfect-bound") return 1;
  if (sourcePageCount <= 0) return 0;
  const pagesPerSig = Math.max(1, sheetsPerSignature) * 4;
  return Math.ceil(sourcePageCount / pagesPerSig);
}

// ---- Page count validator ----

export function validatePageCount(
  sourcePageCount: number,
  type: BookletType,
): { valid: boolean; padded: number; blanks: number; multiple: number } {
  if (sourcePageCount <= 0) {
    return { valid: false, padded: 0, blanks: 0, multiple: 0 };
  }
  const multiple = type === "gate-fold" ? 6 : 4;
  const valid = sourcePageCount % multiple === 0;
  const padded = padToMultiple(sourcePageCount, multiple);
  return { valid, padded, blanks: padded - sourcePageCount, multiple };
}

// ---- Blank page padder (returns padding count) ----

export function blankPadderCount(sourcePageCount: number, type: BookletType): number {
  if (sourcePageCount <= 0) return 0;
  const multiple = type === "gate-fold" ? 6 : 4;
  return padToMultiple(sourcePageCount, multiple) - sourcePageCount;
}

// ---- Duplex arrangement ----

export interface DuplexPair {
  sheetNum: number;
  front: BookletSide;
  back: BookletSide;
}

/** Group sides into front/back pairs per sheet. */
export function duplexArrangement(sides: BookletSide[]): DuplexPair[] {
  const out: DuplexPair[] = [];
  for (let i = 0; i + 1 < sides.length; i += 2) {
    const front = sides[i];
    const back = sides[i + 1];
    if (front && back && front.sheetNum === back.sheetNum) {
      out.push({ sheetNum: front.sheetNum, front, back });
    }
  }
  return out;
}

// ---- Page position calculator ----

export interface PagePosition {
  /** X (origin = left edge) in points. */
  x: number;
  /** Y (origin = bottom edge) in points. */
  y: number;
  /** Slot width in points. */
  width: number;
  /** Slot height in points. */
  height: number;
}

/**
 * Calculate position of each page slot on a sheet.
 * For 2-up: left slot and right slot (split horizontally).
 * For 3-up: left, center, right.
 * Includes an inner gutter for binding.
 */
export function pagePositions(
  paperSize: PaperSize,
  pagesPerSide: number,
  bindingMargin: number = BINDING_MARGIN_PT,
): PagePosition[] {
  const { width, height } = paperSize;
  const slotW = (width - bindingMargin * (pagesPerSide + 1)) / pagesPerSide;
  const slotH = height - bindingMargin * 2;
  const positions: PagePosition[] = [];
  for (let i = 0; i < pagesPerSide; i++) {
    const x = bindingMargin + i * (slotW + bindingMargin);
    const y = bindingMargin;
    positions.push({ x, y, width: slotW, height: slotH });
  }
  return positions;
}

// ---- Crop marks generator ----

export interface CropLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate crop marks at the corners of a rectangular area.
 * Each corner gets a small horizontal + vertical line just outside.
 */
export function cropMarks(
  x: number,
  y: number,
  w: number,
  h: number,
  length: number = 10,
  offset: number = 4,
): CropLine[] {
  const lines: CropLine[] = [];
  // Top-left
  lines.push({ x1: x - offset - length, y1: y + h, x2: x - offset, y2: y + h }); // horizontal
  lines.push({ x1: x, y1: y + h + offset, x2: x, y2: y + h + offset + length }); // vertical
  // Top-right
  lines.push({ x1: x + w + offset, y1: y + h, x2: x + w + offset + length, y2: y + h });
  lines.push({ x1: x + w, y1: y + h + offset, x2: x + w, y2: y + h + offset + length });
  // Bottom-left
  lines.push({ x1: x - offset - length, y1: y, x2: x - offset, y2: y });
  lines.push({ x1: x, y1: y - offset - length, x2: x, y2: y - offset });
  // Bottom-right
  lines.push({ x1: x + w + offset, y1: y, x2: x + w + offset + length, y2: y });
  lines.push({ x1: x + w, y1: y - offset - length, x2: x + w, y2: y - offset });
  return lines;
}

// ---- Binding margin + spine width ----

export function bindingMarginPt(): number {
  return BINDING_MARGIN_PT;
}

export function spineWidth(sheetCount: number, sheetsPerSignature: number = 1): number {
  // Rough estimate: each sheet adds SPINE_WIDTH_PER_SHEET_MM mm
  // Perfect-bound has slightly more due to glue + cover
  const base = sheetCount * SPINE_WIDTH_PER_SHEET_MM;
  const glue = sheetsPerSignature > 1 ? 0.5 : 0;
  return Math.round((base + glue) * 100) / 100;
}

export function pointsToMm(pt: number): number {
  return Math.round((pt * 25.4 / 72) * 100) / 100;
}

// ---- Cover page separator (for perfect-bound) ----

/**
 * Identify which sides belong to which signature.
 * Returns array of signature indices, one per side.
 */
export function signatureSeparator(
  sides: BookletSide[],
  sheetsPerSignature: number = DEFAULT_SHEETS_PER_SIGNATURE,
): number[] {
  const sheetsPerSig = Math.max(1, sheetsPerSignature);
  return sides.map((s) => Math.floor(s.sheetNum / sheetsPerSig));
}

// ---- Page order validator ----

export function validatePageOrder(sides: BookletSide[], sourcePageCount: number): {
  valid: boolean;
  duplicates: number[];
  missing: number[];
} {
  const seen = new Set<number>();
  const duplicates: number[] = [];
  for (const side of sides) {
    for (const p of side.pages) {
      if (p === 0) continue; // blank
      if (seen.has(p)) duplicates.push(p);
      seen.add(p);
    }
  }
  const missing: number[] = [];
  for (let i = 1; i <= sourcePageCount; i++) {
    if (!seen.has(i)) missing.push(i);
  }
  return { valid: duplicates.length === 0 && missing.length === 0, duplicates, missing };
}

// ---- Summary stats ----

export function computeSummary(
  layout: BookletLayout,
  paperSizeId: PaperSizeId,
  duplex: boolean,
  cropMarksEnabled: boolean,
  sheetsPerSignature: number = DEFAULT_SHEETS_PER_SIGNATURE,
): BookletSummary {
  const spineMm = spineWidth(layout.sheetCount, layout.type === "perfect-bound" ? sheetsPerSignature : 1);
  return {
    sourcePageCount: layout.sourcePageCount,
    paddedPageCount: layout.paddedPageCount,
    blankPages: layout.blankPages,
    sheetCount: layout.sheetCount,
    signatureCount: layout.signatureCount,
    bookletType: layout.type,
    paperSizeLabel: PAPER_SIZE_LABELS[paperSizeId],
    duplex,
    cropMarks: cropMarksEnabled,
    spineWidthPt: Math.round(spineMm * 72 / 25.4 * 100) / 100,
    spineWidthMm: spineMm,
    bindingMarginPt: BINDING_MARGIN_PT,
  };
}

// ---- Renderers ----

function pageLabel(p: number): string {
  return p === 0 ? "BLANK" : `${p}`;
}

/** Render the booklet layout as a text diagram. */
export function renderText(layout: BookletLayout): string {
  const lines: string[] = [];
  lines.push(`Booklet Layout — ${BOOKLET_TYPE_LABELS[layout.type]}`);
  lines.push(`Source pages: ${layout.sourcePageCount}  Padded: ${layout.paddedPageCount}  Blanks: ${layout.blankPages}`);
  lines.push(`Sheets: ${layout.sheetCount}  Signatures: ${layout.signatureCount}`);
  lines.push("");
  for (const side of layout.sides) {
    const pagesStr = side.pages.map(pageLabel).join(" | ");
    lines.push(`Sheet ${side.sheetNum + 1} ${side.side.toUpperCase().padEnd(5)} → [ ${pagesStr} ]`);
  }
  return lines.join("\n");
}

/** Render the booklet layout as CSV. */
export function renderCsv(layout: BookletLayout): string {
  const lines: string[] = ["sheet_num,side,position,page_num"];
  for (const side of layout.sides) {
    side.pages.forEach((p, idx) => {
      lines.push(`${side.sheetNum + 1},${side.side},${idx + 1},${p === 0 ? "BLANK" : p}`);
    });
  }
  return lines.join("\n");
}

/** Render the booklet layout as an HTML preview. */
export function renderHtml(layout: BookletLayout): string {
  const rows = layout.sides
    .map((side) => {
      const cells = side.pages
        .map((p) => `<td class="slot ${p === 0 ? "blank" : ""}">${p === 0 ? "—" : p}</td>`)
        .join("");
      return `<tr><td class="sheet">${side.sheetNum + 1}</td><td class="side">${side.side}</td>${cells}</tr>`;
    })
    .join("");
  return `<table class="booklet-layout">
<thead><tr><th>Sheet</th><th>Side</th>${layout.sides[0]?.pages.map((_, i) => `<th>Slot ${i + 1}</th>`).join("") ?? ""}</tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:pdf-booklet-maker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  bookletType: BookletType;
  sourcePageCount: number;
  sheetCount: number;
  signatureCount: number;
  paperSize: PaperSizeId;
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

export function buildShareUrl(
  bookletType: BookletType,
  sheetsPerSignature: number,
  paperSize: PaperSizeId,
  duplex: boolean,
  cropMarksEnabled: boolean,
): string {
  const params = new URLSearchParams();
  params.set("type", bookletType);
  params.set("sig", String(sheetsPerSignature));
  params.set("paper", paperSize);
  params.set("duplex", String(duplex));
  params.set("crops", String(cropMarksEnabled));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ParsedShare {
  bookletType: BookletType;
  sheetsPerSignature: number;
  paperSize: PaperSizeId;
  duplex: boolean;
  cropMarks: boolean;
}

export function parseShareUrl(hash: string): ParsedShare | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const typeStr = params.get("type");
  const sigStr = params.get("sig");
  const paperStr = params.get("paper");
  if (!typeStr || !paperStr) return null;
  const validTypes: BookletType[] = ["saddle-stitch", "perfect-bound", "gate-fold"];
  if (!validTypes.includes(typeStr as BookletType)) return null;
  if (!isPaperSizeId(paperStr)) return null;
  const sig = sigStr ? Math.max(1, parseInt(sigStr, 10)) : DEFAULT_SHEETS_PER_SIGNATURE;
  if (Number.isNaN(sig)) return null;
  return {
    bookletType: typeStr as BookletType,
    sheetsPerSignature: sig,
    paperSize: paperStr as PaperSizeId,
    duplex: params.get("duplex") !== "false",
    cropMarks: params.get("crops") === "true",
  };
}
