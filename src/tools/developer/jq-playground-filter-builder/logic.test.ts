import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_FLAGS,
  SAMPLE_JSON,
  RECIPES,
  STEP_TYPE_LABELS,
  parseInput,
  formatOutput,
  stringify,
  compareJson,
  run,
  renderStep,
  explainStep,
  buildFilter,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  decodeError,
  type Json,
  type Flags,
  type BuilderStep,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("jq-playground constants", () => {
  it("DEFAULT_FLAGS has 4 toggles all false", () => {
    expect(DEFAULT_FLAGS.compact).toBe(false);
    expect(DEFAULT_FLAGS.raw).toBe(false);
    expect(DEFAULT_FLAGS.slurp).toBe(false);
    expect(DEFAULT_FLAGS.sortKeys).toBe(false);
  });
  it("SAMPLE_JSON has 4 entries", () => {
    expect(SAMPLE_JSON).toHaveLength(4);
    expect(SAMPLE_JSON.map((s) => s.label)).toContain("Users array");
    expect(SAMPLE_JSON.map((s) => s.label)).toContain("NDJSON lines");
  });
  it("RECIPES has 20+ entries", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(20);
  });
  it("STEP_TYPE_LABELS covers all common ops", () => {
    expect(Object.keys(STEP_TYPE_LABELS)).toContain("select");
    expect(Object.keys(STEP_TYPE_LABELS)).toContain("map");
    expect(Object.keys(STEP_TYPE_LABELS)).toContain("sort_by");
    expect(Object.keys(STEP_TYPE_LABELS)).toContain("group_by");
  });
});

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

describe("jq-playground parseInput", () => {
  it("parses a single JSON object", () => {
    const r = parseInput('{"a":1}', false);
    expect(r.error).toBeNull();
    expect(r.values).toEqual([{ a: 1 }]);
  });
  it("parses a JSON array", () => {
    const r = parseInput("[1,2,3]", false);
    expect(r.error).toBeNull();
    expect(r.values).toEqual([[1, 2, 3]]);
  });
  it("returns empty for empty input", () => {
    expect(parseInput("", false).values).toEqual([]);
  });
  it("returns error for invalid JSON in non-slurp mode", () => {
    const r = parseInput("{not json", false);
    expect(r.error).toBeTruthy();
    expect(r.values).toEqual([]);
  });
  it("parses NDJSON lines in slurp mode", () => {
    const r = parseInput('{"a":1}\n{"a":2}\n{"a":3}', true);
    expect(r.error).toBeNull();
    expect(r.values).toHaveLength(3);
  });
  it("skips blank lines in slurp mode", () => {
    const r = parseInput('{"a":1}\n\n{"a":2}', true);
    expect(r.values).toHaveLength(2);
  });
  it("reports line number on bad NDJSON", () => {
    const r = parseInput('{"a":1}\n{bad}\n{"a":3}', true);
    expect(r.error).toMatch(/Line 2/);
  });
});

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

describe("jq-playground formatOutput", () => {
  it("pretty-prints by default", () => {
    const out = formatOutput([{ a: 1 }], DEFAULT_FLAGS);
    expect(out).toBe('{\n  "a": 1\n}');
  });
  it("compacts when -c", () => {
    const out = formatOutput([{ a: 1 }], { ...DEFAULT_FLAGS, compact: true });
    expect(out).toBe('{"a":1}');
  });
  it("raw-prints strings when -r", () => {
    const out = formatOutput(["hello"], { ...DEFAULT_FLAGS, raw: true });
    expect(out).toBe("hello");
  });
  it("still JSON-encodes non-strings with -r", () => {
    const out = formatOutput([42], { ...DEFAULT_FLAGS, raw: true });
    expect(out).toBe("42");
  });
  it("sorts keys with -S", () => {
    const out = formatOutput([{ b: 1, a: 2 }], { ...DEFAULT_FLAGS, sortKeys: true, compact: true });
    expect(out).toBe('{"a":2,"b":1}');
  });
  it("joins multiple results with newlines", () => {
    const out = formatOutput([1, 2, 3], DEFAULT_FLAGS);
    expect(out).toBe("1\n2\n3");
  });
});

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

describe("jq-playground helpers", () => {
  it("stringify returns strings as-is, others as JSON", () => {
    expect(stringify("hello")).toBe("hello");
    expect(stringify(42)).toBe("42");
    expect(stringify({ a: 1 })).toBe('{"a":1}');
  });
  it("compareJson orders null < false < true < numbers < strings", () => {
    expect(compareJson(null, false)).toBeLessThan(0);
    expect(compareJson(false, true)).toBeLessThan(0);
    expect(compareJson(true, 1)).toBeLessThan(0);
    expect(compareJson(1, "a")).toBeLessThan(0);
  });
  it("compareJson sorts numbers numerically", () => {
    expect(compareJson(10, 9)).toBeGreaterThan(0);
    expect(compareJson(2, 2)).toBe(0);
  });
  it("compareJson sorts strings lexicographically", () => {
    expect(compareJson("abc", "abd")).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Run — core jq interpreter
// ---------------------------------------------------------------------------

describe("jq-playground run — identity & literals", () => {
  it("identity returns the input", () => {
    const r = run('{"a":1}', ".", DEFAULT_FLAGS);
    expect(r.error).toBeNull();
    expect(r.results).toEqual([{ a: 1 }]);
  });
  it("literal returns the literal", () => {
    const r = run("{}", "42", DEFAULT_FLAGS);
    expect(r.results).toEqual([42]);
    const r2 = run("{}", '"hello"', DEFAULT_FLAGS);
    expect(r2.results).toEqual(["hello"]);
    const r3 = run("{}", "true", DEFAULT_FLAGS);
    expect(r3.results).toEqual([true]);
    const r4 = run("{}", "null", DEFAULT_FLAGS);
    expect(r4.results).toEqual([null]);
  });
});

describe("jq-playground run — field access", () => {
  it(".foo projects a field", () => {
    const r = run('{"foo":42,"bar":1}', ".foo", DEFAULT_FLAGS);
    expect(r.results).toEqual([42]);
  });
  it(".foo returns null when missing", () => {
    const r = run('{"bar":1}', ".foo", DEFAULT_FLAGS);
    expect(r.results).toEqual([null]);
  });
  it(".foo.bar chains", () => {
    const r = run('{"foo":{"bar":7}}', ".foo.bar", DEFAULT_FLAGS);
    expect(r.results).toEqual([7]);
  });
  it('."quoted" works for keyword-named fields', () => {
    const r = run('{"type":"X"}', '."type"', DEFAULT_FLAGS);
    expect(r.results).toEqual(["X"]);
  });
});

describe("jq-playground run — array index & slice", () => {
  it(".[0] returns the first element", () => {
    const r = run("[10,20,30]", ".[0]", DEFAULT_FLAGS);
    expect(r.results).toEqual([10]);
  });
  it(".[-1] returns the last element", () => {
    const r = run("[10,20,30]", ".[-1]", DEFAULT_FLAGS);
    expect(r.results).toEqual([30]);
  });
  it(".[1:3] returns a slice", () => {
    const r = run("[10,20,30,40]", ".[1:3]", DEFAULT_FLAGS);
    expect(r.results).toEqual([[20, 30]]);
  });
  it(".[:2] returns a head slice", () => {
    const r = run("[10,20,30,40]", ".[:2]", DEFAULT_FLAGS);
    expect(r.results).toEqual([[10, 20]]);
  });
  it(".[2:] returns a tail slice", () => {
    const r = run("[10,20,30,40]", ".[2:]", DEFAULT_FLAGS);
    expect(r.results).toEqual([[30, 40]]);
  });
});

describe("jq-playground run — iteration", () => {
  it(".[] yields each element", () => {
    const r = run("[1,2,3]", ".[]", DEFAULT_FLAGS);
    expect(r.results).toEqual([1, 2, 3]);
  });
  it(".foo[] iterates a nested array", () => {
    const r = run('{"a":[1,2]}', ".a[]", DEFAULT_FLAGS);
    expect(r.results).toEqual([1, 2]);
  });
  it(".[] iterates object values", () => {
    const r = run('{"a":1,"b":2}', ".[]", DEFAULT_FLAGS);
    expect(r.results).toEqual([1, 2]);
  });
  it(".[] on null throws an error", () => {
    const r = run("null", ".[]", DEFAULT_FLAGS);
    expect(r.error).toMatch(/null/);
  });
});

describe("jq-playground run — pipe & comma", () => {
  it("pipe chains filters", () => {
    const r = run('{"a":[1,2,3]}', ".a | .[0]", DEFAULT_FLAGS);
    expect(r.results).toEqual([1]);
  });
  it("comma yields multiple results", () => {
    const r = run('{"a":1,"b":2}', ".a, .b", DEFAULT_FLAGS);
    expect(r.results).toEqual([1, 2]);
  });
});

describe("jq-playground run — select", () => {
  it("select keeps matching elements", () => {
    const r = run("[1,2,3,4,5]", ".[] | select(. > 2)", DEFAULT_FLAGS);
    expect(r.results).toEqual([3, 4, 5]);
  });
  it("select with field comparison", () => {
    const r = run(
      JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }]),
      ".[] | select(.a == 2)",
      DEFAULT_FLAGS,
    );
    expect(r.results).toEqual([{ a: 2 }]);
  });
});

describe("jq-playground run — map", () => {
  it("map applies inner filter to each element", () => {
    const r = run("[1,2,3]", "map(. * 2)", DEFAULT_FLAGS);
    expect(r.results).toEqual([[2, 4, 6]]);
  });
  it("map(.foo) extracts fields", () => {
    const r = run(
      JSON.stringify([{ foo: 1 }, { foo: 2 }]),
      "map(.foo)",
      DEFAULT_FLAGS,
    );
    expect(r.results).toEqual([[1, 2]]);
  });
});

describe("jq-playground run — sort & sort_by", () => {
  it("sort sorts the array", () => {
    const r = run("[3,1,2]", "sort", DEFAULT_FLAGS);
    expect(r.results).toEqual([[1, 2, 3]]);
  });
  it("sort_by(.field) sorts by field", () => {
    const r = run(
      JSON.stringify([{ a: 3 }, { a: 1 }, { a: 2 }]),
      "sort_by(.a)",
      DEFAULT_FLAGS,
    );
    expect(r.results).toEqual([[{ a: 1 }, { a: 2 }, { a: 3 }]]);
  });
});

describe("jq-playground run — group_by", () => {
  it("group_by(.role) groups elements", () => {
    const r = run(
      JSON.stringify([
        { name: "a", role: "x" },
        { name: "b", role: "y" },
        { name: "c", role: "x" },
      ]),
      "group_by(.role)",
      DEFAULT_FLAGS,
    );
    expect(r.results).toEqual([
      [
        [{ name: "a", role: "x" }, { name: "c", role: "x" }],
        [{ name: "b", role: "y" }],
      ],
    ]);
  });
});

describe("jq-playground run — keys, values, length", () => {
  it("keys returns sorted keys", () => {
    const r = run('{"b":1,"a":2}', "keys", DEFAULT_FLAGS);
    expect(r.results).toEqual([["a", "b"]]);
  });
  it("values returns values", () => {
    const r = run('{"a":1,"b":2}', "values", DEFAULT_FLAGS);
    expect(r.results).toEqual([[1, 2]]);
  });
  it("length returns array length", () => {
    expect(run("[1,2,3]", "length", DEFAULT_FLAGS).results).toEqual([3]);
    expect(run('"hello"', "length", DEFAULT_FLAGS).results).toEqual([5]);
    expect(run('{"a":1,"b":2}', "length", DEFAULT_FLAGS).results).toEqual([2]);
  });
});

describe("jq-playground run — to_entries / from_entries", () => {
  it("to_entries converts to entry array", () => {
    const r = run('{"a":1,"b":2}', "to_entries", DEFAULT_FLAGS);
    expect(r.results).toEqual([
      [
        { key: "a", value: 1 },
        { key: "b", value: 2 },
      ],
    ]);
  });
  it("from_entries converts back", () => {
    const r = run(
      JSON.stringify([{ key: "a", value: 1 }]),
      "from_entries",
      DEFAULT_FLAGS,
    );
    expect(r.results).toEqual([{ a: 1 }]);
  });
  it("round-trips to_entries | from_entries", () => {
    const orig = '{"a":1,"b":2}';
    const r = run(orig, "to_entries | from_entries", DEFAULT_FLAGS);
    expect(r.results).toEqual([{ a: 1, b: 2 }]);
  });
});

describe("jq-playground run — add / first / last / limit / unique", () => {
  it("add sums numbers", () => {
    expect(run("[1,2,3]", "add", DEFAULT_FLAGS).results).toEqual([6]);
  });
  it("add concatenates strings", () => {
    expect(run('["a","b","c"]', "add", DEFAULT_FLAGS).results).toEqual(["abc"]);
  });
  it("first returns the first element", () => {
    expect(run("[10,20,30]", "first", DEFAULT_FLAGS).results).toEqual([10]);
  });
  it("last returns the last element", () => {
    expect(run("[10,20,30]", "last", DEFAULT_FLAGS).results).toEqual([30]);
  });
  it("limit(2; .[]) takes first 2", () => {
    const r = run("[1,2,3,4]", "limit(2; .[])", DEFAULT_FLAGS);
    expect(r.results).toEqual([1, 2]);
  });
  it("unique removes duplicates", () => {
    expect(run("[1,2,2,3,3,3]", "unique", DEFAULT_FLAGS).results).toEqual([[1, 2, 3]]);
  });
  it("unique_by(.id) dedupes by field", () => {
    const r = run(
      JSON.stringify([{ id: 1 }, { id: 2 }, { id: 1 }]),
      "unique_by(.id)",
      DEFAULT_FLAGS,
    );
    expect(r.results).toEqual([[{ id: 1 }, { id: 2 }]]);
  });
});

describe("jq-playground run — has / contains", () => {
  it('has("a") checks object key', () => {
    expect(run('{"a":1}', 'has("a")', DEFAULT_FLAGS).results).toEqual([true]);
    expect(run('{"a":1}', 'has("b")', DEFAULT_FLAGS).results).toEqual([false]);
  });
  it("contains checks sub-object", () => {
    const r = run('{"a":1,"b":2}', "contains({a:1})", DEFAULT_FLAGS);
    expect(r.results).toEqual([true]);
  });
});

describe("jq-playground run — del", () => {
  it("del(.foo) removes a field", () => {
    const r = run('{"a":1,"b":2}', "del(.a)", DEFAULT_FLAGS);
    expect(r.results).toEqual([{ b: 2 }]);
  });
});

describe("jq-playground run — constructors", () => {
  it("array constructor collects results", () => {
    const r = run("[1,2,3]", "[.[]]", DEFAULT_FLAGS);
    expect(r.results).toEqual([[1, 2, 3]]);
  });
  it("object constructor with shorthand", () => {
    const r = run('{"a":1,"b":2}', "{a}", DEFAULT_FLAGS);
    expect(r.results).toEqual([{ a: 1 }]);
  });
  it("object constructor with explicit key", () => {
    const r = run('{"a":1,"b":2}', "{x: .a}", DEFAULT_FLAGS);
    expect(r.results).toEqual([{ x: 1 }]);
  });
});

describe("jq-playground run — string interpolation", () => {
  it("interpolates a field", () => {
    const r = run('{"name":"World"}', '"Hello \\(.name)!"', DEFAULT_FLAGS);
    expect(r.results).toEqual(["Hello World!"]);
  });
  it("interpolates multiple fields", () => {
    const r = run('{"a":1,"b":2}', '"a=\\(.a) b=\\(.b)"', DEFAULT_FLAGS);
    expect(r.results).toEqual(["a=1 b=2"]);
  });
});

describe("jq-playground run — arithmetic & comparison", () => {
  it("arithmetic", () => {
    expect(run("null", "1 + 2", DEFAULT_FLAGS).results).toEqual([3]);
    expect(run("null", "10 - 4", DEFAULT_FLAGS).results).toEqual([6]);
    expect(run("null", "3 * 4", DEFAULT_FLAGS).results).toEqual([12]);
    expect(run("null", "10 / 4", DEFAULT_FLAGS).results).toEqual([2.5]);
    expect(run("null", "10 % 3", DEFAULT_FLAGS).results).toEqual([1]);
  });
  it("negation", () => {
    expect(run("null", "-5", DEFAULT_FLAGS).results).toEqual([-5]);
  });
  it("comparison", () => {
    expect(run("null", "1 < 2", DEFAULT_FLAGS).results).toEqual([true]);
    expect(run("null", "1 == 1", DEFAULT_FLAGS).results).toEqual([true]);
    expect(run("null", '"a" != "b"', DEFAULT_FLAGS).results).toEqual([true]);
  });
});

describe("jq-playground run — if/then/else", () => {
  it("if/then/else picks branch", () => {
    const r = run("5", "if . > 3 then \"big\" else \"small\" end", DEFAULT_FLAGS);
    expect(r.results).toEqual(["big"]);
  });
  it("if without else returns empty for false branch", () => {
    const r = run("1", "if . > 3 then \"big\" end", DEFAULT_FLAGS);
    expect(r.results).toEqual([]);
  });
  it("elif chains", () => {
    const r = run("2", "if . == 1 then \"a\" elif . == 2 then \"b\" else \"c\" end", DEFAULT_FLAGS);
    expect(r.results).toEqual(["b"]);
  });
});

describe("jq-playground run — recursive descent", () => {
  it(".. yields all values", () => {
    const r = run('{"a":{"b":1}}', "..", DEFAULT_FLAGS);
    expect(r.results).toEqual([
      { a: { b: 1 } },
      { b: 1 },
      1,
    ]);
  });
});

describe("jq-playground run — as binding", () => {
  it("binds a variable", () => {
    const r = run('{"a":5}', ".a as $x | $x * 2", DEFAULT_FLAGS);
    expect(r.results).toEqual([10]);
  });
});

describe("jq-playground run — reduce & foreach", () => {
  it("reduce sums", () => {
    const r = run("[1,2,3,4]", "reduce .[] as $x (0; . + $x)", DEFAULT_FLAGS);
    expect(r.results).toEqual([10]);
  });
  it("foreach yields intermediate", () => {
    const r = run("[1,2,3]", "foreach .[] as $x (0; . + $x)", DEFAULT_FLAGS);
    expect(r.results).toEqual([1, 3, 6]);
  });
});

describe("jq-playground run — try/catch", () => {
  it("try swallows errors", () => {
    const r = run("null", "try (.[])", DEFAULT_FLAGS);
    expect(r.results).toEqual([]);
  });
  it("try/catch returns the catch value", () => {
    const r = run("null", "try (.[]) catch \"none\"", DEFAULT_FLAGS);
    expect(r.results).toEqual(["none"]);
  });
});

describe("jq-playground run — recipes (integration)", () => {
  const users = JSON.stringify([
    { name: "Alice", age: 30, role: "admin" },
    { name: "Bob", age: 17, role: "user" },
    { name: "Carol", age: 25, role: "user" },
  ]);
  it(".[] | select(.age > 18) keeps adults", () => {
    const r = run(users, ".[] | select(.age > 18)", DEFAULT_FLAGS);
    expect(r.results).toHaveLength(2);
    expect(r.results[0]).toEqual({ name: "Alice", age: 30, role: "admin" });
  });
  it(".[] | map(.name) is wrong-shaped (array in array)", () => {
    // Demonstrates a common mistake: map() on each element vs on the array.
    const r = run(users, "map(.name)", DEFAULT_FLAGS);
    expect(r.results).toEqual([["Alice", "Bob", "Carol"]]);
  });
  it("sort_by(.age) sorts by age", () => {
    const r = run(users, "sort_by(.age)", DEFAULT_FLAGS);
    expect((r.results[0] as Json[])[0]).toEqual({ name: "Bob", age: 17, role: "user" });
  });
  it("group_by(.role) groups by role", () => {
    const r = run(users, "group_by(.role)", DEFAULT_FLAGS);
    expect(r.results[0]).toHaveLength(2);
  });
  it("[.[] | .name] collects names into an array", () => {
    const r = run(users, "[.[] | .name]", DEFAULT_FLAGS);
    expect(r.results).toEqual([["Alice", "Bob", "Carol"]]);
  });
});

// ---------------------------------------------------------------------------
// Run — error handling & flags
// ---------------------------------------------------------------------------

describe("jq-playground run — errors & flags", () => {
  it("returns input error for invalid JSON", () => {
    const r = run("{not json", ".", DEFAULT_FLAGS);
    expect(r.inputValid).toBe(false);
    expect(r.inputError).toBeTruthy();
    expect(r.error).toBeNull();
  });
  it("returns filter error for bad filter", () => {
    const r = run("{}", ".[", DEFAULT_FLAGS);
    expect(r.error).toBeTruthy();
    expect(r.inputValid).toBe(true);
  });
  it("distinguishes input error from filter error", () => {
    const r1 = run("{bad", ".", DEFAULT_FLAGS);
    expect(r1.inputValid).toBe(false);
    const r2 = run("{}", ".[", DEFAULT_FLAGS);
    expect(r2.inputValid).toBe(true);
    expect(r2.error).toBeTruthy();
  });
  it("slurp mode wraps multiple values into an array", () => {
    const r = run('{"a":1}\n{"a":2}', "length", { ...DEFAULT_FLAGS, slurp: true });
    expect(r.results).toEqual([2]);
  });
  it("compact flag produces compact output", () => {
    const r = run('{"a":1}', ".", { ...DEFAULT_FLAGS, compact: true });
    expect(formatOutput(r.results, { ...DEFAULT_FLAGS, compact: true })).toBe('{"a":1}');
  });
  it("raw flag prints strings without quotes", () => {
    const r = run('"hello"', ".", { ...DEFAULT_FLAGS, raw: true });
    expect(formatOutput(r.results, { ...DEFAULT_FLAGS, raw: true })).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

describe("jq-playground builder", () => {
  it("renderStep renders each type", () => {
    expect(renderStep({ type: "identity" })).toBe(".");
    expect(renderStep({ type: "field", field: "foo" })).toBe(".foo");
    expect(renderStep({ type: "iterate" })).toBe(".[]");
    expect(renderStep({ type: "index", index: 2 })).toBe(".[2]");
    expect(renderStep({ type: "index", index: 1, indexEnd: 3 })).toBe(".[1:3]");
    expect(renderStep({ type: "select", condition: ".age > 18" })).toBe("select(.age > 18)");
    expect(renderStep({ type: "map", expr: ".name" })).toBe("map(.name)");
    expect(renderStep({ type: "sort_by", field: "age" })).toBe("sort_by(.age)");
    expect(renderStep({ type: "group_by", field: "role" })).toBe("group_by(.role)");
    expect(renderStep({ type: "keys" })).toBe("keys");
    expect(renderStep({ type: "values" })).toBe("values");
    expect(renderStep({ type: "length" })).toBe("length");
    expect(renderStep({ type: "to_entries" })).toBe("to_entries");
    expect(renderStep({ type: "from_entries" })).toBe("from_entries");
    expect(renderStep({ type: "add" })).toBe("add");
    expect(renderStep({ type: "first" })).toBe("first");
    expect(renderStep({ type: "last", expr: ".name" })).toBe("last(.name)");
    expect(renderStep({ type: "limit", count: 2, limitExpr: ".[]" })).toBe("limit(2; .[])");
    expect(renderStep({ type: "unique" })).toBe("unique");
    expect(renderStep({ type: "unique_by", field: "id" })).toBe("unique_by(.id)");
    expect(renderStep({ type: "has", field: "name" })).toBe('has("name")');
    expect(renderStep({ type: "contains", value: "{a:1}" })).toBe("contains({a:1})");
    expect(renderStep({ type: "del", field: "password" })).toBe("del(.password)");
    expect(renderStep({ type: "array_constructor", arrayExpr: ".name" })).toBe("[.name]");
    expect(renderStep({ type: "reverse" })).toBe("reverse");
  });
  it("explainStep produces a non-empty English explanation", () => {
    const steps: BuilderStep[] = [
      { type: "iterate" },
      { type: "select", condition: ".age > 18" },
      { type: "field", field: "name" },
    ];
    for (const s of steps) {
      expect(explainStep(s).length).toBeGreaterThan(0);
    }
  });
  it("buildFilter joins steps with ' | '", () => {
    const { filter, explained } = buildFilter([
      { type: "field", field: "users" },
      { type: "iterate" },
      { type: "select", condition: ".age > 18" },
    ]);
    expect(filter).toBe(".users | .[] | select(.age > 18)");
    expect(explained).toHaveLength(3);
    expect(explained[0].n).toBe(1);
    expect(explained[2].fragment).toBe("select(.age > 18)");
  });
  it("buildFilter returns '.' for empty steps", () => {
    const { filter, explained } = buildFilter([]);
    expect(filter).toBe(".");
    expect(explained).toEqual([]);
  });
  it("builder filter actually runs end-to-end", () => {
    const { filter } = buildFilter([
      { type: "field", field: "users" },
      { type: "iterate" },
      { type: "select", condition: ".age > 18" },
      { type: "field", field: "name" },
    ]);
    const input = JSON.stringify({ users: [
      { name: "A", age: 30 },
      { name: "B", age: 10 },
    ] });
    const r = run(input, filter, DEFAULT_FLAGS);
    expect(r.results).toEqual(["A"]);
  });
});

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

describe("jq-playground history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory prepends", () => {
    saveHistory({ ts: 1, filter: ".a", resultCount: 1, inputBytes: 10 });
    expect(loadHistory()[0].filter).toBe(".a");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, filter: `f${i}`, resultCount: 1, inputBytes: 10 });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].filter).toBe("f24");
  });
  it("clearHistory empties", () => {
    saveHistory({ ts: 1, filter: "x", resultCount: 1, inputBytes: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("jq-playground share URL", () => {
  it("encodes filter + input + flags", () => {
    const url = buildShareUrl(".a", '{"a":1}', { ...DEFAULT_FLAGS, compact: true, raw: true });
    expect(url).toMatch(/[?#]/);
    expect(url).toContain("f=");
    expect(url).toContain("i=");
    expect(url).toContain("x=cr");
  });
  it("round-trips filter + input + flags", () => {
    const flags: Flags = { ...DEFAULT_FLAGS, slurp: true, sortKeys: true };
    const url = buildShareUrl("map(.x)", '{"x":1}', flags);
    const idx = Math.max(url.indexOf("?"), url.indexOf("#"));
    const hash = idx >= 0 ? url.substring(idx) : "";
    const p = parseShareUrl(hash);
    expect(p.filter).toBe("map(.x)");
    expect(p.input).toBe('{"x":1}');
    expect(p.flags.slurp).toBe(true);
    expect(p.flags.sortKeys).toBe(true);
    expect(p.flags.compact).toBe(false);
  });
  it("parseShareUrl returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.filter).toBe("");
    expect(p.input).toBe("");
    expect(p.flags).toEqual(DEFAULT_FLAGS);
  });
});

// ---------------------------------------------------------------------------
// Error decoder
// ---------------------------------------------------------------------------

describe("jq-playground decodeError", () => {
  it("decodes 'Cannot iterate over null'", () => {
    const d = decodeError("Cannot iterate over null (null)");
    expect(d.plain).toMatch(/iterate/);
    expect(d.hint.length).toBeGreaterThan(0);
  });
  it("decodes 'has no length'", () => {
    const d = decodeError("number has no length");
    expect(d.plain).toMatch(/length/);
  });
  it("decodes 'Unterminated string'", () => {
    const d = decodeError("Unterminated string");
    expect(d.hint).toMatch(/quote/);
  });
  it("passes through unknown errors", () => {
    const d = decodeError("Some mystery error");
    expect(d.plain).toBe("Some mystery error");
  });
});

// ---------------------------------------------------------------------------
// Public API surface (10+ exports)
// ---------------------------------------------------------------------------

describe("jq-playground public API", () => {
  it("exposes the expected functions and constants", () => {
    expect(typeof run).toBe("function");
    expect(typeof parseInput).toBe("function");
    expect(typeof formatOutput).toBe("function");
    expect(typeof stringify).toBe("function");
    expect(typeof compareJson).toBe("function");
    expect(typeof buildFilter).toBe("function");
    expect(typeof renderStep).toBe("function");
    expect(typeof explainStep).toBe("function");
    expect(typeof loadHistory).toBe("function");
    expect(typeof saveHistory).toBe("function");
    expect(typeof clearHistory).toBe("function");
    expect(typeof buildShareUrl).toBe("function");
    expect(typeof parseShareUrl).toBe("function");
    expect(typeof decodeError).toBe("function");
    expect(Array.isArray(RECIPES)).toBe(true);
    expect(Array.isArray(SAMPLE_JSON)).toBe(true);
  });
});
