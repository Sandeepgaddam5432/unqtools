"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeTimesheet, type TimesheetEntry } from "./logic";

export default function TimesheetCalc() {
  const [entries, setEntries] = useState<TimesheetEntry[]>([{ start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] }]);
  const [hourlyRate, setHourlyRate] = useState(20);
  const [overtimeRate, setOvertimeRate] = useState(1.5);
  const [regularThreshold, setRegularThreshold] = useState(8);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeTimesheet({ entries, hourlyRate, overtimeRate, regularThreshold });
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [entries, hourlyRate, overtimeRate, regularThreshold]);

  const update = (i: number, field: keyof TimesheetEntry, value: string) => {
    const next = [...entries];
    next[i] = { ...next[i]!, [field]: value };
    setEntries(next);
  };

  const report = result ? [
    `Regular hours: ${result.regularHours.toFixed(2)}`,
    `Overtime hours: ${result.overtimeHours.toFixed(2)}`,
    `Total hours: ${result.totalHours.toFixed(2)}`,
    `Regular pay: $${result.regularPay.toFixed(2)}`,
    `Overtime pay: $${result.overtimePay.toFixed(2)}`,
    `Total pay: $${result.totalPay.toFixed(2)}`,
  ].join("\n") : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs text-muted-foreground">Hourly rate ($)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Overtime ×</Label><input type="number" step="0.1" className="w-full rounded-md border px-2 py-1 text-sm" value={overtimeRate} onChange={(e) => setOvertimeRate(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Regular threshold (h)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={regularThreshold} onChange={(e) => setRegularThreshold(Number(e.target.value))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Entries</Label>
            <Button size="sm" variant="outline" onClick={() => setEntries([...entries, { start: "09:00", end: "17:00", breaks: [] }])}>Add entry</Button>
          </div>
          {entries.map((e, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" placeholder="Start" className="flex-1 rounded-md border px-2 py-1 text-sm" value={e.start} onChange={(ev) => update(i, "start", ev.target.value)} />
              <input type="text" placeholder="End" className="flex-1 rounded-md border px-2 py-1 text-sm" value={e.end} onChange={(ev) => update(i, "end", ev.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setEntries(entries.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Results</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="timesheet.txt" />
              </div>
            </div>
            <pre className="text-sm p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{report}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
