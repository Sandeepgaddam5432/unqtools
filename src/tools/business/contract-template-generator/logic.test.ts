import { describe, it, expect, beforeEach } from "vitest";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DURATIONS,
  DURATION_LABELS,
  PAYMENT_TERMS_LIST,
  PAYMENT_TERMS_LABELS,
  formatDateLong,
  calculateEndDate,
  formatCompensation,
  formatPaymentTerms,
  parseAdditionalClauses,
  combineClauses,
  buildSections,
  buildFullSections,
  renderText,
  renderMarkdown,
  renderHtml,
  computeStats,
  validateClauses,
  generateDisclaimer,
  countSections,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ContractType,
  type ContractDuration,
  type PaymentTerms,
  type ContractInput,
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

const FULL_INPUT: ContractInput = {
  contractType: "freelance",
  partyAName: "Acme Corp",
  partyAAddress: "123 Main St\nAustin, TX 78701",
  partyBName: "Jane Doe",
  partyBAddress: "456 Oak Ave\nDallas, TX 75201",
  effectiveDate: "2026-07-13",
  contractDuration: "6-months",
  projectDescription: "Design and develop a marketing landing page.",
  compensationAmount: 5000,
  paymentTerms: "net-30",
  governingState: "Texas",
  additionalClauses: "This agreement is governed by mediator-arbitration.\nAll notices shall be sent via email.",
};

describe("contract-template-generator constants", () => {
  it("has 8 contract types", () => {
    expect(CONTRACT_TYPES).toHaveLength(8);
  });
  it("has 5 durations", () => {
    expect(DURATIONS).toHaveLength(5);
  });
  it("has 5 payment terms", () => {
    expect(PAYMENT_TERMS_LIST).toHaveLength(5);
  });
  it("has a label for every contract type", () => {
    for (const t of CONTRACT_TYPES) {
      expect(typeof CONTRACT_TYPE_LABELS[t]).toBe("string");
      expect(CONTRACT_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
  it("has a label for every duration", () => {
    for (const d of DURATIONS) {
      expect(typeof DURATION_LABELS[d]).toBe("string");
      expect(DURATION_LABELS[d].length).toBeGreaterThan(0);
    }
  });
  it("has a label for every payment term", () => {
    for (const p of PAYMENT_TERMS_LIST) {
      expect(typeof PAYMENT_TERMS_LABELS[p]).toBe("string");
      expect(PAYMENT_TERMS_LABELS[p].length).toBeGreaterThan(0);
    }
  });
});

describe("contract-template-generator formatDateLong", () => {
  it("formats a valid YYYY-MM-DD", () => {
    expect(formatDateLong("2026-07-13")).toBe("July 13, 2026");
  });
  it("handles January 1", () => {
    expect(formatDateLong("2026-01-01")).toBe("January 1, 2026");
  });
  it("handles December 31", () => {
    expect(formatDateLong("2026-12-31")).toBe("December 31, 2026");
  });
  it("returns input when empty", () => {
    expect(formatDateLong("")).toBe("");
  });
  it("returns input when malformed", () => {
    expect(formatDateLong("not-a-date")).toBe("not-a-date");
  });
  it("returns input when month out of range", () => {
    expect(formatDateLong("2026-13-01")).toBe("2026-13-01");
  });
});

describe("contract-template-generator calculateEndDate", () => {
  it("adds 6 months for 6-months", () => {
    expect(calculateEndDate("2026-01-15", "6-months")).toBe("2026-07-15");
  });
  it("adds 1 year for 1-year", () => {
    expect(calculateEndDate("2026-07-13", "1-year")).toBe("2027-07-13");
  });
  it("adds 2 years for 2-years", () => {
    expect(calculateEndDate("2026-07-13", "2-years")).toBe("2028-07-13");
  });
  it("handles Feb 29 leap year", () => {
    // 2024-02-29 + 1 year = 2025-02-28 (UTC)
    expect(calculateEndDate("2024-02-29", "1-year")).toBe("2025-02-28");
  });
  it("returns empty for indefinite", () => {
    expect(calculateEndDate("2026-07-13", "indefinite")).toBe("");
  });
  it("returns empty for project-based", () => {
    expect(calculateEndDate("2026-07-13", "project-based")).toBe("");
  });
  it("returns empty for empty effective date", () => {
    expect(calculateEndDate("", "1-year")).toBe("");
  });
  it("returns empty for invalid date", () => {
    expect(calculateEndDate("not-a-date", "1-year")).toBe("");
  });
});

describe("contract-template-generator formatCompensation", () => {
  it("formats a whole number with 2 decimals", () => {
    expect(formatCompensation(5000)).toBe("$5,000.00 USD");
  });
  it("formats a decimal", () => {
    expect(formatCompensation(1234.5)).toBe("$1,234.50 USD");
  });
  it("formats large numbers with commas", () => {
    expect(formatCompensation(1000000)).toBe("$1,000,000.00 USD");
  });
  it("returns empty for zero", () => {
    expect(formatCompensation(0)).toBe("");
  });
  it("returns empty for NaN", () => {
    expect(formatCompensation(Number.NaN)).toBe("");
  });
});

describe("contract-template-generator formatPaymentTerms", () => {
  it("formats net-15", () => {
    expect(formatPaymentTerms("net-15")).toContain("15 days");
  });
  it("formats net-30", () => {
    expect(formatPaymentTerms("net-30")).toContain("30 days");
  });
  it("formats on-completion", () => {
    expect(formatPaymentTerms("on-completion")).toContain("Completion");
  });
  it("formats milestone-based", () => {
    expect(formatPaymentTerms("milestone-based")).toContain("Milestone");
  });
});

describe("contract-template-generator parseAdditionalClauses", () => {
  it("parses one clause per line", () => {
    expect(parseAdditionalClauses("First.\nSecond.\nThird.")).toEqual(["First.", "Second.", "Third."]);
  });
  it("skips blank lines", () => {
    expect(parseAdditionalClauses("First.\n\n  \nSecond.")).toEqual(["First.", "Second."]);
  });
  it("returns empty for empty input", () => {
    expect(parseAdditionalClauses("")).toEqual([]);
  });
  it("trims whitespace", () => {
    expect(parseAdditionalClauses("  Clause with spaces.  ")).toEqual(["Clause with spaces."]);
  });
});

describe("contract-template-generator combineClauses", () => {
  it("combines boilerplate with additional clauses", () => {
    const boilerplate = [
      { number: 1, title: "A", body: "Body A" },
      { number: 2, title: "B", body: "Body B" },
    ];
    const out = combineClauses(boilerplate, ["Extra 1", "Extra 2"]);
    expect(out).toHaveLength(4);
    expect(out[2].title).toBe("Additional Provision");
    expect(out[2].body).toBe("Extra 1");
    expect(out[2].number).toBe(3);
    expect(out[3].number).toBe(4);
  });
  it("returns boilerplate unchanged when no additional clauses", () => {
    const boilerplate = [{ number: 1, title: "A", body: "Body A" }];
    expect(combineClauses(boilerplate, [])).toEqual(boilerplate);
  });
});

describe("contract-template-generator buildSections", () => {
  it("builds sections for freelance", () => {
    const sections = buildSections(FULL_INPUT);
    expect(sections.length).toBeGreaterThan(5);
    expect(sections[0].title).toBe("Parties and Effective Date");
    // Re-numbered
    expect(sections[0].number).toBe(1);
    expect(sections[1].number).toBe(2);
  });
  it("includes compensation section for freelance", () => {
    const sections = buildSections(FULL_INPUT);
    expect(sections.some((s) => s.title === "Compensation and Payment")).toBe(true);
  });
  it("includes independent contractor section for freelance", () => {
    const sections = buildSections(FULL_INPUT);
    expect(sections.some((s) => s.title === "Independent Contractor Status")).toBe(true);
  });
  it("includes Confidential Information section for nda-mutual", () => {
    const sections = buildSections({ ...FULL_INPUT, contractType: "nda-mutual" });
    expect(sections.some((s) => s.title === "Confidential Information")).toBe(true);
  });
  it("includes Confidential Information section for nda-one-way", () => {
    const sections = buildSections({ ...FULL_INPUT, contractType: "nda-one-way" });
    expect(sections.some((s) => s.title === "Confidential Information")).toBe(true);
  });
  it("includes Statements of Work section for MSA", () => {
    const sections = buildSections({ ...FULL_INPUT, contractType: "msa-master-service" });
    expect(sections.some((s) => s.title === "Statements of Work")).toBe(true);
  });
  it("includes Limitation of Liability for MSA", () => {
    const sections = buildSections({ ...FULL_INPUT, contractType: "msa-master-service" });
    expect(sections.some((s) => s.title === "Limitation of Liability")).toBe(true);
  });
  it("includes Project Description section for SOW", () => {
    const sections = buildSections({ ...FULL_INPUT, contractType: "sow-statement-of-work" });
    expect(sections.some((s) => s.title === "Project Description and Scope")).toBe(true);
  });
  it("includes Acceptance Criteria for SOW", () => {
    const sections = buildSections({ ...FULL_INPUT, contractType: "sow-statement-of-work" });
    expect(sections.some((s) => s.title === "Acceptance Criteria")).toBe(true);
  });
  it("always includes Governing Law section", () => {
    for (const t of CONTRACT_TYPES) {
      const sections = buildSections({ ...FULL_INPUT, contractType: t });
      expect(sections.some((s) => s.title === "Governing Law and Jurisdiction")).toBe(true);
    }
  });
  it("always includes Miscellaneous section", () => {
    for (const t of CONTRACT_TYPES) {
      const sections = buildSections({ ...FULL_INPUT, contractType: t });
      expect(sections.some((s) => s.title === "Miscellaneous")).toBe(true);
    }
  });
  it("substitutes party names in parties section", () => {
    const sections = buildSections(FULL_INPUT);
    expect(sections[0].body).toContain("Acme Corp");
    expect(sections[0].body).toContain("Jane Doe");
  });
  it("substitutes governing state in governing law section", () => {
    const sections = buildSections(FULL_INPUT);
    const gov = sections.find((s) => s.title === "Governing Law and Jurisdiction");
    expect(gov?.body).toContain("Texas");
  });
});

describe("contract-template-generator buildFullSections", () => {
  it("includes additional clauses at the end (before renumber)", () => {
    const sections = buildFullSections(FULL_INPUT);
    // Last two sections should be the additional provisions (since Miscellaneous is always last in boilerplate)
    const additional = sections.filter((s) => s.title === "Additional Provision");
    expect(additional).toHaveLength(2);
  });
  it("numbers sections sequentially", () => {
    const sections = buildFullSections(FULL_INPUT);
    for (let i = 0; i < sections.length; i++) {
      expect(sections[i].number).toBe(i + 1);
    }
  });
});

describe("contract-template-generator renderers", () => {
  it("renderText produces plain text with title", () => {
    const text = renderText(FULL_INPUT);
    expect(text).toContain("FREELANCE AGREEMENT");
    expect(text).toContain("1. Parties and Effective Date");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("SIGNATURES");
  });
  it("renderText includes disclaimer", () => {
    const text = renderText(FULL_INPUT);
    expect(text.toLowerCase()).toContain("legal advice");
  });
  it("renderMarkdown produces markdown with H1 title", () => {
    const md = renderMarkdown(FULL_INPUT);
    expect(md).toContain("# Freelance Agreement");
    expect(md).toContain("## 1. Parties and Effective Date");
    expect(md).toContain("## Signatures");
  });
  it("renderHtml produces valid HTML with title", () => {
    const html = renderHtml(FULL_INPUT);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Freelance Agreement</title>");
    expect(html).toContain("<section");
    expect(html).toContain("</body></html>");
  });
  it("renderHtml escapes angle brackets in user content", () => {
    const html = renderHtml({ ...FULL_INPUT, projectDescription: "Use <script> tags" });
    expect(html).toContain("&lt;script&gt;");
  });
  it("renders each contract type without throwing", () => {
    for (const t of CONTRACT_TYPES) {
      expect(() => renderText({ ...FULL_INPUT, contractType: t })).not.toThrow();
      expect(() => renderMarkdown({ ...FULL_INPUT, contractType: t })).not.toThrow();
      expect(() => renderHtml({ ...FULL_INPUT, contractType: t })).not.toThrow();
    }
  });
});

describe("contract-template-generator computeStats", () => {
  it("computes stats for full input", () => {
    const stats = computeStats(FULL_INPUT);
    expect(stats.type).toBe("freelance");
    expect(stats.typeLabel).toBe("Freelance Agreement");
    expect(stats.durationLabel).toBe("6 Months");
    expect(stats.effectiveDateLong).toBe("July 13, 2026");
    expect(stats.endDate).toBe("2027-01-13");
    expect(stats.endDateLong).toBe("January 13, 2027");
    expect(stats.compensationFormatted).toBe("$5,000.00 USD");
    expect(stats.paymentTermsLabel).toContain("30 days");
    expect(stats.sectionCount).toBeGreaterThan(5);
    expect(stats.additionalClauseCount).toBe(2);
    expect(stats.hasMissing).toBe(false);
    expect(stats.missingFields).toEqual([]);
  });
  it("marks missing fields", () => {
    const stats = computeStats({ ...FULL_INPUT, partyAName: "", governingState: "" });
    expect(stats.hasMissing).toBe(true);
    expect(stats.missingFields).toContain("Party A name");
    expect(stats.missingFields).toContain("Governing state");
  });
  it("handles indefinite duration end date", () => {
    const stats = computeStats({ ...FULL_INPUT, contractDuration: "indefinite" });
    expect(stats.endDate).toBe("");
    expect(stats.endDateLong).toBe("Indefinite");
  });
  it("handles project-based duration end date", () => {
    const stats = computeStats({ ...FULL_INPUT, contractDuration: "project-based" });
    expect(stats.endDate).toBe("");
    expect(stats.endDateLong).toBe("On project completion");
  });
  it("shows dash for NDA without compensation", () => {
    const stats = computeStats({ ...FULL_INPUT, contractType: "nda-mutual", compensationAmount: 0 });
    expect(stats.compensationFormatted).toBe("—");
  });
});

describe("contract-template-generator validateClauses", () => {
  it("returns empty for complete input", () => {
    expect(validateClauses(FULL_INPUT)).toEqual([]);
  });
  it("flags missing party A name", () => {
    const missing = validateClauses({ ...FULL_INPUT, partyAName: "" });
    expect(missing).toContain("Party A name");
  });
  it("flags missing effective date", () => {
    const missing = validateClauses({ ...FULL_INPUT, effectiveDate: "" });
    expect(missing).toContain("Effective date");
  });
  it("flags missing project description for freelance", () => {
    const missing = validateClauses({ ...FULL_INPUT, projectDescription: "" });
    expect(missing).toContain("Project description (required for this contract type)");
  });
  it("does not require project description for NDA", () => {
    const missing = validateClauses({ ...FULL_INPUT, contractType: "nda-mutual", projectDescription: "" });
    expect(missing).not.toContain("Project description (required for this contract type)");
  });
  it("flags zero compensation for non-NDA", () => {
    const missing = validateClauses({ ...FULL_INPUT, compensationAmount: 0 });
    expect(missing).toContain("Compensation amount (required for non-NDA contracts)");
  });
  it("does not require compensation for NDA", () => {
    const missing = validateClauses({ ...FULL_INPUT, contractType: "nda-mutual", compensationAmount: 0 });
    expect(missing).not.toContain("Compensation amount (required for non-NDA contracts)");
  });
});

describe("contract-template-generator generateDisclaimer", () => {
  it("mentions 'not legal advice'", () => {
    const d = generateDisclaimer();
    expect(d.toLowerCase()).toContain("not legal advice");
  });
  it("mentions attorney review", () => {
    const d = generateDisclaimer();
    expect(d.toLowerCase()).toContain("attorney");
  });
});

describe("contract-template-generator countSections", () => {
  it("counts sections including additional clauses", () => {
    const n = countSections(FULL_INPUT);
    expect(n).toBeGreaterThanOrEqual(8);
  });
  it("count increases with additional clauses", () => {
    const base = countSections({ ...FULL_INPUT, additionalClauses: "" });
    const withExtra = countSections(FULL_INPUT);
    expect(withExtra).toBe(base + 2);
  });
});

describe("contract-template-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      contractType: "freelance",
      partyAName: "Acme",
      partyBName: "Jane",
      effectiveDate: "2026-07-13",
      sectionCount: 10,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        contractType: "nda-mutual",
        partyAName: `A${i}`,
        partyBName: `B${i}`,
        effectiveDate: "2026-07-13",
        sectionCount: 5,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      contractType: "freelance",
      partyAName: "A",
      partyBName: "B",
      effectiveDate: "2026-07-13",
      sectionCount: 5,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("contract-template-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(FULL_INPUT);
    expect(url).toContain("type=freelance");
    expect(url).toContain("pa=Acme+Corp");
    expect(url).toContain("eff=2026-07-13");
    expect(url).toContain("dur=6-months");
    expect(url).toContain("pt=net-30");
    expect(url).toContain("st=Texas");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips share URL", () => {
    const url = buildShareUrl(FULL_INPUT);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
    const parsed = parseShareUrl(hash);
    expect(parsed.contractType).toBe("freelance");
    expect(parsed.partyAName).toBe("Acme Corp");
    expect(parsed.effectiveDate).toBe("2026-07-13");
    expect(parsed.contractDuration).toBe("6-months");
    expect(parsed.paymentTerms).toBe("net-30");
    expect(parsed.governingState).toBe("Texas");
  });
  it("parses empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown contract type", () => {
    const parsed = parseShareUrl("type=unknown-type&pa=Acme");
    expect(parsed.contractType).toBeUndefined();
    expect(parsed.partyAName).toBe("Acme");
  });
  it("filters unknown duration", () => {
    const parsed = parseShareUrl("dur=foo");
    expect(parsed.contractDuration).toBeUndefined();
  });
  it("filters unknown payment terms", () => {
    const parsed = parseShareUrl("pt=bar");
    expect(parsed.paymentTerms).toBeUndefined();
  });
  it("parses compensation number", () => {
    const parsed = parseShareUrl("comp=7500.50");
    expect(parsed.compensationAmount).toBe(7500.5);
  });
  it("parses additional clauses", () => {
    const parsed = parseShareUrl("add=Clause+A%0AClause+B");
    expect(parsed.additionalClauses).toBe("Clause A\nClause B");
  });
});

// Suppress unused-import lint
export type _Unused = ContractType | ContractDuration | PaymentTerms;
