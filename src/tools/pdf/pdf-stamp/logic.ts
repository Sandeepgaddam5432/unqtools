import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface StampOptions {
  text: string; includeDate: boolean; fontSize: number; color: string;
  position: "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right";
  pages?: string; rotation: 0 | -45 | 45;
}

const PRESET_COLORS: Record<string, { r: number; g: number; b: number }> = {
  red: { r: 0.8, g: 0.1, b: 0.1 }, blue: { r: 0.1, g: 0.3, b: 0.8 }, green: { r: 0.1, g: 0.5, b: 0.1 }, black: { r: 0, g: 0, b: 0 },
};

export async function addStamp(bytes: Uint8Array, opts: StampOptions): Promise<ToolResult<Uint8Array>> {
  if (!opts.text.trim()) return { ok: false, error: "Enter stamp text." };
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (opts.pages ?? "").trim();
  if (spec) { const p = parsePageRanges(spec, total); if (!p.ok) return p; indices = [...new Set(p.output)]; }
  else { indices = Array.from({ length: total }, (_, i) => i); }
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fs = Math.max(10, Math.min(opts.fontSize, 72));
  const dateStr = opts.includeDate ? ` ${new Date().toISOString().slice(0, 10)}` : "";
  const fullText = `${opts.text}${dateStr}`;
  const c = PRESET_COLORS[opts.color] ?? PRESET_COLORS.red;
  const color = rgb(c.r, c.g, c.b);
  try {
    for (const i of indices) {
      const page = doc.getPages()[i];
      const { width, height } = page.getSize();
      const textW = font.widthOfTextAtSize(fullText, fs);
      const margin = 30;
      // Handle "center" (no hyphen) vs "top-left" (with hyphen)
      const parts = opts.position.split("-");
      const vPos = parts[0] as "top" | "center" | "bottom";
      const hPos = (parts[1] ?? "center") as "left" | "center" | "right";
      const x = hPos === "left" ? margin : hPos === "right" ? width - textW - margin : (width - textW) / 2;
      const y = vPos === "top" ? height - fs - margin : vPos === "bottom" ? margin : (height - fs) / 2;
      // Draw border rectangle (white fill with colored border)
      const padX = 8, padY = 4;
      page.drawRectangle({
        x: x - padX, y: y - padY,
        width: textW + padX * 2, height: fs + padY * 2,
        borderColor: color, borderWidth: 2,
        color: rgb(1, 1, 1),
      });
      // Draw stamp text — only pass rotate if non-zero (degrees(0) can cause issues in some pdf-lib versions)
      const drawOpts: Parameters<typeof page.drawText>[1] = { x, y, size: fs, font, color };
      if (opts.rotation !== 0) drawOpts.rotate = degrees(opts.rotation);
      page.drawText(fullText, drawOpts);
    }
    return { ok: true, output: await doc.save() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Stamping failed: ${msg}. The PDF may use features pdf-lib can't re-save. Try the "Flatten PDF" tool first, then stamp the flattened version.` };
  }
}
