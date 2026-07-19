/**
 * AI Citation Formatter — pure logic.
 *
 * Format citations in APA 7, MLA 9, Chicago, Harvard, and IEEE styles for
 * books, journal articles, websites, and newspapers. Pure functions only —
 * no DOM, no network. The optional LLM call (BYO API key) lives in ui.tsx.
 *
 * Honesty: auto-filled metadata is often incomplete/incorrect — the tool
 * flags uncertain fields and urges verification (per Purdue OWL). Citation
 * formatting runs entirely offline; no metadata lookup is performed.
 */

// ---------- Types ----------

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard" | "ieee";
export type SourceType = "book" | "journal" | "website" | "newspaper";

export interface Author {
  first: string;
  last: string;
  middle?: string;
}

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  authors: Author[];
  year: string;
  // book
  publisher?: string;
  edition?: string;
  city?: string;
  isbn?: string;
  // journal
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  // website / newspaper
  siteName?: string;
  url?: string;
  accessedDate?: string; // ISO YYYY-MM-DD
  publishedDate?: string; // ISO YYYY-MM-DD
  // newspaper
  newspaper?: string;
  section?: string;
}

export interface FormattedCitation {
  id: string;
  style: CitationStyle;
  type: SourceType;
  reference: string;       // full reference-list entry
  inText: string;          // in-text citation
  bibtexKey: string;       // unique BibTeX key
  warnings: string[];      // field-level verify-this flags
}

export interface LibraryEntry {
  source: Source;
  ts: number;
}

export interface HistoryEntry {
  ts: number;
  style: CitationStyle;
  type: SourceType;
  title: string;
}

export interface LlmEnhancement {
  refinedTitle: string;
  suggestedAuthors: string[];
  notes: string[];
  missingFields: string[];
}

export interface ShareState {
  source?: Partial<Source>;
  style?: CitationStyle;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-citation-formatter:history";
export const LIBRARY_KEY = "unqtools:ai-citation-formatter:library";
export const HISTORY_MAX = 20;
export const LIBRARY_MAX = 200;
export const LLM_KEY_STORAGE = "unqtools:ai-citation-formatter:llm-key";

export const STYLE_LABELS: Record<CitationStyle, string> = {
  apa: "APA 7th edition",
  mla: "MLA 9th edition",
  chicago: "Chicago (notes-bibliography)",
  harvard: "Harvard (author-date)",
  ieee: "IEEE (numeric)",
};

export const TYPE_LABELS: Record<SourceType, string> = {
  book: "Book",
  journal: "Journal article",
  website: "Website / web page",
  newspaper: "Newspaper article",
};

export const DEFAULT_STYLE: CitationStyle = "apa";
export const DEFAULT_TYPE: SourceType = "journal";

// ---------- Author parsing ----------

/** Parse an author string into a structured Author. Accepts "Last, First" or "First Last". */
export function parseAuthor(s: string): Author {
  const trimmed = (s || "").trim();
  if (!trimmed) return { first: "", last: "" };
  if (trimmed.includes(",")) {
    const [last, rest] = trimmed.split(",", 2).map((x) => x.trim());
    const parts = (rest || "").split(/\s+/).filter(Boolean);
    return {
      last: last || "",
      first: parts[0] ?? "",
      middle: parts.slice(1).join(" ") || undefined,
    };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: "", last: parts[0] };
  return {
    last: parts[parts.length - 1],
    first: parts[0],
    middle: parts.slice(1, -1).join(" ") || undefined,
  };
}

/** Parse a multi-author string (one author per line, or separated by ';'). */
export function parseAuthors(s: string): Author[] {
  return (s || "")
    .split(/[\n;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(parseAuthor);
}

/** Format an author as "Last, F. M." (APA / Harvard style initials). */
export function formatAuthorInitials(a: Author): string {
  if (!a.last) return "";
  const firstI = a.first ? `${a.first.charAt(0).toUpperCase()}.` : "";
  const middleI = a.middle ? ` ${a.middle.charAt(0).toUpperCase()}.` : "";
  if (!firstI && !middleI) return a.last;
  return `${a.last}, ${firstI}${middleI}`;
}

/** Format an author as "First Last" (full name). */
export function formatAuthorFull(a: Author): string {
  const parts = [a.first, a.middle, a.last].filter(Boolean);
  return parts.join(" ");
}

/** Format an author as "Last, First" (MLA style). */
export function formatAuthorLastFirst(a: Author): string {
  if (!a.last) return "";
  if (!a.first) return a.last;
  const middle = a.middle ? ` ${a.middle}` : "";
  return `${a.last}, ${a.first}${middle}`;
}

/** Format a list of authors per APA rules: "A, B, & C." (≤20 listed; >20 uses et al.). */
export function formatAuthorsApa(authors: Author[]): string {
  const list = authors.filter((a) => a.last);
  if (list.length === 0) return "";
  if (list.length > 20) {
    return `${formatAuthorInitials(list[0])} et al.`;
  }
  const formatted = list.map(formatAuthorInitials);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

/** Format authors per MLA: "Last1, First1, and First2 Last2." (3+ → et al.). */
export function formatAuthorsMla(authors: Author[]): string {
  const list = authors.filter((a) => a.last);
  if (list.length === 0) return "";
  if (list.length >= 3) {
    return `${formatAuthorLastFirst(list[0])}, et al.`;
  }
  if (list.length === 1) return formatAuthorLastFirst(list[0]);
  // 2 authors: "Last1, First1, and First2 Last2."
  return `${formatAuthorLastFirst(list[0])}, and ${formatAuthorFull(list[1])}`;
}

/** Format authors per Chicago: "Last1, First1, and First2 Last2." (4+ → et al.). */
export function formatAuthorsChicago(authors: Author[]): string {
  const list = authors.filter((a) => a.last);
  if (list.length === 0) return "";
  if (list.length >= 4) {
    return `${formatAuthorLastFirst(list[0])} et al.`;
  }
  if (list.length === 1) return formatAuthorLastFirst(list[0]);
  if (list.length === 2) {
    return `${formatAuthorLastFirst(list[0])}, and ${formatAuthorFull(list[1])}`;
  }
  // 3 authors
  return `${formatAuthorLastFirst(list[0])}, ${formatAuthorFull(list[1])}, and ${formatAuthorFull(list[2])}`;
}

/** Format authors per Harvard: "Last, F. and Last, F." (4+ → et al.). */
export function formatAuthorsHarvard(authors: Author[]): string {
  const list = authors.filter((a) => a.last);
  if (list.length === 0) return "";
  if (list.length >= 4) {
    return `${formatAuthorInitials(list[0])} et al.`;
  }
  const formatted = list.map(formatAuthorInitials);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, and ${formatted[formatted.length - 1]}`;
}

/** Format authors per IEEE: "F. Last, F. Last, and F. Last" (≥6 → et al.). */
export function formatAuthorsIeee(authors: Author[]): string {
  const list = authors.filter((a) => a.last);
  if (list.length === 0) return "";
  if (list.length > 6) {
    return `${ieeeInitialsName(list[0])} et al.`;
  }
  const formatted = list.map(ieeeInitialsName);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, and ${formatted[formatted.length - 1]}`;
}

function ieeeInitialsName(a: Author): string {
  const firstI = a.first ? `${a.first.charAt(0).toUpperCase()}.` : "";
  const middleI = a.middle ? ` ${a.middle.charAt(0).toUpperCase()}.` : "";
  const initials = `${firstI}${middleI}`.trim();
  return initials ? `${initials} ${a.last}` : a.last;
}

// ---------- Validation ----------

/** Validate DOI format. */
export function isValidDoi(s: string): boolean {
  return /^10\.\d{4,9}\/[^\s]+$/i.test((s || "").trim());
}

/** Validate ISBN-10 or ISBN-13 (with or without hyphens). */
export function isValidIsbn(s: string): boolean {
  const clean = (s || "").replace(/[-\s]/g, "").replace(/X$/i, "X");
  if (/^\d{10}X?$/.test(clean)) return true; // ISBN-10
  if (/^\d{13}$/.test(clean)) return true;   // ISBN-13
  return false;
}

/** Basic URL validator. */
export function isValidUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validate the source and produce warnings (low-confidence field flags). */
export function validateSource(source: Source): string[] {
  const out: string[] = [];
  if (!source.title.trim()) out.push("Title is missing — verify.");
  if (source.authors.length === 0) out.push("No authors listed — verify (or use 'Anonymous').");
  if (!source.year.trim()) out.push("Year is missing — verify.");
  if (source.type === "book" && !source.publisher?.trim()) {
    out.push("Publisher is missing for a book — verify.");
  }
  if (source.type === "journal" && !source.journal?.trim()) {
    out.push("Journal name is missing — verify.");
  }
  if (source.type === "journal" && !source.volume?.trim()) {
    out.push("Volume is missing for a journal article — verify.");
  }
  if (source.type === "journal" && !source.pages?.trim()) {
    out.push("Page range is missing — verify.");
  }
  if (source.doi && !isValidDoi(source.doi)) {
    out.push(`DOI "${source.doi}" does not match the expected format (10.xxxx/...).`);
  }
  if (source.isbn && !isValidIsbn(source.isbn)) {
    out.push(`ISBN "${source.isbn}" is not a valid ISBN-10 or ISBN-13.`);
  }
  if (source.url && !isValidUrl(source.url)) {
    out.push(`URL "${source.url}" is not a valid http(s) URL.`);
  }
  if (source.type === "website" && !source.url?.trim()) {
    out.push("URL is missing for a website source — verify.");
  }
  if (source.type === "newspaper" && !source.newspaper?.trim()) {
    out.push("Newspaper name is missing — verify.");
  }
  return out;
}

// ---------- Page range / date formatting ----------

/** Format a page range per style (APA: "pp. 12–34"; MLA: "pp. 12–34"; Chicago: "12–34"; IEEE: "pp. 12–34"). */
export function formatPageRange(pages: string, style: CitationStyle): string {
  const clean = (pages || "").trim();
  if (!clean) return "";
  // En-dash for ranges (already en-dash or hyphen → en-dash)
  const normalized = clean.replace(/\s*-\s*/g, "–").replace(/–+/g, "–");
  switch (style) {
    case "apa":
    case "mla":
    case "harvard":
    case "ieee":
      return `pp. ${normalized}`;
    case "chicago":
      return normalized;
  }
}

/** Format an ISO date (YYYY-MM-DD) per style. */
export function formatDate(iso: string | undefined, style: CitationStyle): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const monthAbbr = ["Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.",
    "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
  const monthIdx = mo ? parseInt(mo, 10) - 1 : -1;
  const day = d ? parseInt(d, 10) : NaN;
  switch (style) {
    case "apa":
      if (monthIdx >= 0 && !isNaN(day)) return `${y}, ${months[monthIdx]} ${day}`;
      if (monthIdx >= 0) return `${y}, ${months[monthIdx]}`;
      return y;
    case "mla":
      if (monthIdx >= 0 && !isNaN(day)) return `${day} ${months[monthIdx]} ${y}`;
      if (monthIdx >= 0) return `${months[monthIdx]} ${y}`;
      return y;
    case "chicago":
      if (monthIdx >= 0 && !isNaN(day)) return `${monthAbbr[monthIdx]} ${day}, ${y}`;
      if (monthIdx >= 0) return `${monthAbbr[monthIdx]} ${y}`;
      return y;
    case "harvard":
      if (monthIdx >= 0 && !isNaN(day)) return `${day} ${months[monthIdx]} ${y}`;
      if (monthIdx >= 0) return `${months[monthIdx]} ${y}`;
      return y;
    case "ieee":
      if (monthIdx >= 0 && !isNaN(day)) return `${day} ${monthAbbr[monthIdx]} ${y}`;
      if (monthIdx >= 0) return `${monthAbbr[monthIdx]} ${y}`;
      return y;
  }
}

/** Format the year for in-text citations (handles missing year → "n.d."). */
export function formatYear(year: string): string {
  const y = (year || "").trim();
  return y || "n.d.";
}

// ---------- BibTeX key generator ----------

let bibKeyCounter = 0;
export function generateBibtexKey(source: Source): string {
  const last = source.authors[0]?.last || "anon";
  const slug = last.toLowerCase().replace(/[^a-z]+/g, "");
  const year = (source.year || "nd").replace(/[^0-9a-z]+/gi, "");
  const base = `${slug}${year}`;
  // Disambiguate when multiple entries share a base key — uses an in-memory counter
  // plus a hash of the title for stability across calls within a session.
  const titleHash = hashString(source.title + source.id).toString(36).slice(0, 4);
  bibKeyCounter += 1;
  return `${base}_${titleHash}_${bibKeyCounter}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// ---------- Per-style formatters ----------

/** Format the full reference-list entry for a source in a given style. */
export function formatReference(source: Source, style: CitationStyle): string {
  switch (style) {
    case "apa": return formatApa(source);
    case "mla": return formatMla(source);
    case "chicago": return formatChicago(source);
    case "harvard": return formatHarvard(source);
    case "ieee": return formatIeee(source);
  }
}

/** Format the in-text citation for a source in a given style. */
export function formatInText(source: Source, style: CitationStyle): string {
  switch (style) {
    case "apa": return inTextApa(source);
    case "mla": return inTextMla(source);
    case "chicago": return inTextChicago(source);
    case "harvard": return inTextHarvard(source);
    case "ieee": return inTextIeee(source);
  }
}

// ---------- APA 7 ----------

function formatApa(s: Source): string {
  const parts: string[] = [];
  const authors = formatAuthorsApa(s.authors);
  if (authors) parts.push(authors + ".");
  parts.push(`(${formatYear(s.year)}).`);
  if (s.type === "book") {
    parts.push(italicize(s.title) + ".");
    if (s.edition) parts.push(`(${s.edition} ed.).`);
    if (s.publisher) parts.push(s.publisher + ".");
    if (s.doi) parts.push(`https://doi.org/${s.doi}`);
  } else if (s.type === "journal") {
    parts.push(s.title + ".");
    if (s.journal) parts.push(italicize(s.journal) + ",");
    const vol = s.volume ? italicize(s.volume) : "";
    const iss = s.issue ? `(${s.issue})` : "";
    const pages = s.pages ? `, ${formatPageRange(s.pages, "apa")}` : "";
    if (vol || iss || pages) parts.push(`${vol}${iss}${pages}.`);
    if (s.doi) parts.push(`https://doi.org/${s.doi}`);
  } else if (s.type === "website") {
    parts.push(italicize(s.title) + ".");
    if (s.siteName) parts.push(s.siteName + ".");
    if (s.publishedDate) parts.push(`Published ${formatDate(s.publishedDate, "apa")}.`);
    if (s.url) parts.push(s.url);
    if (s.accessedDate) parts.push(`(Retrieved ${formatDate(s.accessedDate, "apa")})`);
  } else if (s.type === "newspaper") {
    parts.push(italicize(s.title) + ".");
    if (s.newspaper) parts.push(italicize(s.newspaper) + ".");
    if (s.publishedDate) parts.push(formatDate(s.publishedDate, "apa") + ".");
    if (s.pages) parts.push(formatPageRange(s.pages, "apa") + ".");
    if (s.url) parts.push(s.url);
  }
  return parts.join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+,/g, ",");
}

function inTextApa(s: Source): string {
  const authors = s.authors.filter((a) => a.last);
  let authorPart: string;
  if (authors.length === 0) authorPart = "Anonymous";
  else if (authors.length === 1) authorPart = authors[0].last;
  else if (authors.length === 2) authorPart = `${authors[0].last} & ${authors[1].last}`;
  else authorPart = `${authors[0].last} et al.`;
  const year = formatYear(s.year);
  // APA in-text default is just (Author, year). Page numbers are added only for direct quotes.
  return `(${authorPart}, ${year})`;
}

// ---------- MLA 9 ----------

function formatMla(s: Source): string {
  const parts: string[] = [];
  const authors = formatAuthorsMla(s.authors);
  if (authors) parts.push(authors + ".");
  parts.push(`"${s.title}."`);
  if (s.type === "book") {
    if (s.edition) parts.push(`${s.edition} ed.,`);
    if (s.publisher) parts.push(s.publisher + ",");
    if (s.year) parts.push(s.year + ".");
  } else if (s.type === "journal") {
    if (s.journal) parts.push(italicize(s.journal) + ",");
    if (s.volume) parts.push(`vol. ${s.volume},`);
    if (s.issue) parts.push(`no. ${s.issue},`);
    if (s.year) parts.push(s.year + ",");
    if (s.pages) parts.push(`pp. ${s.pages.replace(/\s*-\s*/g, "–")}.`);
    if (s.doi) parts.push(`https://doi.org/${s.doi}.`);
  } else if (s.type === "website") {
    if (s.siteName) parts.push(italicize(s.siteName) + ",");
    if (s.publishedDate) parts.push(`${formatDate(s.publishedDate, "mla")},`);
    if (s.url) parts.push(s.url + ".");
    if (s.accessedDate) parts.push(`Accessed ${formatDate(s.accessedDate, "mla")}.`);
  } else if (s.type === "newspaper") {
    if (s.newspaper) parts.push(italicize(s.newspaper) + ",");
    if (s.publishedDate) parts.push(`${formatDate(s.publishedDate, "mla")},`);
    if (s.pages) parts.push(`pp. ${s.pages.replace(/\s*-\s*/g, "–")}.`);
    if (s.url) parts.push(s.url + ".");
  }
  return parts.join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+,/g, ",");
}

function inTextMla(s: Source): string {
  const authors = s.authors.filter((a) => a.last);
  let authorPart: string;
  if (authors.length === 0) authorPart = "Anonymous";
  else if (authors.length === 1) authorPart = authors[0].last;
  else if (authors.length === 2) authorPart = `${authors[0].last} and ${authors[1].last}`;
  else authorPart = `${authors[0].last} et al.`;
  const page = s.pages ? ` ${s.pages.split(/[-–]/)[0].trim()}` : "";
  return `(${authorPart}${page})`;
}

// ---------- Chicago (notes-bibliography) ----------

function formatChicago(s: Source): string {
  const parts: string[] = [];
  const authors = formatAuthorsChicago(s.authors);
  if (authors) parts.push(authors + ".");
  if (s.type === "book") {
    parts.push(italicize(s.title) + ".");
    if (s.edition) parts.push(`${s.edition} ed.`);
    if (s.city) parts.push(s.city + ":");
    if (s.publisher) parts.push(s.publisher + ",");
    if (s.year) parts.push(s.year + ".");
  } else if (s.type === "journal") {
    parts.push(`"${s.title}."`);
    if (s.journal) parts.push(italicize(s.journal) + " ");
    if (s.volume) parts.push(`${s.volume},`);
    if (s.issue) parts.push(`no. ${s.issue} (`);
    if (s.year) parts.push(s.year + (s.issue ? "):" : ","));
    if (s.pages) parts.push(`${formatPageRange(s.pages, "chicago")}.`);
    if (s.doi) parts.push(`https://doi.org/${s.doi}.`);
  } else if (s.type === "website") {
    parts.push(`"${s.title}."`);
    if (s.siteName) parts.push(italicize(s.siteName) + ".");
    if (s.publishedDate) parts.push(formatDate(s.publishedDate, "chicago") + ".");
    if (s.url) parts.push(s.url + ".");
  } else if (s.type === "newspaper") {
    parts.push(`"${s.title}."`);
    if (s.newspaper) parts.push(italicize(s.newspaper) + ",");
    if (s.publishedDate) parts.push(formatDate(s.publishedDate, "chicago") + ".");
    if (s.section) parts.push(`Sec. ${s.section}.`);
    if (s.url) parts.push(s.url + ".");
  }
  return parts.join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+,/g, ",");
}

function inTextChicago(s: Source): string {
  const authors = s.authors.filter((a) => a.last);
  let authorPart: string;
  if (authors.length === 0) authorPart = "Anonymous";
  else if (authors.length === 1) authorPart = authors[0].last;
  else if (authors.length === 2) authorPart = `${authors[0].last} and ${authors[1].last}`;
  else authorPart = `${authors[0].last} et al.`;
  const year = formatYear(s.year);
  const page = s.pages ? `, ${s.pages.split(/[-–]/)[0].trim()}` : "";
  return `(${authorPart} ${year}${page})`;
}

// ---------- Harvard (author-date) ----------

function formatHarvard(s: Source): string {
  const parts: string[] = [];
  const authors = formatAuthorsHarvard(s.authors);
  if (authors) parts.push(authors + ".");
  parts.push(`(${formatYear(s.year)}).`);
  if (s.type === "book") {
    parts.push(italicize(s.title) + ".");
    if (s.edition) parts.push(`${s.edition} edn.`);
    if (s.publisher) parts.push(s.publisher + ".");
  } else if (s.type === "journal") {
    parts.push(`'${s.title}',`);
    if (s.journal) parts.push(italicize(s.journal) + ",");
    if (s.volume) parts.push(`vol. ${s.volume},`);
    if (s.issue) parts.push(`no. ${s.issue},`);
    if (s.pages) parts.push(`pp. ${s.pages.replace(/\s*-\s*/g, "–")}.`);
    if (s.doi) parts.push(`https://doi.org/${s.doi}.`);
  } else if (s.type === "website") {
    parts.push(italicize(s.title) + ".");
    if (s.siteName) parts.push(s.siteName + ".");
    if (s.publishedDate) parts.push(`Available at: ${s.url || "(URL missing)"} (Accessed: ${formatDate(s.accessedDate || s.publishedDate, "harvard")}).`);
    else if (s.url) parts.push(`Available at: ${s.url} (Accessed: ${formatDate(s.accessedDate, "harvard")}).`);
  } else if (s.type === "newspaper") {
    parts.push(`'${s.title}',`);
    if (s.newspaper) parts.push(italicize(s.newspaper) + ",");
    if (s.publishedDate) parts.push(formatDate(s.publishedDate, "harvard") + ",");
    if (s.pages) parts.push(`pp. ${s.pages.replace(/\s*-\s*/g, "–")}.`);
    if (s.url) parts.push(`Available at: ${s.url} (Accessed: ${formatDate(s.accessedDate || s.publishedDate, "harvard")}).`);
  }
  return parts.join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+,/g, ",");
}

function inTextHarvard(s: Source): string {
  const authors = s.authors.filter((a) => a.last);
  let authorPart: string;
  if (authors.length === 0) authorPart = "Anonymous";
  else if (authors.length === 1) authorPart = authors[0].last;
  else if (authors.length === 2) authorPart = `${authors[0].last} and ${authors[1].last}`;
  else authorPart = `${authors[0].last} et al.`;
  const year = formatYear(s.year);
  const page = s.pages ? `, p. ${s.pages.split(/[-–]/)[0].trim()}` : "";
  return `(${authorPart}, ${year}${page})`;
}

// ---------- IEEE (numeric) ----------

let ieeeCounter = 0;
export function resetIeeeCounter(): void {
  ieeeCounter = 0;
}

function formatIeee(s: Source): string {
  ieeeCounter += 1;
  const refNum = ieeeCounter;
  const parts: string[] = [];
  parts.push(`[${refNum}]`);
  const authors = formatAuthorsIeee(s.authors);
  if (authors) parts.push(authors + ",");
  if (s.type === "book") {
    parts.push(italicize(s.title) + ".");
    if (s.edition) parts.push(`${s.edition} ed.`);
    if (s.city) parts.push(s.city + ":");
    if (s.publisher) parts.push(s.publisher + ",");
    if (s.year) parts.push(s.year + ".");
  } else if (s.type === "journal") {
    parts.push(`"${s.title},"`);
    if (s.journal) parts.push(italicize(s.journal) + ",");
    if (s.volume) parts.push(`vol. ${s.volume},`);
    if (s.issue) parts.push(`no. ${s.issue},`);
    if (s.pages) parts.push(`pp. ${s.pages.replace(/\s*-\s*/g, "–")},`);
    if (s.year) parts.push(s.year + ".");
    if (s.doi) parts.push(`doi: ${s.doi}.`);
  } else if (s.type === "website") {
    parts.push(`"${s.title}."`);
    if (s.siteName) parts.push(italicize(s.siteName) + ".");
    if (s.url) parts.push(`[Online]. Available: ${s.url}.`);
    if (s.accessedDate) parts.push(`(Accessed: ${formatDate(s.accessedDate, "ieee")}).`);
  } else if (s.type === "newspaper") {
    parts.push(`"${s.title},"`);
    if (s.newspaper) parts.push(italicize(s.newspaper) + ",");
    if (s.publishedDate) parts.push(formatDate(s.publishedDate, "ieee") + ".");
    if (s.url) parts.push(`[Online]. Available: ${s.url}.`);
  }
  return parts.join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+,/g, ",");
}

function inTextIeee(_s: Source): string {
  // IEEE in-text citations reference the entry number assigned during bibliography formatting.
  // We use the current counter as a best-effort placeholder — the UI replaces this with the
  // real entry number when the bibliography is rendered.
  return `[${ieeeCounter}]`;
}

// ---------- Top-level formatter ----------

/** Format a single source as a complete citation entry (reference + in-text + warnings + key). */
export function formatCitation(source: Source, style: CitationStyle): FormattedCitation {
  const warnings = validateSource(source);
  const reference = formatReference(source, style);
  // For IEEE in-text, reset + re-run so the counter matches what a single-entry bibliography would produce.
  let inText: string;
  if (style === "ieee") {
    resetIeeeCounter();
    formatReference(source, style); // assigns [1]
    inText = "[1]";
  } else {
    inText = formatInText(source, style);
  }
  return {
    id: source.id,
    style,
    type: source.type,
    reference,
    inText,
    bibtexKey: generateBibtexKey(source),
    warnings,
  };
}

/** Format a list of sources as a bibliography (each numbered for IEEE, plain for others). */
export function formatBibliography(sources: Source[], style: CitationStyle): FormattedCitation[] {
  if (style === "ieee") resetIeeeCounter();
  return sources.map((s) => formatCitation(s, style));
}

// ---------- Sorting ----------

export type SortMode = "alpha" | "year-asc" | "year-desc" | "type";

export const SORT_LABELS: Record<SortMode, string> = {
  alpha: "Alphabetical (by first author)",
  "year-asc": "Year (oldest first)",
  "year-desc": "Year (newest first)",
  type: "By source type",
};

export function sortSources(sources: Source[], mode: SortMode): Source[] {
  const copy = [...sources];
  switch (mode) {
    case "alpha":
      copy.sort((a, b) => {
        const an = (a.authors[0]?.last || a.title || "").toLowerCase();
        const bn = (b.authors[0]?.last || b.title || "").toLowerCase();
        return an.localeCompare(bn);
      });
      break;
    case "year-asc":
      copy.sort((a, b) => (a.year || "").localeCompare(b.year || ""));
      break;
    case "year-desc":
      copy.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
      break;
    case "type":
      copy.sort((a, b) => a.type.localeCompare(b.type));
      break;
  }
  return copy;
}

// ---------- Export formats ----------

export function renderPlain(citations: FormattedCitation[]): string {
  return citations.map((c) => c.reference).join("\n\n");
}

export function renderMarkdown(citations: FormattedCitation[]): string {
  if (citations.length === 0) return "_No references._";
  const lines = ["## References", ""];
  citations.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.reference}`);
    if (c.inText) lines.push(`   - In-text: \`${c.inText}\``);
    if (c.warnings.length > 0) lines.push(`   - ⚠ ${c.warnings.join("; ")}`);
  });
  return lines.join("\n");
}

export function renderHtml(citations: FormattedCitation[]): string {
  const items = citations.map((c) => {
    const warn = c.warnings.length > 0
      ? ` <em class="warn">⚠ ${escapeHtml(c.warnings.join("; "))}</em>`
      : "";
    return `  <li>${escapeHtml(c.reference)}${warn}</li>`;
  }).join("\n");
  return `<ol class="references">\n${items}\n</ol>`;
}

export function renderBibtex(citations: FormattedCitation[], sources: Source[]): string {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  return citations.map((c) => {
    const s = sourceById.get(c.id);
    if (!s) return "";
    const entryType = s.type === "book" ? "book"
      : s.type === "journal" ? "article"
      : s.type === "website" ? "misc"
      : "article";
    const fields: string[] = [];
    fields.push(`  title = {${s.title}}`);
    const author = s.authors.length > 0
      ? s.authors.map((a) => `${a.last}, ${a.first}`).join(" and ")
      : "";
    if (author) fields.push(`  author = {${author}}`);
    if (s.year) fields.push(`  year = {${s.year}}`);
    if (s.publisher) fields.push(`  publisher = {${s.publisher}}`);
    if (s.journal) fields.push(`  journal = {${s.journal}}`);
    if (s.volume) fields.push(`  volume = {${s.volume}}`);
    if (s.issue) fields.push(`  number = {${s.issue}}`);
    if (s.pages) fields.push(`  pages = {${s.pages}}`);
    if (s.doi) fields.push(`  doi = {${s.doi}}`);
    if (s.isbn) fields.push(`  isbn = {${s.isbn}}`);
    if (s.url) fields.push(`  url = {${s.url}}`);
    return `@${entryType}{${c.bibtexKey},\n${fields.join(",\n")}\n}`;
  }).filter(Boolean).join("\n\n");
}

export function renderRis(citations: FormattedCitation[], sources: Source[]): string {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  return citations.map((c) => {
    const s = sourceById.get(c.id);
    if (!s) return "";
    const ty = s.type === "book" ? "BOOK"
      : s.type === "journal" ? "JOUR"
      : s.type === "website" ? "ELEC"
      : "NEWS";
    const lines: string[] = ["TY  - " + ty];
    lines.push(`TI  - ${s.title}`);
    s.authors.forEach((a) => lines.push(`AU  - ${a.last}, ${a.first}`));
    if (s.year) lines.push(`PY  - ${s.year}`);
    if (s.publisher) lines.push(`PB  - ${s.publisher}`);
    if (s.journal || s.newspaper || s.siteName) {
      lines.push(`T2  - ${s.journal || s.newspaper || s.siteName}`);
    }
    if (s.volume) lines.push(`VL  - ${s.volume}`);
    if (s.issue) lines.push(`IS  - ${s.issue}`);
    if (s.pages) lines.push(`SP  - ${s.pages}`);
    if (s.doi) lines.push(`DO  - ${s.doi}`);
    if (s.isbn) lines.push(`SN  - ${s.isbn}`);
    if (s.url) lines.push(`UR  - ${s.url}`);
    lines.push("ER  - ");
    return lines.join("\n");
  }).filter(Boolean).join("\n\n");
}

export function renderJson(citations: FormattedCitation[], sources: Source[], style: CitationStyle): string {
  return JSON.stringify({ style, generatedAt: new Date().toISOString(), citations, sources }, null, 2);
}

// ---------- History (localStorage) ----------

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

// ---------- Library persistence (localStorage) ----------

export function loadLibrary(): LibraryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LibraryEntry[];
    return Array.isArray(arr) ? arr.slice(0, LIBRARY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveLibraryEntry(source: Source): LibraryEntry[] {
  const current = loadLibrary().filter((e) => e.source.id !== source.id);
  const next = [{ source, ts: Date.now() }, ...current].slice(0, LIBRARY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeLibraryEntry(id: string): LibraryEntry[] {
  const next = loadLibrary().filter((e) => e.source.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearLibrary(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LIBRARY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(source: Source, style: CitationStyle): string {
  const params = new URLSearchParams();
  params.set("style", style);
  params.set("type", source.type);
  if (source.title) params.set("title", source.title);
  if (source.authors.length > 0) {
    params.set("authors", source.authors.map((a) => `${a.last}, ${a.first}`).join("; "));
  }
  if (source.year) params.set("year", source.year);
  if (source.publisher) params.set("pub", source.publisher);
  if (source.journal) params.set("jrn", source.journal);
  if (source.volume) params.set("vol", source.volume);
  if (source.issue) params.set("iss", source.issue);
  if (source.pages) params.set("pg", source.pages);
  if (source.doi) params.set("doi", source.doi);
  if (source.isbn) params.set("isbn", source.isbn);
  if (source.url) params.set("url", source.url);
  if (source.siteName) params.set("site", source.siteName);
  if (source.newspaper) params.set("paper", source.newspaper);
  if (source.publishedDate) params.set("pubd", source.publishedDate);
  if (source.accessedDate) params.set("accd", source.accessedDate);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const source: Partial<Source> = {};
  const styleStr = params.get("style") as CitationStyle | null;
  const typeStr = params.get("type") as SourceType | null;
  if (typeStr && typeStr in TYPE_LABELS) source.type = typeStr;
  const title = params.get("title");
  if (title) source.title = title;
  const authorsStr = params.get("authors");
  if (authorsStr) source.authors = parseAuthors(authorsStr);
  const year = params.get("year");
  if (year) source.year = year;
  const publisher = params.get("pub");
  if (publisher) source.publisher = publisher;
  const jrn = params.get("jrn");
  if (jrn) source.journal = jrn;
  const vol = params.get("vol");
  if (vol) source.volume = vol;
  const iss = params.get("iss");
  if (iss) source.issue = iss;
  const pg = params.get("pg");
  if (pg) source.pages = pg;
  const doi = params.get("doi");
  if (doi) source.doi = doi;
  const isbn = params.get("isbn");
  if (isbn) source.isbn = isbn;
  const url = params.get("url");
  if (url) source.url = url;
  const site = params.get("site");
  if (site) source.siteName = site;
  const paper = params.get("paper");
  if (paper) source.newspaper = paper;
  const pubd = params.get("pubd");
  if (pubd) source.publishedDate = pubd;
  const accd = params.get("accd");
  if (accd) source.accessedDate = accd;
  return {
    source,
    style: styleStr && styleStr in STYLE_LABELS ? styleStr : undefined,
  };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(source: Source, style: CitationStyle): string {
  return [
    "You are an academic citation assistant familiar with APA 7, MLA 9, Chicago, Harvard, and IEEE styles.",
    "",
    `Target style: ${STYLE_LABELS[style]}`,
    `Source type: ${TYPE_LABELS[source.type]}`,
    `Title: ${source.title}`,
    `Authors: ${source.authors.map((a) => `${a.last}, ${a.first}`).join("; ") || "(none)"}`,
    `Year: ${source.year}`,
    source.journal ? `Journal: ${source.journal}` : "",
    source.volume ? `Volume: ${source.volume}` : "",
    source.issue ? `Issue: ${source.issue}` : "",
    source.pages ? `Pages: ${source.pages}` : "",
    source.doi ? `DOI: ${source.doi}` : "",
    source.publisher ? `Publisher: ${source.publisher}` : "",
    source.url ? `URL: ${source.url}` : "",
    "",
    "Output a JSON object with:",
    '- "refinedTitle": the title in correct title-case for the style (string)',
    '- "suggestedAuthors": array of "Last, First" strings, normalized (empty if no authors)',
    '- "notes": array of strings (3–5 style-specific notes for this entry)',
    '- "missingFields": array of strings (fields the user should add for a complete citation)',
    "",
    "Do not invent data. If a field is missing, mention it in missingFields. No markdown fences, no commentary — only the JSON object.",
  ].filter(Boolean).join("\n");
}

export function renderLlmResult(
  rawText: string,
): { ok: true; result: LlmEnhancement } | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const refinedTitle = typeof o.refinedTitle === "string" ? o.refinedTitle : "";
  const suggestedAuthors = Array.isArray(o.suggestedAuthors)
    ? (o.suggestedAuthors as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const missingFields = Array.isArray(o.missingFields)
    ? (o.missingFields as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { refinedTitle, suggestedAuthors, notes, missingFields } };
}

// ---------- Honesty ----------

export function honestyNote(): string {
  return "Auto-filled metadata is often incomplete or incorrect — always verify each field against the original source (per Purdue OWL). Citation formatting runs entirely offline; no metadata lookup is performed. Your library stays on your device. Optional LLM polish uses your own API key and goes directly to your chosen provider — skip it for 100% offline use.";
}

// ---------- ID generator ----------

let idCounter = 0;
export function generateId(): string {
  idCounter += 1;
  return `src_${Date.now().toString(36)}_${idCounter}`;
}

// ---------- Internal helpers ----------

function italicize(s: string): string {
  // Markdown-style italics are rendered in the UI; plain-text exports lose them.
  return `*${s}*`;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
