import { describe, it, expect, beforeEach } from "vitest";
import {
  CATEGORY_LABELS,
  OPERATION_LABELS,
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  SAMPLE_PROBLEMS,
  extractNumbers,
  extractOperations,
  extractUnits,
  classifyProblem,
  gcd,
  round,
  formatNumber,
  solveArithmetic,
  solveAlgebra,
  solveGeometry,
  solvePercentage,
  solveRatio,
  solveRate,
  solveMixture,
  solveProblem,
  formatStepsMarkdown,
  formatStepsText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ProblemCategory,
  type Operation,
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

describe("ai-math-word-problem-solver constants", () => {
  it("exposes category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(8);
    expect(CATEGORY_LABELS.percentage).toBe("Percentage");
  });
  it("exposes operation labels", () => {
    expect(Object.keys(OPERATION_LABELS)).toHaveLength(5);
    expect(OPERATION_LABELS.add).toContain("Addition");
  });
  it("has history/LLM keys", () => {
    expect(HISTORY_KEY).toContain("ai-math-word-problem-solver");
    expect(HISTORY_MAX).toBe(20);
    expect(LLM_KEY_STORAGE).toContain("ai-math-word-problem-solver");
  });
  it("ships 10+ sample problems", () => {
    expect(SAMPLE_PROBLEMS.length).toBeGreaterThanOrEqual(10);
    const cats = new Set(SAMPLE_PROBLEMS.map((s) => s.category));
    expect(cats.has("arithmetic")).toBe(true);
    expect(cats.has("algebra")).toBe(true);
    expect(cats.has("geometry")).toBe(true);
    expect(cats.has("percentage")).toBe(true);
    expect(cats.has("ratio")).toBe(true);
    expect(cats.has("rate")).toBe(true);
    expect(cats.has("mixture")).toBe(true);
  });
});

describe("ai-math-word-problem-solver extractNumbers", () => {
  it("extracts plain integers", () => {
    const ns = extractNumbers("Alice has 12 apples and Bob has 7.");
    expect(ns.map((n) => n.value)).toEqual([12, 7]);
    expect(ns[0]!.raw).toBe("12");
  });
  it("extracts decimals", () => {
    const ns = extractNumbers("The price is 3.14 dollars.");
    expect(ns[0]!.value).toBeCloseTo(3.14);
  });
  it("extracts negative numbers", () => {
    const ns = extractNumbers("The temperature is -5 degrees.");
    expect(ns[0]!.value).toBe(-5);
  });
  it("extracts fractions", () => {
    const ns = extractNumbers("Use 1/2 of the recipe.");
    expect(ns[0]!.value).toBeCloseTo(0.5);
  });
  it("extracts units (percent)", () => {
    const ns = extractNumbers("25% of 80");
    expect(ns[0]!.unit).toBe("%");
    expect(ns[1]!.value).toBe(80);
  });
  it("extracts units (km)", () => {
    const ns = extractNumbers("Travel 60 km in 3 hours");
    expect(ns[0]!.unit).toBe("km");
  });
  it("extracts dollar signs", () => {
    const ns = extractNumbers("$40 to $50");
    expect(ns[0]!.unit).toBe("$");
    expect(ns[1]!.unit).toBe("$");
  });
  it("returns empty for no numbers", () => {
    expect(extractNumbers("no numbers here")).toEqual([]);
  });
  it("handles empty input", () => {
    expect(extractNumbers("")).toEqual([]);
  });
});

describe("ai-math-word-problem-solver extractOperations", () => {
  it("detects add", () => {
    expect(extractOperations("sum of 5 and 3")).toContain("add");
  });
  it("detects subtract", () => {
    expect(extractOperations("difference between 8 and 3")).toContain("subtract");
  });
  it("detects multiply", () => {
    expect(extractOperations("twice 5")).toContain("multiply");
  });
  it("detects divide", () => {
    expect(extractOperations("divide 10 by 2")).toContain("divide");
  });
  it("detects multiple ops", () => {
    const ops = extractOperations("add 5 and 3 then multiply by 2");
    expect(ops).toContain("add");
    expect(ops).toContain("multiply");
  });
  it("returns unknown for no keywords", () => {
    expect(extractOperations("just numbers 5 and 3")).toEqual(["unknown"]);
  });
});

describe("ai-math-word-problem-solver extractUnits", () => {
  it("extracts miles", () => {
    expect(extractUnits("60 miles per hour")).toBe("miles");
  });
  it("extracts hours", () => {
    expect(extractUnits("3 hours of work")).toBe("hours");
  });
  it("returns empty for no units", () => {
    expect(extractUnits("just numbers")).toBe("");
  });
});

describe("ai-math-word-problem-solver classifyProblem", () => {
  it("classifies percentage", () => {
    expect(classifyProblem("What is 25 percent of 80?")).toBe("percentage");
  });
  it("classifies mixture", () => {
    expect(classifyProblem("Mix 5 liters of 20 percent solution with 10 liters of 5 percent solution")).toBe("mixture");
  });
  it("classifies geometry (rectangle)", () => {
    expect(classifyProblem("A rectangle is 8 long and 5 wide. What is its area?")).toBe("geometry");
  });
  it("classifies rate", () => {
    expect(classifyProblem("A car travels at 60 mph for 3 hours. How far?")).toBe("rate");
  });
  it("classifies ratio", () => {
    expect(classifyProblem("The ratio of cats to dogs is 3 to 2.")).toBe("ratio");
  });
  it("classifies algebra", () => {
    expect(classifyProblem("Twice a number plus 5 is 17. Find the number.")).toBe("algebra");
  });
  it("classifies arithmetic", () => {
    expect(classifyProblem("Alice has 12 apples. Bob gives her 7 more.")).toBe("arithmetic");
  });
  it("returns unknown for empty", () => {
    expect(classifyProblem("")).toBe("unknown");
  });
});

describe("ai-math-word-problem-solver math helpers", () => {
  it("gcd of 12 and 8 is 4", () => {
    expect(gcd(12, 8)).toBe(4);
  });
  it("gcd handles zero", () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(5, 0)).toBe(5);
  });
  it("round to 2 decimals", () => {
    expect(round(3.14159, 2)).toBe(3.14);
  });
  it("formatNumber preserves integers", () => {
    expect(formatNumber(5)).toBe("5");
  });
  it("formatNumber rounds decimals", () => {
    expect(formatNumber(3.14159, 2)).toBe("3.14");
  });
  it("formatNumber handles NaN", () => {
    expect(formatNumber(NaN)).toBe("NaN");
  });
});

describe("ai-math-word-problem-solver solveArithmetic", () => {
  it("solves addition", () => {
    const sol = solveArithmetic("Alice has 12 apples and Bob gives her 7 more. How many?");
    expect(sol.category).toBe("arithmetic");
    expect(sol.answerValue).toBe(19);
    expect(sol.verified).toBe(true);
  });
  it("solves subtraction", () => {
    const sol = solveArithmetic("The difference between 15 and 7.");
    expect(sol.answerValue).toBe(8);
    expect(sol.verified).toBe(true);
  });
  it("solves multiplication", () => {
    const sol = solveArithmetic("There are 8 pens per box. How many pens are in 6 boxes?");
    expect(sol.answerValue).toBe(48);
    expect(sol.verified).toBe(true);
  });
  it("solves division", () => {
    const sol = solveArithmetic("Divide 24 by 6.");
    expect(sol.answerValue).toBe(4);
    expect(sol.verified).toBe(true);
  });
  it("handles division by zero", () => {
    const sol = solveArithmetic("Divide 5 by 0.");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
  it("warns on insufficient numbers", () => {
    const sol = solveArithmetic("Just one number: 5");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solveAlgebra", () => {
  it("solves 'twice a number plus 5 is 17'", () => {
    const sol = solveAlgebra("Twice a number plus 5 is 17. Find the number.");
    expect(sol.answerValue).toBe(6);
    expect(sol.verified).toBe(true);
  });
  it("solves 'three times a number equals 21'", () => {
    const sol = solveAlgebra("Three times a number equals 21. Find the number.");
    expect(sol.answerValue).toBe(7);
    expect(sol.verified).toBe(true);
  });
  it("solves 'a number plus 5 is 12'", () => {
    const sol = solveAlgebra("A number plus 5 is 12. Find the number.");
    expect(sol.answerValue).toBe(7);
    expect(sol.verified).toBe(true);
  });
  it("solves 'a number minus 3 is 10'", () => {
    const sol = solveAlgebra("A number minus 3 is 10. Find the number.");
    expect(sol.answerValue).toBe(13);
    expect(sol.verified).toBe(true);
  });
  it("handles missing target", () => {
    const sol = solveAlgebra("Twice a number is some value.");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solveGeometry", () => {
  it("solves rectangle area", () => {
    const sol = solveGeometry("A rectangle is 8 meters long and 5 meters wide. What is its area?");
    expect(sol.answerValue).toBe(40);
    expect(sol.verified).toBe(true);
    expect(sol.answer).toContain("meters²");
  });
  it("solves rectangle perimeter", () => {
    const sol = solveGeometry("A rectangle is 8 meters long and 5 meters wide. What is its perimeter?");
    expect(sol.answerValue).toBe(26);
    expect(sol.verified).toBe(true);
  });
  it("solves triangle area", () => {
    const sol = solveGeometry("What is the area of a triangle with base 10 and height 6?");
    expect(sol.answerValue).toBe(30);
    expect(sol.verified).toBe(true);
  });
  it("solves circle area", () => {
    const sol = solveGeometry("What is the area of a circle with radius 4 cm? Use pi as 3.14159.");
    expect(sol.answerValue).toBeCloseTo(3.14159 * 16, 4);
    expect(sol.verified).toBe(true);
  });
  it("warns on insufficient dimensions", () => {
    const sol = solveGeometry("A rectangle has length 5. What is its area?");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
  it("warns on unrecognized shape", () => {
    const sol = solveGeometry("What is the volume of a dodecahedron with side 3?");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solvePercentage", () => {
  it("solves 'what is X% of Y'", () => {
    const sol = solvePercentage("What is 25 percent of 80?");
    expect(sol.answerValue).toBe(20);
    expect(sol.verified).toBe(true);
  });
  it("solves 'X is what percent of Y'", () => {
    const sol = solvePercentage("30 is what percent of 120?");
    expect(sol.answerValue).toBe(25);
    expect(sol.verified).toBe(true);
  });
  it("solves percent increase", () => {
    const sol = solvePercentage("A price increases from $40 to $50. What is the percent increase?");
    expect(sol.answerValue).toBe(25);
    expect(sol.answer).toContain("increase");
    expect(sol.verified).toBe(true);
  });
  it("solves percent decrease", () => {
    const sol = solvePercentage("A price decreases from $50 to $40. What is the percent decrease?");
    expect(sol.answerValue).toBe(-20);
    expect(sol.answer).toContain("decrease");
    expect(sol.verified).toBe(true);
  });
  it("handles division by zero", () => {
    const sol = solvePercentage("5 is what percent of 0?");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
  it("warns on unrecognized pattern", () => {
    const sol = solvePercentage("Just some random text without percent pattern.");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solveRatio", () => {
  it("solves part-to-whole with total", () => {
    const sol = solveRatio("The ratio of cats to dogs is 3 to 2. If there are 25 animals total, how many cats are there?");
    expect(sol.answerValue).toBe(15);
    expect(sol.verified).toBe(true);
  });
  it("solves scaling (if A is M, how many B?)", () => {
    const sol = solveRatio("The ratio of cats to dogs is 2 to 5. If there are 10 cats, how many dogs are there?");
    expect(sol.answerValue).toBe(25);
    expect(sol.verified).toBe(true);
  });
  it("warns on unrecognized pattern", () => {
    const sol = solveRatio("Some random text about nothing.");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solveRate", () => {
  it("solves distance = rate × time", () => {
    const sol = solveRate("A car travels at 60 miles per hour for 3 hours. How far does it travel?");
    expect(sol.answerValue).toBe(180);
    expect(sol.verified).toBe(true);
  });
  it("solves work problem", () => {
    const sol = solveRate("Alice can paint a wall in 4 hours and Bob in 6 hours. How long does it take them together?");
    // 1/(1/4 + 1/6) = 1/(5/12) = 12/5 = 2.4
    expect(sol.answerValue).toBeCloseTo(2.4, 4);
    expect(sol.verified).toBe(true);
  });
  it("handles zero work rate", () => {
    const sol = solveRate("Alice can paint a wall in 0 hours and Bob in 6 hours. Together?");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
  it("warns on unrecognized pattern", () => {
    const sol = solveRate("Some random text about something.");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solveMixture", () => {
  it("solves basic mixture", () => {
    // v1 = v2 * (cf - c2) / (c1 - cf) = 10 * (0.10 - 0.05) / (0.20 - 0.10) = 10 * 0.05/0.10 = 5
    const sol = solveMixture("How many liters of a 20 percent salt solution must be added to 10 liters of a 5 percent solution to make a 10 percent solution?");
    expect(sol.answerValue).toBeCloseTo(5, 4);
    expect(sol.verified).toBe(true);
  });
  it("warns on unreachable target", () => {
    // Target 30% but added 20% and existing 5% — can't reach 30%
    const sol = solveMixture("How many liters of a 20 percent salt solution must be added to 10 liters of a 5 percent solution to make a 30 percent solution?");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
  it("warns on unrecognized pattern", () => {
    const sol = solveMixture("Some random text without percentages.");
    expect(sol.answerValue).toBeNull();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-math-word-problem-solver solveProblem (dispatcher)", () => {
  it("dispatches arithmetic", () => {
    const sol = solveProblem("Alice has 12 apples and Bob gives her 7 more. How many?");
    expect(sol.category).toBe("arithmetic");
    expect(sol.answerValue).toBe(19);
  });
  it("dispatches algebra", () => {
    const sol = solveProblem("Twice a number plus 5 is 17. Find the number.");
    expect(sol.category).toBe("algebra");
    expect(sol.answerValue).toBe(6);
  });
  it("dispatches geometry", () => {
    const sol = solveProblem("A rectangle is 8 meters long and 5 meters wide. What is its area?");
    expect(sol.category).toBe("geometry");
    expect(sol.answerValue).toBe(40);
  });
  it("dispatches percentage", () => {
    const sol = solveProblem("What is 25 percent of 80?");
    expect(sol.category).toBe("percentage");
    expect(sol.answerValue).toBe(20);
  });
  it("dispatches ratio", () => {
    const sol = solveProblem("The ratio of cats to dogs is 3 to 2. If there are 25 animals total, how many cats are there?");
    expect(sol.category).toBe("ratio");
    expect(sol.answerValue).toBe(15);
  });
  it("dispatches rate", () => {
    const sol = solveProblem("A car travels at 60 miles per hour for 3 hours. How far does it travel?");
    expect(sol.category).toBe("rate");
    expect(sol.answerValue).toBe(180);
  });
  it("dispatches mixture", () => {
    const sol = solveProblem("How many liters of a 20 percent salt solution must be added to 10 liters of a 5 percent solution to make a 10 percent solution?");
    expect(sol.category).toBe("mixture");
    expect(sol.answerValue).toBeCloseTo(5, 4);
  });
  it("handles empty input", () => {
    const sol = solveProblem("");
    expect(sol.category).toBe("unknown");
    expect(sol.answerValue).toBeNull();
  });
  it("solves all sample problems without crashing", () => {
    for (const s of SAMPLE_PROBLEMS) {
      const sol = solveProblem(s.problem);
      expect(sol.category).toBe(s.category);
      expect(sol.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-math-word-problem-solver formatStepsMarkdown", () => {
  it("renders markdown with all sections", () => {
    const sol = solveProblem("What is 25 percent of 80?");
    const md = formatStepsMarkdown(sol, "What is 25 percent of 80?");
    expect(md).toContain("# Math Word Problem Solution");
    expect(md).toContain("**Problem:**");
    expect(md).toContain("**Category:** Percentage");
    expect(md).toContain("## Equation");
    expect(md).toContain("## Steps");
    expect(md).toContain("## Answer");
    expect(md).toContain("20");
    expect(md).toContain("Verified");
  });
  it("includes warnings when present", () => {
    const sol = solveProblem("random text");
    const md = formatStepsMarkdown(sol, "random text");
    expect(md).toContain("## Warnings");
  });
});

describe("ai-math-word-problem-solver formatStepsText", () => {
  it("strips markdown formatting", () => {
    const sol = solveProblem("What is 25 percent of 80?");
    const txt = formatStepsText(sol, "What is 25 percent of 80?");
    expect(txt).not.toContain("**");
    expect(txt).not.toContain("```");
    expect(txt).not.toContain("# ");
    expect(txt).toContain("Problem:");
    expect(txt).toContain("Answer");
  });
});

describe("ai-math-word-problem-solver history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, problem: "What is 25% of 80?", category: "percentage", answer: "20", verified: true });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].category).toBe("percentage");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, problem: `p${i}`, category: "arithmetic", answer: "1", verified: true });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, problem: "p", category: "arithmetic", answer: "1", verified: true });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-math-word-problem-solver shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("What is 25 percent of 80?");
    expect(url).toContain("p=What+is+25+percent+of+80");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("What is 25 percent of 80?");
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    expect(parseShareUrl(hash)).toBe("What is 25 percent of 80?");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toBe("");
  });
  it("returns empty when no p param", () => {
    expect(parseShareUrl("foo=bar")).toBe("");
  });
});

describe("ai-math-word-problem-solver LLM prompt", () => {
  it("builds a prompt", () => {
    const prompt = buildLlmPrompt("What is 25% of 80?");
    expect(prompt.system).toContain("math tutor");
    expect(prompt.user).toContain("What is 25% of 80?");
    expect(prompt.user).toContain("Category");
  });
  it("strips code fences from result", () => {
    const raw = "```text\nSetup goes here\n```";
    expect(renderLlmResult(raw)).toBe("Setup goes here");
  });
  it("passes through non-fenced text", () => {
    const raw = "Setup goes here";
    expect(renderLlmResult(raw)).toBe("Setup goes here");
  });
});

// Suppress unused-import lint
export type _Unused = ProblemCategory | Operation;
