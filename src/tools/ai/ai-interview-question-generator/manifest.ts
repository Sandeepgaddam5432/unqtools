import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-interview-question-generator",
  name: "AI Interview Question Generator",
  description:
    "Generate role-specific interview questions with model answers, follow-up probes, and scoring rubrics. Built-in question library for developer, designer, product manager, sales, and marketing roles across behavioral, technical, situational, and culture-fit categories. Each question ships with a sample strong answer, follow-up probes, red-flag notes, and a 0-5 scoring rubric. Candidate practice mode grades your answer against the rubric, difficulty mix control, tech-stack tags, export to Markdown/JSON/CSV/text, saved question banks (localStorage), history (last 20), and shareable URL. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "interview question generator", "interview prep", "behavioral interview",
    "technical interview", "interview practice", "interview rubric",
    "developer interview questions", "designer interview", "pm interview",
    "sales interview", "marketing interview", "no login interview tool",
  ],
  icon: "mic",
  requiresNetwork: false,
  seo: {
    title: "AI Interview Question Generator — Role-Specific Q&A with Rubrics | UnQTools",
    faq: [
      {
        q: "How does the AI Interview Question Generator work?",
        a: "Pick a role (developer, designer, product manager, sales, marketing) and a seniority level (junior, mid, senior, lead). The tool pulls role-specific questions from a built-in library across four categories: behavioral, technical, situational, and culture-fit. Each question includes a sample strong answer, follow-up probes, red-flag notes, and a 0-5 scoring rubric. Use candidate practice mode to type your own answer and get structured feedback.",
      },
      {
        q: "What's included with each question?",
        a: "Every question has: the question text, category, difficulty (1-5), tags (e.g., 'conflict', 'system-design'), a sample strong answer (2-4 sentences), 2-3 follow-up probes to dig deeper, red-flag notes (what to watch for in weak answers), and a 5-criteria scoring rubric covering communication, depth, structure, evidence, and role-fit. Total per role: 12+ questions across all categories.",
      },
      {
        q: "How does the candidate practice mode work?",
        a: "Pick a question, type your answer in the textarea, and click 'Grade my answer'. The tool checks your answer against the rubric — it looks for the STAR pattern (Situation, Task, Action, Result) in behavioral questions, keyword coverage from the sample answer, and a reasonable length (50-600 words). You get a 0-100 score and specific feedback on what to improve. The grading is heuristic, not a real interviewer — use it as a self-check, not a hiring decision.",
      },
      {
        q: "Can I use my own LLM API key for richer questions and feedback?",
        a: "Yes. The tool builds an optimal prompt (role + seniority + category + JD if provided) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. Without a key, the on-device library produces solid baseline questions fully offline. The only network call goes directly from your browser to the provider you choose.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 roles (developer, designer, PM, sales, marketing). (2) 4 categories (behavioral, technical, situational, culture-fit). (3) 4 seniority levels (junior, mid, senior, lead). (4) Sample strong answer per question. (5) Follow-up probes (2-3 per question). (6) Red-flag notes for weak answers. (7) 5-criteria scoring rubric (communication, depth, structure, evidence, role-fit). (8) Difficulty mix control. (9) Tech-stack tags. (10) Candidate practice mode with heuristic grading. (11) Saved question banks (localStorage). (12) Copy + Download (text/JSON/CSV/Markdown). (13) Optional BYO-key LLM enhancement. (14) History (localStorage, last 20). (15) Shareable URL.",
      },
    ],
  },
  status: "done",
};
