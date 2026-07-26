/**
 * Bibliography Generator — pure logic.
 * Generate APA, MLA, Chicago, Harvard style citations from source metadata.
 */

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard";
export type SourceType = "book" | "journal" | "website" | "newspaper" | "magazine" | "conference";

export interface Source {
  type: SourceType;
  authors: { first: string; last: string; middle?: string }[];
  year: string;
  title: string;
  // Book
  publisher?: string;
  publisherLocation?: string;
  edition?: string;
  pages?: string;
  // Journal / magazine / newspaper
  journal?: string;
  volume?: string;
  issue?: string;
  doi?: string;
  // Website
  url?: string;
  accessedDate?: string;
  siteName?: string;
  // Conference
  conference?: string;
  // For newspapers
  day?: string;
  month?: string;
}

export interface CitationResult {
  style: CitationStyle;
  inText: string;
  reference: string;
  warnings: string[];
}

/** Format author list for APA: "Last, F. M." format. */
export function formatAuthorsApa(authors: { first: string; last: string; middle?: string }[]): string {
  if (authors.length === 0) return "";
  const fmt = (a: { first: string; last: string; middle?: string }) => {
    const initials = [a.first[0], a.middle?.[0]].filter(Boolean).map((c) => `${c}.`).join(" ");
    return `${a.last}, ${initials}`;
  };
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length === 2) return `${fmt(authors[0])}, & ${fmt(authors[1])}`;
  if (authors.length <= 20) return authors.slice(0, -1).map(fmt).join(", ") + `, & ${fmt(authors[authors.length - 1])}`;
  return authors.slice(0, 19).map(fmt).join(", ") + `... ${fmt(authors[authors.length - 1])}`;
}

/** Format author list for MLA: "Last, First, and First Last." format. */
export function formatAuthorsMla(authors: { first: string; last: string; middle?: string }[]): string {
  if (authors.length === 0) return "";
  const fmt = (a: { first: string; last: string; middle?: string }) => `${a.last}, ${a.first}${a.middle ? " " + a.middle : ""}`;
  if (authors.length === 1) return fmt(authors[0]) + ".";
  if (authors.length === 2) return `${fmt(authors[0])}, and ${authors[1].first}${authors[1].middle ? " " + authors[1].middle : ""} ${authors[1].last}.`;
  return `${fmt(authors[0])}, et al.`;
}

/** Format author list for Chicago: "Last, First, and First Last." format. */
export function formatAuthorsChicago(authors: { first: string; last: string; middle?: string }[]): string {
  if (authors.length === 0) return "";
  const fmt = (a: { first: string; last: string; middle?: string }) => `${a.last}, ${a.first}${a.middle ? " " + a.middle : ""}`;
  if (authors.length === 1) return fmt(authors[0]) + ".";
  if (authors.length === 2) return `${fmt(authors[0])}, and ${authors[1].first}${authors[1].middle ? " " + authors[1].middle : ""} ${authors[1].last}.`;
  if (authors.length <= 3) return authors.slice(0, -1).map(fmt).join(", ") + `, and ${authors[authors.length - 1].first}${authors[authors.length - 1].middle ? " " + authors[authors.length - 1].middle : ""} ${authors[authors.length - 1].last}.`;
  return `${fmt(authors[0])} et al.`;
}

/** Format author list for Harvard: "Last, F.M." format. */
export function formatAuthorsHarvard(authors: { first: string; last: string; middle?: string }[]): string {
  if (authors.length === 0) return "";
  const fmt = (a: { first: string; last: string; middle?: string }) => {
    const initials = [a.first[0], a.middle?.[0]].filter(Boolean).map((c) => `${c}.`).join("");
    return `${a.last}, ${initials}`;
  };
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length === 2) return `${fmt(authors[0])} and ${fmt(authors[1])}`;
  return authors.slice(0, -1).map(fmt).join(", ") + ` and ${fmt(authors[authors.length - 1])}`;
}

export function formatCitation(source: Source, style: CitationStyle): CitationResult {
  const warnings: string[] = [];
  if (!source.title) warnings.push("Missing title.");
  if (source.authors.length === 0) warnings.push("No authors specified.");
  if (!source.year) warnings.push("Missing year.");

  let reference = "";
  let inText = "";

  if (style === "apa") {
    const authors = formatAuthorsApa(source.authors);
    switch (source.type) {
      case "book":
        reference = `${authors} (${source.year}). ${source.title}${source.edition ? ` (${source.edition} ed.)` : ""}. ${source.publisher}.`;
        break;
      case "journal":
        reference = `${authors} (${source.year}). ${source.title}. ${source.journal}, ${source.volume || ""}${source.issue ? `(${source.issue})` : ""}${source.pages ? `, ${source.pages}` : ""}.${source.doi ? ` https://doi.org/${source.doi}` : ""}`;
        break;
      case "website":
        reference = `${authors || source.siteName || ""} (${source.year}). ${source.title}. ${source.siteName || ""}. ${source.url || ""}${source.accessedDate ? ` (Accessed ${source.accessedDate})` : ""}`;
        break;
      case "newspaper":
        reference = `${authors} (${source.year}). ${source.title}. ${source.journal || ""}${source.day ? `, ${source.day} ${source.month || ""}` : ""}, ${source.pages || ""}.`;
        break;
      default:
        reference = `${authors} (${source.year}). ${source.title}.`;
    }
    inText = `(${source.authors[0]?.last ?? "Anon"}, ${source.year})`;
  } else if (style === "mla") {
    const authors = formatAuthorsMla(source.authors);
    switch (source.type) {
      case "book":
        reference = `${authors} ${source.title}. ${source.edition ? `${source.edition} ed., ` : ""}${source.publisher}, ${source.year}.`;
        break;
      case "journal":
        reference = `${authors} "${source.title}." ${source.journal}, vol. ${source.volume || ""}${source.issue ? `, no. ${source.issue}` : ""}, ${source.year}, pp. ${source.pages || ""}.${source.doi ? ` doi:${source.doi}` : ""}`;
        break;
      case "website":
        reference = `${authors} "${source.title}." ${source.siteName || ""}, ${source.year}, ${source.url || ""}.${source.accessedDate ? ` Accessed ${source.accessedDate}.` : ""}`;
        break;
      default:
        reference = `${authors} ${source.title}. ${source.year}.`;
    }
    inText = `(${source.authors[0]?.last ?? "Anon"} ${source.pages ? source.pages : ""})`;
  } else if (style === "chicago") {
    const authors = formatAuthorsChicago(source.authors);
    switch (source.type) {
      case "book":
        reference = `${authors} ${source.title}. ${source.edition ? `${source.edition} ed. ` : ""}${source.publisherLocation ? `${source.publisherLocation}: ` : ""}${source.publisher}, ${source.year}.`;
        break;
      case "journal":
        reference = `${authors} "${source.title}." ${source.journal} ${source.volume || ""}, no. ${source.issue || ""} (${source.year}): ${source.pages || ""}.`;
        break;
      case "website":
        reference = `${authors} "${source.title}." ${source.siteName || ""}, ${source.year}. ${source.url || ""}.`;
        break;
      default:
        reference = `${authors} ${source.title}. ${source.year}.`;
    }
    inText = `(Last ${source.year}, ${source.pages || ""})`;
  } else { // harvard
    const authors = formatAuthorsHarvard(source.authors);
    switch (source.type) {
      case "book":
        reference = `${authors} ${source.year}, ${source.title}. ${source.edition ? `${source.edition} ed. ` : ""}${source.publisher}, ${source.publisherLocation || ""}.`;
        break;
      case "journal":
        reference = `${authors} ${source.year}, '${source.title}', ${source.journal}, vol. ${source.volume || ""}, no. ${source.issue || ""}, pp. ${source.pages || ""}.${source.doi ? ` doi: ${source.doi}` : ""}`;
        break;
      case "website":
        reference = `${authors || source.siteName || ""} ${source.year}, ${source.title}, ${source.siteName || ""}, viewed ${source.accessedDate || ""}, <${source.url || ""}>.`;
        break;
      default:
        reference = `${authors} ${source.year}, ${source.title}.`;
    }
    inText = `(Last ${source.year})`;
  }

  return { style, inText, reference, warnings };
}

export interface BibliographyJob {
  sources: Source[];
  style: CitationStyle;
}

export interface BibliographyResult {
  job: BibliographyJob;
  entries: CitationResult[];
  warnings: string[];
  notes: string[];
}

export function planBibliography(job: BibliographyJob): BibliographyResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (job.sources.length === 0) warnings.push("No sources provided.");
  const entries = job.sources.map((s) => formatCitation(s, job.style));

  // Sort entries alphabetically by first author's last name (MLA / APA / Chicago style)
  // (caller can sort if needed)

  notes.push(`Generated ${entries.length} ${job.style.toUpperCase()} citation(s).`);
  if (job.style === "apa") notes.push("APA 7th edition format applied.");
  if (job.style === "mla") notes.push("MLA 9th edition format applied.");
  if (job.style === "chicago") notes.push("Chicago 17th edition (notes-bibliography) format applied.");
  if (job.style === "harvard") notes.push("Harvard referencing style applied.");

  return { job, entries, warnings, notes };
}

export function planBatch(jobs: BibliographyJob[]): BibliographyResult[] {
  return jobs.map(planBibliography);
}

export function renderBatchCsv(results: BibliographyResult[]): string {
  const lines: string[] = ["index,style,entry_count"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), r.job.style, String(r.entries.length)].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: BibliographyResult): string {
  const lines: string[] = [];
  lines.push(`Bibliography Report (${r.job.style.toUpperCase()})`);
  lines.push("=".repeat(30));
  lines.push(`Sources: ${r.entries.length}`);
  lines.push("");
  lines.push("References:");
  r.entries.forEach((e, i) => {
    lines.push(`  ${i + 1}. ${e.reference}`);
    lines.push(`     In-text: ${e.inText}`);
  });
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Render the full bibliography as plain text. */
export function renderBibliographyText(r: BibliographyResult): string {
  return r.entries.map((e) => e.reference).join("\n\n");
}

export const BIBLIOGRAPHY_PRESETS = [
  {
    id: "book-apa", label: "Book (APA)", source: {
      type: "book" as SourceType,
      authors: [{ first: "J", last: "Smith" }, { first: "R", last: "Jones" }],
      year: "2023", title: "The Art of Programming", publisher: "Tech Books", edition: "2nd",
    } as Source,
  },
  {
    id: "journal-mla", label: "Journal (MLA)", source: {
      type: "journal" as SourceType,
      authors: [{ first: "Mary", last: "Doe" }],
      year: "2022", title: "Quantum Computing Advances", journal: "Nature", volume: "15", issue: "3", pages: "100-115", doi: "10.1000/xyz123",
    } as Source,
  },
  {
    id: "website-chicago", label: "Website (Chicago)", source: {
      type: "website" as SourceType,
      authors: [{ first: "A", last: "Author" }],
      year: "2024", title: "Modern Web Design", siteName: "WebDev.com", url: "https://webdev.com/article", accessedDate: "March 15, 2024",
    } as Source,
  },
];

export function getBibliographyPresets() { return [...BIBLIOGRAPHY_PRESETS]; }
