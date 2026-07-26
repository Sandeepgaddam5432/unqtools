"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { calculateArr, projectionToCsv, arrSummaryText, type ArrResult } from "./logic";

export default function ArrCalculator() {
  const [mrr, setMrr] = useState("10000");
  const [previousMrr, setPreviousMrr] = useState("8000");
  const [monthsBetween, setMonthsBetween] = useState("12");
  const [monthlyChurnRate, setMonthlyChurnRate] = useState("0.02");
  const [netNewMrrPerMonth, setNetNewMrrPerMonth] = useState("500");
  const [result, setResult] = useState<ArrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = calculateArr({
      mrr: Number(mrr),
      previousMrr: previousMrr ? Number(previousMrr) : undefined,
      monthsBetween: monthsBetween ? Number(monthsBetween) : undefined,
      monthlyChurnRate: monthlyChurnRate ? Number(monthlyChurnRate) : undefined,
      netNewMrrPerMonth: netNewMrrPerMonth ? Number(netNewMrrPerMonth) : undefined,
    });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [mrr, previousMrr, monthsBetween, monthlyChurnRate, netNewMrrPerMonth]);

  const sample = useCallback(() => {
    setMrr("25000"); setPreviousMrr("20000"); setMonthsBetween("12");
    setMonthlyChurnRate("0.03"); setNetNewMrrPerMonth("1500");
  }, []);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  const fmtPct = (n: number | null) => n === null ? "—" : `${(n * 100).toFixed(2)}%`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Current MRR ($)</Label>
              <Input type="number" value={mrr} onChange={(e) => setMrr(e.target.value)} aria-label="Current MRR" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Previous MRR ($) (optional)</Label>
              <Input type="number" value={previousMrr} onChange={(e) => setPreviousMrr(e.target.value)} aria-label="Previous MRR" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Months between (for CAGR)</Label>
              <Input type="number" value={monthsBetween} onChange={(e) => setMonthsBetween(e.target.value)} aria-label="Months between" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Monthly churn rate (0-1)</Label>
              <Input type="number" step="0.01" value={monthlyChurnRate} onChange={(e) => setMonthlyChurnRate(e.target.value)} aria-label="Monthly churn rate" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Net new MRR / month ($)</Label>
              <Input type="number" value={netNewMrrPerMonth} onChange={(e) => setNetNewMrrPerMonth(e.target.value)} aria-label="Net new MRR per month" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">ARR</p>
              <p className="text-2xl font-bold text-primary">${result.arr.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">MRR</p>
              <p className="text-lg font-bold">${result.mrr.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Growth rate</p>
              <p className="text-lg font-bold">{fmtPct(result.growthRate)}</p>
              <Badge variant="outline" className="mt-1">CAGR {fmtPct(result.cagr)}</Badge>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Annual churn</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{fmtPct(result.annualChurnRate)}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">12-month projection</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2">Month</th>
                      <th className="text-right py-2">MRR</th>
                      <th className="text-right py-2">ARR</th>
                      <th className="text-right py-2">Churned ARR (cum.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.projection.map((p) => (
                      <tr key={p.month} className="border-b border-border/50">
                        <td className="py-1.5">Month {p.month}</td>
                        <td className="text-right py-1.5">${p.mrr.toLocaleString()}</td>
                        <td className="text-right py-1.5">${p.arr.toLocaleString()}</td>
                        <td className="text-right py-1.5 text-red-600 dark:text-red-400">${p.churnedArr.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export projection &amp; summary</p>
              <div className="flex gap-2">
                <CopyButton getText={() => arrSummaryText(result)} label="Copy summary" />
                <CopyButton getText={() => projectionToCsv(result)} label="Copy CSV" />
                <DownloadButton getText={() => projectionToCsv(result)} filename="arr-projection.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
