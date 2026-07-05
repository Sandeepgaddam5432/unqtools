import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type NumberPosition =
  | "bottom-left" | "bottom-center" | "bottom-right"
  | "top-left" | "top-center" | "top-right";

export type NumberFormat = "page-x" | "page-x-of-n" | "x" | "x-of-n";

export interface PageNumberOptions {
  position: NumberPosition;
  format: NumberFormat;
  startAt: number;
  fontSize: number;
  /** Comma-separated page spec to skip (1-indexed). */
  skipPages?: string;
}

export async function addPageNumbers(
  bytes: Uint8Array,
  options: PageNumberOptions
): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const font = await src.embedFont(StandardFonts.Helvetica);
  const fs = Math.max(6, Math.min(Number(options.fontSize) || 12, 72));
  const margin = 24;

  let skipSet = new Set<number>();
  const skipSpec = (options.skipPages ?? "").trim();
  if (skipSpec) {
    const parsed = parsePageRanges(skipSpec, total);
    if (!parsed.ok) return parsed;
    skipSet = new Set(parsed.output);
  }

  const pages = src.getPages();
  let displayNum = Math.floor(options.startAt ?? 1);
  for (let i = 0; i < total; i++) {
    if (skipSet.has(i)) { displayNum += 1; continue; }
    const page = pages[i];
    const { width, height } = page.getSize();
    const label = formatLabel(options.format, displayNum, total - skipSet.size);
    const textW = font.widthOfTextAtSize(label, fs);
    const top = options.position.startsWith("top");
    const y = top ? height - margin - fs : margin;
    const part = options.position.split("-")[1] as "left" | "center" | "right";
    const x = part === "left" ? margin : part === "right" ? width - margin - textW : (width - textW) / 2;
    page.drawText(label, { x, y, size: fs, font, color: rgb(0, 0, 0), opacity: 0.75 });
    displayNum += 1;
  }
  return { ok: true, output: await src.save() };
}

function formatLabel(format: NumberFormat, current: number, total: number): string {
  switch (format) {
    case "page-x": return `Page ${current}`;
    case "page-x-of-n": return `Page ${current} of ${total}`;
    case "x": return `${current}`;
    case "x-of-n": return `${current} / ${total}`;
  }
}
