"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import { generateMonth, autoFillCalendar, monthToCsv, CONTENT_TYPES, PLATFORMS, type ContentType, type Platform } from "./logic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SocialContentCalendar() {
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(0);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([...CONTENT_TYPES].slice(0, 5) as ContentType[]);
  const [platforms, setPlatforms] = useState<Platform[]>(["Instagram", "Twitter/X", "LinkedIn"]);

  const baseMonth = useMemo(() => generateMonth(year, month), [year, month]);
  const filled = useMemo(() => autoFillCalendar(baseMonth, contentTypes, platforms), [baseMonth, contentTypes, platforms]);
  const csv = useMemo(() => monthToCsv(filled), [filled]);

  const toggleContentType = (t: ContentType) => {
    setContentTypes((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]);
  };
  const togglePlatform = (p: Platform) => {
    setPlatforms((arr) => arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || 2024)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => { const now = new Date(); setMonth(now.getMonth()); setYear(now.getFullYear()); }}
                className="px-2 py-1.5 text-xs rounded-md bg-muted hover:bg-muted/70 cursor-pointer"
              >
                This month
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Content types ({contentTypes.length})</Label>
            <div className="flex flex-wrap gap-1">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleContentType(t)}
                  className={`px-2 py-1 text-[10px] rounded-md border cursor-pointer ${
                    contentTypes.includes(t) ? "border-primary bg-primary/10" : "border-border bg-muted/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Platforms ({platforms.length})</Label>
            <div className="flex flex-wrap gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-2 py-1 text-[10px] rounded-md border cursor-pointer ${
                    platforms.includes(p) ? "border-primary bg-primary/10" : "border-border bg-muted/40"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">{filled.label}</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => csv} />
              <DownloadButton getText={() => csv} filename={`content-calendar-${year}-${month + 1}.csv`} />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d) => <div key={d} className="text-[10px] text-muted-foreground font-medium py-1">{d}</div>)}
            {filled.days.map((d, i) => (
              <div
                key={i}
                className={`min-h-[64px] rounded-md border p-1 text-left ${
                  d.isCurrentMonth ? "bg-background" : "bg-muted/20 opacity-50"
                } ${d.isWeekend ? "border-amber-500/30" : ""}`}
              >
                <div className="text-[10px] text-muted-foreground">{d.day}</div>
                {d.contentSlot && (
                  <div className="mt-0.5 space-y-0.5">
                    <div className="text-[9px] font-medium text-foreground leading-tight">{d.contentSlot}</div>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">{d.platform}</Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {contentTypes.length === 0 || platforms.length === 0 ? (
        <EmptyState title="Select at least one content type and platform" hint="Auto-fill will populate the calendar with a rotation." />
      ) : null}
    </div>
  );
}
