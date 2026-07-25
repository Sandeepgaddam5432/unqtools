"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computePayslip,
  renderPayslip,
  formatMoney,
  validatePayslipInput,
  lineItemsToCsv,
  CURRENCIES,
  SAMPLE_BRACKETS,
  type LineItem,
  type Currency,
  type TaxBracket,
} from "./logic";

export default function PayslipGenerator() {
  const [gross, setGross] = useState(5000);
  const [taxRate, setTaxRate] = useState(20);
  const [useBrackets, setUseBrackets] = useState(false);
  const [brackets, setBrackets] = useState<TaxBracket[]>(SAMPLE_BRACKETS.map((b) => ({ ...b })));
  const [deductions, setDeductions] = useState<LineItem[]>([{ name: "Insurance", amount: 200 }]);
  const [allowances, setAllowances] = useState<LineItem[]>([{ name: "Travel", amount: 100 }]);
  const [hoursWorked, setHoursWorked] = useState(40);
  const [overtimeThreshold, setOvertimeThreshold] = useState(40);
  const [overtimeMult, setOvertimeMult] = useState(1.5);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [ytdGross, setYtdGross] = useState(0);
  const [ytdTaxPaid, setYtdTaxPaid] = useState(0);
  const [currency, setCurrency] = useState<Currency>("USD");

  const input = useMemo(() => ({
    grossSalary: gross,
    taxRate: useBrackets ? undefined : taxRate,
    taxBrackets: useBrackets ? brackets : undefined,
    deductions,
    allowances,
    hoursWorked,
    overtimeThreshold,
    overtimeMultiplier: overtimeMult,
    overtimeHours,
    ytdGross: ytdGross || undefined,
    ytdTaxPaid: ytdTaxPaid || undefined,
    currency,
  }), [gross, taxRate, useBrackets, brackets, deductions, allowances, hoursWorked, overtimeThreshold, overtimeMult, overtimeHours, ytdGross, ytdTaxPaid, currency]);

  const validation = useMemo(() => validatePayslipInput(input), [input]);
  const { result, error } = useMemo(() => {
    if ("error" in validation) return { result: null, error: validation.error };
    const r = computePayslip(input);
    if ("error" in r) return { result: null, error: r.error };
    return { result: r, error: null as string | null };
  }, [input, validation]);

  const report = useMemo(() => (result ? renderPayslip(input, result) : ""), [input, result]);

  const updateItem = (kind: "deduction" | "allowance", i: number, field: keyof LineItem, value: string) => {
    const setter = kind === "deduction" ? setDeductions : setAllowances;
    const list = kind === "deduction" ? deductions : allowances;
    const next = [...list];
    next[i] = { ...next[i]!, [field]: field === "amount" ? Number(value) : value };
    setter(next);
  };

  const updateBracket = (i: number, field: keyof TaxBracket, value: string) => {
    const next = [...brackets];
    next[i] = { ...next[i]!, [field]: field === "upTo" ? (value === "Infinity" ? Infinity : Number(value)) : Number(value) };
    setBrackets(next);
  };

  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Gross salary</Label>
              <Input type="number" min={0} value={gross} onChange={(e) => setGross(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 w-full rounded-md border px-2 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={useBrackets} onChange={(e) => setUseBrackets(e.target.checked)} /> Use tax brackets
              </label>
            </div>
          </div>
          {!useBrackets ? (
            <div>
              <Label className="text-xs text-muted-foreground">Flat tax rate (%)</Label>
              <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tax brackets (marginal)</Label>
                <Button size="sm" variant="ghost" onClick={() => setBrackets([...brackets, { upTo: Infinity, rate: 30 }])}>+ Add</Button>
              </div>
              {brackets.map((b, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground w-12">Up to:</span>
                  <Input type="text" value={b.upTo === Infinity ? "Infinity" : String(b.upTo)} onChange={(e) => updateBracket(i, "upTo", e.target.value)} className="w-32" />
                  <span className="text-xs text-muted-foreground">Rate %:</span>
                  <Input type="number" min={0} max={100} value={b.rate} onChange={(e) => updateBracket(i, "rate", e.target.value)} className="w-24" />
                  <Button size="sm" variant="ghost" onClick={() => setBrackets(brackets.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Hours worked</Label>
              <Input type="number" min={0} value={hoursWorked} onChange={(e) => setHoursWorked(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">OT threshold</Label>
              <Input type="number" min={0} value={overtimeThreshold} onChange={(e) => setOvertimeThreshold(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">OT multiplier</Label>
              <Input type="number" step="0.1" min={1} value={overtimeMult} onChange={(e) => setOvertimeMult(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">OT hours (override)</Label>
              <Input type="number" min={0} value={overtimeHours} onChange={(e) => setOvertimeHours(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Deductions</Label><Button size="sm" variant="outline" onClick={() => setDeductions([...deductions, { name: "", amount: 0 }])}>Add</Button></div>
          {deductions.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" placeholder="Name" className="flex-1 rounded-md border px-2 py-1 text-sm" value={d.name} onChange={(e) => updateItem("deduction", i, "name", e.target.value)} />
              <input type="number" placeholder="Amount" className="w-28 rounded-md border px-2 py-1 text-sm" value={d.amount} onChange={(e) => updateItem("deduction", i, "amount", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Allowances</Label><Button size="sm" variant="outline" onClick={() => setAllowances([...allowances, { name: "", amount: 0 }])}>Add</Button></div>
          {allowances.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" placeholder="Name" className="flex-1 rounded-md border px-2 py-1 text-sm" value={a.name} onChange={(e) => updateItem("allowance", i, "name", e.target.value)} />
              <input type="number" placeholder="Amount" className="w-28 rounded-md border px-2 py-1 text-sm" value={a.amount} onChange={(e) => updateItem("allowance", i, "amount", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Year-to-date (optional, 0 = no YTD)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">YTD gross</Label><Input type="number" min={0} value={ytdGross} onChange={(e) => setYtdGross(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">YTD tax paid</Label><Input type="number" min={0} value={ytdTaxPaid} onChange={(e) => setYtdTaxPaid(Number(e.target.value))} /></div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Gross</p><p className="text-lg font-bold">{fmt(result.gross)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Tax ({result.effectiveTaxRate}%)</p><p className="text-lg font-bold text-orange-600">{fmt(result.taxAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Net pay</p><p className="text-lg font-bold text-primary">{fmt(result.net)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Overtime</p><p className="text-lg font-bold">{fmt(result.overtimePay)}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Payslip report</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => report} />
                  <DownloadButton getText={() => report} filename="payslip.txt" />
                  <DownloadButton getText={() => lineItemsToCsv(deductions, "deduction") + "\n" + lineItemsToCsv(allowances, "allowance")} filename="payslip-items.csv" mime="text/csv" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{report}</pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
