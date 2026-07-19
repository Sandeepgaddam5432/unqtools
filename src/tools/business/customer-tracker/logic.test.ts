import { describe, it, expect, beforeEach } from "vitest";
import {
  STATUS_PRESETS,
  STATUS_LABELS,
  STATUS_FILTER_OPTIONS,
  CURRENCY_PRESETS,
  DEFAULT_INPUT,
  normalizeStatus,
  normalizeString,
  isValidEmail,
  formatPhone,
  isValidDate,
  splitCsvRow,
  parseCustomers,
  computeDaysSinceLastContact,
  computeUrgency,
  filterByStatus,
  filterByDaysSinceContact,
  applyFilters,
  computeTotalValue,
  computeAverageValue,
  computeStatusBreakdown,
  computeFollowupPriority,
  findOverdueCustomers,
  countByUrgency,
  summaryStats,
  formatMoney,
  formatDays,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Status,
  type StatusFilter,
  type Urgency,
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

describe("customer-tracker constants", () => {
  it("has 5 status presets", () => {
    expect(STATUS_PRESETS).toHaveLength(5);
  });
  it("labels cover all 5 statuses", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(5);
    expect(STATUS_LABELS.active).toBe("Active");
    expect(STATUS_LABELS.churned).toBe("Churned");
  });
  it("filter options include all + 5 statuses (6 total)", () => {
    expect(STATUS_FILTER_OPTIONS).toHaveLength(6);
    expect(STATUS_FILTER_OPTIONS[0].value).toBe("all");
  });
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS.map((c) => c.code)).toContain("USD");
  });
  it("default input is sane", () => {
    expect(DEFAULT_INPUT.statusFilter).toBe("all");
    expect(DEFAULT_INPUT.currencySymbol).toBe("$");
    expect(DEFAULT_INPUT.daysSinceContact).toBe("");
  });
});

describe("customer-tracker normalizeStatus", () => {
  it("returns Status for known lowercase", () => {
    expect(normalizeStatus("active")).toBe("active");
    expect(normalizeStatus("lead")).toBe("lead");
  });
  it("handles aliases (churn, prospective)", () => {
    expect(normalizeStatus("churn")).toBe("churned");
    expect(normalizeStatus("prospective")).toBe("prospect");
  });
  it("is case-insensitive", () => {
    expect(normalizeStatus("Active")).toBe("active");
    expect(normalizeStatus("INACTIVE")).toBe("inactive");
  });
  it("returns null for unknown", () => {
    expect(normalizeStatus("won")).toBeNull();
    expect(normalizeStatus("")).toBeNull();
    expect(normalizeStatus("garbage")).toBeNull();
  });
});

describe("customer-tracker normalizeString", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeString("  Alice   Wonderland ")).toBe("Alice Wonderland");
  });
  it("handles empty", () => {
    expect(normalizeString("")).toBe("");
    expect(normalizeString(null as unknown as string)).toBe("");
  });
});

describe("customer-tracker isValidEmail", () => {
  it("accepts standard emails", () => {
    expect(isValidEmail("alice@acme.com")).toBe(true);
    expect(isValidEmail("bob.smith+filter@example.co.uk")).toBe(true);
  });
  it("rejects missing @ or domain", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("alice@")).toBe(false);
    expect(isValidEmail("alice@localhost")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });
});

describe("customer-tracker formatPhone", () => {
  it("normalizes 10-digit US number to +1-XXX-XXX-XXXX", () => {
    expect(formatPhone("5550100123")).toBe("+1-555-010-0123");
    expect(formatPhone("(555) 010-0123")).toBe("+1-555-010-0123");
    expect(formatPhone("555.010.0123")).toBe("+1-555-010-0123");
  });
  it("normalizes 11-digit number starting with 1", () => {
    expect(formatPhone("1-555-010-0123")).toBe("+1-555-010-0123");
    expect(formatPhone("15550100123")).toBe("+1-555-010-0123");
  });
  it("returns original string for non-US/unknown formats", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("12345")).toBe("12345");
  });
  it("returns empty for empty input", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("   ")).toBe("");
  });
});

describe("customer-tracker isValidDate", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(isValidDate("2026-07-10")).toBe(true);
    expect(isValidDate("2000-02-29")).toBe(true); // leap year
  });
  it("rejects invalid month/day", () => {
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-00-15")).toBe(false);
    expect(isValidDate("2026-07-32")).toBe(false);
  });
  it("rejects Feb 29 on non-leap year", () => {
    expect(isValidDate("2025-02-29")).toBe(false);
  });
  it("rejects wrong format", () => {
    expect(isValidDate("07/10/2026")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate("2026-7-10")).toBe(false);
  });
});

describe("customer-tracker splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"say ""hi""",x')).toEqual(['say "hi"', "x"]); });
});

describe("customer-tracker parseCustomers", () => {
  const text = `Alice,alice@acme.com,+1-555-0100,Acme Corp,2026-07-10,active,5000
Bob,bob@beta.com,(555) 222-3344,Beta LLC,2026-06-01,lead,2500
Carol,carol@gamma.com,555-333-4455,Gamma Inc,,prospect,`;

  it("parses valid rows", () => {
    const { customers, errors } = parseCustomers(text);
    expect(customers).toHaveLength(3);
    expect(errors).toHaveLength(0);
    expect(customers[0].name).toBe("Alice");
    expect(customers[0].value).toBe(5000);
    expect(customers[0].status).toBe("active");
    expect(customers[1].phone).toBe("+1-555-222-3344");
    expect(customers[2].value).toBe(0); // missing value defaults to 0
    expect(customers[2].status).toBe("prospect");
    expect(customers[2].lastContactDate).toBe("");
  });

  it("collects errors for invalid email but keeps row", () => {
    const t = "Dave,dave-bad-email,Dave Phone,Dave Co,2026-07-01,active,1000";
    const { customers, errors } = parseCustomers(t);
    expect(customers).toHaveLength(1);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain("invalid email");
  });

  it("errors on missing name and skips row", () => {
    const t = ",x@y.com,5550100123,Co,2026-07-01,active,1000";
    const { customers, errors } = parseCustomers(t);
    expect(customers).toHaveLength(0);
    expect(errors.some((e) => e.includes("empty customer name"))).toBe(true);
  });

  it("errors on unknown status and skips row", () => {
    const t = "Eve,eve@z.com,5551112233,Z Co,2026-07-01,superstar,1000";
    const { customers, errors } = parseCustomers(t);
    expect(customers).toHaveLength(0);
    expect(errors[0]).toContain("unknown status");
  });

  it("defaults status to lead when omitted", () => {
    const t = "Frank,frank@z.com,5551112233,Z Co,2026-07-01";
    const { customers, errors } = parseCustomers(t);
    expect(customers).toHaveLength(1);
    expect(customers[0].status).toBe("lead");
    expect(customers[0].value).toBe(0);
    expect(errors).toHaveLength(0);
  });

  it("skips blank and comment lines", () => {
    const t = `# this is a comment
Alice,alice@acme.com,5550100123,Acme,2026-07-01,active,1000

# another comment
Bob,bob@b.com,5552223344,B Co,,lead,500`;
    const { customers } = parseCustomers(t);
    expect(customers).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    const { customers, errors } = parseCustomers("");
    expect(customers).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("customer-tracker computeDaysSinceLastContact", () => {
  it("returns positive integer days", () => {
    expect(computeDaysSinceLastContact("2026-07-15", "2026-07-10")).toBe(5);
  });
  it("returns 0 for same day", () => {
    expect(computeDaysSinceLastContact("2026-07-10", "2026-07-10")).toBe(0);
  });
  it("returns negative for future date", () => {
    expect(computeDaysSinceLastContact("2026-07-10", "2026-07-15")).toBe(-5);
  });
  it("returns null for empty or invalid date", () => {
    expect(computeDaysSinceLastContact("", "2026-07-10")).toBeNull();
    expect(computeDaysSinceLastContact("2026-07-10", "")).toBeNull();
    expect(computeDaysSinceLastContact("garbage", "2026-07-10")).toBeNull();
  });
});

describe("customer-tracker computeUrgency", () => {
  it("urgent when > 30 days", () => {
    expect(computeUrgency(31)).toBe("urgent");
    expect(computeUrgency(100)).toBe("urgent");
  });
  it("normal when 14-30 days inclusive", () => {
    expect(computeUrgency(14)).toBe("normal");
    expect(computeUrgency(30)).toBe("normal");
  });
  it("recent when < 14 days", () => {
    expect(computeUrgency(0)).toBe("recent");
    expect(computeUrgency(13)).toBe("recent");
  });
  it("none when null or future date", () => {
    expect(computeUrgency(null)).toBe("none");
    expect(computeUrgency(-5)).toBe("none");
  });
});

describe("customer-tracker filters", () => {
  const sample = [
    { name: "A", email: "a@x.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "C1", lastContactDate: "2026-07-10", status: "active" as Status, value: 1000, lineIndex: 1 },
    { name: "B", email: "b@x.com", phone: "+1-555-010-0002", phoneRaw: "5550100002", company: "C2", lastContactDate: "2026-06-01", status: "lead" as Status, value: 2000, lineIndex: 2 },
    { name: "C", email: "c@x.com", phone: "+1-555-010-0003", phoneRaw: "5550100003", company: "C3", lastContactDate: "", status: "prospect" as Status, value: 500, lineIndex: 3 },
  ];

  it("filterByStatus returns all when 'all'", () => {
    expect(filterByStatus(sample, "all")).toHaveLength(3);
  });
  it("filterByStatus filters by status", () => {
    expect(filterByStatus(sample, "lead")).toHaveLength(1);
    expect(filterByStatus(sample, "lead")[0].name).toBe("B");
  });
  it("filterByDaysSinceContact includes customers with no date", () => {
    // Only C has no date → always included regardless of minDays
    const out = filterByDaysSinceContact(sample, 90, "2026-07-15");
    expect(out.some((c) => c.name === "C")).toBe(true);
  });
  it("filterByDaysSinceContact excludes recent contacts at threshold", () => {
    // today=2026-07-15, A's last=2026-07-10 → 5 days → excluded when minDays=14
    const out = filterByDaysSinceContact(sample, 14, "2026-07-15");
    expect(out.some((c) => c.name === "A")).toBe(false);
    expect(out.some((c) => c.name === "B")).toBe(true);  // 44 days
    expect(out.some((c) => c.name === "C")).toBe(true);  // no date
  });
  it("filterByDaysSinceContact returns all when minDays <= 0", () => {
    expect(filterByDaysSinceContact(sample, 0, "2026-07-15")).toHaveLength(3);
  });
  it("applyFilters combines status + days", () => {
    const out = applyFilters(sample, "all", "30", "2026-07-15");
    // 30+ days → B (44d). C has no date → included. A (5d) → excluded.
    expect(out.map((c) => c.name).sort()).toEqual(["B", "C"]);
  });
  it("applyFilters applies status only when days empty", () => {
    const out = applyFilters(sample, "lead", "", "2026-07-15");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("B");
  });
});

describe("customer-tracker value calculations", () => {
  const sample = [
    { name: "A", email: "a@x.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "", lastContactDate: "", status: "active" as Status, value: 1000, lineIndex: 1 },
    { name: "B", email: "b@x.com", phone: "+1-555-010-0002", phoneRaw: "5550100002", company: "", lastContactDate: "", status: "lead" as Status, value: 2000, lineIndex: 2 },
    { name: "C", email: "c@x.com", phone: "+1-555-010-0003", phoneRaw: "5550100003", company: "", lastContactDate: "", status: "active" as Status, value: 500, lineIndex: 3 },
  ];

  it("computeTotalValue sums values", () => {
    expect(computeTotalValue(sample)).toBe(3500);
  });
  it("computeAverageValue returns mean", () => {
    expect(computeAverageValue(sample)).toBeCloseTo(1166.6667, 3);
  });
  it("computeAverageValue returns 0 for empty list", () => {
    expect(computeAverageValue([])).toBe(0);
  });
  it("computeStatusBreakdown returns 5 rows in preset order", () => {
    const rows = computeStatusBreakdown(sample);
    expect(rows).toHaveLength(5);
    expect(rows[0].status).toBe("active");
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalValue).toBe(1500);
    expect(rows[0].avgValue).toBe(750);
    expect(rows[2].status).toBe("lead");
    expect(rows[2].count).toBe(1);
  });
});

describe("customer-tracker follow-up priority + overdue", () => {
  const sample = [
    { name: "Recent", email: "r@x.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "", lastContactDate: "2026-07-14", status: "active" as Status, value: 100, lineIndex: 1 },
    { name: "Old",     email: "o@x.com", phone: "+1-555-010-0002", phoneRaw: "5550100002", company: "", lastContactDate: "2026-05-01", status: "lead" as Status,   value: 200, lineIndex: 2 },
    { name: "Never",   email: "n@x.com", phone: "+1-555-010-0003", phoneRaw: "5550100003", company: "", lastContactDate: "",            status: "prospect" as Status, value: 300, lineIndex: 3 },
  ];
  const today = "2026-07-15";

  it("computeFollowupPriority sorts no-date first, then oldest first", () => {
    const out = computeFollowupPriority(sample, today);
    expect(out.map((p) => p.customer.name)).toEqual(["Never", "Old", "Recent"]);
    expect(out[0].days).toBeNull();
    expect(out[1].days).toBe(75); // 2026-05-01 → 2026-07-15
    expect(out[2].days).toBe(1);
  });
  it("computeFollowupPriority assigns correct urgency tier", () => {
    const out = computeFollowupPriority(sample, today);
    const byName = Object.fromEntries(out.map((p) => [p.customer.name, p.urgency]));
    expect(byName["Never"]).toBe("none");
    expect(byName["Old"]).toBe("urgent");
    expect(byName["Recent"]).toBe("recent");
  });
  it("findOverdueCustomers returns customers with days >= minDays plus no-date", () => {
    const out = findOverdueCustomers(sample, 30, today);
    expect(out.map((c) => c.name).sort()).toEqual(["Never", "Old"]);
  });
  it("countByUrgency tallies each tier", () => {
    const out = countByUrgency(sample, today);
    expect(out.urgent).toBe(1);
    expect(out.recent).toBe(1);
    expect(out.none).toBe(1);
    expect(out.normal).toBe(0);
  });
});

describe("customer-tracker summaryStats", () => {
  const sample = [
    { name: "A", email: "a@x.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "", lastContactDate: "2026-07-10", status: "active" as Status, value: 5000, lineIndex: 1 },
    { name: "B", email: "b@x.com", phone: "+1-555-010-0002", phoneRaw: "5550100002", company: "", lastContactDate: "2026-05-01", status: "lead" as Status,   value: 2500, lineIndex: 2 },
    { name: "C", email: "c@x.com", phone: "+1-555-010-0003", phoneRaw: "5550100003", company: "", lastContactDate: "",            status: "prospect" as Status, value: 0, lineIndex: 3 },
  ];

  it("aggregates totals + per-status counts", () => {
    const stats = summaryStats(sample, "30", "2026-07-15");
    expect(stats.totalCustomers).toBe(3);
    expect(stats.totalValue).toBe(7500);
    expect(stats.averageValue).toBeCloseTo(2500, 3);
    expect(stats.statusCounts.active).toBe(1);
    expect(stats.statusCounts.lead).toBe(1);
    expect(stats.statusCounts.prospect).toBe(1);
    expect(stats.overdueCount).toBe(2); // B + C
    expect(stats.urgentCount).toBe(1);  // B
    expect(stats.recentCount).toBe(1);  // A (5 days)
    expect(stats.noContactCount).toBe(1); // C
    expect(stats.topCustomer?.name).toBe("A");
  });

  it("returns zeroed stats for empty input", () => {
    const stats = summaryStats([], "", "");
    expect(stats.totalCustomers).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.averageValue).toBe(0);
    expect(stats.topCustomer).toBeNull();
    expect(stats.overdueCount).toBe(0);
  });

  it("topCustomer picks highest value", () => {
    const stats = summaryStats(sample, "", "");
    expect(stats.topCustomer?.name).toBe("A");
    expect(stats.topCustomer?.value).toBe(5000);
  });
});

describe("customer-tracker formatting", () => {
  it("formatMoney prepends symbol with 2 decimals", () => {
    expect(formatMoney(1234.5, "$")).toBe("$1234.50");
    expect(formatMoney(0, "€")).toBe("€0.00");
  });
  it("formatMoney handles NaN/Infinity", () => {
    expect(formatMoney(NaN, "$")).toBe("$0.00");
    expect(formatMoney(Infinity, "$")).toBe("$0.00");
  });
  it("formatDays formats counts", () => {
    expect(formatDays(0)).toBe("0 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(5)).toBe("5 days");
    expect(formatDays(null)).toBe("—");
    expect(formatDays(-3)).toBe("in 3 day(s)");
  });
});

describe("customer-tracker renderText", () => {
  const sample = [
    { name: "Alice", email: "alice@acme.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "Acme Corp", lastContactDate: "2026-07-10", status: "active" as Status, value: 5000, lineIndex: 1 },
    { name: "Bob", email: "bob@beta.com", phone: "+1-555-010-0002", phoneRaw: "5550100002", company: "Beta LLC", lastContactDate: "2026-05-01", status: "lead" as Status, value: 2500, lineIndex: 2 },
  ];
  const input = {
    customersText: "alice...,bob...",
    statusFilter: "all" as StatusFilter,
    daysSinceContact: "",
    currencySymbol: "$",
    today: "2026-07-15",
  };

  it("renders report header + summary + sections + priority", () => {
    const txt = renderText(input, sample);
    expect(txt).toContain("=== Customer Tracker Report ===");
    expect(txt).toContain("--- Summary ---");
    expect(txt).toContain("Total customers:   2");
    expect(txt).toContain("Total value:       $7500.00");
    expect(txt).toContain("--- Status Breakdown ---");
    expect(txt).toContain("[Active] — 1 customer(s)");
    expect(txt).toContain("Alice <alice@acme.com>");
    expect(txt).toContain("--- Follow-up Priority");
    expect(txt).toContain("Bob"); // oldest first
  });

  it("returns 'No customers' for empty input", () => {
    const txt = renderText(input, []);
    expect(txt).toBe("No customers to report.");
  });
});

describe("customer-tracker renderCsv", () => {
  const sample = [
    { name: "Alice Wonderland", email: "alice@acme.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "Acme Corp", lastContactDate: "2026-07-10", status: "active" as Status, value: 5000, lineIndex: 1 },
  ];

  it("renders header row", () => {
    const csv = renderCsv([], "");
    expect(csv).toBe("name,email,phone,company,last_contact,status,value,days_since");
  });
  it("renders customer row with days_since", () => {
    const csv = renderCsv(sample, "2026-07-15");
    expect(csv.split("\n")).toHaveLength(2);
    // Alice Wonderland has a space (not escaped) but appears as the first field
    expect(csv).toContain("Alice Wonderland,alice@acme.com");
    expect(csv).toContain("alice@acme.com,+1-555-010-0001,Acme Corp,2026-07-10,active,5000.00,5");
  });
  it("escapes commas in name with CSV quoting", () => {
    const sample2 = [
      { name: "Alice, Jr.", email: "alice@acme.com", phone: "+1-555-010-0001", phoneRaw: "5550100001", company: "Acme Corp", lastContactDate: "2026-07-10", status: "active" as Status, value: 5000, lineIndex: 1 },
    ];
    const csv = renderCsv(sample2, "2026-07-15");
    expect(csv).toContain('"Alice, Jr."');
  });
  it("days_since is empty when no today or no date", () => {
    const csvNoToday = renderCsv(sample, "");
    expect(csvNoToday).toContain(",active,5000.00,");
    const sampleNoDate = [
      { name: "Bob", email: "b@b.com", phone: "+1-555-010-0002", phoneRaw: "5550100002", company: "", lastContactDate: "", status: "lead" as Status, value: 1000, lineIndex: 1 },
    ];
    const csv = renderCsv(sampleNoDate, "2026-07-15");
    expect(csv).toContain(",lead,1000.00,");
  });
});

describe("customer-tracker history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      customersText: "Alice,alice@acme.com,5550100123,Acme,2026-07-10,active,5000",
      customerCount: 1,
      totalValue: 5000,
      averageValue: 5000,
      overdueCount: 0,
      currencySymbol: "$",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        customersText: "x",
        customerCount: 1,
        totalValue: 100,
        averageValue: 100,
        overdueCount: 0,
        currencySymbol: "$",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      customersText: "x",
      customerCount: 1,
      totalValue: 100,
      averageValue: 100,
      overdueCount: 0,
      currencySymbol: "$",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("customer-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      customersText: "Alice,alice@acme.com,5550100123,Acme,2026-07-10,active,5000",
      statusFilter: "active",
      daysSinceContact: "14",
      currencySymbol: "$",
      today: "",
    });
    expect(url).toContain("customers=Alice");
    expect(url).toContain("status=active");
    expect(url).toContain("days=14");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("customers", "Alice,alice@acme.com,5550100123,Acme,2026-07-10,active,5000");
    params.set("status", "lead");
    params.set("days", "30");
    params.set("cur", "€");
    const parsed = parseShareUrl(`#${params.toString()}`);
    expect(parsed.customersText).toContain("Alice");
    expect(parsed.statusFilter).toBe("lead");
    expect(parsed.daysSinceContact).toBe("30");
    expect(parsed.currencySymbol).toBe("€");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ ...DEFAULT_INPUT });
  });
  it("filters unknown statuses", () => {
    const parsed = parseShareUrl("status=garbage");
    expect(parsed.statusFilter).toBe("all");
  });
  it("rejects non-numeric days", () => {
    const parsed = parseShareUrl("days=abc");
    expect(parsed.daysSinceContact).toBe("");
  });
  it("rejects unknown currency symbol", () => {
    const parsed = parseShareUrl("cur=₩");
    expect(parsed.currencySymbol).toBe("$");
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = Status | StatusFilter | Urgency;
