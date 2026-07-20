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
  SECONDS_PER_HOUR,
  durationToSeconds,
  parseDuration,
  parseClockTime,
  isValidClockTime,
  formatHms,
  format12h,
  format24h,
  normalizeDuration,
  toDecimalHours,
  formatHuman,
  formatCompact,
  addDurations,
  subtractDurations,
  multiplyDuration,
  divideDuration,
  durationBetween,
  parseTimesheetRows,
  computeTimesheet,
  renderTimesheetCsv,
  renderTimesheetText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ArithmeticResult,
  type BetweenResult,
  type TimesheetTotal,
  type HistoryEntry,
  type Operation,
  type DurationInput,
} from "./logic";
import {
  History, Clock, Plus, Minus, X, Divide, ArrowRight,
  CalendarClock, ListChecks, ArrowLeftRight,
} from "lucide-react";

type Tab = "arithmetic" | "between" | "timesheet";

const UNIT_FIELDS: { key: keyof DurationInput; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

const OP_LABELS: Record<Operation, string> = {
  add: "Add (+)",
  subtract: "Subtract (-)",
  multiply: "Multiply (×)",
  divide: "Divide (÷)",
};

export default function TimeDurationCalculator() {
  const [tab, setTab] = useState<Tab>("arithmetic");

  // Arithmetic tab state
  const [op, setOp] = useState<Operation>("add");
  const [a, setA] = useState<DurationInput>({ hours: 1, minutes: 30 });
  const [b, setB] = useState<DurationInput>({ hours: 2, minutes: 45 });
  const [factor, setFactor] = useState<number>(2);

  // Between tab state
  const [start, setStart] = useState<string>("09:00");
  const [end, setEnd] = useState<string>("17:00");
  const [nextDay, setNextDay] = useState<boolean>(false);
  const [clockFmt, setClockFmt] = useState<"24h" | "12h">("24h");

  // Timesheet tab state
  const [timesheetText, setTimesheetText] = useState<string>("09:00 17:00 30 morning\n10:00 16:00 0 afternoon");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.mode) setTab(p.mode);
        if (p.mode === "arithmetic") {
          if (p.op) setOp(p.op);
          if (typeof p.aDays === "number") setA({ days: p.aDays, hours: p.aHours, minutes: p.aMinutes, seconds: p.aSeconds });
          if (typeof p.bDays === "number") setB({ days: p.bDays, hours: p.bHours, minutes: p.bMinutes, seconds: p.bSeconds });
          if (typeof p.factor === "number") setFactor(p.factor);
        } else if (p.mode === "between") {
          if (p.start) setStart(p.start);
          if (p.end) setEnd(p.end);
          if (typeof p.nextDay === "boolean") setNextDay(p.nextDay);
        } else if (p.mode === "timesheet") {
          if (p.rows) setTimesheetText(p.rows);
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const arithmeticResult: ArithmeticResult | null = useMemo(() => {
    if (tab !== "arithmetic") return null;
    const aSec = durationToSeconds(a);
    if (op === "add") return addDurations(aSec, durationToSeconds(b));
    if (op === "subtract") return subtractDurations(aSec, durationToSeconds(b));
    if (op === "multiply") return multiplyDuration(aSec, factor);
    return divideDuration(aSec, factor);
  }, [tab, op, a, b, factor]);

  const betweenResult: BetweenResult | null = useMemo(() => {
    if (tab !== "between") return null;
    if (!isValidClockTime(start) || !isValidClockTime(end)) return null;
    return durationBetween(start, end, { nextDay });
  }, [tab, start, end, nextDay]);

  const timesheetResult: TimesheetTotal | null = useMemo(() => {
    if (tab !== "timesheet") return null;
    const rows = parseTimesheetRows(timesheetText);
    if (rows.length === 0) return null;
    return computeTimesheet(rows);
  }, [tab, timesheetText]);

  const handleSaveHistory = useCallback(() => {
    if (tab === "arithmetic" && arithmeticResult) {
      saveHistory({
        ts: Date.now(),
        mode: "arithmetic",
        summary: arithmeticResult.summary,
        totalSeconds: arithmeticResult.totalSeconds,
      });
    } else if (tab === "between" && betweenResult) {
      saveHistory({
        ts: Date.now(),
        mode: "between",
        summary: betweenResult.summary,
        totalSeconds: betweenResult.totalSeconds,
      });
    } else if (tab === "timesheet" && timesheetResult) {
      saveHistory({
        ts: Date.now(),
        mode: "timesheet",
        summary: `${timesheetResult.rowCount} rows: net ${formatHms(timesheetResult.totalSeconds)}`,
        totalSeconds: timesheetResult.totalSeconds,
      });
    }
    setHistory(loadHistory());
  }, [tab, arithmeticResult, betweenResult, timesheetResult]);

  const handleClear = useCallback(() => {
    setA({ hours: 1, minutes: 30 });
    setB({ hours: 2, minutes: 45 });
    setFactor(2);
    setStart("09:00");
    setEnd("17:00");
    setNextDay(false);
    setTimesheetText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const updateA = (key: keyof DurationInput, value: number) =>
    setA((prev) => ({ ...prev, [key]: value }));
  const updateB = (key: keyof DurationInput, value: number) =>
    setB((prev) => ({ ...prev, [key]: value }));

  const startSeconds = parseClockTime(start);
  const endSeconds = parseClockTime(end);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Tab selector */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tab === "arithmetic" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("arithmetic")}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Arithmetic
            </Button>
            <Button
              variant={tab === "between" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("between")}
              className="gap-1.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Between two times
            </Button>
            <Button
              variant={tab === "timesheet" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("timesheet")}
              className="gap-1.5"
            >
              <ListChecks className="h-3.5 w-3.5" /> Timesheet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ARITHMETIC TAB */}
      {tab === "arithmetic" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs">Operation</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(["add", "subtract", "multiply", "divide"] as Operation[]).map((o) => (
                    <Button
                      key={o}
                      variant={op === o ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOp(o)}
                      className="gap-1.5"
                    >
                      {o === "add" && <Plus className="h-3.5 w-3.5" />}
                      {o === "subtract" && <Minus className="h-3.5 w-3.5" />}
                      {o === "multiply" && <X className="h-3.5 w-3.5" />}
                      {o === "divide" && <Divide className="h-3.5 w-3.5" />}
                      {OP_LABELS[o]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DurationInputCard label="Operand A" value={a} onChange={updateA} />
                {op === "multiply" || op === "divide" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Factor / divisor</Label>
                    <Input
                      type="number"
                      step="any"
                      value={factor}
                      onChange={(e) => setFactor(Number(e.target.value))}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {op === "multiply"
                        ? "Duration A will be multiplied by this number."
                        : "Duration A will be divided by this number."}
                    </p>
                  </div>
                ) : (
                  <DurationInputCard label="Operand B" value={b} onChange={updateB} />
                )}
              </div>
            </CardContent>
          </Card>

          {arithmeticResult && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Result
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="HH:MM:SS" value={arithmeticResult.hms} highlight="good" />
                  <Stat label="Decimal hours" value={arithmeticResult.decimalHours.toFixed(4)} />
                  <Stat label="Total seconds" value={arithmeticResult.totalSeconds} />
                  <Stat label="Total minutes" value={(arithmeticResult.totalSeconds / 60).toFixed(2)} />
                </div>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Human-readable</div>
                  <div className="font-medium">{arithmeticResult.human}</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-1">{formatCompact(arithmeticResult.totalSeconds)}</div>
                </div>
                <p className="text-xs text-muted-foreground">{arithmeticResult.summary}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return arithmeticResult.summary;
                    }}
                    label="Copy summary"
                  />
                  <DownloadButton
                    getText={() => arithmeticResult.summary}
                    filename="time-arithmetic.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({
                        mode: "arithmetic",
                        op,
                        aDays: a.days, aHours: a.hours, aMinutes: a.minutes, aSeconds: a.seconds,
                        bDays: b.days, bHours: b.hours, bMinutes: b.minutes, bSeconds: b.seconds,
                        factor,
                      });
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* BETWEEN TAB */}
      {tab === "between" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tdc-start">Start time</Label>
                  <Input
                    id="tdc-start"
                    type="text"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    placeholder="09:00 or 9:00 AM"
                    className="font-mono text-xs"
                  />
                  {!Number.isNaN(startSeconds) && (
                    <p className="text-[10px] text-muted-foreground">
                      {clockFmt === "12h" ? format12h(startSeconds) : format24h(startSeconds)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tdc-end">End time</Label>
                  <Input
                    id="tdc-end"
                    type="text"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    placeholder="17:00 or 5:00 PM"
                    className="font-mono text-xs"
                  />
                  {!Number.isNaN(endSeconds) && (
                    <p className="text-[10px] text-muted-foreground">
                      {clockFmt === "12h" ? format12h(endSeconds) : format24h(endSeconds)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nextDay}
                    onChange={(e) => setNextDay(e.target.checked)}
                  />
                  Force next day (end is on the day after start)
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Preview format:</span>
                  <Button
                    variant={clockFmt === "24h" ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setClockFmt("24h")}
                  >24h</Button>
                  <Button
                    variant={clockFmt === "12h" ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setClockFmt("12h")}
                  >12h</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {betweenResult ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ArrowLeftRight className="h-4 w-4" /> Duration
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="HH:MM:SS" value={betweenResult.hms} highlight="good" />
                  <Stat label="Decimal hours" value={betweenResult.decimalHours.toFixed(4)} />
                  <Stat label="Total seconds" value={betweenResult.totalSeconds} />
                  <Stat label="Total minutes" value={(betweenResult.totalSeconds / 60).toFixed(2)} />
                </div>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Human-readable</div>
                  <div className="font-medium">{betweenResult.human}</div>
                </div>
                {betweenResult.crossedMidnight && (
                  <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-400">
                    Crossed midnight (end is on next day)
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground">{betweenResult.summary}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return betweenResult.summary;
                    }}
                    label="Copy summary"
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({
                        mode: "between",
                        start, end, nextDay,
                      });
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Enter two valid clock times"
              hint="Accepts 24h (HH:MM or HH:MM:SS) or 12h (h:mm AM/PM) format. Cross-midnight is detected automatically."
              icon={<ArrowLeftRight className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {/* TIMESHEET TAB */}
      {tab === "timesheet" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tdc-sheet">Timesheet rows (one per line)</Label>
                <Textarea
                  id="tdc-sheet"
                  value={timesheetText}
                  onChange={(e) => setTimesheetText(e.target.value)}
                  placeholder={"09:00 17:00 30 lunch\n10:00 16:00 0 meeting\n22:00 06:00 0 night"}
                  className="min-h-[120px] resize-y font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Format: <code>start end [breakMinutes] [label...]</code> — breakMinutes is optional (default 0).
                  12h (with AM/PM) and 24h formats both work.
                </p>
              </div>
            </CardContent>
          </Card>

          {timesheetResult && timesheetResult.rowCount > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> Timesheet ({timesheetResult.rowCount} rows)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Net total" value={formatHms(timesheetResult.totalSeconds)} highlight="good" />
                  <Stat label="Gross total" value={formatHms(timesheetResult.totalGrossSeconds)} />
                  <Stat label="Break total" value={formatHms(timesheetResult.totalBreakSeconds)} highlight="bad" />
                  <Stat label="Decimal hours" value={toDecimalHours(timesheetResult.totalSeconds).toFixed(3)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 px-2">Start</th>
                        <th className="text-left py-1.5 px-2">End</th>
                        <th className="text-right py-1.5 px-2">Break</th>
                        <th className="text-left py-1.5 px-2">Label</th>
                        <th className="text-right py-1.5 px-2">Gross</th>
                        <th className="text-right py-1.5 px-2">Net</th>
                        <th className="text-center py-1.5 px-2">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timesheetResult.rows.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-1 px-2 font-mono text-[11px]">{r.start}</td>
                          <td className="py-1 px-2 font-mono text-[11px]">{r.end}</td>
                          <td className="py-1 px-2 text-right">{r.breakMinutes}m</td>
                          <td className="py-1 px-2 text-[11px]">{r.label || "—"}</td>
                          <td className="py-1 px-2 text-right font-mono text-[11px]">{formatHms(r.grossSeconds)}</td>
                          <td className="py-1 px-2 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                            {r.error ? "ERR" : formatHms(r.netSeconds)}
                          </td>
                          <td className="py-1 px-2 text-center">
                            {r.crossedMidnight && (
                              <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-700 dark:text-amber-400">
                                +1d
                              </Badge>
                            )}
                            {r.error && (
                              <Badge variant="outline" className="text-[9px] border-destructive text-destructive">
                                err
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return renderTimesheetText(timesheetResult);
                    }}
                    label="Copy summary"
                  />
                  <CopyButton getText={() => renderTimesheetCsv(timesheetResult)} label="Copy CSV" />
                  <DownloadButton
                    getText={() => renderTimesheetCsv(timesheetResult)}
                    filename="timesheet.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({ mode: "timesheet", rows: timesheetText });
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Add timesheet rows above"
              hint="One row per line. Format: 'start end [breakMin] [label]' (e.g. '09:00 17:00 30 lunch')."
              icon={<ListChecks className="h-8 w-8" />}
            />
          )}
        </>
      )}

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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{formatHms(h.totalSeconds)}</Badge>
                  <span className="text-muted-foreground">{h.summary}</span>
                  <span className="text-muted-foreground ml-2 text-[10px]">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All time math runs locally using integer-second arithmetic (no floating-point drift).
            Timesheet data never leaves your browser. History is stored in localStorage on this device only.
            The shareable URL uses a fragment (after #) which browsers never send to servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DurationInputCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DurationInput;
  onChange: (key: keyof DurationInput, value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {UNIT_FIELDS.map(({ key, label: unitLabel }) => (
          <div key={key}>
            <Label className="text-[10px] text-muted-foreground">{unitLabel}</Label>
            <Input
              type="number"
              value={value[key] ?? 0}
              onChange={(e) => onChange(key, Number(e.target.value))}
              className="font-mono text-xs h-8"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        = {formatHms(durationToSeconds(value))} ({formatCompact(durationToSeconds(value))})
      </p>
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
      <div className={`text-base font-semibold ${color} font-mono`}>{value}</div>
    </div>
  );
}
