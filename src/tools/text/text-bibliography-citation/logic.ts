/**
 * Bibliography & Citation Generator — pure logic.
 * Generates citations in APA, MLA, Chicago, and Harvard styles for various
 * source types (book, journal, website, newspaper, conference).
 */

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard";

export type SourceType = "book" | "journal" | "website" | "newspaper" | "conference";

export interface Author {
  firstName: string;
  lastName: string;
}

export interface Source {
  type: SourceType;
  authors: Author[];
  title: string;
  year: number;
  publisher?: string;
  journal?: string;
  volume?: number;
  issue?: number;
  pages?: string;
  url?: string;
  accessedDate?: string; // ISO YYYY-MM-DD
  publishedDate?: string; // ISO YYYY-MM-DD
  city?: string;
  edition?: number;
  doi?: string;
  conference?: string;
  location?: string;
}

/** Format a single author as "Last, F." (APA). */
export function formatAuthorApa(author: Author): string {
  const initials = author.firstName.split(/\s+/).map((n) => n.charAt(0).toUpperCase()).join(". ");
  return `${author.lastName}, ${initials}.`;
}

/** Format authors list for APA. */
export function formatAuthorsApa(authors: Author[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return formatAuthorApa(authors[0]);
  if (authors.length === 2) return `${formatAuthorApa(authors[0])}, & ${formatAuthorApa(authors[1])}`;
  if (authors.length <= 20) {
    const all = authors.map(formatAuthorApa);
    const last = all.pop();
    return `${all.join(", ")}, & ${last}`;
  }
  // 21+ authors — first 19, then ellipsis, then last
  const first19 = authors.slice(0, 19).map(formatAuthorApa);
  const last = formatAuthorApa(authors[authors.length - 1]);
  return `${first19.join(", ")}, … ${last}`;
}

/** Format authors for MLA ("Last, First" + "and"). */
export function formatAuthorsMla(authors: Author[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return `${authors[0].lastName}, ${authors[0].firstName}`;
  if (authors.length === 2) return `${authors[0].lastName}, ${authors[0].firstName}, and ${authors[1].firstName} ${authors[1].lastName}`;
  // 3+ — first author et al.
  return `${authors[0].lastName}, ${authors[0].firstName}, et al.`;
}

/** Format authors for Chicago (notes-bibliography). */
export function formatAuthorsChicago(authors: Author[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return `${authors[0].lastName}, ${authors[0].firstName}`;
  if (authors.length === 2) return `${authors[0].lastName}, ${authors[0].firstName}, and ${authors[1].firstName} ${authors[1].lastName}`;
  if (authors.length <= 3) {
    const parts = authors.map((a) => `${a.firstName} ${a.lastName}`);
    return `${authors[0].lastName}, ${authors[0].firstName}, ${parts.slice(1, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  }
  return `${authors[0].lastName}, ${authors[0].firstName}, et al.`;
}

/** Format authors for Harvard. */
export function formatAuthorsHarvard(authors: Author[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return formatAuthorApa(authors[0]);
  if (authors.length === 2) return `${formatAuthorApa(authors[0])} and ${formatAuthorApa(authors[1])}`;
  if (authors.length <= 3) {
    return authors.map(formatAuthorApa).join(", ");
  }
  return `${formatAuthorApa(authors[0])} et al.`;
}

/** Generate an APA citation. */
export function citeApa(s: Source): string {
  const authors = formatAuthorsApa(s.authors);
  const year = `(${s.year})`;
  const title = s.type === "book" ? italicize(s.title) : s.title;
  let tail = "";
  switch (s.type) {
    case "book":
      tail = [s.publisher, s.edition ? `${s.edition} ed.` : ""].filter(Boolean).join(", ");
      break;
    case "journal":
      tail = `${italicize(s.journal ?? "")}${s.volume ? `, ${s.volume}` : ""}${s.issue ? `(${s.issue})` : ""}${s.pages ? `, ${s.pages}` : ""}`;
      break;
    case "website":
      tail = `${s.publisher ?? ""}${s.url ? `. ${s.url}` : ""}${s.accessedDate ? ` (accessed ${s.accessedDate})` : ""}`;
      break;
    case "newspaper":
      tail = `${italicize(s.publisher ?? "")}${s.pages ? `, ${s.pages}` : ""}`;
      break;
    case "conference":
      tail = `In ${italicize(s.conference ?? "")}${s.location ? `, ${s.location}` : ""}${s.pages ? `, pp. ${s.pages}` : ""}`;
      break;
  }
  return [authors, year, title + ".", tail].filter(Boolean).join(" ").trim() + (s.doi ? ` https://doi.org/${s.doi}` : "");
}

/** Generate an MLA citation. */
export function citeMla(s: Source): string {
  const authors = formatAuthorsMla(s.authors);
  const title = `"${s.title}."`;
  let tail = "";
  switch (s.type) {
    case "book":
      tail = [italicize(s.title), s.publisher, s.year].filter(Boolean).join(", ");
      return `${authors}. ${title} ${tail}.`;
    case "journal":
      tail = [italicize(s.journal ?? ""), s.volume, s.issue, s.year, s.pages].filter(Boolean).join(", ");
      return `${authors}. ${title} ${tail}.`;
    case "website":
      tail = [s.publisher, s.publishedDate, s.url, s.accessedDate].filter(Boolean).join(", ");
      return `${authors}. ${title} ${tail}.`;
    case "newspaper":
      tail = [italicize(s.publisher ?? ""), s.publishedDate, s.pages].filter(Boolean).join(", ");
      return `${authors}. ${title} ${tail}.`;
    case "conference":
      tail = [italicize(s.conference ?? ""), s.location, s.year, s.pages].filter(Boolean).join(", ");
      return `${authors}. ${title} ${tail}.`;
  }
}

/** Generate a Chicago citation. */
export function citeChicago(s: Source): string {
  const authors = formatAuthorsChicago(s.authors);
  const year = s.year;
  switch (s.type) {
    case "book":
      return `${authors}. ${italicize(s.title)}. ${s.edition ? `${s.edition} ed. ` : ""}${s.city ?? ""}: ${s.publisher ?? ""}, ${year}.`;
    case "journal":
      return `${authors}. "${s.title}." ${italicize(s.journal ?? "")} ${s.volume ?? ""}${s.issue ? `, no. ${s.issue}` : ""} (${year})${s.pages ? `: ${s.pages}` : ""}.`;
    case "website":
      return `${authors}. "${s.title}." ${s.publisher ?? ""}. ${s.publishedDate ?? year}. ${s.url ?? ""}.`;
    case "newspaper":
      return `${authors}. "${s.title}." ${italicize(s.publisher ?? "")}, ${s.publishedDate ?? year}.`;
    case "conference":
      return `${authors}. "${s.title}." Paper presented at ${s.conference ?? ""}, ${s.location ?? ""}, ${year}.`;
  }
}

/** Generate a Harvard citation. */
export function citeHarvard(s: Source): string {
  const authors = formatAuthorsHarvard(s.authors);
  const year = `${s.year}`;
  switch (s.type) {
    case "book":
      return `${authors} (${year}) ${italicize(s.title)}. ${s.edition ? `${s.edition} edn. ` : ""}${s.city ?? ""}: ${s.publisher ?? ""}.`;
    case "journal":
      return `${authors} (${year}) '${s.title}', ${italicize(s.journal ?? "")}${s.volume ? `, ${s.volume}` : ""}${s.issue ? `(${s.issue})` : ""}${s.pages ? `: ${s.pages}` : ""}.`;
    case "website":
      return `${authors} (${year}) '${s.title}', ${s.publisher ?? ""}. Available at: ${s.url ?? ""} (Accessed: ${s.accessedDate ?? ""}).`;
    case "newspaper":
      return `${authors} (${year}) '${s.title}', ${italicize(s.publisher ?? "")}${s.pages ? `, ${s.pages}` : ""}.`;
    case "conference":
      return `${authors} (${year}) '${s.title}', paper presented at ${s.conference ?? ""}, ${s.location ?? ""}.`;
  }
}

/** Generate a citation in the specified style. */
export function generateCitation(s: Source, style: CitationStyle): string {
  switch (style) {
    case "apa": return citeApa(s);
    case "mla": return citeMla(s);
    case "chicago": return citeChicago(s);
    case "harvard": return citeHarvard(s);
  }
}

/** Italicize text (using Unicode mathematical italic for plain-text output). */
export function italicize(text: string): string {
  if (!text) return "";
  // Use markdown-style *italic* for clarity
  return `*${text}*`;
}

/** Generate an in-text citation. */
export function inTextCitation(s: Source, style: CitationStyle): string {
  const firstAuthor = s.authors[0];
  const lastName = firstAuthor ? firstAuthor.lastName : "Anonymous";
  switch (style) {
    case "apa":
      if (s.authors.length === 1) return `(${lastName}, ${s.year})`;
      if (s.authors.length === 2) return `(${lastName} & ${s.authors[1].lastName}, ${s.year})`;
      return `(${lastName} et al., ${s.year})`;
    case "mla":
      if (s.authors.length === 1) return `(${lastName} ${s.pages ?? ""})`.trim();
      return `(${lastName} et al. ${s.pages ?? ""})`.trim();
    case "chicago":
      return `(${lastName} ${s.year})`;
    case "harvard":
      if (s.authors.length === 1) return `(${lastName}, ${s.year})`;
      if (s.authors.length === 2) return `(${lastName} and ${s.authors[1].lastName}, ${s.year})`;
      return `(${lastName} et al., ${s.year})`;
  }
}

/** Validate a source. */
export function validateSource(s: Source): { ok: boolean; reason?: string } {
  if (s.authors.length === 0) return { ok: false, reason: "At least one author is required." };
  if (!s.title) return { ok: false, reason: "Title is required." };
  if (!s.year || s.year < 1500 || s.year > new Date().getFullYear() + 1) {
    return { ok: false, reason: "Year is invalid." };
  }
  return { ok: true };
}

/** Build a bibliography list sorted alphabetically by first author's last name. */
export function buildBibliography(sources: Source[], style: CitationStyle): string[] {
  const sorted = [...sources].sort((a, b) => {
    const aLast = a.authors[0]?.lastName ?? "";
    const bLast = b.authors[0]?.lastName ?? "";
    return aLast.localeCompare(bLast);
  });
  return sorted.map((s) => generateCitation(s, style));
}

/** Generate a sample source for demo. */
export function sampleSource(): Source {
  return {
    type: "book",
    authors: [{ firstName: "Neil", lastName: "Gaiman" }],
    title: "American Gods",
    year: 2001,
    publisher: "HarperCollins",
    city: "New York",
    edition: 1,
  };
}

/** List of available styles. */
export const STYLES: Array<{ value: CitationStyle; label: string; description: string }> = [
  { value: "apa", label: "APA 7th", description: "American Psychological Association — common in social sciences." },
  { value: "mla", label: "MLA 9th", description: "Modern Language Association — common in humanities." },
  { value: "chicago", label: "Chicago 17th", description: "Chicago Manual of Style — common in history." },
  { value: "harvard", label: "Harvard", description: "Author-date style — common in UK/Australia." },
];

/** List of source types. */
export const SOURCE_TYPES: Array<{ value: SourceType; label: string }> = [
  { value: "book", label: "Book" },
  { value: "journal", label: "Journal article" },
  { value: "website", label: "Website" },
  { value: "newspaper", label: "Newspaper article" },
  { value: "conference", label: "Conference paper" },
];
