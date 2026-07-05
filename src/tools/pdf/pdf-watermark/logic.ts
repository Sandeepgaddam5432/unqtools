import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type WatermarkPlacement = "diagonal" | "tiled" | "centered";

export interface WatermarkOptions {
  text: string;
  placement: WatermarkPlacement;
  opacity: number;
  fontSize: number;
  color: string;
  /** Comma-separated page spec. Empty = all pages. */
  pages?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export async function addWatermark(
  bytes: Uint8Array,
  options: WatermarkOptions
): Promise<ToolResult<Uint8Array>> {
  if (!options.text.trim()) return { ok: false, error: "Enter watermark text." };
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  let targetIndices: number[];
  const pageSpec = (options.pages ?? "").trim();
  if (pageSpec) {
    const parsed = parsePageRanges(pageSpec, total);
    if (!parsed.ok) return parsed;
    targetIndices = [...new Set(parsed.output)];
  } else {
    targetIndices = Array.from({ length: total }, (_, i) => i);
  }

  const font = await src.embedFont(StandardFonts.HelveticaBold);
  const fs = Math.max(8, Math.min(Number(options.fontSize) || 48, 200));
  const opacity = Math.max(0.01, Math.min(1, Number(options.opacity) || 0.3));
  const c = hexToRgb(options.color || "#808080");
  const color = rgb(c.r, c.g, c.b);

  const pages = src.getPages();
  for (const i of targetIndices) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const textW = font.widthOfTextAtSize(options.text, fs);
    if (options.placement === "diagonal") {
      const angle = degrees(45);
      page.drawText(options.text, {
        x: (width - textW) / 2,
        y: (height - fs) / 2,
        size: fs, font, color, opacity, rotate: angle,
      });
    } else if (options.placement === "centered") {
      page.drawText(options.text, {
        x: (width - textW) / 2,
        y: (height - fs) / 2,
        size: fs, font, color, opacity,
      });
    } else {
      const gapX = textW + fs * 2;
      const gapY = fs * 3;
      for (let y = fs; y < height + gapY; y += gapY) {
        for (let x = 0; x < width + gapX; x += gapX) {
          page.drawText(options.text, { x, y, size: fs, font, color, opacity });
        }
      }
    }
  }
  return { ok: true, output: await src.save() };
}
