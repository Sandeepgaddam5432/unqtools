"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computeTimesheet, perDayHours, fmt, type TimesheetEntry,
} from "./logic";

export default function TimesheetCalc() {
  const [entries, setEntries] = useState<TimesheetEntry[]>([
    { start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }], date: "2024-01-01" },
  ]);
  const [hourlyRate, setHourlyRate] = useState("20");
  const [overtimeRate, setOvertimeRate] = useState("1.5");
  const [regularThreshold, setRegularThreshold] = useState("8");
  const [doubleRate, setDoubleRate] = useState("2");
  const [doubleThreshold, setDoubleThreshold] = useState("12");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeTimesheet({
      entries, hourlyRate: Number(hourlyRate),
      overtimeRate: Number(overtimeRate),
      regularThreshold: Number(regularThreshold),
      doubleRate: Number(doubleRate),
      doubleThreshold: Number(doubleThreshold),
    });
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [entries, hourlyRate, overtimeRate, regularThreshold, doubleRate, doubleThreshold]);

  const perDay = useMemo(() => perDayHours(entries), [entries]);

  const update = (i: number, field: keyof TimesheetEntry, value: string) => {
    const next = [...entries];
    next[i] = { ...next[i]!, [field]: value };
    setEntries(next);
  };
  const updateBreak = (i: number, j: number, field: "start" | "end", value: string) => {
    const next = [...entries];
    const breaks = [...(next[i]!.breaks)];
    breaks[j] = { ...breaks[j]!, [field]: value };
    next[i] = { ...next[i]!, breaks };
    setEntries(next);
  };

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Regular hours,${result.regularHours}`,
      `Overtime hours,${result.overtimeHours}`,
      `Double-time hours,${result.doubleHours}`,
      `Total hours,${result.totalHours}`,
      `Gross hours,${result.grossHours}`,
      `Break hours,${result.breakHours}`,
      `Regular pay,${result.regularPay}`,
      `Overtime pay,${result.overtimePay}`,
      `Double-time pay,${result.doublePay}`,
      `Total pay,${result.totalPay}`,
    ].join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div><Label className="text-xs text-muted-foreground">Rate ($/h)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">OT ×</Label><input type="number" step="0.1" className="w-full rounded-md border px-2 py-1 text-sm" value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">OT threshold</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={regularThreshold} onChange={(e) => setRegularThreshold(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">DT ×</Label><input type="number" step="0.1" className="w-full rounded-md border px-2 py-1 text-sm" value={doubleRate} onChange={(e) => setDoubleRate(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">DT threshold</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={doubleThreshold} onChange={(e) => setDoubleThreshold(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Entries</Label>
            <Button size="sm" variant="outline" onClick={() => setEntries([...entries, { start: "09:00", end: "17:00", breaks: [], date: "" }])}>Add entry</Button>
          </div>
          {entries.map((e, i) => (
            <div key={i} className="space-y-2 border rounded-md p-2">
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="Date" className="rounded-md border px-2 py-1 text-sm" value={e.date ?? ""} onChange={(ev) => update(i, "date" as keyof TimesheetEntry, ev.target.value)} />
                <input type="text" placeholder="Start" className="rounded-md border px-2 py-1 text-sm" value={e.start} onChange={(ev) => update(i, "start", ev.target.value)} />
                <input type="text" placeholder="End" className="rounded-md border px-2 py-1 text-sm" value={e.end} onChange={(ev) => update(i, "end", ev.target.value)} />
              </div>
              {e.breaks.map((b, j) => (
                <div key={j} className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground">Break:</span>
                  <input type="text" placeholder="Start" className="flex-1 rounded-md border px-2 py-1 text-sm" value={b.start} onChange={(ev) => updateBreak(i, j, "start", ev.target.value)} />
                  <input type="text" placeholder="End" className="flex-1 rounded-md border px-2 py-1 text-sm" value={b.end} onChange={(ev) => updateBreak(i, j, "end", ev.target.value)} />
                  <Button size="sm" variant="ghost" onClick={() => {
                    const next = [...entries];
                    next[i] = { ...next[i]!, breaks: e.breaks.filter((_, k) => k !== j) };
                    setEntries(next);
                  }}>×</Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => {
                  const next = [...entries];
                  next[i] = { ...next[i]!, breaks: [...e.breaks, { start: "12:00", end: "12:30" }] };
                  setEntries(next);
                }}>+ Break</Button>
                <Button size="sm" variant="ghost" onClick={() => setEntries(entries.filter((_, j) => j !== i))}>Remove entry</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total pay</p>
                <p className="text-2xl font-bold">${fmt(result.totalPay, 2)}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">Reg: {fmt(result.regularHours, 2)}h</Badge>
                <Badge variant="outline">OT: {fmt(result.overtimeHours, 2)}h</Badge>
                {result.doubleHours > 0 && <Badge variant="outline">DT: {fmt(result.doubleHours, 2)}h</Badge>}
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => csv} />
                <DownloadButton getText={() => csv} filename="timesheet.csv" mime="text/csv" />
              </div>
            </div>
            <pre className="text-xs p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{csv}</pre>
          </CardContent>
        </Card>
      )}

      {result && !error && !("error" in perDay) && (
        <Card><CardContent className="p-4 space-y-1">
          <Label className="text-xs text-muted-foreground">Per-day hours</Label>
          {Object.entries(perDay).map(([date, h]) => (
            <p key={date} className="text-sm">{date}: <span className="font-mono">{fmt(h, 2)} h</span></p>
          ))}
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
