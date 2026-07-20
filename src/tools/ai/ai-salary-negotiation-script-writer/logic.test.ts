import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  SCENARIO_LABELS,
  SCENARIO_HINTS,
  TONE_LABELS,
  TONE_HINTS,
  OBJECTION_LABELS,
  LEVERAGE_LABELS,
  NON_SALARY_LEVER_LABELS,
  ROLE_PLAY_PRESETS,
  formatSalary,
  normalizeText,
  capitalize,
  computeAnchorRange,
  validateInput,
  computeConfidence,
  buildGreeting,
  buildSignOff,
  buildEmailSubject,
  buildEmailBody,
  buildTalkingPoints,
  buildObjectionResponses,
  buildNonSalaryLevers,
  buildRolePlayQa,
  buildBenefitsChecklist,
  buildSummary,
  buildLeverageFraming,
  generateScript,
  renderScriptText,
  renderScriptCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Scenario,
  type Tone,
  type ObjectionKey,
  type NonSalaryLeverKey,
  type LeverageKey,
  type NegotiationInput,
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

function baseInput(overrides: Partial<NegotiationInput> = {}): NegotiationInput {
  return {
    scenario: "counter-offer",
    tone: "confident",
    role: "Senior Software Engineer",
    companyName: "Acme Corp",
    hiringManager: "Jordan Lee",
    currentSalary: 165000,
    offerSalary: 180000,
    targetSalary: 210000,
    location: "San Francisco, CA",
    leverage: ["competing-offer", "impact"],
    levers: ["equity", "remote"],
    customLeverageNote: "",
    ...overrides,
  };
}

// ---------- Constants ----------

describe("ai-salary-negotiation constants", () => {
  it("has 3 scenario labels + hints", () => {
    expect(Object.keys(SCENARIO_LABELS)).toHaveLength(3);
    expect(Object.keys(SCENARIO_HINTS)).toHaveLength(3);
    expect(SCENARIO_LABELS["initial-ask"]).toBeTruthy();
    expect(SCENARIO_HINTS["counter-offer"]).toBeTruthy();
  });
  it("has 2 tone labels + hints", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(2);
    expect(Object.keys(TONE_HINTS)).toHaveLength(2);
    expect(TONE_LABELS.confident).toBeTruthy();
    expect(TONE_HINTS.collaborative).toBeTruthy();
  });
  it("has 6 objection labels", () => {
    expect(Object.keys(OBJECTION_LABELS)).toHaveLength(6);
  });
  it("has 7 leverage labels", () => {
    expect(Object.keys(LEVERAGE_LABELS)).toHaveLength(7);
  });
  it("has 8 non-salary lever labels", () => {
    expect(Object.keys(NON_SALARY_LEVER_LABELS)).toHaveLength(8);
  });
  it("has at least 3 role-play presets", () => {
    expect(ROLE_PLAY_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(ROLE_PLAY_PRESETS.some((p) => p.input.scenario === "initial-ask")).toBe(true);
    expect(ROLE_PLAY_PRESETS.some((p) => p.input.scenario === "counter-offer")).toBe(true);
    expect(ROLE_PLAY_PRESETS.some((p) => p.input.scenario === "final-offer")).toBe(true);
  });
  it("uses a namespaced history key", () => {
    expect(HISTORY_KEY).toContain("ai-salary-negotiation-script-writer");
  });
  it("history max is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ---------- Helpers ----------

describe("ai-salary-negotiation helpers", () => {
  it("formatSalary formats USD", () => {
    expect(formatSalary(210000)).toBe("$210,000");
    expect(formatSalary(0)).toBe("—");
    expect(formatSalary(null)).toBe("—");
    expect(formatSalary(undefined)).toBe("—");
  });
  it("formatSalary rounds fractions", () => {
    expect(formatSalary(210000.49)).toBe("$210,000");
    expect(formatSalary(210500.5)).toBe("$210,501");
  });
  it("normalizeText collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
    expect(normalizeText("")).toBe("");
  });
  it("capitalize uppercases the first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
    expect(capitalize("H")).toBe("H");
  });
  it("computeAnchorRange builds low/mid/high from target", () => {
    const a = computeAnchorRange(200000);
    expect(a.low).toBe(190000);
    expect(a.mid).toBe(200000);
    expect(a.high).toBe(220000);
  });
  it("computeAnchorRange clamps negative target to 0", () => {
    const a = computeAnchorRange(-50);
    expect(a.low).toBe(0);
    expect(a.mid).toBe(0);
    expect(a.high).toBe(0);
  });
  it("validateInput flags missing role + company", () => {
    const errors = validateInput(baseInput({ role: "", companyName: "" }));
    expect(errors.some((e) => e.includes("Role"))).toBe(true);
    expect(errors.some((e) => e.includes("Company"))).toBe(true);
  });
  it("validateInput flags non-positive target", () => {
    const errors = validateInput(baseInput({ targetSalary: 0 }));
    expect(errors.some((e) => e.includes("Target salary"))).toBe(true);
  });
  it("validateInput flags counter-offer without offerSalary", () => {
    const errors = validateInput(baseInput({ scenario: "counter-offer", offerSalary: null }));
    expect(errors.some((e) => e.includes("Counter-offer"))).toBe(true);
  });
  it("validateInput flags initial-ask with an offerSalary", () => {
    const errors = validateInput(baseInput({ scenario: "initial-ask", offerSalary: 180000 }));
    expect(errors.some((e) => e.includes("Initial ask"))).toBe(true);
  });
  it("validateInput passes a clean counter-offer", () => {
    expect(validateInput(baseInput())).toEqual([]);
  });
  it("computeConfidence scales with leverage + levers count", () => {
    expect(computeConfidence([], [])).toBe("low");
    expect(computeConfidence(["impact"], ["equity"])).toBe("medium");
    expect(computeConfidence(["impact", "experience", "market-data"], ["equity", "pto"])).toBe("high");
  });
});

// ---------- Greeting + sign-off + subject ----------

describe("ai-salary-negotiation greeting/sign-off/subject", () => {
  it("buildGreeting uses first name when hiring manager set", () => {
    expect(buildGreeting(baseInput({ hiringManager: "Jordan Lee" }))).toBe("Hi Jordan,");
  });
  it("buildGreeting falls back when hiring manager empty", () => {
    expect(buildGreeting(baseInput({ hiringManager: "" }))).toBe("Hi there,");
  });
  it("buildSignOff differs by tone", () => {
    expect(buildSignOff(baseInput({ tone: "confident" }))).toContain("Looking forward");
    expect(buildSignOff(baseInput({ tone: "collaborative" }))).toContain("talk it through");
  });
  it("buildEmailSubject changes by scenario", () => {
    expect(buildEmailSubject(baseInput({ scenario: "initial-ask" }))).toContain("Compensation discussion");
    expect(buildEmailSubject(baseInput({ scenario: "counter-offer" }))).toContain("Re:");
    expect(buildEmailSubject(baseInput({ scenario: "final-offer" }))).toContain("Final thoughts");
  });
});

// ---------- Leverage framing ----------

describe("ai-salary-negotiation leverage framing", () => {
  it("returns one string per checked leverage", () => {
    const f = buildLeverageFraming(baseInput({ leverage: ["competing-offer", "impact"] }));
    expect(f).toHaveLength(2);
    expect(f[0]).toContain("Acme Corp");
    expect(f[1]).toContain("measurable impact");
  });
  it("handles empty leverage", () => {
    expect(buildLeverageFraming(baseInput({ leverage: [] }))).toEqual([]);
  });
  it("market-data leverage mentions location", () => {
    const f = buildLeverageFraming(baseInput({ leverage: ["market-data"], location: "Austin, TX" }));
    expect(f[0]).toContain("Austin, TX");
  });
});

// ---------- Email body ----------

describe("ai-salary-negotiation email body", () => {
  it("includes greeting, target, and sign-off", () => {
    const body = buildEmailBody(baseInput());
    expect(body).toContain("Hi Jordan,");
    expect(body).toContain("$210,000");
    expect(body).toContain("Best regards");
  });
  it("counter-offer mentions existing offer", () => {
    const body = buildEmailBody(baseInput({ scenario: "counter-offer" }));
    expect(body).toContain("$180,000");
  });
  it("initial-ask does NOT mention existing offer", () => {
    const body = buildEmailBody(baseInput({ scenario: "initial-ask", offerSalary: null }));
    expect(body).not.toContain("$180,000");
  });
  it("includes non-salary levers when checked", () => {
    const body = buildEmailBody(baseInput({ levers: ["equity", "pto"] }));
    expect(body).toContain("Equity / stock options");
    expect(body).toContain("Additional PTO");
  });
  it("omits non-salary levers section when none checked", () => {
    const body = buildEmailBody(baseInput({ levers: [] }));
    expect(body).not.toContain("non-salary levers");
  });
  it("includes custom leverage note when set", () => {
    const body = buildEmailBody(baseInput({ customLeverageNote: "Just promoted to staff" }));
    expect(body).toContain("Just promoted to staff");
  });
  it("final-offer has a decision deadline line", () => {
    const body = buildEmailBody(baseInput({ scenario: "final-offer" }));
    expect(body).toContain("decision to make by end of week");
  });
});

// ---------- Talking points ----------

describe("ai-salary-negotiation talking points", () => {
  it("opens with stretch anchor for initial-ask", () => {
    const points = buildTalkingPoints(baseInput({ scenario: "initial-ask", targetSalary: 200000 }));
    expect(points[0]).toContain("$220,000");
    expect(points[0]).toContain("stretch");
  });
  it("counter-offer point mentions existing offer", () => {
    const points = buildTalkingPoints(baseInput({ scenario: "counter-offer" }));
    expect(points[0]).toContain("$180,000");
  });
  it("includes a walk-away line", () => {
    const points = buildTalkingPoints(baseInput());
    expect(points.some((p) => p.includes("walk-away" ) || p.includes("appreciate the offer"))).toBe(true);
  });
  it("adds a non-salary trade-up point when levers checked", () => {
    const points = buildTalkingPoints(baseInput({ levers: ["equity"] }));
    expect(points.some((p) => p.includes("Equity / stock options"))).toBe(true);
  });
  it("silence advice appears for confident tone", () => {
    const points = buildTalkingPoints(baseInput({ tone: "confident" }));
    expect(points.some((p) => p.toLowerCase().includes("silence"))).toBe(true);
  });
});

// ---------- Objection responses ----------

describe("ai-salary-negotiation objection responses", () => {
  it("returns 6 objection responses", () => {
    const r = buildObjectionResponses(baseInput());
    expect(r).toHaveLength(6);
    expect(r.map((o) => o.key).sort()).toEqual(
      ["budget", "competitive", "expectations", "experience", "promotion", "timing"].sort(),
    );
  });
  it("budget objection response mentions signing bonus", () => {
    const r = buildObjectionResponses(baseInput());
    const budget = r.find((o) => o.key === "budget")!;
    expect(budget.response.toLowerCase()).toContain("signing bonus");
  });
  it("expectations response mentions target", () => {
    const r = buildObjectionResponses(baseInput({ scenario: "initial-ask" }));
    const exp = r.find((o) => o.key === "expectations")!;
    expect(exp.response).toContain("$210,000");
  });
  it("promotion response asks to write criteria into offer", () => {
    const r = buildObjectionResponses(baseInput());
    const promo = r.find((o) => o.key === "promotion")!;
    expect(promo.response.toLowerCase()).toContain("offer letter");
  });
});

// ---------- Non-salary levers ----------

describe("ai-salary-negotiation non-salary levers", () => {
  it("returns one lever per checked key", () => {
    const levers = buildNonSalaryLevers(baseInput({ levers: ["equity", "pto", "remote"] }));
    expect(levers).toHaveLength(3);
    expect(levers.map((l) => l.key)).toEqual(["equity", "pto", "remote"]);
  });
  it("equity script includes a derived dollar amount", () => {
    const levers = buildNonSalaryLevers(baseInput({ levers: ["equity"], targetSalary: 200000 }));
    expect(levers[0].script).toContain("$");
  });
  it("pto script mentions flexibility", () => {
    const levers = buildNonSalaryLevers(baseInput({ levers: ["pto"] }));
    expect(levers[0].script.toLowerCase()).toContain("vacation");
  });
  it("empty levers returns empty", () => {
    expect(buildNonSalaryLevers(baseInput({ levers: [] }))).toEqual([]);
  });
});

// ---------- Role-play Q&A + benefits checklist ----------

describe("ai-salary-negotiation role-play + benefits", () => {
  it("role-play returns 4 Q&A pairs", () => {
    const qa = buildRolePlayQa(baseInput());
    expect(qa).toHaveLength(4);
    expect(qa[0].question).toBeTruthy();
    expect(qa[0].answer).toBeTruthy();
  });
  it("benefits checklist has 10+ items", () => {
    const c = buildBenefitsChecklist(baseInput());
    expect(c.length).toBeGreaterThanOrEqual(10);
    expect(c.some((s) => s.toLowerCase().includes("base salary"))).toBe(true);
    expect(c.some((s) => s.toLowerCase().includes("equity"))).toBe(true);
  });
});

// ---------- Summary + generateScript ----------

describe("ai-salary-negotiation summary + generateScript", () => {
  it("buildSummary includes anchor range + confidence", () => {
    const input = baseInput();
    const anchor = computeAnchorRange(input.targetSalary);
    const s = buildSummary(input, anchor, "high");
    expect(s).toContain("Senior Software Engineer");
    expect(s).toContain("$210,000");
    expect(s).toContain("$231,000"); // high anchor
    expect(s).toContain("Confidence: high");
  });
  it("generateScript returns a complete NegotiationScript", () => {
    const script = generateScript(baseInput());
    expect(script.scenario).toBe("counter-offer");
    expect(script.email.subject).toBeTruthy();
    expect(script.email.body).toContain("Hi Jordan,");
    expect(script.talkingPoints.length).toBeGreaterThan(3);
    expect(script.objectionResponses).toHaveLength(6);
    expect(script.nonSalaryLevers).toHaveLength(2);
    expect(script.anchorRange.mid).toBe(210000);
    expect(script.benefitsChecklist.length).toBeGreaterThanOrEqual(10);
    expect(script.confidence).toBe("high");
  });
  it("generateScript with no leverage returns low confidence", () => {
    const script = generateScript(baseInput({ leverage: [], levers: [] }));
    expect(script.confidence).toBe("low");
    expect(script.leverageFraming).toEqual([]);
    expect(script.nonSalaryLevers).toEqual([]);
  });
});

// ---------- Rendering ----------

describe("ai-salary-negotiation rendering", () => {
  it("renderScriptText contains section headers", () => {
    const script = generateScript(baseInput());
    const text = renderScriptText(script);
    expect(text).toContain("=== Salary Negotiation Script ===");
    expect(text).toContain("--- Counter-offer email ---");
    expect(text).toContain("--- Talking points ---");
    expect(text).toContain("--- Objection responses ---");
    expect(text).toContain("--- Benefits checklist ---");
    expect(text).toContain("=== End ===");
  });
  it("renderScriptCsv emits a header + rows", () => {
    const script = generateScript(baseInput());
    const csv = renderScriptCsv(script);
    expect(csv).toContain("section,item,detail");
    expect(csv).toContain("summary,scenario");
    expect(csv).toContain("talking-point,1");
  });
  it("renderScriptCsv escapes commas inside fields", () => {
    const script = generateScript(baseInput({ companyName: "Acme, Inc." }));
    const csv = renderScriptCsv(script);
    // Email body row opens with a quoted field because the body contains commas
    expect(csv).toContain("email,body,\"");
    // The comma in the company name survives intact inside the quoted field
    expect(csv).toContain("Acme, Inc.");
    // The body row closes with a quote (Best regards, ends the body before the closing quote)
    expect(csv).toContain("Best regards,\"");
  });
});

// ---------- LLM prompt ----------

describe("ai-salary-negotiation LLM prompt", () => {
  it("buildLlmPrompt includes scenario + target", () => {
    const input = baseInput();
    const script = generateScript(input);
    const p = buildLlmPrompt(input, script);
    expect(p).toContain("Counter-offer");
    expect(p).toContain("$210,000");
    expect(p).toContain("senior career coach");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hi  ")).toBe("hi");
  });
});

// ---------- History ----------

describe("ai-salary-negotiation history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, scenario: "counter-offer", tone: "confident", role: "SWE",
      targetSalary: 210000, offerSalary: 180000, anchorHigh: 231000,
      leverage: ["impact"], nonSalaryLeverCount: 2,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].role).toBe("SWE");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, scenario: "counter-offer", tone: "confident", role: "SWE",
        targetSalary: 100000 + i, offerSalary: 90000, anchorHigh: 110000,
        leverage: [], nonSalaryLeverCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, scenario: "counter-offer", tone: "confident", role: "SWE",
      targetSalary: 1, offerSalary: 1, anchorHigh: 1, leverage: [], nonSalaryLeverCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-salary-negotiation shareable URL", () => {
  it("builds a share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(baseInput());
    expect(url).toContain("scenario=counter-offer");
    expect(url).toContain("tone=confident");
    expect(url).toContain("target=210000");
    expect(url).toContain("lev=competing-offer");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses a share URL back", () => {
    const input = baseInput({
      role: "Product Manager", companyName: "Globex",
      targetSalary: 180000, leverage: ["market-data"], levers: ["pto"],
    });
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.scenario).toBe("counter-offer");
    expect(parsed.role).toBe("Product Manager");
    expect(parsed.companyName).toBe("Globex");
    expect(parsed.targetSalary).toBe(180000);
    expect(parsed.leverage).toEqual(["market-data"]);
    expect(parsed.levers).toEqual(["pto"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown leverage keys", () => {
    const parsed = parseShareUrl("scenario=initial-ask&lev=bogus,impact&nlev=equity,fake");
    expect(parsed.leverage).toEqual(["impact"]);
    expect(parsed.levers).toEqual(["equity"]);
  });
  it("ignores invalid scenario/tone", () => {
    const parsed = parseShareUrl("scenario=bogus&tone=bogus");
    expect(parsed.scenario).toBeUndefined();
    expect(parsed.tone).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused =
  | Scenario
  | Tone
  | ObjectionKey
  | NonSalaryLeverKey
  | LeverageKey;
