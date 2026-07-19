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
  PRESET_EXAMPLES,
  FREQUENCY_LABELS,
  computeLoan,
  computeSavings,
  yearByYearSummary,
  formatNumber,
  formatPercent,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LoanInput,
  type PaymentFrequency,
  type LoanHistoryEntry,
} from "./logic";
import { History, Landmark, AlertTriangle } from "lucide-react";

const DEFAULT_INPUT: LoanInput = {
  loanAmount: 250000,
  annualInterestRate: 6.5,
  loanTermYears: 30,
  startDate: "2024-01-01",
  paymentFrequency: "monthly",
  extraPayment: 0,
};

const FREQUENCIES: PaymentFrequency[] = ["monthly", "bi-weekly", "weekly"];

export default function LoanAmortizationSchedule() {
  const [input, setInput] = useState<LoanInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<LoanHistoryEntry[]>([]);
  const [scheduleLimit, setScheduleLimit] = useState(60); // show first N rows by default

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => computeLoan(input), [input]);
  const savings = useMemo(
    () => (input.extraPayment > 0 && result.valid ? computeSavings(input) : undefined),
    [input, result.valid],
  );
  const stats = useMemo(() => summaryStats(result, savings), [result, savings]);
  const yby = useMemo(() => (result.valid ? yearByYearSummary(result.schedule) : []), [result]);
  const text = useMemo(() => renderText(input, result), [input, result]);
  const csv = useMemo(() => renderCsv(input, result), [input, result]);

  const update = useCallback((patch: Partial<LoanInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.valid) {
      saveHistory({
        ts: Date.now(),
        loanAmount: result.loanAmount,
        annualInterestRate: result.annualInterestRate,
        loanTermYears: result.loanTermYears,
        paymentFrequency: result.paymentFrequency,
        payment: result.payment,
        totalInterest: result.totalInterest,
        extraPayment: result.extraPayment,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput({
      loanAmount: 0,
      annualInterestRate: 0,
      loanTermYears: 0,
      startDate: "",
      paymentFrequency: "monthly",
      extraPayment: 0,
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasInput = input.loanAmount > 0 && input.loanTermYears > 0 && input.startDate !== "";
  const visibleSchedule = result.schedule.slice(0, scheduleLimit);
  const hasMore = result.schedule.length > scheduleLimit;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="la-amt">Loan amount</Label>
              <Input
                id="la-amt"
                type="number"
                min="0"
                step="0.01"
                value={input.loanAmount || ""}
                onChange={(e) => update({ loanAmount: Number(e.target.value) || 0 })}
                placeholder="250000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="la-rate">Annual interest rate (%)</Label>
              <Input
                id="la-rate"
                type="number"
                min="0"
                step="0.01"
                value={input.annualInterestRate || ""}
                onChange={(e) => update({ annualInterestRate: Number(e.target.value) || 0 })}
                placeholder="6.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="la-years">Loan term (years)</Label>
              <Input
                id="la-years"
                type="number"
                min="1"
                step="1"
                value={input.loanTermYears || ""}
                onChange={(e) => update({ loanTermYears: Number(e.target.value) || 0 })}
                placeholder="30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="la-start">Start date</Label>
              <Input
                id="la-start"
                type="date"
                value={input.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="la-freq">Payment frequency</Label>
              <select
                id="la-freq"
                value={input.paymentFrequency}
                onChange={(e) => update({ paymentFrequency: e.target.value as PaymentFrequency })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="la-extra">Extra payment per period (optional)</Label>
              <Input
                id="la-extra"
                type="number"
                min="0"
                step="0.01"
                value={input.extraPayment || ""}
                onChange={(e) => update({ extraPayment: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {PRESET_EXAMPLES.map((p) => (
                <Button
                  key={p.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setInput(p.input)}
                >{p.name}</Button>
              ))}
            </div>
          </div>
          {!result.valid && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {e}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          {result.valid && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Landmark className="h-4 w-4" /> Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Periodic payment" value={formatNumber(stats.payment)} />
                  <Stat label="Total interest" value={formatNumber(stats.totalInterest)} />
                  <Stat label="Total paid" value={formatNumber(stats.totalPaid)} />
                  <Stat label="Payoff date" value={stats.payoffDate ?? "—"} />
                  <Stat label="Payments made" value={`${stats.actualPayments} / ${stats.totalPayments}`} />
                  <Stat label="Frequency" value={FREQUENCY_LABELS[input.paymentFrequency].split(" ")[0]} />
                  {savings && (
                    <>
                      <Stat
                        label="Interest saved"
                        value={formatNumber(savings.interestSavings)}
                        highlight={savings.interestSavings > 0 ? "good" : undefined}
                      />
                      <Stat
                        label="Time saved"
                        value={`~${savings.monthsSaved} mo`}
                        highlight={savings.monthsSaved > 0 ? "good" : undefined}
                      />
                    </>
                  )}
                </div>
                {savings && savings.interestSavings > 0 && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                    Adding <strong>{formatNumber(input.extraPayment)}</strong> per {FREQUENCY_LABELS[input.paymentFrequency].split(" ")[0].toLowerCase()} payment saves you{" "}
                    <strong>{formatNumber(savings.interestSavings)}</strong> in interest and pays off the loan{" "}
                    <strong>~{savings.monthsSaved} months</strong> earlier ({savings.withExtra.payoffDate} vs {savings.withoutExtra.payoffDate}).
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {result.valid && yby.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Year-by-Year Summary</h3>
                <div className="rounded border bg-background overflow-auto max-h-[280px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/30 text-left">
                        <th className="px-3 py-2 font-medium">Year</th>
                        <th className="px-3 py-2 font-medium text-right"># Pmts</th>
                        <th className="px-3 py-2 font-medium text-right">Total Paid</th>
                        <th className="px-3 py-2 font-medium text-right">Principal</th>
                        <th className="px-3 py-2 font-medium text-right">Interest</th>
                        <th className="px-3 py-2 font-medium text-right">End Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yby.map((y, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 font-mono">{y.year}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{y.paymentCount}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{formatNumber(y.totalPayment)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatNumber(y.totalPrincipal)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">{formatNumber(y.totalInterest)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{formatNumber(y.endingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {result.valid && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Full Schedule ({result.schedule.length} payments)</h3>
                  {hasMore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScheduleLimit((n) => n + 60)}
                    >Show more (+60)</Button>
                  )}
                </div>
                <div className="rounded border bg-background overflow-auto max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/30 text-left">
                        <th className="px-2 py-2 font-medium">#</th>
                        <th className="px-2 py-2 font-medium">Date</th>
                        <th className="px-2 py-2 font-medium text-right">Payment</th>
                        <th className="px-2 py-2 font-medium text-right">Extra</th>
                        <th className="px-2 py-2 font-medium text-right">Principal</th>
                        <th className="px-2 py-2 font-medium text-right">Interest</th>
                        <th className="px-2 py-2 font-medium text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSchedule.map((row) => (
                        <tr key={row.paymentNumber} className="border-t">
                          <td className="px-2 py-1.5 font-mono">{row.paymentNumber}</td>
                          <td className="px-2 py-1.5 font-mono">{row.date}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{formatNumber(row.payment)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {row.extraPayment > 0 ? formatNumber(row.extraPayment) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatNumber(row.principal)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-red-600 dark:text-red-400">{formatNumber(row.interest)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{formatNumber(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMore && (
                  <div className="text-[10px] text-muted-foreground">
                    Showing {visibleSchedule.length} of {result.schedule.length} payments.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Landmark className="h-4 w-4" /> Text Schedule
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                  disabled={!result.valid}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="loan-amortization.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="loan-amortization.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter loan amount, rate, term, and start date to build a schedule"
          hint="Pick monthly, bi-weekly, or weekly frequency. Add an extra payment per period to see interest savings and earlier payoff."
          icon={<Landmark className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">Loan: {formatNumber(h.loanAmount)}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">{formatPercent(h.annualInterestRate)}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">{h.loanTermYears}y</Badge>
                  <Badge variant="outline" className="text-[10px]">{FREQUENCY_LABELS[h.paymentFrequency].split(" ")[0]}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Pmt: {formatNumber(h.payment)}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Interest: {formatNumber(h.totalInterest)}</Badge>
                  {h.extraPayment > 0 && (
                    <Badge variant="outline" className="text-[10px]">Extra: {formatNumber(h.extraPayment)}</Badge>
                  )}
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All amortization calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
