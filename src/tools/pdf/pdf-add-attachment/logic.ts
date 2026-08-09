/**
 * Add Attachment to PDF — real engine.
 *
 * Embeds any file as a PDF attachment (EmbeddedFiles name tree + a paperclip
 * annotation on the first page so viewers show the attachment). Can attach
 * multiple files in one pass and lists existing attachments first. Pure
 * pdf-lib; no network, no uploads.
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFString,
  PDFHexString,
  PDFRawStream,
  PDFNumber,
} from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface AttachmentInput {
  name: string;
  bytes: Uint8Array;
  /** MIME type hint (default application/octet-stream). */
  mime?: string;
  /** Optional description shown in the attachments panel. */
  description?: string;
}

export interface AttachResult {
  bytes: Uint8Array;
  attached: { name: string; size: number }[];
}

export interface ExistingAttachment {
  name: string;
  size: number;
}

/** List file attachments already present in the PDF. Pure-ish (needs doc). */
export function listAttachments(doc: PDFDocument): ExistingAttachment[] {
  const out: ExistingAttachment[] = [];
  const names = doc.catalog.get(PDFName.of("Names"));
  if (!(names instanceof PDFDict)) return out;
  const emb = names.get(PDFName.of("EmbeddedFiles"));
  if (!(emb instanceof PDFDict)) return out;
  const nf = emb.get(PDFName.of("Names"));
  if (!(nf instanceof PDFArray)) return out;
  const arr = nf.asArray();
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const nameEntry = arr[i];
    const refEntry = arr[i + 1];
    const label = nameEntry instanceof PDFString ? nameEntry.decodeText() : nameEntry instanceof PDFHexString ? nameEntry.decodeText() : "?";
    const target = refEntry instanceof PDFRef ? doc.context.lookup(refEntry) : refEntry;
    const size =
      target instanceof PDFDict
        ? target.get(PDFName.of("Size"))?.asNumber() ?? 0
        : 0;
    out.push({ name: label, size });
  }
  return out;
}

export async function addAttachments(
  bytes: Uint8Array,
  attachments: AttachmentInput[]
): Promise<ToolResult<AttachResult>> {
  if (attachments.length === 0) {
    return { ok: false, error: "Choose at least one file to attach." };
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  try {
    const attached: { name: string; size: number }[] = [];
    let lastFsRef: PDFRef | null = null;

    // Ensure the name tree exists.
    let names = doc.catalog.get(PDFName.of("Names"));
    if (!(names instanceof PDFDict)) {
      names = doc.context.obj({});
      doc.catalog.set(PDFName.of("Names"), names);
    }
    let emb = names.get(PDFName.of("EmbeddedFiles"));
    if (!(emb instanceof PDFDict)) {
      emb = doc.context.obj({});
      names.set(PDFName.of("EmbeddedFiles"), emb);
    }
    let nf = emb.get(PDFName.of("Names"));
    if (!(nf instanceof PDFArray)) {
      nf = PDFArray.withContext(doc.context);
      emb.set(PDFName.of("Names"), nf);
    }

    for (const a of attachments) {
      // Build the embedded file stream.
      const fdict = doc.context.obj({});
      fdict.set(PDFName.of("Type"), PDFName.of("EmbeddedFile"));
      fdict.set(PDFName.of("Subtype"), PDFName.of(a.mime ?? "application/octet-stream"));
      const stream = PDFRawStream.of(doc.context, a.bytes.slice());
      stream.dict = fdict;
      // Size + params.
      fdict.set(PDFName.of("Length"), PDFNumber.of(a.bytes.length));
      const params = doc.context.obj({});
      params.set(PDFName.of("Size"), PDFNumber.of(a.bytes.length));
      fdict.set(PDFName.of("Params"), params);
      const streamRef = doc.context.register(stream);

      // Filespec.
      const fs = doc.context.obj({});
      fs.set(PDFName.of("Type"), PDFName.of("Filespec"));
      fs.set(PDFName.of("F"), PDFString.of(a.name));
      fs.set(PDFName.of("UF"), PDFString.of(a.name));
      fs.set(PDFName.of("Desc"), PDFString.of(a.description ?? a.name));
      const ef = doc.context.obj({});
      ef.set(PDFName.of("F"), streamRef);
      fs.set(PDFName.of("EF"), ef);
      const fsRef = doc.context.register(fs);
      lastFsRef = fsRef;

      // Append to the EmbeddedFiles name array (name, ref pairs).
      nf.push(PDFString.of(a.name));
      nf.push(fsRef);
      attached.push({ name: a.name, size: a.bytes.length });
    }

    // Paperclip annotation on page 1 so the attachment is discoverable.
    if (doc.getPageCount() > 0 && lastFsRef) {
      const page = doc.getPages()[0]!;
      const { width, height } = page.getSize();
      const annot = doc.context.obj({
        Type: PDFName.of("Annot"),
        Subtype: PDFName.of("FileAttachment"),
        Rect: [width - 24, height - 24, width - 8, height - 8],
        Contents: PDFString.of(`${attached.length} attachment(s)`),
        FS: lastFsRef,
      });
      const annotRef = doc.context.register(annot);
      const existing = page.node.get(PDFName.of("Annots"));
      let annots: PDFArray;
      if (existing instanceof PDFArray) {
        annots = existing;
      } else {
        annots = PDFArray.withContext(doc.context);
        page.node.set(PDFName.of("Annots"), annots);
      }
      annots.push(annotRef);
    }

    return { ok: true, output: { bytes: await doc.save(), attached } };
  } catch {
    return { ok: false, error: "Something went wrong while attaching the file." };
  }
}
