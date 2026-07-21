"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Server, Plus, Trash2, AlertTriangle, CheckCircle2,
  Terminal, Key, ArrowUp, ArrowDown, Upload, Settings2,
} from "lucide-react";
import {
  HOST_TEMPLATES,
  TEMPLATE_LABELS,
  LOG_LEVELS,
  STRICT_HOST_KEY_VALUES,
  applyTemplate,
  emptyHost,
  emptyConfig,
  validateHost,
  renderConfig,
  lintConfig,
  generateKeygenCommand,
  addHost,
  updateHost,
  removeHost,
  moveHost,
  dedupeHosts,
  bulkAddFromJson,
  computeStats,
  importConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SshHost,
  type SshConfig,
  type HostTemplateId,
  type PortForward,
  type PortForwardKind,
  type SecurityWarning,
  type HistoryEntry,
} from "./logic";

export default function SshConfigGenerator() {
  const [cfg, setCfg] = useState<SshConfig>(emptyConfig);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [bulkJson, setBulkJson] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.hosts.length > 0 || parsed.includes.length > 0) {
        setCfg(parsed);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const warnings = useMemo(() => lintConfig(cfg), [cfg]);
  const stats = useMemo(() => computeStats(cfg, warnings), [cfg, warnings]);
  const rendered = useMemo(() => renderConfig(cfg), [cfg]);

  const handleAddFromTemplate = useCallback((tplId: HostTemplateId) => {
    const h = applyTemplate(tplId);
    setCfg((prev) => addHost(prev, h));
    toast.success(`Added ${TEMPLATE_LABELS[tplId]} host`);
  }, []);

  const handleAddBlank = useCallback(() => {
    setCfg((prev) => addHost(prev, emptyHost()));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setCfg((prev) => removeHost(prev, id));
  }, []);

  const handleMove = useCallback((id: string, dir: "up" | "down") => {
    setCfg((prev) => moveHost(prev, id, dir));
  }, []);

  const handlePatch = useCallback((id: string, patch: Partial<SshHost>) => {
    setCfg((prev) => updateHost(prev, id, patch));
  }, []);

  const handleAddForward = useCallback((hostId: string) => {
    const fwd: PortForward = {
      id: `f-${Date.now().toString(36)}`,
      kind: "local",
      spec: "",
    };
    setCfg((prev) =>
      updateHost(prev, hostId, {
        forwards: [...(prev.hosts.find((h) => h.id === hostId)?.forwards ?? []), fwd],
      }),
    );
  }, []);

  const handlePatchForward = useCallback(
    (hostId: string, fwdId: string, patch: Partial<PortForward>) => {
      setCfg((prev) => {
        const host = prev.hosts.find((h) => h.id === hostId);
        if (!host) return prev;
        const nextForwards = host.forwards.map((f) =>
          f.id === fwdId ? { ...f, ...patch } : f,
        );
        return updateHost(prev, hostId, { forwards: nextForwards });
      });
    },
    [],
  );

  const handleRemoveForward = useCallback((hostId: string, fwdId: string) => {
    setCfg((prev) => {
      const host = prev.hosts.find((h) => h.id === hostId);
      if (!host) return prev;
      return updateHost(prev, hostId, {
        forwards: host.forwards.filter((f) => f.id !== fwdId),
      });
    });
  }, []);

  const handleImport = useCallback(() => {
    try {
      const imported = importConfig(importText);
      setCfg(imported);
      setShowImport(false);
      setImportText("");
      toast.success(`Imported ${imported.hosts.length} host(s)`);
    } catch {
      toast.error("Could not parse config");
    }
  }, [importText]);

  const handleBulkAdd = useCallback(() => {
    try {
      setCfg((prev) => bulkAddFromJson(prev, bulkJson));
      setShowBulk(false);
      setBulkJson("");
      toast.success("Bulk-added hosts");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [bulkJson]);

  const handleDedupe = useCallback(() => {
    setCfg((prev) => {
      const next = dedupeHosts(prev);
      const removed = prev.hosts.length - next.hosts.length;
      if (removed > 0) toast.success(`Removed ${removed} duplicate(s)`);
      else toast.info("No duplicates found");
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setCfg(emptyConfig());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (cfg.hosts.length > 0) {
      saveHistory({
        ts: Date.now(),
        hostCount: cfg.hosts.length,
        warningCount: warnings.length,
        aliases: cfg.hosts.map((h) => h.alias).filter(Boolean),
      });
      setHistory(loadHistory());
    }
  }, [cfg, warnings]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Server className="h-4 w-4" /> Templates
            </h3>
            <div className="flex flex-wrap gap-2">
              {HOST_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddFromTemplate(t.id)}
                  title={t.description}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> {t.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={handleAddBlank} className="gap-1">
                <Plus className="h-3 w-3" /> Blank host
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowImport((v) => !v)} className="gap-1">
              <Upload className="h-3 w-3" /> Import config
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowBulk((v) => !v)} className="gap-1">
              <Settings2 className="h-3 w-3" /> Bulk add (JSON)
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDedupe}>
              Dedupe
            </Button>
          </div>
          {showImport && (
            <div className="space-y-2 rounded border p-3 bg-muted/30">
              <Label htmlFor="ssh-import" className="text-xs">Paste existing ~/.ssh/config</Label>
              <Textarea
                id="ssh-import"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"Host prod\n  HostName server.example.com\n  User ubuntu\n  Port 22"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleImport}>Import</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {showBulk && (
            <div className="space-y-2 rounded border p-3 bg-muted/30">
              <Label htmlFor="ssh-bulk" className="text-xs">JSON array of hosts (alias, hostName, user, port, identityFile, proxyJump, description)</Label>
              <Textarea
                id="ssh-bulk"
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                placeholder={'[{"alias":"h1","hostName":"h1.example.com","user":"u"}]'}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleBulkAdd}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {cfg.hosts.length === 0 ? (
        <EmptyState
          title="No hosts yet"
          hint="Pick a template above (basic server, jump host, GitHub, AWS EC2, wildcard) or add a blank host to begin."
          icon={<Server className="h-8 w-8" />}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Hosts" value={stats.hostCount} />
                <Stat label="Wildcards" value={stats.wildcardHosts} />
                <Stat label="Jump hosts" value={stats.jumpHosts} />
                <Stat label="Forwards" value={stats.forwardCount} />
              </div>
              {(warnings.length > 0) && (
                <div className="space-y-1 pt-2">
                  {warnings.slice(0, 8).map((w, i) => (
                    <WarningRow key={i} w={w} />
                  ))}
                  {warnings.length > 8 && (
                    <div className="text-xs text-muted-foreground">+ {warnings.length - 8} more warning(s)</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {cfg.hosts.map((h, idx) => (
              <HostCard
                key={h.id}
                host={h}
                warnings={warnings.filter((w) => w.hostId === h.id)}
                canMoveUp={idx > 0}
                canMoveDown={idx < cfg.hosts.length - 1}
                onPatch={handlePatch}
                onRemove={handleRemove}
                onMove={handleMove}
                onAddForward={handleAddForward}
                onPatchForward={handlePatchForward}
                onRemoveForward={handleRemoveForward}
              />
            ))}
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> ~/.ssh/config preview
              </h3>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[480px] whitespace-pre">
{rendered}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  label="Copy config"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  filename="ssh_config"
                  mime="text/plain"
                  label="Download"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(cfg); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.hostCount} hosts</Badge>
                  {h.warningCount > 0 && (
                    <Badge variant="outline" className="mr-2 text-amber-600">{h.warningCount} warnings</Badge>
                  )}
                  <span className="text-muted-foreground">{h.aliases.join(", ") || "(no hosts)"}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All config generation runs locally in your browser. This tool never handles your private keys — generate them yourself with the per-host `ssh-keygen` command. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HostCard({
  host,
  warnings,
  canMoveUp,
  canMoveDown,
  onPatch,
  onRemove,
  onMove,
  onAddForward,
  onPatchForward,
  onRemoveForward,
}: {
  host: SshHost;
  warnings: SecurityWarning[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (id: string, patch: Partial<SshHost>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onAddForward: (id: string) => void;
  onPatchForward: (hostId: string, fwdId: string, patch: Partial<PortForward>) => void;
  onRemoveForward: (hostId: string, fwdId: string) => void;
}) {
  const v = useMemo(() => validateHost(host), [host]);
  const keygen = useMemo(() => generateKeygenCommand(host), [host]);
  const patch = (p: Partial<SshHost>) => onPatch(host.id, p);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={host.enabled ? "default" : "secondary"} className="text-[10px]">
              {host.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <span className="text-sm font-mono font-semibold text-foreground">
              {host.alias || "(unnamed)"}
            </span>
            {host.proxyJump && (
              <Badge variant="outline" className="text-[10px]">ProxyJump: {host.proxyJump}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={!canMoveUp} onClick={() => onMove(host.id, "up")} title="Move up (first-match-wins)">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={!canMoveDown} onClick={() => onMove(host.id, "down")} title="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => patch({ enabled: !host.enabled })} title={host.enabled ? "Disable" : "Enable"}>
              {host.enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 opacity-30" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onRemove(host.id)} title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => <WarningRow key={i} w={w} />)}
          </div>
        )}
        {v.errors.length > 0 && (
          <div className="text-xs text-red-600 dark:text-red-400">
            {v.errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <Field label="Host alias (patterns, space-separated)">
            <Input value={host.alias} onChange={(e) => patch({ alias: e.target.value })} className="h-8 font-mono text-xs" placeholder="prod" />
          </Field>
          <Field label="Description (comment)">
            <Input value={host.description ?? ""} onChange={(e) => patch({ description: e.target.value })} className="h-8 text-xs" placeholder="Production server" />
          </Field>
          <Field label="HostName">
            <Input value={host.hostName ?? ""} onChange={(e) => patch({ hostName: e.target.value })} className="h-8 font-mono text-xs" placeholder="server.example.com" />
          </Field>
          <Field label="User">
            <Input value={host.user ?? ""} onChange={(e) => patch({ user: e.target.value })} className="h-8 font-mono text-xs" placeholder="ubuntu" />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={host.port ?? ""}
              onChange={(e) => patch({ port: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="h-8 font-mono text-xs"
              placeholder="22"
            />
          </Field>
          <Field label="IdentityFile">
            <Input value={host.identityFile ?? ""} onChange={(e) => patch({ identityFile: e.target.value })} className="h-8 font-mono text-xs" placeholder="~/.ssh/id_ed25519" />
          </Field>
          <Field label="ProxyJump (bastion chain)">
            <Input value={host.proxyJump ?? ""} onChange={(e) => patch({ proxyJump: e.target.value })} className="h-8 font-mono text-xs" placeholder="bastion" />
          </Field>
          <Field label="StrictHostKeyChecking">
            <select
              value={host.strictHostKeyChecking ?? ""}
              onChange={(e) => patch({ strictHostKeyChecking: (e.target.value || undefined) as SshHost["strictHostKeyChecking"] })}
              className="h-8 w-full text-xs rounded border bg-background px-2"
            >
              <option value="">(inherit)</option>
              {STRICT_HOST_KEY_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="ServerAliveInterval (s)">
            <Input
              type="number"
              value={host.serverAliveInterval ?? ""}
              onChange={(e) => patch({ serverAliveInterval: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="h-8 font-mono text-xs"
              placeholder="60"
            />
          </Field>
          <Field label="ServerAliveCountMax">
            <Input
              type="number"
              value={host.serverAliveCountMax ?? ""}
              onChange={(e) => patch({ serverAliveCountMax: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="h-8 font-mono text-xs"
              placeholder="3"
            />
          </Field>
          <Field label="LogLevel">
            <select
              value={host.logLevel ?? ""}
              onChange={(e) => patch({ logLevel: (e.target.value || undefined) as SshHost["logLevel"] })}
              className="h-8 w-full text-xs rounded border bg-background px-2"
            >
              <option value="">(inherit)</option>
              {LOG_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="ControlPath (optional)">
            <Input value={host.controlPath ?? ""} onChange={(e) => patch({ controlPath: e.target.value })} className="h-8 font-mono text-xs" placeholder="~/.ssh/cm-%r@%h:%p" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!host.identitiesOnly} onChange={(e) => patch({ identitiesOnly: e.target.checked })} />
            IdentitiesOnly
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!host.forwardAgent} onChange={(e) => patch({ forwardAgent: e.target.checked })} />
            ForwardAgent
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!host.compression} onChange={(e) => patch({ compression: e.target.checked })} />
            Compression
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!host.controlMaster} onChange={(e) => patch({ controlMaster: e.target.checked })} />
            ControlMaster
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!host.addKeysToAgent} onChange={(e) => patch({ addKeysToAgent: e.target.checked })} />
            AddKeysToAgent
          </label>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Port forwards</Label>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => onAddForward(host.id)}>+ Add forward</Button>
          </div>
          {host.forwards.length === 0 ? (
            <div className="text-xs text-muted-foreground">No forwards configured.</div>
          ) : (
            host.forwards.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs">
                <select
                  value={f.kind}
                  onChange={(e) => onPatchForward(host.id, f.id, { kind: e.target.value as PortForwardKind })}
                  className="h-7 text-xs rounded border bg-background px-1"
                >
                  <option value="local">Local (-L)</option>
                  <option value="remote">Remote (-R)</option>
                  <option value="dynamic">Dynamic (-D)</option>
                </select>
                <Input
                  value={f.spec}
                  onChange={(e) => onPatchForward(host.id, f.id, { spec: e.target.value })}
                  className="h-7 font-mono text-xs flex-1"
                  placeholder={f.kind === "dynamic" ? "1080" : "8080:example.com:80"}
                />
                <Button variant="ghost" size="icon-sm" onClick={() => onRemoveForward(host.id, f.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="rounded border bg-muted/30 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] flex items-center gap-1"><Key className="h-3 w-3" /> Keygen command</Label>
            <CopyButton getText={() => keygen} label="Copy" size="icon-sm" />
          </div>
          <code className="text-[11px] font-mono text-foreground break-all">{keygen}</code>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function WarningRow({ w }: { w: SecurityWarning }) {
  const color =
    w.severity === "critical"
      ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400"
      : w.severity === "warn"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
        : "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-400";
  return (
    <div className={`rounded border px-2 py-1 text-[11px] ${color}`}>
      <AlertTriangle className="inline h-3 w-3 mr-1" />
      <span className="font-mono">[{w.hostAlias}]</span> {w.message}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
