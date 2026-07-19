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
  TAX_TYPES,
  COUNTRIES,
  FILING_STATUSES,
  TAX_YEARS,
  TAX_TYPE_LABELS,
  COUNTRY_LABELS,
  FILING_STATUS_LABELS,
  US_STATE_SALES_TAX,
  DEFAULT_SALES_TAX_RATE,
  computeTax,
  formatCurrency,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  summaryStats,
  type TaxInput,
  type TaxType,
  type Country,
  type FilingStatus,
  type TaxYear,
  type TaxHistoryEntry,
} from "./logic";
import { History, Calculator, FileText, Percent } from "lucide-react";

const DEFAULT_INPUT: TaxInput = {
  taxType: "income",
  country: "US",
  income: 100000,
  purchaseAmount: 100,
  filingStatus: "single",
  taxYear: 2026,
  deductions: 0,
  stateOrRegion: "",
  capitalGainsHoldingYears: 2,
};

export default function TaxCalculator() {
  const [input, setInput] = useState<TaxInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<TaxHistoryEntry[]>([]);

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

  const result = useMemo(() => computeTax(input), [input]);
  const stats = useMemo(() => summaryStats(result), [result]);
  const text = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const update = useCallback((patch: Partial<TaxInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (stats.grossAmount > 0) {
      saveHistory({
        ts: Date.now(),
        taxType: stats.taxType,
        country: stats.country,
        grossAmount: stats.grossAmount,
        totalTax: stats.totalTax,
        currencySymbol: result.currencySymbol,
        effectiveRate: stats.effectiveRate,
      });
      setHistory(loadHistory());
    }
  }, [stats, result.currencySymbol]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const isIncomeOrCG = input.taxType === "income" || input.taxType === "capital-gains";
  const showFilingStatus = input.country === "US" && isIncomeOrCG;
  const showTaxYear = isIncomeOrCG;
  const showIncome = isIncomeOrCG;
  const showPurchaseAmount = input.taxType === "sales" || input.taxType === "vat";
  const showState = input.taxType === "sales" && input.country === "US";
  const showHoldingYears = input.taxType === "capital-gains";
  const showDeductions = isIncomeOrCG;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tc-type">Tax type</Label>
              <select
                id="tc-type"
                value={input.taxType}
                onChange={(e) => update({ taxType: e.target.value as TaxType })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TAX_TYPES.map((t) => (
                  <option key={t} value={t}>{TAX_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-country">Country</Label>
              <select
                id="tc-country"
                value={input.country}
                onChange={(e) => update({ country: e.target.value as Country })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{COUNTRY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            {showTaxYear ? (
              <div className="space-y-1.5">
                <Label htmlFor="tc-year">Tax year</Label>
                <select
                  id="tc-year"
                  value={input.taxYear}
                  onChange={(e) => update({ taxYear: Number(e.target.value) as TaxYear })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {TAX_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">—</Label>
                <div className="h-9 flex items-center text-xs text-muted-foreground">N/A for this tax type</div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {showFilingStatus && (
              <div className="space-y-1.5">
                <Label htmlFor="tc-status">Filing status (US)</Label>
                <select
                  id="tc-status"
                  value={input.filingStatus}
                  onChange={(e) => update({ filingStatus: e.target.value as FilingStatus })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {FILING_STATUSES.map((s) => (
                    <option key={s} value={s}>{FILING_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
            {showIncome && (
              <div className="space-y-1.5">
                <Label htmlFor="tc-income">{input.taxType === "capital-gains" ? "Capital gain amount" : "Income"}</Label>
                <Input
                  id="tc-income"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.income}
                  onChange={(e) => update({ income: Number(e.target.value) })}
                />
              </div>
            )}
            {showPurchaseAmount && (
              <div className="space-y-1.5">
                <Label htmlFor="tc-purchase">Purchase amount</Label>
                <Input
                  id="tc-purchase"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.purchaseAmount}
                  onChange={(e) => update({ purchaseAmount: Number(e.target.value) })}
                />
              </div>
            )}
            {showState && (
              <div className="space-y-1.5">
                <Label htmlFor="tc-state">US state (2-letter code)</Label>
                <Input
                  id="tc-state"
                  value={input.stateOrRegion}
                  onChange={(e) => update({ stateOrRegion: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="CA, NY, TX…"
                  className="font-mono uppercase"
                />
                <div className="text-[11px] text-muted-foreground">
                  {input.stateOrRegion && US_STATE_SALES_TAX[input.stateOrRegion] !== undefined
                    ? `Rate: ${US_STATE_SALES_TAX[input.stateOrRegion]}%`
                    : `Default: ${DEFAULT_SALES_TAX_RATE}%`}
                </div>
              </div>
            )}
            {showHoldingYears && (
              <div className="space-y-1.5">
                <Label htmlFor="tc-hold">Holding period (years)</Label>
                <Input
                  id="tc-hold"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.capitalGainsHoldingYears}
                  onChange={(e) => update({ capitalGainsHoldingYears: Number(e.target.value) })}
                />
                <div className="text-[11px] text-muted-foreground">
                  {input.capitalGainsHoldingYears > 1
                    ? "Long-term (> 1yr) — discounted rate applies"
                    : "Short-term (≤ 1yr) — taxed as ordinary income"}
                </div>
              </div>
            )}
            {showDeductions && (
              <div className="space-y-1.5">
                <Label htmlFor="tc-ded">Deductions</Label>
                <Input
                  id="tc-ded"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.deductions}
                  onChange={(e) => update({ deductions: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          {showState && (
            <div className="flex flex-wrap gap-1">
              {Object.keys(US_STATE_SALES_TAX).slice(0, 12).map((s) => (
                <Button
                  key={s}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => update({ stateOrRegion: s })}
                >{s} ({US_STATE_SALES_TAX[s]}%)</Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {stats.grossAmount > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Gross" value={formatCurrency(stats.grossAmount, result.currencySymbol)} />
                {stats.deductions > 0 && (
                  <Stat label="Deductions" value={`-${formatCurrency(stats.deductions, result.currencySymbol)}`} />
                )}
                <Stat label="Taxable" value={formatCurrency(stats.taxableAmount, result.currencySymbol)} />
                <Stat label="Total tax" value={formatCurrency(stats.totalTax, result.currencySymbol)} highlight="bad" />
                <Stat label="Net" value={formatCurrency(stats.netAmount, result.currencySymbol)} highlight="good" />
                <Stat label="Effective rate" value={`${stats.effectiveRate.toFixed(2)}%`} />
                <Stat label="Marginal rate" value={`${stats.marginalRate.toFixed(2)}%`} />
                <Stat label="Brackets used" value={String(stats.bracketCount)} />
              </div>

              {result.brackets.length > 0 && (
                <div className="rounded border bg-background">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-left">
                        <th className="px-3 py-2 font-medium">Bracket range</th>
                        <th className="px-3 py-2 font-medium text-right">Rate</th>
                        <th className="px-3 py-2 font-medium text-right">Taxable</th>
                        <th className="px-3 py-2 font-medium text-right">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.brackets.map((b, i) => {
                        const fromStr = formatCurrency(b.taxableFrom, result.currencySymbol);
                        const toStr = b.taxableTo === null
                          ? "+"
                          : `→ ${formatCurrency(b.taxableTo, result.currencySymbol)}`;
                        return (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5 font-mono text-[11px]">{fromStr} {toStr}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{b.rate}%</td>
                            <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(b.taxableAmount, result.currencySymbol)}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(b.tax, result.currencySymbol)}</td>
                          </tr>
                        );
                      })}
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
                <FileText className="h-4 w-4" /> Text Report
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
                  filename={`tax-${input.taxType}-${input.country}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename={`tax-${input.taxType}-${input.country}.csv`}
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
          title="Enter an income or purchase amount to compute tax"
          hint="Pick a tax type and country above. For income tax, enter your income; for sales/VAT, enter the purchase amount; for capital gains, enter the gain amount and holding period."
          icon={<Percent className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{TAX_TYPE_LABELS[h.taxType]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.country}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{formatCurrency(h.grossAmount, h.currencySymbol)}</Badge>
                  <Badge variant="secondary" className="text-[10px] text-red-700 dark:text-red-300">{formatCurrency(h.totalTax, h.currencySymbol)} tax</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.effectiveRate}% eff.</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All tax calculation runs 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded. Brackets are public reference values — verify with a tax professional before filing.
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
