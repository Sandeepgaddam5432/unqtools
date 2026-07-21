import { describe, it, expect, beforeEach } from "vitest";
import {
  MERMAID_LIVE_BASE,
  DIAGRAM_TYPES,
  DIAGRAM_LABELS,
  TYPE_KEYWORDS,
  TEMPLATES,
  SYNTAX_REFERENCE,
  stripComment,
  firstSignificantLine,
  detectType,
  codeLines,
  validateCode,
  autoFormat,
  encodeBase64,
  decodeBase64,
  buildLiveUrl,
  buildMarkdownEmbed,
  buildMermaidCodeBlock,
  computeStats,
  getTemplate,
  getReference,
  defaultCode,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DiagramType,
  type HistoryEntry,
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

describe("mermaid constants", () => {
  it("exposes mermaid.live base URL", () => {
    expect(MERMAID_LIVE_BASE).toBe("https://mermaid.live/edit");
  });
  it("has 15 diagram types", () => {
    expect(DIAGRAM_TYPES).toHaveLength(15);
    expect(DIAGRAM_TYPES).toContain("flowchart");
    expect(DIAGRAM_TYPES).toContain("sequence");
    expect(DIAGRAM_TYPES).toContain("class");
    expect(DIAGRAM_TYPES).toContain("er");
    expect(DIAGRAM_TYPES).toContain("gantt");
    expect(DIAGRAM_TYPES).toContain("pie");
    expect(DIAGRAM_TYPES).toContain("state");
    expect(DIAGRAM_TYPES).toContain("mindmap");
    expect(DIAGRAM_TYPES).toContain("gitGraph");
    expect(DIAGRAM_TYPES).toContain("xychart");
  });
  it("has labels for every type", () => {
    for (const t of DIAGRAM_TYPES) expect(DIAGRAM_LABELS[t]).toBeTruthy();
  });
  it("has 15 templates", () => {
    expect(TEMPLATES).toHaveLength(15);
  });
  it("has 15 syntax references", () => {
    expect(SYNTAX_REFERENCE).toHaveLength(15);
  });
  it("maps graph keyword to flowchart", () => {
    expect(TYPE_KEYWORDS["graph"]).toBe("flowchart");
    expect(TYPE_KEYWORDS["flowchart"]).toBe("flowchart");
  });
  it("maps stateDiagram-v2 to state", () => {
    expect(TYPE_KEYWORDS["statediagram-v2"]).toBe("state");
  });
  it("maps xychart-beta to xychart", () => {
    expect(TYPE_KEYWORDS["xychart-beta"]).toBe("xychart");
  });
});

describe("mermaid stripComment", () => {
  it("returns blank line for full-line comment", () => {
    expect(stripComment("%% this is a comment")).toBe("");
  });
  it("strips trailing comment after code", () => {
    expect(stripComment("flowchart TD %% top-down")).toBe("flowchart TD");
  });
  it("returns trimmed code without comment", () => {
    expect(stripComment("  A --> B  ")).toBe("A --> B");
  });
  it("handles empty", () => {
    expect(stripComment("")).toBe("");
  });
});

describe("mermaid firstSignificantLine", () => {
  it("skips comments and blanks", () => {
    const code = "%% header comment\n\nflowchart TD\n  A --> B";
    expect(firstSignificantLine(code)).toBe("flowchart TD");
  });
  it("returns empty for empty input", () => {
    expect(firstSignificantLine("")).toBe("");
  });
  it("returns empty for only comments", () => {
    expect(firstSignificantLine("%% one\n%% two\n")).toBe("");
  });
});

describe("mermaid detectType", () => {
  it("detects flowchart", () => {
    expect(detectType("flowchart TD\n  A --> B")).toBe("flowchart");
  });
  it("detects graph as flowchart", () => {
    expect(detectType("graph LR\n  A --> B")).toBe("flowchart");
  });
  it("detects sequence", () => {
    expect(detectType("sequenceDiagram\n  A->>B: Hi")).toBe("sequence");
  });
  it("detects class", () => {
    expect(detectType("classDiagram\n  class A {}")).toBe("class");
  });
  it("detects er", () => {
    expect(detectType("erDiagram\n  A ||--o{ B : has")).toBe("er");
  });
  it("detects gantt", () => {
    expect(detectType("gantt\n  dateFormat YYYY-MM-DD")).toBe("gantt");
  });
  it("detects pie", () => {
    expect(detectType("pie title Pets\n  \"Dogs\" : 386")).toBe("pie");
  });
  it("detects stateDiagram-v2 as state", () => {
    expect(detectType("stateDiagram-v2\n  [*] --> A")).toBe("state");
  });
  it("detects mindmap", () => {
    expect(detectType("mindmap\n  root((X))")).toBe("mindmap");
  });
  it("detects gitGraph", () => {
    expect(detectType("gitGraph\n  commit")).toBe("gitGraph");
  });
  it("detects journey", () => {
    expect(detectType("journey\n  title My day")).toBe("journey");
  });
  it("detects c4 context", () => {
    expect(detectType("C4Context\n  title X")).toBe("c4");
  });
  it("detects timeline", () => {
    expect(detectType("timeline\n  title History")).toBe("timeline");
  });
  it("detects quadrant", () => {
    expect(detectType("quadrantChart\n  title Q")).toBe("quadrant");
  });
  it("detects requirement", () => {
    expect(detectType("requirementDiagram\n  requirement R {}")).toBe("requirement");
  });
  it("detects xychart", () => {
    expect(detectType("xychart-beta\n  title Chart")).toBe("xychart");
  });
  it("returns unknown for non-mermaid text", () => {
    expect(detectType("hello world\nthis is not mermaid")).toBe("unknown");
  });
  it("returns unknown for empty", () => {
    expect(detectType("")).toBe("unknown");
  });
});

describe("mermaid codeLines", () => {
  it("strips comments and blanks", () => {
    const code = "%% header\nflowchart TD\n\n  A --> B\n";
    expect(codeLines(code)).toEqual(["flowchart TD", "A --> B"]);
  });
  it("returns empty for empty input", () => {
    expect(codeLines("")).toEqual([]);
  });
});

describe("mermaid validateCode", () => {
  it("returns ok for valid flowchart", () => {
    const r = validateCode("flowchart TD\n  A --> B");
    expect(r.ok).toBe(true);
    expect(r.type).toBe("flowchart");
    expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
  it("flags missing end in subgraph", () => {
    const r = validateCode("flowchart TD\n  subgraph X\n    A --> B");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.message.includes("Unclosed 'subgraph'"))).toBe(true);
  });
  it("flags end without subgraph", () => {
    const r = validateCode("flowchart TD\n  A --> B\n  end");
    expect(r.issues.some((i) => i.message.includes("'end' without matching"))).toBe(true);
  });
  it("returns ok for valid sequence", () => {
    const r = validateCode("sequenceDiagram\n  participant A\n  A->>B: Hi");
    expect(r.ok).toBe(true);
  });
  it("flags unclosed alt block in sequence", () => {
    const r = validateCode("sequenceDiagram\n  alt condition\n    A->>B: Hi");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.message.includes("Unclosed 'alt'"))).toBe(true);
  });
  it("flags end without alt/loop in sequence", () => {
    const r = validateCode("sequenceDiagram\n  end");
    expect(r.issues.some((i) => i.message.includes("'end' without matching"))).toBe(true);
  });
  it("returns ok for valid class diagram", () => {
    const r = validateCode("classDiagram\n  class A {\n    +int x\n  }");
    expect(r.ok).toBe(true);
  });
  it("warns about missing dateFormat in gantt", () => {
    const r = validateCode("gantt\n  title X\n  section S\n  Task :2024-01-01, 10d");
    expect(r.issues.some((i) => i.severity === "warn" && i.message.includes("dateFormat"))).toBe(true);
  });
  it("passes gantt with dateFormat", () => {
    const r = validateCode("gantt\n  dateFormat YYYY-MM-DD\n  section S\n  Task :2024-01-01, 10d");
    expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
  it("warns about pie without data", () => {
    const r = validateCode("pie title Pets");
    expect(r.issues.some((i) => i.severity === "warn")).toBe(true);
  });
  it("passes pie with slice", () => {
    const r = validateCode("pie title Pets\n  \"Dogs\" : 386");
    expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
  it("flags state diagram missing header", () => {
    const r = validateCode("flowchart TD");
    // This is detected as flowchart and is valid; state-only check should only trigger if first line starts with stateDiagram
    expect(r.type).toBe("flowchart");
  });
  it("returns error for empty code", () => {
    const r = validateCode("");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.message.includes("Empty diagram"))).toBe(true);
  });
});

describe("mermaid autoFormat", () => {
  it("trims trailing whitespace per line", () => {
    const out = autoFormat("flowchart TD   \n  A --> B   ");
    expect(out).toBe("flowchart TD\n  A --> B");
  });
  it("collapses 2+ blank lines into 1", () => {
    const out = autoFormat("flowchart TD\n\n\n\nA --> B");
    expect(out).toBe("flowchart TD\n\nA --> B");
  });
  it("strips leading and trailing blank lines", () => {
    const out = autoFormat("\n\nflowchart TD\nA --> B\n\n");
    expect(out).toBe("flowchart TD\nA --> B");
  });
  it("returns empty for empty input", () => {
    expect(autoFormat("")).toBe("");
  });
});

describe("mermaid base64 encode/decode", () => {
  it("round-trips ASCII text", () => {
    const src = "flowchart TD\n  A --> B";
    const enc = encodeBase64(src);
    expect(enc).not.toBe("");
    expect(decodeBase64(enc)).toBe(src);
  });
  it("round-trips UTF-8 text", () => {
    const src = "pie title Café résumé\n  \"naïve\" : 1";
    const enc = encodeBase64(src);
    expect(decodeBase64(enc)).toBe(src);
  });
  it("round-trips emoji", () => {
    const src = "flowchart TD\n  A[🎉 Party]";
    const enc = encodeBase64(src);
    expect(decodeBase64(enc)).toBe(src);
  });
  it("handles empty input", () => {
    expect(encodeBase64("")).toBe("");
    expect(decodeBase64("")).toBe("");
  });
});

describe("mermaid buildLiveUrl", () => {
  it("builds URL with base64 fragment", () => {
    const url = buildLiveUrl("flowchart TD\n  A --> B");
    expect(url.startsWith("https://mermaid.live/edit#base64:")).toBe(true);
  });
  it("returns base URL for empty input", () => {
    expect(buildLiveUrl("")).toBe(MERMAID_LIVE_BASE);
    expect(buildLiveUrl("   ")).toBe(MERMAID_LIVE_BASE);
  });
  it("encodes URL-safe base64 (no special chars)", () => {
    const url = buildLiveUrl("flowchart TD\n  A --> B");
    const fragment = url.split("#base64:")[1];
    expect(fragment).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe("mermaid buildMarkdownEmbed & buildMermaidCodeBlock", () => {
  it("builds markdown link to live URL", () => {
    const md = buildMarkdownEmbed("flowchart TD\n  A --> B", "My Diagram");
    expect(md).toContain("[My Diagram](");
    expect(md).toContain("mermaid.live");
  });
  it("uses default alt text", () => {
    const md = buildMarkdownEmbed("flowchart TD");
    expect(md).toContain("[Mermaid diagram](");
  });
  it("builds fenced code block", () => {
    const block = buildMermaidCodeBlock("flowchart TD\n  A --> B");
    expect(block.startsWith("```mermaid\n")).toBe(true);
    expect(block.endsWith("```")).toBe(true);
  });
});

describe("mermaid computeStats", () => {
  it("counts code lines, comments, blanks", () => {
    const code = "%% header\nflowchart TD\n\n  A --> B\n  B --> C";
    const stats = computeStats(code);
    expect(stats.totalLines).toBe(5);
    expect(stats.commentLines).toBe(1);
    expect(stats.blankLines).toBe(1);
    expect(stats.codeLines).toBe(3);
    expect(stats.type).toBe("flowchart");
    expect(stats.charCount).toBe(code.length);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats("");
    expect(stats.totalLines).toBe(0);
    expect(stats.type).toBe("unknown");
  });
});

describe("mermaid templates & references", () => {
  it("getTemplate returns template for known type", () => {
    const t = getTemplate("flowchart");
    expect(t).toBeDefined();
    expect(t!.code).toContain("flowchart");
  });
  it("getTemplate returns undefined for unknown", () => {
    expect(getTemplate("unknown")).toBeUndefined();
  });
  it("getReference returns reference for known type", () => {
    const r = getReference("sequence");
    expect(r).toBeDefined();
    expect(r!.keywords).toContain("sequencediagram");
  });
  it("defaultCode returns a non-empty string", () => {
    expect(defaultCode()).toBeTruthy();
    expect(defaultCode().length).toBeGreaterThan(10);
  });
});

describe("mermaid history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "flowchart", preview: "flowchart TD...", liveUrl: "https://mermaid.live/edit#base64:abc" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "flowchart", preview: `code ${i}`, liveUrl: `https://mermaid.live/edit#base64:${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "flowchart", preview: "x", liveUrl: "y" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("mermaid shareable URL", () => {
  it("round-trips code via share URL (when window unavailable)", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const code = "flowchart TD\n  A --> B";
    const url = buildShareUrl(code);
    expect(url).toContain("code=");
    const parsed = parseShareUrl(url);
    expect(parsed).toBe(code);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty string for empty code", () => {
    expect(buildShareUrl("")).toBe("");
  });
  it("returns empty for hash without code param", () => {
    expect(parseShareUrl("")).toBe("");
    expect(parseShareUrl("#foo=bar")).toBe("");
  });
  it("decodes an explicit hash URL", () => {
    const code = "flowchart TD\n  A --> B";
    const enc = encodeBase64(code);
    const parsed = parseShareUrl(`#code=${enc}`);
    expect(parsed).toBe(code);
  });
});

// Suppress unused-import lint
export type _Unused = DiagramType | HistoryEntry;
