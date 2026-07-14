import { describe, it, expect, beforeEach } from "vitest";
import {
  validateJson, escapeXmlText, escapeXmlAttribute, isValidXmlName, sanitizeXmlName,
  maybeCdata, buildRootOpen, getXsiType, valueToXml, jsonToXml,
  validateXml, parseXml, xmlNodeToJson, xmlToJson,
  loadHistory, saveToHistory, clearHistory, formatBytes,
  DEFAULT_OPTIONS, type ConvertOptions,
} from "./logic";

const opts = (overrides: Partial<ConvertOptions> = {}): ConvertOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe("json2xml validateJson", () => {
  it("parses valid JSON", () => {
    const r = validateJson('{"a":1}');
    expect(r.ok).toBe(true);
  });
  it("rejects invalid JSON", () => {
    const r = validateJson("{a:1}");
    expect(r.ok).toBe(false);
  });
});

describe("json2xml escapeXmlText", () => {
  it("escapes &, <, >", () => {
    expect(escapeXmlText("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });
});

describe("json2xml escapeXmlAttribute", () => {
  it("escapes quotes", () => {
    expect(escapeXmlAttribute('"hi"')).toBe("&quot;hi&quot;");
  });
});

describe("json2xml isValidXmlName", () => {
  it("accepts valid names", () => {
    expect(isValidXmlName("root")).toBe(true);
    expect(isValidXmlName("_private")).toBe(true);
    expect(isValidXmlName("my-element")).toBe(true);
  });
  it("rejects invalid names", () => {
    expect(isValidXmlName("1abc")).toBe(false);
    expect(isValidXmlName("")).toBe(false);
    expect(isValidXmlName("has space")).toBe(false);
  });
});

describe("json2xml sanitizeXmlName", () => {
  it("leaves valid names unchanged", () => {
    expect(sanitizeXmlName("root")).toBe("root");
  });
  it("fixes invalid start char", () => {
    expect(sanitizeXmlName("1abc")).toBe("_abc");
  });
  it("replaces invalid chars", () => {
    expect(sanitizeXmlName("a b c")).toBe("a_b_c");
  });
});

describe("json2xml maybeCdata", () => {
  it("returns escaped text for simple strings", () => {
    expect(maybeCdata("hello", 0)).toBe("hello");
  });
  it("wraps in CDATA when special chars present", () => {
    expect(maybeCdata("a < b", 0)).toBe("<![CDATA[a < b]]>");
  });
  it("wraps in CDATA when over threshold", () => {
    const text = "x".repeat(15);
    expect(maybeCdata(text, 10)).toBe(`<![CDATA[${text}]]>`);
  });
  it("splits CDATA on ]]> sequences", () => {
    expect(maybeCdata("before ]]> after", 0)).toContain("]]]]><![CDATA[>");
  });
});

describe("json2xml buildRootOpen", () => {
  it("no namespace", () => {
    expect(buildRootOpen(opts({ rootName: "root" }))).toBe("<root>");
  });
  it("default namespace", () => {
    expect(buildRootOpen(opts({ rootName: "root", namespace: "https://x" }))).toBe('<root xmlns="https://x">');
  });
  it("prefixed namespace", () => {
    expect(buildRootOpen(opts({ rootName: "root", namespace: "https://x", namespacePrefix: "ns" }))).toBe('<root xmlns:ns="https://x">');
  });
});

describe("json2xml getXsiType", () => {
  it("boolean", () => { expect(getXsiType(true)).toBe("boolean"); });
  it("integer", () => { expect(getXsiType(42)).toBe("integer"); });
  it("double", () => { expect(getXsiType(3.14)).toBe("double"); });
  it("string → null", () => { expect(getXsiType("hi")).toBeNull(); });
});

describe("json2xml valueToXml (objects)", () => {
  it("converts simple object", () => {
    const xml = valueToXml({ name: "Alice", age: 30 }, "person", opts(), 0);
    expect(xml).toContain("<person>");
    expect(xml).toContain("<name>Alice</name>");
    expect(xml).toContain("<age>30</age>");
  });
  it("converts attributes from @-prefixed keys", () => {
    const xml = valueToXml({ "@id": "1", name: "Alice" }, "person", opts(), 0);
    expect(xml).toContain('id="1"');
  });
  it("converts #text to text content", () => {
    const xml = valueToXml({ "#text": "hello" }, "name", opts(), 0);
    expect(xml).toContain(">hello</name>");
  });
  it("handles null as xsi:nil", () => {
    const xml = valueToXml(null, "x", opts(), 0);
    expect(xml).toContain('xsi:nil="true"');
  });
});

describe("json2xml valueToXml (arrays)", () => {
  it("renders array as repeated items", () => {
    const xml = valueToXml({ items: [1, 2, 3] }, "root", opts(), 0);
    expect(xml).toContain("<item>1</item>");
    expect(xml).toContain("<item>2</item>");
    expect(xml).toContain("<item>3</item>");
  });
  it("uses custom array item name", () => {
    const xml = valueToXml({ items: ["a"] }, "root", opts({ arrayItemName: "entry" }), 0);
    expect(xml).toContain("<entry>a</entry>");
  });
});

describe("json2xml jsonToXml (full)", () => {
  it("converts simple JSON", () => {
    const r = jsonToXml('{"name":"Alice"}', opts());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.xml).toContain('<?xml version="1.0"');
      expect(r.xml).toContain("<root>");
      expect(r.xml).toContain("<name>Alice</name>");
    }
  });
  it("returns error for invalid JSON", () => {
    const r = jsonToXml("{bad", opts());
    expect(r.ok).toBe(false);
  });
  it("respects rootName", () => {
    const r = jsonToXml('{"a":1}', opts({ rootName: "data" }));
    if (r.ok) expect(r.xml).toContain("<data>");
  });
  it("respects prettyPrint off", () => {
    const r = jsonToXml('{"a":1}', opts({ prettyPrint: false }));
    if (r.ok) expect(r.xml).not.toContain("\n  ");
  });
  it("enforces depth limit", () => {
    const deep = { a: { b: { c: {} } } };
    const r = jsonToXml(JSON.stringify(deep), opts({ depthLimit: 2 }));
    expect(r.ok).toBe(false);
  });
  it("includes type info when enabled", () => {
    const r = jsonToXml('{"x":true}', opts({ includeTypeInfo: true }));
    if (r.ok) expect(r.xml).toContain('xsi:type="boolean"');
  });
});

describe("json2xml validateXml", () => {
  it("accepts well-formed XML", () => {
    expect(validateXml("<root><child>text</child></root>").ok).toBe(true);
  });
  it("accepts self-closing tags", () => {
    expect(validateXml('<root attr="1" />').ok).toBe(true);
  });
  it("rejects unclosed tag", () => {
    expect(validateXml("<root><child></root>").ok).toBe(false);
  });
  it("rejects mismatched close", () => {
    expect(validateXml("<root></other>").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateXml("").ok).toBe(false);
  });
  it("accepts CDATA", () => {
    expect(validateXml("<root><![CDATA[a < b]]></root>").ok).toBe(true);
  });
});

describe("json2xml parseXml", () => {
  it("parses simple XML", () => {
    const r = parseXml("<root><a>1</a></root>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.root.name).toBe("root");
      expect(r.root.children[0].name).toBe("a");
      expect(r.root.children[0].text).toBe("1");
    }
  });
  it("parses attributes", () => {
    const r = parseXml('<root id="1" name="x"/>');
    if (r.ok) {
      expect(r.root.attributes.id).toBe("1");
      expect(r.root.attributes.name).toBe("x");
    }
  });
  it("parses CDATA", () => {
    const r = parseXml("<root><![CDATA[a < b & c]]></root>");
    if (r.ok) expect(r.root.text).toBe("a < b & c");
  });
  it("rejects invalid XML", () => {
    const r = parseXml("<root><child></root>");
    expect(r.ok).toBe(false);
  });
});

describe("json2xml xmlNodeToJson", () => {
  it("converts simple element to object", () => {
    const r = parseXml("<root><a>1</a></root>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts()) as Record<string, unknown>;
      expect(json.a).toBe("1");
    }
  });
  it("converts attributes to @-prefixed keys", () => {
    const r = parseXml('<root id="1"/>');
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts()) as Record<string, unknown>;
      expect(json["@id"]).toBe("1");
    }
  });
  it("converts repeated children to array", () => {
    const r = parseXml("<root><item>1</item><item>2</item></root>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts()) as Record<string, unknown>;
      expect(json.item).toEqual(["1", "2"]);
    }
  });
});

describe("json2xml xmlToJson (full)", () => {
  it("round-trips simple JSON→XML→JSON", () => {
    const original = '{"name":"Alice","age":"30"}';
    const xmlR = jsonToXml(original, opts());
    if (!xmlR.ok) return;
    const jsonR = xmlToJson(xmlR.xml, opts());
    expect(jsonR.ok).toBe(true);
    if (jsonR.ok) {
      const round = JSON.parse(jsonR.json);
      expect(round.name).toBe("Alice");
      expect(round.age).toBe("30");
    }
  });
  it("returns error for invalid XML", () => {
    const r = xmlToJson("<bad>", opts());
    expect(r.ok).toBe(false);
  });
});

describe("json2xml history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ direction: "json2xml", rootName: "root", inputSize: 10, outputSize: 20, convertedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ direction: "json2xml", rootName: "root", inputSize: 10, outputSize: 20, convertedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("json2xml formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});
