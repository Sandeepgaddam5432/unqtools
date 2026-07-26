/**
 * Purchase Order Generator — pure logic.
 * Vendor info, line items, quantities, unit prices, totals, approval status.
 */

export interface POLineItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  uom: string; // unit of measure
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  paymentTerms: string;
}

export type POStatus = "draft" | "submitted" | "approved" | "rejected" | "received" | "closed";

export interface PurchaseOrder {
  id: string;
  number: string;
  createdAt: number;
  expectedDeliveryAt: number;
  vendor: Vendor;
  shipTo: string;
  items: POLineItem[];
  currency: string;
  shippingCost: number;
  taxRate: number; // flat tax 0..1
  discountRate: number; // 0..1
  status: POStatus;
  approver: string;
  notes: string;
}

export function createVendor(name: string, email = "", address = "", phone = "", taxId = "", paymentTerms = "Net 30"): Vendor {
  return {
    id: `vendor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Unknown vendor",
    email,
    phone,
    address,
    taxId,
    paymentTerms,
  };
}

export function createPO(vendor: Vendor, number = "PO-001", shipTo = ""): PurchaseOrder {
  const now = Date.now();
  return {
    id: `po-${now}-${Math.random().toString(36).slice(2, 8)}`,
    number,
    createdAt: now,
    expectedDeliveryAt: now + 14 * 24 * 60 * 60 * 1000,
    vendor,
    shipTo: shipTo || vendor.address,
    items: [],
    currency: "USD",
    shippingCost: 0,
    taxRate: 0,
    discountRate: 0,
    status: "draft",
    approver: "",
    notes: "",
  };
}

export function addItem(po: PurchaseOrder, sku: string, description: string, quantity: number, unitPrice: number, uom = "ea"): PurchaseOrder {
  const item: POLineItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sku: sku.trim(),
    description: description.trim() || "Item",
    quantity: Math.max(0, quantity),
    unitPrice: Math.max(0, unitPrice),
    uom,
  };
  return { ...po, items: [...po.items, item] };
}

export function removeItem(po: PurchaseOrder, id: string): PurchaseOrder {
  return { ...po, items: po.items.filter((i) => i.id !== id) };
}

export function updateItem(po: PurchaseOrder, id: string, patch: Partial<POLineItem>): PurchaseOrder {
  return { ...po, items: po.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function lineTotal(item: POLineItem): number {
  return item.quantity * item.unitPrice;
}

export function subtotal(po: PurchaseOrder): number {
  return po.items.reduce((s, i) => s + lineTotal(i), 0);
}

export function discountAmount(po: PurchaseOrder): number {
  return subtotal(po) * po.discountRate;
}

export function taxAmount(po: PurchaseOrder): number {
  return Math.max(0, subtotal(po) - discountAmount(po)) * po.taxRate;
}

export function total(po: PurchaseOrder): number {
  return subtotal(po) - discountAmount(po) + taxAmount(po) + po.shippingCost;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Validate a PO. */
export function validatePO(po: PurchaseOrder): string[] {
  const w: string[] = [];
  if (po.items.length === 0) w.push("PO has no line items.");
  if (!po.vendor.name) w.push("Vendor name is required.");
  if (!po.shipTo.trim()) w.push("Ship-to address is required.");
  if (po.taxRate < 0 || po.taxRate > 1) w.push("Tax rate must be between 0 and 1.");
  if (po.discountRate < 0 || po.discountRate > 1) w.push("Discount rate must be between 0 and 1.");
  if (po.expectedDeliveryAt < po.createdAt) w.push("Expected delivery is before creation date.");
  if (po.status === "approved" && !po.approver.trim()) w.push("Approved POs require an approver.");
  return w;
}

/** Transition status with rules. */
export function transitionStatus(po: PurchaseOrder, newStatus: POStatus, approver?: string): PurchaseOrder {
  const valid: Record<POStatus, POStatus[]> = {
    draft: ["submitted"],
    submitted: ["approved", "rejected"],
    approved: ["received"],
    rejected: ["draft"],
    received: ["closed"],
    closed: [],
  };
  if (!valid[po.status].includes(newStatus)) return po;
  const patch: Partial<PurchaseOrder> = { status: newStatus };
  if (newStatus === "approved" && approver) patch.approver = approver;
  return { ...po, ...patch };
}

/** Export as CSV. */
export function exportPOCSV(po: PurchaseOrder): string {
  const header = ["line", "sku", "description", "quantity", "uom", "unit_price", "line_total"];
  const rows = po.items.map((i, idx) =>
    [idx + 1, `"${i.sku}"`, `"${i.description.replace(/"/g, '""')}"`, i.quantity, i.uom, i.unitPrice.toFixed(2), lineTotal(i).toFixed(2)].join(","),
  );
  rows.push(`"SUBTOTAL",,,,,${subtotal(po).toFixed(2)}`);
  rows.push(`"DISCOUNT",,,,,${discountAmount(po).toFixed(2)}`);
  rows.push(`"TAX",,,,,${taxAmount(po).toFixed(2)}`);
  rows.push(`"SHIPPING",,,,,${po.shippingCost.toFixed(2)}`);
  rows.push(`"TOTAL",,,,,${total(po).toFixed(2)}`);
  return [header.join(","), ...rows].join("\n");
}

/** Export as plain-text PO. */
export function exportPOText(po: PurchaseOrder): string {
  const lines: string[] = [];
  lines.push(`PURCHASE ORDER ${po.number}`);
  lines.push(`Created: ${new Date(po.createdAt).toLocaleDateString()}`);
  lines.push(`Expected delivery: ${new Date(po.expectedDeliveryAt).toLocaleDateString()}`);
  lines.push(`Status: ${po.status}`);
  if (po.approver) lines.push(`Approver: ${po.approver}`);
  lines.push("");
  lines.push(`Vendor: ${po.vendor.name}`);
  lines.push(`  ${po.vendor.email}  ${po.vendor.phone}`);
  lines.push(`  ${po.vendor.address}`);
  lines.push(`  Tax ID: ${po.vendor.taxId || "—"}  Terms: ${po.vendor.paymentTerms}`);
  lines.push("");
  lines.push(`Ship to: ${po.shipTo}`);
  lines.push("");
  lines.push("Items:");
  po.items.forEach((i, idx) => {
    lines.push(`  ${idx + 1}. [${i.sku || "—"}] ${i.description} — ${i.quantity} ${i.uom} × ${formatCurrency(i.unitPrice, po.currency)} = ${formatCurrency(lineTotal(i), po.currency)}`);
  });
  lines.push("");
  lines.push(`Subtotal:  ${formatCurrency(subtotal(po), po.currency)}`);
  if (po.discountRate > 0) lines.push(`Discount:  -${formatCurrency(discountAmount(po), po.currency)}`);
  if (po.taxRate > 0) lines.push(`Tax:       ${formatCurrency(taxAmount(po), po.currency)}`);
  if (po.shippingCost > 0) lines.push(`Shipping:  ${formatCurrency(po.shippingCost, po.currency)}`);
  lines.push(`TOTAL:     ${formatCurrency(total(po), po.currency)}`);
  if (po.notes) lines.push(`\nNotes: ${po.notes}`);
  return lines.join("\n");
}

/** Compute summary stats. */
export function poStats(po: PurchaseOrder): {
  itemCount: number;
  totalQuantity: number;
  avgUnitPrice: number;
  largestLine: POLineItem | null;
} {
  const itemCount = po.items.length;
  const totalQuantity = po.items.reduce((s, i) => s + i.quantity, 0);
  const avgUnitPrice = itemCount ? po.items.reduce((s, i) => s + i.unitPrice, 0) / itemCount : 0;
  const largestLine = itemCount ? [...po.items].sort((a, b) => lineTotal(b) - lineTotal(a))[0] : null;
  return { itemCount, totalQuantity, avgUnitPrice, largestLine };
}

/** Group items by UOM. */
export function groupByUOM(po: PurchaseOrder): Record<string, POLineItem[]> {
  const out: Record<string, POLineItem[]> = {};
  for (const i of po.items) {
    if (!out[i.uom]) out[i.uom] = [];
    out[i.uom].push(i);
  }
  return out;
}

/** Generate next PO number. */
export function nextPONumber(last: string): string {
  const m = /^([A-Za-z-]*?)(\d+)$/.exec(last);
  if (!m) return `${last}-1`;
  const next = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return `${m[1]}${next}`;
}

/** Days until expected delivery. */
export function daysUntilDelivery(po: PurchaseOrder, now = Date.now()): number {
  return Math.ceil((po.expectedDeliveryAt - now) / (24 * 60 * 60 * 1000));
}

/** Is PO overdue (not received past expected date)? */
export function isOverdue(po: PurchaseOrder, now = Date.now()): boolean {
  return now > po.expectedDeliveryAt && po.status !== "received" && po.status !== "closed";
}

/** Bulk approve multiple POs. */
export function bulkApprove(pos: PurchaseOrder[], approver: string): PurchaseOrder[] {
  return pos.map((po) => (po.status === "submitted" ? transitionStatus(po, "approved", approver) : po));
}

/** Sort items by SKU. */
export function sortBySKU(po: PurchaseOrder): POLineItem[] {
  return [...po.items].sort((a, b) => a.sku.localeCompare(b.sku));
}
