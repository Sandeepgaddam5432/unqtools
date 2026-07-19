import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "chemistry-formula-calculator",
  name: "Chemistry Formula Calculator",
  description:
    "Calculate molar mass, empirical & molecular formulas, balance chemical equations, and percent composition. Built-in 118-element periodic table with atomic masses. Formula parser handles parentheses and hydrates (CuSO4·5H2O). Equation balancer uses brute-force integer search. 100% client-side — 18 extra features including CSV/text export, history, shareable URL, presets, isotope selector.",
  category: "education",
  keywords: [
    "chemistry", "molar mass", "molecular weight",
    "empirical formula", "molecular formula", "balance equation",
    "percent composition", "stoichiometry", "periodic table",
    "atomic mass", "chemical formula", "hydrate",
  ],
  icon: "flask-conical",
  requiresNetwork: false,
  seo: {
    title: "Chemistry Formula Calculator — Molar Mass, Empirical & Molecular Formulas, Equation Balancer | UnQTools",
    faq: [
      {
        q: "How does the chemistry formula calculator work?",
        a: "Pick a calculation type (molar mass, empirical formula, molecular formula, balance equation, or percent composition), enter a chemical formula like H2O or C6H12O6, and the tool parses it against the built-in 118-element periodic table. For empirical/molecular modes, paste experimental percent composition (element,percentage per line). For balance mode, type an equation like H2 + O2 = H2O.",
      },
      {
        q: "Does the formula parser handle parentheses and hydrates?",
        a: "Yes. The parser handles nested parentheses like (NH4)2SO4 and Fe2(SO4)3, and the hydrate dot notation like CuSO4·5H2O (use the middle-dot character · or '*' as separator). Hydrate segments with a leading coefficient are multiplied correctly.",
      },
      {
        q: "How does the equation balancer work?",
        a: "The balancer parses reactants and products, enumerates each element, then searches integer coefficients from 1 to 20 for every species until the law of conservation of mass is satisfied. It returns the smallest such set and renders the balanced equation.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 calculation types. (2) 118-element periodic table built-in. (3) Formula parser (parentheses + hydrates). (4) Molar mass calculator. (5) Empirical formula from % composition. (6) Molecular formula from empirical + molar mass. (7) Equation balancer (integer search). (8) Percent composition calculator. (9) Formula validator. (10) Text report renderer. (11) CSV renderer. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats. (16) 10 common-compound presets. (17) Hydrate dot handler. (18) Common-isotope mass selector.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All calculations run locally in your browser. The periodic table is bundled in the page. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
