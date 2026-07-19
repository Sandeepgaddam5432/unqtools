import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "grade-calculator",
  name: "Grade Calculator & GPA Projector",
  description:
    "Calculate course grades from weighted assignments, find the grade you need on remaining work to hit your target, and convert between percentage, letter grade, and GPA. Supports 4 grading scales (standard 10-point, plus-minus, pass-fail, custom), 4 GPA scales (4.0, 5.0, 10.0, 100%), what-if scenarios, weight validator, score validator, CSV/text export, history (localStorage), shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "grade calculator", "gpa calculator", "weighted grade",
    "final grade", "target grade", "letter grade",
    "course grade", "education", "what-if grade",
  ],
  icon: "graduation-cap",
  requiresNetwork: false,
  seo: {
    title: "Grade Calculator & GPA Projector — Weighted Grades + Target Grade | UnQTools",
    faq: [
      {
        q: "How does the grade calculator work?",
        a: "Enter your assignments as CSV-style lines: name,score,max_score,weight_percent (e.g. 'Midterm,85,100,25'). The tool calculates the weighted contribution of each assignment, sums up your current grade (using only assignments you've already attempted), and tells you the score you need on the remaining assignments to reach your target grade.",
      },
      {
        q: "How is the grade needed on remaining assignments calculated?",
        a: "Using the formula: needed = (targetGrade × totalWeight − currentWeightedScore) ÷ remainingWeight. For example, if your target is 90% with weights summing to 100%, you've earned 50 weighted points so far from 60% of weight, you need (90×100 − 50) ÷ 40 = 100% on the remaining 40% of work.",
      },
      {
        q: "What grading scales are supported?",
        a: "Four: (1) standard 10-point (A=90+, B=80+, C=70+, D=60+, F<60); (2) plus-minus (A+, A, A-, B+, ... F); (3) pass-fail (P=60+, F<60); (4) custom (you define your own thresholds). For GPA, four scales: 4.0, 5.0, 10.0, and 100-percentage.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV-style assignment parser (name,score,max_score,weight_percent per line). (2) Per-assignment weighted score calculator. (3) Current grade calculator (attempted assignments only). (4) Grade-needed-on-remaining calculator (target grade projection). (5) 4 grading scale presets (standard, plus-minus, pass-fail, custom). (6) 4 GPA scale presets (4.0, 5.0, 10.0, 100%). (7) Percentage → letter grade converter. (8) Percentage → GPA points converter. (9) What-if scenario builder (vary remaining scores). (10) Final grade projection. (11) Text report renderer (per-assignment breakdown). (12) CSV export (name, score, max, weight, weighted_score). (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL with assignments encoded in hash. (16) Summary stats (current grade, target grade, grade needed, GPA). (17) Assignment weight validator (must sum to 100%). (18) Score validator (0 ≤ score ≤ max_score).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, calculations and rendering run locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
