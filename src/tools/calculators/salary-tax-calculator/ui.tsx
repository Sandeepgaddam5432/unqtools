"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  calculateTax,
  taxBreakdownText,
  taxBreakdownCsv,
  type Jurisdiction,
  type TaxResult,
} from "./logic";

const JURISDICTIONS: { id: Jurisdiction; label: string; currency: string; example: string }[] = [
  { id: "US", label: "United States", currency: "USD", example: "80000" },
  { id: "UK", label: "United Kingdom", currency: "GBP", example: "50000" },
  { id: "IN", label: "India", currency: "INR", example: "1200000" },
];

export default function SalaryTaxCalculator() {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("US");
  const [income, setIncome] = useState("80000");
  const [age, setAge] = useState("");
  const [deductions, setDeductions] = useState("");
  const [result, setResult] = useState<TaxResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = JURISDICTIONS.find((j) => j.id === jurisdiction)!;

  const run = useCallback(() => {
    const r = calculateTax({
      jurisdiction,
      grossIncome: Number(income),
      age: age ? Number(age) : undefined,
      deductions: deductions ? Number(deductions) : 0,
    });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [jurisdiction, income, age, deductions]);

  const sample = useCallback(() => {
    setJurisdiction(meta.id);
    setIncome(meta.example);
    setAge("35");
    setDeductions("");
  }, [meta]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {JURISDICTIONS.map((j) => (
              <Button key={j.id} size="sm" variant={jurisdiction === j.id ? "default" : "outline"} onClick={() => setJurisdiction(j.id)}>{j.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Gross annual income ({meta.currency})</Label>
              <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} aria-label="Gross annual income" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Age (optional)</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Age" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pre-tax deductions ({meta.currency})</Label>
              <Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} aria-label="Pre-tax deductions" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Calculate tax</Button>
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
              <p className="text-xs text-muted-foreground">Gross income</p>
              <p className="text-xl font-bold">{result.currency} {result.grossIncome.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total tax</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{result.currency} {result.totalTax.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Net pay</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{result.currency} {result.netPay.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Effective rate</p>
              <p className="text-xl font-bold">{(result.effectiveRate * 100).toFixed(2)}%</p>
              <Badge variant="outline" className="mt-1">Marginal: {(result.marginalRate * 100).toFixed(0)}%</Badge>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Tax band breakdown</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {result.bands.length === 0 ? (
                <p className="text-sm text-muted-foreground">No income tax due — below taxable threshold.</p>
              ) : result.bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="w-20 justify-center">{b.label}</Badge>
                  <span className="font-mono text-xs flex-1">{b.from.toLocaleString()} – {b.to === null ? "∞" : b.to.toLocaleString()}</span>
                  <Badge variant="secondary" className="w-12 justify-center">{(b.rate * 100).toFixed(0)}%</Badge>
                  <span className="font-bold w-24 text-right">{result.currency} {b.tax.toLocaleString()}</span>
                </div>
              ))}
              {result.socialSecurity > 0 && (
                <div className="flex items-center gap-2 text-sm pt-2 border-t border-border">
                  <Badge variant="outline" className="w-20 justify-center">SS/NI</Badge>
                  <span className="font-mono text-xs flex-1">Social security contributions</span>
                  <span className="font-bold w-24 text-right">{result.currency} {result.socialSecurity.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                {result.notes.map((n, i) => <li key={i}>{n}</li>)}
                <li>Estimates only — confirm with a tax professional before filing.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export breakdown</p>
              <div className="flex gap-2">
                <CopyButton getText={() => taxBreakdownText(result)} label="Copy text" />
                <CopyButton getText={() => taxBreakdownCsv(result)} label="Copy CSV" />
                <DownloadButton getText={() => taxBreakdownCsv(result)} filename="tax-breakdown.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
