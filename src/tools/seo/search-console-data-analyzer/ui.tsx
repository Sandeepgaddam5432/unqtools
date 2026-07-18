"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  OPPORTUNITY_LABELS,
  THRESHOLDS,
  parseCsv,
  filterValid,
  annotateOpportunities,
  aggregateByUrl,
  aggregateByQuery,
  topPages,
  topQueries,
  generateRecommendations,
  computeSiteStats,
  filterByOpportunity,
  computeSummaryStats,
  formatNumber,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FilterMode,
  type OpportunityType,
  type HistoryEntry,
} from "./logic";
import { BarChart3, History, Lightbulb } from "lucide-react";

const SAMPLE_CSV = `URL,Query,Clicks,Impressions,CTR,Position
https://example.com/page1,best seo tools,150,5000,3.0,8.5
https://example.com/page1,seo software,80,3000,2.7,12.3
https://example.com/page2,keyword research,200,8000,2.5,5.2
https://example.com/page3,seo audit,5,1500,0.3,14.8
https://example.com/page4,cheap tools,2,50,4.0,3.5`;

export default function SearchConsoleDataAnalyzer() {
  const [csvText, setCsvText] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setCsvText(parsed);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const records = useMemo(() => filterValid(parseCsv(csvText)), [csvText]);
  const annotated = useMemo(() => annotateOpportunities(records), [records]);
  const filteredAnnotated = useMemo(
    () => filterByOpportunity(annotated, filterMode),
    [annotated, filterMode],
  );
  const urlAgg = useMemo(() => aggregateByUrl(records), [records]);
  const queryAgg = useMemo(() => aggregateByQuery(records), [records]);
  const recommendations = useMemo(() => generateRecommendations(records), [records]);
  const stats = useMemo(() => computeSummaryStats(records), [records]);
  const text = useMemo(() => renderText(records, recommendations), [records, recommendations]);
  const csvOut = useMemo(() => renderCsv(annotated), [annotated]);

  const handleSaveHistory = useCallback(() => {
    if (records.length > 0) {
      const site = computeSiteStats(records);
      saveHistory({
        ts: Date.now(),
        records: records.length,
        totalClicks: site.totalClicks,
        totalImpressions: site.totalImpressions,
        avgPosition: site.avgPosition,
        opportunityCount: site.opportunityCount,
      });
      setHistory(loadHistory());
    }
  }, [records]);

  const handleClear = useCallback(() => {
    setCsvText("");
    setFilterMode("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setCsvText(SAMPLE_CSV);
    toast.info("Sample data loaded");
  }, []);

  const opportunityColor = (type: OpportunityType): string => {
    switch (type) {
      case "high-imp-low-ctr":
        return "border-amber-500 text-amber-700 dark:text-amber-400";
      case "low-pos-high-imp":
        return "border-blue-500 text-blue-700 dark:text-blue-400";
      case "high-pos-low-imp":
        return "border-purple-500 text-purple-700 dark:text-purple-400";
      case "striking-distance":
        return "border-emerald-500 text-emerald-700 dark:text-emerald-400";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="scda-csv" className="text-xs">
                Search Console CSV (header row: URL, Query, Clicks, Impressions, CTR, Position)
              </Label>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleLoadSample}>
                Load sample
              </Button>
            </div>
            <Textarea
              id="scda-csv"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={SAMPLE_CSV}
              className="min-h-[200px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {records.length} valid record(s) parsed. Column names are case-insensitive. CTR is auto-calculated if missing.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div className="rounded border bg-background px-3 py-2">
              <strong className="text-foreground">High-imp low-CTR:</strong> impr ≥ {THRESHOLDS.highImpressionLowCtr.minImpressions} AND CTR &lt; {THRESHOLDS.highImpressionLowCtr.maxCtr}%
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <strong className="text-foreground">Striking distance:</strong> position {THRESHOLDS.strikingDistance.minPosition}-{THRESHOLDS.strikingDistance.maxPosition}
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <strong className="text-foreground">Low-pos high-imp:</strong> position ≥ {THRESHOLDS.lowPositionHighImp.minPosition} AND impr ≥ {THRESHOLDS.lowPositionHighImp.minImpressions}
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <strong className="text-foreground">High-pos low-imp:</strong> position ≤ {THRESHOLDS.highPositionLowImp.maxPosition} AND impr ≤ {THRESHOLDS.highPositionLowImp.maxImpressions}
            </div>
          </div>
        </CardContent>
      </Card>

      {records.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Site Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="URLs" value={stats.totalUrls} />
                <Stat label="Queries" value={stats.totalQueries} />
                <Stat label="Total clicks" value={formatNumber(stats.totalClicks)} />
                <Stat label="Total impressions" value={formatNumber(stats.totalImpressions)} />
                <Stat label="Avg CTR" value={`${stats.avgCtr}%`} />
                <Stat label="Avg position" value={stats.avgPosition} />
                <Stat
                  label="Opportunities"
                  value={stats.opportunityCount}
                  highlight={stats.opportunityCount > 0 ? "good" : undefined}
                />
                <Stat label="Records" value={records.length} />
              </div>
            </CardContent>
          </Card>

          {recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Optimization Recommendations ({recommendations.length})
                </h3>
                <div className="space-y-1 max-h-[280px] overflow-auto">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <Badge variant="outline" className={`mr-2 text-[10px] ${opportunityColor(rec.type)}`}>
                        {OPPORTUNITY_LABELS[rec.type]}
                      </Badge>
                      <span className="text-foreground">{rec.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Top 5 Pages (by clicks)</h3>
                <div className="space-y-1">
                  {topPages(urlAgg, 5).map((p, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="font-mono text-foreground truncate">{p.url}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{formatNumber(p.totalClicks)} clicks</Badge>
                        <Badge variant="outline" className="text-[10px]">{formatNumber(p.totalImpressions)} impr</Badge>
                        <Badge variant="outline" className="text-[10px]">CTR {p.avgCtr}%</Badge>
                        <Badge variant="outline" className="text-[10px]">pos {p.avgPosition}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.queryCount} queries</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Top 5 Queries (by clicks)</h3>
                <div className="space-y-1">
                  {topQueries(queryAgg, 5).map((q, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="font-mono text-foreground truncate">{q.query}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{formatNumber(q.totalClicks)} clicks</Badge>
                        <Badge variant="outline" className="text-[10px]">{formatNumber(q.totalImpressions)} impr</Badge>
                        <Badge variant="outline" className="text-[10px]">CTR {q.avgCtr}%</Badge>
                        <Badge variant="outline" className="text-[10px]">pos {q.avgPosition}</Badge>
                        <Badge variant="outline" className="text-[10px]">{q.urlCount} URLs</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Records ({filteredAnnotated.length})
                </h3>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="all">All records</option>
                  <option value="high-imp-low-ctr">High-imp low-CTR</option>
                  <option value="low-pos-high-imp">Low-pos high-imp</option>
                  <option value="high-pos-low-imp">High-pos low-imp</option>
                  <option value="striking-distance">Striking distance</option>
                  <option value="none">No opportunity</option>
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filteredAnnotated.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                  >
                    {r.opportunity !== "none" ? (
                      <Badge variant="outline" className={`text-[10px] ${opportunityColor(r.opportunity)}`}>
                        {OPPORTUNITY_LABELS[r.opportunity]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        —
                      </Badge>
                    )}
                    <span className="font-mono text-foreground flex-1 truncate">{r.url}</span>
                    <span className="font-mono text-muted-foreground text-[10px]">‘{r.query}’</span>
                    <span className="font-mono text-muted-foreground text-[10px]">
                      {r.clicks}/{formatNumber(r.impressions)} · {r.ctr}% · pos {r.position}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="search-console-analysis.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvOut}
                  filename="search-console-annotated.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(csvText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste your Search Console CSV to analyze"
          hint="Expected header row: URL, Query, Clicks, Impressions, CTR, Position. Column names are case-insensitive. Click 'Load sample' to see how it works."
          icon={<BarChart3 className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent analyses ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.records} records</Badge>
                  <Badge variant="outline" className="mr-2">{formatNumber(h.totalClicks)} clicks</Badge>
                  <Badge variant="outline" className="mr-2">{formatNumber(h.totalImpressions)} impr</Badge>
                  <Badge variant="outline" className="mr-2">pos {h.avgPosition}</Badge>
                  <Badge variant="outline" className="mr-2">{h.opportunityCount} opps</Badge>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing, aggregation, and recommendations run locally. History is stored in localStorage on this device only.
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
