import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CONFIG,
  DIRECTION_LABELS,
  DIRECTION_HINTS,
  ARCHIVE_BREAKDOWN,
  RECIPES,
  shellQuote,
  withTrailingSlash,
  isRemotePath,
  parseRemotePath,
  buildSshString,
  renderEffectivePaths,
  visualizeSlashEffect,
  parseList,
  buildCommand,
  explainIntent,
  explainFlags,
  validateConfig,
  renderRecipesText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BuilderConfig,
  type RsyncDirection,
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

// ---- Constants ----

describe("rsync constants", () => {
  it("has 3 directions", () => {
    expect(Object.keys(DIRECTION_LABELS)).toHaveLength(3);
    expect(DIRECTION_LABELS.push).toContain("Push");
  });
  it("has direction hints", () => {
    expect(DIRECTION_HINTS.local).toBeTruthy();
    expect(DIRECTION_HINTS.push).toContain("remote");
  });
  it("has archive breakdown of 7 sub-flags", () => {
    expect(ARCHIVE_BREAKDOWN).toHaveLength(7);
    expect(ARCHIVE_BREAKDOWN.map((b) => b.flag)).toEqual(["-r", "-l", "-p", "-t", "-g", "-o", "-D"]);
  });
  it("default config has archive + verbose + local", () => {
    expect(DEFAULT_CONFIG.direction).toBe("local");
    expect(DEFAULT_CONFIG.archive).toBe(true);
    expect(DEFAULT_CONFIG.verbose).toBe(true);
    expect(DEFAULT_CONFIG.delete).toBe(false);
    expect(DEFAULT_CONFIG.dryRun).toBe(false);
  });
  it("has 10 recipes", () => {
    expect(RECIPES).toHaveLength(10);
  });
});

// ---- shellQuote ----

describe("rsync shellQuote", () => {
  it("passes through safe strings", () => {
    expect(shellQuote("./src/")).toBe("./src/");
    expect(shellQuote("/var/www/project/")).toBe("/var/www/project/");
  });
  it("quotes empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
  it("single-quotes unsafe chars", () => {
    expect(shellQuote("my folder")).toBe("'my folder'");
  });
  it("escapes embedded single quote", () => {
    expect(shellQuote("bob's file")).toContain("'\\''");
  });
});

// ---- withTrailingSlash ----

describe("rsync withTrailingSlash", () => {
  it("adds trailing slash when on", () => {
    expect(withTrailingSlash("./src", true)).toBe("./src/");
    expect(withTrailingSlash("./src/", true)).toBe("./src/");
  });
  it("removes trailing slash when off", () => {
    expect(withTrailingSlash("./src/", false)).toBe("./src");
    expect(withTrailingSlash("./src", false)).toBe("./src");
  });
  it("handles empty path", () => {
    expect(withTrailingSlash("", true)).toBe("");
  });
});

// ---- isRemotePath / parseRemotePath ----

describe("rsync isRemotePath / parseRemotePath", () => {
  it("detects remote paths", () => {
    expect(isRemotePath("user@host:/path")).toBe(true);
    expect(isRemotePath("host:/path")).toBe(true);
    expect(isRemotePath("/local/path")).toBe(false);
    expect(isRemotePath("./local/path")).toBe(false);
  });
  it("parses user@host:path", () => {
    const r = parseRemotePath("alice@example.com:/home/alice");
    expect(r.ok).toBe(true);
    expect(r.user).toBe("alice");
    expect(r.host).toBe("example.com");
    expect(r.pathPart).toBe("/home/alice");
  });
  it("parses host:path without user", () => {
    const r = parseRemotePath("example.com:/data");
    expect(r.user).toBe("");
    expect(r.host).toBe("example.com");
    expect(r.pathPart).toBe("/data");
  });
  it("returns ok=false for local path", () => {
    const r = parseRemotePath("./local/path");
    expect(r.ok).toBe(false);
  });
});

// ---- buildSshString ----

describe("rsync buildSshString", () => {
  it("returns empty when disabled", () => {
    const r = buildSshString({ enabled: false, user: "", host: "", port: "", keyFile: "", extraOptions: "" });
    expect(r.present).toBe(false);
    expect(r.string).toBe("");
  });
  it("builds key + port", () => {
    const r = buildSshString({ enabled: true, user: "", host: "", port: "2222", keyFile: "~/.ssh/key", extraOptions: "" });
    expect(r.present).toBe(true);
    expect(r.string).toBe("ssh -i ~/.ssh/key -p 2222");
  });
  it("includes extra options", () => {
    const r = buildSshString({ enabled: true, user: "", host: "", port: "", keyFile: "", extraOptions: "-o StrictHostKeyChecking=no" });
    expect(r.string).toBe("ssh -o StrictHostKeyChecking=no");
  });
  it("single-quotes the resulting string", () => {
    const r = buildSshString({ enabled: true, user: "", host: "", port: "2222", keyFile: "", extraOptions: "" });
    expect(r.quoted).toBe("'ssh -p 2222'");
  });
  it("returns present=false when only 'ssh' with no flags", () => {
    const r = buildSshString({ enabled: true, user: "", host: "", port: "", keyFile: "", extraOptions: "" });
    expect(r.present).toBe(false);
  });
});

// ---- renderEffectivePaths & visualizeSlashEffect ----

describe("rsync renderEffectivePaths", () => {
  it("applies trailing slash rules", () => {
    const r = renderEffectivePaths({
      ...DEFAULT_CONFIG,
      source: "./src",
      sourceTrailingSlash: true,
      destination: "./dest",
      destTrailingSlash: false,
    });
    expect(r.source).toBe("./src/");
    expect(r.dest).toBe("./dest");
  });
});

describe("rsync visualizeSlashEffect", () => {
  it("contents mode with trailing slash", () => {
    const v = visualizeSlashEffect({
      ...DEFAULT_CONFIG,
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "./dest/",
    });
    expect(v.sourceMode).toBe("contents");
    expect(v.explanation).toContain("CONTENTS");
    expect(v.example).toContain("→");
  });
  it("dir mode without trailing slash", () => {
    const v = visualizeSlashEffect({
      ...DEFAULT_CONFIG,
      source: "./src",
      sourceTrailingSlash: false,
      destination: "./dest",
    });
    expect(v.sourceMode).toBe("dir");
    expect(v.explanation).toContain("DIRECTORY itself");
  });
});

// ---- parseList ----

describe("rsync parseList", () => {
  it("splits newline-separated", () => {
    expect(parseList("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("splits comma-separated", () => {
    expect(parseList("a, b , c")).toEqual(["a", "b", "c"]);
  });
  it("handles empty", () => {
    expect(parseList("")).toEqual([]);
  });
});

// ---- buildCommand ----

describe("rsync buildCommand basic", () => {
  it("builds a local archive sync with trailing slash", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      direction: "local",
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "./dest/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
    });
    expect(built.command).toContain("rsync -av");
    expect(built.command).toContain("./src/");
    expect(built.command).toContain("./dest/");
  });
  it("uses -r when archive is off but recursive is on", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      archive: false,
      recursive: true,
      verbose: true,
    });
    expect(built.command).toContain("-rv");
    expect(built.command).not.toContain("-av");
  });
  it("uses -n for dry-run", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      dryRun: true,
    });
    expect(built.command).toContain("-avn");
  });
});

describe("rsync buildCommand delete + dry-run guards", () => {
  it("warns when --delete is enabled without --dry-run", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      delete: true,
      dryRun: false,
    });
    expect(built.command).toContain("--delete");
    expect(built.warnings.some((w) => /--dry-run|dry-run|preview/i.test(w))).toBe(true);
  });
  it("does NOT warn when --delete is paired with --dry-run", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      delete: true,
      dryRun: true,
    });
    expect(built.warnings.some((w) => /WITHOUT.*dry-run|preview first/i.test(w))).toBe(false);
  });
  it("warns when --delete-excluded without --delete", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      delete: false,
      deleteExcluded: true,
    });
    expect(built.warnings.some((w) => /without --delete/i.test(w))).toBe(true);
  });
});

describe("rsync buildCommand excludes + exclude-from", () => {
  it("emits --exclude=PATTERN for each exclude", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      excludes: [".git/", "node_modules/", "*.log"],
    });
    expect(built.command).toContain("--exclude=.git/");
    expect(built.command).toContain("--exclude=node_modules/");
    // *.log contains a '*' which is shell-unsafe so it gets quoted
    expect(built.command).toContain("--exclude='*.log'");
  });
  it("emits --exclude-from=FILE when set", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      excludeFrom: "excludes.txt",
    });
    expect(built.command).toContain("--exclude-from=excludes.txt");
  });
});

describe("rsync buildCommand long flags", () => {
  it("emits --progress, --partial, --numeric-ids, --bwlimit", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      progress: true,
      partial: true,
      numericIds: true,
      bwlimit: 1024,
    });
    expect(built.command).toContain("--progress");
    expect(built.command).toContain("--partial");
    expect(built.command).toContain("--numeric-ids");
    expect(built.command).toContain("--bwlimit=1024");
  });
  it("emits -c for checksum", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      checksum: true,
    });
    expect(built.command).toContain("-avc");
  });
  it("emits -z for compress and -h for human-readable", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      compress: true,
      humanReadable: true,
    });
    expect(built.command).toContain("-avzh");
  });
});

describe("rsync buildCommand SSH transport", () => {
  it("emits -e 'ssh -i key -p port' when SSH enabled with key+port", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      direction: "push",
      source: "./local/",
      destination: "user@host:/remote/",
      ssh: { enabled: true, user: "", host: "", port: "2222", keyFile: "~/.ssh/k", extraOptions: "" },
    });
    expect(built.command).toContain("-e");
    expect(built.command).toContain("'ssh -i ~/.ssh/k -p 2222'");
  });
  it("does NOT emit -e when SSH enabled but no key/port/options", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      direction: "push",
      source: "./local/",
      destination: "user@host:/remote/",
      ssh: { enabled: true, user: "", host: "", port: "", keyFile: "", extraOptions: "" },
    });
    expect(built.command).not.toContain(" -e ");
  });
});

describe("rsync buildCommand direction validation", () => {
  it("push warns when destination is not remote", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      direction: "push",
      source: "./local/",
      destination: "./not-remote/",
    });
    expect(built.warnings.some((w) => /push.*destination/i.test(w))).toBe(true);
  });
  it("pull warns when source is not remote", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      direction: "pull",
      source: "./local/",
      destination: "./also-local/",
    });
    expect(built.warnings.some((w) => /pull.*source/i.test(w))).toBe(true);
  });
  it("local warns when a path looks remote", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      direction: "local",
      source: "user@host:/remote/",
      destination: "./local/",
    });
    expect(built.warnings.some((w) => /local.*remote/i.test(w))).toBe(true);
  });
});

describe("rsync buildCommand source/dest apply trailing slash", () => {
  it("source without trailing slash keeps no slash", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      source: "./src",
      sourceTrailingSlash: false,
      destination: "./dest",
      destTrailingSlash: true,
    });
    expect(built.command).toContain("./src");
    expect(built.command).toContain("./dest/");
    // ./src (no slash) should NOT be followed by a slash in the output
    expect(built.command).not.toContain("./src /");
    expect(built.command).not.toContain("'./src/'");
  });
});

// ---- explainIntent / explainFlags / validateConfig ----

describe("rsync explainIntent", () => {
  it("mentions direction and archive mode", () => {
    const s = explainIntent(DEFAULT_CONFIG);
    expect(s).toContain("Sync locally");
    expect(s).toContain("Archive");
    expect(s.toLowerCase()).toContain("trailing slash");
  });
  it("mentions delete when enabled", () => {
    const s = explainIntent({ ...DEFAULT_CONFIG, delete: true, dryRun: true });
    expect(s).toContain("DELETE");
    expect(s).toContain("DRY RUN");
  });
});

describe("rsync explainFlags", () => {
  it("includes -a and -v in default config", () => {
    const flags = explainFlags(DEFAULT_CONFIG);
    expect(flags.some((f) => f.flag === "-a")).toBe(true);
    expect(flags.some((f) => f.flag === "-v")).toBe(true);
  });
  it("includes --delete explanation when enabled", () => {
    const flags = explainFlags({ ...DEFAULT_CONFIG, delete: true });
    expect(flags.some((f) => f.flag === "--delete")).toBe(true);
  });
  it("includes --bwlimit when set", () => {
    const flags = explainFlags({ ...DEFAULT_CONFIG, bwlimit: 500 });
    expect(flags.some((f) => f.flag === "--bwlimit=500")).toBe(true);
  });
});

describe("rsync validateConfig", () => {
  it("warns on delete without dry-run", () => {
    const v = validateConfig({ ...DEFAULT_CONFIG, delete: true, dryRun: false });
    expect(v.warnings.some((w) => /dry-run/i.test(w))).toBe(true);
  });
  it("warns on delete-excluded without delete", () => {
    const v = validateConfig({ ...DEFAULT_CONFIG, deleteExcluded: true, delete: false });
    expect(v.warnings.some((w) => /without --delete/i.test(w))).toBe(true);
  });
  it("warns on push with local destination", () => {
    const v = validateConfig({
      ...DEFAULT_CONFIG,
      direction: "push",
      source: "./local/",
      destination: "./not-remote/",
    });
    expect(v.warnings.some((w) => /push.*destination/i.test(w))).toBe(true);
  });
});

// ---- renderRecipesText ----

describe("rsync renderRecipesText", () => {
  it("renders all recipes", () => {
    const text = renderRecipesText();
    expect(text).toContain("Local mirror");
    expect(text).toContain("Push over SSH");
    expect(text).toContain("rsync");
  });
});

// ---- History ----

describe("rsync history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, direction: "local", command: "rsync -av ./src/ ./dest/" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].direction).toBe("local");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, direction: "local", command: `rsync -av ./s${i}/ ./d${i}/` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, direction: "local", command: "rsync -av ./s/ ./d/" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Share URL ----

describe("rsync share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ...DEFAULT_CONFIG,
      direction: "push",
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "user@host:/remote/",
      destTrailingSlash: true,
      delete: true,
      dryRun: true,
      bwlimit: 500,
      excludes: [".git/"],
      ssh: { enabled: true, user: "u", host: "h", port: "2222", keyFile: "~/.ssh/k", extraOptions: "" },
    });
    expect(url).toContain("d=push");
    expect(url).toContain("s=.%2Fsrc%2F");
    expect(url).toContain("ss=1");
    expect(url).toContain("f=avnD");
    expect(url).toContain("bw=500");
    expect(url).toContain("ex=.git%2F");
    expect(url).toContain("se=1");
    expect(url).toContain("su=u");
    expect(url).toContain("sp=2222");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { config } = parseShareUrl("d=push&s=./src/&ss=1&t=user@host:/remote/&ts=1&f=avnD&bw=500&ex=.git/&se=1&su=u&sh=h&sp=2222&sk=~/.ssh/k");
    expect(config.direction).toBe("push");
    expect(config.source).toBe("./src/");
    expect(config.sourceTrailingSlash).toBe(true);
    expect(config.destination).toBe("user@host:/remote/");
    expect(config.archive).toBe(true);
    expect(config.verbose).toBe(true);
    expect(config.dryRun).toBe(true);
    expect(config.delete).toBe(true);
    expect(config.bwlimit).toBe(500);
    expect(config.excludes).toEqual([".git/"]);
    expect(config.ssh?.enabled).toBe(true);
    expect(config.ssh?.user).toBe("u");
    expect(config.ssh?.host).toBe("h");
    expect(config.ssh?.port).toBe("2222");
    expect(config.ssh?.keyFile).toBe("~/.ssh/k");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ config: {} });
  });
  it("filters unknown direction", () => {
    const { config } = parseShareUrl("d=bogus");
    expect(config.direction).toBeUndefined();
  });
  it("round-trips a full config", () => {
    const cfg: BuilderConfig = {
      ...DEFAULT_CONFIG,
      direction: "pull",
      source: "alice@host:/home/alice/",
      sourceTrailingSlash: true,
      destination: "./backups/alice/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      partial: true,
      progress: true,
      checksum: true,
      humanReadable: true,
      compress: true,
      numericIds: true,
      excludes: ["*.tmp", "cache/"],
      excludeFrom: "excludes.txt",
      bwlimit: 2000,
      ssh: { enabled: true, user: "alice", host: "host", port: "22", keyFile: "~/.ssh/id_ed25519", extraOptions: "" },
    };
    const url = buildShareUrl(cfg);
    const { config: parsed } = parseShareUrl(url.split("#")[1] ?? url);
    expect(parsed.direction).toBe("pull");
    expect(parsed.source).toBe("alice@host:/home/alice/");
    expect(parsed.archive).toBe(true);
    expect(parsed.partial).toBe(true);
    expect(parsed.progress).toBe(true);
    expect(parsed.checksum).toBe(true);
    expect(parsed.humanReadable).toBe(true);
    expect(parsed.compress).toBe(true);
    expect(parsed.numericIds).toBe(true);
    expect(parsed.excludes).toEqual(["*.tmp", "cache/"]);
    expect(parsed.excludeFrom).toBe("excludes.txt");
    expect(parsed.bwlimit).toBe(2000);
    expect(parsed.ssh?.enabled).toBe(true);
    expect(parsed.ssh?.user).toBe("alice");
    expect(parsed.ssh?.keyFile).toBe("~/.ssh/id_ed25519");
  });
});

// Suppress unused-import lint
export type _Unused = RsyncDirection | BuilderConfig;
