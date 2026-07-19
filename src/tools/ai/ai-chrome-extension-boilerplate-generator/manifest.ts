import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-chrome-extension-boilerplate-generator",
  name: "AI Chrome Extension Boilerplate Generator",
  description:
    "Generate a ready-to-load Manifest V3 Chrome extension scaffold in-browser: valid manifest.json, popup/options/content-script/background service worker/side-panel files, framework picker (Vanilla/React/Vue), permission catalog with explanations and over-broad warnings, cross-browser Firefox manifest variant, Vite/HMR build config, message-passing + storage helpers, icons placeholder, README, file-tree preview, and a downloadable ZIP — no CLI, no sign-up, no uploads. 100% client-side with optional BYO-key LLM polish.",
  category: "ai",
  keywords: [
    "chrome extension boilerplate", "manifest v3 generator", "chrome extension scaffold",
    "chrome extension starter", "mv3 boilerplate", "no cli chrome extension",
    "plasmo alternative", "extensionizr alternative", "crxjs alternative",
    "chrome extension zip download", "content script generator",
    "background service worker", "popup html generator",
  ],
  icon: "puzzle",
  requiresNetwork: false,
  seo: {
    title: "AI Chrome Extension Boilerplate Generator — Manifest V3, ZIP, Private | UnQTools",
    faq: [
      {
        q: "How does the Chrome extension boilerplate generator work?",
        a: "Pick a framework (Vanilla, React, or Vue), tick the surfaces you need (popup, options page, content script, background service worker, side panel), and select permissions from a curated catalog with explanations. The tool generates a valid Manifest V3 manifest.json plus all the matching JS/HTML/CSS files, a Vite config for React/Vue, message-passing and storage helper snippets, an icons placeholder, and a README — then packages them into a ZIP you can download and load directly into chrome://extensions as an unpacked extension.",
      },
      {
        q: "Why does the tool warn me about over-broad permissions?",
        a: "Chrome Web Store reviewers scrutinize extensions that request broad permissions (like <all_urls>, tabs, or history) because they expose user data. The tool flags any permission in our 'review-risk' category with a clear warning so you can request the minimum your feature actually needs — this is the single biggest factor in getting your extension approved faster.",
      },
      {
        q: "Can I generate a Firefox-compatible manifest variant?",
        a: "Yes. Toggle the 'Cross-browser (Firefox) variant' option and the tool emits a second manifest with the Firefox-specific fields (browser_specific_settings.gecko.id, background.scripts instead of service_worker for older Firefox versions, and a slightly different action format). Firefox MV3 is converging with Chrome but still differs in a few keys — the tool keeps both variants side-by-side so you can ship to both stores.",
      },
      {
        q: "What extra features does this tool have compared to other scaffolders?",
        a: "(1) Framework picker (Vanilla/React/Vue). (2) Surface checkboxes (popup, options, content script, background SW, side panel). (3) Permission catalog with explanations + risk levels. (4) Over-broad permission warnings (Chrome Web Store review risk). (5) Host permissions input. (6) Cross-browser Firefox manifest variant. (7) Vite/HMR build config generator. (8) Message-passing helper snippet. (9) Storage helper snippet. (10) Pure-JS ZIP builder (store mode + CRC-32). (11) File-tree preview. (12) Icons placeholder (inline SVG → PNG-style data URI). (13) README generator. (14) NL 'describe my extension' keyword router (on-device). (15) Manifest validator (basic shape checks). (16) History (localStorage, last 20). (17) Shareable URL with all inputs encoded. (18) Stats (file count, total size, permission count). (19) Optional BYO-key LLM polish (OpenAI/Anthropic). (20) Honesty disclaimer about scaffolding + store review.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All scaffold generation, manifest validation, ZIP building, history, and sharing run locally in your browser. Your extension description never leaves this device. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
