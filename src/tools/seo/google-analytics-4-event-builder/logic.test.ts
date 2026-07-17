import { describe, it, expect, beforeEach } from "vitest";
import {
  EVENT_PRESETS,
  validateEventName,
  validateParamName,
  validateEvent,
  formatParamValue,
  generateGtagCode,
  generateDataLayerCode,
  generateMeasurementProtocolPayload,
  buildMeasurementProtocolUrl,
  findPreset,
  countParams,
  GA4_EVENT_DOCS_URL,
  GA4_MEASUREMENT_PROTOCOL_DOCS_URL,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Ga4Event,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("ga4-event-builder presets", () => {
  it("includes required presets", () => {
    const names = EVENT_PRESETS.map((p) => p.name);
    expect(names).toContain("page_view");
    expect(names).toContain("scroll");
    expect(names).toContain("click");
    expect(names).toContain("form_start");
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

describe("ga4-event-builder validateEventName", () => {
  it("accepts valid names", () => {
    expect(validateEventName("page_view").valid).toBe(true);
    expect(validateEventName("purchase").valid).toBe(true);
    expect(validateEventName("custom_event_1").valid).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateEventName("").valid).toBe(false);
    expect(validateEventName("  ").valid).toBe(false);
  });
  it("rejects names starting with number", () => {
    expect(validateEventName("1event").valid).toBe(false);
  });
  it("rejects names with special characters", () => {
    expect(validateEventName("event-name").valid).toBe(false);
    expect(validateEventName("event.name").valid).toBe(false);
  });
  it("rejects names over 40 chars", () => {
    expect(validateEventName("a".repeat(41)).valid).toBe(false);
  });
  it("accepts name of exactly 40 chars", () => {
    expect(validateEventName("a".repeat(40)).valid).toBe(true);
  });
});

describe("ga4-event-builder validateParamName", () => {
  it("accepts valid param names", () => {
    expect(validateParamName("page_location").valid).toBe(true);
    expect(validateParamName("value").valid).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateParamName("").valid).toBe(false);
  });
  it("rejects invalid chars", () => {
    expect(validateParamName("page-location").valid).toBe(false);
  });
  it("rejects names over 40 chars", () => {
    expect(validateParamName("a".repeat(41)).valid).toBe(false);
  });
});

describe("ga4-event-builder validateEvent", () => {
  it("accepts valid event", () => {
    const e: Ga4Event = { name: "purchase", params: { value: 99.99, currency: "USD" } };
    const v = validateEvent(e);
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("errors on invalid event name", () => {
    const e: Ga4Event = { name: "", params: {} };
    expect(validateEvent(e).valid).toBe(false);
  });
  it("errors on invalid param name", () => {
    const e: Ga4Event = { name: "purchase", params: { "bad-name": "x" } };
    const v = validateEvent(e);
    expect(v.valid).toBe(false);
  });
  it("warns on too many params", () => {
    const params: Record<string, string> = {};
    for (let i = 0; i < 30; i++) params[`param_${i}`] = `value${i}`;
    const e: Ga4Event = { name: "purchase", params };
    const v = validateEvent(e);
    expect(v.warnings.some((w) => /25 parameters/.test(w))).toBe(true);
  });
  it("ignores empty param values", () => {
    const e: Ga4Event = { name: "purchase", params: { value: "", currency: "USD" } };
    const v = validateEvent(e);
    expect(v.valid).toBe(true);
  });
});

describe("ga4-event-builder formatParamValue", () => {
  it("formats strings as JSON literals", () => {
    expect(formatParamValue("hello")).toBe('"hello"');
  });
  it("formats numbers as-is", () => {
    expect(formatParamValue(42)).toBe("42");
    expect(formatParamValue(99.99)).toBe("99.99");
  });
  it("formats booleans as-is", () => {
    expect(formatParamValue(true)).toBe("true");
    expect(formatParamValue(false)).toBe("false");
  });
  it("returns undefined for undefined", () => {
    expect(formatParamValue(undefined)).toBe("undefined");
  });
  it("keeps JSON-looking strings as-is", () => {
    expect(formatParamValue('{"key":"value"}')).toBe('{"key":"value"}');
    expect(formatParamValue('[1,2,3]')).toBe('[1,2,3]');
  });
});

describe("ga4-event-builder generateGtagCode", () => {
  it("generates simple event with no params", () => {
    const code = generateGtagCode({ name: "page_view", params: {} });
    expect(code).toBe("gtag('event', 'page_view');");
  });
  it("generates event with params", () => {
    const code = generateGtagCode({ name: "purchase", params: { value: 99.99, currency: "USD" } });
    expect(code).toContain("gtag('event', 'purchase', {");
    expect(code).toContain("value: 99.99");
    expect(code).toContain("currency: \"USD\"");
  });
  it("throws on invalid event name", () => {
    expect(() => generateGtagCode({ name: "", params: {} })).toThrow();
  });
  it("skips empty param values", () => {
    const code = generateGtagCode({ name: "purchase", params: { value: "", currency: "USD" } });
    expect(code).not.toContain("value:");
    expect(code).toContain("currency: \"USD\"");
  });
});

describe("ga4-event-builder generateDataLayerCode", () => {
  it("generates simple event with no params", () => {
    const code = generateDataLayerCode({ name: "page_view", params: {} });
    expect(code).toBe("dataLayer.push({ event: 'page_view' });");
  });
  it("generates event with params", () => {
    const code = generateDataLayerCode({ name: "purchase", params: { value: 99.99, currency: "USD" } });
    expect(code).toContain("dataLayer.push({");
    expect(code).toContain("event: 'purchase'");
    expect(code).toContain("value: 99.99");
  });
  it("throws on invalid event", () => {
    expect(() => generateDataLayerCode({ name: "1invalid", params: {} })).toThrow();
  });
});

describe("ga4-event-builder generateMeasurementProtocolPayload", () => {
  it("generates JSON payload", () => {
    const payload = generateMeasurementProtocolPayload(
      { name: "purchase", params: { value: 99.99, currency: "USD" } },
      { clientId: "abc.123", apiSecret: "secret" },
    );
    const parsed = JSON.parse(payload);
    expect(parsed.client_id).toBe("abc.123");
    expect(parsed.events[0].name).toBe("purchase");
    expect(parsed.events[0].params.value).toBe(99.99);
    expect(parsed.events[0].params.currency).toBe("USD");
  });
  it("includes timestamp_micros when provided", () => {
    const payload = generateMeasurementProtocolPayload(
      { name: "page_view", params: {} },
      { clientId: "abc", apiSecret: "secret", timestampMicros: 1234567890000 },
    );
    const parsed = JSON.parse(payload);
    expect(parsed.events[0].params.timestamp_micros).toBe(1234567890000);
  });
  it("parses JSON-looking string params into objects", () => {
    const payload = generateMeasurementProtocolPayload(
      { name: "purchase", params: { items: '[{"item_id":"sku1"}]' } },
      { clientId: "abc", apiSecret: "secret" },
    );
    const parsed = JSON.parse(payload);
    expect(Array.isArray(parsed.events[0].params.items)).toBe(true);
    expect(parsed.events[0].params.items[0].item_id).toBe("sku1");
  });
  it("converts numeric strings to numbers", () => {
    const payload = generateMeasurementProtocolPayload(
      { name: "purchase", params: { value: "99.99" } },
      { clientId: "abc", apiSecret: "secret" },
    );
    const parsed = JSON.parse(payload);
    expect(parsed.events[0].params.value).toBe(99.99);
  });
  it("throws on invalid event", () => {
    expect(() => generateMeasurementProtocolPayload(
      { name: "", params: {} },
      { clientId: "abc", apiSecret: "secret" },
    )).toThrow();
  });
});

describe("ga4-event-builder buildMeasurementProtocolUrl", () => {
  it("builds the MP collect endpoint", () => {
    const url = buildMeasurementProtocolUrl("my_secret", "G-XXXXXXX");
    expect(url).toContain("google-analytics.com/mp/collect");
    expect(url).toContain("measurement_id=G-XXXXXXX");
    expect(url).toContain("api_secret=my_secret");
  });
});

describe("ga4-event-builder countParams", () => {
  it("counts non-empty params", () => {
    const e: Ga4Event = { name: "x", params: { a: "1", b: "", c: undefined, d: 0 } };
    expect(countParams(e)).toBe(2); // a and d (0 is a valid value)
  });
  it("returns 0 for empty params", () => {
    expect(countParams({ name: "x", params: {} })).toBe(0);
  });
});

describe("ga4-event-builder docs URLs", () => {
  it("has GA4 events docs URL", () => {
    expect(GA4_EVENT_DOCS_URL).toContain("google.com");
  });
  it("has MP docs URL", () => {
    expect(GA4_MEASUREMENT_PROTOCOL_DOCS_URL).toContain("google.com");
  });
});

describe("ga4-event-builder history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, eventName: "purchase", paramCount: 3 });
    saveHistory({ ts: 2, eventName: "page_view", paramCount: 1 });
    expect(loadHistory()).toHaveLength(2);
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

describe("ga4-event-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      eventName: "purchase",
      paramsJson: '{"value":99.99}',
      clientId: "abc",
      apiSecret: "secret",
      measurementId: "G-XXX",
    });
    expect(url).toContain("event=purchase");
    expect(url).toContain("clientId=abc");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("event=purchase&params=%7B%22value%22%3A99.99%7D&clientId=abc");
    expect(parsed.eventName).toBe("purchase");
    expect(parsed.paramsJson).toBe('{"value":99.99}');
    expect(parsed.clientId).toBe("abc");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty optional fields", () => {
    const url = buildShareUrl({
      eventName: "x",
      paramsJson: "{}",
      clientId: "",
      apiSecret: "",
      measurementId: "",
    });
    expect(url).not.toContain("clientId=");
    expect(url).not.toContain("apiSecret=");
  });
});
