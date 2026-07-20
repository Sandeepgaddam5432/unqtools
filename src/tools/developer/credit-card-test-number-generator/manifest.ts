/**
 * Credit Card Test Number Generator — Tool Manifest.
 * Tool #282 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "credit-card-test-number-generator",
  name: "Credit Card Test Number Generator",
  description:
    "Generate Luhn-valid, clearly-fake test credit card numbers for sandbox use. Per-brand BIN prefixes (Visa, Mastercard, Amex, Discover, JCB, Diners, UnionPay, Maestro) with matching expiry, CVV, and cardholder name. Bulk export to JSON/CSV/text. Includes official processor sandbox library (Stripe, Adyen, Braintree, PayPal). 100% client-side — sandbox only, never real.",
  category: "developer",
  keywords: [
    "credit card", "test card", "luhn", "sandbox", "stripe test card",
    "fake credit card", "test credit card number", "card generator",
    "luhn valid", "payment testing", "bin", "amex test", "visa test",
  ],
  icon: "credit-card",
  requiresNetwork: false,
  seo: {
    title: "Credit Card Test Number Generator — Luhn-valid Sandbox Cards | UnQTools",
    faq: [
      {
        q: "Are these credit card numbers real?",
        a: "No. Every number this tool generates is Luhn-valid (passes the mod-10 checksum that payment processors use for basic validation) but UNASSIGNED — meaning no bank has ever issued them. They are for sandbox / development / testing only. They CANNOT be used for real payments. Attempting to do so is fraud.",
      },
      {
        q: "Which card brands are supported?",
        a: "Eight brands with their correct IIN/BIN prefixes and lengths: Visa (4, 16 digits), Mastercard (51-55 + 2221-2720 2-series, 16 digits), American Express (34/37, 15 digits, 4-digit CVV), Discover (6011/65/644-649/622126, 16 digits), JCB (3528-3589, 16 digits), Diners Club (300-305/36/38, 14 digits), UnionPay (62, 16 digits), and Maestro (5018/5020/5038/6304/6759/6761-6763, 16 digits).",
      },
      {
        q: "How does the Luhn algorithm work here?",
        a: "We pick a brand prefix, fill the middle with random digits, then compute the correct Luhn check digit so the full number always passes mod-10 validation. The same is true for the included processor sandbox library — every published test number from Stripe, Adyen, Braintree, and PayPal in our library is Luhn-valid (we verify each on load).",
      },
      {
        q: "Can I bulk-generate test cards for automated test suites?",
        a: "Yes. Generate up to 10,000 card bundles per click — each bundle includes number, expiry (MM/YY, always future-dated), CVV (3 digits, or 4 for Amex), and a fake cardholder name. Export as JSON, CSV, or plain text with your preferred number formatting (plain, spaced, dashed, or Amex-style 4-6-5 grouped).",
      },
      {
        q: "What extra features does this tool have versus other card generators?",
        a: "(1) Eight brands with correct BIN prefixes + lengths. (2) Luhn-valid check digit always. (3) Full bundle (number + expiry + CVV + cardholder). (4) Bulk generation up to 10k. (5) Four number formats (plain/spaced/dashed/grouped). (6) Brand auto-detection from a pasted number. (7) Processor sandbox library with official Stripe/Adyen/Braintree/PayPal test cards. (8) Scenario-tagged decline cards (insufficient funds, 3DS required, fraud, etc.). (9) Deterministic seed for reproducible test fixtures. (10) Export JSON/CSV/text. (11) localStorage history (max 20). (12) Shareable URL with seed + brands + format encoded. (13) Prominent honesty banner.",
      },
    ],
  },
  status: "done",
};
