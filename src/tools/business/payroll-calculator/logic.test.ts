import { describe, it, expect, beforeEach } from "vitest";
import {
  PAY_FREQUENCIES,
  EMPLOYEE_TYPES,
  PAY_FREQUENCY_LABELS,
  EMPLOYEE_TYPE_LABELS,
  PAY_PERIODS_PER_YEAR,
  CURRENCY_SYMBOLS,
  DEFAULT_RATES,
  DEFAULT_INPUT,
  normalizeEmployeeName,
  clampNonNegative,
  clampPercent,
  parsePeriodNumber,
  isValidPayPeriod,
  computeHourlyGross,
  computeSalariedGross,
  computeFederalTax,
  computeStateTax,
  computeSocialSecurity,
  computeMedicare,
  compute401k,
  computeHealthInsurance,
  sumDeductions,
  computeEffectiveTaxRate,
  computeYTD,
  computePayroll,
  summaryStats,
  formatCurrency,
  formatPercent,
  renderText,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PayrollInput,
  type PayFrequency,
  type EmployeeType,
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

// ---- Constants ----

describe("payroll-calculator constants", () => {
  it("has 4 pay frequencies", () => {
    expect(PAY_FREQUENCIES).toEqual(["weekly", "bi-weekly", "semi-monthly", "monthly"]);
  });
  it("has 2 employee types", () => {
    expect(EMPLOYEE_TYPES).toEqual(["hourly", "salaried"]);
  });
  it("has labels for every frequency", () => {
    for (const f of PAY_FREQUENCIES) {
      expect(PAY_FREQUENCY_LABELS[f]).toBeTruthy();
    }
  });
  it("has labels for every employee type", () => {
    for (const t of EMPLOYEE_TYPES) {
      expect(EMPLOYEE_TYPE_LABELS[t]).toBeTruthy();
    }
  });
  it("has correct periods per year", () => {
    expect(PAY_PERIODS_PER_YEAR["weekly"]).toBe(52);
    expect(PAY_PERIODS_PER_YEAR["bi-weekly"]).toBe(26);
    expect(PAY_PERIODS_PER_YEAR["semi-monthly"]).toBe(24);
    expect(PAY_PERIODS_PER_YEAR["monthly"]).toBe(12);
  });
  it("has 7 currency symbols", () => {
    expect(CURRENCY_SYMBOLS).toHaveLength(7);
    expect(CURRENCY_SYMBOLS).toContain("$");
    expect(CURRENCY_SYMBOLS).toContain("₹");
  });
  it("default rates match US reference", () => {
    expect(DEFAULT_RATES.socialSecurityRate).toBe(6.2);
    expect(DEFAULT_RATES.medicareRate).toBe(1.45);
    expect(DEFAULT_RATES.overtimeRate).toBe(1.5);
  });
  it("default input is hourly bi-weekly", () => {
    expect(DEFAULT_INPUT.employeeType).toBe("hourly");
    expect(DEFAULT_INPUT.payFrequency).toBe("bi-weekly");
    expect(DEFAULT_INPUT.hourlyRate).toBeGreaterThan(0);
    expect(DEFAULT_INPUT.hoursWorked).toBeGreaterThan(0);
  });
});

// ---- Normalizers ----

describe("payroll-calculator normalizeEmployeeName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeEmployeeName("  Alice   Wonderland  ")).toBe("Alice Wonderland");
  });
  it("handles empty", () => {
    expect(normalizeEmployeeName("")).toBe("");
  });
});

describe("payroll-calculator clampNonNegative", () => {
  it("passes positive", () => { expect(clampNonNegative(42)).toBe(42); });
  it("zeros negative", () => { expect(clampNonNegative(-5)).toBe(0); });
  it("zeros NaN", () => { expect(clampNonNegative(NaN)).toBe(0); });
  it("zeros Infinity", () => { expect(clampNonNegative(Infinity)).toBe(0); });
});

describe("payroll-calculator clampPercent", () => {
  it("passes 0-100", () => { expect(clampPercent(12.5)).toBe(12.5); });
  it("caps above 100", () => { expect(clampPercent(150)).toBe(100); });
  it("zeros negative", () => { expect(clampPercent(-1)).toBe(0); });
});

describe("payroll-calculator parsePeriodNumber", () => {
  it("clamps low to 1", () => {
    expect(parsePeriodNumber("0", 26)).toBe(1);
  });
  it("clamps high to max", () => {
    expect(parsePeriodNumber("999", 26)).toBe(26);
  });
  it("floors decimals", () => {
    expect(parsePeriodNumber("5.7", 26)).toBe(5);
  });
  it("handles non-numeric", () => {
    expect(parsePeriodNumber("abc", 26)).toBe(1);
  });
});

describe("payroll-calculator isValidPayPeriod", () => {
  it("validates YYYY-MM-DD", () => {
    expect(isValidPayPeriod("2024-12-31")).toBe(true);
  });
  it("rejects bad format", () => {
    expect(isValidPayPeriod("12/31/2024")).toBe(false);
  });
  it("rejects invalid date", () => {
    expect(isValidPayPeriod("2024-13-45")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidPayPeriod("")).toBe(false);
  });
});

// ---- Calculators ----

describe("payroll-calculator computeHourlyGross", () => {
  it("computes regular + overtime", () => {
    const r = computeHourlyGross(40, 25, 5, 1.5);
    expect(r.regularPay).toBe(1000);
    expect(r.overtimePay).toBe(187.5);
    expect(r.gross).toBe(1187.5);
  });
  it("zero overtime returns regular only", () => {
    const r = computeHourlyGross(40, 20, 0, 1.5);
    expect(r.overtimePay).toBe(0);
    expect(r.gross).toBe(800);
  });
  it("clamps negative inputs to 0", () => {
    const r = computeHourlyGross(-10, 25, -5, 1.5);
    expect(r.gross).toBe(0);
  });
  it("handles overtime rate of 0 as 1x (avoid zero multiplier)", () => {
    const r = computeHourlyGross(40, 10, 2, 0);
    expect(r.overtimePay).toBe(20); // 2 * 10 * 1
    expect(r.gross).toBe(420);
  });
});

describe("payroll-calculator computeSalariedGross", () => {
  it("divides annual by periods per year", () => {
    expect(computeSalariedGross(60000, "monthly")).toBeCloseTo(5000, 2);
    expect(computeSalariedGross(52000, "weekly")).toBeCloseTo(1000, 2);
    expect(computeSalariedGross(78000, "bi-weekly")).toBeCloseTo(3000, 2);
    expect(computeSalariedGross(72000, "semi-monthly")).toBeCloseTo(3000, 2);
  });
  it("clamps negative salary to 0", () => {
    expect(computeSalariedGross(-1000, "monthly")).toBe(0);
  });
});

describe("payroll-calculator tax/deduction calculators", () => {
  it("computeFederalTax applies percent", () => {
    expect(computeFederalTax(1000, 12)).toBe(120);
  });
  it("computeStateTax applies percent", () => {
    expect(computeStateTax(1000, 5)).toBe(50);
  });
  it("computeSocialSecurity applies 6.2%", () => {
    expect(computeSocialSecurity(1000, 6.2)).toBeCloseTo(62, 2);
  });
  it("computeMedicare applies 1.45%", () => {
    expect(computeMedicare(1000, 1.45)).toBeCloseTo(14.5, 2);
  });
  it("compute401k applies percent", () => {
    expect(compute401k(1000, 5)).toBe(50);
  });
  it("computeHealthInsurance clamps negative to 0", () => {
    expect(computeHealthInsurance(-50)).toBe(0);
    expect(computeHealthInsurance(100)).toBe(100);
  });
  it("clampPercent caps federal at 100", () => {
    expect(computeFederalTax(1000, 200)).toBe(1000);
  });
});

describe("payroll-calculator sumDeductions", () => {
  it("sums lines", () => {
    const lines = [
      { component: "A", amount: 10 },
      { component: "B", amount: 20.5 },
      { component: "C", amount: 5 },
    ];
    expect(sumDeductions(lines)).toBe(35.5);
  });
  it("empty list returns 0", () => {
    expect(sumDeductions([])).toBe(0);
  });
});

describe("payroll-calculator computeEffectiveTaxRate", () => {
  it("returns percent", () => {
    expect(computeEffectiveTaxRate(200, 1000)).toBe(20);
  });
  it("zero gross returns 0", () => {
    expect(computeEffectiveTaxRate(100, 0)).toBe(0);
  });
});

describe("payroll-calculator computeYTD", () => {
  it("multiplies per-period by period number", () => {
    expect(computeYTD(1000, 6, 26)).toBe(6000);
  });
  it("clamps period to max", () => {
    expect(computeYTD(1000, 99, 26)).toBe(26000);
  });
});

// ---- computePayroll ----

describe("payroll-calculator computePayroll hourly", () => {
  const input: PayrollInput = {
    ...DEFAULT_INPUT,
    employeeName: "  Jane  Doe ",
    employeeType: "hourly",
    payFrequency: "bi-weekly",
    hourlyRate: 20,
    hoursWorked: 80,
    overtimeHours: 5,
    overtimeRate: 1.5,
    federalTaxRate: 12,
    stateTaxRate: 5,
    socialSecurityRate: 6.2,
    medicareRate: 1.45,
    healthInsuranceDeduction: 50,
    retirementContribution: 5,
    payPeriod: "2024-06-15",
    periodNumber: 12,
  };

  it("normalizes employee name", () => {
    const r = computePayroll(input);
    expect(r.employeeName).toBe("Jane Doe");
  });

  it("computes gross = regular + overtime", () => {
    const r = computePayroll(input);
    // regular: 80 × 20 = 1600
    // overtime: 5 × 20 × 1.5 = 150
    expect(r.regularPay).toBe(1600);
    expect(r.overtimePay).toBe(150);
    expect(r.grossPay).toBe(1750);
  });

  it("computes all deduction lines", () => {
    const r = computePayroll(input);
    // Federal: 1750 × 12% = 210
    // State: 1750 × 5% = 87.5
    // SS: 1750 × 6.2% = 108.5
    // Medicare: 1750 × 1.45% = 25.375 → 25.38
    // 401k: 1750 × 5% = 87.5
    // Health: 50
    expect(r.deductions).toHaveLength(6);
    const byName = Object.fromEntries(r.deductions.map((d) => [d.component, d.amount]));
    expect(byName["Federal Tax"]).toBe(210);
    expect(byName["State Tax"]).toBe(87.5);
    expect(byName["Social Security"]).toBe(108.5);
    expect(byName["Medicare"]).toBeCloseTo(25.38, 1);
    expect(byName["401(k) Retirement"]).toBe(87.5);
    expect(byName["Health Insurance"]).toBe(50);
  });

  it("computes total deductions and net", () => {
    const r = computePayroll(input);
    expect(r.totalDeductions).toBeCloseTo(568.88, 0);
    expect(r.netPay).toBeCloseTo(1750 - r.totalDeductions, 2);
    expect(r.netPay).toBeGreaterThan(0);
  });

  it("computes YTD for period 12 of bi-weekly (26 periods)", () => {
    const r = computePayroll(input);
    expect(r.ytdGross).toBeCloseTo(1750 * 12, 2);
    expect(r.ytdNet).toBeCloseTo(r.netPay * 12, 2);
  });

  it("computes effective tax rate", () => {
    const r = computePayroll(input);
    expect(r.effectiveTaxRate).toBeGreaterThan(20);
    expect(r.effectiveTaxRate).toBeLessThan(40);
  });

  it("notes contain salaried/overtime hints", () => {
    const r = computePayroll(input);
    expect(r.notes.some((n) => n.includes("Overtime"))).toBe(true);
    expect(r.notes.some((n) => n.includes("401(k)"))).toBe(true);
  });
});

describe("payroll-calculator computePayroll salaried", () => {
  const input: PayrollInput = {
    ...DEFAULT_INPUT,
    employeeName: "John Smith",
    employeeType: "salaried",
    payFrequency: "monthly",
    annualSalary: 120000,
    hourlyRate: 0,
    hoursWorked: 0,
    federalTaxRate: 22,
    stateTaxRate: 5,
    socialSecurityRate: 6.2,
    medicareRate: 1.45,
    healthInsuranceDeduction: 100,
    retirementContribution: 10,
    payPeriod: "2024-06-30",
    periodNumber: 6,
  };

  it("computes gross = annual / 12", () => {
    const r = computePayroll(input);
    expect(r.grossPay).toBe(10000);
  });

  it("excludes overtime in salaried mode", () => {
    const r = computePayroll(input);
    expect(r.overtimePay).toBe(0);
    expect(r.regularPay).toBe(0);
  });

  it("computes federal tax 22%", () => {
    const r = computePayroll(input);
    const fed = r.deductions.find((d) => d.component === "Federal Tax");
    expect(fed?.amount).toBe(2200);
  });

  it("computes 401k 10%", () => {
    const r = computePayroll(input);
    const k = r.deductions.find((d) => d.component === "401(k) Retirement");
    expect(k?.amount).toBe(1000);
  });

  it("YTD period 6 of 12", () => {
    const r = computePayroll(input);
    expect(r.ytdGross).toBe(60000);
  });
});

describe("payroll-calculator computePayroll edge cases", () => {
  it("handles zero gross (no income)", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeType: "hourly",
      hourlyRate: 0,
      hoursWorked: 0,
      overtimeHours: 0,
      federalTaxRate: 12,
      stateTaxRate: 5,
      socialSecurityRate: 6.2,
      medicareRate: 1.45,
      healthInsuranceDeduction: 0,
      retirementContribution: 0,
    });
    expect(r.grossPay).toBe(0);
    expect(r.totalDeductions).toBe(0);
    expect(r.netPay).toBe(0);
    expect(r.effectiveTaxRate).toBe(0);
  });

  it("hides zero deduction lines", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeType: "hourly",
      hourlyRate: 25,
      hoursWorked: 40,
      overtimeHours: 0,
      federalTaxRate: 0,
      stateTaxRate: 0,
      socialSecurityRate: 0,
      medicareRate: 0,
      healthInsuranceDeduction: 0,
      retirementContribution: 0,
    });
    expect(r.deductions).toHaveLength(0);
    expect(r.totalDeductions).toBe(0);
  });

  it("defaults employee name when blank", () => {
    const r = computePayroll({ ...DEFAULT_INPUT, employeeName: "   " });
    expect(r.employeeName).toBe("Employee");
  });
});

// ---- summaryStats ----

describe("payroll-calculator summaryStats", () => {
  it("returns summary object", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeType: "hourly",
      hourlyRate: 20,
      hoursWorked: 40,
      overtimeHours: 2,
      overtimeRate: 1.5,
    });
    const s = summaryStats(r);
    expect(s.gross).toBe(r.grossPay);
    expect(s.net).toBe(r.netPay);
    expect(s.hasOvertime).toBe(true);
    expect(s.deductionCount).toBeGreaterThan(0);
  });

  it("flags no overtime", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeType: "hourly",
      hourlyRate: 20,
      hoursWorked: 40,
      overtimeHours: 0,
    });
    const s = summaryStats(r);
    expect(s.hasOvertime).toBe(false);
  });
});

// ---- Formatting ----

describe("payroll-calculator formatCurrency", () => {
  it("formats positive amount with symbol", () => {
    expect(formatCurrency(1234.5, "$")).toBe("$1,234.50");
  });
  it("handles negative", () => {
    const s = formatCurrency(-50, "$");
    expect(s.startsWith("-$")).toBe(true);
  });
  it("supports other symbols", () => {
    expect(formatCurrency(100, "€")).toBe("€100.00");
    expect(formatCurrency(100, "₹")).toBe("₹100.00");
  });
});

describe("payroll-calculator formatPercent", () => {
  it("formats with 2 decimals", () => {
    expect(formatPercent(12.3456)).toBe("12.35%");
  });
});

// ---- Rendering ----

describe("payroll-calculator renderText", () => {
  it("renders pay stub header and sections", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeName: "Test User",
      employeeType: "hourly",
      hourlyRate: 20,
      hoursWorked: 40,
      overtimeHours: 0,
      federalTaxRate: 10,
    });
    const text = renderText(r);
    expect(text).toContain("PAY STUB");
    expect(text).toContain("Employee:    Test User");
    expect(text).toContain("EARNINGS");
    expect(text).toContain("GROSS PAY");
    expect(text).toContain("DEDUCTIONS");
    expect(text).toContain("NET PAY");
    expect(text).toContain("YEAR-TO-DATE");
  });
  it("renders (none) for empty deductions", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeType: "hourly",
      hourlyRate: 20,
      hoursWorked: 40,
      overtimeHours: 0,
      federalTaxRate: 0,
      stateTaxRate: 0,
      socialSecurityRate: 0,
      medicareRate: 0,
      healthInsuranceDeduction: 0,
      retirementContribution: 0,
    });
    expect(renderText(r)).toContain("(none)");
  });
});

describe("payroll-calculator renderHtml", () => {
  it("renders valid HTML document", () => {
    const r = computePayroll({ ...DEFAULT_INPUT, employeeName: "Jane" });
    const html = renderHtml(r);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Pay Stub");
    expect(html).toContain("Jane");
    expect(html).toContain("</html>");
  });
  it("escapes HTML in employee name", () => {
    const r = computePayroll({ ...DEFAULT_INPUT, employeeName: "<script>x</script>" });
    const html = renderHtml(r);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("payroll-calculator renderCsv", () => {
  it("renders header row", () => {
    const r = computePayroll({ ...DEFAULT_INPUT });
    const csv = renderCsv(r);
    expect(csv.split("\n")[0]).toBe("component,amount");
  });
  it("renders gross, deductions, net rows", () => {
    const r = computePayroll({
      ...DEFAULT_INPUT,
      employeeType: "hourly",
      hourlyRate: 20,
      hoursWorked: 40,
      federalTaxRate: 10,
    });
    const csv = renderCsv(r);
    expect(csv).toContain("Gross Pay");
    expect(csv).toContain("Federal Tax");
    expect(csv).toContain("Net Pay");
    expect(csv).toContain("YTD Gross");
  });
});

// ---- History ----

describe("payroll-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      employeeName: "Alice",
      payFrequency: "bi-weekly",
      employeeType: "hourly",
      grossPay: 1000,
      totalDeductions: 200,
      netPay: 800,
      currencySymbol: "$",
      payPeriod: "2024-01-01",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].employeeName).toBe("Alice");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        employeeName: `Emp${i}`,
        payFrequency: "weekly",
        employeeType: "hourly",
        grossPay: 100,
        totalDeductions: 10,
        netPay: 90,
        currencySymbol: "$",
        payPeriod: "2024-01-01",
      });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].employeeName).toBe("Emp24");
  });
  it("clears", () => {
    saveHistory({
      ts: 1, employeeName: "x", payFrequency: "weekly", employeeType: "hourly",
      grossPay: 1, totalDeductions: 0, netPay: 1, currencySymbol: "$", payPeriod: "2024-01-01",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("payroll-calculator shareable URL", () => {
  it("builds share URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input: PayrollInput = {
      ...DEFAULT_INPUT,
      employeeName: "Bob",
      employeeType: "hourly",
      payFrequency: "weekly",
      hourlyRate: 30,
      hoursWorked: 40,
      overtimeHours: 5,
      federalTaxRate: 15,
    };
    const url = buildShareUrl(input, "€");
    expect(url).toContain("employeeName=Bob");
    expect(url).toContain("payFrequency=weekly");
    expect(url).toContain("employeeType=hourly");
    expect(url).toContain("hourlyRate=30");
    expect(url).toContain("currency=%E2%82%AC"); // € encoded
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back into input", () => {
    const input: PayrollInput = {
      ...DEFAULT_INPUT,
      employeeName: "Carol",
      employeeType: "salaried",
      payFrequency: "monthly",
      annualSalary: 95000,
      federalTaxRate: 22,
    };
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const { input: parsed } = parseShareUrl(hash);
    expect(parsed.employeeName).toBe("Carol");
    expect(parsed.employeeType).toBe("salaried");
    expect(parsed.payFrequency).toBe("monthly");
    expect(parsed.annualSalary).toBe(95000);
    expect(parsed.federalTaxRate).toBe(22);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: {} });
  });

  it("filters unknown enum values", () => {
    const { input: parsed } = parseShareUrl("payFrequency=unknown&employeeType=alien");
    expect(parsed.payFrequency).toBeUndefined();
    expect(parsed.employeeType).toBeUndefined();
  });

  it("parses currency", () => {
    const { currency } = parseShareUrl("currency=%C2%A3"); // £
    expect(currency).toBe("£");
  });

  it("ignores invalid currency", () => {
    const { currency } = parseShareUrl("currency=ZZZ");
    expect(currency).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = PayFrequency | EmployeeType;
