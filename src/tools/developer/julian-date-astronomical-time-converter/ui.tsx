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
  CALENDAR_SYSTEMS,
  MODES,
  PRECISION_LEVELS,
  WEEKDAYS,
  MONTHS,
  J2000_JD,
  UNIX_EPOCH_JD,
  isLeapYear,
  daysInMonth,
  makeCalendar,
  parseCalendarString,
  parseJd,
  convertCalendar,
  convertFromJd,
  convertOrdinal,
  currentJd,
  currentMjd,
  formatFixed,
  formatConversionTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CalendarSystem,
  type Mode,
  type HistoryEntry,
} from "./logic";
import {
  History, CalendarClock, AlertTriangle, Info, Sparkles, Pause, Play,
} from "lucide-react";

export default function JulianDateAstronomicalTimeConverter() {
  const [mode, setMode] = useState<Mode>("calendar");
  const [calendarSystem, setCalendarSystem] = useState<CalendarSystem>("gregorian");
  const [precision, setPrecision] = useState(6);

  // Inputs per mode
  const [calInput, setCalInput] = useState("2025-01-01 00:00:00");
  const [jdInput, setJdInput] = useState("2460676.5");
  const [ordInput, setOrdInput] = useState("25001");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Live current-epoch readout
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMode(p.mode);
      setCalendarSystem(p.calendarSystem);
      setPrecision(p.precision);
      if (p.input) {
        if (p.mode === "calendar") setCalInput(p.input);
        if (p.mode === "jd") setJdInput(p.input);
        if (p.mode === "ordinal") setOrdInput(p.input);
      }
      if (p.input || p.mode !== "calendar" || p.calendarSystem !== "gregorian" || p.precision !== 6) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Calendar → JD
  const calResult = useMemo(() => {
    if (mode !== "calendar") return null;
    const parts = parseCalendarString(calInput);
    if (!parts) return { ok: false as const, error: "Could not parse date. Use YYYY-MM-DD HH:MM:SS." };
    return convertCalendar(parts, calendarSystem);
  }, [mode, calInput, calendarSystem]);

  // JD → calendar
  const jdResult = useMemo(() => {
    if (mode !== "jd") return null;
    const jd = parseJd(jdInput);
    if (jd === null) return { ok: false as const, error: "JD must be a number (e.g. 2460676.5)." };
    return convertFromJd(jd, calendarSystem);
  }, [mode, jdInput, calendarSystem]);

  // Ordinal → calendar
  const ordResult = useMemo(() => {
    if (mode !== "ordinal") return null;
    return convertOrdinal(ordInput);
  }, [mode, ordInput]);

  const currentJdNow = useMemo(() => currentJd(new Date(nowMs)), [nowMs]);
  const currentMjdNow = useMemo(() => currentMjd(new Date(nowMs)), [nowMs]);

  const handleSaveHistory = useCallback(() => {
    if (mode === "calendar" && calResult && calResult.ok) {
      saveHistory({
        ts: Date.now(),
        mode,
        calendarSystem,
        inputPreview: calInput.slice(0, 32),
        jd: calResult.jd,
      });
      setHistory(loadHistory());
    } else if (mode === "jd" && jdResult && jdResult.ok) {
      saveHistory({
        ts: Date.now(),
        mode,
        calendarSystem,
        inputPreview: jdInput.slice(0, 32),
        jd: jdResult.jd,
      });
      setHistory(loadHistory());
    } else if (mode === "ordinal" && ordResult && ordResult.ok) {
      saveHistory({
        ts: Date.now(),
        mode,
        calendarSystem,
        inputPreview: ordInput.slice(0, 32),
        jd: ordResult.jd,
      });
      setHistory(loadHistory());
    }
  }, [mode, calResult, jdResult, ordResult, calInput, jdInput, ordInput, calendarSystem]);

  const handleClear = useCallback(() => {
    setCalInput("");
    setJdInput("");
    setOrdInput("");
    setCalendarSystem("gregorian");
    setPrecision(6);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Live current JD / MJD readout */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" /> Current JD / MJD (live, UTC)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)} className="gap-1.5">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Julian Date (JD)</div>
              <div className="font-mono text-lg sm:text-xl text-foreground break-all">{formatFixed(currentJdNow, precision)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Modified JD (MJD)</div>
              <div className="font-mono text-lg sm:text-xl text-foreground break-all">{formatFixed(currentMjdNow, precision)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono">
              Unix ms: {nowMs}
            </Badge>
            <CopyButton getText={() => formatFixed(currentJdNow, precision)} label="Copy JD" size="sm" />
            <CopyButton getText={() => formatFixed(currentMjdNow, precision)} label="Copy MJD" size="sm" />
          </div>
        </CardContent>
      </Card>

      {/* Mode selector + calendar system + precision */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.value}
                variant={mode === m.value ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m.value)}
                title={m.hint}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Calendar system</Label>
              <select
                value={calendarSystem}
                onChange={(e) => setCalendarSystem(e.target.value as CalendarSystem)}
                className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
              >
                {CALENDAR_SYSTEMS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {CALENDAR_SYSTEMS.find((c) => c.value === calendarSystem)?.hint}
              </p>
            </div>
            <div>
              <Label className="text-xs">Decimal precision</Label>
              <select
                value={precision}
                onChange={(e) => setPrecision(parseInt(e.target.value, 10))}
                className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
              >
                {PRECISION_LEVELS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-muted-foreground">Fractional digits shown for JD/MJD/etc.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode: calendar → JD */}
      {mode === "calendar" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cal-input">Calendar date/time (UTC)</Label>
              <Input
                id="cal-input"
                value={calInput}
                onChange={(e) => setCalInput(e.target.value)}
                placeholder="YYYY-MM-DD HH:MM:SS  (e.g. 2025-01-01 00:00:00)"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Use negative year for BC (year 0 = 1 BC, year -44 = 45 BC). All time is interpreted as UTC.
              </p>
            </div>
            {calResult && !calResult.ok && <ErrorBanner message={calResult.error} />}
            {calResult && calResult.ok && (
              <ConversionView
                r={calResult}
                precision={precision}
                input={calInput}
                onSaveHistory={handleSaveHistory}
                onClear={handleClear}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Mode: JD → calendar */}
      {mode === "jd" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="jd-input">Julian Date (JD)</Label>
              <Input
                id="jd-input"
                value={jdInput}
                onChange={(e) => setJdInput(e.target.value)}
                placeholder="e.g. 2460676.5"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Astronomical Julian Date. Integer JD corresponds to noon UTC; .5 = midnight.
              </p>
            </div>
            {jdResult && !jdResult.ok && <ErrorBanner message={jdResult.error} />}
            {jdResult && jdResult.ok && (
              <ConversionView
                r={jdResult}
                precision={precision}
                input={jdInput}
                onSaveHistory={handleSaveHistory}
                onClear={handleClear}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Mode: ordinal YYDDD / YYYYDDD */}
      {mode === "ordinal" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Not astronomical JD!</strong> This is the mainframe-style ordinal
                "Julian date" — <span className="font-mono">YYDDD</span> (5 digits, 70-99 → 1970-1999,
                00-69 → 2000-2069) or <span className="font-mono">YYYYDDD</span> (7 digits).
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ord-input">Ordinal date (YYDDD or YYYYDDD)</Label>
              <Input
                id="ord-input"
                value={ordInput}
                onChange={(e) => setOrdInput(e.target.value)}
                placeholder="e.g. 25001 (= 2025-01-01) or 2025001"
                className="font-mono text-sm"
              />
            </div>
            {ordResult && !ordResult.ok && <ErrorBanner message={ordResult.error} />}
            {ordResult && ordResult.ok && (
              <OrdinalView
                r={ordResult}
                onSaveHistory={handleSaveHistory}
                onClear={handleClear}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Reference card */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4" /> Reference values
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <RefRow label="J2000.0 (JD)" value={formatFixed(J2000_JD, 1)} />
            <RefRow label="Unix epoch (JD)" value={formatFixed(UNIX_EPOCH_JD, 1)} />
            <RefRow label="MJD = JD − 2400000.5" value="" />
            <RefRow label="Rata Die = JD − 1721424.5" value="" />
            <RefRow label="2025-01-01 00:00 UTC" value="JD 2460676.5" />
            <RefRow label="1970-01-01 00:00 UTC" value="JD 2440587.5" />
            <RefRow label="First Gregorian day (1582-10-15)" value="JD 2299160.5" />
            <RefRow label="Last Julian day (1582-10-04)" value="JD 2299159.5" />
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            <Sparkles className="inline h-3 w-3 mr-1" />
            JD 0 was a Monday in 4713 BC (proleptic Julian). Weekday = (JD + 1.5) mod 7.
          </p>
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.calendarSystem}</Badge>
                    <span className="font-mono text-foreground truncate max-w-[180px]">{h.inputPreview}</span>
                    <span className="font-mono text-muted-foreground ml-auto">JD {formatFixed(h.jd, 4)}</span>
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
            <strong className="text-foreground">Privacy:</strong> All conversions run locally using pure
            arithmetic. History is stored in localStorage on this device only and contains a short input
            preview plus the resulting JD.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConversionView({
  r,
  precision,
  input,
  onSaveHistory,
  onClear,
}: {
  r: Extract<ReturnType<typeof convertCalendar>, { ok: true }>;
  precision: number;
  input: string;
  onSaveHistory: () => void;
  onClear: () => void;
}) {
  const rows = useMemo(() => formatConversionTable(r, precision), [r, precision]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{r.calendarSystem === "gregorian" ? "Proleptic Gregorian" : "Proleptic Julian"}</Badge>
        <Badge variant="outline" className="text-[10px]">Weekday: {r.weekday}</Badge>
        {r.unixSeconds === null && (
          <Badge variant="secondary" className="text-[10px]">out of JS Date range</Badge>
        )}
      </div>
      <div className="space-y-1 max-h-[400px] overflow-auto">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
            <span className="text-muted-foreground w-40 flex-shrink-0">{row.label}</span>
            <span className="flex-1 text-foreground truncate font-mono">{row.value}</span>
            <CopyButton getText={() => row.value} label="" size="icon-sm" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <CopyButton
          getText={() => {
            onSaveHistory();
            return formatFixed(r.jd, precision);
          }}
          label="Copy JD"
        />
        <CopyButton getText={() => formatFixed(r.mjd, precision)} label="Copy MJD" />
        <DownloadButton
          getText={() => JSON.stringify({
            input,
            calendarSystem: r.calendarSystem,
            mode: r.mode,
            jd: r.jd,
            mjd: r.mjd,
            rjd: r.rjd,
            tjd: r.tjd,
            djd: r.djd,
            rataDie: r.rataDie,
            j2000: r.j2000,
            unixSeconds: r.unixSeconds !== null ? r.unixSeconds.toString() : null,
            unixMillis: r.unixMillis !== null ? r.unixMillis.toString() : null,
            calendar: r.calendar,
            weekday: r.weekday,
            iso: r.iso,
          }, null, 2)}
          filename="julian-date-conversion.json"
          mime="application/json"
          label="Download JSON"
        />
        <ShareButton getUrl={() => { onSaveHistory(); return buildShareUrl(r.mode, input, r.calendarSystem, precision); }} />
        <ClearButton onClick={onClear} />
      </div>
    </div>
  );
}

function OrdinalView({
  r,
  onSaveHistory,
  onClear,
}: {
  r: Extract<ReturnType<typeof convertOrdinal>, { ok: true }>;
  onSaveHistory: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">Form: {r.form}</Badge>
        <Badge variant="outline" className="text-[10px]">Year: {r.year}</Badge>
        <Badge variant="outline" className="text-[10px]">DOY: {r.dayOfYear}</Badge>
        <Badge variant="outline" className="text-[10px]">Weekday: {r.weekday}</Badge>
        <Badge variant="outline" className="text-[10px]">
          {isLeapYear(r.year, "gregorian") ? "Leap year" : "Common year"}
        </Badge>
      </div>
      <div className="space-y-1">
        <Row label="Calendar date (Gregorian)" value={`${r.calendar.year}-${String(r.calendar.month).padStart(2, "0")}-${String(r.calendar.day).padStart(2, "0")}`} />
        <Row label="Month" value={MONTHS[r.calendar.month - 1]} />
        <Row label="JD at midnight UT" value={formatFixed(r.jd, 6)} />
        <Row label="MJD at midnight UT" value={formatFixed(r.jd - 2_400_000.5, 6)} />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <CopyButton
          getText={() => {
            onSaveHistory();
            return `${r.calendar.year}-${String(r.calendar.month).padStart(2, "0")}-${String(r.calendar.day).padStart(2, "0")}`;
          }}
          label="Copy date"
        />
        <CopyButton getText={() => formatFixed(r.jd, 6)} label="Copy JD" />
        <ShareButton getUrl={() => { onSaveHistory(); return buildShareUrl("ordinal", `${r.year}${String(r.dayOfYear).padStart(3, "0")}`, "gregorian", 6); }} />
        <ClearButton onClick={onClear} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
      <span className="text-muted-foreground w-48 flex-shrink-0">{label}</span>
      <span className="flex-1 text-foreground truncate font-mono">{value}</span>
      <CopyButton getText={() => value} label="" size="icon-sm" />
    </div>
  );
}

function RefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
      <span className="text-muted-foreground flex-1 truncate">{label}</span>
      {value && <span className="font-mono text-foreground">{value}</span>}
    </div>
  );
}
