"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { generateMinutes, type MeetingInput, type MeetingResult, type Attendee, type AgendaItem, type Decision, type ActionItem } from "./logic";

export default function MeetingMinutesTemplate() {
  const [title, setTitle] = useState("Weekly Standup");
  const [date, setDate] = useState("2024-09-30");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");
  const [location, setLocation] = useState("Room A / Zoom");
  const [facilitator, setFacilitator] = useState("Alice");
  const [noteTaker, setNoteTaker] = useState("Bob");
  const [attendees, setAttendees] = useState<Attendee[]>([
    { name: "Alice", role: "Lead", present: true },
    { name: "Bob", role: "Engineer", present: true },
    { name: "Carol", present: false },
  ]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { topic: "Review last week", presenter: "Alice", durationMinutes: 5 },
    { topic: "Plan this week", presenter: "Bob", durationMinutes: 15, notes: "Focus on auth" },
  ]);
  const [decisions, setDecisions] = useState<Decision[]>([{ text: "Ship auth in sprint 12", decidedBy: "Alice" }]);
  const [actions, setActions] = useState<ActionItem[]>([
    { task: "Write auth spec", assignee: "Bob", dueDate: "2024-10-04", priority: "high" },
    { task: "Schedule design review", assignee: "Carol", priority: "medium" },
  ]);
  const [notes, setNotes] = useState("Demo next week.");
  const [nextDate, setNextDate] = useState("2024-10-07");
  const [nextTime, setNextTime] = useState("10:00");
  const [nextLocation, setNextLocation] = useState("Room A");
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateAttendee = (i: number, patch: Partial<Attendee>) => setAttendees((p) => p.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const addAttendee = () => setAttendees((p) => [...p, { name: "", present: true }]);
  const removeAttendee = (i: number) => setAttendees((p) => p.filter((_, idx) => idx !== i));

  const updateAgenda = (i: number, patch: Partial<AgendaItem>) => setAgenda((p) => p.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const addAgenda = () => setAgenda((p) => [...p, { topic: "" }]);
  const removeAgenda = (i: number) => setAgenda((p) => p.filter((_, idx) => idx !== i));

  const updateDecision = (i: number, patch: Partial<Decision>) => setDecisions((p) => p.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  const addDecision = () => setDecisions((p) => [...p, { text: "" }]);
  const removeDecision = (i: number) => setDecisions((p) => p.filter((_, idx) => idx !== i));

  const updateAction = (i: number, patch: Partial<ActionItem>) => setActions((p) => p.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const addAction = () => setActions((p) => [...p, { task: "", priority: "medium" }]);
  const removeAction = (i: number) => setActions((p) => p.filter((_, idx) => idx !== i));

  const run = useCallback(() => {
    const cfg: MeetingInput = {
      title, date, startTime, endTime, location, facilitator, noteTaker,
      attendees: attendees.filter((a) => a.name.trim()),
      agenda: agenda.filter((a) => a.topic.trim()),
      decisions: decisions.filter((d) => d.text.trim()),
      actionItems: actions.filter((a) => a.task.trim()),
      notes,
      nextMeeting: nextDate ? { date: nextDate, time: nextTime, location: nextLocation } : undefined,
    };
    const r = generateMinutes(cfg);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [title, date, startTime, endTime, location, facilitator, noteTaker, attendees, agenda, decisions, actions, notes, nextDate, nextTime, nextLocation]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Start time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Start time" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">End time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="End time" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Facilitator</Label>
              <Input value={facilitator} onChange={(e) => setFacilitator(e.target.value)} aria-label="Facilitator" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Note taker</Label>
              <Input value={noteTaker} onChange={(e) => setNoteTaker(e.target.value)} aria-label="Note taker" />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Attendees</Label><Button size="sm" variant="outline" onClick={addAttendee}>Add</Button></div>
            {attendees.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" value={a.name} onChange={(e) => updateAttendee(i, { name: e.target.value })} placeholder="Name" aria-label="Attendee name" />
                <Input className="col-span-3" value={a.role ?? ""} onChange={(e) => updateAttendee(i, { role: e.target.value })} placeholder="Role" aria-label="Role" />
                <Button size="sm" variant={a.present !== false ? "default" : "outline"} onClick={() => updateAttendee(i, { present: a.present === false })} className="col-span-2">{a.present !== false ? "Present" : "Absent"}</Button>
                <Button size="sm" variant="ghost" onClick={() => removeAttendee(i)} className="col-span-3">Remove</Button>
              </div>
            ))}
          </div>

          {/* Agenda */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Agenda</Label><Button size="sm" variant="outline" onClick={addAgenda}>Add</Button></div>
            {agenda.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" value={a.topic} onChange={(e) => updateAgenda(i, { topic: e.target.value })} placeholder="Topic" aria-label="Topic" />
                <Input className="col-span-3" value={a.presenter ?? ""} onChange={(e) => updateAgenda(i, { presenter: e.target.value })} placeholder="Presenter" aria-label="Presenter" />
                <Input className="col-span-2" type="number" value={a.durationMinutes ?? ""} onChange={(e) => updateAgenda(i, { durationMinutes: e.target.value ? Number(e.target.value) : undefined })} placeholder="min" aria-label="Duration" />
                <Button size="sm" variant="ghost" onClick={() => removeAgenda(i)} className="col-span-3">Remove</Button>
              </div>
            ))}
          </div>

          {/* Decisions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Decisions</Label><Button size="sm" variant="outline" onClick={addDecision}>Add</Button></div>
            {decisions.map((d, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-7" value={d.text} onChange={(e) => updateDecision(i, { text: e.target.value })} placeholder="Decision" aria-label="Decision text" />
                <Input className="col-span-2" value={d.decidedBy ?? ""} onChange={(e) => updateDecision(i, { decidedBy: e.target.value })} placeholder="By" aria-label="Decided by" />
                <Button size="sm" variant="ghost" onClick={() => removeDecision(i)} className="col-span-3">Remove</Button>
              </div>
            ))}
          </div>

          {/* Action Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Action items</Label><Button size="sm" variant="outline" onClick={addAction}>Add</Button></div>
            {actions.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" value={a.task} onChange={(e) => updateAction(i, { task: e.target.value })} placeholder="Task" aria-label="Task" />
                <Input className="col-span-3" value={a.assignee ?? ""} onChange={(e) => updateAction(i, { assignee: e.target.value })} placeholder="Assignee" aria-label="Assignee" />
                <Input className="col-span-2" type="date" value={a.dueDate ?? ""} onChange={(e) => updateAction(i, { dueDate: e.target.value })} aria-label="Due date" />
                <select className="col-span-1 rounded-md border border-input bg-background px-1 py-1 text-sm" value={a.priority ?? "medium"} onChange={(e) => updateAction(i, { priority: e.target.value as ActionItem["priority"] })} aria-label="Priority">
                  <option value="low">L</option><option value="medium">M</option><option value="high">H</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => removeAction(i)} className="col-span-2">Remove</Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Next meeting date</Label><Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} aria-label="Next meeting date" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Next meeting time</Label><Input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} aria-label="Next meeting time" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Next meeting location</Label><Input value={nextLocation} onChange={(e) => setNextLocation(e.target.value)} aria-label="Next meeting location" /></div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Generate minutes</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">HTML preview</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="border border-border rounded p-4 bg-white" dangerouslySetInnerHTML={{ __html: result.html }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Markdown</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3 max-h-80 overflow-auto">{result.markdown}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export minutes</p>
              <div className="flex gap-2 flex-wrap">
                <CopyButton getText={() => result.markdown} label="Copy Markdown" />
                <CopyButton getText={() => result.text} label="Copy text" />
                <CopyButton getText={() => result.html} label="Copy HTML" />
                <DownloadButton getText={() => result.markdown} filename="meeting-minutes.md" />
                <DownloadButton getText={() => result.html} filename="meeting-minutes.html" mime="text/html" label="Download HTML" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
