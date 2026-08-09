"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, ErrorBanner } from "../../_shared";
import { ArrowUpDown, Clock } from "lucide-react";
import {
  COMMON_ZONES,
  getAllZoneIds,
  formatInZone,
  utcOffsetFor,
  convertToAll,
  dateFromZoneParts,
  validateInput,
} from "./logic";

export default function TimezoneConverterTool() {
  const [fromZone, setFromZone] = useState("Asia/Kolkata");
  const [toZone, setToZone] = useState("America/New_York");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [day, setDay] = useState(() => String(new Date().getDate()).padStart(2, "0"));
  const [hour, setHour] = useState(() => String(new Date().getHours()).padStart(2, "0"));
  const [minute, setMinute] = useState(() => String(new Date().getMinutes()).padStart(2, "0"));
  const [hour12, setHour12] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allZones = useMemo<string[]>(() => getAllZoneIds(), []);

  const moment = useMemo(() => {
    const d = dateFromZoneParts(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      fromZone,
    );
    return d;
  }, [year, month, day, hour, minute, fromZone]);

  const errorMsg = useMemo(() => validateInput(moment), [moment]);

  const result = useMemo(() => {
    if (!moment || errorMsg) return null;
    return {
      fromLocal: formatInZone(moment, fromZone, { hour12 }),
      toLocal: formatInZone(moment, toZone, { hour12 }),
      fromOffset: utcOffsetFor(fromZone, moment),
      toOffset: utcOffsetFor(toZone, moment),
    };
  }, [moment, fromZone, toZone, hour12, errorMsg]);

  const allZonesView = useMemo(() => {
    if (!moment || errorMsg) return [];
    return convertToAll(moment, fromZone, COMMON_ZONES.map((z) => z.id));
  }, [moment, fromZone, errorMsg]);

  const setNow = () => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(String(n.getMonth() + 1).padStart(2, "0"));
    setDay(String(n.getDate()).padStart(2, "0"));
    setHour(String(n.getHours()).padStart(2, "0"));
    setMinute(String(n.getMinutes()).padStart(2, "0"));
  };

  const swap = () => {
    setFromZone(toZone);
    setToZone(fromZone);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        {errorMsg && <ErrorBanner message={errorMsg} />}

        {/* Date/time inputs */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Date &amp; time (in source zone)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Input aria-label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            <Input aria-label="Month" type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Input aria-label="Day" type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} />
            <Input aria-label="Hour" type="number" min="0" max="23" value={hour} onChange={(e) => setHour(e.target.value)} />
            <Input aria-label="Minute" type="number" min="0" max="59" value={minute} onChange={(e) => setMinute(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={setNow} className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Now
          </Button>
        </div>

        {/* From / To zones */}
        <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From timezone</Label>
            <Select value={fromZone} onValueChange={setFromZone}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON_ZONES.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.label} ({utcOffsetFor(z.id, moment ?? new Date())})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap timezones" className="mb-0.5">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To timezone</Label>
            <Select value={toZone} onValueChange={setToZone}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON_ZONES.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.label} ({utcOffsetFor(z.id, moment ?? new Date())})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 12/24h toggle */}
        <div className="flex items-center gap-2">
          <Button variant={hour12 ? "default" : "outline"} size="sm" onClick={() => setHour12(true)}>12-hour</Button>
          <Button variant={!hour12 ? "default" : "outline"} size="sm" onClick={() => setHour12(false)}>24-hour</Button>
        </div>

        {/* Result */}
        {result && !errorMsg && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Source ({COMMON_ZONES.find((z) => z.id === fromZone)?.label ?? fromZone}) {result.fromOffset}</span>
              <CopyButton getText={() => `${result.fromLocal}`} label="Copy" />
            </div>
            <div className="text-lg font-semibold">{result.fromLocal}</div>
            <div className="border-t pt-2 mt-2 flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Target ({COMMON_ZONES.find((z) => z.id === toZone)?.label ?? toZone}) {result.toOffset}</span>
              <CopyButton getText={() => `${result.toLocal}`} label="Copy" />
            </div>
            <div className="text-lg font-semibold text-primary">{result.toLocal}</div>
          </div>
        )}

        {/* All zones */}
        {allZonesView.length > 0 && !errorMsg && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Same moment across timezones</Label>
            <div className="max-h-64 overflow-y-auto rounded-xl border divide-y">
              {allZonesView.map((row) => (
                <div key={row.zone} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-muted-foreground truncate">
                    {COMMON_ZONES.find((z) => z.id === row.zone)?.label ?? row.zone}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{row.offset} · {row.relativeHours}</span>
                  <span className="font-medium shrink-0">{row.local.split("·")[1]?.trim() ?? row.local}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Uses your browser&apos;s built-in IANA timezone database — 100% offline, DST-aware. No data leaves your device.
        </p>
      </CardContent>
    </Card>
  );
}
