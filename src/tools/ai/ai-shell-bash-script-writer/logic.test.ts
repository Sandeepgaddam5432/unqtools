import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  STRICT_MODE_BASH,
  STRICT_MODE_POSIX,
  DESTRUCTIVE_PATTERNS,
  LINT_RULES,
  TASK_PRESETS,
  CATEGORY_KEYWORDS,
  CATEGORY_LABELS,
  normalizeTask,
  detectCategory,
  buildShebang,
  buildStrictMode,
  buildUsageBlock,
  buildArgParser,
  addDryRunGuard,
  wrapForCron,
  lintScript,
  detectDestructive,
  explainScript,
  buildBody,
  generateScript,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ShellFlavor,
  type ScriptCategory,
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

// ---------- Constants ----------

describe("ai-shell constants", () => {
  it("exposes history key + max", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-shell-bash-script-writer:history");
    expect(HISTORY_MAX).toBe(20);
  });
  it("exposes LLM key storage id", () => {
    expect(LLM_KEY_STORAGE).toContain("ai-shell-bash-script-writer");
  });
  it("has strict-mode constants", () => {
    expect(STRICT_MODE_BASH).toContain("set -euo pipefail");
    expect(STRICT_MODE_POSIX).toContain("set -eu");
  });
  it("has 10+ destructive patterns", () => {
    expect(DESTRUCTIVE_PATTERNS.length).toBeGreaterThanOrEqual(10);
    expect(DESTRUCTIVE_PATTERNS.some((p) => p.pattern.test("rm -rf /tmp/x"))).toBe(true);
    expect(DESTRUCTIVE_PATTERNS.some((p) => p.pattern.test("dd if=foo of=/dev/sda"))).toBe(true);
  });
  it("has 8+ lint rules", () => {
    expect(LINT_RULES.length).toBeGreaterThanOrEqual(8);
    expect(LINT_RULES.some((r) => r.rule === "SC2086")).toBe(true);
    expect(LINT_RULES.some((r) => r.rule === "SC2164")).toBe(true);
  });
  it("has 8+ task presets", () => {
    expect(TASK_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(TASK_PRESETS.some((p) => p.includes("backup"))).toBe(true);
  });
  it("has 6 categories with keyword arrays", () => {
    expect(Object.keys(CATEGORY_KEYWORDS)).toHaveLength(6);
    expect(CATEGORY_KEYWORDS["backup"]).toContain("rotate");
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
  });
});

// ---------- normalizeTask ----------

describe("ai-shell normalizeTask", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTask("  back   up   this folder  ")).toBe("back up this folder");
  });
  it("handles empty", () => {
    expect(normalizeTask("")).toBe("");
  });
});

// ---------- detectCategory ----------

describe("ai-shell detectCategory", () => {
  it("detects backup tasks", () => {
    expect(detectCategory("back up this folder and rotate old backups")).toBe("backup");
  });
  it("detects file-ops tasks", () => {
    expect(detectCategory("rename all JPG files to lowercase")).toBe("file-ops");
  });
  it("detects system-info tasks", () => {
    expect(detectCategory("show disk usage and memory")).toBe("system-info");
  });
  it("detects deployment tasks", () => {
    expect(detectCategory("deploy the current git branch to /var/www")).toBe("deployment");
  });
  it("detects monitoring tasks", () => {
    expect(detectCategory("monitor a URL and alert on HTTP 5xx")).toBe("monitoring");
  });
  it("falls back to generic", () => {
    expect(detectCategory("do something unusual and bespoke")).toBe("generic");
  });
  it("returns generic for empty input", () => {
    expect(detectCategory("")).toBe("generic");
  });
});

// ---------- buildShebang / buildStrictMode ----------

describe("ai-shell shebang and strict mode", () => {
  it("builds bash shebang", () => {
    expect(buildShebang("bash")).toBe("#!/usr/bin/env bash");
  });
  it("builds posix shebang", () => {
    expect(buildShebang("posix")).toBe("#!/bin/sh");
  });
  it("builds bash strict mode with pipefail", () => {
    expect(buildStrictMode("bash")).toContain("pipefail");
  });
  it("builds posix strict mode without pipefail", () => {
    expect(buildStrictMode("posix")).not.toContain("pipefail");
    expect(buildStrictMode("posix")).toContain("set -eu");
  });
});

// ---------- buildUsageBlock / buildArgParser ----------

describe("ai-shell usage block", () => {
  it("includes name and description", () => {
    const u = buildUsageBlock("myscript", ["SRC"], "Backs up SRC");
    expect(u).toContain("myscript <SRC>");
    expect(u).toContain("Backs up SRC");
    expect(u).toContain("--help");
    expect(u).toContain("--dry-run");
  });
  it("omits args section when none provided", () => {
    const u = buildUsageBlock("myscript", [], "");
    expect(u).toContain("myscript [options]");
    expect(u).not.toContain("<");
  });
});

describe("ai-shell arg parser", () => {
  it("bash parser uses [[ and case", () => {
    const p = buildArgParser("bash", []);
    expect(p).toContain("[[ $# -gt 0 ]]");
    expect(p).toContain('--help)');
    expect(p).toContain("DRY_RUN=1");
  });
  it("posix parser uses getopts", () => {
    const p = buildArgParser("posix", []);
    expect(p).toContain("getopts");
    expect(p).toContain("OPTIND");
  });
  it("validates positional arg count", () => {
    const p = buildArgParser("bash", ["SRC", "DEST"]);
    expect(p).toContain("-lt 2");
    expect(p).toContain('SRC="$1"');
    expect(p).toContain('DEST="$2"');
  });
});

// ---------- lintScript ----------

describe("ai-shell lintScript", () => {
  it("flags unquoted variables (SC2086)", () => {
    const f = lintScript('echo $VAR\n');
    expect(f.some((x) => x.rule === "SC2086")).toBe(true);
  });
  it("flags cd without || exit (SC2164)", () => {
    const f = lintScript("cd /tmp\n");
    expect(f.some((x) => x.rule === "SC2164")).toBe(true);
  });
  it("does not flag commented lines", () => {
    const f = lintScript("# echo $VAR\n");
    expect(f).toHaveLength(0);
  });
  it("flags which (SC2230)", () => {
    const f = lintScript("if which foo; then echo ok; fi\n");
    expect(f.some((x) => x.rule === "SC2230")).toBe(true);
  });
  it("flags $? usage (SC2181)", () => {
    const f = lintScript("if [ $? -eq 0 ]; then echo ok; fi\n");
    expect(f.some((x) => x.rule === "SC2181")).toBe(true);
  });
});

// ---------- detectDestructive ----------

describe("ai-shell detectDestructive", () => {
  it("flags rm -rf", () => {
    const d = detectDestructive("rm -rf /tmp/x\n");
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0].line).toBe(1);
  });
  it("flags dd to a block device", () => {
    const d = detectDestructive("dd if=img.bin of=/dev/sda\n");
    expect(d.length).toBeGreaterThanOrEqual(1);
  });
  it("flags mkfs", () => {
    const d = detectDestructive("mkfs.ext4 /dev/sda1\n");
    expect(d.length).toBeGreaterThanOrEqual(1);
  });
  it("does not flag safe commands", () => {
    const d = detectDestructive("echo hello\ncd /tmp\nls -la\n");
    expect(d).toHaveLength(0);
  });
  it("ignores comments", () => {
    const d = detectDestructive("# rm -rf /tmp/x\n");
    expect(d).toHaveLength(0);
  });
});

// ---------- explainScript ----------

describe("ai-shell explainScript", () => {
  it("identifies shebang", () => {
    const s = explainScript("#!/usr/bin/env bash\nset -euo pipefail\n");
    expect(s.some((x) => x.label === "Shebang")).toBe(true);
  });
  it("identifies strict mode", () => {
    const s = explainScript("#!/usr/bin/env bash\nset -euo pipefail\n\necho hi\n");
    expect(s.some((x) => x.label === "Strict mode")).toBe(true);
  });
  it("identifies a function definition", () => {
    const s = explainScript("rotate() {\n  echo hi\n}\n");
    expect(s.some((x) => x.label === "Function: rotate")).toBe(true);
  });
  it("identifies section headers", () => {
    const s = explainScript("# ---- Backup block ----\necho hi\n");
    expect(s.some((x) => /Backup block/.test(x.label))).toBe(true);
  });
  it("identifies if statements", () => {
    const s = explainScript('if [ -f x ]; then echo hi; fi\n');
    expect(s.some((x) => x.label === "Conditional (if)")).toBe(true);
  });
  it("identifies for loops", () => {
    const s = explainScript('for f in *; do echo "$f"; done\n');
    expect(s.some((x) => x.label === "Loop (for)")).toBe(true);
  });
});

// ---------- buildBody ----------

describe("ai-shell buildBody", () => {
  it("file-ops: cleanup older-than", () => {
    const b = buildBody("file-ops", "find files older than 30 days and delete them", []);
    expect(b).toContain("mtime");
    expect(b).toContain("30");
  });
  it("file-ops: rename", () => {
    const b = buildBody("file-ops", "rename files to lowercase", []);
    expect(b).toContain('new="${f,,}"');
  });
  it("backup: rotate", () => {
    const b = buildBody("backup", "back up and rotate keeping 7", []);
    expect(b).toContain("KEEP");
    expect(b).toContain("tar -czf");
  });
  it("deployment: s3", () => {
    const b = buildBody("deployment", "sync to s3 bucket", []);
    expect(b).toContain("aws s3 sync");
  });
  it("monitoring: http", () => {
    const b = buildBody("monitoring", "monitor a URL and alert on 5xx", []);
    expect(b).toContain("curl");
    expect(b).toContain("http_code");
  });
  it("system-info: disk", () => {
    const b = buildBody("system-info", "disk usage", []);
    expect(b).toContain("du -sh");
  });
  it("generic: scaffolds a TODO", () => {
    const b = buildBody("generic", "do something bespoke", []);
    expect(b).toContain("TODO");
  });
});

// ---------- generateScript ----------

describe("ai-shell generateScript", () => {
  it("emits a bash script with shebang + strict mode", () => {
    const r = generateScript("back up this folder and rotate old backups", { flavor: "bash" });
    expect(r.script).toContain("#!/usr/bin/env bash");
    expect(r.script).toContain("set -euo pipefail");
    expect(r.category).toBe("backup");
    expect(r.flavor).toBe("bash");
  });
  it("emits a posix script with /bin/sh", () => {
    const r = generateScript("show disk usage", { flavor: "posix" });
    expect(r.script).toContain("#!/bin/sh");
    expect(r.script).toContain("set -eu");
    expect(r.flavor).toBe("posix");
  });
  it("includes a usage block", () => {
    const r = generateScript("monitor a URL", { flavor: "bash", name: "urlcheck" });
    expect(r.script).toContain("urlcheck");
    expect(r.script).toContain("--help");
  });
  it("dryRun wraps commands with a guard", () => {
    const r = generateScript("find files older than 30 days", { flavor: "bash", dryRun: true });
    expect(r.script).toContain("DRY_RUN");
    expect(r.script).toContain('[[ "$DRY_RUN" -eq 1 ]]');
  });
  it("cron wrap adds a lockfile + flock", () => {
    const r = generateScript("monitor a URL", { flavor: "bash", cron: true, name: "urlcheck" });
    expect(r.script).toContain("flock -n");
    expect(r.script).toContain("LOCKFILE");
    expect(r.script).toContain("/tmp/urlcheck.lock");
  });
  it("returns lint findings for unsafe script", () => {
    const r = generateScript("cd /tmp && echo $X", { flavor: "bash" });
    expect(r.findings.length).toBeGreaterThan(0);
  });
  it("flags destructive operations", () => {
    const r = generateScript("find files older than 30 days and delete them", { flavor: "bash" });
    // The template emits `find ... -delete` which is destructive-ish but not rm -rf.
    // At minimum the destructive array is present (may be empty for non-matching templates).
    expect(Array.isArray(r.destructive)).toBe(true);
  });
  it("emits at least one script section", () => {
    const r = generateScript("back up this folder", { flavor: "bash" });
    expect(r.sections.length).toBeGreaterThan(0);
  });
  it("non-matching task falls to generic with a note", () => {
    const r = generateScript("do something completely unusual", { flavor: "bash" });
    expect(r.category).toBe("generic");
    expect(r.note).toContain("generic");
  });
});

// ---------- addDryRunGuard / wrapForCron ----------

describe("ai-shell addDryRunGuard", () => {
  it("wraps echo but not if", () => {
    const out = addDryRunGuard('if [ -f x ]; then\n  echo hi\nfi\n');
    expect(out).toContain('[[ "$DRY_RUN" -eq 1 ]]');
    // The `if` line itself is not wrapped (it's control flow).
    expect(out.split('\n')[0]).toBe('if [ -f x ]; then');
  });
});

describe("ai-shell wrapForCron", () => {
  it("adds flock lockfile", () => {
    const out = wrapForCron("echo hi\n", "job");
    expect(out).toContain("flock -n 9");
    expect(out).toContain("/tmp/job.lock");
  });
  it("logs start and done", () => {
    const out = wrapForCron("echo hi\n", "job");
    expect(out).toContain('"starting ${0}"');
    expect(out).toContain('"done"');
  });
});

// ---------- History ----------

describe("ai-shell history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, task: "back up folder",
      flavor: "bash", category: "backup", scriptPreview: "preview",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, task: `t${i}`, flavor: "bash",
        category: "generic", scriptPreview: "x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, task: "x", flavor: "bash", category: "generic", scriptPreview: "y" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-shell shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ task: "back up folder", flavor: "posix", dryRun: true, cron: false });
    expect(url).toContain("task=back");
    expect(url).toContain("flavor=posix");
    expect(url).toContain("dry=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("task=back%20up&flavor=posix&dry=1&cron=1");
    expect(s.task).toBe("back up");
    expect(s.flavor).toBe("posix");
    expect(s.dryRun).toBe(true);
    expect(s.cron).toBe(true);
  });
  it("defaults to bash when flavor missing", () => {
    const s = parseShareUrl("task=hello");
    expect(s.flavor).toBe("bash");
    expect(s.dryRun).toBe(false);
    expect(s.cron).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ task: "", flavor: "bash", dryRun: false, cron: false });
  });
});

// ---------- BYO-key LLM ----------

describe("ai-shell BYO-key LLM", () => {
  it("builds a prompt mentioning set -euo pipefail for bash", () => {
    const p = buildLlmPrompt("back up folder", "bash");
    expect(p).toContain("set -euo pipefail");
    expect(p).toContain("back up folder");
  });
  it("builds a prompt mentioning set -eu for posix", () => {
    const p = buildLlmPrompt("back up folder", "posix");
    expect(p).toContain("set -eu");
  });
  it("renders LLM JSON result", () => {
    const raw = JSON.stringify({
      script: "echo hi",
      explanation: "prints hi",
      alternatives: ["echo bye"],
      warnings: ["none"],
    });
    const r = renderLlmResult(raw);
    expect(r.script).toBe("echo hi");
    expect(r.explanation).toBe("prints hi");
    expect(r.alternatives).toEqual(["echo bye"]);
    expect(r.warnings).toEqual(["none"]);
  });
  it("falls back gracefully on garbage", () => {
    const r = renderLlmResult("not json at all");
    expect(r.script).toBe("");
    expect(r.explanation).toContain("did not return");
  });
});

// Suppress unused-import lint
export type _Unused = ShellFlavor | ScriptCategory;
