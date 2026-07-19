/**
 * Study Notes Organizer — pure logic.
 *
 * Parse pipe-separated study notes, group by subject/topic, index by tag,
 * full-text search, validate, dedupe, count, render as multiple formats.
 * Pure functions only — no DOM, no network.
 */

export interface StudyNote {
  subject: string;
  topic: string;
  title: string;
  content: string;
  tags: string[];
  date: string; // YYYY-MM-DD
  /** index in the original input (1-based) */
  line: number;
}

export interface NoteValidationIssue {
  line: number;
  reason: "missing-subject" | "missing-title" | "missing-content" | "bad-date";
  message: string;
}

export interface SubjectGroup {
  subject: string;
  notes: StudyNote[];
  topics: TopicGroup[];
}

export interface TopicGroup {
  subject: string;
  topic: string;
  notes: StudyNote[];
}

export interface TagIndexEntry {
  tag: string;
  notes: StudyNote[];
  count: number;
}

export interface NoteCounts {
  total: number;
  bySubject: Record<string, number>;
  byTopic: Record<string, number>; // key: "subject|topic"
  byTag: Record<string, number>;
  totalWords: number;
}

export interface DuplicateGroup {
  subject: string;
  title: string;
  notes: StudyNote[];
  count: number;
}

export interface TagCloudEntry {
  tag: string;
  count: number;
}

export type SortOrder = "newest" | "oldest";

export const FIELD_NAMES = ["subject", "topic", "title", "content", "tags", "date"] as const;
export const MAX_SHARE_NOTES = 50;
export const TAG_CLOUD_LIMIT = 10;

/** Split a pipe-separated line, honoring double-quoted fields that may contain pipes. */
export function splitPipeLine(line: string): string[] {
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
    } else if (ch === "|" && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** Parse tags cell: comma-separated, trimmed, lowercased, deduped. */
export function parseTags(tagsCell: string): string[] {
  if (!tagsCell) return [];
  const tags = tagsCell
    .split(/[,\s]+/)
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

/** Validate a YYYY-MM-DD date string. Returns true if valid or empty. */
export function isValidDate(s: string): boolean {
  if (!s) return true; // empty is OK (date optional)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

/**
 * Parse the full notes textarea. Each non-empty line is one note.
 * Returns the parsed notes + any validation issues.
 */
export function parseNotes(input: string): { notes: StudyNote[]; issues: NoteValidationIssue[] } {
  if (!input) return { notes: [], issues: [] };
  const lines = input.split(/\r?\n/);
  const notes: StudyNote[] = [];
  const issues: NoteValidationIssue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const lineNo = i + 1;
    const parts = splitPipeLine(raw);
    // pad to 6 fields
    while (parts.length < 6) parts.push("");
    const subject = parts[0].trim();
    const topic = parts[1].trim();
    const title = parts[2].trim();
    const content = parts[3].trim();
    const tags = parseTags(parts[4]);
    const date = parts[5].trim();

    if (!subject) {
      issues.push({
        line: lineNo,
        reason: "missing-subject",
        message: `Line ${lineNo}: missing subject`,
      });
    }
    if (!title) {
      issues.push({
        line: lineNo,
        reason: "missing-title",
        message: `Line ${lineNo}: missing title`,
      });
    }
    if (!content) {
      issues.push({
        line: lineNo,
        reason: "missing-content",
        message: `Line ${lineNo}: missing content`,
      });
    }
    if (!isValidDate(date)) {
      issues.push({
        line: lineNo,
        reason: "bad-date",
        message: `Line ${lineNo}: invalid date "${date}" (use YYYY-MM-DD)`,
      });
    }

    notes.push({ subject, topic, title, content, tags, date, line: lineNo });
  }
  return { notes, issues };
}

/** Validate notes — returns notes that pass validation (subject+title+content required, date valid). */
export function validateNotes(notes: StudyNote[]): { valid: StudyNote[]; invalid: StudyNote[] } {
  const valid: StudyNote[] = [];
  const invalid: StudyNote[] = [];
  for (const n of notes) {
    if (n.subject && n.title && n.content && isValidDate(n.date)) {
      valid.push(n);
    } else {
      invalid.push(n);
    }
  }
  return { valid, invalid };
}

/** Group notes by subject. Returns sorted groups (alphabetical by subject). */
export function groupBySubject(notes: StudyNote[]): SubjectGroup[] {
  const map = new Map<string, StudyNote[]>();
  for (const n of notes) {
    const key = n.subject || "(no subject)";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  const out: SubjectGroup[] = [];
  for (const [subject, list] of map) {
    out.push({ subject, notes: list, topics: groupByTopic(list) });
  }
  out.sort((a, b) => a.subject.localeCompare(b.subject));
  return out;
}

/** Group notes by topic (within a subject). Returns sorted groups (alphabetical by topic). */
export function groupByTopic(notes: StudyNote[]): TopicGroup[] {
  const map = new Map<string, StudyNote[]>();
  for (const n of notes) {
    const key = n.topic || "(no topic)";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  const subject = notes[0]?.subject || "";
  const out: TopicGroup[] = [];
  for (const [topic, list] of map) {
    out.push({ subject, topic, notes: list });
  }
  out.sort((a, b) => a.topic.localeCompare(b.topic));
  return out;
}

/** Build tag → notes index. */
export function buildTagIndex(notes: StudyNote[]): TagIndexEntry[] {
  const map = new Map<string, StudyNote[]>();
  for (const n of notes) {
    for (const t of n.tags) {
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(n);
    }
  }
  const out: TagIndexEntry[] = [];
  for (const [tag, list] of map) {
    out.push({ tag, notes: list, count: list.length });
  }
  out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
  return out;
}

/** Case-insensitive search across title + content. */
export function searchNotes(notes: StudyNote[], query: string): StudyNote[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return notes;
  return notes.filter(
    (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
  );
}

/** Combined subject + tag filter. Either may be empty (means "no filter"). */
export function filterNotes(
  notes: StudyNote[],
  subjectFilter: string,
  tagFilter: string,
): StudyNote[] {
  const s = (subjectFilter || "").toLowerCase().trim();
  const t = (tagFilter || "").toLowerCase().trim();
  return notes.filter((n) => {
    if (s && !n.subject.toLowerCase().includes(s)) return false;
    if (t && !n.tags.some((tag) => tag.includes(t))) return false;
    return true;
  });
}

/** Sort notes by date. Newest first by default. Notes with no date go last. */
export function sortByDate(notes: StudyNote[], order: SortOrder = "newest"): StudyNote[] {
  const arr = [...notes];
  arr.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return order === "newest" ? db.localeCompare(da) : da.localeCompare(db);
  });
  return arr;
}

/** Compute counts per subject/topic/tag and total words. */
export function computeCounts(notes: StudyNote[]): NoteCounts {
  const bySubject: Record<string, number> = {};
  const byTopic: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let totalWords = 0;
  for (const n of notes) {
    const s = n.subject || "(no subject)";
    bySubject[s] = (bySubject[s] || 0) + 1;
    const tKey = `${n.subject || "(no subject)"}|${n.topic || "(no topic)"}`;
    byTopic[tKey] = (byTopic[tKey] || 0) + 1;
    for (const tag of n.tags) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
    totalWords += n.content.split(/\s+/).filter(Boolean).length;
    totalWords += n.title.split(/\s+/).filter(Boolean).length;
  }
  return { total: notes.length, bySubject, byTopic, byTag, totalWords };
}

/** Generate tag cloud — top N tags by frequency. */
export function generateTagCloud(notes: StudyNote[], limit = TAG_CLOUD_LIMIT): TagCloudEntry[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const arr: TagCloudEntry[] = [];
  for (const [tag, count] of counts) {
    arr.push({ tag, count });
  }
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
  return arr.slice(0, limit);
}

/** Find duplicate notes — same subject + title (case-insensitive). */
export function findDuplicates(notes: StudyNote[]): DuplicateGroup[] {
  const map = new Map<string, StudyNote[]>();
  for (const n of notes) {
    const key = `${(n.subject || "").toLowerCase()}|${(n.title || "").toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  const out: DuplicateGroup[] = [];
  for (const [key, list] of map) {
    if (list.length < 2) continue;
    const [subject, title] = key.split("|");
    out.push({ subject, title, notes: list, count: list.length });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// ---- Renderers ----

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCsvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render notes as plain text — grouped by subject → topic. */
export function renderText(notes: StudyNote[]): string {
  if (notes.length === 0) return "";
  const groups = groupBySubject(notes);
  const lines: string[] = [];
  for (const sg of groups) {
    lines.push(`=== ${sg.subject} (${sg.notes.length}) ===`);
    for (const tg of sg.topics) {
      lines.push(`  -- ${tg.topic || "(no topic)"} (${tg.notes.length}) --`);
      for (const n of tg.notes) {
        lines.push(`    • ${n.title}`);
        if (n.content) lines.push(`      ${n.content.replace(/\n/g, "\n      ")}`);
        if (n.tags.length > 0) lines.push(`      [tags: ${n.tags.join(", ")}]`);
        if (n.date) lines.push(`      [date: ${n.date}]`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render notes as printable HTML with a table of contents. */
export function renderHtml(notes: StudyNote[]): string {
  if (notes.length === 0) return "<!doctype html><html><body><p>No notes.</p></body></html>";
  const groups = groupBySubject(notes);
  const toc: string[] = [`<ul>`];
  const body: string[] = [];
  for (const sg of groups) {
    const sid = `subject-${sg.subject.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
    toc.push(`<li><a href="#${sid}">${escapeHtml(sg.subject)} (${sg.notes.length})</a><ul>`);
    for (const tg of sg.topics) {
      const tid = `${sid}-topic-${tg.topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      toc.push(`<li><a href="#${tid}">${escapeHtml(tg.topic || "(no topic)")} (${tg.notes.length})</a></li>`);
    }
    toc.push(`</ul></li>`);
    body.push(`<h2 id="${sid}">${escapeHtml(sg.subject)} <small>(${sg.notes.length})</small></h2>`);
    for (const tg of sg.topics) {
      const tid = `${sid}-topic-${tg.topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      body.push(`<h3 id="${tid}">${escapeHtml(tg.topic || "(no topic)")}</h3>`);
      for (const n of tg.notes) {
        body.push(`<div class="note">`);
        body.push(`<h4>${escapeHtml(n.title)}</h4>`);
        if (n.content) body.push(`<p>${escapeHtml(n.content).replace(/\n/g, "<br/>")}</p>`);
        if (n.tags.length > 0) {
          body.push(`<p class="tags">Tags: ${n.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</p>`);
        }
        if (n.date) body.push(`<p class="date">Date: ${escapeHtml(n.date)}</p>`);
        body.push(`</div>`);
      }
    }
  }
  toc.push(`</ul>`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Study Notes</title>
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#222}
h2{border-bottom:2px solid #ddd;padding-bottom:.25rem}
h3{color:#555;margin-top:1.5rem}
.note{margin:1rem 0;padding:.75rem;border-left:3px solid #4a90e2;background:#fafafa}
.tag{display:inline-block;background:#eef;padding:0 .35rem;margin:0 .1rem;border-radius:3px;font-size:.85em}
.toc{background:#f5f5f5;padding:1rem;border-radius:6px;margin-bottom:2rem}
.toc ul{margin:.25rem 0;padding-left:1.25rem}
@media print{.toc{display:none}}
</style>
</head>
<body>
<h1>Study Notes</h1>
<div class="toc"><strong>Contents</strong>${toc.join("")}</div>
${body.join("\n")}
</body>
</html>`;
}

/** Render notes as Markdown with headers per subject → topic → note. */
export function renderMarkdown(notes: StudyNote[]): string {
  if (notes.length === 0) return "";
  const groups = groupBySubject(notes);
  const lines: string[] = [`# Study Notes`, ``];
  for (const sg of groups) {
    lines.push(`## ${sg.subject} (${sg.notes.length})`, ``);
    for (const tg of sg.topics) {
      lines.push(`### ${tg.topic || "(no topic)"}`, ``);
      for (const n of tg.notes) {
        lines.push(`#### ${n.title}`, ``);
        if (n.content) {
          lines.push(n.content, ``);
        }
        if (n.tags.length > 0) {
          lines.push(`**Tags:** ${n.tags.map((t) => `\`${t}\``).join(", ")}`, ``);
        }
        if (n.date) {
          lines.push(`**Date:** ${n.date}`, ``);
        }
        lines.push(`---`, ``);
      }
    }
  }
  return lines.join("\n");
}

/** Render notes as CSV. */
export function renderCsv(notes: StudyNote[]): string {
  const lines = ["subject,topic,title,content,tags,date"];
  for (const n of notes) {
    lines.push([
      escapeCsvField(n.subject),
      escapeCsvField(n.topic),
      escapeCsvField(n.title),
      escapeCsvField(n.content),
      escapeCsvField(n.tags.join(",")),
      escapeCsvField(n.date),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render notes as JSON (for import into Notion/Obsidian). */
export function renderJson(notes: StudyNote[]): string {
  const groups = groupBySubject(notes);
  const obj = {
    exportedAt: new Date().toISOString(),
    totalNotes: notes.length,
    subjects: groups.map((sg) => ({
      subject: sg.subject,
      noteCount: sg.notes.length,
      topics: sg.topics.map((tg) => ({
        topic: tg.topic,
        noteCount: tg.notes.length,
        notes: tg.notes.map((n) => ({
          title: n.title,
          content: n.content,
          tags: n.tags,
          date: n.date,
        })),
      })),
    })),
  };
  return JSON.stringify(obj, null, 2);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:study-notes-organizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  noteCount: number;
  subjectCount: number;
  preview: string; // first 200 chars of input
}

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

// ---- Shareable URL (encode up to MAX_SHARE_NOTES in hash) ----

export function buildShareUrl(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const { notes } = parseNotes(trimmed);
  const limited = notes.slice(0, MAX_SHARE_NOTES);
  // Encode as JSON base64
  const payload = JSON.stringify(limited.map((n) => ({
    s: n.subject,
    t: n.topic,
    ti: n.title,
    c: n.content,
    tg: n.tags,
    d: n.date,
  })));
  const encoded = encodeURIComponent(payload);
  const params = new URLSearchParams();
  params.set("n", encoded);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { notes: StudyNote[]; raw: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { notes: [], raw: "" };
  const params = new URLSearchParams(clean);
  const encoded = params.get("n");
  if (!encoded) return { notes: [], raw: "" };
  try {
    const payload = JSON.parse(decodeURIComponent(encoded)) as Array<{
      s: string; t: string; ti: string; c: string; tg: string[]; d: string;
    }>;
    const notes: StudyNote[] = payload.map((p, i) => ({
      subject: p.s || "",
      topic: p.t || "",
      title: p.ti || "",
      content: p.c || "",
      tags: Array.isArray(p.tg) ? p.tg : [],
      date: p.d || "",
      line: i + 1,
    }));
    // Reconstruct the raw pipe-separated input
    const raw = notes
      .map((n) => {
        const content = n.content.includes("|") ? `"${n.content}"` : n.content;
        return [n.subject, n.topic, n.title, content, n.tags.join(","), n.date].join("|");
      })
      .join("\n");
    return { notes, raw };
  } catch {
    return { notes: [], raw: "" };
  }
}
