import { describe, it, expect, beforeEach } from "vitest";
import {
  ALIGNMENT_VALUES,
  ALIGNMENT_LABELS,
  CASE_VALUES,
  CASE_LABELS,
  MODE_VALUES,
  MODE_LABELS,
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  SAMPLE_TABLES,
  detectFormat,
  escapeCell,
  applyCase,
  formatNumber,
  splitCsvRow,
  splitTsvRow,
  parseCsv,
  parseTsv,
  parseJsonArray,
  parseMarkdownTable,
  parseInput,
  sortRows,
  transposeTable,
  dedupeRows,
  applyCaseToTable,
  formatNumbersInTable,
  applyTransforms,
  generateMarkdownTable,
  escapeHtml,
  renderHtml,
  renderCsv,
  renderJson,
  generateTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Alignment,
  type CaseTransform,
  type InputFormat,
  type OutputMode,
  type SortDirection,
  type TableData,
  type TableOptions,
  type TableTransforms,
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

const defaultOpts: TableOptions = {
  alignments: [],
  mode: "compact",
  boldHeader: true,
  brForNewlines: true,
  numberFormat: { enabled: false, decimals: 2 },
};
const defaultTransforms: TableTransforms = {
  sortColumn: null,
  sortDirection: "asc",
  transpose: false,
  dedupe: false,
  caseTransform: "none",
};

describe("ai-markdown-table-generator constants", () => {
  it("exposes 4 alignment values", () => {
    expect(ALIGNMENT_VALUES).toEqual(["default", "left", "center", "right"]);
    expect(Object.keys(ALIGNMENT_LABELS)).toHaveLength(4);
  });
  it("exposes 4 case values", () => {
    expect(CASE_VALUES).toEqual(["none", "upper", "lower", "title"]);
    expect(Object.keys(CASE_LABELS)).toHaveLength(4);
  });
  it("exposes 2 mode values", () => {
    expect(MODE_VALUES).toEqual(["compact", "pretty"]);
    expect(Object.keys(MODE_LABELS)).toHaveLength(2);
  });
  it("has history/LLM keys", () => {
    expect(HISTORY_KEY).toContain("ai-markdown-table-generator");
    expect(HISTORY_MAX).toBe(20);
    expect(LLM_KEY_STORAGE).toContain("ai-markdown-table-generator");
  });
  it("ships 4+ sample tables", () => {
    expect(SAMPLE_TABLES.length).toBeGreaterThanOrEqual(4);
    expect(SAMPLE_TABLES.some((s) => s.format === "csv")).toBe(true);
    expect(SAMPLE_TABLES.some((s) => s.format === "tsv")).toBe(true);
    expect(SAMPLE_TABLES.some((s) => s.format === "json")).toBe(true);
    expect(SAMPLE_TABLES.some((s) => s.format === "markdown")).toBe(true);
  });
});

describe("ai-markdown-table-generator detectFormat", () => {
  it("detects JSON", () => {
    expect(detectFormat('[{"a":1}]')).toBe("json");
  });
  it("detects Markdown table", () => {
    expect(detectFormat("| a | b |\n| - | - |")).toBe("markdown");
  });
  it("detects TSV when tabs dominate", () => {
    expect(detectFormat("a\tb\tc\n1\t2\t3")).toBe("tsv");
  });
  it("detects CSV when commas dominate", () => {
    expect(detectFormat("a,b,c\n1,2,3")).toBe("csv");
  });
  it("returns auto for empty", () => {
    expect(detectFormat("")).toBe("auto");
  });
});

describe("ai-markdown-table-generator escapeCell", () => {
  it("escapes pipes", () => {
    expect(escapeCell("a|b", true)).toBe("a\\|b");
  });
  it("converts newlines to <br>", () => {
    expect(escapeCell("line1\nline2", true)).toBe("line1<br>line2");
  });
  it("converts newlines to space when br disabled", () => {
    expect(escapeCell("line1\nline2", false)).toBe("line1 line2");
  });
  it("escapes backslashes", () => {
    expect(escapeCell("a\\b", true)).toBe("a\\\\b");
  });
  it("handles null/undefined", () => {
    expect(escapeCell(null as unknown as string, true)).toBe("");
    expect(escapeCell(undefined as unknown as string, true)).toBe("");
  });
});

describe("ai-markdown-table-generator applyCase", () => {
  it("uppercases", () => {
    expect(applyCase("hello world", "upper")).toBe("HELLO WORLD");
  });
  it("lowercases", () => {
    expect(applyCase("Hello World", "lower")).toBe("hello world");
  });
  it("title-cases", () => {
    expect(applyCase("hello world", "title")).toBe("Hello World");
  });
  it("no change", () => {
    expect(applyCase("Hello", "none")).toBe("Hello");
  });
  it("handles empty", () => {
    expect(applyCase("", "upper")).toBe("");
  });
});

describe("ai-markdown-table-generator formatNumber", () => {
  it("formats to 2 decimals", () => {
    expect(formatNumber("3.14159", { enabled: true, decimals: 2 })).toBe("3.14");
  });
  it("pads to decimals", () => {
    expect(formatNumber("5", { enabled: true, decimals: 2 })).toBe("5.00");
  });
  it("returns non-numbers as-is", () => {
    expect(formatNumber("abc", { enabled: true, decimals: 2 })).toBe("abc");
  });
  it("respects disabled flag", () => {
    expect(formatNumber("3.1", { enabled: false, decimals: 2 })).toBe("3.1");
  });
  it("handles empty string", () => {
    expect(formatNumber("", { enabled: true, decimals: 2 })).toBe("");
  });
});

describe("ai-markdown-table-generator splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles doubled quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("ai-markdown-table-generator splitTsvRow", () => {
  it("splits on tabs", () => {
    expect(splitTsvRow("a\tb\tc")).toEqual(["a", "b", "c"]);
  });
  it("preserves commas in cells", () => {
    expect(splitTsvRow("a,b\tc")).toEqual(["a,b", "c"]);
  });
});

describe("ai-markdown-table-generator parseCsv", () => {
  it("parses headers + rows", () => {
    const t = parseCsv("a,b\n1,2\n3,4");
    expect(t.headers).toEqual(["a", "b"]);
    expect(t.rows).toEqual([["1", "2"], ["3", "4"]]);
  });
  it("skips empty lines", () => {
    const t = parseCsv("a,b\n\n1,2\n");
    expect(t.rows).toEqual([["1", "2"]]);
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
  it("handles quoted fields with newlines (literal)", () => {
    const t = parseCsv('name,note\n"ada","first\nsecond"');
    expect(t.rows[0]).toEqual(["ada", "first\nsecond"]);
  });
});

describe("ai-markdown-table-generator parseTsv", () => {
  it("parses TSV", () => {
    const t = parseTsv("a\tb\n1\t2");
    expect(t.headers).toEqual(["a", "b"]);
    expect(t.rows).toEqual([["1", "2"]]);
  });
});

describe("ai-markdown-table-generator parseJsonArray", () => {
  it("parses array of objects", () => {
    const t = parseJsonArray('[{"a":1,"b":2},{"a":3,"b":4}]');
    expect(t.headers).toEqual(["a", "b"]);
    expect(t.rows).toEqual([["1", "2"], ["3", "4"]]);
  });
  it("parses array of arrays", () => {
    const t = parseJsonArray('[["a","b"],[1,2]]');
    expect(t.headers).toEqual(["Col 1", "Col 2"]);
    expect(t.rows).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("returns empty for invalid JSON", () => {
    expect(parseJsonArray("not json")).toEqual({ headers: [], rows: [] });
  });
  it("returns empty for non-array", () => {
    expect(parseJsonArray('{"a":1}')).toEqual({ headers: [], rows: [] });
  });
  it("handles null values", () => {
    const t = parseJsonArray('[{"a":null,"b":"x"}]');
    expect(t.rows[0]).toEqual(["", "x"]);
  });
});

describe("ai-markdown-table-generator parseMarkdownTable", () => {
  it("round-trips a basic GFM table", () => {
    const md = "| Name | Score |\n| --- | --- |\n| Ada | 95 |\n| Bob | 82 |";
    const t = parseMarkdownTable(md);
    expect(t.headers).toEqual(["Name", "Score"]);
    expect(t.rows).toEqual([["Ada", "95"], ["Bob", "82"]]);
  });
  it("strips alignment markers", () => {
    const md = "| a | b |\n| :--- | ---: |\n| 1 | 2 |";
    const t = parseMarkdownTable(md);
    expect(t.headers).toEqual(["a", "b"]);
    expect(t.rows).toEqual([["1", "2"]]);
  });
  it("un-escapes pipes", () => {
    const md = "| a \\| b | c |\n| --- | --- |\n| 1 | 2 |";
    const t = parseMarkdownTable(md);
    expect(t.headers).toEqual(["a | b", "c"]);
  });
  it("returns empty for short input", () => {
    expect(parseMarkdownTable("| a | b |")).toEqual({ headers: [], rows: [] });
  });
});

describe("ai-markdown-table-generator parseInput", () => {
  it("dispatches to parseCsv", () => {
    const t = parseInput("a,b\n1,2", "csv");
    expect(t.headers).toEqual(["a", "b"]);
  });
  it("dispatches to parseTsv", () => {
    const t = parseInput("a\tb\n1\t2", "tsv");
    expect(t.headers).toEqual(["a", "b"]);
  });
  it("dispatches to parseJsonArray", () => {
    const t = parseInput('[{"a":1}]', "json");
    expect(t.headers).toEqual(["a"]);
  });
  it("dispatches to parseMarkdownTable", () => {
    const t = parseInput("| a | b |\n| - | - |\n| 1 | 2 |", "markdown");
    expect(t.headers).toEqual(["a", "b"]);
  });
  it("auto-detects format", () => {
    expect(parseInput('[{"a":1}]', "auto").headers).toEqual(["a"]);
    expect(parseInput("a,b\n1,2", "auto").headers).toEqual(["a", "b"]);
    expect(parseInput("a\tb\n1\t2", "auto").headers).toEqual(["a", "b"]);
    expect(parseInput("| a | b |\n| - | - |\n| 1 | 2 |", "auto").headers).toEqual(["a", "b"]);
  });
});

describe("ai-markdown-table-generator sortRows", () => {
  const data: TableData = {
    headers: ["name", "score"],
    rows: [["bob", "82"], ["ada", "95"], ["cara", "78"]],
  };
  it("sorts ascending numerically", () => {
    const t = sortRows(data, 1, "asc");
    expect(t.rows.map((r) => r[0])).toEqual(["cara", "bob", "ada"]);
  });
  it("sorts descending numerically", () => {
    const t = sortRows(data, 1, "desc");
    expect(t.rows.map((r) => r[0])).toEqual(["ada", "bob", "cara"]);
  });
  it("sorts alphabetically when not numeric", () => {
    const t = sortRows(data, 0, "asc");
    expect(t.rows.map((r) => r[0])).toEqual(["ada", "bob", "cara"]);
  });
  it("ignores invalid column", () => {
    const t = sortRows(data, 99, "asc");
    expect(t).toBe(data);
  });
});

describe("ai-markdown-table-generator transposeTable", () => {
  it("transposes a 2x3 table", () => {
    const data: TableData = {
      headers: ["a", "b"],
      rows: [["1", "2"], ["3", "4"], ["5", "6"]],
    };
    const t = transposeTable(data);
    expect(t.headers).toEqual(["a", "1", "3", "5"]);
    expect(t.rows).toEqual([["b", "2", "4", "6"]]);
  });
  it("handles ragged rows", () => {
    const data: TableData = {
      headers: ["a", "b", "c"],
      rows: [["1"]],
    };
    const t = transposeTable(data);
    expect(t.headers).toEqual(["a", "1"]);
    expect(t.rows).toEqual([["b", ""], ["c", ""]]);
  });
});

describe("ai-markdown-table-generator dedupeRows", () => {
  it("removes exact duplicates", () => {
    const data: TableData = {
      headers: ["a"],
      rows: [["1"], ["1"], ["2"]],
    };
    const t = dedupeRows(data);
    expect(t.rows).toEqual([["1"], ["2"]]);
  });
  it("preserves order", () => {
    const data: TableData = {
      headers: ["a"],
      rows: [["b"], ["a"], ["b"], ["c"], ["a"]],
    };
    const t = dedupeRows(data);
    expect(t.rows).toEqual([["b"], ["a"], ["c"]]);
  });
});

describe("ai-markdown-table-generator applyCaseToTable", () => {
  it("applies upper", () => {
    const data: TableData = {
      headers: ["name"],
      rows: [["alice"], ["bob"]],
    };
    const t = applyCaseToTable(data, "upper");
    expect(t.headers).toEqual(["NAME"]);
    expect(t.rows).toEqual([["ALICE"], ["BOB"]]);
  });
  it("no change for none", () => {
    const data: TableData = { headers: ["x"], rows: [["y"]] };
    expect(applyCaseToTable(data, "none")).toBe(data);
  });
});

describe("ai-markdown-table-generator formatNumbersInTable", () => {
  it("formats numbers in cells", () => {
    const data: TableData = {
      headers: ["x"],
      rows: [["3.14159"], ["abc"], ["5"]],
    };
    const t = formatNumbersInTable(data, { enabled: true, decimals: 2 });
    expect(t.rows).toEqual([["3.14"], ["abc"], ["5.00"]]);
  });
  it("disabled returns input", () => {
    const data: TableData = { headers: ["x"], rows: [["3.1"]] };
    expect(formatNumbersInTable(data, { enabled: false, decimals: 2 })).toBe(data);
  });
});

describe("ai-markdown-table-generator applyTransforms", () => {
  it("applies dedupe + sort + case", () => {
    const data: TableData = {
      headers: ["name"],
      rows: [["bob"], ["alice"], ["bob"], ["cara"]],
    };
    const out = applyTransforms(data, {
      ...defaultTransforms,
      dedupe: true,
      sortColumn: 0,
      sortDirection: "asc",
      caseTransform: "upper",
    });
    expect(out.rows).toEqual([["ALICE"], ["BOB"], ["CARA"]]);
  });
  it("applies transpose", () => {
    const data: TableData = {
      headers: ["a", "b"],
      rows: [["1", "2"]],
    };
    const out = applyTransforms(data, { ...defaultTransforms, transpose: true });
    expect(out.headers).toEqual(["a", "1"]);
    expect(out.rows).toEqual([["b", "2"]]);
  });
});

describe("ai-markdown-table-generator generateMarkdownTable", () => {
  it("generates a compact GFM table", () => {
    const data: TableData = {
      headers: ["a", "b"],
      rows: [["1", "2"]],
    };
    const md = generateMarkdownTable(data, defaultOpts);
    expect(md).toContain("| a | b |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| 1 | 2 |");
  });
  it("applies left alignment", () => {
    const data: TableData = { headers: ["a"], rows: [["1"]] };
    const md = generateMarkdownTable(data, { ...defaultOpts, alignments: ["left"] });
    expect(md).toContain(":---");
  });
  it("applies right alignment", () => {
    const data: TableData = { headers: ["a"], rows: [["1"]] };
    const md = generateMarkdownTable(data, { ...defaultOpts, alignments: ["right"] });
    expect(md).toContain("---:");
  });
  it("applies center alignment", () => {
    const data: TableData = { headers: ["a"], rows: [["1"]] };
    const md = generateMarkdownTable(data, { ...defaultOpts, alignments: ["center"] });
    expect(md).toContain(":---:");
  });
  it("pretty mode pads cells", () => {
    const data: TableData = {
      headers: ["name", "score"],
      rows: [["ada", "95"], ["longername", "100"]],
    };
    const md = generateMarkdownTable(data, { ...defaultOpts, mode: "pretty" });
    // Both rows should have the same length (padded to widest)
    const lines = md.split("\n");
    expect(lines[0]!.length).toBe(lines[2]!.length);
  });
  it("escapes pipes in cells", () => {
    const data: TableData = {
      headers: ["a"],
      rows: [["x|y"]],
    };
    const md = generateMarkdownTable(data, defaultOpts);
    expect(md).toContain("x\\|y");
  });
  it("converts newlines to <br>", () => {
    const data: TableData = {
      headers: ["a"],
      rows: [["line1\nline2"]],
    };
    const md = generateMarkdownTable(data, defaultOpts);
    expect(md).toContain("line1<br>line2");
  });
  it("returns empty for no headers", () => {
    expect(generateMarkdownTable({ headers: [], rows: [] }, defaultOpts)).toBe("");
  });
});

describe("ai-markdown-table-generator escapeHtml", () => {
  it("escapes <, >, &, \"", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

describe("ai-markdown-table-generator renderHtml", () => {
  it("renders an HTML table", () => {
    const data: TableData = {
      headers: ["name", "score"],
      rows: [["ada", "95"]],
    };
    const html = renderHtml(data, defaultOpts);
    expect(html).toContain("<table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<th>name</th>");
    expect(html).toContain("<td>ada</td>");
  });
  it("includes alignment styles", () => {
    const data: TableData = { headers: ["a"], rows: [["1"]] };
    const html = renderHtml(data, { ...defaultOpts, alignments: ["right"] });
    expect(html).toContain('style="text-align:right"');
  });
  it("escapes HTML special chars", () => {
    const data: TableData = { headers: ["a"], rows: [["<b>"]] };
    const html = renderHtml(data, defaultOpts);
    expect(html).toContain("&lt;b&gt;");
  });
  it("returns empty for no headers", () => {
    expect(renderHtml({ headers: [], rows: [] }, defaultOpts)).toBe("");
  });
});

describe("ai-markdown-table-generator renderCsv", () => {
  it("renders CSV with quoting", () => {
    const data: TableData = {
      headers: ["a", "b"],
      rows: [["1,2", "x"]],
    };
    const csv = renderCsv(data);
    expect(csv.split("\n")[0]).toBe("a,b");
    expect(csv.split("\n")[1]).toBe('"1,2",x');
  });
  it("quotes doubled quotes", () => {
    const data: TableData = { headers: ["a"], rows: [['x"y']] };
    const csv = renderCsv(data);
    expect(csv).toContain('"x""y"');
  });
  it("returns empty for no headers", () => {
    expect(renderCsv({ headers: [], rows: [] })).toBe("");
  });
});

describe("ai-markdown-table-generator renderJson", () => {
  it("renders JSON array of objects", () => {
    const data: TableData = {
      headers: ["a", "b"],
      rows: [["1", "2"]],
    };
    const json = renderJson(data);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([{ a: "1", b: "2" }]);
  });
  it("returns [] for no headers", () => {
    expect(renderJson({ headers: [], rows: [] })).toBe("[]");
  });
});

describe("ai-markdown-table-generator generateTable (orchestration)", () => {
  it("generates all formats", () => {
    const result = generateTable(
      "a,b\n1,2\n3,4",
      "csv",
      { ...defaultOpts, alignments: ["left", "right"] },
      defaultTransforms,
    );
    expect(result.markdown).toContain("| a | b |");
    expect(result.html).toContain("<table>");
    expect(result.csv).toContain("a,b");
    expect(result.json).toContain('"a":');
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(2);
    expect(result.charCount).toBe(result.markdown.length);
  });
  it("returns empty for empty input", () => {
    const result = generateTable("", "csv", defaultOpts, defaultTransforms);
    expect(result.markdown).toBe("");
    expect(result.rowCount).toBe(0);
  });
  it("applies transforms", () => {
    const result = generateTable(
      "a\n3\n1\n2",
      "csv",
      defaultOpts,
      { ...defaultTransforms, sortColumn: 0, sortDirection: "asc" },
    );
    const lines = result.markdown.split("\n");
    // Lines: header, separator, then 1, 2, 3
    expect(lines[2]).toContain("1");
    expect(lines[3]).toContain("2");
    expect(lines[4]).toContain("3");
  });
});

describe("ai-markdown-table-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, format: "csv", rowCount: 3, columnCount: 2, preview: "a,b" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].format).toBe("csv");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, format: "csv", rowCount: 1, columnCount: 1, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, format: "csv", rowCount: 1, columnCount: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-markdown-table-generator shareable URL", () => {
  const state = {
    format: "csv" as InputFormat,
    input: "a,b\n1,2",
    alignments: ["left", "right"] as Alignment[],
    mode: "compact" as OutputMode,
    boldHeader: true,
    brForNewlines: true,
    numberFormat: { enabled: false, decimals: 2 },
    sortColumn: 1 as number | null,
    sortDirection: "asc" as SortDirection,
    transpose: false,
    dedupe: true,
    caseTransform: "none" as CaseTransform,
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(state);
    expect(url).toContain("f=csv");
    expect(url).toContain("a=left%2Cright");
    expect(url).toContain("m=compact");
    expect(url).toContain("d=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(state);
    // Extract hash portion
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.format).toBe("csv");
    expect(parsed!.input).toBe("a,b\n1,2");
    expect(parsed!.alignments).toEqual(["left", "right"]);
    expect(parsed!.mode).toBe("compact");
    expect(parsed!.boldHeader).toBe(true);
    expect(parsed!.brForNewlines).toBe(true);
    expect(parsed!.numberFormat.enabled).toBe(false);
    expect(parsed!.numberFormat.decimals).toBe(2);
    expect(parsed!.sortColumn).toBe(1);
    expect(parsed!.sortDirection).toBe("asc");
    expect(parsed!.transpose).toBe(false);
    expect(parsed!.dedupe).toBe(true);
    expect(parsed!.caseTransform).toBe("none");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("filters invalid format", () => {
    const p = parseShareUrl("f=invalid&i=x");
    expect(p!.format).toBe("auto");
  });
  it("filters invalid case transform", () => {
    const p = parseShareUrl("f=csv&c=invalid");
    expect(p!.caseTransform).toBe("none");
  });
});

describe("ai-markdown-table-generator LLM prompt", () => {
  it("builds a prompt", () => {
    const prompt = buildLlmPrompt("a,b\n1,2", "csv");
    expect(prompt.system).toContain("Markdown table expert");
    expect(prompt.user).toContain("csv");
    expect(prompt.user).toContain("a,b\n1,2");
  });
  it("strips code fences from result", () => {
    const raw = "```markdown\n| a | b |\n| - | - |\n| 1 | 2 |\n```";
    const rendered = renderLlmResult(raw);
    expect(rendered).not.toContain("```");
    expect(rendered).toContain("| a | b |");
  });
  it("passes through non-fenced text", () => {
    const raw = "| a | b |\n| - | - |";
    expect(renderLlmResult(raw)).toBe(raw);
  });
});

// Suppress unused-import lint
export type _Unused = Alignment | CaseTransform | InputFormat | OutputMode | SortDirection;
