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
      const [vPos, hPos] = opts.position.split("-") as ["top" | "center" | "bottom", "left" | "center" | "right"];
      const x = hPos === "left" ? margin : hPos === "right" ? width - textW - margin : (width - textW) / 2;
      const y = vPos === "top" ? height - fs - margin : vPos === "bottom" ? margin : (height - fs) / 2;
      // Draw border rectangle
      const padX = 8, padY = 4;
      page.drawRectangle({ x: x - padX, y: y - padY, width: textW + padX * 2, height: fs + padY * 2, borderColor: color, borderWidth: 2, color: rgb(1, 1, 1), opacity: 0.8 });
      page.drawText(fullText, { x, y, size: fs, font, color, rotate: degrees(opts.rotation) });
    }
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong while stamping." }; }
}
