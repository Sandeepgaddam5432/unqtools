import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  TARGET_MODEL_LABELS,
  USE_CASE_LABELS,
  USE_CASE_PRESETS,
  DEFAULT_OPTIONS,
  normalizePrompt,
  countVagueWords,
  analyzePrompt,
  scorePrompt,
  suggestImprovements,
  rewritePrompt,
  extractVariables,
  fillTemplate,
  buildDiff,
  estimateTokens,
  buildNegativeConstraints,
  renderAnalysisText,
  renderSuggestionsText,
  renderMarkdown,
  renderJson,
  renderDiffText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type TargetModel,
  type UseCase,
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

describe("ai-prompt-improver constants", () => {
  it("exposes history key and cap of 20", () => {
    expect(HISTORY_KEY).toContain("ai-prompt-improver");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 4 target models", () => {
    expect(Object.keys(TARGET_MODEL_LABELS)).toHaveLength(4);
    expect(TARGET_MODEL_LABELS.gpt4).toBe("GPT-4-class");
    expect(TARGET_MODEL_LABELS.local).toBe("Small Local");
  });
  it("has 6 use cases with presets", () => {
    expect(Object.keys(USE_CASE_LABELS)).toHaveLength(6);
    expect(Object.keys(USE_CASE_PRESETS)).toHaveLength(6);
    expect(USE_CASE_PRESETS.coding.role).toContain("engineer");
    expect(USE_CASE_PRESETS.coding.constraints.length).toBeGreaterThan(0);
  });
  it("has default options", () => {
    expect(DEFAULT_OPTIONS.targetModel).toBe("gpt4");
    expect(DEFAULT_OPTIONS.useCase).toBe("general");
  });
});

describe("ai-prompt-improver normalizePrompt", () => {
  it("trims and collapses spaces", () => {
    expect(normalizePrompt("  hello   world  ")).toBe("hello world");
  });
  it("normalizes CRLF to LF", () => {
    expect(normalizePrompt("a\r\nb")).toBe("a\nb");
  });
  it("handles empty", () => {
    expect(normalizePrompt("")).toBe("");
  });
});

describe("ai-prompt-improver countVagueWords", () => {
  it("counts vague words", () => {
    // thing, really, nice = 3 vague words
    expect(countVagueWords("make a thing that is really nice")).toBe(3);
    expect(countVagueWords("good stuff and nice things")).toBe(4);
  });
  it("returns 0 for clean text", () => {
    expect(countVagueWords("Build a React form")).toBe(0);
  });
});

describe("ai-prompt-improver analyzePrompt", () => {
  it("scores a weak one-line prompt low", () => {
    const a = analyzePrompt("write a thing");
    expect(a.overall).toBeLessThan(60);
    expect(a.wordCount).toBe(3);
    expect(a.hasRole).toBe(false);
  });
  it("scores a strong structured prompt higher", () => {
    const strong = [
      "Act as a senior backend engineer.",
      "Context: we run a Node.js service on AWS.",
      "Task: write a rate-limiter middleware.",
      "Constraints: must be under 100 lines; avoid external deps.",
      "Format: reply with code in a fenced block, then a short explanation.",
      "Example: input {ip:'1.2.3.4'} output {allowed:true}.",
    ].join(" ");
    const a = analyzePrompt(strong);
    expect(a.overall).toBeGreaterThan(70);
    expect(a.hasRole).toBe(true);
    expect(a.hasFormat).toBe(true);
    expect(a.hasConstraints).toBe(true);
    expect(a.hasContext).toBe(true);
    expect(a.hasExamples).toBe(true);
  });
  it("returns six dimension scores with tips", () => {
    const a = analyzePrompt("write a poem");
    expect(a.clarity.tips.length).toBeGreaterThan(0);
    expect(a.specificity.tips.length).toBeGreaterThan(0);
    expect(a.context.tips.length).toBeGreaterThan(0);
    expect(a.constraints.tips.length).toBeGreaterThan(0);
    expect(a.format.tips.length).toBeGreaterThan(0);
    expect(a.examples.tips.length).toBeGreaterThan(0);
  });
  it("clamps scores to 0-100", () => {
    const a = analyzePrompt("");
    for (const d of [a.clarity, a.specificity, a.context, a.constraints, a.format, a.examples]) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
    expect(a.overall).toBeGreaterThanOrEqual(0);
    expect(a.overall).toBeLessThanOrEqual(100);
  });
});

describe("ai-prompt-improver scorePrompt", () => {
  it("returns a number 0-100", () => {
    const s = scorePrompt("write a thing");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("ai-prompt-improver suggestImprovements", () => {
  it("suggests all five missing components for a weak prompt", () => {
    const s = suggestImprovements("write a thing", "general");
    const types = s.map((x) => x.type);
    expect(types).toContain("role");
    expect(types).toContain("context");
    expect(types).toContain("constraints");
    expect(types).toContain("format");
    expect(types).toContain("examples");
  });
  it("skips role when role cue is present", () => {
    const s = suggestImprovements("Act as a writer. Write a poem.", "writing");
    expect(s.map((x) => x.type)).not.toContain("role");
  });
  it("each suggestion has a non-empty snippet", () => {
    const s = suggestImprovements("x", "coding");
    for (const sug of s) {
      expect(sug.snippet.length).toBeGreaterThan(0);
      expect(sug.title.length).toBeGreaterThan(0);
      expect(sug.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-prompt-improver rewritePrompt", () => {
  it("produces a longer improved prompt with structure", () => {
    const r = rewritePrompt("write a thing", { targetModel: "gpt4", useCase: "general" });
    expect(r.improved.length).toBeGreaterThan(r.original.length);
    expect(r.improved).toContain("TASK:");
    expect(r.improved).toContain("CONTEXT:");
    expect(r.improved).toContain("FORMAT:");
  });
  it("uses XML tags for Claude target", () => {
    const r = rewritePrompt("write a thing", { targetModel: "claude", useCase: "general" });
    expect(r.improved).toContain("<task>");
    expect(r.improved).toContain("</task>");
    expect(r.improved).toContain("<context>");
  });
  it("includes a tail hint per target model", () => {
    const rGem = rewritePrompt("write a thing", { targetModel: "gemini", useCase: "general" });
    expect(rGem.improved).toContain("Be concise");
    const rLoc = rewritePrompt("write a thing", { targetModel: "local", useCase: "general" });
    expect(rLoc.improved).toContain("under 200 tokens");
  });
  it("extracts variables and produces a template", () => {
    const r = rewritePrompt('Translate "Hello World" to Python v3', { targetModel: "gpt4", useCase: "coding" });
    expect(r.variables.length).toBeGreaterThan(0);
    expect(r.template).toContain("{{");
    expect(r.template).toContain("}}");
  });
  it("produces a diff with added lines", () => {
    const r = rewritePrompt("write a thing");
    expect(r.diff.length).toBeGreaterThan(0);
    expect(r.diff.some((d) => d.type === "added")).toBe(true);
  });
  it("estimates tokens greater than zero", () => {
    const r = rewritePrompt("write a thing");
    expect(r.tokenEstimate).toBeGreaterThan(0);
  });
});

describe("ai-prompt-improver extractVariables", () => {
  it("extracts quoted strings", () => {
    const { template, variables } = extractVariables('Say "Hello World" loudly.');
    expect(variables.some((v) => v.original === "Hello World")).toBe(true);
    expect(template).toContain("{{");
  });
  it("extracts technology names", () => {
    const { variables } = extractVariables("Use TypeScript and Rust.");
    expect(variables.some((v) => v.original === "TypeScript")).toBe(true);
    expect(variables.some((v) => v.original === "Rust")).toBe(true);
  });
  it("extracts versions", () => {
    const { variables } = extractVariables("Upgrade to v2 and v3.1");
    expect(variables.some((v) => v.original === "v2")).toBe(true);
  });
  it("handles text with no variables", () => {
    const { template, variables } = extractVariables("plain text without variables");
    expect(variables).toEqual([]);
    expect(template).toBe("plain text without variables");
  });
});

describe("ai-prompt-improver fillTemplate", () => {
  it("replaces placeholders with values", () => {
    const out = fillTemplate("Hello {{name}}, you are {{role}}", { name: "Alice", role: "admin" });
    expect(out).toBe("Hello Alice, you are admin");
  });
  it("leaves unknown placeholders intact", () => {
    const out = fillTemplate("Hello {{name}}", {});
    expect(out).toBe("Hello {{name}}");
  });
});

describe("ai-prompt-improver buildDiff", () => {
  it("marks added lines", () => {
    const diff = buildDiff("a", "a\nb\nc");
    expect(diff.some((d) => d.type === "added" && d.text === "b")).toBe(true);
  });
  it("marks removed lines when original is not contained", () => {
    const diff = buildDiff("old line", "completely different");
    expect(diff.some((d) => d.type === "removed")).toBe(true);
  });
});

describe("ai-prompt-improver estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("hello world!")).toBeGreaterThanOrEqual(3);
  });
  it("returns at least 1 for any input", () => {
    expect(estimateTokens("")).toBe(1);
  });
});

describe("ai-prompt-improver buildNegativeConstraints", () => {
  it("builds a Do not block", () => {
    const out = buildNegativeConstraints(["use jargon", "exceed 100 words"]);
    expect(out).toContain("Do not:");
    expect(out).toContain("- use jargon");
  });
  it("returns empty string for no items", () => {
    expect(buildNegativeConstraints([])).toBe("");
    expect(buildNegativeConstraints(["  ", ""])).toBe("");
  });
});

describe("ai-prompt-improver renderers", () => {
  const r = rewritePrompt("write a thing", { targetModel: "gpt4", useCase: "general" });
  it("renderAnalysisText contains overall score", () => {
    const txt = renderAnalysisText(r.analysis);
    expect(txt).toContain("Overall score");
    expect(txt).toContain("Clarity");
  });
  it("renderSuggestionsText lists suggestions", () => {
    const txt = renderSuggestionsText(r.suggestions);
    expect(txt).toContain("Suggestions");
    expect(txt).toContain("role");
  });
  it("renderMarkdown contains headings and code block", () => {
    const md = renderMarkdown(r);
    expect(md).toContain("# Improved Prompt");
    expect(md).toContain("## Score");
    expect(md).toContain("```");
  });
  it("renderJson produces valid JSON", () => {
    const json = renderJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.improved).toBe(r.improved);
    expect(parsed.targetModel).toBe(r.targetModel);
  });
  it("renderDiffText prefixes lines", () => {
    const txt = renderDiffText([{ type: "added", text: "x" }, { type: "removed", text: "y" }, { type: "unchanged", text: "z" }]);
    expect(txt).toContain("+ x");
    expect(txt).toContain("- y");
    expect(txt).toContain("  z");
  });
});

describe("ai-prompt-improver history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      originalLength: 10,
      improvedLength: 200,
      overallScore: 50,
      targetModel: "gpt4",
      useCase: "general",
      variableCount: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalLength: 10,
        improvedLength: 200,
        overallScore: 50,
        targetModel: "gpt4",
        useCase: "general",
        variableCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, originalLength: 1, improvedLength: 1, overallScore: 1,
      targetModel: "gpt4", useCase: "general", variableCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-prompt-improver shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("write a thing", "claude", "coding");
    expect(url).toContain("p=write+a+thing");
    expect(url).toContain("m=claude");
    expect(url).toContain("u=coding");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("p=write+a+thing&m=claude&u=coding");
    expect(p.prompt).toBe("write a thing");
    expect(p.targetModel).toBe("claude");
    expect(p.useCase).toBe("coding");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.prompt).toBe("");
    expect(p.targetModel).toBe("gpt4");
    expect(p.useCase).toBe("general");
  });
  it("filters unknown target model", () => {
    const p = parseShareUrl("p=x&m=unknown&u=general");
    expect(p.targetModel).toBe("gpt4");
  });
  it("filters unknown use case", () => {
    const p = parseShareUrl("p=x&m=gpt4&u=unknown");
    expect(p.useCase).toBe("general");
  });
});

describe("ai-prompt-improver LLM helpers", () => {
  it("buildLlmPrompt includes target model label and original prompt", () => {
    const p = buildLlmPrompt("write a thing", "claude", "coding");
    expect(p).toContain("Claude");
    expect(p).toContain("Coding");
    expect(p).toContain("write a thing");
  });
  it("renderLlmResult normalizes and extracts variables", () => {
    const out = renderLlmResult('Act as a writer.\nWrite about "Hello".', "x");
    expect(out.improved).toContain("Hello");
    expect(out.template).toContain("{{");
  });
});

// Suppress unused-import lint
export type _Unused = TargetModel | UseCase;
