/**
 * Quote / Proposal Generator — pure logic.
 *
 * Parse line items, compute totals (no tax — quotes exclude tax until
 * invoiced), render as PDF / HTML / text / CSV, convert quote → invoice.
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

export interface QuoteInput {
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  quoteNumber: string;
  quoteDate: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  lineItemsText: string;
  discountPercent: number;
  currencySymbol: CurrencySymbol;
  termsAndConditions: string;
  notes: string;
}

export interface QuoteTotals {
  lineItems: LineItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  totalQty: number;
}

export interface QuoteHistoryEntry {
  ts: number;
  quoteNumber: string;
  total: number;
  currencySymbol: CurrencySymbol;
  itemCount: number;
}

/** Output of the quote-to-invoice converter. Consumed by invoice-generator. */
export interface InvoicePayload {
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lineItemsText: string;
  taxRate: number;
  discountPercent: number;
  currencySymbol: CurrencySymbol;
  notes: string;
}

// ---- Constants / Presets ----

export const CURRENCY_PRESETS: CurrencySymbol[] = ["$", "€", "£", "₹", "¥", "A$", "C$"];

export const VALIDITY_PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
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

/** Compute all totals from a list of line items (no tax). */
export function computeTotals(items: LineItem[], discountPercent: number): QuoteTotals {
  const subtotal = round2(items.reduce((s, it) => s + it.total, 0));
  const discountAmount = round2(subtotal - applyDiscount(subtotal, discountPercent));
  const total = round2(subtotal - discountAmount);
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  return {
    lineItems: items,
    subtotal,
    discountAmount,
    total,
    itemCount: items.length,
    totalQty,
  };
}

/** Compute grand total directly from raw input. */
export function computeGrandTotal(input: QuoteInput): QuoteTotals {
  const { items } = parseLineItems(input.lineItemsText);
  return computeTotals(items, input.discountPercent);
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

/** Suggest a quote number based on date and optional sequence. */
export function suggestQuoteNumber(dateStr: string, sequence: number = 1): string {
  const year = dateStr ? dateStr.slice(0, 4) : new Date().getFullYear().toString();
  const safeSeq = Math.max(1, Math.floor(sequence));
  const seqStr = String(safeSeq).padStart(3, "0");
  return `QUO-${year}-${seqStr}`;
}

/** Calculate valid-until date given quote date and days. */
export function calculateValidUntil(quoteDate: string, days: number): string {
  if (!quoteDate) return "";
  const d = new Date(quoteDate + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

/** Calculate days until expiry (validUntil - quoteDate). Negative if expired. */
export function validityDays(quoteDate: string, validUntil: string): number | null {
  if (!quoteDate || !validUntil) return null;
  const a = new Date(quoteDate + "T00:00:00Z");
  const b = new Date(validUntil + "T00:00:00Z");
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ---- Quote-to-Invoice converter ----

/**
 * Convert a quote input into an invoice payload that invoice-generator
 * can consume. Default Net 30 due date, taxRate 0 (caller can override).
 */
export function quoteToInvoice(
  input: QuoteInput,
  options: { dueDays?: number; taxRate?: number } = {},
): InvoicePayload {
  const dueDays = options.dueDays ?? 30;
  const taxRate = options.taxRate ?? 0;
  const invoiceNumber = input.quoteNumber.replace(/^QUO-/i, "INV-");
  const dueDate = calculateValidUntil(input.quoteDate, dueDays);
  return {
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    fromAddress: input.fromAddress,
    toName: input.toName,
    toEmail: input.toEmail,
    toAddress: input.toAddress,
    invoiceNumber,
    invoiceDate: input.quoteDate,
    dueDate,
    lineItemsText: input.lineItemsText,
    taxRate,
    discountPercent: input.discountPercent,
    currencySymbol: input.currencySymbol,
    notes: input.notes,
  };
}

// ---- Renderers ----

/** Render quote as plain text. */
export function renderText(input: QuoteInput, totals: QuoteTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const vDays = validityDays(input.quoteDate, input.validUntil);
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("QUOTE / PROPOSAL");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Quote #: ${input.quoteNumber}`);
  L.push(`Date: ${input.quoteDate}`);
  L.push(`Valid Until: ${input.validUntil}${vDays !== null ? ` (${vDays} days)` : ""}`);
  L.push("");
  L.push("FROM:");
  L.push(input.fromName || "-");
  if (input.fromEmail) L.push(input.fromEmail);
  if (input.fromAddress) L.push(input.fromAddress.replace(/\n/g, " | "));
  L.push("");
  L.push("PREPARED FOR:");
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
  L.push("=".repeat(60));
  L.push("TOTAL:".padEnd(43) + cur(totals.total).padStart(17));
  L.push("=".repeat(60));
  if (input.termsAndConditions) {
    L.push("");
    L.push("Terms & Conditions:");
    L.push(input.termsAndConditions);
  }
  if (input.notes) {
    L.push("");
    L.push("Notes:");
    L.push(input.notes);
  }
  return L.join("\n");
}

/** Render quote as CSV of line items. */
export function renderCsv(input: QuoteInput, totals: QuoteTotals): string {
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
  lines.push(`quote_number,${escapeCsv(input.quoteNumber)}`);
  lines.push(`quote_date,${escapeCsv(input.quoteDate)}`);
  lines.push(`valid_until,${escapeCsv(input.validUntil)}`);
  lines.push(`from_name,${escapeCsv(input.fromName)}`);
  lines.push(`from_email,${escapeCsv(input.fromEmail)}`);
  lines.push(`to_name,${escapeCsv(input.toName)}`);
  lines.push(`to_email,${escapeCsv(input.toEmail)}`);
  lines.push(`currency,${escapeCsv(input.currencySymbol)}`);
  lines.push(`subtotal,${totals.subtotal.toFixed(2)}`);
  lines.push(`discount_percent,${input.discountPercent}`);
  lines.push(`discount_amount,${totals.discountAmount.toFixed(2)}`);
  lines.push(`total,${totals.total.toFixed(2)}`);
  return lines.join("\n");
}

/** Render quote as printable HTML with inline CSS. */
export function renderHtml(input: QuoteInput, totals: QuoteTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const vDays = validityDays(input.quoteDate, input.validUntil);
  const rows = totals.lineItems
    .map(
      (it) =>
        `<tr><td>${esc(it.description)}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">${cur(it.unitPrice)}</td><td style="text-align:right">${cur(it.total)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Quote ${esc(input.quoteNumber)}</title>
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
  .terms,.notes{margin-top:24px;padding:12px;background:#fafafa;border-radius:6px;font-size:13px;color:#444}
</style></head><body>
<h1>QUOTE / PROPOSAL</h1>
<div class="muted">#${esc(input.quoteNumber)} · Date ${esc(input.quoteDate)} · Valid until ${esc(input.validUntil)}${vDays !== null ? ` (${vDays} days)` : ""}</div>
<div class="grid">
  <div class="box"><h3>From</h3><div><strong>${esc(input.fromName)}</strong></div><div class="muted">${esc(input.fromEmail)}</div><div class="muted">${esc(input.fromAddress)}</div></div>
  <div class="box"><h3>Prepared For</h3><div><strong>${esc(input.toName)}</strong></div><div class="muted">${esc(input.toEmail)}</div><div class="muted">${esc(input.toAddress)}</div></div>
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Subtotal</span><span>${cur(totals.subtotal)}</span></div>
  ${totals.discountAmount > 0 ? `<div><span>Discount (${input.discountPercent}%)</span><span>-${cur(totals.discountAmount)}</span></div>` : ""}
  <div class="grand"><span>Total</span><span>${cur(totals.total)}</span></div>
</div>
${input.termsAndConditions ? `<div class="terms"><strong>Terms &amp; Conditions:</strong><br/>${esc(input.termsAndConditions)}</div>` : ""}
${input.notes ? `<div class="notes"><strong>Notes:</strong><br/>${esc(input.notes)}</div>` : ""}
</body></html>`;
}

// ---- PDF generation (pdf-lib) ----

/** Generate a PDF quote as bytes. */
export async function generatePdf(
  input: QuoteInput,
  totals: QuoteTotals,
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
  drawText("QUOTE / PROPOSAL", margin, y, 24, fontBold, rgb(0, 0, 0));
  y -= 18;
  drawText(`# ${input.quoteNumber}`, margin, y, 11, font, rgb(0.4, 0.4, 0.4));
  y -= 14;
  drawText(
    `Date: ${input.quoteDate}    Valid Until: ${input.validUntil}`,
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
  drawText("PREPARED FOR", margin + colW + 16, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
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

  for (const it of totals.lineItems) {
    const desc = truncate(it.description, colW * 1.4, font, 10);
    drawText(desc, margin, y, 10, font);
    drawText(String(it.qty), margin + colW * 1.5, y, 10, font);
    drawText(cur(it.unitPrice), margin + colW * 1.7 + 20, y, 10, font);
    drawText(cur(it.total), pageW - margin - 50, y, 10, font);
    y -= 14;
    if (y < margin + 120) break;
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
  y -= 4;
  page.drawLine({ start: { x: tx, y }, end: { x: vx, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;
  totalRow("TOTAL", cur(totals.total), true);

  // Terms
  if (input.termsAndConditions) {
    y -= 20;
    drawText("Terms & Conditions", margin, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
    y -= 14;
    const termLines = multiLine(input.termsAndConditions, pageW - margin * 2, font, 9);
    for (const ln of termLines) {
      drawText(ln, margin, y, 9, font, rgb(0.3, 0.3, 0.3));
      y -= 12;
      if (y < margin) break;
    }
  }
  if (input.notes) {
    y -= 16;
    drawText("Notes", margin, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
    y -= 14;
    const noteLines = multiLine(input.notes, pageW - margin * 2, font, 9);
    for (const ln of noteLines) {
      drawText(ln, margin, y, 9, font, rgb(0.3, 0.3, 0.3));
      y -= 12;
      if (y < margin) break;
    }
  }

  doc.setProducer("UnQTools — Quote Generator");
  doc.setCreator("UnQTools — Quote Generator");
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

const HISTORY_KEY = "unqtools:quote-generator:history";
const HISTORY_MAX = 20;

export function loadHistory(): QuoteHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as QuoteHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: QuoteHistoryEntry): QuoteHistoryEntry[] {
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

export function buildShareUrl(input: Partial<QuoteInput>): string {
  const params = new URLSearchParams();
  if (input.fromName) params.set("fromName", input.fromName);
  if (input.fromEmail) params.set("fromEmail", input.fromEmail);
  if (input.fromAddress) params.set("fromAddress", input.fromAddress);
  if (input.toName) params.set("toName", input.toName);
  if (input.toEmail) params.set("toEmail", input.toEmail);
  if (input.toAddress) params.set("toAddress", input.toAddress);
  if (input.quoteNumber) params.set("quo", input.quoteNumber);
  if (input.quoteDate) params.set("date", input.quoteDate);
  if (input.validUntil) params.set("valid", input.validUntil);
  if (input.lineItemsText) params.set("items", input.lineItemsText);
  if (input.discountPercent !== undefined) params.set("disc", String(input.discountPercent));
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (input.termsAndConditions) params.set("terms", input.termsAndConditions);
  if (input.notes) params.set("notes", input.notes);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<QuoteInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<QuoteInput> = {};
  if (params.get("fromName")) out.fromName = params.get("fromName")!;
  if (params.get("fromEmail")) out.fromEmail = params.get("fromEmail")!;
  if (params.get("fromAddress")) out.fromAddress = params.get("fromAddress")!;
  if (params.get("toName")) out.toName = params.get("toName")!;
  if (params.get("toEmail")) out.toEmail = params.get("toEmail")!;
  if (params.get("toAddress")) out.toAddress = params.get("toAddress")!;
  if (params.get("quo")) out.quoteNumber = params.get("quo")!;
  if (params.get("date")) out.quoteDate = params.get("date")!;
  if (params.get("valid")) out.validUntil = params.get("valid")!;
  if (params.get("items")) out.lineItemsText = params.get("items")!;
  const disc = params.get("disc");
  if (disc !== null) {
    const n = Number(disc);
    if (Number.isFinite(n)) out.discountPercent = n;
  }
  const cur = params.get("cur") as CurrencySymbol | null;
  if (cur && CURRENCY_PRESETS.includes(cur)) out.currencySymbol = cur;
  if (params.get("terms")) out.termsAndConditions = params.get("terms")!;
  if (params.get("notes")) out.notes = params.get("notes")!;
  return out;
}

// ---- Summary stats ----

export interface QuoteSummaryStats {
  itemCount: number;
  totalQty: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  avgLineTotal: number;
  maxLineTotal: number;
  minLineTotal: number;
  validityDays: number | null;
  isExpired: boolean;
}

export function summaryStats(totals: QuoteTotals, quoteDate: string, validUntil: string): QuoteSummaryStats {
  const lineTotals = totals.lineItems.map((i) => i.total);
  const sum = lineTotals.reduce((s, n) => s + n, 0);
  const vDays = validityDays(quoteDate, validUntil);
  const today = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(today + "T00:00:00Z");
  const validDate = validUntil ? new Date(validUntil + "T00:00:00Z") : null;
  const isExpired = validDate !== null && todayDate.getTime() > validDate.getTime();
  return {
    itemCount: totals.itemCount,
    totalQty: totals.totalQty,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    total: totals.total,
    avgLineTotal: lineTotals.length ? round2(sum / lineTotals.length) : 0,
    maxLineTotal: lineTotals.length ? round2(Math.max(...lineTotals)) : 0,
    minLineTotal: lineTotals.length ? round2(Math.min(...lineTotals)) : 0,
    validityDays: vDays,
    isExpired,
  };
}
