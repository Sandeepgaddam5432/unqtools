/**
 * AI Markdown README Generator — pure logic.
 *
 * Assemble a structured README.md from project inputs using five
 * templates (open-source, npm-package, library, cli-tool, web-app),
 * 21 toggleable sections, a shields.io badge builder, a license
 * picker with full SPDX text, an auto table of contents, emoji
 * headings, screenshot placeholders, a minimal Markdown→HTML
 * renderer for live preview, a package.json parser, and a
 * best-effort existing-README importer.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: generated READMEs are a strong starting point — verify
 * commands, options, and API signatures against your actual code.
 */

// ---------- Types ----------

export type TemplateId =
  | "open-source"
  | "npm-package"
  | "library"
  | "cli-tool"
  | "web-app";

export type LicenseId =
  | "mit"
  | "apache-2.0"
  | "bsd-3-clause"
  | "gpl-3.0"
  | "unlicense"
  | "none";

export type BadgeType =
  | "npm-version"
  | "npm-downloads"
  | "github-stars"
  | "github-license"
  | "github-issues"
  | "github-prs"
  | "build-status"
  | "coverage"
  | "discord"
  | "custom";

export type SectionId =
  | "title"
  | "badges"
  | "toc"
  | "description"
  | "features"
  | "prerequisites"
  | "installation"
  | "usage"
  | "configuration"
  | "scripts"
  | "api"
  | "examples"
  | "screenshots"
  | "demo"
  | "tech-stack"
  | "deployment"
  | "contributing"
  | "code-of-conduct"
  | "changelog"
  | "faq"
  | "license";

export interface Section {
  id: SectionId;
  label: string;
  enabled: boolean;
}

export interface ReadmeInputs {
  projectName: string;
  tagline: string;
  description: string;
  author: string;
  repoUrl: string;
  homepage: string;
  demoUrl: string;
  npmPackage: string;
  githubUser: string;
  githubRepo: string;
  license: LicenseId;
  licenseYear: string;
  installCmd: string;
  usageExample: string;
  prerequisites: string;
  configuration: string;
  scripts: string;
  apiDoc: string;
  faqList: string;
  featuresList: string;
  techStack: string;
  screenshotUrl: string;
  emojiHeadings: boolean;
  includeToc: boolean;
  badges: BadgeType[];
  customBadgeLabel: string;
  customBadgeMessage: string;
  customBadgeColor: string;
  discordUrl: string;
  buildStatusUrl: string;
  coverageUrl: string;
}

export interface Template {
  id: TemplateId;
  label: string;
  description: string;
  defaultSections: SectionId[];
  defaultBadges: BadgeType[];
}

export interface GeneratedReadme {
  markdown: string;
  sections: Section[];
  wordCount: number;
  charCount: number;
  lineCount: number;
  badges: string[];
  templateId: TemplateId;
}

export interface HistoryEntry {
  ts: number;
  projectName: string;
  templateId: TemplateId;
  license: LicenseId;
  charCount: number;
}

export interface ShareState {
  inputs: ReadmeInputs;
  templateId: TemplateId;
  sections: Section[];
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-markdown-readme-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-markdown-readme-generator:llm-key";

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  "open-source": "Open-Source Project",
  "npm-package": "npm Package",
  "library": "Library / Framework",
  "cli-tool": "CLI Tool",
  "web-app": "Web App",
};

export const LICENSE_LABELS: Record<LicenseId, string> = {
  "mit": "MIT",
  "apache-2.0": "Apache-2.0",
  "bsd-3-clause": "BSD-3-Clause",
  "gpl-3.0": "GPL-3.0",
  "unlicense": "Unlicense",
  "none": "None (proprietary)",
};

export const BADGE_LABELS: Record<BadgeType, string> = {
  "npm-version": "npm version",
  "npm-downloads": "npm downloads",
  "github-stars": "GitHub stars",
  "github-license": "GitHub license",
  "github-issues": "GitHub issues",
  "github-prs": "GitHub PRs",
  "build-status": "Build status",
  "coverage": "Coverage",
  "discord": "Discord",
  "custom": "Custom",
};

export const SECTION_LABELS: Record<SectionId, string> = {
  "title": "Title",
  "badges": "Badges",
  "toc": "Table of Contents",
  "description": "Description",
  "features": "Features",
  "prerequisites": "Prerequisites",
  "installation": "Installation",
  "usage": "Usage",
  "configuration": "Configuration",
  "scripts": "Scripts",
  "api": "API",
  "examples": "Examples",
  "screenshots": "Screenshots",
  "demo": "Demo",
  "tech-stack": "Tech Stack",
  "deployment": "Deployment",
  "contributing": "Contributing",
  "code-of-conduct": "Code of Conduct",
  "changelog": "Changelog",
  "faq": "FAQ",
  "license": "License",
};

export const ALL_SECTIONS: SectionId[] = [
  "title", "badges", "toc", "description", "features", "prerequisites",
  "installation", "usage", "configuration", "scripts", "api", "examples",
  "screenshots", "demo", "tech-stack", "deployment", "contributing",
  "code-of-conduct", "changelog", "faq", "license",
];

export const TEMPLATES: Template[] = [
  {
    id: "open-source",
    label: TEMPLATE_LABELS["open-source"],
    description: "Full open-source project README with all sections.",
    defaultSections: [
      "title", "badges", "toc", "description", "features", "prerequisites",
      "installation", "usage", "configuration", "scripts", "api", "examples",
      "screenshots", "demo", "tech-stack", "deployment", "contributing",
      "code-of-conduct", "changelog", "faq", "license",
    ],
    defaultBadges: ["github-license", "github-stars", "github-issues", "build-status", "coverage", "discord"],
  },
  {
    id: "npm-package",
    label: TEMPLATE_LABELS["npm-package"],
    description: "npm package README focused on install, API, and options.",
    defaultSections: [
      "title", "badges", "toc", "description", "installation", "usage",
      "api", "configuration", "examples", "contributing", "license",
    ],
    defaultBadges: ["npm-version", "npm-downloads", "github-license", "build-status", "coverage"],
  },
  {
    id: "library",
    label: TEMPLATE_LABELS["library"],
    description: "Library / framework README with quick-start and browser support.",
    defaultSections: [
      "title", "badges", "toc", "description", "features", "installation",
      "usage", "api", "examples", "tech-stack", "contributing", "license",
    ],
    defaultBadges: ["npm-version", "npm-downloads", "github-license", "github-stars", "build-status"],
  },
  {
    id: "cli-tool",
    label: TEMPLATE_LABELS["cli-tool"],
    description: "CLI tool README with commands, options, and configuration.",
    defaultSections: [
      "title", "badges", "toc", "description", "features", "prerequisites",
      "installation", "usage", "configuration", "scripts", "examples",
      "contributing", "license",
    ],
    defaultBadges: ["npm-version", "github-license", "github-stars", "build-status"],
  },
  {
    id: "web-app",
    label: TEMPLATE_LABELS["web-app"],
    description: "Web app README with screenshots, demo, tech stack, and deployment.",
    defaultSections: [
      "title", "badges", "toc", "description", "features", "screenshots",
      "demo", "tech-stack", "prerequisites", "installation", "usage",
      "configuration", "deployment", "contributing", "license", "faq",
    ],
    defaultBadges: ["github-license", "github-stars", "build-status", "coverage", "discord"],
  },
];

export const TEMPLATE_MAP: Record<TemplateId, Template> = TEMPLATES.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TemplateId, Template>,
);

export const DEFAULT_INPUTS: ReadmeInputs = {
  projectName: "my-project",
  tagline: "A short, punchy tagline.",
  description: "Describe what your project does and why someone should care.",
  author: "Your Name",
  repoUrl: "https://github.com/user/my-project",
  homepage: "",
  demoUrl: "",
  npmPackage: "my-project",
  githubUser: "user",
  githubRepo: "my-project",
  license: "mit",
  licenseYear: String(new Date().getFullYear()),
  installCmd: "npm install my-project",
  usageExample: "```bash\nmy-project --help\n```",
  prerequisites: "Node.js >= 18, npm >= 9",
  configuration: "Configuration via environment variables or `config.json`.",
  scripts: "```json\n{\n  \"scripts\": {\n    \"start\": \"node index.js\",\n    \"test\": \"npm test\"\n  }\n}\n```",
  apiDoc: "Document the public API surface here.",
  faqList: "**Q: Is this free?**\nA: Yes, MIT-licensed.\n\n**Q: Where do I report bugs?**\nA: Use GitHub Issues.",
  featuresList: "- Fast\n- Private (runs in your browser)\n- No account required",
  techStack: "- TypeScript\n- Node.js\n- Vite",
  screenshotUrl: "https://placehold.co/600x400?text=Screenshot",
  emojiHeadings: false,
  includeToc: true,
  badges: ["npm-version", "github-license", "github-stars"],
  customBadgeLabel: "custom",
  customBadgeMessage: "yes",
  customBadgeColor: "blue",
  discordUrl: "https://discord.gg/your-invite",
  buildStatusUrl: "https://github.com/user/my-project/actions/workflows/ci.yml",
  coverageUrl: "https://codecov.io/gh/user/my-project",
};

export const SAMPLE_PROJECTS: { label: string; inputs: ReadmeInputs; templateId: TemplateId }[] = [
  {
    label: "npm CLI tool",
    templateId: "cli-tool",
    inputs: {
      ...DEFAULT_INPUTS,
      projectName: "fancycmd",
      tagline: "A delightful CLI for fanciful command-line magic.",
      description: "fancycmd scaffolds new projects in seconds. Zero config, sensible defaults, fully offline.",
      installCmd: "npm install -g fancycmd",
      usageExample: "```bash\nfancycmd init my-app\ncd my-app\nfancycmd dev\n```",
      featuresList: "- Zero-config scaffolding\n- 20+ project templates\n- Works offline\n- Cross-platform",
      techStack: "- TypeScript\n- Node.js\n- Commander.js",
      npmPackage: "fancycmd",
      githubUser: "yourname",
      githubRepo: "fancycmd",
      repoUrl: "https://github.com/yourname/fancycmd",
    },
  },
  {
    label: "React library",
    templateId: "library",
    inputs: {
      ...DEFAULT_INPUTS,
      projectName: "react-cool-hooks",
      tagline: "A collection of batteries-included React hooks.",
      description: "Production-ready React hooks for forms, async, and animations. Tree-shakeable, typed, tiny.",
      installCmd: "npm install react-cool-hooks",
      usageExample: "```tsx\nimport { useDebounce } from 'react-cool-hooks';\nconst debounced = useDebounce(value, 300);\n```",
      featuresList: "- 30+ hooks\n- Fully typed (TypeScript)\n- < 5KB gzipped\n- SSR-friendly",
      techStack: "- React 18\n- TypeScript\n- Vite",
      npmPackage: "react-cool-hooks",
      githubUser: "yourname",
      githubRepo: "react-cool-hooks",
      repoUrl: "https://github.com/yourname/react-cool-hooks",
    },
  },
];

// ---------- Helpers ----------

/** Normalize newlines and whitespace. */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Slugify a heading into a GitHub-style anchor (lowercase, dashes, no specials). */
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Count words (whitespace-separated) in a string. */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Get a template by id; throws for unknown ids. */
export function getTemplate(id: TemplateId): Template {
  const t = TEMPLATE_MAP[id];
  if (!t) throw new Error(`Unknown template id: ${id}`);
  return t;
}

/** List all available templates. */
export function listTemplates(): Template[] {
  return TEMPLATES;
}

/** Build a sections list from a template (enabled = in template.defaultSections). */
export function buildSectionsFromTemplate(templateId: TemplateId, enabledOverrides?: Partial<Record<SectionId, boolean>>): Section[] {
  const t = getTemplate(templateId);
  const enabledSet = new Set(t.defaultSections);
  return ALL_SECTIONS.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    enabled: enabledOverrides && id in enabledOverrides ? !!enabledOverrides[id] : enabledSet.has(id),
  }));
}

/** Toggle a section's enabled flag. */
export function toggleSection(sections: Section[], id: SectionId): Section[] {
  return sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
}

/** Move a section up in the order array (returns reordered copy). */
export function moveSectionUp(sections: Section[], id: SectionId): Section[] {
  const idx = sections.findIndex((s) => s.id === id);
  if (idx <= 0) return sections;
  const out = [...sections];
  const [item] = out.splice(idx, 1);
  out.splice(idx - 1, 0, item);
  return out;
}

/** Move a section down in the order array (returns reordered copy). */
export function moveSectionDown(sections: Section[], id: SectionId): Section[] {
  const idx = sections.findIndex((s) => s.id === id);
  if (idx < 0 || idx >= sections.length - 1) return sections;
  const out = [...sections];
  const [item] = out.splice(idx, 1);
  out.splice(idx + 1, 0, item);
  return out;
}

/** Build a single shields.io badge URL. */
export function buildBadge(badge: BadgeType, inputs: ReadmeInputs): string | null {
  const shield = (label: string, message: string, color: string, logo?: string) => {
    let url = `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}`;
    if (logo) url += `?logo=${logo}`;
    return url;
  };
  const npmPkg = inputs.npmPackage || inputs.projectName;
  const ghUser = inputs.githubUser;
  const ghRepo = inputs.githubRepo || inputs.projectName;
  switch (badge) {
    case "npm-version":
      return `https://img.shields.io/npm/v/${encodeURIComponent(npmPkg)}.svg`;
    case "npm-downloads":
      return `https://img.shields.io/npm/dm/${encodeURIComponent(npmPkg)}.svg`;
    case "github-stars":
      return `https://img.shields.io/github/stars/${encodeURIComponent(ghUser)}/${encodeURIComponent(ghRepo)}.svg`;
    case "github-license":
      return `https://img.shields.io/github/license/${encodeURIComponent(ghUser)}/${encodeURIComponent(ghRepo)}.svg`;
    case "github-issues":
      return `https://img.shields.io/github/issues/${encodeURIComponent(ghUser)}/${encodeURIComponent(ghRepo)}.svg`;
    case "github-prs":
      return `https://img.shields.io/github/issues-pr/${encodeURIComponent(ghUser)}/${encodeURIComponent(ghRepo)}.svg`;
    case "build-status":
      return inputs.buildStatusUrl
        ? `https://github.com/${encodeURIComponent(ghUser)}/${encodeURIComponent(ghRepo)}/actions/workflows/ci.yml/badge.svg`
        : shield("build", "passing", "brightgreen");
    case "coverage":
      return inputs.coverageUrl
        ? `https://codecov.io/gh/${encodeURIComponent(ghUser)}/${encodeURIComponent(ghRepo)}/graph/badge.svg`
        : shield("coverage", "100%25", "brightgreen");
    case "discord":
      return inputs.discordUrl ? "https://img.shields.io/discord/your-server-id.svg?logo=discord" : null;
    case "custom":
      return shield(inputs.customBadgeLabel || "custom", inputs.customBadgeMessage || "yes", inputs.customBadgeColor || "blue");
    default:
      return null;
  }
}

/** Build a markdown image link for every enabled badge. */
export function buildBadges(inputs: ReadmeInputs): string[] {
  const out: string[] = [];
  for (const b of inputs.badges) {
    const url = buildBadge(b, inputs);
    if (!url) continue;
    let link = "";
    if (b === "npm-version" || b === "npm-downloads") {
      link = `https://www.npmjs.com/package/${encodeURIComponent(inputs.npmPackage || inputs.projectName)}`;
    } else if (b.startsWith("github-")) {
      link = `https://github.com/${encodeURIComponent(inputs.githubUser)}/${encodeURIComponent(inputs.githubRepo || inputs.projectName)}`;
    } else if (b === "build-status") {
      link = inputs.buildStatusUrl || link;
    } else if (b === "coverage") {
      link = inputs.coverageUrl || link;
    } else if (b === "discord") {
      link = inputs.discordUrl;
    }
    out.push(link ? `[![${b}](${url})](${link})` : `![${b}](${url})`);
  }
  return out;
}

/** Get the SPDX license identifier. */
export function getLicenseSpdx(id: LicenseId): string {
  switch (id) {
    case "mit": return "MIT";
    case "apache-2.0": return "Apache-2.0";
    case "bsd-3-clause": return "BSD-3-Clause";
    case "gpl-3.0": return "GPL-3.0-only";
    case "unlicense": return "Unlicense";
    case "none": return "proprietary";
  }
}

/** Build the full license text for a given license. */
export function buildLicenseText(id: LicenseId, author: string, year: string): string {
  const yr = year || String(new Date().getFullYear());
  const holder = author || "Your Name";
  switch (id) {
    case "mit":
      return `MIT License\n\nCopyright (c) ${yr} ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
    case "apache-2.0":
      return `Apache License 2.0\n\nCopyright ${yr} ${holder}\n\nLicensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at\n\n    http://www.apache.org/licenses/LICENSE-2.0\n\nUnless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.`;
    case "bsd-3-clause":
      return `BSD 3-Clause License\n\nCopyright (c) ${yr}, ${holder}\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n\n2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n\n3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;
    case "gpl-3.0":
      return `GNU General Public License v3.0\n\nCopyright (C) ${yr} ${holder}\n\nThis program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.\n\nThis program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.\n\nYou should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.`;
    case "unlicense":
      return `This is free and unencumbered software released into the public domain.\n\nAnyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.\n\nFor more information, please refer to <https://unlicense.org>`;
    case "none":
      return `Proprietary — All rights reserved. © ${yr} ${holder}. Contact the author for licensing options.`;
  }
}

/** Build an emoji prefix for a section heading (when emojiHeadings enabled). */
export function emojiFor(id: SectionId): string {
  const map: Record<SectionId, string> = {
    "title": "",
    "badges": " shields",
    "toc": "",
    "description": "📜",
    "features": "✨",
    "prerequisites": "📋",
    "installation": "📦",
    "usage": "🚀",
    "configuration": "⚙️",
    "scripts": "🧰",
    "api": "📚",
    "examples": "💡",
    "screenshots": "📸",
    "demo": "🌐",
    "tech-stack": "🧱",
    "deployment": "☁️",
    "contributing": "🤝",
    "code-of-conduct": " CODE",
    "changelog": "📰",
    "faq": "❓",
    "license": "⚖️",
  };
  return map[id] || "";
}

/** Build a Markdown heading (H1/H2) with optional emoji. */
export function buildHeading(text: string, level: 1 | 2, emoji: string, useEmoji: boolean): string {
  const prefix = "#".repeat(level);
  const label = useEmoji && emoji ? `${emoji} ${text}` : text;
  return `${prefix} ${label}`;
}

// ---------- Section rendering ----------

export function renderSection(id: SectionId, inputs: ReadmeInputs, useEmoji: boolean): string {
  switch (id) {
    case "title": {
      const name = inputs.projectName || "Project Name";
      const tagline = inputs.tagline ? `\n\n> ${inputs.tagline}` : "";
      return `# ${name}${tagline}`;
    }
    case "badges":
      return buildBadges(inputs).join("\n");
    case "toc":
      return inputs.includeToc ? buildHeading("Table of Contents", 2, emojiFor("toc"), false) : "";
    case "description":
      return `${buildHeading("Description", 2, emojiFor("description"), useEmoji)}\n\n${inputs.description || "TODO: describe your project."}`;
    case "features":
      return `${buildHeading("Features", 2, emojiFor("features"), useEmoji)}\n\n${inputs.featuresList || "- TODO: list key features"}`;
    case "prerequisites":
      return `${buildHeading("Prerequisites", 2, emojiFor("prerequisites"), useEmoji)}\n\n${inputs.prerequisites || "TODO: list prerequisites (Node version, OS, etc.)"}`;
    case "installation":
      return `${buildHeading("Installation", 2, emojiFor("installation"), useEmoji)}\n\n\`\`\`bash\n${inputs.installCmd || "npm install my-project"}\n\`\`\``;
    case "usage":
      return `${buildHeading("Usage", 2, emojiFor("usage"), useEmoji)}\n\n${inputs.usageExample || "TODO: usage example"}`;
    case "configuration":
      return `${buildHeading("Configuration", 2, emojiFor("configuration"), useEmoji)}\n\n${inputs.configuration || "TODO: configuration options"}`;
    case "scripts":
      return `${buildHeading("Scripts", 2, emojiFor("scripts"), useEmoji)}\n\n${inputs.scripts || "TODO: npm scripts"}`;
    case "api":
      return `${buildHeading("API", 2, emojiFor("api"), useEmoji)}\n\n${inputs.apiDoc || "TODO: document the public API"}`;
    case "examples":
      return `${buildHeading("Examples", 2, emojiFor("examples"), useEmoji)}\n\nSee the [\`examples/\`](${inputs.repoUrl || ""}/tree/main/examples) directory for complete examples.`;
    case "screenshots":
      return `${buildHeading("Screenshots", 2, emojiFor("screenshots"), useEmoji)}\n\n![Screenshot](${inputs.screenshotUrl || "https://placehold.co/600x400?text=Screenshot"})`;
    case "demo":
      return inputs.demoUrl
        ? `${buildHeading("Demo", 2, emojiFor("demo"), useEmoji)}\n\n[Live demo](${inputs.demoUrl})`
        : "";
    case "tech-stack":
      return `${buildHeading("Tech Stack", 2, emojiFor("tech-stack"), useEmoji)}\n\n${inputs.techStack || "- TypeScript"}`;
    case "deployment":
      return `${buildHeading("Deployment", 2, emojiFor("deployment"), useEmoji)}\n\n\`\`\`bash\nnpm run build\nnpm start\n\`\`\``;
    case "contributing":
      return `${buildHeading("Contributing", 2, emojiFor("contributing"), useEmoji)}\n\nContributions are welcome! Please open an issue first to discuss what you'd like to change.\n\n1. Fork the repo\n2. Create a feature branch (\`git checkout -b feat/my-feature\`)\n3. Commit your changes (\`git commit -m 'feat: add my-feature'\`)\n4. Push to the branch (\`git push origin feat/my-feature\`)\n5. Open a Pull Request\n\nPlease run \`npm test\` before submitting.`;
    case "code-of-conduct":
      return `${buildHeading("Code of Conduct", 2, emojiFor("code-of-conduct"), false)}\n\nThis project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) Code of Conduct. By participating, you are expected to uphold this code.`;
    case "changelog":
      return `${buildHeading("Changelog", 2, emojiFor("changelog"), useEmoji)}\n\nSee [CHANGELOG.md](${inputs.repoUrl || ""}/blob/main/CHANGELOG.md) for release history.`;
    case "faq":
      return `${buildHeading("FAQ", 2, emojiFor("faq"), useEmoji)}\n\n${inputs.faqList || "**Q: Where do I report bugs?**\\nA: Use GitHub Issues."}`;
    case "license": {
      const spdx = getLicenseSpdx(inputs.license);
      const link = inputs.license === "none" ? "" : `[${spdx}](${inputs.repoUrl || ""}/blob/main/LICENSE)`;
      return `${buildHeading("License", 2, emojiFor("license"), useEmoji)}\n\n${link || "Proprietary"} © ${inputs.licenseYear || new Date().getFullYear()} ${inputs.author || "Your Name"}. See the full license text below.\n\n<details>\n<summary>Full license text</summary>\n\n\`\`\`\n${buildLicenseText(inputs.license, inputs.author, inputs.licenseYear)}\n\`\`\`\n\n</details>`;
    }
    default:
      return "";
  }
}

/** Build the table of contents from enabled sections (excluding title/badges/toc itself). */
export function buildToc(sections: Section[], inputs: ReadmeInputs): string {
  const skip: SectionId[] = ["title", "badges", "toc"];
  const lines: string[] = [];
  for (const s of sections) {
    if (!s.enabled || skip.includes(s.id)) continue;
    const label = inputs.emojiHeadings && emojiFor(s.id) ? `${emojiFor(s.id)} ${s.label}` : s.label;
    const slug = slugify(label);
    lines.push(`- [${s.label}](#${slug})`);
  }
  return lines.join("\n");
}

// ---------- Generate README ----------

export function generateReadme(
  inputs: ReadmeInputs,
  templateId: TemplateId,
  sections: Section[],
): GeneratedReadme {
  const enabled = sections.filter((s) => s.enabled);
  const parts: string[] = [];
  let tocInserted = false;
  for (const s of enabled) {
    const rendered = renderSection(s.id, inputs, inputs.emojiHeadings);
    if (!rendered.trim()) continue;
    parts.push(rendered);
    if (s.id === "toc" && inputs.includeToc && !tocInserted) {
      // Insert TOC body between heading and next section.
      const tocBody = buildToc(enabled, inputs);
      if (tocBody) {
        parts.push(tocBody);
        tocInserted = true;
      }
    }
  }
  const markdown = parts.join("\n\n").trim() + "\n";
  return {
    markdown,
    sections: enabled,
    wordCount: countWords(markdown),
    charCount: markdown.length,
    lineCount: markdown.split("\n").length,
    badges: buildBadges(inputs),
    templateId,
  };
}

// ---------- package.json parser ----------

/** Parse a package.json string into a partial ReadmeInputs. */
export function parsePackageJson(json: string): Partial<ReadmeInputs> {
  if (!json || !json.trim()) return {};
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
  const out: Partial<ReadmeInputs> = {};
  if (typeof pkg.name === "string") {
    out.projectName = pkg.name;
    out.npmPackage = pkg.name.startsWith("@") ? pkg.name.split("/").pop() ?? pkg.name : pkg.name;
    out.githubRepo = out.npmPackage;
  }
  if (typeof pkg.description === "string") out.description = pkg.description;
  if (typeof pkg.author === "string") {
    out.author = pkg.author;
  } else if (pkg.author && typeof pkg.author === "object") {
    const a = pkg.author as Record<string, unknown>;
    if (typeof a.name === "string") out.author = a.name;
  }
  if (typeof pkg.license === "string") {
    const lic = pkg.license.toLowerCase();
    if (lic.includes("mit")) out.license = "mit";
    else if (lic.includes("apache")) out.license = "apache-2.0";
    else if (lic.includes("bsd")) out.license = "bsd-3-clause";
    else if (lic.includes("gpl")) out.license = "gpl-3.0";
    else if (lic.includes("unlicense")) out.license = "unlicense";
    else out.license = "none";
  }
  if (typeof pkg.homepage === "string") out.homepage = pkg.homepage;
  if (pkg.repository && typeof pkg.repository === "object") {
    const r = pkg.repository as Record<string, unknown>;
    if (typeof r.url === "string") {
      out.repoUrl = r.url.replace(/^git\+/, "").replace(/\.git$/, "");
      const m = out.repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)/);
      if (m) {
        out.githubUser = m[1];
        out.githubRepo = m[2];
      }
    }
  } else if (typeof pkg.repository === "string") {
    out.repoUrl = `https://github.com/${pkg.repository}`;
  }
  if (pkg.scripts && typeof pkg.scripts === "object") {
    const scripts = pkg.scripts as Record<string, string>;
    const lines = Object.entries(scripts).map(([k, v]) => `  "${k}": "${v}"`);
    out.scripts = "```json\n{\n" + lines.join(",\n") + "\n}\n```";
  }
  if (pkg.bin && typeof pkg.bin === "object") {
    out.usageExample = "```bash\n" + Object.keys(pkg.bin as Record<string, unknown>).map((b) => `${b} --help`).join("\n") + "\n```";
  }
  if (typeof pkg.keywords === "object" && Array.isArray(pkg.keywords)) {
    out.featuresList = (pkg.keywords as string[]).slice(0, 5).map((k) => `- ${k}`).join("\n");
  }
  return out;
}

// ---------- Existing README importer ----------

const SECTION_HEADING_MAP: Record<string, SectionId> = {
  "description": "description",
  "about": "description",
  "overview": "description",
  "features": "features",
  "prerequisites": "prerequisites",
  "requirements": "prerequisites",
  "installation": "installation",
  "install": "installation",
  "getting started": "prerequisites",
  "usage": "usage",
  "configuration": "configuration",
  "config": "configuration",
  "options": "configuration",
  "scripts": "scripts",
  "api": "api",
  "examples": "examples",
  "example": "examples",
  "screenshots": "screenshots",
  "demo": "demo",
  "tech stack": "tech-stack",
  "tech-stack": "tech-stack",
  "deployment": "deployment",
  "contributing": "contributing",
  "code of conduct": "code-of-conduct",
  "code-of-conduct": "code-of-conduct",
  "changelog": "changelog",
  "faq": "faq",
  "license": "license",
};

/** Best-effort parse of an existing README into partial ReadmeInputs + a sections list. */
export function parseExistingReadme(
  text: string,
): { inputs: Partial<ReadmeInputs>; enabledSections: SectionId[] } {
  if (!text || !text.trim()) return { inputs: {}, enabledSections: [] };
  const lines = text.split("\n");
  const inputs: Partial<ReadmeInputs> = {};
  const enabledSections: SectionId[] = [];
  // Title from first H1.
  const h1 = lines.find((l) => /^#\s+/.test(l));
  if (h1) {
    inputs.projectName = h1.replace(/^#\s+/, "").trim();
  }
  // Description: first non-heading, non-empty paragraph.
  const descIdx = lines.findIndex(
    (l, i) => i > 0 && l.trim() && !/^#/.test(l) && !/^!\[/.test(l) && !/^\[!\[/.test(l),
  );
  if (descIdx >= 0) {
    const para = [lines[descIdx]];
    for (let j = descIdx + 1; j < lines.length; j++) {
      if (!lines[j].trim()) break;
      if (/^#/.test(lines[j])) break;
      para.push(lines[j]);
    }
    inputs.description = para.join(" ").trim();
  }
  // Walk headings to find enabled sections and capture section bodies.
  let current: { id: SectionId | null; body: string[] } = { id: null, body: [] };
  const sectionBodies: Partial<Record<SectionId, string>> = {};
  const flush = () => {
    if (current.id) {
      const body = current.body.join("\n").trim();
      if (body) sectionBodies[current.id] = body;
    }
    current = { id: null, body: [] };
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      const label = m[1].toLowerCase().replace(/[^\w\s-]/g, "").trim();
      const id = SECTION_HEADING_MAP[label];
      if (id) {
        current.id = id;
        if (!enabledSections.includes(id)) enabledSections.push(id);
      }
    } else if (current.id) {
      current.body.push(line);
    }
  }
  flush();
  // Map captured bodies back to inputs fields where possible.
  if (sectionBodies.features) inputs.featuresList = sectionBodies.features;
  if (sectionBodies.prerequisites) inputs.prerequisites = sectionBodies.prerequisites;
  if (sectionBodies.installation) inputs.installCmd = stripCodeFence(sectionBodies.installation).split("\n")[0] ?? "npm install";
  if (sectionBodies.usage) inputs.usageExample = sectionBodies.usage;
  if (sectionBodies.configuration) inputs.configuration = sectionBodies.configuration;
  if (sectionBodies.scripts) inputs.scripts = sectionBodies.scripts;
  if (sectionBodies.api) inputs.apiDoc = sectionBodies.api;
  if (sectionBodies["tech-stack"]) inputs.techStack = sectionBodies["tech-stack"];
  if (sectionBodies.faq) inputs.faqList = sectionBodies.faq;
  // License detection from body.
  if (sectionBodies.license) {
    const l = sectionBodies.license.toLowerCase();
    if (l.includes("mit")) inputs.license = "mit";
    else if (l.includes("apache")) inputs.license = "apache-2.0";
    else if (l.includes("bsd")) inputs.license = "bsd-3-clause";
    else if (l.includes("gpl")) inputs.license = "gpl-3.0";
    else if (l.includes("unlicense")) inputs.license = "unlicense";
  }
  return { inputs, enabledSections };
}

function stripCodeFence(s: string): string {
  return s.replace(/^```[a-z]*\n?/g, "").replace(/```\s*$/g, "").trim();
}

// ---------- Minimal Markdown → HTML (for preview) ----------

/** Convert a (subset of) Markdown into HTML for the live preview. */
export function markdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
        codeLang = "";
      } else {
        codeLang = line.slice(3).trim();
        out.push(`<pre><code class="language-${escapeHtml(codeLang)}">`);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    if (/^###\s+/.test(line)) {
      closeList();
      out.push(`<h3>${inlineMd(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h2>${inlineMd(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeList();
      out.push(`<h1>${inlineMd(line.replace(/^#\s+/, ""))}</h1>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inlineMd(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineMd(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeList();
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      closeList();
      out.push(`<p>${inlineMd(line)}</p>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

/** Inline Markdown: bold, italic, code, links, images. */
export function inlineMd(s: string): string {
  let out = escapeHtml(s);
  // Images: ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // Inline code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
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
  params.set("t", state.templateId);
  // Encode inputs as compact JSON to keep URL manageable.
  params.set("i", JSON.stringify(state.inputs));
  if (state.sections.length > 0) {
    params.set("s", state.sections.map((s) => `${s.id}:${s.enabled ? "1" : "0"}`).join(","));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const t = params.get("t");
  if (!t) return null;
  const validTemplates: TemplateId[] = ["open-source", "npm-package", "library", "cli-tool", "web-app"];
  if (!validTemplates.includes(t as TemplateId)) return null;
  const templateId = t as TemplateId;
  let inputs: ReadmeInputs = { ...DEFAULT_INPUTS };
  const iRaw = params.get("i");
  if (iRaw) {
    try {
      const parsed = JSON.parse(iRaw) as Partial<ReadmeInputs>;
      inputs = { ...DEFAULT_INPUTS, ...parsed };
    } catch {
      // ignore
    }
  }
  const sRaw = params.get("s");
  let sections: Section[] = buildSectionsFromTemplate(templateId);
  if (sRaw) {
    const overrides: Partial<Record<SectionId, boolean>> = {};
    const validIds = new Set<SectionId>(ALL_SECTIONS);
    for (const part of sRaw.split(",")) {
      const [id, flag] = part.split(":");
      if (id && validIds.has(id as SectionId)) {
        overrides[id as SectionId] = flag === "1";
      }
    }
    // Preserve order from default sections, apply overrides, then keep enabled state from overrides.
    sections = sections.map((s) => ({
      ...s,
      enabled: s.id in overrides ? !!overrides[s.id] : s.enabled,
    }));
  }
  return { inputs, templateId, sections };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(inputs: ReadmeInputs, templateId: TemplateId): LlmPrompt {
  const system =
    "You are a technical writer. Improve the user's README draft. Tighten prose, fix typos, " +
    "add concrete examples where appropriate, and preserve all Markdown formatting and code blocks. " +
    "Do not invent API signatures or commands that aren't in the input. Output the full README.md only.";
  const user =
    `Template: ${templateId}\n` +
    `Project: ${inputs.projectName}\n` +
    `Description: ${inputs.description}\n` +
    `Install: ${inputs.installCmd}\n` +
    `Usage:\n${inputs.usageExample}\n` +
    `Features:\n${inputs.featuresList}\n` +
    `API:\n${inputs.apiDoc}\n` +
    `License: ${inputs.license}\n\n` +
    `Produce a polished README.md as Markdown.`;
  return { system, user };
}

/** Render the LLM response — for this tool we trust the model's Markdown output verbatim. */
export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
