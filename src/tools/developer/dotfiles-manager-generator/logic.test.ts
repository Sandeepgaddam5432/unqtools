import { describe, it, expect, beforeEach } from "vitest";
import {
  DOTFILE_CATALOG,
  MANAGERS,
  SECRET_PATTERNS,
  NEVER_COMMIT_LIST,
  getManager,
  validateConfig,
  resolveDotfile,
  generateRepoTree,
  generateInstallScript,
  generateDotbotConf,
  generateChezmoiConf,
  generateGitignore,
  generateReadme,
  generateBundle,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  defaultConfig,
  type DotfileConfig,
  type Manager,
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

function cfg(overrides: Partial<DotfileConfig> = {}): DotfileConfig {
  return { ...defaultConfig(), ...overrides };
}

describe("dotfiles-manager-generator constants", () => {
  it("has 12 dotfiles in catalog", () => {
    expect(DOTFILE_CATALOG.length).toBeGreaterThanOrEqual(12);
  });
  it("catalog includes .bashrc, .zshrc, .vimrc, .gitconfig, .tmux.conf", () => {
    const targets = DOTFILE_CATALOG.map((d) => d.target);
    expect(targets).toContain(".bashrc");
    expect(targets).toContain(".zshrc");
    expect(targets).toContain(".vimrc");
    expect(targets).toContain(".gitconfig");
    expect(targets).toContain(".tmux.conf");
  });
  it("ssh config flagged as secretRisk", () => {
    const ssh = resolveDotfile(".ssh/config");
    expect(ssh?.secretRisk).toBe(true);
  });
  it("has 4 managers", () => {
    expect(MANAGERS).toHaveLength(4);
    const ids = MANAGERS.map((m) => m.id);
    expect(ids).toEqual(["stow", "bare-git", "chezmoi", "dotbot"]);
  });
  it("getManager returns correct info", () => {
    expect(getManager("stow").label).toBe("GNU Stow");
    expect(getManager("chezmoi").label).toBe("chezmoi");
  });
  it("secret patterns include SSH keys and .env", () => {
    expect(SECRET_PATTERNS.some((p) => p.includes("id_"))).toBe(true);
    expect(SECRET_PATTERNS).toContain(".env");
    expect(SECRET_PATTERNS).toContain(".netrc");
  });
  it("never-commit list has critical and warn entries", () => {
    expect(NEVER_COMMIT_LIST.length).toBeGreaterThanOrEqual(5);
    expect(NEVER_COMMIT_LIST.some((x) => x.severity === "critical")).toBe(true);
    expect(NEVER_COMMIT_LIST.some((x) => x.severity === "warn")).toBe(true);
  });
});

describe("dotfiles-manager-generator resolveDotfile", () => {
  it("resolves known target", () => {
    const d = resolveDotfile(".bashrc");
    expect(d?.label).toBe("Bash config");
  });
  it("returns null for unknown", () => {
    expect(resolveDotfile(".bogus")).toBeNull();
  });
});

describe("dotfiles-manager-generator validateConfig", () => {
  it("errors on empty repo name", () => {
    const r = validateConfig({ ...cfg(), repoName: "" });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.message.includes("Repo name"))).toBe(true);
  });
  it("warns on no dotfiles selected", () => {
    const r = validateConfig({ ...cfg(), selected: [] });
    expect(r.issues.some((i) => i.severity === "warn")).toBe(true);
  });
  it("warns on bare-git + ssh/config", () => {
    const r = validateConfig({
      ...cfg(),
      manager: "bare-git",
      selected: [".ssh/config"],
    });
    expect(r.issues.some((i) => i.message.includes("ssh"))).toBe(true);
  });
  it("warns on overwrite backup mode", () => {
    const r = validateConfig({ ...cfg(), backupMode: "overwrite" });
    expect(r.issues.some((i) => i.message.includes("overwrite"))).toBe(true);
  });
  it("valid config is ok", () => {
    const r = validateConfig(cfg());
    expect(r.ok).toBe(true);
  });
});

describe("dotfiles-manager-generator generateRepoTree", () => {
  it("stow tree includes README.md and install.sh", () => {
    const tree = generateRepoTree(cfg());
    expect(tree).toContain("install.sh");
    expect(tree).toContain("README.md");
    expect(tree).toContain(".gitignore");
  });
  it("bare-git tree includes bare dir note", () => {
    const tree = generateRepoTree({ ...cfg(), manager: "bare-git" });
    expect(tree).toContain(".cfg/");
    expect(tree).toContain("Files live at their real $HOME paths");
  });
  it("chezmoi tree includes dot_ prefixed files", () => {
    const tree = generateRepoTree({ ...cfg(), manager: "chezmoi" });
    expect(tree).toContain("dot_bashrc");
    expect(tree).toContain(".chezmoi.toml.tmpl");
  });
  it("dotbot tree includes install.conf.yaml", () => {
    const tree = generateRepoTree({ ...cfg(), manager: "dotbot" });
    expect(tree).toContain("install.conf.yaml");
    expect(tree).toContain(".gitmodules");
  });
  it("uses repo name as root", () => {
    const tree = generateRepoTree({ ...cfg(), repoName: "my-dotfiles" });
    expect(tree.startsWith("my-dotfiles/")).toBe(true);
  });
});

describe("dotfiles-manager-generator generateInstallScript", () => {
  it("starts with shebang", () => {
    const s = generateInstallScript(cfg());
    expect(s.startsWith("#!/usr/bin/env bash")).toBe(true);
  });
  it("uses set -euo pipefail", () => {
    expect(generateInstallScript(cfg())).toContain("set -euo pipefail");
  });
  it("stow install calls stow --target=$HOME", () => {
    const s = generateInstallScript({ ...cfg(), manager: "stow" });
    expect(s).toContain("stow --target=\"$HOME\"");
  });
  it("bare-git init --bare", () => {
    const s = generateInstallScript({ ...cfg(), manager: "bare-git" });
    expect(s).toContain("git init --bare");
    expect(s).toContain("status.showUntrackedFiles no");
  });
  it("chezmoi install via curl", () => {
    const s = generateInstallScript({ ...cfg(), manager: "chezmoi" });
    expect(s).toContain("chezmoi init");
    expect(s).toContain("get.chezmoi.io");
  });
  it("dotbot invokes dotbot bin", () => {
    const s = generateInstallScript({ ...cfg(), manager: "dotbot" });
    expect(s).toContain("install.conf.yaml");
    expect(s).toContain("dotbot");
  });
  it("bak mode backs up existing files", () => {
    const s = generateInstallScript({ ...cfg(), backupMode: "bak" });
    expect(s).toContain("mv \"$target\" \"$target.bak.$TIMESTAMP\"");
  });
  it("skip mode returns 1 to skip", () => {
    const s = generateInstallScript({ ...cfg(), backupMode: "skip" });
    expect(s).toContain("return 1");
    expect(s).toContain("Skipping");
  });
  it("overwrite mode rm -rf", () => {
    const s = generateInstallScript({ ...cfg(), backupMode: "overwrite" });
    expect(s).toContain("rm -rf \"$target\"");
  });
  it("osGuards includes uname detection", () => {
    const s = generateInstallScript({ ...cfg(), osGuards: true });
    expect(s).toContain("uname -s");
    expect(s).toContain("Darwin*");
  });
  it("osGuards off omits detection", () => {
    const s = generateInstallScript({ ...cfg(), osGuards: false });
    expect(s).not.toContain("uname -s");
  });
  it("packageStub includes brew/apt stub", () => {
    const s = generateInstallScript({ ...cfg(), packageStub: true });
    expect(s).toContain("brew bundle");
    expect(s).toContain("apt install");
  });
});

describe("dotfiles-manager-generator generateDotbotConf", () => {
  it("has defaults + link + shell sections", () => {
    const y = generateDotbotConf(cfg());
    expect(y).toContain("- defaults:");
    expect(y).toContain("- link:");
    expect(y).toContain("- shell:");
  });
  it("lists each selected dotfile as link entry", () => {
    const y = generateDotbotConf({ ...cfg(), selected: [".bashrc", ".vimrc"] });
    expect(y).toContain("bashrc: .bashrc");
    expect(y).toContain("vimrc: .vimrc");
  });
});

describe("dotfiles-manager-generator generateChezmoiConf", () => {
  it("contains promptString and [data] block", () => {
    const c = generateChezmoiConf(cfg());
    expect(c).toContain("promptString");
    expect(c).toContain("[data]");
    expect(c).toContain("email");
  });
});

describe("dotfiles-manager-generator generateGitignore", () => {
  it("includes OS junk and secrets sections", () => {
    const g = generateGitignore(cfg());
    expect(g).toContain(".DS_Store");
    expect(g).toContain("Secrets");
    expect(g).toContain(".ssh/id_*");
    expect(g).toContain(".env");
  });
  it("chezmoi ignores .chezmoi.toml local", () => {
    const g = generateGitignore({ ...cfg(), manager: "chezmoi" });
    expect(g).toContain(".chezmoi.toml");
  });
  it("bare-git includes extra warning comment", () => {
    const g = generateGitignore({ ...cfg(), manager: "bare-git" });
    expect(g).toContain("Bare-git already hides untracked files");
  });
});

describe("dotfiles-manager-generator generateReadme", () => {
  it("includes repo name as H1", () => {
    const r = generateReadme({ ...cfg(), repoName: "my-dots" });
    expect(r).toContain("# my-dots");
  });
  it("includes manager pros/cons", () => {
    const r = generateReadme({ ...cfg(), manager: "stow" });
    expect(r).toContain("## Why GNU Stow?");
    expect(r).toContain("**Pros**");
    expect(r).toContain("**Cons**");
  });
  it("lists tracked dotfiles", () => {
    const r = generateReadme({ ...cfg(), selected: [".bashrc"] });
    expect(r).toContain("`.bashrc`");
    expect(r).toContain("Bash config");
  });
  it("flags ssh config secret risk", () => {
    const r = generateReadme({ ...cfg(), selected: [".ssh/config"] });
    expect(r).toContain("may contain secrets");
  });
  it("includes install command", () => {
    const r = generateReadme(cfg());
    expect(r).toContain("./install.sh");
    expect(r).toContain("git clone");
  });
});

describe("dotfiles-manager-generator generateBundle", () => {
  it("returns tree + install + gitignore + readme + checklist", () => {
    const b = generateBundle(cfg());
    expect(b.tree).toContain("install.sh");
    expect(b.installScript).toContain("set -euo pipefail");
    expect(b.gitignore).toContain(".DS_Store");
    expect(b.readme).toContain("# dotfiles");
    expect(b.checklist.length).toBeGreaterThanOrEqual(5);
  });
  it("dotbot bundle includes dotbotConf", () => {
    const b = generateBundle({ ...cfg(), manager: "dotbot" });
    expect(b.dotbotConf).toBeDefined();
    expect(b.dotbotConf).toContain("- link:");
  });
  it("chezmoi bundle includes chezmoiConf", () => {
    const b = generateBundle({ ...cfg(), manager: "chezmoi" });
    expect(b.chezmoiConf).toBeDefined();
    expect(b.chezmoiConf).toContain("[data]");
  });
  it("stow bundle has no dotbot/chezmoi conf", () => {
    const b = generateBundle({ ...cfg(), manager: "stow" });
    expect(b.dotbotConf).toBeUndefined();
    expect(b.chezmoiConf).toBeUndefined();
  });
});

describe("dotfiles-manager-generator computeStats", () => {
  it("counts selected dotfiles", () => {
    const s = computeStats({ ...cfg(), selected: [".bashrc", ".zshrc", ".ssh/config"] });
    expect(s.totalSelected).toBe(3);
    expect(s.withSecretRisk).toBe(1); // ssh/config
  });
  it("counts files vs directories", () => {
    const s = computeStats({
      ...cfg(),
      selected: [".bashrc", ".config/nvim", ".config/starship.toml"],
    });
    expect(s.files).toBe(1); // .bashrc
    expect(s.directories).toBe(2); // nvim, starship
  });
  it("counts install script lines and gitignore patterns", () => {
    const s = computeStats(cfg());
    expect(s.installScriptLines).toBeGreaterThan(10);
    expect(s.gitignorePatterns).toBe(SECRET_PATTERNS.length);
  });
});

describe("dotfiles-manager-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, manager: "stow", selectedCount: 5, repoName: "dotfiles" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, manager: "stow", selectedCount: 1, repoName: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, manager: "stow", selectedCount: 1, repoName: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("dotfiles-manager-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(cfg());
    expect(url).toContain("m=stow");
    expect(url).toContain("r=dotfiles");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips config through share URL", () => {
    const c = cfg({
      manager: "chezmoi",
      repoName: "my-dots",
      author: "alice",
      selected: [".bashrc", ".vimrc"],
      osGuards: true,
      packageStub: true,
      backupMode: "skip",
    });
    const url = buildShareUrl(c);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.manager).toBe("chezmoi");
    expect(parsed.repoName).toBe("my-dots");
    expect(parsed.author).toBe("alice");
    expect(parsed.selected).toEqual([".bashrc", ".vimrc"]);
    expect(parsed.osGuards).toBe(true);
    expect(parsed.packageStub).toBe(true);
    expect(parsed.backupMode).toBe("skip");
  });
  it("parses empty hash to default config", () => {
    const parsed = parseShareUrl("");
    expect(parsed.manager).toBe("stow");
    expect(parsed.selected).toEqual(defaultConfig().selected);
  });
  it("filters unknown manager to stow", () => {
    const parsed = parseShareUrl("m=unknown&r=x");
    expect(parsed.manager).toBe("stow");
  });
  it("filters unknown dotfile targets", () => {
    const parsed = parseShareUrl("m=stow&s=.bashrc,.bogus,.vimrc");
    expect(parsed.selected).toEqual([".bashrc", ".vimrc"]);
  });
});

describe("dotfiles-manager-generator defaultConfig", () => {
  it("defaults to stow manager", () => {
    expect(defaultConfig().manager).toBe("stow");
  });
  it("selects 5 common dotfiles by default", () => {
    expect(defaultConfig().selected).toHaveLength(5);
  });
  it("defaults to backupMode=bak", () => {
    expect(defaultConfig().backupMode).toBe("bak");
  });
});

// Suppress unused-import lint
export type _Unused = Manager;
