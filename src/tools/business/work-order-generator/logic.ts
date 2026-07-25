/**
 * Work Order Generator — line items, labor, materials, totals.
 */
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface WorkOrderInput {
  workOrderNumber: string;
  customer: string;
  labor: LineItem[];
  materials: LineItem[];
  taxRate: number; // percent
}

export interface WorkOrderResult {
  laborSubtotal: number;
  materialsSubtotal: number;
  subtotal: number;
  tax: number;
  total: number;
}

export function lineTotal(item: LineItem): number {
  return item.quantity * item.unitPrice;
}

export function sumItems(items: LineItem[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}

export function computeWorkOrder(input: WorkOrderInput): WorkOrderResult | { error: string } {
  if (input.taxRate < 0 || input.taxRate > 100) return { error: "Tax rate must be 0-100" };
  if (input.labor.some((i) => i.quantity < 0 || i.unitPrice < 0)) return { error: "Labor items cannot be negative" };
  if (input.materials.some((i) => i.quantity < 0 || i.unitPrice < 0)) return { error: "Material items cannot be negative" };
  const laborSubtotal = sumItems(input.labor);
  const materialsSubtotal = sumItems(input.materials);
  const subtotal = laborSubtotal + materialsSubtotal;
  const tax = subtotal * (input.taxRate / 100);
  return { laborSubtotal, materialsSubtotal, subtotal, tax, total: subtotal + tax };
}

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function renderWorkOrder(input: WorkOrderInput, r: WorkOrderResult): string {
  const L: string[] = [];
  L.push(`WORK ORDER #${input.workOrderNumber}`, `Customer: ${input.customer}`, "=".repeat(50), "");
  L.push("LABOR:");
  for (const i of input.labor) L.push(`  ${i.description} × ${i.quantity} @ ${formatMoney(i.unitPrice)} = ${formatMoney(lineTotal(i))}`);
  L.push(`  Subtotal: ${formatMoney(r.laborSubtotal)}`, "");
  L.push("MATERIALS:");
  for (const i of input.materials) L.push(`  ${i.description} × ${i.quantity} @ ${formatMoney(i.unitPrice)} = ${formatMoney(lineTotal(i))}`);
  L.push(`  Subtotal: ${formatMoney(r.materialsSubtotal)}`, "");
  L.push("-".repeat(50));
  L.push(`Subtotal: ${formatMoney(r.subtotal)}`);
  L.push(`Tax (${input.taxRate}%): ${formatMoney(r.tax)}`);
  L.push(`TOTAL: ${formatMoney(r.total)}`);
  return L.join("\n");
}
