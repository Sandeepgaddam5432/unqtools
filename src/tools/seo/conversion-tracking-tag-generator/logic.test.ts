import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_INFO,
  validateConfig,
  escapeHtml,
  generateGoogleAdsBaseTag,
  generateGoogleAdsEventTag,
  generateFacebookPixelBase,
  generateFacebookPixelEvent,
  generateLinkedInInsightTag,
  generateLinkedInEventTag,
  generateTwitterPixelBase,
  generateTwitterPixelEvent,
  generateFullSnippet,
  getSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TrackingConfig,
  type Platform,
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

describe("conversion-tracking-tag-generator PLATFORM_INFO", () => {
  it("has 4 platforms", () => {
    expect(PLATFORM_INFO).toHaveLength(4);
    const ids = PLATFORM_INFO.map((p) => p.id);
    expect(ids).toContain("google-ads");
    expect(ids).toContain("facebook-pixel");
    expect(ids).toContain("linkedin-insight");
    expect(ids).toContain("twitter-pixel");
  });
  it("each platform has docs URL", () => {
    for (const p of PLATFORM_INFO) {
      expect(p.docsUrl).toMatch(/^https?:\/\//);
      expect(p.requiredFields.length).toBeGreaterThan(0);
    }
  });
});

describe("conversion-tracking-tag-generator validateConfig", () => {
  it("validates Google Ads config", () => {
    const v = validateConfig({
      platform: "google-ads",
      conversionId: "AW-123456789",
      conversionLabel: "abcDEFghi",
    });
    expect(v.ok).toBe(true);
  });
  it("errors when Google Ads conversionId missing", () => {
    const v = validateConfig({ platform: "google-ads", conversionLabel: "x" });
    expect(v.ok).toBe(false);
  });
  it("validates Facebook Pixel config", () => {
    const v = validateConfig({ platform: "facebook-pixel", pixelId: "123456789012345" });
    expect(v.ok).toBe(true);
  });
  it("errors when Facebook pixelId missing", () => {
    const v = validateConfig({ platform: "facebook-pixel" });
    expect(v.ok).toBe(false);
  });
  it("validates LinkedIn config", () => {
    const v = validateConfig({ platform: "linkedin-insight", partnerId: "1234567" });
    expect(v.ok).toBe(true);
  });
  it("errors when LinkedIn partnerId missing", () => {
    const v = validateConfig({ platform: "linkedin-insight" });
    expect(v.ok).toBe(false);
  });
  it("validates Twitter config", () => {
    const v = validateConfig({ platform: "twitter-pixel", pixelId: "abc12" });
    expect(v.ok).toBe(true);
  });
  it("errors when Twitter pixelId missing", () => {
    const v = validateConfig({ platform: "twitter-pixel" });
    expect(v.ok).toBe(false);
  });
  it("warns on unusual Google Ads ID format", () => {
    const v = validateConfig({
      platform: "google-ads",
      conversionId: "weird-id",
      conversionLabel: "x",
    });
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it("warns on unusual Facebook pixel ID", () => {
    const v = validateConfig({ platform: "facebook-pixel", pixelId: "abc" });
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it("errors on unknown platform", () => {
    const v = validateConfig({ platform: "unknown" as Platform });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("Unknown platform");
  });
});

describe("conversion-tracking-tag-generator escapeHtml", () => {
  it("escapes HTML special chars", () => {
    expect(escapeHtml('<script>"x" & \'y\'</script>')).toBe(
      "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });
  it("returns empty for empty", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("conversion-tracking-tag-generator Google Ads", () => {
  const config: TrackingConfig = {
    platform: "google-ads",
    conversionId: "AW-123456789",
    conversionLabel: "abcDEFghi",
    conversionValue: 99.99,
    currency: "USD",
    transactionId: "T-12345",
  };
  it("generates base tag with conversion ID", () => {
    const tag = generateGoogleAdsBaseTag(config);
    expect(tag).toContain("googletagmanager.com/gtag/js");
    expect(tag).toContain("AW-123456789");
  });
  it("generates event tag with send_to", () => {
    const tag = generateGoogleAdsEventTag(config);
    expect(tag).toContain("gtag('event', 'conversion'");
    expect(tag).toContain("'send_to': 'AW-123456789/abcDEFghi'");
  });
  it("includes value and currency in event tag", () => {
    const tag = generateGoogleAdsEventTag(config);
    expect(tag).toContain("'value': 99.99");
    expect(tag).toContain("'currency': 'USD'");
  });
  it("includes transaction_id when provided", () => {
    const tag = generateGoogleAdsEventTag(config);
    expect(tag).toContain("'transaction_id': 'T-12345'");
  });
  it("omits value when not provided", () => {
    const tag = generateGoogleAdsEventTag({ ...config, conversionValue: undefined });
    expect(tag).not.toContain("'value'");
  });
  it("throws on invalid config", () => {
    expect(() => generateGoogleAdsBaseTag({ platform: "google-ads" })).toThrow();
  });
});

describe("conversion-tracking-tag-generator Facebook Pixel", () => {
  const config: TrackingConfig = {
    platform: "facebook-pixel",
    pixelId: "123456789012345",
    eventName: "Purchase",
    eventValue: 50,
    eventCurrency: "USD",
  };
  it("generates base code with pixel ID", () => {
    const tag = generateFacebookPixelBase(config);
    expect(tag).toContain("connect.facebook.net");
    expect(tag).toContain("fbq('init', '123456789012345')");
    expect(tag).toContain("fbq('track', 'PageView')");
  });
  it("includes noscript fallback", () => {
    const tag = generateFacebookPixelBase(config);
    expect(tag).toContain("<noscript>");
    expect(tag).toContain("facebook.com/tr?id=123456789012345");
  });
  it("generates event code with name and value", () => {
    const tag = generateFacebookPixelEvent(config);
    expect(tag).toContain("fbq('track', 'Purchase'");
    expect(tag).toContain("value: 50");
    expect(tag).toContain("currency: 'USD'");
  });
  it("omits value params when not provided", () => {
    const tag = generateFacebookPixelEvent({ ...config, eventValue: undefined });
    expect(tag).not.toContain("value:");
  });
  it("throws on invalid config", () => {
    expect(() => generateFacebookPixelBase({ platform: "facebook-pixel" })).toThrow();
  });
});

describe("conversion-tracking-tag-generator LinkedIn Insight", () => {
  const config: TrackingConfig = {
    platform: "linkedin-insight",
    partnerId: "1234567",
    eventName: "signup",
  };
  it("generates base tag with partner ID", () => {
    const tag = generateLinkedInInsightTag(config);
    expect(tag).toContain("_linkedin_partner_id");
    expect(tag).toContain('"1234567"');
    expect(tag).toContain("snap.licdn.com");
  });
  it("includes noscript fallback", () => {
    const tag = generateLinkedInInsightTag(config);
    expect(tag).toContain("<noscript>");
    expect(tag).toContain("px.ads.linkedin.com/collect");
  });
  it("generates event tag", () => {
    const tag = generateLinkedInEventTag(config);
    expect(tag).toContain("window.lintrk");
    expect(tag).toContain("track");
  });
  it("throws on invalid config", () => {
    expect(() => generateLinkedInInsightTag({ platform: "linkedin-insight" })).toThrow();
  });
});

describe("conversion-tracking-tag-generator Twitter Pixel", () => {
  const config: TrackingConfig = {
    platform: "twitter-pixel",
    pixelId: "abc12",
    eventName: "Purchase",
    eventValue: 100,
    eventCurrency: "USD",
  };
  it("generates base code with pixel ID", () => {
    const tag = generateTwitterPixelBase(config);
    expect(tag).toContain("static.ads-twitter.com");
    expect(tag).toContain("twq('init','abc12')");
    expect(tag).toContain("twq('track','PageView')");
  });
  it("generates event code", () => {
    const tag = generateTwitterPixelEvent(config);
    expect(tag).toContain("twq('track', 'Purchase'");
    expect(tag).toContain("value: '100'");
  });
  it("omits value when not provided", () => {
    const tag = generateTwitterPixelEvent({ ...config, eventValue: undefined });
    expect(tag).not.toContain("value:");
  });
  it("throws on invalid config", () => {
    expect(() => generateTwitterPixelBase({ platform: "twitter-pixel" })).toThrow();
  });
});

describe("conversion-tracking-tag-generator generateFullSnippet", () => {
  it("combines base + event for Google Ads", () => {
    const config: TrackingConfig = {
      platform: "google-ads",
      conversionId: "AW-123",
      conversionLabel: "abc",
    };
    const snippet = generateFullSnippet(config);
    expect(snippet).toContain("googletagmanager.com");
    expect(snippet).toContain("gtag('event', 'conversion'");
  });
  it("combines base + event for Facebook", () => {
    const config: TrackingConfig = {
      platform: "facebook-pixel",
      pixelId: "12345",
    };
    const snippet = generateFullSnippet(config);
    expect(snippet).toContain("fbq('init', '12345')");
  });
  it("throws on invalid config", () => {
    expect(() => generateFullSnippet({ platform: "google-ads" })).toThrow();
  });
});

describe("conversion-tracking-tag-generator getSnippet", () => {
  it("returns base for Google Ads", () => {
    const config: TrackingConfig = {
      platform: "google-ads",
      conversionId: "AW-123",
      conversionLabel: "abc",
    };
    const s = getSnippet(config, "base");
    expect(s).toContain("googletagmanager.com");
  });
  it("returns event for Facebook", () => {
    const config: TrackingConfig = {
      platform: "facebook-pixel",
      pixelId: "12345",
      eventName: "Lead",
    };
    const s = getSnippet(config, "event");
    expect(s).toContain("fbq('track'");
  });
});

describe("conversion-tracking-tag-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, platform: "google-ads", snippetLength: 500 });
    saveHistory({ ts: 2, platform: "facebook-pixel", snippetLength: 800 });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, platform: "google-ads", snippetLength: 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, platform: "google-ads", snippetLength: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("conversion-tracking-tag-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      config: {
        platform: "google-ads",
        conversionId: "AW-123",
        conversionLabel: "abc",
      },
    });
    expect(url).toContain("platform=google-ads");
    expect(url).toContain("conversionId=AW-123");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("platform=google-ads&conversionId=AW-123&conversionLabel=abc");
    expect(parsed.platform).toBe("google-ads");
    expect(parsed.conversionId).toBe("AW-123");
    expect(parsed.conversionLabel).toBe("abc");
  });
  it("parses numeric values as numbers", () => {
    const parsed = parseShareUrl("platform=google-ads&conversionValue=99.99");
    expect(parsed.conversionValue).toBe(99.99);
    expect(typeof parsed.conversionValue).toBe("number");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty optional fields", () => {
    const url = buildShareUrl({
      config: { platform: "google-ads", conversionId: "AW-1", conversionLabel: "x" },
    });
    expect(url).not.toContain("pixelId=");
    expect(url).not.toContain("partnerId=");
  });
});
