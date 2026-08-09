/**
 * PDF Text-to-Speech (Read Aloud) — real engine.
 *
 * Extracts the text layer and exposes it for the browser's
 * speechSynthesis API. `speakText` / `stopSpeech` are thin browser
 * wrappers; extraction is shared and unit-tested. In Node, extraction
 * works but speech requires a browser.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";

export interface TtsResult {
  text: string;
  pages: string[];
  pageCount: number;
  supported: boolean;
}

/** True when the browser supports speech synthesis. */
export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text with the browser's TTS (cancels previous speech first). */
export function speakText(text: string, rate = 1, pitch = 1): boolean {
  if (!speechSupported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = Math.max(0.5, Math.min(2, rate));
  u.pitch = Math.max(0, Math.min(2, pitch));
  synth.speak(u);
  return true;
}

export function stopSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export async function prepareTts(bytes: Uint8Array): Promise<ToolResult<TtsResult>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;
  return {
    ok: true,
    output: { text: r.fullText, pages: r.pages, pageCount: r.pageCount, supported: speechSupported() },
  };
}
