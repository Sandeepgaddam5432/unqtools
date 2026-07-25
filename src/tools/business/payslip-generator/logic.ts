/**
 * Payslip Generator — gross/net pay, tax, deductions, allowances.
 */
export interface PayslipInput {
  grossSalary: number;
  taxRate: number;        // percent (0-100)
  deductions: { name: string; amount: number }[];
  allowances: { name: string; amount: number }[];
}

export interface PayslipResult {
  gross: number;
  taxAmount: number;
  totalDeductions: number;
  totalAllowances: number;
  net: number;
}

export function computePayslip(input: PayslipInput): PayslipResult | { error: string } {
  if (input.grossSalary < 0) return { error: "Gross salary cannot be negative" };
  if (input.taxRate < 0 || input.taxRate > 100) return { error: "Tax rate must be 0-100" };
  if (input.deductions.some((d) => d.amount < 0)) return { error: "Deductions cannot be negative" };
  if (input.allowances.some((a) => a.amount < 0)) return { error: "Allowances cannot be negative" };
  const taxAmount = input.grossSalary * (input.taxRate / 100);
  const totalDeductions = input.deductions.reduce((s, d) => s + d.amount, 0);
  const totalAllowances = input.allowances.reduce((s, a) => s + a.amount, 0);
  const net = input.grossSalary - taxAmount - totalDeductions + totalAllowances;
  return { gross: input.grossSalary, taxAmount, totalDeductions, totalAllowances, net };
}

/** Format currency. */
export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Render payslip as a plain-text report. */
export function renderPayslip(input: PayslipInput, result: PayslipResult): string {
  const L: string[] = [];
  L.push("PAYSLIP", "=".repeat(40), "");
  L.push(`Gross salary:       ${formatMoney(result.gross)}`);
  L.push(`Tax (${input.taxRate}%):       ${formatMoney(result.taxAmount)}`);
  L.push("");
  L.push("Deductions:");
  for (const d of input.deductions) L.push(`  ${d.name}: ${formatMoney(d.amount)}`);
  L.push(`  Total: ${formatMoney(result.totalDeductions)}`);
  L.push("");
  L.push("Allowances:");
  for (const a of input.allowances) L.push(`  ${a.name}: ${formatMoney(a.amount)}`);
  L.push(`  Total: ${formatMoney(result.totalAllowances)}`);
  L.push("");
  L.push("-".repeat(40));
  L.push(`Net pay:             ${formatMoney(result.net)}`);
  return L.join("\n");
}
