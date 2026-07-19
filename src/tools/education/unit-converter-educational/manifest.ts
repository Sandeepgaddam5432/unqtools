import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "unit-converter-educational",
  name: "Unit Converter (Educational, with Steps)",
  description:
    "Convert between 59+ units across 10 categories (length, mass, temperature, time, area, volume, speed, digital storage, energy, pressure) and see every conversion step — formula, substitution, and result. Special non-multiplicative temperature formulas (C↔F↔K), adjustable precision (0-10 decimals), step-by-step text and CSV renderers, copy + multi-download, history (localStorage, last 20), shareable URL, summary stats by category, unit search/filter, 6 common-conversion presets (mile→km, kg→lb, etc.), bi-directional auto-fill, and per-category formula reference table. 100% client-side — no network.",
  category: "education",
  keywords: [
    "unit converter", "conversion", "metric", "imperial",
    "length", "mass", "temperature", "time",
    "education", "learning", "formula",
  ],
  icon: "ruler",
  requiresNetwork: false,
  seo: {
    title: "Unit Converter Educational — Steps + Formulas, 10 Categories | UnQTools",
    faq: [
      {
        q: "How does the educational unit converter work?",
        a: "Pick one of 10 categories (length, mass, temperature, time, area, volume, speed, digital storage, energy, pressure), choose the source and target unit, enter a value, and the tool computes the result plus a step-by-step derivation: the formula, the substitution with your value, and the final result with the chosen precision.",
      },
      {
        q: "How are temperature conversions handled?",
        a: "Temperature is non-multiplicative, so the tool uses the standard formulas: °F = °C × 9/5 + 32, K = °C + 273.15, °C = (°F − 32) × 5/9, etc. Each step shows the formula and substitution explicitly. The other 9 categories use a single multiplicative conversion factor relative to a base unit (e.g. meters for length).",
      },
      {
        q: "What units are supported in each category?",
        a: "Length: m, km, cm, mm, mile, yard, foot, inch, nautical mile. Mass: kg, g, mg, ton, lb, oz, stone. Temperature: °C, °F, K. Time: s, min, hr, day, week, month, year. Area: m², km², ft², yd², acre, hectare. Volume: L, mL, gal (US), qt, pt, cup, fl oz. Speed: m/s, km/h, mph, knot. Digital: bit, byte, KB, MB, GB, TB, PB. Energy: J, cal, kWh, BTU. Pressure: Pa, kPa, bar, psi, atm. Total: 59 units across 10 categories.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 conversion categories. (2) 59+ unit types. (3) Built-in conversion factor table. (4) Step-by-step conversion display (formula → substitution → result). (5) Temperature special handler (non-multiplicative formulas). (6) Precision customizer (0-10 decimals). (7) Text report renderer (with steps). (8) CSV renderer (from, to, value, result, formula). (9) Copy + Download .txt + Download CSV. (10) History (localStorage, last 20). (11) Shareable URL (encode inputs in hash). (12) Summary stats (total conversions, by category). (13) Unit search/filter. (14) Common-conversion presets (mile→km, kg→lb, °C→°F, hr→s, L→gal, MB→KB). (15) Bi-directional converter (swap from/to with one click). (16) Formula reference table per category.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All conversions and step generation run locally. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
