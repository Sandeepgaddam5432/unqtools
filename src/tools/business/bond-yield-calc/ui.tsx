"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planBond, planBatch, renderBatchCsv, renderReport, getBondPresets, formatCurrency, formatPct,
  macaulayDuration, modifiedDuration, type BondInput,
} from "./logic";

export default function BondYieldCalc() {
  const presets = useMemo(() => getBondPresets(), []);
  const [parValue, setParValue] = useState(1000);
  const [couponRate, setCouponRate] = useState(0.05);
  const [yearsToMaturity, setYearsToMaturity] = useState(10);
  const [marketPrice, setMarketPrice] = useState(95);
  const [priceIsPercent, setPriceIsPercent] = useState(true);
  const [frequency, setFrequency] = useState<1 | 2 | 4 | 12>(2);
  const [error, setError] = useState<string | null>(null);

  const input: BondInput = useMemo(() => ({
    parValue, couponRate, yearsToMaturity, marketPrice, priceIsPercent, frequency,
  }), [parValue, couponRate, yearsToMaturity, marketPrice, priceIsPercent, frequency]);

  const result = useMemo(() => planBond(input), [input]);

  const macDur = useMemo(() => macaulayDuration(parValue, parValue * couponRate / frequency, result.ytm / frequency, yearsToMaturity * frequency, frequency), [result, parValue, couponRate, frequency, yearsToMaturity]);
  const modDur = useMemo(() => modifiedDuration(macDur, result.ytm / frequency, frequency), [macDur, result, frequency]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setParValue(p.parValue);
    setCouponRate(p.couponRate);
    setYearsToMaturity(p.yearsToMaturity);
    setMarketPrice(p.marketPrice);
    setPriceIsPercent(p.priceIsPercent);
    setFrequency(p.frequency);
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([input, { ...input, marketPrice: marketPrice + 10 }, { ...input, yearsToMaturity: yearsToMaturity + 5 }]); } catch (e) { setError(String(e)); }
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
            <Field label="Par value ($)"><input type="number" value={parValue} onChange={(e) => setParValue(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label={`Coupon rate: ${(couponRate * 100).toFixed(3)}%`}><input type="range" min={0} max={0.2} step={0.001} value={couponRate} onChange={(e) => setCouponRate(parseFloat(e.target.value))} className="w-full cursor-pointer" /></Field>
            <Field label={`Years to maturity: ${yearsToMaturity}`}><input type="range" min={1} max={50} value={yearsToMaturity} onChange={(e) => setYearsToMaturity(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label="Market price"><input type="number" value={marketPrice} onChange={(e) => setMarketPrice(parseFloat(e.target.value) || 0)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Price mode"><select value={priceIsPercent ? "percent" : "absolute"} onChange={(e) => setPriceIsPercent(e.target.value === "percent")} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="percent">Percent of par</option><option value="absolute">Absolute $</option></select></Field>
            <Field label="Frequency"><select value={String(frequency)} onChange={(e) => setFrequency(Number(e.target.value) as 1 | 2 | 4 | 12)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="1">Annual</option><option value="2">Semi-annual</option><option value="4">Quarterly</option><option value="12">Monthly</option></select></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="bond-yield-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([input]))} filename="bond-yield-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 scenarios)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Bond yield results</Label>
            <Badge variant="outline" className={`text-xs ${
              result.tradingStatus === "premium" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : result.tradingStatus === "discount" ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
              : "border-blue-500/30 text-blue-700 dark:text-blue-400"
            }`}>{result.tradingStatus}</Badge>
          </div>
          <Row label="Market price" value={formatCurrency(result.marketPriceDollars) + ` (${(result.marketPriceDollars / parValue * 100).toFixed(2)}% of par)`} />
          <Row label="Annual coupon" value={formatCurrency(result.annualCoupon)} />
          <Row label="Coupon payment (per period)" value={formatCurrency(result.couponPayment)} />
          <Row label="Current yield" value={formatPct(result.currentYield)} />
          <Row label="Yield to maturity (YTM)" value={formatPct(result.ytm)} />
          <Row label="Macaulay duration" value={`${macDur.toFixed(2)} years`} />
          <Row label="Modified duration" value={`${modDur.toFixed(2)} years`} />
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Price–yield curve</Label>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead><tr className="text-muted-foreground"><th className="text-right p-1">Price ($)</th><th className="text-right p-1">Price (% of par)</th><th className="text-right p-1">YTM</th></tr></thead>
              <tbody>
                {result.yieldCurve.filter((_, i) => i % 2 === 0).map((row) => (
                  <tr key={row.price} className="border-t border-border/40">
                    <td className="p-1 text-right font-mono">{formatCurrency(row.price)}</td>
                    <td className="p-1 text-right font-mono">{((row.price / parValue) * 100).toFixed(1)}%</td>
                    <td className="p-1 text-right font-mono">{formatPct(row.yield)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
