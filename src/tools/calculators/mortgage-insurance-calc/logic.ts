/**
 * Mortgage Insurance Calculator — pure logic.
 * Computes PMI (conventional), MIP (FHA), and VA funding fee.
 * Based on standard 2024 US industry formulas.
 */

export type LoanType = "conventional" | "fha" | "va";
export type Term = 15 | 20 | 30;

export interface MortgageInsuranceInput {
  homePrice: number;
  downPayment: number; // dollars
  loanType: LoanType;
  term: Term;
  creditScore: number; // 300-850
  /** For FHA: upfront MIP percentage. For VA: service category. */
  upfrontMipPct?: number;
  /** VA: first-time use vs subsequent. */
  vaFirstUse?: boolean;
  /** VA: disabled veteran exemption. */
  vaDisabled?: boolean;
  /** Annual interest rate (for monthly payment calc). */
  interestRate?: number;
}

export interface MortgageInsuranceResult {
  loanAmount: number;
  ltv: number;
  monthlyMI: number;
  annualMI: number;
  upfrontMI: number;
  totalUpfrontPlusFiveYear: number;
  schedule: { year: number; monthlyMI: number; annualMI: number; cumulativeMI: number }[];
  notes: string[];
  cancellable: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** LTV ratio (loan-to-value) as a percentage. */
export function calcLtv(homePrice: number, downPayment: number): number {
  if (homePrice <= 0) return 0;
  const loan = homePrice - downPayment;
  return (loan / homePrice) * 100;
}

/** Standard monthly mortgage payment (principal + interest). */
export function monthlyPayment(principal: number, annualRatePct: number, termYears: number): number {
  if (principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Conventional PMI annual rate based on LTV + credit score.
 * Returns annual percentage of loan amount (e.g., 0.55 = 0.55%).
 */
export function conventionalPmiRate(ltv: number, creditScore: number): number {
  // Approximate rate card from MGIC/Radian public tables (simplified).
  let base = 0.55;
  if (ltv > 95) base = 1.05;
  else if (ltv > 90) base = 0.78;
  else if (ltv > 85) base = 0.62;
  else if (ltv > 80) base = 0.55;
  else if (ltv > 75) base = 0.41;
  else base = 0.19;
  // Credit score adjustment
  if (creditScore >= 760) base *= 0.6;
  else if (creditScore >= 720) base *= 0.75;
  else if (creditScore >= 680) base *= 0.9;
  else if (creditScore >= 640) base *= 1.1;
  else if (creditScore < 620) base *= 1.4;
  return round(base);
}

/**
 * FHA MIP annual rate based on term + LTV.
 * Standard rates: 30yr >95% LTV = 0.55%, ≤95% = 0.50; 15yr = 0.15.
 */
export function fhaAnnualMipRate(term: Term, ltv: number): number {
  if (term === 15) return ltv > 90 ? 0.4 : 0.15;
  return ltv > 95 ? 0.55 : 0.5;
}

/** FHA upfront MIP (default 1.75% of loan). */
export function fhaUpfrontMip(loan: number, pct = 1.75): number {
  return round((loan * pct) / 100);
}

/**
 * VA funding fee based on down payment and first-time vs subsequent use.
 * Disabled veterans are exempt.
 */
export function vaFundingFee(loan: number, downPct: number, firstUse: boolean, disabled: boolean): number {
  if (disabled) return 0;
  let rate: number;
  if (downPct >= 10) rate = firstUse ? 1.25 : 1.5;
  else if (downPct >= 5) rate = firstUse ? 1.5 : 1.75;
  else rate = firstUse ? 2.3 : 3.3;
  return round((loan * rate) / 100);
}

/** Full PMI/MIP/VA computation. */
export function computeMortgageInsurance(input: MortgageInsuranceInput): MortgageInsuranceResult {
  const loanAmount = Math.max(0, input.homePrice - input.downPayment);
  const ltv = calcLtv(input.homePrice, input.downPayment);
  const notes: string[] = [];
  let monthlyMI = 0;
  let annualMI = 0;
  let upfrontMI = 0;
  let cancellable = false;

  if (input.loanType === "conventional") {
    if (ltv < 80) {
      notes.push("No PMI required — LTV is below 80%.");
      cancellable = false;
    } else {
      const rate = conventionalPmiRate(ltv, input.creditScore);
      annualMI = round((loanAmount * rate) / 100);
      monthlyMI = round(annualMI / 12);
      cancellable = true;
      notes.push(`Conventional PMI @ ${rate}%/yr of loan. Cancellable at 80% LTV.`);
    }
  } else if (input.loanType === "fha") {
    const rate = fhaAnnualMipRate(input.term, ltv);
    annualMI = round((loanAmount * rate) / 100);
    monthlyMI = round(annualMI / 12);
    upfrontMI = fhaUpfrontMip(loanAmount, input.upfrontMipPct);
    cancellable = false;
    notes.push(`FHA MIP @ ${rate}%/yr. Upfront MIP ${input.upfrontMipPct ?? 1.75}%. MIP is for the life of the loan (≥11yr).`);
  } else {
    // VA
    const downPct = input.homePrice > 0 ? (input.downPayment / input.homePrice) * 100 : 0;
    upfrontMI = vaFundingFee(loanAmount, downPct, input.vaFirstUse ?? true, input.vaDisabled ?? false);
    cancellable = false;
    notes.push(input.vaDisabled ? "VA funding fee waived (disabled veteran)." : `VA funding fee applied upfront. No monthly MI.`);
  }

  // Build 5-year schedule (conventional PMI typically cancels at 78% LTV or via payments).
  const schedule: MortgageInsuranceResult["schedule"] = [];
  let cum = upfrontMI;
  for (let y = 1; y <= 5; y++) {
    const yearAnnual = input.loanType === "va" ? 0 : annualMI;
    cum += yearAnnual;
    schedule.push({ year: y, monthlyMI, annualMI: yearAnnual, cumulativeMI: round(cum) });
  }

  const totalUpfrontPlusFiveYear = round(upfrontMI + (input.loanType === "va" ? 0 : annualMI * 5));

  return {
    loanAmount: round(loanAmount),
    ltv: round(ltv),
    monthlyMI,
    annualMI,
    upfrontMI,
    totalUpfrontPlusFiveYear,
    schedule,
    notes,
    cancellable,
  };
}

/** Estimate when PMI can be cancelled (years to reach 78% LTV). */
export function pmiCancellationYear(
  homePrice: number,
  downPayment: number,
  annualRatePct: number,
  termYears: number,
  homeAppreciationPct = 3,
): number {
  const loan = homePrice - downPayment;
  const targetLtv = 0.78;
  const payment = monthlyPayment(loan, annualRatePct, termYears);
  let balance = loan;
  let homeValue = homePrice;
  for (let y = 1; y <= termYears; y++) {
    for (let m = 0; m < 12; m++) {
      const r = annualRatePct / 100 / 12;
      const interest = balance * r;
      balance -= payment - interest;
    }
    homeValue *= 1 + homeAppreciationPct / 100;
    if (balance / homeValue <= targetLtv) return y;
  }
  return termYears;
}

/** Validate inputs. */
export function validateInputs(input: Partial<MortgageInsuranceInput>): string[] {
  const errs: string[] = [];
  if ((input.homePrice ?? 0) <= 0) errs.push("Home price must be > 0");
  if ((input.downPayment ?? 0) < 0) errs.push("Down payment cannot be negative");
  if ((input.downPayment ?? 0) >= (input.homePrice ?? 0)) errs.push("Down payment must be less than home price");
  if (input.creditScore !== undefined && (input.creditScore < 300 || input.creditScore > 850)) {
    errs.push("Credit score must be 300-850");
  }
  return errs;
}

/** Format currency USD. */
export function fmtUSD(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Refinance breakeven: months to recover closing costs. */
export function refinanceBreakeven(closingCosts: number, monthlySavings: number): number {
  if (monthlySavings <= 0) return Infinity;
  return Math.ceil(closingCosts / monthlySavings);
}

/** LTV-categorized risk label. */
export function ltvRiskLabel(ltv: number): { label: string; color: string } {
  if (ltv < 80) return { label: "Low", color: "emerald" };
  if (ltv < 95) return { label: "Moderate", color: "amber" };
  if (ltv <= 100) return { label: "High", color: "orange" };
  return { label: "Underwater", color: "red" };
}

/** Comparison: total MI cost across all three loan types. */
export function compareLoanTypes(input: Omit<MortgageInsuranceInput, "loanType">): {
  type: LoanType;
  monthly: number;
  upfront: number;
  fiveYear: number;
}[] {
  return (["conventional", "fha", "va"] as LoanType[]).map((type) => {
    const r = computeMortgageInsurance({ ...input, loanType: type });
    return {
      type,
      monthly: r.monthlyMI,
      upfront: r.upfrontMI,
      fiveYear: r.totalUpfrontPlusFiveYear,
    };
  });
}
