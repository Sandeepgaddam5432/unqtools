/**
 * Invoice Generator — pure logic.
 *
 * Parse line items, compute totals, render as PDF / HTML / text / CSV.
 * Pure functions only — DOM only via pdf-lib inside async generator.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ---- Types ----

export interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export type CurrencySymbol = "$" | "€" | "£" | "₹" | "¥" | "A$" | "C$";

export interface InvoiceInput {
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  lineItemsText: string;
  taxRate: number;
  discountPercent: number;
  currencySymbol: CurrencySymbol;
  notes: string;
}

export interface InvoiceTotals {
  lineItems: LineItem[];
  subtotal: number;
  discountAmount: number;
  discountedSubtotal: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  totalQty: number;
}

export interface InvoiceHistoryEntry {
  ts: number;
  invoiceNumber: string;
  total: number;
  currencySymbol: CurrencySymbol;
  itemCount: number;
}

// ---- Constants / Presets ----

export const CURRENCY_PRESETS: CurrencySymbol[] = ["$", "€", "£", "₹", "¥", "A$", "C$"];

export const TAX_PRESETS: number[] = [0, 5, 8.5, 10, 18, 20, 25];

export const DUE_DATE_PRESETS: { label: string; days: number }[] = [
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 60", days: 60 },
];

// ---- Parsing ----

/** Parse `description,qty,unit_price` lines. Returns parsed items + errors. */
export function parseLineItems(text: string): { items: LineItem[]; errors: string[] } {
  const items: LineItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    // Split by comma but respect quoted values.
    const parts = splitCsvRow(line).map((s) => s.trim());

    if (parts.length < 3) {
      errors.push(`Line ${idx + 1}: needs description,qty,unit_price`);
      return;
    }
    const [description, qtyStr, unitStr] = parts;
    const qty = Number(qtyStr);
    const unitPrice = Number(unitStr);
    if (!description) {
      errors.push(`Line ${idx + 1}: description is required`);
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      errors.push(`Line ${idx + 1}: invalid qty "${qtyStr}"`);
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`Line ${idx + 1}: invalid unit_price "${unitStr}"`);
      return;
    }
    items.push({ description, qty, unitPrice, total: round2(qty * unitPrice) });
  });
  return { items, errors };
}

/** Split CSV row honoring quoted values (basic). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---- Calculations ----

/** Apply discount percentage. */
export function applyDiscount(amount: number, discountPercent: number): number {
  if (!Number.isFinite(discountPercent) || discountPercent <= 0) return amount;
  if (discountPercent >= 100) return 0;
  return round2(amount * (1 - discountPercent / 100));
}

/** Calculate tax amount. */
export function calculateTax(amount: number, taxRate: number): number {
  if (!Number.isFinite(taxRate) || taxRate <= 0) return 0;
  return round2(amount * (taxRate / 100));
}

/** Compute all totals from a list of line items. */
export function computeTotals(
  items: LineItem[],
  discountPercent: number,
  taxRate: number,
): InvoiceTotals {
  const subtotal = round2(items.reduce((s, it) => s + it.total, 0));
  const discountAmount = round2(subtotal - applyDiscount(subtotal, discountPercent));
  const discountedSubtotal = round2(subtotal - discountAmount);
  const taxAmount = calculateTax(discountedSubtotal, taxRate);
  const total = round2(discountedSubtotal + taxAmount);
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  return {
    lineItems: items,
    subtotal,
    discountAmount,
    discountedSubtotal,
    taxAmount,
    total,
    itemCount: items.length,
    totalQty,
  };
}

/** Compute grand total directly from raw input. */
export function computeGrandTotal(input: InvoiceInput): InvoiceTotals {
  const { items } = parseLineItems(input.lineItemsText);
  return computeTotals(items, input.discountPercent, input.taxRate);
}

// ---- Formatting ----

/** Format a number as currency string. */
export function formatCurrency(amount: number, symbol: CurrencySymbol): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toFixed(2)}`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Auto-suggesters ----

/** Suggest an invoice number based on date and optional sequence. */
export function suggestInvoiceNumber(dateStr: string, sequence: number = 1): string {
  const year = dateStr ? dateStr.slice(0, 4) : new Date().getFullYear().toString();
  const safeSeq = Math.max(1, Math.floor(sequence));
  const seqStr = String(safeSeq).padStart(3, "0");
  return `INV-${year}-${seqStr}`;
}

/** Calculate due date given invoice date and days. */
export function calculateDueDate(invoiceDate: string, days: number): string {
  if (!invoiceDate) return "";
  const d = new Date(invoiceDate + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

// ---- Renderers ----

/** Render invoice as plain text. */
export function renderText(input: InvoiceInput, totals: InvoiceTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("INVOICE");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Invoice #: ${input.invoiceNumber}`);
  L.push(`Date: ${input.invoiceDate}`);
  L.push(`Due: ${input.dueDate}`);
  L.push("");
  L.push("FROM:");
  L.push(input.fromName || "-");
  if (input.fromEmail) L.push(input.fromEmail);
  if (input.fromAddress) L.push(input.fromAddress.replace(/\n/g, " | "));
  L.push("");
  L.push("BILL TO:");
  L.push(input.toName || "-");
  if (input.toEmail) L.push(input.toEmail);
  if (input.toAddress) L.push(input.toAddress.replace(/\n/g, " | "));
  L.push("");
  L.push("-".repeat(60));
  L.push("Description".padEnd(34) + "Qty".padStart(8) + "Price".padStart(9) + "Total".padStart(9));
  L.push("-".repeat(60));
  for (const it of totals.lineItems) {
    const desc = it.description.length > 32 ? it.description.slice(0, 29) + "..." : it.description;
    L.push(
      desc.padEnd(34) +
      String(it.qty).padStart(8) +
      cur(it.unitPrice).padStart(9) +
      cur(it.total).padStart(9),
    );
  }
  L.push("-".repeat(60));
  L.push("Subtotal:".padEnd(43) + cur(totals.subtotal).padStart(17));
  if (totals.discountAmount > 0) {
    L.push(`Discount (${input.discountPercent}%):`.padEnd(43) + "-" + cur(totals.discountAmount).padStart(16));
  }
  if (totals.taxAmount > 0) {
    L.push(`Tax (${input.taxRate}%):`.padEnd(43) + cur(totals.taxAmount).padStart(17));
  }
  L.push("=".repeat(60));
  L.push("TOTAL DUE:".padEnd(43) + cur(totals.total).padStart(17));
  L.push("=".repeat(60));
  if (input.notes) {
    L.push("");
    L.push("Notes:");
    L.push(input.notes);
  }
  return L.join("\n");
}

/** Render invoice as CSV of line items. */
export function renderCsv(input: InvoiceInput, totals: InvoiceTotals): string {
  const lines = ["description,qty,unit_price,line_total"];
  for (const it of totals.lineItems) {
    lines.push([
      escapeCsv(it.description),
      String(it.qty),
      it.unitPrice.toFixed(2),
      it.total.toFixed(2),
    ].join(","));
  }
  lines.push("");
  lines.push(`invoice_number,${escapeCsv(input.invoiceNumber)}`);
  lines.push(`invoice_date,${escapeCsv(input.invoiceDate)}`);
  lines.push(`due_date,${escapeCsv(input.dueDate)}`);
  lines.push(`from_name,${escapeCsv(input.fromName)}`);
  lines.push(`from_email,${escapeCsv(input.fromEmail)}`);
  lines.push(`to_name,${escapeCsv(input.toName)}`);
  lines.push(`to_email,${escapeCsv(input.toEmail)}`);
  lines.push(`currency,${escapeCsv(input.currencySymbol)}`);
  lines.push(`subtotal,${totals.subtotal.toFixed(2)}`);
  lines.push(`discount_percent,${input.discountPercent}`);
  lines.push(`discount_amount,${totals.discountAmount.toFixed(2)}`);
  lines.push(`tax_rate,${input.taxRate}`);
  lines.push(`tax_amount,${totals.taxAmount.toFixed(2)}`);
  lines.push(`total,${totals.total.toFixed(2)}`);
  return lines.join("\n");
}

/** Render invoice as printable HTML with inline CSS. */
export function renderHtml(input: InvoiceInput, totals: InvoiceTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const rows = totals.lineItems
    .map(
      (it) =>
        `<tr><td>${esc(it.description)}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">${cur(it.unitPrice)}</td><td style="text-align:right">${cur(it.total)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(input.invoiceNumber)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:800px}
  h1{font-size:28px;margin:0 0 4px;color:#111}
  .muted{color:#666;font-size:13px}
  .grid{display:flex;justify-content:space-between;margin:24px 0}
  .box{flex:1;padding:12px;border:1px solid #eee;border-radius:6px;background:#fafafa}
  .box + .box{margin-left:16px}
  .box h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#888}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{padding:8px 12px;border-bottom:1px solid #eee;font-size:14px}
  th{background:#f5f5f5;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
  .totals{margin-left:auto;width:280px;font-size:14px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid #111;margin-top:8px;padding-top:8px;font-weight:bold;font-size:18px}
  .notes{margin-top:24px;padding:12px;background:#fafafa;border-radius:6px;font-size:13px;color:#444}
</style></head><body>
<h1>INVOICE</h1>
<div class="muted">#${esc(input.invoiceNumber)} · Issued ${esc(input.invoiceDate)} · Due ${esc(input.dueDate)}</div>
<div class="grid">
  <div class="box"><h3>From</h3><div><strong>${esc(input.fromName)}</strong></div><div class="muted">${esc(input.fromEmail)}</div><div class="muted">${esc(input.fromAddress)}</div></div>
  <div class="box"><h3>Bill To</h3><div><strong>${esc(input.toName)}</strong></div><div class="muted">${esc(input.toEmail)}</div><div class="muted">${esc(input.toAddress)}</div></div>
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Subtotal</span><span>${cur(totals.subtotal)}</span></div>
  ${totals.discountAmount > 0 ? `<div><span>Discount (${input.discountPercent}%)</span><span>-${cur(totals.discountAmount)}</span></div>` : ""}
  ${totals.taxAmount > 0 ? `<div><span>Tax (${input.taxRate}%)</span><span>${cur(totals.taxAmount)}</span></div>` : ""}
  <div class="grand"><span>Total Due</span><span>${cur(totals.total)}</span></div>
</div>
${input.notes ? `<div class="notes"><strong>Notes:</strong><br/>${esc(input.notes)}</div>` : ""}
</body></html>`;
}

// ---- PDF generation (pdf-lib) ----

/** Generate a PDF invoice as bytes. */
export async function generatePdf(
  input: InvoiceInput,
  totals: InvoiceTotals,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28; // A4 width
  const pageH = 841.89; // A4 height
  const page = doc.addPage([pageW, pageH]);
  const margin = 40;
  let y = pageH - margin;

  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const drawText = (
    text: string,
    x: number,
    yv: number,
    size: number,
    f: typeof font,
    color = rgb(0.1, 0.1, 0.1),
  ) => {
    page.drawText(text, { x, y: yv, size, font: f, color });
  };

  // Header
  drawText("INVOICE", margin, y, 28, fontBold, rgb(0, 0, 0));
  y -= 18;
  drawText(`# ${input.invoiceNumber}`, margin, y, 11, font, rgb(0.4, 0.4, 0.4));
  y -= 14;
  drawText(
    `Issued: ${input.invoiceDate}    Due: ${input.dueDate}`,
    margin,
    y,
    10,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  y -= 24;

  // From / To
  const colW = (pageW - margin * 2) / 2 - 8;
  drawText("FROM", margin, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  drawText("BILL TO", margin + colW + 16, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  y -= 14;
  const fromLines = [
    input.fromName,
    input.fromEmail,
    ...multiLine(input.fromAddress, colW, font, 10),
  ].filter(Boolean);
  const toLines = [
    input.toName,
    input.toEmail,
    ...multiLine(input.toAddress, colW, font, 10),
  ].filter(Boolean);
  const maxLines = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (fromLines[i]) drawText(truncate(fromLines[i], colW, font, 10), margin, y, 10, font);
    if (toLines[i]) drawText(truncate(toLines[i], colW, font, 10), margin + colW + 16, y, 10, font);
    y -= 13;
  }
  y -= 10;

  // Items table header
  drawText("Description", margin, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  drawText("Qty", margin + colW * 1.5, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  drawText("Price", margin + colW * 1.7 + 20, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  drawText("Total", pageW - margin - 50, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageW - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 14;

  // Items
  for (const it of totals.lineItems) {
    const desc = truncate(it.description, colW * 1.4, font, 10);
    drawText(desc, margin, y, 10, font);
    drawText(String(it.qty), margin + colW * 1.5, y, 10, font);
    drawText(cur(it.unitPrice), margin + colW * 1.7 + 20, y, 10, font);
    drawText(cur(it.total), pageW - margin - 50, y, 10, font);
    y -= 14;
    if (y < margin + 100) break;
  }
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageW - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 18;

  // Totals
  const tx = pageW - margin - 200;
  const vx = pageW - margin;
  const totalRow = (label: string, val: string, bold = false) => {
    drawText(label, tx, y, 10, bold ? fontBold : font, bold ? rgb(0, 0, 0) : rgb(0.3, 0.3, 0.3));
    drawText(val, vx - 60, y, 10, bold ? fontBold : font, bold ? rgb(0, 0, 0) : rgb(0.3, 0.3, 0.3));
    y -= 14;
  };
  totalRow("Subtotal", cur(totals.subtotal));
  if (totals.discountAmount > 0) totalRow(`Discount (${input.discountPercent}%)`, "-" + cur(totals.discountAmount));
  if (totals.taxAmount > 0) totalRow(`Tax (${input.taxRate}%)`, cur(totals.taxAmount));
  y -= 4;
  page.drawLine({ start: { x: tx, y }, end: { x: vx, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;
  totalRow("TOTAL DUE", cur(totals.total), true);

  // Notes
  if (input.notes) {
    y -= 20;
    drawText("Notes", margin, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
    y -= 14;
    const noteLines = multiLine(input.notes, pageW - margin * 2, font, 9);
    for (const ln of noteLines) {
      drawText(ln, margin, y, 9, font, rgb(0.3, 0.3, 0.3));
      y -= 12;
      if (y < margin) break;
    }
  }

  doc.setProducer("UnQTools — Invoice Generator");
  doc.setCreator("UnQTools — Invoice Generator");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  return await doc.save();
}

function truncate(s: string, maxW: number, font: { widthOfTextAtSize: (t: string, n: number) => number }, size: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const t = s.slice(0, mid) + "…";
    if (font.widthOfTextAtSize(t, size) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + "…";
}

function multiLine(s: string, maxW: number, font: { widthOfTextAtSize: (t: string, n: number) => number }, size: number): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const para of s.split(/\n/)) {
    if (!para) { out.push(""); continue; }
    const words = para.split(" ");
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > maxW && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = t;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:invoice-generator:history";
const HISTORY_MAX = 20;

export function loadHistory(): InvoiceHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as InvoiceHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: InvoiceHistoryEntry): InvoiceHistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<InvoiceInput>): string {
  const params = new URLSearchParams();
  if (input.fromName) params.set("fromName", input.fromName);
  if (input.fromEmail) params.set("fromEmail", input.fromEmail);
  if (input.fromAddress) params.set("fromAddress", input.fromAddress);
  if (input.toName) params.set("toName", input.toName);
  if (input.toEmail) params.set("toEmail", input.toEmail);
  if (input.toAddress) params.set("toAddress", input.toAddress);
  if (input.invoiceNumber) params.set("inv", input.invoiceNumber);
  if (input.invoiceDate) params.set("date", input.invoiceDate);
  if (input.dueDate) params.set("due", input.dueDate);
  if (input.lineItemsText) params.set("items", input.lineItemsText);
  if (input.taxRate !== undefined) params.set("tax", String(input.taxRate));
  if (input.discountPercent !== undefined) params.set("disc", String(input.discountPercent));
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (input.notes) params.set("notes", input.notes);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<InvoiceInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<InvoiceInput> = {};
  if (params.get("fromName")) out.fromName = params.get("fromName")!;
  if (params.get("fromEmail")) out.fromEmail = params.get("fromEmail")!;
  if (params.get("fromAddress")) out.fromAddress = params.get("fromAddress")!;
  if (params.get("toName")) out.toName = params.get("toName")!;
  if (params.get("toEmail")) out.toEmail = params.get("toEmail")!;
  if (params.get("toAddress")) out.toAddress = params.get("toAddress")!;
  if (params.get("inv")) out.invoiceNumber = params.get("inv")!;
  if (params.get("date")) out.invoiceDate = params.get("date")!;
  if (params.get("due")) out.dueDate = params.get("due")!;
  if (params.get("items")) out.lineItemsText = params.get("items")!;
  const tax = params.get("tax");
  if (tax !== null) {
    const n = Number(tax);
    if (Number.isFinite(n)) out.taxRate = n;
  }
  const disc = params.get("disc");
  if (disc !== null) {
    const n = Number(disc);
    if (Number.isFinite(n)) out.discountPercent = n;
  }
  const cur = params.get("cur") as CurrencySymbol | null;
  if (cur && CURRENCY_PRESETS.includes(cur)) out.currencySymbol = cur;
  if (params.get("notes")) out.notes = params.get("notes")!;
  return out;
}

// ---- Summary stats ----

export interface InvoiceSummaryStats {
  itemCount: number;
  totalQty: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  avgLineTotal: number;
  maxLineTotal: number;
  minLineTotal: number;
}

export function summaryStats(totals: InvoiceTotals): InvoiceSummaryStats {
  const lineTotals = totals.lineItems.map((i) => i.total);
  const sum = lineTotals.reduce((s, n) => s + n, 0);
  return {
    itemCount: totals.itemCount,
    totalQty: totals.totalQty,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    total: totals.total,
    avgLineTotal: lineTotals.length ? round2(sum / lineTotals.length) : 0,
    maxLineTotal: lineTotals.length ? round2(Math.max(...lineTotals)) : 0,
    minLineTotal: lineTotals.length ? round2(Math.min(...lineTotals)) : 0,
  };
}
