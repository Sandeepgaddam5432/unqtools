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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  KPI_TEMPLATES,
  TEMPLATE_LABELS,
  parseKpiCsv,
  buildKpiGroups,
  filterByKpi,
  computeSummaryStats,
  generateBarChart,
  generateLineChart,
  renderKpiCard,
  renderTextDashboard,
  renderCsvDashboard,
  renderHtmlDashboard,
  renderMarkdownDashboard,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type KpiStatus,
} from "./logic";
import { History, BarChart3, FileText, FileCode, FileDown, TrendingUp, TrendingDown, Minus } from "lucide-react";

const SAMPLE = `Organic Traffic,12500,15000,2026-01
Organic Traffic,13200,15000,2026-02
Organic Traffic,14100,15000,2026-03
Keyword Rankings,85,100,2026-01
Keyword Rankings,92,100,2026-02
Keyword Rankings,96,100,2026-03
Backlinks,2400,3000,2026-01
Backlinks,2650,3000,2026-02
Backlinks,2780,3000,2026-03
Conversions,420,500,2026-01
Conversions,455,500,2026-02`;

const STATUS_COLOR: Record<KpiStatus, string> = {
  "on-track": "text-emerald-600 dark:text-emerald-400",
  "behind": "text-amber-600 dark:text-amber-400",
  "critical": "text-red-600 dark:text-red-400",
  "no-target": "text-muted-foreground",
};

const STATUS_BADGE: Record<KpiStatus, "default" | "secondary" | "destructive" | "outline"> = {
  "on-track": "default",
  "behind": "secondary",
  "critical": "destructive",
  "no-target": "outline",
};

export default function SeoKpiDashboardBuilder() {
  const [csvText, setCsvText] = useState("");
  const [filterText, setFilterText] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "text" | "html" | "markdown">("cards");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setCsvText(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseKpiCsv(csvText), [csvText]);
  const allGroups = useMemo(() => buildKpiGroups(parsed.rows), [parsed.rows]);
  const groups = useMemo(() => filterByKpi(allGroups, filterText), [allGroups, filterText]);
  const stats = useMemo(() => computeSummaryStats(allGroups), [allGroups]);
  const textDash = useMemo(() => renderTextDashboard(groups, computeSummaryStats(groups)), [groups]);
  const csvDash = useMemo(() => renderCsvDashboard(groups), [groups]);
  const htmlDash = useMemo(() => renderHtmlDashboard(groups, computeSummaryStats(groups)), [groups]);
  const mdDash = useMemo(() => renderMarkdownDashboard(groups, computeSummaryStats(groups)), [groups]);

  const handleSaveHistory = useCallback(() => {
    if (allGroups.length > 0) {
      saveHistory({
        ts: Date.now(),
        totalKpis: stats.totalKpis,
        onTrack: stats.onTrack,
        critical: stats.critical,
        avgProgress: stats.avgProgress,
      });
      setHistory(loadHistory());
    }
  }, [allGroups, stats]);

  const handleClear = useCallback(() => {
    setCsvText("");
    setFilterText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="kpi-csv">KPI data (CSV: kpi,value,target,date — one row per period)</Label>
            <Textarea
              id="kpi-csv"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"Organic Traffic,12500,15000,2026-01\nOrganic Traffic,13200,15000,2026-02\nKeyword Rankings,85,100,2026-01\nBacklinks,2400,3000,2026-01"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => setCsvText(SAMPLE)}>Load sample</Button>
              {Object.keys(KPI_TEMPLATES).map((k) => (
                <Button
                  key={k}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setCsvText((prev) => (prev ? `${prev}\n${KPI_TEMPLATES[k]}` : KPI_TEMPLATES[k]))}
                >+ {TEMPLATE_LABELS[k]}</Button>
              ))}
            </div>
          </div>
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} row(s) skipped — see console`} />
          )}
        </CardContent>
      </Card>

      {allGroups.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Dashboard summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Total KPIs" value={stats.totalKpis} />
                <Stat label="On-track" value={stats.onTrack} highlight="good" />
                <Stat label="Behind" value={stats.behind} highlight="bad" />
                <Stat label="Critical" value={stats.critical} highlight="bad" />
                <Stat label="No-target" value={stats.noTarget} />
                <Stat label="Avg progress" value={`${stats.avgProgress}%`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> {groups.length} KPI(s)
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter by KPI name…"
                    className="h-8 text-xs rounded border bg-background px-2 w-40"
                  />
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as "cards" | "text" | "html" | "markdown")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="cards">Cards view</option>
                    <option value="text">Text dashboard</option>
                    <option value="html">HTML source</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
              </div>

              {viewMode === "cards" ? (
                <div className="space-y-3 max-h-[600px] overflow-auto">
                  {groups.map((g) => {
                    const TrendIcon = g.trend.direction === "up" ? TrendingUp : g.trend.direction === "down" ? TrendingDown : Minus;
                    const trendPct = g.trend.pctChange > 0 ? `+${g.trend.pctChange}%` : `${g.trend.pctChange}%`;
                    return (
                      <div key={g.kpi} className="rounded-lg border bg-background p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-medium text-sm text-foreground">{g.kpi}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{g.type}</Badge>
                            <Badge variant={STATUS_BADGE[g.status]} className="text-[10px]">{g.status}</Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                          <div><span className="text-muted-foreground">Value:</span> <span className="font-mono font-semibold">{g.latest.value.toLocaleString()}</span></div>
                          <div><span className="text-muted-foreground">Target:</span> <span className="font-mono">{g.latest.target.toLocaleString()}</span></div>
                          <div><span className="text-muted-foreground">Progress:</span> <span className={`font-mono font-semibold ${STATUS_COLOR[g.status]}`}>{g.targetProgress.toFixed(1)}%</span></div>
                          <div className="flex items-center gap-1">
                            <TrendIcon className="h-3 w-3" />
                            <span className="font-mono">{trendPct}</span>
                          </div>
                        </div>
                        <pre className="text-[10px] font-mono whitespace-pre overflow-x-auto bg-muted/30 rounded p-2 mb-2">{generateBarChart(g.kpi, g.targetProgress, 30)}</pre>
                        {g.type === "timeseries" && g.records.length > 1 && (
                          <pre className="text-[10px] font-mono whitespace-pre overflow-x-auto bg-muted/30 rounded p-2">{generateLineChart(g.records.map((r) => r.value))}</pre>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">Latest: {g.latest.date} · {g.records.length} record(s)</div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === "text" ? (
                <pre className="text-[10px] font-mono whitespace-pre overflow-auto bg-muted/30 rounded p-3 max-h-[600px]">{textDash}</pre>
              ) : viewMode === "html" ? (
                <pre className="text-[10px] font-mono whitespace-pre overflow-auto bg-muted/30 rounded p-3 max-h-[600px]">{htmlDash}</pre>
              ) : (
                <pre className="text-[10px] font-mono whitespace-pre overflow-auto bg-muted/30 rounded p-3 max-h-[600px]">{mdDash}</pre>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return viewMode === "html" ? htmlDash : viewMode === "markdown" ? mdDash : viewMode === "text" ? textDash : renderTextDashboard(groups, computeSummaryStats(groups)); }}
                  label="Copy dashboard"
                />
                <DownloadButton getText={() => textDash} filename="kpi-dashboard.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => htmlDash} filename="kpi-dashboard.html" mime="text/html" label="Download .html" />
                <DownloadButton getText={() => mdDash} filename="kpi-dashboard.md" mime="text/markdown" label="Download .md" />
                <DownloadButton getText={() => csvDash} filename="kpi-dashboard.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(csvText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste KPI data to build your dashboard"
          hint="CSV format: kpi,value,target,date — one row per period. Click 'Load sample' to see an example or add KPI templates below."
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
                  <Badge variant="outline">{h.totalKpis} KPIs</Badge>
                  <Badge variant="outline">{h.onTrack} on-track</Badge>
                  <Badge variant="outline">{h.critical} critical</Badge>
                  <Badge variant="outline">avg {h.avgProgress}%</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, calculation, and rendering runs locally. History is stored in localStorage on this device only.
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
