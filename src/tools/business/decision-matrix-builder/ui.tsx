"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  parseOptions,
  parseCriteria,
  parseWeights,
  parseScores,
  normalizeWeights,
  totalRawWeight,
  buildCells,
  calculateOptionTotals,
  rankOptions,
  sensitivityAnalysis,
  summaryStats,
  scoreColor,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MatrixInput,
  type HistoryEntry,
} from "./logic";
import { History, GitCompare, Download, AlertTriangle, Trophy } from "lucide-react";

const DEFAULT_INPUT: MatrixInput = {
  decisionTitle: "Which vendor to pick",
  optionsText: "Vendor A\nVendor B\nVendor C",
  criteriaText: "Cost\nSpeed\nQuality\nReliability",
  weightsText: "Cost,30\nSpeed,20\nQuality,30\nReliability,20",
  scoresText: [
    "Vendor A,Cost,4",
    "Vendor A,Speed,3",
    "Vendor A,Quality,5",
    "Vendor A,Reliability,4",
    "Vendor B,Cost,2",
    "Vendor B,Speed,5",
    "Vendor B,Quality,3",
    "Vendor B,Reliability,3",
    "Vendor C,Cost,5",
    "Vendor C,Speed,2",
    "Vendor C,Quality,3",
    "Vendor C,Reliability,5",
  ].join("\n"),
};

export default function DecisionMatrixBuilder() {
  const [input, setInput] = useState<MatrixInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const options = useMemo(() => parseOptions(input.optionsText), [input.optionsText]);
  const criteria = useMemo(() => parseCriteria(input.criteriaText), [input.criteriaText]);
  const { weights, errors: weightErrors } = useMemo(
    () => parseWeights(input.weightsText),
    [input.weightsText],
  );
  const { scores, errors: scoreErrors } = useMemo(
    () => parseScores(input.scoresText),
    [input.scoresText],
  );
  const normalizedWeights = useMemo(() => normalizeWeights(weights), [weights]);
  const cells = useMemo(
    () => buildCells(options, criteria, normalizedWeights, scores),
    [options, criteria, normalizedWeights, scores],
  );
  const totals = useMemo(() => calculateOptionTotals(cells, options), [cells, options]);
  const ranked = useMemo(() => rankOptions(totals), [totals]);
  const stats = useMemo(
    () => summaryStats(options, criteria, weights, normalizedWeights, cells, ranked),
    [options, criteria, weights, normalizedWeights, cells, ranked],
  );
  const sensitivity = useMemo(
    () => sensitivityAnalysis(options, criteria, weights, scores),
    [options, criteria, weights, scores],
  );

  const text = useMemo(
    () => renderText(input, options, criteria, normalizedWeights, cells, ranked, stats, sensitivity),
    [input, options, criteria, normalizedWeights, cells, ranked, stats, sensitivity],
  );
  const csv = useMemo(
    () => renderCsv(options, criteria, normalizedWeights, cells, ranked),
    [options, criteria, normalizedWeights, cells, ranked],
  );
  const html = useMemo(
    () => renderHtml(input, options, criteria, normalizedWeights, cells, ranked, stats, sensitivity),
    [input, options, criteria, normalizedWeights, cells, ranked, stats, sensitivity],
  );

  const update = useCallback((patch: Partial<MatrixInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (options.length > 0 && criteria.length > 0) {
      saveHistory({
        ts: Date.now(),
        title: input.decisionTitle || "(untitled)",
        optionsCount: options.length,
        criteriaCount: criteria.length,
        winnerOption: stats.winnerOption,
        winnerTotal: stats.winnerTotal,
      });
      setHistory(loadHistory());
    }
  }, [options.length, criteria.length, input.decisionTitle, stats]);

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(input.decisionTitle || "decision-matrix").replace(/[^a-z0-9-]+/gi, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.decisionTitle, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setInput({
      decisionTitle: "",
      optionsText: "",
      criteriaText: "",
      weightsText: "",
      scoresText: "",
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasData = options.length > 0 && criteria.length > 0;
  const winner = ranked.length > 0 ? ranked[0] : null;
  const runnerUp = ranked.length > 1 ? ranked[1] : null;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dmb-title">What decision are you making?</Label>
            <Input
              id="dmb-title"
              value={input.decisionTitle}
              onChange={(e) => update({ decisionTitle: e.target.value })}
              placeholder="Which vendor should we hire?"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dmb-opts">Options (one per line)</Label>
              <Textarea
                id="dmb-opts"
                value={input.optionsText}
                onChange={(e) => update({ optionsText: e.target.value })}
                placeholder={"Vendor A\nVendor B\nVendor C"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dmb-crit">Criteria (one per line)</Label>
              <Textarea
                id="dmb-crit"
                value={input.criteriaText}
                onChange={(e) => update({ criteriaText: e.target.value })}
                placeholder={"Cost\nSpeed\nQuality"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dmb-weights">
                Weights — one per line:{" "}
                <code className="font-mono text-[11px]">criterion,weight</code>{" "}
                (should sum to 100)
              </Label>
              <Textarea
                id="dmb-weights"
                value={input.weightsText}
                onChange={(e) => update({ weightsText: e.target.value })}
                placeholder={"Cost,30\nSpeed,20\nQuality,30\nReliability,20"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
              <div className="text-[11px] text-muted-foreground">
                Raw total: <span className="font-mono">{totalRawWeight(weights)}</span>
                {totalRawWeight(weights) !== 100 && totalRawWeight(weights) > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                    · will be normalized to 100
                  </span>
                )}
              </div>
              {weightErrors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                  {weightErrors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dmb-scores">
                Scores — one per line:{" "}
                <code className="font-mono text-[11px]">option,criterion,score</code>{" "}
                (score 1-5)
              </Label>
              <Textarea
                id="dmb-scores"
                value={input.scoresText}
                onChange={(e) => update({ scoresText: e.target.value })}
                placeholder={"Vendor A,Cost,4\nVendor A,Speed,3"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
              {scoreErrors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                  {scoreErrors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasData ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GitCompare className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Options" value={String(stats.optionsCount)} />
                <Stat label="Criteria" value={String(stats.criteriaCount)} />
                <Stat
                  label="Cells filled"
                  value={`${stats.filledCellsCount}/${stats.cellsCount}`}
                  highlight={stats.filledCellsCount === stats.cellsCount ? "good" : undefined}
                />
                <Stat label="Raw weight" value={String(stats.totalWeight)} />
                <Stat
                  label="Winner"
                  value={stats.winnerOption || "—"}
                  highlight="good"
                />
                <Stat label="Winner total" value={stats.winnerTotal.toFixed(2)} />
                <Stat
                  label="Margin"
                  value={stats.marginOfVictory.toFixed(2)}
                />
                <Stat
                  label="Stability"
                  value={sensitivity.stable ? "Robust" : "Sensitive"}
                  highlight={sensitivity.stable ? "good" : "bad"}
                />
              </div>
              {!sensitivity.stable && (
                <div className="flex items-center gap-2 rounded border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  The winner changes under ±10% weight variation. Consider revisiting your weights before committing.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Ranking
              </h3>
              <div className="space-y-1">
                {ranked.map((t) => (
                  <div
                    key={t.option}
                    className={`rounded border px-3 py-2 text-xs flex items-center gap-2 ${
                      t.rank === 1
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400/50"
                        : "bg-background"
                    }`}
                  >
                    <Badge variant={t.rank === 1 ? "default" : "outline"} className="text-[10px]">
                      #{t.rank}
                    </Badge>
                    <span className="font-medium text-foreground">{t.option}</span>
                    <span className="ml-auto font-mono text-muted-foreground">
                      {t.totalScore.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" /> Score Matrix
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Color: <span style={{ color: scoreColor(5) }}>●</span> 5
                  <span className="mx-1" style={{ color: scoreColor(3) }}>●</span> 3
                  <span style={{ color: scoreColor(1) }}>●</span> 1
                </span>
              </div>
              <div className="rounded border bg-background overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-2 py-2 font-medium">Option</th>
                      {criteria.map((c) => {
                        const nw = normalizedWeights.find(
                          (w) => w.criterion.toLowerCase() === c.toLowerCase(),
                        );
                        return (
                          <th key={c} className="px-2 py-2 font-medium text-center">
                            {c}
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {nw ? `${nw.normalizedWeight.toFixed(1)}%` : "—"}
                            </div>
                          </th>
                        );
                      })}
                      <th className="px-2 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((option) => {
                      const t = ranked.find((rt) => rt.option === option);
                      return (
                        <tr key={option} className={t?.rank === 1 ? "bg-emerald-50 dark:bg-emerald-950/20" : "border-t"}>
                          <td className="px-2 py-1.5 font-medium">
                            {t?.rank === 1 ? "★ " : ""}{option}
                          </td>
                          {criteria.map((criterion) => {
                            const cell = cells.find(
                              (cc) => cc.option === option && cc.criterion === criterion,
                            );
                            const score = cell ? cell.score : 0;
                            const color = scoreColor(score);
                            return (
                              <td
                                key={criterion}
                                className="px-2 py-1.5 text-center font-semibold"
                                style={{
                                  backgroundColor: `${color}22`,
                                  borderLeft: `3px solid ${color}`,
                                }}
                                title={cell ? `weighted: ${cell.weightedScore.toFixed(2)}` : ""}
                              >
                                {score > 0 ? score : "—"}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right font-mono font-semibold">
                            {t ? t.totalScore.toFixed(2) : "0.00"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {winner && runnerUp && (
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{winner.option}</strong> wins over{" "}
                  <strong className="text-foreground">{runnerUp.option}</strong> by{" "}
                  <span className="font-mono">{stats.marginOfVictory.toFixed(2)}</span> points.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Sensitivity Analysis
              </h3>
              <p className="text-xs text-muted-foreground">
                Each criterion's weight is varied ±10% (renormalized) to check if the winner is robust.
                Base winner: <strong className="text-foreground">{sensitivity.baseWinner || "—"}</strong>
              </p>
              <div className="rounded border bg-background overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-2 py-2 font-medium">Variation</th>
                      <th className="px-2 py-2 font-medium">Winner</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.variations.map((v, i) => (
                      <tr key={i} className={`border-t ${v.winnerChanged ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                        <td className="px-2 py-1.5 font-mono">{v.label}</td>
                        <td className="px-2 py-1.5">{v.winnerOption || "—"}</td>
                        <td className="px-2 py-1.5">
                          {v.winnerChanged ? (
                            <span className="text-amber-700 dark:text-amber-300 font-medium">⚠ changed</span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-300">same</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GitCompare className="h-4 w-4" /> Text Report Preview
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`${(input.decisionTitle || "decision-matrix").replace(/[^a-z0-9-]+/gi, "-")}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename={`${(input.decisionTitle || "decision-matrix").replace(/[^a-z0-9-]+/gi, "-")}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <Button variant="outline" size="sm" onClick={handleDownloadHtml} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download HTML
                </Button>
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter options and criteria to build the decision matrix"
          hint="One per line. Then add weights (criterion,weight) and scores (option,criterion,score 1-5)."
          icon={<GitCompare className="h-8 w-8" />}
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
                  <span className="font-medium text-foreground">{h.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{h.optionsCount} opts</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.criteriaCount} crit</Badge>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    ★ {h.winnerOption || "—"}
                  </Badge>
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
            <strong className="text-foreground">Privacy:</strong> All matrix parsing, scoring, ranking and sensitivity analysis happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
  value: string;
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
      <div className={`text-sm font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}
