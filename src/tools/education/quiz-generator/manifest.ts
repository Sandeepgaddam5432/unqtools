import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "quiz-generator",
  name: "Quiz Generator & Grader",
  description:
    "Build multiple-choice quizzes from question|correct|wrong1|wrong2|wrong3 input. Take the quiz, get scored instantly, review every answer, and export as printable text or HTML. Includes question shuffler, per-question option shuffler, pass/fail with custom passing score, answer tracker, per-question feedback, quiz state machine, time tracker, summary stats, true/false auto-conversion to MC, per-question difficulty markers, 4 quiz presets (general knowledge, math, geography, science), history (localStorage), and shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "quiz", "quiz generator", "test", "exam",
    "multiple choice", "mcq", "assessment",
    "trivia", "education", "learning",
  ],
  icon: "list-checks",
  requiresNetwork: false,
  seo: {
    title: "Quiz Generator & Grader — Multiple-Choice, Scored, Printable | UnQTools",
    faq: [
      {
        q: "How does the quiz generator work?",
        a: "Enter one question per line in the format 'question|correct_answer|wrong1|wrong2|wrong3'. Set a passing score (default 70%), optionally shuffle questions and options, then take the quiz. You'll get an instant score, pass/fail verdict, time spent, and a full review of every question showing your answer vs the correct answer.",
      },
      {
        q: "What input format is supported?",
        a: "Pipe-separated lines: 'question|correct|wrong1|wrong2|wrong3'. You can include 1-3 wrong answers (minimum 2 options total) and an optional difficulty marker as the last field ('easy|medium|hard'). True/false questions can be entered as 'question|true' or 'question|false' — they're auto-converted to a 2-option MC question. You can also paste a JSON array of {question, options, correctIndex, difficulty?} objects.",
      },
      {
        q: "Can I shuffle questions and answer options?",
        a: "Yes. Two independent toggles: 'shuffle questions' (Fisher-Yates on the whole question list) and 'shuffle options' (randomize the position of the correct answer within each question). Both apply at quiz start.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Question parser (pipe-separated, auto T/F detection, JSON). (2) Question validator (>=2 options, exactly 1 correct). (3) Fisher-Yates question shuffler. (4) Per-question option shuffler. (5) Score calculator (correct/total×100). (6) Pass/fail determiner vs passing score. (7) Answer tracker (records selected option + correctness per question). (8) Per-question feedback generator. (9) Quiz state machine (current question, answered, finished). (10) Time tracker (start/end/duration). (11) Text/HTML/CSV renderers (printable). (12) Copy + multi-download (.txt, .html, .csv). (13) History (localStorage, last 20 quizzes with scores). (14) Shareable URL with quiz encoded in hash. (15) Summary stats (total, correct, incorrect, skipped, score %, pass/fail, by-difficulty breakdown). (16) True/false → MC auto-converter. (17) 4 quiz presets (general knowledge, math, geography, science). (18) Per-question difficulty marker.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, shuffling, scoring, and rendering run locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
