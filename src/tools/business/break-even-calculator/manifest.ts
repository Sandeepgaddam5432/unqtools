import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "break-even-calculator",
  name: "Break-Even Calculator (Units, Revenue, Margin of Safety)",
  description:
    "Calculate break-even point — units to sell, revenue needed, margin of safety, profit at expected sales, target profit units, contribution margin per unit and ratio, plus price sensitivity analysis. Enter fixed costs, variable cost per unit, price per unit, expected sales, and optional target profit. Export as text report or CSV. 16 extra features: contribution margin per unit, contribution margin ratio, break-even units, break-even revenue, target profit units, margin of safety units, margin of safety %, profit at expected sales, text report renderer, CSV export (metric, value, formula), copy + download .txt + CSV, history (localStorage, last 20), shareable URL (encode inputs in hash), summary stats, sensitivity analysis (±10% / ±20% price), input validation. 100% client-side.",
  category: "business",
  keywords: [
    "break even", "break-even", "break even point",
    "contribution margin", "margin of safety",
    "fixed costs", "variable costs", "target profit",
    "sensitivity analysis", "pricing calculator",
  ],
  icon: "scale",
  requiresNetwork: false,
  seo: {
    title: "Break-Even Calculator — Units, Revenue, Margin of Safety | UnQTools",
    faq: [
      {
        q: "How does the break-even calculator work?",
        a: "Enter your total fixed costs, variable cost per unit, and price per unit. The tool computes contribution margin per unit (price − variable cost), contribution margin ratio (contribution margin ÷ price), break-even units (fixed costs ÷ contribution margin per unit), and break-even revenue. Optionally add expected sales units to see the margin of safety, and a target profit to see how many units you must sell to reach it.",
      },
      {
        q: "What is the margin of safety?",
        a: "Margin of safety is the cushion between your expected sales and the break-even point. In units it is expected sales − break-even units. As a percentage it is (margin of safety ÷ expected sales) × 100. A higher margin of safety means the business can absorb more sales shortfall before losing money.",
      },
      {
        q: "What is the contribution margin ratio?",
        a: "Contribution margin ratio = contribution margin per unit ÷ price per unit. It tells you what fraction of every sales dollar goes toward covering fixed costs (and then profit). For example, a 40% ratio means $0.40 of every $1.00 in revenue contributes to fixed costs.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Contribution margin per unit calculator. (2) Contribution margin ratio calculator. (3) Break-even units calculator. (4) Break-even revenue calculator. (5) Target profit units calculator. (6) Margin of safety (units) calculator. (7) Margin of safety (%) calculator. (8) Profit at expected sales calculator. (9) Text report renderer. (10) CSV export (metric, value, formula). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL (encode inputs in hash). (14) Summary stats (break-even units, revenue, margin of safety, profit at expected). (15) Sensitivity analysis (vary price by ±10% and ±20%, show break-even at each). (16) Input validation (price > variable cost, fixed costs > 0).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All break-even, contribution margin, and margin of safety calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
