import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "quote-generator",
  name: "Quote / Proposal Generator (PDF/HTML/Text)",
  description:
    "Generate professional PDF quotes and proposals with line items, discount, validity period and terms & conditions. No tax (quotes typically exclude tax until invoiced). Export as PDF (pdf-lib), printable HTML, plain text, or CSV. Includes a quote-to-invoice JSON converter so you can convert an accepted quote into an invoice payload. 18 extra features: line parser, totals, discount, grand total, 7 currency presets, validity presets (7/14/30/60/90 days), validity-days calculator, quote number auto-suggester, quote-to-invoice converter, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "quote", "quotation", "proposal",
    "quote generator", "pdf quote", "estimate",
    "quote to invoice", "price quote", "sales quote",
  ],
  icon: "receipt",
  requiresNetwork: false,
  seo: {
    title: "Quote / Proposal Generator — PDF / HTML / CSV | UnQTools",
    faq: [
      {
        q: "How does the quote generator work?",
        a: "Enter your business details (from) and prospect details (to). Add line items as `description,qty,unit_price` per line. Pick a currency, optional discount, and validity period. The tool computes subtotal, discount and grand total, then lets you download a professional PDF (via pdf-lib), printable HTML, plain-text quote, or CSV of line items. Quotes exclude tax by default — tax is added when the quote is converted to an invoice.",
      },
      {
        q: "Why is there no tax field?",
        a: "Quotes and proposals typically exclude tax — tax is calculated only when the quote is accepted and converted into an invoice. You can convert a quote into an invoice payload (JSON) using the quote-to-invoice converter, then paste the result into the invoice generator which supports tax.",
      },
      {
        q: "How do validity periods work?",
        a: "Set a quote date and click 7 days, 14 days, 30 days, 60 days, or 90 days to auto-fill the valid-until date. The tool also shows the number of days until the quote expires.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Line item parser with validation. (2) Multi-line totals calculator. (3) Discount applier (percentage). (4) Grand total calculator. (5) 7 currency presets ($, €, £, ₹, ¥, A$, C$). (6) PDF generator via pdf-lib. (7) Printable HTML quote (inline CSS). (8) Text quote generator. (9) CSV line-items exporter. (10) Quote number auto-suggester (date + sequence). (11) Validity period calculator (days until expiry). (12) Validity presets (7/14/30/60/90 days). (13) Quote-to-invoice JSON converter. (14) Summary stats (subtotal, discount, total, validity days, item count). (15) History (localStorage, last 20). (16) Shareable URL (encode inputs in hash). (17) Copy quote text to clipboard. (18) Currency-aware formatting.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All quote generation, calculation and PDF creation happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
