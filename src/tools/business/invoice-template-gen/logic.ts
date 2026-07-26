/**
 * Invoice Template Generator — pure logic.
 * Line items, tax (flat/bracket), discount, terms, subtotal/total, CSV/PDF-friendly export.
 */

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}

export interface InvoiceParty {
  name: string;
  email: string;
  address: string;
  phone?: string;
}

export type TaxMode = "flat" | "bracket" | "none";

export interface TaxBracket {
  upTo: number; // amount this bracket applies up to (cumulative subtotal)
  rate: number; // 0..1
}

export interface Invoice {
  id: string;
  number: string;
  issuedAt: number;
  dueAt: number;
  issuer: InvoiceParty;
  client: InvoiceParty;
  items: InvoiceLineItem[];
  currency: string;
  taxMode: TaxMode;
  flatTaxRate: number; // 0..1, used when taxMode = "flat"
  brackets: TaxBracket[];
  discountRate: number; // 0..1
  terms: string;
  notes: string;
  status: "draft" | "sent" | "paid" | "overdue";
}

export function createInvoice(issuer: InvoiceParty, client: InvoiceParty, number = "INV-001"): Invoice {
  const now = Date.now();
  return {
    id: `inv-${now}-${Math.random().toString(36).slice(2, 8)}`,
    number,
    issuedAt: now,
    dueAt: now + 14 * 24 * 60 * 60 * 1000,
    issuer,
    client,
    items: [],
    currency: "USD",
    taxMode: "flat",
    flatTaxRate: 0.08,
    brackets: [],
    discountRate: 0,
    terms: "Net 14. Late payments subject to 1.5% monthly interest.",
    notes: "",
    status: "draft",
  };
}

export function addItem(invoice: Invoice, description: string, quantity: number, unitPrice: number, taxable = true): Invoice {
  const item: InvoiceLineItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: description.trim() || "Item",
    quantity: Math.max(0, quantity),
    unitPrice: Math.max(0, unitPrice),
    taxable,
  };
  return { ...invoice, items: [...invoice.items, item] };
}

export function removeItem(invoice: Invoice, id: string): Invoice {
  return { ...invoice, items: invoice.items.filter((i) => i.id !== id) };
}

export function updateItem(invoice: Invoice, id: string, patch: Partial<InvoiceLineItem>): Invoice {
  return { ...invoice, items: invoice.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function lineTotal(item: InvoiceLineItem): number {
  return item.quantity * item.unitPrice;
}

export function subtotal(invoice: Invoice): number {
  return invoice.items.reduce((s, i) => s + lineTotal(i), 0);
}

export function taxableSubtotal(invoice: Invoice): number {
  return invoice.items.filter((i) => i.taxable).reduce((s, i) => s + lineTotal(i), 0);
}

export function discountAmount(invoice: Invoice): number {
  return subtotal(invoice) * invoice.discountRate;
}

export function taxAmount(invoice: Invoice): number {
  const base = taxableSubtotal(invoice) - discountAmount(invoice) * (taxableSubtotal(invoice) / Math.max(1, subtotal(invoice)));
  if (invoice.taxMode === "none") return 0;
  if (invoice.taxMode === "flat") return Math.max(0, base) * invoice.flatTaxRate;
  // bracket
  let tax = 0;
  let remaining = Math.max(0, base);
  let prevCap = 0;
  for (const b of invoice.brackets) {
    const slab = Math.max(0, Math.min(b.upTo, remaining + prevCap) - prevCap);
    if (slab <= 0) break;
    tax += slab * b.rate;
    remaining -= slab;
    prevCap = b.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

export function total(invoice: Invoice): number {
  return subtotal(invoice) - discountAmount(invoice) + taxAmount(invoice);
}

export function amountDue(invoice: Invoice): number {
  // If paid, $0 due; else full total
  return invoice.status === "paid" ? 0 : total(invoice);
}

export function isOverdue(invoice: Invoice, now = Date.now()): boolean {
  return now > invoice.dueAt && invoice.status !== "paid";
}

export function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Export invoice as CSV (one row per line item + summary rows). */
export function exportInvoiceCSV(invoice: Invoice): string {
  const header = ["line", "description", "quantity", "unit_price", "line_total", "taxable"];
  const rows = invoice.items.map((i, idx) =>
    [idx + 1, `"${i.description.replace(/"/g, '""')}"`, i.quantity, i.unitPrice.toFixed(2), lineTotal(i).toFixed(2), i.taxable ? "yes" : "no"].join(","),
  );
  rows.push(`"SUBTOTAL",,,"",${subtotal(invoice).toFixed(2)},`);
  rows.push(`"DISCOUNT",,,"",${discountAmount(invoice).toFixed(2)},`);
  rows.push(`"TAX",,,"",${taxAmount(invoice).toFixed(2)},`);
  rows.push(`"TOTAL",,,"",${total(invoice).toFixed(2)},`);
  return [header.join(","), ...rows].join("\n");
}

/** Plain-text invoice suitable for email. */
export function exportInvoiceText(invoice: Invoice): string {
  const lines: string[] = [];
  lines.push(`INVOICE ${invoice.number}`);
  lines.push(`Issued: ${new Date(invoice.issuedAt).toLocaleDateString()}`);
  lines.push(`Due:    ${new Date(invoice.dueAt).toLocaleDateString()}`);
  lines.push("");
  lines.push(`From: ${invoice.issuer.name}`);
  lines.push(`      ${invoice.issuer.email}`);
  lines.push(`      ${invoice.issuer.address}`);
  lines.push("");
  lines.push(`To:   ${invoice.client.name}`);
  lines.push(`      ${invoice.client.email}`);
  lines.push(`      ${invoice.client.address}`);
  lines.push("");
  lines.push("Items:");
  invoice.items.forEach((i, idx) => {
    lines.push(`  ${idx + 1}. ${i.description} — ${i.quantity} × ${formatCurrency(i.unitPrice, invoice.currency)} = ${formatCurrency(lineTotal(i), invoice.currency)}`);
  });
  lines.push("");
  lines.push(`Subtotal:  ${formatCurrency(subtotal(invoice), invoice.currency)}`);
  if (invoice.discountRate > 0) lines.push(`Discount:  -${formatCurrency(discountAmount(invoice), invoice.currency)} (${(invoice.discountRate * 100).toFixed(1)}%)`);
  if (invoice.taxMode !== "none") lines.push(`Tax:       ${formatCurrency(taxAmount(invoice), invoice.currency)}`);
  lines.push(`TOTAL:     ${formatCurrency(total(invoice), invoice.currency)}`);
  if (invoice.terms) lines.push(`\nTerms: ${invoice.terms}`);
  if (invoice.notes) lines.push(`Notes: ${invoice.notes}`);
  return lines.join("\n");
}

/** Validate invoice. */
export function validateInvoice(invoice: Invoice): string[] {
  const w: string[] = [];
  if (invoice.items.length === 0) w.push("Invoice has no line items.");
  if (!invoice.issuer.name) w.push("Issuer name required.");
  if (!invoice.client.name) w.push("Client name required.");
  if (invoice.dueAt < invoice.issuedAt) w.push("Due date is before issue date.");
  if (invoice.taxMode === "flat" && (invoice.flatTaxRate < 0 || invoice.flatTaxRate > 1)) w.push("Flat tax rate must be between 0 and 1.");
  if (invoice.taxMode === "bracket" && invoice.brackets.length === 0) w.push("Bracket tax mode requires at least one bracket.");
  if (invoice.discountRate < 0 || invoice.discountRate > 1) w.push("Discount rate must be between 0 and 1.");
  return w;
}

/** Compute days until due. */
export function daysUntilDue(invoice: Invoice, now = Date.now()): number {
  return Math.ceil((invoice.dueAt - now) / (24 * 60 * 60 * 1000));
}

/** Late fee if overdue (1.5% per month). */
export function lateFee(invoice: Invoice, now = Date.now()): number {
  if (!isOverdue(invoice, now)) return 0;
  const daysLate = Math.max(0, Math.ceil((now - invoice.dueAt) / (24 * 60 * 60 * 1000)));
  const monthsLate = daysLate / 30;
  return total(invoice) * 0.015 * monthsLate;
}

/** Stats summary. */
export function invoiceStats(invoice: Invoice): {
  itemCount: number;
  totalQuantity: number;
  avgItemValue: number;
  effectiveTaxRate: number;
} {
  const itemCount = invoice.items.length;
  const totalQuantity = invoice.items.reduce((s, i) => s + i.quantity, 0);
  const avgItemValue = itemCount ? subtotal(invoice) / itemCount : 0;
  const effectiveTaxRate = subtotal(invoice) > 0 ? taxAmount(invoice) / subtotal(invoice) : 0;
  return { itemCount, totalQuantity, avgItemValue, effectiveTaxRate };
}

/** Apply a flat dollar discount (instead of percentage). */
export function applyFlatDiscount(invoice: Invoice, flatAmount: number): Invoice {
  const sub = subtotal(invoice);
  const rate = sub > 0 ? Math.min(1, flatAmount / sub) : 0;
  return { ...invoice, discountRate: rate };
}

/** Mark invoice as paid. */
export function markPaid(invoice: Invoice): Invoice {
  return { ...invoice, status: "paid" };
}

/** Generate next invoice number. */
export function nextInvoiceNumber(lastNumber: string): string {
  const m = /^([A-Za-z-]*?)(\d+)$/.exec(lastNumber);
  if (!m) return `${lastNumber}-1`;
  const next = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return `${m[1]}${next}`;
}
