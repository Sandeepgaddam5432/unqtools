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
  PREFIX_OPTIONS,
  VERSION_OPTIONS,
  COPY_MODE_OPTIONS,
  SPLIT_BINDING_OPTIONS,
  STATUS_SEGMENT_OPTIONS,
  CURATED_PLUGINS,
  CATEGORY_LABELS,
  MODE_LABELS,
  PRESETS,
  makeDefaultConfig,
  normalizePluginRepo,
  buildCheatsheet,
  filterCheatsheet,
  generateConfig,
  renderCheatsheetMarkdown,
  validateConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TmuxConfig,
  type PrefixKey,
  type TmuxVersion,
  type CopyMode,
  type SplitBinding,
  type StatusSegment,
  type BindingCategory,
  type TmuxPlugin,
  type HistoryEntry,
} from "./logic";
import {
  History, Terminal, AlertTriangle, Info, ShieldAlert, Search,
  Layout, Settings, Keyboard, Package, Wand2,
} from "lucide-react";

export default function TmuxConfigGeneratorCheatsheet() {
  const [config, setConfig] = useState<TmuxConfig>(makeDefaultConfig());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<BindingCategory | "">("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      try {
        const parsed = parseShareUrl(window.location.hash);
        setConfig(parsed);
        toast.info("Loaded config from share link");
      } catch {
        // ignore
      }
    }
  }, []);

  const result = useMemo(() => generateConfig(config), [config]);
  const cheatsheet = useMemo(() => buildCheatsheet(config), [config]);
  const filteredCs = useMemo(
    () => filterCheatsheet(cheatsheet, { query: search, category: filterCat || "" }),
    [cheatsheet, search, filterCat],
  );
  const validation = useMemo(() => validateConfig(config), [config]);
  const csMarkdown = useMemo(() => renderCheatsheetMarkdown(cheatsheet), [cheatsheet]);

  const update = useCallback(<K extends keyof TmuxConfig>(key: K, value: TmuxConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePlugin = useCallback((repo: string) => {
    setConfig((prev) => {
      const exists = prev.plugins.find((p) => p.repo === repo);
      let plugins: TmuxPlugin[];
      if (exists) {
        plugins = prev.plugins.map((p) => p.repo === repo ? { ...p, enabled: !p.enabled } : p);
      } else {
        const curated = CURATED_PLUGINS.find((p) => p.repo === repo);
        plugins = [...prev.plugins, { ...(curated ?? { repo, enabled: false }), enabled: true }];
      }
      return { ...prev, plugins };
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    // Deep clone plugins
    setConfig({
      ...preset.config,
      plugins: preset.config.plugins.map((p) => ({ ...p, options: p.options ? { ...p.options } : undefined })),
    });
    toast.success(`Applied preset: ${preset.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      presetId: "custom",
      prefix: config.prefix,
      version: config.version,
      pluginCount: config.plugins.filter((p) => p.enabled).length,
      lineCount: result.stats.totalLines,
    });
    setHistory(loadHistory());
  }, [config, result.stats.totalLines]);

  const handleClear = useCallback(() => {
    setConfig(makeDefaultConfig());
    setSearch("");
    setFilterCat("");
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Presets */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Presets
          </h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(p.id)}
                title={p.description}
              >{p.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Settings className="h-4 w-4" /> Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prefix key</Label>
              <select
                value={config.prefix}
                onChange={(e) => update("prefix", e.target.value as PrefixKey)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {PREFIX_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label} — {p.hint}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">tmux version</Label>
              <select
                value={config.version}
                onChange={(e) => update("version", e.target.value as TmuxVersion)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {VERSION_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Copy mode</Label>
              <select
                value={config.copyMode}
                onChange={(e) => update("copyMode", e.target.value as CopyMode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {COPY_MODE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vertical split key</Label>
              <select
                value={config.splitBinding}
                onChange={(e) => update("splitBinding", e.target.value as SplitBinding)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {SPLIT_BINDING_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horizontal split key</Label>
              <select
                value={config.vSplitBinding}
                onChange={(e) => update("vSplitBinding", e.target.value as SplitBinding)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {SPLIT_BINDING_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status bar position</Label>
              <select
                value={config.statusPosition}
                onChange={(e) => update("statusPosition", e.target.value as "top" | "bottom")}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="bottom">Bottom</option>
                <option value="top">Top</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Base index</Label>
              <Input
                type="number"
                value={config.baseIndex}
                onChange={(e) => update("baseIndex", parseInt(e.target.value || "0", 10))}
                className="h-8 text-xs"
                min={0}
                max={99}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">History limit (lines)</Label>
              <Input
                type="number"
                value={config.historyLimit}
                onChange={(e) => update("historyLimit", parseInt(e.target.value || "0", 10))}
                className="h-8 text-xs"
                min={100}
                step={1000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Escape time (ms)</Label>
              <Input
                type="number"
                value={config.escapeTime}
                onChange={(e) => update("escapeTime", parseInt(e.target.value || "0", 10))}
                className="h-8 text-xs"
                min={0}
                max={1000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status foreground</Label>
              <Input
                value={config.statusFg}
                onChange={(e) => update("statusFg", e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status background</Label>
              <Input
                value={config.statusBg}
                onChange={(e) => update("statusBg", e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Toggle
              label="Mouse mode"
              checked={config.mouse}
              onChange={(v) => update("mouse", v)}
            />
            <Toggle
              label="Renumber windows"
              checked={config.renumberWindows}
              onChange={(v) => update("renumberWindows", v)}
            />
            <Toggle
              label="Send-prefix (nested tmux)"
              checked={config.sendPrefix}
              onChange={(v) => update("sendPrefix", v)}
            />
            <Toggle
              label="Resize binds"
              checked={config.enableResizeBinds}
              onChange={(v) => update("enableResizeBinds", v)}
            />
            <Toggle
              label="Reload bind (prefix + r)"
              checked={config.enableReloadBind}
              onChange={(v) => update("enableReloadBind", v)}
            />
            <Toggle
              label="True color (Tc)"
              checked={config.enableTrueColor}
              onChange={(v) => update("enableTrueColor", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status bar segments */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Layout className="h-4 w-4" /> Status bar content
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Left segments</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {STATUS_SEGMENT_OPTIONS.map((s) => {
                  const active = config.statusLeftSegments.includes(s.value);
                  return (
                    <Button
                      key={s.value}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        const next = active
                          ? config.statusLeftSegments.filter((x) => x !== s.value)
                          : [...config.statusLeftSegments, s.value];
                        update("statusLeftSegments", next);
                      }}
                    >{s.label}</Button>
                  );
                })}
              </div>
              {config.statusLeftSegments.includes("custom") && (
                <Input
                  value={config.statusLeftCustom}
                  onChange={(e) => update("statusLeftCustom", e.target.value)}
                  placeholder='e.g. "[#S] "'
                  className="h-8 mt-2 text-xs font-mono"
                />
              )}
            </div>
            <div>
              <Label className="text-xs">Right segments</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {STATUS_SEGMENT_OPTIONS.map((s) => {
                  const active = config.statusRightSegments.includes(s.value as StatusSegment);
                  return (
                    <Button
                      key={s.value}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        const next = active
                          ? config.statusRightSegments.filter((x) => x !== s.value)
                          : [...config.statusRightSegments, s.value];
                        update("statusRightSegments", next);
                      }}
                    >{s.label}</Button>
                  );
                })}
              </div>
              {config.statusRightSegments.includes("custom") && (
                <Input
                  value={config.statusRightCustom}
                  onChange={(e) => update("statusRightCustom", e.target.value)}
                  placeholder='e.g. "%H:%M"'
                  className="h-8 mt-2 text-xs font-mono"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plugins */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Plugins (TPM)
          </h3>
          <p className="text-[11px] text-muted-foreground">
            TPM is auto-bootstrapped when any plugin is enabled. Press <code className="font-mono">prefix + I</code> to install inside tmux.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CURATED_PLUGINS.map((p) => {
              const current = config.plugins.find((x) => x.repo === p.repo);
              const enabled = !!current?.enabled;
              return (
                <label
                  key={p.repo}
                  className="flex items-start gap-2 rounded border bg-background px-3 py-2 text-xs cursor-pointer hover:bg-accent/30"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => togglePlugin(p.repo)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-foreground">{normalizePluginRepo(p.repo)}</div>
                    {p.options && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {Object.entries(p.options).map(([k, v]) => (
                          <div key={k}><span className="font-mono">{k}</span> = <span className="font-mono">{v}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(validation.errors.length > 0 || result.warnings.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Validation
            </h3>
            {validation.errors.map((e, i) => (
              <div key={`e${i}`} className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
                <ShieldAlert className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <span>{e}</span>
              </div>
            ))}
            {result.warnings.map((w, i) => {
              const Icon = w.level === "danger" ? ShieldAlert : w.level === "warning" ? AlertTriangle : Info;
              const color =
                w.level === "danger" ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : w.level === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400";
              return (
                <div key={`w${i}`} className={`flex items-start gap-2 rounded border px-3 py-2 text-xs ${color}`}>
                  <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{w.message}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Generated config preview */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> .tmux.conf ({result.stats.totalLines} lines, {result.stats.pluginCount} plugins)
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return result.config; }} label="Copy .tmux.conf" />
              <DownloadButton
                getText={() => { handleSaveHistory(); return result.config; }}
                filename=".tmux.conf"
                mime="text/plain"
                label="Download"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            readOnly
            value={result.config}
            className="min-h-[400px] resize-y font-mono text-[11px] leading-tight"
          />
        </CardContent>
      </Card>

      {/* Cheatsheet */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Keyboard className="h-4 w-4" /> Personalized Cheatsheet ({filteredCs.length})
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bindings…"
                  className="h-8 pl-7 text-xs w-48"
                />
              </div>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value as BindingCategory | "")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">All categories</option>
                {(Object.keys(CATEGORY_LABELS) as BindingCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <CopyButton getText={() => csMarkdown} label="Copy as .md" />
              <DownloadButton
                getText={() => csMarkdown}
                filename="tmux-cheatsheet.md"
                mime="text/markdown"
                label="Download .md"
              />
            </div>
          </div>
          {filteredCs.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-auto">
              {(Object.keys(CATEGORY_LABELS) as BindingCategory[]).map((cat) => {
                const items = filteredCs.filter((b) => b.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{CATEGORY_LABELS[cat]}</div>
                    <div className="space-y-1">
                      {items.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                          <code className="font-mono text-primary min-w-[100px]">{b.key}</code>
                          <span className="flex-1 text-foreground">{b.description}</span>
                          {b.custom && <Badge variant="secondary" className="text-[10px]">custom</Badge>}
                          <Badge variant="outline" className="text-[10px]">{MODE_LABELS[b.mode]}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No bindings match your search"
              hint="Try clearing the search box or filter."
              icon={<Search className="h-8 w-8" />}
            />
          )}
        </CardContent>
      </Card>

      {/* History */}
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
                  <Badge variant="outline" className="mr-2">{h.prefix}</Badge>
                  <Badge variant="outline" className="mr-2">tmux {h.version}</Badge>
                  <Badge variant="outline" className="mr-2">{h.pluginCount} plugins</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All config generation runs locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode options in the fragment (after #), which browsers never send to servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
