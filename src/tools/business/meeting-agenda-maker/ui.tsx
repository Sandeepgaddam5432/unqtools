"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  MEETING_TYPE_PRESETS,
  parseAttendees,
  parseObjectives,
  parseAgendaItems,
  calculateMeetingDuration,
  calculateTotalAgendaTime,
  generateTimeSlots,
  applyPreset,
  summaryStats,
  renderText,
  renderMarkdown,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MeetingInput,
  type HistoryEntry,
} from "./logic";
import { History, CalendarClock, Download, AlertTriangle } from "lucide-react";

const DEFAULT_INPUT: MeetingInput = {
  meetingTitle: "",
  meetingDate: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  organizer: "",
  attendees: "Alice\nBob\nCharlie",
  agendaItems: "Q3 review,15,Alice\nRoadmap,30,Bob\nOpen Q&A,10,Charlie",
  objectives: "Align on Q3 priorities\nIdentify blockers",
  notes: "",
};

export default function MeetingAgendaMaker() {
  const [input, setInput] = useState<MeetingInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseAgendaItems(input.agendaItems), [input.agendaItems]);
  const attendees = useMemo(() => parseAttendees(input.attendees), [input.attendees]);
  const objectives = useMemo(() => parseObjectives(input.objectives), [input.objectives]);
  const stats = useMemo(
    () => summaryStats(input, parsed.items, attendees, objectives),
    [input, parsed.items, attendees, objectives],
  );
  const slots = useMemo(
    () => generateTimeSlots(parsed.items, input.startTime),
    [parsed.items, input.startTime],
  );
  const text = useMemo(
    () => renderText(input, parsed.items, attendees, objectives, slots, stats),
    [input, parsed.items, attendees, objectives, slots, stats],
  );
  const md = useMemo(
    () => renderMarkdown(input, parsed.items, attendees, objectives, slots, stats),
    [input, parsed.items, attendees, objectives, slots, stats],
  );
  const html = useMemo(
    () => renderHtml(input, parsed.items, attendees, objectives, slots, stats),
    [input, parsed.items, attendees, objectives, slots, stats],
  );
  const csv = useMemo(() => renderCsv(slots), [slots]);

  const update = useCallback((patch: Partial<MeetingInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (parsed.items.length > 0) {
      saveHistory({
        ts: Date.now(),
        title: input.meetingTitle || "(untitled)",
        date: input.meetingDate,
        attendeeCount: attendees.length,
        itemCount: parsed.items.length,
        totalAgendaTimeMinutes: stats.totalAgendaTimeMinutes,
        meetingDurationMinutes: stats.meetingDurationMinutes,
      });
      setHistory(loadHistory());
    }
  }, [parsed.items, attendees.length, input.meetingTitle, input.meetingDate, stats]);

  const handleApplyPreset = useCallback(
    (presetValue: string) => {
      const preset = MEETING_TYPE_PRESETS.find((p) => p.value === presetValue);
      if (!preset) return;
      const r = applyPreset(preset);
      setInput((prev) => ({
        ...prev,
        startTime: r.startTime,
        endTime: r.endTime,
        agendaItems: r.agendaItems,
      }));
      toast.success(`Applied ${preset.label}`);
    },
    [],
  );

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(input.meetingTitle || "agenda").replace(/[^a-z0-9-]+/gi, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.meetingTitle, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT, meetingDate: new Date().toISOString().slice(0, 10) });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground self-center mr-1">Preset:</span>
            {MEETING_TYPE_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={() => handleApplyPreset(p.value)}
              >+ {p.label}</Button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mam-title">Meeting title</Label>
              <Input
                id="mam-title"
                value={input.meetingTitle}
                onChange={(e) => update({ meetingTitle: e.target.value })}
                placeholder="Q3 Planning Meeting"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mam-date">Date</Label>
              <Input
                id="mam-date"
                type="date"
                value={input.meetingDate}
                onChange={(e) => update({ meetingDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mam-start">Start time</Label>
              <Input
                id="mam-start"
                type="time"
                value={input.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mam-end">End time</Label>
              <Input
                id="mam-end"
                type="time"
                value={input.endTime}
                onChange={(e) => update({ endTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mam-loc">Location / video link</Label>
              <Input
                id="mam-loc"
                value={input.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="Conf Room A / https://meet.example/abc"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mam-org">Organizer</Label>
              <Input
                id="mam-org"
                value={input.organizer}
                onChange={(e) => update({ organizer: e.target.value })}
                placeholder="Alice"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mam-attendees">Attendees (one per line)</Label>
              <Textarea
                id="mam-attendees"
                value={input.attendees}
                onChange={(e) => update({ attendees: e.target.value })}
                placeholder={"Alice\nBob\nCharlie"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mam-objs">Objectives (one per line)</Label>
              <Textarea
                id="mam-objs"
                value={input.objectives}
                onChange={(e) => update({ objectives: e.target.value })}
                placeholder={"Align on Q3 priorities\nIdentify blockers"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mam-items">
              Agenda items — one per line:{" "}
              <code className="font-mono text-[11px]">topic,duration_minutes,presenter</code>
            </Label>
            <Textarea
              id="mam-items"
              value={input.agendaItems}
              onChange={(e) => update({ agendaItems: e.target.value })}
              placeholder={"Q3 review,15,Alice\nRoadmap,30,Bob"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            {parsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {parsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            {parsed.items.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {parsed.items.length} item(s) · total {stats.totalAgendaTimeMinutes} min · meeting {stats.meetingDurationMinutes} min
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mam-notes">Notes (optional)</Label>
            <Textarea
              id="mam-notes"
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Bring laptops, pre-read attached, etc."
              className="min-h-[50px] resize-y text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {parsed.items.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Attendees" value={String(stats.attendeeCount)} />
                <Stat label="Agenda items" value={String(stats.agendaItemCount)} />
                <Stat label="Objectives" value={String(stats.objectiveCount)} />
                <Stat label="Meeting duration" value={`${stats.meetingDurationMinutes} min`} />
                <Stat label="Total agenda time" value={`${stats.totalAgendaTimeMinutes} min`} />
                <Stat
                  label="Buffer"
                  value={`${stats.bufferMinutes} min`}
                  highlight={stats.overflow ? "bad" : "good"}
                />
                <Stat
                  label="Overflow"
                  value={stats.overflow ? `+${stats.overflowMinutes} min` : "None"}
                  highlight={stats.overflow ? "bad" : "good"}
                />
                <Stat label="Time slots" value={String(slots.length)} />
              </div>
              {stats.overflow && (
                <div className="flex items-center gap-2 rounded border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Agenda exceeds meeting duration by {stats.overflowMinutes} minutes. Trim items or extend end time.
                </div>
              )}

              <div className="rounded border bg-background overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-2 py-2 font-medium w-8">#</th>
                      <th className="px-2 py-2 font-medium">Start</th>
                      <th className="px-2 py-2 font-medium">End</th>
                      <th className="px-2 py-2 font-medium text-right">Min</th>
                      <th className="px-2 py-2 font-medium">Topic</th>
                      <th className="px-2 py-2 font-medium">Presenter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s) => (
                      <tr key={s.index} className="border-t">
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">{s.index}</td>
                        <td className="px-2 py-1.5 font-mono">{s.startTime}</td>
                        <td className="px-2 py-1.5 font-mono">{s.endTime}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{s.durationMinutes}</td>
                        <td className="px-2 py-1.5">{s.topic}</td>
                        <td className="px-2 py-1.5">{s.presenter || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> Text Preview
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`${(input.meetingTitle || "agenda").replace(/[^a-z0-9-]+/gi, "-")}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => md}
                  filename={`${(input.meetingTitle || "agenda").replace(/[^a-z0-9-]+/gi, "-")}.md`}
                  mime="text/markdown"
                  label="Download .md"
                />
                <Button variant="outline" size="sm" onClick={handleDownloadHtml} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download HTML
                </Button>
                <DownloadButton
                  getText={() => csv}
                  filename={`${(input.meetingTitle || "agenda").replace(/[^a-z0-9-]+/gi, "-")}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter at least one agenda item to generate the agenda"
          hint="Use the format: topic,duration_minutes,presenter — one per line. Pick a preset to seed sample times."
          icon={<CalendarClock className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.date || "—"}</Badge>
                  <span className="font-medium text-foreground">{h.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{h.attendeeCount} attendees</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.itemCount} items</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.totalAgendaTimeMinutes}/{h.meetingDurationMinutes} min</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All agenda generation, time slot calculation and rendering happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
