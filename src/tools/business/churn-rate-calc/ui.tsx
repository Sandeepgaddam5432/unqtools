"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planChurn, planBatch, renderBatchCsv, renderReport, getChurnPresets, formatPct, formatCurrency,
  categorizeChurn, type ChurnInput,
} from "./logic";

export default function ChurnRateCalc() {
  const presets = useMemo(() => getChurnPresets(), []);
  const [customersStart, setCustomersStart] = useState(100);
  const [customersEnd, setCustomersEnd] = useState(95);
  const [newCustomers, setNewCustomers] = useState(5);
  const [mrrStart, setMrrStart] = useState(10_000);
  const [mrrEnd, setMrrEnd] = useState(9_800);
  const [newMrr, setNewMrr] = useState(500);
  const [expansionMrr, setExpansionMrr] = useState(200);
  const [contractionMrr, setContractionMrr] = useState(100);
  const [churnedMrr, setChurnedMrr] = useState(800);
  const [periodMonths, setPeriodMonths] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const input: ChurnInput = useMemo(() => ({
    customersStart, customersEnd, newCustomers, mrrStart, mrrEnd, newMrr, expansionMrr, contractionMrr, churnedMrr, periodMonths,
  }), [customersStart, customersEnd, newCustomers, mrrStart, mrrEnd, newMrr, expansionMrr, contractionMrr, churnedMrr, periodMonths]);

  const result = useMemo(() => planChurn(input), [input]);
  const churnCat = useMemo(() => categorizeChurn(result.customerChurnRate), [result.customerChurnRate]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPeriodMonths(p.periodMonths);
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([input, { ...input, customersStart: 200 }, { ...input, customersEnd: customersEnd + 10 }]); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">Period presets:</span>
            {presets.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} className="text-xs text-primary hover:underline cursor-pointer">{p.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Customers (start)"><input type="number" value={customersStart} onChange={(e) => setCustomersStart(parseInt(e.target.value, 10) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Customers (end)"><input type="number" value={customersEnd} onChange={(e) => setCustomersEnd(parseInt(e.target.value, 10) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="New customers"><input type="number" value={newCustomers} onChange={(e) => setNewCustomers(parseInt(e.target.value, 10) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="MRR (start) $"><input type="number" value={mrrStart} onChange={(e) => setMrrStart(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="MRR (end) $"><input type="number" value={mrrEnd} onChange={(e) => setMrrEnd(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="New MRR $"><input type="number" value={newMrr} onChange={(e) => setNewMrr(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Expansion MRR $"><input type="number" value={expansionMrr} onChange={(e) => setExpansionMrr(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Contraction MRR $"><input type="number" value={contractionMrr} onChange={(e) => setContractionMrr(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Churned MRR $"><input type="number" value={churnedMrr} onChange={(e) => setChurnedMrr(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Period (months)"><input type="number" step={0.25} value={periodMonths} onChange={(e) => setPeriodMonths(parseFloat(e.target.value) || 1)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="churn-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([input]))} filename="churn-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 scenarios)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Churn summary</Label>
            <Badge variant="outline" className={`text-xs ${
              churnCat.level === "good" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : churnCat.level === "ok" ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
              : "border-destructive/30 text-destructive"
            }`}>{churnCat.label}</Badge>
          </div>
          <Row label="Customer churn rate" value={formatPct(result.customerChurnRate)} />
          <Row label="Net customer churn rate" value={formatPct(result.netCustomerChurnRate)} />
          <Row label="Revenue churn rate (gross)" value={formatPct(result.revenueChurnRate)} />
          <Row label="Net revenue churn rate" value={formatPct(result.netRevenueChurnRate)} />
          <Row label="Lost customers" value={String(result.lostCustomers)} />
          <Row label="Monthly net MRR impact" value={formatCurrency(result.mrrImpact) + " / month"} />
          <Row label="Monthly new MRR" value={formatCurrency(result.monthlyNewMrr)} />
          <Row label="Monthly expansion MRR" value={formatCurrency(result.monthlyExpansionMrr)} />
          <Row label="Monthly contraction MRR" value={formatCurrency(result.monthlyContractionMrr)} />
          <Row label="Monthly churned MRR" value={formatCurrency(result.monthlyChurnedMrr)} />
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
