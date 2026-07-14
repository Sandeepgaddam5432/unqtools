import { describe, it, expect, beforeEach } from "vitest";
import {
  stripNamespace, normalizeName, escapeXmlText, escapeXmlAttribute, unescapeXml,
  validateXml, parseXml, coerceValue, xmlNodeToJson, xmlToJson,
  validateJson, sanitizeXmlName, maybeCdata, valueToXml, jsonToXml,
  loadHistory, saveToHistory, clearHistory, formatBytes,
  DEFAULT_OPTIONS, type ConvertOptions,
} from "./logic";

const opts = (overrides: Partial<ConvertOptions> = {}): ConvertOptions => ({ ...DEFAULT_OPTIONS, ...overrides });

describe("xml2json stripNamespace", () => {
  it("strips ns: prefix", () => { expect(stripNamespace("ns:foo")).toBe("foo"); });
  it("leaves bare name unchanged", () => { expect(stripNamespace("foo")).toBe("foo"); });
  it("handles names without prefix", () => { expect(stripNamespace("a-b-c")).toBe("a-b-c"); });
});

describe("xml2json normalizeName", () => {
  it("strips namespaces when enabled", () => {
    expect(normalizeName("ns:foo", opts({ ignoreNamespaces: true }))).toBe("foo");
  });
  it("keeps namespaces when disabled", () => {
    expect(normalizeName("ns:foo", opts({ ignoreNamespaces: false }))).toBe("ns:foo");
  });
});

describe("xml2xml escapeXmlText", () => {
  it("escapes &, <, >", () => {
    expect(escapeXmlText("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });
});

describe("xml2json escapeXmlAttribute", () => {
  it("escapes quotes", () => {
    expect(escapeXmlAttribute('"hi" \'there\'')).toBe("&quot;hi&quot; &apos;there&apos;");
  });
});

describe("xml2json unescapeXml", () => {
  it("unescapes standard entities", () => {
    expect(unescapeXml("a &amp; b &lt; c &gt; d")).toBe("a & b < c > d");
  });
  it("unescapes numeric entities", () => {
    expect(unescapeXml("&#65;")).toBe("A");
  });
  it("unescapes hex entities", () => {
    expect(unescapeXml("&#x41;")).toBe("A");
  });
  it("order — ampersand last so it doesn't double-unescape", () => {
    expect(unescapeXml("&amp;lt;")).toBe("&lt;");
  });
});

describe("xml2json validateXml", () => {
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
  it("accepts namespaced tags", () => {
    expect(validateXml("<ns:root xmlns:ns='http://x'><ns:child/></ns:root>").ok).toBe(true);
  });
});

describe("xml2json parseXml", () => {
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
  it("parses entities in text", () => {
    const r = parseXml("<root>a &amp; b</root>");
    if (r.ok) expect(r.root.text).toBe("a & b");
  });
  it("parses entities in attributes", () => {
    const r = parseXml('<root title="a &amp; b"/>');
    if (r.ok) expect(r.root.attributes.title).toBe("a & b");
  });
});

describe("xml2json coerceValue", () => {
  it("returns string as-is when disabled", () => {
    expect(coerceValue("123", opts({ coerceTypes: false }))).toBe("123");
  });
  it("coerces integer", () => {
    expect(coerceValue("123", opts({ coerceTypes: true }))).toBe(123);
  });
  it("coerces boolean true", () => {
    expect(coerceValue("true", opts({ coerceTypes: true }))).toBe(true);
  });
  it("coerces boolean false", () => {
    expect(coerceValue("false", opts({ coerceTypes: true }))).toBe(false);
  });
  it("coerces null", () => {
    expect(coerceValue("null", opts({ coerceTypes: true }))).toBe(null);
  });
  it("coerces float", () => {
    expect(coerceValue("3.14", opts({ coerceTypes: true }))).toBe(3.14);
  });
  it("leaves non-numeric strings", () => {
    expect(coerceValue("hello", opts({ coerceTypes: true }))).toBe("hello");
  });
});

describe("xml2json xmlNodeToJson", () => {
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
  it("handles text + attributes", () => {
    const r = parseXml('<root id="1">hello</root>');
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts()) as Record<string, unknown>;
      expect(json["@id"]).toBe("1");
      expect(json["#text"]).toBe("hello");
    }
  });
  it("collapses empty element to null when collapseEmpty=null", () => {
    const r = parseXml("<root><a/></root>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ collapseEmpty: "null" })) as Record<string, unknown>;
      expect(json.a).toBeNull();
    }
  });
  it("collapses empty element to empty string when collapseEmpty=empty", () => {
    const r = parseXml("<root><a/></root>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ collapseEmpty: "empty" })) as Record<string, unknown>;
      expect(json.a).toBe("");
    }
  });
  it("strips namespaces when enabled", () => {
    const r = parseXml("<ns:root xmlns:ns='http://x'><ns:child>1</ns:child></ns:root>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ ignoreNamespaces: true })) as Record<string, unknown>;
      expect(json.child).toBe("1");
    }
  });
  it("keeps namespaces when disabled", () => {
    const r = parseXml("<ns:root xmlns:ns='http://x'><ns:child>1</ns:child></ns:root>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ ignoreNamespaces: false })) as Record<string, unknown>;
      expect(json["ns:child"]).toBe("1");
    }
  });
  it("respects custom attribute prefix", () => {
    const r = parseXml('<root id="1"/>');
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ attributePrefix: "$" })) as Record<string, unknown>;
      expect(json.$id).toBe("1");
    }
  });
  it("respects custom text key", () => {
    const r = parseXml('<root id="1">hello</root>');
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ textKey: "_value" })) as Record<string, unknown>;
      expect(json._value).toBe("hello");
    }
  });
  it("preserves xmlns when preserveDeclarations=true", () => {
    const r = parseXml("<root xmlns='http://x' id='1'/>");
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ preserveDeclarations: true })) as Record<string, unknown>;
      expect(json["@xmlns"]).toBe("http://x");
    }
  });
  it("ignores attributes when ignoreAttributes=true", () => {
    const r = parseXml('<root id="1"><a>1</a></root>');
    if (r.ok) {
      const json = xmlNodeToJson(r.root, opts({ ignoreAttributes: true })) as Record<string, unknown>;
      expect(json["@id"]).toBeUndefined();
    }
  });
  it("trims whitespace by default", () => {
    const r = parseXml("<root>  hello  </root>");
    if (r.ok) {
      const v = xmlNodeToJson(r.root, opts());
      expect(v).toBe("hello");
    }
  });
});

describe("xml2json xmlToJson (full)", () => {
  it("converts simple XML to JSON object", () => {
    const r = xmlToJson("<root><name>Alice</name></root>", opts());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parsed = JSON.parse(r.json);
      expect(parsed.root.name).toBe("Alice");
    }
  });
  it("detects arrays from repeated elements", () => {
    const r = xmlToJson("<root><item>1</item><item>2</item></root>", opts());
    if (r.ok) {
      const parsed = JSON.parse(r.json);
      expect(parsed.root.item).toEqual(["1", "2"]);
    }
  });
  it("returns error for invalid XML", () => {
    const r = xmlToJson("<bad>", opts());
    expect(r.ok).toBe(false);
  });
  it("respects indent", () => {
    const r = xmlToJson("<root><a>1</a></root>", opts({ prettyPrint: true, indent: 4 }));
    if (r.ok) expect(r.json).toContain("\n    ");
  });
  it("respects prettyPrint off", () => {
    const r = xmlToJson("<root><a>1</a></root>", opts({ prettyPrint: false }));
    if (r.ok) expect(r.json).not.toContain("\n");
  });
  it("coerces types when enabled", () => {
    const r = xmlToJson("<root><age>30</age></root>", opts({ coerceTypes: true }));
    if (r.ok) {
      const parsed = JSON.parse(r.json);
      expect(parsed.root.age).toBe(30);
    }
  });
  it("round-trips XML→JSON→XML", () => {
    const xmlR = xmlToJson("<root><a>1</a><b>2</b></root>", opts());
    if (!xmlR.ok) return;
    const reverseR = jsonToXml(xmlR.json, opts());
    expect(reverseR.ok).toBe(true);
    if (reverseR.ok) {
      expect(reverseR.xml).toContain("<a>1</a>");
      expect(reverseR.xml).toContain("<b>2</b>");
    }
  });
});

describe("xml2json reverse jsonToXml", () => {
  it("converts simple JSON to XML", () => {
    const r = jsonToXml('{"root":{"name":"Alice"}}', opts());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.xml).toContain("<?xml");
      expect(r.xml).toContain("<root>");
      expect(r.xml).toContain("<name>Alice</name>");
    }
  });
  it("returns error for invalid JSON", () => {
    const r = jsonToXml("{bad", opts());
    expect(r.ok).toBe(false);
  });
  it("converts attributes from @-prefixed keys", () => {
    const r = jsonToXml('{"root":{"@id":"1","name":"Alice"}}', opts());
    if (r.ok) expect(r.xml).toContain('id="1"');
  });
});

describe("xml2json sanitizeXmlName", () => {
  it("leaves valid names unchanged", () => { expect(sanitizeXmlName("root")).toBe("root"); });
  it("fixes invalid start char", () => { expect(sanitizeXmlName("1abc")).toBe("_abc"); });
  it("replaces invalid chars", () => { expect(sanitizeXmlName("a b c")).toBe("a_b_c"); });
  it("empty → underscore", () => { expect(sanitizeXmlName("")).toBe("_"); });
});

describe("xml2json maybeCdata", () => {
  it("returns escaped text for simple strings", () => {
    expect(maybeCdata("hello")).toBe("hello");
  });
  it("wraps in CDATA when special chars present", () => {
    expect(maybeCdata("a < b & c")).toBe("<![CDATA[a < b & c]]>");
  });
});

describe("xml2json validateJson", () => {
  it("parses valid JSON", () => {
    const r = validateJson('{"a":1}');
    expect(r.ok).toBe(true);
  });
  it("rejects invalid JSON", () => {
    const r = validateJson("{a:1}");
    expect(r.ok).toBe(false);
  });
});

describe("xml2json history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (_i: number) => null,
      length: 0,
    } as Storage;
  });
  it("saves and loads", () => {
    saveToHistory({ direction: "xml2json", attributePrefix: "@", textKey: "#text", inputSize: 10, outputSize: 20, convertedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ direction: "xml2json", attributePrefix: "@", textKey: "#text", inputSize: 10, outputSize: 20, convertedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("xml2json formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});
