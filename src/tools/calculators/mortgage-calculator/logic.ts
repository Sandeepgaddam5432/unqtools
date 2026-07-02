/**
 * Mortgage Calculator — pure logic.
 *
 * Computes:
 *  - Monthly P&I (principal + interest) via standard amortization formula
 *  - Full PITI breakdown: P&I + property tax + home insurance + PMI + HOA
 *  - PMI drop-off when LTV reaches 78% (auto-cancel) or 80% (request)
 *  - Extra-payment payoff: months saved + interest saved
 *  - Full amortization schedule (monthly or yearly CSV)
 *
 * Edge cases:
 *  - 0% down → PMI required for the life of the loan (until 78% LTV)
 *  - 20%+ down → no PMI
 *  - Final-month rounding so balance clears to 0 exactly
 */

export interface MortgageInput {
  homePrice: number;
  downPaymentPct: number; // 0-100
  annualInterestRatePct: number;
  termYears: number; // 15, 30, etc.
  /** Annual property tax (dollars, not %). */
  propertyTaxAnnual?: number;
  /** Annual home insurance (dollars). */
  homeInsuranceAnnual?: number;
  /** Annual HOA dues (dollars). */
  hoaAnnual?: number;
  /** PMI annual rate as % of loan (e.g. 0.5 for 0.5%). */
  pmiRatePct?: number;
  /** Extra principal per month. */
  extraMonthly?: number;
  /** One-time extra principal at month N. */
  oneTimeExtra?: { month: number; amount: number };
}

export interface MonthlyBreakdown {
  principalAndInterest: number;
  propertyTax: number;
  homeInsurance: number;
  pmi: number;
  hoa: number;
  total: number;
}

export interface MortgageAmortRow {
  month: number;
  interest: number;
  principal: number;
  extra: number;
  pmi: number;
  balance: number;
  ltv: number;
  cumulativeInterest: number;
}

export interface MortgageResult {
  loanAmount: number;
  downPayment: number;
  monthlyPI: number;
  monthlyBreakdown: MonthlyBreakdown;
  totalInterest: number;
  totalPayment: number;
  totalPmiPaid: number;
  pmiDropMonth: number | null;
  schedule: MortgageAmortRow[];
  actualMonths: number;
  monthsSaved: number;
  interestSaved: number;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeMonthlyPI(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function calculateMortgage(input: MortgageInput): MortgageResult | { error: string } {
  const {
    homePrice,
    downPaymentPct,
    annualInterestRatePct,
    termYears,
    propertyTaxAnnual = 0,
    homeInsuranceAnnual = 0,
    hoaAnnual = 0,
    pmiRatePct = 0.5,
    extraMonthly = 0,
    oneTimeExtra,
  } = input;

  if (homePrice <= 0) return { error: "Home price must be greater than 0." };
  if (downPaymentPct < 0 || downPaymentPct > 100)
    return { error: "Down payment must be between 0 and 100%." };
  if (termYears <= 0 || termYears > 50) return { error: "Term must be between 1 and 50 years." };

  const downPayment = homePrice * (downPaymentPct / 100);
  const loanAmount = homePrice - downPayment;
  if (loanAmount <= 0) return { error: "Down payment cannot equal or exceed home price." };

  const monthlyRate = annualInterestRatePct / 100 / 12;
  const totalMonths = termYears * 12;
  const monthlyPI = computeMonthlyPI(loanAmount, monthlyRate, totalMonths);
  if (monthlyPI === 0) return { error: "Could not compute monthly payment from these inputs." };

  // PMI required if down payment < 20%
  const pmiRequired = downPaymentPct < 20;
  const monthlyPmiRate = pmiRequired ? pmiRatePct / 100 / 12 : 0;

  const monthlyTax = propertyTaxAnnual / 12;
  const monthlyInsurance = homeInsuranceAnnual / 12;
  const monthlyHoa = hoaAnnual / 12;

  // Baseline (no extra) — to compute months saved + interest saved
  function runSchedule(withExtra: boolean): {
    schedule: MortgageAmortRow[];
    totalInterest: number;
    totalPmi: number;
    actualMonths: number;
    pmiDropMonth: number | null;
  } {
    let balance = loanAmount;
    let totalInterest = 0;
    let totalPmi = 0;
    let pmiDropMonth: number | null = null;
    const schedule: MortgageAmortRow[] = [];
    let cumulativeInterest = 0;

    for (let m = 1; m <= totalMonths; m++) {
      const interest = balance * monthlyRate;
      let principalPart = monthlyPI - interest;
      let extra = 0;

      if (withExtra) {
        if (extraMonthly > 0) {
          const e = Math.min(extraMonthly, balance - principalPart);
          if (e > 0) {
            extra += e;
            principalPart += e;
          }
        }
        if (oneTimeExtra && oneTimeExtra.month === m && oneTimeExtra.amount > 0) {
          const e = Math.min(oneTimeExtra.amount, balance - principalPart);
          if (e > 0) {
            extra += e;
            principalPart += e;
          }
        }
      }

      if (principalPart > balance) principalPart = balance;
      balance -= principalPart;

      // PMI: charge while LTV > 78% (auto-cancel threshold)
      const ltv = (balance / homePrice) * 100;
      let pmiThisMonth = 0;
      if (pmiRequired && ltv > 78) {
        pmiThisMonth = balance * monthlyPmiRate;
        totalPmi += pmiThisMonth;
      } else if (pmiRequired && pmiDropMonth === null) {
        pmiDropMonth = m;
      }

      totalInterest += interest;
      cumulativeInterest = totalInterest;
      schedule.push({
        month: m,
        interest: r2(interest),
        principal: r2(principalPart),
        extra: r2(extra),
        pmi: r2(pmiThisMonth),
        balance: r2(Math.max(0, balance)),
        ltv: r2(ltv),
        cumulativeInterest: r2(cumulativeInterest),
      });

      if (balance <= 0.005) break;
    }

    return {
      schedule,
      totalInterest: r2(totalInterest),
      totalPmi: r2(totalPmi),
      actualMonths: schedule.length,
      pmiDropMonth,
    };
  }

  const baseline = runSchedule(false);
  const withExtraResult = runSchedule(true);
  const schedule = withExtraResult.schedule;

  const monthlyBreakdown: MonthlyBreakdown = {
    principalAndInterest: r2(
      monthlyPI +
        monthlyTax +
        monthlyInsurance +
        monthlyHoa +
        (pmiRequired ? loanAmount * monthlyPmiRate : 0),
    ),
    propertyTax: r2(monthlyTax),
    homeInsurance: r2(monthlyInsurance),
    pmi: r2(pmiRequired ? loanAmount * monthlyPmiRate : 0),
    hoa: r2(monthlyHoa),
    total: r2(
      monthlyPI +
        monthlyTax +
        monthlyInsurance +
        monthlyHoa +
        (pmiRequired ? loanAmount * monthlyPmiRate : 0),
    ),
  };
  // Override P&I to be just principal+interest (cleaner for users)
  monthlyBreakdown.principalAndInterest = r2(monthlyPI);
  monthlyBreakdown.total = r2(
    monthlyPI +
      monthlyTax +
      monthlyInsurance +
      monthlyHoa +
      (pmiRequired ? loanAmount * monthlyPmiRate : 0),
  );

  return {
    loanAmount: r2(loanAmount),
    downPayment: r2(downPayment),
    monthlyPI: r2(monthlyPI),
    monthlyBreakdown,
    totalInterest: withExtraResult.totalInterest,
    totalPayment: r2(withExtraResult.totalInterest + loanAmount),
    totalPmiPaid: withExtraResult.totalPmi,
    pmiDropMonth: withExtraResult.pmiDropMonth,
    schedule,
    actualMonths: withExtraResult.actualMonths,
    monthsSaved: Math.max(0, baseline.actualMonths - withExtraResult.actualMonths),
    interestSaved: r2(Math.max(0, baseline.totalInterest - withExtraResult.totalInterest)),
  };
}

export function formatCurrency(amount: number, locale = "en-US", currency = "USD"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function mortgageScheduleToCsv(
  schedule: MortgageAmortRow[],
  grouping: "monthly" | "yearly" = "monthly",
): string {
  if (grouping === "monthly") {
    const header = "Month,Interest,Principal,Extra,PMI,Balance,LTV,Cumulative Interest";
    const rows = schedule.map(
      (r) =>
        `${r.month},${r.interest},${r.principal},${r.extra},${r.pmi},${r.balance},${r.ltv},${r.cumulativeInterest}`,
    );
    return [header, ...rows].join("\n");
  }
  const header =
    "Year,Total Interest,Total Principal,Total Extra,Total PMI,Ending Balance,Ending LTV";
  const rows: string[] = [];
  for (let i = 0; i < schedule.length; i += 12) {
    const slice = schedule.slice(i, i + 12);
    if (slice.length === 0) break;
    const year = Math.floor(i / 12) + 1;
    const totalInterest = slice.reduce((s, r) => s + r.interest, 0);
    const totalPrincipal = slice.reduce((s, r) => s + r.principal, 0);
    const totalExtra = slice.reduce((s, r) => s + r.extra, 0);
    const totalPmi = slice.reduce((s, r) => s + r.pmi, 0);
    const endingBalance = slice[slice.length - 1]!.balance;
    const endingLtv = slice[slice.length - 1]!.ltv;
    rows.push(
      `${year},${r2(totalInterest)},${r2(totalPrincipal)},${r2(totalExtra)},${r2(totalPmi)},${endingBalance},${endingLtv}`,
    );
  }
  return [header, ...rows].join("\n");
}
