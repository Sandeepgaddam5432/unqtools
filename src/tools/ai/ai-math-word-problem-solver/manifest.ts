import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-math-word-problem-solver",
  name: "AI Math Word Problem Solver — Step-by-Step, Verified",
  description:
    "Solve math word problems with step-by-step working and a verified final answer. Pattern-based classifier for arithmetic, algebra, geometry, percentage, ratio, rate, and mixture problems. Extracts numbers and operations from natural language, sets up the equation, computes the result with a deterministic math engine, and verifies the answer. Unit tracking, multiple methods, sample problems. Pure-JS solver — optional BYO-key LLM for hard problems. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "math word problem solver", "word problem solver with steps",
    "algebra word problem calculator", "math solver with steps",
    "ai math help private", "percentage word problem",
    "ratio word problem", "geometry word problem",
    "free math solver", "step by step math",
  ],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "AI Math Word Problem Solver — Verified Steps, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Math Word Problem Solver work?",
        a: "Paste a word problem in plain English. The solver (1) classifies it into one of seven categories — arithmetic, algebra, geometry, percentage, ratio, rate, or mixture — using keyword patterns; (2) extracts the numbers and the operation keywords ('sum', 'difference', 'product', 'per', 'of', 'is what percent'); (3) sets up the equation in a readable form; (4) computes the answer with a deterministic arithmetic engine (not an LLM); and (5) verifies the result by substituting back or recomputing via an alternative method. You see the setup, every step, and a verified-answer badge. Copy the steps or download them as a text file.",
      },
      {
        q: "What problem types are supported?",
        a: "Seven categories with sub-solvers: (1) Arithmetic — add/subtract/multiply/divide with keyword detection (sum, difference, product, quotient, times, per). (2) Algebra — solve for x in linear equations of the form ax + b = c, ax = b, x + b = c, with word phrases like 'twice a number plus 5 is 17'. (3) Geometry — area/perimeter of rectangle, triangle, circle given side/radius descriptions. (4) Percentage — 'what is X% of Y', 'X is what percent of Y', 'percent increase/decrease'. (5) Ratio — part-to-part and part-to-whole ratios with scaling. (6) Rate — distance/speed/time (d = r×t), work problems (1/a + 1/b = 1/t). (7) Mixture — mixing two solutions of different concentrations. Each solver returns the equation, intermediate steps, and verified final answer.",
      },
      {
        q: "How are units and edge cases handled?",
        a: "Units are extracted from the problem text (km, m, mi, ft, kg, g, lb, hr, min, sec, $, %, etc.) and carried through the steps into the final answer. If the problem is ambiguous (e.g., multiple candidate operations or missing numbers), the solver states the assumptions it made and provides its best-effort answer. Problems needing diagrams (e.g., complex geometry) are flagged. Division by zero, negative square roots, and other arithmetic errors are caught and reported as a verification failure rather than a silent wrong answer.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Seven problem-category classifiers (arithmetic, algebra, geometry, percentage, ratio, rate, mixture). (2) Number + operation extraction from natural language. (3) Readable equation setup for every category. (4) Step-by-step working with intermediate values. (5) Deterministic math engine — the LLM (if used) sets up the problem; the arithmetic is computed and verified by a real calculator, not trusted to the model. (6) Verified-answer badge (✓ when the back-substitution check passes). (7) Alternative-method verification where applicable (e.g., percentage problems recomputed as fractions). (8) Unit tracking + display. (9) 10+ sample problems across all categories. (10) Copy steps as Markdown. (11) Download steps as .txt. (12) Save problems locally (last 20). (13) Shareable URL with the problem encoded. (14) Optional BYO-key LLM for hard problems (sets up the equation; verification still uses the deterministic engine). (15) Honesty disclaimers (the classifier can misread; verify the setup against the original problem).",
      },
      {
        q: "Is my problem data sent anywhere?",
        a: "No. All classification, extraction, equation setup, computation, and verification run locally in your browser. Your problem text never leaves this device. The only network call is if you paste your own LLM API key and click 'Solve with LLM' — that request goes directly from your browser to OpenAI, and even then the final arithmetic is verified locally by our deterministic engine.",
      },
    ],
  },
  status: "done",
};
