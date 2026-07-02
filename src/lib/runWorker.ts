/**
 * Generic Web Worker harness — offload heavy/blocking work off the main thread.
 * Each tool's worker.ts receives a message and posts back a single result.
 */
export function runInWorker<I, O>(
  workerUrl: URL,
  payload: I,
  options: { timeoutMs?: number } = {},
): Promise<O> {
  const { timeoutMs = 30_000 } = options;
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, { type: "module" });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Worker timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      const data = e.data as { ok: true; output: O } | { ok: false; error: string };
      worker.terminate();
      if (data.ok) {
        resolve(data.output);
      } else {
        reject(new Error(data.error));
      }
    };
    worker.onerror = (e: ErrorEvent) => {
      clearTimeout(timer);
      worker.terminate();
      reject(e instanceof Error ? e : new Error(e.message ?? "Worker error"));
    };
    worker.postMessage(payload);
  });
}
