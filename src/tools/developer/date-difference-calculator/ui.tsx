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
  parseDateTime,
  isValidDate,
  calculateDifference,
  calculateAge,
  parseBatch,
  computeBatch,
  renderResultText,
  renderBatchCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DifferenceResult,
  type AgeResult,
  type HistoryEntry,
} from "./logic";
import { History, Calendar, Clock, ArrowLeftRight, Cake, ListChecks } from "lucide-react";

type Tab = "difference" | "age" | "batch";

export default function DateDifferenceCalculator() {
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  const [tab, setTab] = useState<Tab>("difference");
  const [start, setStart] = useState<string>("2025-01-01");
  const [end, setEnd] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(""); // optional HH:MM
  const [endTime, setEndTime] = useState<string>("");
  const [includeEnd, setIncludeEnd] = useState<boolean>(false);
  const [weekendDays, setWeekendDays] = useState<number[]>([...DEFAULT_WEEKEND_DAYS]);
  const [holidaysText, setHolidaysText] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Age tab
  const [birthDate, setBirthDate] = useState<string>("2000-01-01");
  const [ageNowDate, setAgeNowDate] = useState<string>(todayStr);

  // Batch tab
  const [batchInput, setBatchInput] = useState<string>("2025-01-01,2025-01-31\n2025-02-01,2025-02-28");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.start) setStart(p.start);
        if (p.end) setEnd(p.end);
        setIncludeEnd(p.includeEndDay);
        if (p.weekendDays.length > 0) setWeekendDays(p.weekendDays);
        if (p.holidays.length > 0) setHolidaysText(p.holidays.join("\n"));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const startMs = useMemo(() => {
    const dt = startTime ? `${start}T${startTime}:00` : start;
    return parseDateTime(dt);
  }, [start, startTime]);
  const endMs = useMemo(() => {
    const dt = endTime ? `${end}T${endTime}:00` : end;
    return parseDateTime(dt);
  }, [end, endTime]);

  const holidays = useMemo(
    () => holidaysText.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && isValidDate(s)),
    [holidaysText],
  );

  const result: DifferenceResult | null = useMemo(() => {
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
    return calculateDifference({
      startMs, endMs,
      includeEndDay: includeEnd,
      weekendDays,
      holidays,
    });
  }, [startMs, endMs, includeEnd, weekendDays, holidays]);

  const ageResult: AgeResult | null = useMemo(() => {
    const birthMs = parseDateTime(birthDate);
    const nowMs = parseDateTime(ageNowDate);
    if (Number.isNaN(birthMs) || Number.isNaN(nowMs)) return null;
    return calculateAge(birthMs, nowMs);
  }, [birthDate, ageNowDate]);

  const batchRows = useMemo(() => {
    const pairs = parseBatch(batchInput);
    return computeBatch(pairs, includeEnd, weekendDays, holidays);
  }, [batchInput, includeEnd, weekendDays, holidays]);

  const handleSaveHistory = useCallback(() => {
    if (result) {
      saveHistory({
        ts: Date.now(),
        start,
        end,
        includeEndDay: includeEnd,
        totalDays: result.totalDays,
      });
      setHistory(loadHistory());
    }
  }, [result, start, end, includeEnd]);

  const handleSwap = useCallback(() => {
    setStart(end);
    setEnd(start);
    setStartTime(endTime);
    setEndTime(startTime);
  }, [end, start, endTime, startTime]);

  const handleClear = useCallback(() => {
    setStart(todayStr);
    setEnd(todayStr);
    setStartTime("");
    setEndTime("");
    setHolidaysText("");
    setIncludeEnd(false);
    setWeekendDays([...DEFAULT_WEEKEND_DAYS]);
    toast.info("Cleared inputs");
  }, [todayStr]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleWeekend = (dayNum: number) => {
    setWeekendDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort(),
    );
  };

  const weekendLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const startValid = isValidDate(startTime ? `${start}T${startTime}:00` : start);
  const endValid = isValidDate(endTime ? `${end}T${endTime}:00` : end);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={tab === "difference" ? "default" : "outline"}
              onClick={() => setTab("difference")}
              className="gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" /> Difference
            </Button>
            <Button
              size="sm"
              variant={tab === "age" ? "default" : "outline"}
              onClick={() => setTab("age")}
              className="gap-1.5"
            >
              <Cake className="h-3.5 w-3.5" /> Age
            </Button>
            <Button
              size="sm"
              variant={tab === "batch" ? "default" : "outline"}
              onClick={() => setTab("batch")}
              className="gap-1.5"
            >
              <ListChecks className="h-3.5 w-3.5" /> Batch
            </Button>
          </div>
        </CardContent>
      </Card>

      {tab === "difference" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ddc-start" className="text-xs">Start date</Label>
                  <Input
                    id="ddc-start"
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
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ddc-end" className="text-xs">End date</Label>
                  <Input
                    id="ddc-end"
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-xs h-8"
                    placeholder="optional time"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleSwap} className="gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Swap start ↔ end
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludeEnd((p) => !p)}
                  className="gap-1.5"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {includeEnd ? "Including end day" : "Excluding end day"}
                </Button>
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
              <div className="space-y-1">
                <Label htmlFor="ddc-holidays" className="text-xs">Holidays (one YYYY-MM-DD per line)</Label>
                <Textarea
                  id="ddc-holidays"
                  value={holidaysText}
                  onChange={(e) => setHolidaysText(e.target.value)}
                  placeholder={"2025-01-01\n2025-07-04"}
                  className="min-h-[60px] resize-y font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {!startValid || !endValid ? (
            <EmptyState
              title="Enter valid start and end dates"
              hint="Both dates must be valid YYYY-MM-DD. Optional time fields let you compute sub-day precision."
              icon={<Calendar className="h-8 w-8" />}
            />
          ) : result ? (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> {result.summary}
                  </h3>
                  <p className="text-xs text-muted-foreground italic">{result.relativePhrase}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Years" value={result.years} />
                    <Stat label="Months" value={result.months} />
                    <Stat label="Days" value={result.days} />
                    <Stat label="Total days" value={result.totalDays} highlight={result.isNegative ? "bad" : "good"} />
                    <Stat label="Total weeks" value={result.totalWeeks.toFixed(2)} />
                    <Stat label="Total hours" value={result.totalHours} />
                    <Stat label="Total minutes" value={result.totalMinutes} />
                    <Stat label="Total seconds" value={result.totalSeconds} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Weekdays" value={result.weekdays} />
                    <Stat label="Weekend days" value={result.weekendDays} />
                    <Stat label="Business days" value={result.businessDays} highlight="good" />
                  </div>
                  {result.holidaysHit > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {result.holidaysHit} holiday(s) fell on weekdays and were excluded from business days.
                    </p>
                  )}
                  <div className="rounded border bg-background p-2 text-[11px] text-muted-foreground">
                    <strong className="text-foreground">Convention:</strong> {result.includeEndExplanation}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton
                      getText={() => { handleSaveHistory(); return renderResultText(result); }}
                      label="Copy full summary"
                    />
                    <ShareButton
                      getUrl={() => { handleSaveHistory(); return buildShareUrl({ start, end, includeEndDay: includeEnd, weekendDays, holidays }); }}
                    />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      )}

      {tab === "age" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ddc-birth" className="text-xs">Birth date</Label>
                <Input
                  id="ddc-birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ddc-agenow" className="text-xs">"Today" (defaults to today)</Label>
                <Input
                  id="ddc-agenow"
                  type="date"
                  value={ageNowDate}
                  onChange={(e) => setAgeNowDate(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
            {!ageResult ? (
              <EmptyState
                title="Enter a valid birth date"
                hint="Age is computed in calendar years/months/days using the same algorithm as the difference calculator."
                icon={<Cake className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-2">
                <div className="rounded border bg-background p-3">
                  <div className="text-2xl font-semibold text-foreground">
                    {ageResult.years} <span className="text-sm font-normal text-muted-foreground">years old</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{ageResult.summary}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Years" value={ageResult.years} />
                  <Stat label="Months" value={ageResult.months} />
                  <Stat label="Days" value={ageResult.days} />
                  <Stat label="Total days alive" value={ageResult.totalDays} />
                </div>
                <div className="rounded border bg-background p-3 text-xs">
                  <span className="text-muted-foreground">Next birthday: </span>
                  <span className="font-medium text-foreground">{ageResult.nextBirthdayDate}</span>
                  <span className="text-muted-foreground"> (in </span>
                  <span className="font-medium text-foreground">{ageResult.daysUntilNextBirthday} day(s)</span>
                  <span className="text-muted-foreground">)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => ageResult.summary} label="Copy age summary" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ddc-batch" className="text-xs">Date pairs (one per line, format: start,end)</Label>
              <Textarea
                id="ddc-batch"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={"2025-01-01,2025-01-31\n2025-02-01,2025-02-28"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Lines starting with # are ignored. Current weekend/holiday/include-end settings apply.
              </p>
            </div>
            {batchRows.length > 0 && (
              <div className="space-y-2">
                <div className="rounded border bg-background overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left p-2">Start</th>
                        <th className="text-left p-2">End</th>
                        <th className="text-right p-2">Total days</th>
                        <th className="text-right p-2">Business days</th>
                        <th className="text-right p-2">Y/M/D</th>
                        <th className="text-center p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono">{r.start}</td>
                          <td className="p-2 font-mono">{r.end}</td>
                          <td className="p-2 text-right font-mono">{r.totalDays}</td>
                          <td className="p-2 text-right font-mono">{r.businessDays}</td>
                          <td className="p-2 text-right font-mono">{r.years}y {r.months}m {r.days}d</td>
                          <td className="p-2 text-center">
                            {r.ok ? (
                              <Badge variant="outline" className="text-[10px]">ok</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]" title={r.error}>err</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DownloadButton
                    getText={() => renderBatchCsv(batchRows)}
                    filename="date-differences.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <CopyButton
                    getText={() => renderBatchCsv(batchRows)}
                    label="Copy CSV"
                  />
                </div>
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.totalDays} days</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.includeEndDay ? "incl" : "excl"}</Badge>
                  <span className="font-mono text-muted-foreground">{h.start} → {h.end}</span>
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
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
