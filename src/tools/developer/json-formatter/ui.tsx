/**
 * JSON Formatter — Preact island UI.
 *
 * Layout:
 *  - Two-pane textarea (input / output) on desktop, stacked on mobile
 *  - Options bar: indent select, sort-keys toggle, format / minify / validate buttons, load sample
 *  - Error banner with line:column when applicable
 *  - Copy + download on the output
 *  - Live "char count" / "byte size" hint
 *
 * Behavior:
 *  - Inputs under WORKER_THRESHOLD_BYTES run on the main thread (instant).
 *  - Larger inputs are offloaded to worker.ts via runInWorker so the UI never janks.
 *  - URL state: ?i=base64(input) lets users share a prefilled tool state.
 */
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  Button,
  Textarea,
  Select,
  Toggle,
  CopyButton,
  DownloadButton,
  ErrorBanner,
  Card,
  ToastContainer,
  toast,
} from "../../../components/ui";
import {
  formatJson,
  minifyJson,
  validateJson,
  WORKER_THRESHOLD_BYTES,
  type FormatOptions,
  type FormatResult,
} from "./logic";

const SAMPLE = `{
  "name": "UnQTools",
  "version": "0.1.0",
  "tools": 1700,
  "static": true,
  "features": ["offline", "private", "pwa"],
  "author": {
    "name": "Sandeep Gaddam",
    "url": "https://github.com/Sandeepgaddam5432"
  }
}`;

type Op = "format" | "minify" | "validate";

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<number>(2);
  const [sortKeys, setSortKeys] = useState<boolean>(false);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lineCol, setLineCol] = useState<{ line?: number; column?: number } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [lastOp, setLastOp] = useState<Op | null>(null);

  // Restore shared state from URL (?i=base64) — must be safe; ignore on failure.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("i");
    if (encoded) {
      try {
        const decoded = atob(encoded);
        setInput(decoded);
      } catch {
        /* ignore malformed share links */
      }
    }
  }, []);

  const inputBytes = useMemo(() => new Blob([input]).size, [input]);
  const outputBytes = useMemo(() => new Blob([output]).size, [output]);
  const willUseWorker = inputBytes >= WORKER_THRESHOLD_BYTES;

  async function runInWorker(op: Op, opts?: FormatOptions): Promise<FormatResult> {
    const workerUrl = new URL("./worker.ts", import.meta.url);
    const worker = new Worker(workerUrl, { type: "module" });
    return new Promise<FormatResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Worker timed out after 30s"));
      }, 30_000);
      worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timer);
        worker.terminate();
        resolve(e.data as FormatResult);
      };
      worker.onerror = (ev: ErrorEvent) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(ev.message ?? "Worker error"));
      };
      const payload =
        op === "format"
          ? { id: Date.now(), op, input, opts: opts ?? { indent, sortKeys } }
          : { id: Date.now(), op, input };
      worker.postMessage(payload);
    });
  }

  async function run(op: Op) {
    setLastOp(op);
    if (!input.trim()) {
      setError("Input is empty.");
      setOutput("");
      setLineCol(null);
      return;
    }
    setBusy(true);
    setError(null);
    setLineCol(null);
    try {
      let r: FormatResult;
      if (willUseWorker) {
        r = await runInWorker(op, { indent, sortKeys });
      } else if (op === "format") {
        r = formatJson(input, { indent, sortKeys });
      } else if (op === "minify") {
        r = minifyJson(input);
      } else {
        r = validateJson(input);
      }
      if (r.ok) {
        setOutput(r.output);
      } else {
        setError(r.error);
        setOutput("");
        setLineCol({ line: r.line, column: r.column });
      }
    } catch (e) {
      setError((e as Error).message ?? "Unexpected error");
      setOutput("");
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setInput(SAMPLE);
    setOutput("");
    setError(null);
    setLineCol(null);
    toast("Sample loaded", "info");
  }

  function clearAll() {
    setInput("");
    setOutput("");
    setError(null);
    setLineCol(null);
  }

  function shareLink() {
    try {
      const encoded = btoa(input);
      const url = `${window.location.origin}${window.location.pathname}?i=${encoded}`;
      void navigator.clipboard.writeText(url).then(
        () => toast("Share link copied", "success"),
        () => toast("Could not copy link", "error"),
      );
    } catch {
      toast("Input too large to share via URL", "error");
    }
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="flex flex-wrap items-end gap-4">
          <Select
            id="opt-indent"
            label="Indent"
            value={String(indent)}
            onChange={(e) => setIndent(Number((e.currentTarget as HTMLSelectElement).value))}
            options={[
              { value: "2", label: "2 spaces" },
              { value: "4", label: "4 spaces" },
              { value: "\t", label: "Tab" },
            ]}
          />
          <Toggle id="opt-sort" label="Sort keys" checked={sortKeys} onChange={setSortKeys} />
          <div class="flex flex-wrap gap-2">
            <Button onClick={() => run("format")} disabled={busy}>
              {busy ? "Working…" : "Format"}
            </Button>
            <Button variant="outline" onClick={() => run("minify")} disabled={busy}>
              Minify
            </Button>
            <Button variant="outline" onClick={() => run("validate")} disabled={busy}>
              Validate
            </Button>
            <Button variant="ghost" onClick={loadSample}>
              Load sample
            </Button>
            <Button variant="ghost" onClick={clearAll} disabled={!input && !output}>
              Clear
            </Button>
            <Button variant="ghost" onClick={shareLink} disabled={!input}>
              Share link
            </Button>
          </div>
        </div>
        {willUseWorker && (
          <p class="text-unq-muted mt-3 text-xs">
            Input ≥ 100 KB — running in a background worker to keep the UI smooth.
          </p>
        )}
      </Card>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <Textarea
            id="json-input"
            label="Input"
            placeholder="Paste JSON here…"
            value={input}
            onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
            hint={`${inputBytes.toLocaleString()} bytes`}
            class="min-h-[320px]"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="json-output" class="text-sm font-medium">
            Output
          </label>
          <pre
            id="json-output"
            aria-live="polite"
            class="unq-input min-h-[320px] overflow-auto whitespace-pre-wrap py-2 font-mono text-sm"
          >
            {output}
          </pre>
          {output && (
            <div class="flex items-center justify-between gap-2">
              <p class="text-unq-muted text-xs">
                {outputBytes.toLocaleString()} bytes · op: {lastOp ?? "—"}
              </p>
              <div class="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton
                  filename="formatted.json"
                  getText={() => output}
                  mime="application/json"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={
            lineCol?.line ? `${error} (line ${lineCol.line}, column ${lineCol.column})` : error
          }
        />
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> your input never leaves your browser. Everything runs locally —
          including large files, which are processed in a background Web Worker.
        </p>
      </Card>
    </div>
  );
}
