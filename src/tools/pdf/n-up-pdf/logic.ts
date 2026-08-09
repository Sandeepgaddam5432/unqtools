/**
 * N-Up PDF — advanced imposition.
 *
 * Places 1–16 source pages per output sheet with a computed grid, row-wise
 * or column-wise page order, configurable page size (A4/Letter/A3/custom),
 * margin + gutter, optional cell borders and per-sheet page numbers.
 * Pure pdf-lib — no rasterization, text stays selectable.
 */
import { PDFDocument, PageSizes, rgb, StandardFonts } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type NUpSheet = "a4" | "letter" | "a3" | "a5" | "custom";
export type NUpOrder = "row" | "column";

export interface NUpOptions {
  /** Pages per sheet (1–16). Default 4. */
  pagesPerSheet: number;
  /** Output sheet size. Default "a4". */
  sheet: NUpSheet;
  /** Custom sheet size in pt (when sheet === "custom"). */
  customWidth?: number;
  customHeight?: number;
  /** Page order on the sheet. Default "row". */
  order?: NUpOrder;
  /** Margin around the sheet in pt. Default 10. */
  margin?: number;
  /** Gutter between cells in pt. Default 6. */
  gutter?: number;
  /** Draw a thin border around each cell. Default false. */
  borders?: boolean;
  /** Draw "Sheet N of M" in the bottom-right of each sheet. Default false. */
  sheetNumbers?: boolean;
}

export interface GridConfig {
  cols: number;
  rows: number;
}

/** Compute the grid for N pages per sheet (most square). Pure + testable. */
export function gridFor(n: number): GridConfig {
  const clamped = Math.max(1, Math.min(16, Math.floor(n)));
  const best: { cols: number; rows: number } = { cols: clamped, rows: 1 };
  let bestSpread = Infinity;
  for (let cols = 1; cols <= clamped; cols++) {
    const rows = Math.ceil(clamped / cols);
    const spread = Math.abs(cols - rows);
    // On ties prefer wider grids (side-by-side layout reads naturally).
    if (spread < bestSpread || (spread === bestSpread && cols > best.cols)) {
      bestSpread = spread;
      best.cols = cols;
      best.rows = rows;
    }
  }
  return best;
}

/** Pure layout planner: returns per-sheet cell placement for row/column order. */
export function planLayout(
  pageCount: number,
  pagesPerSheet: number,
  order: NUpOrder
): { sheet: number; cell: number }[] {
  const n = Math.max(1, Math.floor(pagesPerSheet));
  const grid = gridFor(n);
  const out: { sheet: number; cell: number }[] = [];
  const cellsPerSheet = grid.cols * grid.rows;
  for (let i = 0; i < pageCount; i++) {
    const sheet = Math.floor(i / cellsPerSheet);
    const pos = i % cellsPerSheet;
    let cell: number;
    if (order === "column") {
      const col = Math.floor(pos / grid.rows);
      const row = pos % grid.rows;
      cell = row * grid.cols + col;
    } else {
      cell = pos;
    }
    out.push({ sheet, cell });
  }
  return out;
}

export async function nUpPdf(
  bytes: Uint8Array,
  opts: NUpOptions | number
): Promise<ToolResult<Uint8Array>> {
  // Backward-compat: accept a plain number (pages per sheet).
  const options: NUpOptions = typeof opts === "number" ? { pagesPerSheet: opts } : opts;
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };

  const pagesPerSheet = Math.max(1, Math.min(16, Math.floor(options.pagesPerSheet || 4)));
  const order = options.order ?? "row";
  const grid = gridFor(pagesPerSheet);
  const perSheet = grid.cols * grid.rows;

  let sheetW: number;
  let sheetH: number;
  if (options.sheet === "custom") {
    const cw = Number(options.customWidth);
    const ch = Number(options.customHeight);
    if (!Number.isFinite(cw) || cw < 1 || !Number.isFinite(ch) || ch < 1) {
      return { ok: false, error: "Enter valid custom sheet width and height (pt)." };
    }
    sheetW = Math.floor(cw);
    sheetH = Math.floor(ch);
  } else {
    const base =
      options.sheet === "letter" ? PageSizes.Letter : options.sheet === "a3" ? PageSizes.A3 : options.sheet === "a5" ? PageSizes.A5 : PageSizes.A4;
    [sheetW, sheetH] = base;
  }

  const margin = Math.max(0, Number(options.margin ?? 10) || 0);
  const gutter = Math.max(0, Number(options.gutter ?? 6) || 0);
  const cellW = (sheetW - margin * 2 - gutter * (grid.cols - 1)) / grid.cols;
  const cellH = (sheetH - margin * 2 - gutter * (grid.rows - 1)) / grid.rows;

  try {
    const out = await PDFDocument.create();
    const sheets = Math.ceil(total / perSheet);
    const font = options.sheetNumbers ? await out.embedFont(StandardFonts.Helvetica) : null;
    const layout = planLayout(total, perSheet, order);
    const srcPages = src.getPages();

    for (let s = 0; s < sheets; s++) {
      const outPage = out.addPage([sheetW, sheetH]);
      for (let c = 0; c < perSheet; c++) {
        const item = layout.find((l) => l.sheet === s && l.cell === c);
        if (!item) continue;
        const srcPage = srcPages[layout.findIndex((l) => l === item)]!;
        const { width: pw, height: ph } = srcPage.getSize();
        const scale = Math.min((cellW - (options.borders ? 4 : 0)) / pw, (cellH - (options.borders ? 4 : 0)) / ph);
        const drawW = pw * scale;
        const drawH = ph * scale;
        const col = c % grid.cols;
        const row = Math.floor(c / grid.cols);
        const x = margin + col * (cellW + gutter) + (cellW - drawW) / 2;
        const y = sheetH - margin - row * (cellH + gutter) - cellH + (cellH - drawH) / 2;
        const embedded = await out.embedPage(srcPage);
        outPage.drawPage(embedded, { x, y, width: drawW, height: drawH });
        if (options.borders) {
          outPage.drawRectangle({
            x: margin + col * (cellW + gutter),
            y: sheetH - margin - (row + 1) * (cellH + gutter),
            width: cellW,
            height: cellH,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });
        }
      }
      if (options.sheetNumbers && font) {
        const label = `Sheet ${s + 1} of ${sheets}`;
        const w = font.widthOfTextAtSize(label, 8);
        outPage.drawText(label, { x: sheetW - margin - w, y: margin / 2, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      }
    }

    out.setProducer("UnQTools — N-Up PDF");
    out.setCreator("UnQTools — N-Up PDF");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());
    return { ok: true, output: await out.save() };
  } catch {
    return { ok: false, error: "Something went wrong during N-up layout." };
  }
}
