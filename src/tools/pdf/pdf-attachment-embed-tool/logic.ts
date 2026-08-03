/**
 * Add Attachment (Embedded File) to PDF — tool variant.
 * Enhanced with file preview and metadata display.
 */

export interface FileToEmbed {
  name: string;
  data: Uint8Array;
  mimeType: string;
  size: number;
}

export interface EmbedResult {
  ok: true;
  outputBytes: Uint8Array;
  pageCount: number;
  filesCount: number;
}

export type EmbedError = { ok: false; error: string };

export async function embedAttachments(
  pdfBuffer: ArrayBuffer,
  files: FileToEmbed[],
): Promise<EmbedResult | EmbedError> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdfBuffer);

    for (const f of files) {
      await doc.embedFile(f.data, {
        name: f.name,
        mimeType: f.mimeType || "application/octet-stream",
      });
    }

    const saved = await doc.save();
    return {
      ok: true,
      outputBytes: saved,
      pageCount: doc.getPageCount(),
      filesCount: files.length,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Embed failed" };
  }
}

export function getMimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
    json: "application/json", xml: "application/xml", html: "text/html",
    css: "text/css", js: "text/javascript", png: "image/png",
    jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", zip: "application/zip", md: "text/markdown",
  };
  return map[ext] || "application/octet-stream";
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "file-text";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  if (["zip", "tar", "gz", "rar"].includes(ext)) return "archive";
  if (["doc", "docx", "txt", "md"].includes(ext)) return "file-text";
  if (["xls", "xlsx", "csv"].includes(ext)) return "table";
  return "file";
}
