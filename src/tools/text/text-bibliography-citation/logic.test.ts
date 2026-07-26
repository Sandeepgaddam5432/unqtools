import { describe, it, expect } from "vitest";
import {
  formatAuthorApa, formatAuthorsApa, formatAuthorsMla, formatAuthorsChicago,
  formatAuthorsHarvard, citeApa, citeMla, citeChicago, citeHarvard,
  generateCitation, italicize, inTextCitation, validateSource, buildBibliography,
  sampleSource, STYLES, SOURCE_TYPES,
} from "./logic";

const bookSource = {
  type: "book" as const,
  authors: [{ firstName: "Neil", lastName: "Gaiman" }],
  title: "American Gods",
  year: 2001,
  publisher: "HarperCollins",
  city: "New York",
};

const multiAuthor = {
  type: "book" as const,
  authors: [
    { firstName: "John", lastName: "Smith" },
    { firstName: "Jane", lastName: "Doe" },
  ],
  title: "Multi Author Book",
  year: 2020,
  publisher: "Pub",
};

const journalSource = {
  type: "journal" as const,
  authors: [{ firstName: "A", lastName: "Researcher" }],
  title: "A Study",
  year: 2023,
  journal: "Journal of Things",
  volume: 12,
  issue: 3,
  pages: "45-67",
};

describe("formatAuthorApa", () => {
  it("formats single name", () => {
    expect(formatAuthorApa({ firstName: "Neil", lastName: "Gaiman" })).toBe("Gaiman, N.");
  });
  it("handles multi-word first name", () => {
    expect(formatAuthorApa({ firstName: "Mary Jane", lastName: "Watson" })).toBe("Watson, M. J.");
  });
});

describe("formatAuthorsApa", () => {
  it("single author", () => {
    expect(formatAuthorsApa([{ firstName: "A", lastName: "B" }])).toBe("B, A.");
  });
  it("two authors with ampersand", () => {
    const r = formatAuthorsApa([{ firstName: "A", lastName: "B" }, { firstName: "C", lastName: "D" }]);
    expect(r).toContain("&");
  });
  it("empty returns empty", () => {
    expect(formatAuthorsApa([])).toBe("");
  });
});

describe("formatAuthorsMla", () => {
  it("single author 'Last, First'", () => {
    expect(formatAuthorsMla([{ firstName: "Neil", lastName: "Gaiman" }])).toBe("Gaiman, Neil");
  });
  it("two authors with 'and'", () => {
    const r = formatAuthorsMla([{ firstName: "A", lastName: "B" }, { firstName: "C", lastName: "D" }]);
    expect(r).toContain("and C D");
  });
  it("3+ uses et al.", () => {
    const r = formatAuthorsMla([
      { firstName: "A", lastName: "B" },
      { firstName: "C", lastName: "D" },
      { firstName: "E", lastName: "F" },
    ]);
    expect(r).toContain("et al.");
  });
});

describe("formatAuthorsChicago", () => {
  it("single author", () => {
    expect(formatAuthorsChicago([{ firstName: "A", lastName: "B" }])).toBe("B, A");
  });
  it("et al. for 4+", () => {
    const r = formatAuthorsChicago([
      { firstName: "A", lastName: "B" },
      { firstName: "C", lastName: "D" },
      { firstName: "E", lastName: "F" },
      { firstName: "G", lastName: "H" },
    ]);
    expect(r).toContain("et al.");
  });
});

describe("formatAuthorsHarvard", () => {
  it("single author", () => {
    expect(formatAuthorsHarvard([{ firstName: "A", lastName: "B" }])).toBe("B, A.");
  });
  it("two authors with 'and'", () => {
    const r = formatAuthorsHarvard([{ firstName: "A", lastName: "B" }, { firstName: "C", lastName: "D" }]);
    expect(r).toContain("and");
  });
});

describe("citeApa", () => {
  it("formats book", () => {
    const c = citeApa(bookSource);
    expect(c).toContain("Gaiman");
    expect(c).toContain("(2001)");
    expect(c).toContain("*American Gods*");
  });
  it("formats journal", () => {
    const c = citeApa(journalSource);
    expect(c).toContain("12(3)");
    expect(c).toContain("45-67");
  });
});

describe("citeMla", () => {
  it("formats book", () => {
    const c = citeMla(bookSource);
    expect(c).toContain("Gaiman, Neil");
    expect(c).toContain("HarperCollins");
  });
});

describe("citeChicago", () => {
  it("formats book with city", () => {
    const c = citeChicago(bookSource);
    expect(c).toContain("New York");
    expect(c).toContain("HarperCollins");
  });
});

describe("citeHarvard", () => {
  it("formats book", () => {
    const c = citeHarvard(bookSource);
    expect(c).toContain("(2001)");
    expect(c).toContain("HarperCollins");
  });
});

describe("generateCitation", () => {
  it("dispatches by style", () => {
    const apa = generateCitation(bookSource, "apa");
    const mla = generateCitation(bookSource, "mla");
    expect(apa).not.toBe(mla);
  });
});

describe("italicize & inTextCitation", () => {
  it("wraps text with asterisks", () => {
    expect(italicize("Title")).toBe("*Title*");
  });
  it("empty returns empty", () => {
    expect(italicize("")).toBe("");
  });
  it("APA in-text", () => {
    expect(inTextCitation(bookSource, "apa")).toBe("(Gaiman, 2001)");
  });
  it("MLA in-text", () => {
    const r = inTextCitation({ ...bookSource, pages: "23" }, "mla");
    expect(r).toContain("Gaiman");
  });
});

describe("validateSource", () => {
  it("accepts valid source", () => {
    expect(validateSource(bookSource).ok).toBe(true);
  });
  it("rejects missing authors", () => {
    expect(validateSource({ ...bookSource, authors: [] }).ok).toBe(false);
  });
  it("rejects missing title", () => {
    expect(validateSource({ ...bookSource, title: "" }).ok).toBe(false);
  });
  it("rejects bad year", () => {
    expect(validateSource({ ...bookSource, year: 1000 }).ok).toBe(false);
  });
});

describe("buildBibliography", () => {
  it("sorts alphabetically", () => {
    const bib = buildBibliography([
      { type: "book", authors: [{ firstName: "Z", lastName: "Zimmer" }], title: "Z", year: 2020 },
      { type: "book", authors: [{ firstName: "A", lastName: "Adams" }], title: "A", year: 2020 },
    ], "apa");
    expect(bib[0]).toContain("Adams");
  });
  it("returns citations in chosen style", () => {
    const bib = buildBibliography([bookSource], "mla");
    expect(bib.length).toBe(1);
    expect(bib[0]).toContain("Gaiman");
  });
});

describe("sampleSource & constants", () => {
  it("returns a book source", () => {
    const s = sampleSource();
    expect(s.type).toBe("book");
    expect(s.authors.length).toBeGreaterThan(0);
  });
  it("STYLES has 4 entries", () => {
    expect(STYLES.length).toBe(4);
  });
  it("SOURCE_TYPES has 5 entries", () => {
    expect(SOURCE_TYPES.length).toBe(5);
  });
});
