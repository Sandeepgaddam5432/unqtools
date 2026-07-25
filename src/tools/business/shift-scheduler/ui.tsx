"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { totalHours, computeCoverage, formatTime, type Shift } from "./logic";

export default function ShiftScheduler() {
  const [shifts, setShifts] = useState<Shift[]>([
    { employee: "Alice", start: "09:00", end: "17:00" },
    { employee: "Bob", start: "10:00", end: "15:00" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const hrs = totalHours(shifts);
    const cov = computeCoverage(shifts);
    if (typeof hrs === "object" && "error" in hrs) { setError(hrs.error); return null; }
    if ("error" in cov) { setError(cov.error); return null; }
    setError(null);
    return { hours: hrs as number, coverage: cov };
  }, [shifts]);

  const update = (i: number, field: keyof Shift, value: string) => {
    const next = [...shifts];
    next[i] = { ...next[i]!, [field]: value };
    setShifts(next);
  };

  const report = summary ? [
    `Total coverage hours: ${summary.hours.toFixed(2)}`,
    "",
    "Coverage:",
    ...summary.coverage.map((s) => `${formatTime(s.startMin)} - ${formatTime(s.endMin)}: ${s.count} employee(s)`),
  ].join("\n") : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Shifts</Label>
            <Button size="sm" variant="outline" onClick={() => setShifts([...shifts, { employee: "", start: "09:00", end: "17:00" }])}>Add shift</Button>
          </div>
          {shifts.map((s, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center">
              <input type="text" placeholder="Employee" className="rounded-md border px-2 py-1 text-sm" value={s.employee} onChange={(e) => update(i, "employee", e.target.value)} />
              <input type="text" placeholder="Start" className="rounded-md border px-2 py-1 text-sm" value={s.start} onChange={(e) => update(i, "start", e.target.value)} />
              <input type="text" placeholder="End" className="rounded-md border px-2 py-1 text-sm" value={s.end} onChange={(e) => update(i, "end", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setShifts(shifts.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total coverage</p>
                <p className="text-2xl font-bold">{summary.hours.toFixed(2)} hours</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="shifts.txt" />
              </div>
            </div>
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{report}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
