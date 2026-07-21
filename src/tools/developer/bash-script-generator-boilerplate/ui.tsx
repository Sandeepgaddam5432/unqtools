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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  DEFAULT_CONFIG,
  PRESETS,
  SHEBANG_LABELS,
  validateConfig,
  generateScript,
  computeStats,
  countLines,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  flagVarName,
  type ScriptConfig,
  type Flag,
  type Positional,
  type Shebang,
  type HistoryEntry,
} from "./logic";
import {
  History, Terminal, Plus, Trash2, Settings2, FileCode, AlertTriangle, CheckCircle2,
} from "lucide-react";

const EMPTY_FLAG: Flag = {
  short: "", long: "", description: "", takesValue: false, required: false,
};
const EMPTY_POSITIONAL: Positional = { name: "", description: "", required: false };

export default function BashScriptGeneratorBoilerplate() {
  const [config, setConfig] = useState<ScriptConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setConfig(parsed);
        toast.info("Loaded config from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateConfig(config), [config]);
  const script = useMemo(() => generateScript(config), [config]);
  const stats = useMemo(() => computeStats(config), [config]);
  const lineCount = useMemo(() => countLines(script), [script]);
  const filename = `${config.name || "script"}.sh`;

  const updateField = useCallback(
    <K extends keyof ScriptConfig>(key: K, value: ScriptConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addFlag = useCallback(() => {
    setConfig((prev) => ({ ...prev, flags: [...prev.flags, { ...EMPTY_FLAG }] }));
  }, []);

  const updateFlag = useCallback((index: number, patch: Partial<Flag>) => {
    setConfig((prev) => ({
      ...prev,
      flags: prev.flags.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }, []);

  const removeFlag = useCallback((index: number) => {
    setConfig((prev) => ({ ...prev, flags: prev.flags.filter((_, i) => i !== index) }));
  }, []);

  const addPositional = useCallback(() => {
    setConfig((prev) => ({ ...prev, positionals: [...prev.positionals, { ...EMPTY_POSITIONAL }] }));
  }, []);

  const updatePositional = useCallback((index: number, patch: Partial<Positional>) => {
    setConfig((prev) => ({
      ...prev,
      positionals: prev.positionals.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removePositional = useCallback((index: number) => {
    setConfig((prev) => ({ ...prev, positionals: prev.positionals.filter((_, i) => i !== index) }));
  }, []);

  const loadPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    // Deep clone via JSON to avoid mutating the preset.
    const cloned = JSON.parse(JSON.stringify(preset.config)) as ScriptConfig;
    setConfig(cloned);
    toast.success(`Loaded preset: ${preset.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      name: config.name,
      flagCount: config.flags.length,
      positionalCount: config.positionals.length,
      lineCount,
    });
    setHistory(loadHistory());
  }, [config, lineCount]);

  const handleClear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Terminal className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Script settings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bsg-name" className="text-xs">Script name</Label>
              <Input
                id="bsg-name"
                value={config.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="my-script"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bsg-version" className="text-xs">Version</Label>
              <Input
                id="bsg-version"
                value={config.version}
                onChange={(e) => updateField("version", e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bsg-shebang" className="text-xs">Shebang</Label>
              <select
                id="bsg-shebang"
                value={config.shebang}
                onChange={(e) => updateField("shebang", e.target.value as Shebang)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(SHEBANG_LABELS) as Shebang[]).map((s) => (
                  <option key={s} value={s}>{SHEBANG_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bsg-desc" className="text-xs">Description (shown in --help)</Label>
            <Input
              id="bsg-desc"
              value={config.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="h-8 text-xs"
              placeholder="A short description of what this script does."
            />
          </div>
          <div>
            <Label className="text-xs">Toggles</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              <Toggle
                label="Strict mode" checked={config.strictMode}
                onChange={(v) => updateField("strictMode", v)}
              />
              <Toggle
                label="Traps (cleanup)" checked={config.traps}
                onChange={(v) => updateField("traps", v)}
              />
              <Toggle
                label="Logging" checked={config.logging}
                onChange={(v) => updateField("logging", v)}
              />
              <Toggle
                label="Colors" checked={config.colors} disabled={!config.logging}
                onChange={(v) => updateField("colors", v)}
              />
              <Toggle
                label="--verbose/--quiet" checked={config.verboseQuiet} disabled={!config.logging}
                onChange={(v) => updateField("verboseQuiet", v)}
              />
              <Toggle
                label="--dry-run" checked={config.dryRun}
                onChange={(v) => updateField("dryRun", v)}
              />
              <Toggle
                label="Require root" checked={config.rootRequired}
                onChange={(v) => updateField("rootRequired", v)}
              />
              <Toggle
                label="OS detect" checked={config.osDetect}
                onChange={(v) => updateField("osDetect", v)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bsg-deps" className="text-xs">Dependency check (comma-separated commands)</Label>
            <Input
              id="bsg-deps"
              value={config.dependencyCheck.join(", ")}
              onChange={(e) => updateField(
                "dependencyCheck",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )}
              className="h-8 text-xs font-mono"
              placeholder="curl, jq, tar"
            />
          </div>
          <div>
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => loadPreset(p.id)}
                  title={p.description}
                >{p.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Settings2 className="h-4 w-4" /> Flags ({config.flags.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addFlag} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Add flag
            </Button>
          </div>
          {config.flags.length === 0 ? (
            <p className="text-xs text-muted-foreground">No flags declared. The parser will still handle --help and toggles.</p>
          ) : (
            <div className="space-y-2">
              {config.flags.map((f, i) => (
                <div key={i} className="rounded border bg-background p-2 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <Input
                      value={f.short}
                      onChange={(e) => updateFlag(i, { short: e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1) })}
                      placeholder="s"
                      className="col-span-2 h-7 text-xs font-mono"
                      title="Short flag (single letter)"
                    />
                    <Input
                      value={f.long}
                      onChange={(e) => updateFlag(i, { long: e.target.value.replace(/[^a-z0-9-]/g, "") })}
                      placeholder="source"
                      className="col-span-3 h-7 text-xs font-mono"
                      title="Long name (no -- prefix)"
                    />
                    <Input
                      value={f.description}
                      onChange={(e) => updateFlag(i, { description: e.target.value })}
                      placeholder="Description"
                      className="col-span-5 h-7 text-xs"
                    />
                    <Input
                      value={f.default ?? ""}
                      onChange={(e) => updateFlag(i, { default: e.target.value })}
                      placeholder="default"
                      className="col-span-1 h-7 text-xs font-mono"
                      title="Default value (only if takes value)"
                    />
                    <Button
                      variant="ghost" size="icon" className="col-span-1"
                      onClick={() => removeFlag(i)}
                      title="Remove"
                    ><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox" checked={f.takesValue}
                        onChange={(e) => updateFlag(i, { takesValue: e.target.checked })}
                      />
                      Takes value
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox" checked={f.required}
                        onChange={(e) => updateFlag(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <Badge variant="outline" className="text-[10px]">{flagVarName(f.long || "flag")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Settings2 className="h-4 w-4" /> Positional arguments ({config.positionals.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addPositional} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Add positional
            </Button>
          </div>
          {config.positionals.length === 0 ? (
            <p className="text-xs text-muted-foreground">No positional arguments declared.</p>
          ) : (
            <div className="space-y-2">
              {config.positionals.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    value={p.name}
                    onChange={(e) => updatePositional(i, { name: e.target.value.replace(/[^a-z0-9_]/gi, "") })}
                    placeholder="input_file"
                    className="col-span-3 h-7 text-xs font-mono"
                  />
                  <Input
                    value={p.description}
                    onChange={(e) => updatePositional(i, { description: e.target.value })}
                    placeholder="Description"
                    className="col-span-7 h-7 text-xs"
                  />
                  <label className="col-span-1 flex items-center gap-1 text-[10px] cursor-pointer">
                    <input
                      type="checkbox" checked={p.required}
                      onChange={(e) => updatePositional(i, { required: e.target.checked })}
                    />
                    req
                  </label>
                  <Button
                    variant="ghost" size="icon" className="col-span-1"
                    onClick={() => removePositional(i)}
                  ><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {validation.errors.length > 0 && (
        <ErrorBanner message={`Errors: ${validation.errors.join("; ")}`} />
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Warnings:</strong>
            <ul className="list-disc ml-4 mt-1">
              {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-4 w-4" /> Generated script
              <Badge variant="secondary" className="text-[10px] ml-1">{lineCount} lines</Badge>
              {validation.errors.length === 0 && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> valid
                </Badge>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return script; }}
                label="Copy .sh"
              />
              <DownloadButton
                getText={() => { handleSaveHistory(); return script; }}
                filename={filename}
                mime="text/x-shellscript"
                label="Download .sh"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Flags" value={stats.flagCount} />
            <Stat label="Positionals" value={stats.positionalCount} />
            <Stat label="Dependencies" value={stats.dependencyCount} />
            <Stat label="Toggles on" value={stats.togglesOn} />
          </div>
          <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-auto max-h-[600px] whitespace-pre">
            {script}
          </pre>
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className="mr-2">{h.flagCount}f</Badge>
                  <Badge variant="outline" className="mr-2">{h.positionalCount}p</Badge>
                  <Badge variant="outline" className="mr-2">{h.lineCount}L</Badge>
                  <span className="font-mono text-foreground">{h.name}</span>
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
            <strong className="text-foreground">Privacy:</strong> All script generation runs locally. Your config never leaves the browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-1.5 text-xs ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
