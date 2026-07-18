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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  METRIC_KEYS,
  METRIC_LABELS,
  METRIC_DIRECTIONS,
  parseMetricsCsv,
  analyze,
  filterByMetric,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  getMetricLabel,
  formatNumber,
  type HistoryEntry,
  type MetricStats,
} from "./logic";
import { History, Swords, Trophy, Zap, AlertTriangle, Filter } from "lucide-react";

const SAMPLE = `yoursite.com,organic_traffic,12500
competitor1.com,organic_traffic,18000
competitor2.com,organic_traffic,9500
yoursite.com,organic_keywords,850
competitor1.com,organic_keywords,1200
competitor2.com,organic_keywords,720
yoursite.com,backlinks,2400
competitor1.com,backlinks,3200
competitor2.com,backlinks,1800
yoursite.com,referring_domains,450
competitor1.com,referring_domains,620
competitor2.com,referring_domains,340
yoursite.com,domain_authority,42
competitor1.com,domain_authority,55
competitor2.com,domain_authority,38
yoursite.com,page_authority,38
competitor1.com,page_authority,48
competitor2.com,page_authority,32
yoursite.com,avg_position,15
competitor1.com,avg_position,8
competitor2.com,avg_position,22
yoursite.com,pages_indexed,850
competitor1.com,pages_indexed,1200
competitor2.com,pages_indexed,650
yoursite.com,load_time_ms,1500
competitor1.com,load_time_ms,900
competitor2.com,load_time_ms,2400
yoursite.com,mobile_score,72
competitor1.com,mobile_score,88
competitor2.com,mobile_score,65`;

function cellColor(stats: MetricStats, yourDomain: string, value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (stats.leader === yourDomain) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (stats.gapPct !== null && stats.gapPct > 50) return "text-red-600 dark:text-red-400";
  if (stats.gapPct !== null && stats.gapPct < 20) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

export default function CompetitorWebsiteAnalyzer() {
  const [yourDomain, setYourDomain] = useState("");
  const [competitorDomains, setCompetitorDomains] = useState("");
  const [metricsCsv, setMetricsCsv] = useState("");
  const [filterText, setFilterText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.yourDomain) setYourDomain(p.yourDomain);
      if (p.data) {
        setMetricsCsv(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseMetricsCsv(metricsCsv), [metricsCsv]);
  const result = useMemo(
    () => (parsed.rows.length > 0 && yourDomain.trim() ? analyze(parsed.rows, yourDomain) : null),
    [parsed.rows, yourDomain],
  );
  const filteredMetrics = useMemo(
    () => (result ? filterByMetric(result.metrics, filterText) : []),
    [result, filterText],
  );
  const stats = useMemo(() => (result ? computeSummaryStats(result) : null), [result]);
  const textReport = useMemo(() => (result ? renderTextReport(result) : ""), [result]);
  const csvReport = useMemo(() => (result ? renderCsvReport(result) : ""), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result && stats) {
      saveHistory({
        ts: Date.now(),
        yourDomain: result.yourDomain,
        competitorCount: stats.totalDomains - 1,
        totalMetrics: stats.totalMetrics,
        yourWins: stats.yourWins,
        yourCriticalGaps: stats.yourCriticalGaps,
      });
      setHistory(loadHistory());
    }
  }, [result, stats]);

  const handleClear = useCallback(() => {
    setYourDomain("");
    setCompetitorDomains("");
    setMetricsCsv("");
    setFilterText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = () => {
    setYourDomain("yoursite.com");
    setCompetitorDomains("competitor1.com\ncompetitor2.com");
    setMetricsCsv(SAMPLE);
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="your-domain">Your domain</Label>
              <Input
                id="your-domain"
                value={yourDomain}
                onChange={(e) => setYourDomain(e.target.value)}
                placeholder="yoursite.com"
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competitors">Competitor domains (one per line — for reference)</Label>
              <Textarea
                id="competitors"
                value={competitorDomains}
                onChange={(e) => setCompetitorDomains(e.target.value)}
                placeholder={"competitor1.com\ncompetitor2.com"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metrics-csv">Metrics data (CSV: domain,metric,value)</Label>
            <Textarea
              id="metrics-csv"
              value={metricsCsv}
              onChange={(e) => setMetricsCsv(e.target.value)}
              placeholder={"yoursite.com,organic_traffic,12500\ncompetitor1.com,organic_traffic,18000\nyoursite.com,backlinks,2400"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1 items-center">
              <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={loadSample}>Load sample</Button>
              <span className="text-[10px] text-muted-foreground mr-1">Metrics:</span>
              {METRIC_KEYS.map((k) => (
                <Badge key={k} variant="outline" className="text-[9px] font-mono">
                  {k}{METRIC_DIRECTIONS[k] === "lower-better" ? " ↓" : " ↑"}
                </Badge>
              ))}
            </div>
          </div>
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} row(s) skipped — check metric names (must be one of the 10 supported keys)`} />
          )}
        </CardContent>
      </Card>

      {result && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Swords className="h-4 w-4" /> Analysis summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                <Stat label="Your domain" value={result.yourDomain} />
                <Stat label="Domains" value={stats.totalDomains} />
                <Stat label="Metrics" value={stats.totalMetrics} />
                <Stat label="Your wins" value={stats.yourWins} highlight="good" />
                <Stat label="Critical gaps" value={stats.yourCriticalGaps} highlight="bad" />
              </div>
            </CardContent>
          </Card>

          {(result.strengths.length > 0 || result.quickWins.length > 0 || result.criticalGaps.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 space-y-1">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-emerald-600" /> Strengths ({result.strengths.length})
                  </h4>
                  {result.strengths.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No metrics where you lead.</p>
                  ) : (
                    result.strengths.map((m) => (
                      <div key={m.metric} className="text-[11px] flex justify-between">
                        <span className="font-mono">{getMetricLabel(m.metric)}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatNumber(m.yourValue)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 space-y-1">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-600" /> Quick wins ({result.quickWins.length})
                  </h4>
                  {result.quickWins.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No quick wins (gap &lt; 20%).</p>
                  ) : (
                    result.quickWins.map((m) => (
                      <div key={m.metric} className="text-[11px] flex justify-between">
                        <span className="font-mono">{getMetricLabel(m.metric)}</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">{m.gapPct?.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 space-y-1">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> Critical gaps ({result.criticalGaps.length})
                  </h4>
                  {result.criticalGaps.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No critical gaps (gap &gt; 50%).</p>
                  ) : (
                    result.criticalGaps.map((m) => (
                      <div key={m.metric} className="text-[11px] flex justify-between">
                        <span className="font-mono">{getMetricLabel(m.metric)}</span>
                        <span className="font-mono text-red-600 dark:text-red-400">{m.gapPct?.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Filter className="h-4 w-4" /> Comparison matrix ({filteredMetrics.length} metrics)
                </h3>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter metric…"
                  className="h-8 text-xs rounded border bg-background px-2 w-40"
                />
              </div>
              <div className="overflow-auto max-h-[500px] border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Metric</th>
                      <th className="text-left p-2 font-medium">Dir</th>
                      {result.domains.map((d) => (
                        <th key={d} className="text-right p-2 font-medium">
                          {d}{d === result.yourDomain ? " (you)" : ""}
                        </th>
                      ))}
                      <th className="text-right p-2 font-medium">Leader</th>
                      <th className="text-right p-2 font-medium">Your rank</th>
                      <th className="text-right p-2 font-medium">Gap %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map((m) => (
                      <tr key={m.metric} className="border-t">
                        <td className="p-2 font-mono">{getMetricLabel(m.metric)}</td>
                        <td className="p-2 text-muted-foreground">{m.direction === "higher-better" ? "↑" : "↓"}</td>
                        {result.domains.map((d) => {
                          const v = m.values[d] ?? null;
                          return (
                            <td key={d} className={`text-right p-2 font-mono ${cellColor(m, result.yourDomain, v)}`}>
                              {formatNumber(v)}
                            </td>
                          );
                        })}
                        <td className="text-right p-2 font-mono text-muted-foreground">{m.leader ?? "—"}</td>
                        <td className={`text-right p-2 font-mono ${m.yourRank === 1 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}`}>
                          #{m.yourRank ?? "—"}
                        </td>
                        <td className={`text-right p-2 font-mono ${(m.gapPct ?? 0) > 50 ? "text-red-600 dark:text-red-400" : (m.gapPct ?? 0) < 20 && m.gapPct !== null ? "text-amber-600 dark:text-amber-400" : ""}`}>
                          {m.gapPct !== null ? `${m.gapPct.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy report" />
                <DownloadButton getText={() => textReport} filename="competitor-analysis.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csvReport} filename="competitor-analysis.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(yourDomain, metricsCsv); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Text report preview</h3>
              <pre className="text-[10px] font-mono whitespace-pre overflow-auto bg-muted/30 rounded p-3 max-h-[300px]">{textReport}</pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your domain and competitor metrics"
          hint="CSV format: domain,metric,value. Supported metrics: organic_traffic, organic_keywords, backlinks, referring_domains, domain_authority, page_authority, avg_position, pages_indexed, load_time_ms, mobile_score. Click 'Load sample' to see an example."
          icon={<Swords className="h-8 w-8" />}
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
                  <Badge variant="outline">{h.yourDomain}</Badge>
                  <Badge variant="outline">{h.competitorCount} competitors</Badge>
                  <Badge variant="outline">{h.totalMetrics} metrics</Badge>
                  <Badge variant="outline">{h.yourWins} wins</Badge>
                  <Badge variant="outline">{h.yourCriticalGaps} critical</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing and analysis runs locally. History is stored in localStorage on this device only. The tool never makes network requests.
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
      <div className={`text-base font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}
