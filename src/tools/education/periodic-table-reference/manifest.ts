import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "periodic-table-reference",
  name: "Periodic Table Reference",
  description:
    "Interactive periodic table with all 118 elements. Search by name/symbol/atomic number, filter by category, click any element for full details (mass, electronegativity, electron configuration, melting/boiling points, density, discovery year, isotopes). Period/group calculator, neighbor finder, compound formula validator, CSV/JSON export, history (localStorage), shareable URL. 100% client-side.",
  category: "education",
  keywords: [
    "periodic table", "elements", "chemistry", "atomic number",
    "atomic mass", "electronegativity", "electron configuration",
    "isotopes", "alkali metal", "noble gas", "transition metal",
    "compound formula", "science", "reference",
  ],
  icon: "atom",
  requiresNetwork: false,
  seo: {
    title: "Periodic Table Reference — 118 Elements, Search, Filter, Details | UnQTools",
    faq: [
      {
        q: "How does this periodic table tool work?",
        a: "Click any element in the grid to see full details: atomic number, symbol, name, atomic mass, category, electron configuration, electronegativity, atomic radius, melting/boiling points, density, discovery year, and common isotopes. The grid is color-coded by category (alkali metal, noble gas, transition metal, etc.).",
      },
      {
        q: "Can I search and filter elements?",
        a: "Yes. Search by name (e.g. 'oxygen'), symbol (e.g. 'O'), or atomic number (e.g. '8') — case-insensitive. Filter by category to show only alkali metals, halogens, noble gases, transition metals, lanthanides, actinides, and more (10+ categories).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Built-in 118 element data table. (2) Search by name/symbol/atomic number. (3) Filter by category. (4) Element formatter. (5) Element comparator (sort by number, mass, name). (6) Category color lookup (10+ categories). (7) Period/group calculator. (8) Element neighbor finder (left/right/up/down). (9) Common isotope data per element. (10) Compound formula validator. (11) Text/CSV/JSON renderers. (12) Copy + multi-download (.txt, .csv, .json). (13) History (localStorage, last 20 viewed). (14) Shareable URL (encoded selected element). (15) Summary stats (total elements, count by category).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All element data is built-in and lives in the page. Your search, filters, and viewing history never leave your browser. History is stored in localStorage on this device only.",
      },
      {
        q: "Does the compound formula validator support all formulas?",
        a: "It supports basic inorganic formulas like H2O, NaCl, CO2, Ca(OH)2, H2SO4 — it validates that the formula matches the pattern (element symbols with optional counts, optionally grouped with parentheses). It is a syntax validator, not a chemical-reaction balancer.",
      },
    ],
  },
  status: "done",
};
