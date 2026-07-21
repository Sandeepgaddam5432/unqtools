import { describe, it, expect, beforeEach } from "vitest";
import {
  PLANTUML_SERVER_BASE,
  DIAGRAM_TYPES,
  DIAGRAM_LABELS,
  THEMES,
  TEMPLATES,
  SYNTAX_REFERENCE,
  stripComment,
  firstSignificantLine,
  codeLines,
  extractUmlBlock,
  detectType,
  validateCode,
  autoFormat,
  encodePlantUml,
  decodePlantUml,
  buildRenderUrl,
  applyTheme,
  buildMarkdownEmbed,
  buildPumlCodeBlock,
  decodeRenderUrl,
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
  type ExportFormat,
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

describe("plantuml constants", () => {
  it("exposes plantuml.com server base URL", () => {
    expect(PLANTUML_SERVER_BASE).toBe("https://www.plantuml.com/plantuml");
  });
  it("has 8 diagram types", () => {
    expect(DIAGRAM_TYPES).toHaveLength(8);
    expect(DIAGRAM_TYPES).toContain("sequence");
    expect(DIAGRAM_TYPES).toContain("class");
    expect(DIAGRAM_TYPES).toContain("usecase");
    expect(DIAGRAM_TYPES).toContain("activity");
    expect(DIAGRAM_TYPES).toContain("component");
    expect(DIAGRAM_TYPES).toContain("state");
    expect(DIAGRAM_TYPES).toContain("object");
    expect(DIAGRAM_TYPES).toContain("deployment");
  });
  it("has labels for every type including unknown", () => {
    for (const t of DIAGRAM_TYPES) expect(DIAGRAM_LABELS[t]).toBeTruthy();
    expect(DIAGRAM_LABELS.unknown).toBe("Unknown");
  });
  it("has 8 templates", () => {
    expect(TEMPLATES).toHaveLength(8);
  });
  it("has 8 syntax references", () => {
    expect(SYNTAX_REFERENCE).toHaveLength(8);
  });
  it("has theme options including plain", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(5);
    expect(THEMES.some((t) => t.value === "plain")).toBe(true);
    expect(THEMES.some((t) => t.value === "minty")).toBe(true);
  });
});

describe("plantuml stripComment", () => {
  it("returns blank line for full-line comment", () => {
    expect(stripComment("' this is a comment")).toBe("");
  });
  it("strips trailing comment after code", () => {
    expect(stripComment("participant A ' Alice")).toBe("participant A");
  });
  it("returns trimmed code without comment", () => {
    expect(stripComment("  A --> B  ")).toBe("A --> B");
  });
  it("handles empty", () => {
    expect(stripComment("")).toBe("");
  });
});

describe("plantuml firstSignificantLine", () => {
  it("skips comments and blanks", () => {
    const code = "' header comment\n\n@startuml\n  A --> B";
    expect(firstSignificantLine(code)).toBe("@startuml");
  });
  it("returns empty for empty input", () => {
    expect(firstSignificantLine("")).toBe("");
  });
  it("returns empty for only comments", () => {
    expect(firstSignificantLine("' one\n' two\n")).toBe("");
  });
});

describe("plantuml extractUmlBlock", () => {
  it("extracts inner content", () => {
    const code = "@startuml\nA --> B\n@enduml";
    const block = extractUmlBlock(code);
    expect(block.hasStart).toBe(true);
    expect(block.hasEnd).toBe(true);
    expect(block.inner).toBe("A --> B");
  });
  it("flags missing @startuml", () => {
    const block = extractUmlBlock("A --> B");
    expect(block.hasStart).toBe(false);
  });
  it("flags missing @enduml", () => {
    const block = extractUmlBlock("@startuml\nA --> B");
    expect(block.hasStart).toBe(true);
    expect(block.hasEnd).toBe(false);
  });
});

describe("plantuml detectType", () => {
  it("detects sequence", () => {
    expect(detectType("@startuml\nparticipant A\nparticipant B\nA -> B: hi\n@enduml")).toBe("sequence");
  });
  it("detects class", () => {
    expect(detectType("@startuml\nclass Foo\nclass Bar\nFoo <|-- Bar\n@enduml")).toBe("class");
  });
  it("detects usecase", () => {
    expect(detectType("@startuml\nactor User\nusecase Login\nUser --> Login\n@enduml")).toBe("usecase");
  });
  it("detects activity", () => {
    expect(detectType("@startuml\nstart\n:Do work;\nstop\n@enduml")).toBe("activity");
  });
  it("detects component", () => {
    expect(detectType("@startuml\ncomponent [Web]\ncomponent [API]\n[Web] --> [API]\n@enduml")).toBe("component");
  });
  it("detects state", () => {
    expect(detectType("@startuml\n[*] --> Active\nActive --> [*]\n@enduml")).toBe("state");
  });
  it("detects object", () => {
    expect(detectType("@startuml\nobject a {\n  x = 1\n}\n@enduml")).toBe("object");
  });
  it("detects deployment", () => {
    expect(detectType("@startuml\nnode Server\ndatabase DB\nServer --> DB\n@enduml")).toBe("deployment");
  });
  it("returns unknown for empty", () => {
    expect(detectType("")).toBe("unknown");
  });
});

describe("plantuml validateCode", () => {
  it("rejects empty input", () => {
    const r = validateCode("");
    expect(r.ok).toBe(false);
    expect(r.issues[0].severity).toBe("error");
  });
  it("flags missing @startuml/@enduml", () => {
    const r = validateCode("participant A\nA -> B: hi");
    expect(r.issues.some((i) => /@startuml/.test(i.message))).toBe(true);
  });
  it("passes a valid sequence diagram", () => {
    const r = validateCode("@startuml\nparticipant A\nparticipant B\nA -> B: hi\n@enduml");
    expect(r.ok).toBe(true);
    expect(r.type).toBe("sequence");
  });
  it("detects unclosed alt block in sequence", () => {
    const r = validateCode("@startuml\nparticipant A\nalt cond\nA -> B: yes\n@enduml");
    expect(r.issues.some((i) => /Unclosed 'alt'/.test(i.message))).toBe(true);
    expect(r.ok).toBe(false);
  });
  it("warns about missing start/stop in activity", () => {
    const r = validateCode("@startuml\n:Do work;\n@enduml");
    expect(r.issues.some((i) => /start/.test(i.message))).toBe(true);
    expect(r.issues.some((i) => i.severity === "warn")).toBe(true);
  });
  it("detects unclosed if in activity", () => {
    const r = validateCode("@startuml\nstart\nif (ok?) then (yes)\n:Finish;\nstop\n@enduml");
    expect(r.issues.some((i) => /Unclosed 'if'/.test(i.message))).toBe(true);
  });
  it("warns about missing [*] in state diagram", () => {
    const r = validateCode("@startuml\nstate Active\nstate Inactive\nActive --> Inactive\n@enduml");
    expect(r.issues.some((i) => /\[\*\]/.test(i.message))).toBe(true);
  });
  it("validates class diagram with unclosed block", () => {
    const r = validateCode("@startuml\nclass Foo {\n  +x: int\n@enduml");
    expect(r.issues.some((i) => /Unclosed class block/.test(i.message))).toBe(true);
  });
});

describe("plantuml autoFormat", () => {
  it("trims trailing whitespace and collapses blank lines", () => {
    const input = "@startuml  \n\n\nA --> B  \n@enduml  ";
    const out = autoFormat(input);
    expect(out).toBe("@startuml\n\nA --> B\n@enduml");
  });
  it("preserves leading indentation", () => {
    const input = "  @startuml  \n  A --> B  \n  @enduml  ";
    const out = autoFormat(input);
    expect(out).toBe("  @startuml\n  A --> B\n  @enduml");
  });
  it("handles empty input", () => {
    expect(autoFormat("")).toBe("");
  });
});

describe("plantuml encodePlantUml / decodePlantUml round-trip", () => {
  it("round-trips a short ASCII source", () => {
    const src = "@startuml\nA --> B\n@enduml";
    const enc = encodePlantUml(src);
    expect(enc).toBeTruthy();
    const back = decodePlantUml(enc);
    expect(back).toBe(src);
  });
  it("round-trips a source with unicode", () => {
    const src = "@startuml\nA -> B: héllo 你好 🚀\n@enduml";
    const enc = encodePlantUml(src);
    const back = decodePlantUml(enc);
    expect(back).toBe(src);
  });
  it("round-trips a large source (>64KB triggers multi-block deflate)", () => {
    const big = "@startuml\n" + "A --> B\n".repeat(10000) + "@enduml";
    const enc = encodePlantUml(big);
    const back = decodePlantUml(enc);
    expect(back).toBe(big);
  });
  it("encodes empty string as empty", () => {
    expect(encodePlantUml("")).toBe("");
    expect(decodePlantUml("")).toBe("");
  });
});

describe("plantuml buildRenderUrl", () => {
  it("builds a SVG render URL", () => {
    const url = buildRenderUrl("@startuml\nA --> B\n@enduml", "svg");
    expect(url).toContain("https://www.plantuml.com/plantuml/svg/");
  });
  it("builds a PNG render URL", () => {
    const url = buildRenderUrl("@startuml\nA --> B\n@enduml", "png");
    expect(url).toContain("/png/");
  });
  it("builds a UML/ASCII URL when format=uml", () => {
    const url = buildRenderUrl("@startuml\nA --> B\n@enduml", "uml");
    expect(url).toContain("/uml/");
  });
  it("returns base URL for empty input", () => {
    expect(buildRenderUrl("", "svg")).toBe(PLANTUML_SERVER_BASE);
  });
  it("applies theme to source", () => {
    const url = buildRenderUrl("@startuml\nA --> B\n@enduml", "svg", "minty");
    // Decoding the URL should yield source with !theme minty
    const decoded = decodeRenderUrl(url);
    expect(decoded).toContain("!theme minty");
  });
});

describe("plantuml applyTheme", () => {
  it("adds !theme directive after @startuml", () => {
    const out = applyTheme("@startuml\nA --> B\n@enduml", "minty");
    expect(out).toContain("!theme minty");
    expect(out.indexOf("!theme minty")).toBeGreaterThan(out.indexOf("@startuml"));
  });
  it("returns code unchanged for plain theme", () => {
    const src = "@startuml\nA --> B\n@enduml";
    expect(applyTheme(src, "plain")).toBe(src);
  });
  it("wraps code in @startuml/@enduml if missing", () => {
    const out = applyTheme("A --> B", "minty");
    expect(out).toContain("@startuml");
    expect(out).toContain("@enduml");
    expect(out).toContain("!theme minty");
  });
});

describe("plantuml buildMarkdownEmbed", () => {
  it("builds a Markdown image link", () => {
    const md = buildMarkdownEmbed("@startuml\nA --> B\n@enduml", "svg");
    expect(md.startsWith("![PlantUML diagram](https://www.plantuml.com/plantuml/svg/")).toBe(true);
  });
  it("uses custom alt text", () => {
    const md = buildMarkdownEmbed("@startuml\nA --> B\n@enduml", "svg", "My Diagram");
    expect(md.startsWith("![My Diagram](")).toBe(true);
  });
});

describe("plantuml buildPumlCodeBlock", () => {
  it("wraps source in plantuml fenced block", () => {
    const out = buildPumlCodeBlock("@startuml\nA --> B\n@enduml");
    expect(out.startsWith("```plantuml\n")).toBe(true);
    expect(out.endsWith("\n```")).toBe(true);
    expect(out).toContain("A --> B");
  });
});

describe("plantuml decodeRenderUrl", () => {
  it("decodes a SVG render URL back to source", () => {
    const url = buildRenderUrl("@startuml\nA --> B\n@enduml", "svg");
    const decoded = decodeRenderUrl(url);
    expect(decoded).toBe("@startuml\nA --> B\n@enduml");
  });
  it("returns empty for unrelated URL", () => {
    expect(decodeRenderUrl("https://example.com/foo")).toBe("");
  });
});

describe("plantuml computeStats", () => {
  it("computes stats for a diagram", () => {
    const code = "@startuml\nA --> B\n' a comment\n@enduml";
    const stats = computeStats(code);
    expect(stats.totalLines).toBe(4);
    expect(stats.codeLines).toBe(3); // @startuml, A --> B, @enduml
    expect(stats.commentLines).toBe(1);
    expect(stats.type).toBe("sequence");
    expect(stats.charCount).toBe(code.length);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats("");
    expect(stats.totalLines).toBe(0);
    expect(stats.codeLines).toBe(0);
  });
});

describe("plantuml templates & references", () => {
  it("gets template by type", () => {
    const t = getTemplate("sequence");
    expect(t).toBeDefined();
    expect(t!.code).toContain("@startuml");
  });
  it("gets reference by type", () => {
    const r = getReference("class");
    expect(r).toBeDefined();
    expect(r!.keywords).toContain("class");
  });
  it("defaultCode returns first template", () => {
    expect(defaultCode()).toBe(TEMPLATES[0].code);
  });
  it("returns undefined for unknown type", () => {
    expect(getTemplate("unknown")).toBeUndefined();
    expect(getReference("unknown")).toBeUndefined();
  });
});

describe("plantuml history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      type: "sequence",
      preview: "@startuml A --> B",
      renderUrl: "https://www.plantuml.com/plantuml/svg/abc",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        type: "sequence",
        preview: `entry ${i}`,
        renderUrl: "https://www.plantuml.com/plantuml/svg/x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, type: "sequence", preview: "x", renderUrl: "url",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("plantuml shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const src = "@startuml\nA --> B\n@enduml";
    const url = buildShareUrl(src, "plain");
    expect(url).toContain("code=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to source", () => {
    const src = "@startuml\nA --> B\n@enduml";
    const url = buildShareUrl(src, "plain");
    // Extract the hash part
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.split("?")[1] ?? ""}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.code).toBe(src);
    expect(parsed.theme).toBe("plain");
  });
  it("parses share URL with theme", () => {
    const src = "@startuml\nA --> B\n@enduml";
    const url = buildShareUrl(src, "minty");
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.split("?")[1] ?? ""}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.code).toBe(src);
    expect(parsed.theme).toBe("minty");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ code: "", theme: "plain" });
  });
  it("filters unknown themes", () => {
    const parsed = parseShareUrl("code=abc&theme=doesnotexist");
    expect(parsed.theme).toBe("plain");
  });
});

// Suppress unused-import lint
export type _Unused = DiagramType | ExportFormat | HistoryEntry;
