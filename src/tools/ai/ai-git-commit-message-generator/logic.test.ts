import { describe, it, expect, beforeEach } from "vitest";
import {
  CHANGE_TYPE_LABELS,
  STYLE_LABELS,
  GITMOJI_MAP,
  LANGUAGE_MAP,
  LARGE_DIFF_LINE_THRESHOLD,
  SUBJECT_MAX,
  HISTORY_MAX,
  HONESTY_NOTE,
  detectLanguage,
  parseDiff,
  extractSymbol,
  classifyChangeType,
  deriveScope,
  detectBreakingChange,
  extractIssueRefs,
  generateSubject,
  generateBody,
  generateFooter,
  generateCommit,
  assembleFull,
  validateConventional,
  chunkLargeDiff,
  summarizeChunk,
  summarizeLargeDiff,
  generateHookSnippet,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadPreset,
  savePreset,
  clearPreset,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  renderLlmResult,
  type CommitStyle,
  type ChangeType,
  type CommitOptions,
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

// ----- Sample diffs (kept short for test speed) -----

const FEAT_DIFF = `diff --git a/src/parser.ts b/src/parser.ts
index 1111111..2222222 100644
--- a/src/parser.ts
+++ b/src/parser.ts
@@ -10,6 +10,18 @@ export function parse(text: string) {
   return tokens;
 }

+export function parseNested(text: string) {
+  // Add support for nested arrays
+  const tokens = text.split(",");
+  return tokens.map((t) => t.trim());
+}
+
 export function tokenize(text: string) {
   return text.split("");
 }
diff --git a/src/parser.test.ts b/src/parser.test.ts
index 3333333..4444444 100644
--- a/src/parser.test.ts
+++ b/src/parser.test.ts
@@ -1,4 +1,8 @@
 import { parse } from "./parser";
+import { parseNested } from "./parser";

+test("parseNested handles nested arrays", () => {
+  expect(parseNested("[1,2,3]")).toEqual(["1", "2", "3"]);
+});
`;

const FIX_DIFF = `diff --git a/src/calc.ts b/src/calc.ts
index 1111111..2222222 100644
--- a/src/calc.ts
+++ b/src/calc.ts
@@ -5,7 +5,7 @@ export function add(a, b) {
 }

 export function divide(a, b) {
-  return a / b;
+  return b === 0 ? NaN : a / b;
 }
`;

const DOCS_DIFF = `diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,7 @@
 # Project

+A new README section.
+
+## Installation
+
+Run \`npm install\`.
`;

const CI_DIFF = `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 1111111..2222222 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -10,6 +10,8 @@ jobs:
     steps:
       - uses: actions/checkout@v4
       - run: npm ci
+      - run: npm run lint
       - run: npm test
`;

const BREAKING_DIFF = `diff --git a/src/api.ts b/src/api.ts
index 1111111..2222222 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,5 +1,3 @@
-export function oldApi() {
-  return "old";
-}
+export function newApi() {
+  return "new";
+}
`;

const MULTI_FILE_DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1..2 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,2 @@
-export const old = 1;
+export const new1 = 1;
+export const new2 = 2;
diff --git a/src/b.ts b/src/b.ts
index 1..2 100644
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,1 @@
-const x = 1;
+const x = 2;
`;

const EMPTY_DIFF = "";

describe("ai-git-commit-message-generator constants", () => {
  it("has all 10 change type labels", () => {
    expect(Object.keys(CHANGE_TYPE_LABELS)).toHaveLength(10);
    expect(CHANGE_TYPE_LABELS.feat).toContain("feat");
    expect(CHANGE_TYPE_LABELS.fix).toContain("fix");
  });
  it("has 4 commit styles with labels", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(4);
    expect(STYLE_LABELS.conventional).toBeTruthy();
  });
  it("has a gitmoji for each change type", () => {
    for (const t of Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]) {
      expect(GITMOJI_MAP[t].length).toBeGreaterThan(0);
    }
  });
  it("has a language map with common extensions", () => {
    expect(LANGUAGE_MAP.ts).toBe("typescript");
    expect(LANGUAGE_MAP.py).toBe("python");
    expect(LANGUAGE_MAP.md).toBe("markdown");
  });
  it("exposes sensible thresholds and limits", () => {
    expect(LARGE_DIFF_LINE_THRESHOLD).toBeGreaterThan(100);
    expect(SUBJECT_MAX).toBe(72);
    expect(HISTORY_MAX).toBe(20);
    expect(HONESTY_NOTE.length).toBeGreaterThan(50);
  });
});

describe("ai-git-commit-message-generator detectLanguage", () => {
  it("detects TypeScript from .ts", () => {
    expect(detectLanguage("src/parser.ts")).toBe("typescript");
  });
  it("detects Python from .py", () => {
    expect(detectLanguage("scripts/run.py")).toBe("python");
  });
  it("detects Markdown from .md", () => {
    expect(detectLanguage("README.md")).toBe("markdown");
  });
  it("handles Dockerfile specially", () => {
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("build/Dockerfile")).toBe("dockerfile");
  });
  it("returns text for unknown extensions", () => {
    expect(detectLanguage("file.xyz")).toBe("text");
  });
});

describe("ai-git-commit-message-generator parseDiff", () => {
  it("parses a feat diff into 2 files", () => {
    const parsed = parseDiff(FEAT_DIFF);
    expect(parsed.fileCount).toBe(2);
    expect(parsed.files[0].path).toBe("src/parser.ts");
    expect(parsed.files[0].language).toBe("typescript");
    expect(parsed.files[0].additions).toBeGreaterThan(0);
    expect(parsed.files[0].deletions).toBe(0);
    expect(parsed.files[0].symbols).toContain("parseNested");
  });
  it("counts total additions and deletions", () => {
    const parsed = parseDiff(FIX_DIFF);
    expect(parsed.totalDeletions).toBe(1);
    expect(parsed.totalAdditions).toBe(1);
  });
  it("marks added/deleted/renamed correctly", () => {
    const diff = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,1 @@
+hello
`;
    const parsed = parseDiff(diff);
    expect(parsed.files[0].kind).toBe("added");
  });
  it("handles empty diff", () => {
    const parsed = parseDiff(EMPTY_DIFF);
    expect(parsed.fileCount).toBe(0);
    expect(parsed.totalAdditions).toBe(0);
  });
  it("flags large diffs as summarized", () => {
    const big = "diff --git a/f.ts b/f.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n".repeat(2000);
    const parsed = parseDiff(big);
    expect(parsed.summarized).toBe(true);
  });
});

describe("ai-git-commit-message-generator extractSymbol", () => {
  it("extracts function name from a JS section header", () => {
    expect(extractSymbol("function parseNested(text)")).toBe("parseNested");
  });
  it("extracts class name", () => {
    expect(extractSymbol("class Tokenizer")).toBe("Tokenizer");
  });
  it("returns null for empty section", () => {
    expect(extractSymbol("")).toBeNull();
  });
});

describe("ai-git-commit-message-generator classifyChangeType", () => {
  it("classifies a feature diff as feat", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    expect(c.type).toBe("feat");
    expect(c.confidence).toBeGreaterThanOrEqual(0);
  });
  it("classifies a docs-only diff as docs", () => {
    const parsed = parseDiff(DOCS_DIFF);
    const c = classifyChangeType(parsed, DOCS_DIFF);
    expect(c.type).toBe("docs");
  });
  it("classifies a CI workflow change as ci", () => {
    const parsed = parseDiff(CI_DIFF);
    const c = classifyChangeType(parsed, CI_DIFF);
    expect(c.type).toBe("ci");
  });
  it("returns a non-empty scope for a typical diff", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    expect(c.scope.length).toBeGreaterThan(0);
  });
  it("provides reasons explaining the classification", () => {
    const parsed = parseDiff(DOCS_DIFF);
    const c = classifyChangeType(parsed, DOCS_DIFF);
    expect(c.reasons.length).toBeGreaterThan(0);
  });
});

describe("ai-git-commit-message-generator deriveScope", () => {
  it("derives scope from top-level directory", () => {
    const parsed = parseDiff(FEAT_DIFF);
    expect(deriveScope(parsed)).toBe("src");
  });
  it("returns root for files in the root", () => {
    const parsed = parseDiff(DOCS_DIFF);
    expect(deriveScope(parsed)).toBe("root");
  });
});

describe("ai-git-commit-message-generator detectBreakingChange", () => {
  it("detects BREAKING CHANGE: footer", () => {
    const info = detectBreakingChange("feat(api)!: change\n\nBREAKING CHANGE: removes oldApi", parseDiff(BREAKING_DIFF));
    expect(info.isBreaking).toBe(true);
    expect(info.reason).toContain("oldApi");
  });
  it("detects ! suffix on type", () => {
    const info = detectBreakingChange("feat(api)!: change the API", parseDiff("diff --git a/x b/x\n"));
    expect(info.isBreaking).toBe(true);
  });
  it("detects removed public exports", () => {
    const info = detectBreakingChange(BREAKING_DIFF, parseDiff(BREAKING_DIFF));
    expect(info.isBreaking).toBe(true);
    expect(info.reason).toContain("oldApi");
  });
  it("returns false for non-breaking diffs", () => {
    const info = detectBreakingChange(FEAT_DIFF, parseDiff(FEAT_DIFF));
    expect(info.isBreaking).toBe(false);
  });
});

describe("ai-git-commit-message-generator extractIssueRefs", () => {
  it("extracts #123 style refs", () => {
    const refs = extractIssueRefs("fix(parser): handle edge case\n\nFixes #123", parseDiff(FIX_DIFF));
    expect(refs).toContain("#123");
  });
  it("extracts JIRA-style ABC-123 refs", () => {
    const refs = extractIssueRefs("feat: add thing\n\nRefs ABC-456", parseDiff(FEAT_DIFF));
    expect(refs.some((r) => r === "ABC-456")).toBe(true);
  });
  it("returns empty array when no refs present", () => {
    const refs = extractIssueRefs("feat: add thing", parseDiff(FEAT_DIFF));
    expect(refs).toEqual([]);
  });
});

describe("ai-git-commit-message-generator generateSubject", () => {
  it("generates a non-empty subject for a feat diff", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    const s = generateSubject(parsed, c);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(60);
  });
  it("mentions the function name when symbols are available", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    const s = generateSubject(parsed, c);
    expect(s.toLowerCase()).toContain("parsenested");
  });
});

describe("ai-git-commit-message-generator generateBody", () => {
  it("includes file count and line totals", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    const body = generateBody(parsed, c, FEAT_DIFF);
    expect(body).toContain("2 files changed");
    expect(body).toContain("+");
    expect(body).toContain("−");
  });
  it("lists top files", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    const body = generateBody(parsed, c, FEAT_DIFF);
    expect(body).toContain("src/parser.ts");
  });
});

describe("ai-git-commit-message-generator generateFooter", () => {
  it("includes issue refs", () => {
    const f = generateFooter(["#123", "#456"], { isBreaking: false, reason: "" });
    expect(f).toContain("#123");
    expect(f).toContain("#456");
  });
  it("includes BREAKING CHANGE: when breaking", () => {
    const f = generateFooter([], { isBreaking: true, reason: "old API removed" });
    expect(f).toContain("BREAKING CHANGE:");
    expect(f).toContain("old API removed");
  });
  it("returns empty string when nothing to add", () => {
    expect(generateFooter([], { isBreaking: false, reason: "" })).toBe("");
  });
});

describe("ai-git-commit-message-generator assembleFull", () => {
  it("assembles conventional subject only", () => {
    const full = assembleFull({
      type: "feat", scope: "parser", subject: "add nested array support",
      body: "", footer: "", isBreaking: false,
      style: "conventional", wrapBody: true,
    });
    expect(full.split("\n")[0]).toBe("feat(parser): add nested array support");
  });
  it("assembles conventional with body", () => {
    const full = assembleFull({
      type: "feat", scope: "parser", subject: "add nested array support",
      body: "Body line one.", footer: "", isBreaking: false,
      style: "conventional-body", wrapBody: true,
    });
    expect(full).toContain("feat(parser): add nested array support");
    expect(full).toContain("Body line one.");
  });
  it("assembles gitmoji with the correct emoji", () => {
    const full = assembleFull({
      type: "fix", scope: "", subject: "handle divide by zero",
      body: "", footer: "", isBreaking: false,
      style: "gitmoji", wrapBody: true,
    });
    expect(full.split("\n")[0]).toContain("🐛");
    expect(full.split("\n")[0]).toContain("fix:");
  });
  it("assembles plain style without prefix", () => {
    const full = assembleFull({
      type: "feat", scope: "", subject: "add nested array support",
      body: "", footer: "", isBreaking: false,
      style: "plain", wrapBody: true,
    });
    expect(full.split("\n")[0]).toBe("Add nested array support");
  });
  it("adds ! mark when breaking", () => {
    const full = assembleFull({
      type: "feat", scope: "api", subject: "remove old API",
      body: "", footer: "BREAKING CHANGE: removes oldApi", isBreaking: true,
      style: "conventional", wrapBody: true,
    });
    expect(full.split("\n")[0]).toContain("feat(api)!: remove old API");
  });
});

describe("ai-git-commit-message-generator generateCommit", () => {
  it("generates a conventional commit from a feat diff", () => {
    const msg = generateCommit(FEAT_DIFF, { style: "conventional", includeBody: true, includeFooter: true });
    expect(msg.type).toBe("feat");
    expect(msg.scope.length).toBeGreaterThan(0);
    expect(msg.full.split("\n")[0]).toMatch(/^feat\([^)]+\): /);
  });
  it("respects typeOverride", () => {
    const msg = generateCommit(FEAT_DIFF, { style: "conventional", typeOverride: "refactor" });
    expect(msg.type).toBe("refactor");
    expect(msg.full.split("\n")[0]).toMatch(/^refactor\(/);
  });
  it("respects scopeOverride", () => {
    const msg = generateCommit(FEAT_DIFF, { style: "conventional", scopeOverride: "custom-scope" });
    expect(msg.scope).toBe("custom-scope");
    expect(msg.full.split("\n")[0]).toContain("(custom-scope)");
  });
  it("includes a body when includeBody is true", () => {
    const msg = generateCommit(FEAT_DIFF, { style: "conventional-body", includeBody: true });
    expect(msg.body.length).toBeGreaterThan(0);
    expect(msg.full).toContain(msg.body.split("\n")[0]);
  });
  it("omits body when includeBody is false", () => {
    const msg = generateCommit(FEAT_DIFF, { style: "conventional", includeBody: false });
    expect(msg.body).toBe("");
  });
  it("includes footer with issue refs when present", () => {
    const diffWithRef = FEAT_DIFF + "\n# In commit message: Refs #999\n";
    const msg = generateCommit(diffWithRef, { style: "conventional", includeFooter: true });
    expect(msg.issueRefs.length).toBeGreaterThan(0);
  });
  it("warns when diff is empty", () => {
    const msg = generateCommit("", { style: "conventional" });
    expect(msg.warnings.some((w) => w.includes("No files"))).toBe(true);
  });
});

describe("ai-git-commit-message-generator validateConventional", () => {
  it("accepts a well-formed conventional subject", () => {
    const r = validateConventional("feat(parser): add nested array support\n\nBody line.");
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("flags a subject that is too long", () => {
    const longSubject = "feat(parser): " + "x".repeat(80);
    const r = validateConventional(longSubject);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("max 72"))).toBe(true);
  });
  it("flags an unknown type", () => {
    const r = validateConventional("unknown(parser): something");
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("not a recognized"))).toBe(true);
  });
  it("accepts a plain sentence (no prefix)", () => {
    const r = validateConventional("Update the README with install instructions");
    expect(r.valid).toBe(true);
  });
  it("flags missing blank line between subject and body", () => {
    const r = validateConventional("feat: x\nbody line");
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("blank line"))).toBe(true);
  });
});

describe("ai-git-commit-message-generator chunkLargeDiff", () => {
  it("returns single chunk for small diff", () => {
    expect(chunkLargeDiff(FEAT_DIFF)).toHaveLength(1);
  });
  it("splits a large diff into multiple chunks", () => {
    const big = "diff --git a/f.ts b/f.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n".repeat(50);
    const chunks = chunkLargeDiff(big, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("ai-git-commit-message-generator summarizeChunk", () => {
  it("summarizes a small chunk correctly", () => {
    const s = summarizeChunk(FEAT_DIFF);
    expect(s.fileCount).toBe(2);
    expect(s.additions).toBeGreaterThan(0);
    expect(s.topPaths.length).toBeGreaterThan(0);
  });
});

describe("ai-git-commit-message-generator summarizeLargeDiff", () => {
  it("aggregates file counts and additions across chunks", () => {
    const big = "diff --git a/f.ts b/f.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n".repeat(20);
    const summary = summarizeLargeDiff(big, 30);
    expect(summary.fileCount).toBe(20);
    expect(summary.additions).toBe(20);
  });
});

describe("ai-git-commit-message-generator generateHookSnippet", () => {
  it("returns a bash script starting with shebang", () => {
    const hook = generateHookSnippet();
    expect(hook.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(hook).toContain("prepare-commit-msg");
    expect(hook).toContain("git diff --cached");
  });
  it("includes the tool URL when provided", () => {
    const hook = generateHookSnippet("https://example.com/tool");
    expect(hook).toContain("https://example.com/tool");
  });
});

describe("ai-git-commit-message-generator renderers", () => {
  const msg = generateCommit(FEAT_DIFF, { style: "conventional-body", includeBody: true, includeFooter: true });
  it("renderText returns the full message", () => {
    expect(renderText(msg)).toBe(msg.full);
  });
  it("renderMarkdown wraps the message in a code block", () => {
    const md = renderMarkdown(msg);
    expect(md).toContain("```");
    expect(md).toContain(msg.full);
    expect(md).toContain("**Type:**");
  });
  it("renderJson returns valid JSON", () => {
    const parsed = JSON.parse(renderJson(msg));
    expect(parsed.type).toBe(msg.type);
    expect(parsed.full).toBe(msg.full);
  });
});

describe("ai-git-commit-message-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads an entry", () => {
    saveHistory({
      ts: 1, type: "feat", scope: "parser", subject: "add x",
      style: "conventional", fileCount: 2, additions: 5, deletions: 1, isBreaking: false,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, type: "fix", scope: "x", subject: `s${i}`,
        style: "conventional", fileCount: 1, additions: 1, deletions: 1, isBreaking: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, type: "feat", scope: "x", subject: "s",
      style: "conventional", fileCount: 1, additions: 1, deletions: 0, isBreaking: false,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-git-commit-message-generator preset (localStorage)", () => {
  it("loads null initially", () => { expect(loadPreset()).toBeNull(); });
  it("saves and loads a preset", () => {
    savePreset({ scope: "api", style: "gitmoji", includeBody: true, includeFooter: true, wrapBody: true });
    const p = loadPreset();
    expect(p).not.toBeNull();
    expect(p!.style).toBe("gitmoji");
    expect(p!.scope).toBe("api");
  });
  it("clears preset", () => {
    savePreset({ scope: "x", style: "plain", includeBody: false, includeFooter: false, wrapBody: true });
    clearPreset();
    expect(loadPreset()).toBeNull();
  });
});

describe("ai-git-commit-message-generator shareable URL", () => {
  it("builds a share URL with style and flags encoded", () => {
    const url = buildShareUrl({
      style: "gitmoji", typeOverride: "feat", scopeOverride: "api",
      includeBody: true, includeFooter: true,
    });
    expect(url).toContain("style=gitmoji");
    expect(url).toContain("type=feat");
    expect(url).toContain("scope=api");
    expect(url).toContain("body=1");
    expect(url).toContain("footer=1");
  });
  it("parses a share URL back into the original state", () => {
    const orig = {
      style: "conventional-body" as CommitStyle, typeOverride: "fix" as ChangeType,
      scopeOverride: "parser", includeBody: true, includeFooter: false,
    };
    const url = buildShareUrl(orig);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).toEqual(orig);
  });
  it("returns null for an empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null for an unknown style", () => {
    expect(parseShareUrl("style=bogus")).toBeNull();
  });
});

describe("ai-git-commit-message-generator LLM helpers", () => {
  it("buildLlmPrompt includes the suggested type and file count", () => {
    const parsed = parseDiff(FEAT_DIFF);
    const c = classifyChangeType(parsed, FEAT_DIFF);
    const prompt = buildLlmPrompt(parsed, c, FEAT_DIFF);
    expect(prompt).toContain("Conventional Commits");
    expect(prompt).toContain("Files changed: 2");
  });
  it("parseLlmResult extracts a code block when present", () => {
    const raw = "Here it is:\n```\nfeat(api): add thing\n\nBody.\n```\nDone.";
    const en = parseLlmResult(raw, "test-model");
    expect(en.message).toBe("feat(api): add thing\n\nBody.");
    expect(en.model).toBe("test-model");
  });
  it("parseLlmResult returns the raw text when no code block is present", () => {
    const en = parseLlmResult("feat: x", "test-model");
    expect(en.message).toBe("feat: x");
  });
  it("renderLlmResult includes the model name and a code block", () => {
    const en = parseLlmResult("```\nfeat: x\n```", "test-model");
    const text = renderLlmResult(en);
    expect(text).toContain("test-model");
    expect(text).toContain("feat: x");
  });
});

describe("ai-git-commit-message-generator CommitOptions type", () => {
  it("accepts a minimal options object", () => {
    const opts: CommitOptions = { style: "plain" };
    expect(opts.style).toBe("plain");
  });
});
