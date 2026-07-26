"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planBurnRate, planBatch, renderBatchCsv, renderReport, getBurnRatePresets, formatCurrency,
  categorizeRunway, type BurnRateInput,
} from "./logic";

export default function BurnRateCalc() {
  const presets = useMemo(() => getBurnRatePresets(), []);
  const [cashBalance, setCashBalance] = useState(2_000_000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(100_000);
  const [monthlyRevenue, setMonthlyRevenue] = useState(30_000);
  const [historyExpenses, setHistoryExpenses] = useState("80000,90000,100000,110000");
  const [historyRevenue, setHistoryRevenue] = useState("10000,15000,22000,30000");
  const [error, setError] = useState<string | null>(null);

  const input: BurnRateInput = useMemo(() => ({
    cashBalance, monthlyExpenses, monthlyRevenue,
    historicalExpenses: historyExpenses.split(",").map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n)),
    historicalRevenue: historyRevenue.split(",").map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n)),
  }), [cashBalance, monthlyExpenses, monthlyRevenue, historyExpenses, historyRevenue]);

  const result = useMemo(() => planBurnRate(input), [input]);
  const runwayCat = useMemo(() => categorizeRunway(result.runwayMonths), [result.runwayMonths]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setCashBalance(p.cashBalance);
    setMonthlyExpenses(p.monthlyExpenses);
    setMonthlyRevenue(p.monthlyRevenue);
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([input, { ...input, monthlyRevenue: monthlyRevenue * 2 }, { ...input, monthlyExpenses: monthlyExpenses * 1.5 }]); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">Presets:</span>
            {presets.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} className="text-xs text-primary hover:underline cursor-pointer">{p.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Cash balance ($)"><input type="number" value={cashBalance} onChange={(e) => setCashBalance(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Monthly expenses ($)"><input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Monthly revenue ($)"><input type="number" value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Historical expenses (comma-sep)"><input value={historyExpenses} onChange={(e) => setHistoryExpenses(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Historical revenue (comma-sep)"><input value={historyRevenue} onChange={(e) => setHistoryRevenue(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="burn-rate-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([input]))} filename="burn-rate-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 scenarios)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Burn rate summary</Label>
            <Badge variant="outline" className={`text-xs ${
              runwayCat.level === "healthy" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : runwayCat.level === "concerning" ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
              : runwayCat.level === "critical" ? "border-destructive/30 text-destructive"
              : "border-blue-500/30 text-blue-700 dark:text-blue-400"
            }`}>{runwayCat.label}</Badge>
          </div>
          <Row label="Gross burn" value={formatCurrency(result.grossBurn) + " / month"} />
          <Row label="Net burn" value={formatCurrency(result.netBurn) + " / month"} />
          <Row label="Runway" value={Number.isFinite(result.runwayMonths) ? `${result.runwayMonths.toFixed(1)} months` : "infinite (cash-positive)"} />
          <Row label="Cash zero date" value={result.cashZeroDateISO} />
          <Row label="Burn rate (% of cash)" value={`${result.burnRatePercent.toFixed(2)}% / month`} />
          <Row label="Projected runway (with trend)" value={Number.isFinite(result.projectedRunwayMonths) ? `${result.projectedRunwayMonths.toFixed(1)} months` : "infinite"} />
          <Row label="Avg monthly expense (history)" value={formatCurrency(result.avgMonthlyExpense)} />
          <Row label="Avg monthly revenue (history)" value={formatCurrency(result.avgMonthlyRevenue)} />
          <Row label="Expense trend" value={`${result.expenseTrend.toFixed(2)} / month`} />
          <Row label="Revenue trend" value={`${result.revenueTrend.toFixed(2)} / month`} />
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="grid grid-cols-[240px_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono break-all">{value}</span></div>);
}
