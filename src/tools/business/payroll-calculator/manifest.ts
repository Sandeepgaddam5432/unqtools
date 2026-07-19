import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "payroll-calculator",
  name: "Payroll Calculator",
  description:
    "Calculate payroll — gross pay, deductions, and net pay — for hourly and salaried employees. Federal/state tax, Social Security, Medicare, 401k, health insurance, YTD estimator, pay stub generator (text + HTML), CSV export, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "payroll", "paycheck", "pay stub", "salary calculator",
    "hourly calculator", "overtime", "net pay", "gross pay",
    "deductions", "401k", "social security", "medicare",
  ],
  icon: "wallet",
  requiresNetwork: false,
  seo: {
    title: "Payroll Calculator — Gross Pay, Deductions, Net Pay | UnQTools",
    faq: [
      {
        q: "How does the payroll calculator work?",
        a: "Enter the employee's pay frequency (weekly, bi-weekly, semi-monthly, or monthly) and type (hourly or salaried). For hourly employees, enter hourly rate, hours worked, and optional overtime hours with a 1.5x default multiplier. For salaried employees, enter the annual salary — the tool divides by pay periods per year. Federal tax, state tax, Social Security (6.2%), Medicare (1.45%), 401k, and health insurance deductions are all itemized. Net pay = gross − total deductions.",
      },
      {
        q: "Can I generate a printable pay stub?",
        a: "Yes. After calculating payroll, download the pay stub as a formatted text file (.txt) or as a printable HTML file (.html) that opens in any browser and prints cleanly. A CSV breakdown of every line item (component, amount) is also available.",
      },
      {
        q: "What is the YTD estimator?",
        a: "Year-to-date (YTD) estimator multiplies the current period's gross, total deductions, and net pay by the period number within the year. For example, period 6 of a bi-weekly pay frequency (26 periods/year) gives an estimate of the partial-year totals. Adjust as needed for variable pay.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 pay frequency presets (weekly, bi-weekly, semi-monthly, monthly). (2) 2 employee types (hourly, salaried). (3) Hourly gross calculator with overtime. (4) Salaried gross calculator per period. (5) Federal tax calculator. (6) State tax calculator. (7) Social Security + Medicare calculator. (8) 401k retirement contribution calculator. (9) Health insurance deduction applier. (10) YTD estimator. (11) Pay stub generator (text + HTML). (12) Render as text report. (13) Render as CSV (component, amount). (14) Copy + Download .txt + Download HTML + Download CSV. (15) History (localStorage, max 20). (16) Shareable URL. (17) Summary stats (gross, deductions, net, effective tax rate).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All payroll calculation runs 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
