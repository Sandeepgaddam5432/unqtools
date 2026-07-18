import { describe, it, expect, beforeEach } from "vitest";
import {
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  ALL_SECTIONS,
  SECTION_LABELS,
  defaultInput,
  scoreInfo,
  SCORE_COLOR_HEX,
  SCORE_COLOR_NAME,
  computeOverallScore,
  isValidUrl,
  isValidDate,
  isValidScore,
  validate,
  parseKeywordRankings,
  splitCsvRow,
  parseLines,
  buildCoverPage,
  buildToc,
  renderExecutiveSummary,
  renderTechnicalSeo,
  renderOnPageSeo,
  renderContentAnalysis,
  renderBacklinkProfile,
  renderKeywordRankings,
  renderCompetitorAnalysis,
  renderRecommendations,
  generateReport,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ReportInput,
  type ReportFormat,
  type SectionId,
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

function validInput(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    ...defaultInput(),
    clientName: "Acme Corp",
    websiteUrl: "https://acme.example.com",
    auditDate: "2024-03-15",
    auditorName: "Jane SEO",
    reportFormat: "markdown",
    sectionsToInclude: [...ALL_SECTIONS],
    executiveSummary: "This audit covers Acme Corp's overall SEO health.",
    technicalSeoScore: "82",
    onPageSeoScore: "78",
    contentScore: "65",
    backlinkScore: "90",
    keywordRankings: "wireless headphones,3,https://acme.example.com/p1\nbluetooth speaker,12,https://acme.example.com/p2",
    topRecommendations: "Fix title tags on top 10 pages\nImprove Core Web Vitals\nBuild 5 high-authority backlinks",
    competitorUrls: "https://comp1.com\nhttps://comp2.com\nhttps://comp3.com",
    ...overrides,
  };
}

describe("seo-report-generator constants", () => {
  it("has 3 report formats", () => {
    expect(REPORT_FORMATS).toHaveLength(3);
    expect(REPORT_FORMATS).toEqual(["markdown", "html", "text"]);
  });
  it("has labels for all formats", () => {
    for (const f of REPORT_FORMATS) {
      expect(REPORT_FORMAT_LABELS[f]).toBeTruthy();
    }
  });
  it("has 8 sections", () => {
    expect(ALL_SECTIONS).toHaveLength(8);
  });
  it("has labels for all sections", () => {
    for (const s of ALL_SECTIONS) {
      expect(SECTION_LABELS[s]).toBeTruthy();
    }
  });
  it("defaultInput returns all defaults", () => {
    const d = defaultInput();
    expect(d.clientName).toBe("");
    expect(d.reportFormat).toBe("markdown");
    expect(d.sectionsToInclude).toHaveLength(8);
  });
});

describe("seo-report-generator scoreInfo", () => {
  it("returns Excellent for 90+", () => {
    const s = scoreInfo("95");
    expect(s.label).toBe("Excellent");
    expect(s.color).toBe("excellent");
    expect(s.value).toBe(95);
  });
  it("returns Good for 75-89", () => {
    const s = scoreInfo("80");
    expect(s.label).toBe("Good");
    expect(s.color).toBe("good");
  });
  it("returns Needs Improvement for 60-74", () => {
    const s = scoreInfo("65");
    expect(s.label).toBe("Needs Improvement");
    expect(s.color).toBe("needs-improvement");
  });
  it("returns Poor for <60", () => {
    const s = scoreInfo("45");
    expect(s.label).toBe("Poor");
    expect(s.color).toBe("poor");
  });
  it("returns Not provided for empty", () => {
    const s = scoreInfo("");
    expect(s.label).toBe("Not provided");
    expect(s.color).toBe("none");
    expect(s.value).toBeNull();
  });
  it("returns Not provided for non-numeric", () => {
    const s = scoreInfo("abc");
    expect(s.color).toBe("none");
  });
  it("has hex colors for all states", () => {
    for (const c of ["excellent", "good", "needs-improvement", "poor", "none"] as const) {
      expect(SCORE_COLOR_HEX[c]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(SCORE_COLOR_NAME[c]).toBeTruthy();
    }
  });
});

describe("seo-report-generator computeOverallScore", () => {
  it("computes weighted score (25/25/20/30)", () => {
    // 82*0.25 + 78*0.25 + 65*0.20 + 90*0.30 = 20.5 + 19.5 + 13 + 27 = 80
    const score = computeOverallScore(validInput());
    expect(score).toBe(80);
  });
  it("returns null when no scores provided", () => {
    const score = computeOverallScore(validInput({
      technicalSeoScore: "",
      onPageSeoScore: "",
      contentScore: "",
      backlinkScore: "",
    }));
    expect(score).toBeNull();
  });
  it("normalizes when only some scores provided", () => {
    // Only technical=82, weight 0.25 → normalize: 82*0.25/0.25 = 82
    const score = computeOverallScore(validInput({
      onPageSeoScore: "",
      contentScore: "",
      backlinkScore: "",
    }));
    expect(score).toBe(82);
  });
  it("handles partial scores (2 of 4)", () => {
    // technical=82 (0.25) + backlink=90 (0.30) → (82*0.25 + 90*0.30) / 0.55 = 47.5/0.55 ≈ 86.4
    const score = computeOverallScore(validInput({
      onPageSeoScore: "",
      contentScore: "",
    }));
    expect(score).toBe(86.4);
  });
});

describe("seo-report-generator validators", () => {
  it("isValidUrl accepts http(s)", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });
  it("isValidUrl rejects ftp + invalid", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidDate accepts YYYY-MM-DD", () => {
    expect(isValidDate("2024-03-15")).toBe(true);
  });
  it("isValidDate rejects bad format + bad date", () => {
    expect(isValidDate("15-03-2024")).toBe(false);
    expect(isValidDate("2024-13-45")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
  it("isValidScore accepts 0-100 + empty", () => {
    expect(isValidScore("0")).toBe(true);
    expect(isValidScore("100")).toBe(true);
    expect(isValidScore("75.5")).toBe(true);
    expect(isValidScore("")).toBe(true);
  });
  it("isValidScore rejects negatives, >100, non-numbers", () => {
    expect(isValidScore("-1")).toBe(false);
    expect(isValidScore("101")).toBe(false);
    expect(isValidScore("abc")).toBe(false);
  });
});

describe("seo-report-generator validate", () => {
  it("passes for valid input", () => {
    expect(validate(validInput()).ok).toBe(true);
  });
  it("fails when clientName missing", () => {
    const v = validate(validInput({ clientName: "" }));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("Client name"))).toBe(true);
  });
  it("fails when websiteUrl missing", () => {
    const v = validate(validInput({ websiteUrl: "" }));
    expect(v.ok).toBe(false);
  });
  it("fails when websiteUrl invalid", () => {
    const v = validate(validInput({ websiteUrl: "not-a-url" }));
    expect(v.ok).toBe(false);
  });
  it("fails when auditDate missing", () => {
    const v = validate(validInput({ auditDate: "" }));
    expect(v.ok).toBe(false);
  });
  it("fails when auditDate bad format", () => {
    const v = validate(validInput({ auditDate: "03/15/2024" }));
    expect(v.ok).toBe(false);
  });
  it("fails when auditorName missing", () => {
    const v = validate(validInput({ auditorName: "" }));
    expect(v.ok).toBe(false);
  });
  it("fails when no sections selected", () => {
    const v = validate(validInput({ sectionsToInclude: [] }));
    expect(v.ok).toBe(false);
  });
  it("fails when a score is out of range", () => {
    const v = validate(validInput({ technicalSeoScore: "150" }));
    expect(v.ok).toBe(false);
  });
  it("warns when executiveSummary empty", () => {
    const v = validate(validInput({ executiveSummary: "" }));
    expect(v.warnings.some((w) => w.includes("Executive summary"))).toBe(true);
  });
  it("warns when keyword rankings section selected but no CSV", () => {
    const v = validate(validInput({ keywordRankings: "" }));
    expect(v.warnings.some((w) => w.includes("Keyword rankings"))).toBe(true);
  });
  it("warns when competitor section selected but no URLs", () => {
    const v = validate(validInput({ competitorUrls: "" }));
    expect(v.warnings.some((w) => w.includes("Competitor"))).toBe(true);
  });
  it("issues array matches errors + warnings", () => {
    const v = validate(validInput({ executiveSummary: "" }));
    expect(v.issues.length).toBe(v.errors.length + v.warnings.length);
  });
});

describe("seo-report-generator parseKeywordRankings", () => {
  it("parses CSV rows", () => {
    const rows = parseKeywordRankings("kw1,1,https://a.com\nkw2,5,https://b.com");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ keyword: "kw1", position: "1", url: "https://a.com" });
  });
  it("skips header row", () => {
    const rows = parseKeywordRankings("keyword,position,url\nkw1,1,https://a.com");
    expect(rows).toHaveLength(1);
  });
  it("handles empty input", () => {
    expect(parseKeywordRankings("")).toEqual([]);
  });
  it("handles quoted commas in URLs/keywords", () => {
    const rows = parseKeywordRankings('"kw, with comma",1,https://a.com');
    expect(rows[0].keyword).toBe("kw, with comma");
  });
});

describe("seo-report-generator splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("seo-report-generator parseLines", () => {
  it("parses one-per-line", () => {
    expect(parseLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("trims whitespace + skips blanks", () => {
    expect(parseLines("  a  \n\n  b  ")).toEqual(["a", "b"]);
  });
  it("handles empty", () => {
    expect(parseLines("")).toEqual([]);
  });
});

describe("seo-report-generator buildCoverPage", () => {
  it("builds markdown cover", () => {
    const c = buildCoverPage(validInput(), "markdown");
    expect(c).toContain("# SEO Audit Report");
    expect(c).toContain("Acme Corp");
    expect(c).toContain("https://acme.example.com");
    expect(c).toContain("2024-03-15");
    expect(c).toContain("Jane SEO");
  });
  it("builds html cover with inline styles", () => {
    const c = buildCoverPage(validInput(), "html");
    expect(c).toContain("<h1");
    expect(c).toContain("Acme Corp");
    expect(c).toContain("style=");
  });
  it("builds text cover with ASCII bars", () => {
    const c = buildCoverPage(validInput(), "text");
    expect(c).toContain("===");
    expect(c).toContain("SEO AUDIT REPORT");
    expect(c).toContain("Acme Corp");
  });
  it("uses — when fields empty", () => {
    const c = buildCoverPage(validInput({ auditDate: "" }), "markdown");
    expect(c).toContain("Audit Date: —");
  });
});

describe("seo-report-generator buildToc", () => {
  it("builds markdown TOC with links", () => {
    const t = buildToc(validInput(), "markdown");
    expect(t).toContain("## Table of Contents");
    expect(t).toContain("[Executive Summary](#executive-summary)");
    expect(t).toContain("[Technical SEO](#technical-seo)");
  });
  it("builds html TOC with anchor links", () => {
    const t = buildToc(validInput(), "html");
    expect(t).toContain('href="#executive-summary"');
    expect(t).toContain('href="#recommendations"');
  });
  it("builds text TOC numbered", () => {
    const t = buildToc(validInput(), "text");
    expect(t).toContain("Table of Contents");
    expect(t).toContain("1. Executive Summary");
    expect(t).toContain("8. Recommendations");
  });
  it("returns empty when no sections selected", () => {
    expect(buildToc(validInput({ sectionsToInclude: [] }), "markdown")).toBe("");
  });
  it("respects selected sections order", () => {
    const t = buildToc(validInput({ sectionsToInclude: ["recommendations", "executive-summary"] }), "markdown");
    expect(t.indexOf("Recommendations")).toBeLessThan(t.indexOf("Executive Summary"));
  });
});

describe("seo-report-generator renderExecutiveSummary", () => {
  it("uses provided summary + overall score", () => {
    const s = renderExecutiveSummary(validInput(), "markdown");
    expect(s).toContain("## Executive Summary");
    expect(s).toContain("This audit covers Acme Corp");
    expect(s).toContain("80 / 100");
  });
  it("uses default summary when empty", () => {
    const s = renderExecutiveSummary(validInput({ executiveSummary: "" }), "markdown");
    expect(s).toContain("This SEO audit report evaluates");
    expect(s).toContain("Acme Corp");
  });
  it("renders html format", () => {
    const s = renderExecutiveSummary(validInput(), "html");
    expect(s).toContain("<h2");
    expect(s).toContain("Acme Corp");
  });
  it("renders text format", () => {
    const s = renderExecutiveSummary(validInput(), "text");
    expect(s).toContain("Executive Summary");
    expect(s).toContain("---");
  });
});

describe("seo-report-generator render score sections", () => {
  it("renderTechnicalSeo includes score + label", () => {
    const s = renderTechnicalSeo(validInput(), "markdown");
    expect(s).toContain("82 / 100");
    expect(s).toContain("Good");
  });
  it("renderOnPageSeo includes score + label", () => {
    const s = renderOnPageSeo(validInput(), "markdown");
    expect(s).toContain("78 / 100");
    expect(s).toContain("Good");
  });
  it("renderContentAnalysis includes score + label", () => {
    const s = renderContentAnalysis(validInput(), "markdown");
    expect(s).toContain("65 / 100");
    expect(s).toContain("Needs Improvement");
  });
  it("renderBacklinkProfile includes score + label", () => {
    const s = renderBacklinkProfile(validInput(), "markdown");
    expect(s).toContain("90 / 100");
    expect(s).toContain("Excellent");
  });
  it("renders html bullet list", () => {
    const s = renderTechnicalSeo(validInput(), "html");
    expect(s).toContain("<ul");
    expect(s).toContain("<li");
  });
  it("renders text bullets with •", () => {
    const s = renderTechnicalSeo(validInput(), "text");
    expect(s).toContain("•");
  });
  it("shows — when score not provided", () => {
    const s = renderTechnicalSeo(validInput({ technicalSeoScore: "" }), "markdown");
    expect(s).toContain("— / 100");
    expect(s).toContain("Not provided");
  });
});

describe("seo-report-generator renderKeywordRankings", () => {
  it("renders markdown table", () => {
    const s = renderKeywordRankings(validInput(), "markdown");
    expect(s).toContain("## Keyword Rankings");
    expect(s).toContain("| # | Keyword | Position | URL |");
    expect(s).toContain("wireless headphones");
    expect(s).toContain("bluetooth speaker");
  });
  it("renders html table", () => {
    const s = renderKeywordRankings(validInput(), "html");
    expect(s).toContain("<table");
    expect(s).toContain("wireless headphones");
  });
  it("renders text list", () => {
    const s = renderKeywordRankings(validInput(), "text");
    expect(s).toContain("1. wireless headphones");
  });
  it("shows placeholder when empty", () => {
    const s = renderKeywordRankings(validInput({ keywordRankings: "" }), "markdown");
    expect(s).toContain("No keyword rankings provided");
  });
});

describe("seo-report-generator renderCompetitorAnalysis", () => {
  it("renders markdown list", () => {
    const s = renderCompetitorAnalysis(validInput(), "markdown");
    expect(s).toContain("## Competitor Analysis");
    expect(s).toContain("https://comp1.com");
    expect(s).toContain("Total competitors analyzed: 3");
  });
  it("renders html list", () => {
    const s = renderCompetitorAnalysis(validInput(), "html");
    expect(s).toContain("<ul");
    expect(s).toContain("comp1.com");
  });
  it("renders text list", () => {
    const s = renderCompetitorAnalysis(validInput(), "text");
    expect(s).toContain("1. https://comp1.com");
  });
  it("shows placeholder when empty", () => {
    const s = renderCompetitorAnalysis(validInput({ competitorUrls: "" }), "markdown");
    expect(s).toContain("No competitors provided");
  });
});

describe("seo-report-generator renderRecommendations", () => {
  it("renders markdown ordered list with priorities", () => {
    const s = renderRecommendations(validInput(), "markdown");
    expect(s).toContain("## Recommendations");
    expect(s).toContain("[Priority 3]");
    expect(s).toContain("[Priority 1]");
    expect(s).toContain("Fix title tags");
  });
  it("renders html ordered list", () => {
    const s = renderRecommendations(validInput(), "html");
    expect(s).toContain("<ol");
    expect(s).toContain("[Priority 3]");
  });
  it("renders text list", () => {
    const s = renderRecommendations(validInput(), "text");
    expect(s).toContain("1. [Priority 3] Fix title tags");
  });
  it("shows placeholder when empty", () => {
    const s = renderRecommendations(validInput({ topRecommendations: "" }), "markdown");
    expect(s).toContain("No recommendations provided");
  });
});

describe("seo-report-generator generateReport", () => {
  it("generates markdown report with all sections", () => {
    const r = generateReport(validInput());
    expect(r).toContain("# SEO Audit Report");
    expect(r).toContain("## Table of Contents");
    expect(r).toContain("## Executive Summary");
    expect(r).toContain("## Technical SEO");
    expect(r).toContain("## On-Page SEO");
    expect(r).toContain("## Content Analysis");
    expect(r).toContain("## Backlink Profile");
    expect(r).toContain("## Keyword Rankings");
    expect(r).toContain("## Competitor Analysis");
    expect(r).toContain("## Recommendations");
  });
  it("generates html report with full HTML wrapper", () => {
    const r = generateReport(validInput({ reportFormat: "html" }));
    expect(r).toContain("<!DOCTYPE html>");
    expect(r).toContain("<html");
    expect(r).toContain("<body");
    expect(r).toContain("</html>");
    expect(r).toContain("Overall Score: 80");
  });
  it("generates text report with ASCII dividers", () => {
    const r = generateReport(validInput({ reportFormat: "text" }));
    expect(r).toContain("===");
    expect(r).toContain("SEO AUDIT REPORT");
    expect(r).toContain("Table of Contents");
  });
  it("only includes selected sections", () => {
    const r = generateReport(validInput({ sectionsToInclude: ["executive-summary", "recommendations"] }));
    expect(r).toContain("## Executive Summary");
    expect(r).toContain("## Recommendations");
    expect(r).not.toContain("## Technical SEO");
    expect(r).not.toContain("## Keyword Rankings");
  });
  it("throws when validation fails", () => {
    expect(() => generateReport(validInput({ clientName: "" }))).toThrow();
  });
  it("html report includes score badge", () => {
    const r = generateReport(validInput({ reportFormat: "html" }));
    expect(r).toContain("Overall Score: 80 / 100");
    expect(r).toContain("background:");
  });
});

describe("seo-report-generator computeSummaryStats", () => {
  it("computes summary stats", () => {
    const s = computeSummaryStats(validInput());
    expect(s.totalSections).toBe(8);
    expect(s.selectedSections).toBe(8);
    expect(s.overallScore).toBe(80);
    expect(s.overallLabel).toBe("Good");
    expect(s.scoresProvided).toBe(4);
    expect(s.scoresTotal).toBe(4);
    expect(s.keywordCount).toBe(2);
    expect(s.competitorCount).toBe(3);
    expect(s.recommendationCount).toBe(3);
  });
  it("handles missing scores", () => {
    const s = computeSummaryStats(validInput({
      technicalSeoScore: "",
      onPageSeoScore: "",
      contentScore: "",
      backlinkScore: "",
    }));
    expect(s.overallScore).toBeNull();
    expect(s.scoresProvided).toBe(0);
    expect(s.overallColor).toBe("none");
  });
  it("reflects selected sections count", () => {
    const s = computeSummaryStats(validInput({ sectionsToInclude: ["executive-summary"] }));
    expect(s.selectedSections).toBe(1);
  });
});

describe("seo-report-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      clientName: "Acme",
      websiteUrl: "https://acme.com",
      auditDate: "2024-01-01",
      format: "markdown",
      sectionsCount: 8,
      overallScore: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, clientName: `C${i}`, websiteUrl: "https://x.com", auditDate: "2024-01-01", format: "markdown", sectionsCount: 8, overallScore: 80 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, clientName: "X", websiteUrl: "https://x.com", auditDate: "2024-01-01", format: "markdown", sectionsCount: 8, overallScore: 80 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("seo-report-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ clientName: "Acme", technicalSeoScore: "80" });
    expect(url).toContain("clientName=Acme");
    expect(url).toContain("technicalSeoScore=80");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("excludes long text fields from share URL", () => {
    const url = buildShareUrl({
      clientName: "Acme",
      executiveSummary: "long text should be excluded",
      keywordRankings: "kw,1,https://x.com",
      topRecommendations: "do thing 1",
      competitorUrls: "https://comp.com",
    });
    expect(url).toContain("clientName=Acme");
    expect(url).not.toContain("executiveSummary");
    expect(url).not.toContain("keywordRankings");
    expect(url).not.toContain("topRecommendations");
    expect(url).not.toContain("competitorUrls");
  });
  it("includes sections in URL", () => {
    const url = buildShareUrl({ sectionsToInclude: ["executive-summary", "recommendations"] });
    expect(url).toContain("sections=executive-summary%2Crecommendations");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("clientName=Acme&technicalSeoScore=80&reportFormat=html&sections=executive-summary%2Crecommendations");
    expect(p.clientName).toBe("Acme");
    expect(p.technicalSeoScore).toBe("80");
    expect(p.reportFormat).toBe("html");
    expect(p.sectionsToInclude).toEqual(["executive-summary", "recommendations"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown format", () => {
    const p = parseShareUrl("reportFormat=pdf");
    expect(p.reportFormat).toBeUndefined();
  });
  it("filters unknown sections", () => {
    const p = parseShareUrl("sections=executive-summary%2Cunknown-section");
    expect(p.sectionsToInclude).toEqual(["executive-summary"]);
  });
});

// Suppress unused-import lint
export type _Unused = ReportFormat | SectionId;
