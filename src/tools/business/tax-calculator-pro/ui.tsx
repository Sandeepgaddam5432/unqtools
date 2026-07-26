"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllTaxSystems,
  getTaxSystemById,
  computeBreakdown,
  multiYearProjection,
  validateInputs,
  exportBreakdownCSV,
  exportBreakdownText,
  monthlyTakeHome,
  compareSystems,
  effectiveRate,
  type TaxBreakdown,
} from "./logic";

const fmt = (n: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return n.toFixed(0);
  }
};

const fmtPct = (r: number) => `${(r * 100).toFixed(2)}%`;

export default function TaxCalculatorPro() {
  const systems = useMemo(() => getAllTaxSystems(), []);
  const [systemId, setSystemId] = useState<string>("us-2024-single");
  const [gross, setGross] = useState<string>("100000");
  const [extraDed, setExtraDed] = useState<string>("0");
  const [credits, setCredits] = useState<string>("0");
  const [growth, setGrowth] = useState<string>("3");
  const [years, setYears] = useState<string>("5");
  const [error, setError] = useState<string>("");

  const system = getTaxSystemById(systemId)!;
  const grossN = Number(gross) || 0;
  const dedN = Number(extraDed) || 0;
  const credN = Number(credits) || 0;
  const warnings = validateInputs(grossN, dedN, credN);
  const breakdown: TaxBreakdown = useMemo(
    () => computeBreakdown(system, grossN, dedN, credN),
    [system, grossN, dedN, credN],
  );
  const projection = useMemo(
    () => multiYearProjection(system, grossN, Number(years) || 1, (Number(growth) || 0) / 100, dedN, credN),
    [system, grossN, years, growth, dedN, credN],
  );
  const comparison = useMemo(
    () => compareSystems(grossN, systems.map((s) => s.id), dedN, credN),
    [grossN, systems, dedN, credN],
  );

  const currencyMap: Record<string, string> = { US: "USD", UK: "GBP", IN: "INR", AU: "AUD" };
  const currency = currencyMap[system.country] || "USD";

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax system</Label>
              <select value={systemId} onChange={(e) => setSystemId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gross income</Label>
              <input type="number" value={gross} onChange={(e) => setGross(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Extra deductions</Label>
              <input type="number" value={extraDed} onChange={(e) => setExtraDed(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax credits</Label>
              <input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <p className="text-[10px] text-muted-foreground">{system.notes} · Standard deduction: {fmt(system.standardDeduction, currency)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Tax breakdown</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportBreakdownText(breakdown, system.name)} label="Copy text" />
              <DownloadButton getText={() => exportBreakdownCSV(breakdown)} filename={`tax-breakdown-${system.id}.csv`} mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Gross income</div>
              <code className="font-mono">{fmt(breakdown.grossIncome, currency)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Taxable income</div>
              <code className="font-mono">{fmt(breakdown.taxableIncome, currency)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Total tax</div>
              <code className="font-mono text-red-600 dark:text-red-400">{fmt(breakdown.totalTax, currency)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">After-tax income</div>
              <code className="font-mono text-emerald-600 dark:text-emerald-400">{fmt(breakdown.afterTaxIncome, currency)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Monthly take-home</div>
              <code className="font-mono">{fmt(monthlyTakeHome(breakdown), currency)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Effective rate</div>
              <code className="font-mono">{fmtPct(breakdown.effectiveRate)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Marginal rate</div>
              <code className="font-mono">{fmtPct(breakdown.marginalRate)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Credits applied</div>
              <code className="font-mono">{fmt(breakdown.credits, currency)}</code>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <Label className="text-xs text-muted-foreground">Per-bracket breakdown</Label>
            <div className="space-y-0.5">
              {breakdown.perBracket.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_100px] gap-2 text-xs py-0.5">
                  <code className="font-mono text-muted-foreground">{p.range}</code>
                  <code className="font-mono">{(p.rate * 100).toFixed(1)}%</code>
                  <code className="font-mono text-right">{fmt(p.amount, currency)}</code>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Multi-year projection</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Years</Label>
              <input type="number" value={years} onChange={(e) => setYears(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Annual growth %</Label>
              <input type="number" value={growth} onChange={(e) => setGrowth(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            {projection.map((p, i) => (
              <div key={i} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-2 text-xs py-0.5 border-b border-border/40 last:border-0">
                <code className="font-mono">{p.year}</code>
                <code className="font-mono">{fmt(p.income, currency)}</code>
                <code className="font-mono text-red-600 dark:text-red-400">{fmt(p.tax, currency)}</code>
                <code className="font-mono text-emerald-600 dark:text-emerald-400">{fmt(p.afterTax, currency)}</code>
                <Badge variant="outline" className="text-[10px] justify-self-end">{fmtPct(p.effectiveRate)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Compare across systems ({fmt(grossN, currency)} gross)</Label>
          <div className="space-y-1">
            {comparison.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_80px] gap-2 text-xs py-1 border-b border-border/40 last:border-0 items-center">
                <span>{c.system}</span>
                <code className="font-mono text-right">{fmt(c.totalTax, currency)}</code>
                <Badge variant="outline" className="text-[10px] justify-self-end">{fmtPct(c.effectiveRate)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
