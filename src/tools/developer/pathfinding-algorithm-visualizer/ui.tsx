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
  ALGORITHM_LIST,
  ALGORITHMS,
  HEURISTIC_LIST,
  HEURISTICS,
  MAZE_LIST,
  MAZES,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_COLS,
  makeGrid,
  defaultGrid,
  cloneGrid,
  idx,
  cellAt,
  setWall,
  cycleWeight,
  setStart,
  setEnd,
  clearWallsAndWeights,
  generateMaze,
  runAlgorithm,
  compareAll,
  cellColorClass,
  formatStep,
  serializeGrid,
  deserializeGrid,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AlgorithmId,
  type HeuristicId,
  type MazeId,
  type Grid,
  type Step,
  type HistoryEntry,
} from "./logic";
import {
  History, Navigation, Play, Pause, SkipForward, SkipBack,
  FastForward, RotateCcw, Info, Shuffle, Grid3x3, Eraser,
} from "lucide-react";

type Tool = "wall" | "weight" | "start" | "end";
const WEIGHT_TIERS = [1, 5, 15];

export default function PathfindingAlgorithmVisualizer() {
  const [grid, setGrid] = useState<Grid>(() => defaultGrid());
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [heuristicId, setHeuristicId] = useState<HeuristicId>("manhattan");
  const [diagonal, setDiagonal] = useState(false);
  const [tool, setTool] = useState<Tool>("wall");
  const [rowsInput, setRowsInput] = useState(String(DEFAULT_GRID_ROWS));
  const [colsInput, setColsInput] = useState(String(DEFAULT_GRID_COLS));
  const [mazeSeed, setMazeSeed] = useState("7");
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [showCompare, setShowCompare] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{ kind: "start" | "end" | null }>({ kind: null });

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        setAlgorithm(p.algorithm);
        setHeuristicId(p.heuristic);
        setDiagonal(p.diagonal);
        const g = deserializeGrid(p.grid);
        if (g) {
          setGrid(g);
          setRowsInput(String(g.rows));
          setColsInput(String(g.cols));
          toast.info("Loaded grid from share link");
        }
      }
    }
  }, []);

  // Run the algorithm.
  const result = useMemo(
    () => runAlgorithm(algorithm, grid, diagonal, heuristicId),
    [algorithm, grid, diagonal, heuristicId],
  );
  const steps = result.steps;
  const currentStep: Step | null = steps[stepIndex] ?? null;

  // Comparison table.
  const comparison = useMemo(
    () => showCompare ? compareAll(grid, diagonal, heuristicId) : null,
    [showCompare, grid, diagonal, heuristicId],
  );

  // Reset step index when algorithm/grid/heuristic/diagonal changes.
  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [algorithm, grid, heuristicId, diagonal]);

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

  const handleCellClick = useCallback((row: number, col: number, ev: React.MouseEvent) => {
    const c = cellAt(grid, row, col);
    if (!c) return;
    if (c.type === "start") {
      if (tool === "start" || tool === "end") {
        dragRef.current = { kind: "start" };
      }
      return;
    }
    if (c.type === "end") {
      if (tool === "start" || tool === "end") {
        dragRef.current = { kind: "end" };
      }
      return;
    }
    if (ev.shiftKey || tool === "weight") {
      setGrid((g) => cycleWeight(g, row, col));
    } else {
      setGrid((g) => setWall(g, row, col, c.type !== "wall"));
    }
  }, [grid, tool]);

  const handleCellEnter = useCallback((row: number, col: number) => {
    if (dragRef.current.kind === "start") {
      setGrid((g) => setStart(g, row, col));
    } else if (dragRef.current.kind === "end") {
      setGrid((g) => setEnd(g, row, col));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { kind: null };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [handleMouseUp]);

  const handleApplySize = useCallback(() => {
    const r = parseInt(rowsInput, 10);
    const c = parseInt(colsInput, 10);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r < 2 || c < 2) {
      toast.error("Rows and cols must be ≥ 2");
      return;
    }
    if (r > 50 || c > 60) {
      toast.error("Max size is 50 × 60");
      return;
    }
    setGrid(makeGrid(r, c));
    toast.success(`Resized to ${r} × ${c}`);
  }, [rowsInput, colsInput]);

  const handleMaze = useCallback((m: MazeId) => {
    const seed = parseInt(mazeSeed, 10) || 1;
    setGrid((g) => generateMaze(g, m, seed));
    toast.success(`Generated ${MAZES[m].name} maze`);
  }, [mazeSeed]);

  const handleClearWalls = useCallback(() => {
    setGrid((g) => clearWallsAndWeights(g));
    toast.info("Cleared walls and weights");
  }, []);

  const handleReset = useCallback(() => {
    setGrid(defaultGrid());
    setRowsInput(String(DEFAULT_GRID_ROWS));
    setColsInput(String(DEFAULT_GRID_COLS));
    setAlgorithm("astar");
    setHeuristicId("manhattan");
    setDiagonal(false);
    setStepIndex(0);
    setPlaying(false);
    toast.info("Reset to defaults");
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      algorithm,
      heuristic: heuristicId,
      diagonal,
      rows: grid.rows,
      cols: grid.cols,
      wallCount: grid.cells.filter((c) => c.type === "wall").length,
      pathFound: result.pathFound,
      pathLength: result.pathLength,
      visited: result.totalVisited,
    });
    setHistory(loadHistory());
  }, [algorithm, heuristicId, diagonal, grid, result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const stepPct = steps.length > 0 ? Math.round((stepIndex / Math.max(1, steps.length - 1)) * 100) : 0;
  const algoInfo = ALGORITHMS[algorithm];
  const heurInfo = HEURISTICS[heuristicId];
  const admissibilityWarning = (algorithm === "astar" || algorithm === "greedy") &&
    ((diagonal && !heurInfo.admissible8) || (!diagonal && !heurInfo.admissible4));

  return (
    <div className="space-y-4 unq-animate-fade-in-up" onMouseUp={handleMouseUp}>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Algorithm</Label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as AlgorithmId)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {ALGORITHM_LIST.map((a) => (
                  <option key={a} value={a}>{ALGORITHMS[a].name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Heuristic (A* / Greedy)</Label>
              <select
                value={heuristicId}
                onChange={(e) => setHeuristicId(e.target.value as HeuristicId)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
                disabled={algorithm !== "astar" && algorithm !== "greedy"}
              >
                {HEURISTIC_LIST.map((h) => (
                  <option key={h} value={h}>{HEURISTICS[h].name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Movement</Label>
              <select
                value={diagonal ? "8" : "4"}
                onChange={(e) => setDiagonal(e.target.value === "8")}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="4">4-direction</option>
                <option value="8">8-direction (diagonal)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Draw tool</Label>
              <select
                value={tool}
                onChange={(e) => setTool(e.target.value as Tool)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="wall">Wall (click)</option>
                <option value="weight">Weight (shift-click)</option>
                <option value="start">Move start (drag)</option>
                <option value="end">Move end (drag)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Rows</Label>
              <Input
                value={rowsInput}
                onChange={(e) => setRowsInput(e.target.value)}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cols</Label>
              <Input
                value={colsInput}
                onChange={(e) => setColsInput(e.target.value)}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Maze seed</Label>
              <Input
                value={mazeSeed}
                onChange={(e) => setMazeSeed(e.target.value)}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleApplySize} className="h-8">Apply size</Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MAZE_LIST.map((m) => (
              <Button key={m} variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleMaze(m)}>
                <Shuffle className="h-3 w-3 mr-1" /> {MAZES[m].name}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearWalls}>
              <Eraser className="h-3 w-3 mr-1" /> Clear walls
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Navigation className="h-4 w-4" /> {algoInfo.name}
              <Badge variant="outline" className="text-[10px]">{algoInfo.time}</Badge>
              {algoInfo.optimal
                ? <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-400">optimal</Badge>
                : <Badge variant="secondary" className="text-[10px] text-amber-700 dark:text-amber-400">non-optimal</Badge>}
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
            <Stat label="Visited" value={currentStep?.visitedCount ?? 0} />
            <Stat label="Frontier" value={currentStep?.frontierCount ?? 0} />
            <Stat label="Path length" value={result.pathFound ? result.pathLength : "—"} />
            <Stat
              label="Path cost"
              value={result.pathFound ? (Number.isFinite(result.pathCost) ? result.pathCost : "—") : "—"}
              highlight={result.pathFound ? "good" : undefined}
            />
          </div>

          {admissibilityWarning && (
            <div className="rounded border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ {heurInfo.name} heuristic overestimates on {diagonal ? "8-dir" : "4-dir"} grids — A* / Greedy may not return the optimal path.
            </div>
          )}

          {!result.pathFound && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              No path from start to end. Clear some walls or move start/end.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <Legend swatch="bg-emerald-500" label="Start" />
              <Legend swatch="bg-rose-500" label="End" />
              <Legend swatch="bg-slate-700 dark:bg-slate-300" label="Wall" />
              <Legend swatch="bg-sky-300 dark:bg-sky-700" label="Visited" />
              <Legend swatch="bg-amber-300 dark:bg-amber-700" label="Frontier" />
              <Legend swatch="bg-yellow-400" label="Current" />
              <Legend swatch="bg-purple-500" label="Path" />
              <Legend swatch="bg-orange-200 dark:bg-orange-800" label="Weight 5" />
              <Legend swatch="bg-orange-400 dark:bg-orange-600" label="Weight 15" />
            </div>
            <div
              className="grid gap-[1px] overflow-auto rounded border bg-border select-none"
              style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, maxHeight: "60vh" }}
            >
              {grid.cells.map((cell, i) => {
                const cls = currentStep ? cellColorClass(i, currentStep, grid) : (cell.type === "wall" ? "wall" : cell.type === "start" ? "start" : cell.type === "end" ? "end" : cell.weight > 1 ? `weight-${cell.weight}` : "empty");
                return (
                  <div
                    key={i}
                    onMouseDown={(ev) => handleCellClick(cell.row, cell.col, ev)}
                    onMouseEnter={() => handleCellEnter(cell.row, cell.col)}
                    className={`aspect-square cursor-pointer transition-colors ${cellClass(cls)}`}
                    title={`(${cell.row}, ${cell.col})${cell.weight > 1 ? ` · w=${cell.weight}` : ""}`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Click a cell to toggle a wall. Shift-click (or use the Weight tool) to cycle weight through {WEIGHT_TIERS.join(" → ")}. Drag the green start or red end to move them.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4" /> Algorithm info
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowCompare((s) => !s)}>
              <Grid3x3 className="h-3.5 w-3.5 mr-1" /> {showCompare ? "Hide" : "Show"} comparison
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{algoInfo.description}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Time" value={algoInfo.time} />
            <Stat label="Space" value={algoInfo.space} />
            <Stat label="Weighted" value={algoInfo.weighted ? "Yes" : "No"} />
            <Stat label="Complete" value={algoInfo.complete ? "Yes" : "No"} highlight={algoInfo.complete ? "good" : "bad"} />
          </div>
          {(algorithm === "astar" || algorithm === "greedy") && (
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="font-medium text-foreground">{heurInfo.name} heuristic</div>
              <div className="text-muted-foreground font-mono">{heurInfo.formula}</div>
              <div className="text-muted-foreground mt-1">{heurInfo.description}</div>
              <div className="mt-1 text-[10px]">
                Admissible: 4-dir={heurInfo.admissible4 ? "yes" : "no"}, 8-dir={heurInfo.admissible8 ? "yes" : "no"}
              </div>
            </div>
          )}

          {showCompare && comparison && (
            <div className="overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Algorithm</th>
                    <th className="text-right p-2">Visited</th>
                    <th className="text-right p-2">Path length</th>
                    <th className="text-right p-2">Path cost</th>
                    <th className="text-right p-2">Found</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(({ algorithm: a, result: r }) => (
                    <tr key={a} className="border-t">
                      <td className="p-2">{ALGORITHMS[a].name}</td>
                      <td className="text-right p-2 font-mono">{r.totalVisited}</td>
                      <td className="text-right p-2 font-mono">{r.pathLength}</td>
                      <td className="text-right p-2 font-mono">{r.pathFound ? r.pathCost : "—"}</td>
                      <td className="text-right p-2">{r.pathFound ? "✓" : "✗"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Step log</h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return steps.map((s, i) => formatStep(s, i, steps.length)).join("\n"); }}
                label="Copy steps"
              />
              <DownloadButton
                getText={() => steps.map((s, i) => formatStep(s, i, steps.length)).join("\n")}
                filename="pathfinding-steps.txt"
                label="Download log"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(algorithm, heuristicId, diagonal, grid); }} />
              <CopyButton
                getText={() => serializeGrid(grid)}
                label="Copy grid"
              />
              <ClearButton onClick={handleReset} />
            </div>
          </div>
          <div className="max-h-[200px] overflow-auto rounded border bg-background p-2 text-[10px] font-mono whitespace-pre-wrap">
            {steps.slice(Math.max(0, stepIndex - 4), stepIndex + 1).map((s, i) => {
              const real = Math.max(0, stepIndex - 4) + i;
              return (
                <div key={real} className={real === stepIndex ? "text-foreground font-semibold" : "text-muted-foreground"}>
                  {formatStep(s, real, steps.length)}
                </div>
              );
            })}
            {steps.length === 0 && <span className="text-muted-foreground">No steps yet.</span>}
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
                  <Badge variant="outline" className="mr-2">{ALGORITHMS[h.algorithm].name}</Badge>
                  <Badge variant="outline" className="mr-2">{h.rows}×{h.cols}</Badge>
                  <Badge variant="outline" className="mr-2">{h.wallCount} walls</Badge>
                  <Badge variant="outline" className="mr-2">{h.diagonal ? "8-dir" : "4-dir"}</Badge>
                  <span className="text-muted-foreground">
                    {h.pathFound ? `path ${h.pathLength}` : "no path"} · {h.visited} visited · {new Date(h.ts).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All pathfinding, maze generation, and animation run locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function cellClass(kind: string): string {
  switch (kind) {
    case "start": return "bg-emerald-500";
    case "end": return "bg-rose-500";
    case "wall": return "bg-slate-700 dark:bg-slate-300";
    case "visited": return "bg-sky-300 dark:bg-sky-700";
    case "frontier": return "bg-amber-300 dark:bg-amber-700";
    case "current": return "bg-yellow-400";
    case "path": return "bg-purple-500";
    case "weight-5": return "bg-orange-200 dark:bg-orange-800";
    case "weight-15": return "bg-orange-400 dark:bg-orange-600";
    case "empty":
    default: return "bg-background hover:bg-muted";
  }
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
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
