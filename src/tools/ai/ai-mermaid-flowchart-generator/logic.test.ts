import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeNodeId,
  formatNodeShape,
  splitOnTransitions,
  parseSegment,
  parseDescription,
  parseToGraph,
  generateMermaid,
  applyTheme,
  validateMermaid,
  repairMermaid,
  generateFlowchart,
  refineFlowchart,
  mermaidLiveUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Direction,
  type Theme,
  type NodeShape,
  type FlowGraph,
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

describe("ai-mermaid-flowchart-generator ID + shape helpers", () => {
  it("sanitizes labels into valid IDs", () => {
    expect(sanitizeNodeId("User Sign In")).toBe("user_sign_in");
    expect(sanitizeNodeId("Validate? Auth!")).toBe("validate_auth");
  });
  it("prefixes IDs starting with digit", () => {
    expect(sanitizeNodeId("123 hello")).toBe("n_123_hello");
  });
  it("reserves keywords get suffixed", () => {
    expect(sanitizeNodeId("end")).toBe("end_");
    expect(sanitizeNodeId("loop")).toBe("loop_");
  });
  it("empty label returns a generated id", () => {
    const id = sanitizeNodeId("");
    expect(id).toMatch(/^n\d+$/);
  });
  it("formatNodeShape wraps label with correct delimiters", () => {
    expect(formatNodeShape("Foo", "rect")).toBe("[Foo]");
    expect(formatNodeShape("Foo", "diamond")).toBe("{Foo}");
    expect(formatNodeShape("Foo", "rounded")).toBe("(Foo)");
    expect(formatNodeShape("Foo", "stadium")).toBe("([Foo])");
    expect(formatNodeShape("Foo", "database")).toBe("[(Foo)]");
    expect(formatNodeShape("Foo", "circle")).toBe("((Foo))");
    expect(formatNodeShape("Foo", "hexagon")).toBe("{{Foo}}");
    expect(formatNodeShape("Foo", "subroutine")).toBe("[[Foo]]");
  });
  it("formatNodeShape quotes label with special chars", () => {
    expect(formatNodeShape("a:b", "rect")).toBe('["a:b"]');
  });
});

describe("ai-mermaid-flowchart-generator transition splitting", () => {
  it("splits on 'leads to'", () => {
    expect(splitOnTransitions("A leads to B")).toEqual(["A", "B"]);
  });
  it("splits on arrows", () => {
    expect(splitOnTransitions("A -> B --> C")).toEqual(["A", "B", "C"]);
  });
  it("splits on 'then'", () => {
    expect(splitOnTransitions("Start then Middle then End")).toEqual(["Start", "Middle", "End"]);
  });
  it("returns [] for empty", () => {
    expect(splitOnTransitions("")).toEqual([]);
  });
});

describe("ai-mermaid-flowchart-generator segment parsing", () => {
  it("parses plain step as rect", () => {
    const s = parseSegment("Ship the API");
    expect(s.shape).toBe("rect");
    expect(s.label).toBe("Ship the API");
  });
  it("parses 'if X then Y else Z' as decision with branches", () => {
    const s = parseSegment("if valid then dashboard else login error");
    expect(s.shape).toBe("diamond");
    expect(s.label).toBe("valid");
    expect(s.decisionBranches).toHaveLength(2);
    expect(s.decisionBranches![0].condition).toBe("yes");
    expect(s.decisionBranches![0].target).toBe("dashboard");
    expect(s.decisionBranches![1].target).toBe("login error");
  });
  it("parses 'loop over items' as hexagon", () => {
    const s = parseSegment("loop over items");
    expect(s.shape).toBe("hexagon");
    expect(s.label).toContain("Loop:");
  });
  it("parses 'phase: setup' as subgraph", () => {
    const s = parseSegment("phase: setup");
    expect(s.subgraph).toBe("setup");
  });
  it("parses 'start' as stadium", () => {
    expect(parseSegment("start").shape).toBe("stadium");
    expect(parseSegment("end").shape).toBe("stadium");
  });
});

describe("ai-mermaid-flowchart-generator description parsing", () => {
  it("splits multi-line description", () => {
    const segs = parseDescription("A leads to B\nC then D");
    expect(segs).toEqual(["A", "B", "C", "D"]);
  });
  it("handles empty", () => {
    expect(parseDescription("")).toEqual([]);
  });
});

describe("ai-mermaid-flowchart-generator parseToGraph", () => {
  it("builds a linear graph from a simple description", () => {
    const g = parseToGraph("Start leads to Step 1 leads to Step 2 leads to End", "TD");
    expect(g.direction).toBe("TD");
    expect(g.nodes.length).toBe(4);
    expect(g.edges.length).toBe(3);
    expect(g.edges[0].from).toBe(g.nodes[0].id);
    expect(g.edges[0].to).toBe(g.nodes[1].id);
  });
  it("builds a decision with yes/no branches", () => {
    const g = parseToGraph("Check creds\nif valid then dashboard else error", "TD");
    // Segments: [Check creds, if valid then dashboard else error]
    // First is rect, second is diamond with two inline branches.
    expect(g.nodes.length).toBeGreaterThanOrEqual(3);
    expect(g.nodes.some((n) => n.shape === "diamond")).toBe(true);
    expect(g.edges.some((e) => e.label === "yes")).toBe(true);
    expect(g.edges.some((e) => e.label === "no")).toBe(true);
  });
  it("creates a subgraph from 'phase:' prefix", () => {
    const g = parseToGraph("phase: setup\nDo A then Do B");
    expect(g.subgraphs).toHaveLength(1);
    expect(g.subgraphs[0].label).toBe("setup");
  });
  it("returns empty graph for empty description", () => {
    const g = parseToGraph("");
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
  });
  it("warns on parallel cue", () => {
    const g = parseToGraph("Start leads to A meanwhile B", "LR");
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.warnings.some((w) => /Parallel/.test(w))).toBe(true);
  });
});

describe("ai-mermaid-flowchart-generator Mermaid code generation", () => {
  it("emits flowchart header with direction", () => {
    const g: FlowGraph = {
      direction: "LR",
      nodes: [{ id: "a", label: "A", shape: "rect" }],
      edges: [],
      subgraphs: [],
      warnings: [],
    };
    const code = generateMermaid(g);
    expect(code).toContain("flowchart LR");
    expect(code).toContain("a[A]");
  });
  it("emits edges with labels", () => {
    const g: FlowGraph = {
      direction: "TD",
      nodes: [
        { id: "d", label: "valid", shape: "diamond" },
        { id: "yes", label: "Yes", shape: "rect" },
      ],
      edges: [{ from: "d", to: "yes", label: "yes" }],
      subgraphs: [],
      warnings: [],
    };
    const code = generateMermaid(g);
    expect(code).toContain("d{valid}");
    expect(code).toContain("d -->|yes| yes");
  });
  it("wraps nodes in a subgraph when subgraphs present", () => {
    const g: FlowGraph = {
      direction: "TD",
      nodes: [
        { id: "a", label: "A", shape: "rect", subgraph: "Setup" },
        { id: "b", label: "B", shape: "rect" },
      ],
      edges: [],
      subgraphs: [{ id: "sub_1", label: "Setup" }],
      warnings: [],
    };
    const code = generateMermaid(g);
    expect(code).toContain("subgraph sub_1");
    expect(code).toContain('"Setup"');
    expect(code).toContain("end");
  });
  it("applies theme classDef when not default", () => {
    const g: FlowGraph = {
      direction: "TD",
      nodes: [{ id: "a", label: "A", shape: "rect" }],
      edges: [],
      subgraphs: [],
      warnings: [],
    };
    const code = generateMermaid(g, "forest");
    expect(code).toContain("classDef primary");
    expect(code).toContain("class a primary");
  });
  it("applyTheme returns the same graph for default", () => {
    const g: FlowGraph = {
      direction: "TD",
      nodes: [{ id: "a", label: "A", shape: "rect" }],
      edges: [],
      subgraphs: [],
      warnings: [],
    };
    expect(applyTheme(g, "default")).toEqual(g);
  });
});

describe("ai-mermaid-flowchart-generator validation", () => {
  it("validates a clean flowchart", () => {
    const code = "flowchart TD\n  a[A] --> b[B]\n";
    const v = validateMermaid(code);
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("flags missing flowchart header", () => {
    const v = validateMermaid("a[A] --> b[B]");
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => /flowchart/.test(e))).toBe(true);
  });
  it("flags orphan edge arrow", () => {
    const code = "flowchart TD\n  a[A] -->\n";
    const v = validateMermaid(code);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => /Orphan/.test(e))).toBe(true);
  });
  it("flags unclosed subgraph", () => {
    const code = "flowchart TD\n  subgraph s1 [\"S\"]\n    a[A]\n";
    const v = validateMermaid(code);
    expect(v.valid).toBe(false);
  });
  it("warns on odd number of quotes", () => {
    const code = 'flowchart TD\n  a["Label]\n';
    const v = validateMermaid(code);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it("flags empty code", () => {
    const v = validateMermaid("");
    expect(v.valid).toBe(false);
  });
});

describe("ai-mermaid-flowchart-generator self-healing repair", () => {
  it("adds missing flowchart header", () => {
    const r = repairMermaid("a[A] --> b[B]");
    expect(r.code).toContain("flowchart");
    expect(r.repairs.some((p) => /header/.test(p))).toBe(true);
  });
  it("removes orphan edge arrows", () => {
    const r = repairMermaid("flowchart TD\n  a[A] -->\n");
    expect(r.code).not.toMatch(/-->\s*$/m);
    expect(r.repairs.some((p) => /orphan/i.test(p))).toBe(true);
  });
  it("closes unclosed subgraph", () => {
    const r = repairMermaid("flowchart TD\n  subgraph s1 [\"S\"]\n    a[A]\n");
    expect(r.code).toContain("end");
    expect(r.repairs.some((p) => /subgraph/i.test(p))).toBe(true);
  });
  it("leaves clean code unchanged structurally", () => {
    const clean = "flowchart TD\n  a[A] --> b[B]\n";
    const r = repairMermaid(clean);
    expect(r.code).toContain("flowchart TD");
    expect(r.code).toContain("a[A]");
  });
});

describe("ai-mermaid-flowchart-generator end-to-end", () => {
  it("generates valid flowchart from description", () => {
    const r = generateFlowchart("Start leads to Middle leads to End", {
      direction: "LR",
      theme: "default",
    });
    expect(r.graph.nodes.length).toBe(3);
    expect(r.code).toContain("flowchart LR");
    expect(r.code).toContain("-->");
  });
  it("auto-repairs by default", () => {
    const r = generateFlowchart("A then B", {});
    expect(r.code).toContain("flowchart");
  });
  it("refine appends and regenerates", () => {
    const r1 = generateFlowchart("A then B");
    const r2 = refineFlowchart("A then B", "then C", {});
    expect(r2.graph.nodes.length).toBeGreaterThan(r1.graph.nodes.length);
  });
});

describe("ai-mermaid-flowchart-generator mermaid.live URL", () => {
  it("builds a mermaid.live edit URL with encoded code", () => {
    const url = mermaidLiveUrl("flowchart TD\n  a[A]\n");
    expect(url).toContain("https://mermaid.live/edit#");
    expect(url).toContain(encodeURIComponent("flowchart TD"));
  });
});

describe("ai-mermaid-flowchart-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, description: "A then B", direction: "TD", nodeCount: 2, edgeCount: 1 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].description).toBe("A then B");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, description: `D${i}`, direction: "TD", nodeCount: 1, edgeCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, description: "X", direction: "TD", nodeCount: 1, edgeCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-mermaid-flowchart-generator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("A then B", "LR", "forest");
    expect(url).toContain("d=A+then+B");
    expect(url).toContain("dir=LR");
    expect(url).toContain("theme=forest");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("d", "A then B");
    params.set("dir", "LR");
    params.set("theme", "forest");
    const r = parseShareUrl(`#${params.toString()}`);
    expect(r.description).toBe("A then B");
    expect(r.direction).toBe("LR");
    expect(r.theme).toBe("forest");
  });
  it("parses empty hash returns defaults", () => {
    const r = parseShareUrl("");
    expect(r.description).toBe("");
    expect(r.direction).toBe("TD");
    expect(r.theme).toBe("default");
  });
  it("falls back to TD for invalid direction", () => {
    const r = parseShareUrl("d=hi&dir=banana");
    expect(r.direction).toBe("TD");
  });
  it("falls back to default for invalid theme", () => {
    const r = parseShareUrl("d=hi&theme=banana");
    expect(r.theme).toBe("default");
  });
});

// Suppress unused-import lint
export type _Unused = Direction | Theme | NodeShape;
