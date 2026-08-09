/**
 * Extract Images from PDF — real engine.
 *
 * Scans the PDF for embedded image XObjects (JPEG via DCTDecode, PNG-ish
 * via FlateDecode) and returns them as downloadable files with detected
 * format, dimensions and size. Pure stream detection is unit-tested.
 */
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface ExtractedImage {
  name: string;
  bytes: Uint8Array;
  format: "jpg" | "png" | "unknown";
  width: number;
  height: number;
  size: number;
}

export interface ExtractImagesResult {
  images: ExtractedImage[];
  count: number;
}

export interface ImageStreamInfo {
  stream: PDFRawStream;
  width: number;
  height: number;
  format: "jpg" | "png" | "unknown";
}

/** Detect embedded image streams. Pure + testable. */
export function findImageStreams(doc: PDFDocument): ImageStreamInfo[] {
  const out: ImageStreamInfo[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const subtype = obj.dict.get(PDFName.of("Subtype"));
    if (!subtype || subtype.toString() !== "/Image") continue;
    const filter = obj.dict.get(PDFName.of("Filter"));
    let filterName = "";
    if (filter instanceof PDFName) filterName = filter.toString();
    else if (Array.isArray(filter)) {
      const first = filter[0];
      if (first instanceof PDFName) filterName = first.toString();
    }
    const width = obj.dict.get(PDFName.of("Width"))?.asNumber() ?? 0;
    const height = obj.dict.get(PDFName.of("Height"))?.asNumber() ?? 0;
    if (width < 1 || height < 1) continue;
    let format: "jpg" | "png" | "unknown" = "unknown";
    if (filterName === "/DCTDecode") format = "jpg";
    else if (filterName === "/FlateDecode") format = "png";
    out.push({ stream: obj, width, height, format });
  }
  return out;
}

/** Build a safe filename for an extracted image. Pure. */
export function imageFilename(index: number, format: "jpg" | "png" | "unknown"): string {
  const ext = format === "jpg" ? "jpg" : format === "png" ? "png" : "bin";
  return `image-${String(index).padStart(2, "0")}.${ext}`;
}

export async function extractImages(bytes: Uint8Array): Promise<ToolResult<ExtractImagesResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const found = findImageStreams(doc);
  if (found.length === 0) {
    return { ok: false, error: "No embedded images were found in this PDF." };
  }
  const images = found.map((info, i) => ({
    name: imageFilename(i + 1, info.format),
    bytes: info.stream.contents.slice(),
    format: info.format,
    width: info.width,
    height: info.height,
    size: info.stream.contents.length,
  }));
  return { ok: true, output: { images, count: images.length } };
}
