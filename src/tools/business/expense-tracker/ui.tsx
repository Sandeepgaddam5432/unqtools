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
  EXPENSE_CATEGORIES,
  DEDUCTIBLE_CATEGORIES,
  DEFAULT_INPUT,
  parseExpenses,
  filterByDateRange,
  computeCategoryTotals,
  sortExpenses,
  summaryStats,
  formatMoney,
  formatPercentage,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExpenseInput,
  type SortOption,
  type HistoryEntry,
} from "./logic";
import { Receipt, History, FileText, AlertCircle, TrendingUp, CalendarDays } from "lucide-react";

const SAMPLE_EXPENSES = `2026-07-13,Travel,Taxi to airport,45.50
2026-07-13,Meals,Client lunch,32.00
2026-07-14,Software,Annual subscription,199.99
2026-07-14,Travel,"Train, return ticket",68.25
2026-07-15,Office,Printer paper,12.49
2026-07-15,Marketing,Facebook ads,150.00
2026-07-16,Meals,Coffee meeting,8.75
2026-07-16,Other,Team gift,25.00`;

export default function ExpenseTracker() {
  const [expensesText, setExpensesText] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_INPUT.currencySymbol);
  const [sort, setSort] = useState<SortOption>("date");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.expensesText) setExpensesText(p.expensesText);
      if (p.dateRangeStart) setDateRangeStart(p.dateRangeStart);
      if (p.dateRangeEnd) setDateRangeEnd(p.dateRangeEnd);
      if (p.currencySymbol) setCurrencySymbol(p.currencySymbol);
      if (p.sort) setSort(p.sort);
      if (p.expensesText || p.dateRangeStart || p.dateRangeEnd) toast.info("Loaded from share link");
    }
  }, []);

  const input: ExpenseInput = useMemo(() => ({
    expensesText,
    dateRangeStart,
    dateRangeEnd,
    currencySymbol,
    sort,
  }), [expensesText, dateRangeStart, dateRangeEnd, currencySymbol, sort]);

  const parsed = useMemo(() => parseExpenses(expensesText), [expensesText]);
  const filtered = useMemo(
    () => filterByDateRange(parsed.expenses, dateRangeStart, dateRangeEnd),
    [parsed.expenses, dateRangeStart, dateRangeEnd],
  );
  const sorted = useMemo(() => sortExpenses(filtered, sort), [filtered, sort]);
  const totals = useMemo(() => computeCategoryTotals(filtered), [filtered]);
  const stats = useMemo(() => summaryStats(filtered), [filtered]);
  const text = useMemo(() => renderText(input, filtered), [input, filtered]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);

  const handleSaveHistory = useCallback(() => {
    if (parsed.expenses.length > 0) {
      saveHistory({
        ts: Date.now(),
        expensesText,
        expenseCount: parsed.expenses.length,
        grandTotal: stats.grandTotal,
        currencySymbol,
      });
      setHistory(loadHistory());
    }
  }, [expensesText, parsed.expenses.length, stats.grandTotal, currencySymbol]);

  const handleClear = useCallback(() => {
    setExpensesText("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrencySymbol(DEFAULT_INPUT.currencySymbol);
    setSort("date");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const appendCategory = (cat: string) => {
    setExpensesText((prev) => {
      const today = new Date().toISOString().slice(0, 10);
      const line = `${today},${cat},,0.00`;
      return prev ? `${prev}\n${line}` : line;
    });
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="et-expenses">Expenses (one per line: date,category,description,amount)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setExpensesText(SAMPLE_EXPENSES)}
              >
                Load sample
              </Button>
            </div>
            <Textarea
              id="et-expenses"
              value={expensesText}
              onChange={(e) => setExpensesText(e.target.value)}
              placeholder={SAMPLE_EXPENSES}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: <code>YYYY-MM-DD,Category,Description,Amount</code>. Wrap descriptions containing commas in double quotes. Lines starting with <code>#</code> are ignored.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Category presets (click to append a starter row)</Label>
            <div className="flex flex-wrap gap-1">
              {EXPENSE_CATEGORIES.map((c) => {
                const ded = DEDUCTIBLE_CATEGORIES.includes(c);
                return (
                  <Button
                    key={c}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => appendCategory(c)}
                  >
                    + {c}
                    {ded && <Badge variant="outline" className="text-[9px] px-1 py-0">ded</Badge>}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="et-from" className="text-xs">From date</Label>
              <Input
                id="et-from"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-to" className="text-xs">To date</Label>
              <Input
                id="et-to"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-cur" className="text-xs">Currency</Label>
              <select
                id="et-cur"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {CURRENCY_PRESETS.map((c) => (
                  <option key={c.code} value={c.symbol}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-sort" className="text-xs">Sort by</Label>
              <select
                id="et-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                <option value="date">Date (ascending)</option>
                <option value="amount-desc">Amount (high to low)</option>
                <option value="category">Category (A–Z)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed.errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4" />
            <span>{parsed.errors.length} line(s) had issues (valid rows still processed)</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 space-y-0.5 max-h-[120px] overflow-auto">
            {parsed.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Expenses" value={String(stats.count)} />
                <Stat label="Grand total" value={formatMoney(stats.grandTotal, currencySymbol)} highlight="good" />
                <Stat label="Categories" value={String(stats.categoryCount)} />
                <Stat label="Avg / category" value={formatMoney(stats.avgPerCategory, currencySymbol)} />
                <Stat label="Unique dates" value={String(stats.uniqueDates)} />
                <Stat label="Daily average" value={formatMoney(stats.dailyAverage, currencySymbol)} />
                <Stat
                  label="Top category"
                  value={stats.topCategory ?? "—"}
                />
                <Stat
                  label="Deductible total"
                  value={formatMoney(stats.deductibleTotal, currencySymbol)}
                  highlight="good"
                />
              </div>
              {stats.topExpense && (
                <div className="pt-2 text-xs text-muted-foreground">
                  Top single expense: <span className="font-medium text-foreground">{formatMoney(stats.topExpense.amount, currencySymbol)}</span>
                  {" "}— {stats.topExpense.description || "(no description)"} [{stats.topExpense.date}]
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Receipt className="h-4 w-4" /> By Category
              </h3>
              <div className="space-y-1">
                {totals.map((t) => (
                  <div key={t.category} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{t.category}</span>
                      <Badge variant="secondary" className="text-[10px]">{t.count} entries</Badge>
                      {t.deductible && <Badge variant="outline" className="text-[10px]">deductible</Badge>}
                      <span className="ml-auto font-mono font-semibold text-foreground">{formatMoney(t.total, currencySymbol)}</span>
                      <Badge variant="outline" className="text-[10px]">{formatPercentage(t.percentage)}</Badge>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, t.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-foreground">Expenses ({sorted.length})</h3>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {sorted.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <span className="font-mono text-muted-foreground text-[10px]">{e.date}</span>
                    <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                    <span className="flex-1 text-foreground truncate">{e.description || "(no description)"}</span>
                    <span className="font-mono font-semibold text-foreground">{formatMoney(e.amount, currencySymbol)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Report
              </h3>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
{text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="expense-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="expenses.csv"
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
          title="Enter expenses to track and categorize"
          hint="One per line in the form date,category,description,amount. Click 'Load sample' to see an example, or click a category preset to add a starter row."
          icon={<Receipt className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setExpensesText(h.expensesText);
                    setCurrencySymbol(h.currencySymbol);
                    toast.info("Restored from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.expenseCount} entries</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatMoney(h.grandTotal, h.currencySymbol)}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing and calculations run 100% in your browser. History is stored in localStorage on this device only. The share link encodes inputs in the URL hash which never leaves the device unless you copy and send it. Deductible markers are general guidance — verify with a tax professional before claiming deductions.
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
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
