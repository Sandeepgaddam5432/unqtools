"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computeDuration, computePayroll, batchCompute, batchToCsv,
  toHHMM, fmt, type TimeRange,
} from "./logic";

export default function TimeDurationCalc() {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [breaks, setBreaks] = useState<TimeRange[]>([{ start: "12:00", end: "13:00" }]);
  const [rate, setRate] = useState("20");
  const [otMult, setOtMult] = useState("1.5");
  const [dtMult, setDtMult] = useState("2");
  const [otThresh, setOtThresh] = useState("8");
  const [dtThresh, setDtThresh] = useState("12");
  const [batch, setBatch] = useState("09:00-17:00\n08:00-16:00\n22:00-06:00");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeDuration({ start, end, breaks });
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    queueMicrotask(() => setError(null));
    return r;
  }, [start, end, breaks]);

  const payroll = useMemo(() => {
    if (!result) return null;
    return computePayroll({
      ranges: [{ start, end, breaks }],
      regularRate: Number(rate),
      overtimeMultiplier: Number(otMult),
      doubleMultiplier: Number(dtMult),
      overtimeThreshold: Number(otThresh),
      doubleThreshold: Number(dtThresh),
    });
  }, [result, start, end, breaks, rate, otMult, dtMult, otThresh, dtThresh]);

  const batchResult = useMemo(() => {
    const ranges = batch.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [s, e] = line.split("-");
      return { start: s?.trim() ?? "", end: e?.trim() ?? "", breaks: [] };
    });
    return batchCompute(ranges);
  }, [batch]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Start,${start}`,
      `End,${end}`,
      `Total,${result.totalMinutes}`,
      `Breaks,${result.breakMinutes}`,
      `Net (min),${result.netMinutes}`,
      `Net (hours),${result.hours}`,
      `Formatted,"${result.formatted}"`,
    ].join("\n");
  }, [result, start, end]);

  const updateBreak = (i: number, field: keyof TimeRange, value: string) => {
    const next = [...breaks];
    next[i] = { ...next[i]!, [field]: value };
    setBreaks(next);
  };
  const addBreak = () => setBreaks([...breaks, { start: "12:00", end: "12:30" }]);
  const removeBreak = (i: number) => setBreaks(breaks.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground">Start (HH:MM)</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">End (HH:MM)</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Breaks (deducted)</Label>
              <Button size="sm" variant="outline" onClick={addBreak}>Add break</Button>
            </div>
            {breaks.map((b, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="text" placeholder="Start" className="flex-1 rounded-md border px-2 py-1 text-sm" value={b.start} onChange={(e) => updateBreak(i, "start", e.target.value)} />
                <input type="text" placeholder="End" className="flex-1 rounded-md border px-2 py-1 text-sm" value={b.end} onChange={(e) => updateBreak(i, "end", e.target.value)} />
                <Button size="sm" variant="ghost" onClick={() => removeBreak(i)}>Remove</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Duration</p>
              <div className="flex gap-2">
                <CopyButton getText={() => csv} />
                <DownloadButton getText={() => csv} filename="duration.csv" mime="text/csv" />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Gross total</td><td className="py-1.5 text-right font-mono">{result.totalMinutes} min · {toHHMM(result.totalMinutes)}</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Breaks</td><td className="py-1.5 text-right font-mono">{result.breakMinutes} min</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Net</td><td className="py-1.5 text-right font-mono">{result.formatted} ({fmt(result.hours, 2)} h)</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {payroll && !error && !("error" in payroll) && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Payroll mode</p>
            <Badge variant="outline">${rate}/hr · ×{otMult} OT · ×{dtMult} DT</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><Label className="text-xs">Regular rate ($/hr)</Label><input value={rate} onChange={(e) => setRate(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
            <div><Label className="text-xs">OT multiplier</Label><input value={otMult} onChange={(e) => setOtMult(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
            <div><Label className="text-xs">OT threshold (h)</Label><input value={otThresh} onChange={(e) => setOtThresh(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
            <div><Label className="text-xs">DT threshold (h)</Label><input value={dtThresh} onChange={(e) => setDtThresh(e.target.value)} className="w-full rounded-md border px-2 py-1" /></div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1 text-muted-foreground">Regular</td><td className="text-right font-mono">{fmt(payroll.regularHours, 2)} h · ${fmt(payroll.regularPay, 2)}</td></tr>
              <tr className="border-b"><td className="py-1 text-muted-foreground">Overtime</td><td className="text-right font-mono">{fmt(payroll.overtimeHours, 2)} h · ${fmt(payroll.overtimePay, 2)}</td></tr>
              <tr className="border-b"><td className="py-1 text-muted-foreground">Double-time</td><td className="text-right font-mono">{fmt(payroll.doubleHours, 2)} h · ${fmt(payroll.doublePay, 2)}</td></tr>
              <tr><td className="py-1 font-medium">Total</td><td className="text-right font-mono font-bold">{fmt(payroll.totalHours, 2)} h · ${fmt(payroll.totalPay, 2)}</td></tr>
            </tbody>
          </table>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Batch (start-end per line)</Label>
          {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
        </div>
        <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        {batchResult.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {batchResult.map((r) => (
              <div key={r.i} className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">#{r.i + 1}</p>
                <p className="font-mono">{"error" in r.result ? "err" : r.result.formatted}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
