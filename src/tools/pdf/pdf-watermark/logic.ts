/**
 * PDF Watermark — advanced.
 *
 * Text AND image watermarks, 4 placements (diagonal, centered, tiled,
 * custom position), rotation, opacity, font size/bold/color, per-page
 * ranges, and multiple watermarks layered in one pass. Pure pdf-lib;
 * image watermarks embed PNG/JPEG in the document.
 */
import {
  PDFDocument,
  PDFImage,
  PDFFont,
  StandardFonts,
  degrees,
  rgb,
  type RGB,
} from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type WatermarkPlacement = "diagonal" | "tiled" | "centered" | "custom";
export type Anchor =
  | "top-left" | "top" | "top-right"
  | "left" | "center" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

export interface WatermarkTextPart {
  text: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  rotateDeg?: number;
}

export interface WatermarkImagePart {
  /** PNG or JPEG bytes. */
  imageBytes: Uint8Array;
  /** Width in PDF points (height auto). */
  widthPt?: number;
  opacity?: number;
  rotateDeg?: number;
}

export interface WatermarkOptions {
  /** Text watermark (or empty when using an image). */
  text?: string;
  /** Image watermark (or empty when using text). */
  image?: WatermarkImagePart;
  placement: WatermarkPlacement;
  /** Anchor used by "custom" placement. */
  anchor?: Anchor;
  /** Manual x/y offset (pt) for "custom" placement. */
  xOffset?: number;
  yOffset?: number;
  opacity: number;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  rotateDeg?: number;
  /** Comma-separated page spec. Empty = all pages. */
  pages?: string;
  /** Extra text watermarks layered on top (e.g. corner stamps). */
  extras?: WatermarkTextPart[];
}

function hexToRgb(hex: string): RGB {
  const clean = (hex || "#808080").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return rgb(0.5, 0.5, 0.5);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function anchorPoint(
  anchor: Anchor,
  width: number,
  height: number,
  itemW: number,
  itemH: number,
  margin = 24
): { x: number; y: number } {
  const h = anchor.includes("left") ? margin : anchor.includes("right") ? width - margin - itemW : (width - itemW) / 2;
  const v = anchor.includes("top") ? height - margin - itemH : anchor.includes("bottom") ? margin : (height - itemH) / 2;
  return { x: h, y: v };
}

export async function addWatermark(
  bytes: Uint8Array,
  options: WatermarkOptions
): Promise<ToolResult<Uint8Array>> {
  const hasText = Boolean(options.text?.trim());
  const hasImage = Boolean(options.image);
  if (!hasText && !hasImage) {
    return { ok: false, error: "Enter watermark text or choose a watermark image." };
  }

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

  const font: PDFFont = options.bold
    ? await src.embedFont(StandardFonts.HelveticaBold)
    : await src.embedFont(StandardFonts.Helvetica);
  const fs = Math.max(8, Math.min(Number(options.fontSize) || 48, 200));
  const opacity = Math.max(0.01, Math.min(1, Number(options.opacity) || 0.3));
  const color = hexToRgb(options.color || "#808080");
  const rotate = options.rotateDeg ?? (options.placement === "diagonal" ? 45 : 0);

  // Prepare optional image watermark.
  let img: PDFImage | null = null;
  let imgW = 0;
  let imgH = 0;
  if (hasImage && options.image) {
    try {
      img = await src.embedJpg(options.image.imageBytes);
    } catch {
      try {
        img = await src.embedPng(options.image.imageBytes);
      } catch {
        img = null;
      }
    }
    if (img) {
      imgW = options.image.widthPt ?? 120;
      imgH = (img.height / img.width) * imgW;
    }
  }

  const pages = src.getPages();
  for (const i of targetIndices) {
    const page = pages[i]!;
    const { width, height } = page.getSize();
    const textW = hasText ? font.widthOfTextAtSize(options.text!, fs) : 0;

    // ---- Main watermark ----
    if (options.placement === "tiled") {
      const gapX = textW + fs * 2;
      const gapY = fs * 3;
      for (let y = fs; y < height + gapY; y += gapY) {
        for (let x = 0; x < width + gapX; x += gapX) {
          if (hasText) page.drawText(options.text!, { x, y, size: fs, font, color, opacity, rotate: degrees(rotate) });
        }
      }
      if (img) {
        // Tile image watermark at fixed intervals.
        for (let y = 0; y < height; y += imgH * 2.2) {
          for (let x = 0; x < width; x += imgW * 2.2) {
            page.drawImage(img, { x, y, width: imgW, height: imgH, opacity });
          }
        }
      }
    } else if (options.placement === "custom") {
      const itemW = hasImage && img ? imgW : textW;
      const itemH = hasImage && img ? imgH : fs;
      const base = anchorPoint(options.anchor ?? "center", width, height, itemW, itemH);
      const x = base.x + (options.xOffset ?? 0);
      const y = base.y + (options.yOffset ?? 0);
      if (hasText) page.drawText(options.text!, { x, y, size: fs, font, color, opacity, rotate: degrees(rotate) });
      if (img) page.drawImage(img, { x, y, width: imgW, height: imgH, opacity });
    } else {
      // diagonal or centered
      if (hasText) {
        const x = (width - textW) / 2;
        const y = (height - fs) / 2;
        page.drawText(options.text!, { x, y, size: fs, font, color, opacity, rotate: degrees(rotate) });
      }
      if (img) {
        const x = (width - imgW) / 2;
        const y = (height - imgH) / 2;
        page.drawImage(img, { x, y, width: imgW, height: imgH, opacity });
      }
    }

    // ---- Extra layered watermarks (corner stamps etc.) ----
    for (const extra of options.extras ?? []) {
      if (!extra.text.trim()) continue;
      const fs2 = Math.max(6, Math.min(extra.fontSize ?? 10, 60));
      const f2 = extra.bold ? await src.embedFont(StandardFonts.HelveticaBold) : font;
      const w2 = f2.widthOfTextAtSize(extra.text, fs2);
      const p2 = anchorPoint(extra.anchor ?? "top-left", width, height, w2, fs2, 12);
      page.drawText(extra.text, {
        x: p2.x,
        y: p2.y,
        size: fs2,
        font: f2,
        color: hexToRgb(extra.color ?? "#888888"),
        opacity: Math.max(0.01, Math.min(1, options.opacity)),
        rotate: degrees(extra.rotateDeg ?? 0),
      });
    }
  }

  return { ok: true, output: await src.save() };
}
