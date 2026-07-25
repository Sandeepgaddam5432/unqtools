"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { calculateUtilization, formatDuration, type Booking, type UtilizationResult } from "./logic";

export default function MeetingRoomBooker() {
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("17:00");
  const [bookings, setBookings] = useState<Booking[]>([
    { start: "10:00", end: "11:00" },
    { start: "14:00", end: "15:30" },
  ]);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const result = useMemo<UtilizationResult>(() =>
    calculateUtilization({ openTime, closeTime, bookings }),
  [openTime, closeTime, bookings]);

  const summary = useMemo(() => {
    const lines = [
      `Open: ${openTime}  Close: ${closeTime}`,
      `Booked: ${formatDuration(result.bookedMinutes)} (${result.utilizationPct}%)`,
      `Available: ${formatDuration(result.availableMinutes)}`,
      `Free slots: ${result.freeSlots.length}`,
      `Overlaps: ${result.overlaps.length}`,
    ];
    return lines.join("\n");
  }, [result, openTime, closeTime]);

  const addBooking = () => {
    if (!newStart || !newEnd) return;
    setBookings((prev) => [...prev, { start: newStart, end: newEnd }]);
    setNewStart(""); setNewEnd("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Open</Label>
              <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Close</Label>
              <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
          </div>
          {result.errors.length > 0 && <ErrorBanner message={result.errors.join("; ")} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Bookings ({bookings.length})</p>
            <CopyButton getText={() => summary} label="Copy" />
          </div>
          <div className="space-y-1">
            {bookings.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">{b.start}–{b.end}</Badge>
                <span className="text-muted-foreground">{formatDuration((Number(b.end.split(":")[0]) - Number(b.start.split(":")[0])) * 60 + (Number(b.end.split(":")[1]) - Number(b.start.split(":")[1])))}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => setBookings((prev) => prev.filter((_, idx) => idx !== i))}>×</Button>
              </div>
            ))}
            {bookings.length === 0 && <p className="text-xs text-muted-foreground">No bookings yet.</p>}
          </div>
          <div className="flex gap-2">
            <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="h-8 text-xs" />
            <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" onClick={addBooking} disabled={!newStart || !newEnd}>Add</Button>
          </div>
        </CardContent>
      </Card>

      {result.errors.length === 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600">{result.utilizationPct}% booked</Badge>
              <span className="text-xs text-muted-foreground">{formatDuration(result.bookedMinutes)} / {formatDuration(result.totalMinutes)}</span>
              <div className="ml-auto"><DownloadButton getText={() => summary} filename="room-utilization.txt" /></div>
            </div>
            <div className="h-3 w-full rounded bg-muted overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${result.utilizationPct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Cell label="Available" value={formatDuration(result.availableMinutes)} />
              <Cell label="Overlaps" value={String(result.overlaps.length)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Free slots</p>
              {result.freeSlots.map((s, i) => (
                <Badge key={i} variant="outline" className="mr-1.5 font-mono text-[11px]">{s.start}–{s.end}</Badge>
              ))}
              {result.freeSlots.length === 0 && <p className="text-xs text-muted-foreground">No free slots.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
