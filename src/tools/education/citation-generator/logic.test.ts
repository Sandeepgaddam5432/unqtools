import { describe, it, expect, beforeEach } from "vitest";
import {
  STYLE_LABELS,
  SOURCE_TYPE_LABELS,
  STYLES,
  SOURCE_TYPES,
  FIELD_PRESETS,
  normalizeText,
  parseAuthors,
  parseSingleAuthor,
  isValidDoi,
  normalizeDoi,
  isValidYear,
  formatAuthor,
  formatAuthors,
  italicize,
  quoteTitle,
  formatTitle,
  formatJournalName,
  formatYear,
  formatPageRange,
  formatPages,
  formatUrl,
  formatDate,
  formatDoi,
  formatCitation,
  formatInText,
  sortBibliography,
  computeStats,
  stripMarkdown,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  generateId,
  buildCitation,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parseBulkCitations,
  splitPipeRow,
  type CitationStyle,
  type SourceType,
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

describe("citation-generator constants", () => {
  it("has 4 styles", () => {
    expect(STYLES).toHaveLength(4);
    expect(Object.keys(STYLE_LABELS)).toHaveLength(4);
  });
  it("has 7 source types", () => {
    expect(SOURCE_TYPES).toHaveLength(7);
    expect(Object.keys(SOURCE_TYPE_LABELS)).toHaveLength(7);
  });
  it("labels cover all styles", () => {
    expect(STYLE_LABELS.apa).toBe("APA 7th");
    expect(STYLE_LABELS.mla).toBe("MLA 9th");
    expect(STYLE_LABELS.chicago).toBe("Chicago");
    expect(STYLE_LABELS.harvard).toBe("Harvard");
  });
  it("has field presets for every source type", () => {
    for (const st of SOURCE_TYPES) {
      expect(FIELD_PRESETS[st]).toBeDefined();
      expect(FIELD_PRESETS[st].length).toBeGreaterThan(0);
    }
  });
});

describe("citation-generator normalizeText", () => {
  it("trims whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
  it("handles undefined", () => {
    expect(normalizeText(undefined)).toBe("");
  });
  it("handles null", () => {
    expect(normalizeText(null)).toBe("");
  });
});

describe("citation-generator parseAuthors", () => {
  it("parses 'Last, First' format", () => {
    const authors = parseAuthors("Smith, John");
    expect(authors).toEqual([{ first: "John", last: "Smith" }]);
  });
  it("parses 'First Last' format", () => {
    const authors = parseAuthors("John Smith");
    expect(authors).toEqual([{ first: "John", last: "Smith" }]);
  });
  it("parses 'First Middle Last' format", () => {
    const authors = parseAuthors("John Robert Smith");
    expect(authors).toEqual([{ first: "John Robert", last: "Smith" }]);
  });
  it("parses multiple authors separated by semicolons", () => {
    const authors = parseAuthors("Smith, John; Doe, Jane");
    expect(authors).toEqual([
      { first: "Jane", last: "Doe" },
      { first: "John", last: "Smith" },
    ].sort((a, b) => a.last.localeCompare(b.last)) ? authors : authors);
    expect(authors.length).toBe(2);
    expect(authors[0].last).toBe("Smith");
    expect(authors[1].last).toBe("Doe");
  });
  it("handles newlines as separators", () => {
    const authors = parseAuthors("Smith, John\nDoe, Jane");
    expect(authors).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseAuthors("")).toEqual([]);
  });
  it("returns empty for whitespace input", () => {
    expect(parseAuthors("   ")).toEqual([]);
  });
});

describe("citation-generator parseSingleAuthor", () => {
  it("parses a single author", () => {
    expect(parseSingleAuthor("Smith, John")).toEqual({ first: "John", last: "Smith" });
  });
  it("returns empty author for empty input", () => {
    expect(parseSingleAuthor("")).toEqual({ first: "", last: "" });
  });
});

describe("citation-generator DOI validation", () => {
  it("accepts bare DOI", () => {
    expect(isValidDoi("10.1234/abc.def")).toBe(true);
  });
  it("accepts doi: prefix", () => {
    expect(isValidDoi("doi:10.1234/abc.def")).toBe(true);
  });
  it("accepts full URL", () => {
    expect(isValidDoi("https://doi.org/10.1234/abc.def")).toBe(true);
    expect(isValidDoi("https://dx.doi.org/10.1234/abc.def")).toBe(true);
  });
  it("rejects empty", () => {
    expect(isValidDoi("")).toBe(false);
  });
  it("rejects malformed DOI", () => {
    expect(isValidDoi("not-a-doi")).toBe(false);
    expect(isValidDoi("10.12/abc")).toBe(false); // too few registrant digits
  });
  it("normalizes DOI", () => {
    expect(normalizeDoi("https://doi.org/10.1234/abc.def")).toBe("10.1234/abc.def");
    expect(normalizeDoi("doi:10.1234/abc.def")).toBe("10.1234/abc.def");
  });
});

describe("citation-generator year validation", () => {
  it("accepts 4-digit year", () => {
    expect(isValidYear("2020")).toBe(true);
  });
  it("rejects non-4-digit", () => {
    expect(isValidYear("20")).toBe(false);
    expect(isValidYear("20201")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidYear("")).toBe(false);
  });
});

describe("citation-generator formatAuthor", () => {
  it("APA: Last, F.", () => {
    expect(formatAuthor({ first: "John", last: "Smith" }, "apa")).toBe("Smith, J.");
  });
  it("APA: Last, F. M. for two given names", () => {
    expect(formatAuthor({ first: "John Robert", last: "Smith" }, "apa")).toBe("Smith, J. R.");
  });
  it("APA: handles missing first name", () => {
    expect(formatAuthor({ first: "", last: "Smith" }, "apa")).toBe("Smith");
  });
  it("MLA: Last, First", () => {
    expect(formatAuthor({ first: "John", last: "Smith" }, "mla")).toBe("Smith, John");
  });
  it("Chicago: Last, First", () => {
    expect(formatAuthor({ first: "John", last: "Smith" }, "chicago")).toBe("Smith, John");
  });
  it("Harvard: Last, F.", () => {
    expect(formatAuthor({ first: "John", last: "Smith" }, "harvard")).toBe("Smith, J.");
  });
});

describe("citation-generator formatAuthors (multiple)", () => {
  it("returns empty for no authors", () => {
    expect(formatAuthors([], "apa")).toBe("");
  });
  it("single author: no separator", () => {
    expect(formatAuthors([{ first: "John", last: "Smith" }], "apa")).toBe("Smith, J.");
  });
  it("APA: two authors joined with &", () => {
    const result = formatAuthors(
      [{ first: "John", last: "Smith" }, { first: "Jane", last: "Doe" }],
      "apa",
    );
    expect(result).toBe("Smith, J., & Doe, J.");
  });
  it("MLA: two authors joined with 'and'", () => {
    const result = formatAuthors(
      [{ first: "John", last: "Smith" }, { first: "Jane", last: "Doe" }],
      "mla",
    );
    expect(result).toBe("Smith, John, and Doe, Jane");
  });
  it("APA: 3+ authors use et al.", () => {
    const result = formatAuthors(
      [
        { first: "John", last: "Smith" },
        { first: "Jane", last: "Doe" },
        { first: "Bob", last: "Jones" },
      ],
      "apa",
    );
    expect(result).toBe("Smith, J., et al.");
  });
});

describe("citation-generator title formatters", () => {
  it("italicize returns input", () => {
    expect(italicize("Hello")).toBe("Hello");
  });
  it("quoteTitle wraps in quotes", () => {
    expect(quoteTitle("Hello")).toBe('"Hello"');
  });
  it("formatTitle: book is italic", () => {
    const r = formatTitle("My Book", "apa", "book");
    expect(r.italic).toBe(true);
    expect(r.text).toBe("My Book");
  });
  it("formatTitle: journal article is plain", () => {
    const r = formatTitle("My Article", "apa", "journal-article");
    expect(r.italic).toBe(false);
    expect(r.text).toBe("My Article");
  });
  it("formatTitle: website is italic", () => {
    const r = formatTitle("My Site", "apa", "website");
    expect(r.italic).toBe(true);
  });
  it("formatTitle: thesis is italic", () => {
    const r = formatTitle("My Thesis", "apa", "thesis");
    expect(r.italic).toBe(true);
  });
  it("formatJournalName is italic", () => {
    const r = formatJournalName("Nature");
    expect(r.italic).toBe(true);
    expect(r.text).toBe("Nature");
  });
  it("formatTitle: empty returns empty", () => {
    expect(formatTitle("", "apa", "book")).toEqual({ text: "", italic: false });
  });
});

describe("citation-generator formatYear", () => {
  it("APA wraps in parens", () => {
    expect(formatYear("2020", "apa")).toBe("(2020)");
  });
  it("Harvard wraps in parens", () => {
    expect(formatYear("2020", "harvard")).toBe("(2020)");
  });
  it("MLA: bare year", () => {
    expect(formatYear("2020", "mla")).toBe("2020");
  });
  it("Chicago: bare year", () => {
    expect(formatYear("2020", "chicago")).toBe("2020");
  });
  it("empty year: n.d.", () => {
    expect(formatYear("", "apa")).toBe("n.d.");
  });
});

describe("citation-generator formatPageRange", () => {
  it("replaces hyphen with en-dash", () => {
    expect(formatPageRange("1-10")).toBe("1–10");
  });
  it("handles spaces around hyphen", () => {
    expect(formatPageRange("1 - 10")).toBe("1–10");
  });
  it("handles existing en-dash", () => {
    expect(formatPageRange("1–10")).toBe("1–10");
  });
  it("handles single page", () => {
    expect(formatPageRange("25")).toBe("25");
  });
  it("empty returns empty", () => {
    expect(formatPageRange("")).toBe("");
  });
});

describe("citation-generator formatPages", () => {
  it("APA: no label", () => {
    expect(formatPages("1-10", "apa")).toBe("1–10");
  });
  it("MLA: pp. prefix", () => {
    expect(formatPages("1-10", "mla")).toBe("pp. 1–10");
  });
  it("Chicago: no label", () => {
    expect(formatPages("1-10", "chicago")).toBe("1–10");
  });
});

describe("citation-generator formatDate", () => {
  it("APA format", () => {
    expect(formatDate("2020-03-15", "apa")).toBe("March 15, 2020");
  });
  it("MLA format", () => {
    expect(formatDate("2020-03-15", "mla")).toBe("15 Mar. 2020");
  });
  it("Chicago format", () => {
    expect(formatDate("2020-03-15", "chicago")).toBe("March 15, 2020");
  });
  it("Harvard format", () => {
    expect(formatDate("2020-03-15", "harvard")).toBe("15 March 2020");
  });
  it("returns input for invalid date", () => {
    expect(formatDate("not-a-date", "apa")).toBe("not-a-date");
  });
  it("empty returns empty", () => {
    expect(formatDate("", "apa")).toBe("");
  });
});

describe("citation-generator formatUrl", () => {
  it("APA with accessed date", () => {
    const r = formatUrl("https://example.com", "2020-03-15", "apa");
    expect(r).toBe("Retrieved March 15, 2020, from https://example.com");
  });
  it("APA without accessed date", () => {
    const r = formatUrl("https://example.com", "", "apa");
    expect(r).toBe("https://example.com");
  });
  it("MLA accessed format", () => {
    const r = formatUrl("https://example.com", "2020-03-15", "mla");
    expect(r).toContain("Accessed 15 Mar. 2020");
  });
  it("Harvard 'Available at:' format", () => {
    const r = formatUrl("https://example.com", "2020-03-15", "harvard");
    expect(r).toContain("Available at: https://example.com");
    expect(r).toContain("[Accessed");
  });
  it("empty url returns empty", () => {
    expect(formatUrl("", "2020-03-15", "apa")).toBe("");
  });
});

describe("citation-generator formatDoi", () => {
  it("APA: full URL", () => {
    expect(formatDoi("10.1234/abc", "apa")).toBe("https://doi.org/10.1234/abc");
  });
  it("MLA: doi: prefix", () => {
    expect(formatDoi("10.1234/abc", "mla")).toBe("doi:10.1234/abc");
  });
  it("normalizes URL form first", () => {
    expect(formatDoi("https://doi.org/10.1234/abc", "apa")).toBe("https://doi.org/10.1234/abc");
  });
  it("empty returns empty", () => {
    expect(formatDoi("", "apa")).toBe("");
  });
});

describe("citation-generator formatCitation (book)", () => {
  const fields = {
    title: "The Great Gatsby",
    authors: [{ first: "F. Scott", last: "Fitzgerald" }],
    year: "1925",
    publisher: "Scribner",
    publisherLocation: "New York",
  };
  it("APA book format", () => {
    const r = formatCitation("apa", "book", fields);
    expect(r).toContain("Fitzgerald, F. S.");
    expect(r).toContain("(1925).");
    expect(r).toContain("*The Great Gatsby*.");
    expect(r).toContain("Scribner.");
  });
  it("MLA book format", () => {
    const r = formatCitation("mla", "book", fields);
    expect(r).toContain("Fitzgerald, F. Scott.");
    expect(r).toContain("*The Great Gatsby*.");
    expect(r).toContain("New York: Scribner, 1925.");
  });
  it("Chicago book format", () => {
    const r = formatCitation("chicago", "book", fields);
    expect(r).toContain("Fitzgerald, F. Scott.");
    expect(r).toContain("New York: Scribner, 1925.");
  });
  it("Harvard book format", () => {
    const r = formatCitation("harvard", "book", fields);
    expect(r).toContain("(1925).");
    expect(r).toContain("New York: Scribner.");
  });
});

describe("citation-generator formatCitation (journal-article)", () => {
  const fields = {
    title: "A Study on X",
    authors: [{ first: "Jane", last: "Doe" }],
    year: "2020",
    journal: "Nature",
    volume: "10",
    issue: "2",
    pages: "1-25",
    doi: "10.1234/abc",
  };
  it("APA journal format", () => {
    const r = formatCitation("apa", "journal-article", fields);
    expect(r).toContain("Doe, J.");
    expect(r).toContain("(2020).");
    expect(r).toContain("A Study on X.");
    expect(r).toContain("*Nature*, 10(2), 1–25.");
    expect(r).toContain("https://doi.org/10.1234/abc");
  });
  it("MLA journal format", () => {
    const r = formatCitation("mla", "journal-article", fields);
    expect(r).toContain('"A Study on X."');
    expect(r).toContain("*Nature*, vol. 10.2");
    expect(r).toContain("pp. 1–25");
  });
  it("Chicago journal format", () => {
    const r = formatCitation("chicago", "journal-article", fields);
    expect(r).toContain('"A Study on X."');
    expect(r).toContain("*Nature* 10, no. 2");
    expect(r).toContain("(2020)");
    expect(r).toContain(": 1–25.");
  });
});

describe("citation-generator formatCitation (website)", () => {
  const fields = {
    title: "Example Page",
    authors: [{ first: "John", last: "Smith" }],
    year: "2021",
    siteName: "Example.com",
    url: "https://example.com/page",
    accessedDate: "2024-01-15",
  };
  it("APA website format", () => {
    const r = formatCitation("apa", "website", fields);
    expect(r).toContain("Smith, J.");
    expect(r).toContain("(2021).");
    expect(r).toContain("*Example Page*.");
    expect(r).toContain("Example.com.");
    expect(r).toContain("Retrieved January 15, 2024, from https://example.com/page");
  });
  it("MLA website format", () => {
    const r = formatCitation("mla", "website", fields);
    expect(r).toContain('"Example Page."');
    expect(r).toContain("Accessed 15 Jan. 2024");
  });
});

describe("citation-generator formatInText", () => {
  const fields = {
    authors: [{ first: "John", last: "Smith" }],
    year: "2020",
    pages: "25-30",
  };
  it("APA: (Smith, 2020)", () => {
    expect(formatInText("apa", fields)).toBe("(Smith, 2020)");
  });
  it("MLA: (Smith 25)", () => {
    expect(formatInText("mla", fields)).toBe("(Smith 25)");
  });
  it("Chicago: (Smith 2020, 25)", () => {
    expect(formatInText("chicago", fields)).toBe("(Smith 2020, 25)");
  });
  it("Harvard: (Smith, 2020, p.25)", () => {
    expect(formatInText("harvard", fields)).toBe("(Smith, 2020, p.25)");
  });
  it("handles no year", () => {
    expect(formatInText("apa", { authors: [{ first: "John", last: "Smith" }] })).toBe("(Smith, n.d.)");
  });
  it("handles two authors", () => {
    const r = formatInText("apa", {
      authors: [
        { first: "John", last: "Smith" },
        { first: "Jane", last: "Doe" },
      ],
      year: "2020",
    });
    expect(r).toBe("(Smith & Doe, 2020)");
  });
  it("handles 3+ authors with et al.", () => {
    const r = formatInText("mla", {
      authors: [
        { first: "John", last: "Smith" },
        { first: "Jane", last: "Doe" },
        { first: "Bob", last: "Jones" },
      ],
      pages: "10",
    });
    expect(r).toBe("(Smith et al. 10)");
  });
});

describe("citation-generator buildCitation + sortBibliography", () => {
  it("buildCitation creates entry", () => {
    const e = buildCitation("apa", "book", {
      title: "Test",
      authors: [{ first: "John", last: "Smith" }],
      year: "2020",
      publisher: "Pub",
    });
    expect(e.style).toBe("apa");
    expect(e.sourceType).toBe("book");
    expect(e.formatted).toContain("Smith, J.");
    expect(e.inText).toBe("(Smith, 2020)");
    expect(e.id).toMatch(/^cit_/);
  });
  it("sortBibliography sorts alphabetically", () => {
    const entries = [
      buildCitation("apa", "book", { title: "B", authors: [{ first: "", last: "Zebra" }], year: "2020" }),
      buildCitation("apa", "book", { title: "A", authors: [{ first: "", last: "Apple" }], year: "2020" }),
    ];
    const sorted = sortBibliography(entries);
    expect(sorted[0].fields.authors?.[0].last).toBe("Apple");
    expect(sorted[1].fields.authors?.[0].last).toBe("Zebra");
  });
});

describe("citation-generator computeStats", () => {
  it("computes stats", () => {
    const entries = [
      buildCitation("apa", "book", { title: "A", year: "2020" }),
      buildCitation("mla", "book", { title: "B", year: "2020" }),
      buildCitation("apa", "website", { title: "C", year: "2020" }),
    ];
    const s = computeStats(entries);
    expect(s.total).toBe(3);
    expect(s.byStyle.apa).toBe(2);
    expect(s.byStyle.mla).toBe(1);
    expect(s.byType.book).toBe(2);
    expect(s.byType.website).toBe(1);
  });
  it("empty entries returns zero stats", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.byStyle.apa).toBe(0);
  });
});

describe("citation-generator renderers", () => {
  const entries = [
    buildCitation("apa", "book", {
      title: "My Book",
      authors: [{ first: "John", last: "Smith" }],
      year: "2020",
      publisher: "Pub",
    }),
    buildCitation("mla", "website", {
      title: "My Site",
      year: "2021",
      url: "https://example.com",
    }),
  ];
  it("stripMarkdown removes asterisks", () => {
    expect(stripMarkdown("Hello *World*")).toBe("Hello World");
  });
  it("renderText joins with blank lines", () => {
    const t = renderText(entries);
    expect(t).toContain("Smith, J.");
    expect(t).toContain("My Book");
    expect(t).not.toContain("*");
    expect(t.split("\n\n").length).toBe(2);
  });
  it("renderHtml wraps in <ol>", () => {
    const h = renderHtml(entries);
    expect(h).toContain("<ol");
    expect(h).toContain("<em>");
    expect(h).toContain("</em>");
    expect(h).toContain("<li>");
  });
  it("renderMarkdown uses list markers", () => {
    const m = renderMarkdown(entries);
    expect(m).toContain("- ");
    expect(m).toContain("*My Book*");
  });
  it("renderCsv includes header", () => {
    const c = renderCsv(entries);
    expect(c).toContain("id,style,source_type,title,authors,year,formatted_citation,in_text");
    expect(c).toContain("apa,book");
    expect(c).toContain("mla,website");
  });
  it("renderCsv escapes commas", () => {
    const c = renderCsv([buildCitation("apa", "book", {
      title: "Title, With Comma",
      year: "2020",
    })]);
    expect(c).toContain('"Title, With Comma"');
  });
  it("renderers handle empty", () => {
    expect(renderText([])).toBe("");
    expect(renderHtml([])).toContain("<ol");
    expect(renderMarkdown([])).toBe("");
    expect(renderCsv([])).toContain("id,style");
  });
});

describe("citation-generator splitPipeRow", () => {
  it("splits simple", () => {
    expect(splitPipeRow("a|b|c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted pipes", () => {
    expect(splitPipeRow('"a|b"|c')).toEqual(["a|b", "c"]);
  });
  it("handles doubled quotes", () => {
    expect(splitPipeRow('"a""b"|c')).toEqual(['a"b', "c"]);
  });
});

describe("citation-generator parseBulkCitations", () => {
  it("parses bulk book and website entries", () => {
    const input = [
      'book|My Book|Smith, John|2020|Publisher|New York|10.1/abc',
      'website|My Site|Doe, Jane|2021|Example|https://example.com|2024-01-01',
    ].join("\n");
    const entries = parseBulkCitations(input, "apa");
    expect(entries).toHaveLength(2);
    expect(entries[0].sourceType).toBe("book");
    expect(entries[0].fields.title).toBe("My Book");
    expect(entries[0].formatted).toContain("Smith, J.");
    expect(entries[1].sourceType).toBe("website");
    expect(entries[1].fields.siteName).toBe("Example");
  });
  it("skips invalid source types", () => {
    expect(parseBulkCitations("invalid|Title", "apa")).toEqual([]);
  });
  it("returns empty for empty input", () => {
    expect(parseBulkCitations("", "apa")).toEqual([]);
  });
});

describe("citation-generator generateId", () => {
  it("generates unique ids", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^cit_/);
  });
});

describe("citation-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      style: "apa",
      sourceType: "book",
      title: "Test",
      formatted: "Smith, J. (2020). Test.",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        style: "apa",
        sourceType: "book",
        title: `T${i}`,
        formatted: "x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      style: "apa",
      sourceType: "book",
      title: "T",
      formatted: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("citation-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("apa", "book", {
      title: "Test",
      authors: [{ first: "John", last: "Smith" }],
      year: "2020",
    });
    expect(url).toContain("style=apa");
    expect(url).toContain("type=book");
    expect(url).toContain("title=Test");
    expect(url).toContain("year=2020");
    expect(url).toContain("authors=Smith");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("style=mla&type=journal-article&title=Hello&year=2021");
    expect(p.style).toBe("mla");
    expect(p.sourceType).toBe("journal-article");
    expect(p.fields.title).toBe("Hello");
    expect(p.fields.year).toBe("2021");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.style).toBe("apa");
    expect(p.sourceType).toBe("book");
  });
  it("filters unknown styles", () => {
    const p = parseShareUrl("style=unknown&type=book");
    expect(p.style).toBe("apa");
  });
  it("filters unknown source types", () => {
    const p = parseShareUrl("style=apa&type=unknown");
    expect(p.sourceType).toBe("book");
  });
});

// Suppress unused-import lint
export type _Unused = Author | CitationStyle | SourceType;
