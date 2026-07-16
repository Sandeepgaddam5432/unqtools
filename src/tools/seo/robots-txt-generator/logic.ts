/**
 * Robots.txt Generator — pure logic.
 */

export interface RobotsRule {
  path: string;
  allow: boolean; // true = Allow, false = Disallow
}

export interface RobotsGroup {
  userAgent: string;
  rules: RobotsRule[];
  crawlDelay?: number;
}

export interface RobotsInput {
  groups: RobotsGroup[];
  sitemaps: string[];
  comments: string[];
}

export const USER_AGENT_PRESETS: { value: string; label: string; description: string }[] = [
  { value: "*", label: "All bots", description: "Default rule for any crawler" },
  { value: "Googlebot", label: "Googlebot", description: "Google's main web crawler" },
  { value: "Googlebot-Image", label: "Googlebot-Image", description: "Google image crawler" },
  { value: "Bingbot", label: "Bingbot", description: "Microsoft Bing crawler" },
  { value: "Slurp", label: "Slurp", description: "Yahoo crawler" },
  { value: "DuckDuckBot", label: "DuckDuckBot", description: "DuckDuckGo crawler" },
  { value: "Baiduspider", label: "Baiduspider", description: "Baidu crawler (China)" },
  { value: "YandexBot", label: "YandexBot", description: "Yandex crawler (Russia)" },
  { value: "facebookexternalhit", label: "facebookexternalhit", description: "Facebook crawler" },
  { value: "AhrefsBot", label: "AhrefsBot", description: "Ahrefs SEO crawler" },
  { value: "SemrushBot", label: "SemrushBot", description: "Semrush SEO crawler" },
  { value: "GPTBot", label: "GPTBot", description: "OpenAI crawler" },
];

export function isValidUserAgent(ua: string): boolean {
  return typeof ua === "string" && ua.trim().length > 0;
}

export function isValidPath(path: string): boolean {
  if (!path) return false;
  // Path must start with / or be empty (allowing all)
  return path.startsWith("/") || path === "";
}

export function isValidWildcardPath(path: string): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  // Check for valid wildcard usage — * and $ are special
  // Allow only one * and one $ at the end
  const starCount = (path.match(/\*/g) || []).length;
  if (starCount > 1) return false;
  if (path.includes("$") && !path.endsWith("$")) return false;
  return true;
}

export function isValidSitemapUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidCrawlDelay(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 30;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateInput(input: RobotsInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (input.groups.length === 0 && input.sitemaps.length === 0) {
    warnings.push("robots.txt is empty — consider at least one rule or sitemap directive");
  }
  for (let i = 0; i < input.groups.length; i++) {
    const g = input.groups[i];
    if (!isValidUserAgent(g.userAgent)) {
      errors.push(`Group #${i + 1} has an empty user-agent`);
    }
    for (let j = 0; j < g.rules.length; j++) {
      const r = g.rules[j];
      if (!isValidPath(r.path)) {
        errors.push(`Group #${i + 1} rule #${j + 1} path must start with /`);
      } else if (!isValidWildcardPath(r.path)) {
        warnings.push(`Group #${i + 1} rule #${j + 1} has invalid wildcard syntax: ${r.path}`);
      }
    }
    if (g.crawlDelay !== undefined && !isValidCrawlDelay(g.crawlDelay)) {
      errors.push(`Group #${i + 1} crawl-delay must be 0-30 seconds`);
    }
  }
  for (let i = 0; i < input.sitemaps.length; i++) {
    if (!isValidSitemapUrl(input.sitemaps[i])) {
      errors.push(`Sitemap #${i + 1} is not a valid URL`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function buildGroupBlock(group: RobotsGroup): string {
  const lines: string[] = [];
  lines.push(`User-agent: ${group.userAgent}`);
  for (const r of group.rules) {
    const verb = r.allow ? "Allow" : "Disallow";
    lines.push(`${verb}: ${r.path}`);
  }
  if (group.crawlDelay !== undefined) {
    lines.push(`Crawl-delay: ${group.crawlDelay}`);
  }
  return lines.join("\n");
}

export function generateRobotsTxt(input: RobotsInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const blocks: string[] = [];
  for (const comment of input.comments) {
    blocks.push(`# ${comment}`);
  }
  for (const g of input.groups) {
    blocks.push(buildGroupBlock(g));
  }
  if (input.sitemaps.length > 0) {
    blocks.push(input.sitemaps.map((s) => `Sitemap: ${s}`).join("\n"));
  }
  return blocks.join("\n\n");
}

export interface RobotsStats {
  groupCount: number;
  totalRules: number;
  sitemapCount: number;
  commentCount: number;
}

export function computeStats(input: RobotsInput): RobotsStats {
  return {
    groupCount: input.groups.length,
    totalRules: input.groups.reduce((sum, g) => sum + g.rules.length, 0),
    sitemapCount: input.sitemaps.length,
    commentCount: input.comments.length,
  };
}

/** Test whether a path matches a robots.txt pattern (with * and $). */
export function pathMatchesPattern(testPath: string, pattern: string): boolean {
  if (pattern === "" || pattern === "/") return true;
  // Convert pattern to regex
  let regex = pattern.replace(/\*/g, ".*");
  if (regex.endsWith("$")) {
    regex = regex.slice(0, -1);
    return new RegExp(`^${regex}$`).test(testPath);
  }
  return new RegExp(`^${regex}`).test(testPath);
}

/** Parse a raw robots.txt into structured input (best-effort). */
export function parseRobotsTxt(raw: string): RobotsInput {
  const input: RobotsInput = { groups: [], sitemaps: [], comments: [] };
  const lines = raw.split(/\n+/);
  let currentGroup: RobotsGroup | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      input.comments.push(line.slice(1).trim());
      continue;
    }
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const k = key.trim().toLowerCase();
    if (k === "user-agent") {
      if (currentGroup && currentGroup.rules.length > 0) {
        input.groups.push(currentGroup);
        currentGroup = null;
      }
      if (!currentGroup) {
        currentGroup = { userAgent: value, rules: [] };
      } else {
        // Multiple user-agent lines group together
        input.groups.push(currentGroup);
        currentGroup = { userAgent: value, rules: [] };
      }
      continue;
    }
    if (k === "allow" || k === "disallow") {
      if (!currentGroup) {
        currentGroup = { userAgent: "*", rules: [] };
      }
      currentGroup.rules.push({ path: value, allow: k === "allow" });
      continue;
    }
    if (k === "crawl-delay") {
      if (!currentGroup) currentGroup = { userAgent: "*", rules: [] };
      currentGroup.crawlDelay = parseFloat(value);
      continue;
    }
    if (k === "sitemap") {
      input.sitemaps.push(value);
      continue;
    }
  }
  if (currentGroup) input.groups.push(currentGroup);
  return input;
}

// ---- History ----
const HISTORY_KEY = "unqtools:robots-txt-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  snippet: string;
}

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
