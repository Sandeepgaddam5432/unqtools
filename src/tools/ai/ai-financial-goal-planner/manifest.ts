import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-financial-goal-planner",
  name: "AI Financial Goal Planner",
  description:
    "Build a prioritized savings and debt-payoff roadmap from your goals (emergency fund, debt payoff, house, retirement, vacation, education), income, timeline, and current savings. Compound-growth projections, snowball/avalanche debt schedules, milestone tracking, scenario compare, and what-if sliders. Pure-JS template engine with transparent math — optional BYO-key LLM. 100% client-side, no bank linking, no sign-up, no upload.",
  category: "ai",
  keywords: [
    "financial goal planner", "savings roadmap", "debt payoff planner",
    "retirement projection", "compound interest calculator",
    "snowball avalanche", "no bank link planner", "private financial plan",
    "emergency fund calculator", "no login financial planner",
  ],
  icon: "piggy-bank",
  requiresNetwork: false,
  seo: {
    title: "AI Financial Goal Planner — Private Roadmap, No Bank Link | UnQTools",
    faq: [
      {
        q: "How does the financial goal planner work?",
        a: "Enter your goals (emergency fund, debt payoff, house down payment, retirement, vacation, or education), the target amount, current savings, timeline in months, and an assumed annual return rate. The tool computes the exact monthly contribution required using the future-value-of-series formula, projects a month-by-month compound-growth curve, generates milestone checkpoints (25/50/75/100%), and — when you add debts — produces a snowball or avalanche payoff schedule. Multiple goals are prioritized by your chosen order and combined into a single roadmap with total monthly need.",
      },
      {
        q: "What is the difference between snowball and avalanche debt payoff?",
        a: "Snowball pays the smallest-balance debt first for quick psychological wins, then rolls the freed payment into the next smallest. Avalanche pays the highest-interest debt first, which is mathematically cheaper but slower to see a debt fully retired. The tool computes both schedules side-by-side so you can compare total interest paid and payoff months.",
      },
      {
        q: "Are the projections financial advice?",
        a: "No. This is an educational planning tool, not financial, investment, or tax advice. Projections use assumptions (return rate, inflation, no withdrawals) that may not hold. Past returns do not guarantee future results. Consult a licensed financial professional before making decisions. Nothing is uploaded — all math runs in your browser and saved plans stay in your device's localStorage.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six goal-type templates (emergency fund, debt payoff, house, retirement, vacation, education) plus custom. (2) Compound-growth projection with monthly resolution. (3) Snowball + avalanche debt schedules. (4) Milestone tracking at 25/50/75/100%. (5) Multi-goal prioritized roadmap. (6) Scenario A/B compare. (7) What-if sliders for rate and contribution. (8) Currency selection (USD, EUR, GBP, INR, JPY, CAD, AUD). (9) Inflation-adjusted projections. (10) Honest warnings for unrealistic goals. (11) Markdown + JSON + CSV export. (12) History (localStorage, last 20). (13) Shareable URL. (14) Goal presets. (15) Optional BYO-key LLM explanation. (16) Transparent formulas shown inline.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All goal math, compound interest, debt schedules, and projections run locally in your browser. Your income, debts, and savings never leave this device — there is no bank linking and no account required. Saved plans live in localStorage on this device only. The only network call is if you paste your own LLM API key and click 'Explain with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
