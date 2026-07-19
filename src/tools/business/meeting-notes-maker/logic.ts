/**
 * Meeting Notes Maker — pure logic.
 *
 * Parse attendees, agenda recap (CSV), decisions, action items (CSV),
 * parking lot; compute meeting duration; group action items by owner;
 * sort by due date; detect overdue items; render as text / HTML /
 * Markdown / CSV. Pure functions only — no DOM, no network.
 */

// ---- Types ----

export interface AgendaRecapItem {
  topic: string;
  discussionSummary: string;
}

export interface ActionItem {
  task: string;
  owner: string;
  dueDate: string; // YYYY-MM-DD, may be empty
}

export interface ActionItemGroup {
  owner: string;
  items: ActionItem[];
}

export interface MeetingTypePreset {
  label: string;
  value: string;
  defaultDurationMinutes: number;
  sampleAttendees: string;
  sampleAgendaRecap: string;
  sampleDecisions: string;
  sampleActionItems: string;
  sampleParkingLot: string;
}

export interface MeetingNotesInput {
  meetingTitle: string;
  meetingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location: string;
  facilitator: string;
  attendees: string; // textarea, one per line
  agendaRecap: string; // textarea, CSV: topic,discussion_summary
  decisions: string; // textarea, one per line
  actionItems: string; // textarea, CSV: task,owner,due_date
  parkingLot: string; // textarea, one per line
  nextMeetingDate: string; // YYYY-MM-DD, optional
}

export interface MeetingStats {
  attendeeCount: number;
  agendaRecapCount: number;
  decisionCount: number;
  actionItemCount: number;
  parkingLotCount: number;
  meetingDurationMinutes: number;
  overdueCount: number;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  date: string;
  attendeeCount: number;
  decisionCount: number;
  actionItemCount: number;
  parkingLotCount: number;
  meetingDurationMinutes: number;
  overdueCount: number;
}

export interface ParseResult<T> {
  items: T[];
  errors: string[];
}

// ---- Constants / Presets ----

export const MEETING_TYPE_PRESETS: MeetingTypePreset[] = [
  {
    label: "Standup (15 min)",
    value: "standup",
    defaultDurationMinutes: 15,
    sampleAttendees: "Alice\nBob\nCharlie",
    sampleAgendaRecap: "Yesterday,shipped login fix\nToday,working on API\nBlockers,none",
    sampleDecisions: "Push release to Friday\nPair on API bug",
    sampleActionItems: "Fix API bug,Alice,2026-07-22\nReview PR,Bob,2026-07-23",
    sampleParkingLot: "Discuss new hire onboarding",
  },
  {
    label: "Weekly Sync (60 min)",
    value: "weekly",
    defaultDurationMinutes: 60,
    sampleAttendees: "Alice Johnson\nBob Smith\nCarol Lee\nDan Patel",
    sampleAgendaRecap: "Metrics review,MRR up 8% WoW\nRoadmap,prioritize mobile app\nBlockers,need design review",
    sampleDecisions: "Approve mobile app roadmap\nFreeze API changes until release",
    sampleActionItems: "Draft mobile spec,Alice Johnson,2026-07-25\nSchedule design review,Carol Lee,2026-07-26\nUpdate budget,Bob Smith,2026-07-30",
    sampleParkingLot: "Revisit Q4 OKRs next week\nVendor selection in August",
  },
  {
    label: "Monthly Review (90 min)",
    value: "monthly",
    defaultDurationMinutes: 90,
    sampleAttendees: "Alice Johnson\nBob Smith\nCarol Lee\nDan Patel\nEve Wang",
    sampleAgendaRecap: "KPI review,Met revenue target of $1.2M\nBudget,Q3 spending on track\nTeam updates,Hired 2 new engineers",
    sampleDecisions: "Approved Q4 budget\nHired new designer\nRenew vendor contract for 1 year",
    sampleActionItems: "Onboard designer,Alice Johnson,2026-08-01\nRenew vendor contract,Bob Smith,2026-08-10\nPlan Q4 kickoff,Dan Patel,2026-08-15",
    sampleParkingLot: "Revisit hiring plan in October\nDiscuss remote-work policy",
  },
  {
    label: "Quarterly Planning (3 hr)",
    value: "quarterly",
    defaultDurationMinutes: 180,
    sampleAttendees: "Alice Johnson\nBob Smith\nCarol Lee\nDan Patel\nEve Wang\nFrank Wu",
    sampleAgendaRecap: "Q3 recap,Shipped 12 features, grew 25%\nGoal setting,Q4 target $2M ARR\nInitiatives,Mobile + enterprise tier\nResource alloc,Need 3 eng + 1 designer",
    sampleDecisions: "Q4 OKRs approved\nEnterprise tier launches Jan\nHire 3 engineers by Nov",
    sampleActionItems: "Draft Q4 OKR doc,Alice Johnson,2026-08-05\nScope enterprise tier,Carol Lee,2026-08-20\nOpen 3 eng reqs,Dan Patel,2026-08-10",
    sampleParkingLot: "Discuss acquisition targets\nReview compensation bands",
  },
  {
    label: "Retrospective (2 hr)",
    value: "retro",
    defaultDurationMinutes: 120,
    sampleAttendees: "Alice Johnson\nBob Smith\nCarol Lee\nDan Patel",
    sampleAgendaRecap: "What went well,Cross-team collaboration improved\nWhat didn't,Release slipped by 2 weeks\nAction items,Need better estimation\nTeam health,Score 7/10",
    sampleDecisions: "Adopt 2-week sprints\nAdd estimation workshop\nRotate scrum master quarterly",
    sampleActionItems: "Schedule estimation workshop,Alice Johnson,2026-07-30\nSet up sprint cadence,Bob Smith,2026-08-01\nPlan rotation schedule,Carol Lee,2026-08-05",
    sampleParkingLot: "Revisit standup time\nConsider async standups",
  },
  {
    label: "1:1 (30 min)",
    value: "1on1",
    defaultDurationMinutes: 30,
    sampleAttendees: "Alice Johnson\nBob Smith",
    sampleAgendaRecap: "Wins,Shipped onboarding redesign\nChallenges,Struggling with prioritization\nGrowth,Interested in leading mobile team",
    sampleDecisions: "Pair on prioritization framework\nTrial lead on next mobile project",
    sampleActionItems: "Read 'Inspired' book,Bob Smith,2026-08-01\nDraft mobile project brief,Alice Johnson,2026-08-03",
    sampleParkingLot: "Career growth conversation next month",
  },
  {
    label: "Brainstorm (90 min)",
    value: "brainstorm",
    defaultDurationMinutes: 90,
    sampleAttendees: "Alice Johnson\nBob Smith\nCarol Lee\nDan Patel\nEve Wang",
    sampleAgendaRecap: "Theme: reduce churn,Ideas: onboarding flow, weekly tips, in-app surveys\nTop 3 voted,Onboarding redesign, weekly tips, NPS survey",
    sampleDecisions: "Prototype onboarding redesign\nShip weekly tips in 2 weeks\nRun NPS survey next month",
    sampleActionItems: "Onboarding prototype,Carol Lee,2026-07-28\nWeekly tips spec,Dan Patel,2026-07-25\nNPS survey draft,Eve Wang,2026-08-01",
    sampleParkingLot: "Customer advisory board\nIn-app chat feature",
  },
];

// ---- Normalization / Parsing ----

/** Normalize a free-text string (collapse whitespace, trim). */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Split a CSV row honoring quoted values (basic, no embedded newlines). */
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

/** Parse attendees — one per line. */
export function parseAttendees(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse decisions — one per line. */
export function parseDecisions(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse parking-lot items — one per line. */
export function parseParkingLot(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse agenda recap — `topic,discussion_summary` per line. */
export function parseAgendaRecap(text: string): ParseResult<AgendaRecapItem> {
  const items: AgendaRecapItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 1 || !parts[0]) {
      errors.push(`Line ${idx + 1}: topic is required`);
      return;
    }
    const [topic, discussionSummary = ""] = parts;
    items.push({
      topic: normalizeText(topic),
      discussionSummary: normalizeText(discussionSummary),
    });
  });
  return { items, errors };
}

/** Parse action items — `task,owner,due_date` per line. */
export function parseActionItems(text: string): ParseResult<ActionItem> {
  const items: ActionItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 1 || !parts[0]) {
      errors.push(`Line ${idx + 1}: task is required`);
      return;
    }
    const [task, owner = "", dueDate = ""] = parts;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      errors.push(`Line ${idx + 1}: due_date "${dueDate}" is not YYYY-MM-DD`);
      return;
    }
    items.push({
      task: normalizeText(task),
      owner: normalizeText(owner),
      dueDate: dueDate.trim(),
    });
  });
  return { items, errors };
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

/** Calculate meeting duration in minutes from start/end strings. Wraps midnight. */
export function calculateMeetingDuration(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  let diff = end - start;
  if (diff < 0) diff += 1440; // wrap around midnight
  return diff;
}

/** Format duration in minutes as "1h 30m" or "45m" or "0m". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---- Action item grouping / sorting / overdue ----

/** Group action items by owner (alphabetical). Unassigned → "(unassigned)". */
export function groupActionItemsByOwner(items: ActionItem[]): ActionItemGroup[] {
  const map = new Map<string, ActionItem[]>();
  for (const it of items) {
    const owner = it.owner || "(unassigned)";
    if (!map.has(owner)) map.set(owner, []);
    map.get(owner)!.push(it);
  }
  const groups = Array.from(map.entries()).map(([owner, list]) => ({
    owner,
    items: list,
  }));
  groups.sort((a, b) => a.owner.localeCompare(b.owner));
  return groups;
}

/**
 * Sort action items by due date (earliest first).
 * Items without a due date are placed at the end in their original order.
 */
export function sortActionItemsByDueDate(items: ActionItem[]): ActionItem[] {
  const withDate = items.filter((it) => it.dueDate);
  const withoutDate = items.filter((it) => !it.dueDate);
  withDate.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return [...withDate, ...withoutDate];
}

/** Format today's date as YYYY-MM-DD using the local timezone. */
export function todayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Validate a YYYY-MM-DD string. */
export function isValidDateString(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  return true;
}

/** True if dueDate is strictly before today. Lexicographic compare works for YYYY-MM-DD. */
export function isOverdue(dueDate: string, today: string): boolean {
  if (!isValidDateString(dueDate) || !isValidDateString(today)) return false;
  return dueDate < today;
}

/** Filter to just the overdue action items. */
export function detectOverdueActionItems(
  items: ActionItem[],
  today: string,
): ActionItem[] {
  return items.filter((it) => isOverdue(it.dueDate, today));
}

// ---- Presets ----

/** Apply a meeting type preset, returning sample input data + default times. */
export function applyPreset(
  preset: MeetingTypePreset,
): {
  startTime: string;
  endTime: string;
  attendees: string;
  agendaRecap: string;
  decisions: string;
  actionItems: string;
  parkingLot: string;
} {
  const startMinutes = 9 * 60; // 09:00 default
  const endMinutes = startMinutes + preset.defaultDurationMinutes;
  return {
    startTime: formatTime(startMinutes),
    endTime: formatTime(endMinutes),
    attendees: preset.sampleAttendees,
    agendaRecap: preset.sampleAgendaRecap,
    decisions: preset.sampleDecisions,
    actionItems: preset.sampleActionItems,
    parkingLot: preset.sampleParkingLot,
  };
}

// ---- Stats ----

/** Compute summary stats for the meeting. */
export function summaryStats(
  input: MeetingNotesInput,
  attendees: string[],
  recap: AgendaRecapItem[],
  decisions: string[],
  actionItems: ActionItem[],
  parkingLot: string[],
  today: string,
): MeetingStats {
  const meetingDurationMinutes = calculateMeetingDuration(input.startTime, input.endTime);
  const overdueCount = detectOverdueActionItems(actionItems, today).length;
  return {
    attendeeCount: attendees.length,
    agendaRecapCount: recap.length,
    decisionCount: decisions.length,
    actionItemCount: actionItems.length,
    parkingLotCount: parkingLot.length,
    meetingDurationMinutes,
    overdueCount,
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

/** Format an action item as a one-line summary, marking overdue items. */
export function formatActionItemLine(item: ActionItem, today: string): string {
  const due = item.dueDate ? ` (due ${item.dueDate})` : "";
  const owner = item.owner ? ` — ${item.owner}` : "";
  const overdue = isOverdue(item.dueDate, today) ? " [OVERDUE]" : "";
  return `[ ] ${item.task}${owner}${due}${overdue}`;
}

/** Render meeting notes as plain text. */
export function renderText(
  input: MeetingNotesInput,
  attendees: string[],
  recap: AgendaRecapItem[],
  decisions: string[],
  actionItems: ActionItem[],
  parkingLot: string[],
  stats: MeetingStats,
  today: string,
): string {
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("MEETING NOTES");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Title: ${input.meetingTitle || "(untitled)"}`);
  if (input.meetingDate) L.push(`Date: ${input.meetingDate}`);
  L.push(
    `Time: ${input.startTime} – ${input.endTime} (${formatDuration(stats.meetingDurationMinutes)})`,
  );
  if (input.location) L.push(`Location: ${input.location}`);
  if (input.facilitator) L.push(`Facilitator: ${input.facilitator}`);
  L.push("");

  if (attendees.length > 0) {
    L.push("ATTENDEES:");
    attendees.forEach((a, i) => L.push(`  ${i + 1}. ${a}`));
    L.push("");
  }

  if (recap.length > 0) {
    L.push("-".repeat(60));
    L.push("AGENDA RECAP");
    L.push("-".repeat(60));
    recap.forEach((r, i) => {
      L.push(`  ${i + 1}. ${r.topic}`);
      if (r.discussionSummary) L.push(`     ${r.discussionSummary}`);
    });
    L.push("");
  }

  if (decisions.length > 0) {
    L.push("-".repeat(60));
    L.push(`DECISIONS (${decisions.length})`);
    L.push("-".repeat(60));
    decisions.forEach((d, i) => L.push(`  ${i + 1}. ${d}`));
    L.push("");
  }

  if (actionItems.length > 0) {
    L.push("-".repeat(60));
    const overdueLabel = stats.overdueCount > 0
      ? ` — ${stats.overdueCount} overdue`
      : "";
    L.push(`ACTION ITEMS (${actionItems.length}${overdueLabel})`);
    L.push("-".repeat(60));
    const sorted = sortActionItemsByDueDate(actionItems);
    sorted.forEach((it) => L.push(`  ${formatActionItemLine(it, today)}`));
    L.push("");

    const groups = groupActionItemsByOwner(actionItems);
    if (groups.length > 0) {
      L.push("  By owner:");
      groups.forEach((g) => {
        L.push(`  ${g.owner}:`);
        g.items.forEach((it) => {
          const due = it.dueDate ? ` (due ${it.dueDate})` : "";
          const overdue = isOverdue(it.dueDate, today) ? " [OVERDUE]" : "";
          L.push(`    - ${it.task}${due}${overdue}`);
        });
      });
      L.push("");
    }
  }

  if (parkingLot.length > 0) {
    L.push("-".repeat(60));
    L.push(`PARKING LOT (${parkingLot.length})`);
    L.push("-".repeat(60));
    parkingLot.forEach((p, i) => L.push(`  ${i + 1}. ${p}`));
    L.push("");
  }

  if (input.nextMeetingDate) {
    L.push(`Next meeting: ${input.nextMeetingDate}`);
    L.push("");
  }

  L.push("-".repeat(60));
  L.push("SUMMARY");
  L.push("-".repeat(60));
  L.push(`  Attendees:      ${stats.attendeeCount}`);
  L.push(`  Agenda recap:   ${stats.agendaRecapCount}`);
  L.push(`  Decisions:      ${stats.decisionCount}`);
  L.push(`  Action items:   ${stats.actionItemCount}${stats.overdueCount > 0 ? ` (${stats.overdueCount} overdue)` : ""}`);
  L.push(`  Parking lot:    ${stats.parkingLotCount}`);
  L.push(`  Duration:       ${formatDuration(stats.meetingDurationMinutes)}`);

  return L.join("\n");
}

/** Render meeting notes as Markdown (wiki/Notion compatible). */
export function renderMarkdown(
  input: MeetingNotesInput,
  attendees: string[],
  recap: AgendaRecapItem[],
  decisions: string[],
  actionItems: ActionItem[],
  parkingLot: string[],
  stats: MeetingStats,
  today: string,
): string {
  const L: string[] = [];
  L.push(`# ${input.meetingTitle || "Meeting Notes"}`);
  L.push("");
  L.push(`- **Date:** ${input.meetingDate}`);
  L.push(
    `- **Time:** ${input.startTime} – ${input.endTime} (${formatDuration(stats.meetingDurationMinutes)})`,
  );
  if (input.location) L.push(`- **Location:** ${input.location}`);
  if (input.facilitator) L.push(`- **Facilitator:** ${input.facilitator}`);
  L.push("");

  if (attendees.length > 0) {
    L.push("## Attendees");
    L.push("");
    attendees.forEach((a) => L.push(`- ${a}`));
    L.push("");
  }

  if (recap.length > 0) {
    L.push("## Agenda Recap");
    L.push("");
    recap.forEach((r, i) => {
      L.push(`### ${i + 1}. ${r.topic}`);
      L.push("");
      if (r.discussionSummary) {
        L.push(r.discussionSummary);
        L.push("");
      }
    });
  }

  if (decisions.length > 0) {
    L.push(`## Decisions (${decisions.length})`);
    L.push("");
    decisions.forEach((d) => L.push(`- ${d}`));
    L.push("");
  }

  if (actionItems.length > 0) {
    const overdueLabel = stats.overdueCount > 0
      ? ` — ${stats.overdueCount} overdue`
      : "";
    L.push(`## Action Items (${actionItems.length}${overdueLabel})`);
    L.push("");
    const sorted = sortActionItemsByDueDate(actionItems);
    sorted.forEach((it) => {
      const owner = it.owner ? ` — **${it.owner}**` : "";
      const due = it.dueDate ? ` _(due ${it.dueDate})_` : "";
      const overdue = isOverdue(it.dueDate, today) ? " **[OVERDUE]**" : "";
      L.push(`- [ ] ${it.task}${owner}${due}${overdue}`);
    });
    L.push("");

    const groups = groupActionItemsByOwner(actionItems);
    if (groups.length > 0) {
      L.push("### By Owner");
      L.push("");
      groups.forEach((g) => {
        L.push(`**${g.owner}**`);
        L.push("");
        g.items.forEach((it) => {
          const due = it.dueDate ? ` _(due ${it.dueDate})_` : "";
          const overdue = isOverdue(it.dueDate, today) ? " **[OVERDUE]**" : "";
          L.push(`- [ ] ${it.task}${due}${overdue}`);
        });
        L.push("");
      });
    }
  }

  if (parkingLot.length > 0) {
    L.push(`## Parking Lot (${parkingLot.length})`);
    L.push("");
    parkingLot.forEach((p) => L.push(`- ${p}`));
    L.push("");
  }

  if (input.nextMeetingDate) {
    L.push(`> **Next meeting:** ${input.nextMeetingDate}`);
    L.push("");
  }

  L.push("## Summary");
  L.push("");
  L.push("| Metric | Value |");
  L.push("|---|---|");
  L.push(`| Attendees | ${stats.attendeeCount} |`);
  L.push(`| Agenda recap | ${stats.agendaRecapCount} |`);
  L.push(`| Decisions | ${stats.decisionCount} |`);
  L.push(`| Action items | ${stats.actionItemCount}${stats.overdueCount > 0 ? ` (${stats.overdueCount} overdue)` : ""} |`);
  L.push(`| Parking lot | ${stats.parkingLotCount} |`);
  L.push(`| Duration | ${formatDuration(stats.meetingDurationMinutes)} |`);
  L.push("");

  return L.join("\n");
}

/** Render meeting notes as printable HTML with inline CSS. */
export function renderHtml(
  input: MeetingNotesInput,
  attendees: string[],
  recap: AgendaRecapItem[],
  decisions: string[],
  actionItems: ActionItem[],
  parkingLot: string[],
  stats: MeetingStats,
  today: string,
): string {
  const esc = escapeHtml;
  const attendeeList = attendees.map((a) => `<li>${esc(a)}</li>`).join("");
  const recapList = recap
    .map(
      (r, i) =>
        `<li><strong>${i + 1}. ${esc(r.topic)}</strong>${r.discussionSummary ? `<br/><span class="muted">${esc(r.discussionSummary)}</span>` : ""}</li>`,
    )
    .join("");
  const decisionList = decisions.map((d) => `<li>${esc(d)}</li>`).join("");

  const sorted = sortActionItemsByDueDate(actionItems);
  const actionRows = sorted
    .map((it) => {
      const overdueClass = isOverdue(it.dueDate, today) ? ` class="overdue"` : "";
      return `<tr${overdueClass}><td>${esc(it.task)}</td><td>${esc(it.owner || "—")}</td><td>${esc(it.dueDate || "—")}</td><td>${isOverdue(it.dueDate, today) ? "Overdue" : "On track"}</td></tr>`;
    })
    .join("");

  const groups = groupActionItemsByOwner(actionItems);
  const byOwnerHtml = groups
    .map((g) => {
      const items = g.items
        .map((it) => {
          const due = it.dueDate ? ` <em>(due ${esc(it.dueDate)})</em>` : "";
          const overdue = isOverdue(it.dueDate, today) ? ` <strong class="overdue-tag">[OVERDUE]</strong>` : "";
          return `<li>${esc(it.task)}${due}${overdue}</li>`;
        })
        .join("");
      return `<div class="owner-group"><h4>${esc(g.owner)}</h4><ul>${items}</ul></div>`;
    })
    .join("");

  const parkingList = parkingLot.map((p) => `<li>${esc(p)}</li>`).join("");

  const overdueBanner = stats.overdueCount > 0
    ? `<div class="warn">⚠ ${stats.overdueCount} overdue action item${stats.overdueCount === 1 ? "" : "s"} — review and reschedule</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(input.meetingTitle || "Meeting Notes")}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:880px}
  h1{font-size:24px;margin:0 0 4px;color:#111}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:24px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
  h3{font-size:14px;margin:14px 0 6px;color:#222}
  h4{font-size:13px;margin:8px 0 4px;color:#444;font-weight:600}
  .muted{color:#666;font-size:13px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:12px 0;font-size:13px}
  .meta div{padding:2px 0}
  .meta strong{display:inline-block;min-width:90px;color:#555}
  ul{margin:0 0 8px;padding-left:20px;font-size:13px}
  ul li{margin:3px 0}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:left}
  th{background:#f5f5f5;text-transform:uppercase;font-size:11px;letter-spacing:.03em;color:#666}
  tr.overdue td{color:#b91c1c}
  .overdue-tag{color:#b91c1c}
  .warn{background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:8px 12px;border-radius:6px;font-size:13px;margin:8px 0}
  .ok{background:#dcfce7;color:#166534;border:1px solid #86efac;padding:8px 12px;border-radius:6px;font-size:13px;margin:8px 0}
  .owner-group{margin:8px 0;padding-left:12px;border-left:2px solid #e5e7eb}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
  .summary-grid div{background:#fafafa;border:1px solid #eee;padding:8px 10px;border-radius:6px;font-size:12px}
  .summary-grid strong{display:block;font-size:18px;color:#111;margin-top:2px}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>${esc(input.meetingTitle || "Meeting Notes")}</h1>
<div class="muted">${esc(input.meetingDate || "")} · ${esc(input.startTime)} – ${esc(input.endTime)} · ${formatDuration(stats.meetingDurationMinutes)}</div>
<div class="meta">
  ${input.location ? `<div><strong>Location:</strong> ${esc(input.location)}</div>` : ""}
  ${input.facilitator ? `<div><strong>Facilitator:</strong> ${esc(input.facilitator)}</div>` : ""}
  <div><strong>Attendees:</strong> ${attendees.length}</div>
  <div><strong>Decisions:</strong> ${decisions.length}</div>
  <div><strong>Action items:</strong> ${actionItems.length}</div>
  <div><strong>Parking lot:</strong> ${parkingLot.length}</div>
</div>
${overdueBanner}
${attendees.length > 0 ? `<h2>Attendees</h2><ul>${attendeeList}</ul>` : ""}
${recap.length > 0 ? `<h2>Agenda Recap</h2><ul>${recapList}</ul>` : ""}
${decisions.length > 0 ? `<h2>Decisions (${decisions.length})</h2><ul>${decisionList}</ul>` : ""}
${actionItems.length > 0 ? `<h2>Action Items (${actionItems.length})</h2>
<table>
  <thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
  <tbody>${actionRows}</tbody>
</table>
${byOwnerHtml ? `<h3>By Owner</h3>${byOwnerHtml}` : ""}` : ""}
${parkingLot.length > 0 ? `<h2>Parking Lot (${parkingLot.length})</h2><ul>${parkingList}</ul>` : ""}
${input.nextMeetingDate ? `<div class="ok"><strong>Next meeting:</strong> ${esc(input.nextMeetingDate)}</div>` : ""}
<h2>Summary</h2>
<div class="summary-grid">
  <div>Attendees<strong>${stats.attendeeCount}</strong></div>
  <div>Agenda recap<strong>${stats.agendaRecapCount}</strong></div>
  <div>Decisions<strong>${stats.decisionCount}</strong></div>
  <div>Action items<strong>${stats.actionItemCount}</strong></div>
  <div>Overdue<strong>${stats.overdueCount}</strong></div>
  <div>Parking lot<strong>${stats.parkingLotCount}</strong></div>
</div>
</body></html>`;
}

/** Render action items as CSV: task,owner,due_date,status. */
export function renderCsv(actionItems: ActionItem[], today: string): string {
  const lines = ["task,owner,due_date,status"];
  const sorted = sortActionItemsByDueDate(actionItems);
  for (const it of sorted) {
    const status = isOverdue(it.dueDate, today) ? "overdue" : "on-track";
    lines.push(
      [
        escapeCsv(it.task),
        escapeCsv(it.owner),
        escapeCsv(it.dueDate),
        status,
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:meeting-notes-maker:history";
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

export function buildShareUrl(input: Partial<MeetingNotesInput>): string {
  const params = new URLSearchParams();
  if (input.meetingTitle) params.set("title", input.meetingTitle);
  if (input.meetingDate) params.set("date", input.meetingDate);
  if (input.startTime) params.set("start", input.startTime);
  if (input.endTime) params.set("end", input.endTime);
  if (input.location) params.set("loc", input.location);
  if (input.facilitator) params.set("fac", input.facilitator);
  if (input.attendees) params.set("att", input.attendees);
  if (input.agendaRecap) params.set("recap", input.agendaRecap);
  if (input.decisions) params.set("dec", input.decisions);
  if (input.actionItems) params.set("ai", input.actionItems);
  if (input.parkingLot) params.set("park", input.parkingLot);
  if (input.nextMeetingDate) params.set("next", input.nextMeetingDate);
  if (typeof window === "undefined") return `#${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<MeetingNotesInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<MeetingNotesInput> = {};
  if (params.get("title")) out.meetingTitle = params.get("title")!;
  if (params.get("date")) out.meetingDate = params.get("date")!;
  if (params.get("start")) out.startTime = params.get("start")!;
  if (params.get("end")) out.endTime = params.get("end")!;
  if (params.get("loc")) out.location = params.get("loc")!;
  if (params.get("fac")) out.facilitator = params.get("fac")!;
  if (params.get("att")) out.attendees = params.get("att")!;
  if (params.get("recap")) out.agendaRecap = params.get("recap")!;
  if (params.get("dec")) out.decisions = params.get("dec")!;
  if (params.get("ai")) out.actionItems = params.get("ai")!;
  if (params.get("park")) out.parkingLot = params.get("park")!;
  if (params.get("next")) out.nextMeetingDate = params.get("next")!;
  return out;
}
