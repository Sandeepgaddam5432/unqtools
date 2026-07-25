"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeDuration, type TimeRange } from "./logic";

export default function TimeDurationCalc() {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [breaks, setBreaks] = useState<TimeRange[]>([{ start: "12:00", end: "13:00" }]);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeDuration({ start, end, breaks });
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [start, end, breaks]);

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
              <Label className="text-xs text-muted-foreground">Breaks</Label>
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

      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Duration</p>
              <div className="flex gap-2">
                <CopyButton getText={() => JSON.stringify(result, null, 2)} />
                <DownloadButton getText={() => JSON.stringify(result, null, 2)} filename="duration.json" />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Total</td><td className="py-1.5 text-right font-mono">{result.formatted} ({result.totalMinutes} min)</td></tr>
                <tr className="border-b"><td className="py-1.5 text-muted-foreground">Breaks</td><td className="py-1.5 text-right font-mono">{result.breakMinutes} min</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Net</td><td className="py-1.5 text-right font-mono">{result.formatted} ({result.hours.toFixed(2)} h)</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
