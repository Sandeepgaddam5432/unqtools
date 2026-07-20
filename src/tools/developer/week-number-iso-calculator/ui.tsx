"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  CONVENTIONS,
  SAMPLE_DATES,
  isLeapYear,
  parseDateInput,
  formatDate,
  getWeekNumber,
  weeksInYear,
  hasWeek53,
  weekToDateRange,
  buildYearGrid,
  findCurrentWeek,
  renderYearGridCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Convention,
  type HistoryEntry,
} from "./logic";
import { History, CalendarDays, CalendarRange, Table, ArrowRight, AlertTriangle } from "lucide-react";

export default function WeekNumberIsoCalculator() {
  const [dateText, setDateText] = useState<string>(() => formatDate(new Date()));
  const [convention, setConvention] = useState<Convention>("iso");
  const [reverseYear, setReverseYear] = useState<number>(new Date().getFullYear());
  const [reverseWeek, setReverseWeek] = useState<number>(1);
  const [reverseConvention, setReverseConvention] = useState<Convention>("iso");
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setConvention(parsed.convention);
      if (parsed.dateIso && parsed.dateIso !== "today") setDateText(parsed.dateIso);
      if (parsed.dateIso || parsed.convention) toast.info("Loaded from share link");
    }
  }, []);

  const parsedDate = useMemo(() => {
    if (dateText.trim() === "" || dateText.trim().toLowerCase() === "today") {
      return new Date();
    }
    try { return parseDateInput(dateText); } catch { return null; }
  }, [dateText]);

  const weekInfo = useMemo(() => {
    if (!parsedDate) return null;
    try { return getWeekNumber(parsedDate, convention); } catch { return null; }
  }, [parsedDate, convention]);

  const range = useMemo(() => {
    if (!weekInfo) return null;
    return weekToDateRange(weekInfo.weekYear, weekInfo.week, convention);
  }, [weekInfo, convention]);

  const totalWeeks = useMemo(
    () => (weekInfo ? weeksInYear(weekInfo.weekYear, convention) : 0),
    [weekInfo, convention],
  );

  const is53 = useMemo(
    () => (weekInfo ? hasWeek53(weekInfo.weekYear, convention) : false),
    [weekInfo, convention],
  );

  const reverseRange = useMemo(() => {
    if (reverseWeek < 1 || reverseWeek > weeksInYear(reverseYear, reverseConvention)) return null;
    return weekToDateRange(reverseYear, reverseWeek, reverseConvention);
  }, [reverseYear, reverseWeek, reverseConvention]);

  const grid = useMemo(
    () => (showGrid ? buildYearGrid(weekInfo?.weekYear ?? new Date().getFullYear(), convention) : []),
    [showGrid, weekInfo, convention],
  );

  const gridCsv = useMemo(
    () => (showGrid ? renderYearGridCsv(weekInfo?.weekYear ?? new Date().getFullYear(), convention) : ""),
    [showGrid, weekInfo, convention],
  );

  const currentWeek = useMemo(() => findCurrentWeek(new Date(), convention), [convention]);

  const handleUseToday = useCallback(() => {
    setDateText(formatDate(new Date()));
    toast.info("Set to today");
  }, []);

  const handleClear = useCallback(() => {
    setDateText(formatDate(new Date()));
    toast.info("Reset to today");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (weekInfo) {
      saveHistory({
        ts: Date.now(),
        dateIso: weekInfo.date,
        convention,
        week: weekInfo.week,
        weekYear: weekInfo.weekYear,
      });
      setHistory(loadHistory());
    }
  }, [weekInfo, convention]);

  const conventionMeta = CONVENTIONS.find((c) => c.value === convention);

  const dateValid = parsedDate != null;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wn-date" className="text-sm font-semibold">Date</Label>
              <Input
                id="wn-date"
                value={dateText}
                onChange={(e) => setDateText(e.target.value)}
                placeholder="2025-01-15 or 1705315200000"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wn-conv" className="text-sm font-semibold">Week-numbering convention</Label>
              <select
                id="wn-conv"
                value={convention}
                onChange={(e) => setConvention(e.target.value as Convention)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {CONVENTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Quick samples</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleUseToday}>Today</Button>
              {SAMPLE_DATES.filter((s) => s.iso !== "today").map((s) => (
                <Button
                  key={s.iso}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setDateText(s.iso)}
                >{s.label.split(" ")[0]}</Button>
              ))}
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          {conventionMeta && (
            <p className="text-[11px] text-muted-foreground border-l-2 pl-2 italic">
              {conventionMeta.description}
            </p>
          )}
        </CardContent>
      </Card>

      {dateValid && weekInfo ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> Result
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleRecordHistory(); return `Week ${weekInfo.week} of ${weekInfo.weekYear} (${convention.toUpperCase()})`; }}
                    label="Copy week"
                  />
                  <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(convention, weekInfo.date); }} />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {conventionMeta?.label.split(" (")[0]} · weeks start {weekInfo.startOfWeek}
                </div>
                <div className="text-4xl font-semibold text-foreground">
                  Week {weekInfo.week}
                </div>
                <div className="text-base text-muted-foreground mt-1">
                  of <span className="text-foreground font-medium">{weekInfo.weekYear}</span>
                </div>
                {weekInfo.weekYear !== weekInfo.calendarYear && (
                  <Badge variant="outline" className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                    week-year {weekInfo.weekYear} ≠ calendar year {weekInfo.calendarYear}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Date" value={weekInfo.date} />
                <Stat label="Weekday" value={weekInfo.weekdayName} />
                <Stat label="ISO weekday" value={`${weekInfo.weekday} (1=Mon)`} />
                <Stat label="Total weeks" value={`${totalWeeks} (${is53 ? "has W53" : "no W53"})`} />
              </div>

              {range && (
                <div className="rounded border bg-background p-3 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Week {range.week} date range ({range.convention.toUpperCase()})
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-foreground">{range.startDate}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground">{range.endDate}</span>
                    {range.crossesYearBoundary && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                        crosses year boundary
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {weekInfo.isWeek53 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    This is week 53 — a leap-week that only occurs in {convention.toUpperCase()} years where Jan 1 is Thursday
                    {convention === "iso" ? " (or Wednesday in leap years)" : ""}.
                    {weekInfo.weekYear} is {isLeapYear(weekInfo.weekYear) ? "a leap year" : "not a leap year"}.
                  </span>
                </div>
              )}

              <p className="text-xs text-foreground">{weekInfo.summary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4" /> Reverse lookup: year + week → date range
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Convention">
                  <select
                    value={reverseConvention}
                    onChange={(e) => setReverseConvention(e.target.value as Convention)}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    {CONVENTIONS.map((c) => <option key={c.value} value={c.value}>{c.value.toUpperCase()}</option>)}
                  </select>
                </Field>
                <Field label={`Year (max W${weeksInYear(reverseYear, reverseConvention)})`}>
                  <Input
                    type="number"
                    value={reverseYear}
                    onChange={(e) => setReverseYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label={`Week (1-${weeksInYear(reverseYear, reverseConvention)})`}>
                  <Input
                    type="number"
                    min={1}
                    max={weeksInYear(reverseYear, reverseConvention)}
                    value={reverseWeek}
                    onChange={(e) => setReverseWeek(parseInt(e.target.value, 10) || 1)}
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
              {reverseRange ? (
                <div className="rounded border bg-background p-3 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <Badge variant="outline" className="text-[10px]">W{reverseRange.week}/{reverseRange.weekYear}</Badge>
                    <span className="text-foreground">{reverseRange.startDate}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground">{reverseRange.endDate}</span>
                    {reverseRange.crossesYearBoundary && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                        cross-year
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <ErrorBanner message={`Week ${reverseWeek} is out of range for ${reverseConvention.toUpperCase()} year ${reverseYear} (1-${weeksInYear(reverseYear, reverseConvention)}).`} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Table className="h-4 w-4" /> Year grid
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={showGrid ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    {showGrid ? "Hide" : "Show"} grid for {weekInfo?.weekYear}
                  </Button>
                  {showGrid && (
                    <DownloadButton
                      getText={() => gridCsv}
                      filename={`week-grid-${weekInfo?.weekYear}-${convention}.csv`}
                      mime="text/csv"
                      label="Download CSV"
                    />
                  )}
                </div>
              </div>
              {showGrid && grid.length > 0 && (
                <div className="max-h-[400px] overflow-auto rounded border bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Week</th>
                        <th className="px-2 py-1 text-left">Start</th>
                        <th className="px-2 py-1 text-left">End</th>
                        <th className="px-2 py-1 text-left"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grid.map((row) => (
                        <tr
                          key={row.week}
                          className={row.isCurrent ? "bg-primary/10 font-medium" : ""}
                        >
                          <td className="px-2 py-1 font-mono">{row.week}</td>
                          <td className="px-2 py-1 font-mono">{row.startDate}</td>
                          <td className="px-2 py-1 font-mono">{row.endDate}</td>
                          <td className="px-2 py-1">
                            {row.isCurrent && <Badge variant="default" className="text-[10px]">current</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">
                Current week ({convention.toUpperCase()}): <span className="font-medium text-foreground">W{currentWeek.week} of {currentWeek.weekYear}</span> · today is {currentWeek.date} ({currentWeek.weekdayName})
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a date to compute its week number"
          hint="Supports YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, or Unix timestamps. Four conventions: ISO 8601, US (Sun-start), Simple (Jan 1-7), Middle-Eastern (Sat-start). Week-53 and cross-year-boundary cases handled correctly."
          icon={<CalendarDays className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.convention.toUpperCase()}</Badge>
                    <Badge variant="outline" className="text-[10px]">W{h.week}/{h.weekYear}</Badge>
                    <span className="ml-auto text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-1">{h.dateIso}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All week-number math runs locally. Nothing is uploaded.
            History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
