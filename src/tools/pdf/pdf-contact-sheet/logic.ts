import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type GridSize = 2 | 3 | 4 | 5;

export async function generateContactSheet(bytes: Uint8Array, gridSize: GridSize, showLabels: boolean): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try { src = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };
  const perSheet = gridSize * gridSize;
  try {
    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);
    const sheets = Math.ceil(total / perSheet);
    for (let s = 0; s < sheets; s++) {
      const firstPageIdx = s * perSheet;
      const srcPage = src.getPages()[firstPageIdx];
      const { width: pageW, height: pageH } = srcPage.getSize();
      const outPage = out.addPage([pageW, pageH]);
      const margin = 20;
      const labelH = showLabels ? 15 : 0;
      const cellW = (pageW - margin * (gridSize + 1)) / gridSize;
      const cellH = (pageH - margin * (gridSize + 1) - labelH * gridSize) / gridSize;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const idx = firstPageIdx + r * gridSize + c;
          if (idx >= total) continue;
          const embedded = await out.embedPage(src.getPages()[idx]);
          const { width: eW, height: eH } = embedded.size();
          const scale = Math.min(cellW / eW, cellH / eH);
          const drawW = eW * scale;
          const drawH = eH * scale;
          const cellX = margin + c * (cellW + margin);
          const cellY = pageH - margin - (r + 1) * cellH - r * (margin + labelH);
          const x = cellX + (cellW - drawW) / 2;
          const y = cellY + (cellH - drawH) / 2;
          outPage.drawPage(embedded, { x, y, width: drawW, height: drawH });
          if (showLabels) {
            const label = `${idx + 1}`;
            const tw = font.widthOfTextAtSize(label, 8);
            outPage.drawText(label, { x: cellX + (cellW - tw) / 2, y: cellY - labelH + 3, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
          }
        }
      }
    }
    out.setProducer("UnQTools — PDF Contact Sheet"); out.setCreator("UnQTools — PDF Contact Sheet");
    return { ok: true, output: await out.save() };
  } catch { return { ok: false, error: "Something went wrong while generating the contact sheet." }; }
}
