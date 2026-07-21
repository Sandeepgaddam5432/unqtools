/**
 * GitHub Badge (shields.io) Generator — Tool Manifest.
 * Tool #345 — Category 4 (Developer & Code).
 *
 * Build shields.io badge URLs visually — static and dynamic — with correct
 * label/message/color escaping, logo + style pickers, named and hex colors,
 * brand preset gallery, and Markdown/HTML/RST/AsciiDoc embed output. 100%
 * client-side; the only network request is the badge image itself (served by
 * img.shields.io when the page renders the preview).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "github-badge-shields-io-generator",
  name: "GitHub Badge (shields.io) Generator",
  description:
    "Build shields.io badge URLs with correct escaping — static and dynamic badges, brand presets, logo + style + named/hex color pickers, link wrapping, and Markdown/HTML/RST/AsciiDoc embed output. Coverage, npm version, downloads, license, GitHub stars/forks/issues, build status, custom badges, batch row builder, history (localStorage), shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "shields.io", "badge generator", "github badges",
    "markdown badge", "readme badge", "shields badge url",
    "npm version badge", "coverage badge", "build status badge",
    "custom badge maker", "static badge", "dynamic badge",
  ],
  icon: "badge-check",
  requiresNetwork: false,
  seo: {
    title: "GitHub Badge (shields.io) Generator — Markdown / HTML / RST | UnQTools",
    faq: [
      {
        q: "How does the badge generator work?",
        a: "Pick a badge type (static custom, GitHub stars/forks/issues, build status, coverage, npm version, downloads, license, or a brand preset), set the label/message/color, optionally choose a logo (simple-icons slug), style (flat/flat-square/for-the-badge/plastic/social), and we generate a correctly escaped shields.io URL plus the embed code in Markdown, HTML, reStructuredText, and AsciiDoc formats — each ready to copy.",
      },
      {
        q: "What escaping rules does shields.io require?",
        a: "Shields.io splits the path on `--` so any literal dash in your label or message must be written as `--` (double-dash). Underscores become spaces, `%20` also works for spaces, and any literal `_` you want preserved must be written as `__`. Our encoder handles all of this automatically — type `build-status` and `CI / CD pipeline` and we emit `build--status--CI%20/%20CD%20pipeline` so the badge renders correctly instead of falling back to alt text.",
      },
      {
        q: "What color and logo options are supported?",
        a: "Colors: 19 named shields.io colors (brightgreen, green, yellowgreen, yellow, orange, red, blue, lightgrey, success, important, critical, informational, inactive, blueviolet, ff69b4, 9cf, beeaed, fedora) plus any hex color like `#ff6f00` (the leading `#` is stripped automatically). Logos: any simple-icons slug like `github`, `npm`, `docker`, `react`, plus an optional logoColor override (hex without #).",
      },
      {
        q: "What badge types are pre-built?",
        a: "Eight dynamic GitHub/npm/CI templates — GitHub stars, forks, issues, watchers, last commit; npm version, npm downloads, David-DM dependencies; CircleCI build, Codecov coverage, GitHub Actions workflow status, license (MIT/Apache/GPL). Each template takes your repo or package name and fills in the correct path. Plus 12 brand presets (GitHub, npm, Docker, React, Vue, Node, TypeScript, Python, Rust, Go, Linux, VS Code) for instant logo+color badges.",
      },
      {
        q: "What extra features does this tool have versus hand-coding the URL?",
        a: "(1) Eight dynamic badge templates (GitHub, npm, CI). (2) Static custom badge builder. (3) Twelve brand presets with logo + color. (4) Five styles (flat/flat-square/for-the-badge/plastic/social). (5) Named + hex color picker with validation. (6) simple-icons logo slug + logoColor. (7) Link wrapping (badge is clickable). (8) Four embed formats (Markdown / HTML / RST / AsciiDoc). (9) Batch row builder (multiple badges on one line). (10) Double-dash escaping with `__` underscore handling. (11) Live preview by loading the shields.io image. (12) Stats (badge count, by type). (13) History (localStorage, last 20). (14) Shareable URL with full config encoded. 100% client-side — your badge config is never uploaded.",
      },
    ],
  },
  status: "done",
};
