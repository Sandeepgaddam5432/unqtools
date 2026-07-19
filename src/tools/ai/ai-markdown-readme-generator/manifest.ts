import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-markdown-readme-generator",
  name: "AI Markdown README Generator — Private, No Repo Upload",
  description:
    "Generate a professional README.md from project inputs or a pasted package.json. Five templates (open-source, npm package, library, CLI tool, web app). Section toggles + reorder, shields.io badge builder, license picker with full text, live Markdown preview, auto table of contents, emoji headings, screenshot placeholders, save projects locally, and import existing README to restructure. Pure-JS templater — optional BYO-key LLM polish. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "readme generator", "github readme generator", "readme.md generator",
    "readme maker", "readme.so alternative", "private readme tool",
    "no repo upload readme", "markdown readme builder", "npm package readme",
    "cli readme template",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "AI Markdown README Generator — Private, No Repo Upload | UnQTools",
    faq: [
      {
        q: "How does the AI Markdown README Generator work?",
        a: "Pick a template (open-source, npm package, library, CLI tool, or web app), fill in your project name, description, install command, usage example, license, repo URL, and optional metadata (or paste a package.json and let us parse it). The templater assembles a structured README with badges, table of contents, features, installation, usage, configuration, API, screenshots, contributing, code of conduct, changelog, FAQ, and license. Toggle, reorder, or remove sections; pick from 10 shields.io badges; choose from 6 licenses with full SPDX text; toggle emoji headings and screenshot placeholders. The preview renders Markdown live and you can copy or download README.md.",
      },
      {
        q: "Which templates and sections are included?",
        a: "Five templates each ship with a curated section set: open-source (21 sections), npm-package (11 sections focused on install/API/options/examples), library (12 sections with quick-start and browser-support), cli-tool (13 sections with commands/options/configuration), and web-app (16 sections with screenshots/demo/tech-stack/deployment). 21 canonical section types in total — toggle, reorder, or add as needed. Each template has a sensible default badge set (npm version, GitHub stars, license, build, coverage, etc.).",
      },
      {
        q: "Can I import an existing README to restructure it?",
        a: "Yes. Paste an existing README.md and the parser does a best-effort extraction: it splits on heading lines, recognizes common section names (Features, Installation, Usage, Configuration, API, Contributing, License, FAQ, Changelog, etc.), and pulls out the project title (first H1), the first paragraph as description, and any inline badge links. You can then re-toggle, reorder, and regenerate. Code blocks, lists, and tables are preserved verbatim in their assigned sections.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five README templates (open-source, npm-package, library, cli-tool, web-app). (2) 21 toggleable, reorderable sections. (3) shields.io badge builder — 10 badge types (npm version/downloads, GitHub stars/license/issues/PRs, build, coverage, Discord, custom). (4) Live Markdown preview. (5) Auto table of contents. (6) Emoji headings toggle. (7) Screenshot/diagram placeholder toggle. (8) License picker with full SPDX text (MIT, Apache-2.0, BSD-3-Clause, GPL-3.0, Unlicense, None). (9) package.json parser. (10) Existing-README import for restructuring. (11) Save projects locally (last 20). (12) Shareable URL with inputs encoded. (13) Copy / download README.md. (14) Optional BYO-key LLM polish (OpenAI). (15) Honesty disclaimers (verify commands/API against your actual code).",
      },
      {
        q: "Is my project data sent anywhere?",
        a: "No. All template assembly, badge URL building, license rendering, Markdown preview, and package.json parsing run locally in your browser. Your project name, description, and any package.json you paste never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI.",
      },
    ],
  },
  status: "done",
};
