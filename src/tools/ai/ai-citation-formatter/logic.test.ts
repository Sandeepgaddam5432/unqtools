import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  LIBRARY_KEY,
  HISTORY_MAX,
  LIBRARY_MAX,
  LLM_KEY_STORAGE,
  STYLE_LABELS,
  TYPE_LABELS,
  SORT_LABELS,
  DEFAULT_STYLE,
  DEFAULT_TYPE,
  parseAuthor,
  parseAuthors,
  formatAuthorInitials,
  formatAuthorFull,
  formatAuthorLastFirst,
  formatAuthorsApa,
  formatAuthorsMla,
  formatAuthorsChicago,
  formatAuthorsHarvard,
  formatAuthorsIeee,
  isValidDoi,
  isValidIsbn,
  isValidUrl,
  validateSource,
  formatPageRange,
  formatDate,
  formatYear,
  generateBibtexKey,
  formatReference,
  formatInText,
  formatCitation,
  formatBibliography,
  resetIeeeCounter,
  sortSources,
  renderPlain,
  renderMarkdown,
  renderHtml,
  renderBibtex,
  renderRis,
  renderJson,
  honestyNote,
  loadHistory,
  saveHistory,
  clearHistory,
  loadLibrary,
  saveLibraryEntry,
  removeLibraryEntry,
  clearLibrary,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  generateId,
  type CitationStyle,
  type SourceType,
  type Source,
  type Author,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

function makeBookSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "test-book",
    type: "book",
    title: "The Art of Citation",
    authors: [{ first: "Jane", last: "Doe" }, { first: "John", last: "Smith" }],
    year: "2020",
    publisher: "Academic Press",
    city: "New York",
    isbn: "978-3-16-148410-0",
    ...overrides,
  };
}

function makeJournalSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "test-journal",
    type: "journal",
    title: "On the nature of citations",
    authors: [{ first: "Alice", last: "Wonder" }],
    year: "2021",
    journal: "Journal of Citations",
    volume: "12",
    issue: "3",
    pages: "45-67",
    doi: "10.1234/abcd",
    ...overrides,
  };
}

function makeWebsiteSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "test-website",
    type: "website",
    title: "Citation Guide",
    authors: [],
    year: "2022",
    siteName: "CiteRight",
    url: "https://example.com/guide",
    publishedDate: "2022-05-15",
    accessedDate: "2023-01-10",
    ...overrides,
  };
}

describe("ai-citation-formatter constants", () => {
  it("has 5 citation styles", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(5);
    expect(STYLE_LABELS.apa).toContain("APA");
    expect(STYLE_LABELS.ieee).toContain("IEEE");
  });
  it("has 4 source types", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(4);
  });
  it("has 4 sort modes", () => {
    expect(Object.keys(SORT_LABELS)).toHaveLength(4);
  });
  it("has default style and type", () => {
    expect(DEFAULT_STYLE).toBe("apa");
    expect(DEFAULT_TYPE).toBe("journal");
  });
  it("exposes HISTORY_MAX and LIBRARY_MAX", () => {
    expect(HISTORY_MAX).toBe(20);
    expect(LIBRARY_MAX).toBeGreaterThanOrEqual(50);
  });
  it("exposes storage key constants", () => {
    expect(HISTORY_KEY).toContain("citation-formatter");
    expect(LIBRARY_KEY).toContain("citation-formatter");
    expect(LLM_KEY_STORAGE).toContain("citation-formatter");
  });
});

describe("ai-citation-formatter parseAuthor", () => {
  it("parses 'Last, First'", () => {
    const a = parseAuthor("Doe, Jane");
    expect(a.last).toBe("Doe");
    expect(a.first).toBe("Jane");
  });
  it("parses 'First Last'", () => {
    const a = parseAuthor("Jane Doe");
    expect(a.first).toBe("Jane");
    expect(a.last).toBe("Doe");
  });
  it("parses 'First Middle Last'", () => {
    const a = parseAuthor("Jane Marie Doe");
    expect(a.first).toBe("Jane");
    expect(a.middle).toBe("Marie");
    expect(a.last).toBe("Doe");
  });
  it("parses 'Last, First Middle'", () => {
    const a = parseAuthor("Doe, Jane Marie");
    expect(a.last).toBe("Doe");
    expect(a.first).toBe("Jane");
    expect(a.middle).toBe("Marie");
  });
  it("handles single name", () => {
    const a = parseAuthor("Aristotle");
    expect(a.last).toBe("Aristotle");
    expect(a.first).toBe("");
  });
  it("handles empty", () => {
    const a = parseAuthor("");
    expect(a.last).toBe("");
  });
});

describe("ai-citation-formatter parseAuthors (multi)", () => {
  it("parses newline-separated authors", () => {
    const list = parseAuthors("Doe, Jane\nSmith, John");
    expect(list).toHaveLength(2);
    expect(list[0].last).toBe("Doe");
    expect(list[1].last).toBe("Smith");
  });
  it("parses semicolon-separated authors", () => {
    const list = parseAuthors("Doe, Jane; Smith, John; Brown, Bob");
    expect(list).toHaveLength(3);
  });
  it("skips blank entries", () => {
    const list = parseAuthors("Doe, Jane\n\nSmith, John");
    expect(list).toHaveLength(2);
  });
});

describe("ai-citation-formatter author formatters", () => {
  const a: Author = { first: "Jane", last: "Doe", middle: "Marie" };
  it("formatAuthorInitials produces 'Doe, J. M.'", () => {
    expect(formatAuthorInitials(a)).toBe("Doe, J. M.");
  });
  it("formatAuthorFull produces 'Jane Marie Doe'", () => {
    expect(formatAuthorFull(a)).toBe("Jane Marie Doe");
  });
  it("formatAuthorLastFirst produces 'Doe, Jane Marie'", () => {
    expect(formatAuthorLastFirst(a)).toBe("Doe, Jane Marie");
  });
  it("formatAuthorsApa joins 2 authors with &", () => {
    const out = formatAuthorsApa([
      { first: "Jane", last: "Doe" },
      { first: "John", last: "Smith" },
    ]);
    expect(out).toBe("Doe, J., & Smith, J.");
  });
  it("formatAuthorsApa uses et al. for >20", () => {
    const list: Author[] = Array.from({ length: 21 }, (_, i) => ({
      first: "A", last: `L${i}`,
    }));
    expect(formatAuthorsApa(list)).toBe("L0, A. et al.");
  });
  it("formatAuthorsMla uses et al. for 3+", () => {
    const list = [
      { first: "Jane", last: "Doe" },
      { first: "John", last: "Smith" },
      { first: "Bob", last: "Brown" },
    ];
    expect(formatAuthorsMla(list)).toContain("et al.");
  });
  it("formatAuthorsChicago uses et al. for 4+", () => {
    const list = [
      { first: "A", last: "X" },
      { first: "B", last: "Y" },
      { first: "C", last: "Z" },
    ];
    expect(formatAuthorsChicago(list)).not.toContain("et al.");
    const list4 = [...list, { first: "D", last: "W" }];
    expect(formatAuthorsChicago(list4)).toContain("et al.");
  });
  it("formatAuthorsHarvard uses 'and' between two", () => {
    const out = formatAuthorsHarvard([
      { first: "Jane", last: "Doe" },
      { first: "John", last: "Smith" },
    ]);
    expect(out).toBe("Doe, J. and Smith, J.");
  });
  it("formatAuthorsIeee uses 'F. Last' format", () => {
    const out = formatAuthorsIeee([{ first: "Jane", last: "Doe" }]);
    expect(out).toBe("J. Doe");
  });
  it("formatAuthorsIeee uses et al. for >6", () => {
    const list: Author[] = Array.from({ length: 7 }, (_, i) => ({
      first: "A", last: `L${i}`,
    }));
    expect(formatAuthorsIeee(list)).toContain("et al.");
  });
});

describe("ai-citation-formatter validators", () => {
  it("isValidDoi accepts valid DOI", () => {
    expect(isValidDoi("10.1234/abcd")).toBe(true);
    expect(isValidDoi("10.1000/xyz-123")).toBe(true);
  });
  it("isValidDoi rejects invalid", () => {
    expect(isValidDoi("not-a-doi")).toBe(false);
    expect(isValidDoi("")).toBe(false);
  });
  it("isValidIsbn accepts ISBN-13", () => {
    expect(isValidIsbn("978-3-16-148410-0")).toBe(true);
  });
  it("isValidIsbn accepts ISBN-10", () => {
    expect(isValidIsbn("0-306-40615-2")).toBe(true);
  });
  it("isValidIsbn rejects invalid", () => {
    expect(isValidIsbn("not-isbn")).toBe(false);
  });
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });
  it("isValidUrl rejects non-http", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
  });
});

describe("ai-citation-formatter validateSource", () => {
  it("warns about missing title", () => {
    const w = validateSource({ ...makeBookSource(), title: "" });
    expect(w.some((x) => x.includes("Title is missing"))).toBe(true);
  });
  it("warns about missing authors", () => {
    const w = validateSource({ ...makeBookSource(), authors: [] });
    expect(w.some((x) => x.includes("No authors"))).toBe(true);
  });
  it("warns about missing year", () => {
    const w = validateSource({ ...makeBookSource(), year: "" });
    expect(w.some((x) => x.includes("Year is missing"))).toBe(true);
  });
  it("warns about invalid DOI", () => {
    const w = validateSource({ ...makeJournalSource(), doi: "bad-doi" });
    expect(w.some((x) => x.includes("DOI") && x.includes("format"))).toBe(true);
  });
  it("warns about missing URL for website", () => {
    const w = validateSource({ ...makeWebsiteSource(), url: "" });
    expect(w.some((x) => x.includes("URL is missing for a website"))).toBe(true);
  });
  it("returns empty for a complete source", () => {
    expect(validateSource(makeJournalSource())).toEqual([]);
  });
});

describe("ai-citation-formatter formatPageRange", () => {
  it("APA uses pp. prefix", () => {
    expect(formatPageRange("12-34", "apa")).toBe("pp. 12–34");
  });
  it("MLA uses pp. prefix", () => {
    expect(formatPageRange("12-34", "mla")).toBe("pp. 12–34");
  });
  it("Chicago omits pp.", () => {
    expect(formatPageRange("12-34", "chicago")).toBe("12–34");
  });
  it("empty returns empty", () => {
    expect(formatPageRange("", "apa")).toBe("");
  });
});

describe("ai-citation-formatter formatDate", () => {
  it("APA formats full date", () => {
    expect(formatDate("2021-05-15", "apa")).toBe("2021, May 15");
  });
  it("MLA formats full date", () => {
    expect(formatDate("2021-05-15", "mla")).toBe("15 May 2021");
  });
  it("Chicago uses abbreviated month", () => {
    expect(formatDate("2021-05-15", "chicago")).toBe("May. 15, 2021");
  });
  it("returns year only when no month", () => {
    expect(formatDate("2021", "apa")).toBe("2021");
  });
  it("returns input when not ISO", () => {
    expect(formatDate("May 15 2021", "apa")).toBe("May 15 2021");
  });
});

describe("ai-citation-formatter formatYear", () => {
  it("returns year when present", () => {
    expect(formatYear("2021")).toBe("2021");
  });
  it("returns n.d. when missing", () => {
    expect(formatYear("")).toBe("n.d.");
  });
});

describe("ai-citation-formatter generateBibtexKey", () => {
  it("produces a key starting with author last name + year", () => {
    const key = generateBibtexKey(makeBookSource());
    expect(key.startsWith("doe2020")).toBe(true);
  });
  it("produces unique keys for different sources", () => {
    const k1 = generateBibtexKey(makeBookSource());
    const k2 = generateBibtexKey({ ...makeBookSource(), id: "test-book-2" });
    expect(k1).not.toBe(k2);
  });
});

describe("ai-citation-formatter formatReference (APA)", () => {
  it("formats a book with publisher", () => {
    const ref = formatReference(makeBookSource(), "apa");
    expect(ref).toContain("Doe, J., & Smith, J.");
    expect(ref).toContain("(2020).");
    expect(ref).toContain("*The Art of Citation*");
    expect(ref).toContain("Academic Press");
  });
  it("formats a journal article with volume/issue/pages", () => {
    const ref = formatReference(makeJournalSource(), "apa");
    expect(ref).toContain("Wonder, A.");
    expect(ref).toContain("(2021).");
    expect(ref).toContain("*Journal of Citations*");
    expect(ref).toContain("*12*(3)");
    expect(ref).toContain("pp. 45–67");
    expect(ref).toContain("https://doi.org/10.1234/abcd");
  });
  it("formats a website with URL + accessed date", () => {
    const ref = formatReference(makeWebsiteSource(), "apa");
    expect(ref).toContain("*Citation Guide*");
    expect(ref).toContain("CiteRight");
    expect(ref).toContain("https://example.com/guide");
  });
});

describe("ai-citation-formatter formatReference (MLA)", () => {
  it("formats a book in MLA", () => {
    const ref = formatReference(makeBookSource(), "mla");
    expect(ref).toContain("Doe, Jane, and John Smith.");
    expect(ref).toContain('"The Art of Citation."');
    expect(ref).toContain("Academic Press");
  });
  it("formats a journal article in MLA with vol/no", () => {
    const ref = formatReference(makeJournalSource(), "mla");
    expect(ref).toContain("vol. 12");
    expect(ref).toContain("no. 3");
    expect(ref).toContain("pp. 45–67");
  });
});

describe("ai-citation-formatter formatReference (Chicago)", () => {
  it("formats a book in Chicago", () => {
    const ref = formatReference(makeBookSource(), "chicago");
    expect(ref).toContain("Doe, Jane, and John Smith.");
    expect(ref).toContain("*The Art of Citation*.");
    expect(ref).toContain("New York:");
    expect(ref).toContain("Academic Press,");
  });
});

describe("ai-citation-formatter formatReference (Harvard)", () => {
  it("formats a book in Harvard", () => {
    const ref = formatReference(makeBookSource(), "harvard");
    expect(ref).toContain("Doe, J. and Smith, J.");
    expect(ref).toContain("(2020).");
    expect(ref).toContain("*The Art of Citation*.");
    expect(ref).toContain("Academic Press.");
  });
});

describe("ai-citation-formatter formatReference (IEEE)", () => {
  it("formats a book in IEEE with [1] prefix", () => {
    resetIeeeCounter();
    const ref = formatReference(makeBookSource(), "ieee");
    expect(ref.startsWith("[1]")).toBe(true);
    expect(ref).toContain("J. Doe");
    expect(ref).toContain("J. Smith");
  });
  it("increments IEEE counter", () => {
    resetIeeeCounter();
    formatReference(makeBookSource(), "ieee");
    const ref2 = formatReference(makeJournalSource(), "ieee");
    expect(ref2.startsWith("[2]")).toBe(true);
  });
});

describe("ai-citation-formatter formatInText", () => {
  it("APA in-text is (Author, year)", () => {
    const it = formatInText(makeJournalSource(), "apa");
    expect(it).toBe("(Wonder, 2021)");
  });
  it("APA in-text uses et al. for 3+", () => {
    const it = formatInText({
      ...makeJournalSource(),
      authors: [
        { first: "A", last: "Wonder" },
        { first: "B", last: "Smith" },
        { first: "C", last: "Brown" },
      ],
    }, "apa");
    expect(it).toContain("Wonder et al.");
  });
  it("MLA in-text is (Author page)", () => {
    const it = formatInText(makeJournalSource(), "mla");
    expect(it).toBe("(Wonder 45)");
  });
  it("Chicago in-text is (Author year, page)", () => {
    const it = formatInText(makeJournalSource(), "chicago");
    expect(it).toBe("(Wonder 2021, 45)");
  });
  it("Harvard in-text is (Author, year, p. page)", () => {
    const it = formatInText(makeJournalSource(), "harvard");
    expect(it).toBe("(Wonder, 2021, p. 45)");
  });
});

describe("ai-citation-formatter formatCitation (top-level)", () => {
  it("returns reference + inText + bibtexKey + warnings", () => {
    const c = formatCitation(makeJournalSource(), "apa");
    expect(c.style).toBe("apa");
    expect(c.type).toBe("journal");
    expect(c.reference).toContain("Wonder");
    expect(c.inText).toContain("Wonder");
    expect(c.bibtexKey.length).toBeGreaterThan(0);
    expect(Array.isArray(c.warnings)).toBe(true);
  });
  it("IEEE citation uses [1] for in-text of a single source", () => {
    resetIeeeCounter();
    const c = formatCitation(makeJournalSource(), "ieee");
    expect(c.inText).toBe("[1]");
  });
});

describe("ai-citation-formatter formatBibliography", () => {
  it("formats a list of sources", () => {
    resetIeeeCounter();
    const bib = formatBibliography([
      makeJournalSource(),
      makeBookSource(),
    ], "apa");
    expect(bib).toHaveLength(2);
    expect(bib[0].style).toBe("apa");
  });
  it("IEEE bibliography assigns sequential numbers", () => {
    resetIeeeCounter();
    const bib = formatBibliography([
      makeJournalSource(),
      makeBookSource(),
    ], "ieee");
    expect(bib[0].reference.startsWith("[1]")).toBe(true);
    expect(bib[1].reference.startsWith("[2]")).toBe(true);
  });
});

describe("ai-citation-formatter sortSources", () => {
  it("sorts alphabetically by author last name", () => {
    const sorted = sortSources([
      makeBookSource({ authors: [{ first: "Z", last: "Zebra" }] }),
      makeJournalSource({ authors: [{ first: "A", last: "Apple" }] }),
    ], "alpha");
    expect(sorted[0].authors[0].last).toBe("Apple");
  });
  it("sorts by year ascending", () => {
    const sorted = sortSources([
      makeJournalSource({ year: "2021" }),
      makeBookSource({ year: "2019" }),
    ], "year-asc");
    expect(sorted[0].year).toBe("2019");
  });
  it("sorts by year descending", () => {
    const sorted = sortSources([
      makeBookSource({ year: "2019" }),
      makeJournalSource({ year: "2021" }),
    ], "year-desc");
    expect(sorted[0].year).toBe("2021");
  });
  it("sorts by type", () => {
    const sorted = sortSources([
      makeJournalSource(),
      makeBookSource(),
    ], "type");
    expect(sorted[0].type).toBe("book");
    expect(sorted[1].type).toBe("journal");
  });
});

describe("ai-citation-formatter renderers", () => {
  const bib = formatBibliography([makeJournalSource(), makeBookSource()], "apa");
  const sources = [makeJournalSource(), makeBookSource()];

  it("renderPlain joins references with blank lines", () => {
    const txt = renderPlain(bib);
    expect(txt.split("\n\n").length).toBe(2);
  });
  it("renderMarkdown includes '## References' header", () => {
    const md = renderMarkdown(bib);
    expect(md).toContain("## References");
    expect(md).toContain("In-text:");
  });
  it("renderMarkdown includes warnings when present", () => {
    const cite = formatCitation({ ...makeBookSource(), year: "" }, "apa");
    const md = renderMarkdown([cite]);
    expect(md).toContain("⚠");
  });
  it("renderHtml produces <ol> with <li>", () => {
    const html = renderHtml(bib);
    expect(html).toContain("<ol");
    expect(html).toContain("<li>");
  });
  it("renderBibtex produces @article / @book entries", () => {
    const bibTex = renderBibtex(bib, sources);
    expect(bibTex).toContain("@article{");
    expect(bibTex).toContain("@book{");
    expect(bibTex).toContain("title =");
  });
  it("renderRis produces TY/ER records", () => {
    const ris = renderRis(bib, sources);
    expect(ris).toContain("TY  - JOUR");
    expect(ris).toContain("TY  - BOOK");
    expect(ris).toContain("ER  -");
  });
  it("renderJson produces valid JSON", () => {
    const json = renderJson(bib, sources, "apa");
    const parsed = JSON.parse(json);
    expect(parsed.style).toBe("apa");
    expect(parsed.citations).toHaveLength(2);
  });
  it("renderMarkdown handles empty list", () => {
    expect(renderMarkdown([])).toContain("No references");
  });
  it("honestyNote mentions Purdue OWL", () => {
    expect(honestyNote()).toContain("Purdue OWL");
  });
});

describe("ai-citation-formatter history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, style: "apa", type: "journal", title: "T" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, style: "apa", type: "journal", title: `T${i}` });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, style: "apa", type: "journal", title: "T" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-citation-formatter library (localStorage)", () => {
  it("loads empty initially", () => { expect(loadLibrary()).toEqual([]); });
  it("saves and loads (dedup by id)", () => {
    saveLibraryEntry(makeJournalSource());
    saveLibraryEntry(makeJournalSource()); // same id — should replace, not duplicate
    expect(loadLibrary()).toHaveLength(1);
  });
  it("removes by id", () => {
    saveLibraryEntry(makeJournalSource());
    removeLibraryEntry("test-journal");
    expect(loadLibrary()).toEqual([]);
  });
  it("clears", () => {
    saveLibraryEntry(makeJournalSource());
    clearLibrary();
    expect(loadLibrary()).toEqual([]);
  });
});

describe("ai-citation-formatter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeJournalSource(), "apa");
    expect(url).toContain("style=apa");
    expect(url).toContain("type=journal");
    expect(url).toContain("title=");
    expect(url).toContain("doi=10.1234");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to source", () => {
    const url = buildShareUrl(makeJournalSource(), "mla");
    const hash = url.split(/[?#]/)[1] ?? "";
    const parsed = parseShareUrl(hash);
    expect(parsed.style).toBe("mla");
    expect(parsed.source?.type).toBe("journal");
    expect(parsed.source?.title).toBe("On the nature of citations");
    expect(parsed.source?.doi).toBe("10.1234/abcd");
    expect(parsed.source?.authors?.length).toBe(1);
    expect(parsed.source?.authors?.[0].last).toBe("Wonder");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown style/type", () => {
    const p = parseShareUrl("style=bogus&type=also-bogus&title=Foo");
    expect(p.style).toBeUndefined();
    expect(p.source?.type).toBeUndefined();
    expect(p.source?.title).toBe("Foo");
  });
});

describe("ai-citation-formatter LLM", () => {
  it("buildLlmPrompt includes style + source title", () => {
    const prompt = buildLlmPrompt(makeJournalSource(), "apa");
    expect(prompt).toContain("APA 7th edition");
    expect(prompt).toContain("On the nature of citations");
    expect(prompt).toContain("refinedTitle");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      refinedTitle: "On the Nature of Citations",
      suggestedAuthors: ["Wonder, Alice"],
      notes: ["Italicize journal title in APA."],
      missingFields: [],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedTitle).toContain("Nature of Citations");
      expect(r.result.suggestedAuthors).toEqual(["Wonder, Alice"]);
      expect(r.result.notes).toHaveLength(1);
    }
  });
  it("renderLlmResult strips ```json fences", () => {
    const raw = "```json\n" + JSON.stringify({
      refinedTitle: "x", suggestedAuthors: [], notes: [], missingFields: [],
    }) + "\n```";
    expect(renderLlmResult(raw).ok).toBe(true);
  });
  it("renderLlmResult rejects invalid JSON", () => {
    expect(renderLlmResult("not json").ok).toBe(false);
  });
  it("renderLlmResult rejects non-object JSON", () => {
    expect(renderLlmResult("[1,2,3]").ok).toBe(false);
  });
});

describe("ai-citation-formatter generateId", () => {
  it("produces unique IDs", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a.startsWith("src_")).toBe(true);
  });
});

// Suppress unused-import lint for type re-exports
export type _Unused = CitationStyle | SourceType | Source | Author;
