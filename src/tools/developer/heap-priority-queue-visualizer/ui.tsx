"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  createHeap,
  fromArray,
  cloneHeap,
  insertPure,
  extractPure,
  peek,
  size,
  computeStats,
  isValid,
  layout,
  parent,
  left,
  right,
  runInsert,
  runExtract,
  runBuild,
  runChangePriority,
  runHeapsort,
  compareBuildVsInsert,
  parseValues,
  serializeHeap,
  deserializeHeap,
  nodeColorClass,
  formatStep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  randomArray,
  sortedArray,
  reverseSortedArray,
  type HeapState,
  type HeapKind,
  type OpKind,
  type OpResult,
  type Step,
  type TreeLayout as TreeLayoutView,
  type HistoryEntry,
} from "./logic";
import {
  History, Layers, Play, Pause, SkipForward, SkipBack,
  RotateCcw, ArrowDownToLine, ArrowUpFromLine, Sparkles,
  Plus, Minus, Trash2, TreePine, ListOrdered, Gauge,
} from "lucide-react";

type Tab = "insert" | "extract" | "build" | "change-priority" | "heapsort";

export default function HeapPriorityQueueVisualizer() {
  const [heap, setHeap] = useState<HeapState>(() => fromArray([9, 5, 2, 7, 1, 3, 8, 4, 6], "min"));
  const [kind, setKind] = useState<HeapKind>("min");
  const [tab, setTab] = useState<Tab>("insert");
  const [valueInput, setValueInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [cpIndexInput, setCpIndexInput] = useState("");
  const [cpValueInput, setCpValueInput] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastResult, setLastResult] = useState<OpResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p && p.heap !== null) {
        const h = deserializeHeap(p.heap);
        if (h) {
          setHeap(h);
          setKind(h.kind);
          toast.info("Loaded heap from share link");
        }
      }
    }
  }, []);

  // Compute the active operation result.
  const result: OpResult | null = useMemo(() => {
    if (tab === "insert") {
      const v = parseInt(valueInput, 10);
      if (!Number.isFinite(v)) return null;
      return runInsert(heap, v);
    }
    if (tab === "extract") {
      if (heap.arr.length === 0) return null;
      return runExtract(heap);
    }
    if (tab === "build") {
      return runBuild(heap);
    }
    if (tab === "change-priority") {
      const idx = parseInt(cpIndexInput, 10);
      const v = parseInt(cpValueInput, 10);
      if (!Number.isFinite(idx) || !Number.isFinite(v)) return null;
      return runChangePriority(heap, idx, v);
    }
    if (tab === "heapsort") {
      if (heap.arr.length === 0) return null;
      return runHeapsort(heap);
    }
    return null;
  }, [tab, valueInput, cpIndexInput, cpValueInput, heap]);

  const steps = result?.steps ?? [];
  const totalSteps = steps.length;
  const safeStepIndex = Math.min(stepIndex, Math.max(0, totalSteps - 1));
  const currentStep: Step | null = totalSteps > 0 ? steps[safeStepIndex] : null;
  const displayArr = currentStep?.arr ?? heap.arr;
  const displayHeapSize = currentStep?.heapSize ?? heap.arr.length;
  const displaySorted = currentStep?.sortedSuffix ?? [];
  const stats = useMemo(() => computeStats(heap), [heap]);

  // Play/pause effect.
  useEffect(() => {
    if (playing && totalSteps > 0) {
      const delay = 1100 - speed * 100;
      intervalRef.current = setInterval(() => {
        setStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [playing, totalSteps, speed]);

  // Reset step index when tab/input changes.
  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [tab, valueInput, cpIndexInput, cpValueInput]);

  const treeLayout = useMemo(() => {
    // Layout from current display array.
    const tempHeap: HeapState = { arr: displayArr, kind };
    return layout(tempHeap);
  }, [displayArr, kind]);

  const handleApply = useCallback(() => {
    if (!result || result.steps.length === 0) {
      toast.info("Nothing to run — enter a value first");
      return;
    }
    const last = result.steps[result.steps.length - 1];
    const newHeap: HeapState = { arr: [...last.arr], kind };
    setHeap(newHeap);
    setStepIndex(0);
    setPlaying(false);
    setLastResult(result);
    saveHistory({
      ts: Date.now(),
      op: result.kind as OpKind,
      value: tab === "insert" ? parseInt(valueInput, 10) : undefined,
      size: newHeap.arr.length,
      comparisons: result.totalComparisons,
      swaps: result.totalSwaps,
      ok: result.ok,
    });
    setHistory(loadHistory());
    toast.success(`${result.kind} done (${result.totalComparisons} cmp, ${result.totalSwaps} swaps)`);
  }, [result, kind, tab, valueInput]);

  const handleKindSwitch = useCallback((newKind: HeapKind) => {
    const h = cloneHeap(heap);
    h.kind = newKind;
    // Re-heapify
    const built = fromArray(h.arr, newKind);
    setHeap(built);
    setKind(newKind);
    setStepIndex(0);
    setPlaying(false);
    toast.info(`Switched to ${newKind}-heap and rebuilt`);
  }, [heap]);

  const handleClear = useCallback(() => {
    setHeap(createHeap(kind));
    setStepIndex(0);
    setPlaying(false);
    setValueInput("");
    setBulkInput("");
    setCpIndexInput("");
    setCpValueInput("");
    toast.info("Heap cleared");
  }, [kind]);

  const handleBulkInsert = useCallback(() => {
    const { ok, skipped } = parseValues(bulkInput);
    if (ok.length === 0) {
      toast.error("No valid integers found");
      return;
    }
    const h = cloneHeap(heap);
    for (const v of ok) insertPure(h, v);
    setHeap(h);
    setBulkInput("");
    toast.success(`Inserted ${ok.length} value(s)${skipped.length > 0 ? `, skipped ${skipped.length}` : ""}`);
  }, [bulkInput, heap]);

  const handlePeek = useCallback(() => {
    const p = peek(heap);
    if (p === null) toast.info("Heap is empty");
    else toast.success(`Peek: ${p} (root, index 0)`);
  }, [heap]);

  const handleRandom = useCallback((n: number) => {
    setHeap(fromArray(randomArray(n, Date.now() & 0xffff), kind));
    setStepIndex(0);
    setPlaying(false);
    toast.success(`Generated ${n} random values`);
  }, [kind]);

  const handleSortedPreset = useCallback((which: "asc" | "desc") => {
    const arr = which === "asc" ? sortedArray(10) : reverseSortedArray(10);
    setHeap({ arr: [...arr], kind });
    setStepIndex(0);
    setPlaying(false);
    toast.success(`Loaded ${which === "asc" ? "ascending" : "descending"} array (heap property not yet enforced — use Build-heap)`);
  }, [kind]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const comparison = useMemo(() => {
    if (heap.arr.length === 0) return null;
    return compareBuildVsInsert(heap.arr, kind);
  }, [heap, kind]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Header card: kind + tabs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Heap kind:</Label>
              <Button
                size="sm"
                variant={kind === "min" ? "default" : "outline"}
                onClick={() => handleKindSwitch("min")}
                className="h-7"
              >Min-heap</Button>
              <Button
                size="sm"
                variant={kind === "max" ? "default" : "outline"}
                onClick={() => handleKindSwitch("max")}
                className="h-7"
              >Max-heap</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handlePeek} className="h-7 gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Peek
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleRandom(10)} className="h-7">Random 10</Button>
              <Button size="sm" variant="ghost" onClick={() => handleRandom(25)} className="h-7">Random 25</Button>
              <Button size="sm" variant="ghost" onClick={() => handleSortedPreset("asc")} className="h-7">Sorted↑</Button>
              <Button size="sm" variant="ghost" onClick={() => handleSortedPreset("desc")} className="h-7">Sorted↓</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["insert", "Insert", Plus],
              ["extract", "Extract", Minus],
              ["build", "Build-heap", TreePine],
              ["change-priority", "Change-priority", Gauge],
              ["heapsort", "Heapsort", ListOrdered],
            ] as const).map(([t, label, Icon]) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "default" : "outline"}
                onClick={() => setTab(t)}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Stat label="Size" value={stats.size} />
            <Stat label="Height" value={stats.height} />
            <Stat label="Kind" value={stats.kind} />
            <Stat label="Valid heap" value={stats.isValid ? "yes" : "no"} highlight={stats.isValid ? "good" : "bad"} />
            <Stat label="Root" value={peek(heap) ?? "—"} />
          </div>
        </CardContent>
      </Card>

      {/* Operation input card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {tab === "insert" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="hpq-insert-val" className="text-xs">Value to insert</Label>
                <Input
                  id="hpq-insert-val"
                  type="number"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  placeholder="42"
                  className="w-32 h-8 text-xs"
                />
              </div>
              <Button size="sm" onClick={handleApply} disabled={!result} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Insert & animate
              </Button>
            </div>
          )}
          {tab === "extract" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleApply} disabled={!result || heap.arr.length === 0} className="gap-1.5">
                <Minus className="h-3.5 w-3.5" /> Extract root & animate
              </Button>
              <span className="text-xs text-muted-foreground">
                Root = {peek(heap) ?? "(empty)"} will be removed; last element replaces it and sifts down.
              </span>
            </div>
          )}
          {tab === "build" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleApply} disabled={!result} className="gap-1.5">
                <TreePine className="h-3.5 w-3.5" /> Build-heap (Floyd O(n))
              </Button>
              <span className="text-xs text-muted-foreground">
                Sifts down every internal node from last to root. Useful after loading a sorted array.
              </span>
            </div>
          )}
          {tab === "change-priority" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="hpq-cp-idx" className="text-xs">Index</Label>
                <Input
                  id="hpq-cp-idx"
                  type="number"
                  value={cpIndexInput}
                  onChange={(e) => setCpIndexInput(e.target.value)}
                  placeholder="0"
                  className="w-24 h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hpq-cp-val" className="text-xs">New priority</Label>
                <Input
                  id="hpq-cp-val"
                  type="number"
                  value={cpValueInput}
                  onChange={(e) => setCpValueInput(e.target.value)}
                  placeholder="1"
                  className="w-24 h-8 text-xs"
                />
              </div>
              <Button size="sm" onClick={handleApply} disabled={!result} className="gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Change & animate
              </Button>
              <span className="text-xs text-muted-foreground">
                Better priority → sift up; worse → sift down.
              </span>
            </div>
          )}
          {tab === "heapsort" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleApply} disabled={!result || heap.arr.length < 2} className="gap-1.5">
                <ListOrdered className="h-3.5 w-3.5" /> Run heapsort
              </Button>
              <span className="text-xs text-muted-foreground">
                Phase 1 build-heap, then n−1 swaps of root→end with sift-down. {kind === "max" ? "Output: ascending." : "Output: descending."}
              </span>
            </div>
          )}

          {/* Bulk insert */}
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label htmlFor="hpq-bulk" className="text-xs">Bulk insert (comma / space / newline separated)</Label>
              <Input
                id="hpq-bulk"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="5 3 8 1 9 2 7"
                className="h-8 text-xs font-mono"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleBulkInsert} className="gap-1.5">
              <ArrowUpFromLine className="h-3.5 w-3.5" /> Bulk insert
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visualization */}
      {displayArr.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TreePine className="h-4 w-4" /> Tree view
                {currentStep && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Step {safeStepIndex + 1}/{totalSteps}
                  </Badge>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setStepIndex(0)} disabled={totalSteps === 0} className="px-2">
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={safeStepIndex === 0} className="px-2">
                  <ArrowDownToLine className="h-3.5 w-3.5 rotate-90" />
                </Button>
                <Button size="sm" variant="default" onClick={() => setPlaying((p) => !p)} disabled={totalSteps === 0} className="gap-1.5">
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {playing ? "Pause" : "Play"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStepIndex((i) => Math.min(totalSteps - 1, i + 1))} disabled={safeStepIndex >= totalSteps - 1} className="px-2">
                  <ArrowDownToLine className="h-3.5 w-3.5 -rotate-90" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStepIndex(totalSteps - 1)} disabled={totalSteps === 0} className="px-2">
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {[1, 2, 3, 5, 7, 9].map((s) => <option key={s} value={s}>Speed {s}</option>)}
                </select>
              </div>
            </div>

            {/* SVG tree */}
            <div className="overflow-auto rounded border bg-background p-2">
              <TreeSvg
                layout={treeLayout}
                step={currentStep}
                kind={kind}
                heapSize={displayHeapSize}
                sortedSuffix={displaySorted}
              />
            </div>

            {/* Array view */}
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <ListOrdered className="h-3.5 w-3.5" /> Array view (index → value, parent → index)
              </h4>
              <div className="overflow-auto">
                <div className="flex flex-wrap gap-1.5">
                  {displayArr.map((v, i) => {
                    const cls = currentStep ? nodeColorClass(i, currentStep) : "default";
                    const isSorted = displaySorted.includes(i);
                    const inHeap = i < displayHeapSize;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col items-center rounded border px-2 py-1 text-xs font-mono min-w-[60px]
                          ${cls === "swap" ? "bg-amber-100 border-amber-400 dark:bg-amber-900/40 dark:border-amber-600" :
                            cls === "insert" ? "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-600" :
                            cls === "extract" ? "bg-rose-100 border-rose-400 dark:bg-rose-900/40 dark:border-rose-600" :
                            cls === "compare" ? "bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:border-blue-600" :
                            cls === "edge" ? "bg-purple-100 border-purple-400 dark:bg-purple-900/40 dark:border-purple-600" :
                            cls === "path" ? "bg-sky-50 border-sky-300 dark:bg-sky-900/30 dark:border-sky-700" :
                            isSorted ? "bg-gray-200 border-gray-400 dark:bg-gray-700 dark:border-gray-500" :
                            !inHeap ? "bg-muted/30 border-dashed" :
                            "bg-background"}
                        `}
                      >
                        <div className="text-[9px] text-muted-foreground">[{i}] p={i === 0 ? "—" : parent(i)}</div>
                        <div className="text-sm font-bold">{v}</div>
                        <div className="text-[9px] text-muted-foreground">L={left(i)} R={right(i)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step description */}
            {currentStep && (
              <div className="rounded border bg-muted/30 px-3 py-2 text-xs font-mono">
                {formatStep(currentStep, safeStepIndex, totalSteps)}
              </div>
            )}

            {/* Color legend */}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Legend color="bg-blue-200 dark:bg-blue-900/50" label="Compare" />
              <Legend color="bg-amber-200 dark:bg-amber-900/50" label="Swap" />
              <Legend color="bg-emerald-200 dark:bg-emerald-900/50" label="Insert" />
              <Legend color="bg-rose-200 dark:bg-rose-900/50" label="Extract" />
              <Legend color="bg-purple-200 dark:bg-purple-900/50" label="Parent/child" />
              <Legend color="bg-gray-200 dark:bg-gray-700" label="Sorted suffix" />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton
                getText={() => {
                  if (!result) return "";
                  return result.steps.map((s, i) => formatStep(s, i, result.steps.length)).join("\n");
                }}
                label="Copy trace"
                disabled={!result}
              />
              <DownloadButton
                getText={() => {
                  if (!result) return "";
                  return result.steps.map((s, i) => formatStep(s, i, result.steps.length)).join("\n");
                }}
                filename="heap-trace.txt"
                mime="text/plain"
                label="Download trace"
                disabled={!result}
              />
              <ShareButton getUrl={() => buildShareUrl(heap)} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Heap is empty"
          hint="Insert values one at a time, use bulk insert, or click Random / Sorted presets to populate."
          icon={<Layers className="h-8 w-8" />}
        />
      )}

      {/* Build-heap vs n-inserts comparison */}
      {comparison && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Gauge className="h-4 w-4" /> Build-heap (Floyd O(n)) vs n inserts (O(n log n))
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Build-heap</div>
                <div className="text-base font-semibold">{comparison.buildComparisons} comparisons</div>
                <div className="text-[10px] text-muted-foreground">{comparison.buildSwaps} swaps · O(n)</div>
              </div>
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">n inserts</div>
                <div className="text-base font-semibold">{comparison.insertComparisons} comparisons</div>
                <div className="text-[10px] text-muted-foreground">{comparison.insertSwaps} swaps · O(n log n)</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              On the current array of {heap.arr.length} element(s), Floyd&apos;s bottom-up heapify uses{" "}
              <strong className="text-foreground">
                {comparison.insertComparisons > 0
                  ? `${(comparison.buildComparisons / comparison.insertComparisons * 100).toFixed(0)}%`
                  : "—"}
              </strong>{" "}
              of the comparisons that repeated insert would.
            </p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.op}</Badge>
                  {h.value !== undefined && <Badge variant="outline" className="text-[10px]">v={h.value}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{h.size} elts</Badge>
                  <span className="text-muted-foreground">{h.comparisons} cmp · {h.swaps} swaps</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All heap logic runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function TreeSvg({
  layout: treeLayout,
  step,
  kind,
  heapSize,
  sortedSuffix,
}: {
  layout: TreeLayoutView;
  step: Step | null;
  kind: HeapKind;
  heapSize: number;
  sortedSuffix: number[];
}) {
  const nodeRadius = 16;
  const xSpacing = 50;
  const ySpacing = 60;
  const padX = 40;
  const padY = 30;
  const width = Math.max(treeLayout.width * xSpacing + padX * 2, 200);
  const height = Math.max(treeLayout.height * ySpacing + padY * 2, 100);

  const nodeByIndex = new Map<number, { x: number; y: number; value: number; index: number }>();
  for (const n of treeLayout.nodes) {
    nodeByIndex.set(n.index, { x: n.x * xSpacing + padX, y: n.y * ySpacing + padY, value: n.value, index: n.index });
  }

  return (
    <svg width={width} height={height} className="max-w-full" role="img" aria-label="Heap tree visualization">
      {/* Edges */}
      {treeLayout.edges.map((e, i) => {
        const from = nodeByIndex.get(e.from);
        const to = nodeByIndex.get(e.to);
        if (!from || !to) return null;
        const isPathEdge = step?.path.includes(e.from) && step?.path.includes(e.to);
        const isSwapEdge = step?.swapped.some(([a, b]) => (a === e.from && b === e.to) || (a === e.to && b === e.from));
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={isSwapEdge ? "#f59e0b" : isPathEdge ? "#0ea5e9" : "currentColor"}
            strokeWidth={isSwapEdge || isPathEdge ? 2 : 1}
            className={isSwapEdge || isPathEdge ? "text-amber-500" : "text-muted-foreground"}
            opacity={0.6}
          />
        );
      })}
      {/* Nodes */}
      {treeLayout.nodes.map((n) => {
        const x = n.x * xSpacing + padX;
        const y = n.y * ySpacing + padY;
        const cls = step ? nodeColorClass(n.index, step) : "default";
        const isSorted = sortedSuffix.includes(n.index);
        const fill =
          cls === "swap" ? "#fde68a" :
          cls === "insert" ? "#a7f3d0" :
          cls === "extract" ? "#fecaca" :
          cls === "compare" ? "#bfdbfe" :
          cls === "edge" ? "#e9d5ff" :
          cls === "path" ? "#bae6fd" :
          isSorted ? "#d1d5db" :
          n.index >= heapSize ? "#f3f4f6" :
          "#ffffff";
        const stroke =
          cls === "swap" ? "#d97706" :
          cls === "insert" ? "#059669" :
          cls === "extract" ? "#dc2626" :
          cls === "compare" ? "#2563eb" :
          cls === "edge" ? "#7c3aed" :
          isSorted ? "#6b7280" :
          "#94a3b8";
        return (
          <g key={n.index}>
            <circle
              cx={x}
              cy={y}
              r={nodeRadius}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              className="transition-all"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="text-xs font-mono font-bold fill-foreground pointer-events-none"
            >
              {n.value}
            </text>
            <text
              x={x}
              y={y - nodeRadius - 4}
              textAnchor="middle"
              className="text-[9px] fill-muted-foreground pointer-events-none"
            >
              [{n.index}]
            </text>
          </g>
        );
      })}
      {/* Kind label */}
      <text x={padX} y={16} className="text-[10px] fill-muted-foreground">
        {kind}-heap ({heapSize} active, {sortedSuffix.length} sorted)
      </text>
    </svg>
  );
}
