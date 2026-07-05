"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { calculateEmi, formatCurrency, scheduleToCsv, type EmiInput } from "./logic";

export default function EmiCalculator() {
  const [principal, setPrincipal] = useState("500000");
  const [annualRatePct, setAnnualRatePct] = useState("9.5");
  const [tenureMonths, setTenureMonths] = useState("60");
  const [recurringExtra, setRecurringExtra] = useState("0");
  const [result, setResult] = useState<ReturnType<typeof calculateEmi> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input: EmiInput = {
      principal: Number(principal),
      annualRatePct: Number(annualRatePct),
      tenureMonths: Number(tenureMonths),
      recurringExtra: Number(recurringExtra) || undefined,
    };
    const r = calculateEmi(input);
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
    }
  }, [principal, annualRatePct, tenureMonths, recurringExtra]);

  const loadSample = useCallback(() => {
    setPrincipal("1000000");
    setAnnualRatePct("9.5");
    setTenureMonths("120");
    setRecurringExtra("2000");
    toast.info("Sample loaded — click Calculate");
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Principal (₹)</Label>
              <Input type="number" aria-label="Principal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="500000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Annual rate (%)</Label>
              <Input type="number" step="0.1" aria-label="Annual rate" value={annualRatePct} onChange={(e) => setAnnualRatePct(e.target.value)} placeholder="9.5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tenure (months)</Label>
              <Input type="number" aria-label="Tenure in months" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} placeholder="60" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Extra / month (₹)</Label>
              <Input type="number" aria-label="Extra per month" value={recurringExtra} onChange={(e) => setRecurringExtra(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button variant="ghost" size="sm" onClick={loadSample}>Sample</Button>
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Monthly EMI</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(result.emi)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total interest</p>
                <p className="text-xl font-bold">{formatCurrency(result.totalInterest)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total payment</p>
                <p className="text-xl font-bold">{formatCurrency(result.totalPayment)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Months / Interest saved</p>
                <p className="text-xl font-bold text-emerald-500">{result.monthsSaved}mo · {formatCurrency(result.interestSaved)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Amortization schedule</CardTitle>
                <DownloadButton
                  getText={() => scheduleToCsv(result.schedule)}
                  filename="emi-schedule.csv"
                  mime="text/csv"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left">
                      <th className="p-2">Month</th>
                      <th className="p-2 text-right">EMI</th>
                      <th className="p-2 text-right">Interest</th>
                      <th className="p-2 text-right">Principal</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.schedule.map((row) => (
                      <tr key={row.month} className="border-t border-border/50">
                        <td className="p-2">{row.month}</td>
                        <td className="p-2 text-right font-mono">{row.emi.toLocaleString()}</td>
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
