import { describe, it, expect, beforeEach } from "vitest";
import {
  SECTION_TYPE_LABELS,
  LICENSE_LABELS,
  LICENSE_SPDX,
  LICENSE_TEXTS,
  TEMPLATE_LABELS,
  BADGE_PRESETS,
  normalizeSectionId,
  slugifyHeading,
  parseRepoUrl,
  renderBadgeUrl,
  renderBadge,
  generateBadges,
  generateLicense,
  generateToc,
  createSection,
  applyTemplate,
  renderMarkdown,
  computeStats,
  parseReadme,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SectionType,
  type LicenseId,
  type TemplateId,
  type BadgeId,
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

describe("readme-generator constants", () => {
  it("has 12 section types", () => {
    expect(Object.keys(SECTION_TYPE_LABELS)).toHaveLength(12);
  });
  it("has 8 license labels", () => {
    expect(Object.keys(LICENSE_LABELS)).toHaveLength(8);
  });
  it("has 8 SPDX identifiers", () => {
    expect(Object.keys(LICENSE_SPDX)).toHaveLength(8);
    expect(LICENSE_SPDX.mit).toBe("MIT");
    expect(LICENSE_SPDX["apache-2.0"]).toBe("Apache-2.0");
  });
  it("has 8 full license texts", () => {
    expect(Object.keys(LICENSE_TEXTS)).toHaveLength(8);
    expect(LICENSE_TEXTS.mit).toContain("Permission is hereby granted");
    expect(LICENSE_TEXTS.mit).toContain("{year}");
    expect(LICENSE_TEXTS.mit).toContain("{author}");
  });
  it("has 5 templates", () => {
    expect(Object.keys(TEMPLATE_LABELS)).toHaveLength(5);
  });
  it("has 16 badge presets", () => {
    expect(BADGE_PRESETS).toHaveLength(16);
  });
});

describe("readme-generator normalizeSectionId", () => {
  it("kebab-cases", () => {
    expect(normalizeSectionId("Hello World!")).toBe("hello-world");
  });
  it("handles empty", () => {
    expect(normalizeSectionId("")).toBe("");
  });
});

describe("readme-generator slugifyHeading", () => {
  it("lowercases and dashes", () => {
    expect(slugifyHeading("Installation Guide")).toBe("installation-guide");
  });
  it("strips punctuation", () => {
    expect(slugifyHeading("API: Methods!")).toBe("api-methods");
  });
});

describe("readme-generator parseRepoUrl", () => {
  it("parses https url", () => {
    expect(parseRepoUrl("https://github.com/user/repo")).toEqual({ user: "user", name: "repo" });
  });
  it("parses .git url", () => {
    expect(parseRepoUrl("https://github.com/foo/bar.git")).toEqual({ user: "foo", name: "bar" });
  });
  it("parses ssh url", () => {
    expect(parseRepoUrl("git@github.com:foo/bar.git")).toEqual({ user: "foo", name: "bar" });
  });
  it("returns null for non-github", () => {
    expect(parseRepoUrl("https://gitlab.com/foo/bar")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(parseRepoUrl("")).toBeNull();
  });
});

describe("readme-generator renderBadgeUrl", () => {
  const project = {
    name: "test", author: "Alice", year: 2024,
    repoUrl: "https://github.com/alice/test", npmPackage: "test-pkg",
    description: "Test",
  };
  it("renders npm-version badge url", () => {
    const preset = BADGE_PRESETS.find((b) => b.id === "npm-version")!;
    const url = renderBadgeUrl(preset, project);
    expect(url).toContain("img.shields.io/npm/v/test-pkg.svg");
  });
  it("renders github-stars badge url with user/repo", () => {
    const preset = BADGE_PRESETS.find((b) => b.id === "github-stars")!;
    const url = renderBadgeUrl(preset, project);
    expect(url).toContain("github/stars/alice/test.svg");
  });
  it("custom badge uses template directly", () => {
    const customPreset = { ...BADGE_PRESETS.find((b) => b.id === "custom")!, urlTemplate: "https://example.com/badge.svg" };
    expect(renderBadgeUrl(customPreset, project)).toBe("https://example.com/badge.svg");
  });
  it("falls back when repoUrl missing", () => {
    const preset = BADGE_PRESETS.find((b) => b.id === "github-stars")!;
    const url = renderBadgeUrl(preset, { ...project, repoUrl: "" });
    expect(url).toContain("github/stars/user/repo.svg");
  });
});

describe("readme-generator renderBadge", () => {
  const project = {
    name: "test", author: "Alice", year: 2024,
    repoUrl: "https://github.com/alice/test", npmPackage: "test-pkg",
    description: "Test",
  };
  it("emits markdown image with link", () => {
    const preset = BADGE_PRESETS.find((b) => b.id === "npm-version")!;
    const md = renderBadge(preset, project);
    expect(md).toContain("![npm version]");
    expect(md).toContain("(https://www.npmjs.com/package/test-pkg)");
  });
  it("returns empty for empty custom url", () => {
    const customPreset = BADGE_PRESETS.find((b) => b.id === "custom")!;
    expect(renderBadge(customPreset, project)).toBe("");
  });
});

describe("readme-generator generateBadges", () => {
  const project = {
    name: "test", author: "Alice", year: 2024,
    repoUrl: "https://github.com/alice/test", npmPackage: "test-pkg",
    description: "Test",
  };
  it("renders multiple badges one per line", () => {
    const out = generateBadges(["npm-version", "license", "github-stars"], project);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toContain("img.shields.io/npm/v/test-pkg");
    expect(out).toContain("img.shields.io/github/license/alice/test");
    expect(out).toContain("img.shields.io/github/stars/alice/test");
  });
  it("skips unknown ids", () => {
    const out = generateBadges(["npm-version", "unknown-id" as BadgeId], project);
    expect(out.split("\n")).toHaveLength(1);
  });
  it("returns empty for empty list", () => {
    expect(generateBadges([], project)).toBe("");
  });
});

describe("readme-generator generateLicense", () => {
  const project = {
    name: "test", author: "Alice", year: 2025,
    repoUrl: "", npmPackage: "", description: "",
  };
  it("substitutes year and author in MIT", () => {
    const text = generateLicense("mit", project);
    expect(text).toContain("Copyright (c) 2025 Alice");
    expect(text).not.toContain("{year}");
    expect(text).not.toContain("{author}");
  });
  it("substitutes in Apache", () => {
    const text = generateLicense("apache-2.0", project);
    expect(text).toContain("Copyright (c) 2025 Alice");
  });
  it("substitutes in GPL-3.0", () => {
    const text = generateLicense("gpl-3.0", project);
    expect(text).toContain("Copyright (c) 2025 Alice");
  });
  it("falls back to proprietary text for unknown", () => {
    const text = generateLicense("nonexistent" as LicenseId, project);
    expect(text).toContain("Proprietary");
  });
});

describe("readme-generator generateToc", () => {
  it("lists enabled non-title sections", () => {
    const model = applyTemplate("npm");
    const toc = generateToc(model);
    expect(toc).toContain("- [Installation](#installation)");
    expect(toc).toContain("- [Usage](#usage)");
    expect(toc).not.toContain("[Title]");
  });
  it("skips disabled sections", () => {
    const model = applyTemplate("npm");
    model.sections[4].enabled = false; // installation
    const toc = generateToc(model);
    expect(toc).not.toContain("[Installation]");
  });
});

describe("readme-generator createSection", () => {
  it("creates a section with unique id", () => {
    const s1 = createSection("installation");
    const s2 = createSection("installation");
    expect(s1.id).not.toBe(s2.id);
    expect(s1.type).toBe("installation");
    expect(s1.enabled).toBe(true);
  });
  it("uses default body for installation", () => {
    const s = createSection("installation");
    expect(s.body).toContain("npm install");
  });
  it("badges section has default badge ids", () => {
    const s = createSection("badges");
    expect(s.badges).toContain("npm-version");
    expect(s.badges).toContain("license");
  });
});

describe("readme-generator applyTemplate", () => {
  it("npm template has 9 sections", () => {
    const model = applyTemplate("npm");
    expect(model.sections).toHaveLength(9);
    expect(model.sections[0].type).toBe("title");
    expect(model.sections.map((s) => s.type)).toContain("installation");
    expect(model.sections.map((s) => s.type)).toContain("license");
  });
  it("github template has 7 sections", () => {
    expect(applyTemplate("github").sections).toHaveLength(7);
  });
  it("library template has 8 sections including api", () => {
    const m = applyTemplate("library");
    expect(m.sections).toHaveLength(8);
    expect(m.sections.some((s) => s.type === "api")).toBe(true);
  });
  it("cli template has 9 sections", () => {
    expect(applyTemplate("cli").sections).toHaveLength(9);
  });
  it("profile template has 4 sections including details", () => {
    const m = applyTemplate("profile");
    expect(m.sections).toHaveLength(4);
    expect(m.sections.some((s) => s.type === "details")).toBe(true);
  });
  it("populates project info from arguments", () => {
    const m = applyTemplate("npm", { name: "cool-lib", author: "Bob", year: 2023 });
    expect(m.project.name).toBe("cool-lib");
    expect(m.project.author).toBe("Bob");
    expect(m.project.year).toBe(2023);
  });
});

describe("readme-generator renderMarkdown", () => {
  it("renders title as H1", () => {
    const model = applyTemplate("npm");
    const md = renderMarkdown(model);
    expect(md).toContain(`# ${model.project.name}`);
  });
  it("renders license section with full license text", () => {
    const model = applyTemplate("npm");
    const md = renderMarkdown(model);
    expect(md).toContain("## License");
    expect(md).toContain("MIT License");
    expect(md).toContain("Permission is hereby granted");
  });
  it("renders TOC section with anchor links", () => {
    const model = applyTemplate("npm");
    const md = renderMarkdown(model);
    expect(md).toContain("## Table of Contents");
    expect(md).toContain("[Installation](#installation)");
  });
  it("renders details section as <details>", () => {
    const model = applyTemplate("profile");
    const md = renderMarkdown(model);
    expect(md).toContain("<details");
    expect(md).toContain("</details>");
  });
  it("skips disabled sections", () => {
    const model = applyTemplate("npm");
    model.sections[4].enabled = false;
    const md = renderMarkdown(model);
    expect(md).not.toContain("## Installation");
  });
  it("renders badges block at top", () => {
    const model = applyTemplate("npm");
    const md = renderMarkdown(model);
    expect(md).toContain("img.shields.io/npm/v");
  });
});

describe("readme-generator computeStats", () => {
  it("counts enabled sections and badges", () => {
    const model = applyTemplate("npm");
    const stats = computeStats(model);
    expect(stats.sections).toBe(9);
    expect(stats.enabledSections).toBe(9);
    expect(stats.badges).toBeGreaterThanOrEqual(3);
    expect(stats.chars).toBeGreaterThan(0);
    expect(stats.words).toBeGreaterThan(0);
    expect(stats.lines).toBeGreaterThan(0);
  });
  it("disabled sections reduce enabled count", () => {
    const model = applyTemplate("npm");
    model.sections[0].enabled = false;
    const stats = computeStats(model);
    expect(stats.enabledSections).toBe(8);
  });
});

describe("readme-generator parseReadme (import)", () => {
  it("round-trips title and sections", () => {
    const original = applyTemplate("npm");
    const md = renderMarkdown(original);
    const reimported = parseReadme(md);
    expect(reimported.project.name).toBe(original.project.name);
    expect(reimported.sections.some((s) => s.type === "installation")).toBe(true);
    expect(reimported.sections.some((s) => s.type === "license")).toBe(true);
  });
  it("detects badges from shields.io images", () => {
    const md = `# Test

[![npm version](https://img.shields.io/npm/v/foo.svg)](https://www.npmjs.com/package/foo)
[![license](https://img.shields.io/github/license/a/b.svg)](#)

## Installation

npm install foo
`;
    const model = parseReadme(md);
    expect(model.project.name).toBe("Test");
    const badgesSection = model.sections.find((s) => s.type === "badges");
    expect(badgesSection).toBeTruthy();
    expect(badgesSection!.badges).toContain("npm-version");
    expect(badgesSection!.badges).toContain("license");
  });
  it("detects description from leading paragraph", () => {
    const md = `# Title

This is my project description.

## Usage

Run it.
`;
    const model = parseReadme(md);
    expect(model.project.description).toContain("This is my project description");
  });
});

describe("readme-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, projectName: "foo", sectionCount: 9, chars: 1000 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, projectName: `p${i}`, sectionCount: 9, chars: 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, projectName: "foo", sectionCount: 9, chars: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("readme-generator shareable URL", () => {
  it("builds share URL with project fields when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const model = applyTemplate("npm", { name: "cool-lib", author: "Bob", year: 2023 });
    const url = buildShareUrl(model);
    expect(url).toContain("name=cool-lib");
    expect(url).toContain("author=Bob");
    expect(url).toContain("year=2023");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const model = applyTemplate("npm", { name: "cool-lib", author: "Bob", year: 2023 });
    const url = buildShareUrl(model);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.project.name).toBe("cool-lib");
    expect(p.project.author).toBe("Bob");
    expect(p.project.year).toBe(2023);
    expect(p.sectionTypes.length).toBeGreaterThan(0);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.project.name).toBeUndefined();
    expect(p.sectionTypes).toEqual([]);
  });
  it("filters unknown section types", () => {
    const p = parseShareUrl("name=foo&sections=installation|bogus|usage");
    expect(p.sectionTypes).toContain("installation");
    expect(p.sectionTypes).toContain("usage");
    expect(p.sectionTypes).not.toContain("bogus" as SectionType);
  });
});

// Suppress unused-import lint
export type _Unused = TemplateId | SectionType | LicenseId | BadgeId;
