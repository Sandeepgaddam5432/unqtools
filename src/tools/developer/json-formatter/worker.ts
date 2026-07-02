/**
 * JSON Formatter — Web Worker.
 * Receives a single message, runs the requested operation, posts back a
 * FormatResult. Used by the UI when input size exceeds WORKER_THRESHOLD_BYTES
 * to keep the main thread responsive.
 *
 * Message protocol:
 *   in:  { id: number; op: "format" | "minify" | "validate"; input: string; opts?: FormatOptions }
 *   out: { ok: true; output: string } | { ok: false; error: string; line?: number; column?: number }
 */
import { formatJson, minifyJson, validateJson, type FormatOptions } from "./logic";

export type WorkerRequest =
  | { id: number; op: "format"; input: string; opts: FormatOptions }
  | { id: number; op: "minify"; input: string }
  | { id: number; op: "validate"; input: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  let result;
  if (req.op === "format") {
    result = formatJson(req.input, req.opts);
  } else if (req.op === "minify") {
    result = minifyJson(req.input);
  } else {
    result = validateJson(req.input);
  }
  (self as unknown as Worker).postMessage(result);
};
