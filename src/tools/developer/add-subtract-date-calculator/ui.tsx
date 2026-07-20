"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  DEFAULT_WEEKEND_DAYS,
  UNIT_ORDER,
  parseDateTime,
  isValidDate,
  calculateAddSubtract,
  generateSeries,
  renderSeriesCsv,
  renderResultText,
  startOfDay,
  endOfDay,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DateOffset,
  type OperationMode,
  type MonthEndPolicy,
  type DateMode,
  type HistoryEntry,
} from "./logic";
import {
  History, CalendarPlus, CalendarDays, Briefcase, Repeat, Plus, Minus, Clock,
} from "lucide-react";

type Tab = "single" | "series";

const UNIT_PLACEHOLDERS: Record<keyof DateOffset, string> = {
  years: "0",
  months: "0",
  weeks: "0",
  days: "0",
  hours: "0",
  minutes: "0",
  seconds: "0",
};

export default function AddSubtractDateCalculator() {
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  const [tab, setTab] = useState<Tab>("single");
  const [start, setStart] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>("");
  const [offset, setOffset] = useState<DateOffset>({ days: 30 });
  const [mode, setMode] = useState<OperationMode>("add");
  const [monthEndPolicy, setMonthEndPolicy] = useState<MonthEndPolicy>("clamp");
  const [dateMode, setDateMode] = useState<DateMode>("calendar");
  const [weekendDays, setWeekendDays] = useState<number[]>([...DEFAULT_WEEKEND_DAYS]);
  const [holidaysText, setHolidaysText] = useState<string>("");
  const [count, setCount] = useState<number>(10);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.start) setStart(p.start);
        if (p.startTime) setStartTime(p.startTime);
        if (Object.keys(p.offset).length > 0) setOffset(p.offset);
        setMode(p.mode);
        setMonthEndPolicy(p.monthEndPolicy);
        setDateMode(p.dateMode);
        if (p.weekendDays.length > 0) setWeekendDays(p.weekendDays);
        if (p.holidays.length > 0) setHolidaysText(p.holidays.join("\n"));
        if (p.count > 0) setCount(p.count);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const startMs = useMemo(() => {
    const dt = startTime ? `${start}T${startTime}:00` : start;
    return parseDateTime(dt);
  }, [start, startTime]);

  const holidays = useMemo(
    () => holidaysText.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && isValidDate(s)),
    [holidaysText],
  );

  const result = useMemo(() => {
    if (Number.isNaN(startMs)) return null;
    return calculateAddSubtract({
      startMs,
      offset,
      mode,
      monthEndPolicy,
      dateMode,
      weekendDays,
      holidays,
    });
  }, [startMs, offset, mode, monthEndPolicy, dateMode, weekendDays, holidays]);

  const seriesRows = useMemo(() => {
    if (Number.isNaN(startMs) || count <= 0) return [];
    return generateSeries({
      startMs, offset, mode, monthEndPolicy, dateMode, count, weekendDays, holidays,
    });
  }, [startMs, offset, mode, monthEndPolicy, dateMode, count, weekendDays, holidays]);

  const handleSaveHistory = useCallback(() => {
    if (result && !Number.isNaN(result.resultMs)) {
      saveHistory({
        ts: Date.now(),
        start,
        offset,
        mode,
        monthEndPolicy,
        dateMode,
        result: result.resultDate,
      });
      setHistory(loadHistory());
    }
  }, [result, start, offset, mode, monthEndPolicy, dateMode]);

  const setUnit = (unit: keyof DateOffset, value: string) => {
    const n = value === "" ? 0 : Number(value);
    if (!Number.isFinite(n)) return;
    setOffset((prev) => ({ ...prev, [unit]: n }));
  };

  const toggleWeekend = (dayNum: number) => {
    setWeekendDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort(),
    );
  };

  const handleClear = useCallback(() => {
    setStart(todayStr);
    setStartTime("");
    setOffset({ days: 30 });
    setMode("add");
    setMonthEndPolicy("clamp");
    setDateMode("calendar");
    setWeekendDays([...DEFAULT_WEEKEND_DAYS]);
    setHolidaysText("");
    setCount(10);
    toast.info("Cleared inputs");
  }, [todayStr]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleNow = useCallback(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    setStart(`${y}-${m}-${d}`);
    setStartTime(`${hh}:${mm}`);
  }, []);

  const handleStartOfDay = useCallback(() => {
    setStartTime("00:00");
  }, []);
  const handleEndOfDay = useCallback(() => {
    setStartTime("23:59");
  }, []);

  const weekendLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const startValid = isValidDate(startTime ? `${start}T${startTime}:00` : start);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={tab === "single" ? "default" : "outline"}
              onClick={() => setTab("single")}
              className="gap-1.5"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Single
            </Button>
            <Button
              size="sm"
              variant={tab === "series" ? "default" : "outline"}
              onClick={() => setTab("series")}
              className="gap-1.5"
            >
              <Repeat className="h-3.5 w-3.5" /> Series
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="asd-start" className="text-xs">Start date</Label>
              <Input
                id="asd-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="text-xs h-8"
                placeholder="optional time"
              />
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleNow}>
                  <Clock className="h-3 w-3 mr-1" /> Now
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleStartOfDay}>Start of day</Button>
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleEndOfDay}>End of day</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operation</Label>
              <div className="flex gap-2">
                <Button
                  variant={mode === "add" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setMode("add")}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
                <Button
                  variant={mode === "subtract" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setMode("subtract")}
                >
                  <Minus className="h-3.5 w-3.5" /> Subtract
                </Button>
              </div>
              <Label className="text-xs pt-1 block">Date mode</Label>
              <div className="flex gap-2">
                <Button
                  variant={dateMode === "calendar" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setDateMode("calendar")}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Calendar days
                </Button>
                <Button
                  variant={dateMode === "business" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setDateMode("business")}
                >
                  <Briefcase className="h-3.5 w-3.5" /> Business days
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Offset (years, months, weeks, days, hours, minutes, seconds)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {UNIT_ORDER.map((u) => (
                <div key={u} className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{u}</span>
                  <Input
                    type="number"
                    value={offset[u] ?? 0}
                    onChange={(e) => setUnit(u, e.target.value)}
                    placeholder={UNIT_PLACEHOLDERS[u]}
                    className="text-xs h-8"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Month-end policy (when target day exceeds month length)</Label>
            <div className="flex gap-2 pt-1">
              <Button
                variant={monthEndPolicy === "clamp" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMonthEndPolicy("clamp")}
              >
                Clamp to last valid day
              </Button>
              <Button
                variant={monthEndPolicy === "overflow" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMonthEndPolicy("overflow")}
              >
                Overflow into next month
              </Button>
            </div>
          </div>

          {dateMode === "business" && (
            <>
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
              <div className="space-y-1">
                <Label htmlFor="asd-holidays" className="text-xs">Holidays (one YYYY-MM-DD per line)</Label>
                <Textarea
                  id="asd-holidays"
                  value={holidaysText}
                  onChange={(e) => setHolidaysText(e.target.value)}
                  placeholder={"2025-01-01\n2025-07-04\n2025-12-25"}
                  className="min-h-[60px] resize-y font-mono text-xs"
                />
              </div>
            </>
          )}

          {tab === "series" && (
            <div className="space-y-1">
              <Label htmlFor="asd-count" className="text-xs">Number of occurrences (1–1000)</Label>
              <Input
                id="asd-count"
                type="number"
                min={1}
                max={1000}
                value={count}
                onChange={(e) => setCount(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                className="text-xs h-8 w-32"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5">
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {!startValid ? (
        <EmptyState
          title="Enter a valid start date"
          hint="Start date must be a valid YYYY-MM-DD. Optional time field lets you preserve sub-day precision."
          icon={<CalendarPlus className="h-8 w-8" />}
        />
      ) : tab === "single" ? (
        result && !Number.isNaN(result.resultMs) ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarPlus className="h-4 w-4" /> {result.summary}
              </h3>
              <p className="text-xs text-muted-foreground italic">{result.relativePhrase}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Result date" value={result.resultDate} highlight="good" />
                <Stat label="Result datetime" value={result.resultDateTime} />
                <Stat label="Weekday" value={result.weekday} />
                <Stat label="Day of week" value={result.dayOfWeek} />
                <Stat label="Elapsed ms" value={result.elapsedMs} />
                <Stat label="Elapsed days" value={result.elapsedDays.toFixed(3)} />
                {dateMode === "business" && (
                  <>
                    <Stat label="Business days moved" value={result.businessDaysMoved} />
                    <Stat label="Weekend days skipped" value={result.weekendDaysSkipped} />
                    <Stat label="Holidays skipped" value={result.holidaysSkipped} />
                  </>
                )}
              </div>
              <div className="rounded border bg-background p-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Month-end policy:</strong> {result.monthEndExplanation}
              </div>
              <div className="rounded border bg-background p-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Date mode:</strong> {result.dateModeExplanation}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return renderResultText(result); }}
                  label="Copy full summary"
                />
                <CopyButton
                  getText={() => { handleSaveHistory(); return result.resultDate; }}
                  label="Copy date"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      start, startTime, offset, mode, monthEndPolicy, dateMode,
                      weekendDays, holidays, count,
                    });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        ) : null
      ) : (
        seriesRows.length > 0 ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Repeat className="h-4 w-4" /> Series ({seriesRows.length} rows)
                </h3>
                <Badge variant="outline" className="text-[10px]">every {Object.entries(offset).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ")}</Badge>
              </div>
              <div className="rounded border bg-background overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-right p-2">#</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Datetime</th>
                      <th className="text-left p-2">Weekday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seriesRows.map((r) => (
                      <tr key={r.index} className="border-t">
                        <td className="p-2 text-right font-mono">{r.n}</td>
                        <td className="p-2 font-mono">{r.resultDate}</td>
                        <td className="p-2 font-mono text-muted-foreground text-[10px]">{r.resultDateTime}</td>
                        <td className="p-2">{r.weekday}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return renderSeriesCsv(seriesRows); }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return renderSeriesCsv(seriesRows); }}
                  filename="add-subtract-date-series.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      start, startTime, offset, mode, monthEndPolicy, dateMode,
                      weekendDays, holidays, count,
                    });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="Set a count > 0 to generate a series"
            hint="The series applies the offset 1, 2, 3, ... count times to produce upcoming dates."
            icon={<Repeat className="h-8 w-8" />}
          />
        )
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.dateMode}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.monthEndPolicy}</Badge>
                  <span className="font-mono text-muted-foreground">{h.start} → {h.result}</span>
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
            <strong className="text-foreground">Privacy:</strong> All date math runs locally. The shareable URL is fragment-encoded (never sent to server). History is stored in localStorage on this device only.
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
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
