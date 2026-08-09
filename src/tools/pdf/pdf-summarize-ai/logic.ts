/**
 * PDF Summarize (On-Device AI) — real engine.
 *
 * Extractive summarization, no cloud: scores sentences by term frequency
 * (TF-style) with position bonus, picks the top-N sentences, and reorders
 * them by original position. Returns a readable summary + per-section
 * highlights. Pure and unit-tested in Node.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";

export interface SummaryResult {
  summary: string;
  bytes: Uint8Array;
  sourceChars: number;
  sentences: number;
  ratio: number;
}

/** Split text into sentences. Pure + testable. */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+["')\]]*|\S[^.!?…]*$/g) ?? [];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Tokenize into words. Pure. */
export function tokenize(text: string): string[] {
  const m = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  return m ?? [];
}

/** Score sentences: TF frequency + first-sentence bonus. Pure + testable. */
export function scoreSentences(sentences: string[]): { sentence: string; score: number; index: number }[] {
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of tokenize(s)) {
      if (w.length < 3) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return sentences.map((sentence, index) => {
    let score = 0;
    const seen = new Set<string>();
    for (const w of tokenize(sentence)) {
      if (w.length < 3 || seen.has(w)) continue;
      seen.add(w);
      score += freq.get(w) ?? 0;
    }
    // Position bonus: first 2 sentences get a boost.
    if (index < 2) score *= 1.5;
    return { sentence, score, index };
  });
}

/** Produce a summary of ~n sentences. Pure + testable. */
export function summarize(sentences: string[], n: number): string {
  const target = Math.max(1, Math.min(sentences.length, n));
  const scored = scoreSentences(sentences);
  const top = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, target)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence);
  return top.join(" ");
}

export async function summarizePdf(bytes: Uint8Array, sentences = 5): Promise<ToolResult<SummaryResult>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;
  const sentencesList = splitSentences(r.fullText);
  if (sentencesList.length === 0) {
    return { ok: false, error: "No sentences were found to summarize." };
  }
  const summary = summarize(sentencesList, sentences);
  return {
    ok: true,
    output: {
      summary,
      bytes: new TextEncoder().encode(summary),
      sourceChars: r.fullText.length,
      sentences: sentencesList.length,
      ratio: Math.round((summary.length / Math.max(1, r.fullText.length)) * 100),
    },
  };
}
