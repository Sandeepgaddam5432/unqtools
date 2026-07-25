"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculateLoanPayoff, formatCurrency, scheduleToCsv, type LoanInput, type PayoffResult } from "./logic";

export default function LoanPayoffCalc() {
  const [principal, setPrincipal] = useState("100000");
  const [annualRatePct, setAnnualRatePct] = useState("6");
  const [tenureMonths, setTenureMonths] = useState("60");
  const [extraMonthly, setExtraMonthly] = useState("0");
  const [lumpMonth, setLumpMonth] = useState("0");
  const [lumpAmount, setLumpAmount] = useState("0");
  const [result, setResult] = useState<PayoffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input: LoanInput = {
      principal: Number(principal),
      annualRatePct: Number(annualRatePct),
      tenureMonths: Number(tenureMonths),
      extraMonthly: Number(extraMonthly) || undefined,
      oneTimePrepayment: Number(lumpAmount) > 0 ? { month: Number(lumpMonth), amount: Number(lumpAmount) } : undefined,
    };
    const r = calculateLoanPayoff(input);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [principal, annualRatePct, tenureMonths, extraMonthly, lumpMonth, lumpAmount]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Principal</Label>
              <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Annual rate (%)</Label>
              <Input type="number" step="0.1" value={annualRatePct} onChange={(e) => setAnnualRatePct(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tenure (months)</Label>
              <Input type="number" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Extra / month</Label>
              <Input type="number" value={extraMonthly} onChange={(e) => setExtraMonthly(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Lump sum month (0=none)</Label>
              <Input type="number" value={lumpMonth} onChange={(e) => setLumpMonth(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Lump sum amount</Label>
              <Input type="number" value={lumpAmount} onChange={(e) => setLumpAmount(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setPrincipal("100000"); setAnnualRatePct("6"); setTenureMonths("60"); setExtraMonthly("100"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Monthly payment</p><p className="text-xl font-bold text-primary">{formatCurrency(result.monthlyPayment)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total interest</p><p className="text-xl font-bold">{formatCurrency(result.totalInterest)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total paid</p><p className="text-xl font-bold">{formatCurrency(result.totalPaid)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Months / interest saved</p><p className="text-xl font-bold text-emerald-500">{result.monthsSaved}mo · {formatCurrency(result.interestSaved)}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Amortization schedule ({result.actualMonths} months)</CardTitle>
                <DownloadButton getText={() => scheduleToCsv(result.schedule)} filename="loan-payoff.csv" mime="text/csv" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left">
                      <th className="p-2">Month</th>
                      <th className="p-2 text-right">Payment</th>
                      <th className="p-2 text-right">Interest</th>
                      <th className="p-2 text-right">Principal</th>
                      <th className="p-2 text-right">Extra</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.schedule.map((row) => (
                      <tr key={row.month} className="border-t border-border/50">
                        <td className="p-2">{row.month}</td>
                        <td className="p-2 text-right font-mono">{row.payment.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono">{row.interest.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono">{row.principal.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-emerald-500">{row.extra > 0 ? row.extra.toLocaleString() : "—"}</td>
                        <td className="p-2 text-right font-mono">{row.balance.toLocaleString()}</td>
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
