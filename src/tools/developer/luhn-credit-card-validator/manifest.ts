/**
 * Luhn / Credit Card Validator — Tool Manifest.
 * Tool #283 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "luhn-credit-card-validator",
  name: "Luhn / Credit Card Validator",
  description:
    "Validate identification numbers with the Luhn (mod-10) checksum — credit cards, IMEI, gift cards. Brand detection from BIN, step-by-step doubling visualization, corrected check-digit suggestion, transposition/typo hint, masked display, and bulk list mode with CSV export. 100% client-side — numbers never leave the browser.",
  category: "developer",
  keywords: [
    "luhn", "luhn validator", "credit card validator",
    "mod 10", "check digit", "imei validator",
    "gift card validator", "bin detection", "card brand",
    "luhn algorithm", "checksum",
  ],
  icon: "credit-card",
  requiresNetwork: false,
  seo: {
    title: "Luhn / Credit Card Validator — Mod-10 Checksum + Brand Detection | UnQTools",
    faq: [
      {
        q: "What is the Luhn algorithm and what does this validator do?",
        a: "The Luhn (mod-10) algorithm is a simple checksum formula used to validate identification numbers like credit cards, IMEI codes, gift cards, and Canadian SINs. This tool computes the checksum locally in your browser, tells you pass/fail, shows the corrected check digit when validation fails, displays the step-by-step doubling visualization, and detects the card brand from the BIN/IIN prefix.",
      },
      {
        q: "Which card brands can this tool detect?",
        a: "Visa, Mastercard (including the 2-series 2221-2720 range), American Express, Discover, JCB, Diners Club, UnionPay, and Maestro. Each brand has known BIN/IIN prefixes and allowed lengths — the matcher prefers the longest prefix so 622126-622925 correctly resolves to Discover rather than UnionPay, and 3528-3589 resolves to JCB.",
      },
      {
        q: "Can I validate IMEI, gift card, or other non-card numbers?",
        a: "Yes. Choose a mode: Credit Card (12-19 digits), IMEI (14 digits + check digit = 15), Gift Card (configurable 12-19 digits), or Any (no length constraint). The Luhn algorithm itself is mode-agnostic; modes only constrain accepted length and turn off brand detection for non-card inputs.",
      },
      {
        q: "Does this tool store or transmit my card numbers?",
        a: "Never. Every computation runs 100% client-side in JavaScript. There is no server endpoint, no analytics on the input field, and no console logging of card data. The history feature (last 20 operations) stores only a count and timestamp in localStorage on this device — never the card numbers themselves.",
      },
      {
        q: "What extra features does this tool have versus other Luhn validators?",
        a: "(1) Single-number live validation with pass/fail. (2) Eight-brand BIN detection. (3) Step-by-step doubling visualization. (4) Corrected check-digit suggestion on failure. (5) Adjacent-transposition hint (catches the most common typing error). (6) Four display formats (plain, spaced, dashed, grouped 4-6-5 for Amex). (7) Masked display toggle. (8) Four input modes (credit, IMEI, gift, any). (9) Bulk paste with per-line valid/invalid table. (10) CSV export of bulk results. (11) Wikipedia + Stripe canonical test vectors. (12) localStorage history (max 20, no numbers stored). (13) Shareable URL with mode + format encoded in fragment.",
      },
    ],
  },
  status: "done",
};
