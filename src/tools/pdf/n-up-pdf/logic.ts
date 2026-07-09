import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type NUpLayout = 2 | 4 | 6 | 8 | 16;

interface GridConfig { cols: number; rows: number; }
const GRID: Record<NUpLayout, GridConfig> = {
  2: { cols: 2, rows: 1 }, 4: { cols: 2, rows: 2 }, 6: { cols: 3, rows: 2 }, 8: { cols: 4, rows: 2 }, 16: { cols: 4, rows: 4 },
};

export async function nUpPdf(bytes: Uint8Array, n: NUpLayout): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try { src = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };
  const grid = GRID[n];
  const perSheet = grid.cols * grid.rows;
  try {
    const out = await PDFDocument.create();
    const sheets = Math.ceil(total / perSheet);
    for (let s = 0; s < sheets; s++) {
      const firstPageIdx = s * perSheet;
      const srcPage = src.getPages()[firstPageIdx];
      const { width: pageW, height: pageH } = srcPage.getSize();
      const outPage = out.addPage([pageW, pageH]);
      const margin = 10;
      const cellW = (pageW - margin * (grid.cols + 1)) / grid.cols;
      const cellH = (pageH - margin * (grid.rows + 1)) / grid.rows;
      const scale = Math.min(cellW / pageW, cellH / pageH);
      const drawW = pageW * scale;
      const drawH = pageH * scale;
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const idx = firstPageIdx + r * grid.cols + c;
          if (idx >= total) break;
          const embedded = await out.embedPage(src.getPages()[idx]);
          const x = margin + c * (cellW + margin) + (cellW - drawW) / 2;
          const y = pageH - margin - r * (cellH + margin) - cellH + (cellH - drawH) / 2;
          outPage.drawPage(embedded, { x, y, width: drawW, height: drawH });
        }
      }
    }
    out.setProducer("UnQTools — N-Up PDF"); out.setCreator("UnQTools — N-Up PDF");
    out.setCreationDate(new Date()); out.setModificationDate(new Date());
    return { ok: true, output: await out.save() };
  } catch { return { ok: false, error: "Something went wrong during N-up layout." }; }
}
