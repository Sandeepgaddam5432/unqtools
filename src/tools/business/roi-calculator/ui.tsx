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
  ROI_TARGET_PRESETS,
  parseCashFlows,
  computeRoi,
  formatNumber,
  formatPercent,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RoiInput,
  type RoiHistoryEntry,
} from "./logic";
import { History, TrendingUp, Calculator } from "lucide-react";

const DEFAULT_INPUT: RoiInput = {
  initialInvestment: 10000,
  cashFlowsText: "5000\n6000\n7000\n8000",
  discountRate: 10,
  terminalValue: 0,
};

export default function RoiCalculator() {
  const [input, setInput] = useState<RoiInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<RoiHistoryEntry[]>([]);

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

  const parsed = useMemo(() => parseCashFlows(input.cashFlowsText), [input.cashFlowsText]);
  const result = useMemo(() => computeRoi(input), [input]);
  const stats = useMemo(() => summaryStats(result), [result]);
  const text = useMemo(() => renderText(input, result), [input, result]);
  const csv = useMemo(() => renderCsv(input, result), [input, result]);

  const update = useCallback((patch: Partial<RoiInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.initialInvestment > 0 || result.cashFlows.length > 0) {
      saveHistory({
        ts: Date.now(),
        initialInvestment: result.initialInvestment,
        totalCashFlow: result.totalCashFlow,
        roi: result.roi,
        npv: result.npv,
        irr: result.irr,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const profitabilityVariant = (
    stats.profitability === "profitable" ? "secondary"
      : stats.profitability === "unprofitable" ? "destructive"
        : "outline"
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="roi-init">Initial investment</Label>
              <Input
                id="roi-init"
                type="number"
                min="0"
                step="0.01"
                value={input.initialInvestment || ""}
                onChange={(e) => update({ initialInvestment: Number(e.target.value) || 0 })}
                placeholder="10000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roi-rate">Discount rate (for NPV, %)</Label>
              <Input
                id="roi-rate"
                type="number"
                step="0.1"
                value={input.discountRate}
                onChange={(e) => update({ discountRate: Number(e.target.value) || 0 })}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="roi-cf">
                Annual cash flows — one number per line (e.g. <code className="font-mono text-[11px]">5000</code> per year)
              </Label>
              <Textarea
                id="roi-cf"
                value={input.cashFlowsText}
                onChange={(e) => update({ cashFlowsText: e.target.value })}
                placeholder={"5000\n6000\n7000\n8000"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
              {parsed.errors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                  {parsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
                </div>
              )}
              {parsed.values.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {parsed.values.length} year(s) of cash flow
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roi-tv">Terminal / salvage value (optional)</Label>
              <Input
                id="roi-tv"
                type="number"
                step="0.01"
                value={input.terminalValue || ""}
                onChange={(e) => update({ terminalValue: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quick discount rate presets</Label>
              <div className="flex flex-wrap gap-1">
                {[0, 5, 10, 15, 20].map((r) => (
                  <Button
                    key={r}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => update({ discountRate: r })}
                  >{r}%</Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.cashFlows.length > 0 || result.initialInvestment > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" /> Results
                </h3>
                <Badge variant={profitabilityVariant} className="uppercase text-[10px]">
                  {stats.profitability}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Initial" value={formatNumber(stats.initialInvestment)} />
                <Stat label="Total CF" value={formatNumber(stats.totalCashFlow)} />
                <Stat label="Net profit" value={formatNumber(stats.netProfit)} highlight={stats.netProfit >= 0 ? "good" : "bad"} />
                <Stat label="ROI" value={formatPercent(stats.roi)} highlight={stats.roi >= 0 ? "good" : "bad"} />
                <Stat label="Annualized ROI" value={formatPercent(stats.annualizedRoi)} />
                <Stat
                  label="Payback"
                  value={stats.paybackPeriod === null ? "never" : `${stats.paybackPeriod.toFixed(2)}y`}
                />
                <Stat label="NPV" value={formatNumber(stats.npv)} highlight={stats.npv > 0 ? "good" : stats.npv < 0 ? "bad" : undefined} />
                <Stat label="IRR" value={formatPercent(stats.irr)} />
              </div>
              {stats.paybackPeriod !== null && (
                <div className="text-[11px] text-muted-foreground">
                  Payback: <strong className="text-foreground">{stats.paybackPeriod === null ? "never" : `${result.paybackYears} year(s) ${result.paybackMonths} month(s)`}</strong>
                </div>
              )}
              <div className="rounded border bg-background p-2 text-[11px]">
                <strong className="text-foreground">Profitability check:</strong>{" "}
                {stats.profitability === "profitable"
                  ? "NPV is positive AND IRR exceeds the discount rate."
                  : stats.profitability === "unprofitable"
                    ? "NPV is negative AND IRR is below the discount rate."
                    : "Mixed signals — review NPV and IRR individually."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">ROI Target Comparison</h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                {ROI_TARGET_PRESETS.map((target) => {
                  const hit = stats.roi >= target;
                  return (
                    <div
                      key={target}
                      className={`rounded border px-3 py-2 ${hit ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{target}% target</span>
                        <span className={`text-[11px] ${hit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {hit ? "✓ HIT" : "✗ MISS"}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">{formatPercent(stats.roi)}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Cash Flow Schedule</h3>
              <div className="rounded border bg-background overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-3 py-2 font-medium">Year</th>
                      <th className="px-3 py-2 font-medium text-right">Cash Flow</th>
                      <th className="px-3 py-2 font-medium text-right">Cumulative</th>
                      <th className="px-3 py-2 font-medium text-right">Discounted ({input.discountRate.toFixed(1)}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-1.5 font-mono">0</td>
                      <td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">-{formatNumber(stats.initialInvestment)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">-{formatNumber(stats.initialInvestment)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">-{formatNumber(stats.initialInvestment)}</td>
                    </tr>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{row.year}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          <span className={row.cashFlow < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                            {formatNumber(row.cashFlow)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          <span className={row.cumulative < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                            {formatNumber(row.cumulative)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatNumber(row.discounted)}</td>
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
                <TrendingUp className="h-4 w-4" /> Text Report
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
                  filename="roi-analysis.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="roi-analysis.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter an initial investment and cash flows to compute ROI"
          hint="One cash flow per line — each line represents one year. Set a discount rate for NPV and a terminal value if applicable."
          icon={<TrendingUp className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">Init: {formatNumber(h.initialInvestment)}</Badge>
                  <Badge variant="secondary" className="text-[10px]">CF: {formatNumber(h.totalCashFlow)}</Badge>
                  <Badge variant={h.roi >= 0 ? "secondary" : "destructive"} className="text-[10px]">ROI: {formatPercent(h.roi)}</Badge>
                  <Badge variant="outline" className="text-[10px]">NPV: {formatNumber(h.npv)}</Badge>
                  <Badge variant="outline" className="text-[10px]">IRR: {formatPercent(h.irr)}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All ROI, NPV and IRR calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
