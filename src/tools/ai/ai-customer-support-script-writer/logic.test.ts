import { describe, it, expect, beforeEach } from "vitest";
import {
  SCENARIO_LABELS,
  SCENARIO_DESCRIPTIONS,
  CHANNEL_LABELS,
  TONE_LABELS,
  STAGE_LABELS,
  SCENARIO_LIST,
  VARIABLE_FIELDS,
  DEFAULT_BRAND_VOICE,
  DE_ESCALATION_PRESETS,
  WEAK_PHRASES,
  HISTORY_KEY,
  MACRO_KEY,
  BRAND_VOICE_KEY,
  extractVariables,
  applyVariables,
  detectMissingVariables,
  variablesUsed,
  applyChannel,
  generateScript,
  deEscalate,
  positiveLanguageRewrite,
  renderMarkdown,
  renderJson,
  renderText,
  loadHistory,
  saveHistory,
  clearHistory,
  loadMacros,
  saveMacro,
  deleteMacro,
  clearMacros,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  loadBrandVoice,
  saveBrandVoice,
  type Scenario,
  type Channel,
  type Tone,
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

// ---------- Constants ----------

describe("ai-customer-support constants", () => {
  it("has 12 scenarios", () => {
    expect(SCENARIO_LIST).toHaveLength(12);
    expect(SCENARIO_LABELS["refund-request"]).toBe("Refund Request");
    expect(SCENARIO_LABELS["complaint-escalation"]).toContain("Complaint");
  });
  it("has descriptions for all scenarios", () => {
    for (const s of SCENARIO_LIST) {
      expect(SCENARIO_DESCRIPTIONS[s].length).toBeGreaterThan(10);
    }
  });
  it("has 3 channels", () => {
    expect(Object.keys(CHANNEL_LABELS)).toHaveLength(3);
    expect(CHANNEL_LABELS.chat).toBe("Live Chat");
    expect(CHANNEL_LABELS.email).toBe("Email");
    expect(CHANNEL_LABELS.phone).toBe("Phone");
  });
  it("has 3 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
    expect(TONE_LABELS.empathetic).toBe("Empathetic");
    expect(TONE_LABELS.formal).toBe("Formal");
    expect(TONE_LABELS.friendly).toBe("Friendly");
  });
  it("has 6 stages", () => {
    expect(Object.keys(STAGE_LABELS)).toHaveLength(6);
    expect(STAGE_LABELS.opener).toBe("Opener");
    expect(STAGE_LABELS.closing).toBe("Closing");
  });
  it("has 7 variable fields", () => {
    expect(VARIABLE_FIELDS).toHaveLength(7);
    expect(VARIABLE_FIELDS.map((f) => f.key)).toContain("customerName");
    expect(VARIABLE_FIELDS.map((f) => f.key)).toContain("orderId");
  });
  it("has default brand voice with traits + signature", () => {
    expect(DEFAULT_BRAND_VOICE.traits.length).toBeGreaterThan(0);
    expect(DEFAULT_BRAND_VOICE.signature.length).toBeGreaterThan(0);
  });
  it("has 20+ de-escalation presets", () => {
    expect(DE_ESCALATION_PRESETS.length).toBeGreaterThanOrEqual(20);
  });
  it("has weak-phrase list", () => {
    expect(WEAK_PHRASES.length).toBeGreaterThanOrEqual(5);
  });
  it("uses HISTORY_KEY with tool name", () => {
    expect(HISTORY_KEY).toContain("ai-customer-support-script-writer");
  });
  it("uses MACRO_KEY with tool name", () => {
    expect(MACRO_KEY).toContain("ai-customer-support-script-writer");
  });
  it("uses BRAND_VOICE_KEY with tool name", () => {
    expect(BRAND_VOICE_KEY).toContain("ai-customer-support-script-writer");
  });
});

// ---------- extractVariables / applyVariables ----------

describe("ai-customer-support extractVariables", () => {
  it("extracts {{var}} placeholders", () => {
    expect(extractVariables("Hi {{customerName}}, order {{orderId}}")).toEqual(["customerName", "orderId"]);
  });
  it("handles duplicate names", () => {
    expect(extractVariables("{{x}} and {{x}}")).toEqual(["x"]);
  });
  it("handles whitespace inside braces", () => {
    expect(extractVariables("{{ customerName }}")).toEqual(["customerName"]);
  });
  it("returns empty for no placeholders", () => {
    expect(extractVariables("no placeholders here")).toEqual([]);
  });
  it("ignores malformed braces", () => {
    expect(extractVariables("{not} {{ 1invalid }} {{valid}}")).toEqual(["valid"]);
  });
});

describe("ai-customer-support applyVariables", () => {
  it("replaces placeholders with values", () => {
    const out = applyVariables("Hi {{customerName}}, order {{orderId}}", {
      customerName: "Jane", orderId: "ORD-1",
    });
    expect(out).toBe("Hi Jane, order ORD-1");
  });
  it("leaves missing placeholders as {{var}}", () => {
    const out = applyVariables("Hi {{customerName}}", {});
    expect(out).toBe("Hi {{customerName}}");
  });
  it("handles whitespace inside braces", () => {
    const out = applyVariables("Hi {{ customerName }}", { customerName: "Jane" });
    expect(out).toBe("Hi Jane");
  });
  it("auto-derives timeOfDay", () => {
    const out = applyVariables("Good {{timeOfDay}}", {});
    expect(out).toMatch(/morning|afternoon|evening/);
  });
});

describe("ai-customer-support detectMissingVariables", () => {
  it("lists missing variables", () => {
    const m = detectMissingVariables("Hi {{customerName}}, order {{orderId}}", { customerName: "Jane" });
    expect(m).toEqual(["orderId"]);
  });
  it("excludes timeOfDay (auto-derived)", () => {
    const m = detectMissingVariables("Good {{timeOfDay}}", {});
    expect(m).toEqual([]);
  });
  it("excludes variables with empty/whitespace values", () => {
    const m = detectMissingVariables("Hi {{customerName}}", { customerName: "   " });
    expect(m).toEqual(["customerName"]);
  });
  it("returns empty when all present", () => {
    const m = detectMissingVariables("Hi {{customerName}}", { customerName: "Jane" });
    expect(m).toEqual([]);
  });
});

describe("ai-customer-support variablesUsed", () => {
  it("aggregates variables across stages", () => {
    const used = variablesUsed([
      { text: "Hi {{customerName}}" },
      { text: "Order {{orderId}} for {{customerName}}" },
    ]);
    expect(used).toEqual(["customerName", "orderId"]);
  });
  it("excludes timeOfDay", () => {
    const used = variablesUsed([{ text: "Good {{timeOfDay}}, {{customerName}}" }]);
    expect(used).toEqual(["customerName"]);
  });
});

// ---------- applyChannel ----------

describe("ai-customer-support applyChannel", () => {
  it("appends signature for email", () => {
    const out = applyChannel("Hello.", "email", "— Acme");
    expect(out).toContain("— Acme");
    expect(out).toContain("Hello.");
  });
  it("does not append signature for phone", () => {
    const out = applyChannel("Hello.", "phone", "— Acme");
    expect(out).toBe("Hello.");
  });
  it("strips trailing signature for chat", () => {
    const out = applyChannel("Hello.\n— Acme", "chat", "— Acme");
    expect(out).toBe("Hello.");
  });
});

// ---------- generateScript ----------

describe("ai-customer-support generateScript", () => {
  const baseVars = {
    customerName: "Jane",
    agentName: "Sam",
    orderId: "ORD-1",
    productName: "Acme Pro",
    companyName: "Acme Inc.",
    issueSummary: "Order arrived damaged",
    ticketId: "TKT-9",
  };

  it("generates 6 stages for refund-request", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    expect(s.stages).toHaveLength(6);
    expect(s.stages[0].stage).toBe("opener");
    expect(s.stages[5].stage).toBe("closing");
  });
  it("uses empathetic tone in opener", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    expect(s.stages[0].text).toContain("Jane");
    expect(s.stages[0].text).toContain("Sam");
    expect(s.stages[0].text).toContain("sorry");
  });
  it("uses formal tone in opener", () => {
    const s = generateScript("refund-request", "email", "formal", baseVars);
    expect(s.stages[0].text.toLowerCase()).toContain("good");
  });
  it("uses friendly tone in opener", () => {
    const s = generateScript("refund-request", "chat", "friendly", baseVars);
    expect(s.stages[0].text).toContain("Hey");
  });
  it("applies variables to all stages", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    for (const stage of s.stages) {
      expect(stage.text).not.toContain("{{customerName}}");
      expect(stage.text).not.toContain("{{agentName}}");
    }
  });
  it("flags missing variables in warnings", () => {
    const s = generateScript("refund-request", "chat", "empathetic", {});
    expect(s.variablesMissing.length).toBeGreaterThan(0);
    expect(s.warnings.length).toBeGreaterThan(0);
    expect(s.warnings[0]).toContain("Missing variables");
  });
  it("tracks variablesUsed", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    expect(s.variablesUsed).toContain("customerName");
    expect(s.variablesUsed).toContain("agentName");
  });
  it("flags compliance scenarios", () => {
    expect(generateScript("refund-request", "chat", "empathetic", baseVars).complianceFlag).toBe(true);
    expect(generateScript("complaint-escalation", "chat", "empathetic", baseVars).complianceFlag).toBe(true);
    expect(generateScript("billing-dispute", "chat", "empathetic", baseVars).complianceFlag).toBe(true);
    expect(generateScript("cancellation", "chat", "empathetic", baseVars).complianceFlag).toBe(true);
    expect(generateScript("upsell", "chat", "empathetic", baseVars).complianceFlag).toBe(false);
    expect(generateScript("onboarding", "chat", "empathetic", baseVars).complianceFlag).toBe(false);
  });
  it("includes a tip per stage", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    for (const stage of s.stages) {
      expect(stage.tip).toBeTruthy();
      expect(stage.tip!.length).toBeGreaterThan(10);
    }
  });
  it("works for all 12 scenarios", () => {
    for (const sc of SCENARIO_LIST) {
      const s = generateScript(sc, "chat", "empathetic", baseVars);
      expect(s.stages).toHaveLength(6);
      expect(s.scenario).toBe(sc);
    }
  });
  it("appends brand voice signature on email", () => {
    const s = generateScript("refund-request", "email", "formal", baseVars, {
      name: "Acme",
      traits: ["warm"],
      avoid: [],
      signature: "— The Acme Team",
    });
    expect(s.stages[5].text).toContain("— The Acme Team");
  });
  it("warns on weak phrases in brand voice", () => {
    // Inject a weak phrase into a variable that lands in the opener.
    const s = generateScript("upsell", "chat", "empathetic", {
      ...baseVars,
      productName: "world-class Acme Pro",
    });
    expect(s.warnings.some((w) => w.includes("weak phrasing"))).toBe(true);
  });
  it("warns on brand-voice avoid terms", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars, {
      name: "Strict",
      traits: [],
      avoid: ["sorry"],
      signature: "",
    });
    expect(s.warnings.some((w) => w.includes("Brand voice avoid-list"))).toBe(true);
  });
});

// ---------- de-escalation / positive language ----------

describe("ai-customer-support deEscalate", () => {
  it("replaces 'unfortunately' with calmer phrasing", () => {
    const r = deEscalate("Unfortunately, we can't do that.");
    expect(r.text).not.toContain("Unfortunately");
    expect(r.hits.length).toBeGreaterThan(0);
  });
  it("replaces 'calm down'", () => {
    const r = deEscalate("Please calm down and listen.");
    expect(r.text).not.toContain("calm down");
    expect(r.hits.length).toBeGreaterThan(0);
  });
  it("replaces 'that's our policy'", () => {
    const r = deEscalate("That's our policy, sorry.");
    expect(r.text).not.toContain("That's our policy");
  });
  it("returns no hits on clean text", () => {
    const r = deEscalate("Thanks for reaching out, I'd love to help.");
    expect(r.hits).toEqual([]);
  });
  it("handles multiple hits in one block", () => {
    const r = deEscalate("Unfortunately, that's our policy. You have to calm down.");
    expect(r.hits.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ai-customer-support positiveLanguageRewrite", () => {
  it("applies de-escalation and flags weak phrases", () => {
    const r = positiveLanguageRewrite("Unfortunately, our world-class service was disrupted.");
    expect(r.text).not.toContain("Unfortunately");
    expect(r.hits.some((h) => h.toLowerCase().includes("weak phrase"))).toBe(true);
  });
  it("returns no hits on clean text", () => {
    const r = positiveLanguageRewrite("Thanks for reaching out.");
    expect(r.hits).toEqual([]);
  });
});

// ---------- Rendering ----------

describe("ai-customer-support renderMarkdown", () => {
  const baseVars = {
    customerName: "Jane", agentName: "Sam", orderId: "ORD-1",
    productName: "Acme Pro", companyName: "Acme Inc.",
    issueSummary: "Damaged", ticketId: "TKT-9",
  };
  it("renders Markdown with header", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    const md = renderMarkdown(s);
    expect(md).toContain("# Refund Request — Live Chat — Empathetic");
    expect(md).toContain("## Opener");
    expect(md).toContain("## Closing");
  });
  it("includes compliance flag when relevant", () => {
    const s = generateScript("complaint-escalation", "chat", "empathetic", baseVars);
    const md = renderMarkdown(s);
    expect(md).toContain("Compliance flag");
  });
  it("includes warnings when present", () => {
    const s = generateScript("refund-request", "chat", "empathetic", {});
    const md = renderMarkdown(s);
    expect(md).toContain("## Warnings");
  });
  it("includes stage tips", () => {
    const s = generateScript("refund-request", "chat", "empathetic", baseVars);
    const md = renderMarkdown(s);
    expect(md).toContain("Tip:");
  });
});

describe("ai-customer-support renderJson", () => {
  it("renders valid JSON with all fields", () => {
    const s = generateScript("refund-request", "chat", "empathetic", {
      customerName: "Jane", agentName: "Sam",
    });
    const j = renderJson(s);
    const obj = JSON.parse(j);
    expect(obj.scenario).toBe("refund-request");
    expect(obj.channel).toBe("chat");
    expect(obj.tone).toBe("empathetic");
    expect(Array.isArray(obj.stages)).toBe(true);
    expect(obj.stages).toHaveLength(6);
  });
});

describe("ai-customer-support renderText", () => {
  it("renders flat transcript with stage labels", () => {
    const s = generateScript("refund-request", "chat", "empathetic", {
      customerName: "Jane", agentName: "Sam",
    });
    const t = renderText(s);
    expect(t).toContain("[Opener]");
    expect(t).toContain("[Closing]");
    expect(t).toContain("Jane");
  });
});

// ---------- history ----------

describe("ai-customer-support history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      scenario: "refund-request",
      channel: "chat",
      tone: "empathetic",
      issueSummary: "Damaged",
      preview: "Hi Jane…",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        scenario: "refund-request",
        channel: "chat",
        tone: "empathetic",
        issueSummary: "x",
        preview: "p",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      scenario: "refund-request",
      channel: "chat",
      tone: "empathetic",
      issueSummary: "x",
      preview: "p",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- macro library ----------

describe("ai-customer-support macro library", () => {
  it("loads empty initially", () => {
    expect(loadMacros()).toEqual([]);
  });
  it("saves and loads", () => {
    saveMacro({
      id: "m1",
      name: "Refund opener",
      scenario: "refund-request",
      channel: "chat",
      tone: "empathetic",
      text: "Hi Jane…",
      ts: 1,
    });
    const list = loadMacros();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("m1");
  });
  it("replaces by id", () => {
    saveMacro({ id: "m1", name: "v1", scenario: "refund-request", channel: "chat", tone: "empathetic", text: "a", ts: 1 });
    saveMacro({ id: "m1", name: "v2", scenario: "refund-request", channel: "chat", tone: "empathetic", text: "b", ts: 2 });
    const list = loadMacros();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("v2");
  });
  it("deletes by id", () => {
    saveMacro({ id: "m1", name: "v1", scenario: "refund-request", channel: "chat", tone: "empathetic", text: "a", ts: 1 });
    saveMacro({ id: "m2", name: "v2", scenario: "refund-request", channel: "chat", tone: "empathetic", text: "b", ts: 2 });
    const remaining = deleteMacro("m1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("m2");
  });
  it("clears all", () => {
    saveMacro({ id: "m1", name: "v1", scenario: "refund-request", channel: "chat", tone: "empathetic", text: "a", ts: 1 });
    clearMacros();
    expect(loadMacros()).toEqual([]);
  });
});

// ---------- share URL ----------

describe("ai-customer-support share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      scenario: "refund-request",
      channel: "chat",
      tone: "empathetic",
      vars: { customerName: "Jane", orderId: "ORD-1" },
    });
    expect(url).toContain("scenario=refund-request");
    expect(url).toContain("channel=chat");
    expect(url).toContain("tone=empathetic");
    expect(url).toContain("vars=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits vars param when empty", () => {
    const url = buildShareUrl({
      scenario: "refund-request",
      channel: "chat",
      tone: "empathetic",
      vars: {},
    });
    expect(url).not.toContain("vars=");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({
      scenario: "technical-issue",
      channel: "email",
      tone: "formal",
      vars: { customerName: "Jane" },
    });
    // Extract query/hash from full URL (window may be unavailable in test env).
    const hash = url.includes("#")
      ? url.slice(url.indexOf("#"))
      : url.includes("?")
        ? `#${url.slice(url.indexOf("?") + 1)}`
        : "";
    const s = parseShareUrl(hash);
    expect(s.scenario).toBe("technical-issue");
    expect(s.channel).toBe("email");
    expect(s.tone).toBe("formal");
    expect(s.vars.customerName).toBe("Jane");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.scenario).toBe("refund-request");
    expect(s.channel).toBe("chat");
    expect(s.tone).toBe("empathetic");
  });
  it("falls back to defaults on unknown scenario", () => {
    const s = parseShareUrl("scenario=bogus");
    expect(s.scenario).toBe("refund-request");
  });
  it("falls back to defaults on unknown channel/tone", () => {
    const s = parseShareUrl("scenario=refund-request&channel=carrier-pigeon&tone=sarcastic");
    expect(s.channel).toBe("chat");
    expect(s.tone).toBe("empathetic");
  });
  it("handles malformed vars JSON gracefully", () => {
    const s = parseShareUrl("scenario=refund-request&vars=not-json");
    expect(s.vars).toEqual({});
  });
});

// ---------- LLM prompt + result ----------

describe("ai-customer-support LLM prompt + result", () => {
  it("builds LLM prompt with scenario, channel, tone, vars, issue", () => {
    const p = buildLlmPrompt(
      "refund-request",
      "email",
      "formal",
      { customerName: "Jane" },
      "Order arrived damaged",
    );
    expect(p).toContain("customer-support coach");
    expect(p).toContain("refund-request");
    expect(p).toContain("email");
    expect(p).toContain("formal");
    expect(p).toContain("Jane");
    expect(p).toContain("Order arrived damaged");
    expect(p).toContain("JSON");
  });
  it("renders valid LLM result JSON", () => {
    const json = JSON.stringify({
      opener: "Hi Jane",
      acknowledgment: "Sorry",
      resolution: "Refund issued",
      objectionHandling: "Alternative",
      closing: "Bye",
      suggestions: ["Add proof"],
    });
    const r = renderLlmResult(json);
    expect(r.opener).toBe("Hi Jane");
    expect(r.acknowledgment).toBe("Sorry");
    expect(r.resolution).toBe("Refund issued");
    expect(r.objectionHandling).toBe("Alternative");
    expect(r.closing).toBe("Bye");
    expect(r.suggestions).toEqual(["Add proof"]);
  });
  it("renders LLM result wrapped in markdown fences", () => {
    const raw = '```json\n{"opener":"x","acknowledgment":"","resolution":"","objectionHandling":"","closing":"","suggestions":[]}\n```';
    const r = renderLlmResult(raw);
    expect(r.opener).toBe("x");
  });
  it("returns fallback on bad JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.opener).toBe("");
    expect(r.suggestions).toEqual([]);
  });
});

// ---------- brand voice storage ----------

describe("ai-customer-support brand voice storage", () => {
  it("loads default when empty", () => {
    expect(loadBrandVoice().name).toBe(DEFAULT_BRAND_VOICE.name);
  });
  it("saves and loads custom voice", () => {
    saveBrandVoice({
      name: "Acme",
      traits: ["witty", "expert"],
      avoid: ["bureaucratese"],
      signature: "— The Acme Crew",
    });
    const v = loadBrandVoice();
    expect(v.name).toBe("Acme");
    expect(v.traits).toEqual(["witty", "expert"]);
    expect(v.avoid).toEqual(["bureaucratese"]);
    expect(v.signature).toBe("— The Acme Crew");
  });
  it("falls back to default on bad JSON", () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(BRAND_VOICE_KEY, "not json");
    }
    const v = loadBrandVoice();
    expect(v.name).toBe(DEFAULT_BRAND_VOICE.name);
  });
});

// Suppress unused-import lint for re-exported types
export type _Unused = Scenario | Channel | Tone;
