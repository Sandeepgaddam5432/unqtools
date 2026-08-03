/**
 * Add Background Image to PDF — pure logic using pdf-lib.
 * Adds an image as background to all or selected pages.
 */

export type PageSize = "all" | "first" | "last" | "odd" | "even" | number[];

export interface BgOptions {
  pages: PageSize;
  opacity?: number; // 0-1
  scale?: "fit" | "fill" | "stretch" | "original";
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface BgResult {
  ok: true;
  pdfBytes: Uint8Array;
  pageCount: number;
  pagesModified: number;
}

export type BgError = { ok: false; error: string };

export async function addBackgroundImage(
  pdfBuffer: ArrayBuffer,
  imageBuffer: ArrayBuffer,
  imageType: "png" | "jpg",
  options: BgOptions,
): Promise<BgResult | BgError> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(pdfBuffer);

    let image;
    if (imageType === "png") {
      image = await pdf.embedPng(imageBuffer);
    } else {
      image = await pdf.embedJpg(imageBuffer);
    }

    const totalPages = pdf.getPageCount();
    const targetPages = resolvePages(options.pages, totalPages);
    let pagesModified = 0;

    for (const pageIdx of targetPages) {
      if (pageIdx >= totalPages) continue;
      const page = pdf.getPage(pageIdx);
      const { width: pageW, height: pageH } = page.getSize();

      let imgW: number, imgH: number;
      const imgAspect = image.width / image.height;
      const pageAspect = pageW / pageH;

      switch (options.scale || "fit") {
        case "fit":
          if (imgAspect > pageAspect) {
            imgW = pageW;
            imgH = pageW / imgAspect;
          } else {
            imgH = pageH;
            imgW = pageH * imgAspect;
          }
          break;
        case "fill":
          if (imgAspect > pageAspect) {
            imgH = pageH;
            imgW = pageH * imgAspect;
          } else {
            imgW = pageW;
            imgH = pageW / imgAspect;
          }
          break;
        case "stretch":
          imgW = pageW;
          imgH = pageH;
          break;
        case "original":
          imgW = image.width;
          imgH = image.height;
          break;
        default:
          imgW = pageW;
          imgH = pageH;
      }

      let x: number, y: number;
      switch (options.position || "center") {
        case "center":
          x = (pageW - imgW) / 2;
          y = (pageH - imgH) / 2;
          break;
        case "top-left":
          x = 0;
          y = pageH - imgH;
          break;
        case "top-right":
          x = pageW - imgW;
          y = pageH - imgH;
          break;
        case "bottom-left":
          x = 0;
          y = 0;
          break;
        case "bottom-right":
          x = pageW - imgW;
          y = 0;
          break;
        default:
          x = (pageW - imgW) / 2;
          y = (pageH - imgH) / 2;
      }

      page.drawImage(image, {
        x,
        y,
        width: imgW,
        height: imgH,
        opacity: options.opacity ?? 1,
      });
      pagesModified++;
    }

    const result = await pdf.save();
    return { ok: true, pdfBytes: result, pageCount: totalPages, pagesModified };
  } catch (e) {
    return { ok: false, error: `Failed to add background: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function resolvePages(spec: PageSize, total: number): number[] {
  if (spec === "all") return Array.from({ length: total }, (_, i) => i);
  if (spec === "first") return [0];
  if (spec === "last") return [total - 1];
  if (spec === "odd") return Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 0);
  if (spec === "even") return Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 1);
  if (Array.isArray(spec)) return spec.filter((i) => i >= 0 && i < total);
  return [0];
}

export function detectImageType(buffer: ArrayBuffer): "png" | "jpg" | null {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
