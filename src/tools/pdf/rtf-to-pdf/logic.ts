import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { textToPdf } from "../text-to-pdf/logic";

export interface RtfToPdfOptions { fontSize: number; pageSize: "a4" | "letter"; orientation: "portrait" | "landscape"; margin: number; }

/**
 * Extract plain text from RTF content.
 * Strips RTF control words, groups, and escapes.
 */
export function extractTextFromRtf(rtf: string): string {
  let text = rtf;
  // Remove RTF header
  text = text.replace(/\\rtf[0-9]*\s?/g, "");
  // Remove font table, color table, info group, etc.
  text = text.replace(/\\fonttbl[^}]*}/g, "");
  text = text.replace(/\\colortbl[^}]*}/g, "");
  text = text.replace(/\\info{[^}]*}/g, "");
  text = text.replace(/\\stylesheet[^}]*}/g, "");
  // Remove control words (e.g. \b, \i, \fs24, \par, \pard)
  text = text.replace(/\\'[0-9a-f]{2}/g, ""); // hex chars
  text = text.replace(/\\[a-z]+-?[0-9]*\s?/g, ""); // control words with optional numeric param
  text = text.replace(/\\[a-z]+/g, ""); // control words without param
  text = text.replace(/\\[*{}\\]/g, ""); // escaped chars
  // Remove remaining braces
  text = text.replace(/[{}]/g, "");
  // Unescape
  text = text.replace(/\\\\/g, "\\");
  // Normalize whitespace
  text = text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

export async function rtfToPdf(rtf: string, opts: RtfToPdfOptions): Promise<ToolResult<Uint8Array>> {
  if (!rtf.trim()) return { ok: false, error: "Enter some RTF content to convert." };
  if (!rtf.includes("\\rtf")) return { ok: false, error: "The input doesn't appear to be valid RTF. RTF files start with '{\\rtf'." };
  try {
    const text = extractTextFromRtf(rtf);
    if (!text.trim()) return { ok: false, error: "No text content found in the RTF — it may contain only images or unsupported elements." };
    // Reuse text-to-pdf logic
    return textToPdf(text, { fontSize: opts.fontSize, pageSize: opts.pageSize, orientation: opts.orientation, margin: opts.margin });
  } catch { return { ok: false, error: "Something went wrong during conversion." }; }
}
