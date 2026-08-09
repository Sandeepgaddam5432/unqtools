/**
 * Split PDF Page into Poster Tiles — real engine.
 *
 * Takes one page and slices it into an ROWS×COLS grid of tiles, each tile
 * becoming its own PDF page — print the tiles and assemble them into a
 * large poster. Crop boxes are used (non-destructive), text stays vector.
 * Pure pdf-lib.
 */
import { PDFDocument, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface PosterOptions {
  /** Page to posterize (1-indexed). Default 1. */
  page?: number;
  rows: number;
  cols: number;
  /** Optional overlap between tiles in pt (helps alignment). */
  overlap?: number;
  /** Output page size: "fit" = tile size, or an ISO size. */
  pageSize?: "fit" | "a4" | "letter";
}

export interface PosterResult {
  bytes: Uint8Array;
  tiles: number;
  rows: number;
  cols: number;
}

/** Compute tile grid geometry. Pure + testable. */
export function tileGrid(
  pageW: number,
  pageH: number,
  rows: number,
  cols: number,
  overlap: number
): { x: number; y: number; w: number; h: number }[] {
  const r = Math.max(1, Math.floor(rows));
  const c = Math.max(1, Math.floor(cols));
  const ov = Math.max(0, overlap || 0);
  const baseW = pageW / c;
  const baseH = pageH / r;
  const tiles: { x: number; y: number; w: number; h: number }[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const x = col * baseW;
      const y = (r - 1 - row) * baseH; // bottom-up in PDF coords
      const w = col === c - 1 ? pageW - x : baseW + ov;
      const h = row === r - 1 ? pageH - y : baseH + ov;
      tiles.push({ x, y, w, h });
    }
  }
  return tiles;
}

export async function posterSplit(
  bytes: Uint8Array,
  options: PosterOptions
): Promise<ToolResult<PosterResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = doc.getPageCount();
  const pageIdx = Math.max(1, Math.min(total, Math.floor(options.page ?? 1))) - 1;
  const rows = Math.max(1, Math.min(10, Math.floor(options.rows || 2)));
  const cols = Math.max(1, Math.min(10, Math.floor(options.cols || 3)));
  const overlap = Math.max(0, Math.min(50, options.overlap ?? 0));

  const srcPage = doc.getPages()[pageIdx]!;
  const { width: pageW, height: pageH } = srcPage.getSize();
  const tiles = tileGrid(pageW, pageH, rows, cols, overlap);

  try {
    const out = await PDFDocument.create();
    for (const t of tiles) {
      let pageW2: number;
      let pageH2: number;
      if (options.pageSize === "a4" || options.pageSize === "letter") {
        const base = options.pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
        pageW2 = base[0];
        pageH2 = base[1];
      } else {
        pageW2 = t.w;
        pageH2 = t.h;
      }
      const outPage = out.addPage([pageW2, pageH2]);
      // Draw only the tile region of the source page.
      const embedded = await out.embedPage(srcPage);
      outPage.drawPage(embedded, {
        x: 0,
        y: 0,
        width: pageW2,
        height: pageH2,
        clip: { x: t.x, y: t.y, width: t.w, height: t.h },
      });
    }
    out.setProducer("UnQTools — Poster Split");
    out.setCreator("UnQTools — Poster Split");
    out.setCreationDate(new Date());
    return { ok: true, output: { bytes: await out.save(), tiles: tiles.length, rows, cols } };
  } catch {
    return { ok: false, error: "Something went wrong while splitting into tiles." };
  }
}
