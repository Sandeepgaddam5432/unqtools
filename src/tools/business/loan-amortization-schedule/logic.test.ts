import { describe, it, expect, beforeEach } from "vitest";
import {
  FREQUENCY_PAYMENTS_PER_YEAR,
  FREQUENCY_DAYS,
  FREQUENCY_LABELS,
  PRESET_EXAMPLES,
  validateInput,
  parseDate,
  formatDate,
  addDays,
  addMonths,
  nextPaymentDate,
  calcPeriodicRate,
  calcTotalPayments,
  calcPayment,
  calcInterestPayment,
  calcPrincipalPayment,
  applyPrincipal,
  generateSchedule,
  calcTotalInterest,
  calcTotalPaid,
  calcPayoffDate,
  computeLoan,
  computeSavings,
  yearByYearSummary,
  formatNumber,
  formatPercent,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LoanInput,
  type PaymentFrequency,
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

function sampleInput(overrides: Partial<LoanInput> = {}): LoanInput {
  return {
    loanAmount: 10000,
    annualInterestRate: 6,
    loanTermYears: 1,
    startDate: "2024-01-01",
    paymentFrequency: "monthly",
    extraPayment: 0,
    ...overrides,
  };
}

describe("loan-amort constants", () => {
  it("has 3 frequencies", () => {
    expect(Object.keys(FREQUENCY_PAYMENTS_PER_YEAR)).toHaveLength(3);
  });
  it("monthly = 12 payments/year", () => {
    expect(FREQUENCY_PAYMENTS_PER_YEAR.monthly).toBe(12);
  });
  it("bi-weekly = 26 payments/year", () => {
    expect(FREQUENCY_PAYMENTS_PER_YEAR["bi-weekly"]).toBe(26);
  });
  it("weekly = 52 payments/year", () => {
    expect(FREQUENCY_PAYMENTS_PER_YEAR.weekly).toBe(52);
  });
  it("has day counts", () => {
    expect(FREQUENCY_DAYS["bi-weekly"]).toBe(14);
    expect(FREQUENCY_DAYS.weekly).toBe(7);
    expect(FREQUENCY_DAYS.monthly).toBe(30);
  });
  it("has labels for all frequencies", () => {
    expect(FREQUENCY_LABELS.monthly).toContain("Monthly");
    expect(FREQUENCY_LABELS["bi-weekly"]).toContain("Bi-weekly");
    expect(FREQUENCY_LABELS.weekly).toContain("Weekly");
  });
  it("has 5 preset examples", () => {
    expect(PRESET_EXAMPLES).toHaveLength(5);
    expect(PRESET_EXAMPLES.some((p) => p.name === "30-yr mortgage")).toBe(true);
  });
});

describe("loan-amort validateInput", () => {
  it("passes for valid input", () => {
    expect(validateInput(sampleInput())).toEqual([]);
  });
  it("errors when loan amount is not positive", () => {
    expect(validateInput(sampleInput({ loanAmount: 0 }))).toContain(
      "Loan amount must be a positive number.",
    );
  });
  it("errors when rate is negative", () => {
    expect(validateInput(sampleInput({ annualInterestRate: -1 }))).toContain(
      "Annual interest rate must be a non-negative number.",
    );
  });
  it("allows zero interest rate (interest-free loan)", () => {
    expect(validateInput(sampleInput({ annualInterestRate: 0 }))).toEqual([]);
  });
  it("errors when term is not positive", () => {
    expect(validateInput(sampleInput({ loanTermYears: 0 }))).toContain(
      "Loan term must be a positive number of years.",
    );
  });
  it("errors when extra payment is negative", () => {
    expect(validateInput(sampleInput({ extraPayment: -50 }))).toContain(
      "Extra payment must be a non-negative number.",
    );
  });
  it("errors when start date is malformed", () => {
    expect(validateInput(sampleInput({ startDate: "01/01/2024" })).length).toBeGreaterThan(0);
  });
  it("errors when start date is invalid calendar date", () => {
    expect(validateInput(sampleInput({ startDate: "2024-13-45" })).length).toBeGreaterThan(0);
  });
});

describe("loan-amort date helpers", () => {
  it("parses YYYY-MM-DD", () => {
    const d = parseDate("2024-03-15");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });
  it("returns invalid date for bad input", () => {
    expect(Number.isNaN(parseDate("bad").getTime())).toBe(true);
  });
  it("formats date back", () => {
    expect(formatDate(parseDate("2024-03-15"))).toBe("2024-03-15");
  });
  it("addDays advances correctly", () => {
    const d = parseDate("2024-01-01");
    expect(formatDate(addDays(d, 14))).toBe("2024-01-15");
  });
  it("addMonths advances correctly", () => {
    const d = parseDate("2024-01-01");
    expect(formatDate(addMonths(d, 1))).toBe("2024-02-01");
  });
  it("nextPaymentDate for monthly adds 1 month", () => {
    const d = parseDate("2024-01-01");
    expect(formatDate(nextPaymentDate(d, "monthly"))).toBe("2024-02-01");
  });
  it("nextPaymentDate for bi-weekly adds 14 days", () => {
    const d = parseDate("2024-01-01");
    expect(formatDate(nextPaymentDate(d, "bi-weekly"))).toBe("2024-01-15");
  });
  it("nextPaymentDate for weekly adds 7 days", () => {
    const d = parseDate("2024-01-01");
    expect(formatDate(nextPaymentDate(d, "weekly"))).toBe("2024-01-08");
  });
});

describe("loan-amort rate / count calculations", () => {
  it("calcPeriodicRate monthly = annual/12/100", () => {
    expect(calcPeriodicRate(6, "monthly")).toBeCloseTo(0.005, 6);
  });
  it("calcPeriodicRate bi-weekly = annual/26/100", () => {
    expect(calcPeriodicRate(6, "bi-weekly")).toBeCloseTo(6 / 26 / 100, 6);
  });
  it("calcPeriodicRate weekly = annual/52/100", () => {
    expect(calcPeriodicRate(6, "weekly")).toBeCloseTo(6 / 52 / 100, 6);
  });
  it("calcTotalPayments monthly 1yr = 12", () => {
    expect(calcTotalPayments(1, "monthly")).toBe(12);
  });
  it("calcTotalPayments bi-weekly 1yr = 26", () => {
    expect(calcTotalPayments(1, "bi-weekly")).toBe(26);
  });
  it("calcTotalPayments weekly 1yr = 52", () => {
    expect(calcTotalPayments(1, "weekly")).toBe(52);
  });
});

describe("loan-amort calcPayment", () => {
  it("computes standard amortization payment", () => {
    // P=10000, r=0.005, n=12 → payment ≈ 860.66
    const pmt = calcPayment(10000, 0.005, 12);
    expect(pmt).toBeCloseTo(860.66, 1);
  });
  it("returns principal/n when rate is 0", () => {
    expect(calcPayment(12000, 0, 12)).toBe(1000);
  });
  it("returns 0 when principal is 0", () => {
    expect(calcPayment(0, 0.005, 12)).toBe(0);
  });
  it("returns 0 when n is 0", () => {
    expect(calcPayment(10000, 0.005, 0)).toBe(0);
  });
});

describe("loan-amort per-payment calculations", () => {
  it("calcInterestPayment = balance × rate", () => {
    expect(calcInterestPayment(10000, 0.005)).toBe(50);
  });
  it("calcInterestPayment returns 0 when balance is 0", () => {
    expect(calcInterestPayment(0, 0.005)).toBe(0);
  });
  it("calcPrincipalPayment subtracts interest and adds extra", () => {
    // payment=860.66, interest=50, extra=100, balance=10000 → 910.66
    const principal = calcPrincipalPayment(860.66, 50, 100, 10000);
    expect(principal).toBeCloseTo(910.66, 2);
  });
  it("calcPrincipalPayment caps at balance", () => {
    // payment=2000, interest=10, extra=0, balance=500 → capped to 500
    expect(calcPrincipalPayment(2000, 10, 0, 500)).toBe(500);
  });
  it("calcPrincipalPayment returns 0 when balance is 0", () => {
    expect(calcPrincipalPayment(1000, 0, 0, 0)).toBe(0);
  });
  it("applyPrincipal subtracts principal", () => {
    expect(applyPrincipal(10000, 810.66)).toBeCloseTo(9189.34, 2);
  });
  it("applyPrincipal floors at 0", () => {
    expect(applyPrincipal(100, 500)).toBe(0);
  });
});

describe("loan-amort generateSchedule", () => {
  it("produces 12 monthly payments for a 1-yr loan", () => {
    const schedule = generateSchedule(sampleInput());
    expect(schedule).toHaveLength(12);
  });
  it("first payment has interest = balance × rate", () => {
    const schedule = generateSchedule(sampleInput());
    expect(schedule[0].interest).toBeCloseTo(50, 0); // 10000 × 0.005 = 50
  });
  it("final payment leaves 0 balance", () => {
    const schedule = generateSchedule(sampleInput());
    expect(schedule[schedule.length - 1].balance).toBeLessThan(0.02);
  });
  it("payment dates advance monthly", () => {
    const schedule = generateSchedule(sampleInput());
    expect(schedule[0].date).toBe("2024-01-01");
    expect(schedule[1].date).toBe("2024-02-01");
    expect(schedule[2].date).toBe("2024-03-01");
  });
  it("extra payment reduces schedule length", () => {
    const without = generateSchedule(sampleInput({ extraPayment: 0 }));
    const withExtra = generateSchedule(sampleInput({ extraPayment: 200 }));
    expect(withExtra.length).toBeLessThan(without.length);
  });
  it("bi-weekly schedule has 26 payments for 1-yr loan", () => {
    const schedule = generateSchedule(sampleInput({ paymentFrequency: "bi-weekly" }));
    expect(schedule).toHaveLength(26);
  });
  it("weekly schedule has 52 payments for 1-yr loan", () => {
    const schedule = generateSchedule(sampleInput({ paymentFrequency: "weekly" }));
    expect(schedule).toHaveLength(52);
  });
  it("interest-free loan produces equal principal payments", () => {
    const schedule = generateSchedule(sampleInput({ annualInterestRate: 0 }));
    // 10000 / 12 ≈ 833.33
    expect(schedule[0].principal).toBeCloseTo(833.33, 1);
    expect(schedule[0].interest).toBe(0);
  });
});

describe("loan-amort totals", () => {
  it("calcTotalInterest sums interest across schedule", () => {
    const schedule = generateSchedule(sampleInput());
    const total = calcTotalInterest(schedule);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(1000); // 1-year loan at 6% — interest should be small
  });
  it("calcTotalPaid = principal + interest", () => {
    const total = calcTotalPaid(10000, 328);
    expect(total).toBe(10328);
  });
  it("calcPayoffDate returns last payment date", () => {
    const schedule = generateSchedule(sampleInput());
    expect(calcPayoffDate(schedule)).toBe(schedule[schedule.length - 1].date);
  });
  it("calcPayoffDate returns null for empty schedule", () => {
    expect(calcPayoffDate([])).toBe(null);
  });
});

describe("loan-amort computeLoan", () => {
  it("returns valid result for proper input", () => {
    const r = computeLoan(sampleInput());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.paymentsPerYear).toBe(12);
    expect(r.totalPayments).toBe(12);
    expect(r.payment).toBeCloseTo(860.66, 1);
    expect(r.actualPayments).toBe(12);
    expect(r.schedule).toHaveLength(12);
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.totalPaid).toBeGreaterThan(10000);
    expect(r.payoffDate).toBe("2024-12-01");
  });
  it("marks invalid for bad input", () => {
    const r = computeLoan(sampleInput({ loanAmount: -1 }));
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.schedule).toEqual([]);
    expect(r.totalPayments).toBe(0);
    expect(r.payment).toBe(0);
  });
  it("handles bi-weekly frequency", () => {
    const r = computeLoan(sampleInput({ paymentFrequency: "bi-weekly" }));
    expect(r.paymentsPerYear).toBe(26);
    expect(r.totalPayments).toBe(26);
  });
  it("handles weekly frequency", () => {
    const r = computeLoan(sampleInput({ paymentFrequency: "weekly" }));
    expect(r.paymentsPerYear).toBe(52);
    expect(r.totalPayments).toBe(52);
  });
  it("extra payment shortens actual payments", () => {
    const r = computeLoan(sampleInput({ extraPayment: 200 }));
    expect(r.actualPayments).toBeLessThan(12);
    expect(r.schedule.length).toBeLessThan(12);
  });
  it("interest-free loan yields principal-only payments", () => {
    const r = computeLoan(sampleInput({ annualInterestRate: 0 }));
    expect(r.payment).toBeCloseTo(833.33, 1);
    expect(r.totalInterest).toBe(0);
  });
});

describe("loan-amort computeSavings", () => {
  it("reports zero savings when no extra payment", () => {
    const s = computeSavings(sampleInput({ extraPayment: 0 }));
    expect(s.interestSavings).toBe(0);
    expect(s.paymentsSaved).toBe(0);
  });
  it("reports positive savings with extra payment", () => {
    const s = computeSavings(sampleInput({ extraPayment: 200, loanTermYears: 5, loanAmount: 50000 }));
    expect(s.interestSavings).toBeGreaterThan(0);
    expect(s.paymentsSaved).toBeGreaterThan(0);
    expect(s.monthsSaved).toBeGreaterThan(0);
  });
  it("with-extra payoff date is earlier than without", () => {
    const s = computeSavings(sampleInput({ extraPayment: 200, loanTermYears: 5, loanAmount: 50000 }));
    const withDate = parseDate(s.withExtra.payoffDate ?? "2099-01-01").getTime();
    const withoutDate = parseDate(s.withoutExtra.payoffDate ?? "2099-01-01").getTime();
    expect(withDate).toBeLessThanOrEqual(withoutDate);
  });
});

describe("loan-amort yearByYearSummary", () => {
  it("returns empty for empty schedule", () => {
    expect(yearByYearSummary([])).toEqual([]);
  });
  it("groups payments by year", () => {
    const schedule = generateSchedule(sampleInput({ loanTermYears: 2 }));
    const yby = yearByYearSummary(schedule);
    expect(yby.length).toBeGreaterThanOrEqual(2);
    expect(yby[0].year).toBe(2024);
    expect(yby[0].paymentCount).toBe(12);
  });
  it("ending balance matches last payment of the year", () => {
    const schedule = generateSchedule(sampleInput());
    const yby = yearByYearSummary(schedule);
    expect(yby[0].endingBalance).toBe(schedule[schedule.length - 1].balance);
  });
});

describe("loan-amort formatting", () => {
  it("formatNumber formats with 2 decimals", () => {
    expect(formatNumber(1234.567)).toBe("1234.57");
  });
  it("formatNumber handles null and NaN", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
  });
  it("formatNumber handles negative", () => {
    expect(formatNumber(-50)).toBe("-50.00");
  });
  it("formatPercent formats", () => {
    expect(formatPercent(6.5)).toBe("6.50%");
  });
});

describe("loan-amort renderText", () => {
  it("renders header and summary", () => {
    const r = computeLoan(sampleInput());
    const text = renderText(sampleInput(), r);
    expect(text).toContain("LOAN AMORTIZATION SCHEDULE");
    expect(text).toContain("Periodic payment:");
    expect(text).toContain("Total interest:");
    expect(text).toContain("AMORTIZATION TABLE");
    expect(text).toContain("YEAR-BY-YEAR SUMMARY");
  });
  it("includes validation errors for invalid input", () => {
    const input = sampleInput({ loanAmount: -1 });
    const r = computeLoan(input);
    const text = renderText(input, r);
    expect(text).toContain("VALIDATION ERRORS");
  });
  it("includes savings section when extra payment > 0", () => {
    const input = sampleInput({ extraPayment: 100, loanTermYears: 5, loanAmount: 50000 });
    const r = computeLoan(input);
    const text = renderText(input, r);
    expect(text).toContain("EXTRA PAYMENT SAVINGS");
    expect(text).toContain("Interest saved:");
  });
});

describe("loan-amort renderCsv", () => {
  it("renders field/value header", () => {
    const csv = renderCsv(sampleInput(), computeLoan(sampleInput()));
    expect(csv).toContain("field,value");
    expect(csv).toContain("loan_amount,10000.0000");
  });
  it("renders schedule header and rows", () => {
    const csv = renderCsv(sampleInput(), computeLoan(sampleInput()));
    expect(csv).toContain("payment_num,date,payment,extra_payment,principal,interest,balance");
    expect(csv).toContain("1,2024-01-01,");
  });
  it("renders year-by-year section", () => {
    const csv = renderCsv(sampleInput({ loanTermYears: 2 }), computeLoan(sampleInput({ loanTermYears: 2 })));
    expect(csv).toContain("year,payment_count,total_paid,total_principal,total_interest,ending_balance");
  });
  it("renders savings fields when extra payment > 0", () => {
    const csv = renderCsv(
      sampleInput({ extraPayment: 100, loanTermYears: 5, loanAmount: 50000 }),
      computeLoan(sampleInput({ extraPayment: 100, loanTermYears: 5, loanAmount: 50000 })),
    );
    expect(csv).toContain("interest_savings,");
    expect(csv).toContain("payments_saved,");
  });
  it("renders error rows for invalid input", () => {
    const csv = renderCsv(sampleInput({ loanAmount: -1 }), computeLoan(sampleInput({ loanAmount: -1 })));
    expect(csv).toContain("error,validation");
  });
});

describe("loan-amort summaryStats", () => {
  it("builds summary without savings", () => {
    const r = computeLoan(sampleInput());
    const s = summaryStats(r);
    expect(s.payment).toBeCloseTo(860.66, 1);
    expect(s.totalInterest).toBeGreaterThan(0);
    expect(s.interestSavings).toBe(0);
    expect(s.actualPayments).toBe(12);
    expect(s.totalPayments).toBe(12);
  });
  it("includes savings when provided", () => {
    const r = computeLoan(sampleInput({ extraPayment: 100, loanTermYears: 5, loanAmount: 50000 }));
    const savings = computeSavings(sampleInput({ extraPayment: 100, loanTermYears: 5, loanAmount: 50000 }));
    const s = summaryStats(r, savings);
    expect(s.interestSavings).toBeGreaterThan(0);
    expect(s.paymentsSaved).toBeGreaterThan(0);
  });
});

describe("loan-amort history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      loanAmount: 10000,
      annualInterestRate: 6,
      loanTermYears: 1,
      paymentFrequency: "monthly",
      payment: 860.66,
      totalInterest: 328,
      extraPayment: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        loanAmount: 1000,
        annualInterestRate: 5,
        loanTermYears: 1,
        paymentFrequency: "monthly",
        payment: 85.81,
        totalInterest: 30,
        extraPayment: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      loanAmount: 10000,
      annualInterestRate: 6,
      loanTermYears: 1,
      paymentFrequency: "monthly",
      payment: 860.66,
      totalInterest: 328,
      extraPayment: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("loan-amort shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      loanAmount: 10000,
      annualInterestRate: 6,
      loanTermYears: 1,
      startDate: "2024-01-01",
      paymentFrequency: "monthly",
      extraPayment: 50,
    });
    expect(url).toContain("amt=10000");
    expect(url).toContain("rate=6");
    expect(url).toContain("years=1");
    expect(url).toContain("start=2024-01-01");
    expect(url).toContain("freq=monthly");
    expect(url).toContain("extra=50");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits extra when 0", () => {
    const url = buildShareUrl({ extraPayment: 0 });
    expect(url).not.toContain("extra=");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("amt=10000&rate=6&years=1&start=2024-01-01&freq=monthly&extra=50");
    expect(p).toEqual({
      loanAmount: 10000,
      annualInterestRate: 6,
      loanTermYears: 1,
      startDate: "2024-01-01",
      paymentFrequency: "monthly",
      extraPayment: 50,
    });
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid frequency", () => {
    const p = parseShareUrl("freq=daily");
    expect(p.paymentFrequency).toBeUndefined();
  });
  it("filters malformed start date", () => {
    const p = parseShareUrl("start=01-01-2024");
    expect(p.startDate).toBeUndefined();
  });
  it("ignores non-finite numbers", () => {
    const p = parseShareUrl("amt=abc&rate=6");
    expect(p.loanAmount).toBeUndefined();
    expect(p.annualInterestRate).toBe(6);
  });
});

// Suppress unused-import lint
export type _Unused = PaymentFrequency;
