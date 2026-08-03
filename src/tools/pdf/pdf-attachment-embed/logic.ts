/**
 * Add Attachment (Embedded File) to PDF — variant with drag-and-drop.
 * Uses pdf-lib to embed files as PDF attachments.
 */

export interface EmbedResult {
  ok: true;
  pdfBytes: Uint8Array;
  pageCount: number;
  filesEmbedded: number;
}

export type EmbedError = { ok: false; error: string };

export interface EmbeddableFile {
  name: string;
  data: Uint8Array;
  mimeType: string;
  description: string;
}

export async function embedFilesInPdf(
  pdfBuffer: ArrayBuffer,
  files: EmbeddableFile[],
): Promise<EmbedResult | EmbedError> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(pdfBuffer);
    const pageCount = pdf.getPageCount();

    for (const file of files) {
      await pdf.embedFile(file.data, {
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        description: file.description || `Embedded: ${file.name}`,
      });
    }

    const result = await pdf.save();
    return {
      ok: true,
      pdfBytes: result,
      pageCount,
      filesEmbedded: files.length,
    };
  } catch (e) {
    return { ok: false, error: `Embed failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function detectMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
    json: "application/json", xml: "application/xml", html: "text/html",
    css: "text/css", js: "application/javascript", ts: "application/typescript",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", webp: "image/webp", zip: "application/zip",
    md: "text/markdown", py: "text/x-python", java: "text/x-java",
    doc: "application/msword", xls: "application/vnd.ms-excel",
    ppt: "application/vnd.ms-powerpoint",
  };
  return types[ext] || "application/octet-stream";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
