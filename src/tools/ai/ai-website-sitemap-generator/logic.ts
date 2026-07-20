/**
 * AI Website Sitemap Generator — pure logic.
 *
 * Site-type templates (blog, e-commerce, SaaS, portfolio, docs), paste-URL mode,
 * merge mode, exclude-pattern filters, per-URL overrides, valid XML sitemap with
 * priority/changefreq/lastmod, HTML sitemap, visual tree render, sitemap-index
 * auto-split at 50k URLs, image + hreflang (multilingual) entries, stats,
 * history (localStorage), shareable URL, optional BYO-key LLM.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type SiteType = "blog" | "ecommerce" | "saas" | "portfolio" | "docs";

export type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapUrl {
  loc: string;
  lastmod?: string;          // ISO date (YYYY-MM-DD)
  changefreq: ChangeFreq;
  priority: number;          // 0.0 - 1.0
  images?: string[];         // image sitemap entries
  alternates?: Alternate[];  // hreflang (multilingual) entries
  depth: number;             // path depth (home = 0)
  section: string;           // first path segment, or "root"
}

export interface Alternate {
  hreflang: string;
  href: string;
}

export interface UrlOverride {
  loc: string;
  priority?: number;
  changefreq?: ChangeFreq;
  lastmod?: string;
}

export interface SitemapTree {
  loc: string;
  children: SitemapTree[];
  url?: SitemapUrl;
}

export interface SitemapStats {
  total: number;
  bySection: Record<string, number>;
  byDepth: Record<number, number>;
  byChangefreq: Record<ChangeFreq, number>;
  withImages: number;
  withAlternates: number;
  avgPriority: number;
}

export interface SitemapResult {
  urls: SitemapUrl[];
  tree: SitemapTree;
  stats: SitemapStats;
  chunked: SitemapUrl[][];        // split into chunks of MAX_URLS_PER_SITEMAP
  needsIndex: boolean;
}

export interface ShareState {
  siteType: SiteType;
  customUrls: string;
  excludes: string;
  defaultLastmod: string;
  useTemplate: boolean;
}

export interface HistoryEntry {
  ts: number;
  siteType: SiteType;
  urlCount: number;
  chunkCount: number;
  needsIndex: boolean;
  topSection: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-website-sitemap-generator:history";
export const HISTORY_MAX = 20;
export const MAX_URLS_PER_SITEMAP = 50000;
export const MAX_BYTES_PER_SITEMAP = 50_000_000;

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  blog: "Blog",
  ecommerce: "E-Commerce",
  saas: "SaaS",
  portfolio: "Portfolio",
  docs: "Docs / Knowledge Base",
};

export const CHANGEFREQ_LABELS: Record<ChangeFreq, string> = {
  always: "Always",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  never: "Never",
};

export const CHANGEFREQ_VALUES: ChangeFreq[] = [
  "always", "hourly", "daily", "weekly", "monthly", "yearly", "never",
];

// ---------- Site-type templates ----------
//
// Each template is a list of relative paths with default priority + changefreq.
// We resolve them against the user's domain (root URL).

interface TemplateEntry {
  path: string;
  priority: number;
  changefreq: ChangeFreq;
  section: string;
}

const BLOG_TEMPLATE: TemplateEntry[] = [
  { path: "/",                       priority: 1.0, changefreq: "daily",   section: "root" },
  { path: "/about",                  priority: 0.6, changefreq: "monthly", section: "about" },
  { path: "/contact",                priority: 0.6, changefreq: "monthly", section: "contact" },
  { path: "/blog",                   priority: 0.9, changefreq: "daily",   section: "blog" },
  { path: "/blog/category/news",     priority: 0.7, changefreq: "weekly",  section: "blog" },
  { path: "/blog/category/guides",   priority: 0.7, changefreq: "weekly",  section: "blog" },
  { path: "/blog/category/tutorials",priority: 0.7, changefreq: "weekly",  section: "blog" },
  { path: "/blog/how-to-start-a-blog",       priority: 0.6, changefreq: "monthly", section: "blog" },
  { path: "/blog/best-writing-tools",        priority: 0.6, changefreq: "monthly", section: "blog" },
  { path: "/blog/seo-checklist-for-2024",    priority: 0.6, changefreq: "monthly", section: "blog" },
  { path: "/blog/newsletter",               priority: 0.6, changefreq: "monthly", section: "blog" },
  { path: "/tags",                 priority: 0.5, changefreq: "weekly", section: "tags" },
  { path: "/author/admin",         priority: 0.4, changefreq: "monthly", section: "author" },
  { path: "/search",               priority: 0.3, changefreq: "weekly", section: "search" },
  { path: "/privacy",              priority: 0.3, changefreq: "yearly", section: "legal" },
  { path: "/terms",                priority: 0.3, changefreq: "yearly", section: "legal" },
];

const ECOMMERCE_TEMPLATE: TemplateEntry[] = [
  { path: "/",                       priority: 1.0, changefreq: "daily",   section: "root" },
  { path: "/about",                  priority: 0.6, changefreq: "monthly", section: "about" },
  { path: "/contact",                priority: 0.6, changefreq: "monthly", section: "contact" },
  { path: "/shop",                   priority: 0.9, changefreq: "daily",   section: "shop" },
  { path: "/shop/new-arrivals",      priority: 0.8, changefreq: "daily",   section: "shop" },
  { path: "/shop/sale",              priority: 0.8, changefreq: "daily",   section: "shop" },
  { path: "/shop/category/men",      priority: 0.7, changefreq: "weekly",  section: "shop" },
  { path: "/shop/category/women",    priority: 0.7, changefreq: "weekly",  section: "shop" },
  { path: "/shop/category/kids",     priority: 0.7, changefreq: "weekly",  section: "shop" },
  { path: "/shop/category/accessories", priority: 0.7, changefreq: "weekly", section: "shop" },
  { path: "/shop/product/classic-t-shirt", priority: 0.6, changefreq: "weekly", section: "product" },
  { path: "/shop/product/denim-jacket",     priority: 0.6, changefreq: "weekly", section: "product" },
  { path: "/shop/product/running-shoes",    priority: 0.6, changefreq: "weekly", section: "product" },
  { path: "/shop/product/leather-wallet",   priority: 0.6, changefreq: "weekly", section: "product" },
  { path: "/cart",                   priority: 0.5, changefreq: "daily",   section: "cart" },
  { path: "/checkout",               priority: 0.5, changefreq: "weekly",  section: "checkout" },
  { path: "/account",                priority: 0.4, changefreq: "weekly",  section: "account" },
  { path: "/wishlist",               priority: 0.4, changefreq: "weekly",  section: "account" },
  { path: "/shipping",               priority: 0.4, changefreq: "monthly", section: "info" },
  { path: "/returns",                priority: 0.4, changefreq: "monthly", section: "info" },
  { path: "/faq",                    priority: 0.5, changefreq: "monthly", section: "info" },
  { path: "/privacy",                priority: 0.3, changefreq: "yearly",  section: "legal" },
  { path: "/terms",                  priority: 0.3, changefreq: "yearly",  section: "legal" },
];

const SAAS_TEMPLATE: TemplateEntry[] = [
  { path: "/",                       priority: 1.0, changefreq: "weekly",  section: "root" },
  { path: "/product",                priority: 0.9, changefreq: "weekly",  section: "product" },
  { path: "/features",               priority: 0.8, changefreq: "monthly", section: "product" },
  { path: "/integrations",           priority: 0.7, changefreq: "monthly", section: "product" },
  { path: "/pricing",                priority: 0.9, changefreq: "monthly", section: "pricing" },
  { path: "/about",                  priority: 0.6, changefreq: "monthly", section: "about" },
  { path: "/team",                   priority: 0.5, changefreq: "monthly", section: "about" },
  { path: "/careers",                priority: 0.5, changefreq: "weekly",  section: "careers" },
  { path: "/contact",                priority: 0.6, changefreq: "monthly", section: "contact" },
  { path: "/blog",                   priority: 0.8, changefreq: "weekly",  section: "blog" },
  { path: "/blog/category/product",  priority: 0.6, changefreq: "weekly",  section: "blog" },
  { path: "/blog/category/engineering", priority: 0.6, changefreq: "weekly", section: "blog" },
  { path: "/customers",              priority: 0.7, changefreq: "monthly", section: "customers" },
  { path: "/case-studies",           priority: 0.7, changefreq: "monthly", section: "customers" },
  { path: "/login",                  priority: 0.4, changefreq: "yearly",  section: "auth" },
  { path: "/signup",                 priority: 0.5, changefreq: "yearly",  section: "auth" },
  { path: "/docs",                   priority: 0.8, changefreq: "weekly",  section: "docs" },
  { path: "/docs/quickstart",        priority: 0.7, changefreq: "weekly",  section: "docs" },
  { path: "/docs/api",               priority: 0.7, changefreq: "weekly",  section: "docs" },
  { path: "/changelog",              priority: 0.6, changefreq: "weekly",  section: "changelog" },
  { path: "/security",               priority: 0.5, changefreq: "monthly", section: "security" },
  { path: "/privacy",                priority: 0.3, changefreq: "yearly",  section: "legal" },
  { path: "/terms",                  priority: 0.3, changefreq: "yearly",  section: "legal" },
];

const PORTFOLIO_TEMPLATE: TemplateEntry[] = [
  { path: "/",                       priority: 1.0, changefreq: "monthly", section: "root" },
  { path: "/about",                  priority: 0.7, changefreq: "yearly",  section: "about" },
  { path: "/work",                   priority: 0.9, changefreq: "monthly", section: "work" },
  { path: "/work/project-alpha",     priority: 0.6, changefreq: "yearly",  section: "work" },
  { path: "/work/project-beta",      priority: 0.6, changefreq: "yearly",  section: "work" },
  { path: "/work/project-gamma",     priority: 0.6, changefreq: "yearly",  section: "work" },
  { path: "/services",               priority: 0.8, changefreq: "monthly", section: "services" },
  { path: "/testimonials",           priority: 0.6, changefreq: "yearly",  section: "testimonials" },
  { path: "/blog",                   priority: 0.7, changefreq: "monthly", section: "blog" },
  { path: "/blog/process",           priority: 0.5, changefreq: "yearly",  section: "blog" },
  { path: "/contact",                priority: 0.8, changefreq: "yearly",  section: "contact" },
  { path: "/resume",                 priority: 0.5, changefreq: "yearly",  section: "resume" },
  { path: "/uses",                   priority: 0.4, changefreq: "yearly",  section: "uses" },
  { path: "/privacy",                priority: 0.3, changefreq: "yearly",  section: "legal" },
];

const DOCS_TEMPLATE: TemplateEntry[] = [
  { path: "/",                       priority: 1.0, changefreq: "weekly",  section: "root" },
  { path: "/docs",                   priority: 0.9, changefreq: "weekly",  section: "docs" },
  { path: "/docs/getting-started",   priority: 0.8, changefreq: "weekly",  section: "docs" },
  { path: "/docs/installation",      priority: 0.7, changefreq: "monthly", section: "docs" },
  { path: "/docs/configuration",     priority: 0.7, changefreq: "monthly", section: "docs" },
  { path: "/docs/usage",             priority: 0.7, changefreq: "monthly", section: "docs" },
  { path: "/docs/advanced",          priority: 0.6, changefreq: "monthly", section: "docs" },
  { path: "/docs/api-reference",     priority: 0.8, changefreq: "weekly",  section: "api" },
  { path: "/docs/api/authentication",priority: 0.7, changefreq: "monthly", section: "api" },
  { path: "/docs/api/endpoints",     priority: 0.7, changefreq: "weekly",  section: "api" },
  { path: "/docs/api/errors",        priority: 0.6, changefreq: "monthly", section: "api" },
  { path: "/docs/sdk",               priority: 0.7, changefreq: "monthly", section: "sdk" },
  { path: "/docs/sdk/javascript",    priority: 0.6, changefreq: "monthly", section: "sdk" },
  { path: "/docs/sdk/python",        priority: 0.6, changefreq: "monthly", section: "sdk" },
  { path: "/docs/migrations",        priority: 0.6, changefreq: "monthly", section: "migrations" },
  { path: "/docs/faq",               priority: 0.6, changefreq: "weekly",  section: "faq" },
  { path: "/docs/troubleshooting",   priority: 0.6, changefreq: "weekly",  section: "troubleshooting" },
  { path: "/blog",                   priority: 0.7, changefreq: "weekly",  section: "blog" },
  { path: "/changelog",              priority: 0.7, changefreq: "weekly",  section: "changelog" },
  { path: "/community",              priority: 0.5, changefreq: "weekly",  section: "community" },
  { path: "/support",                priority: 0.6, changefreq: "weekly",  section: "support" },
  { path: "/privacy",                priority: 0.3, changefreq: "yearly",  section: "legal" },
  { path: "/terms",                  priority: 0.3, changefreq: "yearly",  section: "legal" },
];

export const SITE_TYPE_TEMPLATES: Record<SiteType, TemplateEntry[]> = {
  blog: BLOG_TEMPLATE,
  ecommerce: ECOMMERCE_TEMPLATE,
  saas: SAAS_TEMPLATE,
  portfolio: PORTFOLIO_TEMPLATE,
  docs: DOCS_TEMPLATE,
};

// ---------- URL parsing & validation ----------

/** Normalize a URL: trim, strip trailing slash (except root), lowercase host. */
export function normalizeUrl(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  if (!s) return "";
  // Add https:// if missing scheme
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    u.hostname = u.hostname.toLowerCase();
    // Strip default ports
    if ((u.protocol === "https:" && u.port === "443") ||
        (u.protocol === "http:" && u.port === "80")) {
      u.port = "";
    }
    // Strip trailing slash unless root path
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    u.pathname = path;
    return u.toString();
  } catch {
    return "";
  }
}

/** Validate that a string is a parseable http(s) URL. */
export function validateUrl(raw: string): boolean {
  if (!raw) return false;
  const n = normalizeUrl(raw);
  if (!n) return false;
  try {
    const u = new URL(n);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Parse a pasted URL list (newline, comma, semicolon, or whitespace separated). */
export function parseUrls(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizeUrl(s))
    .filter(Boolean);
}

/** Dedupe URLs (case-sensitive on path is OK after normalize). */
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/** Sort URLs alphabetically (stable, deterministic). */
export function sortUrls(urls: string[]): string[] {
  return [...urls].sort((a, b) => a.localeCompare(b));
}

// ---------- Path helpers ----------

/** Compute path depth (root "/" = 0, "/about" = 1, "/blog/post" = 2). */
export function pathDepth(loc: string): number {
  try {
    const u = new URL(loc);
    const p = u.pathname.replace(/\/+$/, "");
    if (p === "" || p === "/") return 0;
    return p.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** Get first path segment as section ("root" for "/"). */
export function urlSection(loc: string): string {
  try {
    const u = new URL(loc);
    const p = u.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return p || "root";
  } catch {
    return "root";
  }
}

/** Default priority for a URL based on pattern heuristics. */
export function defaultPriorityForUrl(loc: string): number {
  try {
    const u = new URL(loc);
    const p = u.pathname;
    if (p === "/" || p === "") return 1.0;
    if (/^\/(blog|docs|shop|product|work)/i.test(p)) return 0.8;
    if (/^\/(pricing|features|contact|about|services|customers)/i.test(p)) return 0.7;
    if (/\/(category|tag|tags|author)/i.test(p)) return 0.6;
    if (/\.(xml|json|pdf|jpg|png|gif)$/i.test(p)) return 0.3;
    return 0.5;
  } catch {
    return 0.5;
  }
}

/** Default changefreq for a URL based on pattern heuristics. */
export function defaultChangefreqForUrl(loc: string): ChangeFreq {
  try {
    const u = new URL(loc);
    const p = u.pathname;
    if (p === "/" || p === "") return "daily";
    if (/^\/(blog|docs|shop|changelog)/i.test(p)) return "weekly";
    if (/^\/(pricing|features|about|contact)/i.test(p)) return "monthly";
    if (/\/(category|tag|tags)/i.test(p)) return "weekly";
    if (/\.(xml|json|pdf|jpg|png|gif)$/i.test(p)) return "yearly";
    return "monthly";
  } catch {
    return "monthly";
  }
}

// ---------- Template loading ----------

export interface LoadedTemplate {
  loc: string;
  priority: number;
  changefreq: ChangeFreq;
  section: string;
}

/** Load a site-type template against a root URL (e.g. "https://example.com"). */
export function loadTemplate(siteType: SiteType, rootUrl: string): LoadedTemplate[] {
  const root = normalizeUrl(rootUrl);
  if (!root) return [];
  const entries = SITE_TYPE_TEMPLATES[siteType] ?? [];
  const out: LoadedTemplate[] = [];
  for (const e of entries) {
    try {
      const u = new URL(root);
      u.pathname = e.path;
      // Re-normalize (strip trailing slash etc.)
      const loc = normalizeUrl(u.toString());
      if (loc) out.push({ loc, priority: e.priority, changefreq: e.changefreq, section: e.section });
    } catch {
      // skip
    }
  }
  return out;
}

// ---------- Merge ----------

/** Merge template + custom URLs (deduped, sorted). */
export function mergeUrls(template: LoadedTemplate[], custom: string[]): LoadedTemplate[] {
  const seen = new Set<string>();
  const out: LoadedTemplate[] = [];
  for (const t of template) {
    if (!seen.has(t.loc)) {
      seen.add(t.loc);
      out.push(t);
    }
  }
  for (const c of custom) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push({
        loc: c,
        priority: defaultPriorityForUrl(c),
        changefreq: defaultChangefreqForUrl(c),
        section: urlSection(c),
      });
    }
  }
  return out;
}

// ---------- Exclude patterns ----------

/** Apply exclude patterns (regex strings). Returns URLs that DO NOT match any. */
export function applyExcludePatterns(urls: string[], patterns: string[]): string[] {
  if (!patterns.length) return urls;
  const regexes: RegExp[] = [];
  for (const p of patterns) {
    try { regexes.push(new RegExp(p, "i")); } catch { /* skip bad regex */ }
  }
  if (!regexes.length) return urls;
  return urls.filter((u) => !regexes.some((r) => r.test(u)));
}

// ---------- Build sitemap URLs ----------

export interface BuildOptions {
  defaultLastmod?: string;       // ISO date applied when no override
  overrides?: UrlOverride[];     // per-URL priority/changefreq/lastmod
}

/** Build the final list of SitemapUrl objects from loaded template+custom entries. */
export function buildSitemapUrls(
  entries: LoadedTemplate[],
  options: BuildOptions = {},
): SitemapUrl[] {
  const overrideMap = new Map<string, UrlOverride>();
  for (const o of options.overrides ?? []) {
    const n = normalizeUrl(o.loc);
    if (n) overrideMap.set(n, o);
  }
  const out: SitemapUrl[] = [];
  for (const e of entries) {
    const o = overrideMap.get(e.loc);
    const priority = o?.priority ?? e.priority;
    const changefreq = o?.changefreq ?? e.changefreq;
    const lastmod = o?.lastmod ?? options.defaultLastmod;
    out.push({
      loc: e.loc,
      lastmod,
      changefreq,
      priority: clampPriority(priority),
      depth: pathDepth(e.loc),
      section: e.section,
    });
  }
  return out;
}

function clampPriority(p: number): number {
  if (typeof p !== "number" || isNaN(p)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(p * 10) / 10));
}

// ---------- Tree builder ----------

/** Build a hierarchical tree from a list of sitemap URLs (by path segments). */
export function buildTree(urls: SitemapUrl[]): SitemapTree {
  const root: SitemapTree = { loc: "/", children: [] };
  for (const u of urls) {
    let path: string;
    let origin: string;
    try {
      const pu = new URL(u.loc);
      path = pu.pathname;
      origin = `${pu.protocol}//${pu.host}`;
    } catch {
      continue;
    }
    const segments = path.split("/").filter(Boolean);
    let node = root;
    let acc = origin;
    for (let i = 0; i < segments.length; i++) {
      acc += `/${segments[i]}`;
      let child = node.children.find((c) => c.loc === acc);
      if (!child) {
        child = { loc: acc, children: [] };
        node.children.push(child);
      }
      node = child;
      if (i === segments.length - 1) {
        node.url = u;
      }
    }
    if (segments.length === 0) {
      root.url = u;
      root.loc = u.loc;
    }
  }
  // Sort children alphabetically for determinism
  const sortRec = (n: SitemapTree) => {
    n.children.sort((a, b) => a.loc.localeCompare(b.loc));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

// ---------- Stats ----------

export function computeStats(urls: SitemapUrl[]): SitemapStats {
  const bySection: Record<string, number> = {};
  const byDepth: Record<number, number> = {};
  const byChangefreq: Record<ChangeFreq, number> = {
    always: 0, hourly: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0, never: 0,
  };
  let withImages = 0;
  let withAlternates = 0;
  let prioritySum = 0;
  for (const u of urls) {
    bySection[u.section] = (bySection[u.section] ?? 0) + 1;
    byDepth[u.depth] = (byDepth[u.depth] ?? 0) + 1;
    byChangefreq[u.changefreq] += 1;
    if (u.images && u.images.length > 0) withImages += 1;
    if (u.alternates && u.alternates.length > 0) withAlternates += 1;
    prioritySum += u.priority;
  }
  return {
    total: urls.length,
    bySection,
    byDepth,
    byChangefreq,
    withImages,
    withAlternates,
    avgPriority: urls.length === 0 ? 0 : Math.round((prioritySum / urls.length) * 100) / 100,
  };
}

// ---------- Chunking / sitemap index ----------

/** Split URLs into chunks of MAX_URLS_PER_SITEMAP (50,000). */
export function splitIntoChunks(urls: SitemapUrl[], maxPerChunk = MAX_URLS_PER_SITEMAP): SitemapUrl[][] {
  if (urls.length === 0) return [];
  const chunks: SitemapUrl[][] = [];
  for (let i = 0; i < urls.length; i += maxPerChunk) {
    chunks.push(urls.slice(i, i + maxPerChunk));
  }
  return chunks;
}

// ---------- Full build ----------

export interface BuildInput {
  siteType: SiteType;
  rootUrl: string;
  customUrls: string[];           // already-normalized
  excludes: string[];             // regex patterns
  defaultLastmod?: string;
  overrides?: UrlOverride[];
  useTemplate: boolean;
}

/** Top-level build: produces urls, tree, stats, chunked, needsIndex. */
export function buildSitemap(input: BuildInput): SitemapResult {
  const template = input.useTemplate ? loadTemplate(input.siteType, input.rootUrl) : [];
  const merged = mergeUrls(template, input.customUrls);
  // Apply excludes on loc strings
  const kept = merged.filter((e) => applyExcludePatterns([e.loc], input.excludes).length > 0);
  const urls = buildSitemapUrls(kept, {
    defaultLastmod: input.defaultLastmod,
    overrides: input.overrides,
  });
  urls.sort((a, b) => a.loc.localeCompare(b.loc));
  const tree = buildTree(urls);
  const stats = computeStats(urls);
  const chunked = splitIntoChunks(urls);
  const needsIndex = chunked.length > 1;
  return { urls, tree, stats, chunked, needsIndex };
}

// ---------- XML escaping ----------

export function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- Render: XML sitemap ----------

/** Render a single <urlset> XML sitemap. */
export function renderXmlSitemap(urls: SitemapUrl[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  lines.push('        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  for (const u of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(u.loc)}</loc>`);
    if (u.lastmod) lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
    lines.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
    if (u.images && u.images.length > 0) {
      for (const img of u.images) {
        lines.push(`    <image:image>`);
        lines.push(`      <image:loc>${escapeXml(img)}</image:loc>`);
        lines.push(`    </image:image>`);
      }
    }
    if (u.alternates && u.alternates.length > 0) {
      for (const alt of u.alternates) {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`);
      }
    }
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return lines.join("\n");
}

/** Render a <sitemapindex> XML pointing at multiple sitemap-N.xml files. */
export function renderSitemapIndex(
  chunks: SitemapUrl[][],
  baseUrl: string,
  lastmod?: string,
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  const root = baseUrl.replace(/\/+$/, "");
  chunks.forEach((chunk, i) => {
    lines.push("  <sitemap>");
    lines.push(`    <loc>${escapeXml(`${root}/sitemap-${i + 1}.xml`)}</loc>`);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push("  </sitemap>");
  });
  lines.push("</sitemapindex>");
  return lines.join("\n");
}

/** Render every chunk as a separate XML string (for download). */
export function renderAllXmlChunks(chunks: SitemapUrl[][]): string[] {
  return chunks.map((c) => renderXmlSitemap(c));
}

// ---------- Render: HTML sitemap ----------

export function renderHtmlSitemap(urls: SitemapUrl[]): string {
  const lines: string[] = [];
  lines.push('<!DOCTYPE html>');
  lines.push('<html lang="en">');
  lines.push('<head>');
  lines.push('  <meta charset="UTF-8">');
  lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  lines.push('  <title>Sitemap</title>');
  lines.push('  <style>');
  lines.push('    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }');
  lines.push('    h1 { font-size: 1.5rem; }');
  lines.push('    ul { list-style: none; padding-left: 1.25rem; }');
  lines.push('    a { color: #2563eb; text-decoration: none; }');
  lines.push('    a:hover { text-decoration: underline; }');
  lines.push('    .meta { color: #6b7280; font-size: 0.85rem; margin-left: 0.5rem; }');
  lines.push('  </style>');
  lines.push('</head>');
  lines.push('<body>');
  lines.push('  <h1>Sitemap</h1>');
  lines.push(`  <p>${urls.length} URLs</p>`);
  // Group by section
  const bySection = new Map<string, SitemapUrl[]>();
  for (const u of urls) {
    if (!bySection.has(u.section)) bySection.set(u.section, []);
    bySection.get(u.section)!.push(u);
  }
  const sections = [...bySection.keys()].sort();
  for (const section of sections) {
    lines.push(`  <h2>${escapeHtml(section)}</h2>`);
    lines.push('  <ul>');
    for (const u of bySection.get(section)!) {
      const label = tryLabel(u.loc);
      lines.push(`    <li><a href="${escapeHtml(u.loc)}">${escapeHtml(label)}</a><span class="meta">${u.changefreq} · ${u.priority.toFixed(1)}${u.lastmod ? ` · ${u.lastmod}` : ""}</span></li>`);
    }
    lines.push('  </ul>');
  }
  lines.push('</body>');
  lines.push('</html>');
  return lines.join("\n");
}

function tryLabel(loc: string): string {
  try {
    const u = new URL(loc);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return loc;
  }
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- Render: visual tree (text) ----------

export function renderVisualTree(tree: SitemapTree): string {
  const lines: string[] = [];
  const walk = (node: SitemapTree, prefix: string, isLast: boolean, depth: number) => {
    if (depth > 0) {
      const branch = isLast ? "└── " : "├── ";
      const label = node.url ? node.loc : node.loc;
      const meta = node.url ? ` [${node.url.changefreq}, ${node.url.priority.toFixed(1)}]` : "";
      lines.push(`${prefix}${branch}${label}${meta}`);
    }
    const nextPrefix = depth === 0 ? "" : prefix + (isLast ? "    " : "│   ");
    node.children.forEach((c, i) => {
      walk(c, nextPrefix, i === node.children.length - 1, depth + 1);
    });
  };
  // Root: print label if it has a url or hostname; children walk
  if (tree.url) {
    lines.push(`${tree.url.loc} [root]`);
  } else {
    lines.push("/");
  }
  tree.children.forEach((c, i) => {
    walk(c, "", i === tree.children.length - 1, 1);
  });
  return lines.join("\n");
}

// ---------- Render: JSON ----------

export function renderJson(urls: SitemapUrl[]): string {
  return JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    count: urls.length,
    urls: urls.map((u) => ({
      loc: u.loc,
      lastmod: u.lastmod ?? null,
      changefreq: u.changefreq,
      priority: u.priority,
      depth: u.depth,
      section: u.section,
      images: u.images ?? [],
      alternates: u.alternates ?? [],
    })),
  }, null, 2);
}

// ---------- Render: Markdown ----------

export function renderMarkdown(urls: SitemapUrl[]): string {
  const lines: string[] = [];
  lines.push("# Sitemap");
  lines.push("");
  lines.push(`Total URLs: ${urls.length}`);
  lines.push("");
  const bySection = new Map<string, SitemapUrl[]>();
  for (const u of urls) {
    if (!bySection.has(u.section)) bySection.set(u.section, []);
    bySection.get(u.section)!.push(u);
  }
  for (const section of [...bySection.keys()].sort()) {
    lines.push(`## ${section}`);
    lines.push("");
    lines.push("| URL | Priority | Changefreq | Lastmod |");
    lines.push("| --- | --- | --- | --- |");
    for (const u of bySection.get(section)!) {
      lines.push(`| ${u.loc} | ${u.priority.toFixed(1)} | ${u.changefreq} | ${u.lastmod ?? "—"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------- Render: text list ----------

export function renderTextList(urls: SitemapUrl[]): string {
  return urls.map((u) => u.loc).join("\n");
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("type", state.siteType);
  if (state.customUrls) params.set("urls", state.customUrls);
  if (state.excludes) params.set("ex", state.excludes);
  if (state.defaultLastmod) params.set("lm", state.defaultLastmod);
  params.set("tmpl", state.useTemplate ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {
    siteType: "blog",
    customUrls: "",
    excludes: "",
    defaultLastmod: "",
    useTemplate: true,
  };
  const params = new URLSearchParams(clean);
  const typeRaw = params.get("type") ?? "blog";
  const validTypes: SiteType[] = ["blog", "ecommerce", "saas", "portfolio", "docs"];
  const siteType = validTypes.includes(typeRaw as SiteType) ? (typeRaw as SiteType) : "blog";
  const tmpl = params.get("tmpl");
  return {
    siteType,
    customUrls: params.get("urls") ?? "",
    excludes: params.get("ex") ?? "",
    defaultLastmod: params.get("lm") ?? "",
    useTemplate: tmpl === null ? true : tmpl === "1",
  };
}

// ---------- Optional LLM helpers ----------

/** Build a prompt for an LLM to enrich the sitemap with extra URLs. */
export function buildLlmPrompt(rootUrl: string, siteType: SiteType, existingCount: number): string {
  return [
    `You are an SEO expert. Given a ${siteType} website at ${rootUrl}, suggest 10 additional important URLs that should be in its sitemap but are currently missing.`,
    `The sitemap currently has ${existingCount} URLs.`,
    `Return only a JSON array of objects with shape: {"loc": "<full URL>", "priority": <0-1>, "changefreq": "<always|hourly|daily|weekly|monthly|yearly|never>", "section": "<short label>"}.`,
    `Do not include any prose, only the JSON array.`,
  ].join(" ");
}

export interface LlmSuggestedUrl {
  loc: string;
  priority: number;
  changefreq: ChangeFreq;
  section: string;
}

/** Parse the LLM response JSON into a list of suggested URLs (best-effort). */
export function renderLlmResult(text: string): LlmSuggestedUrl[] {
  const out: LlmSuggestedUrl[] = [];
  if (!text) return out;
  // Find first [ ... ] block
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return out;
  const slice = text.slice(start, end + 1);
  try {
    const arr = JSON.parse(slice) as unknown;
    if (!Array.isArray(arr)) return out;
    const validCf: ChangeFreq[] = CHANGEFREQ_VALUES;
    for (const item of arr) {
      if (typeof item !== "object" || item === null) continue;
      const i = item as Record<string, unknown>;
      const loc = typeof i.loc === "string" ? normalizeUrl(i.loc) : "";
      if (!loc) continue;
      const priority = typeof i.priority === "number" ? clampPriority(i.priority) : 0.5;
      const cfRaw = typeof i.changefreq === "string" ? i.changefreq : "monthly";
      const changefreq = validCf.includes(cfRaw as ChangeFreq) ? (cfRaw as ChangeFreq) : "monthly";
      const section = typeof i.section === "string" ? i.section : urlSection(loc);
      out.push({ loc, priority, changefreq, section });
    }
  } catch {
    // ignore parse errors
  }
  return out;
}
