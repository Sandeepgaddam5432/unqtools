import { describe, it, expect, beforeEach } from "vitest";
import {
  TEMPLATES,
  TEMPLATE_MAP,
  TEMPLATE_LABELS,
  LICENSE_LABELS,
  BADGE_LABELS,
  SECTION_LABELS,
  ALL_SECTIONS,
  DEFAULT_INPUTS,
  SAMPLE_PROJECTS,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeText,
  escapeHtml,
  slugify,
  countWords,
  getTemplate,
  listTemplates,
  buildSectionsFromTemplate,
  toggleSection,
  moveSectionUp,
  moveSectionDown,
  buildBadge,
  buildBadges,
  getLicenseSpdx,
  buildLicenseText,
  emojiFor,
  buildHeading,
  renderSection,
  buildToc,
  generateReadme,
  parsePackageJson,
  parseExistingReadme,
  markdownToHtml,
  inlineMd,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type TemplateId,
  type SectionId,
  type LicenseId,
  type BadgeType,
  type ReadmeInputs,
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

describe("ai-markdown-readme-generator constants", () => {
  it("has 5 templates", () => {
    expect(TEMPLATES).toHaveLength(5);
    expect(listTemplates()).toHaveLength(5);
  });

  it("TEMPLATE_MAP has entry for every template id", () => {
    for (const t of TEMPLATES) {
      expect(TEMPLATE_MAP[t.id].id).toBe(t.id);
    }
  });

  it("has labels for every template, license, badge, section", () => {
    expect(Object.keys(TEMPLATE_LABELS)).toHaveLength(5);
    expect(Object.keys(LICENSE_LABELS)).toHaveLength(6);
    expect(Object.keys(BADGE_LABELS)).toHaveLength(10);
    expect(Object.keys(SECTION_LABELS)).toHaveLength(ALL_SECTIONS.length);
  });

  it("has 21 canonical sections", () => {
    expect(ALL_SECTIONS).toHaveLength(21);
    expect(ALL_SECTIONS).toContain("title");
    expect(ALL_SECTIONS).toContain("license");
  });

  it("each template has at least 11 default sections", () => {
    for (const t of TEMPLATES) {
      expect(t.defaultSections.length).toBeGreaterThanOrEqual(11);
    }
  });

  it("each template has at least 4 default badges", () => {
    for (const t of TEMPLATES) {
      expect(t.defaultBadges.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("DEFAULT_INPUTS has sensible defaults", () => {
    expect(DEFAULT_INPUTS.projectName).toBeTruthy();
    expect(DEFAULT_INPUTS.license).toBe("mit");
    expect(DEFAULT_INPUTS.badges.length).toBeGreaterThan(0);
  });

  it("SAMPLE_PROJECTS has at least 2 entries", () => {
    expect(SAMPLE_PROJECTS.length).toBeGreaterThanOrEqual(2);
  });

  it("uses correct history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-markdown-readme-generator:history");
  });
});

describe("ai-markdown-readme-generator helpers", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("a   b\r\n\r\n\r\nc")).toBe("a b\n\nc");
  });
  it("escapeHtml escapes special characters", () => {
    expect(escapeHtml("<b>&\"'</b>")).toBe("&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
  });
  it("slugify produces GitHub-style anchors", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("Tech Stack")).toBe("tech-stack");
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("hello world  foo")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("getTemplate returns the right template", () => {
    expect(getTemplate("npm-package").id).toBe("npm-package");
  });
  it("getTemplate throws on unknown id", () => {
    expect(() => getTemplate("not-a-template" as TemplateId)).toThrow();
  });
});

describe("ai-markdown-readme-generator sections", () => {
  it("buildSectionsFromTemplate creates enabled flags for default sections", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    expect(sections).toHaveLength(ALL_SECTIONS.length);
    const enabled = sections.filter((s) => s.enabled).map((s) => s.id);
    expect(enabled).toContain("installation");
    expect(enabled).toContain("api");
  });

  it("buildSectionsFromTemplate applies overrides", () => {
    const sections = buildSectionsFromTemplate("npm-package", { license: false });
    const license = sections.find((s) => s.id === "license");
    expect(license?.enabled).toBe(false);
  });

  it("toggleSection flips enabled", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const before = sections.find((s) => s.id === "license")!.enabled;
    const toggled = toggleSection(sections, "license");
    const after = toggled.find((s) => s.id === "license")!.enabled;
    expect(after).toBe(!before);
  });

  it("moveSectionUp moves a section up", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const idxBefore = sections.findIndex((s) => s.id === "license");
    const moved = moveSectionUp(sections, "license");
    const idxAfter = moved.findIndex((s) => s.id === "license");
    expect(idxAfter).toBe(idxBefore - 1);
  });

  it("moveSectionUp at top is a no-op", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const moved = moveSectionUp(sections, sections[0].id);
    expect(moved[0].id).toBe(sections[0].id);
  });

  it("moveSectionDown moves a section down", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const idxBefore = sections.findIndex((s) => s.id === "installation");
    const moved = moveSectionDown(sections, "installation");
    const idxAfter = moved.findIndex((s) => s.id === "installation");
    expect(idxAfter).toBe(idxBefore + 1);
  });

  it("moveSectionDown at bottom is a no-op", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const last = sections[sections.length - 1].id;
    const moved = moveSectionDown(sections, last);
    expect(moved[moved.length - 1].id).toBe(last);
  });
});

describe("ai-markdown-readme-generator badges", () => {
  it("buildBadge returns a shields.io URL for npm-version", () => {
    const url = buildBadge("npm-version", DEFAULT_INPUTS);
    expect(url).toContain("img.shields.io/npm/v/");
  });
  it("buildBadge returns a URL for github-stars", () => {
    const url = buildBadge("github-stars", DEFAULT_INPUTS);
    expect(url).toContain("img.shields.io/github/stars/");
  });
  it("buildBadge returns null for discord when no URL set", () => {
    const inputs = { ...DEFAULT_INPUTS, discordUrl: "" };
    expect(buildBadge("discord", inputs)).toBeNull();
  });
  it("buildBadges produces markdown image links", () => {
    const badges = buildBadges(DEFAULT_INPUTS);
    expect(badges.length).toBe(DEFAULT_INPUTS.badges.length);
    expect(badges[0]).toContain("![");
    expect(badges[0]).toContain("img.shields.io");
  });
});

describe("ai-markdown-readme-generator license", () => {
  it("getLicenseSpdx returns correct SPDX identifiers", () => {
    expect(getLicenseSpdx("mit")).toBe("MIT");
    expect(getLicenseSpdx("apache-2.0")).toBe("Apache-2.0");
    expect(getLicenseSpdx("bsd-3-clause")).toBe("BSD-3-Clause");
    expect(getLicenseSpdx("gpl-3.0")).toBe("GPL-3.0-only");
    expect(getLicenseSpdx("unlicense")).toBe("Unlicense");
    expect(getLicenseSpdx("none")).toBe("proprietary");
  });

  it("buildLicenseText MIT includes the permission notice", () => {
    const txt = buildLicenseText("mit", "Jane Doe", "2024");
    expect(txt).toContain("MIT License");
    expect(txt).toContain("Copyright (c) 2024 Jane Doe");
    expect(txt).toContain("Permission is hereby granted");
  });

  it("buildLicenseText Apache-2.0 includes the URL", () => {
    const txt = buildLicenseText("apache-2.0", "Jane Doe", "2024");
    expect(txt).toContain("Apache License 2.0");
    expect(txt).toContain("apache.org/licenses/LICENSE-2.0");
  });

  it("buildLicenseText none is proprietary", () => {
    const txt = buildLicenseText("none", "Jane Doe", "2024");
    expect(txt).toContain("All rights reserved");
  });
});

describe("ai-markdown-readme-generator render + generate", () => {
  it("emojiFor returns an emoji for known sections", () => {
    expect(emojiFor("features")).toBe("✨");
    expect(emojiFor("license")).toBe("⚖️");
  });

  it("buildHeading produces correct level + emoji prefix", () => {
    expect(buildHeading("Hello", 2, "✨", true)).toBe("## ✨ Hello");
    expect(buildHeading("Hello", 1, "✨", false)).toBe("# Hello");
  });

  it("renderSection title returns H1 with tagline", () => {
    const s = renderSection("title", DEFAULT_INPUTS, false);
    expect(s).toContain(`# ${DEFAULT_INPUTS.projectName}`);
    expect(s).toContain(`> ${DEFAULT_INPUTS.tagline}`);
  });

  it("renderSection installation wraps installCmd in code block", () => {
    const s = renderSection("installation", DEFAULT_INPUTS, false);
    expect(s).toContain("## Installation");
    expect(s).toContain("```bash");
    expect(s).toContain(DEFAULT_INPUTS.installCmd);
  });

  it("renderSection license includes collapsible license text", () => {
    const s = renderSection("license", DEFAULT_INPUTS, false);
    expect(s).toContain("## License");
    expect(s).toContain("<details>");
    expect(s).toContain("MIT");
  });

  it("buildToc generates anchor links for enabled sections", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const toc = buildToc(sections, DEFAULT_INPUTS);
    expect(toc).toContain("- [Installation](#installation)");
    expect(toc).toContain("- [API](#api)");
    expect(toc).not.toContain("[Title]");
  });

  it("generateReadme produces a markdown string with sections", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const result = generateReadme(DEFAULT_INPUTS, "npm-package", sections);
    expect(result.markdown).toContain(`# ${DEFAULT_INPUTS.projectName}`);
    expect(result.markdown).toContain("## Installation");
    expect(result.markdown).toContain("## License");
    expect(result.charCount).toBe(result.markdown.length);
    expect(result.lineCount).toBe(result.markdown.split("\n").length);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.templateId).toBe("npm-package");
  });

  it("generateReadme respects disabled sections", () => {
    let sections = buildSectionsFromTemplate("npm-package");
    sections = toggleSection(sections, "license");
    const result = generateReadme(DEFAULT_INPUTS, "npm-package", sections);
    expect(result.markdown).not.toContain("## License");
  });

  it("generateReadme includes TOC body when includeToc enabled", () => {
    const sections = buildSectionsFromTemplate("open-source");
    const result = generateReadme({ ...DEFAULT_INPUTS, includeToc: true }, "open-source", sections);
    expect(result.markdown).toContain("- [Installation](#installation)");
  });

  it("generateReadme with emoji headings includes emojis", () => {
    // open-source template includes the "features" section by default.
    const sections = buildSectionsFromTemplate("open-source");
    const result = generateReadme({ ...DEFAULT_INPUTS, emojiHeadings: true }, "open-source", sections);
    expect(result.markdown).toContain("## ✨ Features");
  });
});

describe("ai-markdown-readme-generator package.json parser", () => {
  it("parses name, description, author, license, scripts", () => {
    const json = JSON.stringify({
      name: "@scope/my-pkg",
      description: "Does cool stuff.",
      author: "Jane Doe",
      license: "MIT",
      homepage: "https://example.com",
      repository: { type: "git", url: "https://github.com/user/my-pkg.git" },
      scripts: { start: "node index.js", test: "vitest" },
      keywords: ["cli", "tools", "private"],
    });
    const out = parsePackageJson(json);
    expect(out.projectName).toBe("@scope/my-pkg");
    expect(out.npmPackage).toBe("my-pkg");
    expect(out.description).toBe("Does cool stuff.");
    expect(out.author).toBe("Jane Doe");
    expect(out.license).toBe("mit");
    expect(out.homepage).toBe("https://example.com");
    expect(out.repoUrl).toBe("https://github.com/user/my-pkg");
    expect(out.githubUser).toBe("user");
    expect(out.githubRepo).toBe("my-pkg");
    expect(out.scripts).toContain("start");
    expect(out.scripts).toContain("test");
    expect(out.featuresList).toContain("cli");
  });

  it("returns empty object for invalid JSON", () => {
    expect(parsePackageJson("not json")).toEqual({});
  });

  it("returns empty object for empty input", () => {
    expect(parsePackageJson("")).toEqual({});
  });

  it("handles string repository shorthand", () => {
    const json = JSON.stringify({ name: "foo", repository: "user/foo" });
    const out = parsePackageJson(json);
    expect(out.repoUrl).toBe("https://github.com/user/foo");
  });

  it("detects Apache license", () => {
    const json = JSON.stringify({ name: "foo", license: "Apache-2.0" });
    expect(parsePackageJson(json).license).toBe("apache-2.0");
  });
});

describe("ai-markdown-readme-generator existing-README parser", () => {
  it("extracts title and description from a simple README", () => {
    const text = `# my-cool-project\n\nThis project does cool stuff. It works offline.\n\n## Installation\n\n\`\`\`bash\nnpm install my-cool-project\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nmy-cool-project --help\n\`\`\`\n\n## License\n\nMIT © Jane Doe\n`;
    const { inputs, enabledSections } = parseExistingReadme(text);
    expect(inputs.projectName).toBe("my-cool-project");
    expect(inputs.description).toContain("cool stuff");
    expect(inputs.installCmd).toBe("npm install my-cool-project");
    expect(enabledSections).toContain("installation");
    expect(enabledSections).toContain("usage");
    expect(enabledSections).toContain("license");
    expect(inputs.license).toBe("mit");
  });

  it("returns empty for empty input", () => {
    expect(parseExistingReadme("")).toEqual({ inputs: {}, enabledSections: [] });
  });

  it("captures features list", () => {
    const text = `# x\n\nDesc.\n\n## Features\n\n- Fast\n- Private\n- Free\n`;
    const { inputs } = parseExistingReadme(text);
    expect(inputs.featuresList).toContain("- Fast");
  });
});

describe("ai-markdown-readme-generator markdown preview", () => {
  it("markdownToHtml renders headings, lists, paragraphs", () => {
    const md = "# Title\n\nParagraph.\n\n## Section\n\n- item 1\n- item 2\n";
    const html = markdownToHtml(md);
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Section</h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain("<p>Paragraph.</p>");
  });

  it("markdownToHtml renders code blocks", () => {
    const md = "```bash\nnpm install\n```";
    const html = markdownToHtml(md);
    expect(html).toContain("<pre><code");
    expect(html).toContain("npm install");
  });

  it("inlineMd renders bold, italic, code, links, images", () => {
    expect(inlineMd("**bold**")).toContain("<strong>bold</strong>");
    expect(inlineMd("`code`")).toContain("<code>code</code>");
    expect(inlineMd("[link](https://x.com)")).toContain('<a href="https://x.com"');
    expect(inlineMd("![alt](https://x.com/a.png)")).toContain("<img");
  });

  it("markdownToHtml returns empty for empty input", () => {
    expect(markdownToHtml("")).toBe("");
  });
});

describe("ai-markdown-readme-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads an entry", () => {
    saveHistory({
      ts: 1,
      projectName: "foo",
      templateId: "npm-package",
      license: "mit",
      charCount: 1234,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].projectName).toBe("foo");
  });

  it(`caps at ${HISTORY_MAX} entries`, () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        projectName: `p${i}`,
        templateId: "npm-package",
        license: "mit",
        charCount: 10,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });

  it("clears history", () => {
    saveHistory({
      ts: 1,
      projectName: "foo",
      templateId: "npm-package",
      license: "mit",
      charCount: 100,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-markdown-readme-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const sections = buildSectionsFromTemplate("npm-package");
    const url = buildShareUrl({
      inputs: { ...DEFAULT_INPUTS, projectName: "shared-pkg" },
      templateId: "npm-package",
      sections,
    });
    expect(url).toContain("t=npm-package");
    expect(url).toContain("i=");
    expect(url).toContain("s=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back into state", () => {
    const sections = buildSectionsFromTemplate("npm-package");
    const url = buildShareUrl({
      inputs: { ...DEFAULT_INPUTS, projectName: "shared-pkg" },
      templateId: "npm-package",
      sections,
    });
    // buildShareUrl returns ?... when window is unavailable, #... when window is present.
    // parseShareUrl handles both, so strip up to the first ? or #.
    const hashIndex = url.indexOf("#");
    const queryIndex = url.indexOf("?");
    let fragment = "";
    if (hashIndex >= 0) fragment = url.slice(hashIndex);
    else if (queryIndex >= 0) fragment = url.slice(queryIndex + 1);
    const parsed = parseShareUrl(fragment);
    expect(parsed).not.toBeNull();
    expect(parsed!.templateId).toBe("npm-package");
    expect(parsed!.inputs.projectName).toBe("shared-pkg");
  });

  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });

  it("returns null for unknown template", () => {
    expect(parseShareUrl("t=unknown-template")).toBeNull();
  });
});

describe("ai-markdown-readme-generator LLM prompt", () => {
  it("buildLlmPrompt produces system + user messages", () => {
    const p = buildLlmPrompt(DEFAULT_INPUTS, "npm-package");
    expect(p.system.length).toBeGreaterThan(0);
    expect(p.user).toContain("npm-package");
    expect(p.user).toContain(DEFAULT_INPUTS.projectName);
  });

  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });

  it("renderLlmResult returns empty for empty input", () => {
    expect(renderLlmResult("")).toBe("");
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused =
  | SectionId
  | LicenseId
  | BadgeType
  | ReadmeInputs;
