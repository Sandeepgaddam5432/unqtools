/**
 * AI Tech Stack Recommender — pure logic.
 *
 * Turns a product profile (product type, team size, team skills, timeline,
 * scale, budget, compliance) into a specific recommended stack with a weighted
 * scorecard, per-pick rationale, alternatives, cost estimates, and ADR export.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type ProductType =
  | "saas-web"
  | "saas-mobile"
  | "marketing-site"
  | "internal-tool"
  | "ecommerce"
  | "realtime-collab"
  | "data-platform"
  | "api-only";

export type TeamSize = "solo" | "small" | "medium" | "large";
export type Timeline = "weekend" | "month" | "quarter" | "year";
export type Scale = "tiny" | "small" | "medium" | "large" | "huge";
export type Budget = "shoestring" | "lean" | "comfortable" | "enterprise";
export type Compliance = "none" | "gdpr" | "hipaa" | "soc2" | "fedramp";
export type Skill = "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "php" | "ruby";

export interface ProductProfile {
  productType: ProductType;
  teamSize: TeamSize;
  skills: Skill[];
  timeline: Timeline;
  scale: Scale;
  budget: Budget;
  compliance: Compliance;
  offline: boolean;          // must run on-prem/air-gapped
  realtime: boolean;         // realtime collab / sockets
  seoCritical: boolean;      // SEO is critical (affects SSR choice)
}

export type LayerKey = "frontend" | "backend" | "database" | "hosting" | "auth";

export interface TechChoice {
  layer: LayerKey;
  name: string;               // e.g. "Next.js"
  category: string;            // e.g. "React meta-framework"
  rationale: string;           // why this pick
  alternative: string;         // pick this instead if...
  costEstimate?: string;       // e.g. "$0–20/mo hobby, $20–100/mo pro"
  scaleCeiling?: string;       // e.g. "~5000 RPS on 2 vCPU"
}

export interface ScorecardAxis {
  key: "hiring" | "shiptime" | "scale" | "cost" | "ecosystem";
  label: string;
  rawScore: number;            // 0–10 for this stack
  weightedScore: number;       // rawScore * weight
  weight: number;              // 0–1
}

export interface StackCandidate {
  id: string;                  // e.g. "next-fastify-postgres"
  name: string;                // e.g. "Next.js + Node/Fastify + Postgres"
  summary: string;
  choices: Record<LayerKey, TechChoice>;
  scores: ScorecardAxis[];
  totalScore: number;          // sum of weighted scores
  stars: number;               // 1–5 derived from total
}

export interface Recommendation {
  profile: ProductProfile;
  primary: StackCandidate;
  alternatives: StackCandidate[];
  weights: ScoreWeights;
  honestyNotes: string[];
  generatedAt: number;
}

export interface ScoreWeights {
  hiring: number;
  shiptime: number;
  scale: number;
  cost: number;
  ecosystem: number;
}

export interface HistoryEntry {
  ts: number;
  productType: ProductType;
  teamSize: TeamSize;
  primaryStackId: string;
  primaryStackName: string;
  totalScore: number;
}

export interface ShareState {
  profile: Partial<ProductProfile>;
  weights: Partial<ScoreWeights>;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-tech-stack-recommender:history";
export const HISTORY_MAX = 20;

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  "saas-web": "SaaS web app",
  "saas-mobile": "SaaS with mobile app",
  "marketing-site": "Marketing / content site",
  "internal-tool": "Internal tool / admin panel",
  "ecommerce": "E-commerce storefront",
  "realtime-collab": "Realtime collaboration app",
  "data-platform": "Data / analytics platform",
  "api-only": "API / backend service only",
};

export const TEAM_SIZE_LABELS: Record<TeamSize, string> = {
  "solo": "Solo founder (1)",
  "small": "Small team (2–5)",
  "medium": "Medium team (6–20)",
  "large": "Large team (20+)",
};

export const TIMELINE_LABELS: Record<Timeline, string> = {
  "weekend": "Weekend MVP",
  "month": "1 month",
  "quarter": "1 quarter (3 months)",
  "year": "6–12 months",
};

export const SCALE_LABELS: Record<Scale, string> = {
  "tiny": "< 100 users",
  "small": "100–1K users",
  "medium": "1K–10K users",
  "large": "10K–100K users",
  "huge": "100K+ users",
};

export const BUDGET_LABELS: Record<Budget, string> = {
  "shoestring": "Shoestring ($0–50/mo)",
  "lean": "Lean ($50–500/mo)",
  "comfortable": "Comfortable ($500–5K/mo)",
  "enterprise": "Enterprise ($5K+/mo)",
};

export const COMPLIANCE_LABELS: Record<Compliance, string> = {
  "none": "None / general",
  "gdpr": "GDPR (EU privacy)",
  "hipaa": "HIPAA (US healthcare)",
  "soc2": "SOC 2 (audit-ready)",
  "fedramp": "FedRAMP (US gov)",
};

export const SKILL_LABELS: Record<Skill, string> = {
  "javascript": "JavaScript",
  "typescript": "TypeScript",
  "python": "Python",
  "go": "Go",
  "rust": "Rust",
  "java": "Java",
  "php": "PHP",
  "ruby": "Ruby",
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  hiring: 0.25,
  shiptime: 0.25,
  scale: 0.20,
  cost: 0.15,
  ecosystem: 0.15,
};

export const DEFAULT_PROFILE: ProductProfile = {
  productType: "saas-web",
  teamSize: "small",
  skills: ["typescript"],
  timeline: "quarter",
  scale: "medium",
  budget: "lean",
  compliance: "none",
  offline: false,
  realtime: false,
  seoCritical: true,
};

export const PRODUCT_TYPE_PRESETS: { label: string; profile: Partial<ProductProfile> }[] = [
  { label: "Indie SaaS (Next.js + TS)", profile: { productType: "saas-web", teamSize: "solo", skills: ["typescript"], timeline: "month", scale: "small", budget: "shoestring", compliance: "none", offline: false, realtime: false, seoCritical: true } },
  { label: "B2B SaaS (TS, quarter)", profile: { productType: "saas-web", teamSize: "small", skills: ["typescript"], timeline: "quarter", scale: "medium", budget: "lean", compliance: "none", offline: false, realtime: false, seoCritical: true } },
  { label: "Realtime collab", profile: { productType: "realtime-collab", teamSize: "small", skills: ["typescript"], timeline: "quarter", scale: "medium", budget: "lean", compliance: "none", offline: false, realtime: true, seoCritical: false } },
  { label: "Enterprise HIPAA", profile: { productType: "saas-web", teamSize: "large", skills: ["java"], timeline: "year", scale: "large", budget: "enterprise", compliance: "hipaa", offline: false, realtime: false, seoCritical: false } },
  { label: "Marketing site", profile: { productType: "marketing-site", teamSize: "solo", skills: ["javascript"], timeline: "weekend", scale: "small", budget: "shoestring", compliance: "none", offline: false, realtime: false, seoCritical: true } },
  { label: "API only", profile: { productType: "api-only", teamSize: "solo", skills: ["python"], timeline: "month", scale: "medium", budget: "lean", compliance: "none", offline: false, realtime: false, seoCritical: false } },
];

// ---------- Knowledge base: stack candidates ----------

interface StackDef {
  id: string;
  name: string;
  summary: string;
  choices: Record<LayerKey, TechChoice>;
  /** Base scores 0–10 before profile adjustments. */
  base: { hiring: number; shiptime: number; scale: number; cost: number; ecosystem: number };
  /** Skills that this stack aligns with (for skill-match boost). */
  alignsSkills: Skill[];
  /** Best-fit product types. */
  fitsProducts: ProductType[];
  /** True if offline / on-prem friendly. */
  offlineOk: boolean;
  /** True if realtime-friendly (websockets / SSE first-class). */
  realtimeOk: boolean;
  /** True if SEO-friendly (SSR/SSG by default). */
  seoOk: boolean;
  /** Compliance tiers supported. */
  supportsCompliance: Compliance[];
}

const STACKS: StackDef[] = [
  {
    id: "next-fastify-postgres",
    name: "Next.js + Node/Fastify + Postgres",
    summary: "Fastest time-to-ship for SaaS web apps. TypeScript end-to-end. Huge hiring pool. Deploy on Vercel/Render.",
    choices: {
      frontend: {
        layer: "frontend", name: "Next.js (React)", category: "React meta-framework",
        rationale: "SSR + SSG + API routes in one box. Best-in-class DX and SEO when configured.",
        alternative: "Pick Remix instead if you want flatter nested routing and stronger web-standards alignment.",
      },
      backend: {
        layer: "backend", name: "Node.js + Fastify", category: "Node web framework",
        rationale: "Fast, typed, schema-first. Shares TS types with the frontend — no DTO drift.",
        alternative: "Pick Hono instead if you want edge-runtime first-class and smaller bundles.",
        scaleCeiling: "~3000 RPS on 2 vCPU (TechEmpower-style, real workloads vary)",
      },
      database: {
        layer: "database", name: "PostgreSQL (Neon/Supabase)", category: "Relational DB",
        rationale: "Battle-tested relational DB with great hosted options. Row-level security available.",
        alternative: "Pick SQLite (Turso) instead if you want zero-ops and edge replication.",
        costEstimate: "$0 free tier, $19–90/mo pro, scales with storage",
      },
      hosting: {
        layer: "hosting", name: "Vercel", category: "PaaS (managed)",
        rationale: "Zero-config deploys for Next.js. Edge functions, image opt, analytics built in.",
        alternative: "Pick Render/Fly.io instead if you want to avoid vendor lock-in.",
        costEstimate: "$0 hobby, $20–100/mo pro, $100+/mo at scale",
      },
      auth: {
        layer: "auth", name: "Auth0 / Clerk", category: "Managed auth",
        rationale: "OAuth, MFA, SSO out of the box. No need to roll your own crypto.",
        alternative: "Pick Lucia instead if you want self-hosted sessions and zero per-MAU cost.",
      },
    },
    base: { hiring: 9, shiptime: 9, scale: 7, cost: 6, ecosystem: 10 },
    alignsSkills: ["typescript", "javascript"],
    fitsProducts: ["saas-web", "marketing-site", "ecommerce", "internal-tool"],
    offlineOk: false, realtimeOk: true, seoOk: true,
    supportsCompliance: ["none", "gdpr", "soc2"],
  },
  {
    id: "react-django-postgres",
    name: "React + Python/Django + Postgres",
    summary: "Best when your team is Python-first. Django admin gives free backoffice. Slower hiring for frontend.",
    choices: {
      frontend: {
        layer: "frontend", name: "React (Vite)", category: "SPA",
        rationale: "Largest frontend talent pool. Pair with TanStack Router/Query for SPA ergonomics.",
        alternative: "Pick Next.js instead if SEO matters — SPA needs pre-rendering tricks.",
      },
      backend: {
        layer: "backend", name: "Django + DRF", category: "Python web framework",
        rationale: "Batteries-included ORM, admin, auth. Huge ecosystem for data/science tasks.",
        alternative: "Pick FastAPI instead if you want async-first and OpenAPI by default.",
        scaleCeiling: "~1500 RPS on 2 vCPU (Python is slower than Node/Go per-request)",
      },
      database: {
        layer: "database", name: "PostgreSQL", category: "Relational DB",
        rationale: "Django's ORM works best with Postgres. JSONB, full-text search, partitions all supported.",
        alternative: "Pick MySQL instead if your ops team already runs it.",
        costEstimate: "$0 self-host, $15–200/mo managed",
      },
      hosting: {
        layer: "hosting", name: "Render / Railway", category: "PaaS",
        rationale: "Python-friendly PaaS. Easy deploys, managed Postgres add-on.",
        alternative: "Pick AWS ECS/Fargate instead if you need enterprise controls.",
        costEstimate: "$0 free, $7–50/mo starter, $50+/mo at scale",
      },
      auth: {
        layer: "auth", name: "Django allauth / Auth0", category: "Self-host or managed",
        rationale: "Django ships auth. Add allauth for social. Or wrap with Auth0 for SSO.",
        alternative: "Pick Clerk instead if you want drop-in React components.",
      },
    },
    base: { hiring: 7, shiptime: 7, scale: 7, cost: 8, ecosystem: 9 },
    alignsSkills: ["python", "javascript"],
    fitsProducts: ["saas-web", "data-platform", "internal-tool", "api-only"],
    offlineOk: false, realtimeOk: false, seoOk: false,
    supportsCompliance: ["none", "gdpr", "soc2"],
  },
  {
    id: "vue-go-postgres",
    name: "Vue + Go/Fiber + Postgres",
    summary: "High-throughput API-first stack. Go's goroutines handle many concurrent connections cheaply.",
    choices: {
      frontend: {
        layer: "frontend", name: "Vue 3 (Nuxt)", category: "Vue meta-framework",
        rationale: "SSR-capable, smaller learning curve than React for designers.",
        alternative: "Pick SvelteKit instead if bundle size and DX matter most.",
      },
      backend: {
        layer: "backend", name: "Go + Fiber", category: "Go web framework",
        rationale: "Express-like ergonomics with Go's concurrency. Tiny memory footprint.",
        alternative: "Pick Echo instead if you want middleware heavy customization.",
        scaleCeiling: "~20000 RPS on 2 vCPU (Go routinely leads TechEmpower plaintext)",
      },
      database: {
        layer: "database", name: "PostgreSQL", category: "Relational DB",
        rationale: "Pgx driver is best-in-class. Connection pooling via pgBouncer.",
        alternative: "Pick CockroachDB instead if you need multi-region active-active.",
        costEstimate: "$0 self-host, $15–200/mo managed",
      },
      hosting: {
        layer: "hosting", name: "Fly.io", category: "Edge PaaS",
        rationale: "Deploy Go binaries close to users. Cheap scaling. Native Postgres clusters.",
        alternative: "Pick GCP Cloud Run instead if you're already on Google Cloud.",
        costEstimate: "$0 free, $5–50/mo small, $50+/mo at scale",
      },
      auth: {
        layer: "auth", name: "Clerk / Auth0", category: "Managed auth",
        rationale: "Drop-in Vue/React components. No need to build MFA/SSO.",
        alternative: "Pick Ory Kratos instead if you want self-hosted GDPR-first auth.",
      },
    },
    base: { hiring: 6, shiptime: 6, scale: 10, cost: 9, ecosystem: 7 },
    alignsSkills: ["go", "javascript"],
    fitsProducts: ["api-only", "realtime-collab", "saas-web", "ecommerce"],
    offlineOk: true, realtimeOk: true, seoOk: true,
    supportsCompliance: ["none", "gdpr", "soc2", "hipaa"],
  },
  {
    id: "sveltekit-hono-sqlite",
    name: "SvelteKit + Hono + SQLite",
    summary: "Smallest blast radius. Perfect for indie hackers and edge-first apps. SQLite/Turso = zero DB ops.",
    choices: {
      frontend: {
        layer: "frontend", name: "SvelteKit", category: "Svelte meta-framework",
        rationale: "Smallest bundles, friendliest DX, SSR + edge-ready.",
        alternative: "Pick Astro instead if your site is mostly content.",
      },
      backend: {
        layer: "backend", name: "Hono (edge)", category: "Edge-first web framework",
        rationale: "Runs on Cloudflare Workers, Deno, Bun, Node. Type-safe routing.",
        alternative: "Pick tRPC instead if you want end-to-end TS RPC without schemas.",
        scaleCeiling: "~5000 RPS per worker; scales horizontally on edge",
      },
      database: {
        layer: "database", name: "SQLite (Turso)", category: "Embedded/edge DB",
        rationale: "Zero-ops, edge-replicated. Free tier huge. Backed by libSQL.",
        alternative: "Pick Postgres instead if you need heavy write concurrency or stored procs.",
        costEstimate: "$0 free (500 DBs), $29/mo pro",
      },
      hosting: {
        layer: "hosting", name: "Cloudflare Pages", category: "Edge PaaS",
        rationale: "Free tier massive. Workers/Pages/Functions all edge-deployed.",
        alternative: "Pick Netlify instead if you want a simpler UX.",
        costEstimate: "$0 free, $5–20/mo pro",
      },
      auth: {
        layer: "auth", name: "Lucia", category: "Self-hosted auth library",
        rationale: "Lightweight, session-based, zero per-MAU cost. Works on edge.",
        alternative: "Pick Better-Auth instead if you want OAuth providers baked in.",
      },
    },
    base: { hiring: 5, shiptime: 8, scale: 6, cost: 10, ecosystem: 7 },
    alignsSkills: ["typescript", "javascript"],
    fitsProducts: ["marketing-site", "saas-web", "internal-tool", "api-only"],
    offlineOk: false, realtimeOk: false, seoOk: true,
    supportsCompliance: ["none", "gdpr"],
  },
  {
    id: "remix-rust-postgres",
    name: "Remix + Rust/Axum + Postgres",
    summary: "Max performance ceiling. Steeper hiring. Best when team already knows Rust or scale is the priority.",
    choices: {
      frontend: {
        layer: "frontend", name: "Remix", category: "React meta-framework",
        rationale: "Web-standard focused. Nested routing. SSR/SSG/streaming built-in.",
        alternative: "Pick Next.js instead if you want the largest React ecosystem.",
      },
      backend: {
        layer: "backend", name: "Rust + Axum", category: "Rust web framework",
        rationale: "Top of TechEmpower. Memory-safe. Tiny containers.",
        alternative: "Pick Go/Fiber instead if you don't need borrow-checker pain.",
        scaleCeiling: "~50000+ RPS on 2 vCPU (TechEmpower top tier)",
      },
      database: {
        layer: "database", name: "PostgreSQL (SQLx)", category: "Relational DB",
        rationale: "SQLx gives compile-time SQL checking. Postgres + Rust = high-throughput combo.",
        alternative: "Pick ScyllaDB instead if you need Cassandra-like write throughput.",
        costEstimate: "$0 self-host, $15–200/mo managed",
      },
      hosting: {
        layer: "hosting", name: "Railway / Shuttle", category: "PaaS",
        rationale: "Railway is generic; Shuttle is Rust-native. Both ship binaries.",
        alternative: "Pick Fly.io instead if you want multi-region edge.",
        costEstimate: "$0 free, $5–50/mo starter",
      },
      auth: {
        layer: "auth", name: "Auth0 / Ory", category: "Managed or self-host",
        rationale: "Auth0 is fastest to ship. Ory is open-source and self-hostable.",
        alternative: "Pick Auth0 instead if you don't want to run infra.",
      },
    },
    base: { hiring: 3, shiptime: 4, scale: 10, cost: 8, ecosystem: 5 },
    alignsSkills: ["rust"],
    fitsProducts: ["api-only", "realtime-collab", "data-platform", "saas-web"],
    offlineOk: true, realtimeOk: true, seoOk: true,
    supportsCompliance: ["none", "gdpr", "soc2", "hipaa"],
  },
  {
    id: "angular-spring-mysql",
    name: "Angular + Java/Spring + MySQL",
    summary: "Enterprise classic. Strong typing, long-term support contracts, and a deep tooling ecosystem. HIPAA/SOC2-friendly.",
    choices: {
      frontend: {
        layer: "frontend", name: "Angular", category: "Enterprise SPA framework",
        rationale: "Opinionated, batteries-included. Big-team friendly. Long-term LTS.",
        alternative: "Pick React+Next.js instead if hiring pool matters more than structure.",
      },
      backend: {
        layer: "backend", name: "Java + Spring Boot", category: "JVM web framework",
        rationale: "Mature, observability-rich, contract-first. Huge enterprise ecosystem.",
        alternative: "Pick Kotlin/Spring instead if you want modern syntax on the JVM.",
        scaleCeiling: "~5000 RPS on 2 vCPU (JVM warmup matters; steady-state is excellent)",
      },
      database: {
        layer: "database", name: "MySQL (Aurora/RDS)", category: "Relational DB",
        rationale: "Mature, well-understood by enterprise DBAs. Aurora = multi-AZ by default.",
        alternative: "Pick Postgres instead if you want JSONB and richer types.",
        costEstimate: "$15–500/mo managed, scales with replicas",
      },
      hosting: {
        layer: "hosting", name: "AWS ECS/Fargate", category: "Container orchestration",
        rationale: "Fine-grained control. Native ALB, IAM, CloudWatch. SOC2/HIPAA-ready.",
        alternative: "Pick EKS instead if you want Kubernetes-native.",
        costEstimate: "$50+/mo minimum, $200–2K/mo at scale",
      },
      auth: {
        layer: "auth", name: "Keycloak / Auth0", category: "Self-host or managed IdP",
        rationale: "Keycloak = self-hosted SSO/OIDC. Auth0 = managed equivalent.",
        alternative: "Pick Okta instead if you want enterprise SAML support out of the box.",
      },
    },
    base: { hiring: 8, shiptime: 5, scale: 9, cost: 4, ecosystem: 9 },
    alignsSkills: ["java"],
    fitsProducts: ["saas-web", "saas-mobile", "internal-tool", "ecommerce"],
    offlineOk: true, realtimeOk: true, seoOk: false,
    supportsCompliance: ["none", "gdpr", "soc2", "hipaa", "fedramp"],
  },
];

// ---------- Helpers ----------

/** Clamp a number to [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Normalize a comma-separated string into a Skill[]. Unknown skills are dropped. */
export function parseSkills(input: string): Skill[] {
  const valid = Object.keys(SKILL_LABELS) as Skill[];
  const out: Skill[] = [];
  for (const piece of input.toLowerCase().split(/[,\s]+/)) {
    const s = piece.trim() as Skill;
    if (valid.includes(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

/** Validate a product profile: returns an array of error strings (empty = valid). */
export function validateProfile(p: ProductProfile): string[] {
  const errs: string[] = [];
  if (!p.productType) errs.push("Product type is required.");
  if (!p.teamSize) errs.push("Team size is required.");
  if (!p.timeline) errs.push("Timeline is required.");
  if (!p.scale) errs.push("Scale is required.");
  if (!p.budget) errs.push("Budget is required.");
  if (!p.compliance) errs.push("Compliance is required.");
  if (!Array.isArray(p.skills) || p.skills.length === 0) errs.push("Select at least one team skill.");
  return errs;
}

/** Adjust base scores by profile. Higher = better fit. */
function adjustScores(stack: StackDef, profile: ProductProfile): {
  hiring: number; shiptime: number; scale: number; cost: number; ecosystem: number;
} {
  let { hiring, shiptime, scale, cost, ecosystem } = stack.base;

  // Skill match → boosts hiring + shiptime
  const skillMatch = profile.skills.filter((s) => stack.alignsSkills.includes(s)).length;
  const skillTotal = profile.skills.length || 1;
  const skillRatio = skillMatch / skillTotal;
  hiring = clamp(hiring + skillRatio * 1.5, 0, 10);
  shiptime = clamp(shiptime + skillRatio * 1.5, 0, 10);

  // Product type fit → boosts shiptime + ecosystem
  if (stack.fitsProducts.includes(profile.productType)) {
    shiptime = clamp(shiptime + 1, 0, 10);
    ecosystem = clamp(ecosystem + 0.5, 0, 10);
  }

  // Timeline → fast timelines favor high shiptime stacks
  if (profile.timeline === "weekend" || profile.timeline === "month") {
    if (stack.base.shiptime < 7) shiptime = clamp(shiptime - 1, 0, 10);
  } else if (profile.timeline === "year") {
    // long timelines forgive harder stacks
    shiptime = clamp(shiptime + 0.5, 0, 10);
  }

  // Scale → big scale rewards high scale ceiling
  if (profile.scale === "large" || profile.scale === "huge") {
    if (stack.base.scale < 8) scale = clamp(scale - 1.5, 0, 10);
    else scale = clamp(scale + 0.5, 0, 10);
  } else {
    // small scale penalizes over-engineered stacks on cost
    if (stack.base.scale >= 9) cost = clamp(cost - 1, 0, 10);
  }

  // Budget → low budget penalizes expensive stacks
  if (profile.budget === "shoestring" || profile.budget === "lean") {
    if (stack.base.cost < 6) cost = clamp(cost - 1.5, 0, 10);
    else cost = clamp(cost + 0.5, 0, 10);
  } else if (profile.budget === "enterprise") {
    if (stack.base.cost < 6) cost = clamp(cost + 0.5, 0, 10);
  }

  // Compliance mismatch is a hard penalty applied at filter time,
  // but supported stacks get a small ecosystem bump.
  if (stack.supportsCompliance.includes(profile.compliance)) {
    ecosystem = clamp(ecosystem + 0.3, 0, 10);
  }

  // Realtime / SEO / offline hard requirements applied as penalties here too
  if (profile.realtime && !stack.realtimeOk) {
    scale = clamp(scale - 2, 0, 10);
    shiptime = clamp(shiptime - 1, 0, 10);
  }
  if (profile.seoCritical && !stack.seoOk) {
    shiptime = clamp(shiptime - 1, 0, 10);
  }
  if (profile.offline && !stack.offlineOk) {
    cost = clamp(cost - 3, 0, 10);
    scale = clamp(scale - 2, 0, 10);
  }

  // Team size: large teams need hiring-friendly, opinionated frameworks
  if (profile.teamSize === "large") {
    if (stack.base.hiring >= 8) hiring = clamp(hiring + 0.5, 0, 10);
    else hiring = clamp(hiring - 1, 0, 10);
  }
  if (profile.teamSize === "solo") {
    // solo founders benefit from batteries-included stacks
    shiptime = clamp(shiptime + 0.5, 0, 10);
  }

  return { hiring, shiptime, scale, cost, ecosystem };
}

/** Build a scorecard from raw scores + weights. */
export function buildScorecard(
  raw: { hiring: number; shiptime: number; scale: number; cost: number; ecosystem: number },
  weights: ScoreWeights,
): ScorecardAxis[] {
  const axes: ScorecardAxis[] = [
    { key: "hiring", label: "Hiring ease", rawScore: raw.hiring, weight: weights.hiring, weightedScore: raw.hiring * weights.hiring },
    { key: "shiptime", label: "Time to ship", rawScore: raw.shiptime, weight: weights.shiptime, weightedScore: raw.shiptime * weights.shiptime },
    { key: "scale", label: "Scale ceiling", rawScore: raw.scale, weight: weights.scale, weightedScore: raw.scale * weights.scale },
    { key: "cost", label: "Cost efficiency", rawScore: raw.cost, weight: weights.cost, weightedScore: raw.cost * weights.cost },
    { key: "ecosystem", label: "Ecosystem maturity", rawScore: raw.ecosystem, weight: weights.ecosystem, weightedScore: raw.ecosystem * weights.ecosystem },
  ];
  return axes;
}

/** Total weighted score (0–10 scale). */
export function totalScore(axes: ScorecardAxis[]): number {
  return axes.reduce((s, a) => s + a.weightedScore, 0);
}

/** Map a 0–10 score to 1–5 stars. */
export function scoreToStars(score: number): number {
  // Max possible = 10 (if all weights sum to 1 and all raw = 10).
  return clamp(Math.round((score / 10) * 5 * 2) / 2, 1, 5);
}

/** Returns true if the stack satisfies the profile's hard requirements. */
export function satisfiesHardRequirements(stack: StackDef, profile: ProductProfile): boolean {
  if (profile.compliance !== "none" && !stack.supportsCompliance.includes(profile.compliance)) {
    return false;
  }
  if (profile.offline && !stack.offlineOk) return false;
  // realtime + seo are soft penalties, not hard filters — keep them in the pool.
  return true;
}

// ---------- Build a StackCandidate from a StackDef ----------

function buildCandidate(stack: StackDef, profile: ProductProfile, weights: ScoreWeights): StackCandidate {
  const raw = adjustScores(stack, profile);
  const scores = buildScorecard(raw, weights);
  const total = totalScore(scores);
  return {
    id: stack.id,
    name: stack.name,
    summary: stack.summary,
    choices: stack.choices,
    scores,
    totalScore: total,
    stars: scoreToStars(total),
  };
}

// ---------- Honesty notes ----------

function buildHonestyNotes(profile: ProductProfile): string[] {
  const notes: string[] = [];
  notes.push("There is no single 'best' stack — this is a starting recommendation, not gospel. Validate against your own load tests and team reality.");
  notes.push("The 'best' choice depends on factors the questionnaire can't capture: domain knowledge, existing code, vendor relationships, and taste. Treat this as one input, not the answer.");
  if (profile.compliance === "hipaa") {
    notes.push("HIPAA compliance is about people, processes, and BAs — not just the stack. Budget for audits and a HIPAA-friendly host.");
  }
  if (profile.compliance === "fedramp") {
    notes.push("FedRAMP authorization is a multi-month, six-figure process. The stack is the easy part.");
  }
  if (profile.scale === "huge") {
    notes.push("At 100K+ users, the stack matters less than your data model, caching strategy, and sharding. Plan for DB ops cost.");
  }
  if (profile.budget === "shoestring" && profile.scale === "huge") {
    notes.push("Shoestring budget + huge scale is contradictory. Expect to spend most of your time on cost optimization.");
  }
  if (profile.timeline === "weekend" && profile.teamSize === "large") {
    notes.push("Weekend timeline with a large team rarely works — coordination overhead dominates. Cut scope or extend timeline.");
  }
  if (profile.realtime) {
    notes.push("Realtime apps need careful thought about connection limits, fan-out, and presence. Don't underestimate ops cost.");
  }
  notes.push("Cost and scale numbers are estimates from public benchmarks (TechEmpower, State-of-JS) as of 2024–2025. Always validate against your own workload.");
  return notes;
}

// ---------- Main: recommend ----------

/** Recommend a stack for the given profile + weights. */
export function recommend(profile: ProductProfile, weights: ScoreWeights = DEFAULT_WEIGHTS): Recommendation {
  const valid = STACKS.filter((s) => satisfiesHardRequirements(s, profile));
  // If everything is filtered out (shouldn't happen — every stack supports "none"),
  // fall back to the full pool so the user still gets something.
  const pool = valid.length > 0 ? valid : STACKS;
  const candidates = pool.map((s) => buildCandidate(s, profile, weights));
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  const primary = candidates[0];
  const alternatives = candidates.slice(1, 4); // up to 3 alternatives
  return {
    profile,
    primary,
    alternatives,
    weights,
    honestyNotes: buildHonestyNotes(profile),
    generatedAt: Date.now(),
  };
}

// ---------- Compare two stacks side-by-side ----------

export interface StackComparison {
  left: StackCandidate;
  right: StackCandidate;
  deltas: { axis: ScorecardAxis["key"]; label: string; delta: number; winner: "left" | "right" | "tie" }[];
  totalDelta: number;
  overallWinner: "left" | "right" | "tie";
}

export function compareStacks(left: StackCandidate, right: StackCandidate): StackComparison {
  const deltas = left.scores.map((ax, i) => {
    const r = right.scores[i];
    const d = ax.weightedScore - r.weightedScore;
    const winner: "left" | "right" | "tie" = Math.abs(d) < 0.05 ? "tie" : d > 0 ? "left" : "right";
    return { axis: ax.key, label: ax.label, delta: d, winner };
  });
  const totalDelta = deltas.reduce((s, d) => s + d.delta, 0);
  const overallWinner: "left" | "right" | "tie" = Math.abs(totalDelta) < 0.1 ? "tie" : totalDelta > 0 ? "left" : "right";
  return { left, right, deltas, totalDelta, overallWinner };
}

// ---------- Render ----------

/** Render the recommendation as a Markdown ADR (Architecture Decision Record). */
export function renderAdr(rec: Recommendation): string {
  const date = new Date(rec.generatedAt).toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# ADR: Tech Stack Selection`);
  lines.push("");
  lines.push(`- **Date:** ${date}`);
  lines.push(`- **Status:** Proposed`);
  lines.push(`- **Decision Driver:** UnQTools AI Tech Stack Recommender (on-device)`);
  lines.push("");
  lines.push(`## Context`);
  lines.push("");
  lines.push(`- Product type: ${PRODUCT_TYPE_LABELS[rec.profile.productType]}`);
  lines.push(`- Team size: ${TEAM_SIZE_LABELS[rec.profile.teamSize]}`);
  lines.push(`- Team skills: ${rec.profile.skills.map((s) => SKILL_LABELS[s]).join(", ")}`);
  lines.push(`- Timeline: ${TIMELINE_LABELS[rec.profile.timeline]}`);
  lines.push(`- Expected scale: ${SCALE_LABELS[rec.profile.scale]}`);
  lines.push(`- Budget: ${BUDGET_LABELS[rec.profile.budget]}`);
  lines.push(`- Compliance: ${COMPLIANCE_LABELS[rec.profile.compliance]}`);
  lines.push(`- Offline requirement: ${rec.profile.offline ? "yes" : "no"}`);
  lines.push(`- Realtime requirement: ${rec.profile.realtime ? "yes" : "no"}`);
  lines.push(`- SEO critical: ${rec.profile.seoCritical ? "yes" : "no"}`);
  lines.push("");
  lines.push(`## Decision`);
  lines.push("");
  lines.push(`**Chosen stack: ${rec.primary.name}** (score: ${rec.primary.totalScore.toFixed(2)} / 10, ${rec.primary.stars}★)`);
  lines.push("");
  lines.push(`${rec.primary.summary}`);
  lines.push("");
  lines.push(`### Layer-by-layer`);
  lines.push("");
  (Object.keys(rec.primary.choices) as LayerKey[]).forEach((layer) => {
    const c = rec.primary.choices[layer];
    lines.push(`#### ${layer.toUpperCase()}: ${c.name} (${c.category})`);
    lines.push("");
    lines.push(`- **Why:** ${c.rationale}`);
    lines.push(`- **Alternative:** ${c.alternative}`);
    if (c.costEstimate) lines.push(`- **Cost estimate:** ${c.costEstimate}`);
    if (c.scaleCeiling) lines.push(`- **Scale ceiling:** ${c.scaleCeiling}`);
    lines.push("");
  });
  lines.push(`## Scorecard`);
  lines.push("");
  lines.push(`| Axis | Raw (0–10) | Weight | Weighted |`);
  lines.push(`|------|-----------:|-------:|---------:|`);
  for (const ax of rec.primary.scores) {
    lines.push(`| ${ax.label} | ${ax.rawScore.toFixed(1)} | ${(ax.weight * 100).toFixed(0)}% | ${ax.weightedScore.toFixed(2)} |`);
  }
  lines.push(`| **Total** |  | 100% | **${rec.primary.totalScore.toFixed(2)}** |`);
  lines.push("");
  lines.push(`## Alternatives considered`);
  lines.push("");
  for (const alt of rec.alternatives) {
    lines.push(`- **${alt.name}** — score ${alt.totalScore.toFixed(2)} (${alt.stars}★). ${alt.summary}`);
  }
  lines.push("");
  lines.push(`## Honesty notes`);
  lines.push("");
  for (const n of rec.honestyNotes) {
    lines.push(`- ${n}`);
  }
  lines.push("");
  lines.push(`## Consequences`);
  lines.push("");
  lines.push(`- Hiring: ${rec.primary.scores.find((s) => s.key === "hiring")!.rawScore.toFixed(1)}/10 — adjust team plan accordingly.`);
  lines.push(`- Cost: see per-layer estimates above. Validate with real cloud quotes.`);
  lines.push(`- Lock-in: review per-layer alternatives before scaling.`);
  return lines.join("\n");
}

/** Render the recommendation as plain text (compact). */
export function renderText(rec: Recommendation): string {
  const lines: string[] = [];
  lines.push(`Tech Stack Recommendation — ${rec.primary.name}`);
  lines.push(`Score: ${rec.primary.totalScore.toFixed(2)} / 10 (${rec.primary.stars}★)`);
  lines.push("");
  lines.push("Layers:");
  (Object.keys(rec.primary.choices) as LayerKey[]).forEach((layer) => {
    const c = rec.primary.choices[layer];
    lines.push(`  ${layer}: ${c.name} — ${c.rationale}`);
  });
  lines.push("");
  lines.push("Alternatives:");
  for (const alt of rec.alternatives) {
    lines.push(`  - ${alt.name} (${alt.totalScore.toFixed(2)})`);
  }
  lines.push("");
  lines.push("Honesty notes:");
  for (const n of rec.honestyNotes) lines.push(`  - ${n}`);
  return lines.join("\n");
}

/** Render as JSON for programmatic consumption. */
export function renderJson(rec: Recommendation): string {
  return JSON.stringify({
    generatedAt: new Date(rec.generatedAt).toISOString(),
    profile: rec.profile,
    weights: rec.weights,
    primary: {
      id: rec.primary.id,
      name: rec.primary.name,
      summary: rec.primary.summary,
      totalScore: rec.primary.totalScore,
      stars: rec.primary.stars,
      choices: rec.primary.choices,
      scores: rec.primary.scores.map((s) => ({ axis: s.key, label: s.label, raw: s.rawScore, weight: s.weight, weighted: s.weightedScore })),
    },
    alternatives: rec.alternatives.map((a) => ({
      id: a.id, name: a.name, summary: a.summary, totalScore: a.totalScore, stars: a.stars,
    })),
    honestyNotes: rec.honestyNotes,
  }, null, 2);
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(profile: Partial<ProductProfile>, weights: Partial<ScoreWeights> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(profile)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      params.set(k, v.join(","));
    } else {
      params.set(k, String(v));
    }
  }
  for (const [k, v] of Object.entries(weights)) {
    if (v === undefined || v === null) continue;
    params.set(`w_${k}`, String(v));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { profile: {}, weights: {} };
  const params = new URLSearchParams(clean);
  const profile: Partial<ProductProfile> = {};
  const weights: Partial<ScoreWeights> = {};

  const validProductTypes = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];
  const validTeamSizes = Object.keys(TEAM_SIZE_LABELS) as TeamSize[];
  const validTimelines = Object.keys(TIMELINE_LABELS) as Timeline[];
  const validScales = Object.keys(SCALE_LABELS) as Scale[];
  const validBudgets = Object.keys(BUDGET_LABELS) as Budget[];
  const validCompliance = Object.keys(COMPLIANCE_LABELS) as Compliance[];
  const validSkills = Object.keys(SKILL_LABELS) as Skill[];

  for (const [k, v] of params.entries()) {
    if (k === "productType" && validProductTypes.includes(v as ProductType)) {
      profile.productType = v as ProductType;
    } else if (k === "teamSize" && validTeamSizes.includes(v as TeamSize)) {
      profile.teamSize = v as TeamSize;
    } else if (k === "timeline" && validTimelines.includes(v as Timeline)) {
      profile.timeline = v as Timeline;
    } else if (k === "scale" && validScales.includes(v as Scale)) {
      profile.scale = v as Scale;
    } else if (k === "budget" && validBudgets.includes(v as Budget)) {
      profile.budget = v as Budget;
    } else if (k === "compliance" && validCompliance.includes(v as Compliance)) {
      profile.compliance = v as Compliance;
    } else if (k === "skills") {
      profile.skills = v.split(",").filter((s) => validSkills.includes(s as Skill)) as Skill[];
    } else if (k === "offline") {
      profile.offline = v === "true" || v === "1";
    } else if (k === "realtime") {
      profile.realtime = v === "true" || v === "1";
    } else if (k === "seoCritical") {
      profile.seoCritical = v === "true" || v === "1";
    } else if (k.startsWith("w_")) {
      const wkey = k.slice(2) as keyof ScoreWeights;
      const num = parseFloat(v);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        (weights as Record<string, number>)[wkey] = num;
      }
    }
  }
  return { profile, weights };
}

// ---------- LLM prompt (BYO key) ----------

export function buildLlmPrompt(profile: ProductProfile, primary: StackCandidate): LlmPrompt {
  return {
    system: "You are a senior staff engineer helping a team choose a tech stack. Be opinionated but transparent. List concrete tradeoffs. Never funnel to a paid product. Output Markdown only — no preamble.",
    user: `Given this product profile, write a 1-paragraph rationale for the recommended stack and suggest ONE alternative stack the team should prototype in parallel.

## Product profile
- Type: ${PRODUCT_TYPE_LABELS[profile.productType]}
- Team: ${TEAM_SIZE_LABELS[profile.teamSize]} with skills in ${profile.skills.map((s) => SKILL_LABELS[s]).join(", ")}
- Timeline: ${TIMELINE_LABELS[profile.timeline]}
- Scale: ${SCALE_LABELS[profile.scale]}
- Budget: ${BUDGET_LABELS[profile.budget]}
- Compliance: ${COMPLIANCE_LABELS[profile.compliance]}
- Offline required: ${profile.offline ? "yes" : "no"}
- Realtime: ${profile.realtime ? "yes" : "no"}
- SEO critical: ${profile.seoCritical ? "yes" : "no"}

## Recommended (by on-device rule engine)
- ${primary.name} (score ${primary.totalScore.toFixed(2)} / 10, ${primary.stars}★)
- ${primary.summary}

Layers:
${(Object.keys(primary.choices) as LayerKey[]).map((l) => `- ${l}: ${primary.choices[l].name} — ${primary.choices[l].rationale}`).join("\n")}

Scorecard:
${primary.scores.map((s) => `- ${s.label}: ${s.rawScore.toFixed(1)}/10 (weight ${(s.weight * 100).toFixed(0)}%)`).join("\n")}

Write the rationale and alternative now. Include a "Honest limits" section. Cost/scale numbers are estimates — label them as such.`,
  };
}

export function renderLlmResult(raw: string): string {
  return raw.replace(/^```[\w]*\n?/g, "").replace(/\n?```$/g, "").trim();
}
