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
  parseInput,
  computeChanges,
  buildTimeline,
  averageTrend,
  filterByKeyword,
  filterByDateRange,
  computeStats,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RankRow,
  type HistoryEntry,
} from "./logic";
import { History, LineChart, TrendingUp, TrendingDown, Calendar, Filter } from "lucide-react";

const SAMPLE = `date,keyword,position
2026-06-01,best seo tools,15
2026-06-15,best seo tools,10
2026-07-01,best seo tools,5
2026-07-15,best seo tools,3
2026-06-01,content marketing,30
2026-06-15,content marketing,25
2026-07-01,content marketing,40
2026-07-15,content marketing,35
2026-06-01,email automation,8
2026-07-15,email automation,4`;

export default function RankChangeVisualizer() {
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setInput(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseInput(input), [input]);
  const filteredRows = useMemo(() => {
    let rows = parsed.rows;
    rows = filterByKeyword(rows, filter);
    rows = filterByDateRange(rows, { start: startDate, end: endDate });
    return rows;
  }, [parsed.rows, filter, startDate, endDate]);
  const changes = useMemo(() => computeChanges(filteredRows), [filteredRows]);
  const timeline = useMemo(() => buildTimeline(filteredRows), [filteredRows]);
  const trend = useMemo(() => averageTrend(filteredRows), [filteredRows]);
  const stats = useMemo(() => {
    const s = computeStats(changes);
    return { ...s, uniqueDates: timeline.dates.length };
  }, [changes, timeline.dates.length]);
  const markdown = useMemo(
    () => renderMarkdown(filteredRows, changes, stats, timeline),
    [filteredRows, changes, stats, timeline],
  );
  const csv = useMemo(() => renderCsv(timeline), [timeline]);

  const handleSaveHistory = useCallback(() => {
    if (stats.totalRows > 0) {
      saveHistory({
        ts: Date.now(),
        totalRows: stats.totalRows,
        uniqueKeywords: stats.uniqueKeywords,
        overallAverageChange: stats.overallAverageChange,
      });
      setHistory(loadHistory());
    }
  }, [stats]);

  const handleClear = useCallback(() => {
    setInput("");
    setFilter("");
    setStartDate("");
    setEndDate("");
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
          <div className="flex items-center justify-between">
            <Label htmlFor="rcv-input">Rank history (CSV: date,keyword,position)</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="rcv-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"date,keyword,position\n2026-07-01,best seo tools,5\n2026-07-08,best seo tools,3"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join("; ")}`} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="rcv-filter" className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" /> Keyword filter
              </Label>
              <Input id="rcv-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 text-xs" placeholder="substring…" />
            </div>
            <div>
              <Label htmlFor="rcv-start" className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Start date
              </Label>
              <Input id="rcv-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label htmlFor="rcv-end" className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> End date
              </Label>
              <Input id="rcv-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {stats.totalRows > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <LineChart className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total rows" value={stats.totalRows} />
                <Stat label="Unique keywords" value={stats.uniqueKeywords} />
                <Stat label="Unique dates" value={stats.uniqueDates} />
                <Stat
                  label="Avg change"
                  value={`${stats.overallAverageChange > 0 ? "+" : ""}${stats.overallAverageChange}`}
                  highlight={stats.overallAverageChange > 0 ? "good" : stats.overallAverageChange < 0 ? "bad" : undefined}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Biggest gains ({stats.biggestGains.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {stats.biggestGains.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No gains detected.</p>
                  ) : (
                    stats.biggestGains.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex-1 font-mono text-foreground truncate">{g.keyword}</div>
                        <Badge variant="secondary">{g.firstPosition} → {g.lastPosition}</Badge>
                        <Badge variant="default" className="bg-emerald-600 text-white">+{g.change}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Biggest drops ({stats.biggestDrops.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {stats.biggestDrops.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No drops detected.</p>
                  ) : (
                    stats.biggestDrops.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex-1 font-mono text-foreground truncate">{d.keyword}</div>
                        <Badge variant="secondary">{d.firstPosition} → {d.lastPosition}</Badge>
                        <Badge variant="destructive">{d.change}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Average position trend</h3>
              <div className="flex items-end gap-1 h-32">
                {trend.map((t, i) => {
                  const maxAvg = Math.max(...trend.map((x) => x.averagePosition || 1), 1);
                  const heightPct = maxAvg > 0 ? ((maxAvg - t.averagePosition + 1) / maxAvg) * 100 : 50;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full bg-primary/40 group-hover:bg-primary rounded-sm transition-colors"
                        style={{ height: `${Math.max(10, heightPct)}%` }}
                        title={`${t.date}: avg ${t.averagePosition}`}
                      />
                      <div className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                        {t.date.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">Hover bars to see exact average per date.</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Timeline (date × keyword)</h3>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr>
                      <th className="text-left p-1.5 border-b">date</th>
                      {timeline.keywords.map((k) => (
                        <th key={k} className="text-left p-1.5 border-b font-mono">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.cells.map((cell) => (
                      <tr key={cell.date}>
                        <td className="p-1.5 border-b font-mono text-muted-foreground">{cell.date}</td>
                        {timeline.keywords.map((k) => {
                          const v = cell.values[k];
                          return (
                            <td key={k} className="p-1.5 border-b font-mono">
                              {v === null ? <span className="text-muted-foreground">—</span> : v}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return markdown; }}
                  label="Copy report (MD)"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return markdown; }}
                  filename="rank-change-report.md"
                  mime="text/markdown"
                  label="Download Markdown"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="rank-timeline.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste rank history to visualize"
          hint="CSV with header `date,keyword,position`. Click 'Load sample' to see gains, drops, timeline, and trend."
          icon={<LineChart className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalRows} rows</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueKeywords} kw</Badge>
                  <Badge variant="outline" className="mr-2">avg {h.overallAverageChange > 0 ? "+" : ""}{h.overallAverageChange}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All rank change computation runs locally. History is stored in localStorage on this device only.
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
