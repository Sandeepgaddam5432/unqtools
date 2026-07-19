/**
 * History Timeline Maker — pure logic.
 *
 * Parse pipe-separated events, sort, group, color-code, and render
 * as ASCII / HTML / Markdown / CSV timelines. Pure functions only.
 */

export type ColorScheme = "rainbow" | "mono" | "category";
export type SortDirection = "chronological" | "reverse-chronological";

export interface ParsedDate {
  sortKey: number;
  year: number;
  month: number | null;
  day: number | null;
  isBC: boolean;
}

export interface TimelineEvent {
  id: string;
  rawDate: string;
  sortKey: number;
  year: number;
  month: number | null;
  day: number | null;
  isBC: boolean;
  title: string;
  description: string;
  category: string;
  importance: number; // 1-5
}

export interface EventSpan {
  fromId: string;
  toId: string;
  fromDate: string;
  toDate: string;
  days: number;
  years: number;
}

export interface TimelineStats {
  totalEvents: number;
  earliestDate: string;
  latestDate: string;
  spanYears: number;
  byCategory: Record<string, number>;
}

export interface TimelinePreset {
  id: string;
  title: string;
  events: string;
}

// ---------- Color palettes ----------

export const RAINBOW_PALETTE: string[] = [
  "#ff6b6b", "#ffa94d", "#ffd43b", "#a9e34b", "#69db7c",
  "#4dabf7", "#74c0fc", "#b197fc", "#f783ac", "#e599f7",
];

export const MONO_PALETTE: string[] = [
  "#1e3a5f", "#2c5282", "#3182ce", "#4299e1",
  "#63b3ed", "#90cdf4", "#bee3f8",
];

export const CATEGORY_PALETTE: string[] = [
  "#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#319795",
  "#3182ce", "#5a67d8", "#805ad5", "#d53f8c", "#718096",
];

// ---------- Timeline presets ----------

export const TIMELINE_PRESETS: TimelinePreset[] = [
  {
    id: "world-war-2",
    title: "World War II",
    events: [
      "1939-09-01|World War II begins|Germany invades Poland|Military|5",
      "1940-05-10|Battle of France|Germany invades France and Low Countries|Military|4",
      "1940-07-10|Battle of Britain|Air campaign by Luftwaffe against UK|Military|4",
      "1941-06-22|Operation Barbarossa|Germany invades the Soviet Union|Military|5",
      "1941-12-07|Pearl Harbor|Japan attacks US naval base|Military|5",
      "1942-08-23|Battle of Stalingrad|Turning point on Eastern Front|Military|5",
      "1944-06-06|D-Day|Allied invasion of Normandy|Military|5",
      "1945-05-08|VE Day|Victory in Europe, Germany surrenders|Military|5",
      "1945-08-06|Hiroshima|US drops atomic bomb on Hiroshima|Military|5",
      "1945-09-02|Japan surrenders|End of World War II|Military|5",
    ].join("\n"),
  },
  {
    id: "american-revolution",
    title: "American Revolution",
    events: [
      "1775-04-19|Battles of Lexington and Concord|First military engagements of the war|Military|5",
      "1775-06-17|Battle of Bunker Hill|Costly British victory near Boston|Military|4",
      "1776-07-04|Declaration of Independence|Continental Congress adopts Declaration|Political|5",
      "1777-10-17|Battle of Saratoga|American victory, turning point of war|Military|5",
      "1778-02-06|Franco-American Alliance|France enters war on American side|Political|4",
      "1781-10-19|Siege of Yorktown|British surrender, effectively ends war|Military|5",
      "1783-09-03|Treaty of Paris|Great Britain recognizes US independence|Political|5",
      "1787-09-17|US Constitution signed|Constitutional Convention concludes|Political|5",
    ].join("\n"),
  },
  {
    id: "ancient-egypt",
    title: "Ancient Egypt",
    events: [
      "3100 BC|Unification of Egypt|Narmer unites Upper and Lower Egypt|Political|5",
      "2667 BC|Step Pyramid of Djoser|First monumental stone pyramid built|Culture|4",
      "2560 BC|Great Pyramid of Giza|Built for Pharaoh Khufu|Culture|5",
      "1479 BC|Hatshepsut's reign|Female pharaoh rules Egypt|Political|4",
      "1353 BC|Amarna Period|Akhenaten introduces monotheism|Religion|4",
      "1323 BC|Tutankhamun's death|Boy-king buried in Valley of Kings|Political|3",
      "1279 BC|Ramses II's reign|Longest reigning pharaoh of New Kingdom|Political|4",
      "332 BC|Alexander the Great conquers Egypt|Ends Persian rule|Military|5",
      "30 BC|Cleopatra VII dies|End of Ptolemaic dynasty, Rome annexes Egypt|Political|5",
    ].join("\n"),
  },
  {
    id: "renaissance",
    title: "Renaissance",
    events: [
      "1397|Medici Bank founded|Rise of Florentine banking power|Economy|3",
      "1453|Fall of Constantinople|Greek scholars flee to Italy, sparking revival|Military|4",
      "1455|Gutenberg Bible printed|First major book printed with movable type|Culture|5",
      "1492|Columbus reaches the Americas|Voyage funded by Spanish crown|Exploration|5",
      "1503|Mona Lisa painted|Leonardo da Vinci's masterpiece|Culture|5",
      "1508|Sistine Chapel ceiling|Michelangelo paints ceiling|Culture|5",
      "1517|95 Theses|Luther begins Protestant Reformation|Religion|5",
      "1543|Copernicus publishes heliocentric model|On the Revolutions of Heavenly Spheres|Science|5",
      "1610|Galileo discovers Jupiter's moons|Confirms heliocentrism|Science|4",
    ].join("\n"),
  },
];

// ---------- Date parser ----------

/**
 * Parse a date string in one of these formats:
 *   - "1945"          (year only)
 *   - "1945-08"       (year-month)
 *   - "1945-08-06"    (full date)
 *   - "44 BC" / "44 BCE"
 *   - "44 AD" / "44 CE"
 * Returns null on parse failure.
 */
export function parseDate(input: string): ParsedDate | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // BC / BCE
  const bcMatch = raw.match(/^(\d+)\s*(?:BC|BCE)$/i);
  if (bcMatch) {
    const year = parseInt(bcMatch[1], 10);
    // sortKey negative so BC sorts before AD; higher BC year → earlier
    return { sortKey: -(year * 10000), year, month: null, day: null, isBC: true };
  }

  // AD / CE (explicit)
  const adMatch = raw.match(/^(\d+)\s*(?:AD|CE)$/i);
  if (adMatch) {
    const year = parseInt(adMatch[1], 10);
    return { sortKey: year * 10000, year, month: null, day: null, isBC: false };
  }

  // Full ISO date YYYY-MM-DD
  const fullMatch = raw.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
  if (fullMatch) {
    const year = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10);
    const day = parseInt(fullMatch[3], 10);
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    return { sortKey: year * 10000 + month * 100 + day, year, month, day, isBC: false };
  }

  // Year-month YYYY-MM
  const ymMatch = raw.match(/^(\d{1,4})-(\d{1,2})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    if (month < 1 || month > 12) return null;
    return { sortKey: year * 10000 + month * 100, year, month, day: null, isBC: false };
  }

  // Bare year
  const yMatch = raw.match(/^(\d+)$/);
  if (yMatch) {
    const year = parseInt(yMatch[1], 10);
    return { sortKey: year * 10000, year, month: null, day: null, isBC: false };
  }

  return null;
}

/** Format a parsed date back to a readable label. */
export function formatDateLabel(d: ParsedDate, original: string): string {
  if (d.isBC) return `${d.year} BC`;
  if (d.month && d.day) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.day} ${monthNames[d.month - 1]} ${d.year}`;
  }
  if (d.month) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[d.month - 1]} ${d.year}`;
  }
  return original.trim();
}

// ---------- Pipe splitter (supports quoted fields) ----------

/** Split a line on '|', respecting double-quoted fields. */
export function splitPipe(line: string): string[] {
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

// ---------- Event parser ----------

let eventIdCounter = 0;

/** Parse a textarea of events into TimelineEvent[]. */
export function parseEvents(input: string): TimelineEvent[] {
  if (!input) return [];
  const lines = input.split(/\r?\n/);
  const out: TimelineEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = splitPipe(trimmed).map((p) => p.trim());
    if (parts.length < 2) continue;
    const [rawDate, title, desc = "", category = "General", impStr = "3"] = parts;
    const parsed = parseDate(rawDate);
    if (!parsed) continue;
    const importance = clampInt(parseInt(impStr, 10), 1, 5, 3);
    out.push({
      id: `evt-${eventIdCounter++}`,
      rawDate: rawDate.trim(),
      sortKey: parsed.sortKey,
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      isBC: parsed.isBC,
      title: title || "(untitled)",
      description: desc,
      category: category || "General",
      importance,
    });
  }
  return out;
}

// ---------- Sort / group ----------

export function sortEvents(
  events: TimelineEvent[],
  direction: SortDirection = "chronological",
): TimelineEvent[] {
  const sorted = [...events].sort((a, b) => a.sortKey - b.sortKey);
  return direction === "reverse-chronological" ? sorted.reverse() : sorted;
}

export function groupByCategory(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const out = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    if (!out.has(e.category)) out.set(e.category, []);
    out.get(e.category)!.push(e);
  }
  return out;
}

export function getCategories(events: TimelineEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) set.add(e.category);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ---------- Color palettes ----------

export function generateColorPalette(
  categories: string[],
  scheme: ColorScheme,
): Record<string, string> {
  const out: Record<string, string> = {};
  const palette =
    scheme === "mono" ? MONO_PALETTE
      : scheme === "rainbow" ? RAINBOW_PALETTE
        : CATEGORY_PALETTE;
  categories.forEach((cat, i) => {
    out[cat] = palette[i % palette.length];
  });
  return out;
}

export function getColorForCategory(
  category: string,
  palette: Record<string, string>,
): string {
  return palette[category] ?? "#888888";
}

// ---------- Renderers ----------

const STAR_FULL = "★";
const STAR_EMPTY = "☆";

/** Format importance (1-5) as a 5-char star string. */
export function formatImportance(level: number): string {
  const n = clampInt(level, 1, 5, 3);
  return STAR_FULL.repeat(n) + STAR_EMPTY.repeat(5 - n);
}

/** Render a vertical ASCII timeline. */
export function renderAscii(
  events: TimelineEvent[],
  palette: Record<string, string> = {},
): string {
  if (events.length === 0) return "(no events)";
  const lines: string[] = [];
  for (const e of events) {
    const dateLabel = formatDateLabel({ sortKey: e.sortKey, year: e.year, month: e.month, day: e.day, isBC: e.isBC }, e.rawDate);
    const stars = formatImportance(e.importance);
    lines.push(`${dateLabel.padEnd(14)} ● ${e.title} ${stars}`);
    if (e.description) {
      lines.push(`${"".padEnd(14)} ┃   ${e.description}`);
    }
    lines.push(`${"".padEnd(14)} ┃   [category: ${e.category}]`);
    lines.push(`${"".padEnd(14)} ┃`);
  }
  // Drop the trailing separator
  if (lines.length > 0 && lines[lines.length - 1].endsWith("┃")) lines.pop();
  return lines.join("\n");
}

/** Render a compact horizontal ASCII timeline. */
export function renderAsciiHorizontal(events: TimelineEvent[]): string {
  if (events.length === 0) return "(no events)";
  const labels: string[] = [];
  const markers: string[] = [];
  const titles: string[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const lbl = formatDateLabel({ sortKey: e.sortKey, year: e.year, month: e.month, day: e.day, isBC: e.isBC }, e.rawDate);
    labels.push(`[${lbl}]`);
    markers.push(i < events.length - 1 ? "──●──" : "──●");
    const titleShort = e.title.length > 12 ? `${e.title.slice(0, 11)}…` : e.title;
    titles.push(titleShort.padEnd(10).slice(0, 10));
  }
  return [
    labels.join(""),
    "    ".repeat(0) + markers.join(""),
    titles.map((t) => t.padEnd(14).slice(0, 14)).join(""),
  ].join("\n");
}

/** Escape HTML special characters. */
function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render an HTML timeline (printable, vertical). */
export function renderHtml(
  events: TimelineEvent[],
  palette: Record<string, string> = {},
  title: string = "Timeline",
): string {
  const items = events.map((e) => {
    const color = escapeHtml(getColorForCategory(e.category, palette));
    const dateLabel = escapeHtml(formatDateLabel({ sortKey: e.sortKey, year: e.year, month: e.month, day: e.day, isBC: e.isBC }, e.rawDate));
    const stars = escapeHtml(formatImportance(e.importance));
    return [
      `<div class="event" style="border-left: 4px solid ${color}; padding: 8px 12px; margin: 8px 0;">`,
      `  <div class="date" style="font-weight: 600; color: ${color};">${dateLabel}</div>`,
      `  <div class="title" style="font-size: 16px; font-weight: 600; margin: 4px 0;">${escapeHtml(e.title)} <span class="stars" style="color: #f59e0b;">${stars}</span></div>`,
      e.description ? `  <div class="desc" style="color: #4a5568; margin: 4px 0;">${escapeHtml(e.description)}</div>` : "",
      `  <div class="cat" style="font-size: 11px; color: #718096; text-transform: uppercase;">${escapeHtml(e.category)}</div>`,
      `</div>`,
    ].filter(Boolean).join("\n");
  }).join("\n");
  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<title>${escapeHtml(title)}</title>`,
    `<style>`,
    `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #1a202c; }`,
    `h1 { font-size: 24px; margin-bottom: 8px; }`,
    `@media print { body { margin: 0; } }`,
    `</style>`,
    `</head>`,
    `<body>`,
    `<h1>${escapeHtml(title)}</h1>`,
    `<div class="timeline">`,
    items,
    `</div>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}

/** Render a Markdown timeline. */
export function renderMarkdown(
  events: TimelineEvent[],
  title: string = "Timeline",
): string {
  if (events.length === 0) return `# ${title}\n\n_(no events)_`;
  const lines: string[] = [`# ${title}`, ""];
  for (const e of events) {
    const dateLabel = formatDateLabel({ sortKey: e.sortKey, year: e.year, month: e.month, day: e.day, isBC: e.isBC }, e.rawDate);
    const stars = formatImportance(e.importance);
    lines.push(`## ${dateLabel} — ${e.title} ${stars}`);
    lines.push(`*Category: ${e.category}*`);
    lines.push("");
    if (e.description) {
      lines.push(e.description);
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Escape a single CSV cell. */
function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render events as CSV. */
export function renderCsv(events: TimelineEvent[]): string {
  const header = "date,title,description,category,importance";
  if (events.length === 0) return header;
  const lines = [header];
  for (const e of events) {
    lines.push([
      escapeCsv(e.rawDate),
      escapeCsv(e.title),
      escapeCsv(e.description),
      escapeCsv(e.category),
      String(e.importance),
    ].join(","));
  }
  return lines.join("\n");
}

// ---------- Spans ----------

/** Compute span (days/years) between consecutive sorted events. */
export function computeSpans(events: TimelineEvent[]): EventSpan[] {
  if (events.length < 2) return [];
  const sorted = sortEvents(events, "chronological");
  const out: EventSpan[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const days = daysBetween(prev, curr);
    const years = Math.round((days / 365.25) * 10) / 10;
    out.push({
      fromId: prev.id,
      toId: curr.id,
      fromDate: prev.rawDate,
      toDate: curr.rawDate,
      days,
      years,
    });
  }
  return out;
}

/** Approximate days between two events (BC dates use year-only). */
function daysBetween(a: TimelineEvent, b: TimelineEvent): number {
  // Convert each to a pseudo-JDN (Julian Day Number) for sorting purposes.
  const ja = toPseudoJulian(a);
  const jb = toPseudoJulian(b);
  return jb - ja;
}

function toPseudoJulian(e: TimelineEvent): number {
  // For year-only entries use Jan 1 of that year (or BC equivalent).
  // For BC dates, treat as year-only and just use year comparison.
  if (e.isBC) {
    // Use a rough scale: BC year y maps to -y * 365.25
    return -Math.round(e.year * 365.25);
  }
  const y = e.year;
  const m = e.month ?? 1;
  const d = e.day ?? 1;
  // Julian Day Number formula (proleptic Gregorian)
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

// ---------- Stats ----------

export function computeStats(events: TimelineEvent[]): TimelineStats {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      earliestDate: "",
      latestDate: "",
      spanYears: 0,
      byCategory: {},
    };
  }
  const sorted = [...events].sort((a, b) => a.sortKey - b.sortKey);
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const spanYears = Math.abs(latest.year - earliest.year);
  const byCategory: Record<string, number> = {};
  for (const e of events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return {
    totalEvents: events.length,
    earliestDate: earliest.rawDate,
    latestDate: latest.rawDate,
    spanYears,
    byCategory,
  };
}

// ---------- Search ----------

export function searchEvents(events: TimelineEvent[], query: string): TimelineEvent[] {
  if (!query) return events;
  const q = query.toLowerCase().trim();
  return events.filter((e) =>
    e.title.toLowerCase().includes(q)
    || e.description.toLowerCase().includes(q)
    || e.category.toLowerCase().includes(q)
    || e.rawDate.toLowerCase().includes(q),
  );
}

// ---------- Era calculator ----------

/** Compute a human-readable era label from a year. */
export function computeEra(year: number, isBC: boolean): string {
  if (isBC) {
    if (year >= 4000) return "Prehistoric (pre-4000 BC)";
    if (year >= 3000) return "Early Bronze Age";
    if (year >= 2000) return "Middle Bronze Age";
    if (year >= 1000) return "Late Bronze / Iron Age";
    return "Classical Antiquity (BC)";
  }
  const century = Math.floor((year - 1) / 100) + 1;
  const suf = ordinalSuffix(century);
  if (century <= 5) return `Classical Antiquity (${century}${suf} century)`;
  if (century <= 14) return `Middle Ages (${century}${suf} century)`;
  if (century <= 17) return `Renaissance / Early Modern (${century}${suf} century)`;
  if (century === 18) return `Age of Enlightenment (${century}${suf} century)`;
  if (century === 19) return `Industrial Era (${century}${suf} century)`;
  if (century === 20) return `Modern Era (${century}${suf} century)`;
  return `Contemporary (${century}${suf} century)`;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ---------- Presets ----------

export function getPreset(id: string): TimelinePreset | undefined {
  return TIMELINE_PRESETS.find((p) => p.id === id);
}

// ---------- Helpers ----------

function clampInt(v: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:history-timeline-maker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  eventCount: number;
  dateRange: string;
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

// ---------- Shareable URL ----------

export interface ShareParams {
  title: string;
  events: string;
  sortDirection: SortDirection;
  groupByCategory: boolean;
  colorScheme: ColorScheme;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  if (p.title) params.set("title", p.title);
  if (p.events) params.set("events", p.events);
  if (p.sortDirection) params.set("dir", p.sortDirection);
  if (p.groupByCategory) params.set("group", "1");
  if (p.colorScheme) params.set("scheme", p.colorScheme);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const sortDirection = params.get("dir") as SortDirection | null;
  const colorScheme = params.get("scheme") as ColorScheme | null;
  const validDirs: SortDirection[] = ["chronological", "reverse-chronological"];
  const validSchemes: ColorScheme[] = ["rainbow", "mono", "category"];
  return {
    title: params.get("title") ?? "",
    events: params.get("events") ?? "",
    sortDirection: sortDirection && validDirs.includes(sortDirection) ? sortDirection : "chronological",
    groupByCategory: params.get("group") === "1",
    colorScheme: colorScheme && validSchemes.includes(colorScheme) ? colorScheme : "category",
  };
}
