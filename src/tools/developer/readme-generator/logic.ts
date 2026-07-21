/**
 * README Generator — pure logic.
 *
 * A section-based builder that scaffolds a professional project README from
 * clickable blocks. Pure functions only — no DOM, no network.
 *
 * Capabilities:
 *   - 12 section types (title, badges, description, toc, installation, usage,
 *     features, api, contributing, license, screenshots, details).
 *   - 5 project templates (npm, github, library, cli, profile).
 *   - 8 SPDX license texts with year/author substitution.
 *   - 15+ Shields.io badge presets + custom static badges.
 *   - Auto-TOC with GitHub-style anchor slugs.
 *   - Import existing README by H1/H2 section split.
 *   - History (localStorage, max 20) and a shareable URL.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SectionType =
  | "title"
  | "badges"
  | "description"
  | "toc"
  | "installation"
  | "usage"
  | "features"
  | "api"
  | "contributing"
  | "license"
  | "screenshots"
  | "details";

export type TemplateId = "npm" | "github" | "library" | "cli" | "profile";

export type LicenseId =
  | "mit"
  | "apache-2.0"
  | "gpl-3.0"
  | "bsd-3-clause"
  | "isc"
  | "mpl-2.0"
  | "unlicense"
  | "proprietary";

export type BadgeId =
  | "npm-version"
  | "npm-downloads"
  | "build-status"
  | "license"
  | "github-stars"
  | "github-last-commit"
  | "typescript"
  | "bundle-size"
  | "coverage"
  | "semantic-release"
  | "dependabot"
  | "issues-open"
  | "prs-welcome"
  | "discord"
  | "twitter-follow"
  | "custom";

export interface BadgePreset {
  id: BadgeId;
  label: string;
  /** Template — uses {npmPackage} / {repoUser} / {repoName} placeholders. */
  urlTemplate: string;
  defaultAlt: string;
}

export interface Section {
  id: string;
  type: SectionType;
  title: string;
  enabled: boolean;
  body: string;
  /** For badges section: which badge ids are enabled. */
  badges?: BadgeId[];
  /** For license section: which license. */
  license?: LicenseId;
  /** For screenshots: array of image URLs/captions. */
  images?: { url: string; alt: string }[];
  /** For details: collapsed by default. */
  collapsed?: boolean;
}

export interface ProjectInfo {
  name: string;
  author: string;
  year: number;
  repoUrl: string;
  npmPackage: string;
  description: string;
}

export interface ReadmeModel {
  project: ProjectInfo;
  sections: Section[];
}

export interface ReadmeStats {
  sections: number;
  enabledSections: number;
  badges: number;
  chars: number;
  words: number;
  lines: number;
}

export interface HistoryEntry {
  ts: number;
  projectName: string;
  sectionCount: number;
  chars: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:readme-generator:history";
const HISTORY_MAX = 20;

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  title: "Title",
  badges: "Badges",
  description: "Description",
  toc: "Table of Contents",
  installation: "Installation",
  usage: "Usage",
  features: "Features",
  api: "API",
  contributing: "Contributing",
  license: "License",
  screenshots: "Screenshots",
  details: "Collapsible Section",
};

export const LICENSE_LABELS: Record<LicenseId, string> = {
  "mit": "MIT",
  "apache-2.0": "Apache-2.0",
  "gpl-3.0": "GPL-3.0",
  "bsd-3-clause": "BSD-3-Clause",
  "isc": "ISC",
  "mpl-2.0": "MPL-2.0",
  "unlicense": "Unlicense",
  "proprietary": "Proprietary",
};

export const LICENSE_SPDX: Record<LicenseId, string> = {
  "mit": "MIT",
  "apache-2.0": "Apache-2.0",
  "gpl-3.0": "GPL-3.0-only",
  "bsd-3-clause": "BSD-3-Clause",
  "isc": "ISC",
  "mpl-2.0": "MPL-2.0",
  "unlicense": "Unlicense",
  "proprietary": "Proprietary",
};

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  npm: "npm Package",
  github: "GitHub Project",
  library: "Library / SDK",
  cli: "CLI Tool",
  profile: "GitHub Profile",
};

/** Full SPDX license texts with {year} and {author} placeholders. */
export const LICENSE_TEXTS: Record<LicenseId, string> = {
  mit: `MIT License

Copyright (c) {year} {author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  "apache-2.0": `Apache License, Version 2.0

Copyright (c) {year} {author}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,
  "gpl-3.0": `GNU General Public License v3.0

Copyright (c) {year} {author}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.`,
  "bsd-3-clause": `BSD 3-Clause License

Copyright (c) {year}, {author}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  isc: `ISC License

Copyright (c) {year} {author}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`,
  "mpl-2.0": `Mozilla Public License, Version 2.0

Copyright (c) {year} {author}

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.`,
  unlicense: `The Unlicense

This is free and unencumbered software released into the public domain ({year}, {author}).

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this
software, either in source code form or as a compiled binary, for any purpose,
commercial or non-commercial, and by any means.

For more information, please refer to <https://unlicense.org>`,
  proprietary: `Proprietary License

Copyright (c) {year} {author}. All rights reserved.

This software and its source code are the confidential and proprietary
information of {author}. Unauthorized copying, modification, distribution,
or use of this software, via any medium, is strictly prohibited without
prior written consent from the copyright holder.`,
};

export const BADGE_PRESETS: BadgePreset[] = [
  { id: "npm-version", label: "npm version", urlTemplate: "https://img.shields.io/npm/v/{npmPackage}.svg", defaultAlt: "npm version" },
  { id: "npm-downloads", label: "npm downloads", urlTemplate: "https://img.shields.io/npm/dm/{npmPackage}.svg", defaultAlt: "npm downloads" },
  { id: "build-status", label: "build status", urlTemplate: "https://img.shields.io/github/actions/workflow/status/{repoUser}/{repoName}/ci.yml?branch=main", defaultAlt: "build status" },
  { id: "license", label: "license", urlTemplate: "https://img.shields.io/github/license/{repoUser}/{repoName}.svg", defaultAlt: "license" },
  { id: "github-stars", label: "GitHub stars", urlTemplate: "https://img.shields.io/github/stars/{repoUser}/{repoName}.svg", defaultAlt: "GitHub stars" },
  { id: "github-last-commit", label: "last commit", urlTemplate: "https://img.shields.io/github/last-commit/{repoUser}/{repoName}.svg", defaultAlt: "last commit" },
  { id: "typescript", label: "TypeScript", urlTemplate: "https://img.shields.io/badge/TypeScript-strict-blue.svg", defaultAlt: "TypeScript" },
  { id: "bundle-size", label: "bundle size", urlTemplate: "https://img.shields.io/bundlephobia/min/{npmPackage}.svg", defaultAlt: "bundle size" },
  { id: "coverage", label: "coverage", urlTemplate: "https://img.shields.io/coveralls/github/{repoUser}/{repoName}.svg", defaultAlt: "coverage" },
  { id: "semantic-release", label: "semantic-release", urlTemplate: "https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg", defaultAlt: "semantic-release" },
  { id: "dependabot", label: "dependabot", urlTemplate: "https://img.shields.io/badge/dependabot-enabled-025e8c.svg", defaultAlt: "dependabot" },
  { id: "issues-open", label: "open issues", urlTemplate: "https://img.shields.io/github/issues/{repoUser}/{repoName}.svg", defaultAlt: "open issues" },
  { id: "prs-welcome", label: "PRs welcome", urlTemplate: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg", defaultAlt: "PRs welcome" },
  { id: "discord", label: "Discord", urlTemplate: "https://img.shields.io/discord/000000000000000000.svg?label=Discord", defaultAlt: "Discord" },
  { id: "twitter-follow", label: "Twitter follow", urlTemplate: "https://img.shields.io/twitter/follow/{repoUser}.svg?style=social", defaultAlt: "Twitter follow" },
  { id: "custom", label: "custom static", urlTemplate: "", defaultAlt: "custom" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a section id (kebab-case, lowercase). */
export function normalizeSectionId(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Build a GitHub-style anchor slug from heading text. */
export function slugifyHeading(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/** Parse a GitHub repo URL into user and name. Returns null if not parseable. */
export function parseRepoUrl(url: string): { user: string; name: string } | null {
  if (!url) return null;
  const m = url.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!m) return null;
  return { user: m[1], name: m[2] };
}

/** Render a shields.io badge URL by substituting project info. */
export function renderBadgeUrl(preset: BadgePreset, project: ProjectInfo): string {
  if (preset.id === "custom") return preset.urlTemplate;
  const { user, name } = parseRepoUrl(project.repoUrl) ?? { user: "user", name: "repo" };
  return preset.urlTemplate
    .replace(/\{npmPackage\}/g, encodeURIComponent(project.npmPackage || "package"))
    .replace(/\{repoUser\}/g, encodeURIComponent(user))
    .replace(/\{repoName\}/g, encodeURIComponent(name));
}

/** Build the markdown for a single badge. */
export function renderBadge(preset: BadgePreset, project: ProjectInfo): string {
  const url = renderBadgeUrl(preset, project);
  if (!url) return "";
  const alt = preset.defaultAlt;
  const link = preset.id === "license" && project.repoUrl
    ? project.repoUrl
    : preset.id === "npm-version" || preset.id === "npm-downloads" || preset.id === "bundle-size"
      ? `https://www.npmjs.com/package/${project.npmPackage || "package"}`
      : project.repoUrl || "#";
  return `[![${alt}](${url})](${link})`;
}

/** Generate the full badges block for a list of badge ids. */
export function generateBadges(badgeIds: BadgeId[], project: ProjectInfo): string {
  const lines: string[] = [];
  for (const id of badgeIds) {
    const preset = BADGE_PRESETS.find((b) => b.id === id);
    if (!preset) continue;
    const md = renderBadge(preset, project);
    if (md) lines.push(md);
  }
  return lines.join("\n");
}

/** Generate the full license text with year/author substituted. */
export function generateLicense(licenseId: LicenseId, project: ProjectInfo): string {
  const text = LICENSE_TEXTS[licenseId] ?? LICENSE_TEXTS.proprietary;
  return text
    .replace(/\{year\}/g, String(project.year || new Date().getFullYear()))
    .replace(/\{author\}/g, project.author || "Your Name");
}

/** Generate a TOC for the enabled H2 sections of a README model. */
export function generateToc(model: ReadmeModel): string {
  const lines: string[] = [];
  for (const s of model.sections) {
    if (!s.enabled) continue;
    if (s.type === "title" || s.type === "toc" || s.type === "badges") continue;
    if (!s.title) continue;
    const slug = slugifyHeading(s.title);
    lines.push(`- [${s.title}](#${slug})`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Section creation
// ---------------------------------------------------------------------------

let _sectionCounter = 0;

/** Create a new section with a unique id. */
export function createSection(type: SectionType, title?: string, body?: string): Section {
  _sectionCounter = (_sectionCounter + 1) % 1_000_000;
  const id = `${type}-${Date.now().toString(36)}-${_sectionCounter}`;
  const defaults: Record<SectionType, Partial<Section>> = {
    title: { body: "" },
    badges: { badges: ["npm-version", "license", "github-stars"] },
    description: { body: "A short, one-sentence description of what this project does." },
    toc: { body: "" },
    installation: { body: "```bash\nnpm install your-package\n```" },
    usage: { body: "```js\nconst lib = require('your-package');\nlib.doSomething();\n```" },
    features: { body: "- Feature one\n- Feature two\n- Feature three" },
    api: { body: "### `functionName(arg1, arg2)`\n\nDescription of what the function does." },
    contributing: { body: "Contributions are welcome! Please open an issue or submit a PR.\n\n1. Fork the repo\n2. Create your branch (`git checkout -b feature/foo`)\n3. Commit your changes\n4. Open a Pull Request" },
    license: { license: "mit" },
    screenshots: { images: [] },
    details: { body: "Optional content hidden by default.", collapsed: true },
  };
  return {
    id,
    type,
    title: title ?? SECTION_TYPE_LABELS[type],
    enabled: true,
    body: body ?? defaults[type].body ?? "",
    ...defaults[type],
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Apply a template preset — returns a fresh model with template sections. */
export function applyTemplate(template: TemplateId, project?: Partial<ProjectInfo>): ReadmeModel {
  const baseProject: ProjectInfo = {
    name: project?.name ?? "my-project",
    author: project?.author ?? "Your Name",
    year: project?.year ?? new Date().getFullYear(),
    repoUrl: project?.repoUrl ?? "https://github.com/user/repo",
    npmPackage: project?.npmPackage ?? "my-package",
    description: project?.description ?? "A short description of what this project does.",
  };
  const map: Record<TemplateId, SectionType[]> = {
    npm: ["title", "badges", "description", "toc", "installation", "usage", "features", "contributing", "license"],
    github: ["title", "badges", "description", "toc", "usage", "contributing", "license"],
    library: ["title", "badges", "description", "toc", "installation", "api", "usage", "license"],
    cli: ["title", "badges", "description", "toc", "installation", "usage", "features", "contributing", "license"],
    profile: ["title", "description", "badges", "details"],
  };
  const sections = map[template].map((t) => {
    const s = createSection(t);
    if (t === "title") s.body = baseProject.name;
    if (t === "description" && template === "profile") s.body = `Hi, I'm ${baseProject.author}! 👋`;
    return s;
  });
  return { project: baseProject, sections };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderSection(section: Section, model: ReadmeModel): string {
  if (!section.enabled) return "";
  switch (section.type) {
    case "title":
      return `# ${section.body || model.project.name}\n`;
    case "badges": {
      const ids = section.badges ?? [];
      if (ids.length === 0) return "";
      return generateBadges(ids, model.project) + "\n";
    }
    case "description":
      return `${section.body}\n`;
    case "toc": {
      const toc = generateToc(model);
      if (!toc) return "";
      return `## Table of Contents\n\n${toc}\n`;
    }
    case "installation":
      return `## ${section.title}\n\n${section.body}\n`;
    case "usage":
      return `## ${section.title}\n\n${section.body}\n`;
    case "features":
      return `## ${section.title}\n\n${section.body}\n`;
    case "api":
      return `## ${section.title}\n\n${section.body}\n`;
    case "contributing":
      return `## ${section.title}\n\n${section.body}\n`;
    case "license": {
      const licenseId = section.license ?? "mit";
      const fullText = generateLicense(licenseId, model.project);
      const label = LICENSE_LABELS[licenseId];
      return `## ${section.title}\n\nThis project is licensed under the ${label} License — see the full text below.\n\n\`\`\`\n${fullText}\n\`\`\`\n`;
    }
    case "screenshots": {
      const imgs = section.images ?? [];
      if (imgs.length === 0) return `## ${section.title}\n\n_No screenshots provided._\n`;
      const body = imgs.map((i) => `![${i.alt || "screenshot"}](${i.url})`).join("\n\n");
      return `## ${section.title}\n\n${body}\n`;
    }
    case "details": {
      const state = section.collapsed ? "" : " open";
      return `<details${state}>\n<summary>${section.title}</summary>\n\n${section.body}\n\n</details>\n`;
    }
    default:
      return "";
  }
}

/** Render the entire README markdown. */
export function renderMarkdown(model: ReadmeModel): string {
  const parts: string[] = [];
  for (const s of model.sections) {
    const rendered = renderSection(s, model);
    if (rendered) parts.push(rendered.trim());
  }
  return parts.join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(model: ReadmeModel): ReadmeStats {
  const md = renderMarkdown(model);
  const enabledSections = model.sections.filter((s) => s.enabled).length;
  const badges = model.sections
    .filter((s) => s.enabled && s.type === "badges")
    .reduce((acc, s) => acc + (s.badges?.length ?? 0), 0);
  const words = md.split(/\s+/).filter(Boolean).length;
  return {
    sections: model.sections.length,
    enabledSections,
    badges,
    chars: md.length,
    words,
    lines: md.split("\n").length,
  };
}

// ---------------------------------------------------------------------------
// Import existing README
// ---------------------------------------------------------------------------

/** Parse an existing README back into a ReadmeModel. Best-effort split by H1/H2. */
export function parseReadme(markdown: string): ReadmeModel {
  const lines = markdown.split("\n");
  const project: ProjectInfo = {
    name: "imported-project",
    author: "Your Name",
    year: new Date().getFullYear(),
    repoUrl: "",
    npmPackage: "",
    description: "",
  };
  const sections: Section[] = [];
  let current: Section | null = null;
  let badges: BadgeId[] = [];
  let descriptionBuffer: string[] = [];
  let afterTitle = false;

  const pushCurrent = () => {
    if (current) sections.push(current);
    current = null;
  };

  const flushDescription = () => {
    if (descriptionBuffer.length > 0) {
      const text = descriptionBuffer.join("\n").trim();
      if (text) {
        if (!project.description) project.description = text;
        const desc = createSection("description", "Description", text);
        sections.push(desc);
      }
      descriptionBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect badge image — handles both ![alt](url) and [![alt](url)](link)
    const badgeMatch = trimmed.match(/^!?\[?!\[([^\]]*)\]\(([^)]*shields\.io[^)]*)\)/);
    if (badgeMatch) {
      const alt = badgeMatch[1].toLowerCase();
      let id: BadgeId | null = null;
      if (alt.includes("npm") && alt.includes("version")) id = "npm-version";
      else if (alt.includes("npm") && alt.includes("download")) id = "npm-downloads";
      else if (alt.includes("build")) id = "build-status";
      else if (alt.includes("license")) id = "license";
      else if (alt.includes("star")) id = "github-stars";
      else if (alt.includes("typescript")) id = "typescript";
      else if (alt.includes("coverage")) id = "coverage";
      else if (alt.includes("bundle")) id = "bundle-size";
      else if (alt.includes("semantic")) id = "semantic-release";
      else if (alt.includes("dependabot")) id = "dependabot";
      else if (alt.includes("issue")) id = "issues-open";
      else if (alt.includes("pr")) id = "prs-welcome";
      if (id) badges.push(id);
      continue;
    }

    if (/^#\s+/.test(line)) {
      flushDescription();
      pushCurrent();
      const name = line.replace(/^#\s+/, "").trim();
      project.name = name;
      // Push the title section immediately and enter the "description zone".
      sections.push(createSection("title", "Title", name));
      current = null;
      afterTitle = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushDescription();
      pushCurrent();
      afterTitle = false;
      const title = line.replace(/^##\s+/, "").trim();
      const lower = title.toLowerCase();
      let type: SectionType = "details";
      if (lower.includes("install")) type = "installation";
      else if (lower.includes("usage")) type = "usage";
      else if (lower.includes("feature")) type = "features";
      else if (lower.includes("api")) type = "api";
      else if (lower.includes("contribut")) type = "contributing";
      else if (lower.includes("license")) type = "license";
      else if (lower.includes("table of contents") || lower === "toc") type = "toc";
      else if (lower.includes("screenshot")) type = "screenshots";
      current = createSection(type, title, "");
      continue;
    }
    // Lines after the H1 and before the first ## section become the description.
    if (afterTitle && !current) {
      if (trimmed) descriptionBuffer.push(line);
      continue;
    }
    if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else if (trimmed) {
      // Leading paragraph before any H1
      if (!project.description) project.description = trimmed;
      const desc = createSection("description", "Description", line);
      sections.push(desc);
    }
  }
  flushDescription();
  pushCurrent();
  if (badges.length > 0) {
    const badgeSection = createSection("badges", "Badges", "");
    badgeSection.badges = Array.from(new Set(badges));
    // Insert at top after title
    const titleIdx = sections.findIndex((s) => s.type === "title");
    if (titleIdx >= 0) sections.splice(titleIdx + 1, 0, badgeSection);
    else sections.unshift(badgeSection);
  }
  return { project, sections };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(model: ReadmeModel): string {
  const params = new URLSearchParams();
  params.set("name", model.project.name);
  params.set("author", model.project.author);
  params.set("year", String(model.project.year));
  params.set("repo", model.project.repoUrl);
  params.set("npm", model.project.npmPackage);
  params.set("desc", model.project.description);
  // Encode the section types + titles so the structure round-trips.
  const compact = model.sections
    .filter((s) => s.enabled)
    .map((s) => `${s.type}:${s.title}`)
    .join("|");
  params.set("sections", compact);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { template: TemplateId; project: Partial<ProjectInfo>; sectionTypes: SectionType[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { template: "npm", project: {}, sectionTypes: [] };
  const params = new URLSearchParams(clean);
  const project: Partial<ProjectInfo> = {
    name: params.get("name") ?? undefined,
    author: params.get("author") ?? undefined,
    year: params.get("year") ? Number(params.get("year")) : undefined,
    repoUrl: params.get("repo") ?? undefined,
    npmPackage: params.get("npm") ?? undefined,
    description: params.get("desc") ?? undefined,
  };
  const sectionsStr = params.get("sections") ?? "";
  const validTypes = Object.keys(SECTION_TYPE_LABELS) as SectionType[];
  const sectionTypes = sectionsStr
    ? sectionsStr.split("|").map((p) => p.split(":")[0] as SectionType).filter((t) => validTypes.includes(t))
    : [];
  return { template: "npm", project, sectionTypes };
}
