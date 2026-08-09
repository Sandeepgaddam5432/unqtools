/**
 * Currency Converter — Tool Manifest
 * Convert between major world currencies, fully offline with a built-in
 * reference-rate table. Honest about rates being static (no live feed).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "currency-converter",
  name: "Currency Converter",
  description:
    "Convert between 30+ major world currencies (USD, EUR, GBP, INR, JPY, CNY, AUD, CAD, and more). Includes a built-in reference-rate table, live-like quick conversion, amount scaling, and bulk table view. Runs 100% offline with a clear note that rates are reference (not live) values. 100% private.",
  category: "calculators",
  keywords: [
    "currency converter",
    "exchange rate",
    "convert money",
    "usd to eur",
    "usd to inr",
    "currency calculator",
    "foreign exchange",
    "money converter",
  ],
  icon: "DollarSign",
  requiresNetwork: false,
  seo: {
    title: "Currency Converter — 30+ World Currencies, Offline | UnQTools",
    faq: [
      {
        q: "Are these live exchange rates?",
        a: "No. This tool is fully offline, so it uses a built-in reference-rate table. Rates are approximate and for reference/conversion math only — always confirm live rates with your bank or a live source for actual transactions.",
      },
      {
        q: "Why offline?",
        a: "UnQTools is a privacy-first, offline-capable PWA. Nothing is uploaded. This converter works even with no internet, at the cost of not having a live feed.",
      },
      {
        q: "What currencies are supported?",
        a: "30+ major world currencies: USD, EUR, GBP, JPY, CNY, INR, AUD, CAD, CHF, SGD, HKD, NZD, SEK, NOK, DKK, PLN, CZK, HUF, RON, BGN, TRY, RUB, BRL, MXN, ARS, ZAR, AED, SAR, KRW, IDR, MYR, THB, PHP, VND, ILS.",
      },
    ],
  },
  status: "done",
};
