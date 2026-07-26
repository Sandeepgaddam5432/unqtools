"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  totalHours, computeCoverage, formatTime, detectGaps,
  perEmployeeHours, detectConflicts, coverageStats, detectOvertime,
  shiftsToCsv, coverageToCsv, SHIFT_TEMPLATES, fmt, type Shift,
} from "./logic";

export default function ShiftScheduler() {
  const [shifts, setShifts] = useState<Shift[]>([
    { employee: "Alice", start: "09:00", end: "17:00" },
    { employee: "Bob", start: "10:00", end: "15:00" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const hrs = totalHours(shifts);
    const cov = computeCoverage(shifts);
    if (typeof hrs === "object" && "error" in hrs) { queueMicrotask(() => setError(hrs.error)); return null; }
    if ("error" in cov) { queueMicrotask(() => setError(cov.error)); return null; }
    const gaps = detectGaps(shifts, 1);
    if ("error" in gaps) { queueMicrotask(() => setError(gaps.error)); return null; }
    const empHours = perEmployeeHours(shifts);
    if ("error" in empHours) { queueMicrotask(() => setError(empHours.error)); return null; }
    const conflicts = detectConflicts(shifts);
    if ("error" in conflicts) { queueMicrotask(() => setError(conflicts.error)); return null; }
    const overtime = detectOvertime(shifts, 8);
    if ("error" in overtime) { queueMicrotask(() => setError(overtime.error)); return null; }
    queueMicrotask(() => setError(null));
    return { hours: hrs as number, coverage: cov, gaps, empHours, conflicts, overtime, stats: coverageStats(cov) };
  }, [shifts]);

  const update = (i: number, field: keyof Shift, value: string) => {
    const next = [...shifts];
    next[i] = { ...next[i]!, [field]: value };
    setShifts(next);
  };
  const remove = (i: number) => setShifts(shifts.filter((_, j) => j !== i));

  const csv = useMemo(() => {
    if (!summary) return "";
    return shiftsToCsv(shifts) + "\n\n" + coverageToCsv(summary.coverage);
  }, [shifts, summary]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Shifts</Label>
            <Button size="sm" variant="outline" onClick={() => setShifts([...shifts, { employee: "", start: "09:00", end: "17:00" }])}>Add shift</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SHIFT_TEMPLATES.map((t) => (
              <Button key={t.label} size="sm" variant="outline" onClick={() => setShifts([...shifts, { employee: "New", start: t.start, end: t.end }])}>
                {t.label} ({t.start}–{t.end})
              </Button>
            ))}
          </div>
          {shifts.map((s, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center">
              <input type="text" placeholder="Employee" className="rounded-md border px-2 py-1 text-sm" value={s.employee} onChange={(e) => update(i, "employee", e.target.value)} />
              <input type="text" placeholder="Start" className="rounded-md border px-2 py-1 text-sm" value={s.start} onChange={(e) => update(i, "start", e.target.value)} />
              <input type="text" placeholder="End" className="rounded-md border px-2 py-1 text-sm" value={s.end} onChange={(e) => update(i, "end", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => remove(i)}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {summary && !error && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Total coverage</p>
                  <p className="text-2xl font-bold">{fmt(summary.hours, 2)} hours</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">Min: {summary.stats.min}</Badge>
                  <Badge variant="outline">Max: {summary.stats.max}</Badge>
                  <Badge variant="outline">Avg: {fmt(summary.stats.avg, 2)}</Badge>
                </div>
                <div className="flex gap-2">
                  <CopyButton getText={() => csv} />
                  <DownloadButton getText={() => csv} filename="shifts.csv" mime="text/csv" />
                </div>
              </div>
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">
                {summary.coverage.map((s) => `${formatTime(s.startMin)} - ${formatTime(s.endMin)}: ${s.count} employee(s)`).join("\n")}
              </pre>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card><CardContent className="p-4 space-y-1">
              <Label className="text-xs text-muted-foreground">Per-employee hours</Label>
              {Object.entries(summary.empHours).map(([emp, h]) => (
                <p key={emp} className="text-sm">{emp}: <span className="font-mono">{fmt(h, 2)} h</span></p>
              ))}
            </CardContent></Card>
            <Card><CardContent className="p-4 space-y-1">
              <Label className="text-xs text-muted-foreground">Overtime (over 8h)</Label>
              {summary.overtime.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
              {summary.overtime.map((o) => (
                <p key={o.employee} className="text-sm">{o.employee}: <span className="font-mono">{fmt(o.hours, 2)} h</span> {o.overtime > 0 && <Badge variant="destructive">+{fmt(o.overtime, 2)} OT</Badge>}</p>
              ))}
            </CardContent></Card>
          </div>

          {(summary.gaps.length > 0 || summary.conflicts.length > 0) && (
            <Card><CardContent className="p-4 space-y-2">
              {summary.gaps.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Coverage gaps</Label>
                  {summary.gaps.slice(0, 5).map((g, i) => (
                    <p key={i} className="text-xs font-mono text-yellow-700 dark:text-yellow-400">{formatTime(g.startMin)} - {formatTime(g.endMin)} (count={g.count})</p>
                  ))}
                </div>
              )}
              {summary.conflicts.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Conflicts</Label>
                  {summary.conflicts.map((c, i) => (
                    <p key={i} className="text-xs font-mono text-destructive">{c.employee}: {c.a.start}–{c.a.end} ∩ {c.b.start}–{c.b.end}</p>
                  ))}
                </div>
              )}
            </CardContent></Card>
          )}
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
