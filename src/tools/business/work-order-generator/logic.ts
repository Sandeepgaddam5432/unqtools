/**
 * Work Order Generator — line items, labor, materials, totals.
 *
 * Features:
 *  - Line items with quantity × unit price (labor and materials)
 *  - Discount (percent or fixed)
 *  - Tax (percent, validated 0-100)
 *  - Subtotal / tax / total computation
 *  - Plain-text and CSV export
 *  - Batch mode (multiple work orders) with aggregation stats
 *  - Validation with helpful error messages
 */

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type DiscountType = "percent" | "fixed";

export interface Discount {
  type: DiscountType;
  /** Percent (0-100) or fixed amount, depending on `type`. */
  value: number;
}

export interface WorkOrderInput {
  workOrderNumber: string;
  customer: string;
  labor: LineItem[];
  materials: LineItem[];
  /** Tax percent, 0-100. */
  taxRate: number;
  /** Optional discount applied to subtotal. */
  discount?: Discount;
  /** Optional notes appended to the rendered work order. */
  notes?: string;
}

export interface WorkOrderResult {
  laborSubtotal: number;
  materialsSubtotal: number;
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  tax: number;
  total: number;
  laborCount: number;
  materialsCount: number;
  warnings: string[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(item: LineItem): number {
  return item.quantity * item.unitPrice;
}

export function sumItems(items: LineItem[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}

/** Compute the discount amount given a subtotal and a discount spec. */
export function computeDiscount(subtotal: number, discount?: Discount): { amount: number; warnings: string[] } | { error: string } {
  const warnings: string[] = [];
  if (!discount) return { amount: 0, warnings };
  if (discount.value < 0) return { error: "Discount value cannot be negative" };
  if (discount.type === "percent") {
    if (discount.value > 100) return { error: "Percent discount cannot exceed 100" };
    return { amount: round2(subtotal * (discount.value / 100)), warnings };
  }
  if (discount.value > subtotal) {
    warnings.push("Fixed discount exceeds subtotal — clamping to subtotal.");
    return { amount: round2(subtotal), warnings };
  }
  return { amount: round2(discount.value), warnings };
}

/** Validate a single line item. */
export function validateItem(item: LineItem): { ok: true } | { error: string } {
  if (item.quantity < 0) return { error: "Quantity cannot be negative" };
  if (item.unitPrice < 0) return { error: "Unit price cannot be negative" };
  if (!item.description.trim()) return { error: "Description is required" };
  return { ok: true };
}

export function computeWorkOrder(input: WorkOrderInput): WorkOrderResult | { error: string } {
  if (!input.workOrderNumber.trim()) return { error: "Work order number is required" };
  if (!input.customer.trim()) return { error: "Customer name is required" };
  if (input.taxRate < 0 || input.taxRate > 100) return { error: "Tax rate must be 0-100" };

  for (const item of [...input.labor, ...input.materials]) {
    if (item.quantity < 0 || item.unitPrice < 0) return { error: "Line items cannot be negative" };
  }

  const laborSubtotal = round2(sumItems(input.labor));
  const materialsSubtotal = round2(sumItems(input.materials));
  const subtotal = round2(laborSubtotal + materialsSubtotal);

  const d = computeDiscount(subtotal, input.discount);
  if ("error" in d) return { error: d.error };

  const discountAmount = d.amount;
  const taxableBase = round2(Math.max(0, subtotal - discountAmount));
  const tax = round2(taxableBase * (input.taxRate / 100));
  const total = round2(taxableBase + tax);

  return {
    laborSubtotal,
    materialsSubtotal,
    subtotal,
    discountAmount,
    taxableBase,
    tax,
    total,
    laborCount: input.labor.length,
    materialsCount: input.materials.length,
    warnings: d.warnings,
  };
}

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Render a single work order as plain text. */
export function renderWorkOrder(input: WorkOrderInput, r: WorkOrderResult): string {
  const L: string[] = [];
  L.push(`WORK ORDER #${input.workOrderNumber}`, `Customer: ${input.customer}`, "=".repeat(50), "");
  L.push("LABOR:");
  if (input.labor.length === 0) L.push("  (none)");
  for (const i of input.labor) L.push(`  ${i.description} × ${i.quantity} @ ${formatMoney(i.unitPrice)} = ${formatMoney(lineTotal(i))}`);
  L.push(`  Subtotal: ${formatMoney(r.laborSubtotal)}`, "");
  L.push("MATERIALS:");
  if (input.materials.length === 0) L.push("  (none)");
  for (const i of input.materials) L.push(`  ${i.description} × ${i.quantity} @ ${formatMoney(i.unitPrice)} = ${formatMoney(lineTotal(i))}`);
  L.push(`  Subtotal: ${formatMoney(r.materialsSubtotal)}`, "");
  L.push("-".repeat(50));
  L.push(`Subtotal: ${formatMoney(r.subtotal)}`);
  if (r.discountAmount > 0) {
    const d = input.discount!;
    L.push(`Discount (${d.type === "percent" ? `${d.value}%` : formatMoney(d.value)}): -${formatMoney(r.discountAmount)}`);
  }
  L.push(`Taxable base: ${formatMoney(r.taxableBase)}`);
  L.push(`Tax (${input.taxRate}%): ${formatMoney(r.tax)}`);
  L.push(`TOTAL: ${formatMoney(r.total)}`);
  if (input.notes && input.notes.trim()) {
    L.push("", "Notes:", input.notes.trim());
  }
  if (r.warnings.length > 0) {
    L.push("", "Warnings:", ...r.warnings.map((w) => `  - ${w}`));
  }
  return L.join("\n");
}

/** Render the line items of a work order as CSV (suitable for spreadsheet import). */
export function toCsv(input: WorkOrderInput, r: WorkOrderResult): string {
  const lines = ["Kind,Description,Quantity,UnitPrice,LineTotal"];
  for (const i of input.labor) {
    lines.push(`Labor,"${i.description.replace(/"/g, '""')}",${i.quantity},${i.unitPrice},${lineTotal(i)}`);
  }
  for (const i of input.materials) {
    lines.push(`Material,"${i.description.replace(/"/g, '""')}",${i.quantity},${i.unitPrice},${lineTotal(i)}`);
  }
  lines.push(`,Subtotal,,,"${r.subtotal}"`);
  if (r.discountAmount > 0) lines.push(`,Discount,,,"-${r.discountAmount}"`);
  lines.push(`,Tax (${input.taxRate}%),,,"${r.tax}"`);
  lines.push(`,TOTAL,,,"${r.total}"`);
  return lines.join("\n");
}

export interface BatchResult {
  input: WorkOrderInput;
  result: WorkOrderResult | { error: string };
}

/** Compute multiple work orders, returning each result alongside its input. */
export function computeBatch(inputs: WorkOrderInput[]): BatchResult[] {
  return inputs.map((input) => ({ input, result: computeWorkOrder(input) }));
}

/** Aggregate statistics across a batch of valid work orders. */
export function batchStats(results: BatchResult[]): {
  total: number;
  valid: number;
  errors: number;
  grandTotal: number;
  totalLabor: number;
  totalMaterials: number;
  totalTax: number;
} {
  let valid = 0;
  let errors = 0;
  let grandTotal = 0;
  let totalLabor = 0;
  let totalMaterials = 0;
  let totalTax = 0;
  for (const r of results) {
    if ("error" in r.result) {
      errors += 1;
      continue;
    }
    valid += 1;
    grandTotal += r.result.total;
    totalLabor += r.result.laborSubtotal;
    totalMaterials += r.result.materialsSubtotal;
    totalTax += r.result.tax;
  }
  return {
    total: results.length,
    valid,
    errors,
    grandTotal: round2(grandTotal),
    totalLabor: round2(totalLabor),
    totalMaterials: round2(totalMaterials),
    totalTax: round2(totalTax),
  };
}

/** Serialize a batch summary to CSV (one row per work order). */
export function batchToCsv(results: BatchResult[]): string {
  const lines = ["WorkOrderNumber,Customer,Labor,Materials,Subtotal,Tax,Total,Error"];
  for (const r of results) {
    const num = r.input.workOrderNumber.replace(/"/g, '""');
    const cust = r.input.customer.replace(/"/g, '""');
    if ("error" in r.result) {
      lines.push(`"${num}","${cust}",,,,,,"${r.result.error.replace(/"/g, '""')}"`);
      continue;
    }
    lines.push(`"${num}","${cust}",${r.result.laborSubtotal},${r.result.materialsSubtotal},${r.result.subtotal},${r.result.tax},${r.result.total},`);
  }
  return lines.join("\n");
}

/** Parse a multi-line text input into a list of work-order numbers (lightweight batch entry). */
export function parseBatchInput(text: string): { numbers: string[]; customers: string[] }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [num, ...rest] = line.split(/[,\t]+/);
      return { numbers: [num ?? ""], customers: [rest.join(" ").trim()] };
    });
}
