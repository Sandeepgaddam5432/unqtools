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
  TIMELINE_PRESETS,
  parseEvents,
  sortEvents,
  getCategories,
  generateColorPalette,
  getColorForCategory,
  renderAscii,
  renderHtml,
  renderMarkdown,
  renderCsv,
  computeSpans,
  computeStats,
  searchEvents,
  computeEra,
  formatDateLabel,
  getPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ColorScheme,
  type SortDirection,
  type HistoryEntry,
} from "./logic";
import {
  History, GitCommitHorizontal, Search, Code, FileText,
} from "lucide-react";

type RenderMode = "ascii" | "html" | "markdown" | "csv";

export default function HistoryTimelineMaker() {
  const [title, setTitle] = useState("");
  const [eventsText, setEventsText] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("chronological");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("category");
  const [searchQuery, setSearchQuery] = useState("");
  const [renderMode, setRenderMode] = useState<RenderMode>("ascii");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.title) setTitle(p.title);
      if (p.events) setEventsText(p.events);
      if (p.sortDirection) setSortDirection(p.sortDirection);
      if (typeof p.groupByCategory === "boolean") setGroupByCategory(p.groupByCategory);
      if (p.colorScheme) setColorScheme(p.colorScheme);
      if (p.title || p.events) toast.info("Loaded from share link");
    }
  }, []);

  const allEvents = useMemo(() => parseEvents(eventsText), [eventsText]);
  const filteredEvents = useMemo(
    () => searchEvents(allEvents, searchQuery),
    [allEvents, searchQuery],
  );
  const sortedEvents = useMemo(
    () => sortEvents(filteredEvents, sortDirection),
    [filteredEvents, sortDirection],
  );
  const categories = useMemo(() => getCategories(allEvents), [allEvents]);
  const palette = useMemo(
    () => generateColorPalette(categories, colorScheme),
    [categories, colorScheme],
  );
  const stats = useMemo(() => computeStats(allEvents), [allEvents]);
  const spans = useMemo(() => computeSpans(allEvents), [allEvents]);

  const renderOutput = useMemo(() => {
    if (renderMode === "ascii") return renderAscii(sortedEvents, palette);
    if (renderMode === "html") return renderHtml(sortedEvents, palette, title || "Timeline");
    if (renderMode === "markdown") return renderMarkdown(sortedEvents, title || "Timeline");
    return renderCsv(sortedEvents);
  }, [renderMode, sortedEvents, palette, title]);

  const downloadFilename = useMemo(() => {
    const base = (title || "timeline").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timeline";
    const ext = renderMode === "markdown" ? "md" : renderMode === "ascii" ? "txt" : renderMode;
    return `${base}.${ext}`;
  }, [title, renderMode]);

  const downloadMime = renderMode === "html" ? "text/html"
    : renderMode === "csv" ? "text/csv"
      : "text/plain";

  const handleSaveHistory = useCallback(() => {
    if (allEvents.length > 0) {
      saveHistory({
        ts: Date.now(),
        title: title || "Untitled timeline",
        eventCount: allEvents.length,
        dateRange: stats.earliestDate && stats.latestDate
          ? `${stats.earliestDate} – ${stats.latestDate}`
          : "",
      });
      setHistory(loadHistory());
    }
  }, [allEvents, title, stats]);

  const loadPreset = useCallback((id: string) => {
    const p = getPreset(id);
    if (!p) return;
    setTitle(p.title);
    setEventsText(p.events);
    toast.success(`Loaded preset: ${p.title}`);
  }, []);

  const handleClear = useCallback(() => {
    setTitle("");
    setEventsText("");
    setSearchQuery("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  // Grouped rendering for the visual preview
  const groupedForDisplay = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, typeof sortedEvents>();
    for (const e of sortedEvents) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedEvents, groupByCategory]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="htm-title">Timeline title</Label>
            <Input
              id="htm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. World War II"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="htm-events">
              Events (one per line, format: <code className="text-[10px]">date|title|description|category|importance(1-5)</code>)
            </Label>
            <Textarea
              id="htm-events"
              value={eventsText}
              onChange={(e) => setEventsText(e.target.value)}
              placeholder={"1939-09-01|World War II begins|Germany invades Poland|Military|5\n1945-08-06|Hiroshima|US drops atomic bomb|Military|5"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {TIMELINE_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => loadPreset(p.id)}
                >+ {p.title}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Sort direction</Label>
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                className="mt-1 w-full h-9 text-xs rounded border bg-background px-2"
              >
                <option value="chronological">Chronological (oldest first)</option>
                <option value="reverse-chronological">Reverse-chronological (newest first)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Color scheme</Label>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
                className="mt-1 w-full h-9 text-xs rounded border bg-background px-2"
              >
                <option value="category">Category-based (distinct)</option>
                <option value="rainbow">Rainbow (cycled)</option>
                <option value="mono">Monochrome (blues)</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                />
                Group by category
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {allEvents.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GitCommitHorizontal className="h-4 w-4" /> {stats.totalEvents} events
                {stats.earliestDate && stats.latestDate && (
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {stats.earliestDate} → {stats.latestDate} ({stats.spanYears}y span)
                  </Badge>
                )}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total events" value={stats.totalEvents} />
                <Stat label="Categories" value={Object.keys(stats.byCategory).length} />
                <Stat label="Span (years)" value={stats.spanYears} />
                <Stat label="Spans computed" value={spans.length} />
              </div>
              {Object.keys(stats.byCategory).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {Object.entries(stats.byCategory).map(([cat, n]) => (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="text-[10px]"
                      style={{ borderColor: getColorForCategory(cat, palette), color: getColorForCategory(cat, palette) }}
                    >
                      {cat}: {n}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="h-4 w-4" /> Visual preview ({sortedEvents.length})
                </h3>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events…"
                  className="h-8 max-w-[220px] text-xs"
                />
              </div>

              {/* Visual timeline (vertical cards) */}
              <div className="space-y-1 max-h-[400px] overflow-auto pr-2">
                {groupedForDisplay ? (
                  groupedForDisplay.map(([cat, evts]) => (
                    <div key={cat} className="mb-3">
                      <div
                        className="text-xs font-semibold uppercase tracking-wide mb-1"
                        style={{ color: getColorForCategory(cat, palette) }}
                      >
                        {cat} ({evts.length})
                      </div>
                      {evts.map((e) => (
                        <EventCard key={e.id} ev={e} color={getColorForCategory(e.category, palette)} era={computeEra(e.year, e.isBC)} />
                      ))}
                    </div>
                  ))
                ) : (
                  sortedEvents.map((e) => (
                    <EventCard key={e.id} ev={e} color={getColorForCategory(e.category, palette)} era={computeEra(e.year, e.isBC)} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Code className="h-4 w-4" /> Export
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(["ascii", "html", "markdown", "csv"] as RenderMode[]).map((m) => (
                    <Button
                      key={m}
                      variant={renderMode === m ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setRenderMode(m)}
                    >
                      {m === "ascii" ? "ASCII" : m === "html" ? "HTML" : m === "markdown" ? "MD" : "CSV"}
                    </Button>
                  ))}
                </div>
              </div>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words rounded border bg-muted/30 p-3 max-h-[300px] overflow-auto">
                {renderOutput}
              </pre>
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(); return renderOutput; }}
                  label="Copy output"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return renderOutput; }}
                  filename={downloadFilename}
                  mime={downloadMime}
                  label={`Download .${downloadFilename.split(".").pop()}`}
                />
                <DownloadButton
                  getText={() => renderHtml(sortedEvents, palette, title || "Timeline")}
                  filename={`${(title || "timeline").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "timeline"}.html`}
                  mime="text/html"
                  label="Download HTML"
                />
                <DownloadButton
                  getText={() => renderCsv(sortedEvents)}
                  filename={`${(title || "timeline").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "timeline"}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => { handleSaveHistory(); return buildShareUrl({ title, events: eventsText, sortDirection, groupByCategory, colorScheme }); }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter events to build a timeline"
          hint="One per line in format 'date|title|description|category|importance'. Dates may be year (1945), year-month (1945-08), full date (1945-08-06), or BC/AD (44 BC, 1500 AD). Click a preset above to load a sample."
          icon={<FileText className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.eventCount} events</Badge>
                  <span className="font-medium text-foreground">{h.title}</span>
                  {h.dateRange && <span className="text-muted-foreground ml-2">· {h.dateRange}</span>}
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
            <strong className="text-foreground">Privacy:</strong> All parsing, sorting, and rendering runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EventCard({
  ev,
  color,
  era,
}: {
  ev: ReturnType<typeof parseEvents>[number];
  color: string;
  era: string;
}) {
  const label = formatDateLabel(
    { sortKey: ev.sortKey, year: ev.year, month: ev.month, day: ev.day, isBC: ev.isBC },
    ev.rawDate,
  );
  const stars = "★".repeat(ev.importance) + "☆".repeat(5 - ev.importance);
  return (
    <div
      className="flex gap-3 rounded border bg-background px-3 py-2 text-xs"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="font-mono text-muted-foreground w-28 flex-shrink-0">{label}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground flex items-center gap-2">
          <span className="truncate">{ev.title}</span>
          <span className="text-amber-500 text-[10px]">{stars}</span>
        </div>
        {ev.description && <div className="text-muted-foreground text-[11px] mt-0.5">{ev.description}</div>}
        <div className="text-[10px] text-muted-foreground mt-0.5">
          <span className="font-medium" style={{ color }}>{ev.category}</span> · {era}
        </div>
      </div>
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
