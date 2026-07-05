import { PDFDocument, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type PageSize = "a4" | "letter" | "fit";
export type Orientation = "portrait" | "landscape";
export type MarginSize = "none" | "small" | "medium" | "large";

const MARGIN_PX: Record<MarginSize, number> = { none: 0, small: 20, medium: 40, large: 72 };

const BASE_SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: PageSizes.A4,
  letter: PageSizes.Letter,
};

export interface ImageEntry {
  name: string;
  bytes: Uint8Array;
  /** MIME type reported by the browser */
  mimeType: string;
}

export interface ImagesToPdfOptions {
  pageSize: PageSize;
  orientation: Orientation;
  margin: MarginSize;
}

async function embedImage(doc: PDFDocument, entry: ImageEntry) {
  const mime = entry.mimeType.toLowerCase();
  if (mime.includes("png")) return doc.embedPng(entry.bytes);
  return doc.embedJpg(entry.bytes);
}

export async function imagesToPdf(
  images: ImageEntry[],
  options: ImagesToPdfOptions
): Promise<ToolResult<Uint8Array>> {
  if (images.length === 0) return { ok: false, error: "Add at least one image." };
  try {
    const doc = await PDFDocument.create();
    const margin = MARGIN_PX[options.margin];
    for (const entry of images) {
      let embedded;
      try {
        embedded = await embedImage(doc, entry);
      } catch {
        return {
          ok: false,
          error: `Could not embed "${entry.name}" — ensure it is a valid JPEG or PNG image.`,
        };
      }
      const { width: imgW, height: imgH } = embedded;
      let pageW: number;
      let pageH: number;
      if (options.pageSize === "fit") {
        pageW = imgW + margin * 2;
        pageH = imgH + margin * 2;
      } else {
        const base = BASE_SIZES[options.pageSize];
        const isLandscape = options.orientation === "landscape";
        pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
        pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
      }
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const scale = Math.min(availW / imgW, availH / imgH, 1);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = margin + (availW - drawW) / 2;
      const y = margin + (availH - drawH) / 2;
      const page = doc.addPage([pageW, pageH]);
      page.drawImage(embedded, { x, y, width: drawW, height: drawH });
    }
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Something went wrong during conversion — please try again." };
  }
}
