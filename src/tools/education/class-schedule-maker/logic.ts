/**
 * Class Schedule Maker — pure logic.
 * Weekly time slots, conflict detection, room assignment.
 */

export interface TimeSlot {
  id: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startMin: number; // minutes since 00:00 (e.g. 540 = 09:00)
  endMin: number;
  subject: string;
  room: string;
  teacher: string;
  color: string;
}

export const DAYS: TimeSlot["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function createSlot(
  day: TimeSlot["day"],
  startMin: number,
  endMin: number,
  subject: string,
  room = "",
  teacher = "",
  color = "#3b82f6",
): TimeSlot {
  return {
    id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    day,
    startMin,
    endMin,
    subject: subject.trim() || "Untitled",
    room,
    teacher,
    color,
  };
}

/** Convert "HH:MM" to minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return 0;
  return h * 60 + min;
}

export function minutesToTime(min: number): string {
  if (min < 0) min = 0;
  if (min >= 24 * 60) min = 24 * 60 - 1;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Slot duration in minutes. */
export function slotDuration(slot: TimeSlot): number {
  return slot.endMin - slot.startMin;
}

/** Detect overlapping slots on the same day. */
export function findConflicts(slots: TimeSlot[]): Array<{ a: TimeSlot; b: TimeSlot }> {
  const conflicts: Array<{ a: TimeSlot; b: TimeSlot }> = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.day !== b.day) continue;
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

/** Detect same-room double booking (across days if same time). */
export function findRoomConflicts(slots: TimeSlot[]): Array<{ a: TimeSlot; b: TimeSlot }> {
  const conflicts: Array<{ a: TimeSlot; b: TimeSlot }> = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (!a.room || !b.room || a.room !== b.room) continue;
      if (a.day !== b.day) continue;
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

/** Detect teacher double booking (same day, overlapping time). */
export function findTeacherConflicts(slots: TimeSlot[]): Array<{ a: TimeSlot; b: TimeSlot }> {
  const conflicts: Array<{ a: TimeSlot; b: TimeSlot }> = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (!a.teacher || !b.teacher || a.teacher !== b.teacher) continue;
      if (a.day !== b.day) continue;
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

/** Group slots by day. */
export function groupByDay(slots: TimeSlot[]): Record<TimeSlot["day"], TimeSlot[]> {
  const out: Record<TimeSlot["day"], TimeSlot[]> = {
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
  };
  for (const s of slots) out[s.day].push(s);
  for (const d of DAYS) out[d].sort((a, b) => a.startMin - b.startMin);
  return out;
}

/** Total scheduled hours per week. */
export function totalWeeklyHours(slots: TimeSlot[]): number {
  const totalMin = slots.reduce((s, c) => s + slotDuration(c), 0);
  return totalMin / 60;
}

/** Hours per subject. */
export function hoursPerSubject(slots: TimeSlot[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of slots) {
    map[s.subject] = (map[s.subject] ?? 0) + slotDuration(s) / 60;
  }
  return map;
}

/** Assign an available room from a pool, avoiding conflicts. */
export function assignRoom(slots: TimeSlot[], slot: TimeSlot, roomPool: string[]): string | null {
  const occupied = new Set(
    slots
      .filter((s) => s.day === slot.day && s.startMin < slot.endMin && slot.startMin < s.endMin && s.room)
      .map((s) => s.room),
  );
  return roomPool.find((r) => !occupied.has(r)) ?? null;
}

/** Validate a slot. */
export function validateSlot(slot: TimeSlot): string[] {
  const w: string[] = [];
  if (slot.endMin <= slot.startMin) w.push("End time must be after start time.");
  if (slot.startMin < 0 || slot.startMin >= 24 * 60) w.push("Start time out of range.");
  if (slot.endMin > 24 * 60) w.push("End time out of range.");
  if (slotDuration(slot) > 8 * 60) w.push("Slot longer than 8 hours — likely an error.");
  if (!slot.subject.trim()) w.push("Subject is required.");
  return w;
}

/** Export as CSV. */
export function exportScheduleCSV(slots: TimeSlot[]): string {
  const header = ["day", "start", "end", "subject", "room", "teacher", "color"];
  const rows = slots.map((s) =>
    [s.day, minutesToTime(s.startMin), minutesToTime(s.endMin), `"${s.subject}"`, `"${s.room}"`, `"${s.teacher}"`, s.color].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Export as iCalendar (.ics). */
export function exportScheduleICS(slots: TimeSlot[], weekStartDate: Date): string {
  const dayOffsets: Record<TimeSlot["day"], number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UnQTools//Schedule//EN"];
  for (const s of slots) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + dayOffsets[s.day]);
    const start = new Date(d);
    start.setHours(Math.floor(s.startMin / 60), s.startMin % 60, 0, 0);
    const end = new Date(d);
    end.setHours(Math.floor(s.endMin / 60), s.endMin % 60, 0, 0);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${s.id}@unqtools`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${formatICSDate(start)}`);
    lines.push(`DTEND:${formatICSDate(end)}`);
    lines.push(`SUMMARY:${s.subject}`);
    if (s.room) lines.push(`LOCATION:${s.room}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function formatICSDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Find free time blocks on a given day. */
export function findFreeBlocks(slots: TimeSlot[], day: TimeSlot["day"], dayStart = 8 * 60, dayEnd = 18 * 60): Array<{ startMin: number; endMin: number }> {
  const daySlots = slots.filter((s) => s.day === day).sort((a, b) => a.startMin - b.startMin);
  const free: Array<{ startMin: number; endMin: number }> = [];
  let cursor = dayStart;
  for (const s of daySlots) {
    if (s.startMin > cursor) free.push({ startMin: cursor, endMin: s.startMin });
    cursor = Math.max(cursor, s.endMin);
  }
  if (cursor < dayEnd) free.push({ startMin: cursor, endMin: dayEnd });
  return free;
}

/** Suggest a color for a subject (hash-based). */
export function suggestColor(subject: string): string {
  const palette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
