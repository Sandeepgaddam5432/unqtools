"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeDepreciation,
  validateInputs,
  exportScheduleCSV,
  exportScheduleText,
  compareMethods,
  bookValueAtYear,
  section179,
  bonusDepreciationPercent,
  taxShield,
  perYearTaxShield,
  type AssetInputs,
  type DepreciationMethod,
} from "./logic";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function DepreciationCalc() {
  const [cost, setCost] = useState<string>("10000");
  const [salvage, setSalvage] = useState<string>("1000");
  const [life, setLife] = useState<string>("5");
  const [method, setMethod] = useState<DepreciationMethod>("straight-line");
  const [decliningRate, setDecliningRate] = useState<string>("2");
  const [macrsClass, setMacrsClass] = useState<string>("5");
  const [taxYear, setTaxYear] = useState<string>("2024");
  const [taxRate, setTaxRate] = useState<string>("25");
  const [error, setError] = useState<string>("");

  const inputs: AssetInputs = {
    cost: Number(cost) || 0,
    salvage: Number(salvage) || 0,
    usefulLifeYears: Number(life) || 1,
    method,
    decliningRate: Number(decliningRate) || 2,
    macrsClass: Number(macrsClass) as 3 | 5 | 7 | 10 | 15 | 20,
  };
  const warnings = useMemo(() => validateInputs(inputs), [cost, salvage, life, method, decliningRate, macrsClass]);
  const result = useMemo(() => computeDepreciation(inputs), [cost, salvage, life, method, decliningRate, macrsClass]);
  const comparison = useMemo(() => compareMethods(inputs), [cost, salvage, life, decliningRate, macrsClass]);
  const shields = useMemo(() => perYearTaxShield(result, (Number(taxRate) || 0) / 100), [result, taxRate]);
  const bonus = bonusDepreciationPercent(Number(taxYear));
  const s179 = section179(inputs.cost);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cost</Label>
              <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Salvage value</Label>
              <input type="number" value={salvage} onChange={(e) => setSalvage(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Useful life (years)</Label>
              <input type="number" value={life} onChange={(e) => setLife(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <select value={method} onChange={(e) => setMethod(e.target.value as DepreciationMethod)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <option value="straight-line">Straight-line</option>
                <option value="declining-balance">Declining balance</option>
                <option value="sum-of-years">Sum-of-years digits</option>
                <option value="macrs">MACRS</option>
              </select>
            </div>
            {method === "declining-balance" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Declining rate (×)</Label>
                <input type="number" step="0.1" value={decliningRate} onChange={(e) => setDecliningRate(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              </div>
            )}
            {method === "macrs" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">MACRS class</Label>
                <select value={macrsClass} onChange={(e) => setMacrsClass(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                  {[3, 5, 7, 10, 15, 20].map((c) => (
                    <option key={c} value={c}>{c}-year</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax rate %</Label>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax year</Label>
              <input type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">{result.method} schedule</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportScheduleText(result)} label="Copy text" />
              <DownloadButton getText={() => exportScheduleCSV(result)} filename={`depreciation-${result.method}.csv`} mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Total depreciation</div>
              <code className="font-mono">{fmt(result.totalDepreciation)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Final book value</div>
              <code className="font-mono">{fmt(result.finalBookValue)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Annual average</div>
              <code className="font-mono">{fmt(result.annualAverage)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Tax shield ({taxRate}%)</div>
              <code className="font-mono text-emerald-600 dark:text-emerald-400">{fmt(taxShield(result, (Number(taxRate) || 0) / 100))}</code>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr] gap-2 text-[10px] uppercase text-muted-foreground pb-1 border-b border-border/40">
              <span>Yr</span>
              <span>Begin BV</span>
              <span>Depreciation</span>
              <span>End BV</span>
              <span>Cumulative</span>
            </div>
            {result.schedule.map((r) => (
              <div key={r.year} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr] gap-2 text-xs py-0.5 border-b border-border/40 last:border-0">
                <code className="font-mono">{r.year}</code>
                <code className="font-mono">{fmt(r.beginningBookValue)}</code>
                <code className="font-mono text-red-600 dark:text-red-400">{fmt(r.depreciation)}</code>
                <code className="font-mono">{fmt(r.endingBookValue)}</code>
                <code className="font-mono">{fmt(r.cumulativeDepreciation)}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Compare all methods</Label>
          <div className="space-y-1">
            {comparison.map((c) => (
              <div key={c.method} className="grid grid-cols-[1fr_120px_120px_120px] gap-2 text-xs py-1 border-b border-border/40 last:border-0 items-center">
                <span className="capitalize">{c.method.replace("-", " ")}</span>
                <code className="font-mono text-right">Y1: {fmt(c.year1Dep)}</code>
                <code className="font-mono text-right">Total: {fmt(c.totalDep)}</code>
                <Badge variant="outline" className="text-[10px] justify-self-end">{fmt(c.finalBV)} BV</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Bonus depreciation &amp; Section 179</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Bonus dep. {taxYear}</div>
              <code className="font-mono">{(bonus * 100).toFixed(0)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Section 179 eligible</div>
              <code className="font-mono">{fmt(s179)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Bonus dep. amount</div>
              <code className="font-mono">{fmt(inputs.cost * bonus)}</code>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <Label className="text-xs text-muted-foreground">Per-year tax shield ({taxRate}%)</Label>
            <div className="space-y-0.5">
              {shields.map((s) => (
                <div key={s.year} className="grid grid-cols-[40px_1fr] gap-2 text-xs">
                  <code className="font-mono">{s.year}</code>
                  <code className="font-mono text-emerald-600 dark:text-emerald-400">{fmt(s.shield)}</code>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Book value at year 3: {fmt(bookValueAtYear(result, 3))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
