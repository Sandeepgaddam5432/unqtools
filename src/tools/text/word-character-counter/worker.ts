/**
 * Word & Character Counter — Web Worker.
 * Same logic as logic.ts, offloaded for inputs ≥ 100KB to keep UI smooth.
 */
import {
  countText,
  countSmsSegments,
  getPlatformLimits,
  keywordDensity,
  type TextStats,
  type SmsInfo,
  type PlatformLimit,
} from "./logic";

export type WorkerRequest =
  | { id: number; op: "count"; input: string }
  | { id: number; op: "sms"; input: string }
  | { id: number; op: "platforms"; input: string }
  | { id: number; op: "keywords"; input: string; topN: number };

export type WorkerResponse =
  | { ok: true; stats: TextStats }
  | { ok: true; sms: SmsInfo }
  | { ok: true; platforms: PlatformLimit[] }
  | { ok: true; keywords: { word: string; count: number; density: number }[] }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const req = e.data;
    if (req.op === "count") {
      const stats = countText(req.input);
      (self as unknown as Worker).postMessage({ ok: true, stats } satisfies WorkerResponse);
    } else if (req.op === "sms") {
      const sms = countSmsSegments(req.input);
      (self as unknown as Worker).postMessage({ ok: true, sms } satisfies WorkerResponse);
    } else if (req.op === "platforms") {
      const stats = countText(req.input);
      const platforms = getPlatformLimits(stats.graphemes, stats.words);
      (self as unknown as Worker).postMessage({ ok: true, platforms } satisfies WorkerResponse);
    } else if (req.op === "keywords") {
      const keywords = keywordDensity(req.input, { topN: req.topN });
      (self as unknown as Worker).postMessage({ ok: true, keywords } satisfies WorkerResponse);
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: (err as Error).message,
    } satisfies WorkerResponse);
  }
};
