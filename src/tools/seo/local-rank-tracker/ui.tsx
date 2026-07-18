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
  parseKeywords,
  parseLocations,
  parseManualEntries,
  scoreAll,
  generateMatrix,
  filterEntries,
  computeSummaryStats,
  averagePerKeyword,
  averagePerLocation,
  renderText,
  renderCsv,
  generateTemplate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  todayIso,
  type FilterMode,
  type HistoryEntry,
} from "./logic";
import { MapPin, History, FileSpreadsheet, Trophy, AlertTriangle } from "lucide-react";

export default function LocalRankTracker() {
  const [keywordsText, setKeywordsText] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [manualCsv, setManualCsv] = useState("");
  const [date, setDate] = useState(todayIso());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.keywords) setKeywordsText(p.keywords);
      if (p.locations) setLocationsText(p.locations);
      if (p.manual) setManualCsv(p.manual);
      if (p.keywords || p.locations || p.manual) toast.info("Loaded from share link");
    }
  }, []);

  const keywords = useMemo(() => parseKeywords(keywordsText), [keywordsText]);
  const locations = useMemo(() => parseLocations(locationsText), [locationsText]);

  const entries = useMemo(() => {
    const manual = parseManualEntries(manualCsv);
    if (manual.length > 0) return manual;
    if (keywords.length === 0 || locations.length === 0) return [];
    return generateMatrix(keywords, locations, date);
  }, [manualCsv, keywords, locations, date]);

  const scored = useMemo(() => scoreAll(entries), [entries]);
  const filtered = useMemo(() => filterEntries(scored, filterMode), [scored, filterMode]);
  const stats = useMemo(() => computeSummaryStats(scored), [scored]);
  const kwAvgs = useMemo(() => averagePerKeyword(scored), [scored]);
  const locAvgs = useMemo(() => averagePerLocation(scored), [scored]);

  const text = useMemo(() => renderText(filtered), [filtered]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);
  const template = useMemo(
    () => generateTemplate(keywords, locations, date),
    [keywords, locations, date],
  );

  const hasManual = parseManualEntries(manualCsv).length > 0;

  const handleSaveHistory = useCallback(() => {
    if (scored.length > 0) {
      saveHistory({
        ts: Date.now(),
        keywords,
        locations,
        totalEntries: scored.length,
        avgVisibility: stats.avgVisibility,
      });
      setHistory(loadHistory());
    }
  }, [scored, keywords, locations, stats]);

  const handleClear = useCallback(() => {
    setKeywordsText("");
    setLocationsText("");
    setManualCsv("");
    setFilterMode("all");
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
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lrt-keywords">Keywords (one per line or comma-separated)</Label>
              <Textarea
                id="lrt-keywords"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder={"pizza delivery\nplumbing services\nhvac repair"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
              <div className="text-[10px] text-muted-foreground">
                {keywords.length} keyword(s)
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lrt-locations">Locations (one per line, City, State)</Label>
              <Textarea
                id="lrt-locations"
                value={locationsText}
                onChange={(e) => setLocationsText(e.target.value)}
                placeholder={"Austin, TX\nDallas, TX\nSeattle, WA"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
              <div className="text-[10px] text-muted-foreground">
                {locations.length} location(s)
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lrt-manual" className="text-xs">
                Manual entries CSV (optional — overrides matrix)
              </Label>
              <Textarea
                id="lrt-manual"
                value={manualCsv}
                onChange={(e) => setManualCsv(e.target.value)}
                placeholder={"keyword,location,local_pack_pos,organic_pos,date\npizza delivery,Austin TX,1,5,2024-01-15"}
                className="min-h-[100px] resize-y font-mono text-[10px]"
              />
              <div className="text-[10px] text-muted-foreground">
                {hasManual ? "Using manual entries" : "Empty — generating tracking matrix"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lrt-date" className="text-xs">Default date for matrix</Label>
              <Input
                id="lrt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {scored.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {scored.length} tracked entries
                {hasManual && <Badge variant="secondary" className="text-[10px]">manual</Badge>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Total tracked" value={stats.totalTracked} />
                <Stat label="Avg visibility" value={stats.avgVisibility} highlight={stats.avgVisibility >= 50 ? "good" : "bad"} />
                <Stat label="Top-pack entries" value={stats.topPackCount} />
                <Stat label="Page-1 organic" value={stats.page1Count} />
              </div>
              {(stats.bestCombo || stats.worstCombo) && (
                <div className="grid sm:grid-cols-2 gap-2 pt-1">
                  {stats.bestCombo && (
                    <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                        <Trophy className="h-3.5 w-3.5" /> Best
                      </div>
                      <div className="mt-0.5">{stats.bestCombo.keyword} @ {stats.bestCombo.location}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Visibility {stats.bestCombo.visibilityScore} · LP #{stats.bestCombo.localPackPosition ?? "-"} · Org #{stats.bestCombo.organicPosition ?? "-"}
                      </div>
                    </div>
                  )}
                  {stats.worstCombo && (
                    <div className="rounded border bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" /> Worst
                      </div>
                      <div className="mt-0.5">{stats.worstCombo.keyword} @ {stats.worstCombo.location}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Visibility {stats.worstCombo.visibilityScore} · LP #{stats.worstCombo.localPackPosition ?? "-"} · Org #{stats.worstCombo.organicPosition ?? "-"}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {(kwAvgs.length > 0 || locAvgs.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              {kwAvgs.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per Keyword</h4>
                    {kwAvgs.map((k) => (
                      <div key={k.keyword} className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs">
                        <span className="font-mono text-foreground truncate">{k.keyword}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">avg {k.avgVisibility}</Badge>
                          <Badge variant="secondary" className="text-[10px]">n={k.count}</Badge>
                          {k.topPackCount > 0 && <Badge className="text-[10px] bg-emerald-600">{k.topPackCount} top</Badge>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {locAvgs.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per Location</h4>
                    {locAvgs.map((l) => (
                      <div key={l.location} className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs">
                        <span className="font-mono text-foreground truncate">{l.location}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">avg {l.avgVisibility}</Badge>
                          <Badge variant="secondary" className="text-[10px]">n={l.count}</Badge>
                          {l.topPackCount > 0 && <Badge className="text-[10px] bg-emerald-600">{l.topPackCount} top</Badge>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" /> Entries ({filtered.length})
                </h3>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="all">All entries</option>
                  <option value="top-pack">Top pack only (LP 1-3)</option>
                  <option value="page-1">Page 1 only (Org 1-10)</option>
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filtered.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <span className="font-mono text-foreground truncate flex-1">{e.keyword} @ {e.location}</span>
                    <Badge variant={e.localPackCategory === "top-pack" ? "default" : e.localPackCategory === "below-pack" ? "secondary" : "outline"} className="text-[10px]">
                      LP {e.localPackPosition ?? "-"}
                    </Badge>
                    <Badge variant={e.organicCategory === "page-1" ? "default" : e.organicCategory === "page-2" ? "secondary" : "outline"} className="text-[10px]">
                      Org {e.organicPosition ?? "-"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] w-10 text-center">{e.visibilityScore}</Badge>
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
                  filename="local-rank-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="local-rank.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => template}
                  filename="local-rank-template.csv"
                  mime="text/csv"
                  label="Download template"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(keywordsText, locationsText, manualCsv); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter keywords and locations to track local rankings"
          hint="Add keywords (one per line) and locations (one per line as 'City, State'). The tool builds a keyword x location matrix. Or paste manual entries as CSV with columns: keyword, location, local_pack_pos, organic_pos, date."
          icon={<MapPin className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalEntries} entries</Badge>
                  <Badge variant="outline" className="mr-2">avg {h.avgVisibility}</Badge>
                  <span className="text-muted-foreground">{h.keywords.length} kw × {h.locations.length} loc</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, scoring, and reporting happens locally in your browser. History is stored in localStorage on this device only.
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
