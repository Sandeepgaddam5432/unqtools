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
  PLATFORMS,
  PLATFORM_LABELS,
  METRICS,
  METRIC_LABELS,
  DATE_GROUPINGS,
  DATE_GROUPING_LABELS,
  SAMPLE_CSV,
  CSV_HEADER,
  parseCsv,
  groupMetrics,
  buildDashboard,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Metric,
  type DateGrouping,
  type PlatformFilter,
  type HistoryEntry,
} from "./logic";
import { BarChart3, History, LineChart, Table, TrendingUp, AlertCircle } from "lucide-react";

type Tab = "text" | "html" | "markdown" | "csv";

export default function SocialMediaAnalyticsDashboard() {
  const [csvData, setCsvData] = useState("");
  const [metric, setMetric] = useState<Metric>("followers");
  const [grouping, setGrouping] = useState<DateGrouping>("monthly");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [tab, setTab] = useState<Tab>("text");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setCsvData(p.data);
        setMetric(p.metric);
        setGrouping(p.grouping);
        setPlatformFilter(p.platformFilter);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parseResult = useMemo(() => parseCsv(csvData), [csvData]);
  const { rows, errors } = parseResult;

  const dashboard = useMemo(
    () => buildDashboard(rows, metric, grouping, platformFilter),
    [rows, metric, grouping, platformFilter],
  );

  const groups = useMemo(
    () => groupMetrics(rows, grouping, metric, platformFilter),
    [rows, grouping, metric, platformFilter],
  );

  const csvOutput = useMemo(() => renderCsv(rows), [rows]);

  const handleSaveHistory = useCallback(() => {
    if (rows.length > 0) {
      saveHistory({
        ts: Date.now(),
        rowCount: rows.length,
        platformFilter,
        metric,
        grouping,
        totalFollowers: dashboard.summary.totalFollowers,
      });
      setHistory(loadHistory());
    }
  }, [rows, platformFilter, metric, grouping, dashboard.summary.totalFollowers]);

  const handleLoadSample = useCallback(() => {
    setCsvData(SAMPLE_CSV);
    toast.info("Loaded sample CSV data");
  }, []);

  const handleClear = useCallback(() => {
    setCsvData("");
    setMetric("followers");
    setGrouping("monthly");
    setPlatformFilter("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const tabOutput: Record<Tab, string> = {
    text: dashboard.textDashboard,
    html: dashboard.htmlDashboard,
    markdown: dashboard.markdownDashboard,
    csv: csvOutput,
  };

  const tabFilenames: Record<Tab, { name: string; mime: string }> = {
    text: { name: "analytics-dashboard.txt", mime: "text/plain" },
    html: { name: "analytics-dashboard.html", mime: "text/html" },
    markdown: { name: "analytics-dashboard.md", mime: "text/markdown" },
    csv: { name: "analytics-data.csv", mime: "text/csv" },
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="smad-csv">Analytics CSV data</Label>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleLoadSample}>
                Load sample
              </Button>
            </div>
            <Textarea
              id="smad-csv"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder={`date,platform,followers,posts,engagement,impressions,reach\n2024-01-01,twitter,1200,5,180,5000,4200\n...`}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Header: <code className="font-mono">{CSV_HEADER.join(",")}</code>. Supported platforms: {PLATFORMS.join(", ")}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Metric to visualize</Label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {METRICS.map((m) => (
                  <option key={m} value={m}>{METRIC_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date grouping</Label>
              <select
                value={grouping}
                onChange={(e) => setGrouping(e.target.value as DateGrouping)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {DATE_GROUPINGS.map((g) => (
                  <option key={g} value={g}>{DATE_GROUPING_LABELS[g]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Platform filter</Label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                <option value="all">All platforms</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <div className="flex items-center gap-1.5 mb-1 text-amber-700 dark:text-amber-300 font-semibold">
            <AlertCircle className="h-4 w-4" /> {errors.length} parse warning(s)
          </div>
          <ul className="space-y-0.5 text-muted-foreground">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>Line {e.line}: {e.message}</li>
            ))}
            {errors.length > 5 && <li>… and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}

      {rows.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Summary
                <Badge variant="secondary" className="ml-1 text-[10px]">{dashboard.summary.totalRows} rows</Badge>
                <Badge variant="outline" className="text-[10px]">{dashboard.summary.totalPlatforms} platforms</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                <Stat label="Platforms" value={dashboard.summary.totalPlatforms} />
                <Stat label="Followers" value={formatShort(dashboard.summary.totalFollowers)} />
                <Stat label="Posts" value={formatShort(dashboard.summary.totalPosts)} />
                <Stat label="Avg Eng." value={`${dashboard.summary.avgEngagementRate.toFixed(2)}%`} />
                <Stat label="Impressions" value={formatShort(dashboard.summary.totalImpressions)} />
                <Stat label="Reach" value={formatShort(dashboard.summary.totalReach)} />
                <Stat label="Engagement" value={formatShort(dashboard.summary.totalEngagement)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <MiniStat
                  label="Period growth"
                  value={
                    isFinite(dashboard.growth.rate)
                      ? `${dashboard.growth.rate >= 0 ? "+" : ""}${dashboard.growth.rate.toFixed(2)}%`
                      : "∞"
                  }
                  highlight={dashboard.growth.direction}
                  icon={<TrendingUp className="h-3 w-3" />}
                />
                <MiniStat
                  label="Follower trend"
                  value={dashboard.trend.trend.toUpperCase()}
                  highlight={dashboard.trend.trend === "improving" ? "up" : dashboard.trend.trend === "declining" ? "down" : "flat"}
                />
                <MiniStat
                  label="Best / worst"
                  value={
                    dashboard.bestPeriod && dashboard.worstPeriod
                      ? `${dashboard.bestPeriod.group} / ${dashboard.worstPeriod.group}`
                      : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <LineChart className="h-4 w-4" /> {METRIC_LABELS[metric]} · {DATE_GROUPING_LABELS[grouping]} · {platformFilter}
                </h3>
                <Badge variant="outline" className="text-[10px]">{groups.length} groups</Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">ASCII Bar Chart (30-char width)</div>
                  <pre className="text-[10px] leading-tight font-mono bg-muted/30 dark:bg-muted/20 rounded p-2 overflow-auto">
                    {dashboard.barChart}
                  </pre>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">ASCII Line Chart (10×5 grid)</div>
                  <pre className="text-[10px] leading-tight font-mono bg-muted/30 dark:bg-muted/20 rounded p-2 overflow-auto">
                    {dashboard.lineChart}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table className="h-4 w-4" /> Platform Comparison
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1.5 px-2">Platform</th>
                      <th className="text-right py-1.5 px-2">Rows</th>
                      <th className="text-right py-1.5 px-2">Followers (last)</th>
                      <th className="text-right py-1.5 px-2">Posts</th>
                      <th className="text-right py-1.5 px-2">Eng. %</th>
                      <th className="text-right py-1.5 px-2">Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.platformComparison.map((p) => {
                      const growth = p.followerGrowth;
                      const growthStr = isFinite(growth.rate) ? `${growth.rate >= 0 ? "+" : ""}${growth.rate.toFixed(2)}%` : "∞";
                      const color = growth.direction === "up" ? "text-emerald-600 dark:text-emerald-400"
                        : growth.direction === "down" ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground";
                      return (
                        <tr key={p.platform} className="border-b last:border-0">
                          <td className="py-1.5 px-2 font-medium">{PLATFORM_LABELS[p.platform]}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{p.rows}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{formatShort(p.lastFollowers)}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{p.totalPosts}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{p.engagementRate.toFixed(2)}%</td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${color}`}>{growthStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Dashboard output</h3>
                <div className="flex flex-wrap gap-1">
                  {(["text", "html", "markdown", "csv"] as Tab[]).map((t) => (
                    <Button
                      key={t}
                      variant={tab === t ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setTab(t)}
                    >
                      {t === "text" ? "Text" : t === "html" ? "HTML" : t === "markdown" ? "Markdown" : "CSV"}
                    </Button>
                  ))}
                </div>
              </div>
              <pre className="text-[10px] leading-tight font-mono bg-muted/30 dark:bg-muted/20 rounded p-3 overflow-auto max-h-[500px] whitespace-pre-wrap break-all">
                {tabOutput[tab]}
              </pre>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return tabOutput[tab]; }}
                  label={`Copy ${tab}`}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return tabOutput[tab]; }}
                  filename={tabFilenames[tab].name}
                  mime={tabFilenames[tab].mime}
                  label={`Download ${tabFilenames[tab].name.split(".").pop()?.toUpperCase()}`}
                />
                <DownloadButton
                  getText={() => dashboard.htmlDashboard}
                  filename="analytics-dashboard.html"
                  mime="text/html"
                  label="Download HTML"
                />
                <DownloadButton
                  getText={() => dashboard.markdownDashboard}
                  filename="analytics-dashboard.md"
                  mime="text/markdown"
                  label="Download MD"
                />
                <DownloadButton
                  getText={() => csvOutput}
                  filename="analytics-data.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(csvData, metric, grouping, platformFilter); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste your analytics CSV to build a dashboard"
          hint="Expected columns: date,platform,followers,posts,engagement,impressions,reach. Click 'Load sample' for an example dataset with two platforms across three weeks."
          icon={<BarChart3 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.rowCount} rows</Badge>
                  <Badge variant="outline" className="text-[10px]">{METRIC_LABELS[h.metric]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{DATE_GROUPING_LABELS[h.grouping]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.platformFilter}</Badge>
                  <span className="text-muted-foreground">{formatShort(h.totalFollowers)} followers</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, aggregation, and rendering runs locally.
            History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: "up" | "down" | "flat";
  icon?: React.ReactNode;
}) {
  const color = highlight === "up" ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "down" ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function formatShort(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
