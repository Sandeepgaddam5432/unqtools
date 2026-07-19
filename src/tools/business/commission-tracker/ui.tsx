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
  COMMISSION_TYPES,
  PAYOUT_FREQUENCIES,
  STATUS_FILTERS,
  DEFAULT_TIERS_TEXT,
  DEFAULT_DEALS_TEXT,
  parseDeals,
  parseTiers,
  attachCommission,
  applyStatusFilter,
  computePerRepTotals,
  sortLeaderboard,
  computeSummary,
  generatePayoutSchedule,
  detectCommissionCaps,
  renderTextReport,
  renderCsv,
  formatCurrency,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CommissionType,
  type PayoutFrequency,
  type StatusFilter,
  type HistoryEntry,
} from "./logic";
import { History, BadgeDollarSign, Trophy, AlertTriangle, Calendar } from "lucide-react";

export default function CommissionTracker() {
  const [commissionType, setCommissionType] = useState<CommissionType>("flat-percent");
  const [baseCommission, setBaseCommission] = useState<number>(0);
  const [commissionPercent, setCommissionPercent] = useState<number>(10);
  const [bonusPerDeal, setBonusPerDeal] = useState<number>(0);
  const [dealsText, setDealsText] = useState<string>(DEFAULT_DEALS_TEXT);
  const [tiersText, setTiersText] = useState<string>(DEFAULT_TIERS_TEXT);
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>("quarterly");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      let touched = false;
      if (p.type) { setCommissionType(p.type); touched = true; }
      if (p.baseCommission !== undefined) setBaseCommission(p.baseCommission);
      if (p.commissionPercent !== undefined) setCommissionPercent(p.commissionPercent);
      if (p.bonusPerDeal !== undefined) setBonusPerDeal(p.bonusPerDeal);
      if (p.deals) { setDealsText(p.deals); touched = true; }
      if (p.tiers) { setTiersText(p.tiers); touched = true; }
      if (p.frequency) { setPayoutFrequency(p.frequency); touched = true; }
      if (p.statusFilter) { setStatusFilter(p.statusFilter); touched = true; }
      if (touched) toast.info("Loaded from share link");
    }
  }, []);

  // Parse deals (with warnings)
  const parsedDeals = useMemo(() => parseDeals(dealsText), [dealsText]);
  const allWarnings = useMemo(
    () => parsedDeals.flatMap((d) => d.warnings),
    [parsedDeals],
  );

  // Parse tiers
  const tiers = useMemo(() => parseTiers(tiersText), [tiersText]);

  // Apply status filter
  const filteredDeals = useMemo(
    () => applyStatusFilter(parsedDeals, statusFilter),
    [parsedDeals, statusFilter],
  );

  // Attach commission + payout
  const withCommission = useMemo(
    () => attachCommission(filteredDeals, {
      type: commissionType,
      baseCommission,
      commissionPercent,
      tiers,
      bonusPerDeal,
    }, payoutFrequency),
    [filteredDeals, commissionType, baseCommission, commissionPercent, tiers, bonusPerDeal, payoutFrequency],
  );

  // Aggregations
  const reps = useMemo(() => computePerRepTotals(withCommission), [withCommission]);
  const leaderboard = useMemo(() => sortLeaderboard(reps), [reps]);
  const summary = useMemo(() => computeSummary(withCommission, reps), [withCommission, reps]);
  const schedule = useMemo(
    () => generatePayoutSchedule(withCommission, payoutFrequency),
    [withCommission, payoutFrequency],
  );
  const capWarnings = useMemo(() => detectCommissionCaps(withCommission), [withCommission]);

  const reportText = useMemo(
    () => renderTextReport(reps, summary, schedule),
    [reps, summary, schedule],
  );
  const csvText = useMemo(() => renderCsv(withCommission), [withCommission]);

  const handleSaveHistory = useCallback(() => {
    if (withCommission.length > 0) {
      saveHistory({
        ts: Date.now(),
        type: commissionType,
        dealCount: withCommission.length,
        repCount: reps.length,
        totalCommission: summary.totalCommission,
      });
      setHistory(loadHistory());
    }
  }, [withCommission, reps.length, summary.totalCommission, commissionType]);

  const handleClear = useCallback(() => {
    setDealsText("");
    setTiersText("");
    setBaseCommission(0);
    setCommissionPercent(0);
    setBonusPerDeal(0);
    setStatusFilter("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadDemo = useCallback(() => {
    setCommissionType("tiered-percent");
    setDealsText(DEFAULT_DEALS_TEXT);
    setTiersText(DEFAULT_TIERS_TEXT);
    setCommissionPercent(10);
    setBaseCommission(0);
    setBonusPerDeal(0);
    setPayoutFrequency("quarterly");
    setStatusFilter("all");
    toast.info("Loaded demo data");
  }, []);

  const showTiers = commissionType === "tiered-percent";
  const showPercent = commissionType === "flat-percent" || commissionType === "base-plus-percent";
  const showBase = commissionType === "base-plus-percent";
  const showBonus = commissionType === "bonus-per-deal";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-type">Commission type</Label>
              <select
                id="ct-type"
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {COMMISSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-freq">Payout frequency</Label>
              <select
                id="ct-freq"
                value={payoutFrequency}
                onChange={(e) => setPayoutFrequency(e.target.value as PayoutFrequency)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {PAYOUT_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            {showBase && (
              <div className="space-y-1.5">
                <Label htmlFor="ct-base">Base commission ($)</Label>
                <Input
                  id="ct-base"
                  type="number"
                  min={0}
                  step="any"
                  value={baseCommission}
                  onChange={(e) => setBaseCommission(Number(e.target.value) || 0)}
                />
              </div>
            )}
            {showPercent && (
              <div className="space-y-1.5">
                <Label htmlFor="ct-pct">Commission percent (%)</Label>
                <Input
                  id="ct-pct"
                  type="number"
                  min={0}
                  step="any"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(Number(e.target.value) || 0)}
                />
              </div>
            )}
            {showBonus && (
              <div className="space-y-1.5">
                <Label htmlFor="ct-bonus">Bonus per deal ($)</Label>
                <Input
                  id="ct-bonus"
                  type="number"
                  min={0}
                  step="any"
                  value={bonusPerDeal}
                  onChange={(e) => setBonusPerDeal(Number(e.target.value) || 0)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ct-filter">Status filter</Label>
              <select
                id="ct-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ct-deals">
              Deals — one per line: <code className="text-[10px]">deal_name,sales_rep,amount,close_date,status</code>
            </Label>
            <Textarea
              id="ct-deals"
              value={dealsText}
              onChange={(e) => setDealsText(e.target.value)}
              placeholder={"Acme Renewal,Alice,50000,2026-07-15,closed-won\nNewCo Demo,Bob,25000,2026-07-20,closed-won"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>

          {showTiers && (
            <div className="space-y-1.5">
              <Label htmlFor="ct-tiers">
                Tiers — one per line: <code className="text-[10px]">min_amount,percent</code> (progressive brackets)
              </Label>
              <Textarea
                id="ct-tiers"
                value={tiersText}
                onChange={(e) => setTiersText(e.target.value)}
                placeholder={"0,5\n50000,10\n100000,15"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Example: $75k deal with tiers 0:5%, 50k:10%, 100k:15% → $2,500 + $2,500 = $5,000.
              </p>
            </div>
          )}

          {allWarnings.length > 0 && (
            <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" /> {allWarnings.length} parser warning(s)
              </div>
              {allWarnings.slice(0, 5).map((w, i) => (
                <div key={i} className="font-mono text-[10px] text-amber-700 dark:text-amber-300">{w}</div>
              ))}
              {allWarnings.length > 5 && (
                <div className="text-[10px] text-muted-foreground">+{allWarnings.length - 5} more…</div>
              )}
            </div>
          )}

          {capWarnings.length > 0 && (
            <div className="rounded border border-red-400/40 bg-red-50 dark:bg-red-950/30 p-2 text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" /> {capWarnings.length} cap warning(s) — commission exceeds deal amount
              </div>
              {capWarnings.slice(0, 5).map((w, i) => (
                <div key={i} className="font-mono text-[10px] text-red-700 dark:text-red-300">
                  {w.dealName} ({w.salesRep}): {formatCurrency(w.commission)} on {formatCurrency(w.amount)}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleLoadDemo}>Load demo</Button>
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {parsedDeals.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BadgeDollarSign className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total deals" value={String(summary.totalDeals)} />
                <Stat label="Closed-won" value={String(summary.closedWonDeals)} highlight="good" />
                <Stat label="Closed-lost" value={String(summary.closedLostDeals)} />
                <Stat label="Open" value={String(summary.openDeals)} />
                <Stat label="Total amount" value={formatCurrency(summary.totalAmount)} />
                <Stat label="Total commission" value={formatCurrency(summary.totalCommission)} highlight="good" />
                <Stat label="Avg commission/deal" value={formatCurrency(summary.averageCommissionPerDeal)} />
                <Stat label="Reps" value={String(summary.repCount)} />
              </div>
              {summary.topPerformer && (
                <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-foreground">{summary.topPerformer.salesRep}</span>
                  <span className="text-muted-foreground">— top performer</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {formatCurrency(summary.topPerformer.totalCommission)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {leaderboard.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" /> Rep leaderboard
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {leaderboard.map((r, i) => (
                    <div key={r.salesRep} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={i === 0 ? "default" : "outline"} className="text-[10px] w-6 justify-center">
                          {i + 1}
                        </Badge>
                        <span className="font-medium text-foreground">{r.salesRep}</span>
                        <Badge variant="outline" className="text-[10px]">{r.dealCount} deals</Badge>
                        <Badge variant="outline" className="text-[10px]">{r.closedWonCount} won</Badge>
                        <Badge variant="secondary" className="ml-auto text-[10px]">{formatCurrency(r.totalCommission)}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 ml-8">
                        amount {formatCurrency(r.totalAmount)} · avg {formatCurrency(r.avgCommissionPerDeal)}/deal
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {schedule.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Payout schedule ({payoutFrequency})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {schedule.map((b) => (
                    <div key={b.period} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                      <span className="font-medium text-foreground">{b.period}</span>
                      <span className="text-muted-foreground">{b.dealCount} deal(s)</span>
                      <Badge variant="secondary" className="text-[10px]">{formatCurrency(b.totalCommission)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {withCommission.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BadgeDollarSign className="h-4 w-4" /> Deal-level breakdown ({withCommission.length})
                </h3>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {withCommission.map((d, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                      <span className="font-medium text-foreground flex-1 truncate">{d.dealName}</span>
                      <span className="text-muted-foreground text-[10px]">{d.salesRep}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{formatCurrency(d.amount)}</span>
                      <span className="font-mono text-[10px] text-foreground">{formatCurrency(d.commission)}</span>
                      <span className="text-[10px] text-muted-foreground w-20 text-right">{d.payoutPeriod}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return reportText; }}
                    label="Copy report"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return reportText; }}
                    filename="commission-report.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => csvText}
                    filename="commission-deals.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({
                        type: commissionType,
                        baseCommission,
                        commissionPercent,
                        bonusPerDeal,
                        deals: dealsText,
                        tiers: showTiers ? tiersText : "",
                        frequency: payoutFrequency,
                        statusFilter,
                      });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste deals to track commissions"
          hint="CSV format: deal_name,sales_rep,amount,close_date,status. Click 'Load demo' for sample data. Commission is calculated for closed-won deals only."
          icon={<BadgeDollarSign className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.type}</Badge>
                  <Badge variant="outline" className="mr-2">{h.dealCount} deals</Badge>
                  <Badge variant="outline" className="mr-2">{h.repCount} reps</Badge>
                  <Badge variant="secondary" className="mr-2">{formatCurrency(h.totalCommission)}</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All commission calculations run locally. Deal data
            never leaves this device. History is stored in localStorage on this device only.
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
