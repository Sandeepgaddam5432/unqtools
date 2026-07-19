import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "budget-planner",
  name: "Monthly Budget Planner",
  description:
    "Plan your monthly budget — track income, expenses by category (actual vs budgeted), savings goals, and variance analysis. Apply the 50/30/20 rule (needs / wants / savings). Export as text or CSV. 18 extra features: income parser, expense parser, total income, total expenses, net income, savings rate, per-category variance, total variance, savings goal progress, 50/30/20 rule check, 7 currency presets, 10 category presets, text report, CSV export, history (localStorage), shareable URL, summary stats, copy & download. 100% client-side.",
  category: "business",
  keywords: [
    "budget", "budget planner", "monthly budget",
    "expense tracker", "savings goal", "variance analysis",
    "50/30/20 rule", "personal finance", "budget calculator",
  ],
  icon: "wallet",
  requiresNetwork: false,
  seo: {
    title: "Monthly Budget Planner — Income, Expenses, Variance, 50/30/20 | UnQTools",
    faq: [
      {
        q: "How does the budget planner work?",
        a: "Enter your month (YYYY-MM), income items as `source,amount` per line, and expenses as `category,actual,budgeted` per line. Optionally set a savings goal and pick a currency. The tool computes total income, total expenses (actual vs budgeted), net income, savings rate, per-category variance, total variance, savings goal progress, and a 50/30/20 rule check (needs/wants/savings).",
      },
      {
        q: "What is the 50/30/20 rule and how is it checked?",
        a: "The 50/30/20 rule allocates 50% of income to needs (housing, transportation, food, utilities, insurance, healthcare, debt), 30% to wants (entertainment, other discretionary), and 20% to savings. The planner classifies your expense categories into these buckets, computes actual percentages of income, and flags whether each is within target.",
      },
      {
        q: "Can I track variance between budgeted and actual spending?",
        a: "Yes. Each expense line has both an actual amount and a budgeted amount. The planner computes per-category variance (budgeted - actual, positive means under budget, negative means over) and an overall total variance so you can see where you saved or overspent.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Income items parser. (2) Expense items parser (actual + budgeted). (3) Total income calculator. (4) Total expenses calculator (actual + budgeted). (5) Net income calculator. (6) Savings rate calculator. (7) Per-category variance calculator. (8) Total variance calculator. (9) Savings goal progress tracker. (10) 50/30/20 rule checker (needs/wants/savings). (11) 7 currency presets ($, €, £, ₹, ¥, A$, C$). (12) 10 category presets (Housing, Transportation, Food, Utilities, Insurance, Healthcare, Debt, Entertainment, Savings, Other). (13) Text report renderer. (14) CSV export (category, budgeted, actual, variance). (15) Copy + Download .txt + Download CSV. (16) History (localStorage, last 20). (17) Shareable URL (encode inputs in hash). (18) Summary stats.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All budget calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
