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
  STAGE_PRESETS,
  STAGE_LABELS,
  CURRENCY_PRESETS,
  DEFAULT_INPUT,
  parseDeals,
  applyFilters,
  computeStageBreakdown,
  findTopDeals,
  findStaleDeals,
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
  type Stage,
  type StageFilter,
  type PipelineInput,
  type HistoryEntry,
} from "./logic";
import {
  TrendingUp,
  History,
  FileText,
  AlertCircle,
  Trophy,
  AlertTriangle,
  Filter,
} from "lucide-react";

const SAMPLE_DEALS = `Acme Renewal,Acme Corp,Negotiation,50000,75,2026-07-30
NewCo Demo,NewCo,Proposal,25000,50,2026-08-15
Globex Pilot,Globex Inc,Qualified,15000,25,2026-09-30
Initech Expansion,Initech,Lead,8000,10,2026-10-15
Umbrella Renewal,Umbrella Corp,Closed-Won,42000,100,2026-06-30
Hooli Lost,Hooli,Closed-Lost,18000,0,2026-05-15
Stark Demo,Stark Industries,Proposal,30000,60,2026-04-01
Wayne Upgrade,Wayne Enterprises,Negotiation,65000,80,2026-08-20`;

export default function SalesPipelineTracker() {
  const [dealsText, setDealsText] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_INPUT.currencySymbol);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // today's date for stale detection (computed once on mount)
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.dealsText) setDealsText(p.dealsText);
      if (p.stageFilter) setStageFilter(p.stageFilter);
      if (p.dateRangeStart) setDateRangeStart(p.dateRangeStart);
      if (p.dateRangeEnd) setDateRangeEnd(p.dateRangeEnd);
      if (p.currencySymbol) setCurrencySymbol(p.currencySymbol);
      if (p.dealsText || p.dateRangeStart || p.dateRangeEnd) toast.info("Loaded from share link");
    }
  }, []);

  const input: PipelineInput = useMemo(
    () => ({
      dealsText,
      stageFilter,
      dateRangeStart,
      dateRangeEnd,
      currencySymbol,
      today,
    }),
    [dealsText, stageFilter, dateRangeStart, dateRangeEnd, currencySymbol, today],
  );

  const parsed = useMemo(() => parseDeals(dealsText), [dealsText]);
  const filtered = useMemo(
    () => applyFilters(parsed.deals, stageFilter, dateRangeStart, dateRangeEnd),
    [parsed.deals, stageFilter, dateRangeStart, dateRangeEnd],
  );
  const breakdown = useMemo(() => computeStageBreakdown(filtered), [filtered]);
  const stats = useMemo(() => summaryStats(filtered, today), [filtered, today]);
  const topDeals = useMemo(() => findTopDeals(filtered, 5), [filtered]);
  const staleDeals = useMemo(() => findStaleDeals(filtered, today), [filtered, today]);
  const text = useMemo(() => renderText(input, filtered), [input, filtered]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);

  const handleSaveHistory = useCallback(() => {
    if (parsed.deals.length > 0) {
      saveHistory({
        ts: Date.now(),
        dealsText,
        dealCount: parsed.deals.length,
        pipelineValue: stats.pipelineValue,
        weightedPipeline: stats.weightedPipeline,
        winRate: stats.winRate,
        currencySymbol,
      });
      setHistory(loadHistory());
    }
  }, [dealsText, parsed.deals.length, stats.pipelineValue, stats.weightedPipeline, stats.winRate, currencySymbol]);

  const handleClear = useCallback(() => {
    setDealsText("");
    setStageFilter("all");
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrencySymbol(DEFAULT_INPUT.currencySymbol);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const appendStageRow = (stage: Stage) => {
    setDealsText((prev) => {
      const preset = STAGE_PRESETS.find((p) => p.stage === stage);
      const prob = preset ? preset.defaultProbability : 50;
      const closeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const line = `New ${STAGE_LABELS[stage]} Deal,New Customer,${stage},10000,${prob},${closeDate}`;
      return prev ? `${prev}\n${line}` : line;
    });
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="spt-deals">
                Deals (one per line: deal_name,customer,stage,amount,probability,expected_close_date)
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setDealsText(SAMPLE_DEALS)}
              >
                Load sample
              </Button>
            </div>
            <Textarea
              id="spt-deals"
              value={dealsText}
              onChange={(e) => setDealsText(e.target.value)}
              placeholder={SAMPLE_DEALS}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: <code>deal_name,customer,stage,amount,probability,expected_close_date</code>.
              Stages: <code>lead, qualified, proposal, negotiation, closed-won, closed-lost</code>.
              Probability is 0–100 (omit to use stage default). Wrap fields with commas in double quotes.
              Lines starting with <code>#</code> are ignored.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Stage presets (click to append a starter row)</Label>
            <div className="flex flex-wrap gap-1">
              {STAGE_PRESETS.map((p) => (
                <Button
                  key={p.stage}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  onClick={() => appendStageRow(p.stage)}
                >
                  + {p.label}
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{p.defaultProbability}%</Badge>
                </Button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="spt-stage" className="text-xs">Stage filter</Label>
              <select
                id="spt-stage"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as StageFilter)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                <option value="all">All stages</option>
                {STAGE_PRESETS.map((p) => (
                  <option key={p.stage} value={p.stage}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spt-from" className="text-xs">Close from</Label>
              <Input
                id="spt-from"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spt-to" className="text-xs">Close to</Label>
              <Input
                id="spt-to"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spt-cur" className="text-xs">Currency</Label>
              <select
                id="spt-cur"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {CURRENCY_PRESETS.map((c) => (
                  <option key={c.code} value={c.symbol}>{c.label}</option>
                ))}
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
                <TrendingUp className="h-4 w-4" /> Pipeline Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total deals" value={String(stats.totalDeals)} />
                <Stat label="Open deals" value={String(stats.openDeals)} />
                <Stat label="Won / Lost" value={`${stats.wonDeals} / ${stats.lostDeals}`} />
                <Stat label="Win rate" value={formatPercentage(stats.winRate)} highlight={stats.winRate >= 50 ? "good" : "bad"} />
                <Stat label="Pipeline value" value={formatMoney(stats.pipelineValue, currencySymbol)} highlight="good" />
                <Stat label="Weighted pipeline" value={formatMoney(stats.weightedPipeline, currencySymbol)} />
                <Stat label="Won amount" value={formatMoney(stats.wonAmount, currencySymbol)} highlight="good" />
                <Stat label="Lost amount" value={formatMoney(stats.lostAmount, currencySymbol)} highlight="bad" />
                <Stat label="Avg deal size" value={formatMoney(stats.averageDealSize, currencySymbol)} />
                <Stat label="Stale deals" value={String(stats.staleCount)} highlight={stats.staleCount > 0 ? "bad" : undefined} />
                {stats.topDeal && (
                  <Stat label="Top deal" value={formatMoney(stats.topDeal.amount, currencySymbol)} />
                )}
                {stats.topDeal && (
                  <Stat label="Top deal name" value={stats.topDeal.dealName} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4" /> By Stage
              </h3>
              <div className="space-y-1">
                {breakdown.map((row) => (
                  <div
                    key={row.stage}
                    className={`rounded border bg-background px-3 py-2 text-xs ${row.count === 0 ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{row.label}</span>
                      <Badge variant="secondary" className="text-[10px]">{row.count} deals</Badge>
                      <Badge variant="outline" className="text-[10px]">default {row.defaultProbability}%</Badge>
                      <span className="ml-auto font-mono font-semibold text-foreground">
                        {formatMoney(row.totalAmount, currencySymbol)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        weighted {formatMoney(row.weightedValue, currencySymbol)}
                      </Badge>
                    </div>
                    {row.totalAmount > 0 && (
                      <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(100, Math.max(0, (row.weightedValue / Math.max(1, row.totalAmount)) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {staleDeals.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Stale Deals ({staleDeals.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Open deals whose expected close date has already passed (today: {today || "—"}).
                </p>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {staleDeals.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px]">{STAGE_LABELS[d.stage]}</Badge>
                      <span className="font-medium text-foreground truncate flex-1">{d.dealName}</span>
                      <span className="text-muted-foreground text-[10px] truncate">{d.customer}</span>
                      <span className="font-mono text-muted-foreground text-[10px]">{d.expectedCloseDate}</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoney(d.amount, currencySymbol)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Top Deals
              </h3>
              <div className="space-y-1">
                {topDeals.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                    <Badge variant="outline" className="text-[10px]">{STAGE_LABELS[d.stage]}</Badge>
                    <span className="font-medium text-foreground truncate flex-1">{d.dealName}</span>
                    <span className="text-muted-foreground text-[10px] truncate">{d.customer}</span>
                    <span className="font-mono font-semibold text-foreground">{formatMoney(d.amount, currencySymbol)}</span>
                    <Badge variant="outline" className="text-[10px]">{d.probability}%</Badge>
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
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[400px] overflow-auto">
{text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="sales-pipeline-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="sales-pipeline.csv"
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
          title="Enter deals to track your sales pipeline"
          hint="One per line in the form deal_name,customer,stage,amount,probability,expected_close_date. Click 'Load sample' to see an example, or click a stage preset to add a starter row."
          icon={<TrendingUp className="h-8 w-8" />}
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
                    setDealsText(h.dealsText);
                    setCurrencySymbol(h.currencySymbol);
                    toast.info("Restored from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.dealCount} deals</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatMoney(h.pipelineValue, h.currencySymbol)}</Badge>
                    <Badge variant="outline" className="text-[10px]">weighted {formatMoney(h.weightedPipeline, h.currencySymbol)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatPercentage(h.winRate)} win</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, filtering, and calculations run 100% in your browser. History is stored in localStorage on this device only. The share link encodes your inputs in the URL hash which never leaves the device unless you copy and send it yourself.
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
      <div className={`text-sm font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}
