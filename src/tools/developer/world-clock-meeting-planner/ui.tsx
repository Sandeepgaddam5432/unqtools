"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  DEFAULT_WORK_HOURS,
  DEFAULT_DURATION_MINUTES,
  searchCities,
  cityForZone,
  isValidZone,
  computeGrid,
  findBestSlots,
  renderSlotSummary,
  renderIcs,
  buildGoogleCalendarUrl,
  buildOutlookUrl,
  nowInZones,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parseDateUtc,
  type WorkHours,
  type IcsEvent,
  type HistoryEntry,
} from "./logic";
import { History, Globe, Clock, Search, Plus, X, Calendar } from "lucide-react";

type Tab = "planner" | "worldclock";

export default function WorldClockMeetingPlanner() {
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  const [tab, setTab] = useState<Tab>("planner");
  const [zones, setZones] = useState<string[]>([
    "America/New_York", "Europe/London", "Asia/Kolkata",
  ]);
  const [dateStr, setDateStr] = useState<string>(todayStr);
  const [startHour, setStartHour] = useState<number>(DEFAULT_WORK_HOURS.startHour);
  const [endHour, setEndHour] = useState<number>(DEFAULT_WORK_HOURS.endHour);
  const [weekendDays, setWeekendDays] = useState<number[]>(DEFAULT_WORK_HOURS.weekendDays);
  const [durationMin, setDurationMin] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [lockedHour, setLockedHour] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.zones.length > 0) setZones(p.zones);
        if (p.date) setDateStr(p.date);
        if (typeof p.startHour === "number") setStartHour(p.startHour);
        if (typeof p.endHour === "number") setEndHour(p.endHour);
        if (p.weekendDays && p.weekendDays.length > 0) setWeekendDays(p.weekendDays);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const workHours: WorkHours = useMemo(
    () => ({ startHour, endHour, weekendDays }),
    [startHour, endHour, weekendDays],
  );

  const dateMs = useMemo(() => parseDateUtc(dateStr), [dateStr]);
  const dateValid = useMemo(() => !Number.isNaN(dateMs), [dateMs]);

  const grid = useMemo(
    () => (dateValid ? computeGrid(zones, dateMs, workHours) : []),
    [zones, dateMs, dateValid, workHours],
  );
  const slots = useMemo(
    () => (dateValid && zones.length > 0 ? findBestSlots(zones, dateMs, workHours, 5) : []),
    [zones, dateMs, dateValid, workHours],
  );

  const lockedSlot = useMemo(() => {
    if (lockedHour === null) return null;
    return slots.find((s) => s.utcHour === lockedHour) ?? null;
  }, [slots, lockedHour]);

  // Refresh "now" every 30 seconds in world-clock tab.
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    if (tab !== "worldclock") return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [tab]);

  const nowEntries = useMemo(
    () => nowInZones(zones, nowTick),
    [zones, nowTick],
  );

  const cityResults = useMemo(() => searchCities(query, 10), [query]);

  const addZone = useCallback((z: string) => {
    if (!isValidZone(z)) {
      toast.error(`Unknown zone: ${z}`);
      return;
    }
    setZones((prev) => (prev.includes(z) ? prev : [...prev, z]));
    setQuery("");
    if (searchRef.current) searchRef.current.focus();
  }, []);

  const removeZone = useCallback((z: string) => {
    setZones((prev) => prev.filter((x) => x !== z));
  }, []);

  const toggleWeekend = (dayNum: number) => {
    setWeekendDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort(),
    );
  };

  const handleSaveHistory = useCallback(() => {
    if (zones.length > 0 && dateValid) {
      saveHistory({
        ts: Date.now(),
        zones,
        date: dateStr,
        topScore: slots[0]?.score ?? 0,
      });
      setHistory(loadHistory());
    }
  }, [zones, dateValid, dateStr, slots]);

  const handleClear = useCallback(() => {
    setZones([]);
    setLockedHour(null);
    setQuery("");
    toast.info("Cleared cities");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSwap = useCallback((i: number, j: number) => {
    setZones((prev) => {
      if (i < 0 || j < 0 || i >= prev.length || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  // ----- Calendar export for locked slot -----
  const lockedIcsEvent: IcsEvent | null = useMemo(() => {
    if (!lockedSlot || !dateValid) return null;
    return {
      title: "Team Meeting",
      startUtcMs: dateMs + lockedSlot.utcHour * 3_600_000,
      durationMinutes: durationMin,
      description: renderSlotSummary(lockedSlot, durationMin),
    };
  }, [lockedSlot, dateMs, dateValid, durationMin]);

  const weekendLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tab === "planner" ? "default" : "outline"}
              onClick={() => setTab("planner")}
              className="gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" /> Meeting Planner
            </Button>
            <Button
              size="sm"
              variant={tab === "worldclock" ? "default" : "outline"}
              onClick={() => setTab("worldclock")}
              className="gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" /> World Clock
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wcmp-search">Add city (search 400+ cities)</Label>
            <Input
              id="wcmp-search"
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cityResults[0]) {
                  e.preventDefault();
                  addZone(cityResults[0].zone);
                }
              }}
              placeholder="Search: Tokyo, Mumbai, Sao Paulo…"
              className="text-sm"
            />
            {query && cityResults.length > 0 && (
              <div className="rounded border bg-background max-h-[200px] overflow-auto">
                {cityResults.map((c) => (
                  <button
                    key={`${c.zone}|${c.city}`}
                    onClick={() => addZone(c.zone)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-foreground">{c.city}</span>
                    <span className="text-muted-foreground">{c.country}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{c.zone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Participants ({zones.length})</Label>
            <div className="space-y-1 max-h-[180px] overflow-auto">
              {zones.map((z, i) => {
                const c = cityForZone(z);
                return (
                  <div key={z} className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs">
                    <button
                      onClick={() => handleSwap(i, i - 1)}
                      disabled={i === 0}
                      className="text-[10px] px-1 disabled:opacity-30"
                      title="Move up"
                    >↑</button>
                    <button
                      onClick={() => handleSwap(i, i + 1)}
                      disabled={i === zones.length - 1}
                      className="text-[10px] px-1 disabled:opacity-30"
                      title="Move down"
                    >↓</button>
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-foreground">{c?.city ?? z}</span>
                    <span className="text-muted-foreground">{c?.country ?? ""}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{z}</span>
                    <button
                      onClick={() => removeZone(z)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {zones.length === 0 && (
                <div className="text-xs text-muted-foreground italic p-2">No participants yet — search above to add.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {tab === "planner" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="wcmp-date" className="text-xs">Date</Label>
                  <Input
                    id="wcmp-date"
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wcmp-sh" className="text-xs">Work start</Label>
                  <Input
                    id="wcmp-sh"
                    type="number"
                    min={0}
                    max={23}
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wcmp-eh" className="text-xs">Work end</Label>
                  <Input
                    id="wcmp-eh"
                    type="number"
                    min={1}
                    max={24}
                    value={endHour}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wcmp-dur" className="text-xs">Duration (min)</Label>
                  <Input
                    id="wcmp-dur"
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value) || 60)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weekend days (click to toggle)</Label>
                <div className="flex gap-1 flex-wrap">
                  {weekendLabels.map((lbl, i) => (
                    <button
                      key={i}
                      onClick={() => toggleWeekend(i)}
                      className={`h-7 px-2 rounded text-xs border ${weekendDays.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {zones.length === 0 || !dateValid ? (
            <EmptyState
              title="Add participants and pick a date"
              hint="Search cities above. The grid shows 24 UTC hours per participant, color-coded by work/off/sleep."
              icon={<Globe className="h-8 w-8" />}
            />
          ) : (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> 24-hour overlap grid
                    </h3>
                    <div className="flex gap-2 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">work</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">off</span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300">sleep</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-[10px] border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-1 sticky left-0 bg-background z-10">Participant</th>
                          {Array.from({ length: 24 }, (_, h) => (
                            <th
                              key={h}
                              className={`p-1 text-center font-mono cursor-pointer ${lockedHour === h ? "bg-primary text-primary-foreground" : ""}`}
                              onClick={() => setLockedHour(lockedHour === h ? null : h)}
                              title="Click to lock this hour"
                            >
                              {String(h).padStart(2, "0")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grid.map((row) => (
                          <tr key={row.zone}>
                            <td className="p-1 sticky left-0 bg-background z-10 whitespace-nowrap">
                              <div className="font-medium text-foreground">{row.city}</div>
                              <div className="text-[9px] text-muted-foreground font-mono">{row.parts.offsetLabel} {row.parts.abbreviation}</div>
                            </td>
                            {row.cells.map((cell) => {
                              const bg =
                                cell.classification === "work"
                                  ? "bg-emerald-500/30"
                                  : cell.classification === "off"
                                    ? "bg-amber-500/20"
                                    : "bg-rose-500/20";
                              return (
                                <td
                                  key={cell.utcHour}
                                  className={`p-1 text-center font-mono ${bg} ${lockedHour === cell.utcHour ? "ring-1 ring-primary" : ""}`}
                                  title={`${row.city} ${String(cell.localHour).padStart(2, "0")}:00 — ${cell.classification}`}
                                >
                                  {String(cell.localHour).padStart(2, "0")}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Columns are UTC hours of {dateStr}. Each cell shows the local hour for that participant. Click a column header to lock a candidate slot.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Search className="h-4 w-4" /> Top {slots.length} suggested slots
                  </h3>
                  <div className="space-y-1">
                    {slots.map((s) => (
                      <button
                        key={s.utcHour}
                        onClick={() => setLockedHour(s.utcHour)}
                        className={`w-full text-left rounded border px-3 py-2 text-xs ${lockedHour === s.utcHour ? "border-primary bg-primary/5" : "bg-background"}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={s.allInWorkHours ? "default" : "secondary"} className="text-[10px]">
                            {s.allInWorkHours ? "★ All overlap" : `${s.overlapCount}/${s.totalParticipants} in work hours`}
                          </Badge>
                          <span className="font-mono font-medium text-foreground">UTC {String(s.utcHour).padStart(2, "0")}:00</span>
                          <span className="text-muted-foreground">· score {s.score}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                          {s.locals.map((lt) => (
                            <span key={lt.zone} className="font-mono">
                              {lt.city} {lt.weekdayLabel} {String(lt.localHour).padStart(2, "0")}:00
                              <span className={lt.classification === "work" ? "text-emerald-600 dark:text-emerald-400" : lt.classification === "sleep" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}>
                                {" "}({lt.classification})
                              </span>
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {lockedSlot && lockedIcsEvent && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" /> Locked slot — UTC {String(lockedSlot.utcHour).padStart(2, "0")}:00
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setLockedHour(null)}>Unlock</Button>
                    </div>
                    <div className="rounded border bg-background p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                      {renderSlotSummary(lockedSlot, durationMin)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton
                        getText={() => { handleSaveHistory(); return renderSlotSummary(lockedSlot, durationMin); }}
                        label="Copy summary"
                      />
                      <DownloadButton
                        getText={() => { handleSaveHistory(); return renderIcs(lockedIcsEvent); }}
                        filename="meeting.ics"
                        mime="text/calendar"
                        label="Download .ics"
                      />
                      <a
                        href={buildGoogleCalendarUrl(lockedIcsEvent)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Google
                      </a>
                      <a
                        href={buildOutlookUrl(lockedIcsEvent)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Outlook
                      </a>
                      <ShareButton
                        getUrl={() => { handleSaveHistory(); return buildShareUrl({ zones, date: dateStr, startHour, endHour, weekendDays }); }}
                      />
                      <ClearButton onClick={handleClear} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {tab === "worldclock" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Current time across {zones.length} zones
            </h3>
            {zones.length === 0 ? (
              <EmptyState
                title="Add cities to see live world clocks"
                hint="Search above. Each clock updates every 30 seconds."
                icon={<Clock className="h-8 w-8" />}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {nowEntries.map((e) => (
                  <div key={e.zone} className={`rounded border p-3 ${e.isDaytime ? "bg-amber-500/5" : "bg-indigo-500/5"}`}>
                    <div className="flex items-center gap-2">
                      <Globe className={`h-3.5 w-3.5 ${e.isDaytime ? "text-amber-500" : "text-indigo-500"}`} />
                      <span className="text-sm font-semibold text-foreground">{e.city}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{e.country}</div>
                    <div className="text-xl font-mono mt-1 text-foreground">
                      {String(e.parts.hour).padStart(2, "0")}:{String(e.parts.minute).padStart(2, "0")}:{String(e.parts.second).padStart(2, "0")}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {e.parts.weekdayShort} {e.parts.year}-{String(e.parts.month).padStart(2, "0")}-{String(e.parts.day).padStart(2, "0")}
                      {" · "}UTC{e.parts.offsetLabel} {e.parts.abbreviation}
                      {e.parts.dstActive ? " · DST" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.zones.length} zones</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">score {h.topScore}</Badge>
                  <span className="text-muted-foreground">{h.date}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{h.zones.join(", ")}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All time-zone math runs locally via Intl + IANA database. The shareable URL is fragment-encoded (never sent to server). History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
