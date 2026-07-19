import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "math-practice-generator",
  name: "Math Practice Generator",
  description:
    "Generate math practice worksheets for addition, subtraction, multiplication, and division. 5 operation types × 4 difficulty levels (easy, medium, hard, expert), number range parser, allow-negatives toggle, mixed mode, seeded reproducibility, problem validator, Fisher-Yates shuffler, timed mode, answer key, and text/HTML/CSV/Markdown export. 100% client-side.",
  category: "education",
  keywords: [
    "math", "math practice", "worksheet", "addition", "subtraction",
    "multiplication", "division", "arithmetic", "drill", "problems",
    "answer key", "generator", "homework", "printable",
  ],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "Math Practice Generator — Worksheets + Answer Key, 4 Operations × 4 Levels | UnQTools",
    faq: [
      {
        q: "How does the math practice generator work?",
        a: "Pick an operation (addition, subtraction, multiplication, division, or mixed), choose a difficulty level (easy, medium, hard, expert), set the number of problems and number range, then click Generate. You get a printable worksheet with an answer key — copy to clipboard or download as .txt, .html, .csv, or .md.",
      },
      {
        q: "What are the difficulty levels?",
        a: "Easy uses numbers 1-20. Medium uses 1-100. Hard uses 1-1000. Expert uses 1-10000. Each level scales the operand range. You can also override the range manually (e.g. '5-50') for custom worksheets. For division, the divisor is always non-zero, and the dividend is chosen so the answer is a whole number when possible.",
      },
      {
        q: "Can I generate the same worksheet twice?",
        a: "Yes. Every generated worksheet uses a numeric seed. If you supply the same seed (visible in the shareable URL), you get the exact same set of problems — useful for retakes, sharing with students, or replaying a specific mix.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 operation types (add, subtract, multiply, divide, mixed). (2) 4 difficulty presets (easy/medium/hard/expert). (3) Number range parser (e.g. '1-100'). (4) Allow-negatives toggle for subtraction. (5) Seeded RNG for reproducible worksheets. (6) Per-operation answer calculator. (7) Mixed mode (random op per problem). (8) Problem validator (no div-by-zero, no unwanted negatives). (9) Text worksheet renderer (problems + answers). (10) HTML worksheet renderer (printable, 2-column). (11) CSV renderer (problem, answer). (12) Markdown renderer with spoiler answers. (13) Copy + multi-download (.txt/.html/.csv/.md). (14) History (localStorage, last 20). (15) Shareable URL (settings + seed in hash). (16) Summary stats (by operation, by difficulty). (17) Timed-mode preset (suggests time limit per difficulty). (18) Fisher-Yates problem shuffler.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All problem generation runs locally. Your history and settings never leave your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
