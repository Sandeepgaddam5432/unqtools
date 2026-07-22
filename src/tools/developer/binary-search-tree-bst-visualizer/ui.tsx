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
  createTree,
  fromValues,
  cloneTree,
  getNode,
  insertPure,
  deletePure,
  height,
  balanceFactor,
  computeStats,
  layout,
  runInsert,
  runDelete,
  runSearch,
  runTraversal,
  parseValues,
  serializeTree,
  deserializeTree,
  nodeColorClass,
  formatStep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  randomTree,
  sortedTree,
  type BSTree,
  type OpKind,
  type OpResult,
  type HistoryEntry,
} from "./logic";
import {
  History, GitFork, Play, Pause, SkipForward, SkipBack,
  FastForward, RotateCcw, Info, Sparkles, ArrowDownToLine,
  ArrowUpFromLine, Search as SearchIcon, Trash2, Plus,
} from "lucide-react";

type Tab = "insert" | "delete" | "search" | "traverse";
type TraversalKind = "inorder" | "preorder" | "postorder" | "levelorder";

export default function BinarySearchTreeBstVisualizer() {
  const [tree, setTree] = useState<BSTree>(() => fromValues([50, 30, 70, 20, 40, 60, 80]));
  const [tab, setTab] = useState<Tab>("insert");
  const [valueInput, setValueInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [traversalKind, setTraversalKind] = useState<TraversalKind>("inorder");
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p && p.tree !== null) {
        const t = deserializeTree(p.tree);
        if (t) {
          setTree(t);
          toast.info("Loaded tree from share link");
        }
      }
    }
  }, []);

  // Run the active operation.
  const result: OpResult = useMemo(() => {
    if (tab === "insert") {
      const v = parseInt(valueInput, 10);
      if (!Number.isFinite(v)) return { kind: "insert", steps: [], totalComparisons: 0, output: [], found: false };
      return runInsert(tree, v);
    }
    if (tab === "delete") {
      const v = parseInt(valueInput, 10);
      if (!Number.isFinite(v)) return { kind: "delete", steps: [], totalComparisons: 0, output: [], found: false };
      return runDelete(tree, v);
    }
    if (tab === "search") {
      const v = parseInt(valueInput, 10);
      if (!Number.isFinite(v)) return { kind: "search", steps: [], totalComparisons: 0, output: [], found: false };
      return runSearch(tree, v);
    }
    return runTraversal(tree, traversalKind);
  }, [tab, valueInput, tree, traversalKind]);

  const steps = result.steps;
  const currentStep = steps[stepIndex] ?? null;

  // Layout the *displayed* tree (either current step snapshot or the static tree).
  const displayTree = currentStep?.tree ?? tree;
  const positioned = useMemo(() => layout(displayTree), [displayTree]);
  const stats = useMemo(() => computeStats(tree), [tree]);

  // Reset step index when tree/tab/value/traversal changes.
  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [tree, tab, valueInput, traversalKind]);

  // Playback.
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    const total = steps.length;
    if (total === 0) { setPlaying(false); return; }
    if (stepIndex >= total - 1) setStepIndex(0);
    const ms = Math.max(10, 1100 - speed * 110);
    intervalRef.current = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= total - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [playing, speed, steps, stepIndex]);

  // Commit the operation to the actual tree when the user steps to the end.
  const commit = useCallback(() => {
    if (tab === "insert") {
      const v = parseInt(valueInput, 10);
      if (Number.isFinite(v)) {
        const t = cloneTree(tree);
        const inserted = insertPure(t, v);
        setTree(t);
        toast.success(inserted ? `Inserted ${v}` : `${v} is a duplicate — skipped`);
        handleSaveHistory("insert", v, inserted, t);
        setValueInput("");
      }
    } else if (tab === "delete") {
      const v = parseInt(valueInput, 10);
      if (Number.isFinite(v)) {
        const t = cloneTree(tree);
        const deleted = deletePure(t, v);
        setTree(t);
        toast.success(deleted ? `Deleted ${v}` : `${v} not in tree`);
        handleSaveHistory("delete", v, deleted, t);
        setValueInput("");
      }
    } else if (tab === "traverse") {
      handleSaveHistory(`traverse-${traversalKind}`, undefined, true, tree);
    } else if (tab === "search") {
      const v = parseInt(valueInput, 10);
      if (Number.isFinite(v)) {
        handleSaveHistory("search", v, result.found, tree);
      }
    }
  }, [tab, valueInput, tree, traversalKind, result]);

  const handleSaveHistory = useCallback(
    (op: OpKind, value: number | undefined, found: boolean, t: BSTree) => {
      const s = computeStats(t);
      saveHistory({
        ts: Date.now(),
        op,
        value,
        nodeCount: s.nodeCount,
        height: s.height,
        comparisons: result.totalComparisons,
        found,
      });
      setHistory(loadHistory());
    },
    [result],
  );

  const handleBulkInsert = useCallback(() => {
    const parsed = parseValues(bulkInput);
    if (parsed.ok.length === 0) {
      toast.error("No valid integers found");
      return;
    }
    const t = cloneTree(tree);
    let inserted = 0;
    for (const v of parsed.ok) {
      if (insertPure(t, v)) inserted++;
    }
    setTree(t);
    toast.success(`Inserted ${inserted} / ${parsed.ok.length} values${parsed.skipped.length > 0 ? ` (skipped ${parsed.skipped.length} invalid)` : ""}`);
    handleSaveHistory("insert", undefined, true, t);
    setBulkInput("");
  }, [bulkInput, tree, handleSaveHistory]);

  const handleRandomTree = useCallback((n: number) => {
    const t = randomTree(n, Date.now() % 100000);
    setTree(t);
    toast.success(`Generated random ${n}-node tree`);
  }, []);

  const handleSortedTree = useCallback((n: number) => {
    const t = sortedTree(n);
    setTree(t);
    toast.warning(`Generated sorted (degenerate) tree of ${n} nodes`);
  }, []);

  const handleClear = useCallback(() => {
    setTree(createTree());
    setValueInput("");
    setBulkInput("");
    setStepIndex(0);
    setPlaying(false);
    toast.info("Cleared tree");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleReset = useCallback(() => {
    setTree(fromValues([50, 30, 70, 20, 40, 60, 80]));
    setValueInput("");
    setBulkInput("");
    setStepIndex(0);
    setPlaying(false);
    setTab("insert");
    setTraversalKind("inorder");
    toast.info("Reset to default tree");
  }, []);

  const stepPct = steps.length > 0 ? Math.round((stepIndex / Math.max(1, steps.length - 1)) * 100) : 0;

  // SVG layout dimensions.
  const cellW = 44;
  const cellH = 56;
  const svgW = Math.max(300, positioned.length * cellW + 40);
  const svgH = Math.max(180, (stats.height + 1) * cellH + 40);
  const xFor = (x: number) => x * cellW + cellW / 2 + 20;
  const yFor = (y: number) => y * cellH + 30;
  const posById = new Map(positioned.map((p) => [p.node.id, p]));

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <TabButton active={tab === "insert"} onClick={() => setTab("insert")} icon={<ArrowDownToLine className="h-3.5 w-3.5" />} label="Insert" />
            <TabButton active={tab === "delete"} onClick={() => setTab("delete")} icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" />
            <TabButton active={tab === "search"} onClick={() => setTab("search")} icon={<SearchIcon className="h-3.5 w-3.5" />} label="Search" />
            <TabButton active={tab === "traverse"} onClick={() => setTab("traverse")} icon={<GitFork className="h-3.5 w-3.5" />} label="Traverse" />
          </div>

          {tab !== "traverse" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{tab === "insert" ? "Value to insert" : tab === "delete" ? "Value to delete" : "Value to search"}</Label>
                <Input
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  className="h-8 w-32 text-xs"
                  inputMode="numeric"
                  placeholder="e.g. 42"
                />
              </div>
              <Button size="sm" onClick={commit} className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" /> {tab === "insert" ? "Insert" : tab === "delete" ? "Delete" : "Search"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Traversal</Label>
                <select
                  value={traversalKind}
                  onChange={(e) => setTraversalKind(e.target.value as TraversalKind)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="inorder">In-order (L, V, R)</option>
                  <option value="preorder">Pre-order (V, L, R)</option>
                  <option value="postorder">Post-order (L, R, V)</option>
                  <option value="levelorder">Level-order (BFS)</option>
                </select>
              </div>
              <Button size="sm" onClick={commit} className="h-8 gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Run traversal
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Bulk insert (comma / space / newline separated)</Label>
            <div className="flex gap-2">
              <Input
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="h-8 text-xs flex-1"
                placeholder="e.g. 45, 65, 12, 88"
              />
              <Button size="sm" variant="secondary" onClick={handleBulkInsert} className="h-8">Bulk insert</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRandomTree(10)}>Random 10</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRandomTree(25)}>Random 25</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSortedTree(8)}>Sorted 8 (degenerate)</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSortedTree(15)}>Sorted 15</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear}>Clear tree</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <GitFork className="h-4 w-4" />
              {tree.nodes.size} nodes · height {stats.height}
              {stats.isBalanced
                ? <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-400">balanced</Badge>
                : <Badge variant="secondary" className="text-[10px] text-amber-700 dark:text-amber-400">unbalanced</Badge>}
              {stats.isDegenerate && <Badge variant="secondary" className="text-[10px] text-red-700 dark:text-red-400">degenerate</Badge>}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" disabled={stepIndex <= 0 || playing} onClick={() => setStepIndex(0)} className="h-8 w-8">
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" disabled={stepIndex <= 0 || playing} onClick={() => setStepIndex((i) => Math.max(0, i - 1))} className="h-8 w-8">
                <SkipBack className="h-3 w-3" />
              </Button>
              <Button size="sm" onClick={() => setPlaying((p) => !p)} className="gap-1">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button variant="outline" size="icon" disabled={stepIndex >= steps.length - 1 || playing} onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))} className="h-8 w-8">
                <SkipForward className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" disabled={stepIndex >= steps.length - 1 || playing} onClick={() => setStepIndex(steps.length - 1)} className="h-8 w-8">
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FastForward className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="range" min={1} max={10} value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
              className="flex-1"
              aria-label="Speed"
            />
            <span className="text-xs text-muted-foreground w-8">{speed}×</span>
          </div>

          <div className="text-xs text-muted-foreground">
            Step {stepIndex + 1} / {steps.length} ({stepPct}%)
            {currentStep && <span className="ml-2">— {currentStep.description}</span>}
          </div>
          <div className="w-full h-2 rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${stepPct}%` }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Nodes" value={stats.nodeCount} />
            <Stat label="Height" value={stats.height} highlight={stats.isDegenerate ? "bad" : undefined} />
            <Stat label="Min depth" value={stats.minDepth} />
            <Stat label="Comparisons" value={currentStep?.comparisons ?? 0} />
          </div>

          {stats.isDegenerate && (
            <div className="rounded border border-red-400/40 bg-red-400/10 p-2 text-xs text-red-700 dark:text-red-300">
              ⚠️ Degenerate tree — sorted input produced a linked-list shape. Lookup is O(n). Consider a self-balancing tree (AVL / Red-Black).
            </div>
          )}

          {currentStep && currentStep.output.length > 0 && (
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <span className="text-muted-foreground">Output: </span>
              <span className="font-mono text-foreground">[{currentStep.output.join(", ")}]</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {positioned.length === 0 ? (
            <EmptyState
              title="Tree is empty"
              hint="Insert a value, run bulk insert, or generate a random / sorted tree to get started."
              icon={<GitFork className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <Legend color="bg-emerald-500" label="Root / default" />
                <Legend color="bg-yellow-400" label="Compare / active" />
                <Legend color="bg-amber-500" label="Successor" />
                <Legend color="bg-sky-500" label="Path" />
                <Legend color="bg-purple-500" label="Insert" />
                <Legend color="bg-rose-500" label="Found" />
              </div>
              <div className="overflow-auto">
                <svg width={svgW} height={svgH} className="max-w-full" role="img" aria-label="Binary search tree visualization">
                  {/* Edges first */}
                  {positioned.map(({ node, x, y }) => {
                    const edges: React.ReactNode[] = [];
                    if (node.left !== null) {
                      const c = posById.get(node.left);
                      if (c) edges.push(
                        <line
                          key={`e-${node.id}-L`}
                          x1={xFor(x)} y1={yFor(y)}
                          x2={xFor(c.x)} y2={yFor(c.y)}
                          className="stroke-border"
                          strokeWidth={1.5}
                        />,
                      );
                    }
                    if (node.right !== null) {
                      const c = posById.get(node.right);
                      if (c) edges.push(
                        <line
                          key={`e-${node.id}-R`}
                          x1={xFor(x)} y1={yFor(y)}
                          x2={xFor(c.x)} y2={yFor(c.y)}
                          className="stroke-border"
                          strokeWidth={1.5}
                        />,
                      );
                    }
                    return edges;
                  })}
                  {/* Nodes */}
                  {positioned.map(({ node, x, y }) => {
                    const cls = currentStep ? nodeColorClass(node.id, currentStep) : "default";
                    const fill = nodeFill(cls);
                    const isRoot = node.id === displayTree.root;
                    const bf = balanceFactor(displayTree, node.id);
                    return (
                      <g key={node.id}>
                        <circle
                          cx={xFor(x)} cy={yFor(y)} r={16}
                          className={fill}
                          stroke={isRoot ? "currentColor" : "none"}
                          strokeWidth={isRoot ? 2 : 0}
                        />
                        <text
                          x={xFor(x)} y={yFor(y) + 4}
                          textAnchor="middle"
                          className="fill-foreground text-[10px] font-mono"
                        >{node.value}</text>
                        <text
                          x={xFor(x) + 18} y={yFor(y) - 12}
                          className="fill-muted-foreground text-[8px]"
                        >{bf}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Numbers in the top-right of each node are the balance factor (h(left) − h(right)). A balanced tree keeps all factors in {`{-1, 0, 1}`}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4" /> Operation details
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => steps.map((s, i) => formatStep(s, i, steps.length)).join("\n")}
                label="Copy steps"
              />
              <DownloadButton
                getText={() => steps.map((s, i) => formatStep(s, i, steps.length)).join("\n")}
                filename="bst-steps.txt"
                label="Download log"
              />
              {currentStep && currentStep.output.length > 0 && (
                <CopyButton
                  getText={() => currentStep.output.join(", ")}
                  label="Copy output"
                />
              )}
              <ShareButton getUrl={() => { handleSaveHistory(`traverse-${traversalKind}`, undefined, true, tree); return buildShareUrl(tree); }} />
              <CopyButton
                getText={() => serializeTree(tree)}
                label="Copy tree"
              />
              <ClearButton onClick={handleReset} />
            </div>
          </div>

          {tab === "delete" && (
            <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
              <div className="font-medium text-foreground">3 deletion cases</div>
              <div className="text-muted-foreground"><strong>Case 1 — Leaf:</strong> Unlink from parent.</div>
              <div className="text-muted-foreground"><strong>Case 2 — One child:</strong> Splice the child up.</div>
              <div className="text-muted-foreground"><strong>Case 3 — Two children:</strong> Find in-order successor, copy its value, delete successor.</div>
            </div>
          )}

          <div className="max-h-[200px] overflow-auto rounded border bg-background p-2 text-[10px] font-mono whitespace-pre-wrap">
            {steps.slice(Math.max(0, stepIndex - 4), stepIndex + 1).map((s, i) => {
              const real = Math.max(0, stepIndex - 4) + i;
              return (
                <div key={real} className={real === stepIndex ? "text-foreground font-semibold" : "text-muted-foreground"}>
                  {formatStep(s, real, steps.length)}
                </div>
              );
            })}
            {steps.length === 0 && <span className="text-muted-foreground">No steps yet. Enter a value or run a traversal.</span>}
          </div>
        </CardContent>
      </Card>

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.op}</Badge>
                  {h.value !== undefined && <Badge variant="outline" className="mr-2">val={h.value}</Badge>}
                  <Badge variant="outline" className="mr-2">{h.nodeCount} nodes</Badge>
                  <Badge variant="outline" className="mr-2">h={h.height}</Badge>
                  <Badge variant="outline" className="mr-2">{h.comparisons} cmp</Badge>
                  <span className="text-muted-foreground ml-1">{h.found ? "✓" : "✗"} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All tree operations, traversal, and animation run locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-8 text-xs gap-1.5"
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function nodeFill(cls: string): string {
  switch (cls) {
    case "compare":
    case "active": return "fill-yellow-400";
    case "successor": return "fill-amber-500";
    case "path": return "fill-sky-500";
    case "insert": return "fill-purple-500";
    case "found": return "fill-rose-500";
    case "default":
    default: return "fill-emerald-500";
  }
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
