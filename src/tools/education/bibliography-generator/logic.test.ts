import { describe, it, expect } from "vitest";
import {
  formatAuthorsApa, formatAuthorsMla, formatAuthorsChicago, formatAuthorsHarvard,
  formatCitation, planBibliography, planBatch, renderBatchCsv, renderReport,
  renderBibliographyText, getBibliographyPresets, type Source,
} from "./logic";

describe("bibliography-generator formatAuthorsApa", () => {
  it("formats single author", () => {
    expect(formatAuthorsApa([{ first: "John", last: "Smith" }])).toBe("Smith, J.");
  });
  it("formats two authors with &", () => {
    expect(formatAuthorsApa([{ first: "John", last: "Smith" }, { first: "Jane", last: "Doe" }])).toBe("Smith, J., & Doe, J.");
  });
  it("formats three authors with commas and &", () => {
    expect(formatAuthorsApa([{ first: "A", last: "X" }, { first: "B", last: "Y" }, { first: "C", last: "Z" }])).toBe("X, A., Y, B., & Z, C.");
  });
  it("handles middle initial", () => {
    expect(formatAuthorsApa([{ first: "John", last: "Smith", middle: "Robert" }])).toBe("Smith, J. R.");
  });
  it("returns empty for no authors", () => {
    expect(formatAuthorsApa([])).toBe("");
  });
});

describe("bibliography-generator formatAuthorsMla", () => {
  it("formats single author with period", () => {
    expect(formatAuthorsMla([{ first: "John", last: "Smith" }])).toBe("Smith, John.");
  });
  it("formats two authors with 'and'", () => {
    expect(formatAuthorsMla([{ first: "John", last: "Smith" }, { first: "Jane", last: "Doe" }])).toBe("Smith, John, and Jane Doe.");
  });
  it("uses et al. for 3+ authors", () => {
    expect(formatAuthorsMla([{ first: "A", last: "X" }, { first: "B", last: "Y" }, { first: "C", last: "Z" }])).toContain("et al.");
  });
});

describe("bibliography-generator formatAuthorsChicago", () => {
  it("formats single author", () => {
    expect(formatAuthorsChicago([{ first: "John", last: "Smith" }])).toBe("Smith, John.");
  });
  it("uses et al. for 4+ authors", () => {
    const authors = [{ first: "A", last: "X" }, { first: "B", last: "Y" }, { first: "C", last: "Z" }, { first: "D", last: "W" }];
    expect(formatAuthorsChicago(authors)).toContain("et al.");
  });
});

describe("bibliography-generator formatAuthorsHarvard", () => {
  it("formats single author with no space between initials", () => {
    expect(formatAuthorsHarvard([{ first: "John", last: "Smith", middle: "Robert" }])).toBe("Smith, J.R.");
  });
  it("uses 'and' for two authors", () => {
    expect(formatAuthorsHarvard([{ first: "John", last: "Smith" }, { first: "Jane", last: "Doe" }])).toBe("Smith, J. and Doe, J.");
  });
});

describe("bibliography-generator formatCitation", () => {
  const bookSource: Source = {
    type: "book", authors: [{ first: "John", last: "Smith" }],
    year: "2023", title: "Test Book", publisher: "Test Publisher",
  };
  it("formats APA book citation", () => {
    const c = formatCitation(bookSource, "apa");
    expect(c.reference).toContain("Smith, J.");
    expect(c.reference).toContain("(2023)");
    expect(c.reference).toContain("Test Book");
    expect(c.inText).toBe("(Smith, 2023)");
  });
  it("formats MLA book citation", () => {
    const c = formatCitation(bookSource, "mla");
    expect(c.reference).toContain("Smith, John.");
    expect(c.reference).toContain("Test Publisher");
  });
  it("formats Chicago book citation", () => {
    const c = formatCitation(bookSource, "chicago");
    expect(c.reference).toContain("Test Publisher");
    expect(c.reference).toContain("2023.");
  });
  it("formats Harvard book citation", () => {
    const c = formatCitation(bookSource, "harvard");
    expect(c.reference).toContain("Test Publisher");
  });
  it("warns on missing fields", () => {
    const c = formatCitation({ type: "book", authors: [], year: "", title: "" }, "apa");
    expect(c.warnings.length).toBeGreaterThan(0);
  });
});

describe("bibliography-generator planBibliography", () => {
  it("plans bibliography for multiple sources", () => {
    const r = planBibliography({
      style: "apa",
      sources: [
        { type: "book", authors: [{ first: "A", last: "X" }], year: "2020", title: "Book 1", publisher: "P1" },
        { type: "journal", authors: [{ first: "B", last: "Y" }], year: "2021", title: "Article 1", journal: "J1", volume: "1", pages: "1-10" },
      ],
    });
    expect(r.entries.length).toBe(2);
    expect(r.notes.length).toBeGreaterThan(0);
  });
  it("warns on empty sources", () => {
    const r = planBibliography({ style: "apa", sources: [] });
    expect(r.warnings.some((w) => w.includes("No sources"))).toBe(true);
  });
});

describe("bibliography-generator planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const rs = planBatch([
      { style: "apa", sources: [{ type: "book", authors: [{ first: "A", last: "X" }], year: "2020", title: "B1", publisher: "P1" }] },
      { style: "mla", sources: [{ type: "book", authors: [{ first: "A", last: "X" }], year: "2020", title: "B1", publisher: "P1" }] },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch([{ style: "apa", sources: [] }]));
    expect(csv.split("\n")[0]).toContain("index,style");
  });
});

describe("bibliography-generator renderReport / renderBibliographyText", () => {
  it("renders report", () => {
    const r = renderReport(planBibliography({
      style: "apa",
      sources: [{ type: "book", authors: [{ first: "A", last: "X" }], year: "2020", title: "B1", publisher: "P1" }],
    }));
    expect(r).toContain("Bibliography Report");
    expect(r).toContain("References:");
  });
  it("renders bibliography text", () => {
    const r = renderBibliographyText(planBibliography({
      style: "apa",
      sources: [{ type: "book", authors: [{ first: "A", last: "X" }], year: "2020", title: "B1", publisher: "P1" }],
    }));
    expect(r).toContain("B1");
  });
});

describe("bibliography-generator getBibliographyPresets", () => {
  it("returns 3 presets", () => {
    expect(getBibliographyPresets().length).toBe(3);
  });
});
