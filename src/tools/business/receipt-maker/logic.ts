/**
 * Receipt Maker — pure logic.
 *
 * Parse line items (description,amount), compute totals, verify payment,
 * validate per-method reference numbers, render PDF / HTML / text / CSV.
 * Pure functions only — DOM access only via pdf-lib inside async generator.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ---- Types ----

export type PaymentMethod =
  | "cash"
  | "check"
  | "credit-card"
  | "debit-card"
  | "bank-transfer"
  | "paypal"
  | "stripe"
  | "other";

export type CurrencySymbol = "$" | "€" | "£" | "₹" | "¥" | "A$" | "C$";

export interface ReceiptItem {
  description: string;
  amount: number;
}

export interface ReceiptInput {
  receiptNumber: string;
  receiptDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  payerName: string;
  payerEmail: string;
  payeeName: string;
  payeeAddress: string;
  itemsText: string;
  paymentAmount: number;
  currencySymbol: CurrencySymbol;
  referenceNumber: string;
  notes: string;
}

export type PaymentStatus = "matched" | "short" | "over" | "unpaid";

export interface PaymentVerification {
  status: PaymentStatus;
  total: number;
  payment: number;
  difference: number;
  warning?: string;
}

export interface ReceiptTotals {
  items: ReceiptItem[];
  total: number;
  itemCount: number;
  payment: PaymentVerification;
  referenceValid: boolean;
  referenceError?: string;
}

export interface ReceiptHistoryEntry {
  ts: number;
  receiptNumber: string;
  total: number;
  currencySymbol: CurrencySymbol;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  itemCount: number;
}

// ---- Constants / Presets ----

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "check",
  "credit-card",
  "debit-card",
  "bank-transfer",
  "paypal",
  "stripe",
  "other",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  "cash": "Cash",
  "check": "Check",
  "credit-card": "Credit Card",
  "debit-card": "Debit Card",
  "bank-transfer": "Bank Transfer",
  "paypal": "PayPal",
  "stripe": "Stripe",
  "other": "Other",
};

export const CURRENCY_PRESETS: CurrencySymbol[] = ["$", "€", "£", "₹", "¥", "A$", "C$"];

// ---- Parsing ----

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

/** Parse `description,amount` lines. Returns parsed items + errors. */
export function parseItems(text: string): { items: ReceiptItem[]; errors: string[] } {
  const items: ReceiptItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs description,amount`);
      return;
    }
    const [description, amountStr] = parts;
    const amount = Number(amountStr);
    if (!description) {
      errors.push(`Line ${idx + 1}: description is required`);
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push(`Line ${idx + 1}: invalid amount "${amountStr}"`);
      return;
    }
    items.push({ description, amount: round2(amount) });
  });
  return { items, errors };
}

// ---- Calculations ----

/** Calculate total from items. */
export function calculateTotal(items: ReceiptItem[]): number {
  return round2(items.reduce((s, it) => s + it.amount, 0));
}

/** Verify that payment matches total. */
export function verifyPayment(payment: number, total: number): PaymentVerification {
  const p = Number.isFinite(payment) ? payment : 0;
  const diff = round2(p - total);
  if (p <= 0 && total > 0) {
    return {
      status: "unpaid",
      total: round2(total),
      payment: 0,
      difference: round2(-total),
      warning: "No payment recorded — receipt marked unpaid.",
    };
  }
  if (Math.abs(diff) < 0.01) {
    return { status: "matched", total: round2(total), payment: round2(p), difference: 0 };
  }
  if (diff < 0) {
    return {
      status: "short",
      total: round2(total),
      payment: round2(p),
      difference: diff,
      warning: `Payment is short by ${Math.abs(diff).toFixed(2)}.`,
    };
  }
  return {
    status: "over",
    total: round2(total),
    payment: round2(p),
    difference: diff,
    warning: `Payment is over by ${diff.toFixed(2)}.`,
  };
}

/** Validate a reference number format based on payment method. */
export function validateReference(method: PaymentMethod, ref: string): { valid: boolean; error?: string } {
  const trimmed = (ref || "").trim();
  if (method === "cash") {
    // Cash rarely needs a reference; any value is allowed.
    return { valid: true };
  }
  if (method === "check") {
    if (!trimmed) return { valid: false, error: "Check number is required for check payments." };
    if (!/^\d{3,6}$/.test(trimmed)) {
      return { valid: false, error: "Check number must be 3-6 digits." };
    }
    return { valid: true };
  }
  if (method === "credit-card" || method === "debit-card") {
    if (!trimmed) return { valid: false, error: "Last 4 digits required for card payments." };
    if (!/^\d{4}$/.test(trimmed)) {
      return { valid: false, error: "Card reference must be exactly 4 digits (last 4)." };
    }
    return { valid: true };
  }
  if (method === "bank-transfer") {
    if (!trimmed) return { valid: false, error: "Bank transaction ID is required for bank transfers." };
    if (trimmed.length < 4) {
      return { valid: false, error: "Bank transaction ID looks too short (min 4 chars)." };
    }
    return { valid: true };
  }
  if (method === "paypal") {
    if (!trimmed) return { valid: false, error: "PayPal transaction ID is required." };
    if (!/^[A-Z0-9]{8,20}$/i.test(trimmed)) {
      return { valid: false, error: "PayPal transaction ID should be 8-20 alphanumeric chars." };
    }
    return { valid: true };
  }
  if (method === "stripe") {
    if (!trimmed) return { valid: false, error: "Stripe charge/payment-intent ID is required." };
    if (!/^(ch|pi|py|in)_[A-Za-z0-9]{10,}$/i.test(trimmed)) {
      return { valid: false, error: "Stripe ID must start with ch_, pi_, py_ or in_ followed by 10+ chars." };
    }
    return { valid: true };
  }
  // other — accept anything (including empty)
  return { valid: true };
}

/** Compute all totals from raw input. */
export function computeTotals(input: ReceiptInput): ReceiptTotals {
  const { items } = parseItems(input.itemsText);
  const total = calculateTotal(items);
  const payment = verifyPayment(input.paymentAmount, total);
  const refCheck = validateReference(input.paymentMethod, input.referenceNumber);
  return {
    items,
    total,
    itemCount: items.length,
    payment,
    referenceValid: refCheck.valid,
    referenceError: refCheck.error,
  };
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

/** Suggest a receipt number based on date and optional sequence. */
export function suggestReceiptNumber(dateStr: string, sequence: number = 1): string {
  const year = dateStr ? dateStr.slice(0, 4) : new Date().getFullYear().toString();
  const safeSeq = Math.max(1, Math.floor(sequence));
  const seqStr = String(safeSeq).padStart(3, "0");
  return `RCT-${year}-${seqStr}`;
}

// ---- Renderers ----

/** Render receipt as plain text. */
export function renderText(input: ReceiptInput, totals: ReceiptTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("PAYMENT RECEIPT");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Receipt #: ${input.receiptNumber}`);
  L.push(`Date: ${input.receiptDate}`);
  L.push(`Payment Method: ${PAYMENT_METHOD_LABELS[input.paymentMethod]}`);
  if (input.referenceNumber) L.push(`Reference #: ${input.referenceNumber}`);
  L.push("");
  L.push("RECEIVED FROM (Payer):");
  L.push(input.payerName || "-");
  if (input.payerEmail) L.push(input.payerEmail);
  L.push("");
  L.push("PAID TO (Payee):");
  L.push(input.payeeName || "-");
  if (input.payeeAddress) L.push(input.payeeAddress.replace(/\n/g, " | "));
  L.push("");
  L.push("-".repeat(60));
  L.push("Description".padEnd(46) + "Amount".padStart(14));
  L.push("-".repeat(60));
  for (const it of totals.items) {
    const desc = it.description.length > 44 ? it.description.slice(0, 41) + "..." : it.description;
    L.push(desc.padEnd(46) + cur(it.amount).padStart(14));
  }
  L.push("-".repeat(60));
  L.push("TOTAL:".padEnd(46) + cur(totals.total).padStart(14));
  L.push("PAYMENT:".padEnd(46) + cur(totals.payment.payment).padStart(14));
  if (totals.payment.difference !== 0) {
    const sign = totals.payment.difference > 0 ? "+" : "";
    L.push(`BALANCE (${sign}${cur(totals.payment.difference)}):`.padEnd(46) + cur(totals.payment.difference).padStart(14));
  }
  L.push("=".repeat(60));
  L.push(`Status: ${totals.payment.status.toUpperCase()}`);
  if (totals.payment.warning) L.push(`Note: ${totals.payment.warning}`);
  if (input.notes) {
    L.push("");
    L.push("Notes:");
    L.push(input.notes);
  }
  return L.join("\n");
}

/** Render receipt items + meta as CSV. */
export function renderCsv(input: ReceiptInput, totals: ReceiptTotals): string {
  const lines = ["description,amount"];
  for (const it of totals.items) {
    lines.push([
      escapeCsv(it.description),
      it.amount.toFixed(2),
    ].join(","));
  }
  lines.push("");
  lines.push(`receipt_number,${escapeCsv(input.receiptNumber)}`);
  lines.push(`receipt_date,${escapeCsv(input.receiptDate)}`);
  lines.push(`payment_method,${input.paymentMethod}`);
  lines.push(`reference_number,${escapeCsv(input.referenceNumber)}`);
  lines.push(`payer_name,${escapeCsv(input.payerName)}`);
  lines.push(`payer_email,${escapeCsv(input.payerEmail)}`);
  lines.push(`payee_name,${escapeCsv(input.payeeName)}`);
  lines.push(`payee_address,${escapeCsv(input.payeeAddress)}`);
  lines.push(`currency,${escapeCsv(input.currencySymbol)}`);
  lines.push(`total,${totals.total.toFixed(2)}`);
  lines.push(`payment_amount,${totals.payment.payment.toFixed(2)}`);
  lines.push(`difference,${totals.payment.difference.toFixed(2)}`);
  lines.push(`status,${totals.payment.status}`);
  lines.push(`item_count,${totals.itemCount}`);
  return lines.join("\n");
}

/** Render receipt as printable HTML with inline CSS. */
export function renderHtml(input: ReceiptInput, totals: ReceiptTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const rows = totals.items
    .map(
      (it) =>
        `<tr><td>${esc(it.description)}</td><td style="text-align:right">${cur(it.amount)}</td></tr>`,
    )
    .join("");
  const statusColor = totals.payment.status === "matched" ? "#16a34a" : totals.payment.status === "unpaid" ? "#dc2626" : "#d97706";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(input.receiptNumber)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:760px}
  h1{font-size:28px;margin:0 0 4px;color:#111}
  .muted{color:#666;font-size:13px}
  .grid{display:flex;justify-content:space-between;margin:24px 0}
  .box{flex:1;padding:12px;border:1px solid #eee;border-radius:6px;background:#fafafa}
  .box + .box{margin-left:16px}
  .box h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#888}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{padding:8px 12px;border-bottom:1px solid #eee;font-size:14px}
  th{background:#f5f5f5;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
  .totals{margin-left:auto;width:300px;font-size:14px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid #111;margin-top:8px;padding-top:8px;font-weight:bold;font-size:18px}
  .status{display:inline-block;padding:3px 10px;border-radius:9999px;color:#fff;font-size:12px;background:${statusColor}}
  .notes{margin-top:24px;padding:12px;background:#fafafa;border-radius:6px;font-size:13px;color:#444}
</style></head><body>
<h1>RECEIPT</h1>
<div class="muted">#${esc(input.receiptNumber)} · ${esc(input.receiptDate)} · ${esc(PAYMENT_METHOD_LABELS[input.paymentMethod])}${input.referenceNumber ? ` · Ref ${esc(input.referenceNumber)}` : ""}</div>
<div class="grid">
  <div class="box"><h3>Received From</h3><div><strong>${esc(input.payerName)}</strong></div><div class="muted">${esc(input.payerEmail)}</div></div>
  <div class="box"><h3>Paid To</h3><div><strong>${esc(input.payeeName)}</strong></div><div class="muted">${esc(input.payeeAddress)}</div></div>
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Total</span><span>${cur(totals.total)}</span></div>
  <div><span>Payment</span><span>${cur(totals.payment.payment)}</span></div>
  ${totals.payment.difference !== 0 ? `<div><span>Difference</span><span>${cur(totals.payment.difference)}</span></div>` : ""}
  <div class="grand"><span>Status</span><span class="status">${esc(totals.payment.status.toUpperCase())}</span></div>
</div>
${totals.payment.warning ? `<div class="notes"><strong>Note:</strong> ${esc(totals.payment.warning)}</div>` : ""}
${input.notes ? `<div class="notes"><strong>Notes:</strong><br/>${esc(input.notes)}</div>` : ""}
</body></html>`;
}

// ---- PDF generation (pdf-lib) ----

/** Generate a PDF receipt as bytes. */
export async function generatePdf(
  input: ReceiptInput,
  totals: ReceiptTotals,
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
  drawText("PAYMENT RECEIPT", margin, y, 24, fontBold, rgb(0, 0, 0));
  y -= 18;
  drawText(`# ${input.receiptNumber}`, margin, y, 11, font, rgb(0.4, 0.4, 0.4));
  y -= 14;
  drawText(
    `Date: ${input.receiptDate}    Method: ${PAYMENT_METHOD_LABELS[input.paymentMethod]}${input.referenceNumber ? `    Ref: ${input.referenceNumber}` : ""}`,
    margin,
    y,
    10,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  y -= 24;

  // From / To
  const colW = (pageW - margin * 2) / 2 - 8;
  drawText("RECEIVED FROM", margin, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  drawText("PAID TO", margin + colW + 16, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  y -= 14;
  const fromLines = [
    input.payerName,
    input.payerEmail,
  ].filter(Boolean);
  const toLines = [
    input.payeeName,
    ...multiLine(input.payeeAddress, colW, font, 10),
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
  drawText("Amount", pageW - margin - 80, y, 9, fontBold, rgb(0.5, 0.5, 0.5));
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageW - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 14;

  // Items
  for (const it of totals.items) {
    const desc = truncate(it.description, pageW - margin * 2 - 100, font, 10);
    drawText(desc, margin, y, 10, font);
    drawText(cur(it.amount), pageW - margin - 80, y, 10, font);
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
  const totalRow = (label: string, val: string, bold = false, color = rgb(0.3, 0.3, 0.3)) => {
    drawText(label, tx, y, 10, bold ? fontBold : font, bold ? rgb(0, 0, 0) : color);
    drawText(val, vx - 80, y, 10, bold ? fontBold : font, bold ? rgb(0, 0, 0) : color);
    y -= 14;
  };
  totalRow("Total", cur(totals.total));
  totalRow("Payment", cur(totals.payment.payment));
  if (totals.payment.difference !== 0) {
    totalRow("Difference", cur(totals.payment.difference));
  }
  y -= 4;
  page.drawLine({ start: { x: tx, y }, end: { x: vx, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;
  const statusColor =
    totals.payment.status === "matched"
      ? rgb(0.1, 0.6, 0.2)
      : totals.payment.status === "unpaid"
        ? rgb(0.8, 0.1, 0.1)
        : rgb(0.85, 0.45, 0.05);
  totalRow("STATUS", totals.payment.status.toUpperCase(), true, statusColor);

  // Warning note
  if (totals.payment.warning) {
    y -= 16;
    const warnLines = multiLine(totals.payment.warning, pageW - margin * 2, font, 9);
    for (const ln of warnLines) {
      drawText(ln, margin, y, 9, font, rgb(0.6, 0.3, 0.05));
      y -= 12;
      if (y < margin) break;
    }
  }

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

  doc.setProducer("UnQTools — Receipt Maker");
  doc.setCreator("UnQTools — Receipt Maker");
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

const HISTORY_KEY = "unqtools:receipt-maker:history";
const HISTORY_MAX = 20;

export function loadHistory(): ReceiptHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ReceiptHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: ReceiptHistoryEntry): ReceiptHistoryEntry[] {
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

export function buildShareUrl(input: Partial<ReceiptInput>): string {
  const params = new URLSearchParams();
  if (input.receiptNumber) params.set("rct", input.receiptNumber);
  if (input.receiptDate) params.set("date", input.receiptDate);
  if (input.paymentMethod) params.set("method", input.paymentMethod);
  if (input.payerName) params.set("payer", input.payerName);
  if (input.payerEmail) params.set("pemail", input.payerEmail);
  if (input.payeeName) params.set("payee", input.payeeName);
  if (input.payeeAddress) params.set("paddr", input.payeeAddress);
  if (input.itemsText) params.set("items", input.itemsText);
  if (input.paymentAmount !== undefined) params.set("amt", String(input.paymentAmount));
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (input.referenceNumber) params.set("ref", input.referenceNumber);
  if (input.notes) params.set("notes", input.notes);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ReceiptInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ReceiptInput> = {};
  if (params.get("rct")) out.receiptNumber = params.get("rct")!;
  if (params.get("date")) out.receiptDate = params.get("date")!;
  const method = params.get("method") as PaymentMethod | null;
  if (method && PAYMENT_METHODS.includes(method)) out.paymentMethod = method;
  if (params.get("payer")) out.payerName = params.get("payer")!;
  if (params.get("pemail")) out.payerEmail = params.get("pemail")!;
  if (params.get("payee")) out.payeeName = params.get("payee")!;
  if (params.get("paddr")) out.payeeAddress = params.get("paddr")!;
  if (params.get("items")) out.itemsText = params.get("items")!;
  const amt = params.get("amt");
  if (amt !== null) {
    const n = Number(amt);
    if (Number.isFinite(n)) out.paymentAmount = n;
  }
  const cur = params.get("cur") as CurrencySymbol | null;
  if (cur && CURRENCY_PRESETS.includes(cur)) out.currencySymbol = cur;
  if (params.get("ref")) out.referenceNumber = params.get("ref")!;
  if (params.get("notes")) out.notes = params.get("notes")!;
  return out;
}

// ---- Summary stats ----

export interface ReceiptSummaryStats {
  itemCount: number;
  total: number;
  payment: number;
  difference: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  avgItemAmount: number;
  maxItemAmount: number;
  minItemAmount: number;
}

export function summaryStats(totals: ReceiptTotals, method: PaymentMethod): ReceiptSummaryStats {
  const amounts = totals.items.map((i) => i.amount);
  const sum = amounts.reduce((s, n) => s + n, 0);
  return {
    itemCount: totals.itemCount,
    total: totals.total,
    payment: totals.payment.payment,
    difference: totals.payment.difference,
    status: totals.payment.status,
    paymentMethod: method,
    avgItemAmount: amounts.length ? round2(sum / amounts.length) : 0,
    maxItemAmount: amounts.length ? round2(Math.max(...amounts)) : 0,
    minItemAmount: amounts.length ? round2(Math.min(...amounts)) : 0,
  };
}
