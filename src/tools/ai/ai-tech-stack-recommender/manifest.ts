import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-tech-stack-recommender",
  name: "AI Tech Stack Recommender",
  description:
    "Get an opinionated, transparent tech-stack recommendation (frontend, backend, DB, hosting, auth) from a guided questionnaire: product type, team skills, timeline, scale, budget, compliance. Weighted scorecard with adjustable weights, per-pick rationale, alternatives ('pick this instead if…'), cost estimate ranges, and Markdown ADR export. Pure-JS rule engine + optional BYO-key LLM. 100% client-side, no login, no upload.",
  category: "ai",
  keywords: [
    "tech stack recommender", "best stack for startup", "choose tech stack",
    "architecture decision record", "ADR generator", "stack scorecard",
    "frontend backend database picker", "private stack advisor",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "AI Tech Stack Recommender — Scorecard + ADR | UnQTools",
    faq: [
      {
        q: "How does the tech stack recommender work?",
        a: "Answer seven guided questions: product type, team size, team skills, timeline, expected scale, budget, and compliance constraints. The rule engine picks one stack (frontend, backend, database, hosting, auth) per layer, scores it across five axes (hiring ease, time-to-ship, scale ceiling, cost, ecosystem) with weights you can adjust, and explains every choice. It also offers 2–3 alternative stacks. Export as a Markdown ADR (architecture decision record).",
      },
      {
        q: "What stacks are in the knowledge base?",
        a: "Six opinionated starting stacks: (1) Next.js + Node/Fastify + Postgres + Vercel + Auth0 — fastest time-to-ship for SaaS. (2) React + Python/Django + Postgres + Render + Auth0 — Python teams. (3) Vue + Go/Fiber + Postgres + Fly.io + Clerk — high-throughput APIs. (4) SvelteKit + Node/Hono + SQLite + Fly.io + Lucia — small/edge. (5) Remix + Rust/Axum + Postgres + Railway + Auth0 — max performance. (6) Angular + Java/Spring + MySQL + AWS ECS + Keycloak — enterprise compliance.",
      },
      {
        q: "Are the cost and scale numbers exact?",
        a: "No. Cost ranges ($/month) and scale ceilings (RPS / concurrent users) are labeled estimates derived from public TechEmpower benchmarks, State-of-JS surveys, and cloud pricing pages as of 2024–2025. Always validate against your own load tests. The tool labels them as estimates and never claims they are exact.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Seven-question guided wizard. (2) Six starting stacks with per-layer rationale. (3) Weighted scorecard with 5 axes. (4) Adjustable weight sliders. (5) 2–3 alternative stacks per recommendation. (6) Cost estimate ranges per hosting choice. (7) Scale ceiling estimates per backend choice. (8) Compliance filter (HIPAA/SOC2/GDPR). (9) Team-skill match scoring. (10) Markdown ADR export. (11) Save/compare multiple scenario profiles (localStorage). (12) Side-by-side stack comparison. (13) History (localStorage, last 20). (14) Shareable URL. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my product data sent anywhere?",
        a: "No. All scoring, ranking, and ADR generation run locally in your browser. Your product idea, team skills, and budget never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Nothing about your idea is uploaded or logged by us.",
      },
    ],
  },
  status: "done",
};
