import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  FRAMEWORK_LABELS,
  SURFACE_LABELS,
  PERMISSIONS,
  PERMISSION_MAP,
  DEFAULT_INPUTS,
  kebabCase,
  pascalCase,
  normalizeName,
  isValidVersion,
  isValidMatchPattern,
  permissionMeta,
  explainPermissions,
  highRiskPermissions,
  validateInputs,
  buildManifest,
  buildFirefoxManifest,
  stringifyManifest,
  generatePopupHtml,
  generatePopupJs,
  generateContentScript,
  generateBackgroundSw,
  generateMessageHelper,
  generateStorageHelper,
  generateViteConfig,
  generatePackageJson,
  generateIconSvg,
  generateReadme,
  generateScaffold,
  buildFileTree,
  crc32,
  utf8Encode,
  buildZip,
  scaffoldToZip,
  parseDescription,
  renderJson,
  renderMarkdown,
  renderText,
  honestyNote,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Framework,
  type Surface,
  type ExtensionInputs,
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

describe("ai-chrome-ext-boiler constants", () => {
  it("has 3 frameworks", () => {
    expect(Object.keys(FRAMEWORK_LABELS)).toHaveLength(3);
  });
  it("has 5 surfaces", () => {
    expect(Object.keys(SURFACE_LABELS)).toHaveLength(5);
  });
  it("has at least 20 permissions in catalog", () => {
    expect(PERMISSIONS.length).toBeGreaterThanOrEqual(20);
  });
  it("has a permission map mirroring the catalog", () => {
    for (const p of PERMISSIONS) {
      expect(PERMISSION_MAP[p.name]).toBeDefined();
      expect(PERMISSION_MAP[p.name].risk).toMatch(/^(low|medium|high)$/);
      expect(PERMISSION_MAP[p.name].description.length).toBeGreaterThan(10);
    }
  });
  it("default inputs are valid", () => {
    const warnings = validateInputs(DEFAULT_INPUTS);
    expect(warnings).toEqual([]);
  });
});

describe("ai-chrome-ext-boiler kebabCase", () => {
  it("lowercases and hyphenates", () => {
    expect(kebabCase("My Cool Extension")).toBe("my-cool-extension");
  });
  it("strips non-alphanumeric", () => {
    expect(kebabCase("My Extension! v2.0")).toBe("my-extension-v2-0");
  });
  it("handles empty", () => {
    expect(kebabCase("")).toBe("");
  });
});

describe("ai-chrome-ext-boiler pascalCase", () => {
  it("produces PascalCase", () => {
    expect(pascalCase("my-cool-extension")).toBe("MyCoolExtension");
  });
  it("falls back for empty", () => {
    expect(pascalCase("")).toBe("Extension");
  });
});

describe("ai-chrome-ext-boiler normalizeName", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeName("  My   Extension  ")).toBe("My Extension");
  });
  it("defaults when empty", () => {
    expect(normalizeName("")).toBe("My Extension");
  });
});

describe("ai-chrome-ext-boiler isValidVersion", () => {
  it("accepts semver", () => {
    expect(isValidVersion("1.0.0")).toBe(true);
    expect(isValidVersion("2.5.1")).toBe(true);
  });
  it("rejects non-semver", () => {
    expect(isValidVersion("1.0")).toBe(false);
    expect(isValidVersion("v1.0.0")).toBe(false);
    expect(isValidVersion("latest")).toBe(false);
  });
});

describe("ai-chrome-ext-boiler isValidMatchPattern", () => {
  it("accepts <all_urls>", () => {
    expect(isValidMatchPattern("<all_urls>")).toBe(true);
  });
  it("accepts https pattern", () => {
    expect(isValidMatchPattern("https://*.example.com/*")).toBe(true);
  });
  it("rejects empty", () => {
    expect(isValidMatchPattern("")).toBe(false);
  });
});

describe("ai-chrome-ext-boiler permission helpers", () => {
  it("permissionMeta returns meta for known permission", () => {
    const m = permissionMeta("storage");
    expect(m).not.toBeNull();
    expect(m!.risk).toBe("low");
  });
  it("permissionMeta returns null for unknown permission", () => {
    expect(permissionMeta("frobnicate")).toBeNull();
  });
  it("explainPermissions returns meta for each name", () => {
    const out = explainPermissions(["storage", "tabs", "frobnicate"]);
    expect(out).toHaveLength(3);
    expect(out[0].meta).not.toBeNull();
    expect(out[1].meta).not.toBeNull();
    expect(out[2].meta).toBeNull();
  });
  it("highRiskPermissions filters to high only", () => {
    expect(highRiskPermissions(["storage", "tabs", "history", "activeTab"]))
      .toEqual(["tabs", "history"]);
  });
});

describe("ai-chrome-ext-boiler validateInputs", () => {
  it("warns about invalid version", () => {
    const w = validateInputs({ ...DEFAULT_INPUTS, version: "v1" });
    expect(w.some((x) => x.includes("not a valid semver"))).toBe(true);
  });
  it("warns when no surfaces selected", () => {
    const w = validateInputs({ ...DEFAULT_INPUTS, surfaces: [] });
    expect(w.some((x) => x.includes("Pick at least one surface"))).toBe(true);
  });
  it("warns about high-risk permissions", () => {
    const w = validateInputs({
      ...DEFAULT_INPUTS,
      permissions: ["storage", "history", "tabs"],
    });
    expect(w.some((x) => x.includes("High-risk permissions"))).toBe(true);
  });
  it("warns about <all_urls> + content script", () => {
    const w = validateInputs({
      ...DEFAULT_INPUTS,
      surfaces: ["popup", "content"],
      hostPermissions: ["<all_urls>"],
    });
    expect(w.some((x) => x.includes("Content script with <all_urls>"))).toBe(true);
  });
  it("warns when webRequest is missing host_permissions", () => {
    const w = validateInputs({
      ...DEFAULT_INPUTS,
      permissions: ["webRequest"],
      hostPermissions: [],
    });
    expect(w.some((x) => x.includes("webRequest requires host_permissions"))).toBe(true);
  });
  it("warns when both tabs and activeTab selected", () => {
    const w = validateInputs({
      ...DEFAULT_INPUTS,
      permissions: ["tabs", "activeTab"],
    });
    expect(w.some((x) => x.includes("'activeTab' alone is enough"))).toBe(true);
  });
  it("warns when React/Vue framework missing Vite config", () => {
    const w = validateInputs({
      ...DEFAULT_INPUTS,
      framework: "react",
      includeViteConfig: false,
    });
    expect(w.some((x) => x.includes("typically needs a Vite config"))).toBe(true);
  });
});

describe("ai-chrome-ext-boiler buildManifest", () => {
  it("produces a manifest_version 3 object", () => {
    const m = buildManifest(DEFAULT_INPUTS) as Record<string, unknown>;
    expect(m.manifest_version).toBe(3);
    expect(m.name).toBe("My Extension");
    expect(m.version).toBe("1.0.0");
  });
  it("includes permissions and host_permissions arrays", () => {
    const m = buildManifest({
      ...DEFAULT_INPUTS,
      permissions: ["storage", "tabs"],
      hostPermissions: ["https://*.example.com/*"],
    }) as Record<string, unknown>;
    expect(m.permissions).toEqual(["storage", "tabs"]);
    expect(m.host_permissions).toEqual(["https://*.example.com/*"]);
  });
  it("includes action.default_popup when popup surface selected", () => {
    const m = buildManifest(DEFAULT_INPUTS) as Record<string, unknown>;
    const action = m.action as Record<string, unknown>;
    expect(action.default_popup).toBe("popup/popup.html");
  });
  it("includes background.service_worker when background surface selected", () => {
    const m = buildManifest({
      ...DEFAULT_INPUTS,
      surfaces: ["popup", "background"],
    }) as Record<string, unknown>;
    const bg = m.background as Record<string, unknown>;
    expect(bg.service_worker).toBe("background.js");
  });
  it("includes content_scripts when content surface selected", () => {
    const m = buildManifest({
      ...DEFAULT_INPUTS,
      surfaces: ["content"],
      contentMatches: ["https://*.example.com/*"],
    }) as Record<string, unknown>;
    const cs = m.content_scripts as Array<Record<string, unknown>>;
    expect(cs[0].matches).toEqual(["https://*.example.com/*"]);
    expect(cs[0].js).toEqual(["content/content.js"]);
  });
  it("excludes permissions key when empty", () => {
    const m = buildManifest({ ...DEFAULT_INPUTS, permissions: [] }) as Record<string, unknown>;
    expect(m.permissions).toBeUndefined();
  });
});

describe("ai-chrome-ext-boiler buildFirefoxManifest", () => {
  it("adds browser_specific_settings.gecko", () => {
    const m = buildFirefoxManifest(DEFAULT_INPUTS) as Record<string, unknown>;
    const bss = m.browser_specific_settings as Record<string, unknown>;
    const gecko = bss.gecko as Record<string, unknown>;
    expect(gecko.id).toContain("@example.com");
    expect(gecko.strict_min_version).toBe("115.0");
  });
  it("adds scripts array alongside service_worker for background", () => {
    const m = buildFirefoxManifest({
      ...DEFAULT_INPUTS,
      surfaces: ["background"],
    }) as Record<string, unknown>;
    const bg = m.background as Record<string, unknown>;
    expect(bg.scripts).toEqual(["background.js"]);
  });
});

describe("ai-chrome-ext-boiler stringifyManifest", () => {
  it("produces 2-space indented JSON", () => {
    const s = stringifyManifest({ a: 1 });
    expect(s).toContain('  "a": 1');
  });
});

describe("ai-chrome-ext-boiler file generators", () => {
  it("generatePopupHtml includes the extension name", () => {
    const html = generatePopupHtml({ ...DEFAULT_INPUTS, name: "Cool Tool" });
    expect(html).toContain("Cool Tool");
    expect(html).toContain("<!DOCTYPE html>");
  });
  it("generatePopupJs switches by framework", () => {
    const vanilla = generatePopupJs({ ...DEFAULT_INPUTS, framework: "vanilla" });
    const react = generatePopupJs({ ...DEFAULT_INPUTS, framework: "react" });
    const vue = generatePopupJs({ ...DEFAULT_INPUTS, framework: "vue" });
    expect(vanilla).toContain("addEventListener");
    expect(react).toContain("createRoot");
    expect(vue).toContain("createApp");
  });
  it("generateContentScript mentions the match patterns", () => {
    const js = generateContentScript({
      ...DEFAULT_INPUTS,
      surfaces: ["content"],
      contentMatches: ["https://*.foo.com/*"],
    });
    expect(js).toContain("https://*.foo.com/*");
  });
  it("generateBackgroundSw handles POPUP_READY message", () => {
    const js = generateBackgroundSw(DEFAULT_INPUTS);
    expect(js).toContain("POPUP_READY");
    expect(js).toContain("onInstalled");
  });
  it("generateMessageHelper exports sendMessage + onMessage", () => {
    const js = generateMessageHelper();
    expect(js).toContain("export function sendMessage");
    expect(js).toContain("export function onMessage");
    expect(js).toContain("export function sendTabMessage");
  });
  it("generateStorageHelper exports get/set/watch", () => {
    const js = generateStorageHelper();
    expect(js).toContain("export async function get");
    expect(js).toContain("export async function set");
    expect(js).toContain("export function watch");
  });
  it("generateViteConfig includes framework plugin", () => {
    const react = generateViteConfig({ ...DEFAULT_INPUTS, framework: "react" });
    const vue = generateViteConfig({ ...DEFAULT_INPUTS, framework: "vue" });
    expect(react).toContain("@vitejs/plugin-react");
    expect(vue).toContain("@vitejs/plugin-vue");
  });
  it("generatePackageJson includes correct dependencies per framework", () => {
    const react = JSON.parse(generatePackageJson({ ...DEFAULT_INPUTS, framework: "react" }));
    const vue = JSON.parse(generatePackageJson({ ...DEFAULT_INPUTS, framework: "vue" }));
    const vanilla = JSON.parse(generatePackageJson({ ...DEFAULT_INPUTS, framework: "vanilla" }));
    expect(react.dependencies.react).toBeDefined();
    expect(vue.dependencies.vue).toBeDefined();
    expect(vanilla.dependencies).toBeUndefined();
  });
  it("generateIconSvg produces an <svg> with the requested size", () => {
    const svg = generateIconSvg(128);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="128"');
    expect(svg).toContain('height="128"');
  });
  it("generateReadme includes permission table", () => {
    const md = generateReadme({ ...DEFAULT_INPUTS, permissions: ["storage", "tabs"] });
    expect(md).toContain("# My Extension");
    expect(md).toContain("| `storage` |");
    expect(md).toContain("| `tabs` |");
  });
});

describe("ai-chrome-ext-boiler generateScaffold", () => {
  it("produces manifest.json + selected surfaces", () => {
    const out = generateScaffold({
      ...DEFAULT_INPUTS,
      surfaces: ["popup", "background", "content"],
    });
    const paths = out.files.map((f) => f.path);
    expect(paths).toContain("manifest.json");
    expect(paths).toContain("popup/popup.html");
    expect(paths).toContain("background.js");
    expect(paths).toContain("content/content.js");
  });
  it("includes manifest.firefox.json when firefoxVariant is on", () => {
    const out = generateScaffold({ ...DEFAULT_INPUTS, firefoxVariant: true });
    expect(out.files.some((f) => f.path === "manifest.firefox.json")).toBe(true);
  });
  it("includes helpers when toggled", () => {
    const out = generateScaffold({
      ...DEFAULT_INPUTS,
      includeMessageHelper: true,
      includeStorageHelper: true,
    });
    expect(out.files.some((f) => f.path === "lib/message.js")).toBe(true);
    expect(out.files.some((f) => f.path === "lib/storage.js")).toBe(true);
  });
  it("includes README and icons by default", () => {
    const out = generateScaffold(DEFAULT_INPUTS);
    expect(out.files.some((f) => f.path === "README.md")).toBe(true);
    expect(out.files.some((f) => f.path === "icons/icon.svg")).toBe(true);
  });
  it("includes package.json for non-vanilla frameworks", () => {
    const out = generateScaffold({ ...DEFAULT_INPUTS, framework: "react", includeViteConfig: true });
    expect(out.files.some((f) => f.path === "package.json")).toBe(true);
    expect(out.files.some((f) => f.path === "vite.config.js")).toBe(true);
    expect(out.files.some((f) => f.path === "popup/Popup.jsx")).toBe(true);
  });
  it("computes correct stats", () => {
    const out = generateScaffold({
      ...DEFAULT_INPUTS,
      permissions: ["storage", "tabs"],
      hostPermissions: ["https://*.example.com/*"],
      surfaces: ["popup", "background"],
    });
    expect(out.stats.permissionCount).toBe(2);
    expect(out.stats.hostPermissionCount).toBe(1);
    expect(out.stats.surfaceCount).toBe(2);
    expect(out.stats.highRiskPermissions).toBe(1); // tabs
    expect(out.stats.fileCount).toBe(out.files.length);
    expect(out.stats.totalBytes).toBeGreaterThan(0);
  });
});

describe("ai-chrome-ext-boiler buildFileTree", () => {
  it("builds nested tree from flat paths", () => {
    const out = generateScaffold(DEFAULT_INPUTS);
    const tree = buildFileTree(out.files);
    expect(tree.length).toBeGreaterThan(0);
    const popupDir = tree.find((n) => n.name === "popup");
    expect(popupDir).toBeDefined();
    expect(popupDir!.isFile).toBe(false);
    const manifest = tree.find((n) => n.name === "manifest.json");
    expect(manifest).toBeDefined();
    expect(manifest!.isFile).toBe(true);
  });
  it("sorts directories before files", () => {
    const out = generateScaffold(DEFAULT_INPUTS);
    const tree = buildFileTree(out.files);
    let firstFileIdx = -1;
    let lastDirIdx = -1;
    for (let i = 0; i < tree.length; i++) {
      if (tree[i].isFile && firstFileIdx === -1) firstFileIdx = i;
      if (!tree[i].isFile) lastDirIdx = i;
    }
    if (firstFileIdx !== -1 && lastDirIdx !== -1) {
      expect(lastDirIdx).toBeLessThan(firstFileIdx);
    }
  });
});

describe("ai-chrome-ext-boiler zip builder", () => {
  it("crc32 matches a known value", () => {
    // CRC-32 of "123456789" is 0xCBF43926
    const bytes = utf8Encode("123456789");
    expect(crc32(bytes)).toBe(0xCBF43926);
  });
  it("utf8Encode round-trips", () => {
    const bytes = utf8Encode("hello ünïcode");
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe("hello ünïcode");
  });
  it("buildZip produces a valid ZIP signature", () => {
    const zip = buildZip([{ name: "test.txt", bytes: utf8Encode("hello") }]);
    // Local file header signature 0x04034b50 = 50 4B 03 04
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4B);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });
  it("buildZip ends with EOCD signature", () => {
    const zip = buildZip([
      { name: "a.txt", bytes: utf8Encode("aaa") },
      { name: "b.txt", bytes: utf8Encode("bbb") },
    ]);
    // EOCD signature 0x06054b50 = 50 4B 05 06
    expect(zip[zip.length - 22]).toBe(0x50);
    expect(zip[zip.length - 21]).toBe(0x4B);
    expect(zip[zip.length - 20]).toBe(0x05);
    expect(zip[zip.length - 19]).toBe(0x06);
  });
  it("scaffoldToZip returns a Uint8Array with at least one local file header", () => {
    const out = generateScaffold(DEFAULT_INPUTS);
    const zip = scaffoldToZip(out.files);
    expect(zip).toBeInstanceOf(Uint8Array);
    expect(zip.length).toBeGreaterThan(50);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4B);
  });
});

describe("ai-chrome-ext-boiler parseDescription (NL)", () => {
  it("detects framework + surfaces + permissions from description", () => {
    const parsed = parseDescription(
      "I want a React popup extension with storage and notifications that injects a content script",
    );
    expect(parsed.framework).toBe("react");
    expect(parsed.surfaces).toContain("popup");
    expect(parsed.surfaces).toContain("content");
    expect(parsed.permissions).toContain("storage");
    expect(parsed.permissions).toContain("notifications");
  });
  it("defaults to popup + activeTab when nothing recognized", () => {
    const parsed = parseDescription("hello world");
    expect(parsed.surfaces).toEqual(["popup"]);
    expect(parsed.permissions).toEqual(["activeTab"]);
    expect(parsed.notes.length).toBeGreaterThan(0);
  });
  it("detects tabs and cookies", () => {
    const parsed = parseDescription("manage tabs and cookies");
    expect(parsed.permissions).toContain("tabs");
    expect(parsed.permissions).toContain("cookies");
  });
});

describe("ai-chrome-ext-boiler renderers", () => {
  it("renderJson produces valid JSON", () => {
    const out = generateScaffold(DEFAULT_INPUTS);
    const json = renderJson(out);
    const parsed = JSON.parse(json);
    expect(parsed.stats.fileCount).toBe(out.stats.fileCount);
  });
  it("renderMarkdown includes file list and warnings", () => {
    const out = generateScaffold({
      ...DEFAULT_INPUTS,
      permissions: ["tabs", "history"],
    });
    const md = renderMarkdown(out);
    expect(md).toContain("## Files");
    expect(md).toContain("manifest.json");
    expect(md).toContain("Warnings");
  });
  it("renderText lists files", () => {
    const out = generateScaffold(DEFAULT_INPUTS);
    const txt = renderText(out);
    expect(txt).toContain("manifest.json");
    expect(txt).toContain("bytes");
  });
  it("honestyNote mentions chrome://extensions", () => {
    expect(honestyNote()).toContain("chrome://extensions");
  });
});

describe("ai-chrome-ext-boiler history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      name: "Test",
      framework: "vanilla",
      surfaces: ["popup"],
      permissionCount: 2,
      fileCount: 5,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        name: `Ext ${i}`,
        framework: "vanilla",
        surfaces: ["popup"],
        permissionCount: 1,
        fileCount: 3,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, name: "X", framework: "vanilla",
      surfaces: ["popup"], permissionCount: 1, fileCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("exposes HISTORY_KEY and LLM_KEY_STORAGE constants", () => {
    expect(typeof HISTORY_KEY).toBe("string");
    expect(typeof LLM_KEY_STORAGE).toBe("string");
  });
});

describe("ai-chrome-ext-boiler shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ...DEFAULT_INPUTS,
      surfaces: ["popup", "background"],
      permissions: ["storage", "tabs"],
      firefoxVariant: true,
    });
    expect(url).toContain("name=");
    expect(url).toContain("s=popup%2Cbackground");
    expect(url).toContain("p=storage%2Ctabs");
    expect(url).toContain("ff=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to inputs", () => {
    const url = buildShareUrl({
      ...DEFAULT_INPUTS,
      surfaces: ["popup", "background"],
      permissions: ["storage", "tabs"],
      firefoxVariant: true,
      includeViteConfig: true,
    });
    const hash = url.split(/[?#]/)[1] ?? "";
    const parsed = parseShareUrl(hash);
    expect(parsed.inputs?.surfaces).toEqual(["popup", "background"]);
    expect(parsed.inputs?.permissions).toEqual(["storage", "tabs"]);
    expect(parsed.inputs?.firefoxVariant).toBe(true);
    expect(parsed.inputs?.includeViteConfig).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ inputs: {} });
  });
  it("filters unknown surfaces/permissions", () => {
    const p = parseShareUrl("s=popup,unknown&tabs=foo&frobnicate");
    expect(p.inputs?.surfaces).toEqual(["popup"]);
  });
});

describe("ai-chrome-ext-boiler LLM", () => {
  it("buildLlmPrompt includes extension name + framework", () => {
    const prompt = buildLlmPrompt({ ...DEFAULT_INPUTS, name: "My Test Ext" });
    expect(prompt).toContain("My Test Ext");
    expect(prompt).toContain("Vanilla JS");
    expect(prompt).toContain("refinedDescription");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      refinedDescription: "A cleaner description.",
      recommendedPermissions: ["storage", "activeTab"],
      notes: ["Use chrome.storage.local for state."],
      starterCode: "console.log('hi')",
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedDescription).toContain("cleaner");
      expect(r.result.recommendedPermissions).toEqual(["storage", "activeTab"]);
      expect(r.result.notes).toHaveLength(1);
      expect(r.result.starterCode).toContain("console.log");
    }
  });
  it("renderLlmResult strips ```json fences", () => {
    const raw = "```json\n" + JSON.stringify({
      refinedDescription: "x",
      recommendedPermissions: [],
      notes: [],
      starterCode: "",
    }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult rejects invalid JSON", () => {
    const r = renderLlmResult("not json at all");
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult rejects non-object JSON", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint for type re-exports
export type _Unused = Framework | Surface | ExtensionInputs;
