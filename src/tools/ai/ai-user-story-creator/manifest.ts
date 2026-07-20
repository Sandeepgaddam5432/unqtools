import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-user-story-creator",
  name: "AI User Story Creator (Agile/Scrum)",
  description:
    "Generate Agile/Scrum user stories from a feature or epic. Standard 'As a / I want / so that' format, Given/When/Then (Gherkin) acceptance criteria, INVEST validation, story-point estimates (Fibonacci / T-shirt / powers-of-2), edge cases, epic → story → task breakdown, definition-of-done checklist, and Jira/Azure/CSV/Markdown export. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "user story", "user story generator", "agile user story",
    "scrum story", "acceptance criteria", "gherkin",
    "given when then", "story points", "invest checklist",
    "epic breakdown", "jira export", "no login user story",
  ],
  icon: "users",
  requiresNetwork: false,
  seo: {
    title: "AI User Story Creator (Agile/Scrum) — Gherkin AC + INVEST + Points | UnQTools",
    faq: [
      {
        q: "How does the user story creator work?",
        a: "Enter a feature or epic description, pick a primary persona (end-user, admin, developer, guest, or custom), and the tool generates one or more user stories in the standard 'As a [role], I want [feature], so that [benefit]' format. Each story includes Given/When/Then (Gherkin) acceptance criteria, a list of edge cases, an INVEST checklist (Independent, Negotiable, Valuable, Estimable, Small, Testable), and a story-point estimate using your chosen scale (Fibonacci, T-shirt, or powers of 2). Epics are split into smaller stories, and each story is broken down into 3–5 concrete tasks.",
      },
      {
        q: "How are story points estimated?",
        a: "The estimator scans the feature text for complexity signals (data persistence, integrations, auth, permissions, performance, scale), effort signals (UI, API, migration, reporting), and uncertainty signals (third-party, experimental, regulatory). Each signal adds to a complexity score that maps onto your chosen scale: Fibonacci (1, 2, 3, 5, 8, 13, 21), T-shirt (XS, S, M, L, XL), or powers of 2 (1, 2, 4, 8, 16). Points are explicitly labeled as suggestions for the team to refine together during planning — not commitments.",
      },
      {
        q: "What is INVEST and how does the tool check it?",
        a: "INVEST is a Scrum quality checklist: Independent (the story doesn't depend on other stories), Negotiable (it can be re-scoped), Valuable (it delivers user value), Estimable (the team can size it), Small (it fits in a sprint), and Testable (acceptance criteria are clear). The tool runs heuristics on each dimension and returns a pass/warn/fail verdict with a specific reason — for example, a story with no acceptance criteria fails 'Testable', and a story that mentions another story by name fails 'Independent'.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Standard 'As a / I want / so that' template plus Job-Story ('When / I want / so that') and B-MMN format options. (2) Persona presets (end-user, admin, developer, guest, custom). (3) Given/When/Then Gherkin acceptance criteria generator. (4) INVEST checklist with pass/warn/fail per dimension. (5) Story-point estimator with three scales. (6) Edge case generator. (7) Epic → story splitter. (8) Story → task breakdown (3–5 tasks). (9) Definition-of-Done checklist. (10) Dependency notes. (11) Bulk generate from multiple features. (12) Copy + Download (Markdown / Jira CSV / Azure CSV / JSON). (13) History (localStorage, last 20). (14) Shareable URL. (15) Feature presets. (16) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All feature parsing, story generation, Gherkin synthesis, INVEST checks, and point estimation run locally in your browser. Features and backlogs never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
