"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculatePaymentPlan, formatCurrency, scheduleToCsv, type PaymentPlanInput, type PaymentPlanResult } from "./logic";

export default function PaymentPlanCalc() {
  const [totalAmount, setTotalAmount] = useState("5000");
  const [months, setMonths] = useState("12");
  const [annualRatePct, setAnnualRatePct] = useState("0");
  const [result, setResult] = useState<PaymentPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input: PaymentPlanInput = {
      totalAmount: Number(totalAmount),
      months: Number(months),
      annualRatePct: Number(annualRatePct),
    };
    const r = calculatePaymentPlan(input);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [totalAmount, months, annualRatePct]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Total amount</Label>
              <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Months</Label>
              <Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Annual rate (%)</Label>
              <Input type="number" step="0.1" value={annualRatePct} onChange={(e) => setAnnualRatePct(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setTotalAmount("5000"); setMonths("12"); setAnnualRatePct("0"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Monthly payment</p><p className="text-xl font-bold text-primary">{formatCurrency(result.monthlyPayment)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total paid</p><p className="text-xl font-bold">{formatCurrency(result.totalPaid)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total interest</p><p className="text-xl font-bold text-amber-500">{formatCurrency(result.totalInterest)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Months</p><p className="text-xl font-bold">{result.months}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Payment schedule</CardTitle>
                <DownloadButton getText={() => scheduleToCsv(result.schedule)} filename="payment-plan.csv" mime="text/csv" />
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
