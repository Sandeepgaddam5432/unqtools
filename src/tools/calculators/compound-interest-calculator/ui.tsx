"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculateCompoundInterest, breakdownToCsv, formatMoney, type CompoundInput, type CompoundingFrequency, type ContributionFrequency } from "./logic";

export default function CompoundInterestCalculator() {
  const [input, setInput] = useState<CompoundInput>({
    principal: 10000,
    annualRatePct: 7,
    years: 10,
    compounding: "monthly",
    contributionAmount: 500,
    contributionFrequency: "monthly",
    contributionAtStart: true,
  });
  const [inflationRate, setInflationRate] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [result, setResult] = useState<ReturnType<typeof calculateCompoundInterest> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    setError(null);
    try {
      const fullInput: CompoundInput = {
        ...input,
        inflationRatePct: inflationRate ? Number(inflationRate) : undefined,
        taxRatePct: taxRate ? Number(taxRate) : undefined,
      };
      const r = calculateCompoundInterest(fullInput);
      if ("error" in r) { setError(r.error); setResult(null); }
      else { setResult(r); }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input, inflationRate, taxRate]);

  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Principal</Label><Input type="number" value={input.principal} onChange={(e) => setInput({ ...input, principal: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Annual rate (%)</Label><Input type="number" step="0.1" value={input.annualRatePct} onChange={(e) => setInput({ ...input, annualRatePct: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Years</Label><Input type="number" value={input.years} onChange={(e) => setInput({ ...input, years: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Compounding</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={input.compounding} onChange={(e) => setInput({ ...input, compounding: e.target.value as CompoundingFrequency })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi-annually">Semi-annually</option>
                <option value="annually">Annually</option>
                <option value="continuously">Continuously</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Contribution (per period)</Label><Input type="number" value={input.contributionAmount ?? ""} onChange={(e) => setInput({ ...input, contributionAmount: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Contribution frequency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={input.contributionFrequency ?? "monthly"} onChange={(e) => setInput({ ...input, contributionFrequency: e.target.value as ContributionFrequency })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Inflation rate % (optional)</Label><Input type="number" step="0.1" value={inflationRate} onChange={(e) => setInflationRate(e.target.value)} placeholder="3" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Tax on interest % (optional)</Label><Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="25" /></div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["USD","EUR","GBP","INR","JPY","AUD","CAD","CNY","SGD","AED"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={input.contributionAtStart ?? false} onChange={(e) => setInput({ ...input, contributionAtStart: e.target.checked })} />
            <span>Contribute at start of period (annuity-due)</span>
          </label>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput({ principal: 10000, annualRatePct: 7, years: 10, compounding: "monthly", contributionAmount: 500, contributionFrequency: "monthly", contributionAtStart: true }); setInflationRate(""); setTaxRate(""); setResult(null); setError(null); }}>Sample</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Final amount</p><p className="text-lg font-bold text-primary">{fmt(result.finalAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total interest</p><p className="text-lg font-bold text-emerald-500">{fmt(result.totalInterest)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total contributions</p><p className="text-lg font-bold">{fmt(result.totalContributions)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Principal</p><p className="text-lg font-bold">{fmt(result.totalPrincipal)}</p></CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Effective annual rate (APY)</p><p className="font-bold">{result.effectiveAnnualRate}%</p></div>
              <div><p className="text-xs text-muted-foreground">Rule of 72 (doubling time)</p><p className="font-bold">{result.ruleOf72Years === Infinity ? "Never (0% rate)" : `${result.ruleOf72Years} years`}</p></div>
              <div><p className="text-xs text-muted-foreground">Simple interest comparison</p><p className="font-bold">{fmt(result.simpleInterestComparison)}</p></div>
              {result.totalTax > 0 && <div><p className="text-xs text-muted-foreground">Tax on interest</p><p className="font-bold text-red-500">{fmt(result.totalTax)}</p></div>}
              {result.totalTax > 0 && <div><p className="text-xs text-muted-foreground">After-tax amount</p><p className="font-bold">{fmt(result.afterTaxAmount)}</p></div>}
              {input.inflationRatePct && <div><p className="text-xs text-muted-foreground">Real value (today's purchasing power)</p><p className="font-bold">{fmt(result.realValue)}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Year-by-year breakdown</CardTitle>
                <DownloadButton getText={() => breakdownToCsv(result.breakdown)} filename="compound-interest-breakdown.csv" mime="text/csv" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Year</th>
                      <th className="p-2 text-right">Start</th>
                      <th className="p-2 text-right">Contributions</th>
                      <th className="p-2 text-right">Interest</th>
                      <th className="p-2 text-right">End</th>
                      {input.inflationRatePct && <th className="p-2 text-right">Real value</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((row) => (
                      <tr key={row.year} className="border-t border-border/50">
                        <td className="p-2">{row.year}</td>
                        <td className="p-2 text-right font-mono">{fmt(row.startBalance)}</td>
                        <td className="p-2 text-right font-mono">{fmt(row.contributions)}</td>
                        <td className="p-2 text-right font-mono text-emerald-500">{fmt(row.interest)}</td>
                        <td className="p-2 text-right font-mono font-bold">{fmt(row.endBalance)}</td>
                        {input.inflationRatePct && <td className="p-2 text-right font-mono text-muted-foreground">{fmt(row.realValue)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. No data leaves your browser.</p></CardContent></Card>
    </div>
  );
}
