/**
 * User Agent Parser — pure logic.
 * UAParser.js-grade regex parsing of User-Agent strings.
 */

export interface ParsedUA {
  browser: { name: string; version: string; major: string };
  engine: { name: string; version: string };
  os: { name: string; version: string };
  device: { vendor: string; model: string; type: string };
  cpu: { architecture: string };
  bot: { isBot: boolean; name: string; category: string };
  confidence: number; // 0..1
  raw: string;
}

export interface ClientHints {
  brands?: { brand: string; version: string }[];
  mobile?: boolean;
  platform?: string;
}

// === Browser detection regexes ===
const BROWSER_REGEXES: { name: string; regex: RegExp }[] = [
  { name: "Edge", regex: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: "Opera", regex: /OPR\/([\d.]+)/ },
  { name: "Opera", regex: /Opera\/([\d.]+)/ },
  { name: "Vivaldi", regex: /Vivaldi\/([\d.]+)/ },
  { name: "Brave", regex: /Brave\/([\d.]+)/ },
  { name: "Samsung Internet", regex: /SamsungBrowser\/([\d.]+)/ },
  { name: "Chrome", regex: /Chrome\/([\d.]+)/ },
  { name: "Firefox", regex: /Firefox\/([\d.]+)/ },
  { name: "Safari", regex: /Version\/([\d.]+).*Safari/ },
  { name: "Internet Explorer", regex: /(?:MSIE|Trident\/.*rv:)([\d.]+)/ },
];

// === OS detection ===
const OS_REGEXES: { name: string; regex: RegExp }[] = [
  { name: "Windows", regex: /Windows NT ([\d.]+)/ },
  { name: "macOS", regex: /Mac OS X ([\d_]+)/ },
  { name: "iOS", regex: /(?:iPhone|iPad|iPod).*OS ([\d_]+)/ },
  { name: "Android", regex: /Android ([\d.]+)/ },
  { name: "Linux", regex: /Linux/ },
  { name: "Chrome OS", regex: /CrOS/ },
  { name: "FreeBSD", regex: /FreeBSD/ },
];

// === Engine detection ===
const ENGINE_REGEXES: { name: string; regex: RegExp }[] = [
  { name: "Blink", regex: /Chrome\/([\d.]+)/ },
  { name: "Gecko", regex: /rv:([\d.]+).*Gecko/ },
  { name: "WebKit", regex: /AppleWebKit\/([\d.]+)/ },
  { name: "Trident", regex: /Trident\/([\d.]+)/ },
];

// === Bot detection ===
const BOT_REGEXES: { name: string; category: string; regex: RegExp }[] = [
  { name: "Googlebot", category: "Search", regex: /Googlebot\/([\d.]+)/ },
  { name: "Bingbot", category: "Search", regex: /bingbot\/([\d.]+)/ },
  { name: "DuckDuckBot", category: "Search", regex: /DuckDuckBot/ },
  { name: "YandexBot", category: "Search", regex: /YandexBot/ },
  { name: "Baiduspider", category: "Search", regex: /Baiduspider/ },
  { name: "GPTBot", category: "AI", regex: /GPTBot/ },
  { name: "ClaudeBot", category: "AI", regex: /ClaudeBot/ },
  { name: "ChatGPT-User", category: "AI", regex: /ChatGPT-User/ },
  { name: "PerplexityBot", category: "AI", regex: /PerplexityBot/ },
  { name: "Bytespider", category: "AI", regex: /Bytespider/ },
  { name: "Slackbot", category: "Social", regex: /Slackbot/ },
  { name: "Discordbot", category: "Social", regex: /Discordbot/ },
  { name: "TelegramBot", category: "Social", regex: /TelegramBot/ },
  { name: "WhatsApp", category: "Social", regex: /WhatsApp/ },
  { name: "curl", category: "Tool", regex: /curl\/([\d.]+)/ },
  { name: "Wget", category: "Tool", regex: /Wget\/([\d.]+)/ },
  { name: "Postman", category: "Tool", regex: /PostmanRuntime/ },
];

// === Device detection ===
const DEVICE_REGEXES: { vendor: string; model: string; type: string; regex: RegExp }[] = [
  { vendor: "Apple", model: "iPhone", type: "mobile", regex: /iPhone/ },
  { vendor: "Apple", model: "iPad", type: "tablet", regex: /iPad/ },
  { vendor: "Apple", model: "iPod", type: "mobile", regex: /iPod/ },
  { vendor: "Samsung", model: "Galaxy", type: "mobile", regex: /Android.*Samsung|SM-/ },
  { vendor: "Google", model: "Pixel", type: "mobile", regex: /Pixel/ },
  { vendor: "Microsoft", model: "Surface", type: "tablet", regex: /Surface/ },
];

export function parseUserAgent(ua: string, hints?: ClientHints): ParsedUA {
  const result: ParsedUA = {
    browser: { name: "Unknown", version: "", major: "" },
    engine: { name: "Unknown", version: "" },
    os: { name: "Unknown", version: "" },
    device: { vendor: "", model: "", type: "desktop" },
    cpu: { architecture: "" },
    bot: { isBot: false, name: "", category: "" },
    confidence: 0.5,
    raw: ua,
  };

  if (!ua || typeof ua !== "string") {
    result.confidence = 0;
    return result;
  }

  // Bot detection first
  for (const b of BOT_REGEXES) {
    const m = ua.match(b.regex);
    if (m) {
      result.bot.isBot = true;
      result.bot.name = b.name;
      result.bot.category = b.category;
      result.confidence = 0.95;
      break;
    }
  }

  // Browser detection
  for (const b of BROWSER_REGEXES) {
    const m = ua.match(b.regex);
    if (m) {
      result.browser.name = b.name;
      result.browser.version = m[1] || "";
      result.browser.major = (m[1] || "").split(".")[0];
      result.confidence = Math.max(result.confidence, 0.85);
      break;
    }
  }

  // Engine detection
  for (const e of ENGINE_REGEXES) {
    const m = ua.match(e.regex);
    if (m) {
      result.engine.name = e.name;
      result.engine.version = m[1] || "";
      break;
    }
  }

  // OS detection
  for (const o of OS_REGEXES) {
    const m = ua.match(o.regex);
    if (m) {
      result.os.name = o.name;
      result.os.version = (m[1] || "").replace(/_/g, ".");
      result.confidence = Math.max(result.confidence, 0.8);
      break;
    }
  }

  // Device detection
  for (const d of DEVICE_REGEXES) {
    if (d.regex.test(ua)) {
      result.device.vendor = d.vendor;
      result.device.model = d.model;
      result.device.type = d.type;
      break;
    }
  }

  // CPU architecture
  if (/WOW64|Win64|x64|x86_64/.test(ua)) result.cpu.architecture = "amd64";
  else if (/i386|i686/.test(ua)) result.cpu.architecture = "ia32";
  else if (/arm|aarch64/.test(ua)) result.cpu.architecture = "arm";
  else if (/Mac OS X.*Silicon|M1/.test(ua)) result.cpu.architecture = "arm64";

  // Client Hints override (more accurate for modern Chrome)
  if (hints?.brands && hints.brands.length > 0) {
    const realBrand = hints.brands.find((b) => !b.brand.startsWith("Not"));
    if (realBrand) {
      result.browser.name = realBrand.brand;
      result.browser.major = realBrand.version;
      result.confidence = Math.max(result.confidence, 0.95);
    }
  }
  if (hints?.mobile !== undefined) {
    result.device.type = hints.mobile ? "mobile" : "desktop";
    result.confidence = Math.max(result.confidence, 0.9);
  }
  if (hints?.platform) {
    result.os.name = hints.platform;
    result.confidence = Math.max(result.confidence, 0.9);
  }

  // Frozen UA detection (Chrome 100+)
  if (/Chrome\/(10[0-9]|1[1-9]\d|[2-9]\d\d)/.test(ua) && !hints?.brands) {
    result.confidence = Math.min(result.confidence, 0.7);
  }

  return result;
}

export function buildUserAgent(parts: {
  browser: { name: string; version: string };
  os: { name: string; version: string };
  device?: { vendor: string; model: string; type: string };
  engine?: { name: string; version: string };
}): string {
  const parts_arr: string[] = [];
  const isMobile = parts.device?.type === "mobile";

  // Mozilla/5.0 prefix
  parts_arr.push("Mozilla/5.0");

  // OS part
  let osPart = "";
  if (parts.os.name === "Windows") {
    osPart = `Windows NT ${parts.os.version || "10.0"}`;
  } else if (parts.os.name === "macOS") {
    osPart = `Macintosh; Intel Mac OS X ${(parts.os.version || "10.15").replace(/\./g, "_")}`;
  } else if (parts.os.name === "iOS") {
    osPart = `iPhone; CPU iPhone OS ${parts.os.version || "16.0"} like Mac OS X`;
  } else if (parts.os.name === "Android") {
    osPart = `Android ${parts.os.version || "13"}`;
  } else if (parts.os.name === "Linux") {
    osPart = "X11; Linux x86_64";
  } else {
    osPart = parts.os.name || "Unknown";
  }
  parts_arr.push(`(${osPart})`);

  // Engine
  const engine = parts.engine?.name || "AppleWebKit";
  const engineVer = parts.engine?.version || "537.36";
  if (engine === "AppleWebKit") {
    parts_arr.push(`AppleWebKit/${engineVer} (KHTML, like Gecko)`);
  } else if (engine === "Gecko") {
    parts_arr.push(`rv:${engineVer}) Gecko/${engineVer}`);
  }

  // Browser
  if (parts.browser.name === "Chrome") {
    parts_arr.push(`Chrome/${parts.browser.version || "120.0.0.0"} Safari/537.36`);
  } else if (parts.browser.name === "Firefox") {
    parts_arr.push(`Firefox/${parts.browser.version || "120.0"}`);
  } else if (parts.browser.name === "Safari") {
    parts_arr.push(`Version/${parts.browser.version || "17.0"} Safari/605.1.15`);
  } else if (parts.browser.name === "Edge") {
    parts_arr.push(`Chrome/${parts.browser.version || "120.0.0.0"} Safari/537.36 Edg/${parts.browser.version || "120.0.0.0"}`);
  } else {
    parts_arr.push(parts.browser.name);
  }

  return parts_arr.join(" ");
}

export function bulkParse(uas: string): ParsedUA[] {
  return uas.split(/\r?\n/).filter((l) => l.trim()).map((l) => parseUserAgent(l.trim()));
}

export function getClientHints(): ClientHints | undefined {
  if (typeof navigator === "undefined" || !("userAgentData" in navigator)) return undefined;
  const uad = (navigator as any).userAgentData;
  if (!uad) return undefined;
  return {
    brands: uad.brands?.map((b: any) => ({ brand: b.brand, version: b.version })),
    mobile: uad.mobile,
    platform: uad.platform,
  };
}

export function getMyUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function exportParsed(results: ParsedUA[], format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify(results, null, 2);
  // CSV
  const headers = ["browser", "version", "os", "device", "type", "isBot", "botName", "confidence"];
  const rows = results.map((r) => [
    r.browser.name, r.browser.version, r.os.name, r.device.model, r.device.type,
    r.bot.isBot ? "yes" : "no", r.bot.name, r.confidence.toFixed(2),
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function isLikelySpoofed(ua: string): boolean {
  // Multiple browser signatures in one UA = spoofed
  let browserCount = 0;
  if (/Chrome\//.test(ua)) browserCount++;
  if (/Firefox\//.test(ua)) browserCount++;
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browserCount++;
  if (/MSIE|Trident\//.test(ua)) browserCount++;
  return browserCount > 1;
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "High";
  if (confidence >= 0.7) return "Medium";
  if (confidence >= 0.5) return "Low";
  return "Very Low";
}
