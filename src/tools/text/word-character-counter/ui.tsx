/**
 * Word & Character Counter — Preact island UI.
 *
 * Layout:
 *  - Two-pane: textarea (left) + live stats grid (right)
 *  - Sticky stat bar: words / characters / sentences / paragraphs / reading time
 *  - Platform limit meters
 *  - SMS segment info
 *  - Keyword density table (top-10)
 *
 * Behavior:
 *  - Counts update live (debounced 100ms)
 *  - Inputs ≥ 100KB route through worker.ts
 *  - Autosave to localStorage
 */
import { useEffect, useMemo, useState } from "preact/hooks";
import { Textarea, Card, Toggle, CopyButton, ToastContainer, toast } from "../../../components/ui";
import {
  countText,
  countSmsSegments,
  getPlatformLimits,
  computeReadingTime,
  computeSpeakingTime,
  keywordDensity,
  WORKER_THRESHOLD_BYTES,
  type TextStats,
} from "./logic";

const STORAGE_KEY = "unq-wcc-input";

export default function WordCharacterCounter() {
  const [input, setInput] = useState<string>("");
  const [stats, setStats] = useState<TextStats | null>(null);
  const [excludeStopwords, setExcludeStopwords] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInput(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Autosave input
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, input);
    } catch {
      /* ignore quota errors */
    }
  }, [input]);

  // Recompute stats (debounced, offloaded to worker for large input)
  const inputBytes = useMemo(() => new Blob([input]).size, [input]);
  const willUseWorker = inputBytes >= WORKER_THRESHOLD_BYTES;

  useEffect(() => {
    if (!input) {
      setStats(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      if (willUseWorker) {
        try {
          const workerUrl = new URL("./worker.ts", import.meta.url);
          const worker = new Worker(workerUrl, { type: "module" });
          const result = await new Promise<TextStats>((resolve, reject) => {
            const t = setTimeout(() => {
              worker.terminate();
              reject(new Error("Worker timeout"));
            }, 10_000);
            worker.onmessage = (e: MessageEvent) => {
              clearTimeout(t);
              worker.terminate();
              const data = e.data as { ok: boolean; stats?: TextStats; error?: string };
              if (data.ok && data.stats) resolve(data.stats);
              else reject(new Error(data.error ?? "Worker error"));
            };
            worker.onerror = (ev: ErrorEvent) => {
              clearTimeout(t);
              worker.terminate();
              reject(new Error(ev.message ?? "Worker error"));
            };
            worker.postMessage({ id: Date.now(), op: "count", input });
          });
          if (!cancelled) setStats(result);
        } catch (e) {
          if (!cancelled) toast((e as Error).message, "error");
        }
      } else {
        if (!cancelled) setStats(countText(input));
      }
      if (!cancelled) setBusy(false);
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, willUseWorker]);

  const sms = useMemo(() => (input ? countSmsSegments(input) : null), [input]);
  const platforms = useMemo(
    () => (stats ? getPlatformLimits(stats.graphemes, stats.words) : []),
    [stats],
  );
  const readingTime = useMemo(
    () => (stats ? computeReadingTime(stats.words) : { minutes: 0, seconds: 0 }),
    [stats],
  );
  const speakingTime = useMemo(
    () => (stats ? computeSpeakingTime(stats.words) : { minutes: 0, seconds: 0 }),
    [stats],
  );
  const keywords = useMemo(
    () => (input ? keywordDensity(input, { excludeStopwords, topN: 10 }) : []),
    [input, excludeStopwords],
  );

  function loadSample() {
    const sample = `UnQTools is a 100% static, privacy-first, offline-capable PWA.

It ships a huge catalog of browser-based tools — converters, calculators, generators, editors, formatters — each ~10x better than existing tool-collection sites. Your data never leaves your browser.

Try pasting your own text here. 👋🌍`;
    setInput(sample);
    toast("Sample loaded", "info");
  }

  function clearAll() {
    setInput("");
    setStats(null);
  }

  const statCard = (label: string, value: number | string, hint?: string) => (
    <Card class="!p-3 text-center">
      <p class="text-2xl font-bold tabular-nums">{value}</p>
      <p class="text-unq-muted mt-1 text-xs uppercase tracking-wide">{label}</p>
      {hint && <p class="text-unq-muted mt-0.5 text-[10px]">{hint}</p>}
    </Card>
  );

  return (
    <div class="space-y-4">
      <ToastContainer />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <Textarea
            id="wcc-input"
            label="Text"
            placeholder="Type or paste your text here…"
            value={input}
            onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
            hint={`${inputBytes.toLocaleString()} bytes${willUseWorker ? " · running in background worker" : ""}${busy ? " · counting…" : ""}`}
            class="min-h-[360px]"
          />
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              class="unq-btn unq-btn-primary !min-h-[40px] !px-3 text-sm"
              onClick={loadSample}
            >
              Load sample
            </button>
            <button
              class="unq-btn !min-h-[40px] border border-border !px-3 text-sm"
              onClick={clearAll}
              disabled={!input}
            >
              Clear
            </button>
            <CopyButton getText={() => input} label="Copy text" />
          </div>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {statCard("Words", stats?.words ?? 0)}
            {statCard("Characters", stats?.graphemes ?? 0, "graphemes")}
            {statCard("No spaces", stats?.charactersNoSpaces ?? 0)}
            {statCard("Sentences", stats?.sentences ?? 0)}
            {statCard("Paragraphs", stats?.paragraphs ?? 0)}
            {statCard("Lines", stats?.lines ?? 0)}
          </div>

          {stats && (
            <Card class="!p-4">
              <p class="mb-2 text-sm font-semibold">Reading & speaking time</p>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-unq-muted">Reading time</p>
                  <p class="font-mono text-lg">
                    {readingTime.minutes}:{String(readingTime.seconds).padStart(2, "0")}
                  </p>
                </div>
                <div>
                  <p class="text-unq-muted">Speaking time</p>
                  <p class="font-mono text-lg">
                    {speakingTime.minutes}:{String(speakingTime.seconds).padStart(2, "0")}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {sms && input && (
            <Card class="!p-4">
              <p class="mb-2 text-sm font-semibold">SMS segmentation</p>
              <div class="flex flex-wrap gap-4 text-sm">
                <span>
                  <span class="text-unq-muted">Encoding:</span> <strong>{sms.encoding}</strong>
                </span>
                <span>
                  <span class="text-unq-muted">Segments:</span>{" "}
                  <strong class="font-mono">{sms.segments}</strong>
                </span>
                <span>
                  <span class="text-unq-muted">Remaining in segment:</span>{" "}
                  <strong class="font-mono">{sms.remainingInSegment}</strong>
                </span>
              </div>
            </Card>
          )}

          {stats && (
            <Card class="!p-4">
              <p class="mb-3 text-sm font-semibold">Platform limits</p>
              <ul class="space-y-1.5 text-xs">
                {platforms.map((p) => (
                  <li key={p.id} class="flex items-center justify-between gap-3">
                    <span class="text-unq-muted">{p.label}</span>
                    <span
                      class={`font-mono tabular-nums ${
                        p.over ? "text-danger" : p.remaining < 20 ? "text-amber-500" : ""
                      }`}
                    >
                      {p.remaining >= 0 ? `${p.remaining} left` : `${-p.remaining} over`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {stats && (
        <Card class="!p-4">
          <details>
            <summary class="cursor-pointer text-sm font-semibold">
              Advanced counts (for developers)
            </summary>
            <div class="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p class="text-unq-muted">UTF-16 code units</p>
                <p class="font-mono text-base">{stats.codeUnits.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-unq-muted">Unicode code points</p>
                <p class="font-mono text-base">{stats.codePoints.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-unq-muted">UTF-8 bytes</p>
                <p class="font-mono text-base">{stats.utf8Bytes.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-unq-muted">Whitespace</p>
                <p class="font-mono text-base">{stats.whitespace.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-unq-muted">Longest sentence (words)</p>
                <p class="font-mono text-base">{stats.longestSentenceWords}</p>
              </div>
              <div>
                <p class="text-unq-muted">Avg sentence (words)</p>
                <p class="font-mono text-base">{stats.avgSentenceWords}</p>
              </div>
            </div>
            {stats.approximate && (
              <p class="mt-3 text-xs text-amber-500">
                ⚠ Intl.Segmenter unavailable — counts are approximate (regex-based fallback).
              </p>
            )}
          </details>
        </Card>
      )}

      {input && (
        <Card class="!p-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-semibold">Keyword density (top 10)</p>
            <Toggle
              id="wcc-stopwords"
              label="Exclude stopwords"
              checked={excludeStopwords}
              onChange={setExcludeStopwords}
            />
          </div>
          {keywords.length === 0 ? (
            <p class="text-unq-muted text-sm">No keywords found.</p>
          ) : (
            <div class="unq-scroll-x">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-unq-muted border-b border-border text-left text-xs">
                    <th class="py-1">#</th>
                    <th class="py-1">Word</th>
                    <th class="py-1 text-right">Count</th>
                    <th class="py-1 text-right">Density</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((k, i) => (
                    <tr key={k.word} class="border-b border-border/50">
                      <td class="text-unq-muted py-1">{i + 1}</td>
                      <td class="py-1 font-mono">{k.word}</td>
                      <td class="py-1 text-right font-mono">{k.count}</td>
                      <td class="py-1 text-right font-mono">{k.density}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> your text never leaves your browser. All counting is local;
          large inputs are processed in a background worker.
        </p>
      </Card>
    </div>
  );
}
