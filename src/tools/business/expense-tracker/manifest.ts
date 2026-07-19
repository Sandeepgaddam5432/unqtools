import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "expense-tracker",
  name: "Expense Tracker",
  description:
    "Track business expenses — categorize, total, and generate expense reports. CSV parser with validation, date range filter, category grouper, grand total, top expense, daily average, category percentages, tax-deductible markers, 9 category presets, 7 currency presets, sort options, text + CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "business",
  keywords: [
    "expense tracker", "expense report", "business expenses",
    "expense categories", "expense calculator", "tax deductible",
    "reimbursement", "expense log", "expense summary",
    "spending tracker", "budget tracker",
  ],
  icon: "receipt",
  requiresNetwork: false,
  seo: {
    title: "Expense Tracker — Business Expense Categories, Totals & Reports | UnQTools",
    faq: [
      {
        q: "How does the expense tracker work?",
        a: "Enter expenses one per line in the form `date,category,description,amount` (e.g. `2026-07-13,Travel,Taxi to airport,45.50`). The tool parses each line, validates fields (date in YYYY-MM-DD, amount is a number, category non-empty), optionally filters by a date range, then groups by category and computes per-category totals, grand total, top expense, daily average, and category percentages. Descriptions containing commas should be wrapped in double quotes (CSV standard).",
      },
      {
        q: "How are categories handled?",
        a: "Categories are case-insensitive (so 'travel' and 'Travel' merge). The tool ships with 9 preset categories — Travel, Meals, Office, Software, Hardware, Marketing, Legal, Training, Other — but any custom category name works too. Typically tax-deductible categories (Travel, Meals, Office, Software, Hardware, Marketing, Legal, Training) are marked with a badge so you can spot deductible vs non-deductible spend at a glance.",
      },
      {
        q: "Can I export the expense report?",
        a: "Yes — three formats: a plain text report (.txt) with sections grouped by category and by date, a CSV (.csv) with columns date, category, description, amount, and a copy-to-clipboard of the text report. You can also share a link with the expenses encoded in the URL hash. Sort the report by date, by amount descending, or by category name.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with field validation (supports quoted descriptions with commas). (2) Date range filter (start/end). (3) Category grouper. (4) Category total calculator. (5) Grand total calculator. (6) Top expense finder. (7) Daily average calculator. (8) Category percentage calculator. (9) 7 currency presets. (10) 9 expense category presets. (11) Render as text report (by category + by date). (12) Render as CSV. (13) Copy + Download .txt + Download CSV + Share link + Clear. (14) History (localStorage, max 20). (15) Shareable URL (expenses encoded in hash). (16) Summary stats (total, category count, avg per category, top category). (17) Sort options (date / amount desc / category). (18) Tax-deductible marker per category.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Every calculation runs 100% in your browser. History is stored in localStorage on this device only. The share link encodes inputs in the URL hash which never leaves the device unless you copy and send it.",
      },
    ],
  },
  status: "done",
};
