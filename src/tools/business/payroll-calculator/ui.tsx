"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  PAY_FREQUENCIES,
  EMPLOYEE_TYPES,
  PAY_FREQUENCY_LABELS,
  EMPLOYEE_TYPE_LABELS,
  PAY_PERIODS_PER_YEAR,
  CURRENCY_SYMBOLS,
  DEFAULT_INPUT,
  computePayroll,
  summaryStats,
  formatCurrency,
  formatPercent,
  renderText,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PayrollInput,
  type PayFrequency,
  type EmployeeType,
  type CurrencySymbol,
  type PayrollHistoryEntry,
} from "./logic";
import { History, Wallet, FileText, Printer, User } from "lucide-react";

export default function PayrollCalculator() {
  const [input, setInput] = useState<PayrollInput>({ ...DEFAULT_INPUT });
  const [currency, setCurrency] = useState<CurrencySymbol>("$");
  const [history, setHistory] = useState<PayrollHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const { input: parsed, currency: parsedCurrency } = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        if (parsedCurrency) setCurrency(parsedCurrency);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => computePayroll(input, currency), [input, currency]);
  const stats = useMemo(() => summaryStats(result), [result]);
  const text = useMemo(() => renderText(result), [result]);
  const html = useMemo(() => renderHtml(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const update = useCallback((patch: Partial<PayrollInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (stats.gross > 0) {
      saveHistory({
        ts: Date.now(),
        employeeName: result.employeeName,
        payFrequency: result.payFrequency,
        employeeType: result.employeeType,
        grossPay: stats.gross,
        totalDeductions: stats.totalDeductions,
        netPay: stats.net,
        currencySymbol: currency,
        payPeriod: result.payPeriod,
      });
      setHistory(loadHistory());
    }
  }, [stats, result, currency]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    setCurrency("$");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const isHourly = input.employeeType === "hourly";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc-name"><User className="inline h-3 w-3 mr-1" />Employee name</Label>
              <Input
                id="pc-name"
                value={input.employeeName}
                onChange={(e) => update({ employeeName: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-type">Employee type</Label>
              <select
                id="pc-type"
                value={input.employeeType}
                onChange={(e) => update({ employeeType: e.target.value as EmployeeType })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {EMPLOYEE_TYPES.map((t) => (
                  <option key={t} value={t}>{EMPLOYEE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-freq">Pay frequency</Label>
              <select
                id="pc-freq"
                value={input.payFrequency}
                onChange={(e) => update({ payFrequency: e.target.value as PayFrequency })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAY_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{PAY_FREQUENCY_LABELS[f]} ({PAY_PERIODS_PER_YEAR[f]}/yr)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc-period">Pay period date</Label>
              <Input
                id="pc-period"
                type="date"
                value={input.payPeriod}
                onChange={(e) => update({ payPeriod: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-pn">Period # (for YTD)</Label>
              <Input
                id="pc-pn"
                type="number"
                min="1"
                max={PAY_PERIODS_PER_YEAR[input.payFrequency]}
                value={input.periodNumber}
                onChange={(e) => update({ periodNumber: Number(e.target.value) })}
              />
              <div className="text-[11px] text-muted-foreground">
                Range 1 – {PAY_PERIODS_PER_YEAR[input.payFrequency]}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-currency">Currency</Label>
              <select
                id="pc-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencySymbol)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCY_SYMBOLS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {isHourly ? (
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pc-rate">Hourly rate</Label>
                <Input
                  id="pc-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.hourlyRate}
                  onChange={(e) => update({ hourlyRate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-hours">Hours worked</Label>
                <Input
                  id="pc-hours"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.hoursWorked}
                  onChange={(e) => update({ hoursWorked: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-ot">Overtime hours</Label>
                <Input
                  id="pc-ot"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.overtimeHours}
                  onChange={(e) => update({ overtimeHours: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-otr">OT rate (×)</Label>
                <Input
                  id="pc-otr"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.overtimeRate}
                  onChange={(e) => update({ overtimeRate: Number(e.target.value) })}
                />
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pc-salary">Annual salary</Label>
                <Input
                  id="pc-salary"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.annualSalary}
                  onChange={(e) => update({ annualSalary: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5 flex items-end">
                <div className="text-xs text-muted-foreground">
                  Per period: <span className="font-mono font-medium text-foreground">
                    {formatCurrency(input.annualSalary / PAY_PERIODS_PER_YEAR[input.payFrequency], currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc-fed">Federal tax %</Label>
              <Input
                id="pc-fed"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={input.federalTaxRate}
                onChange={(e) => update({ federalTaxRate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-state">State tax %</Label>
              <Input
                id="pc-state"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={input.stateTaxRate}
                onChange={(e) => update({ stateTaxRate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-401k">401(k) %</Label>
              <Input
                id="pc-401k"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={input.retirementContribution}
                onChange={(e) => update({ retirementContribution: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc-ss">Social Security %</Label>
              <Input
                id="pc-ss"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={input.socialSecurityRate}
                onChange={(e) => update({ socialSecurityRate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-mc">Medicare %</Label>
              <Input
                id="pc-mc"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={input.medicareRate}
                onChange={(e) => update({ medicareRate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-hi">Health insurance (per period)</Label>
              <Input
                id="pc-hi"
                type="number"
                step="0.01"
                min="0"
                value={input.healthInsuranceDeduction}
                onChange={(e) => update({ healthInsuranceDeduction: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {stats.gross > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Wallet className="h-4 w-4" /> Summary — {result.employeeName}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Gross pay" value={formatCurrency(stats.gross, currency)} />
                <Stat label="Total deductions" value={`-${formatCurrency(stats.totalDeductions, currency)}`} highlight="bad" />
                <Stat label="Net pay" value={formatCurrency(stats.net, currency)} highlight="good" />
                <Stat label="Effective tax rate" value={formatPercent(stats.effectiveTaxRate)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <Stat label="YTD gross (est.)" value={formatCurrency(result.ytdGross, currency)} />
                <Stat label="YTD deductions" value={formatCurrency(result.ytdDeductions, currency)} />
                <Stat label="YTD net" value={formatCurrency(result.ytdNet, currency)} highlight="good" />
              </div>
              {isHourly && (
                <div className="text-[11px] text-muted-foreground">
                  Regular: {formatCurrency(result.regularPay, currency)}
                  {stats.hasOvertime && (
                    <span className="ml-3">Overtime: {formatCurrency(result.overtimePay, currency)} ({result.overtimeHours}h × {result.overtimeRate}x)</span>
                  )}
                </div>
              )}

              {result.deductions.length > 0 && (
                <div className="rounded border bg-background overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-left">
                        <th className="px-3 py-2 font-medium">Deduction</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.deductions.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5">{d.component}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">
                            -{formatCurrency(d.amount, currency)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/20">
                        <td className="px-3 py-1.5 font-semibold">Total Deductions</td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                          -{formatCurrency(result.totalDeductions, currency)}
                        </td>
                      </tr>
                      <tr className="border-t bg-emerald-50 dark:bg-emerald-950/20">
                        <td className="px-3 py-2 font-bold">Net Pay</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(result.netPay, currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {result.notes.length > 0 && (
                <div className="space-y-1 rounded border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                  {result.notes.map((n, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-foreground">•</span>
                      <span>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Pay Stub Preview
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[320px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`paystub-${result.employeeName.replace(/\s+/g, "-").toLowerCase()}-${result.payPeriod || "period"}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return html; }}
                  filename={`paystub-${result.employeeName.replace(/\s+/g, "-").toLowerCase()}-${result.payPeriod || "period"}.html`}
                  mime="text/html"
                  label="Download HTML"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename={`payroll-${result.employeeName.replace(/\s+/g, "-").toLowerCase()}-${result.payPeriod || "period"}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, currency); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter pay details to compute payroll"
          hint="Pick employee type (hourly or salaried), fill in rate/hours or annual salary, then add tax/deduction rates. Default rates are US 2024 reference values (verify with HR before filing)."
          icon={<Printer className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{EMPLOYEE_TYPE_LABELS[h.employeeType]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{PAY_FREQUENCY_LABELS[h.payFrequency]}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.employeeName}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{formatCurrency(h.grossPay, h.currencySymbol)} gross</Badge>
                  <Badge variant="secondary" className="text-[10px] text-red-700 dark:text-red-300">-{formatCurrency(h.totalDeductions, h.currencySymbol)} ded</Badge>
                  <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">{formatCurrency(h.netPay, h.currencySymbol)} net</Badge>
                  <span className="text-muted-foreground ml-auto">{h.payPeriod} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All payroll calculation runs 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded. Tax rates are public reference values (US 2024) — verify with a tax/payroll professional before filing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
