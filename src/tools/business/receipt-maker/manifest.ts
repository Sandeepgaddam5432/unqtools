import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "receipt-maker",
  name: "Receipt Maker (PDF/HTML/Text)",
  description:
    "Generate professional PDF payment receipts with itemized breakdown. Enter receipt number, date, payment method (cash/check/card/bank/PayPal/Stripe), payer + payee details, line items (`description,amount`), payment amount, currency and optional reference number. Verifies payment vs total, validates references per method, exports as PDF (pdf-lib), printable HTML, plain text, or CSV. 16 extra features: item parser, total calculator, payment verification, 8 payment method presets, 7 currency presets, PDF generator, HTML printable receipt, text receipt, receipt number auto-suggest, reference validator, CSV exporter, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "receipt", "receipt maker", "payment receipt",
    "pdf receipt", "cash receipt", "invoice receipt",
    "payment confirmation", "money receipt",
  ],
  icon: "receipt",
  requiresNetwork: false,
  seo: {
    title: "Receipt Maker — PDF / HTML / Text / CSV | UnQTools",
    faq: [
      {
        q: "How does the receipt maker work?",
        a: "Enter the receipt number, date, payment method (cash, check, credit-card, debit-card, bank-transfer, PayPal, Stripe or other), payer + payee details, and line items as `description,amount` per line. Enter the payment amount and the tool verifies whether it matches the total of the items. Download a professional PDF (via pdf-lib), printable HTML, plain-text receipt, or CSV of the items.",
      },
      {
        q: "What payment methods are supported?",
        a: "Eight: cash, check, credit-card, debit-card, bank-transfer, paypal, stripe and other. Each method has its own reference-number validation — e.g. credit-card/debit-card expect 4 digits, Stripe expects IDs starting with `ch_` or `pi_`, PayPal expects an alphanumeric transaction ID, check expects 3-6 digit check number.",
      },
      {
        q: "How does payment verification work?",
        a: "After parsing line items, the tool sums the item amounts to get the total. It then compares your entered payment amount to the total and flags one of four statuses: matched (within $0.01), short (underpaid), over (overpaid), or unpaid (zero/blank). A warning is shown for any mismatch.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Item parser with validation. (2) Total calculator. (3) Payment verification (match vs total). (4) 8 payment method presets. (5) 7 currency presets ($, €, £, ₹, ¥, A$, C$). (6) PDF generator via pdf-lib. (7) HTML printable receipt. (8) Text receipt generator. (9) Receipt number auto-suggester (`RCT-YYYY-NNN`). (10) Reference number validator (per payment method). (11) Render as text report. (12) Render as CSV (items). (13) Copy + Download PDF/HTML/CSV + Share link + Clear. (14) History (localStorage, last 20). (15) Shareable URL (encode inputs in hash). (16) Summary stats (item count, total, payment method).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All receipt generation, calculation, validation and PDF creation happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
