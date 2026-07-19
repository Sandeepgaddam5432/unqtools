/**
 * Citation Generator — pure logic.
 *
 * Generate academic citations in APA, MLA, Chicago, Harvard styles for books,
 * journal articles, websites, newspapers, magazines, conference papers, theses.
 * Per-style author/year/title/page/URL formatters, in-text citation generator,
 * DOI validator, bibliography sorter, multi-format renderers, history
 * (localStorage), shareable URL. Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard";

export type SourceType =
  | "book"
  | "journal-article"
  | "website"
  | "newspaper"
  | "magazine"
  | "conference-paper"
  | "thesis";

export interface Author {
  first: string;
  last: string;
}

export interface CitationFields {
  title?: string;
  authors?: Author[];
  year?: string;
  publisher?: string;
  publisherLocation?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  accessedDate?: string; // YYYY-MM-DD
  doi?: string;
  edition?: string;
  city?: string;
  university?: string; // for thesis
  conference?: string; // for conference-paper
  siteName?: string; // for website
  dayMonth?: string; // for MLA date format e.g. "15 Mar."
}

export interface CitationEntry {
  id: string;
  style: CitationStyle;
  sourceType: SourceType;
  fields: CitationFields;
  formatted: string;
  inText: string;
}

export interface CitationStats {
  total: number;
  byStyle: Record<CitationStyle, number>;
  byType: Record<SourceType, number>;
}

// ---- Constants ----

export const STYLE_LABELS: Record<CitationStyle, string> = {
  apa: "APA 7th",
  mla: "MLA 9th",
  chicago: "Chicago",
  harvard: "Harvard",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  book: "Book",
  "journal-article": "Journal Article",
  website: "Website",
  newspaper: "Newspaper Article",
  magazine: "Magazine Article",
  "conference-paper": "Conference Paper",
  thesis: "Thesis",
};

export const SOURCE_TYPES: SourceType[] = [
  "book", "journal-article", "website", "newspaper",
  "magazine", "conference-paper", "thesis",
];

export const STYLES: CitationStyle[] = ["apa", "mla", "chicago", "harvard"];

export const FIELD_PRESETS: Record<SourceType, (keyof CitationFields)[]> = {
  book: ["authors", "year", "title", "edition", "publisher", "publisherLocation", "doi"],
  "journal-article": ["authors", "year", "title", "journal", "volume", "issue", "pages", "doi"],
  website: ["authors", "year", "title", "siteName", "url", "accessedDate"],
  newspaper: ["authors", "year", "title", "newspaper" as never, "dayMonth", "pages", "url"],
  magazine: ["authors", "year", "title", "magazine" as never, "dayMonth", "pages", "url"],
  "conference-paper": ["authors", "year", "title", "conference", "publisher", "pages", "doi"],
  thesis: ["authors", "year", "title", "university", "city", "doi"],
};

// ---- Normalize / parse helpers ----

/** Trim a string. Returns "" for null/undefined. */
export function normalizeText(s: string | undefined | null): string {
  return (s ?? "").trim();
}

/** Parse authors from "Last, First; Last, First" or "First Last; First Last" format. */
export function parseAuthors(input: string): Author[] {
  const cleaned = normalizeText(input);
  if (!cleaned) return [];
  const parts = cleaned.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const authors: Author[] = [];
  for (const part of parts) {
    if (part.includes(",")) {
      const [last, first] = part.split(",").map((s) => s.trim());
      authors.push({ first: first ?? "", last: last ?? "" });
    } else {
      // "First Last" or "First Middle Last"
      const tokens = part.split(/\s+/);
      if (tokens.length === 1) {
        authors.push({ first: "", last: tokens[0] });
      } else {
        const last = tokens[tokens.length - 1];
        const first = tokens.slice(0, -1).join(" ");
        authors.push({ first, last });
      }
    }
  }
  return authors;
}

/** Parse a single author from "Last, First" or "First Last". */
export function parseSingleAuthor(input: string): Author {
  const list = parseAuthors(input);
  return list[0] ?? { first: "", last: "" };
}

/** Validate DOI format (basic). */
export function isValidDoi(doi: string): boolean {
  const d = normalizeText(doi);
  if (!d) return false;
  // Accept "10.xxxx/..." or "doi:10.xxxx/..." or full URL
  const stripped = d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:/i, "");
  return /^10\.\d{4,9}\/[^\s]+$/i.test(stripped);
}

/** Normalize a DOI to canonical form (without URL prefix). */
export function normalizeDoi(doi: string): string {
  return normalizeText(doi)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "");
}

/** Validate year format. */
export function isValidYear(year: string): boolean {
  const y = normalizeText(year);
  if (!y) return false;
  return /^\d{4}$/.test(y);
}

// ---- Author formatters ----

/** Format an author's name per style. */
export function formatAuthor(author: Author, style: CitationStyle): string {
  const first = normalizeText(author.first);
  const last = normalizeText(author.last);
  if (!last && !first) return "";
  if (style === "apa" || style === "harvard") {
    // "Last, F. M."
    if (!first) return last;
    const initials = first
      .split(/\s+/)
      .map((t) => t.charAt(0).toUpperCase() + ".")
      .join(" ");
    return `${last}, ${initials}`;
  }
  if (style === "mla") {
    // "Last, First"
    if (!first) return last;
    return `${last}, ${first}`;
  }
  // chicago: "Last, First"
  if (!first) return last;
  return `${last}, ${first}`;
}

/** Format multiple authors with proper separators and "et al." for 3+. */
export function formatAuthors(authors: Author[], style: CitationStyle): string {
  const valid = authors.filter((a) => normalizeText(a.last) || normalizeText(a.first));
  if (valid.length === 0) return "";
  if (valid.length === 1) return formatAuthor(valid[0], style);
  if (valid.length === 2) {
    const a1 = formatAuthor(valid[0], style);
    const a2 = formatAuthor(valid[1], style);
    if (style === "apa") return `${a1}, & ${a2}`;
    if (style === "mla") return `${a1}, and ${a2}`;
    if (style === "chicago") return `${a1}, and ${a2}`;
    return `${a1} and ${a2}`; // harvard
  }
  // 3+ authors
  const first = formatAuthor(valid[0], style);
  if (style === "apa" || style === "harvard") return `${first}, et al.`;
  return `${first}, et al.`; // mla, chicago
}

// ---- Title formatters ----

/** Italicize a title (return as plain text with markers for HTML/MD). */
export function italicize(title: string): string {
  return title;
}

/** Quote a title in double quotes. */
export function quoteTitle(title: string): string {
  return `"${title}"`;
}

/** Format a title per style + source type. */
export function formatTitle(
  title: string,
  style: CitationStyle,
  sourceType: SourceType,
): { text: string; italic: boolean } {
  const t = normalizeText(title);
  if (!t) return { text: "", italic: false };
  // Italic titles: books, journals, websites (site name), newspapers, magazines, conferences, thesis titles
  // Quoted titles: article/chapter titles
  const italicSources: SourceType[] = [
    "book", "website", "newspaper", "magazine",
    "conference-paper", "thesis",
  ];
  const isArticle = sourceType === "journal-article";
  if (isArticle) {
    // article title is quoted; journal name is italic — handled separately
    return { text: t, italic: false };
  }
  if (italicSources.includes(sourceType)) {
    return { text: t, italic: true };
  }
  return { text: t, italic: false };
}

/** Format a journal/newspaper/magazine name (always italic). */
export function formatJournalName(name: string): { text: string; italic: boolean } {
  const n = normalizeText(name);
  return { text: n, italic: true };
}

// ---- Year placement ----

/** Format year per style. */
export function formatYear(year: string, style: CitationStyle): string {
  const y = normalizeText(year);
  if (!y) return "n.d.";
  if (style === "apa") return `(${y})`;
  if (style === "harvard") return `(${y})`;
  return y; // mla, chicago
}

// ---- Page range formatter ----

/** Format a page range with proper dash. */
export function formatPageRange(pages: string): string {
  const p = normalizeText(pages);
  if (!p) return "";
  // Replace hyphen with en-dash, collapse spaces
  return p
    .replace(/\s*[-–—]\s*/g, "–")
    .replace(/^(\d+)$/, "$1")
    .trim();
}

/** Format full pages field with label per style. */
export function formatPages(pages: string, style: CitationStyle): string {
  const formatted = formatPageRange(pages);
  if (!formatted) return "";
  if (style === "apa" || style === "harvard") return formatted;
  if (style === "mla") return `pp. ${formatted}`;
  return formatted; // chicago
}

// ---- URL + accessed date formatter ----

/** Format URL with accessed date per style. */
export function formatUrl(url: string, accessedDate: string, style: CitationStyle): string {
  const u = normalizeText(url);
  if (!u) return "";
  const date = normalizeText(accessedDate);
  const formattedDate = date ? formatDate(date, style) : "";
  if (style === "apa") {
    if (formattedDate) return `Retrieved ${formattedDate}, from ${u}`;
    return u;
  }
  if (style === "mla") {
    if (formattedDate) return `${u}. Accessed ${formattedDate}.`;
    return u;
  }
  if (style === "chicago") {
    if (formattedDate) return `${u}.`;
    return u;
  }
  // harvard
  if (formattedDate) return `Available at: ${u} [Accessed ${formattedDate}].`;
  return `Available at: ${u}.`;
}

/** Format a YYYY-MM-DD date per style. */
export function formatDate(dateStr: string, style: CitationStyle): string {
  const d = normalizeText(dateStr);
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  const year = m[1];
  const month = m[2];
  const day = m[3];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = parseInt(month, 10) - 1;
  if (mi < 0 || mi > 11) return d;
  if (style === "apa") return `${monthNames[mi]} ${parseInt(day, 10)}, ${year}`;
  if (style === "mla") return `${parseInt(day, 10)} ${monthShort[mi]}. ${year}`;
  if (style === "chicago") return `${monthNames[mi]} ${parseInt(day, 10)}, ${year}`;
  return `${parseInt(day, 10)} ${monthNames[mi]} ${year}`; // harvard
}

// ---- DOI formatter ----

/** Format DOI per style. */
export function formatDoi(doi: string, style: CitationStyle): string {
  const d = normalizeDoi(doi);
  if (!d) return "";
  if (style === "apa") return `https://doi.org/${d}`;
  if (style === "mla") return `doi:${d}`;
  if (style === "chicago") return `https://doi.org/${d}`;
  return `doi:${d}`; // harvard
}

// ---- Main citation formatters ----

/** Format a citation per style + source type. */
export function formatCitation(
  style: CitationStyle,
  sourceType: SourceType,
  fields: CitationFields,
): string {
  switch (sourceType) {
    case "book":
      return formatBook(style, fields);
    case "journal-article":
      return formatJournalArticle(style, fields);
    case "website":
      return formatWebsite(style, fields);
    case "newspaper":
      return formatNewspaper(style, fields);
    case "magazine":
      return formatMagazine(style, fields);
    case "conference-paper":
      return formatConferencePaper(style, fields);
    case "thesis":
      return formatThesis(style, fields);
    default:
      return "";
  }
}

function buildAuthorYearBlock(
  style: CitationStyle,
  fields: CitationFields,
): { authors: string; year: string } {
  const authors = formatAuthors(fields.authors ?? [], style);
  const year = formatYear(fields.year ?? "", style);
  return { authors, year };
}

function formatBook(style: CitationStyle, fields: CitationFields): string {
  const { authors, year } = buildAuthorYearBlock(style, fields);
  const titleInfo = formatTitle(fields.title ?? "", style, "book");
  const title = titleInfo.italic ? `*${titleInfo.text}*` : titleInfo.text;
  const edition = normalizeText(fields.edition);
  const editionStr = edition ? ` (${edition} ed.)` : "";
  const publisher = normalizeText(fields.publisher);
  const location = normalizeText(fields.publisherLocation);
  const doi = formatDoi(fields.doi ?? "", style);

  if (style === "apa") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    parts.push(`${year}.`);
    if (title) parts.push(`${title}${editionStr}.`);
    if (publisher) parts.push(`${publisher}.`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "mla") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`${title}${editionStr}.`);
    if (location && publisher) parts.push(`${location}: ${publisher}, ${year}.`);
    else if (publisher) parts.push(`${publisher}, ${year}.`);
    return parts.join(" ");
  }
  if (style === "chicago") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`${title}${editionStr}.`);
    if (location && publisher) parts.push(`${location}: ${publisher}, ${year}.`);
    else if (publisher) parts.push(`${publisher}, ${year}.`);
    return parts.join(" ");
  }
  // harvard
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`${year}.`);
  if (title) parts.push(`${title}${editionStr}.`);
  if (location && publisher) parts.push(`${location}: ${publisher}.`);
  else if (publisher) parts.push(`${publisher}.`);
  return parts.join(" ");
}

function formatJournalArticle(style: CitationStyle, fields: CitationFields): string {
  const { authors, year } = buildAuthorYearBlock(style, fields);
  const title = normalizeText(fields.title);
  const journalInfo = formatJournalName(fields.journal ?? "");
  const journal = journalInfo.italic ? `*${journalInfo.text}*` : journalInfo.text;
  const volume = normalizeText(fields.volume);
  const issue = normalizeText(fields.issue);
  const pages = formatPages(fields.pages ?? "", style);
  const doi = formatDoi(fields.doi ?? "", style);

  if (style === "apa") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    parts.push(`${year}.`);
    if (title) parts.push(`${title}.`);
    const volIss = volume ? (issue ? `${volume}(${issue})` : volume) : "";
    if (journal) {
      if (volIss) parts.push(`${journal}, ${volIss}${pages ? `, ${pages}` : ""}.`);
      else parts.push(`${journal}.`);
    }
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "mla") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (journal) {
      const volIss = volume ? (issue ? `${volume}.${issue}` : volume) : "";
      parts.push(`${journal}${volIss ? `, vol. ${volIss}` : ""}${year ? `, ${year}` : ""}${pages ? `, pp. ${formatPageRange(fields.pages ?? "")}` : ""}.`);
    }
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "chicago") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (journal) {
      const volIss = volume ? (issue ? `${volume}, no. ${issue}` : volume) : "";
      parts.push(`${journal}${volIss ? ` ${volIss}` : ""}${year ? ` (${year})` : ""}${pages ? `: ${formatPageRange(fields.pages ?? "")}` : ""}.`);
    }
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  // harvard
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`${year}.`);
  if (title) parts.push(`'${title}',`);
  if (journal) {
    const volIss = volume ? (issue ? `${volume}(${issue})` : volume) : "";
    parts.push(`${journal}${volIss ? `, ${volIss}` : ""}${pages ? `, pp. ${formatPageRange(fields.pages ?? "")}` : ""}.`);
  }
  if (doi) parts.push(doi);
  return parts.join(" ");
}

function formatWebsite(style: CitationStyle, fields: CitationFields): string {
  const { authors, year } = buildAuthorYearBlock(style, fields);
  // Website title: italic in APA/Harvard, quoted in MLA/Chicago (period inside quotes)
  const rawTitle = normalizeText(fields.title);
  const siteName = normalizeText(fields.siteName);
  const urlBlock = formatUrl(fields.url ?? "", fields.accessedDate ?? "", style);

  if (style === "apa") {
    const title = rawTitle ? `*${rawTitle}*` : "";
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    parts.push(`${year}.`);
    if (title) parts.push(`${title}.`);
    if (siteName) parts.push(`${siteName}.`);
    if (urlBlock) parts.push(urlBlock);
    return parts.join(" ");
  }
  if (style === "mla") {
    const title = rawTitle ? `"${rawTitle}."` : "";
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(title);
    if (siteName) parts.push(`${siteName},`);
    if (fields.year) parts.push(`${year},`);
    if (urlBlock) parts.push(urlBlock);
    return parts.join(" ");
  }
  if (style === "chicago") {
    const title = rawTitle ? `"${rawTitle}."` : "";
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(title);
    if (siteName) parts.push(`${siteName}.`);
    if (fields.year) parts.push(`${year}.`);
    if (urlBlock) parts.push(urlBlock);
    return parts.join(" ");
  }
  // harvard
  const title = rawTitle ? `*${rawTitle}*` : "";
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`${year}.`);
  if (title) parts.push(`${title}.`);
  if (siteName) parts.push(`${siteName}.`);
  if (urlBlock) parts.push(urlBlock);
  return parts.join(" ");
}

function formatNewspaper(style: CitationStyle, fields: CitationFields): string {
  const { authors, year } = buildAuthorYearBlock(style, fields);
  const title = normalizeText(fields.title);
  const newspaperInfo = formatJournalName((fields as Record<string, unknown>).newspaper as string ?? "");
  const newspaper = newspaperInfo.italic ? `*${newspaperInfo.text}*` : newspaperInfo.text;
  const dayMonth = normalizeText(fields.dayMonth);
  const pages = formatPages(fields.pages ?? "", style);
  const urlBlock = formatUrl(fields.url ?? "", fields.accessedDate ?? "", style);

  if (style === "apa") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    parts.push(`${year}.`);
    if (title) parts.push(`${title}.`);
    if (newspaper) parts.push(`${newspaper}.`);
    if (urlBlock) parts.push(urlBlock);
    return parts.join(" ");
  }
  if (style === "mla") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (newspaper) parts.push(`${newspaper}`);
    if (dayMonth) parts.push(`${dayMonth}`);
    if (pages) parts.push(`pp. ${formatPageRange(fields.pages ?? "")}.`);
    if (urlBlock) parts.push(urlBlock);
    return parts.join(" ");
  }
  if (style === "chicago") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (newspaper) parts.push(`${newspaper},`);
    if (dayMonth) parts.push(`${dayMonth}.`);
    if (urlBlock) parts.push(urlBlock);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`${year}.`);
  if (title) parts.push(`'${title}',`);
  if (newspaper) parts.push(`${newspaper}.`);
  if (urlBlock) parts.push(urlBlock);
  return parts.join(" ");
}

function formatMagazine(style: CitationStyle, fields: CitationFields): string {
  // Same structure as newspaper
  return formatNewspaper(style, { ...fields });
}

function formatConferencePaper(style: CitationStyle, fields: CitationFields): string {
  const { authors, year } = buildAuthorYearBlock(style, fields);
  const titleInfo = formatTitle(fields.title ?? "", style, "conference-paper");
  const title = titleInfo.italic ? `*${titleInfo.text}*` : titleInfo.text;
  const conference = normalizeText(fields.conference);
  const publisher = normalizeText(fields.publisher);
  const pages = formatPages(fields.pages ?? "", style);
  const doi = formatDoi(fields.doi ?? "", style);

  if (style === "apa") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    parts.push(`${year}.`);
    if (title) parts.push(`${title}.`);
    if (conference) parts.push(`Paper presented at ${conference}.`);
    if (publisher) parts.push(`${publisher}.`);
    if (pages) parts.push(`pp. ${formatPageRange(fields.pages ?? "")}.`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "mla") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (conference) parts.push(`${conference},`);
    if (year) parts.push(`${year}.`);
    if (pages) parts.push(`pp. ${formatPageRange(fields.pages ?? "")}.`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "chicago") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (conference) parts.push(`Paper presented at ${conference},`);
    if (year) parts.push(`${year}.`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`${year}.`);
  if (title) parts.push(`'${title}',`);
  if (conference) parts.push(`paper presented at ${conference}.`);
  if (doi) parts.push(doi);
  return parts.join(" ");
}

function formatThesis(style: CitationStyle, fields: CitationFields): string {
  const { authors, year } = buildAuthorYearBlock(style, fields);
  const titleInfo = formatTitle(fields.title ?? "", style, "thesis");
  const title = titleInfo.italic ? `*${titleInfo.text}*` : titleInfo.text;
  const university = normalizeText(fields.university);
  const city = normalizeText(fields.city);
  const doi = formatDoi(fields.doi ?? "", style);

  if (style === "apa") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    parts.push(`${year}.`);
    if (title) parts.push(`${title} [Doctoral dissertation].`);
    if (university) parts.push(`${university}.`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "mla") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (year) parts.push(`${year}.`);
    if (university) parts.push(`${university},`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  if (style === "chicago") {
    const parts: string[] = [];
    if (authors) parts.push(`${authors}.`);
    if (title) parts.push(`"${title}."`);
    if (university) parts.push(`${university}, ${year}.`);
    if (doi) parts.push(doi);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`${year}.`);
  if (title) parts.push(`'${title}',`);
  if (university) parts.push(`${university}.`);
  if (doi) parts.push(doi);
  return parts.join(" ");
}

// ---- In-text citation generator ----

/** Generate in-text citation per style. */
export function formatInText(
  style: CitationStyle,
  fields: CitationFields,
): string {
  const authors = (fields.authors ?? []).filter((a) => normalizeText(a.last) || normalizeText(a.first));
  const year = normalizeText(fields.year);
  const pages = normalizeText(fields.pages);
  const pageMatch = pages.match(/(\d+)/);
  const page = pageMatch ? pageMatch[1] : "";

  let authorPart = "";
  if (authors.length === 0) {
    authorPart = "Anon";
  } else if (authors.length === 1) {
    authorPart = normalizeText(authors[0].last) || normalizeText(authors[0].first);
  } else if (authors.length === 2) {
    if (style === "apa") {
      authorPart = `${normalizeText(authors[0].last)} & ${normalizeText(authors[1].last)}`;
    } else {
      authorPart = `${normalizeText(authors[0].last)} and ${normalizeText(authors[1].last)}`;
    }
  } else {
    authorPart = `${normalizeText(authors[0].last)} et al.`;
  }

  if (style === "apa") {
    return year ? `(${authorPart}, ${year})` : `(${authorPart}, n.d.)`;
  }
  if (style === "mla") {
    return page ? `(${authorPart} ${page})` : `(${authorPart})`;
  }
  if (style === "chicago") {
    const y = year || "n.d.";
    return page ? `(${authorPart} ${y}, ${page})` : `(${authorPart} ${y})`;
  }
  // harvard
  const y = year || "n.d.";
  return page ? `(${authorPart}, ${y}, p.${page})` : `(${authorPart}, ${y})`;
}

// ---- Bibliography sorter ----

/** Sort citations alphabetically by first author's last name. */
export function sortBibliography(entries: CitationEntry[]): CitationEntry[] {
  return [...entries].sort((a, b) => {
    const an = a.fields.authors?.[0]?.last ?? a.fields.authors?.[0]?.first ?? "";
    const bn = b.fields.authors?.[0]?.last ?? b.fields.authors?.[0]?.first ?? "";
    const cmp = an.localeCompare(bn);
    if (cmp !== 0) return cmp;
    const at = a.fields.title ?? "";
    const bt = b.fields.title ?? "";
    return at.localeCompare(bt);
  });
}

// ---- Stats ----

export function computeStats(entries: CitationEntry[]): CitationStats {
  const byStyle: Record<CitationStyle, number> = { apa: 0, mla: 0, chicago: 0, harvard: 0 };
  const byType: Record<SourceType, number> = {
    book: 0, "journal-article": 0, website: 0, newspaper: 0,
    magazine: 0, "conference-paper": 0, thesis: 0,
  };
  for (const e of entries) {
    byStyle[e.style] += 1;
    byType[e.sourceType] += 1;
  }
  return { total: entries.length, byStyle, byType };
}

// ---- Renderers ----

/** Strip markdown italic markers (for plain-text rendering). */
export function stripMarkdown(text: string): string {
  return text.replace(/\*(.+?)\*/g, "$1");
}

/** Render citations as plain text bibliography. */
export function renderText(entries: CitationEntry[]): string {
  return entries.map((e) => stripMarkdown(e.formatted)).join("\n\n");
}

/** Render citations as HTML bibliography with hanging indent. */
export function renderHtml(entries: CitationEntry[]): string {
  const items = entries
    .map((e) => {
      const html = e.formatted
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // re-emphasize (the &amp; etc. could break em tags but order matters)
        .replace(/&lt;em&gt;/g, "<em>")
        .replace(/&lt;\/em&gt;/g, "</em>");
      return `  <li>${html}</li>`;
    })
    .join("\n");
  return `<ol class="bibliography" style="padding-left: 1.5rem; list-style: none;">\n${items}\n</ol>`;
}

/** Render citations as Markdown bibliography. */
export function renderMarkdown(entries: CitationEntry[]): string {
  return entries.map((e) => `- ${e.formatted}`).join("\n");
}

/** Render citations as CSV. */
export function renderCsv(entries: CitationEntry[]): string {
  const lines = ["id,style,source_type,title,authors,year,formatted_citation,in_text"];
  for (const e of entries) {
    const title = e.fields.title ?? "";
    const authors = (e.fields.authors ?? [])
      .map((a) => `${a.last}, ${a.first}`.trim().replace(/,$/, ""))
      .join("; ");
    const year = e.fields.year ?? "";
    const formatted = stripMarkdown(e.formatted);
    lines.push([
      escapeCsv(e.id),
      e.style,
      e.sourceType,
      escapeCsv(title),
      escapeCsv(authors),
      year,
      escapeCsv(formatted),
      escapeCsv(e.inText),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- ID generator ----

let idCounter = 0;
export function generateId(): string {
  idCounter += 1;
  return `cit_${Date.now().toString(36)}_${idCounter}`;
}

/** Build a full citation entry from inputs. */
export function buildCitation(
  style: CitationStyle,
  sourceType: SourceType,
  fields: CitationFields,
  id?: string,
): CitationEntry {
  const formatted = formatCitation(style, sourceType, fields);
  const inText = formatInText(style, fields);
  return {
    id: id ?? generateId(),
    style,
    sourceType,
    fields,
    formatted,
    inText,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:citation-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  style: CitationStyle;
  sourceType: SourceType;
  title: string;
  formatted: string;
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

// ---- Shareable URL ----

export function buildShareUrl(
  style: CitationStyle,
  sourceType: SourceType,
  fields: CitationFields,
): string {
  const params = new URLSearchParams();
  params.set("style", style);
  params.set("type", sourceType);
  if (fields.title) params.set("title", fields.title);
  if (fields.year) params.set("year", fields.year);
  if (fields.publisher) params.set("publisher", fields.publisher);
  if (fields.journal) params.set("journal", fields.journal);
  if (fields.volume) params.set("volume", fields.volume);
  if (fields.issue) params.set("issue", fields.issue);
  if (fields.pages) params.set("pages", fields.pages);
  if (fields.url) params.set("url", fields.url);
  if (fields.accessedDate) params.set("accessed", fields.accessedDate);
  if (fields.doi) params.set("doi", fields.doi);
  if (fields.authors && fields.authors.length > 0) {
    params.set(
      "authors",
      fields.authors.map((a) => `${a.last}, ${a.first}`).join("; "),
    );
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  style: CitationStyle;
  sourceType: SourceType;
  fields: CitationFields;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { style: "apa", sourceType: "book", fields: {} };
  }
  const params = new URLSearchParams(clean);
  const style = (params.get("style") as CitationStyle) ?? "apa";
  const sourceType = (params.get("type") as SourceType) ?? "book";
  const validStyles = STYLES.includes(style) ? style : "apa";
  const validTypes = SOURCE_TYPES.includes(sourceType) ? sourceType : "book";
  const authors = parseAuthors(params.get("authors") ?? "");
  const fields: CitationFields = {
    title: params.get("title") ?? "",
    year: params.get("year") ?? "",
    publisher: params.get("publisher") ?? "",
    journal: params.get("journal") ?? "",
    volume: params.get("volume") ?? "",
    issue: params.get("issue") ?? "",
    pages: params.get("pages") ?? "",
    url: params.get("url") ?? "",
    accessedDate: params.get("accessed") ?? "",
    doi: params.get("doi") ?? "",
    authors,
  };
  return { style: validStyles, sourceType: validTypes, fields };
}

// ---- Parse pipe-separated bulk input ----

/** Parse pipe-separated bulk citation input. */
export function parseBulkCitations(
  input: string,
  style: CitationStyle,
): CitationEntry[] {
  if (!input) return [];
  const lines = input.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: CitationEntry[] = [];
  for (const line of lines) {
    const parts = splitPipeRow(line);
    if (parts.length < 2) continue;
    const [sourceTypeStr, title, authorsStr, year, extra1, extra2, extra3, extra4] = parts;
    if (!SOURCE_TYPES.includes(sourceTypeStr as SourceType)) continue;
    const sourceType = sourceTypeStr as SourceType;
    const fields: CitationFields = {
      title: title ?? "",
      authors: parseAuthors(authorsStr ?? ""),
      year: year ?? "",
    };
    // Extra fields vary by source type
    if (sourceType === "book") {
      fields.publisher = extra1;
      fields.publisherLocation = extra2;
      fields.doi = extra3;
    } else if (sourceType === "journal-article") {
      fields.journal = extra1;
      fields.volume = extra2;
      fields.issue = extra3;
      fields.pages = extra4;
    } else if (sourceType === "website") {
      fields.siteName = extra1;
      fields.url = extra2;
      fields.accessedDate = extra3;
    }
    out.push(buildCitation(style, sourceType, fields));
  }
  return out;
}

/** Split pipe-separated row, handling quoted pipes. */
export function splitPipeRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "|" && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}
