/**
 * Roman Numeral Converter — Tool Manifest.
 * Tool #373 — Category 4 (Developer & Code).
 *
 * Convert between Arabic numbers and Roman numerals in both directions,
 * validate the Roman numeral grammar (strict or lenient), show the
 * additive / subtractive decomposition, and support large numbers via
 * vinculum (overline ×1000) notation up to 3,999,999. Batch conversion,
 * a year helper, and a curated history reference. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "roman-numeral-converter",
  name: "Roman Numeral Converter",
  description:
    "Convert between Arabic numbers and Roman numerals both ways. Standard mode (1–3999) and vinculum mode (1–3,999,999 with overline ×1000). Strict vs lenient grammar validation (reject IIII / IC or allow clock-style). Additive/subtractive breakdown (e.g. MCMXCIV = 1000 + 900 + 90 + 4). Batch-convert lists, year helper, copy result, history of Roman numerals reference. 100% client-side, no network.",
  category: "developer",
  keywords: [
    "roman numeral converter", "number to roman", "roman to number",
    "arabic to roman", "roman numeral calculator", "vinculum",
    "overline roman", "large roman numerals", "roman numeral validator",
    "MCMXCIV", "roman numeral breakdown", "roman numeral steps",
    "year to roman", "batch roman converter", "IIII vs IV",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Roman Numeral Converter (Vinculum, Strict Validation, Breakdown) | UnQTools",
    faq: [
      {
        q: "How does the Roman numeral converter work?",
        a: "Type an Arabic number (1, 4, 1994, 2024, …) to get its Roman form, or type a Roman numeral (MCMXCIV, MMXXIV, …) to get its Arabic value. Conversion is live as you type. You can switch between standard mode (1–3999) and vinculum mode (1–3,999,999) which uses an overline above each numeral to multiply its value by 1000. So 4000 becomes I̅V̅, 5000 becomes V̅, and 3,999,999 becomes the longest form supported by one level of vinculum.",
      },
      {
        q: "What's the difference between strict and lenient validation?",
        a: "Strict mode enforces standard modern rules: I, X, C, M may repeat at most 3 times; V, L, D never repeat; only valid subtractive pairs (IV, IX, XL, XC, CD, CM) are allowed; overlined (vinculum) symbols must come before non-overlined ones. So IIII (clock-style 4), VV, and IC (invalid 99) are rejected. Lenient mode only requires that every character be a Roman numeral (or overlined Roman numeral) — it accepts IIII, VV, IC, etc. and computes their value using the standard smaller-before-larger subtractive rule.",
      },
      {
        q: "What is vinculum (overline) notation and how high can it go?",
        a: "Vinculum is the convention where a horizontal bar (overline) above a Roman numeral multiplies its value by 1000. So V̅ = 5,000, X̅ = 10,000, L̅ = 50,000, C̅ = 100,000, D̅ = 500,000, M̅ = 1,000,000. With one level of vinculum the maximum representable value is 3,999,999 = M̅M̅M̅C̅M̅X̅C̅I̅X̅CMXCIX. The tool uses the Unicode combining overline (U+0305) so results copy/paste cleanly into any text editor. Numbers above 3,999,999 would require a second level of vinculum (or other medieval extensions like the apostrophus) and are not supported.",
      },
      {
        q: "Does it show the step-by-step breakdown?",
        a: "Yes. For any input the tool shows the additive / subtractive decomposition. For example MCMXCIV breaks down as M (1000) + CM (1000−100 = 900) + XC (100−10 = 90) + IV (5−1 = 4) = 1994. The same breakdown works for vinculum values — V̅ shows as V̅ (5000) = 5000, and I̅V̅ shows as I̅V̅ (5000 − 1000) = 4000. The breakdown is shown as chips with each piece's formula and running cumulative total.",
      },
      {
        q: "What extra features does this tool have versus other Roman numeral converters?",
        a: "(1) Both directions, live (Arabic → Roman and Roman → Arabic). (2) Standard (1–3999) AND vinculum (1–3,999,999) modes — most converters cap at 3999. (3) Strict vs lenient validation modes (accept IIII clock-style or not). (4) Additive/subtractive breakdown with formula and cumulative total. (5) Batch conversion: paste a list of mixed numbers and Roman numerals, auto-detect direction per line. (6) Year helper. (7) Curated history-of-Roman-numerals reference (Etruscan origins, additive→subtractive shift, vinculum, no-zero, clockmaker's IIII, modern uses). (8) Copy result to clipboard. (9) History (localStorage, last 20, clickable to reload). (10) Shareable URL with direction and input encoded. (11) 10 quick presets. (12) Lowercase input auto-normalized. 100% client-side and offline — your input never leaves the device.",
      },
    ],
  },
  status: "done",
};
