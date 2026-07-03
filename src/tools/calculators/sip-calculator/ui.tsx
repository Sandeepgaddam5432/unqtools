"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { calculateSip, formatCurrency, formatCompact, type SipInput } from "./logic";

export default function SipCalculator() {
  const [monthlyInvestment, setMonthlyInvestment] = useState("10000");
  const [annualReturnPct, setAnnualReturnPct] = useState("12");
  const [years, setYears] = useState("10");
  const [stepUpPct, setStepUpPct] = useState("0");
  const [inflationPct, setInflationPct] = useState("0");
  const [result, setResult] = useState<ReturnType<typeof calculateSip> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input: SipInput = {
      monthlyInvestment: Number(monthlyInvestment),
      annualReturnPct: Number(annualReturnPct),
      years: Number(years),
      stepUpPct: Number(stepUpPct) || undefined,
      inflationPct: Number(inflationPct) || undefined,
    };
    const r = calculateSip(input);
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
    }
  }, [monthlyInvestment, annualReturnPct, years, stepUpPct, inflationPct]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Monthly investment (₹)</Label>
              <Input type="number" value={monthlyInvestment} onChange={(e) => setMonthlyInvestment(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Expected return (%)</Label>
              <Input type="number" step="0.1" value={annualReturnPct} onChange={(e) => setAnnualReturnPct(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Duration (years)</Label>
              <Input type="number" value={years} onChange={(e) => setYears(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Annual step-up (%)</Label>
              <Input type="number" step="0.1" value={stepUpPct} onChange={(e) => setStepUpPct(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Inflation (%)</Label>
              <Input type="number" step="0.1" value={inflationPct} onChange={(e) => setInflationPct(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !"error" in result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total invested</p>
                <p className="text-xl font-bold">{formatCurrency(result.totalInvested)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Future value</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(result.futureValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total returns</p>
                <p className="text-xl font-bold text-emerald-500">{formatCurrency(result.totalReturns)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Wealth ratio</p>
                <p className="text-xl font-bold">{result.wealthRatio.toFixed(2)}x</p>
              </CardContent>
            </Card>
          </div>

          {result.realFutureValue && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  Inflation-adjusted (real) value: <strong className="text-foreground">{formatCurrency(result.realFutureValue)}</strong> ({formatCompact(result.realFutureValue)})
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Year-by-year breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left">
                      <th className="p-2">Year</th>
                      <th className="p-2 text-right">Invested</th>
                      <th className="p-2 text-right">Year invest</th>
                      <th className="p-2 text-right">Returns</th>
                      <th className="p-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.yearlyBreakdown.map((row) => (
                      <tr key={row.year} className="border-t border-border/50">
                        <td className="p-2">{row.year}</td>
                        <td className="p-2 text-right font-mono">{formatCompact(row.cumulativeInvested)}</td>
                        <td className="p-2 text-right font-mono">{formatCompact(row.yearlyInvestment)}</td>
                        <td className="p-2 text-right font-mono text-emerald-500">{formatCompact(row.yearlyReturns)}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatCompact(row.endValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
