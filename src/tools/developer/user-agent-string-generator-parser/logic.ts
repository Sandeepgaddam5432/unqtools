/**
 * User-Agent String Generator & Parser — pure logic.
 *
 * Two-way tool:
 *  • GENERATE realistic UA strings from a curated catalog of 60+
 *    browser/OS/device combinations (Chrome, Firefox, Safari, Edge,
 *    Opera, Vivaldi, Brave, Samsung Internet, mobile devices, 17 bots).
 *  • PARSE any UA string into browser / engine / OS / CPU / device / bot.
 *
 * Pure functions only — no DOM, no network. The generator uses a
 * seedable mulberry32 PRNG for reproducible test fixtures.
 */

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type EngineName =
  | "Blink"
  | "Gecko"
  | "WebKit"
  | "Trident"
  | "EdgeHTML"
  | "KHTML"
  | "Presto"
  | "Goanna";

export type DeviceClass =
  | "desktop"
  | "mobile"
  | "tablet"
  | "bot"
  | "console"
  | "tv";

export type ExportFormat = "txt" | "csv" | "json" | "playwright";

export interface UATemplate {
  id: string;
  /** Display browser name. */
  browser: string;
  /** Canonical browser id used by the parser. */
  browserKey: string;
  vendor: string;
  engine: EngineName;
  deviceClass: DeviceClass;
  /** Display OS name. */
  os: string;
  /** Canonical OS family id. */
  osFamily: string;
  /** Device model name (mobile/tablet only). */
  device?: string;
  /** Device vendor (mobile/tablet only). */
  deviceVendor?: string;
  /** UA template with {bver} (browser version) and {over} (OS version) placeholders. */
  template: string;
  /** Market-share weight. Higher = more likely to be picked. */
  weight: number;
  /** Browser versions to substitute for {bver}. */
  versions: string[];
  /** OS versions to substitute for {over} (optional). */
  osVersions?: string[];
}

export interface BotEntry {
  id: string;
  name: string;
  vendor: string;
  category: "search" | "social" | "seo" | "monitor" | "scraper" | "ai" | "feed";
  /** Regex to match the bot in a UA. */
  regex: RegExp;
  /** Typical UA string. */
  ua: string;
}

export interface ParsedUA {
  browser: { name: string; version: string | null; major: number | null };
  engine: { name: string; version: string | null };
  os: { name: string; version: string | null; family: string };
  device: { type: DeviceClass | "unknown"; model: string | null; vendor: string | null };
  cpu: { architecture: string };
  bot: { isBot: boolean; name: string | null; vendor: string | null; category: string | null };
  isHeadless: boolean;
  raw: string;
  tokens: UAToken[];
}

export interface UAToken {
  value: string;
  meaning: string;
}

export interface GenerateOptions {
  count: number;
  deviceClass?: DeviceClass | "any";
  browserKey?: string;
  osFamily?: string;
  seed?: string;
}

export interface GeneratedUA {
  ua: string;
  template: UATemplate;
}

export interface HistoryEntry {
  ts: number;
  mode: "generate" | "parse";
  summary: string;
  count: number;
  filter?: string;
  seed?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants / catalog
// ──────────────────────────────────────────────────────────────────────────

export const MAX_COUNT = 10_000;
export const HISTORY_MAX = 20;
const HISTORY_KEY = "unqtools:user-agent-string-generator-parser:history";

const CHROME_VERSIONS = ["120", "121", "122", "123", "124", "125", "126", "127", "128", "129", "130"];
const FIREFOX_VERSIONS = ["121", "122", "123", "124", "125", "126", "127", "128", "129", "130", "131"];
const SAFARI_VERSIONS = ["16.0", "16.5", "17.0", "17.4", "17.5", "18.0", "18.1"];
const EDGE_VERSIONS = CHROME_VERSIONS;
const OPERA_VERSIONS = ["106", "107", "108", "109", "110", "111", "112", "113", "114"];
const VIVALDI_VERSIONS = ["6.1", "6.2", "6.4", "6.5", "6.7", "6.8", "6.9"];
const SAMSUNG_VERSIONS = ["22.0", "23.0", "24.0", "25.0", "26.0", "27.0"];
const UC_VERSIONS = ["13.4", "13.5", "13.6", "15.0", "15.5", "16.0"];
const QQ_VERSIONS = ["13.0", "13.5", "14.0", "14.5", "15.0"];

const WIN10 = "10.0";
const WIN11 = "10.0"; // Win11 still reports Windows NT 10.0 in the UA
const MAC_VERSIONS = ["10_15_7", "11_0", "12_0", "13_0", "13_5", "14_0", "14_3", "14_5", "15_0", "15_1"];
const ANDROID_VERSIONS = ["10", "11", "12", "12L", "13", "14", "15"];
const IOS_VERSIONS = ["15_0", "15_6", "16_0", "16_5", "16_7", "17_0", "17_4", "17_5", "18_0", "18_1"];
const LINUX_DISTROS = ["x86_64", "i686", "aarch64"];

// ──────────────────────────────────────────────────────────────────────────
// UA catalog — 60+ templates (Chrome, Firefox, Safari, Edge, Opera,
// Vivaldi, Brave, Samsung, UC, QQ, mobile, and bots).
// ──────────────────────────────────────────────────────────────────────────

export const UA_TEMPLATES: UATemplate[] = [
  // ---- Chrome (desktop) --------------------------------------------------
  {
    id: "chrome-win",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36",
    weight: 35, versions: CHROME_VERSIONS, osVersions: [WIN10, WIN11],
  },
  {
    id: "chrome-mac",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36",
    weight: 16, versions: CHROME_VERSIONS, osVersions: MAC_VERSIONS,
  },
  {
    id: "chrome-linux",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "desktop", os: "Linux", osFamily: "linux",
    template: "Mozilla/5.0 (X11; Linux {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36",
    weight: 4, versions: CHROME_VERSIONS, osVersions: LINUX_DISTROS,
  },
  {
    id: "chrome-cros",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "desktop", os: "Chrome OS", osFamily: "chromeos",
    template: "Mozilla/5.0 (X11; CrOS x86_64 {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36",
    weight: 2, versions: CHROME_VERSIONS, osVersions: ["14526.0.0", "15183.0.0", "15886.0.0"],
  },
  // ---- Firefox (desktop) -------------------------------------------------
  {
    id: "firefox-win",
    browser: "Firefox", browserKey: "firefox", vendor: "Mozilla", engine: "Gecko",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64; rv:{bver}.0) Gecko/20100101 Firefox/{bver}.0",
    weight: 5, versions: FIREFOX_VERSIONS, osVersions: [WIN10, WIN11],
  },
  {
    id: "firefox-mac",
    browser: "Firefox", browserKey: "firefox", vendor: "Mozilla", engine: "Gecko",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}; rv:{bver}.0) Gecko/20100101 Firefox/{bver}.0",
    weight: 2, versions: FIREFOX_VERSIONS, osVersions: MAC_VERSIONS,
  },
  {
    id: "firefox-linux",
    browser: "Firefox", browserKey: "firefox", vendor: "Mozilla", engine: "Gecko",
    deviceClass: "desktop", os: "Linux", osFamily: "linux",
    template: "Mozilla/5.0 (X11; Linux {over}; rv:{bver}.0) Gecko/20100101 Firefox/{bver}.0",
    weight: 2, versions: FIREFOX_VERSIONS, osVersions: LINUX_DISTROS,
  },
  // ---- Safari (desktop) --------------------------------------------------
  {
    id: "safari-mac",
    browser: "Safari", browserKey: "safari", vendor: "Apple", engine: "WebKit",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{bver} Safari/605.1.15",
    weight: 9, versions: SAFARI_VERSIONS, osVersions: MAC_VERSIONS,
  },
  // ---- Edge (desktop) ----------------------------------------------------
  {
    id: "edge-win",
    browser: "Edge", browserKey: "edge", vendor: "Microsoft", engine: "Blink",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36 Edg/{bver}.0.0.0",
    weight: 7, versions: EDGE_VERSIONS, osVersions: [WIN10, WIN11],
  },
  {
    id: "edge-mac",
    browser: "Edge", browserKey: "edge", vendor: "Microsoft", engine: "Blink",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36 Edg/{bver}.0.0.0",
    weight: 2, versions: EDGE_VERSIONS, osVersions: MAC_VERSIONS,
  },
  // ---- Opera (desktop) ---------------------------------------------------
  {
    id: "opera-win",
    browser: "Opera", browserKey: "opera", vendor: "Opera", engine: "Blink",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36 OPR/{bver}.0.0.0",
    weight: 1.5, versions: OPERA_VERSIONS, osVersions: [WIN10, WIN11],
  },
  {
    id: "opera-mac",
    browser: "Opera", browserKey: "opera", vendor: "Opera", engine: "Blink",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36 OPR/{bver}.0.0.0",
    weight: 0.5, versions: OPERA_VERSIONS, osVersions: MAC_VERSIONS,
  },
  {
    id: "opera-linux",
    browser: "Opera", browserKey: "opera", vendor: "Opera", engine: "Blink",
    deviceClass: "desktop", os: "Linux", osFamily: "linux",
    template: "Mozilla/5.0 (X11; Linux {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36 OPR/{bver}.0.0.0",
    weight: 0.3, versions: OPERA_VERSIONS, osVersions: LINUX_DISTROS,
  },
  // ---- Internet Explorer 11 ---------------------------------------------
  {
    id: "ie11-win",
    browser: "Internet Explorer", browserKey: "ie", vendor: "Microsoft", engine: "Trident",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; WOW64; Trident/7.0; rv:11.0) like Gecko",
    weight: 0.4, versions: ["11.0"], osVersions: [WIN10, "6.1", "6.3"],
  },
  // ---- Vivaldi -----------------------------------------------------------
  {
    id: "vivaldi-win",
    browser: "Vivaldi", browserKey: "vivaldi", vendor: "Vivaldi", engine: "Blink",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Vivaldi/{bver}",
    weight: 0.4, versions: VIVALDI_VERSIONS, osVersions: [WIN10, WIN11],
  },
  {
    id: "vivaldi-mac",
    browser: "Vivaldi", browserKey: "vivaldi", vendor: "Vivaldi", engine: "Blink",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Vivaldi/{bver}",
    weight: 0.2, versions: VIVALDI_VERSIONS, osVersions: MAC_VERSIONS,
  },
  // ---- Brave (Chromium-based; recent Brave UAs include "Brave") ----------
  {
    id: "brave-win",
    browser: "Brave", browserKey: "brave", vendor: "Brave", engine: "Blink",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36",
    weight: 1.5, versions: CHROME_VERSIONS, osVersions: [WIN10, WIN11],
  },
  {
    id: "brave-mac",
    browser: "Brave", browserKey: "brave", vendor: "Brave", engine: "Blink",
    deviceClass: "desktop", os: "macOS", osFamily: "macos",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X {over}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Safari/537.36",
    weight: 0.5, versions: CHROME_VERSIONS, osVersions: MAC_VERSIONS,
  },
  // ---- Yandex Browser ----------------------------------------------------
  {
    id: "yandex-win",
    browser: "Yandex Browser", browserKey: "yandex", vendor: "Yandex", engine: "Blink",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/24.1.0.0 Safari/537.36",
    weight: 0.3, versions: ["24.1.0.0", "24.4.0.0", "24.6.0.0", "24.10.0.0"], osVersions: [WIN10, WIN11],
  },
  // ---- Tor Browser (Firefox-based) --------------------------------------
  {
    id: "tor-win",
    browser: "Tor Browser", browserKey: "tor", vendor: "Tor Project", engine: "Gecko",
    deviceClass: "desktop", os: "Windows", osFamily: "windows",
    template: "Mozilla/5.0 (Windows NT {over}; rv:115.0) Gecko/20100101 Firefox/115.0",
    weight: 0.1, versions: ["115.0", "128.0"], osVersions: [WIN10, WIN11],
  },
  // ---- Chrome Mobile (Android) ------------------------------------------
  {
    id: "chrome-android-pixel",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Pixel 8", deviceVendor: "Google",
    template: "Mozilla/5.0 (Linux; Android {over}; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Mobile Safari/537.36",
    weight: 3.5, versions: CHROME_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  {
    id: "chrome-android-galaxy",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "SM-S918B", deviceVendor: "Samsung",
    template: "Mozilla/5.0 (Linux; Android {over}; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Mobile Safari/537.36",
    weight: 3, versions: CHROME_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  {
    id: "chrome-android-xiaomi",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Redmi Note 12", deviceVendor: "Xiaomi",
    template: "Mozilla/5.0 (Linux; Android {over}; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Mobile Safari/537.36",
    weight: 2.5, versions: CHROME_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  {
    id: "chrome-android-huawei",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "PRA-LA1", deviceVendor: "Huawei",
    template: "Mozilla/5.0 (Linux; Android {over}; PRA-LA1; HMSCORE) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Mobile Safari/537.36",
    weight: 1.5, versions: CHROME_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Samsung Internet --------------------------------------------------
  {
    id: "samsung-galaxy",
    browser: "Samsung Internet", browserKey: "samsung", vendor: "Samsung", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "SM-S918B", deviceVendor: "Samsung",
    template: "Mozilla/5.0 (Linux; Android {over}; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/{bver} Chrome/120.0.0.0 Mobile Safari/537.36",
    weight: 2.5, versions: SAMSUNG_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Firefox Mobile (Android) -----------------------------------------
  {
    id: "firefox-android",
    browser: "Firefox", browserKey: "firefox", vendor: "Mozilla", engine: "Gecko",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Pixel 8", deviceVendor: "Google",
    template: "Mozilla/5.0 (Android {over}; Mobile; rv:{bver}.0) Gecko/{bver}.0 Firefox/{bver}.0",
    weight: 1, versions: FIREFOX_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Opera Mobile (Android) -------------------------------------------
  {
    id: "opera-android",
    browser: "Opera Mobile", browserKey: "opera", vendor: "Opera", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "SM-S918B", deviceVendor: "Samsung",
    template: "Mozilla/5.0 (Linux; Android {over}; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 OPR/{bver}.0.0.0",
    weight: 0.8, versions: OPERA_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Edge Mobile (Android) --------------------------------------------
  {
    id: "edge-android",
    browser: "Edge", browserKey: "edge", vendor: "Microsoft", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Pixel 8", deviceVendor: "Google",
    template: "Mozilla/5.0 (Linux; Android {over}; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.0.0",
    weight: 0.8, versions: EDGE_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Brave on Android --------------------------------------------------
  {
    id: "brave-android",
    browser: "Brave", browserKey: "brave", vendor: "Brave", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Pixel 8", deviceVendor: "Google",
    template: "Mozilla/5.0 (Linux; Android {over}; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Mobile Safari/537.36",
    weight: 0.5, versions: CHROME_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- DuckDuckGo Privacy Browser (Android) -----------------------------
  {
    id: "duckduckgo-android",
    browser: "DuckDuckGo", browserKey: "duckduckgo", vendor: "DuckDuckGo", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Pixel 8", deviceVendor: "Google",
    template: "Mozilla/5.0 (Linux; Android {over}; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{bver}.0.0.0 Mobile Safari/537.36 DuckDuckGo/5",
    weight: 0.4, versions: CHROME_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Yandex Browser Mobile (Android) ---------------------------------
  {
    id: "yandex-android",
    browser: "Yandex Browser", browserKey: "yandex", vendor: "Yandex", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "SM-S918B", deviceVendor: "Samsung",
    template: "Mozilla/5.0 (Linux; Android {over}; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 YaBrowser/24.1.0.0",
    weight: 0.3, versions: ["24.1.0.0", "24.4.0.0", "24.6.0.0", "24.10.0.0"], osVersions: ANDROID_VERSIONS,
  },
  // ---- UC Browser (Android) ---------------------------------------------
  {
    id: "uc-android",
    browser: "UC Browser", browserKey: "uc", vendor: "UCWeb", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "Redmi Note 12", deviceVendor: "Xiaomi",
    template: "Mozilla/5.0 (Linux; U; Android {over}; en-US; Redmi Note 12 Build/{over}) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 UCBrowser/{bver} U3/3.6.0.0 Mobile Safari/537.36",
    weight: 0.8, versions: UC_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- QQ Browser (Android) ---------------------------------------------
  {
    id: "qq-android",
    browser: "QQ Browser", browserKey: "qq", vendor: "Tencent", engine: "Blink",
    deviceClass: "mobile", os: "Android", osFamily: "android",
    device: "PGKM10", deviceVendor: "OPPO",
    template: "Mozilla/5.0 (Linux; Android {over}; PGKM10 Build/{over}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.0.0 Mobile Safari/537.36 MQQBrowser/{bver} TBS/046131",
    weight: 0.8, versions: QQ_VERSIONS, osVersions: ANDROID_VERSIONS,
  },
  // ---- Chrome on iPhone (uses iOS Safari WebKit) -----------------------
  {
    id: "chrome-ios",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "WebKit",
    deviceClass: "mobile", os: "iOS", osFamily: "ios",
    device: "iPhone", deviceVendor: "Apple",
    template: "Mozilla/5.0 (iPhone; CPU iPhone OS {over} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{bver} Mobile/15E148 Safari/604.1",
    weight: 2, versions: CHROME_VERSIONS, osVersions: IOS_VERSIONS,
  },
  // ---- Safari Mobile (iPhone) -------------------------------------------
  {
    id: "safari-ios",
    browser: "Safari", browserKey: "safari", vendor: "Apple", engine: "WebKit",
    deviceClass: "mobile", os: "iOS", osFamily: "ios",
    device: "iPhone", deviceVendor: "Apple",
    template: "Mozilla/5.0 (iPhone; CPU iPhone OS {over} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{bver} Mobile/15E148 Safari/604.1",
    weight: 10, versions: SAFARI_VERSIONS, osVersions: IOS_VERSIONS,
  },
  // ---- Firefox on iPhone -------------------------------------------------
  {
    id: "firefox-ios",
    browser: "Firefox", browserKey: "firefox", vendor: "Mozilla", engine: "WebKit",
    deviceClass: "mobile", os: "iOS", osFamily: "ios",
    device: "iPhone", deviceVendor: "Apple",
    template: "Mozilla/5.0 (iPhone; CPU iPhone OS {over} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/{bver} Mobile/15E148 Safari/605.1.15",
    weight: 0.5, versions: ["121.0", "122.0", "123.0", "124.0", "125.0", "126.0", "127.0", "128.0", "129.0", "130.0"], osVersions: IOS_VERSIONS,
  },
  // ---- Edge on iPhone ----------------------------------------------------
  {
    id: "edge-ios",
    browser: "Edge", browserKey: "edge", vendor: "Microsoft", engine: "WebKit",
    deviceClass: "mobile", os: "iOS", osFamily: "ios",
    device: "iPhone", deviceVendor: "Apple",
    template: "Mozilla/5.0 (iPhone; CPU iPhone OS {over} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 EdgiOS/124.0.0.0 Mobile/15E148 Safari/605.1.15",
    weight: 0.3, versions: EDGE_VERSIONS, osVersions: IOS_VERSIONS,
  },
  // ---- Safari on iPad ----------------------------------------------------
  {
    id: "safari-ipad",
    browser: "Safari", browserKey: "safari", vendor: "Apple", engine: "WebKit",
    deviceClass: "tablet", os: "iPadOS", osFamily: "ipados",
    device: "iPad", deviceVendor: "Apple",
    template: "Mozilla/5.0 (iPad; CPU OS {over} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{bver} Mobile/15E148 Safari/604.1",
    weight: 3, versions: SAFARI_VERSIONS, osVersions: IOS_VERSIONS,
  },
  // ---- Chrome on iPad ----------------------------------------------------
  {
    id: "chrome-ipad",
    browser: "Chrome", browserKey: "chrome", vendor: "Google", engine: "WebKit",
    deviceClass: "tablet", os: "iPadOS", osFamily: "ipados",
    device: "iPad", deviceVendor: "Apple",
    template: "Mozilla/5.0 (iPad; CPU OS {over} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{bver} Mobile/15E148 Safari/604.1",
    weight: 0.5, versions: CHROME_VERSIONS, osVersions: IOS_VERSIONS,
  },
  // ---- BOTS -------------------------------------------------------------
  {
    id: "googlebot-desktop",
    browser: "Googlebot", browserKey: "googlebot", vendor: "Google", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    weight: 1.5, versions: ["2.1"],
  },
  {
    id: "googlebot-mobile",
    browser: "Googlebot Smartphone", browserKey: "googlebot", vendor: "Google", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    weight: 0.6, versions: ["2.1"],
  },
  {
    id: "bingbot",
    browser: "Bingbot", browserKey: "bingbot", vendor: "Microsoft", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    weight: 0.7, versions: ["2.0"],
  },
  {
    id: "duckduckbot",
    browser: "DuckDuckBot", browserKey: "duckduckbot", vendor: "DuckDuckGo", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; DuckDuckBot/1.1; +https://duckduckgo.com/duckduckbot)",
    weight: 0.3, versions: ["1.1"],
  },
  {
    id: "baiduspider",
    browser: "Baiduspider", browserKey: "baiduspider", vendor: "Baidu", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    weight: 0.6, versions: ["2.0"],
  },
  {
    id: "yandexbot",
    browser: "YandexBot", browserKey: "yandexbot", vendor: "Yandex", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    weight: 0.4, versions: ["3.0"],
  },
  {
    id: "slurp",
    browser: "Slurp", browserKey: "slurp", vendor: "Yahoo", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
    weight: 0.2, versions: ["1.0"],
  },
  {
    id: "facebookbot",
    browser: "FacebookBot", browserKey: "facebookbot", vendor: "Meta", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    weight: 0.6, versions: ["1.1"],
  },
  {
    id: "twitterbot",
    browser: "Twitterbot", browserKey: "twitterbot", vendor: "X (Twitter)", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; Twitterbot/1.0)",
    weight: 0.3, versions: ["1.0"],
  },
  {
    id: "linkedinbot",
    browser: "LinkedInBot", browserKey: "linkedinbot", vendor: "LinkedIn", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "LinkedInBot/1.0 (compatible; Mozilla/5.0; +https://www.linkedin.com/help/linkedin/answer/86003)",
    weight: 0.2, versions: ["1.0"],
  },
  {
    id: "whatsapp",
    browser: "WhatsApp", browserKey: "whatsapp", vendor: "Meta", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "WhatsApp/2.23.20.0",
    weight: 0.5, versions: ["2.23.20.0", "2.24.10.0", "2.24.18.0"],
  },
  {
    id: "telegrambot",
    browser: "TelegramBot", browserKey: "telegrambot", vendor: "Telegram", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "TelegramBot (like TwitterBot)",
    weight: 0.2, versions: ["1.0"],
  },
  {
    id: "slackbot",
    browser: "Slackbot", browserKey: "slackbot", vendor: "Slack", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    weight: 0.3, versions: ["1.0"],
  },
  {
    id: "discordbot",
    browser: "Discordbot", browserKey: "discordbot", vendor: "Discord", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Discordbot/2.0 (+https://discordapp.com)",
    weight: 0.3, versions: ["2.0"],
  },
  {
    id: "applebot",
    browser: "AppleBot", browserKey: "applebot", vendor: "Apple", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
    weight: 0.2, versions: ["0.1", "0.2"],
  },
  {
    id: "ahrefsbot",
    browser: "AhrefsBot", browserKey: "ahrefsbot", vendor: "Ahrefs", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    weight: 0.4, versions: ["7.0", "7.1", "7.2"],
  },
  {
    id: "semrushbot",
    browser: "SemrushBot", browserKey: "semrushbot", vendor: "Semrush", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
    weight: 0.4, versions: ["7~bl", "7~ca", "7~uk"],
  },
  {
    id: "mj12bot",
    browser: "MJ12bot", browserKey: "mj12bot", vendor: "Majestic", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)",
    weight: 0.2, versions: ["v1.4.8", "v1.4.9"],
  },
  {
    id: "bytespider",
    browser: "Bytespider", browserKey: "bytespider", vendor: "ByteDance", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    weight: 0.4, versions: ["1.0"],
  },
  {
    id: "gptbot",
    browser: "GPTBot", browserKey: "gptbot", vendor: "OpenAI", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)",
    weight: 0.3, versions: ["1.0"],
  },
  {
    id: "claudebot",
    browser: "ClaudeBot", browserKey: "claudebot", vendor: "Anthropic", engine: "Blink",
    deviceClass: "bot", os: "(bot)", osFamily: "bot",
    template: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    weight: 0.3, versions: ["1.0"],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Bot detection table — used by the parser
// ──────────────────────────────────────────────────────────────────────────

export const BOTS: BotEntry[] = [
  { id: "googlebot",     name: "Googlebot",              vendor: "Google",    category: "search",  regex: /Googlebot\/([\d.]+)/i,            ua: "Googlebot/2.1" },
  { id: "googlebot",     name: "Googlebot Smartphone",   vendor: "Google",    category: "search",  regex: /Googlebot\-Smartphone/i,          ua: "Googlebot/2.1" },
  { id: "bingbot",       name: "Bingbot",                vendor: "Microsoft", category: "search",  regex: /bingbot\/([\d.]+)/i,              ua: "bingbot/2.0" },
  { id: "duckduckbot",   name: "DuckDuckBot",            vendor: "DuckDuckGo",category: "search",  regex: /DuckDuckBot\/([\d.]+)/i,          ua: "DuckDuckBot/1.1" },
  { id: "baiduspider",   name: "Baiduspider",            vendor: "Baidu",     category: "search",  regex: /Baiduspider\/([\d.]+)/i,          ua: "Baiduspider/2.0" },
  { id: "yandexbot",     name: "YandexBot",              vendor: "Yandex",    category: "search",  regex: /YandexBot\/([\d.]+)/i,            ua: "YandexBot/3.0" },
  { id: "slurp",         name: "Slurp",                  vendor: "Yahoo",     category: "search",  regex: /Yahoo!\s*Slurp/i,                  ua: "Slurp" },
  { id: "applebot",      name: "AppleBot",               vendor: "Apple",     category: "search",  regex: /Applebot\/([\d.]+)/i,             ua: "Applebot/0.1" },
  { id: "facebookbot",   name: "FacebookBot",            vendor: "Meta",      category: "social",  regex: /facebookexternalhit\/([\d.]+)/i,  ua: "facebookexternalhit/1.1" },
  { id: "twitterbot",    name: "Twitterbot",             vendor: "X",         category: "social",  regex: /Twitterbot\/([\d.]+)/i,           ua: "Twitterbot/1.0" },
  { id: "linkedinbot",   name: "LinkedInBot",            vendor: "LinkedIn",  category: "social",  regex: /LinkedInBot\/([\d.]+)/i,          ua: "LinkedInBot/1.0" },
  { id: "whatsapp",      name: "WhatsApp",               vendor: "Meta",      category: "social",  regex: /WhatsApp\/([\d.]+)/i,             ua: "WhatsApp/2.23.20.0" },
  { id: "telegrambot",   name: "TelegramBot",            vendor: "Telegram",  category: "social",  regex: /TelegramBot/i,                    ua: "TelegramBot" },
  { id: "slackbot",      name: "Slackbot",               vendor: "Slack",     category: "social",  regex: /Slackbot[\-\s]LinkExpanding/i,    ua: "Slackbot-LinkExpanding" },
  { id: "discordbot",    name: "Discordbot",             vendor: "Discord",   category: "social",  regex: /Discordbot\/([\d.]+)/i,           ua: "Discordbot/2.0" },
  { id: "ahrefsbot",     name: "AhrefsBot",              vendor: "Ahrefs",    category: "seo",     regex: /AhrefsBot\/([\d.]+)/i,            ua: "AhrefsBot/7.0" },
  { id: "semrushbot",    name: "SemrushBot",             vendor: "Semrush",   category: "seo",     regex: /SemrushBot\/([\d.~\w]+)/i,        ua: "SemrushBot/7~bl" },
  { id: "mj12bot",       name: "MJ12bot",                vendor: "Majestic",  category: "seo",     regex: /MJ12bot\/(v[\d.]+)/i,             ua: "MJ12bot/v1.4.8" },
  { id: "bytespider",    name: "Bytespider",             vendor: "ByteDance", category: "scraper", regex: /Bytespider/i,                     ua: "Bytespider" },
  { id: "gptbot",        name: "GPTBot",                 vendor: "OpenAI",    category: "ai",      regex: /GPTBot\/([\d.]+)/i,               ua: "GPTBot/1.0" },
  { id: "claudebot",     name: "ClaudeBot",              vendor: "Anthropic", category: "ai",      regex: /ClaudeBot\/([\d.]+)/i,            ua: "ClaudeBot/1.0" },
  { id: "ccbot",         name: "CCBot",                  vendor: "Common Crawl", category: "ai",   regex: /CCBot\/([\d.]+)/i,                ua: "CCBot/2.0" },
  { id: "perplexitybot", name: "PerplexityBot",          vendor: "Perplexity",category: "ai",      regex: /PerplexityBot/i,                  ua: "PerplexityBot" },
];

// ──────────────────────────────────────────────────────────────────────────
// PRNG — mulberry32 (seedable) + FNV-1a hash
// ──────────────────────────────────────────────────────────────────────────

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned 32-bit
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element from a non-empty array. */
export function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("pickRandom: empty array");
  return arr[Math.floor(rng() * arr.length)];
}

/** Pick a weighted element. Each entry has a weight accessor. */
export function pickWeighted<T>(arr: readonly T[], weightFn: (t: T) => number, rng: () => number): T {
  if (arr.length === 0) throw new Error("pickWeighted: empty array");
  const total = arr.reduce((s, x) => s + Math.max(0, weightFn(x)), 0);
  if (total <= 0) return pickRandom(arr, rng);
  let r = rng() * total;
  for (const x of arr) {
    const w = Math.max(0, weightFn(x));
    if (r < w) return x;
    r -= w;
  }
  return arr[arr.length - 1];
}

// ──────────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────────

export function validateOptions(opts: GenerateOptions): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(opts.count) || opts.count < 1) {
    return { ok: false, error: "Count must be at least 1." };
  }
  if (opts.count > MAX_COUNT) {
    return { ok: false, error: `Count must not exceed ${MAX_COUNT.toLocaleString()}.` };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────────────────────────────────

export function filterTemplates(opts: GenerateOptions): UATemplate[] {
  return UA_TEMPLATES.filter((t) => {
    if (opts.deviceClass && opts.deviceClass !== "any" && t.deviceClass !== opts.deviceClass) return false;
    if (opts.browserKey && t.browserKey !== opts.browserKey) return false;
    if (opts.osFamily && t.osFamily !== opts.osFamily) return false;
    return true;
  });
}

/** Fill in {bver} and {over} placeholders on a template. */
export function fillTemplate(t: UATemplate, rng: () => number): string {
  const bver = pickRandom(t.versions, rng);
  let out = t.template.replace(/\{bver\}/g, bver);
  if (t.osVersions && t.osVersions.length > 0) {
    const over = pickRandom(t.osVersions, rng);
    out = out.replace(/\{over\}/g, over);
  } else {
    // Strip remaining {over}
    out = out.replace(/\{over\}/g, "");
  }
  return out;
}

/** Generate a single UA from the catalog (no filtering). */
export function generateOne(opts: GenerateOptions, rng: () => number): GeneratedUA {
  const pool = filterTemplates(opts);
  const t = pickWeighted(pool, (x) => x.weight, rng);
  return { ua: fillTemplate(t, rng), template: t };
}

/** Generate a list of UAs (deterministic when seed is provided). */
export function generateList(opts: GenerateOptions): GeneratedUA[] {
  const v = validateOptions(opts);
  if (!v.ok) return [];
  const seed = opts.seed && opts.seed.length > 0 ? fnv1a(opts.seed) : (Math.random() * 0xffffffff) >>> 0;
  const rng = mulberry32(seed);
  const out: GeneratedUA[] = [];
  for (let i = 0; i < opts.count; i++) {
    out.push(generateOne(opts, rng));
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Parsing
// ──────────────────────────────────────────────────────────────────────────

export interface BotMatch {
  id: string;
  name: string;
  vendor: string;
  category: string;
  version: string | null;
}

/** Detect a bot in a UA string. Returns null if not a bot. */
export function detectBot(ua: string): BotMatch | null {
  if (!ua) return null;
  for (const b of BOTS) {
    const m = ua.match(b.regex);
    if (m) {
      return {
        id: b.id, name: b.name, vendor: b.vendor,
        category: b.category,
        version: m[1] ?? null,
      };
    }
  }
  return null;
}

/** Detect headless browsers (HeadlessChrome, PhantomJS, SlimerJS, etc.). */
export function detectHeadless(ua: string): boolean {
  if (!ua) return false;
  return /HeadlessChrome|PhantomJS|SlimerJS|Electron|Puppeteer|playwright/i.test(ua);
}

interface BrowserMatch {
  name: string;
  version: string | null;
  major: number | null;
}

/** Match browser name + version. Ordered: most-specific first. */
const BROWSER_PATTERNS: { name: string; regex: RegExp; verGroup?: number }[] = [
  { name: "Edge",          regex: /Edg(?:e|A|iOS)?\/([\d.]+)/i },
  { name: "Opera",         regex: /OPR\/([\d.]+)/i },
  { name: "Opera",         regex: /Opera\/([\d.]+)/i },
  { name: "Vivaldi",       regex: /Vivaldi\/([\d.]+)/i },
  { name: "Samsung Internet", regex: /SamsungBrowser\/([\d.]+)/i },
  { name: "UC Browser",    regex: /UCBrowser\/([\d.]+)/i },
  { name: "QQ Browser",    regex: /MQQBrowser\/([\d.]+)/i },
  { name: "Brave",         regex: /Brave\/([\d.]+)/i },
  { name: "Chrome iOS",    regex: /CriOS\/([\d.]+)/i },
  { name: "Firefox iOS",   regex: /FxiOS\/([\d.]+)/i },
  { name: "Edge iOS",      regex: /EdgiOS\/([\d.]+)/i },
  { name: "Chrome",        regex: /Chrome\/([\d.]+)/i },
  { name: "Firefox",       regex: /Firefox\/([\d.]+)/i },
  { name: "Safari",        regex: /Version\/([\d.]+).*Safari\//i },
  { name: "Safari",        regex: /Safari\/([\d.]+)/i },
  { name: "Internet Explorer", regex: /MSIE\s([\d.]+)/i },
  { name: "Internet Explorer", regex: /Trident\/[\d.]+.*rv:([\d.]+)/i },
];

function matchBrowser(ua: string): BrowserMatch {
  for (const p of BROWSER_PATTERNS) {
    const m = ua.match(p.regex);
    if (m) {
      const v = m[1] ?? null;
      const major = v ? parseInt(v.split(".")[0], 10) : null;
      return { name: p.name, version: v, major: Number.isFinite(major) ? major : null };
    }
  }
  return { name: "Unknown", version: null, major: null };
}

interface OsMatch {
  name: string;
  version: string | null;
  family: string;
}

/** Match operating system from the UA comment section. */
function matchOs(ua: string): OsMatch {
  if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT\s([\d.]+)/);
    let v = m ? m[1] : null;
    let name = "Windows";
    if (v === "10.0") {
      // Windows 11 also reports 10.0; can't reliably distinguish without Client Hints
      name = "Windows 10/11";
    } else if (v === "6.3") { name = "Windows 8.1"; }
    else if (v === "6.2") { name = "Windows 8"; }
    else if (v === "6.1") { name = "Windows 7"; }
    else if (v === "6.0") { name = "Windows Vista"; }
    else if (v === "5.1") { name = "Windows XP"; }
    return { name, version: v, family: "windows" };
  }
  if (/iPhone|CPU iPhone OS/.test(ua)) {
    const m = ua.match(/iPhone OS\s([\d_]+)/);
    const v = m ? m[1].replace(/_/g, ".") : null;
    return { name: "iOS", version: v, family: "ios" };
  }
  if (/iPad|CPU OS/.test(ua)) {
    const m = ua.match(/CPU OS\s([\d_]+)/);
    const v = m ? m[1].replace(/_/g, ".") : null;
    return { name: "iPadOS", version: v, family: "ipados" };
  }
  if (/Mac OS X|Macintosh/.test(ua)) {
    // Some UAs use underscores (10_15_7), others use dots (14.0). Accept both.
    const m = ua.match(/Mac OS X\s([\d_.]+)/);
    const v = m ? m[1].replace(/_/g, ".").replace(/\.$/, "") : null;
    return { name: "macOS", version: v, family: "macos" };
  }
  if (/Android/.test(ua)) {
    const m = ua.match(/Android\s([\d.]+)/);
    return { name: "Android", version: m ? m[1] : null, family: "android" };
  }
  if (/CrOS/.test(ua)) {
    return { name: "Chrome OS", version: null, family: "chromeos" };
  }
  if (/FreeBSD/.test(ua)) {
    const m = ua.match(/FreeBSD\s([\d.]+)/);
    return { name: "FreeBSD", version: m ? m[1] : null, family: "freebsd" };
  }
  if (/OpenBSD/.test(ua)) {
    return { name: "OpenBSD", version: null, family: "openbsd" };
  }
  if (/Linux|x11|X11/.test(ua)) {
    return { name: "Linux", version: null, family: "linux" };
  }
  return { name: "Unknown", version: null, family: "unknown" };
}

interface DeviceMatch {
  type: DeviceClass | "unknown";
  model: string | null;
  vendor: string | null;
}

function matchDevice(ua: string): DeviceMatch {
  // iPhone
  if (/iPhone/.test(ua)) return { type: "mobile", model: "iPhone", vendor: "Apple" };
  // iPad (some UAs report as Macintosh since iPadOS 13)
  if (/iPad/.test(ua)) return { type: "tablet", model: "iPad", vendor: "Apple" };
  // Android phone — try to extract model
  if (/Android/.test(ua)) {
    const m = ua.match(/Android\s[\d.]+;\s*([^);]+?)(?:\sBuild|\))/);
    const model = m ? m[1].trim() : null;
    let vendor: string | null = null;
    if (model) {
      if (/^SM-|^SAMSUNG|Galaxy/i.test(model)) vendor = "Samsung";
      else if (/^Pixel/i.test(model)) vendor = "Google";
      else if (/^Redmi|^Mi\s|Xiaomi/i.test(model)) vendor = "Xiaomi";
      else if (/^PRA|^PCT|^ALP|Huawei/i.test(model)) vendor = "Huawei";
      else if (/^CPH|^PGKM|OPPO/i.test(model)) vendor = "OPPO";
      else if (/^OnePlus/i.test(model)) vendor = "OnePlus";
      else if (/^LG/i.test(model)) vendor = "LG";
      else if (/^Nexus/i.test(model)) vendor = "Google";
    }
    const type: DeviceClass = /Tablet/.test(ua) ? "tablet" : "mobile";
    return { type, model, vendor };
  }
  // Windows Phone
  if (/Windows Phone|IEMobile/.test(ua)) {
    return { type: "mobile", model: null, vendor: "Microsoft" };
  }
  // PlayStation
  if (/PlayStation/.test(ua)) {
    const m = ua.match(/PlayStation\s(\d)/);
    return { type: "console", model: m ? `PlayStation ${m[1]}` : "PlayStation", vendor: "Sony" };
  }
  if (/Xbox/.test(ua)) {
    return { type: "console", model: "Xbox", vendor: "Microsoft" };
  }
  if (/Nintendo/.test(ua)) {
    return { type: "console", model: "Nintendo", vendor: "Nintendo" };
  }
  if (/webOS|Web0S/.test(ua)) {
    return { type: "tv", model: "LG TV", vendor: "LG" };
  }
  if (/Tizen|SmartTV/.test(ua)) {
    return { type: "tv", model: "Samsung TV", vendor: "Samsung" };
  }
  // Desktop
  if (/Windows|Macintosh|Mac OS X/.test(ua)) return { type: "desktop", model: null, vendor: null };
  if (/Linux|X11/.test(ua)) return { type: "desktop", model: null, vendor: null };
  return { type: "unknown", model: null, vendor: null };
}

interface EngineMatch {
  name: string;
  version: string | null;
}

function matchEngine(ua: string): EngineMatch {
  // Trident (IE) must be checked BEFORE Gecko because IE11's UA ends with
  // "like Gecko" and includes "rv:11.0", which would otherwise match the
  // Gecko branch.
  if (/Trident/.test(ua)) {
    const m = ua.match(/Trident\/([\d.]+)/);
    return { name: "Trident", version: m ? m[1] : null };
  }
  if (/Gecko\//.test(ua) && !/AppleWebKit/.test(ua)) {
    const m = ua.match(/rv:([\d.]+)/);
    return { name: "Gecko", version: m ? m[1] : null };
  }
  if (/AppleWebKit/.test(ua)) {
    const m = ua.match(/AppleWebKit\/([\d.]+)/);
    // Chrome/Edge/Opera (28+) and recent Safari use Blink-derived WebKit;
    // Safari uses genuine WebKit. For display we still call it WebKit.
    return { name: "WebKit", version: m ? m[1] : null };
  }
  if (/Presto/.test(ua)) {
    const m = ua.match(/Presto\/([\d.]+)/);
    return { name: "Presto", version: m ? m[1] : null };
  }
  if (/KHTML/.test(ua)) {
    const m = ua.match(/KHTML\/([\d.]+)/);
    return { name: "KHTML", version: m ? m[1] : null };
  }
  if (/Goanna/.test(ua)) {
    const m = ua.match(/Goanna\/([\d.]+)/);
    return { name: "Goanna", version: m ? m[1] : null };
  }
  return { name: "Unknown", version: null };
}

function matchCpu(ua: string): { architecture: string } {
  if (/Win64; x64|WOW64|x86_64|x64/.test(ua)) return { architecture: "x64" };
  if (/Win32|i686|i386/.test(ua)) return { architecture: "x86" };
  if (/aarch64|arm64|ARM64/.test(ua)) return { architecture: "arm64" };
  if (/ARM/.test(ua)) return { architecture: "arm" };
  if (/ia64/.test(ua)) return { architecture: "ia64" };
  if (/iPhone|iPad/.test(ua)) return { architecture: "arm64" }; // Apple silicon since iPhone 5S
  if (/Android/.test(ua)) return { architecture: "arm" }; // most Android phones
  return { architecture: "unknown" };
}

/** Parse a UA string into its components. */
export function parseUA(ua: string): ParsedUA {
  const raw = ua ?? "";
  const bot = detectBot(raw);
  const browser = matchBrowser(raw);
  const os = matchOs(raw);
  const device = matchDevice(raw);
  const engine = matchEngine(raw);
  const cpu = matchCpu(raw);
  const isHeadless = detectHeadless(raw);
  const tokens = explainTokens(raw);
  return {
    browser,
    engine,
    os,
    device,
    cpu,
    bot: {
      isBot: bot !== null,
      name: bot?.name ?? null,
      vendor: bot?.vendor ?? null,
      category: bot?.category ?? null,
    },
    isHeadless,
    raw,
    tokens,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Token explanation
// ──────────────────────────────────────────────────────────────────────────

/** Explain each token in a UA string. */
export function explainTokens(ua: string): UAToken[] {
  const out: UAToken[] = [];
  if (!ua) return out;
  // Split into "Mozilla/x.y" prefix + comment + remainder
  const commentMatch = ua.match(/\(([^)]*)\)/);
  if (commentMatch) {
    const inside = commentMatch[1];
    const parts = inside.split(";").map((p) => p.trim());
    for (const p of parts) {
      if (!p) continue;
      out.push({ value: p, meaning: explainCommentToken(p) });
    }
  }
  // Tokens outside the comment
  const outside = ua.replace(/\([^)]*\)/, "").trim();
  const tokens = outside.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    out.push({ value: t, meaning: explainExternalToken(t) });
  }
  return out;
}

function explainCommentToken(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "compatible") return "Signals legacy compatibility mode (Mozilla/5.0 spoofing).";
  if (/^windows nt\s[\d.]+/.test(lower)) {
    const v = t.match(/([\d.]+)/)?.[1];
    const map: Record<string, string> = { "10.0": "Windows 10/11", "6.3": "Windows 8.1", "6.2": "Windows 8", "6.1": "Windows 7", "6.0": "Windows Vista", "5.1": "Windows XP" };
    return `Windows NT version ${v} → ${map[v ?? ""] ?? "Windows"}.`;
  }
  if (lower === "win64; x64") return "64-bit Windows on x64 CPU.";
  if (lower === "wow64") return "32-bit browser running on 64-bit Windows (WOW64 thunking).";
  if (lower === "win32") return "32-bit Windows API subsystem.";
  if (/^macintosh/.test(lower)) return "Macintosh device class.";
  if (/^intel mac os x/.test(lower)) {
    const v = t.match(/([\d_]+)/)?.[1];
    return `macOS (Intel) version ${v?.replace(/_/g, ".") ?? "?"}.`;
  }
  if (/^iphone$/.test(lower)) return "Apple iPhone device class.";
  if (/^cpu iphone os/.test(lower)) {
    const v = t.match(/([\d_]+)/)?.[1];
    return `iOS version ${v?.replace(/_/g, ".") ?? "?"}.`;
  }
  if (/^cpu os/.test(lower)) {
    const v = t.match(/([\d_]+)/)?.[1];
    return `iPadOS version ${v?.replace(/_/g, ".") ?? "?"}.`;
  }
  if (/^ipad$/.test(lower)) return "Apple iPad device class.";
  if (/^linux$/.test(lower)) return "Linux kernel (distribution unknown).";
  if (/^linux;\s*u;/i.test(t)) return "Linux (UC Browser convention).";
  if (/^x11;\s*linux/.test(lower)) return "Linux on x11 window system.";
  if (/^x11;\s*linux\s*x86_64/.test(lower)) return "Linux on 64-bit x86 CPU.";
  if (/^x11;\s*linux\s*i686/.test(lower)) return "Linux on 32-bit x86 CPU.";
  if (/^x11;\s*linux\s*aarch64/.test(lower)) return "Linux on 64-bit ARM CPU.";
  if (/^x11;\s*cros/.test(lower)) return "Chrome OS (Chromebook).";
  if (/android\s[\d.]+/.test(lower)) {
    const v = t.match(/([\d.]+)/)?.[1];
    return `Android version ${v}.`;
  }
  if (/^android$/.test(lower)) return "Android OS.";
  if (/^freebsd/.test(lower)) return "FreeBSD Unix-like OS.";
  if (/^u;/.test(lower)) return "Legacy " + '"' + "US-encrypted" + '"' + " compatibility flag.";
  if (/^like mac os x$/.test(lower)) return "Mobile variant mimics Mac OS X UA convention.";
  if (/^khtml, like gecko$/.test(lower)) return "KHTML engine (Konqueror heritage) advertises Gecko compatibility.";
  if (lower.startsWith("en-us") || lower.startsWith("en-gb") || /^[a-z]{2}-[a-z]{2}$/.test(lower)) return `Locale hint: ${t}.`;
  if (/^samsung\s/i.test(t)) return "Samsung device identifier (model code follows).";
  if (/^(sm-|gt-|sgh-|sgh)/i.test(t)) return "Samsung device model code.";
  if (/^pixel/.test(lower)) return "Google Pixel device model.";
  if (/^redmi|^mi\s/.test(lower)) return "Xiaomi device model.";
  if (/^huawei|^pra|^alp|^pct/i.test(t)) return "Huawei device model.";
  if (/^cph|^pgkm/i.test(t)) return "OPPO device model.";
  if (/^nexus/i.test(t)) return "Google Nexus device model.";
  if (/^build\//i.test(t)) return "Android build identifier (factory image tag).";
  if (/^hmscore$/.test(lower)) return "Huawei Mobile Services Core (replaces Google Play Services).";
  if (/^\+https?:\/\//i.test(t)) return "Crawler contact URL (bot convention).";
  if (/^wv$/i.test(t)) return "Android WebView (in-app browser).";
  return "Unrecognized comment token.";
}

function explainExternalToken(t: string): string {
  if (/^Mozilla\/[\d.]+$/i.test(t)) return "Historic Mozilla compatibility prefix (always " + '"' + "Mozilla/5.0" + '"' + " for compatibility).";
  if (/^AppleWebKit\/[\d.]+/i.test(t)) return "WebKit layout engine version.";
  if (/^Chrome\/[\d.]+/i.test(t)) return "Chromium engine version (also used by Edge, Opera, Brave, Vivaldi).";
  if (/^Safari\/[\d.]+/i.test(t)) return "Safari build number (kept for legacy compatibility even on Chrome).";
  if (/^Firefox\/[\d.]+/i.test(t)) return "Firefox browser version.";
  if (/^CriOS\/[\d.]+/i.test(t)) return "Chrome on iOS version (must use WebKit under App Store rules).";
  if (/^FxiOS\/[\d.]+/i.test(t)) return "Firefox on iOS version.";
  if (/^EdgiOS\/[\d.]+/i.test(t)) return "Edge on iOS version.";
  if (/^Edg\/[\d.]+/i.test(t)) return "Microsoft Edge (Chromium) version.";
  if (/^EdgA\/[\d.]+/i.test(t)) return "Microsoft Edge for Android version.";
  if (/^OPR\/[\d.]+/i.test(t)) return "Opera (Chromium) version.";
  if (/^Opera\/[\d.]+/i.test(t)) return "Opera (Presto/legacy) version.";
  if (/^Vivaldi\/[\d.]+/i.test(t)) return "Vivaldi browser version.";
  if (/^SamsungBrowser\/[\d.]+/i.test(t)) return "Samsung Internet browser version.";
  if (/^UCBrowser\/[\d.]+/i.test(t)) return "UC Browser version.";
  if (/^MQQBrowser\/[\d.]+/i.test(t)) return "QQ Browser version.";
  if (/^Brave\/[\d.]+/i.test(t)) return "Brave browser version.";
  if (/^Version\/[\d.]+/i.test(t)) return "Safari/WebKit feature version (used by Safari, ignored by Chrome).";
  if (/^Mobile\/[\d.]+/i.test(t)) return "iOS build number (CFBundleVersion).";
  if (/^rv:[\d.]+/i.test(t)) return "Gecko engine revision (Firefox/IE).";
  if (/^Gecko\/[\d.]+/i.test(t)) return "Gecko layout engine build date.";
  if (/^Trident\/[\d.]+/i.test(t)) return "Trident engine version (Internet Explorer).";
  if (/^KHTML\/[\d.]+/i.test(t)) return "KHTML layout engine version (Konqueror/Safari heritage).";
  if (/^Presto\/[\d.]+/i.test(t)) return "Presto engine version (legacy Opera).";
  if (/^YaBrowser\/[\d.]+/i.test(t)) return "Yandex Browser version.";
  if (/^U3\/[\d.]+/i.test(t)) return "UC Browser U3 engine identifier.";
  if (/^TBS\/[\d.]+/i.test(t)) return "Tencent Browsing Service kernel version.";
  if (/^UC/.test(t)) return "UC Browser identifier.";
  if (/^WhatsApp\/[\d.]+/i.test(t)) return "WhatsApp in-app crawler version.";
  if (/^facebookexternalhit\/[\d.]+/i.test(t)) return "Facebook link-preview crawler.";
  if (/^Twitterbot\/[\d.]+/i.test(t)) return "Twitter link-preview crawler.";
  if (/^LinkedInBot\/[\d.]+/i.test(t)) return "LinkedIn link-preview crawler.";
  if (/^Discordbot\/[\d.]+/i.test(t)) return "Discord link-preview crawler.";
  if (/^Slackbot/i.test(t)) return "Slack link-expanding crawler.";
  if (/^GPTBot\/[\d.]+/i.test(t)) return "OpenAI GPTBot crawler.";
  if (/^ClaudeBot\/[\d.]+/i.test(t)) return "Anthropic ClaudeBot crawler.";
  if (/^CCBot\/[\d.]+/i.test(t)) return "Common Crawl bot.";
  if (/^PerplexityBot/i.test(t)) return "Perplexity AI crawler.";
  if (/^Bytespider/i.test(t)) return "ByteDance (TikTok) crawler.";
  if (/^AhrefsBot\/[\d.]+/i.test(t)) return "Ahrefs SEO crawler.";
  if (/^SemrushBot\/[\d.~\w]+/i.test(t)) return "Semrush SEO crawler.";
  if (/^MJ12bot\/v[\d.]+/i.test(t)) return "Majestic SEO crawler.";
  if (/^Applebot\/[\d.]+/i.test(t)) return "Apple crawler.";
  return "Unrecognized token.";
}

// ──────────────────────────────────────────────────────────────────────────
// Exporters
// ──────────────────────────────────────────────────────────────────────────

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render UAs as plain text (one per line). */
export function renderText(list: GeneratedUA[]): string {
  return list.map((g) => g.ua).join("\n");
}

/** Render UAs + parsed fields as CSV. */
export function renderCsv(list: GeneratedUA[]): string {
  const lines = ["user_agent,browser,browser_version,os,os_version,device_class,device_model,engine"];
  for (const g of list) {
    const p = parseUA(g.ua);
    lines.push([
      escapeCsv(g.ua),
      escapeCsv(p.browser.name),
      escapeCsv(p.browser.version ?? ""),
      escapeCsv(p.os.name),
      escapeCsv(p.os.version ?? ""),
      p.device.type,
      escapeCsv(p.device.model ?? ""),
      p.engine.name,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render UAs as a JSON array (raw UA strings). */
export function renderJson(list: GeneratedUA[]): string {
  return JSON.stringify(list.map((g) => g.ua), null, 2);
}

/** Render UAs as a Playwright-ready JS array with parsed fields. */
export function renderPlaywright(list: GeneratedUA[]): string {
  const items = list.map((g) => {
    const p = parseUA(g.ua);
    return `  {\n    userAgent: ${JSON.stringify(g.ua)},\n    deviceClass: ${JSON.stringify(p.device.type)},\n    browser: ${JSON.stringify(p.browser.name)},\n    os: ${JSON.stringify(p.os.name)},\n  }`;
  });
  return `export const USER_AGENTS = [\n${items.join(",\n")}\n];\n`;
}

/** Dispatch export by format. */
export function renderExport(list: GeneratedUA[], fmt: ExportFormat): string {
  switch (fmt) {
    case "txt": return renderText(list);
    case "csv": return renderCsv(list);
    case "json": return renderJson(list);
    case "playwright": return renderPlaywright(list);
  }
}

export function exportFilename(fmt: ExportFormat): string {
  switch (fmt) {
    case "txt": return "user-agents.txt";
    case "csv": return "user-agents.csv";
    case "json": return "user-agents.json";
    case "playwright": return "user-agents.ts";
  }
}

export function exportMime(fmt: ExportFormat): string {
  switch (fmt) {
    case "txt": return "text/plain";
    case "csv": return "text/csv";
    case "json": return "application/json";
    case "playwright": return "text/typescript";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Auto-detect current UA
// ──────────────────────────────────────────────────────────────────────────

/** Returns the current browser UA string if available. */
export function getCurrentUA(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent ?? "";
}

// ──────────────────────────────────────────────────────────────────────────
// History (localStorage)
// ──────────────────────────────────────────────────────────────────────────

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Shareable URL
// ──────────────────────────────────────────────────────────────────────────

export function buildShareUrl(opts: GenerateOptions, mode: "generate" | "parse", ua?: string): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (opts.count) params.set("count", String(opts.count));
  if (opts.deviceClass && opts.deviceClass !== "any") params.set("dc", opts.deviceClass);
  if (opts.browserKey) params.set("b", opts.browserKey);
  if (opts.osFamily) params.set("os", opts.osFamily);
  if (opts.seed) params.set("seed", opts.seed);
  if (mode === "parse" && ua) params.set("ua", ua);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  mode: "generate" | "parse";
  opts: GenerateOptions;
  ua: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const mode = (params.get("mode") === "parse" ? "parse" : "generate");
  const count = Number(params.get("count") ?? "1");
  const dc = params.get("dc");
  const validDc: DeviceClass[] = ["desktop", "mobile", "tablet", "bot", "console", "tv"];
  const opts: GenerateOptions = {
    count: Number.isFinite(count) && count > 0 ? Math.min(MAX_COUNT, Math.floor(count)) : 1,
    deviceClass: dc && validDc.includes(dc as DeviceClass) ? (dc as DeviceClass) : "any",
    browserKey: params.get("b") ?? undefined,
    osFamily: params.get("os") ?? undefined,
    seed: params.get("seed") ?? undefined,
  };
  return { mode, opts, ua: params.get("ua") ?? "" };
}

// ──────────────────────────────────────────────────────────────────────────
// Convenience — list of unique browsers and OSes for the UI dropdowns
// ──────────────────────────────────────────────────────────────────────────

export const BROWSER_OPTIONS: { value: string; label: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const t of UA_TEMPLATES) {
    if (!seen.has(t.browserKey)) seen.set(t.browserKey, t.browser);
  }
  return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
})();

export const OS_OPTIONS: { value: string; label: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const t of UA_TEMPLATES) {
    if (!seen.has(t.osFamily)) seen.set(t.osFamily, t.os);
  }
  return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
})();

export const DEVICE_CLASS_OPTIONS: { value: DeviceClass | "any"; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "bot", label: "Bot" },
  { value: "console", label: "Console" },
  { value: "tv", label: "TV" },
];

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "txt", label: "TXT (one per line)" },
  { value: "csv", label: "CSV (with parsed fields)" },
  { value: "json", label: "JSON (raw array)" },
  { value: "playwright", label: "Playwright TS array" },
];

/** Convenience: total template count. */
export function templateCount(): number {
  return UA_TEMPLATES.length;
}

/** Convenience: unique browser count. */
export function uniqueBrowserCount(): number {
  return new Set(UA_TEMPLATES.map((t) => t.browserKey)).size;
}

/** Convenience: bot count. */
export function botCount(): number {
  return BOTS.length;
}
