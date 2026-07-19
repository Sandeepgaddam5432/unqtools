import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "typing-practice",
  name: "Typing Practice & WPM Test",
  description:
    "Practice typing with timed tests (1/3/5 min), custom text, or word-count goals. Measure WPM, accuracy, and error count in real time. Built-in pools of common English words (200+), famous quotes (20+), code snippets (10+ JS/Python), and numbers. Standard WPM formula ((correctChars/5)/minutes), accuracy calculator, per-character diff (correct/incorrect/missed/extra), case-insensitive mode, cursor position tracker, test state machine, result history (localStorage, last 20), text/CSV renderers, copy + download, shareable URL, and summary stats (best WPM, avg WPM, avg accuracy, total tests). 100% client-side — no network.",
  category: "education",
  keywords: [
    "typing", "wpm", "words per minute", "typing test",
    "typing speed", "accuracy", "keyboard", "code typing",
    "practice", "education", "learning",
  ],
  icon: "keyboard",
  requiresNetwork: false,
  seo: {
    title: "Typing Practice & WPM Test — Speed, Accuracy, Code Snippets | UnQTools",
    faq: [
      {
        q: "How does the typing practice tool work?",
        a: "Pick a practice mode (1-minute, 3-minute, 5-minute, custom text, or word-count goal) and a text type (common words, quotes, code snippets, numbers, or your own custom text). Type into the input area — the displayed text highlights each character as you type (green = correct, red = incorrect). When you finish, you'll see your WPM, accuracy, error count, net WPM, and duration. Your last 20 results are saved locally.",
      },
      {
        q: "How is WPM calculated?",
        a: "We use the standard formula: gross WPM = (correct characters typed / 5) / minutes elapsed. The '/5' accounts for the average English word length (5 characters including spaces). Net WPM subtracts errors: net WPM = gross WPM - (errors / minutes elapsed / 5). Accuracy is correctChars / totalTyped × 100.",
      },
      {
        q: "What text types are available?",
        a: "Five built-in pools: (1) common English words (200+ high-frequency words); (2) famous quotes (20+ quotes from literature, science, and culture); (3) code snippets (10+ JavaScript and Python snippets); (4) numbers (random digit sequences); (5) custom (paste your own text). Pools are shuffled for each test.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 practice modes (timed 1/3/5 min, custom text, word count). (2) 5 text types (common words, quotes, code, numbers, custom). (3) Built-in word pool (200+ common English words). (4) Built-in quotes pool (20+ famous quotes). (5) Built-in code snippets pool (10+ JS/Python). (6) Standard WPM calculator ((chars/5)/minutes). (7) Accuracy calculator. (8) Per-character diff (correct/incorrect/missed/extra). (9) Time formatter (ms → MM:SS). (10) Case-insensitive mode. (11) Cursor position tracker. (12) Test state machine (idle/running/finished). (13) Result history (localStorage, last 20). (14) Text/CSV renderers. (15) Copy + download. (16) Shareable URL with settings encoded. (17) Summary stats (best WPM, avg WPM, avg accuracy, total tests). (18) Net WPM (gross - errors/5).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All typing, scoring, and stat computation run locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
