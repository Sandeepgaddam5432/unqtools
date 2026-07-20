import { describe, it, expect, beforeEach } from "vitest";
import {
  STYLE_LABELS,
  THEME_LABELS,
  THEME_COLORS,
  SAMPLE_TIMEZONES,
  STYLE_OPTIONS,
  THEME_OPTIONS,
  ONFINISH_OPTIONS,
  parseTargetDateTime,
  validateTimezone,
  validateConfig,
  rollRecurringAnnual,
  computeCountdown,
  formatCountdown,
  formatTargetLabel,
  generateWidgetParts,
  generateEmbedSnippet,
  generateStandaloneHtml,
  generateIcsEvent,
  escapeHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  defaultConfig,
  type TimerConfig,
  type Style,
  type Theme,
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

describe("countdown-timer-generator constants", () => {
  it("has 3 styles", () => {
    expect(STYLE_OPTIONS).toEqual(["digit", "flip", "simple"]);
    expect(Object.keys(STYLE_LABELS)).toHaveLength(3);
  });
  it("has 4 themes", () => {
    expect(THEME_OPTIONS).toEqual(["dark", "light", "neon", "minimal"]);
    expect(Object.keys(THEME_LABELS)).toHaveLength(4);
  });
  it("has 3 onfinish options", () => {
    expect(ONFINISH_OPTIONS).toEqual(["message", "hide", "redirect"]);
  });
  it("has theme colors for each theme", () => {
    for (const t of THEME_OPTIONS) {
      expect(THEME_COLORS[t]).toBeDefined();
      expect(THEME_COLORS[t].bg).toBeTruthy();
      expect(THEME_COLORS[t].fg).toBeTruthy();
    }
  });
  it("has sample timezones", () => {
    expect(SAMPLE_TIMEZONES.length).toBeGreaterThan(5);
    expect(SAMPLE_TIMEZONES).toContain("UTC");
    expect(SAMPLE_TIMEZONES).toContain("America/New_York");
  });
});

describe("countdown-timer-generator parseTargetDateTime", () => {
  it("parses ISO with Z", () => {
    const d = parseTargetDateTime("2025-12-31T23:59:59Z");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
  });
  it("parses ISO with offset", () => {
    const d = parseTargetDateTime("2025-12-31T18:00:00-05:00");
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(23); // -05:00 → 23:00 UTC
  });
  it("returns null for garbage", () => {
    expect(parseTargetDateTime("hello")).toBeNull();
    expect(parseTargetDateTime("")).toBeNull();
  });
});

describe("countdown-timer-generator validateTimezone", () => {
  it("accepts valid IANA zones", () => {
    expect(validateTimezone("UTC")).toBe(true);
    expect(validateTimezone("America/New_York")).toBe(true);
    expect(validateTimezone("Asia/Kolkata")).toBe(true);
  });
  it("rejects invalid zones", () => {
    expect(validateTimezone("Mars/Olympus")).toBe(false);
    expect(validateTimezone("")).toBe(false);
    expect(validateTimezone("Foo/Bar_Baz")).toBe(false);
  });
});

describe("countdown-timer-generator validateConfig", () => {
  it("accepts a valid config", () => {
    const cfg = defaultConfig();
    const r = validateConfig(cfg);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("flags invalid target", () => {
    const cfg = { ...defaultConfig(), targetIso: "garbage" };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Target"))).toBe(true);
  });
  it("flags missing fixed timezone when mode=fixed", () => {
    const cfg = { ...defaultConfig(), timezoneMode: "fixed" as const, fixedTimezone: "" };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
  });
  it("flags invalid fixed timezone", () => {
    const cfg = { ...defaultConfig(), timezoneMode: "fixed" as const, fixedTimezone: "Mars/Olympus" };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
  });
  it("flags redirect without URL", () => {
    const cfg = { ...defaultConfig(), onFinish: "redirect" as const, redirectUrl: "" };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("redirect"))).toBe(true);
  });
  it("flags message without message text", () => {
    const cfg = { ...defaultConfig(), onFinish: "message" as const, finishedMessage: "" };
    const r = validateConfig(cfg);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("message"))).toBe(true);
  });
});

describe("countdown-timer-generator rollRecurringAnnual", () => {
  it("returns target unchanged if it's still in the future", () => {
    const target = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const rolled = rollRecurringAnnual(target, now);
    expect(rolled.getTime()).toBe(target.getTime());
  });
  it("rolls forward to next year when past", () => {
    // Deterministic: target is a specific past date.
    const target = new Date(2000, 5, 15, 12, 0, 0); // June 15, 2000 local
    const now = new Date(2025, 0, 1);              // Jan 1, 2025 local
    const rolled = rollRecurringAnnual(target, now);
    expect(rolled.getTime()).toBeGreaterThan(now.getTime());
    expect(rolled.getMonth()).toBe(target.getMonth());
    expect(rolled.getDate()).toBe(target.getDate());
    expect(rolled.getFullYear()).toBe(2025);
  });
});

describe("countdown-timer-generator computeCountdown", () => {
  it("computes parts for a future target", () => {
    const cfg = { ...defaultConfig(), targetIso: new Date(Date.now() + 86400000 + 3600000 + 60000 + 5000).toISOString() };
    const parts = computeCountdown(cfg, new Date());
    expect(parts.isFinished).toBe(false);
    expect(parts.days).toBeGreaterThanOrEqual(1);
    expect(parts.hours).toBeGreaterThanOrEqual(0);
    expect(parts.totalMs).toBeGreaterThan(0);
  });
  it("flags finished when target is past", () => {
    const cfg = { ...defaultConfig(), targetIso: new Date(Date.now() - 10000).toISOString() };
    const parts = computeCountdown(cfg, new Date());
    expect(parts.isFinished).toBe(true);
    expect(parts.totalMs).toBeLessThanOrEqual(0);
  });
  it("returns zeroed parts for invalid target", () => {
    const cfg = { ...defaultConfig(), targetIso: "garbage" };
    const parts = computeCountdown(cfg, new Date());
    expect(parts.days).toBe(0);
    expect(parts.hours).toBe(0);
    expect(parts.minutes).toBe(0);
    expect(parts.seconds).toBe(0);
  });
  it("rolls forward when recurring is on and target is past", () => {
    // Deterministic: a date clearly in the past, with a fixed "now".
    const pastIso = new Date(Date.UTC(2000, 5, 15, 12, 0, 0)).toISOString();
    const cfg = { ...defaultConfig(), recurringAnnual: true, targetIso: pastIso };
    const now = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    const parts = computeCountdown(cfg, now);
    expect(parts.isFinished).toBe(false);
    expect(parts.totalMs).toBeGreaterThan(0);
    // Effective target should be in 2025.
    expect(new Date(parts.effectiveTargetIso).getUTCFullYear()).toBe(2025);
  });
});

describe("countdown-timer-generator formatCountdown", () => {
  it("formats future countdown", () => {
    const cfg = { ...defaultConfig(), targetIso: new Date(Date.now() + 3 * 86400000).toISOString(), title: "Launch" };
    const parts = computeCountdown(cfg, new Date());
    const text = formatCountdown(cfg, parts);
    expect(text).toContain("Launch");
    expect(text).toContain("until");
  });
  it("formats finished-with-message", () => {
    const cfg = {
      ...defaultConfig(),
      targetIso: new Date(Date.now() - 1000).toISOString(),
      title: "Event",
      finishedMessage: "Done!",
      countUpAfterTarget: false,
    };
    const parts = computeCountdown(cfg, new Date());
    const text = formatCountdown(cfg, parts);
    expect(text).toContain("Done!");
  });
  it("formats count-up when configured", () => {
    const cfg = {
      ...defaultConfig(),
      targetIso: new Date(Date.now() - 5000).toISOString(),
      title: "Launch",
      countUpAfterTarget: true,
    };
    const parts = computeCountdown(cfg, new Date());
    const text = formatCountdown(cfg, parts);
    expect(text).toContain("elapsed");
    expect(text).toContain("since");
  });
});

describe("countdown-timer-generator formatTargetLabel", () => {
  it("uses UTC when visitor mode", () => {
    const cfg = { ...defaultConfig(), timezoneMode: "visitor" as const };
    const label = formatTargetLabel(cfg);
    expect(label).toContain("GMT");
  });
  it("uses fixed timezone when configured", () => {
    const cfg = { ...defaultConfig(), timezoneMode: "fixed" as const, fixedTimezone: "America/New_York" };
    const label = formatTargetLabel(cfg);
    expect(label).toContain("America/New_York");
  });
  it("falls back gracefully for invalid zone", () => {
    const cfg = { ...defaultConfig(), timezoneMode: "fixed" as const, fixedTimezone: "Mars/Olympus" };
    const label = formatTargetLabel(cfg);
    expect(label).toContain("GMT"); // falls back to UTC
  });
});

describe("countdown-timer-generator generateWidgetParts", () => {
  it("produces html, css, js for digit style", () => {
    const cfg = { ...defaultConfig(), style: "digit" as Style };
    const parts = generateWidgetParts(cfg);
    expect(parts.html).toContain("unq-cd-digit");
    expect(parts.css).toContain("--bg:");
    expect(parts.js).toContain("setInterval");
  });
  it("produces simple style", () => {
    const cfg = { ...defaultConfig(), style: "simple" as Style };
    const parts = generateWidgetParts(cfg);
    expect(parts.html).toContain("unq-cd-simple");
    expect(parts.html).toContain('data-unit="text"');
  });
  it("produces flip style", () => {
    const cfg = { ...defaultConfig(), style: "flip" as Style };
    const parts = generateWidgetParts(cfg);
    expect(parts.html).toContain("unq-cd-flip");
  });
  it("JS includes targetMs and config", () => {
    const cfg = defaultConfig();
    const parts = generateWidgetParts(cfg);
    expect(parts.js).toContain("targetMs");
    expect(parts.js).toContain("setInterval");
    expect(parts.js).toContain("onFinish");
    expect(parts.css).toContain("prefers-reduced-motion");
  });
  it("respects showLabels=false", () => {
    const cfg = { ...defaultConfig(), showLabels: false };
    const parts = generateWidgetParts(cfg);
    expect(parts.html).not.toContain("unq-cd-lbl");
  });
  it("applies theme colors", () => {
    const cfg = { ...defaultConfig(), theme: "neon" as Theme };
    const parts = generateWidgetParts(cfg);
    expect(parts.css).toContain(THEME_COLORS.neon.bg);
    expect(parts.css).toContain(THEME_COLORS.neon.accent);
  });
});

describe("countdown-timer-generator generateEmbedSnippet", () => {
  it("wraps parts with comment markers", () => {
    const snippet = generateEmbedSnippet(defaultConfig());
    expect(snippet).toContain("<!-- UnQTools countdown widget");
    expect(snippet).toContain("<style>");
    expect(snippet).toContain("<script>");
    expect(snippet).toContain("setInterval");
    expect(snippet).toContain("End UnQTools countdown widget");
  });
  it("escapes HTML in title", () => {
    const cfg = { ...defaultConfig(), title: "<script>alert(1)</script>" };
    const snippet = generateEmbedSnippet(cfg);
    expect(snippet).toContain("&lt;script&gt;");
    expect(snippet).not.toContain("<script>alert(1)</script>");
  });
});

describe("countdown-timer-generator generateStandaloneHtml", () => {
  it("produces full HTML document", () => {
    const html = generateStandaloneHtml(defaultConfig());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("setInterval");
  });
  it("contains widget root", () => {
    const html = generateStandaloneHtml(defaultConfig());
    expect(html).toContain("unq-cd");
  });
});

describe("countdown-timer-generator generateIcsEvent", () => {
  it("produces valid VCALENDAR", () => {
    const ics = generateIcsEvent(defaultConfig());
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
  });
  it("includes DTSTART in UTC", () => {
    const ics = generateIcsEvent(defaultConfig());
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/DTEND:\d{8}T\d{6}Z/);
  });
  it("includes UID and DTSTAMP", () => {
    const ics = generateIcsEvent(defaultConfig());
    expect(ics).toMatch(/UID:.+@unqtools/);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
  it("escapes commas and semicolons in title", () => {
    const cfg = { ...defaultConfig(), title: "Launch, v2; final" };
    const ics = generateIcsEvent(cfg);
    expect(ics).toContain("Launch\\, v2\\; final");
  });
  it("throws for invalid target", () => {
    expect(() => generateIcsEvent({ ...defaultConfig(), targetIso: "garbage" })).toThrow();
  });
  it("uses CRLF line endings", () => {
    const ics = generateIcsEvent(defaultConfig());
    expect(ics).toContain("\r\n");
  });
});

describe("countdown-timer-generator escapeHtml", () => {
  it("escapes dangerous chars", () => {
    expect(escapeHtml(`<a href="x">"&'</a>`)).toBe(`&lt;a href=&quot;x&quot;&gt;&quot;&amp;&#39;&lt;/a&gt;`);
  });
  it("handles empty", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("countdown-timer-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, title: "Event",
      targetIso: "2025-12-31T23:59:59Z",
      style: "digit", theme: "dark", recurringAnnual: false,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, title: `Event${i}`,
        targetIso: "2025-12-31T23:59:59Z",
        style: "digit", theme: "dark", recurringAnnual: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, title: "x",
      targetIso: "2025-12-31T23:59:59Z",
      style: "digit", theme: "dark", recurringAnnual: false,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("countdown-timer-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const cfg = { ...defaultConfig(), title: "My Event", recurringAnnual: true };
    const url = buildShareUrl(cfg);
    expect(url).toContain("t=");
    expect(url).toContain("title=My+Event");
    expect(url).toContain("recurring=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const cfg = { ...defaultConfig(), title: "Holiday", recurringAnnual: true, countUpAfterTarget: true, theme: "neon" as Theme, style: "flip" as Style };
    const url = buildShareUrl(cfg);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.title).toBe("Holiday");
    expect(parsed.recurringAnnual).toBe(true);
    expect(parsed.countUpAfterTarget).toBe(true);
    expect(parsed.theme).toBe("neon");
    expect(parsed.style).toBe("flip");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown style/theme", () => {
    const parsed = parseShareUrl("style=glyph&theme=rainbow");
    expect(parsed.style).toBeUndefined();
    expect(parsed.theme).toBeUndefined();
  });
});

describe("countdown-timer-generator defaultConfig", () => {
  it("produces a valid config", () => {
    const cfg = defaultConfig();
    expect(validateConfig(cfg).ok).toBe(true);
    expect(cfg.targetIso).toBeTruthy();
    expect(cfg.title).toBeTruthy();
  });
});

// Suppress unused-import lint
export type _Unused = TimerConfig | Style | Theme;
