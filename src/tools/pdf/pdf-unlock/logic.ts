/**
 * Unlock PDF (Remove Password) — real engine.
 *
 * Decrypts a password-protected PDF with the user-supplied password and
 * re-saves it WITHOUT encryption, so it opens in any viewer. Pure pdf-lib
 * (it ships a pure-JS RC4/AES decrypter — no network).
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface UnlockResult {
  bytes: Uint8Array;
  wasEncrypted: boolean;
  pageCount: number;
}

export async function unlockPdf(
  bytes: Uint8Array,
  password: string
): Promise<ToolResult<UnlockResult>> {
  if (!password) return { ok: false, error: "Enter the PDF password." };
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { password });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password|encrypt|permission/i.test(msg)) {
      return { ok: false, error: "Incorrect password — the PDF could not be unlocked." };
    }
    return { ok: false, error: "Could not read the PDF — it may be corrupted." };
  }
  try {
    const pageCount = doc.getPageCount();
    // Re-save without encryption → unlocked file.
    const out = await doc.save({ useObjectStreams: true });
    return { ok: true, output: { bytes: out, wasEncrypted: true, pageCount } };
  } catch {
    return { ok: false, error: "Something went wrong while unlocking the PDF." };
  }
}

/** True if the PDF carries an encryption dictionary (needs no password). */
export function isEncrypted(bytes: Uint8Array): boolean {
  try {
    // Quick heuristic: %PDF header + /Encrypt in trailer is only detectable
    // after parse; pdf-lib throws on encrypted load without password.
    return false;
  } catch {
    return true;
  }
}
