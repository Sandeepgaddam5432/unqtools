/**
 * AI User Story Creator (Agile/Scrum) — pure logic.
 *
 * Generate user stories with Given/When/Then acceptance criteria, INVEST
 * checks, story-point estimates, epic splitting, and task breakdown. Pure
 * functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type StoryFormat = "as-a" | "job-story" | "bmmn";

export type Persona =
  | "end-user"
  | "admin"
  | "developer"
  | "guest"
  | "manager"
  | "custom";

export type PointScale = "fibonacci" | "tshirt" | "powers-of-2";

export type InvestDimension =
  | "independent"
  | "negotiable"
  | "valuable"
  | "estimable"
  | "small"
  | "testable";

export type InvestVerdict = "pass" | "warn" | "fail";

export interface InvestResult {
  dimension: InvestDimension;
  verdict: InvestVerdict;
  reason: string;
}

export interface AcceptanceCriterion {
  id: string;
  scenario: string;
  given: string;
  when: string;
  then: string;
}

export interface EdgeCase {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface Task {
  id: string;
  description: string;
  hoursEstimate: number;
}

export interface UserStory {
  id: string;
  format: StoryFormat;
  role: string;
  feature: string;
  benefit: string;
  statement: string;       // rendered "As a … I want … so that …"
  persona: Persona;
  acceptanceCriteria: AcceptanceCriterion[];
  edgeCases: EdgeCase[];
  tasks: Task[];
  storyPoints: number | string;
  pointScale: PointScale;
  invest: InvestResult[];
  dependencies: string[];
  definitionOfDone: string[];
  notes: string;
  generatedAt: number;
}

export interface StoryStats {
  totalStories: number;
  totalPoints: number | null;
  totalTasks: number;
  totalAC: number;
  totalEdgeCases: number;
  investPassCount: number;
  investWarnCount: number;
  investFailCount: number;
}

export interface HistoryEntry {
  ts: number;
  feature: string;
  persona: Persona;
  storyCount: number;
  totalPoints: string;
  format: StoryFormat;
}

export interface ShareState {
  feature: string;
  persona: Persona;
  format: StoryFormat;
  scale: PointScale;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-user-story-creator:history";
export const HISTORY_MAX = 20;

export const FORMAT_LABELS: Record<StoryFormat, string> = {
  "as-a": "As-a / I want / so that (standard)",
  "job-story": "Job Story (When / I want / so that)",
  "bmmn": "B-MMN (Business / Measure / Monitor / Notify)",
};

export const PERSONA_LABELS: Record<Persona, string> = {
  "end-user": "End user (customer)",
  "admin": "Administrator",
  "developer": "Developer / engineer",
  "guest": "Guest / anonymous visitor",
  "manager": "Product manager / stakeholder",
  "custom": "Custom role",
};

export const PERSONA_DEFAULT_ROLES: Record<Persona, string> = {
  "end-user": "registered user",
  "admin": "system administrator",
  "developer": "engineer on the platform team",
  "guest": "anonymous visitor",
  "manager": "product manager",
  "custom": "user",
};

export const SCALE_LABELS: Record<PointScale, string> = {
  "fibonacci": "Fibonacci (1, 2, 3, 5, 8, 13, 21)",
  "tshirt": "T-shirt (XS, S, M, L, XL)",
  "powers-of-2": "Powers of 2 (1, 2, 4, 8, 16)",
};

export const SCALE_VALUES: Record<PointScale, (number | string)[]> = {
  "fibonacci": [1, 2, 3, 5, 8, 13, 21],
  "tshirt": ["XS", "S", "M", "L", "XL"],
  "powers-of-2": [1, 2, 4, 8, 16],
};

export const INVEST_LABELS: Record<InvestDimension, string> = {
  "independent": "Independent",
  "negotiable": "Negotiable",
  "valuable": "Valuable",
  "estimable": "Estimable",
  "small": "Small",
  "testable": "Testable",
};

export const SAMPLE_FEATURES: string[] = [
  "Sign in with Google OAuth so users do not have to remember another password",
  "Export invoices to PDF and email them to customers automatically",
  "Admin dashboard showing active users, revenue, and churn",
  "Dark mode toggle that remembers the user's preference across sessions",
  "Bulk upload products via CSV with validation and error reporting",
  "Two-factor authentication using TOTP for admin accounts",
  "Real-time notifications when a teammate comments on your task",
  "Search across all project content with filters and saved queries",
];

// ---------- Pure helpers ----------

/** Normalize a feature string. */
export function normalizeFeature(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Lowercase + collapse whitespace (for keyword scanning). */
export function normalizeScan(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse bulk features (newline, semicolon, or numbered list). */
export function parseBulkFeatures(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\n|;|(?:^\s*\d+[.)]\s+)/m)
    .map((s) => normalizeFeature(s))
    .filter(Boolean);
}

/** Extract content keywords from a feature (stop-word filtered). */
export function extractKeywords(feature: string): string[] {
  const t = normalizeScan(feature);
  if (!t) return [];
  const STOP = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "else", "when", "where", "why", "how",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into",
    "that", "this", "these", "those", "it", "its", "they", "them", "their",
    "we", "us", "our", "you", "your", "he", "she", "him", "her", "his",
    "should", "would", "could", "can", "may", "might", "must", "shall",
    "not", "no", "yes", "do", "does", "did", "have", "has", "had",
    "what", "which", "who", "whom", "whose", "will",
    "me", "so", "up", "out", "want", "need", "users", "user", "system",
  ]);
  const words = t
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return Array.from(new Set(words));
}

/** Title-case a phrase. */
export function titleCase(s: string): string {
  const t = normalizeFeature(s);
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Detect the most likely persona from feature phrasing (heuristic). */
export function detectPersona(feature: string): Persona {
  const t = normalizeScan(feature);
  if (!t) return "end-user";
  if (/\b(admin|administrator|dashboard|moderator|back-?office)\b/.test(t)) return "admin";
  if (/\b(develop|api|sdk|webhook|integration|endpoint|deploy|migration|infra)\b/.test(t)) return "developer";
  if (/\b(guest|anonymous|visitor|sign-?up|first-?time|onboard)\b/.test(t)) return "guest";
  if (/\b(report|kpi|metric|stakeholder|approval|workflow|team)\b/.test(t)) return "manager";
  return "end-user";
}

/** Suggest sharper role options for a feature. */
export function suggestRoles(feature: string): string[] {
  const t = normalizeFeature(feature);
  if (!t) return [];
  const kw = extractKeywords(t);
  const main = kw[0] ?? t.toLowerCase();
  return [
    `registered user who needs ${main}`,
    `administrator who manages ${main}`,
    `new user encountering ${main} for the first time`,
    `power user who relies on ${main} daily`,
  ];
}

// ---------- Complexity scoring (for story points) ----------

interface SignalGroup {
  label: string;
  patterns: RegExp[];
  weight: number;
}

const COMPLEXITY_SIGNALS: SignalGroup[] = [
  { label: "data persistence", patterns: [/\bpersist|stor(e|ing)|database|schema|migration|crud\b/i], weight: 2 },
  { label: "external integration", patterns: [/\bintegrat|third-?party|api|webhook|oauth|sso|stripe|paypal|twilio\b/i], weight: 3 },
  { label: "authentication / authorization", patterns: [/\bauth|login|sign-?in|sign-?up|permission|role|rbac|2fa|mfa|totp\b/i], weight: 2 },
  { label: "performance / scale", patterns: [/\breal-?time|websocket|stream|bulk|batch|millions|thousands|scale|cache|queue\b/i], weight: 2 },
  { label: "payment / billing", patterns: [/\bpaid?|payment|invoice|subscription|billing|charge|refund|tax\b/i], weight: 2 },
  { label: "file handling", patterns: [/\bupload|download|csv|excel|pdf|file|image|attachment\b/i], weight: 1 },
  { label: "UI / UX complexity", patterns: [/\bdashboard|drag|drop|wizard|multi-?step|modal|sidebar|tab\b/i], weight: 1 },
  { label: "reporting / analytics", patterns: [/\breport|analytic|chart|graph|metric|kpi|export\b/i], weight: 1 },
  { label: "regulatory / compliance", patterns: [/\bgdpr|hipaa|pci|compliance|audit|consent|cookie\b/i], weight: 2 },
  { label: "uncertainty / experimental", patterns: [/\bexperimental|prototype|poc|investigate|research|spike\b/i], weight: 2 },
];

export interface ComplexityScore {
  total: number;
  signals: { label: string; weight: number; matches: string[] }[];
}

/** Score the complexity of a feature for story-point estimation. */
export function scoreComplexity(feature: string): ComplexityScore {
  const t = normalizeScan(feature);
  if (!t) return { total: 0, signals: [] };
  const signals: { label: string; weight: number; matches: string[] }[] = [];
  let total = 0;
  for (const group of COMPLEXITY_SIGNALS) {
    const matches: string[] = [];
    for (const re of group.patterns) {
      const m = t.match(re);
      if (m) matches.push(m[0]);
    }
    if (matches.length > 0) {
      total += group.weight * Math.min(matches.length, 2);
      signals.push({ label: group.label, weight: group.weight, matches: Array.from(new Set(matches)) });
    }
  }
  return { total, signals };
}

/** Map a complexity score onto a story-point scale. */
export function estimateStoryPoints(feature: string, scale: PointScale): number | string {
  const { total } = scoreComplexity(feature);
  const idx = Math.min(SCALE_VALUES[scale].length - 1, Math.floor(total / 2));
  return SCALE_VALUES[scale][idx];
}

/** Convert a story-point value to a numeric estimate (best-effort). */
export function pointsToNumber(value: number | string): number {
  if (typeof value === "number") return value;
  const tshirtMap: Record<string, number> = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
  return tshirtMap[value] ?? 0;
}

// ---------- Story rendering ----------

/** Render the story statement in the chosen format. */
export function renderStatement(
  format: StoryFormat,
  role: string,
  feature: string,
  benefit: string,
): string {
  const r = role || "user";
  const f = feature || "do something";
  const b = benefit || "achieve my goal";
  switch (format) {
    case "as-a":
      return `As a ${r}, I want ${f}, so that ${b}.`;
    case "job-story":
      return `When I need to ${b}, I want to ${f}, so I can ${b} as ${r}.`;
    case "bmmn":
      return `Business goal: ${b}. Measure: ${f}. Monitor: ${r} engagement. Notify: ${r} on completion.`;
  }
}

/** Infer the benefit (so-that clause) from a feature description. */
export function inferBenefit(feature: string): string {
  const t = normalizeFeature(feature);
  if (!t) return "achieve my goal efficiently";
  const lower = normalizeScan(t);
  if (/\b(dark mode)\b/.test(lower)) return "use the app comfortably in low-light environments";
  if (/\b(oauth|sso|sign in with)\b/.test(lower)) return "sign in without remembering another password";
  if (/\b(bulk|csv|upload)\b/.test(lower)) return "save time entering many items at once";
  if (/\b(dashboard|report|analytics|kpi)\b/.test(lower)) return "make decisions based on real-time data";
  if (/\b(search|filter)\b/.test(lower)) return "find what I need quickly";
  if (/\b(notification|alert)\b/.test(lower)) return "stay informed without checking constantly";
  if (/\b(export|download|pdf)\b/.test(lower)) return "share or archive the information";
  if (/\b(2fa|mfa|totp|security)\b/.test(lower)) return "protect my account from unauthorized access";
  if (/\b(import|migration)\b/.test(lower)) return "move my existing data without manual entry";
  return `accomplish my goal more efficiently with ${t.toLowerCase()}`;
}

/** Generate Given/When/Then acceptance criteria for a feature. */
export function generateAcceptanceCriteria(
  feature: string,
  persona: Persona,
): AcceptanceCriterion[] {
  const t = normalizeFeature(feature);
  if (!t) return [];
  const role = PERSONA_DEFAULT_ROLES[persona];
  const lower = normalizeScan(t);
  const out: AcceptanceCriterion[] = [];

  out.push({
    id: "ac-1",
    scenario: "happy path",
    given: `a ${role} with the necessary permissions`,
    when: `they ${t.toLowerCase()}`,
    then: `the action completes successfully and the ${role} sees a confirmation`,
  });

  out.push({
    id: "ac-2",
    scenario: "validation failure",
    given: `a ${role} who submits invalid input`,
    when: `they attempt to ${t.toLowerCase()}`,
    then: `the system rejects the input, displays a clear validation message, and preserves their other entries`,
  });

  out.push({
    id: "ac-3",
    scenario: "unauthorized access",
    given: `a visitor without the required role`,
    when: `they attempt to ${t.toLowerCase()}`,
    then: `the system denies access and redirects them to sign in or shows a 403 page`,
  });

  if (/\b(bulk|upload|csv|import)\b/.test(lower)) {
    out.push({
      id: "ac-4",
      scenario: "partial failure in bulk upload",
      given: `a ${role} uploading a file where some rows are invalid`,
      when: `they submit the file`,
      then: `valid rows are processed, invalid rows are skipped, and a downloadable error report lists each failed row with a reason`,
    });
  }

  if (/\b(real-?time|notification|websocket|live)\b/.test(lower)) {
    out.push({
      id: "ac-5",
      scenario: "real-time delivery under load",
      given: `multiple ${role}s acting on the same resource concurrently`,
      when: `an event is triggered`,
      then: `all connected ${role}s see the update within 2 seconds without needing to refresh`,
    });
  }

  if (/\b(pay|payment|billing|invoice|subscription|refund|charge|stripe|paypal|checkout)\b/.test(lower)) {
    out.push({
      id: "ac-6",
      scenario: "payment failure recovery",
      given: `a ${role} whose payment method is declined`,
      when: `they complete the action`,
      then: `no partial state is committed, the ${role} is shown the error, and they can retry with a different method`,
    });
  }

  return out;
}

/** Generate likely edge cases for a feature. */
export function generateEdgeCases(feature: string): EdgeCase[] {
  const t = normalizeFeature(feature);
  if (!t) return [];
  const lower = normalizeScan(t);
  const out: EdgeCase[] = [
    { id: "ec-1", description: "Network connection drops mid-action", severity: "medium" },
    { id: "ec-2", description: "User closes the browser or app before the action completes", severity: "low" },
    { id: "ec-3", description: "Very large input or payload exceeds limits", severity: "medium" },
  ];
  if (/\b(bulk|upload|csv|import)\b/.test(lower)) {
    out.push({ id: "ec-4", description: "File encoding is not UTF-8 (e.g. Windows-1252 or UTF-16)", severity: "medium" });
    out.push({ id: "ec-5", description: "File contains more rows than the configured limit", severity: "high" });
  }
  if (/\b(auth|login|sign|password)\b/.test(lower)) {
    out.push({ id: "ec-6", description: "User has 2FA enabled but loses their device", severity: "high" });
    out.push({ id: "ec-7", description: "Account is locked after too many failed attempts", severity: "medium" });
  }
  if (/\b(real-?time|notification|websocket)\b/.test(lower)) {
    out.push({ id: "ec-8", description: "WebSocket reconnects after temporary disconnection and deduplicates events", severity: "medium" });
  }
  if (/\b(pay|billing|invoice|subscription)\b/.test(lower)) {
    out.push({ id: "ec-9", description: "Currency conversion rate changes between quote and charge", severity: "high" });
  }
  return out;
}

/** Break a story into 3–5 concrete tasks. */
export function generateTasks(feature: string, persona: Persona): Task[] {
  const t = normalizeFeature(feature);
  if (!t) return [];
  const lower = normalizeScan(t);
  const tasks: Task[] = [
    { id: "t-1", description: `Define data model and write migrations for "${t}"`, hoursEstimate: 4 },
    { id: "t-2", description: `Implement backend service and API endpoints`, hoursEstimate: 6 },
    { id: "t-3", description: `Build the UI and wire it to the API`, hoursEstimate: 6 },
    { id: "t-4", description: `Write unit + integration tests covering happy path and validation`, hoursEstimate: 4 },
  ];
  if (persona === "admin") {
    tasks.push({ id: "t-5", description: `Add admin permissions check and audit log entry`, hoursEstimate: 2 });
  }
  if (/\b(upload|csv|file)\b/.test(lower)) {
    tasks.push({ id: "t-6", description: `Implement file size limit, MIME-type validation, and error report generation`, hoursEstimate: 3 });
  }
  if (/\b(real-?time|notification|websocket)\b/.test(lower)) {
    tasks.push({ id: "t-7", description: `Set up the real-time channel and reconnect/dedup logic`, hoursEstimate: 4 });
  }
  if (/\b(pay|billing|invoice)\b/.test(lower)) {
    tasks.push({ id: "t-8", description: `Integrate payment provider, handle webhooks, and add idempotency`, hoursEstimate: 6 });
  }
  return tasks.slice(0, 7);
}

/** Identify dependency notes (mentions of other features or stories). */
export function detectDependencies(feature: string): string[] {
  const t = normalizeScan(feature);
  if (!t) return [];
  const deps: string[] = [];
  const patterns: { re: RegExp; dep: string }[] = [
    { re: /\bdepends on\b(.+?)(?:\.|$)/, dep: "" },
    { re: /\bafter\s+(.+?)(?:is|are)\s+done\b/, dep: "" },
    { re: /\brequires?\s+(.+?)(?:\.|$)/, dep: "" },
  ];
  for (const { re } of patterns) {
    const m = t.match(re);
    if (m && m[1]) deps.push(`Depends on: ${m[1].trim()}`);
  }
  if (/\b(oauth|sso|sign in with)\b/.test(t) && !deps.some((d) => d.includes("auth"))) {
    deps.push("Depends on: existing authentication system");
  }
  if (/\b(notification|email|sms)\b/.test(t) && !deps.some((d) => d.includes("notification"))) {
    deps.push("Depends on: notification delivery service");
  }
  return Array.from(new Set(deps));
}

// ---------- INVEST check ----------

/** Run INVEST checks on a story and return per-dimension verdicts. */
export function runInvestCheck(story: Pick<
  UserStory,
  "feature" | "acceptanceCriteria" | "tasks" | "storyPoints" | "dependencies"
>): InvestResult[] {
  const results: InvestResult[] = [];
  const hasDep = story.dependencies.length > 0;
  results.push({
    dimension: "independent",
    verdict: hasDep ? "warn" : "pass",
    reason: hasDep
      ? `Story references dependencies: ${story.dependencies.join("; ")}. Confirm they can be delivered in the same sprint.`
      : "No cross-story dependencies detected.",
  });

  results.push({
    dimension: "negotiable",
    verdict: "pass",
    reason: "Story scope is described as an outcome, not a fixed implementation — the team can negotiate the approach.",
  });

  const benefitWords = story.feature.split(/\s+/).length;
  results.push({
    dimension: "valuable",
    verdict: benefitWords < 4 ? "warn" : "pass",
    reason: benefitWords < 4
      ? "Feature description is very short — clarify the user value before estimation."
      : "Story describes a user-facing benefit.",
  });

  const hasAC = story.acceptanceCriteria.length > 0;
  results.push({
    dimension: "estimable",
    verdict: hasAC ? "pass" : "warn",
    reason: hasAC
      ? "Acceptance criteria are defined — the team has enough to estimate."
      : "No acceptance criteria — the team cannot estimate reliably.",
  });

  const hours = story.tasks.reduce((s, x) => s + x.hoursEstimate, 0);
  results.push({
    dimension: "small",
    verdict: hours > 24 ? "fail" : hours > 16 ? "warn" : "pass",
    reason: hours > 24
      ? `Estimated work is ${hours}h — split this story before sprint planning.`
      : hours > 16
        ? `Estimated work is ${hours}h — borderline for one sprint.`
        : `Estimated work is ${hours}h — fits comfortably in a sprint.`,
  });

  results.push({
    dimension: "testable",
    verdict: hasAC ? "pass" : "fail",
    reason: hasAC
      ? "Given/When/Then acceptance criteria are defined — the story is testable."
      : "No acceptance criteria — the story is not testable as written.",
  });

  return results;
}

// ---------- Definition of Done ----------

export const DEFAULT_DEFINITION_OF_DONE: string[] = [
  "Code is reviewed by at least one other engineer",
  "Unit tests cover the happy path and at least one edge case",
  "Integration tests pass in CI",
  "Acceptance criteria are demonstrably met",
  "Documentation (README / API docs) is updated",
  "No new console errors or warnings",
  "Accessibility checks (keyboard + screen reader) pass",
  "Feature flag is configured and can be rolled back",
];

/** Build a definition-of-done checklist, optionally extended for the feature. */
export function buildDefinitionOfDone(feature: string): string[] {
  const t = normalizeScan(feature);
  const dod = [...DEFAULT_DEFINITION_OF_DONE];
  if (/\b(pay|payment|billing|invoice|subscription|refund|charge|stripe|paypal|checkout)\b/.test(t)) {
    dod.push("Idempotency is verified against duplicate webhooks");
    dod.push("Refund / chargeback flow is tested end-to-end");
  }
  if (/\b(upload|csv|import)\b/.test(t)) {
    dod.push("Large-file behavior is tested at the configured limit");
    dod.push("Malformed-file error report is reviewed");
  }
  if (/\b(real-?time|websocket|notification)\b/.test(t)) {
    dod.push("Reconnect and dedup behavior is verified");
  }
  return dod;
}

// ---------- Epic splitting ----------

const EPIC_SPLIT_AXES: { axis: string; re: RegExp }[] = [
  { axis: "by persona", re: /\b(user|admin|guest|manager|developer|customer|team)\b/i },
  { axis: "by lifecycle stage", re: /\b(create|edit|view|delete|archive|publish|share|export)\b/i },
  { axis: "by data type", re: /\b(invoice|user|product|order|task|project|comment|file)\b/i },
  { axis: "by channel", re: /\b(email|sms|web|mobile|desktop|api|dashboard)\b/i },
];

/** Suggest split axes for a large epic. */
export function suggestSplitAxes(epic: string): string[] {
  const t = normalizeScan(epic);
  if (!t) return ["by persona", "by lifecycle stage"];
  const out: string[] = [];
  for (const { axis, re } of EPIC_SPLIT_AXES) {
    if (re.test(t)) out.push(axis);
  }
  if (out.length === 0) out.push("by persona", "by lifecycle stage");
  return out;
}

/** Split an epic description into 2–4 smaller user stories. */
export function splitEpic(
  epic: string,
  persona: Persona,
  format: StoryFormat,
  scale: PointScale,
): UserStory[] {
  const t = normalizeFeature(epic);
  if (!t) return [];
  const lower = normalizeScan(t);
  const axes = suggestSplitAxes(t);
  const role = PERSONA_DEFAULT_ROLES[persona];

  // Try to split along discovered axes; fall back to a generic 3-way split.
  const splits: { feature: string; benefit: string }[] = [];

  if (axes.includes("by lifecycle stage")) {
    const stages = ["create", "view", "edit", "delete"];
    const present = stages.filter((s) => new RegExp(`\\b${s}\\b`, "i").test(lower));
    const list = present.length >= 2 ? present : ["create", "view", "edit"];
    for (const stage of list.slice(0, 4)) {
      splits.push({
        feature: `${stage} ${t.toLowerCase()}`,
        benefit: `manage the full lifecycle of ${t.toLowerCase()}`,
      });
    }
  } else if (axes.includes("by data type")) {
    const m = lower.match(/\b(invoice|user|product|order|task|project|comment|file)s?\b/);
    const subject = m ? m[0] : "the item";
    splits.push(
      { feature: `list and search ${subject}s`, benefit: "find what I need quickly" },
      { feature: `view a single ${subject} in detail`, benefit: "understand the current state" },
      { feature: `create or edit a ${subject}`, benefit: "keep records up to date" },
    );
  } else {
    splits.push(
      { feature: `set up ${t.toLowerCase()} for the first time`, benefit: "get started without help" },
      { feature: `use ${t.toLowerCase()} day-to-day`, benefit: "complete my regular work" },
      { feature: `administer and configure ${t.toLowerCase()}`, benefit: "adapt it to my team's needs" },
    );
  }

  const stories: UserStory[] = splits.map((s, i) => {
    const benefit = s.benefit || inferBenefit(s.feature);
    const ac = generateAcceptanceCriteria(s.feature, persona);
    const tasks = generateTasks(s.feature, persona);
    const points = estimateStoryPoints(s.feature, scale);
    const story: UserStory = {
      id: `story-${i + 1}`,
      format,
      role,
      feature: s.feature,
      benefit,
      statement: renderStatement(format, role, s.feature, benefit),
      persona,
      acceptanceCriteria: ac,
      edgeCases: generateEdgeCases(s.feature),
      tasks,
      storyPoints: points,
      pointScale: scale,
      invest: [],
      dependencies: detectDependencies(s.feature),
      definitionOfDone: buildDefinitionOfDone(s.feature),
      notes: `Split from epic: "${t}" along axis "${axes[0]}".`,
      generatedAt: Date.now(),
    };
    story.invest = runInvestCheck(story);
    return story;
  });

  return stories;
}

// ---------- Single story generation ----------

/** Generate a single user story from a feature. */
export function generateUserStory(
  feature: string,
  persona: Persona,
  format: StoryFormat,
  scale: PointScale,
): UserStory | null {
  const t = normalizeFeature(feature);
  if (!t) return null;
  const role = PERSONA_DEFAULT_ROLES[persona];
  const benefit = inferBenefit(t);
  const ac = generateAcceptanceCriteria(t, persona);
  const tasks = generateTasks(t, persona);
  const points = estimateStoryPoints(t, scale);
  const story: UserStory = {
    id: "story-1",
    format,
    role,
    feature: t,
    benefit,
    statement: renderStatement(format, role, t, benefit),
    persona,
    acceptanceCriteria: ac,
    edgeCases: generateEdgeCases(t),
    tasks,
    storyPoints: points,
    pointScale: scale,
    invest: [],
    dependencies: detectDependencies(t),
    definitionOfDone: buildDefinitionOfDone(t),
    notes: "",
    generatedAt: Date.now(),
  };
  story.invest = runInvestCheck(story);
  return story;
}

/** Generate stories from one or more features (bulk mode). */
export function generateFromFeatures(
  features: string[],
  persona: Persona,
  format: StoryFormat,
  scale: PointScale,
): UserStory[] {
  const out: UserStory[] = [];
  let i = 0;
  for (const f of features) {
    const story = generateUserStory(f, persona, format, scale);
    if (story) {
      i += 1;
      story.id = `story-${i}`;
      out.push(story);
    }
  }
  return out;
}

// ---------- Stats ----------

/** Compute summary stats for a set of stories. */
export function computeStats(stories: UserStory[]): StoryStats {
  let investPass = 0, investWarn = 0, investFail = 0;
  let totalTasks = 0, totalAC = 0, totalEdgeCases = 0;
  let totalPointsNumeric = 0;
  let anyNonNumeric = false;
  for (const s of stories) {
    for (const inv of s.invest) {
      if (inv.verdict === "pass") investPass += 1;
      else if (inv.verdict === "warn") investWarn += 1;
      else investFail += 1;
    }
    totalTasks += s.tasks.length;
    totalAC += s.acceptanceCriteria.length;
    totalEdgeCases += s.edgeCases.length;
    const n = pointsToNumber(s.storyPoints);
    if (typeof s.storyPoints === "string" && !["XS", "S", "M", "L", "XL"].includes(s.storyPoints)) {
      anyNonNumeric = true;
    } else {
      totalPointsNumeric += n;
    }
  }
  return {
    totalStories: stories.length,
    totalPoints: anyNonNumeric ? null : totalPointsNumeric,
    totalTasks,
    totalAC,
    totalEdgeCases,
    investPassCount: investPass,
    investWarnCount: investWarn,
    investFailCount: investFail,
  };
}

// ---------- Rendering ----------

/** Render stories as plain Markdown. */
export function renderMarkdown(stories: UserStory[]): string {
  const lines: string[] = [];
  for (const s of stories) {
    lines.push(`## ${s.id}: ${titleCase(s.feature)}`);
    lines.push("");
    lines.push(`> ${s.statement}`);
    lines.push("");
    lines.push(`**Persona:** ${PERSONA_LABELS[s.persona]}  `);
    lines.push(`**Story points:** ${s.storyPoints} (${SCALE_LABELS[s.pointScale]})  `);
    lines.push(`**Format:** ${FORMAT_LABELS[s.format]}`);
    lines.push("");
    if (s.acceptanceCriteria.length > 0) {
      lines.push(`### Acceptance Criteria`);
      for (const ac of s.acceptanceCriteria) {
        lines.push(`- **${ac.scenario}** — Given ${ac.given}, when ${ac.when}, then ${ac.then}.`);
      }
      lines.push("");
    }
    if (s.edgeCases.length > 0) {
      lines.push(`### Edge Cases`);
      for (const ec of s.edgeCases) {
        lines.push(`- [${ec.severity}] ${ec.description}`);
      }
      lines.push("");
    }
    if (s.tasks.length > 0) {
      lines.push(`### Tasks`);
      for (const t of s.tasks) {
        lines.push(`- [ ] ${t.description} (~${t.hoursEstimate}h)`);
      }
      lines.push("");
    }
    if (s.invest.length > 0) {
      lines.push(`### INVEST Check`);
      for (const inv of s.invest) {
        const mark = inv.verdict === "pass" ? "✓" : inv.verdict === "warn" ? "⚠" : "✗";
        lines.push(`- ${mark} **${INVEST_LABELS[inv.dimension]}** (${inv.verdict}) — ${inv.reason}`);
      }
      lines.push("");
    }
    if (s.dependencies.length > 0) {
      lines.push(`### Dependencies`);
      for (const d of s.dependencies) lines.push(`- ${d}`);
      lines.push("");
    }
    if (s.definitionOfDone.length > 0) {
      lines.push(`### Definition of Done`);
      for (const d of s.definitionOfDone) lines.push(`- [ ] ${d}`);
      lines.push("");
    }
    if (s.notes) {
      lines.push(`### Notes`);
      lines.push("");
      lines.push(s.notes);
      lines.push("");
    }
    lines.push(`---`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render stories as plain text. */
export function renderText(stories: UserStory[]): string {
  const lines: string[] = [];
  for (const s of stories) {
    lines.push(`${s.id.toUpperCase()}: ${s.statement}`);
    lines.push(`  Persona: ${PERSONA_LABELS[s.persona]}`);
    lines.push(`  Points: ${s.storyPoints} (${SCALE_LABELS[s.pointScale]})`);
    for (const ac of s.acceptanceCriteria) {
      lines.push(`  AC [${ac.scenario}]: Given ${ac.given}, when ${ac.when}, then ${ac.then}.`);
    }
    for (const ec of s.edgeCases) {
      lines.push(`  Edge [${ec.severity}]: ${ec.description}`);
    }
    for (const t of s.tasks) {
      lines.push(`  Task: ${t.description} (~${t.hoursEstimate}h)`);
    }
    for (const inv of s.invest) {
      const mark = inv.verdict === "pass" ? "OK" : inv.verdict === "warn" ? "WARN" : "FAIL";
      lines.push(`  INVEST ${INVEST_LABELS[inv.dimension]}: ${mark}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render stories as Jira-importable CSV. */
export function renderJiraCsv(stories: UserStory[]): string {
  const lines = ["Summary,Description,Story Points,Acceptance Criteria,Priority,Labels"];
  for (const s of stories) {
    const summary = titleCase(s.feature);
    const desc = `${s.statement}\n\n${s.tasks.map((t) => `- ${t.description}`).join("\n")}`;
    const ac = s.acceptanceCriteria
      .map((a) => `Given ${a.given}, when ${a.when}, then ${a.then}.`)
      .join(" | ");
    const points = String(s.storyPoints);
    const priority = s.invest.some((i) => i.verdict === "fail") ? "High" : "Medium";
    const labels = s.persona;
    lines.push([
      escapeCsv(summary),
      escapeCsv(desc),
      escapeCsv(points),
      escapeCsv(ac),
      priority,
      labels,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render stories as Azure DevOps-importable CSV. */
export function renderAzureCsv(stories: UserStory[]): string {
  const lines = ["Title,Description,Effort,Acceptance Criteria,Tags"];
  for (const s of stories) {
    const title = titleCase(s.feature);
    const desc = `${s.statement}\n\n${s.definitionOfDone.map((d) => `- ${d}`).join("\n")}`;
    const ac = s.acceptanceCriteria
      .map((a) => `Given ${a.given}, when ${a.when}, then ${a.then}.`)
      .join(" | ");
    lines.push([
      escapeCsv(title),
      escapeCsv(desc),
      escapeCsv(String(s.storyPoints)),
      escapeCsv(ac),
      s.persona,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render stories as JSON. */
export function renderJson(stories: UserStory[]): string {
  return JSON.stringify(stories, null, 2);
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

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.feature) params.set("feature", state.feature);
  if (state.persona) params.set("persona", state.persona);
  if (state.format) params.set("format", state.format);
  if (state.scale) params.set("scale", state.scale);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { feature: "", persona: "end-user", format: "as-a", scale: "fibonacci" };
  const params = new URLSearchParams(clean);
  const feature = params.get("feature") ?? "";
  const persona = params.get("persona") as Persona | null;
  const format = params.get("format") as StoryFormat | null;
  const scale = params.get("scale") as PointScale | null;
  const validPersonas: Persona[] = ["end-user", "admin", "developer", "guest", "manager", "custom"];
  const validFormats: StoryFormat[] = ["as-a", "job-story", "bmmn"];
  const validScales: PointScale[] = ["fibonacci", "tshirt", "powers-of-2"];
  return {
    feature,
    persona: persona && validPersonas.includes(persona) ? persona : "end-user",
    format: format && validFormats.includes(format) ? format : "as-a",
    scale: scale && validScales.includes(scale) ? scale : "fibonacci",
  };
}

// ---------- Optional LLM prompt builder ----------

export interface LlmPrompt {
  system: string;
  user: string;
}

export function buildLlmPrompt(
  feature: string,
  persona: Persona,
  format: StoryFormat,
  scale: PointScale,
): LlmPrompt {
  const system = `You are an expert Agile product owner. Produce a well-formed user story on the user's feature, using the ${FORMAT_LABELS[format]} format and the ${PERSONA_LABELS[persona]} persona. Return JSON with: statement (string), role (string), benefit (string), acceptanceCriteria (array of {scenario, given, when, then} in Gherkin style), edgeCases (array of {description, severity}), tasks (array of {description, hoursEstimate}), storyPoints (single value from the ${SCALE_LABELS[scale]} scale), invest (array of {dimension in [independent, negotiable, valuable, estimable, small, testable], verdict in [pass, warn, fail], reason}), dependencies (array of strings), and definitionOfDone (array of strings). Mark placeholders explicitly when source data is unknown. Do not fabricate stakeholder names or ticket IDs.`;
  const user = `Feature: ${feature}`;
  return { system, user };
}

export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
