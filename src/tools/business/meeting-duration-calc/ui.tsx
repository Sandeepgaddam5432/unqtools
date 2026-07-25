"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeMeetingCost, formatMoney, attendeeBreakdown, type Attendee } from "./logic";

export default function MeetingDurationCalc() {
  const [attendees, setAttendees] = useState<Attendee[]>([{ name: "Alice", hourlyRate: 60 }, { name: "Bob", hourlyRate: 40 }]);
  const [duration, setDuration] = useState(60);
  const [overhead, setOverhead] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeMeetingCost({ attendees, durationMinutes: duration, overheadPercent: overhead });
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [attendees, duration, overhead]);

  const breakdown = useMemo(() => attendeeBreakdown({ attendees, durationMinutes: duration }), [attendees, duration]);

  const update = (i: number, field: keyof Attendee, value: string) => {
    const next = [...attendees];
    next[i] = { ...next[i]!, [field]: field === "hourlyRate" ? Number(value) : value };
    setAttendees(next);
  };

  const report = result ? [
    `Total cost: ${formatMoney(result.totalCost)}`,
    `Cost per minute: ${formatMoney(result.costPerMinute)}`,
    `Duration: ${result.durationHours.toFixed(2)}h`,
    `Attendees: ${result.attendeeCount}`,
    `With overhead: ${formatMoney(result.withOverhead)}`,
  ].join("\n") : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground">Duration (min)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Overhead (%)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={overhead} onChange={(e) => setOverhead(Number(e.target.value))} /></div>
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
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total meeting cost</p>
                <p className="text-2xl font-bold">{formatMoney(result.withOverhead)}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="meeting-cost.txt" />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {breakdown.map((b, i) => (
                  <tr key={i} className="border-b"><td className="py-1.5">{b.name}</td><td className="py-1.5 text-right font-mono">{formatMoney(b.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
