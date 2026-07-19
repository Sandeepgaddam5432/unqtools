import { describe, it, expect, beforeEach } from "vitest";
import {
  DEPARTMENT_PRESETS,
  normalizeText,
  splitCsvRow,
  parseRoles,
  parseProcessSteps,
  parseTools,
  parseReferences,
  parseTroubleshooting,
  parseDateYMD,
  formatDateYMD,
  calculateNextReviewDate,
  calculateTotalProcessDuration,
  formatDuration,
  departmentCode,
  suggestSopId,
  validateSop,
  summaryStats,
  renderText,
  renderMarkdown,
  renderHtml,
  renderQuickReferenceCard,
  renderQuickReferenceCardHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SopInput,
  type SopProcessStep,
  type SopRole,
  type SopTroubleshooting,
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

function sampleInput(overrides: Partial<SopInput> = {}): SopInput {
  return {
    sopTitle: "Code Review Process",
    sopId: "SOP-2026-ENG-001",
    version: "1.0",
    department: "Engineering",
    lastReviewedDate: "2026-01-15",
    nextReviewDate: "2027-01-15",
    purpose: "Ensure consistent code quality before merging changes to main.",
    scope: "Applies to all pull requests targeting the main branch.",
    roles: "Author,Submits pull request\nReviewer,Reviews code and approves\nLead,Merges after approval",
    process: "1,Author opens pull request,5\n2,Reviewer inspects changes,30\n3,Reviewer leaves comments,10",
    tools: "GitHub\nJira\nSlack",
    troubleshooting: "PR has conflicts,Rebase against main and resolve\nTests failing,Run locally and fix before re-requesting review",
    references: "CONTRIBUTING.md\nInternal Style Guide",
    ...overrides,
  };
}

function parsedAll(input: SopInput) {
  const steps = parseProcessSteps(input.process).items;
  const roles = parseRoles(input.roles).items;
  const tools = parseTools(input.tools);
  const trouble = parseTroubleshooting(input.troubleshooting).items;
  const refs = parseReferences(input.references);
  const stats = summaryStats(steps, roles, tools, trouble, refs);
  return { steps, roles, tools, trouble, refs, stats };
}

// ---- Constants ----

describe("sop-generator constants", () => {
  it("has 8 department presets", () => {
    expect(DEPARTMENT_PRESETS).toHaveLength(8);
  });
  it("includes Engineering and Legal", () => {
    expect(DEPARTMENT_PRESETS.some((p) => p.value === "engineering")).toBe(true);
    expect(DEPARTMENT_PRESETS.some((p) => p.value === "legal")).toBe(true);
  });
  it("every preset has a 2-3 letter uppercase code", () => {
    expect(DEPARTMENT_PRESETS.every((p) => /^[A-Z]{2,3}$/.test(p.code))).toBe(true);
  });
  it("HR preset uses 2-letter code", () => {
    expect(DEPARTMENT_PRESETS.find((p) => p.value === "hr")?.code).toBe("HR");
  });
  it("every preset has sample roles and process", () => {
    expect(DEPARTMENT_PRESETS.every((p) => p.sampleRoles.length > 0 && p.sampleProcess.length > 0)).toBe(true);
  });
});

// ---- normalizeText ----

describe("sop-generator normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Hello   World  ")).toBe("Hello World");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

// ---- splitCsvRow ----

describe("sop-generator splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"she said ""hi""",x')).toEqual(['she said "hi"', "x"]);
  });
});

// ---- parseRoles ----

describe("sop-generator parseRoles", () => {
  it("parses two-column rows", () => {
    const { items, errors } = parseRoles("Manager,Approves deliverable\nEngineer,Executes work");
    expect(errors).toHaveLength(0);
    expect(items).toEqual([
      { role: "Manager", responsibility: "Approves deliverable" },
      { role: "Engineer", responsibility: "Executes work" },
    ]);
  });
  it("trims whitespace and collapses spaces in responsibility", () => {
    const { items } = parseRoles("Lead,  Owns   delivery  ");
    expect(items[0].responsibility).toBe("Owns delivery");
  });
  it("reports error on missing responsibility column", () => {
    const { items, errors } = parseRoles("JustARole");
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("needs role,responsibility");
  });
  it("skips blank lines", () => {
    const { items } = parseRoles("A,B\n\nC,D");
    expect(items).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseRoles("")).toEqual({ items: [], errors: [] });
  });
});

// ---- parseProcessSteps ----

describe("sop-generator parseProcessSteps", () => {
  it("parses three-column rows", () => {
    const { items, errors } = parseProcessSteps("1,Gather requirements,30\n2,Design solution,60");
    expect(errors).toHaveLength(0);
    expect(items).toEqual([
      { stepNumber: 1, action: "Gather requirements", durationMinutes: 30 },
      { stepNumber: 2, action: "Design solution", durationMinutes: 60 },
    ]);
  });
  it("defaults missing duration to 0", () => {
    const { items } = parseProcessSteps("1,Do a thing");
    expect(items[0].durationMinutes).toBe(0);
  });
  it("auto-numbers when step number is invalid", () => {
    const { items } = parseProcessSteps("x,First step,10\ny,Second step,20");
    expect(items[0].stepNumber).toBe(1);
    expect(items[1].stepNumber).toBe(2);
  });
  it("reports error on invalid duration", () => {
    const { items, errors } = parseProcessSteps("1,Bad step,abc");
    expect(items).toHaveLength(0);
    expect(errors[0]).toContain("invalid duration");
  });
  it("rejects negative duration", () => {
    const { items, errors } = parseProcessSteps("1,Bad step,-5");
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
  it("reports error when action missing", () => {
    const { errors } = parseProcessSteps("1,,10");
    expect(errors[0]).toContain("action is required");
  });
  it("returns empty for empty input", () => {
    expect(parseProcessSteps("")).toEqual({ items: [], errors: [] });
  });
});

// ---- parseTools / parseReferences ----

describe("sop-generator parseTools and parseReferences", () => {
  it("parses tools one per line", () => {
    expect(parseTools("GitHub\nJira\nSlack")).toEqual(["GitHub", "Jira", "Slack"]);
  });
  it("skips blank lines in tools", () => {
    expect(parseTools("GitHub\n\nSlack\n  ")).toEqual(["GitHub", "Slack"]);
  });
  it("parses references one per line", () => {
    expect(parseReferences("CONTRIBUTING.md\nStyle Guide")).toEqual(["CONTRIBUTING.md", "Style Guide"]);
  });
  it("returns empty for empty input", () => {
    expect(parseTools("")).toEqual([]);
    expect(parseReferences("")).toEqual([]);
  });
});

// ---- parseTroubleshooting ----

describe("sop-generator parseTroubleshooting", () => {
  it("parses issue,solution pairs", () => {
    const { items, errors } = parseTroubleshooting("Tests failing,Run locally and fix\nPR conflicts,Rebase against main");
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ issue: "Tests failing", solution: "Run locally and fix" });
  });
  it("reports error on single-column row", () => {
    const { items, errors } = parseTroubleshooting("Just an issue");
    expect(items).toHaveLength(0);
    expect(errors[0]).toContain("needs issue,solution");
  });
  it("returns empty for empty input", () => {
    expect(parseTroubleshooting("")).toEqual({ items: [], errors: [] });
  });
});

// ---- Date helpers ----

describe("sop-generator date helpers", () => {
  it("parses valid YYYY-MM-DD", () => {
    const d = parseDateYMD("2026-01-15");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(15);
  });
  it("rejects malformed strings", () => {
    expect(parseDateYMD("01/15/2026")).toBeNull();
    expect(parseDateYMD("not-a-date")).toBeNull();
    expect(parseDateYMD("")).toBeNull();
  });
  it("rejects rolled-over dates (Feb 30)", () => {
    expect(parseDateYMD("2026-02-30")).toBeNull();
  });
  it("formats a Date as YYYY-MM-DD", () => {
    expect(formatDateYMD(new Date(Date.UTC(2027, 0, 15)))).toBe("2027-01-15");
  });
  it("calculates next review date +1 year (same day)", () => {
    expect(calculateNextReviewDate("2026-01-15")).toBe("2027-01-15");
  });
  it("handles Feb 29 by rolling to Mar 1 in non-leap year", () => {
    // 2024 is a leap year; +1 year = 2025-03-01
    expect(calculateNextReviewDate("2024-02-29")).toBe("2025-03-01");
  });
  it("returns empty for invalid last reviewed", () => {
    expect(calculateNextReviewDate("")).toBe("");
    expect(calculateNextReviewDate("nope")).toBe("");
  });
});

// ---- Duration helpers ----

describe("sop-generator duration helpers", () => {
  it("sums step durations", () => {
    const steps: SopProcessStep[] = [
      { stepNumber: 1, action: "A", durationMinutes: 30 },
      { stepNumber: 2, action: "B", durationMinutes: 45 },
    ];
    expect(calculateTotalProcessDuration(steps)).toBe(75);
  });
  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45m");
  });
  it("formats hours only", () => {
    expect(formatDuration(120)).toBe("2h");
  });
  it("formats mixed hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });
  it("formats zero as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

// ---- SOP ID suggestion ----

describe("sop-generator suggestSopId", () => {
  it("uses department code from presets", () => {
    const id = suggestSopId("Engineering", 1);
    expect(id).toMatch(/^SOP-\d{4}-ENG-001$/);
  });
  it("is case-insensitive on department", () => {
    expect(suggestSopId("hr", 7)).toMatch(/-HR-007$/);
  });
  it("pads sequence to 3 digits", () => {
    expect(suggestSopId("Finance", 12)).toMatch(/-FIN-012$/);
  });
  it("falls back to first 3 letters of unknown department", () => {
    expect(suggestSopId("Compliance", 1)).toMatch(/-COM-001$/);
  });
  it("departmentCode pads short unknown names with X", () => {
    // "QA" is not a preset, so the fallback path runs and pads to 3 chars.
    expect(departmentCode("QA")).toBe("QAX");
  });
});

// ---- Validation ----

describe("sop-generator validateSop", () => {
  it("returns no errors for a complete valid SOP", () => {
    const input = sampleInput();
    const steps = parseProcessSteps(input.process).items;
    expect(validateSop(input, steps)).toEqual([]);
  });
  it("flags missing title", () => {
    const input = sampleInput({ sopTitle: "  " });
    const steps = parseProcessSteps(input.process).items;
    const errors = validateSop(input, steps);
    expect(errors.some((e) => e.includes("title"))).toBe(true);
  });
  it("flags missing purpose", () => {
    const input = sampleInput({ purpose: "" });
    const steps = parseProcessSteps(input.process).items;
    const errors = validateSop(input, steps);
    expect(errors.some((e) => e.includes("Purpose"))).toBe(true);
  });
  it("flags no process steps", () => {
    const input = sampleInput({ process: "" });
    const errors = validateSop(input, []);
    expect(errors.some((e) => e.includes("process step"))).toBe(true);
  });
  it("flags invalid last reviewed date", () => {
    const input = sampleInput({ lastReviewedDate: "nope" });
    const steps = parseProcessSteps(input.process).items;
    const errors = validateSop(input, steps);
    expect(errors.some((e) => e.includes("Last reviewed date"))).toBe(true);
  });
});

// ---- Summary stats ----

describe("sop-generator summaryStats", () => {
  it("computes counts and totals", () => {
    const input = sampleInput();
    const { stats } = parsedAll(input);
    expect(stats.stepCount).toBe(3);
    expect(stats.totalDurationMinutes).toBe(45);
    expect(stats.roleCount).toBe(3);
    expect(stats.toolCount).toBe(3);
    expect(stats.troubleshootingCount).toBe(2);
    expect(stats.referenceCount).toBe(2);
  });
  it("returns zeros for empty input", () => {
    const stats = summaryStats([], [], [], [], []);
    expect(stats).toEqual({
      stepCount: 0,
      totalDurationMinutes: 0,
      roleCount: 0,
      toolCount: 0,
      troubleshootingCount: 0,
      referenceCount: 0,
    });
  });
});

// ---- Renderers ----

describe("sop-generator renderText", () => {
  it("includes title, purpose, process steps, and totals", () => {
    const input = sampleInput();
    const { steps, roles, tools, trouble, refs, stats } = parsedAll(input);
    const text = renderText(input, steps, roles, tools, trouble, refs, stats);
    expect(text).toContain("STANDARD OPERATING PROCEDURE");
    expect(text).toContain("Code Review Process");
    expect(text).toContain("SOP ID:      SOP-2026-ENG-001");
    expect(text).toContain("1. PURPOSE");
    expect(text).toContain("Step 1: Author opens pull request");
    expect(text).toContain("Total process duration: 45m");
  });
  it("handles empty process gracefully", () => {
    const input = sampleInput({ process: "" });
    const { steps, roles, tools, trouble, refs, stats } = parsedAll(input);
    const text = renderText(input, steps, roles, tools, trouble, refs, stats);
    expect(text).toContain("(no process steps)");
  });
});

describe("sop-generator renderMarkdown", () => {
  it("emits markdown headings and tables", () => {
    const input = sampleInput();
    const { steps, roles, tools, trouble, refs, stats } = parsedAll(input);
    const md = renderMarkdown(input, steps, roles, tools, trouble, refs, stats);
    expect(md).toContain("# Code Review Process");
    expect(md).toContain("## 1. Purpose");
    expect(md).toContain("| Step | Action | Duration |");
    expect(md).toContain("| 1 | Author opens pull request | 5m |");
    expect(md).toContain("> **Total process duration:** 45m");
  });
});

describe("sop-generator renderHtml", () => {
  it("emits a full HTML document with inline CSS", () => {
    const input = sampleInput();
    const { steps, roles, tools, trouble, refs, stats } = parsedAll(input);
    const html = renderHtml(input, steps, roles, tools, trouble, refs, stats);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Code Review Process</title>");
    expect(html).toContain("<style>");
    expect(html).toContain("Author opens pull request");
    expect(html).toContain("@media print");
  });
  it("escapes HTML-unsafe characters in fields", () => {
    const input = sampleInput({ purpose: "<script>alert(1)</script>", sopTitle: "A & B" });
    const { steps, roles, tools, trouble, refs, stats } = parsedAll(input);
    const html = renderHtml(input, steps, roles, tools, trouble, refs, stats);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});

describe("sop-generator renderQuickReferenceCard", () => {
  it("renders a compact text card", () => {
    const input = sampleInput();
    const { steps, stats } = parsedAll(input);
    const card = renderQuickReferenceCard(input, steps, stats);
    expect(card).toContain("SOP QUICK REFERENCE CARD");
    expect(card).toContain("Code Review Process");
    expect(card).toContain("1. Author opens pull request");
    expect(card).toContain("Total: 45m");
  });
});

describe("sop-generator renderQuickReferenceCardHtml", () => {
  it("emits an HTML card with numbered steps", () => {
    const input = sampleInput();
    const { steps, stats } = parsedAll(input);
    const html = renderQuickReferenceCardHtml(input, steps, stats);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("SOP Quick Reference");
    expect(html).toContain("class=\"num\"");
    expect(html).toContain("Author opens pull request");
  });
});

describe("sop-generator renderCsv", () => {
  it("emits header and rows", () => {
    const steps: SopProcessStep[] = [
      { stepNumber: 1, action: "Step A", durationMinutes: 10 },
      { stepNumber: 2, action: "Step, with comma", durationMinutes: 20 },
    ];
    const csv = renderCsv(steps);
    expect(csv).toContain("step_number,action,duration_minutes");
    expect(csv).toContain("1,Step A,10");
    // Action with comma should be quoted
    expect(csv).toContain('"Step, with comma"');
  });
  it("emits only header for empty steps", () => {
    expect(renderCsv([])).toBe("step_number,action,duration_minutes");
  });
});

// ---- History ----

describe("sop-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      sopTitle: "Test SOP",
      sopId: "SOP-2026-ENG-001",
      department: "Engineering",
      version: "1.0",
      lastReviewedDate: "2026-01-15",
      stepCount: 3,
      totalDurationMinutes: 45,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].sopTitle).toBe("Test SOP");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        sopTitle: `SOP ${i}`,
        sopId: "SOP-2026-ENG-001",
        department: "Engineering",
        version: "1.0",
        lastReviewedDate: "2026-01-15",
        stepCount: 1,
        totalDurationMinutes: 10,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, sopTitle: "x", sopId: "", department: "", version: "",
      lastReviewedDate: "", stepCount: 0, totalDurationMinutes: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("sop-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ sopTitle: "Test", department: "Engineering" });
    expect(url).toContain("title=Test");
    expect(url).toContain("dept=Engineering");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("title", "Test SOP");
    params.set("id", "SOP-2026-ENG-001");
    params.set("process", "1,Step A,10");
    const parsed = parseShareUrl(`#${params.toString()}`);
    expect(parsed.sopTitle).toBe("Test SOP");
    expect(parsed.sopId).toBe("SOP-2026-ENG-001");
    expect(parsed.process).toBe("1,Step A,10");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores leading hash", () => {
    const p = parseShareUrl("#title=Hello");
    expect(p.sopTitle).toBe("Hello");
  });
});

// Suppress unused-import lint for type-only imports used above
export type _Unused =
  | SopRole
  | SopTroubleshooting;
