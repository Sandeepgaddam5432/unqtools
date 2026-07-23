/**
 * Tip Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tip-calculator",
  name: "Tip Calculator",
  description:
    "Calculate tip + total bill with custom %, split between N people, round-up options, and per-person breakdown. Includes tax handling and 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["tip calculator", "gratuity", "restaurant", "bill split", "service charge", "tipping"],
  icon: "receipt",
  requiresNetwork: false,
  seo: {
    title: "Tip Calculator — Split Bill + Round-Up + Tax | UnQTools",
    faq: [
      { q: "How much should I tip?", a: "Standard tip in the US is 15-20% of pre-tax bill for sit-down service. Tip 18% for average service, 20%+ for excellent. Counter-service: 10% or none. Tip jars: $1-2." },
      { q: "Should I tip on tax?", a: "Generally no — tip on the pre-tax subtotal. This tool lets you choose: calculate tip on subtotal only, or on subtotal+tax." },
      { q: "What extras does this tool have?", a: "Extras: (1) Split between N people, (2) Round-up to nearest dollar, (3) Round per-person to avoid small change, (4) Tax handling with tip-on-tax toggle, (5) Quick preset buttons (10/15/18/20/25%), (6) Currency selector (12 currencies), (7) Service quality rating that suggests tip %, (8) Per-person itemized breakdown CSV, (9) Tip history (last 10 bills, localStorage), (10) Custom tip % with explanation, (11) Compare 3 tip levels side-by-side, (12) Birthday/celebration surcharge calculator." },
    ],
  },
  status: "done",
};
