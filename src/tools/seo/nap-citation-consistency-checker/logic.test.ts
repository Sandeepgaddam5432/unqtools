import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeName,
  normalizeAddress,
  normalizePhone,
  normalizeNap,
  compareField,
  compareCitation,
  analyze,
  renderCsv,
  renderReport,
  GOOGLE_BUSINESS_PROFILE_URL,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Nap,
  type Citation,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

const master: Nap = {
  name: "Joe's Coffee Shop",
  address: "123 Main Street, Springfield, IL 62701",
  phone: "(217) 555-1234",
};

describe("nap-citation normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  Joe's Coffee  ")).toBe("joes coffee");
  });
  it("strips punctuation", () => {
    expect(normalizeName("Joe's, Coffee & Tea")).toBe("joes coffee tea");
  });
  it("collapses whitespace", () => {
    expect(normalizeName("Joe's   Coffee")).toBe("joes coffee");
  });
  it("returns empty for empty", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("nap-citation normalizeAddress", () => {
  it("expands nothing, abbreviates words", () => {
    expect(normalizeAddress("123 Main Street")).toBe("123 main st");
  });
  it("abbreviates Avenue to Ave", () => {
    expect(normalizeAddress("456 Oak Avenue")).toBe("456 oak ave");
  });
  it("abbreviates Boulevard to Blvd", () => {
    expect(normalizeAddress("789 First Boulevard")).toBe("789 first blvd");
  });
  it("abbreviates Road to Rd", () => {
    expect(normalizeAddress("100 Hill Road")).toBe("100 hill rd");
  });
  it("abbreviates directional words", () => {
    expect(normalizeAddress("100 North Main")).toBe("100 n main");
  });
  it("strips commas", () => {
    expect(normalizeAddress("123 Main, Springfield")).toBe("123 main springfield");
  });
  it("returns empty for empty", () => {
    expect(normalizeAddress("")).toBe("");
  });
});

describe("nap-citation normalizePhone", () => {
  it("strips non-digits", () => {
    expect(normalizePhone("(217) 555-1234")).toBe("2175551234");
  });
  it("strips country code (keeps last 10)", () => {
    expect(normalizePhone("+1 (217) 555-1234")).toBe("2175551234");
  });
  it("handles dots and dashes", () => {
    expect(normalizePhone("217.555.1234")).toBe("2175551234");
    expect(normalizePhone("217-555-1234")).toBe("2175551234");
  });
  it("returns empty for empty", () => {
    expect(normalizePhone("")).toBe("");
  });
});

describe("nap-citation normalizeNap", () => {
  it("normalizes all three fields", () => {
    const n = normalizeNap({
      name: "Joe's Coffee",
      address: "123 Main Street",
      phone: "(217) 555-1234",
    });
    expect(n.name).toBe("joes coffee");
    expect(n.address).toBe("123 main st");
    expect(n.phone).toBe("2175551234");
  });
});

describe("nap-citation compareField", () => {
  it("matches identical values", () => {
    const f = compareField("name", "Joe's Coffee", "Joe's Coffee");
    expect(f.match).toBe(true);
  });
  it("matches with formatting differences", () => {
    const f = compareField("phone", "(217) 555-1234", "217-555-1234");
    expect(f.match).toBe(true);
  });
  it("matches address with abbreviation differences", () => {
    const f = compareField("address", "123 Main Street", "123 Main St");
    expect(f.match).toBe(true);
  });
  it("detects mismatch", () => {
    const f = compareField("name", "Joe's Coffee", "Joey's Coffee");
    expect(f.match).toBe(false);
  });
  it("includes normalized values in result", () => {
    const f = compareField("phone", "(217) 555-1234", "2175551234");
    expect(f.masterNormalized).toBe("2175551234");
    expect(f.citationNormalized).toBe("2175551234");
  });
});

describe("nap-citation compareCitation", () => {
  it("returns all-match for identical citation", () => {
    const citation: Citation = {
      source: "Google",
      nap: { ...master },
    };
    const c = compareCitation(master, citation);
    expect(c.allMatch).toBe(true);
    expect(c.mismatchCount).toBe(0);
  });
  it("detects single field mismatch", () => {
    const citation: Citation = {
      source: "Yelp",
      nap: { ...master, name: "Joe's Café" },
    };
    const c = compareCitation(master, citation);
    expect(c.allMatch).toBe(false);
    expect(c.mismatchCount).toBe(1);
    expect(c.fields.name.match).toBe(false);
    expect(c.fields.address.match).toBe(true);
    expect(c.fields.phone.match).toBe(true);
  });
  it("detects multiple field mismatches", () => {
    const citation: Citation = {
      source: "Facebook",
      nap: { name: "Different Name", address: "Different Address", phone: "555-000-0000" },
    };
    const c = compareCitation(master, citation);
    expect(c.mismatchCount).toBe(3);
  });
});

describe("nap-citation analyze", () => {
  const citations: Citation[] = [
    { source: "Google", nap: { ...master } },
    { source: "Yelp", nap: { ...master, name: "Joe's Café" } },
    { source: "Facebook", nap: { ...master, phone: "(217) 555-9999" } },
    { source: "Apple Maps", nap: { ...master } },
  ];
  it("computes total citations", () => {
    const r = analyze(master, citations);
    expect(r.stats.totalCitations).toBe(4);
  });
  it("counts fully consistent", () => {
    const r = analyze(master, citations);
    expect(r.stats.fullyConsistent).toBe(2);
  });
  it("counts partially consistent", () => {
    const r = analyze(master, citations);
    expect(r.stats.partiallyConsistent).toBe(2);
  });
  it("computes consistency percentage", () => {
    const r = analyze(master, citations);
    expect(r.stats.consistencyPercentage).toBe(50);
  });
  it("tracks issues by field", () => {
    const r = analyze(master, citations);
    expect(r.stats.issuesByField.name).toBe(1);
    expect(r.stats.issuesByField.phone).toBe(1);
    expect(r.stats.issuesByField.address).toBe(0);
  });
  it("computes total issues", () => {
    const r = analyze(master, citations);
    expect(r.stats.totalIssues).toBe(2);
  });
  it("generates recommendations", () => {
    const r = analyze(master, citations);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.recommendations.some((rec) => /name/i.test(rec))).toBe(true);
    expect(r.recommendations.some((rec) => /phone/i.test(rec))).toBe(true);
  });
  it("handles 100% consistency", () => {
    const perfect = [
      { source: "A", nap: { ...master } },
      { source: "B", nap: { ...master } },
    ];
    const r = analyze(master, perfect);
    expect(r.stats.consistencyPercentage).toBe(100);
    expect(r.recommendations.some((rec) => /Perfect/i.test(rec))).toBe(true);
  });
  it("handles empty citations", () => {
    const r = analyze(master, []);
    expect(r.stats.totalCitations).toBe(0);
    expect(r.stats.consistencyPercentage).toBe(0);
  });
  it("generates poor-consistency warning for low percentage", () => {
    const bad = [
      { source: "A", nap: { name: "X", address: "Y", phone: "Z" } },
      { source: "B", nap: { name: "X2", address: "Y2", phone: "Z2" } },
    ];
    const r = analyze(master, bad);
    expect(r.recommendations.some((rec) => /Poor/i.test(rec))).toBe(true);
  });
});

describe("nap-citation renderCsv", () => {
  it("renders CSV with header and rows", () => {
    const r = analyze(master, [
      { source: "Google", nap: { ...master } },
      { source: "Yelp", nap: { ...master, name: "Other" } },
    ]);
    const csv = renderCsv(r);
    expect(csv).toContain("source,field,master_value,citation_value,match");
    expect(csv).toContain("Google,name");
    expect(csv).toContain("yes");
    expect(csv).toContain("no");
  });
  it("escapes commas in values", () => {
    const r = analyze(master, [
      { source: "Google", nap: { ...master, address: "123 Main, Suite 5" } },
    ]);
    const csv = renderCsv(r);
    expect(csv).toContain('"123 Main, Suite 5"');
  });
});

describe("nap-citation renderReport", () => {
  it("renders markdown report", () => {
    const r = analyze(master, [{ source: "Google", nap: { ...master } }]);
    const report = renderReport(master, r);
    expect(report).toContain("# NAP Citation Consistency Report");
    expect(report).toContain("## Master NAP");
    expect(report).toContain("## Summary");
    expect(report).toContain("## Per-citation comparison");
    expect(report).toContain("Joe's Coffee Shop");
  });
});

describe("nap-citation Google Business Profile URL", () => {
  it("points to Google Business", () => {
    expect(GOOGLE_BUSINESS_PROFILE_URL).toContain("google.com/business");
  });
});

describe("nap-citation history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, citationCount: 10, consistencyPct: 80, issueCount: 2 });
    saveHistory({ ts: 2, citationCount: 5, consistencyPct: 100, issueCount: 0 });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, citationCount: 1, consistencyPct: 100, issueCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, citationCount: 1, consistencyPct: 100, issueCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("nap-citation shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      master,
      citations: [{ source: "Google", nap: master }],
    });
    expect(url).toContain("m_name=");
    expect(url).toContain("c0_source=Google");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = {
      location: { origin: "https://app.example.com", pathname: "/tools/nap-citation-consistency-checker" },
    };
    try {
      const url = buildShareUrl({
        master,
        citations: [{ source: "Google", nap: master }],
      });
      const hash = url.includes("#") ? `#${url.split("#")[1]}` : "";
      const parsed = parseShareUrl(hash);
      expect(parsed.master?.name).toBe("Joe's Coffee Shop");
      expect(parsed.citations).toHaveLength(1);
      expect(parsed.citations?.[0].source).toBe("Google");
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("caps citations at 5 in URL", () => {
    const manyCitations: Citation[] = Array.from({ length: 8 }, (_, i) => ({
      source: `Source ${i}`,
      nap: master,
    }));
    const url = buildShareUrl({ master, citations: manyCitations });
    expect(url).toContain("c0_source=");
    expect(url).toContain("c4_source=");
    expect(url).not.toContain("c5_source=");
  });
});
