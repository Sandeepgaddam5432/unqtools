"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  createSlot,
  timeToMinutes,
  minutesToTime,
  slotDuration,
  findConflicts,
  findRoomConflicts,
  findTeacherConflicts,
  groupByDay,
  totalWeeklyHours,
  hoursPerSubject,
  assignRoom,
  validateSlot,
  exportScheduleCSV,
  exportScheduleICS,
  findFreeBlocks,
  suggestColor,
  DAYS,
  type TimeSlot,
} from "./logic";

const DEFAULT_ROOMS = ["Room A", "Room B", "Room C", "Room D"];

export default function ClassScheduleMaker() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [day, setDay] = useState<TimeSlot["day"]>("Mon");
  const [start, setStart] = useState<string>("09:00");
  const [end, setEnd] = useState<string>("10:00");
  const [subject, setSubject] = useState<string>("");
  const [room, setRoom] = useState<string>("");
  const [teacher, setTeacher] = useState<string>("");
  const [error, setError] = useState<string>("");

  const grouped = useMemo(() => groupByDay(slots), [slots]);
  const conflicts = useMemo(() => findConflicts(slots), [slots]);
  const roomConflicts = useMemo(() => findRoomConflicts(slots), [slots]);
  const teacherConflicts = useMemo(() => findTeacherConflicts(slots), [slots]);
  const totalH = useMemo(() => totalWeeklyHours(slots), [slots]);
  const subjectHours = useMemo(() => hoursPerSubject(slots), [slots]);

  const handleAdd = () => {
    const s = createSlot(day, timeToMinutes(start), timeToMinutes(end), subject, room, teacher, suggestColor(subject || "Untitled"));
    const w = validateSlot(s);
    if (w.length > 0) {
      setError(w[0]);
      return;
    }
    setError("");
    setSlots((cur) => [...cur, s]);
    setSubject("");
    setRoom("");
    setTeacher("");
  };

  const handleAutoRoom = () => {
    const tempSlot = createSlot(day, timeToMinutes(start), timeToMinutes(end), subject || "Untitled");
    const assigned = assignRoom(slots, tempSlot, DEFAULT_ROOMS);
    if (assigned) setRoom(assigned);
    else setError("No available room at that time.");
  };

  const handleRemove = (id: string) => setSlots((cur) => cur.filter((s) => s.id !== id));

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Add class slot</h3>
            <div className="flex gap-2">
              <CopyButton getText={() => exportScheduleCSV(slots)} label="Copy CSV" />
              <DownloadButton getText={() => exportScheduleCSV(slots)} filename="schedule.csv" mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportScheduleICS(slots, new Date())} filename="schedule.ics" mime="text/calendar" label="ICS" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Day</Label>
              <select value={day} onChange={(e) => setDay(e.target.value as TimeSlot["day"])} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start</Label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">End</Label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Math" className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Room</Label>
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room A" className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Teacher</Label>
              <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Ms Lee" className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">+ Add slot</button>
            <button onClick={handleAutoRoom} className="px-4 py-1.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted">Auto room</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Conflicts</Label>
          {conflicts.length === 0 && roomConflicts.length === 0 && teacherConflicts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No conflicts detected. ✅</p>
          ) : (
            <div className="space-y-2 text-xs">
              {conflicts.map((c, i) => (
                <p key={`t${i}`} className="text-red-600 dark:text-red-400">⏱ Time conflict: {c.a.subject} ({minutesToTime(c.a.startMin)}–{minutesToTime(c.a.endMin)}) vs {c.b.subject} ({minutesToTime(c.b.startMin)}–{minutesToTime(c.b.endMin)}) on {c.a.day}</p>
              ))}
              {roomConflicts.map((c, i) => (
                <p key={`r${i}`} className="text-orange-600 dark:text-orange-400">🚪 Room conflict: {c.a.room} double-booked on {c.a.day}</p>
              ))}
              {teacherConflicts.map((c, i) => (
                <p key={`tch${i}`} className="text-purple-600 dark:text-purple-400">👨‍🏫 Teacher conflict: {c.a.teacher} double-booked on {c.a.day}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm font-semibold">Weekly grid</Label>
            <span className="text-xs text-muted-foreground">Total: {totalH.toFixed(1)}h</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {DAYS.map((d) => (
              <div key={d} className="rounded-md border border-border p-2 min-h-[120px]">
                <div className="text-xs font-semibold mb-1">{d}</div>
                {grouped[d].length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">—</p>
                ) : (
                  grouped[d].map((s) => (
                    <div key={s.id} className="mb-1 rounded p-1.5 text-[10px]" style={{ backgroundColor: s.color + "22", borderLeft: `3px solid ${s.color}` }}>
                      <div className="font-medium">{s.subject}</div>
                      <div className="text-muted-foreground">{minutesToTime(s.startMin)}–{minutesToTime(s.endMin)}</div>
                      {s.room && <div className="text-muted-foreground">📍 {s.room}</div>}
                      {s.teacher && <div className="text-muted-foreground">👤 {s.teacher}</div>}
                      <button onClick={() => handleRemove(s.id)} className="text-red-500 hover:underline mt-0.5">remove</button>
                    </div>
                  ))
                )}
                {findFreeBlocks(slots, d).length > 0 && grouped[d].length > 0 && (
                  <p className="text-[9px] text-muted-foreground mt-1">Free: {findFreeBlocks(slots, d).map((b) => `${minutesToTime(b.startMin)}–${minutesToTime(b.endMin)}`).join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Hours per subject</Label>
          {Object.keys(subjectHours).length === 0 ? (
            <p className="text-xs text-muted-foreground">Add classes to see breakdown.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {Object.entries(subjectHours).map(([s, h]) => (
                <Badge key={s} variant="outline" className="text-[10px]">{s}: {h.toFixed(1)}h</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
