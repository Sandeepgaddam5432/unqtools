import { describe, it, expect, beforeEach } from "vitest";
import {
  EVENT_PRESETS,
  validateEventName,
  validateParamName,
  validateEvent,
  formatParamValue,
  generatePushCode,
  generateInitCode,
  generateCustomEventTrigger,
  generateVariableDeclarations,
  generateFullSnippet,
  findPreset,
  countParams,
  generateJsonPreview,
  GTM_DOCS_URL,
  DATALAYER_DOCS_URL,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DataLayerEvent,
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

describe("gtm-datalayer-helper presets", () => {
  it("includes required presets", () => {
    const names = EVENT_PRESETS.map((p) => p.name);
    expect(names).toContain("page_view");
    expect(names).toContain("scroll");
    expect(names).toContain("click");
    expect(names).toContain("form_submit");
    expect(names).toContain("purchase");
  });
  it("each preset has description and example", () => {
    for (const p of EVENT_PRESETS) {
      expect(p.description).toBeTruthy();
      expect(p.example).toBeTruthy();
      expect(p.example.name).toBe(p.name);
      expect(p.recommendedParams.length).toBeGreaterThan(0);
    }
  });
  it("findPreset returns matching preset", () => {
    expect(findPreset("page_view")?.name).toBe("page_view");
    expect(findPreset("nonexistent")).toBeUndefined();
  });
});

describe("gtm-datalayer-helper validateEventName", () => {
  it("accepts valid names", () => {
    expect(validateEventName("page_view").valid).toBe(true);
    expect(validateEventName("purchase").valid).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateEventName("").valid).toBe(false);
  });
  it("rejects names starting with number", () => {
    expect(validateEventName("1event").valid).toBe(false);
  });
  it("rejects names with special chars", () => {
    expect(validateEventName("event-name").valid).toBe(false);
  });
  it("rejects names over 40 chars", () => {
    expect(validateEventName("a".repeat(41)).valid).toBe(false);
  });
});

describe("gtm-datalayer-helper validateParamName", () => {
  it("accepts valid param names", () => {
    expect(validateParamName("page_location").valid).toBe(true);
    expect(validateParamName("value").valid).toBe(true);
  });
  it("rejects invalid", () => {
    expect(validateParamName("").valid).toBe(false);
    expect(validateParamName("bad-name").valid).toBe(false);
  });
});

describe("gtm-datalayer-helper validateEvent", () => {
  it("accepts valid event", () => {
    const e: DataLayerEvent = { name: "purchase", params: { value: 99.99, currency: "USD" } };
    expect(validateEvent(e).valid).toBe(true);
  });
  it("errors on invalid name", () => {
    expect(validateEvent({ name: "", params: {} }).valid).toBe(false);
  });
  it("errors on invalid param name", () => {
    const e: DataLayerEvent = { name: "purchase", params: { "bad-name": "x" } };
    expect(validateEvent(e).valid).toBe(false);
  });
  it("warns on too many params", () => {
    const params: Record<string, string> = {};
    for (let i = 0; i < 30; i++) params[`param_${i}`] = `value${i}`;
    const e: DataLayerEvent = { name: "purchase", params };
    expect(validateEvent(e).warnings.some((w) => /25 parameters/.test(w))).toBe(true);
  });
});

describe("gtm-datalayer-helper formatParamValue", () => {
  it("formats strings as JSON literals", () => {
    expect(formatParamValue("hello")).toBe('"hello"');
  });
  it("formats numbers as-is", () => {
    expect(formatParamValue(42)).toBe("42");
  });
  it("formats booleans as-is", () => {
    expect(formatParamValue(true)).toBe("true");
  });
  it("returns undefined for undefined", () => {
    expect(formatParamValue(undefined)).toBe("undefined");
  });
  it("keeps JSON-looking strings as-is", () => {
    expect(formatParamValue('{"key":"value"}')).toBe('{"key":"value"}');
  });
});

describe("gtm-datalayer-helper generatePushCode", () => {
  it("generates simple event with no params", () => {
    const code = generatePushCode({ name: "page_view", params: {} });
    expect(code).toBe("dataLayer.push({ event: 'page_view' });");
  });
  it("generates event with params", () => {
    const code = generatePushCode({ name: "purchase", params: { value: 99.99, currency: "USD" } });
    expect(code).toContain("dataLayer.push({");
    expect(code).toContain("event: 'purchase'");
    expect(code).toContain("value: 99.99");
    expect(code).toContain('currency: "USD"');
  });
  it("throws on invalid event", () => {
    expect(() => generatePushCode({ name: "", params: {} })).toThrow();
  });
  it("skips empty param values", () => {
    const code = generatePushCode({ name: "purchase", params: { value: "", currency: "USD" } });
    expect(code).not.toContain("value:");
    expect(code).toContain("currency:");
  });
});

describe("gtm-datalayer-helper generateInitCode", () => {
  it("includes dataLayer init and gtm.js load", () => {
    const code = generateInitCode();
    expect(code).toContain("window.dataLayer");
    expect(code).toContain("googletagmanager.com/gtm.js");
    expect(code).toContain("GTM-XXXXXXX");
  });
});

describe("gtm-datalayer-helper generateCustomEventTrigger", () => {
  it("produces JSON trigger config", () => {
    const t = generateCustomEventTrigger({ name: "purchase", params: { value: 99.99 } });
    const parsed = JSON.parse(t);
    expect(parsed.type).toBe("CUSTOM_EVENT");
    expect(parsed.eventName).toBe("purchase");
    expect(parsed.triggerName).toContain("purchase");
  });
  it("throws on invalid event", () => {
    expect(() => generateCustomEventTrigger({ name: "1invalid", params: {} })).toThrow();
  });
});

describe("gtm-datalayer-helper generateVariableDeclarations", () => {
  it("generates variable docs for each param", () => {
    const decls = generateVariableDeclarations({ name: "purchase", params: { value: 99.99, currency: "USD" } });
    expect(decls).toContain("value");
    expect(decls).toContain("currency");
    expect(decls).toContain("Data Layer Variable Name");
  });
  it("returns placeholder for empty params", () => {
    const decls = generateVariableDeclarations({ name: "page_view", params: {} });
    expect(decls).toContain("No parameters");
  });
});

describe("gtm-datalayer-helper generateFullSnippet", () => {
  it("combines init + push", () => {
    const s = generateFullSnippet({ name: "purchase", params: { value: 99.99 } });
    expect(s).toContain("window.dataLayer");
    expect(s).toContain("dataLayer.push");
    expect(s).toContain("purchase");
  });
});

describe("gtm-datalayer-helper countParams", () => {
  it("counts non-empty params", () => {
    const e: DataLayerEvent = { name: "x", params: { a: "1", b: "", c: undefined, d: 0 } };
    expect(countParams(e)).toBe(2);
  });
  it("returns 0 for empty params", () => {
    expect(countParams({ name: "x", params: {} })).toBe(0);
  });
});

describe("gtm-datalayer-helper generateJsonPreview", () => {
  it("produces valid JSON with event + params", () => {
    const json = generateJsonPreview({ name: "purchase", params: { value: 99.99, currency: "USD" } });
    const parsed = JSON.parse(json);
    expect(parsed.event).toBe("purchase");
    expect(parsed.value).toBe(99.99);
    expect(parsed.currency).toBe("USD");
  });
  it("parses JSON-looking string params", () => {
    const json = generateJsonPreview({ name: "purchase", params: { items: '[{"item_id":"sku1"}]' } });
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.items)).toBe(true);
  });
  it("skips empty values", () => {
    const json = generateJsonPreview({ name: "x", params: { a: "1", b: "" } });
    const parsed = JSON.parse(json);
    expect(parsed.b).toBeUndefined();
  });
});

describe("gtm-datalayer-helper docs URLs", () => {
  it("has GTM docs URL", () => {
    expect(GTM_DOCS_URL).toContain("google.com");
  });
  it("has dataLayer docs URL", () => {
    expect(DATALAYER_DOCS_URL).toContain("google.com");
  });
});

describe("gtm-datalayer-helper history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, eventName: "purchase", paramCount: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, eventName: "x", paramCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, eventName: "x", paramCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("gtm-datalayer-helper shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ eventName: "purchase", paramsJson: '{"value":99.99}' });
    expect(url).toContain("event=purchase");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("event=purchase&params=%7B%22value%22%3A99.99%7D");
    expect(parsed.eventName).toBe("purchase");
    expect(parsed.paramsJson).toBe('{"value":99.99}');
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
