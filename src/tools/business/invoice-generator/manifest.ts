import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "invoice-generator",
  name: "Invoice Generator (PDF/HTML/Text)",
  description:
    "Generate professional PDF invoices with line items, discount, tax, and totals. Enter from/to details, line items, tax rate, discount and currency — export as PDF (pdf-lib), printable HTML, plain text, or CSV. 18 extra features: line parser, totals calc, discount applier, tax calculator, grand total, 7 currency presets, tax presets, Net 15/30/60 due-date presets, invoice number auto-suggest, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "invoice", "invoice generator", "pdf invoice",
    "billing", "freelance invoice", "tax invoice",
    "quote to invoice", "receipt", "estimate",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Invoice Generator — PDF / HTML / Text / CSV | UnQTools",
    faq: [
      {
        q: "How does the invoice generator work?",
        a: "Enter your business details (from) and your customer details (to). Add line items as `description,qty,unit_price` per line. Pick a currency, enter tax rate and optional discount percent. The tool computes subtotal, discount, tax and grand total, then lets you download a professional PDF (via pdf-lib), printable HTML, plain-text invoice, or CSV of line items.",
      },
      {
        q: "What format are line items in?",
        a: "One per line, comma-separated: `description,qty,unit_price`. Example: `Web design,10,75.00`. The parser strips quotes, validates numeric fields, and skips blank lines. Negative or NaN values are rejected with an error message.",
      },
      {
        q: "Can I set due dates automatically?",
        a: "Yes. After entering the invoice date, click Net 15, Net 30, or Net 60 to auto-fill the due date. You can also override the due date manually.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Line item parser with validation. (2) Multi-line totals calculator. (3) Discount applier (percentage). (4) Tax calculator (percentage). (5) Grand total calculator. (6) 7 currency presets ($, €, £, ₹, ¥, A$, C$). (7) PDF generator via pdf-lib. (8) Printable HTML invoice (inline CSS). (9) Text invoice generator. (10) CSV line-items exporter. (11) Invoice number auto-suggester (date + sequence). (12) Net 15/30/60 due-date presets. (13) Tax rate presets (0/5/8.5/10/18/20/25%). (14) Summary stats (subtotal, tax, total, item count). (15) History (localStorage, last 20). (16) Shareable URL (encode inputs in hash). (17) Copy invoice text to clipboard. (18) Currency-aware formatting.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All invoice generation, calculation and PDF creation happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
