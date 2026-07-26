/**
 * Meeting Minutes Template — pure logic.
 *
 * Renders structured meeting minutes (attendees, agenda, decisions,
 * action items, next meeting) into multiple export formats:
 *   • Markdown
 *   • Plain text
 *   • HTML email
 *
 * All rendering is local — no network calls.
 */

export interface Attendee {
  name: string;
  role?: string;
  email?: string;
  present?: boolean;
}

export interface AgendaItem {
  topic: string;
  presenter?: string;
  durationMinutes?: number;
  notes?: string;
}

export interface Decision {
  text: string;
  decidedBy?: string;
}

export interface ActionItem {
  task: string;
  assignee?: string;
  dueDate?: string; // ISO date string YYYY-MM-DD
  priority?: "low" | "medium" | "high";
}

export interface MeetingInput {
  title: string;
  date: string; // ISO date
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  location?: string;
  facilitator?: string;
  noteTaker?: string;
  attendees: Attendee[];
  agenda: AgendaItem[];
  decisions: Decision[];
  actionItems: ActionItem[];
  notes?: string;
  nextMeeting?: { date: string; time?: string; location?: string };
}

export interface MeetingResult {
  markdown: string;
  text: string;
  html: string;
  config: MeetingInput;
  warnings: string[];
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PRIORITY_LABEL: Record<ActionItem["priority"] & string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function generateMinutes(input: MeetingInput): MeetingResult | { error: string } {
  if (!input.title || input.title.trim().length === 0) return { error: "Meeting title is required." };
  if (!input.date) return { error: "Meeting date is required." };
  if (!input.attendees || input.attendees.length === 0) return { error: "At least one attendee is required." };

  const warnings: string[] = [];
  if (input.actionItems.length > 0) {
    const unassigned = input.actionItems.filter((a) => !a.assignee).length;
    if (unassigned > 0) warnings.push(`${unassigned} action item(s) have no assignee.`);
    const noDue = input.actionItems.filter((a) => !a.dueDate).length;
    if (noDue > 0) warnings.push(`${noDue} action item(s) have no due date.`);
  }
  if (input.agenda.length === 0) warnings.push("Agenda is empty — consider adding topics.");

  const present = input.attendees.filter((a) => a.present !== false);
  const absent = input.attendees.filter((a) => a.present === false);

  // --- Markdown ---
  const md: string[] = [];
  md.push(`# ${input.title}`);
  md.push("");
  md.push(`**Date:** ${fmtDate(input.date)}${input.startTime ? ` ${input.startTime}` : ""}${input.endTime ? ` – ${input.endTime}` : ""}`);
  if (input.location) md.push(`**Location:** ${input.location}`);
  if (input.facilitator) md.push(`**Facilitator:** ${input.facilitator}`);
  if (input.noteTaker) md.push(`**Note taker:** ${input.noteTaker}`);
  md.push("");
  md.push("## Attendees");
  md.push("");
  for (const a of present) md.push(`- ${a.name}${a.role ? ` (${a.role})` : ""}`);
  if (absent.length > 0) {
    md.push("");
    md.push("**Absent:**");
    for (const a of absent) md.push(`- ${a.name}`);
  }
  md.push("");
  if (input.agenda.length > 0) {
    md.push("## Agenda");
    md.push("");
    input.agenda.forEach((item, i) => {
      md.push(`${i + 1}. **${item.topic}**${item.presenter ? ` — ${item.presenter}` : ""}${item.durationMinutes ? ` (${item.durationMinutes} min)` : ""}`);
      if (item.notes) md.push(`   - ${item.notes}`);
    });
    md.push("");
  }
  if (input.decisions.length > 0) {
    md.push("## Decisions");
    md.push("");
    input.decisions.forEach((d) => md.push(`- ${d.text}${d.decidedBy ? ` _(decided by ${d.decidedBy})_` : ""}`));
    md.push("");
  }
  if (input.actionItems.length > 0) {
    md.push("## Action Items");
    md.push("");
    md.push("| # | Task | Assignee | Due | Priority |");
    md.push("| --- | --- | --- | --- | --- |");
    input.actionItems.forEach((a, i) => {
      md.push(`| ${i + 1} | ${a.task} | ${a.assignee ?? "—"} | ${a.dueDate ? fmtDate(a.dueDate) : "—"} | ${a.priority ? PRIORITY_LABEL[a.priority] : "—"} |`);
    });
    md.push("");
  }
  if (input.notes) {
    md.push("## Notes");
    md.push("");
    md.push(input.notes);
    md.push("");
  }
  if (input.nextMeeting) {
    md.push("## Next Meeting");
    md.push("");
    md.push(`**Date:** ${fmtDate(input.nextMeeting.date)}${input.nextMeeting.time ? ` ${input.nextMeeting.time}` : ""}`);
    if (input.nextMeeting.location) md.push(`**Location:** ${input.nextMeeting.location}`);
    md.push("");
  }

  // --- Plain text ---
  const txt: string[] = [];
  txt.push(`MEETING MINUTES: ${input.title}`);
  txt.push(`Date: ${fmtDate(input.date)}${input.startTime ? ` ${input.startTime}` : ""}${input.endTime ? ` – ${input.endTime}` : ""}`);
  if (input.location) txt.push(`Location: ${input.location}`);
  if (input.facilitator) txt.push(`Facilitator: ${input.facilitator}`);
  if (input.noteTaker) txt.push(`Note taker: ${input.noteTaker}`);
  txt.push("");
  txt.push("ATTENDEES:");
  for (const a of present) txt.push(`  - ${a.name}${a.role ? ` (${a.role})` : ""}`);
  if (absent.length > 0) {
    txt.push("ABSENT:");
    for (const a of absent) txt.push(`  - ${a.name}`);
  }
  txt.push("");
  if (input.agenda.length > 0) {
    txt.push("AGENDA:");
    input.agenda.forEach((item, i) => {
      txt.push(`  ${i + 1}. ${item.topic}${item.presenter ? ` — ${item.presenter}` : ""}${item.durationMinutes ? ` (${item.durationMinutes} min)` : ""}`);
      if (item.notes) txt.push(`       ${item.notes}`);
    });
    txt.push("");
  }
  if (input.decisions.length > 0) {
    txt.push("DECISIONS:");
    for (const d of input.decisions) txt.push(`  - ${d.text}${d.decidedBy ? ` (decided by ${d.decidedBy})` : ""}`);
    txt.push("");
  }
  if (input.actionItems.length > 0) {
    txt.push("ACTION ITEMS:");
    input.actionItems.forEach((a, i) => {
      txt.push(`  ${i + 1}. ${a.task} — Assignee: ${a.assignee ?? "—"} — Due: ${a.dueDate ? fmtDate(a.dueDate) : "—"} — Priority: ${a.priority ? PRIORITY_LABEL[a.priority] : "—"}`);
    });
    txt.push("");
  }
  if (input.notes) { txt.push("NOTES:"); txt.push(input.notes); txt.push(""); }
  if (input.nextMeeting) {
    txt.push("NEXT MEETING:");
    txt.push(`  Date: ${fmtDate(input.nextMeeting.date)}${input.nextMeeting.time ? ` ${input.nextMeeting.time}` : ""}`);
    if (input.nextMeeting.location) txt.push(`  Location: ${input.nextMeeting.location}`);
  }

  // --- HTML email ---
  const htmlParts: string[] = [];
  htmlParts.push(`<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#0f172a;">`);
  htmlParts.push(`<h1 style="font-size:20px;margin:0 0 8px;">${esc(input.title)}</h1>`);
  htmlParts.push(`<p style="color:#475569;font-size:13px;margin:0 0 16px;">`);
  htmlParts.push(`<strong>Date:</strong> ${esc(fmtDate(input.date))}${input.startTime ? " " + esc(input.startTime) : ""}${input.endTime ? " – " + esc(input.endTime) : ""}`);
  if (input.location) htmlParts.push(` · <strong>Location:</strong> ${esc(input.location)}`);
  if (input.facilitator) htmlParts.push(` · <strong>Facilitator:</strong> ${esc(input.facilitator)}`);
  htmlParts.push(`</p>`);
  htmlParts.push(`<h2 style="font-size:14px;margin:0 0 4px;">Attendees</h2>`);
  htmlParts.push(`<ul style="margin:0 0 16px;padding-left:20px;font-size:13px;">`);
  for (const a of present) htmlParts.push(`<li>${esc(a.name)}${a.role ? ` <span style="color:#64748b;">(${esc(a.role)})</span>` : ""}</li>`);
  htmlParts.push(`</ul>`);
  if (input.agenda.length > 0) {
    htmlParts.push(`<h2 style="font-size:14px;margin:0 0 4px;">Agenda</h2>`);
    htmlParts.push(`<ol style="margin:0 0 16px;padding-left:20px;font-size:13px;">`);
    for (const item of input.agenda) htmlParts.push(`<li><strong>${esc(item.topic)}</strong>${item.presenter ? ` — ${esc(item.presenter)}` : ""}${item.durationMinutes ? ` <span style="color:#64748b;">(${item.durationMinutes} min)</span>` : ""}${item.notes ? `<br/><span style="color:#64748b;">${esc(item.notes)}</span>` : ""}</li>`);
    htmlParts.push(`</ol>`);
  }
  if (input.decisions.length > 0) {
    htmlParts.push(`<h2 style="font-size:14px;margin:0 0 4px;">Decisions</h2>`);
    htmlParts.push(`<ul style="margin:0 0 16px;padding-left:20px;font-size:13px;">`);
    for (const d of input.decisions) htmlParts.push(`<li>${esc(d.text)}${d.decidedBy ? ` <span style="color:#64748b;">(decided by ${esc(d.decidedBy)})</span>` : ""}</li>`);
    htmlParts.push(`</ul>`);
  }
  if (input.actionItems.length > 0) {
    htmlParts.push(`<h2 style="font-size:14px;margin:0 0 4px;">Action Items</h2>`);
    htmlParts.push(`<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">`);
    htmlParts.push(`<thead><tr style="background:#f1f5f9;"><th style="text-align:left;border:1px solid #e2e8f0;">#</th><th style="text-align:left;border:1px solid #e2e8f0;">Task</th><th style="text-align:left;border:1px solid #e2e8f0;">Assignee</th><th style="text-align:left;border:1px solid #e2e8f0;">Due</th><th style="text-align:left;border:1px solid #e2e8f0;">Priority</th></tr></thead>`);
    htmlParts.push(`<tbody>`);
    input.actionItems.forEach((a, i) => {
      htmlParts.push(`<tr><td style="border:1px solid #e2e8f0;">${i + 1}</td><td style="border:1px solid #e2e8f0;">${esc(a.task)}</td><td style="border:1px solid #e2e8f0;">${esc(a.assignee ?? "—")}</td><td style="border:1px solid #e2e8f0;">${a.dueDate ? esc(fmtDate(a.dueDate)) : "—"}</td><td style="border:1px solid #e2e8f0;">${a.priority ? PRIORITY_LABEL[a.priority] : "—"}</td></tr>`);
    });
    htmlParts.push(`</tbody></table>`);
  }
  if (input.nextMeeting) {
    htmlParts.push(`<h2 style="font-size:14px;margin:16px 0 4px;">Next Meeting</h2>`);
    htmlParts.push(`<p style="font-size:13px;">${esc(fmtDate(input.nextMeeting.date))}${input.nextMeeting.time ? " " + esc(input.nextMeeting.time) : ""}${input.nextMeeting.location ? ` · ${esc(input.nextMeeting.location)}` : ""}</p>`);
  }
  htmlParts.push(`</div>`);
  const html = htmlParts.join("\n");

  return { markdown: md.join("\n"), text: txt.join("\n"), html, config: input, warnings };
}

/** Validate an ISO date (YYYY-MM-DD). */
export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
}
