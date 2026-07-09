import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface SignOptions {
  signatureBytes: Uint8Array; signatureMime: string;
  page: number; x: number; y: number; width: number; height: number;
}

export async function drawSignature(bytes: Uint8Array, opts: SignOptions): Promise<ToolResult<Uint8Array>> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = doc.getPageCount();
  const pageNum = Math.floor(opts.page);
  if (pageNum < 1 || pageNum > total) return { ok: false, error: `Page must be between 1 and ${total}.` };
  try {
    let embedded;
    try {
      embedded = opts.signatureMime.includes("png") ? await doc.embedPng(opts.signatureBytes) : await doc.embedJpg(opts.signatureBytes);
    } catch { return { ok: false, error: "Could not embed the signature image — ensure it is a valid JPEG or PNG." }; }
    const page = doc.getPages()[pageNum - 1];
    const { width: pw, height: ph } = page.getSize();
    const w = Math.max(10, Math.min(opts.width, pw));
    const h = Math.max(10, Math.min(opts.height, ph));
    const x = Math.max(0, Math.min(opts.x, pw - w));
    const y = Math.max(0, Math.min(opts.y, ph - h));
    page.drawImage(embedded, { x, y, width: w, height: h });
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong while placing the signature." }; }
}
