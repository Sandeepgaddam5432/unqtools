"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner, CopyButton } from "../../_shared";
import { calculateSimpleInterest, breakdownToCsv, formatMoney, type SiSolveFor } from "./logic";

const SOLVE_OPTIONS: { value: SiSolveFor; label: string; description: string }[] = [
  { value: "si", label: "Interest (SI)", description: "Given P, R, T" },
  { value: "principal", label: "Principal (P)", description: "Given SI, R, T" },
  { value: "rate", label: "Rate (R)", description: "Given SI, P, T" },
  { value: "time", label: "Time (T)", description: "Given SI, P, R" },
];

export default function SimpleInterestCalculator() {
  const [solveFor, setSolveFor] = useState<SiSolveFor>("si");
  const [principal, setPrincipal] = useState("1000");
  const [rate, setRate] = useState("10");
  const [time, setTime] = useState("2");
  const [interest, setInterest] = useState("100");
  const [compoundFreq, setCompoundFreq] = useState("0");
  const [inflationRate, setInflationRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [result, setResult] = useState<ReturnType<typeof calculateSimpleInterest> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const r = calculateSimpleInterest({
      solveFor,
      principal: solveFor !== "principal" ? Number(principal) : undefined,
      rate: solveFor !== "rate" ? Number(rate) : undefined,
      time: solveFor !== "time" ? Number(time) : undefined,
      interest: solveFor !== "si" ? Number(interest) : undefined,
      compoundFreq: Number(compoundFreq) > 0 ? Number(compoundFreq) : undefined,
      inflationRate: inflationRate ? Number(inflationRate) : undefined,
    });
    if ("error" in r) { setError(r.error); setResult(null); } else { setResult(r); setError(null); }
  }, [solveFor, principal, rate, time, interest, compoundFreq, inflationRate]);

  const fmt = (n: number) => formatMoney(n, currency);
  const showPrincipal = solveFor !== "principal";
  const showRate = solveFor !== "rate";
  const showTime = solveFor !== "time";
  const showInterest = solveFor !== "si";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {SOLVE_OPTIONS.map((o) => (
              <Button key={o.value} size="sm" variant={solveFor === o.value ? "default" : "outline"} onClick={() => setSolveFor(o.value)}>
                {o.label} <span className="text-xs opacity-70 ml-1">({o.description})</span>
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {showPrincipal && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Principal</Label>
                <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </div>
            )}
            {showRate && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Annual rate (%)</Label>
                <Input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            )}
            {showTime && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Time (years)</Label>
                <Input type="number" step="0.5" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            )}
            {showInterest && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Interest</Label>
                <Input type="number" value={interest} onChange={(e) => setInterest(e.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Compound freq (0=off, 1=annual, 12=monthly)</Label>
              <Input type="number" min="0" value={compoundFreq} onChange={(e) => setCompoundFreq(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Inflation rate % (optional)</Label>
              <Input type="number" step="0.1" value={inflationRate} onChange={(e) => setInflationRate(e.target.value)} placeholder="5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["USD","EUR","GBP","INR","JPY","AUD","CAD","CNY","SGD","AED"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setPrincipal("1000"); setRate("10"); setTime("2"); setInterest("100"); setCompoundFreq("1"); setInflationRate("5"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Principal</p>
              <p className="text-xl font-bold">{fmt(result.principal)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Interest (SI)</p>
              <p className="text-xl font-bold text-primary">{fmt(result.interest)}</p>
              <CopyButton getText={() => String(result.interest)} size="icon-sm" />
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total amount</p>
              <p className="text-xl font-bold">{fmt(result.amount)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Solved for</p>
              <p className="text-xl font-bold">{result.solved.toUpperCase()}</p>
              <Badge variant="outline" className="mt-1">
                {result.solved === "si" ? `${result.rate}% × ${result.time}y` : result.solved === "principal" ? `${result.rate}% × ${result.time}y` : result.solved === "rate" ? `${result.principal} × ${result.time}y` : `${result.principal} × ${result.rate}%`}
              </Badge>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Per year</p><p className="font-bold">{fmt(result.perYear)}</p></div>
              <div><p className="text-xs text-muted-foreground">Per month</p><p className="font-bold">{fmt(result.perMonth)}</p></div>
              <div><p className="text-xs text-muted-foreground">Per day</p><p className="font-bold">{fmt(result.perDay)}</p></div>
            </CardContent>
          </Card>

          {result.compoundInterestComparison && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Compound interest comparison (same rate, same time)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">CI interest</p><p className="font-bold">{fmt(result.compoundInterestComparison.interest)}</p></div>
                  <div><p className="text-xs text-muted-foreground">CI amount</p><p className="font-bold">{fmt(result.compoundInterestComparison.amount)}</p></div>
                  <div><p className="text-xs text-muted-foreground">CI - SI difference</p><p className="font-bold text-emerald-500">{fmt(result.compoundInterestComparison.difference)}</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          {result.inflationAdjusted && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Inflation-adjusted future value</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Real value (today's purchasing power)</p><p className="font-bold">{fmt(result.inflationAdjusted.realValue)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Lost to inflation</p><p className="font-bold text-red-500">{fmt(result.inflationAdjusted.lostToInflation)}</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          {result.breakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Yearly breakdown</CardTitle>
                  <DownloadButton getText={() => breakdownToCsv(result.breakdown)} filename="simple-interest-breakdown.csv" mime="text/csv" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80">
                    <tr><th className="p-2 text-left">Period</th><th className="p-2 text-right">Interest</th><th className="p-2 text-right">Cumulative</th><th className="p-2 text-right">Balance</th></tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((b, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{b.period}</td>
                        <td className="p-2 text-right font-mono">{fmt(b.interest)}</td>
                        <td className="p-2 text-right font-mono">{fmt(b.cumulativeInterest)}</td>
                        <td className="p-2 text-right font-mono">{fmt(b.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. No data leaves your browser.</p></CardContent></Card>
    </div>
  );
}
