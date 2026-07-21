/**
 * SSH Config Generator — pure logic.
 *
 * Build ~/.ssh/config host entries (Host, HostName, User, Port,
 * IdentityFile, ProxyJump, ForwardAgent, ServerAlive, port forwards,
 * wildcards, Match, Include) from templates, lint for security issues,
 * and emit a clean config file. Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HostTemplateId =
  | "basic-server"
  | "jump-host"
  | "github"
  | "aws-ec2"
  | "wildcard";

export type PortForwardKind = "local" | "remote" | "dynamic";

export interface PortForward {
  id: string;
  kind: PortForwardKind;
  /** For local/remote: `bind_port:host:host_port` (or `bind_addr:bind_port:host:host_port`).
   *  For dynamic: `bind_port` (or `bind_addr:bind_port`). */
  spec: string;
}

export type StrictHostKey = "yes" | "no" | "accept-new";

export type LogLevel =
  | "QUIET" | "FATAL" | "ERROR" | "INFO"
  | "VERBOSE" | "DEBUG" | "DEBUG1" | "DEBUG2" | "DEBUG3";

export interface SshHost {
  id: string;
  /** Host directive pattern(s), space-separated (e.g. `prod` or `10.0.* *.lan`). */
  alias: string;
  hostName?: string;
  user?: string;
  port?: number;
  identityFile?: string;
  identitiesOnly?: boolean;
  proxyJump?: string;
  forwardAgent?: boolean;
  compression?: boolean;
  serverAliveInterval?: number;
  serverAliveCountMax?: number;
  strictHostKeyChecking?: StrictHostKey;
  userKnownHostsFile?: string;
  addKeysToAgent?: boolean;
  controlMaster?: boolean;
  controlPath?: string;
  controlPersist?: string;
  logLevel?: LogLevel;
  forwards: PortForward[];
  description?: string;
  enabled: boolean;
}

export interface IncludeEntry {
  id: string;
  path: string;
  enabled: boolean;
}

export interface MatchBlock {
  id: string;
  /** Full conditions string after `Match`, e.g. `host *.example.com exec "uname | grep -q Linux"`. */
  conditions: string;
  /** Raw option lines (one per line) for the body of the Match block. */
  body: string;
  enabled: boolean;
}

export interface SshConfig {
  hosts: SshHost[];
  includes: IncludeEntry[];
  matches: MatchBlock[];
}

export type WarningSeverity = "critical" | "warn" | "info";

export interface SecurityWarning {
  hostId: string;
  hostAlias: string;
  severity: WarningSeverity;
  rule: string;
  message: string;
}

export interface ConfigStats {
  hostCount: number;
  enabledHosts: number;
  wildcardHosts: number;
  jumpHosts: number;
  forwardCount: number;
  warningCount: number;
  criticalCount: number;
  includeCount: number;
  matchCount: number;
}

export interface HostTemplate {
  id: HostTemplateId;
  label: string;
  description: string;
  build: () => SshHost;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HOST_TEMPLATES: HostTemplate[] = [
  {
    id: "basic-server",
    label: "Basic server",
    description: "Plain SSH to a single server with an ed25519 key.",
    build: () => ({
      id: makeId("h"),
      alias: "prod",
      hostName: "server.example.com",
      user: "ubuntu",
      port: 22,
      identityFile: "~/.ssh/id_ed25519",
      identitiesOnly: true,
      serverAliveInterval: 60,
      serverAliveCountMax: 3,
      compression: false,
      forwardAgent: false,
      forwards: [],
      enabled: true,
      description: "Production server",
    }),
  },
  {
    id: "jump-host",
    label: "Jump host / bastion",
    description: "Internal host reached through a bastion via ProxyJump.",
    build: () => ({
      id: makeId("h"),
      alias: "internal-*",
      hostName: "%h.internal.example.com",
      user: "ubuntu",
      port: 22,
      identityFile: "~/.ssh/id_ed25519",
      identitiesOnly: true,
      proxyJump: "bastion",
      serverAliveInterval: 60,
      forwards: [],
      enabled: true,
      description: "Internal hosts through bastion",
    }),
  },
  {
    id: "github",
    label: "GitHub",
    description: "GitHub.com over SSH with a dedicated deploy key.",
    build: () => ({
      id: makeId("h"),
      alias: "github.com",
      hostName: "github.com",
      user: "git",
      port: 22,
      identityFile: "~/.ssh/github_ed25519",
      identitiesOnly: true,
      forwards: [],
      enabled: true,
      description: "GitHub.com",
    }),
  },
  {
    id: "aws-ec2",
    label: "AWS EC2",
    description: "EC2 instance with the default Amazon Linux user and a .pem key.",
    build: () => ({
      id: makeId("h"),
      alias: "aws-prod",
      hostName: "ec2-1-2-3-4.compute-1.amazonaws.com",
      user: "ec2-user",
      port: 22,
      identityFile: "~/.ssh/aws-prod.pem",
      identitiesOnly: true,
      serverAliveInterval: 60,
      forwards: [],
      enabled: true,
      description: "AWS EC2 instance",
    }),
  },
  {
    id: "wildcard",
    label: "Wildcard / Match",
    description: "Catch-all Host pattern for a private network range.",
    build: () => ({
      id: makeId("h"),
      alias: "10.0.*",
      user: "admin",
      port: 22,
      strictHostKeyChecking: "accept-new",
      forwards: [],
      enabled: true,
      description: "Private 10.0.0.0/8 network",
    }),
  },
];

export const TEMPLATE_LABELS: Record<HostTemplateId, string> = {
  "basic-server": "Basic server",
  "jump-host": "Jump host / bastion",
  "github": "GitHub",
  "aws-ec2": "AWS EC2",
  "wildcard": "Wildcard / Match",
};

export const LOG_LEVELS: LogLevel[] = [
  "QUIET", "FATAL", "ERROR", "INFO",
  "VERBOSE", "DEBUG", "DEBUG1", "DEBUG2", "DEBUG3",
];

export const STRICT_HOST_KEY_VALUES: StrictHostKey[] = ["yes", "no", "accept-new"];

// ---------------------------------------------------------------------------
// ID + factory
// ---------------------------------------------------------------------------

let _idCounter = 0;

export function makeId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

export function emptyHost(): SshHost {
  return {
    id: makeId("h"),
    alias: "",
    user: "",
    port: 22,
    identityFile: "",
    identitiesOnly: true,
    forwards: [],
    enabled: true,
  };
}

export function emptyConfig(): SshConfig {
  return { hosts: [], includes: [], matches: [] };
}

export function applyTemplate(templateId: HostTemplateId): SshHost {
  const tpl = HOST_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);
  return tpl.build();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface HostValidation {
  errors: string[];
  warnings: string[];
}

export function validateHost(host: SshHost): HostValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!host.alias || !host.alias.trim()) {
    errors.push("Host alias is required.");
  } else {
    // alias may contain spaces (multiple patterns) but each pattern must be non-empty
    const parts = host.alias.trim().split(/\s+/);
    if (parts.some((p) => !p)) errors.push("Host alias has empty pattern.");
    if (parts.some((p) => /[<>]/.test(p))) errors.push("Host alias contains invalid characters.");
  }
  if (host.port !== undefined) {
    if (!Number.isInteger(host.port) || host.port < 1 || host.port > 65535) {
      errors.push("Port must be an integer between 1 and 65535.");
    }
  }
  if (host.serverAliveInterval !== undefined && host.serverAliveInterval < 0) {
    warnings.push("ServerAliveInterval should be non-negative.");
  }
  if (host.serverAliveCountMax !== undefined && host.serverAliveCountMax < 0) {
    warnings.push("ServerAliveCountMax should be non-negative.");
  }
  if (host.identityFile && !host.identitiesOnly) {
    warnings.push("IdentityFile set without IdentitiesOnly yes — SSH may offer all your keys.");
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function indent2(s: string): string {
  return `    ${s}`;
}

function renderForward(fwd: PortForward): string | null {
  const spec = (fwd.spec || "").trim();
  if (!spec) return null;
  const key =
    fwd.kind === "local" ? "LocalForward" :
    fwd.kind === "remote" ? "RemoteForward" :
    "DynamicForward";
  // LocalForward/RemoteForward expect two args: [bind:]port host:hostport
  // DynamicForward expects one: [bind:]port
  if (fwd.kind === "dynamic") {
    return `${key} ${spec}`;
  }
  // For local/remote, if spec already contains a space (already two args), keep as-is
  if (/\s/.test(spec)) return `${key} ${spec}`;
  // Otherwise expect format `bind:host:port` — split into two args
  const parts = spec.split(":");
  if (parts.length < 3) {
    // Not enough parts for local/remote — emit as-is and let linter flag it
    return `${key} ${spec}`;
  }
  // [bind_addr:]bind_port host:port
  const lastIndex = parts.length - 1;
  const host = parts[lastIndex - 1];
  const hostPort = parts[lastIndex];
  const bind = parts.slice(0, lastIndex - 1).join(":");
  const bindArg = bind || hostPort; // if no bind given, use port as bind
  const portArg = bind ? `${host}:${hostPort}` : `${host}:${hostPort}`;
  return `${key} ${bind.includes(":") ? bind : bindArg} ${portArg}`;
}

export function renderHost(host: SshHost): string {
  const lines: string[] = [];
  if (!host.enabled) return `# (disabled) Host ${host.alias}`;
  const alias = (host.alias || "").trim() || "(unnamed)";
  if (host.description) lines.push(`# ${host.description}`);
  // Connect-hint comment: pick the first alias token
  const firstAlias = alias.split(/\s+/)[0];
  lines.push(`# ssh ${firstAlias}`);
  lines.push(`Host ${alias}`);
  if (host.hostName) lines.push(indent2(`HostName ${host.hostName}`));
  if (host.user) lines.push(indent2(`User ${host.user}`));
  if (host.port !== undefined) lines.push(indent2(`Port ${host.port}`));
  if (host.identityFile) lines.push(indent2(`IdentityFile ${host.identityFile}`));
  if (host.identitiesOnly !== undefined) {
    lines.push(indent2(`IdentitiesOnly ${host.identitiesOnly ? "yes" : "no"}`));
  }
  if (host.proxyJump) lines.push(indent2(`ProxyJump ${host.proxyJump}`));
  if (host.forwardAgent !== undefined) {
    lines.push(indent2(`ForwardAgent ${host.forwardAgent ? "yes" : "no"}`));
  }
  if (host.compression !== undefined) {
    lines.push(indent2(`Compression ${host.compression ? "yes" : "no"}`));
  }
  if (host.serverAliveInterval !== undefined) {
    lines.push(indent2(`ServerAliveInterval ${host.serverAliveInterval}`));
  }
  if (host.serverAliveCountMax !== undefined) {
    lines.push(indent2(`ServerAliveCountMax ${host.serverAliveCountMax}`));
  }
  if (host.strictHostKeyChecking) {
    lines.push(indent2(`StrictHostKeyChecking ${host.strictHostKeyChecking}`));
  }
  if (host.userKnownHostsFile) {
    lines.push(indent2(`UserKnownHostsFile ${host.userKnownHostsFile}`));
  }
  if (host.addKeysToAgent !== undefined) {
    lines.push(indent2(`AddKeysToAgent ${host.addKeysToAgent ? "yes" : "no"}`));
  }
  if (host.controlMaster !== undefined) {
    lines.push(indent2(`ControlMaster ${host.controlMaster ? "auto" : "no"}`));
  }
  if (host.controlPath) lines.push(indent2(`ControlPath ${host.controlPath}`));
  if (host.controlPersist) lines.push(indent2(`ControlPersist ${host.controlPersist}`));
  if (host.logLevel) lines.push(indent2(`LogLevel ${host.logLevel}`));
  for (const fwd of host.forwards) {
    const rendered = renderForward(fwd);
    if (rendered) lines.push(indent2(rendered));
  }
  return lines.join("\n");
}

export function renderInclude(inc: IncludeEntry): string {
  if (!inc.enabled) return `# (disabled) Include ${inc.path}`;
  return `Include ${inc.path}`;
}

export function renderMatch(m: MatchBlock): string {
  const head = m.enabled ? `Match ${m.conditions}` : `# (disabled) Match ${m.conditions}`;
  const body = (m.body || "").trim();
  if (!body) return head;
  const indented = body.split("\n").map(indent2).join("\n");
  return `${head}\n${indented}`;
}

export function renderConfig(cfg: SshConfig): string {
  const blocks: string[] = [];
  blocks.push("# ~/.ssh/config — generated by UnQTools SSH Config Generator");
  blocks.push("# First-match-wins: put specific hosts above wildcards.");
  blocks.push("");
  for (const h of cfg.hosts) {
    blocks.push(renderHost(h));
    blocks.push("");
  }
  if (cfg.includes.length > 0) {
    blocks.push("# --- Include directives ---");
    for (const inc of cfg.includes) {
      blocks.push(renderInclude(inc));
    }
    blocks.push("");
  }
  if (cfg.matches.length > 0) {
    blocks.push("# --- Match blocks ---");
    for (const m of cfg.matches) {
      blocks.push(renderMatch(m));
      blocks.push("");
    }
  }
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// Parser (import existing ~/.ssh/config)
// ---------------------------------------------------------------------------

interface ParsedHost {
  alias: string;
  options: Record<string, string>;
  description?: string;
}

interface ParsedMatch {
  conditions: string;
  body: string[];
}

interface ParsedInclude {
  path: string;
}

export interface ParsedConfig {
  hosts: ParsedHost[];
  matches: ParsedMatch[];
  includes: ParsedInclude[];
}

/** Parse an existing ~/.ssh/config into structured form. */
export function parseConfig(text: string): ParsedConfig {
  const result: ParsedConfig = { hosts: [], matches: [], includes: [] };
  const lines = text.replace(/\r/g, "").split("\n");
  let currentHost: ParsedHost | null = null;
  let currentDescription: string | null = null;
  let currentMatch: ParsedMatch | null = null;
  const flushMatch = () => {
    if (currentMatch) {
      currentMatch.body = currentMatch.body.join("\n").trim();
      result.matches.push(currentMatch);
      currentMatch = null;
    }
  };
  const flushHost = () => {
    if (currentHost) {
      if (currentDescription) currentHost.description = currentDescription;
      result.hosts.push(currentHost);
      currentHost = null;
    }
    currentDescription = null;
  };
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) { continue; }
    if (line.startsWith("#")) {
      // description comment immediately above a Host block
      const desc = line.replace(/^#\s?/, "");
      if (!currentHost && !currentMatch) currentDescription = desc;
      continue;
    }
    // Match blocks start a new context
    const matchMatch = /^match\s+(.+)$/i.exec(line);
    if (matchMatch) {
      flushHost();
      flushMatch();
      currentMatch = { conditions: matchMatch[1].trim(), body: [] };
      continue;
    }
    const tokens = line.split(/\s+/);
    const key = tokens[0];
    const value = tokens.slice(1).join(" ").trim();
    if (key.toLowerCase() === "host") {
      flushHost();
      flushMatch();
      currentHost = { alias: value, options: {} };
      continue;
    }
    if (key.toLowerCase() === "include") {
      flushHost();
      flushMatch();
      result.includes.push({ path: value });
      continue;
    }
    if (currentMatch) {
      currentMatch.body.push(line);
      continue;
    }
    if (currentHost) {
      currentHost.options[key] = value;
    }
  }
  flushHost();
  flushMatch();
  return result;
}

/** Convert a parsed config into a fully editable SshConfig (import path). */
export function importConfig(text: string): SshConfig {
  const parsed = parseConfig(text);
  const hosts: SshHost[] = parsed.hosts.map((p) => parsedHostToSshHost(p));
  const includes: IncludeEntry[] = parsed.includes.map((p) => ({
    id: makeId("i"),
    path: p.path,
    enabled: true,
  }));
  const matches: MatchBlock[] = parsed.matches.map((p) => ({
    id: makeId("m"),
    conditions: p.conditions,
    body: p.body,
    enabled: true,
  }));
  return { hosts, includes, matches };
}

function parsedHostToSshHost(p: ParsedHost): SshHost {
  const opts = p.options;
  const forwards: PortForward[] = [];
  // Capture forwards from options by scanning known keys
  const forwardKeys: Record<string, PortForwardKind> = {
    LocalForward: "local",
    RemoteForward: "remote",
    DynamicForward: "dynamic",
  };
  // Multiple forwards possible — re-scan raw options isn't supported by record;
  // we accept only one of each here (a known simplification).
  for (const [k, kind] of Object.entries(forwardKeys)) {
    const v = opts[k];
    if (v) {
      forwards.push({ id: makeId("f"), kind, spec: v });
      delete opts[k];
    }
  }
  const portNum = opts.Port ? parseInt(opts.Port, 10) : undefined;
  const intervalNum = opts.ServerAliveInterval ? parseInt(opts.ServerAliveInterval, 10) : undefined;
  const countNum = opts.ServerAliveCountMax ? parseInt(opts.ServerAliveCountMax, 10) : undefined;
  return {
    id: makeId("h"),
    alias: p.alias,
    hostName: opts.HostName,
    user: opts.User,
    port: Number.isFinite(portNum) ? portNum : undefined,
    identityFile: opts.IdentityFile,
    identitiesOnly: opts.IdentitiesOnly === "yes" ? true : opts.IdentitiesOnly === "no" ? false : undefined,
    proxyJump: opts.ProxyJump,
    forwardAgent: opts.ForwardAgent === "yes" ? true : opts.ForwardAgent === "no" ? false : undefined,
    compression: opts.Compression === "yes" ? true : opts.Compression === "no" ? false : undefined,
    serverAliveInterval: Number.isFinite(intervalNum) ? intervalNum : undefined,
    serverAliveCountMax: Number.isFinite(countNum) ? countNum : undefined,
    strictHostKeyChecking:
      opts.StrictHostKeyChecking === "yes" || opts.StrictHostKeyChecking === "no" || opts.StrictHostKeyChecking === "accept-new"
        ? opts.StrictHostKeyChecking
        : undefined,
    userKnownHostsFile: opts.UserKnownHostsFile,
    addKeysToAgent: opts.AddKeysToAgent === "yes" ? true : opts.AddKeysToAgent === "no" ? false : undefined,
    controlMaster: opts.ControlMaster === "auto" ? true : opts.ControlMaster === "no" ? false : undefined,
    controlPath: opts.ControlPath,
    controlPersist: opts.ControlPersist,
    logLevel: LOG_LEVELS.includes(opts.LogLevel as LogLevel) ? (opts.LogLevel as LogLevel) : undefined,
    forwards,
    description: p.description,
    enabled: true,
  };
}

// ---------------------------------------------------------------------------
// Security linter
// ---------------------------------------------------------------------------

export function lintConfig(cfg: SshConfig): SecurityWarning[] {
  const out: SecurityWarning[] = [];
  for (const h of cfg.hosts) {
    if (!h.enabled) continue;
    const alias = h.alias || "(unnamed)";
    // Rule 1: StrictHostKeyChecking no
    if (h.strictHostKeyChecking === "no") {
      out.push({
        hostId: h.id,
        hostAlias: alias,
        severity: "critical",
        rule: "strict-host-key-no",
        message: `StrictHostKeyChecking no on "${alias}" — susceptible to MITM. Use "accept-new" or "yes".`,
      });
    }
    // Rule 2: ForwardAgent yes on broad patterns
    if (h.forwardAgent) {
      const isBroad = h.alias.includes("*") || h.alias.trim() === "*";
      if (isBroad) {
        out.push({
          hostId: h.id,
          hostAlias: alias,
          severity: "warn",
          rule: "broad-forward-agent",
          message: `ForwardAgent yes on broad pattern "${alias}" — bastion compromise exfiltrates keys. Restrict to a specific host.`,
        });
      }
    }
    // Rule 3: IdentityFile set without IdentitiesOnly yes
    if (h.identityFile && !h.identitiesOnly) {
      out.push({
        hostId: h.id,
        hostAlias: alias,
        severity: "warn",
        rule: "missing-identities-only",
        message: `IdentityFile set on "${alias}" without IdentitiesOnly yes — SSH may offer all your loaded keys.`,
      });
    }
    // Rule 4: chmod 600 reminder for any new IdentityFile
    if (h.identityFile && !h.identityFile.endsWith(".pem")) {
      out.push({
        hostId: h.id,
        hostAlias: alias,
        severity: "info",
        rule: "chmod-600-reminder",
        message: `Remember: chmod 600 ${h.identityFile} && chmod 700 ~/.ssh`,
      });
    }
    // Rule 5: Host * with permissive options
    if (h.alias.trim() === "*" && (h.forwardAgent || h.strictHostKeyChecking === "no")) {
      out.push({
        hostId: h.id,
        hostAlias: alias,
        severity: "critical",
        rule: "wildcard-permissive",
        message: `Host * on "${alias}" with permissive options — affects every host. Avoid ForwardAgent / StrictHostKeyChecking no here.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Keygen helper
// ---------------------------------------------------------------------------

export function generateKeygenCommand(host: SshHost): string {
  const comment = host.user && host.hostName
    ? `${host.user}@${host.hostName}`
    : host.alias || "key";
  // Default to ed25519 unless path implies RSA (.pem from AWS still uses ed25519, but we honor .pem)
  const path = host.identityFile || `~/.ssh/${host.alias || "id"}_ed25519`;
  const algo = path.endsWith(".pem") ? "-t rsa -m PEM -b 2048" : "-t ed25519";
  return `ssh-keygen ${algo} -C "${comment}" -f ${path}`;
}

// ---------------------------------------------------------------------------
// Immutability helpers
// ---------------------------------------------------------------------------

export function addHost(cfg: SshConfig, host: SshHost): SshConfig {
  return { ...cfg, hosts: [...cfg.hosts, host] };
}

export function updateHost(cfg: SshConfig, id: string, patch: Partial<SshHost>): SshConfig {
  return {
    ...cfg,
    hosts: cfg.hosts.map((h) => (h.id === id ? { ...h, ...patch } : h)),
  };
}

export function removeHost(cfg: SshConfig, id: string): SshConfig {
  return { ...cfg, hosts: cfg.hosts.filter((h) => h.id !== id) };
}

export function moveHost(cfg: SshConfig, id: string, direction: "up" | "down"): SshConfig {
  const idx = cfg.hosts.findIndex((h) => h.id === id);
  if (idx < 0) return cfg;
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= cfg.hosts.length) return cfg;
  const next = [...cfg.hosts];
  const [item] = next.splice(idx, 1);
  next.splice(newIdx, 0, item);
  return { ...cfg, hosts: next };
}

export function dedupeHosts(cfg: SshConfig): SshConfig {
  const seen = new Set<string>();
  const hosts: SshHost[] = [];
  for (const h of cfg.hosts) {
    const key = (h.alias || "").trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hosts.push(h);
  }
  return { ...cfg, hosts };
}

// ---------------------------------------------------------------------------
// Bulk add (JSON)
// ---------------------------------------------------------------------------

export interface BulkHostInput {
  alias: string;
  hostName?: string;
  user?: string;
  port?: number;
  identityFile?: string;
  proxyJump?: string;
  description?: string;
}

export function bulkAddFromJson(cfg: SshConfig, json: string): SshConfig {
  let arr: BulkHostInput[];
  try {
    arr = JSON.parse(json) as BulkHostInput[];
    if (!Array.isArray(arr)) throw new Error("Expected array");
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  const newHosts: SshHost[] = arr.map((b) => ({
    id: makeId("h"),
    alias: b.alias,
    hostName: b.hostName,
    user: b.user,
    port: b.port,
    identityFile: b.identityFile,
    identitiesOnly: b.identityFile ? true : undefined,
    proxyJump: b.proxyJump,
    forwards: [],
    enabled: true,
    description: b.description,
  }));
  return { ...cfg, hosts: [...cfg.hosts, ...newHosts] };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(cfg: SshConfig, warnings?: SecurityWarning[]): ConfigStats {
  const hostCount = cfg.hosts.length;
  const enabledHosts = cfg.hosts.filter((h) => h.enabled).length;
  const wildcardHosts = cfg.hosts.filter((h) => h.alias.includes("*")).length;
  const jumpHosts = cfg.hosts.filter((h) => !!h.proxyJump).length;
  const forwardCount = cfg.hosts.reduce((sum, h) => sum + h.forwards.length, 0);
  const ws = warnings ?? lintConfig(cfg);
  return {
    hostCount,
    enabledHosts,
    wildcardHosts,
    jumpHosts,
    forwardCount,
    warningCount: ws.length,
    criticalCount: ws.filter((w) => w.severity === "critical").length,
    includeCount: cfg.includes.length,
    matchCount: cfg.matches.length,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:ssh-config-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  hostCount: number;
  warningCount: number;
  aliases: string[];
}

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

// ---------------------------------------------------------------------------
// Shareable URL — non-sensitive fields only (no IdentityFile content,
// no HostName secrets; alias/user/port/description only).
// ---------------------------------------------------------------------------

interface ShareableHost {
  a: string; // alias
  u?: string; // user
  p?: number; // port
  d?: string; // description
  pj?: string; // proxyJump (alias only)
}

export function buildShareUrl(cfg: SshConfig): string {
  const hosts: ShareableHost[] = cfg.hosts.filter((h) => h.enabled).map((h) => {
    const sh: ShareableHost = { a: h.alias };
    if (h.user) sh.u = h.user;
    if (h.port !== undefined) sh.p = h.port;
    if (h.description) sh.d = h.description;
    if (h.proxyJump) sh.pj = h.proxyJump;
    return sh;
  });
  const payload = { hosts, includes: cfg.includes.map((i) => i.path) };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  if (typeof window === "undefined") return `?c=${encoded}`;
  return `${window.location.origin}${window.location.pathname}#c=${encoded}`;
}

export function parseShareUrl(hash: string): SshConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return emptyConfig();
  const params = new URLSearchParams(clean);
  const raw = params.get("c");
  if (!raw) return emptyConfig();
  try {
    const payload = JSON.parse(decodeURIComponent(raw)) as {
      hosts: ShareableHost[];
      includes: string[];
    };
    const hosts: SshHost[] = (payload.hosts || []).map((sh) => ({
      id: makeId("h"),
      alias: sh.a,
      user: sh.u,
      port: sh.p,
      description: sh.d,
      proxyJump: sh.pj,
      forwards: [],
      enabled: true,
    }));
    const includes: IncludeEntry[] = (payload.includes || []).map((p) => ({
      id: makeId("i"),
      path: p,
      enabled: true,
    }));
    return { hosts, includes, matches: [] };
  } catch {
    return emptyConfig();
  }
}
