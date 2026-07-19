import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "physics-formula-reference",
  name: "Physics Formula Reference & Calculator",
  description:
    "Browse 50+ physics formulas across mechanics, electricity, waves, thermodynamics, modern physics, and optics. Solve any formula for any variable, validate required inputs, convert units, run dimensional analysis, and get sig-fig-aware results. Built-in constants (g, c, h, k, G, R, N_A). 100% client-side — 18 extra features including CSV/text export, history, shareable URL, search filter, difficulty markers.",
  category: "education",
  keywords: [
    "physics", "formulas", "mechanics", "electricity",
    "waves", "thermodynamics", "modern physics", "optics",
    "F=ma", "Ohm's law", "kinematics", "calculator",
  ],
  icon: "atom",
  requiresNetwork: false,
  seo: {
    title: "Physics Formula Reference & Calculator — 50+ Formulas, Unit Converter | UnQTools",
    faq: [
      {
        q: "How does the physics formula calculator work?",
        a: "Pick a category (mechanics, electricity, waves, thermodynamics, modern-physics, or optics), then pick a formula. Enter known values as 'variable=value' per line (e.g. mass=10, acceleration=9.8), choose which variable to solve for, and the tool substitutes knowns and solves for the unknown. Required-variable validation flags missing inputs before computing.",
      },
      {
        q: "How many formulas are included?",
        a: "50+ formulas across 6 categories: Newton's laws, kinematics, gravitation, work-energy-power, Ohm's law, Coulomb's law, wave relationships, ideal gas law, calorimetry, mass-energy equivalence, lens/mirror equations, and more. Each formula carries difficulty (basic/intermediate/advanced) and a related-formula cross-reference.",
      },
      {
        q: "Does it handle unit conversion and significant figures?",
        a: "Yes. Common physics units (m/s ↔ km/h ↔ mph, J ↔ cal ↔ kWh) are convertible via the unit converter. Results are rounded using significant-figure rules so 9.81 m/s² × 10 kg gives 98 N not 98.000001.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 6 physics categories. (2) 50+ formula database built-in. (3) Formula evaluator (substitute + solve). (4) Variable validator. (5) Unit converter for physics units. (6) Reference card per formula. (7) Text report renderer. (8) CSV renderer. (9) Copy + Download .txt + Download CSV. (10) History (localStorage, last 20). (11) Shareable URL. (12) Summary stats. (13) Search/filter. (14) Common constants (g, c, h, k, G, R, N_A). (15) Dimensional analysis checker. (16) Significant figures handler. (17) Difficulty marker. (18) Cross-reference (related formulas).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All calculations run locally in your browser. The formula database and constants are bundled in the page. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
