import { describe, it, expect, beforeEach } from "vitest";
import {
  UA_TEMPLATES,
  BOTS,
  BROWSER_OPTIONS,
  OS_OPTIONS,
  DEVICE_CLASS_OPTIONS,
  EXPORT_FORMATS,
  MAX_COUNT,
  HISTORY_MAX,
  fnv1a,
  mulberry32,
  pickRandom,
  pickWeighted,
  validateOptions,
  filterTemplates,
  fillTemplate,
  generateOne,
  generateList,
  detectBot,
  detectHeadless,
  parseUA,
  explainTokens,
  renderText,
  renderCsv,
  renderJson,
  renderPlaywright,
  renderExport,
  exportFilename,
  exportMime,
  getCurrentUA,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  templateCount,
  uniqueBrowserCount,
  botCount,
  type GenerateOptions,
  type DeviceClass,
  type ExportFormat,
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

// ──────────────────────────────────────────────────────────────────────────
// Catalog tests
// ──────────────────────────────────────────────────────────────────────────

describe("UA catalog", () => {
  it("has 60+ templates", () => {
    expect(UA_TEMPLATES.length).toBeGreaterThanOrEqual(60);
  });

  it("has 50+ unique browsers+OS combinations (via templateCount)", () => {
    expect(templateCount()).toBeGreaterThanOrEqual(50);
  });

  it("every template has a non-empty browser name, browserKey, and template", () => {
    for (const t of UA_TEMPLATES) {
      expect(t.browser.length).toBeGreaterThan(0);
      expect(t.browserKey.length).toBeGreaterThan(0);
      expect(t.template.length).toBeGreaterThan(0);
      expect(t.versions.length).toBeGreaterThan(0);
      expect(t.weight).toBeGreaterThan(0);
    }
  });

  it("every template's fillTemplate produces a non-placeholder string", () => {
    const rng = mulberry32(42);
    for (const t of UA_TEMPLATES) {
      const filled = fillTemplate(t, rng);
      expect(filled).not.toContain("{bver}");
      // {over} may be empty for templates without osVersions but must not literally remain
      expect(filled).not.toContain("{over}");
    }
  });

  it("has 17+ bots", () => {
    expect(botCount()).toBeGreaterThanOrEqual(17);
  });

  it("has multiple unique browser families (≥8)", () => {
    expect(uniqueBrowserCount()).toBeGreaterThanOrEqual(8);
  });

  it("exposes BROWSER_OPTIONS, OS_OPTIONS, DEVICE_CLASS_OPTIONS, EXPORT_FORMATS", () => {
    expect(BROWSER_OPTIONS.length).toBeGreaterThan(5);
    expect(OS_OPTIONS.length).toBeGreaterThan(3);
    expect(DEVICE_CLASS_OPTIONS.length).toBeGreaterThanOrEqual(6);
    expect(EXPORT_FORMATS.length).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PRNG tests
// ──────────────────────────────────────────────────────────────────────────

describe("PRNG utilities", () => {
  it("fnv1a is deterministic", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
  });

  it("fnv1a returns unsigned 32-bit", () => {
    expect(fnv1a("hello")).toBeGreaterThanOrEqual(0);
    expect(fnv1a("hello")).toBeLessThan(0x100000000);
  });

  it("mulberry32 is deterministic for the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("mulberry32 returns numbers in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("pickRandom returns an element of the array", () => {
    const rng = mulberry32(1);
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toContain(pickRandom(arr, rng));
  });

  it("pickWeighted favors higher weights", () => {
    const rng = mulberry32(99);
    const arr = [{ x: "heavy", w: 1000 }, { x: "rare", w: 1 }];
    const counts = { heavy: 0, rare: 0 };
    for (let i = 0; i < 100; i++) {
      const pick = pickWeighted(arr, (t) => t.w, rng);
      counts[pick.x as "heavy" | "rare"]++;
    }
    expect(counts.heavy).toBeGreaterThan(counts.rare);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────────

describe("validateOptions", () => {
  it("rejects count < 1", () => {
    const r = validateOptions({ count: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects NaN count", () => {
    const r = validateOptions({ count: NaN });
    expect(r.ok).toBe(false);
  });
  it("rejects count > MAX_COUNT", () => {
    const r = validateOptions({ count: MAX_COUNT + 1 });
    expect(r.ok).toBe(false);
  });
  it("accepts valid count", () => {
    const r = validateOptions({ count: 10 });
    expect(r.ok).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────────────────────────────────

describe("filterTemplates", () => {
  it("returns all when no filter", () => {
    expect(filterTemplates({ count: 1 }).length).toBe(UA_TEMPLATES.length);
  });
  it("filters by deviceClass", () => {
    const r = filterTemplates({ count: 1, deviceClass: "bot" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.deviceClass === "bot")).toBe(true);
  });
  it("filters by browserKey", () => {
    const r = filterTemplates({ count: 1, browserKey: "firefox" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.browserKey === "firefox")).toBe(true);
  });
  it("filters by osFamily", () => {
    const r = filterTemplates({ count: 1, osFamily: "android" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.osFamily === "android")).toBe(true);
  });
  it("returns empty when no match", () => {
    const r = filterTemplates({ count: 1, browserKey: "nonexistent-browser" });
    expect(r).toEqual([]);
  });
});

describe("fillTemplate", () => {
  it("substitutes {bver} and {over}", () => {
    const t = UA_TEMPLATES[0]; // chrome-win
    const rng = mulberry32(1);
    const filled = fillTemplate(t, rng);
    expect(filled).not.toContain("{bver}");
    expect(filled).not.toContain("{over}");
    expect(filled).toContain("Chrome/");
  });
});

describe("generateOne", () => {
  it("returns a GeneratedUA with a non-empty ua string", () => {
    const rng = mulberry32(5);
    const g = generateOne({ count: 1 }, rng);
    expect(g.ua.length).toBeGreaterThan(20);
    expect(g.template).toBeDefined();
  });
});

describe("generateList", () => {
  it("generates the requested count", () => {
    const list = generateList({ count: 25, seed: "test-seed" });
    expect(list).toHaveLength(25);
  });

  it("is deterministic for the same seed", () => {
    const a = generateList({ count: 10, seed: "abc" });
    const b = generateList({ count: 10, seed: "abc" });
    expect(a.map((g) => g.ua)).toEqual(b.map((g) => g.ua));
  });

  it("returns empty for invalid count", () => {
    expect(generateList({ count: 0 })).toEqual([]);
    expect(generateList({ count: MAX_COUNT + 1 })).toEqual([]);
  });

  it("respects deviceClass filter", () => {
    const list = generateList({ count: 50, seed: "s", deviceClass: "bot" });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((g) => g.template.deviceClass === "bot")).toBe(true);
  });

  it("can produce up to MAX_COUNT entries", () => {
    const list = generateList({ count: MAX_COUNT, seed: "big" });
    expect(list).toHaveLength(MAX_COUNT);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Bot detection
// ──────────────────────────────────────────────────────────────────────────

describe("detectBot", () => {
  it("detects Googlebot", () => {
    const b = detectBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(b).not.toBeNull();
    expect(b!.name).toMatch(/Googlebot/);
    expect(b!.category).toBe("search");
  });
  it("detects Bingbot", () => {
    const b = detectBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)");
    expect(b).not.toBeNull();
    expect(b!.vendor).toBe("Microsoft");
  });
  it("detects GPTBot (AI crawler)", () => {
    const b = detectBot("Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)");
    expect(b).not.toBeNull();
    expect(b!.category).toBe("ai");
  });
  it("detects WhatsApp (social)", () => {
    const b = detectBot("WhatsApp/2.23.20.0");
    expect(b).not.toBeNull();
    expect(b!.category).toBe("social");
  });
  it("returns null for non-bot UAs", () => {
    const b = detectBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    expect(b).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(detectBot("")).toBeNull();
  });
});

describe("detectHeadless", () => {
  it("detects HeadlessChrome", () => {
    expect(detectHeadless("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36")).toBe(true);
  });
  it("detects PhantomJS", () => {
    expect(detectHeadless("Mozilla/5.0 (Macintosh; Intel Mac OS X) PhantomJS/2.1.1")).toBe(true);
  });
  it("returns false for normal browsers", () => {
    expect(detectHeadless("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────────────────────────────────

describe("parseUA", () => {
  it("parses Chrome on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Chrome");
    expect(p.browser.major).toBe(120);
    expect(p.os.family).toBe("windows");
    expect(p.os.name).toMatch(/Windows/);
    expect(p.device.type).toBe("desktop");
    expect(p.cpu.architecture).toBe("x64");
    expect(p.bot.isBot).toBe(false);
    expect(p.engine.name).toBe("WebKit"); // AppleWebKit-based display name
  });

  it("parses Firefox on macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:121.0) Gecko/20100101 Firefox/121.0";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Firefox");
    expect(p.browser.major).toBe(121);
    expect(p.os.family).toBe("macos");
    expect(p.os.version).toBe("14.0");
    expect(p.device.type).toBe("desktop");
    expect(p.engine.name).toBe("Gecko");
  });

  it("parses Safari on iPhone", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Safari");
    expect(p.os.family).toBe("ios");
    expect(p.os.version).toBe("17.0");
    expect(p.device.type).toBe("mobile");
    expect(p.device.model).toBe("iPhone");
    expect(p.device.vendor).toBe("Apple");
    expect(p.cpu.architecture).toBe("arm64");
  });

  it("parses Android Chrome with model", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Chrome");
    expect(p.os.family).toBe("android");
    expect(p.os.version).toBe("14");
    expect(p.device.type).toBe("mobile");
    expect(p.device.model).toContain("Pixel");
    expect(p.device.vendor).toBe("Google");
  });

  it("parses Edge on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Edge");
    expect(p.browser.version).toBe("120.0.0.0");
    expect(p.os.family).toBe("windows");
  });

  it("parses Opera", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 OPR/110.0.0.0";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Opera");
    expect(p.browser.major).toBe(110);
  });

  it("parses Samsung Internet", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/120.0.0.0 Mobile Safari/537.36";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Samsung Internet");
    expect(p.device.vendor).toBe("Samsung");
  });

  it("parses IE 11 via Trident/rv", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko";
    const p = parseUA(ua);
    expect(p.browser.name).toBe("Internet Explorer");
    expect(p.browser.version).toBe("11.0");
    expect(p.engine.name).toBe("Trident");
    expect(p.cpu.architecture).toBe("x64"); // WOW64 → x64
  });

  it("parses Googlebot", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const p = parseUA(ua);
    expect(p.bot.isBot).toBe(true);
    expect(p.bot.name).toMatch(/Googlebot/);
    expect(p.bot.category).toBe("search");
  });

  it("parses iPad Safari", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const p = parseUA(ua);
    expect(p.os.family).toBe("ipados");
    expect(p.device.type).toBe("tablet");
  });

  it("handles empty input gracefully", () => {
    const p = parseUA("");
    expect(p.browser.name).toBe("Unknown");
    expect(p.os.family).toBe("unknown");
    expect(p.bot.isBot).toBe(false);
    expect(p.tokens).toEqual([]);
  });

  it("produces a token breakdown table", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const tokens = explainTokens(ua);
    expect(tokens.length).toBeGreaterThan(3);
    for (const t of tokens) {
      expect(t.value.length).toBeGreaterThan(0);
      expect(t.meaning.length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Exporters
// ──────────────────────────────────────────────────────────────────────────

describe("exporters", () => {
  const list = generateList({ count: 10, seed: "export-test" });
  it("renderText joins by newline", () => {
    const txt = renderText(list);
    expect(txt.split("\n")).toHaveLength(10);
  });
  it("renderCsv has header", () => {
    const csv = renderCsv(list);
    expect(csv.split("\n")[0]).toContain("user_agent,browser");
    expect(csv.split("\n").length).toBe(11);
  });
  it("renderJson produces a valid JSON array", () => {
    const txt = renderJson(list);
    const arr = JSON.parse(txt);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(10);
  });
  it("renderPlaywright emits a TS export", () => {
    const txt = renderPlaywright(list);
    expect(txt).toContain("export const USER_AGENTS");
    expect(txt).toContain("userAgent:");
    expect(txt).toContain("deviceClass:");
  });
  it("renderExport dispatches by format", () => {
    expect(renderExport(list, "txt")).toBe(renderText(list));
    expect(renderExport(list, "csv")).toBe(renderCsv(list));
    expect(renderExport(list, "json")).toBe(renderJson(list));
    expect(renderExport(list, "playwright")).toBe(renderPlaywright(list));
  });
  it("exportFilename and exportMime cover all formats", () => {
    const fmts: ExportFormat[] = ["txt", "csv", "json", "playwright"];
    for (const f of fmts) {
      expect(exportFilename(f).length).toBeGreaterThan(0);
      expect(exportMime(f).length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// History
// ──────────────────────────────────────────────────────────────────────────

describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "generate", summary: "10 UAs", count: 10 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "generate", summary: `${i}`, count: 1 });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "generate", summary: "x", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Shareable URL
// ──────────────────────────────────────────────────────────────────────────

describe("shareable URL", () => {
  it("builds share URL when window is unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ count: 10, deviceClass: "bot", seed: "abc" }, "generate");
    expect(url).toContain("count=10");
    expect(url).toContain("dc=bot");
    expect(url).toContain("seed=abc");
    expect(url).toContain("mode=generate");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("includes UA in parse mode", () => {
    const url = buildShareUrl({ count: 1 }, "parse", "Mozilla/5.0 (compatible; Googlebot/2.1)");
    expect(url).toContain("mode=parse");
    expect(url).toContain("ua=");
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ count: 25, deviceClass: "mobile", seed: "xyz" }, "generate");
    const parsed = parseShareUrl(url);
    expect(parsed.mode).toBe("generate");
    expect(parsed.opts.count).toBe(25);
    expect(parsed.opts.deviceClass).toBe("mobile");
    expect(parsed.opts.seed).toBe("xyz");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses parse-mode URL with UA", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ count: 1 }, "parse", "Mozilla/5.0 Firefox/121.0");
    const parsed = parseShareUrl(url);
    expect(parsed.mode).toBe("parse");
    expect(parsed.ua).toContain("Firefox");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.mode).toBe("generate");
    expect(p.opts.count).toBe(1);
    expect(p.opts.deviceClass).toBe("any");
  });
  it("filters invalid device class", () => {
    const p = parseShareUrl("mode=generate&count=5&dc=invalid");
    expect(p.opts.deviceClass).toBe("any");
  });
  it("clamps count above MAX_COUNT", () => {
    const p = parseShareUrl(`mode=generate&count=${MAX_COUNT + 1000}`);
    expect(p.opts.count).toBe(MAX_COUNT);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getCurrentUA
// ──────────────────────────────────────────────────────────────────────────

describe("getCurrentUA", () => {
  it("returns a string (possibly empty in non-browser env)", () => {
    const ua = getCurrentUA();
    expect(typeof ua).toBe("string");
  });
});

// Suppress unused-import lint
export type _Unused = DeviceClass | GenerateOptions;
