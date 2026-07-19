"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  SENSITIVITY_OFFSETS,
  PRESET_EXAMPLES,
  computeBreakEven,
  runSensitivity,
  formatNumber,
  formatPercent,
  formatRatio,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BreakEvenInput,
  type BreakEvenHistoryEntry,
} from "./logic";
import { History, Scale, AlertTriangle } from "lucide-react";

const DEFAULT_INPUT: BreakEvenInput = {
  fixedCosts: 10000,
  variableCostPerUnit: 6,
  pricePerUnit: 10,
  expectedSalesUnits: 3000,
  targetProfit: 5000,
};

export default function BreakEvenCalculator() {
  const [input, setInput] = useState<BreakEvenInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<BreakEvenHistoryEntry[]>([]);

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

  const result = useMemo(() => computeBreakEven(input), [input]);
  const stats = useMemo(() => summaryStats(result), [result]);
  const text = useMemo(() => renderText(input, result), [input, result]);
  const csv = useMemo(() => renderCsv(input, result), [input, result]);
  const sensitivity = useMemo(() => runSensitivity(input), [input]);

  const update = useCallback((patch: Partial<BreakEvenInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.valid) {
      saveHistory({
        ts: Date.now(),
        fixedCosts: result.fixedCosts,
        pricePerUnit: result.pricePerUnit,
        variableCostPerUnit: result.variableCostPerUnit,
        breakEvenUnits: result.breakEvenUnits,
        breakEvenRevenue: result.breakEvenRevenue,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput({ fixedCosts: 0, variableCostPerUnit: 0, pricePerUnit: 0, expectedSalesUnits: 0, targetProfit: 0 });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasInput = input.fixedCosts > 0 || input.pricePerUnit > 0 || input.variableCostPerUnit > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="be-fc">Fixed costs (total)</Label>
              <Input
                id="be-fc"
                type="number"
                min="0"
                step="0.01"
                value={input.fixedCosts || ""}
                onChange={(e) => update({ fixedCosts: Number(e.target.value) || 0 })}
                placeholder="10000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-vc">Variable cost per unit</Label>
              <Input
                id="be-vc"
                type="number"
                min="0"
                step="0.01"
                value={input.variableCostPerUnit || ""}
                onChange={(e) => update({ variableCostPerUnit: Number(e.target.value) || 0 })}
                placeholder="6"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-price">Price per unit</Label>
              <Input
                id="be-price"
                type="number"
                min="0"
                step="0.01"
                value={input.pricePerUnit || ""}
                onChange={(e) => update({ pricePerUnit: Number(e.target.value) || 0 })}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-exp">Expected sales units (optional)</Label>
              <Input
                id="be-exp"
                type="number"
                min="0"
                step="1"
                value={input.expectedSalesUnits || ""}
                onChange={(e) => update({ expectedSalesUnits: Number(e.target.value) || 0 })}
                placeholder="3000"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="be-tp">Target profit (optional — units needed to reach)</Label>
              <Input
                id="be-tp"
                type="number"
                min="0"
                step="0.01"
                value={input.targetProfit || ""}
                onChange={(e) => update({ targetProfit: Number(e.target.value) || 0 })}
                placeholder="5000"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {PRESET_EXAMPLES.map((p) => (
                <Button
                  key={p.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setInput(p.input)}
                >{p.name}</Button>
              ))}
            </div>
          </div>
          {!result.valid && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {e}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          {result.valid && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Scale className="h-4 w-4" /> Break-Even Results
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Break-even units" value={formatNumber(stats.breakEvenUnits)} />
                  <Stat label="Break-even revenue" value={formatNumber(stats.breakEvenRevenue)} />
                  <Stat label="CM / unit" value={formatNumber(stats.contributionMarginPerUnit)} />
                  <Stat label="CM ratio" value={formatRatio(stats.contributionMarginRatio)} />
                  {stats.marginOfSafetyUnits !== null && (
                    <Stat
                      label="Margin of safety (units)"
                      value={formatNumber(stats.marginOfSafetyUnits)}
                      highlight={stats.marginOfSafetyUnits >= 0 ? "good" : "bad"}
                    />
                  )}
                  {stats.marginOfSafetyPct !== null && (
                    <Stat
                      label="Margin of safety (%)"
                      value={formatPercent(stats.marginOfSafetyPct)}
                      highlight={stats.marginOfSafetyPct >= 0 ? "good" : "bad"}
                    />
                  )}
                  {stats.profitAtExpected !== null && (
                    <Stat
                      label="Profit at expected"
                      value={formatNumber(stats.profitAtExpected)}
                      highlight={stats.profitAtExpected >= 0 ? "good" : "bad"}
                    />
                  )}
                  {result.targetProfitUnits !== null && (
                    <Stat label="Units for target" value={formatNumber(result.targetProfitUnits)} />
                  )}
                </div>
                {result.targetProfitRevenue !== null && (
                  <div className="text-[11px] text-muted-foreground">
                    Revenue needed for target profit:{" "}
                    <strong className="text-foreground">{formatNumber(result.targetProfitRevenue)}</strong>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Price Sensitivity Analysis</h3>
              <p className="text-[11px] text-muted-foreground">
                Break-even units &amp; revenue if price is varied by ±10% and ±20% (variable cost held constant).
              </p>
              <div className="rounded border bg-background overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-3 py-2 font-medium">Scenario</th>
                      <th className="px-3 py-2 font-medium text-right">Price</th>
                      <th className="px-3 py-2 font-medium text-right">CM / unit</th>
                      <th className="px-3 py-2 font-medium text-right">Break-even units</th>
                      <th className="px-3 py-2 font-medium text-right">Break-even revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">
                          <Badge variant={row.label === "Base price" ? "secondary" : "outline"} className="text-[10px]">
                            {row.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatNumber(row.pricePerUnit)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {row.valid ? formatNumber(row.contributionMarginPerUnit) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {row.valid ? formatNumber(row.breakEvenUnits) : "n/a"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {row.valid ? formatNumber(row.breakEvenRevenue) : "n/a"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {SENSITIVITY_OFFSETS.length} scenarios computed.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Scale className="h-4 w-4" /> Text Report
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                  disabled={!result.valid}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="break-even-analysis.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="break-even-analysis.csv"
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
          title="Enter costs, price, and volume to compute break-even"
          hint="Fixed costs, variable cost per unit, and price per unit are required. Add expected sales for margin of safety and a target profit for units-to-target."
          icon={<Scale className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">Fixed: {formatNumber(h.fixedCosts)}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">Price: {formatNumber(h.pricePerUnit)}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">VC: {formatNumber(h.variableCostPerUnit)}</Badge>
                  <Badge variant="secondary" className="text-[10px]">BE: {formatNumber(h.breakEvenUnits)} u</Badge>
                  <Badge variant="secondary" className="text-[10px]">Rev: {formatNumber(h.breakEvenRevenue)}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All break-even, contribution margin, and margin of safety calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
