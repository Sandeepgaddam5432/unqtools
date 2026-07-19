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
  PAY_PERIOD_TYPES,
  PAY_PERIOD_LABELS,
  BREAK_PRESETS,
  DEFAULT_OVERTIME_THRESHOLD,
  DEFAULT_OVERTIME_RATE,
  parseEntries,
  computeTimesheet,
  dailyBreakdown,
  summaryStats,
  formatCurrency,
  formatHoursHuman,
  formatHoursDecimal,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PayPeriodType,
  type TimesheetInput,
  type HistoryEntry,
} from "./logic";
import { CalendarClock, History, Clock, FileText, AlertCircle } from "lucide-react";

const SAMPLE_ENTRIES = `2026-07-13,09:00,17:30,30
2026-07-14,09:00,17:30,30
2026-07-15,09:00,17:30,30
2026-07-16,09:00,17:30,30
2026-07-17,09:00,16:00,30`;

function defaultWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function TimesheetGenerator() {
  const [employeeName, setEmployeeName] = useState("");
  const [weekStartDate, setWeekStartDate] = useState(defaultWeekStart());
  const [payPeriodType, setPayPeriodType] = useState<PayPeriodType>("weekly");
  const [entriesText, setEntriesText] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [overtimeThreshold, setOvertimeThreshold] = useState<number>(DEFAULT_OVERTIME_THRESHOLD);
  const [overtimeRate, setOvertimeRate] = useState<number>(DEFAULT_OVERTIME_RATE);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      let loaded = false;
      if (typeof p.employeeName === "string") { setEmployeeName(p.employeeName); loaded = true; }
      if (typeof p.weekStartDate === "string") { setWeekStartDate(p.weekStartDate); loaded = true; }
      if (p.payPeriodType) { setPayPeriodType(p.payPeriodType); loaded = true; }
      if (typeof p.entriesText === "string") { setEntriesText(p.entriesText); loaded = true; }
      if (typeof p.hourlyRate === "number") { setHourlyRate(p.hourlyRate); loaded = true; }
      if (typeof p.overtimeThreshold === "number") { setOvertimeThreshold(p.overtimeThreshold); loaded = true; }
      if (typeof p.overtimeRate === "number") { setOvertimeRate(p.overtimeRate); loaded = true; }
      if (loaded) toast.info("Loaded from share link");
    }
  }, []);

  const input: TimesheetInput = useMemo(() => ({
    employeeName,
    weekStartDate,
    payPeriodType,
    entriesText,
    hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 0,
    overtimeThreshold: Number.isFinite(overtimeThreshold) ? overtimeThreshold : 0,
    overtimeRate: Number.isFinite(overtimeRate) ? overtimeRate : 0,
  }), [employeeName, weekStartDate, payPeriodType, entriesText, hourlyRate, overtimeThreshold, overtimeRate]);

  const result = useMemo(() => computeTimesheet(input), [input]);
  const stats = useMemo(() => summaryStats(result), [result]);
  const days = useMemo(() => dailyBreakdown(result), [result]);
  const parsed = useMemo(() => parseEntries(entriesText), [entriesText]);
  const errorCount = parsed.filter((p) => !p.ok).length;

  const text = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const html = useMemo(() => renderHtml(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.entries.length > 0) {
      saveHistory({
        ts: Date.now(),
        employeeName: result.employeeName,
        weekStartDate: result.weekStartDate,
        payPeriodType: result.payPeriodType,
        totalHours: result.totalWorkedHours,
        grossPay: result.grossPay,
        daysWorked: result.daysWorked,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setEmployeeName("");
    setEntriesText("");
    setHourlyRate(0);
    setOvertimeThreshold(DEFAULT_OVERTIME_THRESHOLD);
    setOvertimeRate(DEFAULT_OVERTIME_RATE);
    setWeekStartDate(defaultWeekStart());
    setPayPeriodType("weekly");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSample = useCallback(() => {
    setEmployeeName("Jane Doe");
    setEntriesText(SAMPLE_ENTRIES);
    setHourlyRate(25);
    setWeekStartDate("2026-07-13");
    toast.info("Sample data loaded");
  }, []);

  const handleShare = useCallback(() => {
    handleSaveHistory();
    return buildShareUrl(input);
  }, [input, handleSaveHistory]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tg-employee">Employee name</Label>
              <Input
                id="tg-employee"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg-week">Week start date (Monday)</Label>
              <Input
                id="tg-week"
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tg-period">Pay period</Label>
              <select
                id="tg-period"
                value={payPeriodType}
                onChange={(e) => setPayPeriodType(e.target.value as PayPeriodType)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAY_PERIOD_TYPES.map((p) => (
                  <option key={p} value={p}>{PAY_PERIOD_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg-rate">Hourly rate ($)</Label>
              <Input
                id="tg-rate"
                type="number"
                min={0}
                step={0.01}
                value={Number.isFinite(hourlyRate) ? hourlyRate : 0}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                placeholder="0 = hours only"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="tg-th">OT threshold (hrs)</Label>
                <Input
                  id="tg-th"
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isFinite(overtimeThreshold) ? overtimeThreshold : 0}
                  onChange={(e) => setOvertimeThreshold(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tg-mul">OT multiplier</Label>
                <Input
                  id="tg-mul"
                  type="number"
                  min={0}
                  step={0.1}
                  value={Number.isFinite(overtimeRate) ? overtimeRate : 0}
                  onChange={(e) => setOvertimeRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tg-entries">
              Entries — one per line: <code className="text-[11px] bg-muted px-1 py-0.5 rounded">date,clock_in,clock_out,break_minutes</code>
            </Label>
            <Textarea
              id="tg-entries"
              value={entriesText}
              onChange={(e) => setEntriesText(e.target.value)}
              placeholder={"2026-07-13,09:00,17:30,30\n2026-07-14,09:00,17:00,30"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground mr-1">Break presets:</span>
              {BREAK_PRESETS.map((b) => (
                <Button
                  key={b}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setEntriesText((prev) => {
                    const last = prev.trim().split(/\n/).filter(Boolean).pop() ?? "";
                    // Append a new line with current date + selected break
                    const today = new Date().toISOString().slice(0, 10);
                    const newLine = `${today},09:00,17:00,${b}`;
                    return prev ? `${prev.replace(/\s+$/, "")}\n${newLine}` : newLine;
                  })}
                >+ {b}m</Button>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={handleSample}>Load sample</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.entries.length > 0 || errorCount > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total hours" value={formatHoursDecimal(stats.totalHours)} />
                <Stat label="Regular hours" value={stats.regularHours.toFixed(2)} />
                <Stat label="Overtime hours" value={stats.overtimeHours.toFixed(2)} highlight={stats.hasOvertime ? "bad" : undefined} />
                <Stat label="Days worked" value={stats.daysWorked} />
                <Stat label="Entries" value={stats.entryCount} />
                <Stat label="Avg hrs/day" value={stats.avgHoursPerDay.toFixed(2)} />
                <Stat label="Break (min)" value={result.totalBreakMinutes} />
                <Stat
                  label="Gross pay"
                  value={result.hourlyRate > 0 ? formatCurrency(stats.grossPay) : "—"}
                  highlight={result.hourlyRate > 0 ? "good" : undefined}
                />
              </div>
            </CardContent>
          </Card>

          {errorCount > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> {errorCount} parse error{errorCount === 1 ? "" : "s"}
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="rounded border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs">
                      <span className="font-mono text-destructive">Line {e.lineNo}:</span>{" "}
                      <span>{e.error}</span>
                      <div className="font-mono text-muted-foreground mt-0.5">{e.raw}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Entries ({result.entries.length})
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">In</th>
                      <th className="text-left p-2">Out</th>
                      <th className="text-right p-2">Break</th>
                      <th className="text-right p-2">Hours</th>
                      <th className="text-right p-2">Reg.</th>
                      <th className="text-right p-2">OT</th>
                      <th className="text-right p-2">Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.entries.map((e, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-mono">{e.entry.date}</td>
                        <td className="p-2 font-mono">{e.entry.clockIn}</td>
                        <td className="p-2 font-mono">{e.entry.clockOut}</td>
                        <td className="p-2 text-right">{e.entry.breakMinutes}m</td>
                        <td className="p-2 text-right font-mono">{e.workedHours.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{e.regularHours.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">
                          {e.overtimeHours > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">{e.overtimeHours.toFixed(2)}</Badge>
                          ) : "0.00"}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {result.hourlyRate > 0 ? formatCurrency(e.pay) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={4} className="p-2 text-right">Totals:</td>
                      <td className="p-2 text-right font-mono">{result.totalWorkedHours.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{result.totalRegularHours.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{result.totalOvertimeHours.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">
                        {result.hourlyRate > 0 ? formatCurrency(result.grossPay) : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {days.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Daily breakdown</div>
                  {days.map((d) => (
                    <div key={d.date} className="flex flex-wrap items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono font-medium">{d.date}</span>
                      <Badge variant="outline" className="text-[10px]">{d.entryCount} {d.entryCount === 1 ? "entry" : "entries"}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{d.workedHours.toFixed(2)} hrs</Badge>
                      {d.overtimeHours > 0 && (
                        <Badge variant="destructive" className="text-[10px]">OT {d.overtimeHours.toFixed(2)}</Badge>
                      )}
                      <span className="text-muted-foreground ml-auto">
                        {result.hourlyRate > 0 ? formatCurrency(d.pay) : `${d.breakMinutes}m break`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`timesheet-${result.weekStartDate}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename={`timesheet-${result.weekStartDate}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => html}
                  filename={`timesheet-${result.weekStartDate}.html`}
                  mime="text/html"
                  label="Download HTML"
                />
                <ShareButton getUrl={handleShare} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Add clock-in/out entries to generate your timesheet"
          hint="One entry per line in the form date,clock_in,clock_out,break_minutes — e.g. 2026-07-13,09:00,17:30,30. Click 'Load sample' to see how it works."
          icon={<CalendarClock className="h-8 w-8" />}
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
                  <span className="font-medium">{h.employeeName}</span>
                  <Badge variant="outline" className="text-[10px] ml-2">{PAY_PERIOD_LABELS[h.payPeriodType]}</Badge>
                  <Badge variant="secondary" className="text-[10px] ml-2">{formatHoursHuman(h.totalHours)}</Badge>
                  {h.grossPay > 0 && (
                    <Badge variant="outline" className="text-[10px] ml-2">{formatCurrency(h.grossPay)}</Badge>
                  )}
                  <span className="text-muted-foreground ml-2">· wk of {h.weekStartDate}</span>
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
            <strong className="text-foreground">Privacy:</strong> All timesheet computation runs 100% locally in your browser. History is stored in localStorage on this device only. Overtime is computed on the weekly total per FLSA-style rules — verify with HR/payroll before filing.
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
