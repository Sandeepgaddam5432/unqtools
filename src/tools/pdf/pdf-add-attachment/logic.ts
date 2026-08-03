/**
 * Add Attachment to PDF — pure logic using pdf-lib.
 * Embeds files as PDF attachments (embedded file annotations).
 */

export interface AttachmentResult {
  ok: true;
  pdfBytes: Uint8Array;
  attachmentCount: number;
  totalPages: number;
}

export interface AttachmentError {
  ok: false;
  error: string;
}

export async function addAttachmentToPdf(
  pdfBytes: ArrayBuffer,
  attachments: { name: string; data: Uint8Array; description?: string }[],
): Promise<AttachmentResult | AttachmentError> {
  try {
    const { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFStream } = await import("pdf-lib");
    const pdf = await PDFDocument.load(pdfBytes);

    for (const att of attachments) {
      const fileData = await pdf.embedFile(att.data, {
        name: att.name,
        mimeType: getMimeType(att.name),
        description: att.description || "",
      });
    }

    const result = await pdf.save();
    return {
      ok: true,
      pdfBytes: result,
      attachmentCount: attachments.length,
      totalPages: pdf.getPageCount(),
    };
  } catch (e) {
    return { ok: false, error: `Failed to add attachment: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    txt: "text/plain",
    pdf: "application/pdf",
    json: "application/json",
    xml: "application/xml",
    csv: "text/csv",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/typescript",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    zip: "application/zip",
    md: "text/markdown",
  };
  return mimeMap[ext || ""] || "application/octet-stream";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
