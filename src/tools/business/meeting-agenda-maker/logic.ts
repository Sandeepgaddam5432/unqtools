/**
 * Meeting Agenda Maker — pure logic.
 *
 * Parse attendees, agenda items (CSV), objectives; compute meeting
 * duration, total agenda time, buffer, overflow, time slots; render
 * as text / HTML / Markdown / CSV. Pure functions only — no DOM, no
 * network.
 */

// ---- Types ----

export interface AgendaItem {
  topic: string;
  durationMinutes: number;
  presenter: string;
}

export interface TimeSlot {
  index: number;
  topic: string;
  presenter: string;
  durationMinutes: number;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
}

export interface MeetingTypePreset {
  label: string;
  value: string;
  defaultDurationMinutes: number;
  defaultItemMinutes: number;
  sampleItems: string;
}

export interface MeetingInput {
  meetingTitle: string;
  meetingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location: string;
  organizer: string;
  attendees: string; // textarea, one per line
  agendaItems: string; // textarea, CSV per line
  objectives: string; // textarea, one per line
  notes: string;
}

export interface MeetingStats {
  attendeeCount: number;
  agendaItemCount: number;
  objectiveCount: number;
  meetingDurationMinutes: number;
  totalAgendaTimeMinutes: number;
  bufferMinutes: number;
  overflow: boolean;
  overflowMinutes: number;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  date: string;
  attendeeCount: number;
  itemCount: number;
  totalAgendaTimeMinutes: number;
  meetingDurationMinutes: number;
}

// ---- Constants / Presets ----

export const MEETING_TYPE_PRESETS: MeetingTypePreset[] = [
  {
    label: "Standup (15 min)",
    value: "standup",
    defaultDurationMinutes: 15,
    defaultItemMinutes: 3,
    sampleItems: "Yesterday,3,Alice\nToday,3,Bob\nBlockers,2,Charlie",
  },
  {
    label: "Weekly Sync (60 min)",
    value: "weekly",
    defaultDurationMinutes: 60,
    defaultItemMinutes: 10,
    sampleItems: "Wins & updates,10,Alice\nMetrics,10,Bob\nRoadmap,20,Charlie\nAction items,10,Alice",
  },
  {
    label: "Monthly Review (90 min)",
    value: "monthly",
    defaultDurationMinutes: 90,
    defaultItemMinutes: 20,
    sampleItems: "KPI review,20,Alice\nBudget,20,Bob\nTeam updates,30,Charlie\nQ&A,10,All\nAction items,10,Alice",
  },
  {
    label: "Quarterly Planning (3 hr)",
    value: "quarterly",
    defaultDurationMinutes: 180,
    defaultItemMinutes: 30,
    sampleItems: "Recap,20,Alice\nGoal setting,40,Bob\nInitiatives,45,Charlie\nResource alloc,30,Dana\nRisks,25,All\nNext steps,20,Alice",
  },
  {
    label: "Retrospective (2 hr)",
    value: "retro",
    defaultDurationMinutes: 120,
    defaultItemMinutes: 20,
    sampleItems: "What went well,20,Alice\nWhat didn't,20,Bob\nAction items,30,Charlie\nTeam health,15,All\nClosing,5,Alice",
  },
];

// ---- Normalization / Parsing ----

/** Normalize a free-text string. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse attendees — one per line. */
export function parseAttendees(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse objectives — one per line. */
export function parseObjectives(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse agenda items — `topic,duration_minutes,presenter` per line. */
export function parseAgendaItems(
  text: string,
): { items: AgendaItem[]; errors: string[] } {
  const items: AgendaItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const parts = splitCsvRow(line).map((s) => s.trim());

    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs topic,duration_minutes[,presenter]`);
      return;
    }
    const [topic, durationStr, presenter = ""] = parts;
    if (!topic) {
      errors.push(`Line ${idx + 1}: topic is required`);
      return;
    }
    const durationMinutes = Number(durationStr);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
      errors.push(`Line ${idx + 1}: invalid duration "${durationStr}"`);
      return;
    }
    items.push({ topic, durationMinutes, presenter: normalizeText(presenter) });
  });
  return { items, errors };
}

/** Split CSV row honoring quoted values (basic). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

// ---- Time helpers ----

/** Parse a HH:MM string into minutes from midnight. Returns NaN if invalid. */
export function parseTimeToMinutes(time: string): number {
  if (!time) return NaN;
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(time.trim());
  if (!m) return NaN;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridian = m[3]?.toLowerCase();
  if (meridian === "pm" && hours < 12) hours += 12;
  if (meridian === "am" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

/** Format minutes-from-midnight as HH:MM (24-hour). */
export function formatTime(minutes: number): string {
  if (!Number.isFinite(minutes)) return "";
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Calculate meeting duration in minutes from start/end strings. */
export function calculateMeetingDuration(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  let diff = end - start;
  if (diff < 0) diff += 1440; // wrap around midnight
  return diff;
}

/** Sum durations of agenda items. */
export function calculateTotalAgendaTime(items: AgendaItem[]): number {
  return items.reduce((s, it) => s + it.durationMinutes, 0);
}

/** Buffer time = meeting duration − total agenda time. Negative = overflow. */
export function calculateBufferTime(
  meetingDurationMinutes: number,
  totalAgendaTimeMinutes: number,
): number {
  return meetingDurationMinutes - totalAgendaTimeMinutes;
}

/** True if total agenda time exceeds meeting duration. */
export function detectOverflow(
  meetingDurationMinutes: number,
  totalAgendaTimeMinutes: number,
): boolean {
  return totalAgendaTimeMinutes > meetingDurationMinutes;
}

/** Generate start/end time slots for each agenda item. */
export function generateTimeSlots(
  items: AgendaItem[],
  startTime: string,
): TimeSlot[] {
  const startMinutes = parseTimeToMinutes(startTime);
  if (!Number.isFinite(startMinutes) || items.length === 0) return [];
  const slots: TimeSlot[] = [];
  let cursor = startMinutes;
  items.forEach((it, idx) => {
    const slotStart = cursor;
    const slotEnd = cursor + it.durationMinutes;
    slots.push({
      index: idx + 1,
      topic: it.topic,
      presenter: it.presenter,
      durationMinutes: it.durationMinutes,
      startMinutes: slotStart,
      endMinutes: slotEnd,
      startTime: formatTime(slotStart),
      endTime: formatTime(slotEnd),
    });
    cursor = slotEnd;
  });
  return slots;
}

/** Produce action item placeholders (one per agenda item). */
export function getActionItemPlaceholders(items: AgendaItem[]): string[] {
  return items.map((it, i) => `[ ] Action item ${i + 1} — ${it.topic} (${it.presenter || "owner"})`);
}

/** Apply a meeting type preset, returning default start/end times + sample items. */
export function applyPreset(
  preset: MeetingTypePreset,
): { startTime: string; endTime: string; agendaItems: string } {
  const startMinutes = 9 * 60; // 09:00 default
  const endMinutes = startMinutes + preset.defaultDurationMinutes;
  return {
    startTime: formatTime(startMinutes),
    endTime: formatTime(endMinutes),
    agendaItems: preset.sampleItems,
  };
}

/** Compute summary stats. */
export function summaryStats(
  input: MeetingInput,
  items: AgendaItem[],
  attendees: string[],
  objectives: string[],
): MeetingStats {
  const meetingDurationMinutes = calculateMeetingDuration(input.startTime, input.endTime);
  const totalAgendaTimeMinutes = calculateTotalAgendaTime(items);
  const bufferMinutes = calculateBufferTime(meetingDurationMinutes, totalAgendaTimeMinutes);
  const overflow = detectOverflow(meetingDurationMinutes, totalAgendaTimeMinutes);
  const overflowMinutes = overflow ? Math.abs(bufferMinutes) : 0;
  return {
    attendeeCount: attendees.length,
    agendaItemCount: items.length,
    objectiveCount: objectives.length,
    meetingDurationMinutes,
    totalAgendaTimeMinutes,
    bufferMinutes,
    overflow,
    overflowMinutes,
  };
}

// ---- Renderers ----

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the agenda as plain text. */
export function renderText(
  input: MeetingInput,
  items: AgendaItem[],
  attendees: string[],
  objectives: string[],
  slots: TimeSlot[],
  stats: MeetingStats,
): string {
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("MEETING AGENDA");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Title: ${input.meetingTitle || "(untitled)"}`);
  if (input.meetingDate) L.push(`Date: ${input.meetingDate}`);
  L.push(`Time: ${input.startTime} – ${input.endTime} (${stats.meetingDurationMinutes} min)`);
  if (input.location) L.push(`Location: ${input.location}`);
  if (input.organizer) L.push(`Organizer: ${input.organizer}`);
  L.push("");
  if (attendees.length > 0) {
    L.push("ATTENDEES:");
    attendees.forEach((a, i) => L.push(`  ${i + 1}. ${a}`));
    L.push("");
  }
  if (objectives.length > 0) {
    L.push("OBJECTIVES:");
    objectives.forEach((o, i) => L.push(`  ${i + 1}. ${o}`));
    L.push("");
  }
  L.push("-".repeat(60));
  L.push("AGENDA");
  L.push("-".repeat(60));
  if (slots.length === 0) {
    L.push("  (no agenda items)");
  } else {
    slots.forEach((s) => {
      const presenter = s.presenter ? ` [${s.presenter}]` : "";
      L.push(
        `${s.startTime} – ${s.endTime} (${s.durationMinutes} min)${presenter}`,
      );
      L.push(`  ${s.index}. ${s.topic}`);
    });
  }
  L.push("-".repeat(60));
  if (stats.overflow) {
    L.push(`⚠ OVERFLOW: agenda exceeds meeting by ${stats.overflowMinutes} min`);
  } else {
    L.push(`Buffer: ${stats.bufferMinutes} min remaining`);
  }
  L.push(`Total agenda time: ${stats.totalAgendaTimeMinutes} min / ${stats.meetingDurationMinutes} min`);
  L.push("");
  if (items.length > 0) {
    L.push("ACTION ITEMS:");
    getActionItemPlaceholders(items).forEach((ai) => L.push(`  ${ai}`));
    L.push("");
  }
  if (input.notes) {
    L.push("NOTES:");
    L.push(input.notes);
    L.push("");
  }
  return L.join("\n");
}

/** Render the agenda as Markdown. */
export function renderMarkdown(
  input: MeetingInput,
  items: AgendaItem[],
  attendees: string[],
  objectives: string[],
  slots: TimeSlot[],
  stats: MeetingStats,
): string {
  const L: string[] = [];
  L.push(`# ${input.meetingTitle || "Meeting Agenda"}`);
  L.push("");
  L.push(`- **Date:** ${input.meetingDate}`);
  L.push(`- **Time:** ${input.startTime} – ${input.endTime} (${stats.meetingDurationMinutes} min)`);
  if (input.location) L.push(`- **Location:** ${input.location}`);
  if (input.organizer) L.push(`- **Organizer:** ${input.organizer}`);
  L.push("");
  if (attendees.length > 0) {
    L.push("## Attendees");
    L.push("");
    attendees.forEach((a) => L.push(`- ${a}`));
    L.push("");
  }
  if (objectives.length > 0) {
    L.push("## Objectives");
    L.push("");
    objectives.forEach((o) => L.push(`- ${o}`));
    L.push("");
  }
  L.push("## Agenda");
  L.push("");
  L.push("| # | Start | End | Duration | Topic | Presenter |");
  L.push("|---|-------|-----|----------|-------|-----------|");
  slots.forEach((s) => {
    L.push(
      `| ${s.index} | ${s.startTime} | ${s.endTime} | ${s.durationMinutes}m | ${s.topic} | ${s.presenter} |`,
    );
  });
  L.push("");
  if (stats.overflow) {
    L.push(`> ⚠ **Overflow:** agenda exceeds meeting by ${stats.overflowMinutes} min`);
  } else {
    L.push(`> **Buffer:** ${stats.bufferMinutes} min remaining`);
  }
  L.push(`> **Total agenda time:** ${stats.totalAgendaTimeMinutes} min / ${stats.meetingDurationMinutes} min`);
  L.push("");
  if (items.length > 0) {
    L.push("## Action Items");
    L.push("");
    getActionItemPlaceholders(items).forEach((ai) => L.push(`- ${ai}`));
    L.push("");
  }
  if (input.notes) {
    L.push("## Notes");
    L.push("");
    L.push(input.notes);
    L.push("");
  }
  return L.join("\n");
}

/** Render the agenda as printable HTML with inline CSS. */
export function renderHtml(
  input: MeetingInput,
  items: AgendaItem[],
  attendees: string[],
  objectives: string[],
  slots: TimeSlot[],
  stats: MeetingStats,
): string {
  const esc = escapeHtml;
  const rows = slots
    .map(
      (s) =>
        `<tr><td>${s.index}</td><td>${esc(s.startTime)}</td><td>${esc(s.endTime)}</td><td style="text-align:right">${s.durationMinutes}</td><td>${esc(s.topic)}</td><td>${esc(s.presenter)}</td></tr>`,
    )
    .join("");
  const attendeeList = attendees.map((a) => `<li>${esc(a)}</li>`).join("");
  const objectiveList = objectives.map((o) => `<li>${esc(o)}</li>`).join("");
  const actionItems = items
    .map(
      (it) =>
        `<li><input type="checkbox" disabled/> Action — <strong>${esc(it.topic)}</strong> (${esc(it.presenter || "owner")})</li>`,
    )
    .join("");
  const bufferLine = stats.overflow
    ? `<div class="warn">⚠ Overflow: agenda exceeds meeting by ${stats.overflowMinutes} min</div>`
    : `<div class="ok">Buffer: ${stats.bufferMinutes} min remaining</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(input.meetingTitle || "Meeting Agenda")}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:820px}
  h1{font-size:24px;margin:0 0 4px;color:#111}
  .muted{color:#666;font-size:13px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:16px 0;font-size:14px}
  .meta div{padding:2px 0}
  .meta strong{display:inline-block;min-width:90px;color:#555}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
  ul{margin:0;padding-left:20px;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:left}
  th{background:#f5f5f5;text-transform:uppercase;font-size:11px;letter-spacing:.03em;color:#666}
  .warn{background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:8px 12px;border-radius:6px;font-size:13px;margin:8px 0}
  .ok{background:#dcfce7;color:#166534;border:1px solid #86efac;padding:8px 12px;border-radius:6px;font-size:13px;margin:8px 0}
  .notes{margin-top:16px;padding:12px;background:#fafafa;border-radius:6px;font-size:13px}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>${esc(input.meetingTitle || "Meeting Agenda")}</h1>
<div class="muted">${esc(input.meetingDate || "")} · ${esc(input.startTime)} – ${esc(input.endTime)} · ${stats.meetingDurationMinutes} min</div>
<div class="meta">
  ${input.location ? `<div><strong>Location:</strong> ${esc(input.location)}</div>` : ""}
  ${input.organizer ? `<div><strong>Organizer:</strong> ${esc(input.organizer)}</div>` : ""}
  <div><strong>Attendees:</strong> ${attendees.length}</div>
  <div><strong>Items:</strong> ${items.length}</div>
</div>
${attendees.length > 0 ? `<h2>Attendees</h2><ul>${attendeeList}</ul>` : ""}
${objectives.length > 0 ? `<h2>Objectives</h2><ul>${objectiveList}</ul>` : ""}
<h2>Agenda</h2>
<table>
  <thead><tr><th>#</th><th>Start</th><th>End</th><th style="text-align:right">Min</th><th>Topic</th><th>Presenter</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#999">No agenda items</td></tr>`}</tbody>
</table>
${bufferLine}
<div class="muted">Total agenda time: ${stats.totalAgendaTimeMinutes} min / ${stats.meetingDurationMinutes} min</div>
${items.length > 0 ? `<h2>Action Items</h2><ul class="actions">${actionItems}</ul>` : ""}
${input.notes ? `<div class="notes"><strong>Notes:</strong><br/>${esc(input.notes)}</div>` : ""}
</body></html>`;
}

/** Render the agenda as CSV: slot,topic,duration,presenter. */
export function renderCsv(slots: TimeSlot[]): string {
  const lines = ["slot_start,slot_end,duration_minutes,topic,presenter"];
  for (const s of slots) {
    lines.push(
      [
        escapeCsv(s.startTime),
        escapeCsv(s.endTime),
        String(s.durationMinutes),
        escapeCsv(s.topic),
        escapeCsv(s.presenter),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:meeting-agenda-maker:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<MeetingInput>): string {
  const params = new URLSearchParams();
  if (input.meetingTitle) params.set("title", input.meetingTitle);
  if (input.meetingDate) params.set("date", input.meetingDate);
  if (input.startTime) params.set("start", input.startTime);
  if (input.endTime) params.set("end", input.endTime);
  if (input.location) params.set("loc", input.location);
  if (input.organizer) params.set("org", input.organizer);
  if (input.attendees) params.set("attendees", input.attendees);
  if (input.agendaItems) params.set("items", input.agendaItems);
  if (input.objectives) params.set("objs", input.objectives);
  if (input.notes) params.set("notes", input.notes);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<MeetingInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<MeetingInput> = {};
  if (params.get("title")) out.meetingTitle = params.get("title")!;
  if (params.get("date")) out.meetingDate = params.get("date")!;
  if (params.get("start")) out.startTime = params.get("start")!;
  if (params.get("end")) out.endTime = params.get("end")!;
  if (params.get("loc")) out.location = params.get("loc")!;
  if (params.get("org")) out.organizer = params.get("org")!;
  if (params.get("attendees")) out.attendees = params.get("attendees")!;
  if (params.get("items")) out.agendaItems = params.get("items")!;
  if (params.get("objs")) out.objectives = params.get("objs")!;
  if (params.get("notes")) out.notes = params.get("notes")!;
  return out;
}
