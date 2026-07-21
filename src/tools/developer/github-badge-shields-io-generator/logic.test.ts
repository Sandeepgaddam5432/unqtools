import { describe, it, expect, beforeEach } from "vitest";
import {
  SHIELDS_BASE,
  STYLES,
  STYLE_LABELS,
  NAMED_COLORS,
  BADGE_TYPES,
  BADGE_TYPE_LABELS,
  BRAND_PRESETS,
  escapeSegment,
  normalizeColor,
  isValidColor,
  isValidHexColor,
  isValidLogoSlug,
  isValidRepo,
  isValidNpmPackage,
  buildQuery,
  buildPath,
  buildTypeQuery,
  generateBadge,
  buildAltText,
  renderMarkdown,
  renderHtml,
  renderRst,
  renderAsciiDoc,
  renderRowMarkdown,
  renderRowHtml,
  presetToConfig,
  findPreset,
  computeStats,
  defaultConfig,
  defaultDynamicConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateConfig,
  type BadgeConfig,
  type BadgeType,
  type HistoryEntry,
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

describe("github-badge constants", () => {
  it("exposes shields base URL", () => {
    expect(SHIELDS_BASE).toBe("https://img.shields.io");
  });
  it("has 5 styles", () => {
    expect(STYLES).toHaveLength(5);
    expect(STYLES).toContain("flat");
    expect(STYLES).toContain("for-the-badge");
  });
  it("has labels for every style", () => {
    for (const s of STYLES) expect(STYLE_LABELS[s]).toBeTruthy();
  });
  it("has 13 badge types", () => {
    expect(BADGE_TYPES).toHaveLength(13);
    expect(BADGE_TYPES).toContain("static");
    expect(BADGE_TYPES).toContain("github-stars");
    expect(BADGE_TYPES).toContain("npm-version");
    expect(BADGE_TYPES).toContain("build-github-actions");
  });
  it("has labels for every badge type", () => {
    for (const t of BADGE_TYPES) expect(BADGE_TYPE_LABELS[t]).toBeTruthy();
  });
  it("has 18 named colors", () => {
    expect(NAMED_COLORS.length).toBeGreaterThanOrEqual(18);
    expect(NAMED_COLORS).toContain("brightgreen");
    expect(NAMED_COLORS).toContain("blueviolet");
  });
  it("has 12 brand presets", () => {
    expect(BRAND_PRESETS).toHaveLength(12);
    expect(BRAND_PRESETS.some((p) => p.slug === "github")).toBe(true);
    expect(BRAND_PRESETS.some((p) => p.slug === "npm")).toBe(true);
  });
});

describe("github-badge escapeSegment", () => {
  it("doubles literal hyphens", () => {
    expect(escapeSegment("build-status")).toBe("build--status");
  });
  it("doubles literal underscores", () => {
    expect(escapeSegment("foo_bar")).toBe("foo__bar");
  });
  it("encodes spaces as %20", () => {
    expect(escapeSegment("hello world")).toBe("hello%20world");
  });
  it("handles empty string", () => {
    expect(escapeSegment("")).toBe("");
  });
  it("doubles both hyphens and underscores in same string", () => {
    expect(escapeSegment("build-status_test")).toBe("build--status__test");
  });
});

describe("github-badge color normalization", () => {
  it("strips leading hash from hex", () => {
    expect(normalizeColor("#ff6f00")).toBe("ff6f00");
  });
  it("lowercases hex", () => {
    expect(normalizeColor("#FF6F00")).toBe("ff6f00");
  });
  it("passes through named color", () => {
    expect(normalizeColor("brightgreen")).toBe("brightgreen");
  });
  it("returns empty for empty input", () => {
    expect(normalizeColor("")).toBe("");
  });
});

describe("github-badge isValidColor", () => {
  it("accepts named colors", () => {
    expect(isValidColor("brightgreen")).toBe(true);
    expect(isValidColor("blueviolet")).toBe(true);
  });
  it("accepts 6-digit hex", () => {
    expect(isValidColor("#ff6f00")).toBe(true);
    expect(isValidColor("ff6f00")).toBe(true);
  });
  it("accepts 3-digit hex", () => {
    expect(isValidColor("#f60")).toBe(true);
  });
  it("rejects invalid hex", () => {
    expect(isValidColor("#gggggg")).toBe(false);
    expect(isValidColor("#ff")).toBe(false);
  });
  it("rejects unknown named color", () => {
    expect(isValidColor("notacolor")).toBe(false);
  });
});

describe("github-badge isValidHexColor", () => {
  it("accepts hex", () => {
    expect(isValidHexColor("#ff6f00")).toBe(true);
  });
  it("rejects named color", () => {
    expect(isValidHexColor("brightgreen")).toBe(false);
  });
});

describe("github-badge isValidLogoSlug / repo / npm", () => {
  it("accepts valid slugs", () => {
    expect(isValidLogoSlug("github")).toBe(true);
    expect(isValidLogoSlug("visualstudiocode")).toBe(true);
  });
  it("rejects slugs with spaces", () => {
    expect(isValidLogoSlug("visual studio code")).toBe(false);
  });
  it("accepts owner/repo", () => {
    expect(isValidRepo("microsoft/typescript")).toBe(true);
    expect(isValidRepo("facebook/react")).toBe(true);
  });
  it("rejects bad repo formats", () => {
    expect(isValidRepo("microsoft")).toBe(false);
    expect(isValidRepo("microsoft/typescript/extra")).toBe(false);
  });
  it("accepts scoped npm packages", () => {
    expect(isValidNpmPackage("@scope/pkg")).toBe(true);
    expect(isValidNpmPackage("react")).toBe(true);
  });
  it("rejects npm names with uppercase", () => {
    expect(isValidNpmPackage("React")).toBe(false);
  });
});

describe("github-badge buildPath & buildTypeQuery", () => {
  it("returns /static/v1 for static badge", () => {
    expect(buildPath(defaultConfig())).toBe("/static/v1");
  });
  it("returns /github/stars/owner/repo for stars", () => {
    const cfg: BadgeConfig = { ...defaultConfig(), type: "github-stars", repo: "microsoft/typescript" };
    expect(buildPath(cfg)).toBe("/github/stars/microsoft/typescript");
  });
  it("returns /npm/v/pkg for npm-version", () => {
    const cfg: BadgeConfig = { ...defaultConfig(), type: "npm-version", npmPackage: "react" };
    expect(buildPath(cfg)).toBe("/npm/v/react");
  });
  it("builds type query for static badge", () => {
    const q = buildTypeQuery(defaultConfig());
    expect(q.join("&")).toContain("label=build");
    expect(q.join("&")).toContain("message=passing");
    expect(q.join("&")).toContain("color=brightgreen");
  });
  it("returns empty type query for github-stars", () => {
    const cfg: BadgeConfig = { ...defaultConfig(), type: "github-stars", repo: "microsoft/typescript" };
    expect(buildTypeQuery(cfg)).toEqual([]);
  });
});

describe("github-badge generateBadge", () => {
  it("generates a static badge URL with escaped label/message", () => {
    const badge = generateBadge({
      ...defaultConfig(),
      label: "build-status",
      message: "CI / CD pipeline",
    });
    expect(badge.url).toContain("https://img.shields.io/static/v1");
    expect(badge.url).toContain("label=build--status");
    expect(badge.url).toContain("message=CI%20%2F%20CD%20pipeline");
    expect(badge.url).toContain("color=brightgreen");
    expect(badge.url).toContain("style=flat");
  });
  it("includes style and logo in query", () => {
    const badge = generateBadge({
      ...defaultConfig(),
      logo: "github",
      style: "for-the-badge",
    });
    expect(badge.url).toContain("style=for-the-badge");
    expect(badge.url).toContain("logo=github");
  });
  it("strips # from hex color", () => {
    const badge = generateBadge({ ...defaultConfig(), color: "#ff6f00" });
    expect(badge.url).toContain("color=ff6f00");
    expect(badge.url).not.toContain("color=%23ff6f00");
  });
  it("builds github-stars URL with style", () => {
    const badge = generateBadge({
      ...defaultConfig(),
      type: "github-stars",
      repo: "microsoft/typescript",
      style: "flat-square",
    });
    expect(badge.url).toContain("/github/stars/microsoft/typescript");
    expect(badge.url).toContain("style=flat-square");
  });
  it("builds npm-version URL", () => {
    const badge = generateBadge({
      ...defaultConfig(),
      type: "npm-version",
      npmPackage: "react",
    });
    expect(badge.url).toContain("/npm/v/react");
  });
  it("builds license URL with color by type", () => {
    const badge = generateBadge({
      ...defaultConfig(),
      type: "license",
      license: "MIT",
      npmPackage: "react",
    });
    expect(badge.url).toContain("label=license");
    expect(badge.url).toContain("message=MIT");
    expect(badge.url).toContain("color=brightgreen");
  });
  it("builds alt text for static badge", () => {
    const badge = generateBadge({ ...defaultConfig(), label: "build", message: "passing" });
    expect(badge.altText).toBe("build: passing");
  });
  it("builds alt text for github-stars", () => {
    const badge = generateBadge({ ...defaultConfig(), type: "github-stars", repo: "microsoft/typescript" });
    expect(badge.altText).toContain("GitHub Stars");
    expect(badge.altText).toContain("microsoft/typescript");
  });
});

describe("github-badge embed renders", () => {
  const badge = generateBadge({
    ...defaultConfig(),
    label: "build",
    message: "passing",
    link: "https://github.com/microsoft/typescript",
  });
  it("renders markdown image without link", () => {
    const md = renderMarkdown({ ...badge, config: { ...badge.config, link: undefined } });
    expect(md).toContain("![build: passing]");
    expect(md).toContain(badge.url);
  });
  it("renders markdown image with link wrapper", () => {
    const md = renderMarkdown(badge);
    expect(md.startsWith("[![build: passing]")).toBe(true);
    expect(md).toContain("](https://github.com/microsoft/typescript)");
  });
  it("renders html img tag", () => {
    const html = renderHtml({ ...badge, config: { ...badge.config, link: undefined } });
    expect(html).toContain("<img src=\"");
    expect(html).toContain(`src="${badge.url}"`);
    expect(html).toContain("alt=\"build: passing\"");
  });
  it("renders html with link anchor", () => {
    const html = renderHtml(badge);
    expect(html).toContain("<a href=\"https://github.com/microsoft/typescript\">");
  });
  it("renders rst image directive", () => {
    const rst = renderRst(badge);
    expect(rst).toContain(".. image::");
    expect(rst).toContain(":target:");
  });
  it("renders asciidoc image macro", () => {
    const ad = renderAsciiDoc(badge);
    expect(ad).toContain("image:");
    expect(ad).toContain("[build: passing");
  });
  it("renders a row of badges (markdown)", () => {
    const row = renderRowMarkdown([badge, badge]);
    expect(row.split(" ").length).toBeGreaterThanOrEqual(2);
  });
  it("renders a row of badges (html)", () => {
    const row = renderRowHtml([badge, badge]);
    expect(row.split("\n").length).toBe(2);
  });
});

describe("github-badge presets", () => {
  it("converts preset to config", () => {
    const preset = findPreset("github")!;
    const cfg = presetToConfig(preset);
    expect(cfg.type).toBe("static");
    expect(cfg.label).toBe("GitHub");
    expect(cfg.logo).toBe("github");
    expect(cfg.color).toBe("181717");
  });
  it("returns undefined for unknown preset", () => {
    expect(findPreset("nonexistent")).toBeUndefined();
  });
});

describe("github-badge stats", () => {
  it("computes stats correctly", () => {
    const badges = [
      generateBadge(defaultConfig()),
      generateBadge({ ...defaultConfig(), type: "github-stars", repo: "microsoft/typescript" }),
      generateBadge({ ...defaultConfig(), type: "npm-version", npmPackage: "react", logo: "npm" }),
    ];
    const stats = computeStats(badges);
    expect(stats.total).toBe(3);
    expect(stats.byType["static"]).toBe(1);
    expect(stats.byType["github-stars"]).toBe(1);
    expect(stats.byType["npm-version"]).toBe(1);
    expect(stats.withLogo).toBe(1);
    expect(stats.withLink).toBe(0);
  });
  it("handles empty list", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
  });
});

describe("github-badge history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "static", url: "https://example.com", altText: "x" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "static", url: `https://example.com/${i}`, altText: `b${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "static", url: "https://example.com", altText: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("github-badge shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...defaultConfig(), logo: "github", repo: "microsoft/typescript", type: "github-stars" });
    expect(url).toContain("type=github-stars");
    expect(url).toContain("logo=github");
    expect(url).toContain("repo=microsoft%2Ftypescript");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips a static config", () => {
    const cfg: BadgeConfig = {
      ...defaultConfig(),
      label: "build",
      message: "passing",
      color: "#ff6f00",
      style: "for-the-badge",
      logo: "github",
    };
    const url = buildShareUrl(cfg);
    const parsed = parseShareUrl(url);
    expect(parsed.type).toBe("static");
    expect(parsed.label).toBe("build");
    expect(parsed.message).toBe("passing");
    expect(parsed.color).toBe("#ff6f00");
    expect(parsed.style).toBe("for-the-badge");
    expect(parsed.logo).toBe("github");
  });
  it("parses empty hash to defaults", () => {
    const cfg = parseShareUrl("");
    expect(cfg.type).toBe("static");
    expect(cfg.style).toBe("flat");
  });
  it("filters unknown badge type", () => {
    const cfg = parseShareUrl("type=unknown-type&style=flat");
    expect(cfg.type).toBe("static");
  });
  it("filters unknown style", () => {
    const cfg = parseShareUrl("type=static&style=unknown");
    expect(cfg.style).toBe("flat");
  });
});

describe("github-badge validateConfig", () => {
  it("flags missing label for static badge", () => {
    const issues = validateConfig({ ...defaultConfig(), label: "" });
    expect(issues.some((i) => i.field === "label" && i.severity === "error")).toBe(true);
  });
  it("flags missing message for static badge", () => {
    const issues = validateConfig({ ...defaultConfig(), message: "" });
    expect(issues.some((i) => i.field === "message" && i.severity === "error")).toBe(true);
  });
  it("flags invalid color", () => {
    const issues = validateConfig({ ...defaultConfig(), color: "notacolor" });
    expect(issues.some((i) => i.field === "color")).toBe(true);
  });
  it("flags invalid logoColor", () => {
    const issues = validateConfig({ ...defaultConfig(), logoColor: "notacolor" });
    expect(issues.some((i) => i.field === "logoColor")).toBe(true);
  });
  it("flags invalid logo slug", () => {
    const issues = validateConfig({ ...defaultConfig(), logo: "Bad Slug" });
    expect(issues.some((i) => i.field === "logo")).toBe(true);
  });
  it("flags missing repo for github-stars", () => {
    const issues = validateConfig({ ...defaultConfig(), type: "github-stars", repo: "" });
    expect(issues.some((i) => i.field === "repo")).toBe(true);
  });
  it("flags missing npm package for npm-version", () => {
    const issues = validateConfig({ ...defaultConfig(), type: "npm-version", npmPackage: "" });
    expect(issues.some((i) => i.field === "npmPackage")).toBe(true);
  });
  it("warns about missing workflow for github-actions", () => {
    const issues = validateConfig({
      ...defaultConfig(),
      type: "build-github-actions",
      repo: "microsoft/typescript",
      workflow: "",
    });
    expect(issues.some((i) => i.field === "workflow" && i.severity === "warn")).toBe(true);
  });
  it("passes for valid static config", () => {
    const issues = validateConfig(defaultConfig());
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
});

describe("github-badge defaultDynamicConfig", () => {
  it("returns a config with given type", () => {
    const cfg = defaultDynamicConfig("github-stars");
    expect(cfg.type).toBe("github-stars");
    expect(cfg.repo).toBeTruthy();
  });
});

// Suppress unused-import lint
export type _Unused = BadgeType | HistoryEntry;
