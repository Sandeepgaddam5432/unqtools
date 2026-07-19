"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  DIFFICULTY_PRESETS,
  OPERATION_LABELS,
  OP_SYMBOLS,
  TIMED_PRESETS,
  generateWorksheet,
  computeStats,
  renderTextWorksheet,
  renderHtmlWorksheet,
  renderCsvWorksheet,
  renderMarkdownWorksheet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  randomSeed,
  type OperationType,
  type DifficultyLevel,
  type WorksheetSettings,
  type Worksheet,
  type HistoryEntry,
} from "./logic";
import { Calculator, History, Shuffle, Clock, RefreshCw } from "lucide-react";

export default function MathPracticeGenerator() {
  const [operation, setOperation] = useState<OperationType>("addition");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");
  const [count, setCount] = useState<number>(20);
  const [range, setRange] = useState<string>("");
  const [allowNegatives, setAllowNegatives] = useState<boolean>(false);
  const [showAnswers, setShowAnswers] = useState<boolean>(true);
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.operation) setOperation(p.operation);
      if (p.difficulty) setDifficulty(p.difficulty);
      if (p.numberOfProblems) setCount(p.numberOfProblems);
      if (p.numberRange !== undefined) setRange(p.numberRange);
      if (p.allowNegatives !== undefined) setAllowNegatives(p.allowNegatives);
      if (p.showAnswers !== undefined) setShowAnswers(p.showAnswers);
      if (p.seed !== undefined) setSeed(p.seed);
      const hasAny = Object.keys(p).length > 0;
      if (hasAny) toast.info("Loaded settings from share link");
    }
  }, []);

  const settings: WorksheetSettings = useMemo(
    () => ({
      operation,
      difficulty,
      numberOfProblems: count,
      numberRange: range,
      allowNegatives,
      showAnswers,
      seed,
    }),
    [operation, difficulty, count, range, allowNegatives, showAnswers, seed],
  );

  const stats = useMemo(
    () => (worksheet ? computeStats(worksheet) : null),
    [worksheet],
  );

  const textOut = useMemo(
    () => (worksheet ? renderTextWorksheet(worksheet) : ""),
    [worksheet],
  );
  const htmlOut = useMemo(
    () => (worksheet ? renderHtmlWorksheet(worksheet) : ""),
    [worksheet],
  );
  const csvOut = useMemo(
    () => (worksheet ? renderCsvWorksheet(worksheet) : ""),
    [worksheet],
  );
  const mdOut = useMemo(
    () => (worksheet ? renderMarkdownWorksheet(worksheet) : ""),
    [worksheet],
  );

  const handleGenerate = useCallback(() => {
    const ws = generateWorksheet(settings);
    setWorksheet(ws);
    saveHistory({
      ts: Date.now(),
      operation: ws.operation,
      difficulty: ws.difficulty,
      count: ws.problems.length,
      seed: ws.seed,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${ws.problems.length} problems (seed ${ws.seed})`);
  }, [settings]);

  const handleReshuffleSeed = useCallback(() => {
    setSeed(randomSeed());
    toast.info("New seed set — click Generate");
  }, []);

  const handleClear = useCallback(() => {
    setWorksheet(null);
    setRange("");
    setAllowNegatives(false);
    setShowAnswers(true);
    setCount(20);
    setOperation("addition");
    setDifficulty("easy");
    setSeed(randomSeed());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const timedPreset = TIMED_PRESETS[difficulty];
  const suggestedMinutes = worksheet
    ? Math.ceil((worksheet.problems.length * timedPreset.perProblemSeconds) / 60)
    : 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="mpg-op" className="text-xs">Operation</Label>
              <select
                id="mpg-op"
                value={operation}
                onChange={(e) => setOperation(e.target.value as OperationType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(OPERATION_LABELS) as OperationType[]).map((op) => (
                  <option key={op} value={op}>{OPERATION_LABELS[op]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpg-diff" className="text-xs">Difficulty</Label>
              <select
                id="mpg-diff"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[]).map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_PRESETS[d].label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpg-count" className="text-xs">Number of problems</Label>
              <Input
                id="mpg-count"
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpg-range" className="text-xs">Number range (override)</Label>
              <Input
                id="mpg-range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder={`e.g. 1-100 (default: ${DIFFICULTY_PRESETS[difficulty].min}-${DIFFICULTY_PRESETS[difficulty].max})`}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={allowNegatives}
                onChange={(e) => setAllowNegatives(e.target.checked)}
              />
              Allow negative results
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
              />
              Include answer key
            </label>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Seed:</span>
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))}
                className="h-7 w-24 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={handleReshuffleSeed} title="Randomize seed">
                <Shuffle className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate worksheet" />
            <ShareButton getUrl={() => buildShareUrl(settings)} />
            <ClearButton onClick={handleClear} />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Suggested pace: {timedPreset.label}
              {worksheet && ` · ~${suggestedMinutes} min total for ${worksheet.problems.length} problems`}
            </span>
          </div>
        </CardContent>
      </Card>

      {worksheet && stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Worksheet — {worksheet.problems.length} problems
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Operation" value={OPERATION_LABELS[worksheet.operation]} />
                <Stat label="Difficulty" value={DIFFICULTY_PRESETS[worksheet.difficulty].label} />
                <Stat label="Range" value={`${worksheet.rangeMin}-${worksheet.rangeMax}`} />
                <Stat label="Seed" value={worksheet.seed} />
                <Stat label="Min answer" value={stats.minAnswer ?? "-"} />
                <Stat label="Max answer" value={stats.maxAnswer ?? "-"} />
                <Stat label="Avg answer" value={stats.avgAnswer !== null ? stats.avgAnswer.toFixed(2) : "-"} />
                <Stat label="Suggested time" value={`${Math.ceil(stats.suggestedTimeSeconds / 60)} min`} />
              </div>
              {worksheet.operation === "mixed" && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(["addition", "subtraction", "multiplication", "division"] as const).map((op) => (
                    <Badge key={op} variant="outline" className="text-[10px]">
                      {OPERATION_LABELS[op]}: {stats.byOp[op]}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Problems
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <CopyButton getText={() => textOut} label="Copy text" />
                  <DownloadButton getText={() => textOut} filename="math-worksheet.txt" label=".txt" />
                  <DownloadButton getText={() => htmlOut} filename="math-worksheet.html" mime="text/html" label=".html" />
                  <DownloadButton getText={() => csvOut} filename="math-worksheet.csv" mime="text/csv" label=".csv" />
                  <DownloadButton getText={() => mdOut} filename="math-worksheet.md" mime="text/markdown" label=".md" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 max-h-[480px] overflow-auto">
                {worksheet.problems.map((p) => (
                  <div key={p.index} className="rounded border bg-background px-3 py-1.5 text-sm font-mono text-foreground">
                    <span className="text-muted-foreground mr-2">{p.index}.</span>
                    {p.text} {worksheet.showAnswers && (
                      <span className="text-emerald-600 dark:text-emerald-400 ml-2 font-semibold">
                        {p.answer % 1 === 0 ? p.answer : p.answer.toFixed(4)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {worksheet.showAnswers && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show answer key as text</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] rounded border bg-muted/30 p-2 max-h-64 overflow-auto">
{worksheet.problems.map((p) => `${p.index}. ${p.text} ${p.answer % 1 === 0 ? p.answer : p.answer.toFixed(4)}`).join("\n")}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!worksheet && (
        <EmptyState
          title="Configure and click Generate"
          hint="Choose operation, difficulty, and count. Override the default range, allow negatives, or hide answers. The seed makes results reproducible."
          icon={<Calculator className="h-8 w-8" />}
        />
      )}

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
                  <Badge variant="outline" className="text-[10px]">{OPERATION_LABELS[h.operation]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{DIFFICULTY_PRESETS[h.difficulty].label}</Badge>
                  <span className="text-muted-foreground">{h.count} problems · seed {h.seed}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      setOperation(h.operation);
                      setDifficulty(h.difficulty);
                      setCount(h.count);
                      setSeed(h.seed);
                      toast.info("Loaded — click Generate");
                    }}
                  >Reload</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All problem generation runs locally. Your settings and history never leave your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export type { OperationType, DifficultyLevel };
