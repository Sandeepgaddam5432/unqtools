"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  CURRENCY_PRESETS,
  CATEGORY_PRESETS,
  parseIncomeItems,
  parseExpenseItems,
  computeBudget,
  formatCurrency,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BudgetInput,
  type CurrencySymbol,
  type BudgetHistoryEntry,
} from "./logic";
import { History, Wallet, Calculator } from "lucide-react";

const DEFAULT_INPUT: BudgetInput = {
  monthYear: new Date().toISOString().slice(0, 7),
  incomeItemsText: "Salary,5000\nFreelance,800",
  expenseItemsText: "Housing,1500,1500\nFood,450,500\nEntertainment,200,150\nSavings,500,500",
  savingsGoal: 1000,
  currencySymbol: "$",
};

export default function BudgetPlanner() {
  const [input, setInput] = useState<BudgetInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);

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

  const incomeParsed = useMemo(() => parseIncomeItems(input.incomeItemsText), [input.incomeItemsText]);
  const expenseParsed = useMemo(() => parseExpenseItems(input.expenseItemsText), [input.expenseItemsText]);
  const totals = useMemo(() => computeBudget(input), [input]);
  const stats = useMemo(() => summaryStats(totals), [totals]);
  const text = useMemo(() => renderText(input, totals), [input, totals]);
  const csv = useMemo(() => renderCsv(input, totals), [input, totals]);

  const update = useCallback((patch: Partial<BudgetInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (totals.incomeItems.length > 0 || totals.expenseItems.length > 0) {
      saveHistory({
        ts: Date.now(),
        monthYear: input.monthYear,
        totalIncome: totals.totalIncome,
        totalExpensesActual: totals.totalExpensesActual,
        netIncome: totals.netIncome,
        currencySymbol: input.currencySymbol,
      });
      setHistory(loadHistory());
    }
  }, [totals, input]);

  const handleClear = useCallback(() => {
    setInput({
      ...DEFAULT_INPUT,
      monthYear: new Date().toISOString().slice(0, 7),
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const ft = totals.fiftyThirtyTwenty;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bp-month">Month</Label>
              <Input
                id="bp-month"
                type="month"
                value={input.monthYear}
                onChange={(e) => update({ monthYear: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-goal">Savings goal (optional)</Label>
              <Input
                id="bp-goal"
                type="number"
                min="0"
                step="0.01"
                value={input.savingsGoal || ""}
                onChange={(e) => update({ savingsGoal: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-cur">Currency</Label>
              <select
                id="bp-cur"
                value={input.currencySymbol}
                onChange={(e) => update({ currencySymbol: e.target.value as CurrencySymbol })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCY_PRESETS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-inc">
              Income items — one per line:{" "}
              <code className="font-mono text-[11px]">source,amount</code>
            </Label>
            <Textarea
              id="bp-inc"
              value={input.incomeItemsText}
              onChange={(e) => update({ incomeItemsText: e.target.value })}
              placeholder={"Salary,5000\nFreelance,800"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            {incomeParsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {incomeParsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            {incomeParsed.items.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {incomeParsed.items.length} income source(s)
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-exp">
              Expense items — one per line:{" "}
              <code className="font-mono text-[11px]">category,actual,budgeted</code>{" "}
              <span className="text-muted-foreground">(budgeted optional — defaults to actual)</span>
            </Label>
            <Textarea
              id="bp-exp"
              value={input.expenseItemsText}
              onChange={(e) => update({ expenseItemsText: e.target.value })}
              placeholder={"Housing,1500,1500\nFood,450,500"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {CATEGORY_PRESETS.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => update({
                    expenseItemsText: input.expenseItemsText
                      ? `${input.expenseItemsText}\n${c},0,0`
                      : `${c},0,0`,
                  })}
                >+ {c}</Button>
              ))}
            </div>
            {expenseParsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {expenseParsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            {expenseParsed.items.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {expenseParsed.items.length} expense categor(ies)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {totals.incomeItems.length > 0 || totals.expenseItems.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Income" value={formatCurrency(stats.totalIncome, input.currencySymbol)} />
                <Stat label="Expenses (actual)" value={formatCurrency(stats.totalExpensesActual, input.currencySymbol)} />
                <Stat label="Net income" value={formatCurrency(stats.netIncome, input.currencySymbol)} highlight={stats.netIncome >= 0 ? "good" : "bad"} />
                <Stat label="Savings rate" value={`${stats.savingsRate.toFixed(2)}%`} highlight={stats.savingsRate >= 20 ? "good" : "bad"} />
                <Stat label="Budgeted" value={formatCurrency(stats.totalExpensesBudgeted, input.currencySymbol)} />
                <Stat
                  label="Total variance"
                  value={`${stats.totalVariance >= 0 ? "+" : ""}${formatCurrency(stats.totalVariance, input.currencySymbol)}`}
                  highlight={stats.totalVariance >= 0 ? "good" : "bad"}
                />
                <Stat label="Under budget" value={String(stats.underBudgetCount)} />
                <Stat label="Over budget" value={String(stats.overBudgetCount)} highlight={stats.overBudgetCount > 0 ? "bad" : undefined} />
              </div>
              {stats.savingsGoal > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Savings goal progress</span>
                    <span className={`font-semibold ${stats.savingsGoalProgress >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                      {stats.savingsGoalProgress.toFixed(2)}% of {formatCurrency(stats.savingsGoal, input.currencySymbol)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, stats.savingsGoalProgress))}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">50/30/20 Rule Check</h3>
              <div className="grid sm:grid-cols-3 gap-2 text-xs">
                <FtCard
                  label="Needs"
                  target={ft.needsTarget}
                  actualPct={ft.needsPct}
                  actualAmount={formatCurrency(ft.needsActual, input.currencySymbol)}
                  ok={ft.needsOk}
                />
                <FtCard
                  label="Wants"
                  target={ft.wantsTarget}
                  actualPct={ft.wantsPct}
                  actualAmount={formatCurrency(ft.wantsActual, input.currencySymbol)}
                  ok={ft.wantsOk}
                />
                <FtCard
                  label="Savings"
                  target={ft.savingsTarget}
                  actualPct={ft.savingsPct}
                  actualAmount={formatCurrency(ft.savingsActual, input.currencySymbol)}
                  ok={ft.savingsOk}
                  minNotMax
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Income &amp; Expenses</h3>
              <div className="rounded border bg-background">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium text-right">Actual</th>
                      <th className="px-3 py-2 font-medium text-right">Budgeted</th>
                      <th className="px-3 py-2 font-medium text-right">Variance</th>
                      <th className="px-3 py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.incomeItems.map((it, i) => (
                      <tr key={`inc-${i}`} className="border-t">
                        <td className="px-3 py-1.5">
                          <Badge variant="outline" className="text-[10px] mr-2">Income</Badge>
                          {it.source}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(it.amount, input.currencySymbol)}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                      </tr>
                    ))}
                    {totals.variances.map((v, i) => (
                      <tr key={`exp-${i}`} className="border-t">
                        <td className="px-3 py-1.5">
                          <Badge variant="outline" className="text-[10px] mr-2">Expense</Badge>
                          {v.category}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">-{formatCurrency(v.actual, input.currencySymbol)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(v.budgeted, input.currencySymbol)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          <span className={v.variance > 0 ? "text-emerald-600 dark:text-emerald-400" : v.variance < 0 ? "text-red-600 dark:text-red-400" : ""}>
                            {v.variance > 0 ? "+" : ""}{formatCurrency(v.variance, input.currencySymbol)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Badge
                            variant={v.status === "under" ? "secondary" : v.status === "over" ? "destructive" : "outline"}
                            className="text-[10px]"
                          >
                            {v.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Wallet className="h-4 w-4" /> Text Report
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`budget-${input.monthYear || "report"}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename={`budget-${input.monthYear || "report"}.csv`}
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
          title="Enter income and/or expense items to plan your budget"
          hint="Income: `source,amount`. Expenses: `category,actual,budgeted`. Click a category preset to add it."
          icon={<Wallet className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">{h.monthYear}</Badge>
                  <Badge variant="secondary" className="text-[10px]">In: {formatCurrency(h.totalIncome, h.currencySymbol)}</Badge>
                  <Badge variant="outline" className="text-[10px]">Exp: {formatCurrency(h.totalExpensesActual, h.currencySymbol)}</Badge>
                  <Badge variant={h.netIncome >= 0 ? "secondary" : "destructive"} className="text-[10px]">Net: {formatCurrency(h.netIncome, h.currencySymbol)}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All budget calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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

function FtCard({
  label,
  target,
  actualPct,
  actualAmount,
  ok,
  minNotMax,
}: {
  label: string;
  target: number;
  actualPct: number;
  actualAmount: string;
  ok: boolean;
  minNotMax?: boolean;
}) {
  const color = ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Badge variant={ok ? "secondary" : "destructive"} className="text-[10px]">
          {ok ? "OK" : minNotMax ? "UNDER" : "OVER"}
        </Badge>
      </div>
      <div className="mt-1 text-base font-semibold text-foreground">
        {actualPct.toFixed(1)}%
        <span className="text-[10px] text-muted-foreground font-normal ml-1">/ {target}%</span>
      </div>
      <div className={`text-[11px] ${color}`}>{actualAmount}</div>
      <div className="mt-1.5 h-1.5 rounded bg-muted overflow-hidden">
        <div
          className={`h-full ${ok ? "bg-emerald-500" : "bg-red-500"} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, actualPct))}%` }}
        />
      </div>
    </div>
  );
}
