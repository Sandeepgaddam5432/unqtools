/**
 * Extract Text from PDF (PDF to TXT) — real engine.
 *
 * Extracts readable text from every page using the shared content-stream
 * text extractor and returns per-page text plus a combined TXT document.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";

export interface ExtractTextResult {
  bytes: Uint8Array;
  text: string;
  pages: string[];
  pageCount: number;
  totalChars: number;
}

export async function extractText(bytes: Uint8Array): Promise<ToolResult<ExtractTextResult>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;
  const text = `${r.fullText}\n`;
  return {
    ok: true,
    output: {
      bytes: new TextEncoder().encode(text),
      text: r.fullText,
      pages: r.pages,
      pageCount: r.pageCount,
      totalChars: r.fullText.length,
    },
  };
}
