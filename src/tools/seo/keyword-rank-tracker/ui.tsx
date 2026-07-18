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
  parseCsv,
  addEntry,
  removeKeyword,
  buildHistory,
  filterHistory,
  sortHistory,
  computeStats,
  renderCsv,
  renderSummaryCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RankEntry,
  type SortField,
  type SortDir,
  type HistoryEntry,
} from "./logic";
import { History, TrendingUp, TrendingDown, Plus, X, Trophy, ArrowDownUp } from "lucide-react";

const SAMPLE = `keyword,position,date
best seo tools,12,2026-06-01
best seo tools,8,2026-06-15
best seo tools,5,2026-07-01
best seo tools,3,2026-07-15
content marketing guide,25,2026-06-01
content marketing guide,20,2026-06-15
content marketing guide,30,2026-07-01
content marketing guide,22,2026-07-15`;

export default function KeywordRankTracker() {
  const [bulkText, setBulkText] = useState("");
  const [singleKw, setSingleKw] = useState("");
  const [singlePos, setSinglePos] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("keyword");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setBulkText(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleImport = useCallback(() => {
    if (!bulkText.trim()) {
      setParseErrors([]);
      return;
    }
    const { entries: parsed, errors } = parseCsv(bulkText);
    if (parsed.length > 0) {
      setEntries((prev) => {
        const map = new Map<string, RankEntry>();
        for (const e of prev) map.set(`${e.keyword}|${e.date}`, e);
        for (const e of parsed) map.set(`${e.keyword}|${e.date}`, e);
        return Array.from(map.values());
      });
      setBulkText("");
      setParseErrors(errors);
      toast.success(`Imported ${parsed.length} entries`);
    } else {
      setParseErrors(errors.length > 0 ? errors : ["No valid entries found"]);
    }
  }, [bulkText]);

  const history_data = useMemo(() => buildHistory(entries), [entries]);
  const filtered = useMemo(() => filterHistory(history_data, filter), [history_data, filter]);
  const sorted = useMemo(() => sortHistory(filtered, sortField, sortDir), [filtered, sortField, sortDir]);
  const stats = useMemo(() => computeStats(history_data), [history_data]);
  const csv = useMemo(() => renderCsv(entries), [entries]);
  const summaryCsv = useMemo(() => renderSummaryCsv(history_data), [history_data]);

  const handleAddSingle = useCallback(() => {
    if (!singleKw.trim() || !singlePos.trim() || !singleDate.trim()) {
      toast.error("Keyword, position, and date are all required");
      return;
    }
    const pos = parseInt(singlePos, 10);
    const newEntries = addEntry(entries, { keyword: singleKw, position: pos, date: singleDate });
    if (newEntries.length === entries.length) {
      toast.error("Invalid position or date");
      return;
    }
    setEntries(newEntries);
    setSingleKw("");
    setSinglePos("");
    setSingleDate("");
    toast.success("Entry added");
  }, [singleKw, singlePos, singleDate, entries]);

  const handleRemoveKeyword = useCallback((keyword: string) => {
    setEntries((prev) => removeKeyword(prev, keyword));
    toast.info(`Removed "${keyword}"`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (entries.length > 0) {
      saveHistory({
        ts: Date.now(),
        keywordsTracked: stats.keywordsTracked,
        totalEntries: stats.totalEntries,
        overallAverage: stats.overallAverage,
      });
      setHistory(loadHistory());
    }
  }, [entries.length, stats]);

  const handleClear = useCallback(() => {
    setEntries([]);
    setBulkText("");
    setFilter("");
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
            <Label htmlFor="krt-bulk">Bulk import (CSV: keyword,position,date)</Label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setBulkText(SAMPLE); toast.info("Sample loaded"); }}
              >Load sample</Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!bulkText.trim()}
              >Import</Button>
            </div>
          </div>
          <Textarea
            id="krt-bulk"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"keyword,position,date\nbest seo tools,5,2026-07-15"}
            className="min-h-[100px] resize-y font-mono text-xs"
          />
          {parseErrors.length > 0 && (
            <ErrorBanner message={`${parseErrors.length} parse error(s): ${parseErrors.slice(0, 3).join("; ")}`} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Add single entry</Label>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <Input
              placeholder="Keyword"
              value={singleKw}
              onChange={(e) => setSingleKw(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Position"
              type="number"
              min={0}
              value={singlePos}
              onChange={(e) => setSinglePos(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Date"
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="text-xs"
            />
            <Button size="sm" onClick={handleAddSingle} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {history_data.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Keywords tracked" value={stats.keywordsTracked} />
                <Stat label="Total entries" value={stats.totalEntries} />
                <Stat
                  label="Overall avg position"
                  value={stats.overallAverage ?? "—"}
                  highlight={stats.overallAverage !== null && stats.overallAverage <= 10 ? "good" : undefined}
                />
                <Stat
                  label="Best mover"
                  value={stats.bestMover ? `${stats.bestMover.keyword} (+${stats.bestMover.change})` : "—"}
                  highlight={stats.bestMover ? "good" : undefined}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Keyword history ({sorted.length})
                </h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Filter keywords…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-8 w-40 text-xs"
                  />
                  <div className="flex gap-1 items-center text-xs">
                    <ArrowDownUp className="h-3 w-3" />
                    {(["keyword", "latest", "change", "best"] as SortField[]).map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={sortField === f ? "default" : "outline"}
                        onClick={() => setSortField(f)}
                        className="h-7 text-xs"
                      >{f}</Button>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                      className="h-7 text-xs"
                    >{sortDir}</Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-auto">
                {sorted.map((h) => (
                  <div key={h.keyword} className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 font-mono text-foreground font-medium">{h.keyword}</div>
                      <Badge variant="outline">{h.entriesCount} entries</Badge>
                      {h.change !== null && (
                        <Badge
                          variant={h.change > 0 ? "default" : h.change < 0 ? "destructive" : "secondary"}
                          className="gap-0.5"
                        >
                          {h.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {h.change > 0 ? `+${h.change}` : h.change}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveKeyword(h.keyword)}
                        title={`Remove ${h.keyword}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-muted-foreground">
                      <span>latest: <strong className="text-foreground">{h.latest ?? "—"}</strong></span>
                      <span>prev: <strong className="text-foreground">{h.previous ?? "—"}</strong></span>
                      <span>best: <strong className="text-foreground">{h.best ?? "—"}</strong></span>
                      <span>worst: <strong className="text-foreground">{h.worst ?? "—"}</strong></span>
                      <span>avg: <strong className="text-foreground">{h.average ?? "—"}</strong></span>
                    </div>
                    {h.entries.length > 1 && (
                      <div className="flex items-end gap-1 h-8 pt-1">
                        {h.entries.map((e, i) => {
                          const maxPos = Math.max(...h.entries.map((x) => x.position || 1), 1);
                          const heightPct = maxPos > 0 ? ((maxPos - e.position + 1) / maxPos) * 100 : 50;
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-primary/40 hover:bg-primary rounded-sm transition-colors"
                              style={{ height: `${Math.max(10, heightPct)}%` }}
                              title={`${e.date}: ${e.position}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return summaryCsv;
                  }}
                  label="Copy summary CSV"
                />
                <DownloadButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  filename="keyword-rank-tracker.csv"
                  mime="text/csv"
                  label="Download full CSV"
                />
                <DownloadButton
                  getText={() => summaryCsv}
                  filename="keyword-rank-summary.csv"
                  mime="text/csv"
                  label="Download summary CSV"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl(csv);
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Add rank entries to start tracking"
          hint="Bulk import a CSV (keyword,position,date) or add single entries. Click 'Load sample' to try it out."
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.keywordsTracked} kw</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalEntries} entries</Badge>
                  {h.overallAverage !== null && <Badge variant="outline" className="mr-2">avg {h.overallAverage}</Badge>}
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
            <strong className="text-foreground">Privacy:</strong> All rank
            tracking runs locally — there is no live SERP API. History is stored
            in localStorage on this device only.
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
