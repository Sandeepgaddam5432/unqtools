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
  CITY_DATABASE,
  IANA_ZONES,
  searchCities,
  searchZones,
  isValidZone,
  getZoneParts,
  convertTime,
  nowInZone,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CityEntry,
  type HistoryEntry,
} from "./logic";
import { History, Globe, Clock, Search, AlertTriangle, Plus, X, MapPin } from "lucide-react";

type Tab = "convert" | "now";

export default function TimeZoneConverter() {
  const [tab, setTab] = useState<Tab>("convert");
  const now = new Date();
  const [sourceZone, setSourceZone] = useState("America/New_York");
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [day, setDay] = useState(now.getUTCDate());
  const [hour, setHour] = useState(now.getUTCHours());
  const [minute, setMinute] = useState(now.getUTCMinutes());
  const [second, setSecond] = useState(now.getUTCSeconds());
  const [targetZones, setTargetZones] = useState<string[]>([
    "Europe/London", "Asia/Kolkata", "Asia/Tokyo",
  ]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        setSourceZone(p.sourceZone);
        setYear(p.year); setMonth(p.month); setDay(p.day);
        setHour(p.hour); setMinute(p.minute); setSecond(p.second);
        if (p.targetZones.length > 0) setTargetZones(p.targetZones);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const convertInput = useMemo(() => ({
    sourceZone, year, month, day, hour, minute, second, targetZones,
  }), [sourceZone, year, month, day, hour, minute, second, targetZones]);

  const result = useMemo(() => convertTime(convertInput), [convertInput]);

  const handleSaveHistory = useCallback(() => {
    if (result.ok) {
      saveHistory({
        ts: Date.now(),
        sourceZone,
        targetZones,
        instantMs: result.sourceInstantMs,
        iso: new Date(result.sourceInstantMs).toISOString(),
      });
      setHistory(loadHistory());
    }
  }, [result, sourceZone, targetZones]);

  const handleClear = useCallback(() => {
    setTargetZones([]);
    toast.info("Cleared targets");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const addTargetZone = (z: string) => {
    if (!isValidZone(z)) {
      toast.error(`Unknown zone: ${z}`);
      return;
    }
    if (targetZones.includes(z)) {
      toast.info("Already added");
      return;
    }
    setTargetZones((prev) => [...prev, z]);
  };

  const removeTargetZone = (z: string) => {
    setTargetZones((prev) => prev.filter((x) => x !== z));
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {(["convert", "now"] as Tab[]).map((t) => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
              >
                {t === "convert" && "Convert a time"}
                {t === "now" && "World clock (now)"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "convert" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <ZonePicker
                label="Source time zone"
                value={sourceZone}
                onChange={setSourceZone}
              />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <NumField label="Year" value={year} onChange={setYear} />
                <NumField label="Month" value={month} onChange={setMonth} min={1} max={12} />
                <NumField label="Day" value={day} onChange={setDay} min={1} max={31} />
                <NumField label="Hour" value={hour} onChange={setHour} min={0} max={23} />
                <NumField label="Min" value={minute} onChange={setMinute} min={0} max={59} />
                <NumField label="Sec" value={second} onChange={setSecond} min={0} max={59} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Wall-clock time in the source zone (e.g. 12:30 in New York). DST transitions are auto-detected.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Target zones ({targetZones.length})
                </h3>
                <ClearButton onClick={handleClear} label="Clear" />
              </div>
              <ZonePicker
                label="Add a target zone"
                value=""
                onChange={addTargetZone}
                placeholder="Search city or IANA zone…"
              />
              <div className="flex flex-wrap gap-1.5">
                {targetZones.map((z) => (
                  <Badge key={z} variant="secondary" className="gap-1 text-[11px]">
                    <MapPin className="h-3 w-3" />
                    {z}
                    <button onClick={() => removeTargetZone(z)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {targetZones.length === 0 && (
                  <span className="text-xs text-muted-foreground">No targets yet — add some above.</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "UTC"].map((z) => (
                  <Button
                    key={z}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => addTargetZone(z)}
                  >+ {z}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {!result.ok && <ErrorBanner message={result.error} />}

          {result.ok && (
            <>
              {result.ambiguity !== "unique" && (
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-foreground">
                          {result.ambiguity === "gap" ? "Spring-forward gap detected" : "Fall-back overlap detected"}
                        </strong>
                        <p className="text-muted-foreground mt-1">{result.ambiguityMessage}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> Source ({sourceZone})
                  </h3>
                  <ZoneRow
                    label={sourceZone}
                    parts={result.source}
                    diffLabel="reference"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Globe className="h-4 w-4" /> Targets
                  </h3>
                  {result.targets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Add target zones above to see conversions.</p>
                  ) : (
                    <div className="space-y-1">
                      {result.targets.map((p, i) => (
                        <ZoneRow
                          key={p.zone}
                          label={p.zone}
                          parts={p}
                          diffLabel={result.differences[i].label}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <CopyButton
                      getText={() => {
                        handleSaveHistory();
                        return result.source.iso;
                      }}
                      label="Copy source ISO"
                    />
                    <CopyButton
                      getText={() => result.targets.map((p) => `${p.zone}\t${p.iso}\t${p.abbreviation}\t${p.offsetLabel}`).join("\n")}
                      label="Copy targets as TSV"
                    />
                    <DownloadButton
                      getText={() => {
                        const lines = ["zone,iso,offset_minutes,abbreviation,dst_active,weekday,hour,minute"];
                        lines.push([result.source.zone, result.source.iso, result.source.offsetMinutes, result.source.abbreviation, result.source.dstActive, result.source.weekday, result.source.hour, result.source.minute].join(","));
                        for (const p of result.targets) {
                          lines.push([p.zone, p.iso, p.offsetMinutes, p.abbreviation, p.dstActive, p.weekday, p.hour, p.minute].join(","));
                        }
                        return lines.join("\n");
                      }}
                      filename="timezone-conversion.csv"
                      mime="text/csv"
                      label="Download CSV"
                    />
                    <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(convertInput); }} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {tab === "now" && (
        <NowView zones={[sourceZone, ...targetZones]} onAddZone={addTargetZone} />
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.sourceZone}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-foreground truncate max-w-[260px]">{h.targetZones.join(", ")}</span>
                    <span className="text-muted-foreground ml-auto">{h.iso}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All timezone math runs locally via Intl.DateTimeFormat with the IANA database bundled in your browser. History is stored in localStorage on this device only and contains metadata (zone ids + instant), never your notes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ZoneRow({
  label,
  parts,
  diffLabel,
}: {
  label: string;
  parts: ReturnType<typeof getZoneParts>;
  diffLabel: string;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-medium text-foreground">{label}</span>
        <Badge variant="outline" className="text-[10px] font-mono">{parts.offsetLabel}</Badge>
        <Badge variant="outline" className="text-[10px] font-mono">{parts.abbreviation}</Badge>
        {parts.dstActive ? (
          <Badge variant="secondary" className="text-[10px] text-amber-700 dark:text-amber-400">DST</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">standard</Badge>
        )}
        <span className="text-muted-foreground text-[10px] ml-auto">{diffLabel}</span>
      </div>
      <div className="mt-1 font-mono text-foreground text-sm">
        {parts.year}-{pad2(parts.month)}-{pad2(parts.day)} {pad2(parts.hour)}:{pad2(parts.minute)}:{pad2(parts.second)} {parts.weekdayShort}
      </div>
      <div className="font-mono text-muted-foreground text-[10px] mt-0.5">{parts.iso}</div>
    </div>
  );
}

function ZonePicker({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (z: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cityResults = useMemo<{ city: string; country: string; zone: string }[]>(() => {
    if (!query.trim() || query === value) return [];
    return searchCities(query, 8);
  }, [query, value]);

  const zoneResults = useMemo<string[]>(() => {
    if (!query.trim() || query === value) return [];
    // Only show zone matches that aren't already covered by city matches
    const cityZones = new Set(cityResults.map((c) => c.zone));
    return searchZones(query, 12).filter((z) => !cityZones.has(z));
  }, [query, value, cityResults]);

  const allResults = useMemo(() => {
    return [
      ...cityResults.map((c) => ({ type: "city" as const, ...c })),
      ...zoneResults.map((z) => ({ type: "zone" as const, zone: z, city: "", country: "" })),
    ];
  }, [cityResults, zoneResults]);

  const handleSelect = (item: { zone: string }) => {
    onChange(item.zone);
    setQuery(item.zone);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || allResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = allResults[activeIndex];
      if (sel) handleSelect(sel);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Search city or IANA zone…"}
          className="font-mono text-xs"
        />
        {open && allResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-[280px] overflow-auto rounded border bg-background shadow-md">
            {allResults.map((item, i) => (
              <button
                key={`${item.type}-${item.zone}-${i}`}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${i === activeIndex ? "bg-accent" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {item.type === "city" ? (
                  <span>
                    <MapPin className="inline h-3 w-3 mr-1" />
                    <strong className="text-foreground">{item.city}</strong>, {item.country}
                    <span className="text-muted-foreground ml-2 font-mono">{item.zone}</span>
                  </span>
                ) : (
                  <span className="font-mono text-foreground">{item.zone}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NowView({ zones, onAddZone }: { zones: string[]; onAddZone: (z: string) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused]);

  // Deduplicate zones, keep order, always include UTC
  const uniqueZones = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    if (!zones.includes("UTC")) out.push("UTC"), seen.add("UTC");
    for (const z of zones) {
      if (!seen.has(z)) { out.push(z); seen.add(z); }
    }
    return out;
  }, [zones]);

  const snapshots = useMemo(() => uniqueZones.map((z) => nowInZone(z)), [uniqueZones, now]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Current time across zones
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          UTC: {new Date(now).toISOString()}
        </div>
        <div className="space-y-1">
          {snapshots.map((s) => (
            <ZoneRow
              key={s.zone}
              label={s.zone}
              parts={s.parts}
              diffLabel={`UTC${s.parts.offsetLabel}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <CopyButton
            getText={() => snapshots.map((s) => `${s.zone}\t${s.parts.iso}`).join("\n")}
            label="Copy all as TSV"
          />
          <DownloadButton
            getText={() => snapshots.map((s) => `${s.zone},${s.parts.iso},${s.parts.offsetMinutes},${s.parts.abbreviation},${s.parts.dstActive}`).join("\n")}
            filename="world-clock.csv"
            mime="text/csv"
            label="Download CSV"
          />
        </div>
        <ZonePicker label="Add a zone" value="" onChange={onAddZone} />
        <p className="text-[10px] text-muted-foreground">
          {CITY_DATABASE.length}+ cities and {IANA_ZONES.length}+ IANA zones available via the search above.
        </p>
      </CardContent>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-9 font-mono text-xs"
      />
    </div>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
