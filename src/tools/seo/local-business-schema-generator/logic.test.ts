import { describe, it, expect, beforeEach } from "vitest";
import {
  BUSINESS_TYPES,
  DAYS,
  isValidUrl,
  isValidEmail,
  isValidTime,
  isValidGeoLat,
  isValidGeoLng,
  validate,
  buildJsonLd,
  buildScriptTag,
  generate,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  defaultHours,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";
import type { BusinessInput, BusinessType } from "./logic";

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

function makeValidInput(overrides: Partial<BusinessInput> = {}): BusinessInput {
  return {
    type: "Restaurant",
    name: "Test Cafe",
    description: "A test cafe",
    url: "https://example.com",
    image: "https://example.com/logo.png",
    telephone: "+1-555-123-4567",
    email: "info@example.com",
    streetAddress: "123 Main St",
    addressLocality: "Springfield",
    addressRegion: "IL",
    postalCode: "62701",
    addressCountry: "US",
    geoLat: "39.78",
    geoLng: "-89.65",
    priceRange: "$$",
    ratingValue: "4.5",
    reviewCount: "120",
    areaServed: "Springfield, IL",
    hours: defaultHours().map((h, i) => (i < 5 ? { ...h, open: "09:00", close: "17:00" } : h)),
    ...overrides,
  };
}

describe("local-business-schema-generator constants", () => {
  it("has multiple business types", () => {
    expect(BUSINESS_TYPES.length).toBeGreaterThan(10);
    expect(BUSINESS_TYPES).toContain("Restaurant");
    expect(BUSINESS_TYPES).toContain("Store");
    expect(BUSINESS_TYPES).toContain("Hotel");
  });
  it("has 7 days", () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS[0]).toBe("Monday");
    expect(DAYS[6]).toBe("Sunday");
  });
});

describe("local-business-schema-generator validators", () => {
  it("isValidUrl — valid http", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });
  it("isValidUrl — invalid", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidEmail — valid", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
  });
  it("isValidEmail — invalid", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
  it("isValidTime — valid HH:MM", () => {
    expect(isValidTime("09:30")).toBe(true);
  });
  it("isValidTime — invalid", () => {
    expect(isValidTime("25:00")).toBe(false);
    expect(isValidTime("09:60")).toBe(false);
    expect(isValidTime("nine")).toBe(false);
  });
  it("isValidGeoLat — boundary", () => {
    expect(isValidGeoLat("90")).toBe(true);
    expect(isValidGeoLat("90.1")).toBe(false);
    expect(isValidGeoLat("-90")).toBe(true);
  });
  it("isValidGeoLng — boundary", () => {
    expect(isValidGeoLng("180")).toBe(true);
    expect(isValidGeoLng("180.1")).toBe(false);
    expect(isValidGeoLng("-180")).toBe(true);
  });
});

describe("local-business-schema-generator defaultHours", () => {
  it("returns 7 days with empty times", () => {
    const h = defaultHours();
    expect(h).toHaveLength(7);
    expect(h.every((x) => x.open === "" && x.close === "")).toBe(true);
    expect(h[0].day).toBe("Monday");
  });
});

describe("local-business-schema-generator validate", () => {
  it("passes for valid input", () => {
    const v = validate(makeValidInput());
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });
  it("requires name", () => {
    const v = validate(makeValidInput({ name: "" }));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("name"))).toBe(true);
  });
  it("requires street address", () => {
    const v = validate(makeValidInput({ streetAddress: "" }));
    expect(v.ok).toBe(false);
  });
  it("requires city", () => {
    const v = validate(makeValidInput({ addressLocality: "" }));
    expect(v.ok).toBe(false);
  });
  it("requires country", () => {
    const v = validate(makeValidInput({ addressCountry: "" }));
    expect(v.ok).toBe(false);
  });
  it("invalid URL fails", () => {
    const v = validate(makeValidInput({ url: "not a url" }));
    expect(v.ok).toBe(false);
  });
  it("invalid email fails", () => {
    const v = validate(makeValidInput({ email: "nope" }));
    expect(v.ok).toBe(false);
  });
  it("invalid lat fails", () => {
    const v = validate(makeValidInput({ geoLat: "999" }));
    expect(v.ok).toBe(false);
  });
  it("invalid rating fails", () => {
    const v = validate(makeValidInput({ ratingValue: "10" }));
    expect(v.ok).toBe(false);
  });
  it("missing close time on a day with open fails", () => {
    const hours = defaultHours();
    hours[0] = { day: "Monday", open: "09:00", close: "" };
    const v = validate(makeValidInput({ hours }));
    expect(v.ok).toBe(false);
  });
  it("warns about missing recommended fields", () => {
    const v = validate(makeValidInput({ telephone: "", image: "", priceRange: "", geoLat: "", geoLng: "" }));
    expect(v.warnings.length).toBeGreaterThan(0);
  });
});

describe("local-business-schema-generator buildJsonLd", () => {
  it("builds object with @context and @type", () => {
    const o = buildJsonLd(makeValidInput());
    expect(o["@context"]).toBe("https://schema.org");
    expect(o["@type"]).toBe("Restaurant");
    expect(o.name).toBe("Test Cafe");
  });
  it("includes PostalAddress", () => {
    const o = buildJsonLd(makeValidInput());
    const addr = o.address as Record<string, unknown>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.streetAddress).toBe("123 Main St");
  });
  it("includes geo coordinates", () => {
    const o = buildJsonLd(makeValidInput());
    const geo = o.geo as Record<string, unknown>;
    expect(geo["@type"]).toBe("GeoCoordinates");
    expect(geo.latitude).toBeCloseTo(39.78);
  });
  it("includes aggregateRating", () => {
    const o = buildJsonLd(makeValidInput());
    const r = o.aggregateRating as Record<string, unknown>;
    expect(r["@type"]).toBe("AggregateRating");
    expect(r.ratingValue).toBe(4.5);
  });
  it("includes openingHoursSpecification", () => {
    const o = buildJsonLd(makeValidInput());
    const arr = o.openingHoursSpecification as Array<Record<string, unknown>>;
    expect(arr.length).toBe(5); // Mon-Fri
    expect(arr[0].dayOfWeek).toBe("Monday");
  });
  it("omits hours when none provided", () => {
    const o = buildJsonLd(makeValidInput({ hours: defaultHours() }));
    expect(o.openingHoursSpecification).toBeUndefined();
  });
  it("uses selected business type", () => {
    const o = buildJsonLd(makeValidInput({ type: "Hotel" }));
    expect(o["@type"]).toBe("Hotel");
  });
  it("throws on invalid input", () => {
    expect(() => buildJsonLd(makeValidInput({ name: "" }))).toThrow();
  });
});

describe("local-business-schema-generator buildScriptTag", () => {
  it("wraps JSON in script tag", () => {
    const tag = buildScriptTag({ "@context": "https://schema.org", "@type": "Restaurant" });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });
});

describe("local-business-schema-generator generate", () => {
  it("returns full script tag", () => {
    const out = generate(makeValidInput());
    expect(out).toContain("application/ld+json");
    expect(out).toContain("Test Cafe");
  });
});

describe("local-business-schema-generator links", () => {
  it("builds Google Rich Results link", () => {
    expect(buildGoogleRichResultsLink()).toContain("search.google.com/test/rich-results");
  });
  it("builds Schema.org docs link", () => {
    expect(buildSchemaDocsLink("Restaurant")).toBe("https://schema.org/Restaurant");
  });
});

describe("local-business-schema-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "Restaurant", name: "Cafe", city: "Springfield" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "Restaurant", name: "X", city: "Y" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "Restaurant", name: "X", city: "Y" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("local-business-schema-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ name: "Cafe", type: "Restaurant" });
    expect(url).toContain("name=Cafe");
    expect(url).toContain("type=Restaurant");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("encodes hours compactly", () => {
    const hours = defaultHours();
    hours[0] = { day: "Monday", open: "09:00", close: "17:00" };
    const url = buildShareUrl({ name: "Cafe", hours });
    expect(url).toContain("hours=");
    expect(url).toContain("Monday");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("name=Cafe&type=Restaurant&hours=Monday%3D09%3A00%7C17%3A00");
    expect(p.name).toBe("Cafe");
    expect(p.type).toBe("Restaurant");
    expect(p.hours).toBeDefined();
    const hours = p.hours!;
    const monday = hours.find((h) => h.day === "Monday");
    expect(monday?.open).toBe("09:00");
    expect(monday?.close).toBe("17:00");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ name: "", type: "Restaurant" });
    expect(url).not.toContain("name=");
  });
});
