"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  ALGORITHM_LIST,
  ALGORITHMS,
  PRESETS,
  DEFAULT_ARRAYS,
  parseArrayInput,
  formatArray,
  generatePreset,
  runAlgorithm,
  race,
  isSorted,
  colorForIndex,
  formatStep,
  getAlgorithmInfo,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AlgorithmId,
  type HistoryEntry,
  type SortStep,
} from "./logic";
import {
  History, BarChart3, Play, Pause, SkipForward, SkipBack,
  FastForward, RotateCcw, Trophy, Info,
} from "lucide-react";

type Mode = "single" | "race";

export default function SortingAlgorithmVisualizer() {
  const [mode, setMode] = useState<Mode>("single");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("bubble");
  const [raceAlgorithms, setRaceAlgorithms] = useState<AlgorithmId[]>(["bubble", "quick", "merge"]);
  const [arrayText, setArrayText] = useState(DEFAULT_ARRAYS.random.join(", "));
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5); // 1..10
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.algorithm) setAlgorithm(p.algorithm);
      if (p.array.length > 0) setArrayText(p.array.join(", "));
      if (p.algorithm || p.array.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  // Parse array input.
  const parsed = useMemo(() => parseArrayInput(arrayText), [arrayText]);
  const array = parsed.ok ? parsed.array : [];

  // Run algorithm(s).
  const singleResult = useMemo(
    () => mode === "single" ? runAlgorithm(algorithm, array) : null,
    [mode, algorithm, array],
  );
  const raceResults = useMemo(
    () => mode === "race" ? race(raceAlgorithms, array) : null,
    [mode, raceAlgorithms, array],
  );

  // Reset step index when input/algorithm changes.
  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [arrayText, algorithm, mode, raceAlgorithms]);

  // Playback.
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    const totalSteps = singleResult ? singleResult.steps.length : 0;
    if (totalSteps === 0) {
      setPlaying(false);
      return;
    }
    if (stepIndex >= totalSteps - 1) {
      setStepIndex(0); // Loop back.
    }
    // Speed: 1 = slow (1000ms), 10 = fast (10ms).
    const ms = Math.max(10, 1100 - speed * 110);
    intervalRef.current = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= totalSteps - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [playing, speed, singleResult, stepIndex]);

  const handleSaveHistory = useCallback(() => {
    if (mode === "single" && singleResult && singleResult.steps.length > 0) {
      saveHistory({
        ts: Date.now(),
        algorithm,
        array,
        steps: singleResult.steps.length,
        comparisons: singleResult.totalComparisons,
        swaps: singleResult.totalSwaps,
      });
      setHistory(loadHistory());
    }
  }, [mode, singleResult, algorithm, array]);

  const handleClear = useCallback(() => {
    setArrayText("");
    setStepIndex(0);
    setPlaying(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleRaceAlg = (id: AlgorithmId) => {
    setRaceAlgorithms((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const currentStep: SortStep | null = singleResult && singleResult.steps.length > 0
    ? singleResult.steps[Math.min(stepIndex, singleResult.steps.length - 1)]
    : null;

  const info = getAlgorithmInfo(algorithm);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Mode tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => setMode("single")}
              className="h-8 text-xs gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Single algorithm
            </Button>
            <Button
              size="sm"
              variant={mode === "race" ? "default" : "outline"}
              onClick={() => setMode("race")}
              className="h-8 text-xs gap-1.5"
            >
              <Trophy className="h-3.5 w-3.5" /> Race mode
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Algorithm selector */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {mode === "single" ? (
            <div className="space-y-2">
              <Label className="text-xs">Algorithm</Label>
              <div className="flex flex-wrap gap-1">
                {ALGORITHM_LIST.map((a) => (
                  <Button
                    key={a.id}
                    size="sm"
                    variant={algorithm === a.id ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setAlgorithm(a.id)}
                  >
                    {a.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Race these algorithms ({raceAlgorithms.length} selected)</Label>
              <div className="flex flex-wrap gap-1">
                {ALGORITHM_LIST.map((a) => (
                  <label key={a.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={raceAlgorithms.includes(a.id)}
                      onChange={() => toggleRaceAlg(a.id)}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sv-array">Custom array (comma / space / newline separated)</Label>
            <Textarea
              id="sv-array"
              value={arrayText}
              onChange={(e) => setArrayText(e.target.value)}
              placeholder="64, 34, 25, 12, 22, 11, 90"
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  title={p.description}
                  onClick={() => setArrayText(DEFAULT_ARRAYS[p.id].join(", "))}
                >
                  + {p.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => {
                  const a = generatePreset("random", 15, Date.now() % 1000);
                  setArrayText(a.join(", "));
                }}
              >
                + random 15
              </Button>
            </div>
            {!parsed.ok && (
              <div className="text-xs text-red-600 dark:text-red-400">{parsed.error}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {array.length === 0 ? (
        <EmptyState
          title="Enter an array to visualize"
          hint="Type numbers separated by commas, spaces, or newlines. Click a preset to load a sample array."
          icon={<BarChart3 className="h-8 w-8" />}
        />
      ) : mode === "single" && singleResult ? (
        <>
          {/* Visualization + controls */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> {info.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">step {stepIndex + 1}/{singleResult.steps.length}</Badge>
                  <Badge variant="outline" className="text-[10px]">cmp {currentStep?.comparisons ?? 0}</Badge>
                  <Badge variant="outline" className="text-[10px]">swap {currentStep?.swaps ?? 0}</Badge>
                  <Badge variant="outline" className="text-[10px]">acc {currentStep?.accesses ?? 0}</Badge>
                </div>
              </div>

              {currentStep && (
                <Bars step={currentStep} />
              )}

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepIndex(0)}
                  disabled={stepIndex === 0}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepIndex((p) => Math.max(0, p - 1))}
                  disabled={stepIndex === 0}
                  className="gap-1.5"
                >
                  <SkipBack className="h-3.5 w-3.5" /> Step back
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPlaying((p) => !p)}
                  disabled={stepIndex >= singleResult.steps.length - 1 && !playing}
                  className="gap-1.5"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {playing ? "Pause" : "Play"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepIndex((p) => Math.min(singleResult.steps.length - 1, p + 1))}
                  disabled={stepIndex >= singleResult.steps.length - 1}
                  className="gap-1.5"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Step forward
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepIndex(singleResult.steps.length - 1)}
                  disabled={stepIndex >= singleResult.steps.length - 1}
                  className="gap-1.5"
                >
                  <FastForward className="h-3.5 w-3.5" /> End
                </Button>
                <div className="flex items-center gap-2 ml-2">
                  <Label htmlFor="sv-speed" className="text-[10px] uppercase tracking-wide text-muted-foreground">Speed</Label>
                  <input
                    id="sv-speed"
                    type="range"
                    min={1}
                    max={10}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground w-6">{speed}x</span>
                </div>
              </div>

              {/* Current step description */}
              {currentStep && (
                <div className="rounded border bg-muted/30 px-3 py-2 text-xs font-mono">
                  {formatStep(currentStep, stepIndex, singleResult.steps.length)}
                </div>
              )}

              {/* Color legend */}
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <LegendDot color="bg-emerald-500" label="sorted" />
                <LegendDot color="bg-amber-400" label="compare" />
                <LegendDot color="bg-red-500" label="swap" />
                <LegendDot color="bg-blue-500" label="set / write" />
                <LegendDot color="bg-purple-500" label="pivot" />
                <LegendDot color="bg-slate-400" label="highlight" />
                <LegendDot color="bg-slate-700 dark:bg-slate-300" label="default" />
              </div>
            </CardContent>
          </Card>

          {/* Algorithm info card */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4" /> {info.name} — complexity & properties
              </h3>
              <p className="text-xs text-muted-foreground">{info.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Complexity label="Best case" value={info.timeBest} />
                <Complexity label="Average" value={info.timeAvg} />
                <Complexity label="Worst case" value={info.timeWorst} />
                <Complexity label="Space" value={info.space} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={info.stable ? "default" : "outline"} className="text-[10px]">
                  {info.stable ? "Stable" : "Not stable"}
                </Badge>
                <Badge variant={info.inPlace ? "default" : "outline"} className="text-[10px]">
                  {info.inPlace ? "In-place" : "Out-of-place"}
                </Badge>
                <Badge variant={info.adaptive ? "default" : "outline"} className="text-[10px]">
                  {info.adaptive ? "Adaptive" : "Not adaptive"}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{info.category}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <Stat label="Total steps" value={singleResult.steps.length} />
                <Stat label="Comparisons" value={singleResult.totalComparisons} />
                <Stat label="Swaps" value={singleResult.totalSwaps} />
                <Stat label="Array accesses" value={singleResult.totalAccesses} />
              </div>
            </CardContent>
          </Card>

          {/* Action bar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => formatArray(array)} label="Copy input array" />
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return singleResult.steps.map((s) => formatStep(s, 0, singleResult.steps.length)).join("\n");
                  }}
                  label="Copy all steps"
                />
                <DownloadButton
                  getText={() => singleResult.steps.map((s, i) => formatStep(s, i, singleResult.steps.length)).join("\n")}
                  filename={`${algorithm}-trace.txt`}
                  mime="text/plain"
                  label="Download trace"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(algorithm, array); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : mode === "race" && raceResults ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Trophy className="h-4 w-4" /> Race — {raceResults.length} algorithms on [{formatArray(array)}]
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {raceResults.map((entry) => {
                const r = entry.result;
                const finalStep = r.steps[r.steps.length - 1];
                const algInfo = ALGORITHMS[entry.algorithm];
                return (
                  <div key={entry.algorithm} className="rounded border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{algInfo.name}</span>
                      {r.sorted && <Badge variant="outline" className="text-[10px] text-emerald-600">✓ sorted</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <div className="text-muted-foreground">steps</div>
                        <div className="font-mono text-foreground">{r.steps.length}</div>
                      </div>
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <div className="text-muted-foreground">comparisons</div>
                        <div className="font-mono text-foreground">{r.totalComparisons}</div>
                      </div>
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <div className="text-muted-foreground">swaps</div>
                        <div className="font-mono text-foreground">{r.totalSwaps}</div>
                      </div>
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <div className="text-muted-foreground">accesses</div>
                        <div className="font-mono text-foreground">{r.totalAccesses}</div>
                      </div>
                    </div>
                    {finalStep && (
                      <div className="text-[10px] font-mono text-muted-foreground">
                        final: [{formatArray(finalStep.array)}]
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {algInfo.timeAvg} · {algInfo.space} · {algInfo.stable ? "stable" : "unstable"}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: switch to <strong>Single algorithm</strong> mode to step through any of these visualizations with full play/pause/step controls.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setMode("single");
                    setAlgorithm(h.algorithm);
                    setArrayText(h.array.join(", "));
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{ALGORITHMS[h.algorithm].name}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.steps} steps</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.comparisons} cmp</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.swaps} swap</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="font-mono text-muted-foreground mt-1 truncate">[{h.array.join(", ")}]</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All sorting and animation runs locally — your arrays never leave the browser. Generator-based step engine with full array snapshots enables true reverse-step fidelity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Bars({ step }: { step: SortStep }) {
  const max = Math.max(...step.array, 1);
  return (
    <div className="flex items-end justify-center gap-1 h-48 sm:h-64 overflow-x-auto bg-muted/20 rounded p-2">
      {step.array.map((v, i) => {
        const color = colorForIndex(i, step);
        const heightPct = (v / max) * 100;
        const bg = colorClass(color);
        return (
          <div
            key={i}
            className="flex flex-col items-center justify-end flex-1 min-w-[18px] max-w-[40px]"
            style={{ height: "100%" }}
          >
            <div
              className={"w-full rounded-t transition-all duration-100 " + bg}
              style={{ height: heightPct + "%" }}
              title={"a[" + i + "]=" + v}
            />
            <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{v}</div>
            <div className="text-[8px] text-muted-foreground/60 font-mono">{i}</div>
          </div>
        );
      })}
    </div>
  );
}

function colorClass(color: string): string {
  switch (color) {
    case "sorted": return "bg-emerald-500";
    case "swap": return "bg-red-500";
    case "compare": return "bg-amber-400";
    case "set": return "bg-blue-500";
    case "pivot": return "bg-purple-500";
    case "highlight": return "bg-slate-400";
    default: return "bg-slate-700 dark:bg-slate-300";
  }
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={"inline-block w-2.5 h-2.5 rounded-sm " + color} />
      <span>{label}</span>
    </div>
  );
}

function Complexity({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-mono text-foreground">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
