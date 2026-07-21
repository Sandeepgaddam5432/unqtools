import { describe, it, expect, beforeEach } from "vitest";
import {
  HOST_TEMPLATES,
  TEMPLATE_LABELS,
  LOG_LEVELS,
  STRICT_HOST_KEY_VALUES,
  makeId,
  emptyHost,
  emptyConfig,
  applyTemplate,
  validateHost,
  renderHost,
  renderInclude,
  renderMatch,
  renderConfig,
  parseConfig,
  importConfig,
  lintConfig,
  generateKeygenCommand,
  addHost,
  updateHost,
  removeHost,
  moveHost,
  dedupeHosts,
  bulkAddFromJson,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SshHost,
  type SshConfig,
  type HostTemplateId,
  type IncludeEntry,
  type MatchBlock,
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

describe("ssh-config-generator constants", () => {
  it("has 5 host templates", () => {
    expect(HOST_TEMPLATES).toHaveLength(5);
  });
  it("includes basic-server, jump-host, github, aws-ec2, wildcard templates", () => {
    const ids = HOST_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["basic-server", "jump-host", "github", "aws-ec2", "wildcard"]),
    );
  });
  it("has template labels matching", () => {
    expect(Object.keys(TEMPLATE_LABELS)).toHaveLength(5);
    expect(TEMPLATE_LABELS["basic-server"]).toBe("Basic server");
  });
  it("has log levels list", () => {
    expect(LOG_LEVELS).toContain("INFO");
    expect(LOG_LEVELS).toContain("DEBUG3");
  });
  it("has strict host key values", () => {
    expect(STRICT_HOST_KEY_VALUES).toEqual(["yes", "no", "accept-new"]);
  });
});

describe("ssh-config-generator makeId / emptyHost / emptyConfig", () => {
  it("makeId returns unique IDs with prefix", () => {
    const a = makeId("h");
    const b = makeId("h");
    expect(a.startsWith("h-")).toBe(true);
    expect(b.startsWith("h-")).toBe(true);
    expect(a).not.toBe(b);
  });
  it("emptyHost returns default host with port 22", () => {
    const h = emptyHost();
    expect(h.port).toBe(22);
    expect(h.identitiesOnly).toBe(true);
    expect(h.forwards).toEqual([]);
    expect(h.enabled).toBe(true);
  });
  it("emptyConfig returns empty arrays", () => {
    const c = emptyConfig();
    expect(c.hosts).toEqual([]);
    expect(c.includes).toEqual([]);
    expect(c.matches).toEqual([]);
  });
});

describe("ssh-config-generator applyTemplate", () => {
  it("basic-server template has HostName + User", () => {
    const h = applyTemplate("basic-server");
    expect(h.alias).toBe("prod");
    expect(h.hostName).toBe("server.example.com");
    expect(h.user).toBe("ubuntu");
    expect(h.identityFile).toBe("~/.ssh/id_ed25519");
    expect(h.identitiesOnly).toBe(true);
  });
  it("jump-host template has ProxyJump", () => {
    const h = applyTemplate("jump-host");
    expect(h.proxyJump).toBe("bastion");
    expect(h.alias).toContain("*");
  });
  it("github template uses git user and dedicated key", () => {
    const h = applyTemplate("github");
    expect(h.user).toBe("git");
    expect(h.identityFile).toBe("~/.ssh/github_ed25519");
  });
  it("aws-ec2 template uses ec2-user and .pem key", () => {
    const h = applyTemplate("aws-ec2");
    expect(h.user).toBe("ec2-user");
    expect(h.identityFile).toBe("~/.ssh/aws-prod.pem");
  });
  it("wildcard template has alias 10.0.* and accept-new", () => {
    const h = applyTemplate("wildcard");
    expect(h.alias).toBe("10.0.*");
    expect(h.strictHostKeyChecking).toBe("accept-new");
  });
  it("throws on unknown template", () => {
    expect(() => applyTemplate("nope" as HostTemplateId)).toThrow();
  });
});

describe("ssh-config-generator validateHost", () => {
  it("flags missing alias", () => {
    const h = applyTemplate("basic-server");
    h.alias = "";
    const v = validateHost(h);
    expect(v.errors).toContain("Host alias is required.");
  });
  it("flags invalid port", () => {
    const h = applyTemplate("basic-server");
    h.port = 99999;
    const v = validateHost(h);
    expect(v.errors.some((e) => e.includes("Port"))).toBe(true);
  });
  it("warns when IdentityFile set without IdentitiesOnly", () => {
    const h = applyTemplate("basic-server");
    h.identitiesOnly = false;
    const v = validateHost(h);
    expect(v.warnings.some((w) => w.includes("IdentitiesOnly"))).toBe(true);
  });
  it("accepts a valid host with no errors", () => {
    const v = validateHost(applyTemplate("basic-server"));
    expect(v.errors).toHaveLength(0);
  });
});

describe("ssh-config-generator renderHost", () => {
  it("renders Host + HostName + User", () => {
    const h = applyTemplate("basic-server");
    const out = renderHost(h);
    expect(out).toContain("Host prod");
    expect(out).toContain("HostName server.example.com");
    expect(out).toContain("User ubuntu");
  });
  it("emits connect-hint comment with first alias", () => {
    const h = applyTemplate("basic-server");
    const out = renderHost(h);
    expect(out).toContain("# ssh prod");
  });
  it("renders ProxyJump when set", () => {
    const h = applyTemplate("jump-host");
    const out = renderHost(h);
    expect(out).toContain("ProxyJump bastion");
  });
  it("renders StrictHostKeyChecking value", () => {
    const h = applyTemplate("wildcard");
    const out = renderHost(h);
    expect(out).toContain("StrictHostKeyChecking accept-new");
  });
  it("renders DynamicForward spec verbatim", () => {
    const h = emptyHost();
    h.alias = "tunnel";
    h.forwards = [
      { id: "f1", kind: "dynamic", spec: "1080" },
    ];
    const out = renderHost(h);
    expect(out).toContain("DynamicForward 1080");
  });
  it("renders LocalForward with two args", () => {
    const h = emptyHost();
    h.alias = "tunnel";
    h.forwards = [
      { id: "f1", kind: "local", spec: "8080:example.com:80" },
    ];
    const out = renderHost(h);
    expect(out).toContain("LocalForward");
    expect(out).toContain("example.com:80");
  });
});

describe("ssh-config-generator renderConfig", () => {
  it("emits header comment", () => {
    const out = renderConfig(emptyConfig());
    expect(out).toContain("~/.ssh/config");
    expect(out).toContain("First-match-wins");
  });
  it("renders multiple hosts separated by blank line", () => {
    const cfg: SshConfig = {
      hosts: [applyTemplate("basic-server"), applyTemplate("github")],
      includes: [],
      matches: [],
    };
    const out = renderConfig(cfg);
    expect(out).toContain("Host prod");
    expect(out).toContain("Host github.com");
  });
  it("renders Include and Match blocks", () => {
    const inc: IncludeEntry = { id: "i1", path: "~/.ssh/config.d/*", enabled: true };
    const m: MatchBlock = { id: "m1", conditions: 'host *.example.com', body: "User admin", enabled: true };
    const out = renderConfig({ hosts: [], includes: [inc], matches: [m] });
    expect(out).toContain("Include ~/.ssh/config.d/*");
    expect(out).toContain("Match host *.example.com");
    expect(out).toContain("User admin");
  });
});

describe("ssh-config-generator parseConfig / importConfig", () => {
  it("parses a single Host block", () => {
    const text = `Host prod
  HostName server.example.com
  User ubuntu
  Port 2222
  IdentityFile ~/.ssh/id_ed25519
`;
    const p = parseConfig(text);
    expect(p.hosts).toHaveLength(1);
    expect(p.hosts[0].alias).toBe("prod");
    expect(p.hosts[0].options.HostName).toBe("server.example.com");
    expect(p.hosts[0].options.Port).toBe("2222");
  });
  it("parses multiple Host blocks", () => {
    const text = `Host a
  User x
Host b
  User y
`;
    const p = parseConfig(text);
    expect(p.hosts).toHaveLength(2);
  });
  it("parses Include directive", () => {
    const p = parseConfig("Include ~/.ssh/config.d/*");
    expect(p.includes).toHaveLength(1);
    expect(p.includes[0].path).toBe("~/.ssh/config.d/*");
  });
  it("parses Match block with body", () => {
    const text = `Match host *.example.com exec "true"
  User admin
  Port 2222
`;
    const p = parseConfig(text);
    expect(p.matches).toHaveLength(1);
    expect(p.matches[0].conditions).toContain("host *.example.com");
    expect(p.matches[0].body).toContain("User admin");
  });
  it("ignores comments and blank lines", () => {
    const text = `# header comment

Host prod
  # inline comment
  User ubuntu
`;
    const p = parseConfig(text);
    expect(p.hosts).toHaveLength(1);
  });
  it("importConfig returns editable SshConfig", () => {
    const cfg = importConfig("Host prod\n  HostName server.example.com\n  User ubuntu\n  Port 2222\n");
    expect(cfg.hosts).toHaveLength(1);
    expect(cfg.hosts[0].alias).toBe("prod");
    expect(cfg.hosts[0].port).toBe(2222);
  });
});

describe("ssh-config-generator lintConfig", () => {
  it("flags StrictHostKeyChecking no as critical", () => {
    const h = applyTemplate("basic-server");
    h.strictHostKeyChecking = "no";
    const ws = lintConfig({ hosts: [h], includes: [], matches: [] });
    expect(ws.some((w) => w.rule === "strict-host-key-no" && w.severity === "critical")).toBe(true);
  });
  it("flags ForwardAgent yes on wildcard", () => {
    const h = applyTemplate("wildcard");
    h.forwardAgent = true;
    const ws = lintConfig({ hosts: [h], includes: [], matches: [] });
    expect(ws.some((w) => w.rule === "broad-forward-agent")).toBe(true);
  });
  it("flags IdentityFile without IdentitiesOnly", () => {
    const h = applyTemplate("basic-server");
    h.identitiesOnly = false;
    const ws = lintConfig({ hosts: [h], includes: [], matches: [] });
    expect(ws.some((w) => w.rule === "missing-identities-only")).toBe(true);
  });
  it("emits chmod-600 info for ed25519 IdentityFile", () => {
    const h = applyTemplate("basic-server");
    const ws = lintConfig({ hosts: [h], includes: [], matches: [] });
    expect(ws.some((w) => w.rule === "chmod-600-reminder" && w.severity === "info")).toBe(true);
  });
  it("flags Host * with permissive options", () => {
    const h = emptyHost();
    h.alias = "*";
    h.forwardAgent = true;
    const ws = lintConfig({ hosts: [h], includes: [], matches: [] });
    expect(ws.some((w) => w.rule === "wildcard-permissive")).toBe(true);
  });
  it("returns no warnings for clean config", () => {
    const h = applyTemplate("github");
    const ws = lintConfig({ hosts: [h], includes: [], matches: [] });
    // github template is clean (no StrictHostKeyChecking no, no ForwardAgent, has IdentitiesOnly yes)
    expect(ws.filter((w) => w.severity === "critical" || w.severity === "warn")).toHaveLength(0);
  });
});

describe("ssh-config-generator generateKeygenCommand", () => {
  it("generates ed25519 keygen by default", () => {
    const h = applyTemplate("basic-server");
    const cmd = generateKeygenCommand(h);
    expect(cmd).toContain("-t ed25519");
    expect(cmd).toContain("-f ~/.ssh/id_ed25519");
  });
  it("uses RSA PEM for .pem paths", () => {
    const h = applyTemplate("aws-ec2");
    const cmd = generateKeygenCommand(h);
    expect(cmd).toContain("-t rsa");
    expect(cmd).toContain("-m PEM");
  });
});

describe("ssh-config-generator addHost / updateHost / removeHost", () => {
  it("addHost appends", () => {
    const cfg = emptyConfig();
    const h = applyTemplate("basic-server");
    const next = addHost(cfg, h);
    expect(next.hosts).toHaveLength(1);
  });
  it("updateHost patches a host", () => {
    const h = applyTemplate("basic-server");
    const cfg = { hosts: [h], includes: [], matches: [] };
    const next = updateHost(cfg, h.id, { user: "root" });
    expect(next.hosts[0].user).toBe("root");
  });
  it("removeHost removes by id", () => {
    const h = applyTemplate("basic-server");
    const cfg = { hosts: [h], includes: [], matches: [] };
    const next = removeHost(cfg, h.id);
    expect(next.hosts).toHaveLength(0);
  });
  it("updateHost is immutable (returns new array)", () => {
    const h = applyTemplate("basic-server");
    const cfg = { hosts: [h], includes: [], matches: [] };
    const next = updateHost(cfg, h.id, { user: "root" });
    expect(cfg.hosts[0].user).toBe("ubuntu");
    expect(next.hosts).not.toBe(cfg.hosts);
  });
});

describe("ssh-config-generator moveHost", () => {
  it("moves host up", () => {
    const h1 = applyTemplate("basic-server");
    const h2 = applyTemplate("github");
    const cfg = { hosts: [h1, h2], includes: [], matches: [] };
    const next = moveHost(cfg, h2.id, "up");
    expect(next.hosts[0].id).toBe(h2.id);
  });
  it("refuses to move beyond bounds", () => {
    const h1 = applyTemplate("basic-server");
    const cfg = { hosts: [h1], includes: [], matches: [] };
    const next = moveHost(cfg, h1.id, "up");
    expect(next.hosts[0].id).toBe(h1.id);
  });
});

describe("ssh-config-generator dedupeHosts", () => {
  it("removes duplicates by alias", () => {
    const h1 = applyTemplate("basic-server"); // alias "prod"
    const h2 = applyTemplate("basic-server"); // alias "prod" (duplicate)
    const cfg = { hosts: [h1, h2], includes: [], matches: [] };
    const next = dedupeHosts(cfg);
    expect(next.hosts).toHaveLength(1);
  });
});

describe("ssh-config-generator bulkAddFromJson", () => {
  it("adds hosts from JSON array", () => {
    const json = JSON.stringify([
      { alias: "h1", hostName: "h1.example.com", user: "u" },
      { alias: "h2", hostName: "h2.example.com", user: "u" },
    ]);
    const cfg = bulkAddFromJson(emptyConfig(), json);
    expect(cfg.hosts).toHaveLength(2);
    expect(cfg.hosts[0].alias).toBe("h1");
  });
  it("throws on invalid JSON", () => {
    expect(() => bulkAddFromJson(emptyConfig(), "not json")).toThrow();
  });
  it("throws on non-array JSON", () => {
    expect(() => bulkAddFromJson(emptyConfig(), "{}")).toThrow();
  });
});

describe("ssh-config-generator computeStats", () => {
  it("computes host/wildcard/jump counts", () => {
    const h1 = applyTemplate("basic-server");
    const h2 = applyTemplate("jump-host");
    const h3 = applyTemplate("wildcard");
    const cfg = { hosts: [h1, h2, h3], includes: [], matches: [] };
    const s = computeStats(cfg);
    expect(s.hostCount).toBe(3);
    expect(s.wildcardHosts).toBe(2); // jump-host has alias "internal-*", wildcard has "10.0.*"
    expect(s.jumpHosts).toBe(1);
  });
  it("includes warning and critical counts", () => {
    const h = applyTemplate("basic-server");
    h.strictHostKeyChecking = "no";
    const cfg = { hosts: [h], includes: [], matches: [] };
    const s = computeStats(cfg);
    expect(s.criticalCount).toBeGreaterThanOrEqual(1);
    expect(s.warningCount).toBeGreaterThanOrEqual(1);
  });
});

describe("ssh-config-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, hostCount: 3, warningCount: 0, aliases: ["a", "b"] });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, hostCount: 1, warningCount: 0, aliases: ["x"] });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, hostCount: 1, warningCount: 0, aliases: ["x"] });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ssh-config-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const cfg: SshConfig = {
      hosts: [applyTemplate("basic-server")],
      includes: [],
      matches: [],
    };
    const url = buildShareUrl(cfg);
    expect(url).toContain("?c=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to config with hosts", () => {
    const cfg: SshConfig = {
      hosts: [applyTemplate("basic-server")],
      includes: [{ id: "i1", path: "~/.ssh/config.d/*", enabled: true }],
      matches: [],
    };
    const url = buildShareUrl(cfg);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.slice(url.indexOf("?") + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.hosts).toHaveLength(1);
    expect(parsed.hosts[0].alias).toBe("prod");
    expect(parsed.includes).toHaveLength(1);
  });
  it("returns empty config for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.hosts).toEqual([]);
  });
  it("returns empty config for invalid payload", () => {
    const parsed = parseShareUrl("c=not-valid-json");
    expect(parsed.hosts).toEqual([]);
  });
});
