/**
 * AI Chrome Extension Boilerplate Generator — pure logic.
 *
 * Generate a ready-to-load Manifest V3 Chrome extension scaffold in-browser.
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 *
 * Honesty: scaffold is a starting point — request the minimum permissions and
 * test in chrome://extensions. Chrome Web Store review has its own rules.
 */

// ---------- Types ----------

export type Framework = "vanilla" | "react" | "vue";

export type Surface =
  | "popup"
  | "options"
  | "content"
  | "background"
  | "sidepanel";

export type PermissionRisk = "low" | "medium" | "high";

export interface PermissionMeta {
  name: string;
  risk: PermissionRisk;
  description: string;
  reviewNote?: string;
}

export interface ExtensionInputs {
  name: string;
  description: string;
  version: string;
  framework: Framework;
  surfaces: Surface[];
  permissions: string[];
  hostPermissions: string[];
  contentMatches: string[]; // URL match patterns for content script
  firefoxVariant: boolean;
  includeMessageHelper: boolean;
  includeStorageHelper: boolean;
  includeReadme: boolean;
  includeViteConfig: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  bytes: number;
  language: "json" | "javascript" | "html" | "css" | "markdown" | "text" | "svg";
}

export interface ScaffoldOutput {
  files: GeneratedFile[];
  warnings: string[];
  stats: ScaffoldStats;
  manifestPath: string;
  zipPath: string;
}

export interface ScaffoldStats {
  fileCount: number;
  totalBytes: number;
  permissionCount: number;
  hostPermissionCount: number;
  surfaceCount: number;
  highRiskPermissions: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  children?: FileTreeNode[];
  isFile: boolean;
  bytes?: number;
}

export interface HistoryEntry {
  ts: number;
  name: string;
  framework: Framework;
  surfaces: Surface[];
  permissionCount: number;
  fileCount: number;
}

export interface LlmEnhancement {
  refinedDescription: string;
  recommendedPermissions: string[];
  notes: string[];
  starterCode: string;
}

export interface ShareState {
  inputs?: Partial<ExtensionInputs>;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-chrome-ext-boiler:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-chrome-ext-boiler:llm-key";

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  vanilla: "Vanilla JS",
  react: "React (Vite)",
  vue: "Vue 3 (Vite)",
};

export const SURFACE_LABELS: Record<Surface, string> = {
  popup: "Popup (toolbar action)",
  options: "Options page",
  content: "Content script (inject into pages)",
  background: "Background service worker",
  sidepanel: "Side panel",
};

export const PERMISSIONS: PermissionMeta[] = [
  { name: "activeTab", risk: "low", description: "Grants temporary access to the current tab when the user invokes the extension (clicks the action, uses a context menu item, or a keyboard shortcut)." },
  { name: "alarms", risk: "low", description: "Schedule code to run periodically or at a specified time using chrome.alarms." },
  { name: "bookmarks", risk: "medium", description: "Read, create, edit, and delete Chrome bookmarks via chrome.bookmarks." },
  { name: "contextMenus", risk: "low", description: "Add items to the browser context menu (right-click) via chrome.contextMenus." },
  { name: "cookies", risk: "high", description: "Read, modify, and delete cookies via chrome.cookies. Exposes session tokens — reviewers scrutinize." },
  { name: "downloads", risk: "medium", description: "Open, save, cancel, and show downloaded files via chrome.downloads." },
  { name: "geolocation", risk: "high", description: "Access browser geolocation. Requires user gesture and disclosure." },
  { name: "history", risk: "high", description: "Read and modify browsing history via chrome.history. Reviewers scrutinize." },
  { name: "identity", risk: "medium", description: "OAuth2 user authentication via chrome.identity (getAuthToken / launchWebAuthFlow)." },
  { name: "idle", risk: "low", description: "Detect when the machine is idle, locked, or active via chrome.idle." },
  { name: "management", risk: "high", description: "Manage installed extensions and apps via chrome.management. Reviewers scrutinize." },
  { name: "nativeMessaging", risk: "high", description: "Communicate with a native application installed on the user's machine. Reviewers scrutinize." },
  { name: "notifications", risk: "low", description: "Create system notifications via chrome.notifications." },
  { name: "pageCapture", risk: "medium", description: "Save the current tab as MHTML via chrome.pageCapture." },
  { name: "scripting", risk: "medium", description: "Inject scripts and CSS into pages via chrome.scripting. Pair with host_permissions." },
  { name: "search", risk: "low", description: "Read and modify the default search engine via chrome.search." },
  { name: "storage", risk: "low", description: "Persist data via chrome.storage.local, .sync, .session. Recommended for any stateful extension." },
  { name: "tabs", risk: "high", description: "Access tab metadata (URLs, titles) and query/create/discard tabs. Use activeTab instead when possible." },
  { name: "topSites", risk: "medium", description: "Access the user's top sites (most-visited) via chrome.topSites." },
  { name: "webNavigation", risk: "medium", description: "Receive notifications about navigation events via chrome.webNavigation." },
  { name: "webRequest", risk: "high", description: "Observe and intercept network requests via chrome.webRequest. Host permissions required. Reviewers scrutinize." },
];

/** Permission lookup map for O(1) explanation lookup. */
export const PERMISSION_MAP: Record<string, PermissionMeta> = (() => {
  const out: Record<string, PermissionMeta> = {};
  for (const p of PERMISSIONS) out[p.name] = p;
  return out;
})();

export const DEFAULT_INPUTS: ExtensionInputs = {
  name: "My Extension",
  description: "A starter Chrome extension built with the UnQTools boilerplate generator.",
  version: "1.0.0",
  framework: "vanilla",
  surfaces: ["popup", "background"],
  permissions: ["activeTab", "storage"],
  hostPermissions: [],
  contentMatches: ["<all_urls>"],
  firefoxVariant: false,
  includeMessageHelper: true,
  includeStorageHelper: true,
  includeReadme: true,
  includeViteConfig: false,
};

// ---------- Helpers ----------

/** Lowercase + replace non-alphanumerics with hyphens. */
export function kebabCase(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** PascalCase for React/Vue component names. */
export function pascalCase(s: string): string {
  const parts = kebabCase(s).split("-").filter(Boolean);
  if (parts.length === 0) return "Extension";
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/** Trim + collapse whitespace. */
export function normalizeName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim() || "My Extension";
}

/** Semver-ish validator. */
export function isValidVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/.test((v || "").trim());
}

/** Validate URL match patterns (basic). */
export function isValidMatchPattern(p: string): boolean {
  if (!p) return false;
  if (p === "<all_urls>") return true;
  // scheme://[*.]host[/path]
  return /^<https?|file|ftp|urn>:\/\/(\*\.?)?[\w-]+(?:\.[\w-]+)*(?:\/.*)?$/i.test(p)
    || /^https?:\/\/(\*\.)?[\w-]+(?:\.[\w-]+)*(?:\/.*)?$/i.test(p);
}

/** Get a permission's metadata by name (returns null if unknown). */
export function permissionMeta(name: string): PermissionMeta | null {
  return PERMISSION_MAP[name] ?? null;
}

/** Explain a list of permissions. */
export function explainPermissions(names: string[]): { name: string; meta: PermissionMeta | null }[] {
  return names.map((n) => ({ name: n, meta: permissionMeta(n) }));
}

/** Detect high-risk permissions in the list. */
export function highRiskPermissions(names: string[]): string[] {
  return names.filter((n) => permissionMeta(n)?.risk === "high");
}

/** Validate inputs and produce warnings. */
export function validateInputs(inputs: ExtensionInputs): string[] {
  const out: string[] = [];
  if (!normalizeName(inputs.name)) out.push("Extension name is required.");
  if (!isValidVersion(inputs.version)) {
    out.push(`Version "${inputs.version}" is not a valid semver (e.g. 1.0.0).`);
  }
  if (inputs.surfaces.length === 0) {
    out.push("Pick at least one surface (popup, options, content, background, or sidepanel).");
  }
  const highRisk = highRiskPermissions(inputs.permissions);
  if (highRisk.length > 0) {
    out.push(
      `High-risk permissions selected: ${highRisk.join(", ")}. Chrome Web Store reviewers will scrutinize these — request only what you actually need.`,
    );
  }
  if (inputs.hostPermissions.includes("<all_urls>") && inputs.surfaces.includes("content")) {
    out.push(
      "Content script with <all_urls> host permission runs on every page the user visits. Consider narrowing the match pattern to specific sites.",
    );
  }
  if (inputs.permissions.includes("webRequest") && !inputs.hostPermissions.length) {
    out.push("webRequest requires host_permissions to actually intercept requests.");
  }
  if (inputs.permissions.includes("tabs") && inputs.permissions.includes("activeTab")) {
    out.push("Both 'tabs' and 'activeTab' are selected — 'activeTab' alone is enough for click-triggered access to the current tab.");
  }
  if (inputs.framework !== "vanilla" && !inputs.includeViteConfig) {
    out.push(`${inputs.framework === "react" ? "React" : "Vue"} typically needs a Vite config — enable 'Include Vite config'.`);
  }
  return out;
}

// ---------- Manifest builders ----------

/** Build the Manifest V3 manifest.json object. */
export function buildManifest(inputs: ExtensionInputs): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    manifest_version: 3,
    name: normalizeName(inputs.name),
    version: inputs.version.trim() || "1.0.0",
    description: (inputs.description || "").trim(),
  };
  if (inputs.permissions.length > 0) manifest["permissions"] = inputs.permissions;
  if (inputs.hostPermissions.length > 0) manifest["host_permissions"] = inputs.hostPermissions;

  // action (popup) — always include action if popup surface, otherwise minimal
  if (inputs.surfaces.includes("popup")) {
    manifest["action"] = {
      default_popup: "popup/popup.html",
      default_title: normalizeName(inputs.name),
      default_icon: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
    };
  } else {
    manifest["action"] = {
      default_title: normalizeName(inputs.name),
      default_icon: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
    };
  }

  if (inputs.surfaces.includes("background")) {
    manifest["background"] = { service_worker: "background.js", type: "module" };
  }
  if (inputs.surfaces.includes("options")) {
    manifest["options_ui"] = { page: "options/options.html", open_in_tab: true };
  }
  if (inputs.surfaces.includes("sidepanel")) {
    manifest["side_panel"] = { default_path: "sidepanel/sidepanel.html" };
  }
  if (inputs.surfaces.includes("content")) {
    manifest["content_scripts"] = [
      {
        matches: inputs.contentMatches.length > 0 ? inputs.contentMatches : ["<all_urls>"],
        js: ["content/content.js"],
        run_at: "document_idle",
      },
    ];
  }
  manifest["icons"] = {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  };
  return manifest;
}

/** Build a Firefox-compatible Manifest V3 variant. */
export function buildFirefoxManifest(inputs: ExtensionInputs): Record<string, unknown> {
  const base = buildManifest(inputs);
  // Firefox uses browser_specific_settings for an extension ID + strict_min_version
  const slug = kebabCase(inputs.name) || "my-extension";
  base["browser_specific_settings"] = {
    gecko: {
      id: `${slug}@example.com`,
      strict_min_version: "115.0",
    },
  };
  // Firefox MV3 supports service_worker behind a flag; for broad compat,
  // emit both service_worker and scripts in background.
  if (inputs.surfaces.includes("background")) {
    base["background"] = {
      service_worker: "background.js",
      scripts: ["background.js"],
      type: "module",
    };
  }
  return base;
}

/** Stringify a manifest with 2-space indentation. */
export function stringifyManifest(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

// ---------- File generators ----------

export function generatePopupHtml(inputs: ExtensionInputs): string {
  const title = normalizeName(inputs.name);
  const body =
    inputs.framework === "react"
      ? `  <div id="root"></div>\n  <script type="module" src="./popup.jsx"></script>`
      : inputs.framework === "vue"
        ? `  <div id="app"></div>\n  <script type="module" src="./popup.js"></script>`
        : `  <h1>${escapeHtml(title)}</h1>\n  <p>Your extension is ready. Edit popup/popup.js to begin.</p>\n  <button id="action">Click me</button>\n  <script src="./popup.js"></script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./popup.css" />
</head>
<body>
${body}
</body>
</html>
`;
}

export function generatePopupCss(): string {
  return `/* Popup styles — Manifest V3 */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 320px;
  font: 14px/1.5 system-ui, -apple-system, sans-serif;
  padding: 16px;
  color: #1f2937;
}
h1 { font-size: 18px; margin-bottom: 8px; }
button {
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  font: inherit;
}
button:hover { background: #4338ca; }
`;
}

export function generatePopupJs(inputs: ExtensionInputs): string {
  if (inputs.framework === "react") {
    return `import React from "react";
import { createRoot } from "react-dom/client";
import Popup from "./Popup.jsx";

const root = createRoot(document.getElementById("root"));
root.render(<Popup />);

// chrome.runtime.sendMessage is available in popup context.
chrome.runtime.sendMessage({ type: "POPUP_READY" }, (resp) => {
  console.log("[popup] background ack:", resp);
});
`;
  }
  if (inputs.framework === "vue") {
    return `import { createApp } from "vue";
import Popup from "./Popup.vue";

createApp(Popup).mount("#app");
`;
  }
  return `// Popup logic — Manifest V3
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("action");
  if (btn) {
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "POPUP_ACTION" }, (resp) => {
        console.log("[popup] ack:", resp);
      });
    });
  }
});
`;
}

export function generateOptionsHtml(inputs: ExtensionInputs): string {
  const title = normalizeName(inputs.name) + " — Options";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./options.css" />
</head>
<body>
  <h1>${escapeHtml(normalizeName(inputs.name))} Options</h1>
  <form id="options-form">
    <label>Setting 1
      <input type="text" id="setting1" name="setting1" />
    </label>
    <button type="submit">Save</button>
  </form>
  <script src="./options.js"></script>
</body>
</html>
`;
}

export function generateOptionsJs(): string {
  return `// Options page logic — Manifest V3
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("options-form");
  const setting1 = document.getElementById("setting1");

  // Load saved settings
  const { setting1: saved } = await chrome.storage.local.get("setting1");
  if (saved) setting1.value = saved;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await chrome.storage.local.set({ setting1: setting1.value });
    const status = document.createElement("span");
    status.textContent = "Saved!";
    form.appendChild(status);
    setTimeout(() => status.remove(), 1500);
  });
});
`;
}

export function generateContentScript(inputs: ExtensionInputs): string {
  return `// Content script — runs in page context.
// Matches: ${inputs.contentMatches.join(", ") || "<all_urls>"}
(function () {
  console.log("[${escapeHtml(kebabCase(inputs.name))}] content script loaded");

  // Listen for messages from the background / popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "PING_CONTENT") {
      sendResponse({ ok: true, url: location.href, title: document.title });
    }
    return true; // keep the message channel open for async responses
  });
})();
`;
}

export function generateBackgroundSw(inputs: ExtensionInputs): string {
  return `// Background service worker — Manifest V3
// Runs in a non-DOM context; no access to window/document.

// Install / activate lifecycle hooks
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[${escapeHtml(kebabCase(inputs.name))}] installed:", details.reason);
});

// Listen for messages from popup / options / content
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;
  switch (msg.type) {
    case "POPUP_READY":
      sendResponse({ ok: true, ts: Date.now() });
      return false;
    case "POPUP_ACTION":
      console.log("[bg] popup action from", sender.tab?.id ?? "popup");
      sendResponse({ ok: true, action: "received" });
      return false;
    default:
      console.warn("[bg] unknown message type:", msg.type);
      return false;
  }
});
`;
}

export function generateSidePanelHtml(inputs: ExtensionInputs): string {
  const title = normalizeName(inputs.name) + " — Side Panel";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./sidepanel.css" />
</head>
<body>
  <h1>${escapeHtml(normalizeName(inputs.name))}</h1>
  <p>Side panel content goes here.</p>
  <script src="./sidepanel.js"></script>
</body>
</html>
`;
}

export function generateSidePanelJs(): string {
  return `// Side panel logic — Manifest V3
// Open via chrome.sidePanel.open() (requires user gesture).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SIDE_PANEL_PING") {
    sendResponse({ ok: true, ts: Date.now() });
  }
  return false;
});
`;
}

export function generateMessageHelper(): string {
  return `// Message-passing helper — type-safe-ish wrappers around chrome.runtime.sendMessage
// Usage:
//   import { sendMessage } from "./message.js";
//   const resp = await sendMessage({ type: "PING" });
export function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resp);
    });
  });
}

export function sendTabMessage(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resp);
    });
  });
}

export function onMessage(handler) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    Promise.resolve(handler(msg, sender)).then(sendResponse).catch(() => sendResponse(undefined));
    return true; // async response
  });
}
`;
}

export function generateStorageHelper(): string {
  return `// Storage helper — Promise wrappers around chrome.storage.local / .sync
export async function get(key) {
  const obj = await chrome.storage.local.get(key);
  return obj[key];
}

export async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function remove(key) {
  await chrome.storage.local.remove(key);
}

export async function getSync(key) {
  const obj = await chrome.storage.sync.get(key);
  return obj[key];
}

export async function setSync(key, value) {
  await chrome.storage.sync.set({ [key]: value });
}

// Watch a key for changes
export function watch(key, handler) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && key in changes) {
      handler(changes[key].newValue, changes[key].oldValue);
    }
  });
}
`;
}

export function generateViteConfig(inputs: ExtensionInputs): string {
  if (inputs.framework === "react") {
    return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
`;
  }
  return `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
`;
}

export function generatePackageJson(inputs: ExtensionInputs): string {
  const slug = kebabCase(inputs.name) || "my-extension";
  const base: Record<string, unknown> = {
    name: slug,
    version: inputs.version.trim() || "1.0.0",
    description: inputs.description.trim(),
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
  };
  if (inputs.framework === "react") {
    base["dependencies"] = {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    };
    base["devDependencies"] = {
      "@crxjs/vite-plugin": "^2.0.0-beta.28",
      "@types/chrome": "^0.0.270",
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      vite: "^5.3.4",
    };
  } else if (inputs.framework === "vue") {
    base["dependencies"] = { vue: "^3.4.31" };
    base["devDependencies"] = {
      "@crxjs/vite-plugin": "^2.0.0-beta.28",
      "@types/chrome": "^0.0.270",
      "@vitejs/plugin-vue": "^5.0.6",
      vite: "^5.3.4",
    };
  } else {
    base["devDependencies"] = {
      "@types/chrome": "^0.0.270",
      vite: "^5.3.4",
    };
  }
  return JSON.stringify(base, null, 2);
}

/** Generate a placeholder SVG icon (also serves as a fallback for PNG sizes). */
export function generateIconSvg(size: number = 128): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size / 6)}" fill="#4f46e5"/>
  <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="${Math.round(size / 2.4)}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">E</text>
</svg>
`;
}

export function generateReadme(inputs: ExtensionInputs): string {
  const lines: string[] = [];
  lines.push(`# ${normalizeName(inputs.name)}`);
  lines.push("");
  lines.push(inputs.description.trim() || "Chrome extension boilerplate generated by UnQTools.");
  lines.push("");
  lines.push("## Getting started");
  lines.push("");
  lines.push("### Load as an unpacked extension (Chrome)");
  lines.push("");
  lines.push("1. Open `chrome://extensions` in Chrome.");
  lines.push("2. Enable **Developer mode** (top-right toggle).");
  lines.push("3. Click **Load unpacked** and select this folder.");
  lines.push("4. The extension appears in your toolbar — pin it for easy access.");
  lines.push("");
  if (inputs.framework !== "vanilla") {
    lines.push("### Develop with Vite + HMR");
    lines.push("");
    lines.push("```bash");
    lines.push("npm install");
    lines.push("npm run dev");
    lines.push("```");
    lines.push("");
    lines.push("Then load the `dist/` folder as an unpacked extension.");
    lines.push("");
  }
  lines.push("## Permissions");
  lines.push("");
  if (inputs.permissions.length === 0) {
    lines.push("This extension requests no permissions.");
  } else {
    lines.push("| Permission | Risk | Why |");
    lines.push("| ---------- | ---- | --- |");
    for (const p of inputs.permissions) {
      const meta = permissionMeta(p);
      lines.push(`| \`${p}\` | ${meta?.risk ?? "unknown"} | ${meta?.description ?? "(unknown permission)"} |`);
    }
  }
  lines.push("");
  if (inputs.hostPermissions.length > 0) {
    lines.push("## Host permissions");
    lines.push("");
    for (const h of inputs.hostPermissions) {
      lines.push(`- \`${h}\``);
    }
    lines.push("");
  }
  lines.push("## Files");
  lines.push("");
  lines.push("- `manifest.json` — Manifest V3 declaration");
  if (inputs.surfaces.includes("popup")) lines.push("- `popup/popup.html` + `popup.js` + `popup.css` — toolbar popup");
  if (inputs.surfaces.includes("options")) lines.push("- `options/options.html` + `options.js` — options page");
  if (inputs.surfaces.includes("content")) lines.push("- `content/content.js` — content script");
  if (inputs.surfaces.includes("background")) lines.push("- `background.js` — service worker");
  if (inputs.surfaces.includes("sidepanel")) lines.push("- `sidepanel/sidepanel.html` + `sidepanel.js` — side panel");
  lines.push("- `icons/` — placeholder icons (replace with your own)");
  if (inputs.includeMessageHelper) lines.push("- `lib/message.js` — message-passing helpers");
  if (inputs.includeStorageHelper) lines.push("- `lib/storage.js` — chrome.storage helpers");
  lines.push("");
  lines.push("## Honesty note");
  lines.push("");
  lines.push("This scaffold is a starting point, not a finished product. Chrome Web Store review has its own rules — request the minimum permissions your feature actually needs and test in `chrome://extensions` before publishing.");
  lines.push("");
  lines.push("Generated by UnQTools — 100% client-side, no uploads.");
  return lines.join("\n");
}

/** Generate all files for the scaffold. */
export function generateScaffold(inputs: ExtensionInputs): ScaffoldOutput {
  const files: GeneratedFile[] = [];
  const warnings = validateInputs(inputs);

  const push = (path: string, content: string, language: GeneratedFile["language"]) => {
    files.push({ path, content, bytes: content.length, language });
  };

  // manifest.json
  push("manifest.json", stringifyManifest(buildManifest(inputs)), "json");
  if (inputs.firefoxVariant) {
    push("manifest.firefox.json", stringifyManifest(buildFirefoxManifest(inputs)), "json");
  }

  // surfaces
  if (inputs.surfaces.includes("popup")) {
    push("popup/popup.html", generatePopupHtml(inputs), "html");
    push("popup/popup.css", generatePopupCss(), "css");
    push("popup/popup.js", generatePopupJs(inputs), "javascript");
    if (inputs.framework === "react") {
      push("popup/Popup.jsx", generateReactPopupComponent(inputs), "javascript");
    } else if (inputs.framework === "vue") {
      push("popup/Popup.vue", generateVuePopupComponent(inputs), "javascript");
    }
  }
  if (inputs.surfaces.includes("options")) {
    push("options/options.html", generateOptionsHtml(inputs), "html");
    push("options/options.css", generatePopupCss(), "css");
    push("options/options.js", generateOptionsJs(), "javascript");
  }
  if (inputs.surfaces.includes("content")) {
    push("content/content.js", generateContentScript(inputs), "javascript");
  }
  if (inputs.surfaces.includes("background")) {
    push("background.js", generateBackgroundSw(inputs), "javascript");
  }
  if (inputs.surfaces.includes("sidepanel")) {
    push("sidepanel/sidepanel.html", generateSidePanelHtml(inputs), "html");
    push("sidepanel/sidepanel.css", generatePopupCss(), "css");
    push("sidepanel/sidepanel.js", generateSidePanelJs(), "javascript");
  }

  // helpers
  if (inputs.includeMessageHelper) {
    push("lib/message.js", generateMessageHelper(), "javascript");
  }
  if (inputs.includeStorageHelper) {
    push("lib/storage.js", generateStorageHelper(), "javascript");
  }

  // icons (placeholder SVG — caller can convert to PNG)
  push("icons/icon.svg", generateIconSvg(128), "svg");

  // framework-specific
  if (inputs.framework !== "vanilla") {
    push("package.json", generatePackageJson(inputs), "json");
    if (inputs.includeViteConfig) {
      push("vite.config.js", generateViteConfig(inputs), "javascript");
    }
  }

  // README
  if (inputs.includeReadme) {
    push("README.md", generateReadme(inputs), "markdown");
  }

  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  const stats: ScaffoldStats = {
    fileCount: files.length,
    totalBytes,
    permissionCount: inputs.permissions.length,
    hostPermissionCount: inputs.hostPermissions.length,
    surfaceCount: inputs.surfaces.length,
    highRiskPermissions: highRiskPermissions(inputs.permissions).length,
  };

  return {
    files,
    warnings,
    stats,
    manifestPath: "manifest.json",
    zipPath: `${kebabCase(inputs.name) || "extension"}.zip`,
  };
}

/** React popup component (JSX-as-string for the scaffold). */
export function generateReactPopupComponent(inputs: ExtensionInputs): string {
  return `import React, { useState, useEffect } from "react";

export default function Popup() {
  const [count, setCount] = useState(0);
  const [resp, setResp] = useState(null);

  useEffect(() => {
    // Ping the background on mount
    chrome.runtime.sendMessage({ type: "POPUP_READY" }, (r) => setResp(r));
  }, []);

  return (
    <div style={{ padding: 16, width: 320, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>${escapeHtml(normalizeName(inputs.name))}</h1>
      <p>Background ack: {JSON.stringify(resp)}</p>
      <button onClick={() => setCount((c) => c + 1)}>Clicked {count} times</button>
    </div>
  );
}
`;
}

/** Vue popup SFC (string). */
export function generateVuePopupComponent(inputs: ExtensionInputs): string {
  return `<template>
  <div class="popup">
    <h1>${escapeHtml(normalizeName(inputs.name))}</h1>
    <p>Background ack: {{ resp }}</p>
    <button @click="count++">Clicked {{ count }} times</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
const count = ref(0);
const resp = ref(null);
onMounted(() => {
  chrome.runtime.sendMessage({ type: "POPUP_READY" }, (r) => { resp.value = r; });
});
</script>

<style scoped>
.popup { padding: 16px; width: 320px; font-family: system-ui; }
h1 { font-size: 18px; margin: 0 0 8px; }
button { background: #4f46e5; color: white; border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer; }
</style>
`;
}

// ---------- File tree ----------

/** Build a hierarchical file tree from a flat list of file paths. */
export function buildFileTree(files: GeneratedFile[]): FileTreeNode[] {
  const root: FileTreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children?.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path,
          isFile: isLeaf,
          children: isLeaf ? undefined : [],
          bytes: isLeaf ? f.bytes : undefined,
        };
        node.children!.push(child);
      }
      if (!isLeaf) node = child;
    }
  }
  // sort: directories first, then files, alpha
  const sortRec = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.children) sortRec(n.children);
  };
  sortRec(root.children ?? []);
  return root.children ?? [];
}

// ---------- ZIP builder (store mode + CRC-32) ----------

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}
function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}

/** Build a minimal valid ZIP archive (store mode). Returns the archive bytes. */
export function buildZip(files: ZipFile[]): Uint8Array {
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    // Local file header
    pushU32(out, 0x04034b50);
    pushU16(out, 20); // version needed
    pushU16(out, 0); // flags
    pushU16(out, 0); // compression: STORE
    pushU16(out, 0); // mod time
    pushU16(out, 0); // mod date
    pushU32(out, crc);
    pushU32(out, size); // compressed size
    pushU32(out, size); // uncompressed size
    pushU16(out, nameBytes.length);
    pushU16(out, 0); // extra field length
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    // Central directory record
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20); // version made by
    pushU16(centralDir, 20); // version needed
    pushU16(centralDir, 0); // flags
    pushU16(centralDir, 0); // compression
    pushU16(centralDir, 0); // mod time
    pushU16(centralDir, 0); // mod date
    pushU32(centralDir, crc);
    pushU32(centralDir, size);
    pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0); // extra
    pushU16(centralDir, 0); // comment
    pushU16(centralDir, 0); // disk number
    pushU16(centralDir, 0); // internal attrs
    pushU32(centralDir, 0); // external attrs
    pushU32(centralDir, offset);
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  // End of central directory record
  pushU32(out, 0x06054b50);
  pushU16(out, 0); // disk number
  pushU16(out, 0); // disk with CD
  pushU16(out, files.length);
  pushU16(out, files.length);
  pushU32(out, cdSize);
  pushU32(out, cdStart);
  pushU16(out, 0); // comment length
  return new Uint8Array(out);
}

/** Convert scaffold files to a ZIP archive (store mode). */
export function scaffoldToZip(files: GeneratedFile[]): Uint8Array {
  const zipFiles: ZipFile[] = files.map((f) => ({
    name: f.path,
    bytes: utf8Encode(f.content),
  }));
  return buildZip(zipFiles);
}

// ---------- NL describe mode (on-device keyword router) ----------

export interface ParsedDescription {
  framework: Framework;
  surfaces: Surface[];
  permissions: string[];
  notes: string[];
}

const NL_KEYWORDS: Record<string, { framework?: Framework; surface?: Surface; permission?: string }> = {
  // frameworks
  react: { framework: "react" },
  jsx: { framework: "react" },
  vue: { framework: "vue" },
  // surfaces
  popup: { surface: "popup" },
  toolbar: { surface: "popup" },
  options: { surface: "options" },
  settings: { surface: "options" },
  content: { surface: "content" },
  inject: { surface: "content" },
  background: { surface: "background" },
  service: { surface: "background" },
  sidepanel: { surface: "sidepanel" },
  "side panel": { surface: "sidepanel" },
  "side-panel": { surface: "sidepanel" },
  // permissions
  storage: { permission: "storage" },
  cookies: { permission: "cookies" },
  bookmark: { permission: "bookmarks" },
  history: { permission: "history" },
  download: { permission: "downloads" },
  notification: { permission: "notifications" },
  alarm: { permission: "alarms" },
  tabs: { permission: "tabs" },
  identity: { permission: "identity" },
  contextmenu: { permission: "contextMenus" },
  "context menu": { permission: "contextMenus" },
  geolocation: { permission: "geolocation" },
};

/** Parse a natural-language description into structured inputs (on-device, keyword-based). */
export function parseDescription(text: string): ParsedDescription {
  const lower = (text || "").toLowerCase();
  const out: ParsedDescription = {
    framework: "vanilla",
    surfaces: [],
    permissions: [],
    notes: [],
  };
  for (const [key, val] of Object.entries(NL_KEYWORDS)) {
    if (lower.includes(key)) {
      if (val.framework) out.framework = val.framework;
      if (val.surface && !out.surfaces.includes(val.surface)) out.surfaces.push(val.surface);
      if (val.permission && !out.permissions.includes(val.permission)) {
        out.permissions.push(val.permission);
      }
    }
  }
  if (out.surfaces.length === 0) {
    out.surfaces = ["popup"];
    out.notes.push("No surfaces detected — defaulting to popup only.");
  }
  if (out.permissions.length === 0) {
    out.permissions = ["activeTab"];
    out.notes.push("No permissions detected — adding activeTab (low-risk default).");
  }
  return out;
}

// ---------- Multi-format renderers ----------

export function renderJson(output: ScaffoldOutput): string {
  return JSON.stringify(output, null, 2);
}

export function renderMarkdown(output: ScaffoldOutput): string {
  const lines: string[] = [];
  lines.push(`# ${output.stats.fileCount} files generated`);
  lines.push("");
  lines.push(`- Total size: ${output.stats.totalBytes.toLocaleString()} bytes`);
  lines.push(`- Permissions: ${output.stats.permissionCount} (${output.stats.highRiskPermissions} high-risk)`);
  lines.push(`- Host permissions: ${output.stats.hostPermissionCount}`);
  lines.push(`- Surfaces: ${output.stats.surfaceCount}`);
  lines.push("");
  lines.push("## Files");
  lines.push("");
  for (const f of output.files) {
    lines.push(`- \`${f.path}\` — ${f.bytes.toLocaleString()} bytes (${f.language})`);
  }
  if (output.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

export function renderText(output: ScaffoldOutput): string {
  const lines: string[] = [];
  lines.push(`Chrome extension scaffold — ${output.stats.fileCount} files, ${output.stats.totalBytes.toLocaleString()} bytes`);
  lines.push("");
  for (const f of output.files) {
    lines.push(`${f.path} (${f.bytes} bytes)`);
  }
  return lines.join("\n");
}

export function honestyNote(): string {
  return "Scaffold is a starting point — request the minimum permissions and test in chrome://extensions. Chrome Web Store review has its own rules. Nothing is uploaded or logged by us. The on-device 'describe' mode is keyword-based and weaker than a real LLM call — use BYO-key polish if you want smarter inference.";
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

export function buildShareUrl(inputs: ExtensionInputs): string {
  const params = new URLSearchParams();
  if (inputs.name) params.set("name", inputs.name);
  if (inputs.description) params.set("desc", inputs.description);
  if (inputs.version) params.set("ver", inputs.version);
  if (inputs.framework !== "vanilla") params.set("fw", inputs.framework);
  if (inputs.surfaces.length > 0) params.set("s", inputs.surfaces.join(","));
  if (inputs.permissions.length > 0) params.set("p", inputs.permissions.join(","));
  if (inputs.hostPermissions.length > 0) params.set("hp", inputs.hostPermissions.join(","));
  if (inputs.contentMatches.length > 0 && inputs.contentMatches[0] !== "<all_urls>") {
    params.set("cm", inputs.contentMatches.join(","));
  }
  if (inputs.firefoxVariant) params.set("ff", "1");
  if (inputs.includeMessageHelper) params.set("mh", "1");
  if (inputs.includeStorageHelper) params.set("sh", "1");
  if (inputs.includeReadme) params.set("rm", "1");
  if (inputs.includeViteConfig) params.set("vc", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {} };
  const params = new URLSearchParams(clean);
  const inputs: Partial<ExtensionInputs> = {};
  const name = params.get("name");
  if (name) inputs.name = name;
  const desc = params.get("desc");
  if (desc) inputs.description = desc;
  const ver = params.get("ver");
  if (ver) inputs.version = ver;
  const fw = params.get("fw") as Framework | null;
  if (fw && fw in FRAMEWORK_LABELS) inputs.framework = fw;
  const s = params.get("s");
  if (s) {
    const validSurfaces = Object.keys(SURFACE_LABELS) as Surface[];
    inputs.surfaces = s.split(",").filter((x) => validSurfaces.includes(x as Surface)) as Surface[];
  }
  const p = params.get("p");
  if (p) {
    inputs.permissions = p.split(",").filter((x) => permissionMeta(x));
  }
  const hp = params.get("hp");
  if (hp) inputs.hostPermissions = hp.split(",").filter(Boolean);
  const cm = params.get("cm");
  if (cm) inputs.contentMatches = cm.split(",").filter(Boolean);
  if (params.get("ff") === "1") inputs.firefoxVariant = true;
  if (params.get("mh") === "1") inputs.includeMessageHelper = true;
  if (params.get("sh") === "1") inputs.includeStorageHelper = true;
  if (params.get("rm") === "1") inputs.includeReadme = true;
  if (params.get("vc") === "1") inputs.includeViteConfig = true;
  return { inputs };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: ExtensionInputs): string {
  return [
    "You are a senior Chrome extension architect. Review the user's extension description and suggest refinements + recommended permissions.",
    "",
    "Inputs:",
    `- Name: ${inputs.name}`,
    `- Description: ${inputs.description}`,
    `- Framework: ${FRAMEWORK_LABELS[inputs.framework]}`,
    `- Surfaces: ${inputs.surfaces.join(", ") || "(none)"}`,
    `- Permissions: ${inputs.permissions.join(", ") || "(none)"}`,
    `- Host permissions: ${inputs.hostPermissions.join(", ") || "(none)"}`,
    "",
    "Output a JSON object with:",
    '- "refinedDescription": a one-paragraph clearer description of what the extension does (string)',
    '- "recommendedPermissions": array of permission strings (only those truly needed; prefer minimal)',
    '- "notes": array of strings (3–5 specific implementation notes for this extension)',
    '- "starterCode": a small JavaScript snippet (string) showing a recommended starting pattern',
    "",
    "Be conservative about permissions — request the minimum. No markdown fences, no commentary — only the JSON object.",
  ].join("\n");
}

export function renderLlmResult(
  rawText: string,
): { ok: true; result: LlmEnhancement } | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const refinedDescription = typeof o.refinedDescription === "string" ? o.refinedDescription : "";
  const recommendedPermissions = Array.isArray(o.recommendedPermissions)
    ? (o.recommendedPermissions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const starterCode = typeof o.starterCode === "string" ? o.starterCode : "";
  return { ok: true, result: { refinedDescription, recommendedPermissions, notes, starterCode } };
}

// ---------- Internal helpers ----------

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
