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
  createTrie,
  cloneTrie,
  fromWords,
  insertPure,
  deletePure,
  searchPure,
  autocompletePure,
  longestCommonPrefixPure,
  computeStats,
  layout,
  compress,
  radixStats,
  runInsert,
  runSearch,
  runDelete,
  runAutocomplete,
  runLongestCommonPrefix,
  parseWords,
  serializeTrie,
  deserializeTrie,
  nodeColorClass,
  formatStep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  WORD_PRESETS,
  randomWords,
  type Trie,
  type TrieLayout as TrieLayoutView,
  type RadixTrie,
  type Step,
  type OpKind,
  type OpResult,
  type HistoryEntry,
} from "./logic";
import {
  History, GitFork, Play, Pause, SkipForward, SkipBack,
  ArrowDownToLine, ArrowUpFromLine, Plus, Minus, Search as SearchIcon,
  Trash2, Sparkles, ListTree, Layers, Gauge, Lightbulb,
} from "lucide-react";

type Tab = "insert" | "search" | "delete" | "autocomplete" | "lcp";

export default function TriePrefixTreeVisualizer() {
  const [trie, setTrie] = useState<Trie>(() => fromWords(["cat", "car", "card", "care", "careful", "dog"]));
  const [tab, setTab] = useState<Tab>("insert");
  const [wordInput, setWordInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [showRadix, setShowRadix] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p && p.words !== null) {
        const t = deserializeTrie(p.words);
        if (t) {
          setTrie(t);
          toast.info("Loaded trie from share link");
        }
      }
    }
  }, []);

  // Compute the active operation result.
  const result: OpResult | null = useMemo(() => {
    const word = caseSensitive ? wordInput : wordInput.toLowerCase();
    if (tab === "insert") {
      if (!word) return null;
      return runInsert(trie, word);
    }
    if (tab === "search") {
      if (!word) return null;
      return runSearch(trie, word);
    }
    if (tab === "delete") {
      if (!word) return null;
      return runDelete(trie, word);
    }
    if (tab === "autocomplete") {
      return runAutocomplete(trie, word, 50);
    }
    if (tab === "lcp") {
      return runLongestCommonPrefix(trie);
    }
    return null;
  }, [tab, wordInput, caseSensitive, trie]);

  const steps = result?.steps ?? [];
  const totalSteps = steps.length;
  const safeStepIndex = Math.min(stepIndex, Math.max(0, totalSteps - 1));
  const currentStep: Step | null = totalSteps > 0 ? steps[safeStepIndex] : null;
  const displayTrie: Trie = currentStep?.trie ?? trie;
  const stats = useMemo(() => computeStats(displayTrie), [displayTrie]);
  const radix = useMemo(() => compress(displayTrie), [displayTrie]);
  const rStats = useMemo(() => radixStats(radix), [radix]);
  const plainLayout = useMemo(() => layout(displayTrie), [displayTrie]);
  const radixLayout = useMemo(() => layoutRadix(radix), [radix]);

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
  }, [tab, wordInput, caseSensitive]);

  const handleApply = useCallback(() => {
    if (!result || result.steps.length === 0) {
      toast.info("Nothing to run — enter a word first");
      return;
    }
    const last = result.steps[result.steps.length - 1];
    setTrie(cloneTrie(last.trie));
    setStepIndex(0);
    setPlaying(false);
    saveHistory({
      ts: Date.now(),
      op: result.kind as OpKind,
      word: wordInput,
      nodeCount: last.trie.nodes.size,
      wordCount: stats.wordCount,
      comparisons: result.totalComparisons,
      created: result.totalCreated,
      pruned: result.totalPruned,
      ok: result.ok,
    });
    setHistory(loadHistory());
    toast.success(`${result.kind} done (${result.totalComparisons} cmp, ${result.totalCreated} created, ${result.totalPruned} pruned)`);
  }, [result, wordInput, stats.wordCount]);

  const handleClear = useCallback(() => {
    setTrie(createTrie());
    setStepIndex(0);
    setPlaying(false);
    setWordInput("");
    setBulkInput("");
    toast.info("Trie cleared");
  }, []);

  const handleBulkInsert = useCallback(() => {
    const words = parseWords(bulkInput, caseSensitive);
    if (words.length === 0) {
      toast.error("No valid words found");
      return;
    }
    const t = cloneTrie(trie);
    let inserted = 0;
    for (const w of words) {
      if (insertPure(t, w)) inserted++;
    }
    setTrie(t);
    setBulkInput("");
    toast.success(`Inserted ${inserted} new word(s) of ${words.length} total`);
  }, [bulkInput, caseSensitive, trie]);

  const handlePreset = useCallback((key: string) => {
    const words = WORD_PRESETS[key];
    if (!words) return;
    setTrie(fromWords(words));
    setStepIndex(0);
    setPlaying(false);
    toast.success(`Loaded ${words.length} word preset: ${key}`);
  }, []);

  const handleRandom = useCallback((n: number) => {
    setTrie(fromWords(randomWords(n, Date.now() & 0xffff)));
    setStepIndex(0);
    setPlaying(false);
    toast.success(`Generated ${n} random words`);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const lcp = useMemo(() => longestCommonPrefixPure(displayTrie), [displayTrie]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Header card: tabs + presets */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Case:</Label>
              <Button
                size="sm"
                variant={caseSensitive ? "default" : "outline"}
                onClick={() => setCaseSensitive((c) => !c)}
                className="h-7"
              >{caseSensitive ? "Sensitive" : "Insensitive"}</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => handleRandom(10)} className="h-7">Random 10</Button>
              <Button size="sm" variant="ghost" onClick={() => handleRandom(25)} className="h-7">Random 25</Button>
              <Button size="sm" variant="ghost" onClick={() => handlePreset("fruits")} className="h-7">Fruits</Button>
              <Button size="sm" variant="ghost" onClick={() => handlePreset("colors")} className="h-7">Colors</Button>
              <Button size="sm" variant="ghost" onClick={() => handlePreset("animals")} className="h-7">Animals</Button>
              <Button size="sm" variant="ghost" onClick={() => handlePreset("prefix")} className="h-7">Shared-prefix</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["insert", "Insert", Plus],
              ["search", "Search", SearchIcon],
              ["delete", "Delete", Minus],
              ["autocomplete", "Autocomplete", Sparkles],
              ["lcp", "Longest common prefix", Lightbulb],
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
            <Stat label="Nodes" value={stats.nodeCount} />
            <Stat label="Words" value={stats.wordCount} />
            <Stat label="Total chars" value={stats.totalChars} />
            <Stat label="Space savings" value={`${(stats.savings * 100).toFixed(0)}%`} highlight={stats.savings > 0 ? "good" : undefined} />
            <Stat label="Height" value={stats.height} />
          </div>
        </CardContent>
      </Card>

      {/* Operation input card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {tab !== "lcp" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="tpv-word" className="text-xs">
                  {tab === "autocomplete" ? "Prefix" : "Word"}
                </Label>
                <Input
                  id="tpv-word"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  placeholder={tab === "autocomplete" ? "ap" : "apple"}
                  className="w-48 h-8 text-xs font-mono"
                />
              </div>
              <Button size="sm" onClick={handleApply} disabled={!result} className="gap-1.5">
                {tab === "insert" && <Plus className="h-3.5 w-3.5" />}
                {tab === "search" && <SearchIcon className="h-3.5 w-3.5" />}
                {tab === "delete" && <Minus className="h-3.5 w-3.5" />}
                {tab === "autocomplete" && <Sparkles className="h-3.5 w-3.5" />}
                {tab === "insert" ? "Insert & animate" :
                  tab === "search" ? "Search & animate" :
                  tab === "delete" ? "Delete & animate" :
                  "Autocomplete & animate"}
              </Button>
              {tab === "autocomplete" && (
                <span className="text-xs text-muted-foreground">
                  Will list every word under that prefix.
                </span>
              )}
            </div>
          )}
          {tab === "lcp" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleApply} disabled={!result} className="gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Compute LCP & animate
              </Button>
              <span className="text-xs text-muted-foreground">
                Walks down the trie while there&apos;s exactly one child and no end-of-word.
              </span>
            </div>
          )}

          {/* Bulk insert */}
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label htmlFor="tpv-bulk" className="text-xs">Bulk insert (comma / space / newline separated)</Label>
              <Input
                id="tpv-bulk"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="apple application apply apricot"
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
      {stats.nodeCount > 1 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListTree className="h-4 w-4" /> {showRadix ? "Compressed (radix) view" : "Plain trie view"}
                {currentStep && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Step {safeStepIndex + 1}/{totalSteps}
                  </Badge>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={showRadix ? "default" : "outline"}
                  onClick={() => setShowRadix((s) => !s)}
                  className="gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" /> {showRadix ? "Radix" : "Plain"}
                </Button>
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
              {showRadix ? (
                <RadixSvg layout={radixLayout} step={currentStep} />
              ) : (
                <TrieSvg layout={plainLayout} step={currentStep} />
              )}
            </div>

            {/* Step description */}
            {currentStep && (
              <div className="rounded border bg-muted/30 px-3 py-2 text-xs font-mono">
                {formatStep(currentStep, safeStepIndex, totalSteps)}
              </div>
            )}

            {/* Autocomplete suggestions */}
            {currentStep && currentStep.suggestions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1">Suggestions ({currentStep.suggestions.length})</h4>
                <div className="flex flex-wrap gap-1">
                  {currentStep.suggestions.map((s, i) => (
                    <Badge key={i} variant="secondary" className="font-mono text-[11px]">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* LCP display */}
            {tab === "lcp" && lcp && (
              <div className="rounded border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 px-3 py-2 text-xs">
                <span className="font-semibold text-foreground">Longest common prefix:</span>{" "}
                <code className="font-mono">{lcp || "(empty)"}</code>
              </div>
            )}

            {/* Color legend */}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Legend color="bg-blue-200 dark:bg-blue-900/50" label="Compare" />
              <Legend color="bg-emerald-200 dark:bg-emerald-900/50" label="Create / found" />
              <Legend color="bg-rose-200 dark:bg-rose-900/50" label="Not found / prune" />
              <Legend color="bg-purple-200 dark:bg-purple-900/50" label="Suggestion" />
              <Legend color="bg-sky-100 dark:bg-sky-900/40" label="Path" />
              <Legend color="border-2 border-amber-400" label="End-of-word" />
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
                getText={() => serializeTrie(trie).split(",").join("\n")}
                filename="trie-words.txt"
                mime="text/plain"
                label="Download word list"
              />
              <ShareButton getUrl={() => buildShareUrl(trie)} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Trie is empty"
          hint="Insert words one at a time, use bulk insert, or click a preset (fruits, colors, animals, shared-prefix) to populate."
          icon={<GitFork className="h-8 w-8" />}
        />
      )}

      {/* Comparison: plain vs radix */}
      {stats.nodeCount > 1 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Gauge className="h-4 w-4" /> Plain vs compressed (radix / Patricia) comparison
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Plain trie</div>
                <div className="text-base font-semibold">{stats.nodeCount} nodes</div>
                <div className="text-[10px] text-muted-foreground">{stats.nodeCount - 1} edges · {stats.totalChars} chars stored</div>
              </div>
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Compressed (radix)</div>
                <div className="text-base font-semibold">{rStats.nodeCount} nodes</div>
                <div className="text-[10px] text-muted-foreground">{rStats.edgeCount} edges · {rStats.totalEdgeChars} edge chars</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The radix view collapses single-child chains into multi-character edges, saving{" "}
              <strong className="text-foreground">
                {stats.nodeCount > 0 ? `${((1 - rStats.nodeCount / stats.nodeCount) * 100).toFixed(0)}%` : "—"}
              </strong>{" "}
              of nodes vs the plain trie.
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
                  {h.word && <Badge variant="outline" className="text-[10px] font-mono">{h.word}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{h.nodeCount} nodes</Badge>
                  <span className="text-muted-foreground">{h.comparisons} cmp · {h.created} created · {h.pruned} pruned</span>
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
            <strong className="text-foreground">Privacy:</strong> All trie logic runs locally in your browser. History is stored in localStorage on this device only.
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

// ---------------------------------------------------------------------------
// SVG renderers
// ---------------------------------------------------------------------------

function TrieSvg({
  layout: trieLayout,
  step,
}: {
  layout: TrieLayoutView;
  step: Step | null;
}) {
  const nodeRadius = 16;
  const xSpacing = 50;
  const ySpacing = 60;
  const padX = 40;
  const padY = 30;
  const width = Math.max(trieLayout.width * xSpacing + padX * 2, 200);
  const height = Math.max(trieLayout.height * ySpacing + padY * 2, 100);

  const nodeByIndex = new Map<number, { x: number; y: number; node: typeof trieLayout.nodes[number]["node"] }>();
  for (const p of trieLayout.nodes) {
    nodeByIndex.set(p.node.id, { x: p.x * xSpacing + padX, y: p.y * ySpacing + padY, node: p.node });
  }

  return (
    <svg width={width} height={height} className="max-w-full" role="img" aria-label="Trie visualization">
      {/* Edges */}
      {trieLayout.edges.map((e, i) => {
        const from = nodeByIndex.get(e.from);
        const to = nodeByIndex.get(e.to);
        if (!from || !to) return null;
        const isPathEdge = step?.path.includes(e.from) && step?.path.includes(e.to);
        return (
          <g key={i}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isPathEdge ? "#0ea5e9" : "currentColor"}
              strokeWidth={isPathEdge ? 2 : 1}
              className={isPathEdge ? "text-sky-500" : "text-muted-foreground"}
              opacity={0.6}
            />
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 4}
              textAnchor="middle"
              className="text-[11px] font-mono font-bold fill-foreground pointer-events-none"
            >
              {e.char}
            </text>
          </g>
        );
      })}
      {/* Nodes */}
      {trieLayout.nodes.map((p) => {
        const x = p.x * xSpacing + padX;
        const y = p.y * ySpacing + padY;
        const cls = step ? nodeColorClass(p.node.id, step) : "default";
        const fill =
          cls === "create" ? "#a7f3d0" :
          cls === "found" ? "#a7f3d0" :
          cls === "not-found" ? "#fecaca" :
          cls === "prune" ? "#fecaca" :
          cls === "compare" ? "#bfdbfe" :
          cls === "suggestion" ? "#e9d5ff" :
          cls === "path" ? "#bae6fd" :
          "#ffffff";
        const stroke =
          cls === "create" || cls === "found" ? "#059669" :
          cls === "not-found" || cls === "prune" ? "#dc2626" :
          cls === "compare" ? "#2563eb" :
          cls === "suggestion" ? "#7c3aed" :
          "#94a3b8";
        return (
          <g key={p.node.id}>
            <circle
              cx={x}
              cy={y}
              r={nodeRadius}
              fill={fill}
              stroke={stroke}
              strokeWidth={p.node.isEnd ? 3 : 2}
              className="transition-all"
            />
            {p.node.isEnd && (
              <circle
                cx={x}
                cy={y}
                r={nodeRadius - 4}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
            )}
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="text-xs font-mono font-bold fill-foreground pointer-events-none"
            >
              {p.node.char || "•"}
            </text>
            <text
              x={x}
              y={y - nodeRadius - 4}
              textAnchor="middle"
              className="text-[9px] fill-muted-foreground pointer-events-none"
            >
              {p.node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Radix (compressed) trie layout
// ---------------------------------------------------------------------------

interface RadixPositionedNode {
  node: { id: number; edge: string; isEnd: boolean; parent: number | null };
  x: number;
  y: number;
  depth: number;
}

interface RadixLayoutView {
  nodes: RadixPositionedNode[];
  edges: { from: number; to: number; label: string }[];
  width: number;
  height: number;
}

function layoutRadix(rt: RadixTrie): RadixLayoutView {
  const nodes: RadixPositionedNode[] = [];
  const edges: { from: number; to: number; label: string }[] = [];
  let nextX = 0;
  let maxDepth = 0;
  const walk = (id: number, depth: number) => {
    const n = rt.nodes.get(id)!;
    maxDepth = Math.max(maxDepth, depth);
    const childEntries = [...n.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (childEntries.length === 0) {
      nodes.push({ node: n, x: nextX, y: depth, depth });
      nextX += 1;
    } else {
      for (const [label, childId] of childEntries) {
        walk(childId, depth + 1);
        edges.push({ from: id, to: childId, label });
      }
      const childPositions = nodes.filter((p) => p.node.parent === id);
      if (childPositions.length > 0) {
        const avgX = childPositions.reduce((s, p) => s + p.x, 0) / childPositions.length;
        nodes.push({ node: n, x: avgX, y: depth, depth });
      }
    }
  };
  walk(rt.root, 0);
  nodes.sort((a, b) => a.depth - b.depth || a.x - b.x);
  return { nodes, edges, width: nextX, height: maxDepth + 1 };
}

function RadixSvg({
  layout: radixLayout,
  step,
}: {
  layout: RadixLayoutView;
  step: Step | null;
}) {
  const nodeRadius = 20;
  const xSpacing = 70;
  const ySpacing = 70;
  const padX = 50;
  const padY = 30;
  const width = Math.max(radixLayout.width * xSpacing + padX * 2, 200);
  const height = Math.max(radixLayout.height * ySpacing + padY * 2, 100);

  const nodeByIndex = new Map<number, { x: number; y: number }>();
  for (const p of radixLayout.nodes) {
    nodeByIndex.set(p.node.id, { x: p.x * xSpacing + padX, y: p.y * ySpacing + padY });
  }

  return (
    <svg width={width} height={height} className="max-w-full" role="img" aria-label="Radix trie visualization">
      {radixLayout.edges.map((e, i) => {
        const from = nodeByIndex.get(e.from);
        const to = nodeByIndex.get(e.to);
        if (!from || !to) return null;
        return (
          <g key={i}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted-foreground"
              opacity={0.6}
            />
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 4}
              textAnchor="middle"
              className="text-[11px] font-mono font-bold fill-foreground pointer-events-none"
            >
              {e.label}
            </text>
          </g>
        );
      })}
      {radixLayout.nodes.map((p) => {
        const x = p.x * xSpacing + padX;
        const y = p.y * ySpacing + padY;
        return (
          <g key={p.node.id}>
            <circle
              cx={x}
              cy={y}
              r={nodeRadius}
              fill={p.node.isEnd ? "#a7f3d0" : "#ffffff"}
              stroke={p.node.isEnd ? "#059669" : "#94a3b8"}
              strokeWidth={2}
              className="transition-all"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="text-[10px] font-mono font-bold fill-foreground pointer-events-none"
            >
              {p.node.edge || "•"}
            </text>
          </g>
        );
      })}
      <text x={padX} y={16} className="text-[10px] fill-muted-foreground">
        Radix (Patricia) trie · {radixLayout.nodes.length} node(s) · edge label = substring
      </text>
    </svg>
  );
}
