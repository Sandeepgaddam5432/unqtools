/**
 * PDF Word Count & Statistics — real engine.
 *
 * Extracts text and computes rich statistics: words, characters (with and
 * without spaces), sentences, paragraphs, lines, reading time (and per
 * page). Pure counting helpers are unit-tested.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";

export interface WordCountStats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  perPage: { page: number; words: number; chars: number }[];
  pages: number;
}

/** Pure counting helpers (Node-testable). */

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function countSentences(text: string): number {
  const m = text.match(/[^.!?…]+[.!?…]+["')\]]*/g);
  return m ? m.length : 0;
}

export function countParagraphs(text: string): number {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.length;
}

export function readingMinutes(words: number, wpm = 200): number {
  return Math.max(0.1, Math.round((words / wpm) * 10) / 10);
}

export async function analyzeText(bytes: Uint8Array): Promise<ToolResult<WordCountStats>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;
  const full = r.fullText;
  const words = countWords(full);
  const chars = full.length;
  const charsNoSpaces = full.replace(/\s/g, "").length;
  const sentences = countSentences(full);
  const paragraphs = countParagraphs(full);
  const perPage = r.pages.map((p, i) => ({
    page: i + 1,
    words: countWords(p),
    chars: p.length,
  }));
  return {
    ok: true,
    output: {
      words,
      chars,
      charsNoSpaces,
      sentences,
      paragraphs,
      readingMinutes: readingMinutes(words),
      perPage,
      pages: r.pageCount,
    },
  };
}
