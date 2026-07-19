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
  parseDecisions,
  parseParkingLot,
  parseAgendaRecap,
  parseActionItems,
  summaryStats,
  applyPreset,
  formatActionItemLine,
  sortActionItemsByDueDate,
  groupActionItemsByOwner,
  isOverdue,
  todayDateString,
  renderText,
  renderMarkdown,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MeetingNotesInput,
  type HistoryEntry,
} from "./logic";
import {
  History,
  ClipboardList,
  Download,
  AlertTriangle,
  CalendarClock,
  Users,
  CheckSquare,
  Lightbulb,
  ListChecks,
} from "lucide-react";

const DEFAULT_INPUT: MeetingNotesInput = {
  meetingTitle: "Weekly Sync",
  meetingDate: new Date().toISOString().slice(0, 10),
  startTime: "10:00",
  endTime: "11:00",
  location: "",
  facilitator: "Alice",
  attendees: "Alice Johnson\nBob Smith\nCarol Lee",
  agendaRecap: "Metrics review,MRR up 8% WoW\nRoadmap,Decided to prioritize mobile app\nBlockers,Need design review",
  decisions: "Approve mobile app roadmap\nFreeze API changes until release",
  actionItems:
    "Draft mobile spec,Alice Johnson,2026-07-25\nSchedule design review,Carol Lee,2026-07-26\nUpdate budget,Bob Smith,2026-07-30",
  parkingLot: "Revisit Q4 OKRs next week\nVendor selection in August",
  nextMeetingDate: "",
};

export default function MeetingNotesMaker() {
  const [input, setInput] = useState<MeetingNotesInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setHistory(loadHistory());
    setToday(todayDateString());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const attendees = useMemo(() => parseAttendees(input.attendees), [input.attendees]);
  const recapResult = useMemo(() => parseAgendaRecap(input.agendaRecap), [input.agendaRecap]);
  const decisions = useMemo(() => parseDecisions(input.decisions), [input.decisions]);
  const actionResult = useMemo(() => parseActionItems(input.actionItems), [input.actionItems]);
  const parkingLot = useMemo(() => parseParkingLot(input.parkingLot), [input.parkingLot]);

  const stats = useMemo(
    () => summaryStats(input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, today),
    [input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, today],
  );

  const text = useMemo(
    () => renderText(input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, stats, today),
    [input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, stats, today],
  );
  const md = useMemo(
    () => renderMarkdown(input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, stats, today),
    [input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, stats, today],
  );
  const html = useMemo(
    () => renderHtml(input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, stats, today),
    [input, attendees, recapResult.items, decisions, actionResult.items, parkingLot, stats, today],
  );
  const csv = useMemo(
    () => renderCsv(actionResult.items, today),
    [actionResult.items, today],
  );

  const sortedActions = useMemo(
    () => sortActionItemsByDueDate(actionResult.items),
    [actionResult.items],
  );
  const actionGroups = useMemo(
    () => groupActionItemsByOwner(actionResult.items),
    [actionResult.items],
  );

  const update = useCallback((patch: Partial<MeetingNotesInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (attendees.length > 0 || decisions.length > 0 || actionResult.items.length > 0 || parkingLot.length > 0 || recapResult.items.length > 0) {
      saveHistory({
        ts: Date.now(),
        title: input.meetingTitle || "(untitled)",
        date: input.meetingDate,
        attendeeCount: attendees.length,
        decisionCount: decisions.length,
        actionItemCount: actionResult.items.length,
        parkingLotCount: parkingLot.length,
        meetingDurationMinutes: stats.meetingDurationMinutes,
        overdueCount: stats.overdueCount,
      });
      setHistory(loadHistory());
    }
  }, [attendees.length, decisions.length, actionResult.items.length, parkingLot.length, recapResult.items.length, input.meetingTitle, input.meetingDate, stats]);

  const handleApplyPreset = useCallback((presetValue: string) => {
    const preset = MEETING_TYPE_PRESETS.find((p) => p.value === presetValue);
    if (!preset) return;
    const r = applyPreset(preset);
    setInput((prev) => ({
      ...prev,
      startTime: r.startTime,
      endTime: r.endTime,
      attendees: r.attendees,
      agendaRecap: r.agendaRecap,
      decisions: r.decisions,
      actionItems: r.actionItems,
      parkingLot: r.parkingLot,
    }));
    toast.success(`Applied ${preset.label}`);
  }, []);

  const fileBase = useMemo(
    () => (input.meetingTitle || "meeting-notes").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "meeting-notes",
    [input.meetingTitle],
  );

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, fileBase, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setInput({
      ...DEFAULT_INPUT,
      meetingDate: new Date().toISOString().slice(0, 10),
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasData =
    attendees.length > 0 ||
    recapResult.items.length > 0 ||
    decisions.length > 0 ||
    actionResult.items.length > 0 ||
    parkingLot.length > 0;

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
              <Label htmlFor="mnm-title">Meeting title</Label>
              <Input
                id="mnm-title"
                value={input.meetingTitle}
                onChange={(e) => update({ meetingTitle: e.target.value })}
                placeholder="Q3 Review Meeting"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mnm-date">Date</Label>
              <Input
                id="mnm-date"
                type="date"
                value={input.meetingDate}
                onChange={(e) => update({ meetingDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mnm-start">Start time</Label>
              <Input
                id="mnm-start"
                type="time"
                value={input.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mnm-end">End time</Label>
              <Input
                id="mnm-end"
                type="time"
                value={input.endTime}
                onChange={(e) => update({ endTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mnm-loc">Location / video link</Label>
              <Input
                id="mnm-loc"
                value={input.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="Conf Room A / https://meet.example/abc"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mnm-fac">Facilitator</Label>
              <Input
                id="mnm-fac"
                value={input.facilitator}
                onChange={(e) => update({ facilitator: e.target.value })}
                placeholder="Alice"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mnm-next">Next meeting date (optional)</Label>
              <Input
                id="mnm-next"
                type="date"
                value={input.nextMeetingDate}
                onChange={(e) => update({ nextMeetingDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mnm-att" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Attendees (one per line)
            </Label>
            <Textarea
              id="mnm-att"
              value={input.attendees}
              onChange={(e) => update({ attendees: e.target.value })}
              placeholder={"Alice Johnson\nBob Smith\nCarol Lee"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mnm-recap" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Agenda recap — one per line:{" "}
              <code className="font-mono text-[11px]">topic,discussion_summary</code>
            </Label>
            <Textarea
              id="mnm-recap"
              value={input.agendaRecap}
              onChange={(e) => update({ agendaRecap: e.target.value })}
              placeholder={"Q3 results,Met revenue target of $1.2M\nRoadmap,Decided to prioritize mobile app"}
              className="min-h-[90px] resize-y font-mono text-xs"
            />
            {recapResult.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {recapResult.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mnm-dec" className="flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" /> Decisions (one per line)
            </Label>
            <Textarea
              id="mnm-dec"
              value={input.decisions}
              onChange={(e) => update({ decisions: e.target.value })}
              placeholder={"Approved Q3 budget\nHired new designer"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mnm-ai" className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Action items — one per line:{" "}
              <code className="font-mono text-[11px]">task,owner,due_date</code>
            </Label>
            <Textarea
              id="mnm-ai"
              value={input.actionItems}
              onChange={(e) => update({ actionItems: e.target.value })}
              placeholder={"Draft proposal,Alice,2026-07-25\nUpdate budget,Bob,2026-07-30"}
              className="min-h-[90px] resize-y font-mono text-xs"
            />
            {actionResult.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {actionResult.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mnm-park" className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Parking lot (one per line)
            </Label>
            <Textarea
              id="mnm-park"
              value={input.parkingLot}
              onChange={(e) => update({ parkingLot: e.target.value })}
              placeholder={"Discuss vendor selection next quarter\nRevisit hiring plan in October"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {hasData ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <Stat label="Attendees" value={String(stats.attendeeCount)} />
                <Stat label="Agenda recap" value={String(stats.agendaRecapCount)} />
                <Stat label="Decisions" value={String(stats.decisionCount)} />
                <Stat label="Action items" value={String(stats.actionItemCount)} />
                <Stat
                  label="Overdue"
                  value={String(stats.overdueCount)}
                  highlight={stats.overdueCount > 0 ? "bad" : "good"}
                />
                <Stat label="Parking lot" value={String(stats.parkingLotCount)} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Meeting duration: {stats.meetingDurationMinutes} min · {input.startTime} – {input.endTime}
              </div>
              {stats.overdueCount > 0 && (
                <div className="flex items-center gap-2 rounded border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  {stats.overdueCount} action item{stats.overdueCount === 1 ? "" : "s"} overdue — review and reschedule.
                </div>
              )}
            </CardContent>
          </Card>

          {actionResult.items.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> Action items by owner
                </h3>
                <div className="space-y-2">
                  {actionGroups.map((g) => (
                    <div key={g.owner} className="rounded border bg-background px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">{g.items.length}</Badge>
                        <span className="text-xs font-medium text-foreground">{g.owner}</span>
                      </div>
                      <ul className="space-y-0.5 text-[11px]">
                        {g.items.map((it, i) => {
                          const overdue = isOverdue(it.dueDate, today);
                          return (
                            <li key={i} className={`flex items-center gap-2 ${overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                              <span className="font-mono">[ ]</span>
                              <span className="flex-1 truncate">{it.task}</span>
                              {it.dueDate && (
                                <Badge variant="outline" className={`text-[10px] ${overdue ? "border-red-400/50 text-red-600 dark:text-red-400" : ""}`}>
                                  {it.dueDate}
                                </Badge>
                              )}
                              {overdue && <Badge variant="destructive" className="text-[10px]">overdue</Badge>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" /> Sorted action items
                </h3>
                <span className="text-[11px] text-muted-foreground">earliest due first</span>
              </div>
              {sortedActions.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {sortedActions.map((it, i) => (
                    <li key={i} className="font-mono text-[11px] text-foreground">
                      {formatActionItemLine(it, today)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No action items.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" /> Text Preview
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`${fileBase}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return md; }}
                  filename={`${fileBase}.md`}
                  mime="text/markdown"
                  label="Download .md"
                />
                <Button variant="outline" size="sm" onClick={handleDownloadHtml} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download HTML
                </Button>
                <DownloadButton
                  getText={() => csv}
                  filename={`${fileBase}.csv`}
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
          title="Enter meeting details to generate structured notes"
          hint="Add attendees, agenda recap (topic,discussion), decisions, action items (task,owner,due_date), and parking-lot items. Pick a preset to seed sample data."
          icon={<ClipboardList className="h-8 w-8" />}
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
                  <Badge variant="secondary" className="text-[10px]">{h.attendeeCount} att</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.decisionCount} dec</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.actionItemCount} AI</Badge>
                  {h.overdueCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{h.overdueCount} overdue</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{h.meetingDurationMinutes} min</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, grouping, sorting, and rendering happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
