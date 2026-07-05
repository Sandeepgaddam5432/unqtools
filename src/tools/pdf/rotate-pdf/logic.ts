import { PDFDocument, degrees } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type RotationDeg = 90 | 180 | 270;
export type RotateTarget = "all" | "odd" | "even" | "custom";

export interface RotateOptions {
  rotation: RotationDeg;
  target: RotateTarget;
  /** Only for target === "custom" */
  customPages?: string;
}

export async function rotatePdf(
  bytes: Uint8Array,
  options: RotateOptions
): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  let indices: number[];
  if (options.target === "all") {
    indices = Array.from({ length: total }, (_, i) => i);
  } else if (options.target === "odd") {
    indices = Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 0);
  } else if (options.target === "even") {
    indices = Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 1);
  } else {
    const spec = (options.customPages ?? "").trim();
    if (!spec) return { ok: false, error: "Enter page numbers or ranges to rotate, e.g. 1, 3-5." };
    const parsed = parsePageRanges(spec, total);
    if (!parsed.ok) return parsed;
    indices = [...new Set(parsed.output)];
  }
  if (indices.length === 0) {
    return { ok: false, error: "No pages matched — check your selection." };
  }
  const pagesAll = src.getPages();
  for (const i of indices) {
    const page = pagesAll[i];
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + options.rotation) % 360));
  }
  return { ok: true, output: await src.save() };
}
