"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planAnnuity, planBatch, renderBatchCsv, renderReport, getAnnuityPresets, getFrequencies,
  formatCurrency, amortizationSchedule, calcPaymentFromPV, type AnnuityInput, type PaymentFrequency,
  type AnnuityType,
} from "./logic";

export default function AnnuityCalculator() {
  const presets = useMemo(() => getAnnuityPresets(), []);
  const freqs = useMemo(() => getFrequencies(), []);
  const [annualRate, setAnnualRate] = useState(0.06);
  const [termYears, setTermYears] = useState(30);
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [type, setType] = useState<AnnuityType>("ordinary");
  const [solveFor, setSolveFor] = useState<"presentValue" | "futureValue" | "paymentAmount">("presentValue");
  const [presentValue, setPresentValue] = useState<number | "">("");
  const [futureValue, setFutureValue] = useState<number | "">("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">(500);
  const [error, setError] = useState<string | null>(null);

  const input: AnnuityInput = useMemo(() => {
    const base: AnnuityInput = { annualRate, termYears, frequency, type };
    if (solveFor === "presentValue" && paymentAmount !== "") base.paymentAmount = Number(paymentAmount);
    if (solveFor === "futureValue" && paymentAmount !== "") base.paymentAmount = Number(paymentAmount);
    if (solveFor === "paymentAmount" && presentValue !== "") base.presentValue = Number(presentValue);
    if (solveFor === "paymentAmount" && futureValue !== "") base.futureValue = Number(futureValue);
    return base;
  }, [annualRate, termYears, frequency, type, solveFor, presentValue, futureValue, paymentAmount]);

  const result = useMemo(() => planAnnuity(input), [input]);

  const schedule = useMemo(() => {
    if (result.presentValue <= 0 || result.paymentAmount <= 0) return [];
    return amortizationSchedule(result.presentValue, result.paymentAmount, result.periodicRate, Math.min(result.totalPeriods, 12));
  }, [result]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setAnnualRate(p.annualRate);
    setTermYears(p.termYears);
    setFrequency(p.frequency);
    setType(p.type);
    if (p.presentValue !== undefined) { setPresentValue(p.presentValue); setPaymentAmount(""); setSolveFor("paymentAmount"); }
    else if (p.futureValue !== undefined) { setFutureValue(p.futureValue); setPaymentAmount(""); setSolveFor("paymentAmount"); }
    else if (p.paymentAmount !== undefined) { setPaymentAmount(p.paymentAmount); setPresentValue(""); setFutureValue(""); setSolveFor("presentValue"); }
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([input, { ...input, annualRate: annualRate * 1.5 }, { ...input, termYears: termYears + 5 }]); } catch (e) { setError(String(e)); }
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
            <Field label="Solve for"><select value={solveFor} onChange={(e) => setSolveFor(e.target.value as "presentValue" | "futureValue" | "paymentAmount")} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="presentValue">Present value</option><option value="futureValue">Future value</option><option value="paymentAmount">Payment amount</option></select></Field>
            <Field label={`Annual rate: ${(annualRate * 100).toFixed(2)}%`}><input type="range" min={0} max={0.3} step={0.001} value={annualRate} onChange={(e) => setAnnualRate(parseFloat(e.target.value))} className="w-full cursor-pointer" /></Field>
            <Field label={`Term (years): ${termYears}`}><input type="range" min={1} max={50} value={termYears} onChange={(e) => setTermYears(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label="Frequency"><select value={frequency} onChange={(e) => setFrequency(e.target.value as PaymentFrequency)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">{freqs.map((f) => <option key={f} value={f}>{f}</option>)}</select></Field>
            <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value as AnnuityType)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="ordinary">Ordinary (end of period)</option><option value="annuity-due">Annuity due (beginning)</option></select></Field>
            <Field label="Payment amount $"><input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={solveFor === "paymentAmount"} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono disabled:opacity-50" /></Field>
            <Field label="Present value $"><input type="number" value={presentValue} onChange={(e) => setPresentValue(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={solveFor === "presentValue"} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono disabled:opacity-50" /></Field>
            <Field label="Future value $"><input type="number" value={futureValue} onChange={(e) => setFutureValue(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={solveFor === "futureValue"} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono disabled:opacity-50" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="annuity-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([input]))} filename="annuity-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 scenarios)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Annuity results</Label>
            <Badge variant="outline" className="text-xs">Solved: {result.solved.field}</Badge>
          </div>
          <Row label="Periods per year" value={String(result.periodsPerYear)} />
          <Row label="Total periods" value={String(result.totalPeriods)} />
          <Row label="Periodic rate" value={`${(result.periodicRate * 100).toFixed(5)}%`} />
          <Row label="Present value" value={formatCurrency(result.presentValue)} />
          <Row label="Future value" value={formatCurrency(result.futureValue)} />
          <Row label="Payment per period" value={formatCurrency(result.paymentAmount)} />
          <Row label="Total payments" value={formatCurrency(result.totalPayments)} />
          <Row label="Total interest" value={formatCurrency(result.totalInterest)} />
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
        </CardContent>
      </Card>

      {schedule.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Amortization schedule (first 12 periods)</Label>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead><tr className="text-muted-foreground"><th className="text-right p-1">Period</th><th className="text-right p-1">Payment</th><th className="text-right p-1">Interest</th><th className="text-right p-1">Principal</th><th className="text-right p-1">Balance</th></tr></thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.period} className="border-t border-border/40">
                      <td className="p-1 text-right font-mono">{row.period}</td>
                      <td className="p-1 text-right font-mono">{formatCurrency(row.payment)}</td>
                      <td className="p-1 text-right font-mono">{formatCurrency(row.interest)}</td>
                      <td className="p-1 text-right font-mono">{formatCurrency(row.principal)}</td>
                      <td className="p-1 text-right font-mono">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="grid grid-cols-[200px_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono break-all">{value}</span></div>);
}
