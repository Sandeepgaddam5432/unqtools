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
  DEFAULT_TIERS,
  PROGRAM_TYPE_LABELS,
  PROGRAM_TYPE_PRESETS,
  normalizeNumber,
  parseTiers,
  calculate,
  computeSummaryStats,
  comparePrograms,
  computeBreakEven,
  formatMoney,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CalculatorInput,
  type ProgramType,
  type HistoryEntry,
} from "./logic";
import { History, Calculator, Layers, Repeat, GitMerge, TrendingUp, Target } from "lucide-react";

const PROGRAM_TYPES: ProgramType[] = ["flat-percent", "tiered-percent", "recurring", "hybrid"];

const PROGRAM_ICONS: Record<ProgramType, React.ReactNode> = {
  "flat-percent": <Calculator className="h-4 w-4" />,
  "tiered-percent": <Layers className="h-4 w-4" />,
  "recurring": <Repeat className="h-4 w-4" />,
  "hybrid": <GitMerge className="h-4 w-4" />,
};

export default function AffiliateCommissionCalculator() {
  const [programType, setProgramType] = useState<ProgramType>("flat-percent");
  const [productPrice, setProductPrice] = useState("99.99");
  const [salesCount, setSalesCount] = useState("100");
  const [commissionPercent, setCommissionPercent] = useState("30");
  const [tiersText, setTiersText] = useState("1,10\n10,15\n50,20\n100,30");
  const [recurringMonths, setRecurringMonths] = useState("12");
  const [refundRatePercent, setRefundRatePercent] = useState("5");
  const [taxPercent, setTaxPercent] = useState("0");

  const [compareType, setCompareType] = useState<ProgramType>("tiered-percent");
  const [comparePct, setComparePct] = useState("25");

  const [breakEvenTarget, setBreakEvenTarget] = useState("5000");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.programType) setProgramType(p.programType);
      if (p.productPrice !== undefined) setProductPrice(String(p.productPrice));
      if (p.salesCount !== undefined) setSalesCount(String(p.salesCount));
      if (p.commissionPercent !== undefined) setCommissionPercent(String(p.commissionPercent));
      if (p.tiers) setTiersText(p.tiers.map((t) => `${t.minSales},${t.percent}`).join("\n"));
      if (p.recurringMonths !== undefined) setRecurringMonths(String(p.recurringMonths));
      if (p.refundRatePercent !== undefined) setRefundRatePercent(String(p.refundRatePercent));
      if (p.taxPercent !== undefined) setTaxPercent(String(p.taxPercent));
      if (Object.keys(p).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const input: CalculatorInput = useMemo(() => ({
    programType,
    productPrice: normalizeNumber(productPrice),
    salesCount: normalizeNumber(salesCount),
    commissionPercent: normalizeNumber(commissionPercent),
    tiers: programType === "tiered-percent" ? parseTiers(tiersText) : [],
    recurringMonths: programType === "recurring" || programType === "hybrid"
      ? normalizeNumber(recurringMonths)
      : 0,
    refundRatePercent: normalizeNumber(refundRatePercent),
    taxPercent: normalizeNumber(taxPercent),
  }), [programType, productPrice, salesCount, commissionPercent, tiersText,
    recurringMonths, refundRatePercent, taxPercent]);

  const result = useMemo(() => calculate(input), [input]);
  const summary = useMemo(() => computeSummaryStats(result), [result]);
  const reportText = useMemo(() => renderTextReport(result), [result]);
  const csvText = useMemo(() => renderCsv(result), [result]);

  const compareInput: CalculatorInput = useMemo(() => ({
    ...input,
    programType: compareType,
    commissionPercent: normalizeNumber(comparePct),
    tiers: compareType === "tiered-percent" ? parseTiers(tiersText) : [],
  }), [input, compareType, comparePct, tiersText]);

  const comparison = useMemo(
    () => comparePrograms(input, compareInput),
    [input, compareInput],
  );

  const breakEven = useMemo(
    () => computeBreakEven(normalizeNumber(breakEvenTarget), input),
    [breakEvenTarget, input],
  );

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      programType,
      netCommission: result.netCommission,
      grossCommission: result.grossCommission,
    });
    setHistory(loadHistory());
  }, [programType, result.netCommission, result.grossCommission]);

  const handleClear = useCallback(() => {
    setProgramType("flat-percent");
    setProductPrice("99.99");
    setSalesCount("100");
    setCommissionPercent("30");
    setTiersText("1,10\n10,15\n50,20\n100,30");
    setRecurringMonths("12");
    setRefundRatePercent("5");
    setTaxPercent("0");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadPreset = useCallback(() => {
    const preset = PROGRAM_TYPE_PRESETS[programType];
    setProductPrice(String(preset.productPrice));
    setSalesCount(String(preset.salesCount));
    setCommissionPercent(String(preset.commissionPercent));
    setRecurringMonths(String(preset.recurringMonths));
    setRefundRatePercent(String(preset.refundRatePercent));
    setTaxPercent(String(preset.taxPercent));
    if (preset.tiers.length > 0) {
      setTiersText(preset.tiers.map((t) => `${t.minSales},${t.percent}`).join("\n"));
    }
    toast.success(`Loaded ${PROGRAM_TYPE_LABELS[programType]} preset`);
  }, [programType]);

  const showTiers = programType === "tiered-percent";
  const showRecurring = programType === "recurring" || programType === "hybrid";
  const showCommission = programType !== "tiered-percent";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Program type</Label>
            <div className="flex flex-wrap gap-1">
              {PROGRAM_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setProgramType(t)}
                  className={`h-8 px-3 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    programType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border hover:bg-accent"
                  }`}
                >
                  {PROGRAM_ICONS[t]}
                  {PROGRAM_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-price">Product price ($)</Label>
              <Input
                id="acc-price"
                type="number"
                step="0.01"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-sales">Sales count</Label>
              <Input
                id="acc-sales"
                type="number"
                value={salesCount}
                onChange={(e) => setSalesCount(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            {showCommission && (
              <div className="space-y-1.5">
                <Label htmlFor="acc-pct">Commission percent (%)</Label>
                <Input
                  id="acc-pct"
                  type="number"
                  step="0.1"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}
            {showRecurring && (
              <div className="space-y-1.5">
                <Label htmlFor="acc-months">Recurring months</Label>
                <Input
                  id="acc-months"
                  type="number"
                  value={recurringMonths}
                  onChange={(e) => setRecurringMonths(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="acc-refund">Refund rate (%)</Label>
              <Input
                id="acc-refund"
                type="number"
                step="0.1"
                value={refundRatePercent}
                onChange={(e) => setRefundRatePercent(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-tax">Tax withholding (%)</Label>
              <Input
                id="acc-tax"
                type="number"
                step="0.1"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          {showTiers && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-tiers">Tiers (one per line: <code>minSales,percent</code>)</Label>
              <Textarea
                id="acc-tiers"
                value={tiersText}
                onChange={(e) => setTiersText(e.target.value)}
                placeholder={"1,10\n10,15\n50,20\n100,30"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={handleLoadPreset}>Load preset for {PROGRAM_TYPE_LABELS[programType]}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calculator className="h-4 w-4" /> {PROGRAM_TYPE_LABELS[programType]}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Gross" value={`$${formatMoney(summary.gross)}`} />
            <Stat label="Refunds" value={`-$${formatMoney(summary.refunds)}`} highlight={summary.refunds > 0 ? "bad" : undefined} />
            <Stat label="Tax" value={`-$${formatMoney(summary.tax)}`} highlight={summary.tax > 0 ? "bad" : undefined} />
            <Stat label="Net" value={`$${formatMoney(summary.net)}`} highlight="good" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <Stat label="Effective rate" value={`${summary.effectiveRate.toFixed(2)}%`} />
            <Stat label="Per-sale net" value={`$${formatMoney(summary.net / Math.max(1, input.salesCount))}`} />
          </div>
          {result.tierBreakdown.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tier breakdown</div>
              {result.tierBreakdown.map((b, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{b.rangeLabel}</Badge>
                    <span className="font-mono text-muted-foreground">{b.tier.percent}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted-foreground">{b.salesInTier} sales</span>
                    <span className="font-mono font-medium text-foreground">${formatMoney(b.commission)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.monthlyBreakdown.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Monthly breakdown</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {result.monthlyBreakdown.map((m, i) => (
                  <div key={i} className="rounded border bg-background px-2 py-1 text-[10px] font-mono">
                    <span className="text-muted-foreground">M{m.month}: </span>
                    <span className="text-foreground">${formatMoney(m.commission)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Comparison mode
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Compare with</Label>
              <select
                value={compareType}
                onChange={(e) => setCompareType(e.target.value as ProgramType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {PROGRAM_TYPES.map((t) => (
                  <option key={t} value={t}>{PROGRAM_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            {compareType !== "tiered-percent" && (
              <div className="space-y-1.5">
                <Label htmlFor="acc-comparepct">Compare commission (%)</Label>
                <Input
                  id="acc-comparepct"
                  type="number"
                  step="0.1"
                  value={comparePct}
                  onChange={(e) => setComparePct(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">A: {PROGRAM_TYPE_LABELS[programType]}</div>
              <div className="text-base font-semibold text-foreground">${formatMoney(comparison.a.netCommission)}</div>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">B: {PROGRAM_TYPE_LABELS[compareType]}</div>
              <div className="text-base font-semibold text-foreground">${formatMoney(comparison.b.netCommission)}</div>
            </div>
          </div>
          <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
            <strong className="text-foreground">
              {comparison.winner === "tie"
                ? "It's a tie."
                : `Program ${comparison.winner.toUpperCase()} wins by $${formatMoney(Math.abs(comparison.delta))}`}
            </strong>
            <span className="text-muted-foreground ml-2">
              ({comparison.deltaPercent >= 0 ? "+" : ""}{comparison.deltaPercent.toFixed(2)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Target className="h-4 w-4" /> Break-even calculator
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="acc-target">Target income ($)</Label>
            <Input
              id="acc-target"
              type="number"
              value={breakEvenTarget}
              onChange={(e) => setBreakEvenTarget(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Stat
              label="Sales required"
              value={breakEven.feasible ? breakEven.salesRequired.toLocaleString() : "N/A"}
              highlight="good"
            />
            <Stat label="Per-sale net" value={`$${formatMoney(breakEven.perSaleNet)}`} />
            <Stat label="Feasible" value={breakEven.feasible ? "yes" : "no"} highlight={breakEven.feasible ? "good" : "bad"} />
          </div>
          {!breakEven.feasible && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Not feasible with current settings — per-sale net commission is zero. Raise the commission percent or product price.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Text report</h3>
          <Textarea
            readOnly
            value={reportText}
            className="min-h-[200px] resize-y font-mono text-[11px]"
          />
          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => { handleSaveHistory(); return reportText; }}
              label="Copy report"
            />
            <DownloadButton
              getText={() => { handleSaveHistory(); return reportText; }}
              filename="affiliate-commission-report.txt"
              mime="text/plain"
              label="Download .txt"
            />
            <DownloadButton
              getText={() => csvText}
              filename="affiliate-commission.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {history.length > 0 ? (
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{PROGRAM_TYPE_LABELS[h.programType]}</Badge>
                  <span className="font-mono text-foreground">net ${formatMoney(h.netCommission)}</span>
                  <span className="text-muted-foreground ml-2">(gross ${formatMoney(h.grossCommission)})</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All calculations run locally in your browser. History is stored in localStorage on this device only. No pricing or sales data is transmitted.
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
  value: string | number;
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
