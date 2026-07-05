"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { calculateMortgage, formatCurrency, mortgageScheduleToCsv, type MortgageInput } from "./logic";

export default function MortgageCalculator() {
  const [homePrice, setHomePrice] = useState("400000");
  const [downPaymentPct, setDownPaymentPct] = useState("20");
  const [annualInterestRatePct, setAnnualInterestRatePct] = useState("7.5");
  const [termYears, setTermYears] = useState("30");
  const [propertyTaxAnnual, setPropertyTaxAnnual] = useState("3600");
  const [homeInsuranceAnnual, setHomeInsuranceAnnual] = useState("1200");
  const [hoaAnnual, setHoaAnnual] = useState("0");
  const [pmiRatePct, setPmiRatePct] = useState("0.5");
  const [extraMonthly, setExtraMonthly] = useState("0");
  const [result, setResult] = useState<ReturnType<typeof calculateMortgage> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const input: MortgageInput = {
      homePrice: Number(homePrice),
      downPaymentPct: Number(downPaymentPct),
      annualInterestRatePct: Number(annualInterestRatePct),
      termYears: Number(termYears),
      propertyTaxAnnual: Number(propertyTaxAnnual) || undefined,
      homeInsuranceAnnual: Number(homeInsuranceAnnual) || undefined,
      hoaAnnual: Number(hoaAnnual) || undefined,
      pmiRatePct: Number(pmiRatePct) || undefined,
      extraMonthly: Number(extraMonthly) || undefined,
    };
    const r = calculateMortgage(input);
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
    }
  }, [homePrice, downPaymentPct, annualInterestRatePct, termYears, propertyTaxAnnual, homeInsuranceAnnual, hoaAnnual, pmiRatePct, extraMonthly]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Home price ($)</Label>
              <Input type="number" aria-label="Home price" value={homePrice} onChange={(e) => setHomePrice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Down payment (%)</Label>
              <Input type="number" aria-label="Down payment percentage" value={downPaymentPct} onChange={(e) => setDownPaymentPct(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Interest rate (%)</Label>
              <Input type="number" step="0.1" aria-label="Interest rate" value={annualInterestRatePct} onChange={(e) => setAnnualInterestRatePct(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Term (years)</Label>
              <Input type="number" aria-label="Term in years" value={termYears} onChange={(e) => setTermYears(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Property tax / yr ($)</Label>
              <Input type="number" aria-label="Annual property tax" value={propertyTaxAnnual} onChange={(e) => setPropertyTaxAnnual(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Insurance / yr ($)</Label>
              <Input type="number" aria-label="Annual home insurance" value={homeInsuranceAnnual} onChange={(e) => setHomeInsuranceAnnual(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">HOA / yr ($)</Label>
              <Input type="number" aria-label="Annual HOA" value={hoaAnnual} onChange={(e) => setHoaAnnual(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">PMI rate (%)</Label>
              <Input type="number" step="0.1" aria-label="PMI rate" value={pmiRatePct} onChange={(e) => setPmiRatePct(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Extra / month ($)</Label>
              <Input type="number" aria-label="Extra monthly payment" value={extraMonthly} onChange={(e) => setExtraMonthly(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
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
                <p className="text-xs text-muted-foreground mb-1">Monthly P&I</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(result.monthlyPI)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Monthly total (PITI+PMI+HOA)</p>
                <p className="text-xl font-bold">{formatCurrency(result.monthlyBreakdown.total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Loan amount</p>
                <p className="text-xl font-bold">{formatCurrency(result.loanAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total interest</p>
                <p className="text-xl font-bold">{formatCurrency(result.totalInterest)}</p>
              </CardContent>
            </Card>
          </div>

          {result.pmiDropMonth && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  PMI drops off at month <strong className="text-foreground">{result.pmiDropMonth}</strong> (78% LTV). Total PMI paid: {formatCurrency(result.totalPmiPaid)}.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Amortization schedule</CardTitle>
                <DownloadButton getText={() => mortgageScheduleToCsv(result.schedule)} filename="mortgage-schedule.csv" mime="text/csv" />
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
                    {result.schedule.slice(0, 360).map((row) => (
                      <tr key={row.month} className="border-t border-border/50">
                        <td className="p-2">{row.month}</td>
                        <td className="p-2 text-right font-mono">{(row.interest + row.principal + (row.pmi || 0)).toLocaleString()}</td>
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
