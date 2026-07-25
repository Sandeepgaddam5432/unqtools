"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { projectCashFlow, applyGrowth, computeRunway, formatMoney, defaultMonths, type MonthlyEntry } from "./logic";

export default function CashFlowProjector() {
  const [text, setText] = useState(() => defaultMonths().map((m) => `${m.month},${m.income},${m.expenses}`).join("\n"));
  const [startingBalance, setStartingBalance] = useState(2000);
  const [useGrowth, setUseGrowth] = useState(false);
  const [baseIncome, setBaseIncome] = useState(5000);
  const [baseExpenses, setBaseExpenses] = useState(4000);
  const [incomeGrowth, setIncomeGrowth] = useState(5);
  const [expenseInflation, setExpenseInflation] = useState(3);
  const [numMonths, setNumMonths] = useState(6);

  const months = useMemo<MonthlyEntry[]>(() => {
    if (useGrowth) return applyGrowth({ income: baseIncome, expenses: baseExpenses }, incomeGrowth, expenseInflation, numMonths);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const [month, income, expenses] = line.split(/[,\t]/).map((s) => s.trim());
      return { month: month ?? "", income: parseFloat(income ?? "0") || 0, expenses: parseFloat(expenses ?? "0") || 0 };
    });
  }, [text, useGrowth, baseIncome, baseExpenses, incomeGrowth, expenseInflation, numMonths]);

  const result = useMemo(() => projectCashFlow(months, startingBalance), [months, startingBalance]);
  const runway = useMemo(() => computeRunway(months, startingBalance), [months, startingBalance]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseGrowth(false)}
              className={`px-3 py-1 text-xs rounded-md border cursor-pointer ${!useGrowth ? "border-primary bg-primary/10" : "border-border bg-muted/40"}`}
            >
              Manual entry
            </button>
            <button
              type="button"
              onClick={() => setUseGrowth(true)}
              className={`px-3 py-1 text-xs rounded-md border cursor-pointer ${useGrowth ? "border-primary bg-primary/10" : "border-border bg-muted/40"}`}
            >
              Growth model
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Starting balance</Label>
            <Input type="number" value={startingBalance} onChange={(e) => setStartingBalance(parseFloat(e.target.value) || 0)} className="text-sm font-mono" />
          </div>
          {!useGrowth ? (
            <div className="space-y-1">
              <Label htmlFor="cf-text" className="text-xs text-muted-foreground">Months (month,income,expenses per line)</Label>
              <Textarea
                id="cf-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Base income" value={baseIncome} onChange={setBaseIncome} />
              <Field label="Base expenses" value={baseExpenses} onChange={setBaseExpenses} />
              <Field label="Months" value={numMonths} onChange={setNumMonths} />
              <Field label="Income growth %" value={incomeGrowth} onChange={setIncomeGrowth} />
              <Field label="Expense inflation %" value={expenseInflation} onChange={setExpenseInflation} />
            </div>
          )}
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Invalid input"} />}

      {result?.isValid && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Total income: {formatMoney(result.totalIncome)}</Badge>
                <Badge variant="outline" className="text-xs">Total expenses: {formatMoney(result.totalExpenses)}</Badge>
                <Badge variant="outline" className={`text-xs ${result.totalNet >= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                  Net: {formatMoney(result.totalNet)}
                </Badge>
                <Badge variant="outline" className="text-xs">Peak: {formatMoney(result.peakBalance)}</Badge>
                <Badge variant="outline" className="text-xs">Lowest: {formatMoney(result.lowestBalance)} ({result.lowestMonth})</Badge>
                {runway !== null && (
                  <Badge variant="outline" className="text-xs border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
                    Runway: {runway} month(s)
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Monthly projection</Label>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-2 text-[10px] text-muted-foreground px-1">
                  <span>Month</span><span>Income</span><span>Expenses</span><span>Net</span><span>Cumulative</span>
                </div>
                {result.months.map((m, i) => {
                  const net = result.netPerMonth[i];
                  const cum = result.cumulative[i];
                  return (
                    <div key={i} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                      <span className="font-medium">{m.month}</span>
                      <code className="font-mono">{formatMoney(m.income)}</code>
                      <code className="font-mono">{formatMoney(m.expenses)}</code>
                      <code className={`font-mono ${net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{formatMoney(net)}</code>
                      <code className={`font-mono ${cum >= 0 ? "" : "text-red-700 dark:text-red-400"}`}>{formatMoney(cum)}</code>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState title="Enter monthly data" hint="Project income vs expenses, see net cash flow, cumulative balance, peak, low, and runway." />
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="text-sm font-mono" />
    </div>
  );
}
