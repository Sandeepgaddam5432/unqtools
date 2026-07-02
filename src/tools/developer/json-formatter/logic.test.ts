/**
 * JSON Formatter — unit tests.
 * Covers: valid input, indent options, key sorting, minify, validation,
 * invalid input (with line/column), empty input, large input, nested structures,
 * edge cases (numbers, null, unicode, scientific notation).
 */
import { describe, it, expect } from "vitest";
import { formatJson, minifyJson, validateJson, sortDeep, WORKER_THRESHOLD_BYTES } from "./logic";

describe("formatJson", () => {
  it("pretty-prints with 2-space indent", () => {
    const r = formatJson('{"b":1,"a":2}', { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe('{\n  "b": 1,\n  "a": 2\n}');
  });

  it("pretty-prints with 4-space indent", () => {
    const r = formatJson('{"a":1}', { indent: 4, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe('{\n    "a": 1\n}');
  });

  it("sorts keys when requested (top-level)", () => {
    const r = formatJson('{"b":1,"a":2}', { indent: 2, sortKeys: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const aIdx = r.output.indexOf('"a"');
      const bIdx = r.output.indexOf('"b"');
      expect(aIdx).toBeLessThan(bIdx);
    }
  });

  it("sorts keys recursively in nested objects", () => {
    const input = '{"z":{"y":1,"x":2},"a":3}';
    const r = formatJson(input, { indent: 2, sortKeys: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // After sort: a comes before z, and inside z: x comes before y
      const aIdx = r.output.indexOf('"a"');
      const zIdx = r.output.indexOf('"z"');
      const xIdx = r.output.indexOf('"x"');
      const yIdx = r.output.indexOf('"y"');
      expect(aIdx).toBeLessThan(zIdx);
      expect(xIdx).toBeLessThan(yIdx);
      expect(zIdx).toBeLessThan(xIdx); // z block contains x and y
    }
  });

  it("preserves array order even when sorting", () => {
    const input = "[3,1,2]";
    const r = formatJson(input, { indent: 2, sortKeys: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("[\n  3,\n  1,\n  2\n]");
  });

  it("returns error on invalid JSON", () => {
    const r = formatJson("{bad}", { indent: 2, sortKeys: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it("returns line/column on invalid JSON", () => {
    // The error is at the 'b' character on line 2, after newline
    const r = formatJson('{\n  "a": bad\n}', { indent: 2, sortKeys: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(2);
      expect(r.column).toBeGreaterThan(0);
    }
  });

  it("errors on empty input", () => {
    expect(formatJson("", { indent: 2, sortKeys: false }).ok).toBe(false);
  });

  it("errors on whitespace-only input", () => {
    expect(formatJson("   \n\t  ", { indent: 2, sortKeys: false }).ok).toBe(false);
  });

  it("handles primitives: number", () => {
    const r = formatJson("42", { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("42");
  });

  it("handles primitives: string", () => {
    const r = formatJson('"hello"', { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe('"hello"');
  });

  it("handles primitives: null", () => {
    const r = formatJson("null", { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("null");
  });

  it("handles primitives: boolean", () => {
    const r = formatJson("true", { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("true");
  });

  it("handles scientific notation", () => {
    const r = formatJson("1.5e3", { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("1500");
  });

  it("handles unicode escapes", () => {
    const r = formatJson('"\\u0041"', { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe('"A"');
  });

  it("handles deeply nested structures", () => {
    const input = '{"a":{"b":{"c":{"d":{"e":1}}}}}';
    const r = formatJson(input, { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain('"e": 1');
  });

  it("handles large arrays efficiently", () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i);
    const input = JSON.stringify(arr);
    const r = formatJson(input, { indent: 2, sortKeys: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.split("\n").length).toBe(1002);
  });
});

describe("minifyJson", () => {
  it("strips all whitespace", () => {
    expect(minifyJson('{ "a": 1, "b": 2 }')).toEqual({ ok: true, output: '{"a":1,"b":2}' });
  });

  it("strips whitespace from pretty-printed input", () => {
    const pretty = '{\n  "a": 1,\n  "b": 2\n}';
    expect(minifyJson(pretty)).toEqual({ ok: true, output: '{"a":1,"b":2}' });
  });

  it("returns error on invalid input", () => {
    expect(minifyJson("{bad}").ok).toBe(false);
  });

  it("errors on empty input", () => {
    expect(minifyJson("").ok).toBe(false);
  });

  it("preserves string contents with internal spaces", () => {
    expect(minifyJson('{ "msg": "hello world" }')).toEqual({
      ok: true,
      output: '{"msg":"hello world"}',
    });
  });
});

describe("validateJson", () => {
  it("returns canonical minified form on valid input", () => {
    expect(validateJson('{ "a": 1 }')).toEqual({ ok: true, output: '{"a":1}' });
  });

  it("returns error on invalid input", () => {
    expect(validateJson("{bad}").ok).toBe(false);
  });

  it("errors on empty input", () => {
    expect(validateJson("   ").ok).toBe(false);
  });
});

describe("sortDeep", () => {
  it("sorts top-level object keys", () => {
    const out = sortDeep({ b: 1, a: 2 }) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(["a", "b"]);
  });

  it("sorts nested objects", () => {
    const out = sortDeep({ z: { y: 1, x: 2 } }) as Record<string, Record<string, unknown>>;
    expect(Object.keys(out.z)).toEqual(["x", "y"]);
  });

  it("preserves array order", () => {
    expect(sortDeep([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it("returns primitives unchanged", () => {
    expect(sortDeep(42)).toBe(42);
    expect(sortDeep("hello")).toBe("hello");
    expect(sortDeep(null)).toBe(null);
    expect(sortDeep(true)).toBe(true);
  });

  it("handles empty objects and arrays", () => {
    expect(sortDeep({})).toEqual({});
    expect(sortDeep([])).toEqual([]);
  });
});

describe("WORKER_THRESHOLD_BYTES", () => {
  it("is exactly 100KB", () => {
    expect(WORKER_THRESHOLD_BYTES).toBe(100 * 1024);
  });
});
