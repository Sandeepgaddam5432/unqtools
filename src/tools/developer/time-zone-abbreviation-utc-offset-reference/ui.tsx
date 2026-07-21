"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  SEARCH_FIELDS,
  ZONE_ENTRIES,
  RECENTLY_CHANGED_ZONES,
  formatOffset,
  parseOffset,
  search,
  disambiguate,
  allAbbreviations,
  ambiguousAbbreviations,
  nowInZone,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SearchField,
  type HistoryEntry,
} from "./logic";
import {
  History, Globe, Search, AlertTriangle, Info, Sparkles, Pause, Play, Copy,
} from "lucide-react";

export default function TimeZoneAbbreviationUtcOffsetReference() {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField | "any">("any");
  const [offsetFilter, setOffsetFilter] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Live "now" readout for selected zones
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.query) setQuery(p.query);
      if (p.field !== "any") setField(p.field);
      if (p.offsetMinutes !== null) setOffsetFilter(p.offsetMinutes);
      if (p.query || p.field !== "any" || p.offsetMinutes !== null) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Search result
  const result = useMemo(() => {
    if (!query.trim() && offsetFilter === null) return null;
    return search({ query, field, offsetMinutes: offsetFilter }, new Date(nowTick));
  }, [query, field, offsetFilter, nowTick]);

  // Live "now" for common reference zones
  const referenceZones = useMemo(() => {
    const zones = ["Etc/UTC", "America/New_York", "Europe/London", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney", "Pacific/Honolulu"];
    return zones.map((z) => nowInZone(z, new Date(nowTick))).filter((n) => n !== null);
  }, [nowTick]);

  const ambigList = useMemo(() => ambiguousAbbreviations().slice(0, 12), []);

  const handleSaveHistory = useCallback(() => {
    if (!query.trim() && offsetFilter === null) return;
    saveHistory({
      ts: Date.now(),
      query: query || (offsetFilter !== null ? formatOffset(offsetFilter) : ""),
      field,
      matchCount: result?.total ?? 0,
    });
    setHistory(loadHistory());
  }, [query, offsetFilter, field, result]);

  const handleClear = useCallback(() => {
    setQuery("");
    setOffsetFilter(null);
    setField("any");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleOffsetChip = (mins: number) => {
    setField("offset");
    setQuery(formatOffset(mins));
    setOffsetFilter(null);
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Live "now" in reference zones */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> Now in major zones (live)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)} className="gap-1.5">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {referenceZones.map((n) => (
              <div key={n!.ianaZone} className="rounded border bg-background px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{n!.ianaZone}</span>
                  {n!.dstActive && (
                    <Badge variant="secondary" className="text-[9px] text-amber-700 dark:text-amber-400">DST</Badge>
                  )}
                </div>
                <div className="font-mono text-foreground">{n!.timeStr.slice(11)}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{n!.offsetStr}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tz-query">Search time zones</Label>
            <div className="flex gap-2">
              <Input
                id="tz-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. CST, India, America/Chicago, +5:30"
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" aria-label="search">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Search field</Label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value as SearchField | "any")}
                className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
              >
                {SEARCH_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Quick offset filter</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {[-600, -300, 0, 60, 330, 540, 480].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleOffsetChip(m)}
                    className="text-[10px] rounded border bg-background px-2 py-1 hover:bg-accent font-mono"
                    title={`Show all UTC${formatOffset(m)} zones`}
                  >
                    {formatOffset(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Tip: search by abbreviation to see disambiguation candidates (e.g. <span className="font-mono">CST</span> shows Central US, China, Cuba, …).
            Search by offset like <span className="font-mono">+5:30</span> to list every zone at that offset.
          </p>
        </CardContent>
      </Card>

      {/* Results */}
      {result && result.total === 0 && (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              title="No matches"
              hint="Try a different abbreviation, IANA id, city name, or UTC offset like '+5:30'."
              icon={<Search className="h-8 w-8" />}
            />
          </CardContent>
        </Card>
      )}

      {result && result.total > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{result.total} zone{result.total === 1 ? "" : "s"}</Badge>
              <Badge variant="outline" className="text-[10px]">{result.distinctAbbrs.length} abbr{result.distinctAbbrs.length === 1 ? "" : "s"}</Badge>
              {result.ambiguous && (
                <Badge variant="secondary" className="text-[10px] gap-1 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Ambiguous abbreviation
                </Badge>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">Updated: {new Date(nowTick).toISOString().slice(0, 19)}Z</span>
            </div>

            {result.ambiguous && result.distinctAbbrs.length === 1 && (
              <AmbiguityBanner abbr={result.distinctAbbrs[0]} />
            )}

            <div className="space-y-1 max-h-[500px] overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-2">Abbr</th>
                    <th className="p-2">IANA Zone</th>
                    <th className="p-2">Full name</th>
                    <th className="p-2">Std</th>
                    <th className="p-2">DST</th>
                    <th className="p-2">Now</th>
                    <th className="p-2">Region</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((row, i) => (
                    <tr key={`${row.ianaZone}-${i}`} className="border-t hover:bg-accent/30">
                      <td className="p-2 font-mono font-semibold text-foreground">{row.abbr}</td>
                      <td className="p-2 font-mono text-foreground">{row.ianaZone}</td>
                      <td className="p-2 text-muted-foreground truncate max-w-[240px]">{row.fullName}</td>
                      <td className="p-2 font-mono">{row.standardOffsetStr}</td>
                      <td className="p-2 font-mono">
                        {row.observesDst ? row.dstOffsetStr : "—"}
                        {row.dstActive && <Badge variant="secondary" className="ml-1 text-[9px] text-amber-700 dark:text-amber-400">on</Badge>}
                      </td>
                      <td className="p-2 font-mono">
                        <div>{row.currentTimeStr.slice(11)}</div>
                        <div className="text-[10px] text-muted-foreground">{row.currentOffsetStr}</div>
                      </td>
                      <td className="p-2 text-muted-foreground">{row.region}</td>
                      <td className="p-2">
                        <CopyButton getText={() => row.ianaZone} label="" size="icon-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length > 200 && (
              <p className="text-[10px] text-muted-foreground">
                Showing first 200 of {result.rows.length} zones. Refine your search or export for the full list.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return result.rows.map((r) => `${r.abbr}\t${r.ianaZone}\t${r.standardOffsetStr}\t${r.dstOffsetStr}\t${r.fullName}`).join("\n");
                }}
                label="Copy TSV"
              />
              <DownloadButton
                getText={() => JSON.stringify(result.rows, null, 2)}
                filename="tz-zones.json"
                mime="application/json"
                label="Download JSON"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(query, field, offsetFilter); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ambiguous abbreviations quick reference */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4" /> Ambiguous abbreviations
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {ambigList.map((a) => (
              <button
                key={a.abbr}
                onClick={() => { setField("any"); setQuery(a.abbr); }}
                className="text-[11px] rounded border bg-background px-2 py-1 hover:bg-accent font-mono"
                title={`${a.abbr} has ${a.count} candidate zones`}
              >
                {a.abbr} <span className="text-muted-foreground">({a.count})</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            These abbreviations have multiple candidate IANA zones. Click to disambiguate.
          </p>
        </CardContent>
      </Card>

      {/* Recently changed zones */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Recently changed zones (indicative)
          </h3>
          <div className="space-y-1 max-h-[200px] overflow-auto">
            {RECENTLY_CHANGED_ZONES.map((z, i) => (
              <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-mono">{z.year}</Badge>
                  <span className="font-mono text-foreground">{z.ianaZone}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{z.change}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Database coverage</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Total entries" value={ZONE_ENTRIES.length} />
            <Stat label="Distinct abbreviations" value={allAbbreviations().length} />
            <Stat label="Recently changed" value={RECENTLY_CHANGED_ZONES.length} />
          </div>
        </CardContent>
      </Card>

      {/* History */}
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
                  onClick={() => { setQuery(h.query); setField(h.field); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.field}</Badge>
                    <span className="font-mono text-foreground truncate max-w-[200px]">{h.query}</span>
                    <span className="ml-auto text-muted-foreground">{h.matchCount} match{h.matchCount === 1 ? "" : "es"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All timezone lookups use Intl.DateTimeFormat
            and a bundled abbreviation→IANA zone map. The tool never makes a network request. Your search
            history is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AmbiguityBanner({ abbr }: { abbr: string }) {
  const info = useMemo(() => disambiguate(abbr), [abbr]);
  if (!info) return null;
  return (
    <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
      <div className="space-y-1">
        <strong className="text-foreground">{info.abbr}</strong> is ambiguous — it can mean any of {info.candidates.length} zones across {info.regions.join(", ")}.
        <div className="flex flex-wrap gap-1 mt-1">
          {info.candidates.map((c) => (
            <span key={c.ianaZone} className="text-[10px] rounded bg-background border px-1.5 py-0.5 font-mono">
              {c.ianaZone} <span className="text-muted-foreground">({c.region})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
