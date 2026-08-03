/**
 * Add Background Image to PDF — tool variant.
 * Enhanced with image preview and advanced positioning.
 */

export interface BackgroundOptions {
  pages: "all" | "first" | "last" | "odd" | "even";
  opacity: number;
  scale: "fit" | "fill" | "stretch" | "original";
  position: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rotation?: number; // degrees
}

export interface BgResult {
  ok: true;
  outputBytes: Uint8Array;
  pagesModified: number;
  totalPages: number;
}

export type BgError = { ok: false; error: string };

export async function applyBackground(
  pdfBuffer: ArrayBuffer,
  imageBuffer: ArrayBuffer,
  imageFormat: "png" | "jpg",
  opts: BackgroundOptions,
): Promise<BgResult | BgError> {
  try {
    const { PDFDocument, degrees } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdfBuffer);

    const img = imageFormat === "png"
      ? await doc.embedPng(imageBuffer)
      : await doc.embedJpg(imageBuffer);

    const total = doc.getPageCount();
    const targets = getPageIndices(opts.pages, total);
    let modified = 0;

    for (const idx of targets) {
      if (idx >= total) continue;
      const page = doc.getPage(idx);
      const { width: pw, height: ph } = page.getSize();

      let iw: number, ih: number;
      const ratio = img.width / img.height;

      switch (opts.scale) {
        case "fit":
          if (ratio > pw / ph) { iw = pw; ih = pw / ratio; }
          else { ih = ph; iw = ph * ratio; }
          break;
        case "fill":
          if (ratio > pw / ph) { ih = ph; iw = ph * ratio; }
          else { iw = pw; ih = pw / ratio; }
          break;
        case "stretch": iw = pw; ih = ph; break;
        default: iw = img.width; ih = img.height;
      }

      let x: number, y: number;
      switch (opts.position) {
        case "center": x = (pw - iw) / 2; y = (ph - ih) / 2; break;
        case "top-left": x = 0; y = ph - ih; break;
        case "top-right": x = pw - iw; y = ph - ih; break;
        case "bottom-left": x = 0; y = 0; break;
        case "bottom-right": x = pw - iw; y = 0; break;
        default: x = (pw - iw) / 2; y = (ph - ih) / 2;
      }

      page.drawImage(img, {
        x, y, width: iw, height: ih,
        opacity: opts.opacity,
        rotate: opts.rotation ? degrees(opts.rotation) : undefined,
      });
      modified++;
    }

    const saved = await doc.save();
    return { ok: true, outputBytes: saved, pagesModified: modified, totalPages: total };
  } catch (e) {
    return { ok: false, error: `Background failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function getPageIndices(spec: string, total: number): number[] {
  switch (spec) {
    case "all": return Array.from({ length: total }, (_, i) => i);
    case "first": return [0];
    case "last": return [total - 1];
    case "odd": return Array.from({ length: total }, (_, i) => i).filter(i => i % 2 === 0);
    case "even": return Array.from({ length: total }, (_, i) => i).filter(i => i % 2 === 1);
    default: return [0];
  }
}

export function identifyImageType(buf: ArrayBuffer): "png" | "jpg" | null {
  const b = new Uint8Array(buf);
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  return null;
}

export function sizeStr(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
