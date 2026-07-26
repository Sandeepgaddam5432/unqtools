/**
 * User-Agent Generator — pure logic.
 *
 * Generates realistic User-Agent strings for common browser + OS
 * combinations, bot UAs, and custom formats. Useful for testing,
 * scraping (legitimate), or populating test fixtures.
 */

export type BrowserType = "chrome" | "firefox" | "safari" | "edge" | "opera";
export type DeviceType = "windows" | "macos" | "linux" | "iphone" | "android" | "ipad";

export interface UaProfile {
  browser: BrowserType;
  device: DeviceType;
  /** Major version (e.g. "120"). */
  version: string;
}

export interface UaResult {
  ua: string;
  profile: UaProfile;
  isBot: boolean;
  warnings: string[];
}

const BROWSER_VERSIONS: Record<BrowserType, string[]> = {
  chrome: ["120", "121", "122", "123", "124", "125"],
  firefox: ["121", "122", "123", "124", "125"],
  safari: ["16", "17", "17.4", "17.5"],
  edge: ["120", "121", "122", "123"],
  opera: ["106", "107", "108", "109"],
};

const DEVICE_PLATFORM: Record<DeviceType, { platform: string; oscpu?: string; mobile?: boolean }> = {
  windows: { platform: "Win32", oscpu: "Windows NT 10.0; Win64; x64" },
  macos: { platform: "MacIntel", oscpu: "Intel Mac OS X 14_3" },
  linux: { platform: "Linux x86_64", oscpu: "Linux x86_64" },
  iphone: { platform: "iPhone", mobile: true },
  android: { platform: "Linux armv8l", mobile: true },
  ipad: { platform: "iPad", mobile: true },
};

export function listBrowserVersions(browser: BrowserType): string[] {
  return [...BROWSER_VERSIONS[browser]];
}

export function listDevices(): DeviceType[] {
  return Object.keys(DEVICE_PLATFORM) as DeviceType[];
}

export function listBrowsers(): BrowserType[] {
  return Object.keys(BROWSER_VERSIONS) as BrowserType[];
}

function buildChromeUa(profile: UaProfile): string {
  const plat = DEVICE_PLATFORM[profile.device];
  const v = profile.version;
  if (profile.device === "iphone" || profile.device === "ipad") {
    // iOS Chrome uses a Safari-like shell
    const ios = profile.device === "ipad" ? "CPU OS 17_4 like Mac OS X" : "CPU iPhone OS 17_4 like Mac OS X";
    return `Mozilla/5.0 (${profile.device === "ipad" ? "iPad" : "iPhone"}; ${ios}) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${v}.0.0.0 Mobile/15E148 Safari/604.1`;
  }
  if (profile.device === "android") {
    return `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Mobile Safari/537.36`;
  }
  const os = profile.device === "windows" ? "Windows NT 10.0; Win64; x64"
    : profile.device === "macos" ? "Macintosh; Intel Mac OS X 14_3"
      : "X11; Linux x86_64";
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`;
}

function buildFirefoxBrowser(profile: UaProfile): string {
  const v = profile.version;
  if (profile.device === "iphone" || profile.device === "ipad") {
    const ios = profile.device === "ipad" ? "CPU OS 17_4 like Mac OS X" : "CPU iPhone OS 17_4 like Mac OS X";
    return `Mozilla/5.0 (${profile.device === "ipad" ? "iPad" : "iPhone"}; ${ios}) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${v}.0 Mobile/15E148 Safari/605.1.15`;
  }
  if (profile.device === "android") {
    return `Mozilla/5.0 (Android 14; Mobile; rv:${v}.0) Gecko/${v}.0 Firefox/${v}.0`;
  }
  const os = profile.device === "windows" ? "Windows NT 10.0; Win64; x64"
    : profile.device === "macos" ? "Macintosh; Intel Mac OS X 14.3"
      : "X11; Linux x86_64";
  return `Mozilla/5.0 (${os}; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`;
}

function buildSafariUa(profile: UaProfile): string {
  const v = profile.version;
  if (profile.device === "iphone") {
    return `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Mobile/15E148 Safari/604.1`;
  }
  if (profile.device === "ipad") {
    return `Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Mobile/15E148 Safari/604.1`;
  }
  // macOS Safari
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Safari/605.1.15`;
}

function buildEdgeUa(profile: UaProfile): string {
  // Edge is Chromium-based; non-Windows falls back to Chrome-like
  const base = buildChromeUa({ ...profile, browser: "chrome" });
  return `${base} Edg/${profile.version}.0.0.0`;
}

function buildOperaUa(profile: UaProfile): string {
  const base = buildChromeUa({ ...profile, browser: "chrome" });
  return `${base} OPR/${profile.version}.0.0.0`;
}

export function generateUa(profile: UaProfile): UaResult | { error: string } {
  if (!BROWSER_VERSIONS[profile.browser]) return { error: `Unknown browser: ${profile.browser}` };
  if (!DEVICE_PLATFORM[profile.device]) return { error: `Unknown device: ${profile.device}` };
  if (!/^\d+(\.\d+)?$/.test(profile.version)) return { error: `Version "${profile.version}" is not numeric.` };

  const warnings: string[] = [];
  if ((profile.device === "iphone" || profile.device === "ipad") && profile.browser === "edge") {
    warnings.push("Edge on iOS uses the WebKit shell — UA may not be widely recognised.");
  }
  if (profile.device === "linux" && profile.browser === "safari") {
    warnings.push("Safari does not run on Linux — this UA is fictional.");
  }

  let ua: string;
  switch (profile.browser) {
    case "chrome": ua = buildChromeUa(profile); break;
    case "firefox": ua = buildFirefoxBrowser(profile); break;
    case "safari": ua = buildSafariUa(profile); break;
    case "edge": ua = buildEdgeUa(profile); break;
    case "opera": ua = buildOperaUa(profile); break;
  }

  return { ua, profile, isBot: false, warnings };
}

export interface BotProfile {
  name: string;
  /** URL the bot crawls from. */
  url: string;
}

export const BOTS: BotProfile[] = [
  { name: "Googlebot", url: "https://www.google.com/bot.html" },
  { name: "Bingbot", url: "https://www.bing.com/bingbot.htm" },
  { name: "DuckDuckBot", url: "https://duckduckgo.com/duckduckbot" },
  { name: "Slackbot", url: "https://api.slack.com/robots" },
  { name: "Twitterbot", url: "https://dev.twitter.com/docs/streaming-apis/parameters#stall_warnings" },
  { name: "facebookexternalhit", url: "https://www.facebook.com/externalhit_uatext.php" },
  { name: "LinkedInBot", url: "https://www.linkedin.com/help/linkedin/answer/86003" },
  { name: "WhatsApp", url: "https://www.whatsapp.com/" },
  { name: "TelegramBot", url: "https://telegram.org/" },
  { name: "Discordbot", url: "https://discordapp.com/" },
];

export function generateBotUa(name: string, url: string): UaResult {
  return {
    ua: `Mozilla/5.0 (compatible; ${name}/2.1; +${url})`,
    profile: { browser: "chrome", device: "linux", version: "0" },
    isBot: true,
    warnings: [],
  };
}

/** Custom UA builder. */
export function generateCustomUa(tokens: { mozilla?: string; os?: string; engine?: string; browser?: string }): UaResult {
  const parts: string[] = [];
  parts.push(`Mozilla/5.0 (${tokens.os ?? "Windows NT 10.0; Win64; x64"})`);
  if (tokens.engine) parts.push(tokens.engine);
  if (tokens.browser) parts.push(tokens.browser);
  return { ua: parts.join(" "), profile: { browser: "chrome", device: "windows", version: "0" }, isBot: false, warnings: [] };
}

/** Generate a batch of UAs across all browser × device combos for the latest version of each browser. */
export function generateBatch(): UaResult[] {
  const out: UaResult[] = [];
  for (const browser of listBrowsers()) {
    const versions = listBrowserVersions(browser);
    const latest = versions[versions.length - 1]!;
    for (const device of listDevices()) {
      // Skip unsupported combos
      if (device === "linux" && browser === "safari") continue;
      const r = generateUa({ browser, device, version: latest });
      if (!("error" in r)) out.push(r);
    }
  }
  return out;
}

/** Convert a batch to a plain-text list. */
export function batchToText(results: UaResult[]): string {
  return results.map((r) => r.ua).join("\n");
}
