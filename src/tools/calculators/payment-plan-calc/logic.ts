/**
 * Payment Plan Calculator — pure logic. No DOM access.
 *
 * Monthly payment (zero interest): total / months
 * Monthly payment (with interest): P · r · (1+r)^n / ((1+r)^n − 1)
 *  P = principal, r = monthly rate, n = total months
 */

export interface PaymentPlanInput {
  totalAmount: number;
  months: number;
  /** Annual interest rate in percent (e.g. 12 for 12%). 0 = no interest. */
  annualRatePct: number;
}

export interface PaymentRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface PaymentPlanResult {
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  schedule: PaymentRow[];
  months: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute monthly payment for a payment plan. */
export function computeMonthlyPayment(totalAmount: number, monthlyRate: number, months: number): number {
  if (totalAmount <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return totalAmount / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (totalAmount * monthlyRate * factor) / (factor - 1);
}

/** Generate a full payment plan schedule. */
export function calculatePaymentPlan(input: PaymentPlanInput): PaymentPlanResult | { error: string } {
  const { totalAmount, months, annualRatePct } = input;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return { error: "Total amount must be greater than 0." };
  if (!Number.isFinite(months) || months <= 0 || !Number.isInteger(months)) return { error: "Months must be a positive integer." };
  if (months > 600) return { error: "Months cannot exceed 600." };
  if (totalAmount > 1e15) return { error: "Total amount is unrealistically large." };

  const monthlyRate = annualRatePct / 100 / 12;
  const payment = computeMonthlyPayment(totalAmount, monthlyRate, months);
  if (payment === 0) return { error: "Could not compute monthly payment." };

  const schedule: PaymentRow[] = [];
  let balance = totalAmount;
  let totalInterest = 0;
  for (let month = 1; month <= months; month++) {
    const interest = balance * monthlyRate;
    let principalPart = payment - interest;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    totalInterest += interest;
    schedule.push({
      month,
      payment: r2(payment),
      interest: r2(interest),
      principal: r2(principalPart),
      balance: r2(Math.max(0, balance)),
    });
    if (balance <= 0.005 && month < months) break;
  }

  const totalPaid = totalAmount + totalInterest;
  return {
    monthlyPayment: r2(payment),
    totalInterest: r2(totalInterest),
    totalPaid: r2(totalPaid),
    schedule,
    months,
  };
}

/** Format a number as currency. */
export function formatCurrency(amount: number, locale = "en-US", currency = "USD"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Convert schedule rows to CSV. */
export function scheduleToCsv(schedule: PaymentRow[]): string {
  const header = "Month,Payment,Interest,Principal,Balance";
  const rows = schedule.map((r) => `${r.month},${r.payment},${r.interest},${r.principal},${r.balance}`);
  return [header, ...rows].join("\n");
}
