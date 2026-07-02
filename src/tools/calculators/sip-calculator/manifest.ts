/**
 * SIP Calculator — Tool Manifest
 *
 * No dedicated blueprint in unqtools-docs; built using the standard SIP
 * future-value formula: FV = P × [((1+r)^n − 1) / r] × (1+r)
 *   P = monthly investment, r = monthly rate, n = total months
 * Also supports annual step-up (P_k = P_{k-1} × (1 + stepUpPct)).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sip-calculator",
  name: "SIP Calculator",
  description:
    "Calculate the future value of a Systematic Investment Plan (SIP) with optional annual step-up. Shows total invested, returns, and projected corpus. 100% private.",
  category: "calculators",
  keywords: [
    "sip calculator",
    "mutual fund",
    "investment calculator",
    "future value",
    "step-up sip",
    "compound interest",
    "monthly investment",
  ],
  icon: "trending-up",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "SIP Calculator — Mutual Fund SIP Returns & Step-Up | UnQTools",
    faq: [
      {
        q: "What is a SIP?",
        a: "A Systematic Investment Plan is a way to invest a fixed amount in a mutual fund every month. Returns compound over time, growing your corpus significantly.",
      },
      {
        q: "How is SIP future value calculated?",
        a: "The standard formula is FV = P × [((1+r)^n − 1) / r] × (1+r), where P is the monthly investment, r is the monthly expected return rate, and n is the total months. Each installment is compounded for its remaining tenure.",
      },
      {
        q: "What is a step-up SIP?",
        a: "A step-up SIP increases your monthly contribution by a fixed percentage each year (typically 5–10%) — usually matching your salary hike. It accelerates corpus growth meaningfully over the long term.",
      },
      {
        q: "Are these returns guaranteed?",
        a: "No. The expected return rate is an assumption. Real mutual fund returns vary with the market. This tool gives you a projected corpus based on the rate you enter.",
      },
    ],
  },
  status: "done",
};
