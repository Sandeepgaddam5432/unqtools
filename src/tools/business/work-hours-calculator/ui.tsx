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
} from "../../_shared";
import { toast } from "sonner";
import {
  SHIFT_PRESETS,
  BREAK_PRESETS,
  RATE_PRESETS,
  DEFAULT_INPUT,
  parseTime,
  formatTime,
  detectOvernight,
  calculate,
  summaryStats,
  formatMoney,
  formatHours,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WorkHoursInput,
  type TimeFormat,
  type HistoryEntry,
} from "./logic";
import { Clock, History, FileText, AlertCircle, Moon } from "lucide-react";

export default function WorkHoursCalculator() {
  const [startTime, setStartTime] = useState(DEFAULT_INPUT.startTime);
  const [endTime, setEndTime] = useState(DEFAULT_INPUT.endTime);
  const [breakMinutes, setBreakMinutes] = useState<number>(DEFAULT_INPUT.breakMinutes);
  const [overnightShift, setOvernightShift] = useState(DEFAULT_INPUT.overnightShift);
  const [hourlyRate, setHourlyRate] = useState<number>(DEFAULT_INPUT.hourlyRate);
  const [overtimeAfterHours, setOvertimeAfterHours] = useState<number>(DEFAULT_INPUT.overtimeAfterHours);
  const [overtimeRateMultiplier, setOvertimeRateMultiplier] = useState<number>(DEFAULT_INPUT.overtimeRateMultiplier);
  const [dateFormat, setDateFormat] = useState<TimeFormat>(DEFAULT_INPUT.dateFormat);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setStartTime(p.startTime);
      setEndTime(p.endTime);
      setBreakMinutes(p.breakMinutes);
      setOvernightShift(p.overnightShift);
      setHourlyRate(p.hourlyRate);
      setOvertimeAfterHours(p.overtimeAfterHours);
      setOvertimeRateMultiplier(p.overtimeRateMultiplier);
      setDateFormat(p.dateFormat);
      toast.info("Loaded from share link");
    }
  }, []);

  const input: WorkHoursInput = useMemo(() => ({
    startTime,
    endTime,
    breakMinutes: Number.isFinite(breakMinutes) ? breakMinutes : 0,
    overnightShift,
    hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 0,
    overtimeAfterHours: Number.isFinite(overtimeAfterHours) ? overtimeAfterHours : 0,
    overtimeRateMultiplier: Number.isFinite(overtimeRateMultiplier) ? overtimeRateMultiplier : 0,
    dateFormat,
  }), [startTime, endTime, breakMinutes, overnightShift, hourlyRate, overtimeAfterHours, overtimeRateMultiplier, dateFormat]);

  const result = useMemo(() => calculate(input), [input]);
  const stats = useMemo(() => summaryStats(result), [result]);
  const text = useMemo(() => renderText(input, result), [input, result]);
  const csv = useMemo(() => renderCsv(input, result), [input, result]);

  const startMin = parseTime(startTime);
  const endMin = parseTime(endTime);
  const autoOvernight = startMin !== null && endMin !== null ? detectOvernight(startMin, endMin) : false;
  const previewStart = startMin !== null ? formatTime(startMin, dateFormat) : "(invalid)";
  const previewEnd = endMin !== null ? formatTime(endMin, dateFormat) : "(invalid)";

  const handleSaveHistory = useCallback(() => {
    if (result.workedMinutes > 0 || result.errors.length === 0) {
      saveHistory({
        ts: Date.now(),
        startTime,
        endTime,
        breakMinutes,
        overnightShift,
        hourlyRate,
        overtimeAfterHours,
        overtimeRateMultiplier,
        dateFormat,
        workedHours: result.workedHours,
        totalPay: result.totalPay,
      });
      setHistory(loadHistory());
    }
  }, [startTime, endTime, breakMinutes, overnightShift, hourlyRate, overtimeAfterHours, overtimeRateMultiplier, dateFormat, result]);

  const handleClear = useCallback(() => {
    setStartTime(DEFAULT_INPUT.startTime);
    setEndTime(DEFAULT_INPUT.endTime);
    setBreakMinutes(DEFAULT_INPUT.breakMinutes);
    setOvernightShift(DEFAULT_INPUT.overnightShift);
    setHourlyRate(DEFAULT_INPUT.hourlyRate);
    setOvertimeAfterHours(DEFAULT_INPUT.overtimeAfterHours);
    setOvertimeRateMultiplier(DEFAULT_INPUT.overtimeRateMultiplier);
    setDateFormat(DEFAULT_INPUT.dateFormat);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyPreset = (presetId: string) => {
    const p = SHIFT_PRESETS.find((s) => s.id === presetId);
    if (!p) return;
    setStartTime(p.start);
    setEndTime(p.end);
    setBreakMinutes(p.breakMinutes);
    setOvernightShift(p.overnight);
    toast.info(`Applied preset: ${p.label}`);
  };

  const numField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    step = 1,
    min = 0,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="h-9 text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="whc-start">Start time</Label>
              <Input
                id="whc-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="09:00 or 9:00 AM"
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Preview: {previewStart}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whc-end">End time</Label>
              <Input
                id="whc-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="17:00 or 5:00 PM"
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Preview: {previewEnd}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {numField("Break (minutes)", breakMinutes, setBreakMinutes, 5, 0)}
            {numField("Hourly rate (0 = off)", hourlyRate, setHourlyRate, 0.5, 0)}
            {numField("OT after hours", overtimeAfterHours, setOvertimeAfterHours, 0.5, 0)}
            {numField("OT multiplier", overtimeRateMultiplier, setOvertimeRateMultiplier, 0.1, 0)}
            <div className="space-y-1.5">
              <Label className="text-xs">Time format</Label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as TimeFormat)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                <option value="24h">24-hour (HH:MM)</option>
                <option value="12h">12-hour (H:MM AM/PM)</option>
              </select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input
                id="whc-overnight"
                type="checkbox"
                checked={overnightShift}
                onChange={(e) => setOvernightShift(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="whc-overnight" className="text-xs cursor-pointer flex items-center gap-1">
                <Moon className="h-3 w-3" /> Overnight shift
              </label>
            </div>
          </div>

          {autoOvernight && !overnightShift && (
            <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              End time is before start time — auto-detected as overnight (next day).
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Quick presets</Label>
            <div className="flex flex-wrap gap-1">
              {SHIFT_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Break presets (minutes)</Label>
            <div className="flex flex-wrap gap-1">
              {BREAK_PRESETS.map((b) => (
                <Button
                  key={b}
                  variant={breakMinutes === b ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setBreakMinutes(b)}
                >
                  {b}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Rate presets (0 = off)</Label>
            <div className="flex flex-wrap gap-1">
              {RATE_PRESETS.map((r) => (
                <Button
                  key={r}
                  variant={hourlyRate === r ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setHourlyRate(r)}
                >
                  {r === 0 ? "off" : `$${r}`}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Issues with your input</span>
          </div>
          <ul className="list-disc list-inside text-xs text-destructive space-y-0.5">
            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {result.workedMinutes > 0 || (startMin !== null && endMin !== null) ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Worked hours" value={formatHours(stats.workedHours)} />
                <Stat label="Regular hours" value={formatHours(stats.regularHours)} />
                <Stat label="Overtime hours" value={formatHours(stats.overtimeHours)} highlight={stats.hasOvertime ? "bad" : undefined} />
                <Stat
                  label="Total pay"
                  value={stats.hasRate ? `$${formatMoney(stats.totalPay)}` : "—"}
                  highlight={stats.hasRate ? "good" : undefined}
                />
                <Stat
                  label="Effective rate"
                  value={stats.hasRate ? `$${formatMoney(stats.effectiveRate)}/hr` : "—"}
                />
                <Stat label="Span (min)" value={String(result.spanMinutes)} />
                <Stat label="Break (min)" value={String(Math.max(0, breakMinutes))} />
                <Stat
                  label="Overnight"
                  value={stats.isOvernight ? "yes" : "no"}
                  highlight={stats.isOvernight ? "bad" : undefined}
                />
              </div>
              {result.hasRate && stats.hasOvertime && (
                <div className="pt-2 text-xs text-muted-foreground">
                  Regular pay: <span className="font-medium text-foreground">${formatMoney(result.regularPay)}</span>
                  {" · "}Overtime pay: <span className="font-medium text-foreground">${formatMoney(result.overtimePay)}</span>
                  {" · "}OT rate: <span className="font-medium text-foreground">${formatMoney(hourlyRate * overtimeRateMultiplier)}/hr</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Report
              </h3>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
{text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="work-hours.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="work-hours.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter start and end times to calculate work hours"
          hint="Supports 12h (9:30 AM) and 24h (09:30) formats. Toggle overnight shift if end < start. Add a break, an hourly rate, and an overtime threshold to compute pay."
          icon={<Clock className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setStartTime(h.startTime);
                    setEndTime(h.endTime);
                    setBreakMinutes(h.breakMinutes);
                    setOvernightShift(h.overnightShift);
                    setHourlyRate(h.hourlyRate);
                    setOvertimeAfterHours(h.overtimeAfterHours);
                    setOvertimeRateMultiplier(h.overtimeRateMultiplier);
                    setDateFormat(h.dateFormat);
                    toast.info("Restored from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{formatHours(h.workedHours)}h</Badge>
                    {h.totalPay > 0 && <Badge variant="outline" className="text-[10px]">${formatMoney(h.totalPay)}</Badge>}
                    {h.overnightShift && <Badge variant="outline" className="text-[10px]">overnight</Badge>}
                    <span className="font-mono text-muted-foreground">
                      {h.startTime} → {h.endTime}
                    </span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
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
            <strong className="text-foreground">Privacy:</strong> All calculations run 100% in your browser. History is stored in localStorage on this device only. The share link encodes inputs in the URL hash which never leaves the device unless you copy and send it.
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
  value: string;
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
