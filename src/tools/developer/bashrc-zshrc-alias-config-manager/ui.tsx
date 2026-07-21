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
  History, Terminal, Plus, Trash2, AlertTriangle, CheckCircle2, Code2,
  Upload, Wand2,
} from "lucide-react";
import {
  ALIAS_PRESETS,
  CATEGORY_LABELS,
  applyPreset,
  computeStats,
  emptyConfig,
  generateAliasesFile,
  generateBashrcSnippet,
  generateZshrcSnippet,
  loadHistory,
  makeId,
  mergeConfigs,
  parseExisting,
  parseShareUrl,
  saveHistory,
  clearHistory,
  buildShareUrl,
  validateAlias,
  detectShadowing,
  type AliasConfig,
  type AliasEntry,
  type AliasCategory,
  type FunctionEntry,
  type ExportEntry,
  type PathEntry,
  type Shell,
  type HistoryEntry,
} from "./logic";

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as AliasCategory[];

export default function BashrcZshrcAliasConfigManager() {
  const [cfg, setCfg] = useState<AliasConfig>(() => applyPreset(emptyConfig(), "git"));
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.aliases.length > 0 || parsed.functions.length > 0) {
        setCfg(parsed);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const stats = useMemo(() => computeStats(cfg), [cfg]);
  const shadowDups = useMemo(() => detectShadowing(cfg.aliases), [cfg.aliases]);
  const aliasesFile = useMemo(() => generateAliasesFile(cfg), [cfg]);
  const bashrcSnippet = useMemo(() => generateBashrcSnippet(), []);
  const zshrcSnippet = useMemo(() => generateZshrcSnippet(), []);

  const handleAddAlias = useCallback(() => {
    const entry: AliasEntry = {
      id: makeId("a"),
      name: "newalias",
      command: "echo hello",
      description: "",
      category: "misc",
      shells: [],
      enabled: true,
    };
    setCfg((prev) => ({ ...prev, aliases: [...prev.aliases, entry] }));
  }, []);

  const handleAddFunction = useCallback(() => {
    const entry: FunctionEntry = {
      id: makeId("fn"),
      name: "newfn",
      body: '  echo "$1"',
      description: "",
      enabled: true,
    };
    setCfg((prev) => ({ ...prev, functions: [...prev.functions, entry] }));
  }, []);

  const handleAddExport = useCallback(() => {
    const entry: ExportEntry = {
      id: makeId("x"),
      key: "NEW_VAR",
      value: "value",
      description: "",
      enabled: true,
    };
    setCfg((prev) => ({ ...prev, exports: [...prev.exports, entry] }));
  }, []);

  const handleAddPath = useCallback(() => {
    const entry: PathEntry = {
      id: makeId("p"),
      path: "/usr/local/bin",
      description: "",
      mode: "prepend",
      enabled: true,
    };
    setCfg((prev) => ({ ...prev, paths: [...prev.paths, entry] }));
  }, []);

  const updateAlias = useCallback((id: string, patch: Partial<AliasEntry>) => {
    setCfg((prev) => ({
      ...prev,
      aliases: prev.aliases.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const removeAlias = useCallback((id: string) => {
    setCfg((prev) => ({ ...prev, aliases: prev.aliases.filter((a) => a.id !== id) }));
  }, []);

  const updateFunction = useCallback((id: string, patch: Partial<FunctionEntry>) => {
    setCfg((prev) => ({
      ...prev,
      functions: prev.functions.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const removeFunction = useCallback((id: string) => {
    setCfg((prev) => ({ ...prev, functions: prev.functions.filter((f) => f.id !== id) }));
  }, []);

  const updateExport = useCallback((id: string, patch: Partial<ExportEntry>) => {
    setCfg((prev) => ({
      ...prev,
      exports: prev.exports.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const removeExport = useCallback((id: string) => {
    setCfg((prev) => ({ ...prev, exports: prev.exports.filter((e) => e.id !== id) }));
  }, []);

  const updatePath = useCallback((id: string, patch: Partial<PathEntry>) => {
    setCfg((prev) => ({
      ...prev,
      paths: prev.paths.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removePath = useCallback((id: string) => {
    setCfg((prev) => ({ ...prev, paths: prev.paths.filter((p) => p.id !== id) }));
  }, []);

  const handleApplyPreset = useCallback((presetId: AliasCategory) => {
    setCfg((prev) => applyPreset(prev, presetId));
    toast.success(`Preset applied: ${CATEGORY_LABELS[presetId]}`);
  }, []);

  const handleImport = useCallback(() => {
    if (!importText.trim()) {
      toast.error("Paste some rc file content first");
      return;
    }
    const parsed = parseExisting(importText);
    const added = parsed.aliases.length + parsed.functions.length + parsed.exports.length + parsed.paths.length;
    if (added === 0) {
      toast.error("Nothing recognized — check the format");
      return;
    }
    setCfg((prev) => mergeConfigs(prev, parsed));
    toast.success(`Imported ${added} entries`);
    setImportText("");
    setShowImport(false);
  }, [importText]);

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
    saveHistory({
      ts: Date.now(),
      totalAliases: cfg.aliases.length,
      totalFunctions: cfg.functions.length,
      totalExports: cfg.exports.length,
      totalPaths: cfg.paths.length,
    });
    setHistory(loadHistory());
  }, [cfg]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Starter packs
            </h3>
            <div className="flex flex-wrap gap-1">
              {ALIAS_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => handleApplyPreset(p.id)}
                  title={p.description}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAddAlias} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Alias</Button>
            <Button size="sm" variant="outline" onClick={handleAddFunction} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Function</Button>
            <Button size="sm" variant="outline" onClick={handleAddExport} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" variant="outline" onClick={handleAddPath} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> PATH</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport((s) => !s)} className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</Button>
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {showImport && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="bz-import" className="text-xs">Paste .bashrc / .zshrc / .aliases content</Label>
            <Textarea
              id="bz-import"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"alias gs='git status'\nexport EDITOR='vim'\nexport PATH=/usr/local/bin:$PATH"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleImport}>Import & merge</Button>
              <Button size="sm" variant="ghost" onClick={() => { setImportText(""); setShowImport(false); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(stats.totalAliases > 0 || stats.totalFunctions > 0 || stats.totalExports > 0 || stats.totalPaths > 0) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <Stat label="Aliases" value={stats.enabledAliases} sub={`/ ${stats.totalAliases}`} />
              <Stat label="Functions" value={stats.enabledFunctions} sub={`/ ${stats.totalFunctions}`} />
              <Stat label="Exports" value={stats.enabledExports} sub={`/ ${stats.totalExports}`} />
              <Stat label="PATH entries" value={stats.enabledPaths} sub={`/ ${stats.totalPaths}`} />
              <Stat label="Warnings" value={stats.warnings} highlight={stats.warnings > 0 ? "bad" : "good"} />
            </div>
            {shadowDups.length > 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Duplicate alias names:</strong> {shadowDups.map((d) => `${d.name} (×${d.count})`).join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {cfg.aliases.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Aliases ({cfg.aliases.length})
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-auto">
              {cfg.aliases.map((a) => {
                const warnings = validateAlias(a);
                const hasWarn = warnings.some((w) => w.severity === "warn" || w.severity === "error");
                return (
                  <div key={a.id} className="rounded border bg-background p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={a.name}
                        onChange={(e) => updateAlias(a.id, { name: e.target.value })}
                        className="h-7 text-xs font-mono flex-shrink-0 w-24"
                        placeholder="name"
                      />
                      <Input
                        value={a.command}
                        onChange={(e) => updateAlias(a.id, { command: e.target.value })}
                        className="h-7 text-xs font-mono flex-1"
                        placeholder="command"
                      />
                      <select
                        value={a.category}
                        onChange={(e) => updateAlias(a.id, { category: e.target.value as AliasCategory })}
                        className="h-7 text-xs rounded border bg-background px-1.5"
                      >
                        {CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                      </select>
                      <select
                        value={a.shells.join(",") || "both"}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateAlias(a.id, { shells: v === "both" ? [] : [v as Shell] });
                        }}
                        className="h-7 text-xs rounded border bg-background px-1.5"
                      >
                        <option value="both">both</option>
                        <option value="bash">bash</option>
                        <option value="zsh">zsh</option>
                      </select>
                      <input
                        type="checkbox"
                        checked={a.enabled}
                        onChange={(e) => updateAlias(a.id, { enabled: e.target.checked })}
                        title="enabled"
                      />
                      <Button size="icon-sm" variant="ghost" onClick={() => removeAlias(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={a.description ?? ""}
                        onChange={(e) => updateAlias(a.id, { description: e.target.value })}
                        className="h-7 text-xs flex-1"
                        placeholder="description (optional)"
                      />
                      {hasWarn ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                    {hasWarn && (
                      <div className="space-y-0.5">
                        {warnings.map((w, i) => (
                          <div
                            key={i}
                            className={`text-[10px] ${
                              w.severity === "error" ? "text-red-600 dark:text-red-400"
                                : w.severity === "warn" ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {w.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {cfg.functions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Functions ({cfg.functions.length})
            </h3>
            <div className="space-y-1.5">
              {cfg.functions.map((f) => (
                <div key={f.id} className="rounded border bg-background p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={f.name}
                      onChange={(e) => updateFunction(f.id, { name: e.target.value })}
                      className="h-7 text-xs font-mono w-32"
                      placeholder="name"
                    />
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => updateFunction(f.id, { enabled: e.target.checked })}
                    />
                    <Button size="icon-sm" variant="ghost" onClick={() => removeFunction(f.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={f.body}
                    onChange={(e) => updateFunction(f.id, { body: e.target.value })}
                    className="min-h-[60px] font-mono text-xs"
                    placeholder={'  echo "Hello $1"'}
                  />
                  <Input
                    value={f.description ?? ""}
                    onChange={(e) => updateFunction(f.id, { description: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="description (optional)"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(cfg.exports.length > 0 || cfg.paths.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Exports / PATH
            </h3>
            {cfg.exports.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Exports</div>
                {cfg.exports.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <Input
                      value={e.key}
                      onChange={(ev) => updateExport(e.id, { key: ev.target.value })}
                      className="h-7 text-xs font-mono w-32"
                      placeholder="KEY"
                    />
                    <Input
                      value={e.value}
                      onChange={(ev) => updateExport(e.id, { value: ev.target.value })}
                      className="h-7 text-xs font-mono flex-1"
                      placeholder="value"
                    />
                    <input
                      type="checkbox"
                      checked={e.enabled}
                      onChange={(ev) => updateExport(e.id, { enabled: ev.target.checked })}
                    />
                    <Button size="icon-sm" variant="ghost" onClick={() => removeExport(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {cfg.paths.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">PATH</div>
                {cfg.paths.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <select
                      value={p.mode}
                      onChange={(ev) => updatePath(p.id, { mode: ev.target.value as "prepend" | "append" })}
                      className="h-7 text-xs rounded border bg-background px-1.5"
                    >
                      <option value="prepend">prepend</option>
                      <option value="append">append</option>
                    </select>
                    <Input
                      value={p.path}
                      onChange={(ev) => updatePath(p.id, { path: ev.target.value })}
                      className="h-7 text-xs font-mono flex-1"
                      placeholder="/path/to/dir"
                    />
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(ev) => updatePath(p.id, { enabled: ev.target.checked })}
                    />
                    <Button size="icon-sm" variant="ghost" onClick={() => removePath(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(stats.totalAliases > 0 || stats.totalFunctions > 0 || stats.totalExports > 0 || stats.totalPaths > 0) ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> .aliases preview
            </h3>
            <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
              {aliasesFile}
            </pre>
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">~/.bashrc snippet</div>
              <pre className="rounded border bg-muted/40 p-2 text-[11px] font-mono overflow-auto">
                {bashrcSnippet}
              </pre>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">~/.zshrc snippet</div>
              <pre className="rounded border bg-muted/40 p-2 text-[11px] font-mono overflow-auto">
                {zshrcSnippet}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return aliasesFile; }}
                label="Copy .aliases"
              />
              <DownloadButton
                getText={() => { handleSaveHistory(); return aliasesFile; }}
                filename=".aliases"
                mime="text/plain"
                label="Download .aliases"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(cfg); }} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No aliases yet"
          hint="Apply a starter pack (git, docker, kubectl, …) or click + Alias to begin. The .aliases file is sourced from both .bashrc and .zshrc."
          icon={<Terminal className="h-8 w-8" />}
        />
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{h.totalAliases} aliases</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.totalFunctions} fns</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.totalExports} exports</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.totalPaths} paths</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All editing and file generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>
        {value}
        {sub && <span className="text-muted-foreground text-xs font-normal"> {sub}</span>}
      </div>
    </div>
  );
}
