"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computeMeetingCost,
  attendeeBreakdown,
  computeMeetingCostBatch,
  formatMoney,
  breakdownToCsv,
  renderReport,
  CURRENCIES,
  type Attendee,
  type Currency,
} from "./logic";

export default function MeetingDurationCalc() {
  const [attendees, setAttendees] = useState<Attendee[]>([
    { name: "Alice", hourlyRate: 60 },
    { name: "Bob", hourlyRate: 40 },
  ]);
  const [duration, setDuration] = useState(60);
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [overhead, setOverhead] = useState(0);
  const [overtimeThreshold, setOvertimeThreshold] = useState(0);
  const [overtimeMult, setOvertimeMult] = useState(1.5);
  const [currency, setCurrency] = useState<Currency>("USD");

  const input = useMemo(() => ({
    attendees,
    durationMinutes: duration,
    breakMinutes,
    overheadPercent: overhead,
    overtimeThresholdMinutes: overtimeThreshold,
    overtimeMultiplier: overtimeMult,
    currency,
  }), [attendees, duration, breakMinutes, overhead, overtimeThreshold, overtimeMult, currency]);

  const { result, error } = useMemo(() => {
    const r = computeMeetingCost(input);
    if ("error" in r) return { result: null, error: r.error };
    return { result: r, error: null as string | null };
  }, [input]);

  const breakdown = useMemo(() => attendeeBreakdown(input), [input]);

  const report = useMemo(() => {
    if (!result) return "";
    return renderReport(input, result);
  }, [input, result]);

  const update = (i: number, field: keyof Attendee, value: string) => {
    const next = [...attendees];
    next[i] = { ...next[i]!, [field]: field === "hourlyRate" ? Number(value) : value };
    setAttendees(next);
  };

  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Duration (min)</Label>
              <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Break (min)</Label>
              <Input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Overhead (%)</Label>
              <Input type="number" min={0} value={overhead} onChange={(e) => setOverhead(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 w-full rounded-md border px-2 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Overtime threshold (min)</Label>
              <Input type="number" min={0} value={overtimeThreshold} onChange={(e) => setOvertimeThreshold(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Overtime multiplier</Label>
              <Input type="number" step="0.1" min={1} value={overtimeMult} onChange={(e) => setOvertimeMult(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Attendees</Label>
            <Button size="sm" variant="outline" onClick={() => setAttendees([...attendees, { name: "", hourlyRate: 50 }])}>Add attendee</Button>
          </div>
          {attendees.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" placeholder="Name" className="flex-1 rounded-md border px-2 py-1 text-sm" value={a.name} onChange={(e) => update(i, "name", e.target.value)} />
              <input type="number" placeholder="Rate" className="w-24 rounded-md border px-2 py-1 text-sm" value={a.hourlyRate} onChange={(e) => update(i, "hourlyRate", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setAttendees(attendees.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total cost</p><p className="text-lg font-bold">{fmt(result.totalCost)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">With overhead</p><p className="text-lg font-bold text-primary">{fmt(result.withOverhead)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Per minute</p><p className="text-lg font-bold">{fmt(result.costPerMinute)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Per attendee</p><p className="text-lg font-bold">{fmt(result.costPerAttendee)}</p></CardContent></Card>
          </div>
          {(result.overtimeMinutes > 0 || result.breakMinutes > 0 || result.overheadCost > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {result.breakMinutes > 0 && <Badge variant="secondary">Break: {result.breakMinutes} min</Badge>}
              {result.overtimeMinutes > 0 && <Badge variant="secondary">Overtime: {result.overtimeMinutes} min · {fmt(result.overtimeCost)}</Badge>}
              {result.overheadCost > 0 && <Badge variant="secondary">Overhead: {fmt(result.overheadCost)}</Badge>}
              <Badge variant="secondary">Working: {result.workingMinutes} min</Badge>
            </div>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Per-attendee breakdown</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => report} />
                  <DownloadButton getText={() => report} filename="meeting-report.txt" />
                  <DownloadButton getText={() => breakdownToCsv(breakdown)} filename="meeting-breakdown.csv" mime="text/csv" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/80 text-xs">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Hours</th>
                    <th className="p-2 text-right">Base</th>
                    <th className="p-2 text-right">Overtime</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2">{b.name}</td>
                      <td className="p-2 text-right font-mono">{fmt(b.hourlyRate)}</td>
                      <td className="p-2 text-right font-mono">{b.hours}</td>
                      <td className="p-2 text-right font-mono">{fmt(b.cost)}</td>
                      <td className="p-2 text-right font-mono text-orange-600">{b.overtimeCost > 0 ? fmt(b.overtimeCost) : "—"}</td>
                      <td className="p-2 text-right font-mono font-bold">{fmt(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
