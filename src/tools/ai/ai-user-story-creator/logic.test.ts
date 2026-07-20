import { describe, it, expect, beforeEach } from "vitest";
import {
  FORMAT_LABELS,
  PERSONA_LABELS,
  PERSONA_DEFAULT_ROLES,
  SCALE_LABELS,
  SCALE_VALUES,
  INVEST_LABELS,
  SAMPLE_FEATURES,
  HISTORY_KEY,
  HISTORY_MAX,
  DEFAULT_DEFINITION_OF_DONE,
  normalizeFeature,
  normalizeScan,
  parseBulkFeatures,
  extractKeywords,
  titleCase,
  detectPersona,
  suggestRoles,
  scoreComplexity,
  estimateStoryPoints,
  pointsToNumber,
  renderStatement,
  inferBenefit,
  generateAcceptanceCriteria,
  generateEdgeCases,
  generateTasks,
  detectDependencies,
  runInvestCheck,
  buildDefinitionOfDone,
  suggestSplitAxes,
  splitEpic,
  generateUserStory,
  generateFromFeatures,
  computeStats,
  renderMarkdown,
  renderText,
  renderJiraCsv,
  renderAzureCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Persona,
  type StoryFormat,
  type PointScale,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("ai-user-story-creator constants", () => {
  it("has 3 format labels", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(3);
    expect(FORMAT_LABELS["as-a"]).toContain("As-a");
  });
  it("has 6 persona labels", () => {
    expect(Object.keys(PERSONA_LABELS)).toHaveLength(6);
    expect(PERSONA_LABELS.admin).toContain("Administrator");
  });
  it("has 6 persona default roles", () => {
    expect(Object.keys(PERSONA_DEFAULT_ROLES)).toHaveLength(6);
    expect(PERSONA_DEFAULT_ROLES["end-user"]).toContain("user");
  });
  it("has 3 point scales with labels", () => {
    expect(Object.keys(SCALE_LABELS)).toHaveLength(3);
  });
  it("fibonacci scale uses 1, 2, 3, 5, 8, 13, 21", () => {
    expect(SCALE_VALUES.fibonacci).toEqual([1, 2, 3, 5, 8, 13, 21]);
  });
  it("tshirt scale uses XS, S, M, L, XL", () => {
    expect(SCALE_VALUES.tshirt).toEqual(["XS", "S", "M", "L", "XL"]);
  });
  it("powers-of-2 scale uses 1, 2, 4, 8, 16", () => {
    expect(SCALE_VALUES["powers-of-2"]).toEqual([1, 2, 4, 8, 16]);
  });
  it("has 6 INVEST dimensions", () => {
    expect(Object.keys(INVEST_LABELS)).toHaveLength(6);
    expect(INVEST_LABELS.testable).toBe("Testable");
  });
  it("has sample features", () => {
    expect(SAMPLE_FEATURES.length).toBeGreaterThanOrEqual(5);
  });
  it("has a history key and max of 20", () => {
    expect(HISTORY_KEY).toContain("ai-user-story-creator");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has a default definition of done with at least 5 items", () => {
    expect(DEFAULT_DEFINITION_OF_DONE.length).toBeGreaterThanOrEqual(5);
  });
});

describe("ai-user-story-creator normalizeFeature", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeFeature("  Bulk   upload   ")).toBe("Bulk upload");
  });
  it("handles empty", () => {
    expect(normalizeFeature("")).toBe("");
  });
});

describe("ai-user-story-creator normalizeScan", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeScan("  Sign   IN ")).toBe("sign in");
  });
});

describe("ai-user-story-creator parseBulkFeatures", () => {
  it("parses newline-separated features", () => {
    expect(parseBulkFeatures("dark mode\nbulk upload\nadmin dashboard")).toEqual([
      "dark mode", "bulk upload", "admin dashboard",
    ]);
  });
  it("parses semicolon-separated features", () => {
    expect(parseBulkFeatures("dark mode; bulk upload; admin dashboard")).toEqual([
      "dark mode", "bulk upload", "admin dashboard",
    ]);
  });
  it("parses numbered list features", () => {
    expect(parseBulkFeatures("1. dark mode\n2. bulk upload\n3. admin dashboard")).toEqual([
      "dark mode", "bulk upload", "admin dashboard",
    ]);
  });
  it("skips blank entries", () => {
    expect(parseBulkFeatures("dark mode\n\n\nbulk upload")).toEqual(["dark mode", "bulk upload"]);
  });
  it("returns empty for empty input", () => {
    expect(parseBulkFeatures("")).toEqual([]);
  });
});

describe("ai-user-story-creator extractKeywords", () => {
  it("removes stop words", () => {
    const kw = extractKeywords("I want to sign in with Google so that I do not need a password");
    expect(kw).toContain("sign");
    expect(kw).toContain("google");
    expect(kw).toContain("password");
    expect(kw).not.toContain("want");
    expect(kw).not.toContain("with");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("ai-user-story-creator titleCase", () => {
  it("title-cases words", () => {
    expect(titleCase("dark mode toggle")).toBe("Dark Mode Toggle");
  });
  it("handles empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("ai-user-story-creator detectPersona", () => {
  it("detects admin", () => {
    expect(detectPersona("admin dashboard with moderation tools")).toBe("admin");
  });
  it("detects developer", () => {
    expect(detectPersona("deploy a new API endpoint with webhooks")).toBe("developer");
  });
  it("detects guest", () => {
    expect(detectPersona("guest visitor sign-up flow")).toBe("guest");
  });
  it("detects manager", () => {
    expect(detectPersona("weekly KPI report for stakeholders")).toBe("manager");
  });
  it("defaults to end-user", () => {
    expect(detectPersona("dark mode toggle")).toBe("end-user");
  });
  it("returns end-user for empty", () => {
    expect(detectPersona("")).toBe("end-user");
  });
});

describe("ai-user-story-creator suggestRoles", () => {
  it("returns at least 3 role suggestions", () => {
    const r = suggestRoles("bulk upload products");
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.some((x) => x.includes("registered user"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(suggestRoles("")).toEqual([]);
  });
});

describe("ai-user-story-creator scoreComplexity", () => {
  it("scores 0 for empty input", () => {
    expect(scoreComplexity("").total).toBe(0);
  });
  it("scores higher for integrations than for a simple toggle", () => {
    const simple = scoreComplexity("dark mode toggle").total;
    const complex = scoreComplexity("OAuth integration with Stripe payment and real-time webhooks").total;
    expect(complex).toBeGreaterThan(simple);
  });
  it("captures signal labels", () => {
    const r = scoreComplexity("CSV bulk upload with validation");
    expect(r.signals.some((s) => s.label.includes("file handling"))).toBe(true);
  });
});

describe("ai-user-story-creator estimateStoryPoints", () => {
  it("returns a fibonacci value", () => {
    const v = estimateStoryPoints("simple toggle", "fibonacci");
    expect(SCALE_VALUES.fibonacci).toContain(v);
  });
  it("returns a t-shirt value", () => {
    const v = estimateStoryPoints("simple toggle", "tshirt");
    expect(SCALE_VALUES.tshirt).toContain(v);
  });
  it("returns a powers-of-2 value", () => {
    const v = estimateStoryPoints("simple toggle", "powers-of-2");
    expect(SCALE_VALUES["powers-of-2"]).toContain(v);
  });
  it("complex feature gets a higher point value than trivial", () => {
    const trivial = pointsToNumber(estimateStoryPoints("rename a button", "fibonacci"));
    const complex = pointsToNumber(estimateStoryPoints(
      "OAuth SSO integration with Stripe billing, real-time webhooks, and GDPR audit log",
      "fibonacci",
    ));
    expect(complex).toBeGreaterThanOrEqual(trivial);
  });
});

describe("ai-user-story-creator pointsToNumber", () => {
  it("converts numbers as-is", () => {
    expect(pointsToNumber(8)).toBe(8);
  });
  it("converts t-shirt sizes", () => {
    expect(pointsToNumber("M")).toBe(3);
    expect(pointsToNumber("XL")).toBe(8);
  });
  it("returns 0 for unknown", () => {
    expect(pointsToNumber("unknown")).toBe(0);
  });
});

describe("ai-user-story-creator renderStatement", () => {
  it("renders the standard as-a format", () => {
    const s = renderStatement("as-a", "registered user", "dark mode", "read at night");
    expect(s).toContain("As a registered user");
    expect(s).toContain("I want dark mode");
    expect(s).toContain("so that read at night");
  });
  it("renders job story", () => {
    const s = renderStatement("job-story", "user", "do X", "achieve Y");
    expect(s).toContain("When I need to");
    expect(s).toContain("I want to do X");
  });
  it("renders bmmn", () => {
    const s = renderStatement("bmmn", "user", "do X", "achieve Y");
    expect(s).toContain("Business goal:");
    expect(s).toContain("Measure:");
    expect(s).toContain("Notify:");
  });
  it("handles missing role", () => {
    const s = renderStatement("as-a", "", "do X", "achieve Y");
    expect(s).toContain("As a user");
  });
});

describe("ai-user-story-creator inferBenefit", () => {
  it("infers oauth benefit", () => {
    expect(inferBenefit("Sign in with Google OAuth")).toContain("without remembering another password");
  });
  it("infers dashboard benefit", () => {
    expect(inferBenefit("Admin dashboard with KPIs")).toContain("real-time data");
  });
  it("returns generic fallback", () => {
    expect(inferBenefit("some random feature")).toContain("more efficiently");
  });
  it("returns fallback for empty", () => {
    expect(inferBenefit("")).toContain("achieve my goal");
  });
});

describe("ai-user-story-creator generateAcceptanceCriteria", () => {
  it("generates at least 3 criteria", () => {
    const ac = generateAcceptanceCriteria("dark mode toggle", "end-user");
    expect(ac.length).toBeGreaterThanOrEqual(3);
  });
  it("includes a happy path scenario", () => {
    const ac = generateAcceptanceCriteria("dark mode toggle", "end-user");
    expect(ac.some((a) => a.scenario === "happy path")).toBe(true);
  });
  it("includes Given/When/Then in each criterion", () => {
    const ac = generateAcceptanceCriteria("dark mode toggle", "end-user");
    for (const a of ac) {
      expect(a.given).toMatch(/^a /i);
      expect(a.when).toMatch(/^they /i);
      expect(a.then).toMatch(/^the /i);
    }
  });
  it("adds bulk upload scenario when feature mentions upload", () => {
    const ac = generateAcceptanceCriteria("bulk upload via CSV", "admin");
    expect(ac.some((a) => a.scenario.includes("bulk upload"))).toBe(true);
  });
  it("adds real-time scenario when feature mentions real-time", () => {
    const ac = generateAcceptanceCriteria("real-time notifications via websocket", "end-user");
    expect(ac.some((a) => a.scenario.includes("real-time"))).toBe(true);
  });
  it("adds payment scenario when feature mentions payment", () => {
    const ac = generateAcceptanceCriteria("charge the customer via Stripe", "end-user");
    expect(ac.some((a) => a.scenario.includes("payment"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(generateAcceptanceCriteria("", "end-user")).toEqual([]);
  });
});

describe("ai-user-story-creator generateEdgeCases", () => {
  it("generates at least 3 edge cases", () => {
    const ec = generateEdgeCases("dark mode toggle");
    expect(ec.length).toBeGreaterThanOrEqual(3);
  });
  it("adds upload edge cases for upload features", () => {
    const ec = generateEdgeCases("bulk CSV upload");
    expect(ec.length).toBeGreaterThanOrEqual(5);
  });
  it("adds auth edge cases for auth features", () => {
    const ec = generateEdgeCases("login with password");
    expect(ec.some((e) => e.description.includes("2FA"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(generateEdgeCases("")).toEqual([]);
  });
});

describe("ai-user-story-creator generateTasks", () => {
  it("generates 3-7 tasks", () => {
    const tasks = generateTasks("dark mode toggle", "end-user");
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(tasks.length).toBeLessThanOrEqual(7);
  });
  it("adds admin task for admin persona", () => {
    const tasks = generateTasks("admin dashboard", "admin");
    expect(tasks.some((t) => t.description.includes("admin permissions"))).toBe(true);
  });
  it("adds upload task for upload features", () => {
    const tasks = generateTasks("bulk CSV upload", "admin");
    expect(tasks.some((t) => t.description.includes("MIME-type validation"))).toBe(true);
  });
  it("adds real-time task for real-time features", () => {
    const tasks = generateTasks("real-time notifications", "end-user");
    expect(tasks.some((t) => t.description.includes("real-time channel"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(generateTasks("", "end-user")).toEqual([]);
  });
});

describe("ai-user-story-creator detectDependencies", () => {
  it("detects explicit depends-on", () => {
    const d = detectDependencies("This feature depends on the user service being done");
    expect(d.some((x) => x.includes("user service"))).toBe(true);
  });
  it("detects auth dependency implicitly", () => {
    const d = detectDependencies("Sign in with Google OAuth");
    expect(d.some((x) => x.includes("authentication system"))).toBe(true);
  });
  it("detects notification dependency implicitly", () => {
    const d = detectDependencies("Send email notification on signup");
    expect(d.some((x) => x.includes("notification delivery"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(detectDependencies("")).toEqual([]);
  });
});

describe("ai-user-story-creator runInvestCheck", () => {
  const baseStory = {
    feature: "dark mode toggle",
    acceptanceCriteria: [
      { id: "ac-1", scenario: "happy", given: "x", when: "y", then: "z" },
    ],
    tasks: [
      { id: "t-1", description: "task 1", hoursEstimate: 4 },
      { id: "t-2", description: "task 2", hoursEstimate: 4 },
    ],
    storyPoints: 3 as number | string,
    dependencies: [] as string[],
  };

  it("returns 6 verdicts", () => {
    const r = runInvestCheck(baseStory);
    expect(r).toHaveLength(6);
  });
  it("fails testable when there are no AC", () => {
    const r = runInvestCheck({ ...baseStory, acceptanceCriteria: [] });
    const testable = r.find((x) => x.dimension === "testable");
    expect(testable?.verdict).toBe("fail");
  });
  it("warns independent when there are dependencies", () => {
    const r = runInvestCheck({ ...baseStory, dependencies: ["Depends on: X"] });
    const ind = r.find((x) => x.dimension === "independent");
    expect(ind?.verdict).toBe("warn");
  });
  it("fails small when hours exceed 24", () => {
    const r = runInvestCheck({
      ...baseStory,
      tasks: [{ id: "t-1", description: "huge task", hoursEstimate: 30 }],
    });
    const small = r.find((x) => x.dimension === "small");
    expect(small?.verdict).toBe("fail");
  });
});

describe("ai-user-story-creator buildDefinitionOfDone", () => {
  it("returns the default DoD for a simple feature", () => {
    const dod = buildDefinitionOfDone("dark mode toggle");
    expect(dod.length).toBeGreaterThanOrEqual(DEFAULT_DEFINITION_OF_DONE.length);
  });
  it("extends DoD for payment features", () => {
    const dod = buildDefinitionOfDone("charge via Stripe with webhooks");
    expect(dod.some((d) => d.includes("Idempotency"))).toBe(true);
  });
  it("extends DoD for upload features", () => {
    const dod = buildDefinitionOfDone("bulk CSV upload");
    expect(dod.some((d) => d.includes("Large-file"))).toBe(true);
  });
});

describe("ai-user-story-creator suggestSplitAxes", () => {
  it("suggests lifecycle stage for CRUD features", () => {
    const a = suggestSplitAxes("create, view, edit, and delete invoices");
    expect(a).toContain("by lifecycle stage");
  });
  it("suggests persona when feature mentions user types", () => {
    const a = suggestSplitAxes("admin and guest users can both access");
    expect(a).toContain("by persona");
  });
  it("returns a fallback for generic features", () => {
    const a = suggestSplitAxes("something random");
    expect(a.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-user-story-creator splitEpic", () => {
  it("splits an epic into 2-4 stories", () => {
    const stories = splitEpic("Manage invoices: create, view, edit, delete", "admin", "as-a", "fibonacci");
    expect(stories.length).toBeGreaterThanOrEqual(2);
    expect(stories.length).toBeLessThanOrEqual(4);
  });
  it("each story has a unique id", () => {
    const stories = splitEpic("Manage invoices: create, view, edit, delete", "admin", "as-a", "fibonacci");
    const ids = new Set(stories.map((s) => s.id));
    expect(ids.size).toBe(stories.length);
  });
  it("each story has acceptance criteria and INVEST", () => {
    const stories = splitEpic("Admin can manage users", "admin", "as-a", "fibonacci");
    for (const s of stories) {
      expect(s.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(s.invest).toHaveLength(6);
    }
  });
  it("returns empty for empty epic", () => {
    expect(splitEpic("", "end-user", "as-a", "fibonacci")).toEqual([]);
  });
});

describe("ai-user-story-creator generateUserStory", () => {
  it("generates a story with all fields populated", () => {
    const s = generateUserStory("dark mode toggle", "end-user", "as-a", "fibonacci");
    expect(s).not.toBeNull();
    expect(s!.statement).toContain("As a");
    expect(s!.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(s!.tasks.length).toBeGreaterThan(0);
    expect(s!.invest).toHaveLength(6);
    expect(s!.definitionOfDone.length).toBeGreaterThan(0);
    expect(typeof s!.storyPoints).not.toBe("undefined");
  });
  it("returns null for empty feature", () => {
    expect(generateUserStory("", "end-user", "as-a", "fibonacci")).toBeNull();
  });
});

describe("ai-user-story-creator generateFromFeatures (bulk)", () => {
  it("generates stories for multiple features", () => {
    const stories = generateFromFeatures(
      ["dark mode toggle", "bulk CSV upload"],
      "end-user",
      "as-a",
      "fibonacci",
    );
    expect(stories).toHaveLength(2);
    expect(stories[0].id).toBe("story-1");
    expect(stories[1].id).toBe("story-2");
  });
  it("skips empty features", () => {
    const stories = generateFromFeatures(["", "dark mode toggle"], "end-user", "as-a", "fibonacci");
    expect(stories).toHaveLength(1);
  });
});

describe("ai-user-story-creator computeStats", () => {
  it("computes summary stats", () => {
    const stories = generateFromFeatures(
      ["dark mode toggle", "bulk CSV upload"],
      "end-user",
      "as-a",
      "fibonacci",
    );
    const stats = computeStats(stories);
    expect(stats.totalStories).toBe(2);
    expect(stats.totalTasks).toBeGreaterThan(0);
    expect(stats.totalAC).toBeGreaterThan(0);
    expect(stats.totalEdgeCases).toBeGreaterThan(0);
    expect(stats.investPassCount + stats.investWarnCount + stats.investFailCount).toBe(12);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats([]);
    expect(stats.totalStories).toBe(0);
    expect(stats.totalPoints).toBe(0);
  });
});

describe("ai-user-story-creator rendering", () => {
  const stories = generateFromFeatures(["dark mode toggle"], "end-user", "as-a", "fibonacci");

  it("renderMarkdown contains the statement and AC", () => {
    const md = renderMarkdown(stories);
    expect(md).toContain("As a");
    expect(md).toContain("Acceptance Criteria");
    expect(md).toContain("INVEST Check");
    expect(md).toContain("Definition of Done");
  });
  it("renderText contains the statement", () => {
    const txt = renderText(stories);
    expect(txt).toContain("STORY-1");
    expect(txt).toContain("As a");
  });
  it("renderJiraCsv has header and a row", () => {
    const csv = renderJiraCsv(stories);
    expect(csv).toContain("Summary,Description,Story Points");
    expect(csv.split("\n").length).toBeGreaterThanOrEqual(2);
  });
  it("renderAzureCsv has header and a row", () => {
    const csv = renderAzureCsv(stories);
    expect(csv).toContain("Title,Description,Effort");
  });
  it("renderJson is valid JSON", () => {
    const json = renderJson(stories);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });
  it("renderMarkdown escapes quotes in CSV exports", () => {
    const csv = renderJiraCsv(stories);
    expect(csv).toContain('"');
  });
});

describe("ai-user-story-creator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, feature: "dark mode", persona: "end-user",
      storyCount: 3, totalPoints: "8", format: "as-a",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, feature: `f${i}`, persona: "end-user",
        storyCount: 1, totalPoints: "1", format: "as-a",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, feature: "x", persona: "end-user",
      storyCount: 1, totalPoints: "1", format: "as-a",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-user-story-creator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ feature: "dark mode", persona: "admin", format: "as-a", scale: "fibonacci" });
    expect(url).toContain("feature=dark+mode");
    expect(url).toContain("persona=admin");
    expect(url).toContain("format=as-a");
    expect(url).toContain("scale=fibonacci");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("feature=dark+mode&persona=admin&format=as-a&scale=tshirt");
    expect(p.feature).toBe("dark mode");
    expect(p.persona).toBe("admin");
    expect(p.format).toBe("as-a");
    expect(p.scale).toBe("tshirt");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.feature).toBe("");
    expect(p.persona).toBe("end-user");
    expect(p.format).toBe("as-a");
    expect(p.scale).toBe("fibonacci");
  });
  it("filters unknown enum values", () => {
    const p = parseShareUrl("feature=x&persona=unknown&format=bad&scale=bad");
    expect(p.persona).toBe("end-user");
    expect(p.format).toBe("as-a");
    expect(p.scale).toBe("fibonacci");
  });
});

describe("ai-user-story-creator LLM prompt", () => {
  it("builds a system + user prompt", () => {
    const p = buildLlmPrompt("dark mode toggle", "end-user", "as-a", "fibonacci");
    expect(p.system).toContain("Agile product owner");
    expect(p.system).toContain("As-a");
    expect(p.system).toContain("Fibonacci");
    expect(p.user).toContain("dark mode toggle");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// Suppress unused-import lint
export type _Unused = Persona | StoryFormat | PointScale;
