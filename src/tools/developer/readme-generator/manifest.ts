/**
 * README Generator — Tool Manifest.
 * Tool #343 — Category 4 (Developer & Code).
 *
 * A section-based builder that scaffolds a professional project README from
 * clickable blocks — title, badges, description, TOC, installation, usage,
 * features, API, contributing, license — with templates for npm, GitHub,
 * library, CLI, and profile READMEs, a Shields.io badge builder, a license
 * picker with full SPDX text, import of existing READMEs, and live preview.
 * 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "readme-generator",
  name: "README Generator",
  description:
    "Scaffold a professional README.md from clickable section blocks — title, badges, description, auto-TOC, installation, usage, features, API, contributing, license — with project templates (npm, GitHub, library, CLI, profile), an inline Shields.io badge builder, a license picker with full SPDX text (MIT, Apache-2.0, GPL-3.0, …), import of existing READMEs, and a live preview. 100% client-side.",
  category: "developer",
  keywords: [
    "readme generator", "readme.md generator", "github readme template",
    "profile readme generator", "readme.so alternative", "readme builder",
    "shields.io badges", "license picker", "mit license generator",
    "apache license generator", "gpl license generator", "project readme",
    "documentation scaffold", "spdx license", "readme sections",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "README Generator — Section Builder, Badges, License Picker | UnQTools",
    faq: [
      {
        q: "How does the README generator work?",
        a: "Pick a project template (npm, GitHub, library, CLI, or GitHub profile), then add, reorder, or remove section blocks. Each section has per-field inputs with sensible placeholders. The live preview on the right updates as you type, and Copy / Download give you a clean README.md ready to drop into your repo. A [TOC] marker is auto-expanded into a clickable table of contents with anchor links that resolve on GitHub.",
      },
      {
        q: "Which licenses are supported with full SPDX text?",
        a: "MIT, Apache-2.0, GPL-3.0, BSD-3-Clause, ISC, MPL-2.0, Unlicense, and a Proprietary placeholder. The full license body is generated with the correct year and copyright holder substituted into the template variables. The license section in the README also emits a Shields.io badge so visitors see the license at a glance.",
      },
      {
        q: "How do Shields.io badges work in this tool?",
        a: "Pick a badge preset (npm version, build status, downloads, license, GitHub stars, coverage, TypeScript, bundle size, etc.) or build a custom static badge. The tool constructs the correct shields.io URL — including URL-encoded label, message, and color — and inserts it as markdown image syntax in the badges section. Badges can be enabled or disabled individually.",
      },
      {
        q: "Can I re-edit an existing README.md?",
        a: "Yes. Paste your existing README into the Import box and click Import. The parser splits the document back into sections by markdown headings (H1/H2), extracts badge markdown image lines, the fenced license block, and inline code blocks, then loads them into the editor so you can edit and re-export. Re-importing the same README round-trips cleanly.",
      },
      {
        q: "What extra features does this tool have versus readme.so?",
        a: "(1) Section library with 12 block types (title, badges, description, TOC, installation, usage, features, API, contributing, license, screenshots, collapsible details). (2) 5 project templates (npm, GitHub, library, CLI, profile). (3) Auto-generated TOC with anchor links. (4) Inline Shields.io badge builder (15+ presets + custom). (5) License picker with 8 full SPDX texts and year/author substitution. (6) Re-import existing README.md. (7) Collapsible <details> sections. (8) Per-section enable/disable. (9) Section reorder. (10) Live markdown preview. (11) Copy / Download .md. (12) Stats (sections, badges, chars, words). (13) History (localStorage, last 20). (14) Shareable URL. 100% client-side — your project info is never uploaded.",
      },
    ],
  },
  status: "done",
};
