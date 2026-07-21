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
  History, FolderTree, FileCode2, ShieldCheck, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  DOTFILE_CATALOG,
  MANAGERS,
  NEVER_COMMIT_LIST,
  computeStats,
  defaultConfig,
  generateBundle,
  generateChezmoiConf,
  generateDotbotConf,
  getManager,
  loadHistory,
  parseShareUrl,
  saveHistory,
  clearHistory,
  buildShareUrl,
  validateConfig,
  type DotfileConfig,
  type Manager,
  type HistoryEntry,
} from "./logic";

export default function DotfilesManagerGenerator() {
  const [config, setConfig] = useState<DotfileConfig>(() => defaultConfig());
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setConfig(parsed);
      toast.info("Loaded from share link");
    }
  }, []);

  const validation = useMemo(() => validateConfig(config), [config]);
  const bundle = useMemo(() => generateBundle(config), [config]);
  const stats = useMemo(() => computeStats(config), [config]);

  const update = useCallback((patch: Partial<DotfileConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleDotfile = useCallback((target: string) => {
    setConfig((prev) => ({
      ...prev,
      selected: prev.selected.includes(target)
        ? prev.selected.filter((t) => t !== target)
        : [...prev.selected, target],
    }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      manager: config.manager,
      selectedCount: config.selected.length,
      repoName: config.repoName,
    });
    setHistory(loadHistory());
  }, [config]);

  const handleClear = useCallback(() => {
    setConfig(defaultConfig());
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const selectedManager = getManager(config.manager);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FolderTree className="h-4 w-4" /> Manager
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MANAGERS.map((m) => {
              const active = m.id === config.manager;
              return (
                <button
                  key={m.id}
                  onClick={() => update({ manager: m.id as Manager })}
                  className={`text-left rounded border p-3 transition ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{m.label}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${
                            i <= m.difficulty ? "bg-primary" : "bg-muted"
                          }`}
                          title={`difficulty ${m.difficulty}/3`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{m.tagline}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.usesSymlinks && <Badge variant="outline" className="text-[9px]">symlinks</Badge>}
                    {m.requiresBinary
                      ? <Badge variant="outline" className="text-[9px]">binary</Badge>
                      : <Badge variant="outline" className="text-[9px]">git-only</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedManager && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div className="rounded border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Pros</div>
                <ul className="text-[11px] mt-1 space-y-0.5">
                  {selectedManager.pros.map((p) => <li key={p}>+ {p}</li>)}
                </ul>
              </div>
              <div className="rounded border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">Cons</div>
                <ul className="text-[11px] mt-1 space-y-0.5">
                  {selectedManager.cons.map((c) => <li key={c}>– {c}</li>)}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileCode2 className="h-4 w-4" /> Dotfiles to track
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {DOTFILE_CATALOG.map((d) => {
              const checked = config.selected.includes(d.target);
              return (
                <label
                  key={d.target}
                  className={`flex items-start gap-2 rounded border p-2 cursor-pointer ${
                    checked ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDotfile(d.target)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono text-foreground">{d.target}</code>
                      {d.secretRisk && (
                        <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                      )}
                      {d.isDirectory && (
                        <Badge variant="outline" className="text-[9px]">dir</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{d.label}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Repo options</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="dm-repo" className="text-xs">Repo name</Label>
              <Input
                id="dm-repo"
                value={config.repoName}
                onChange={(e) => update({ repoName: e.target.value })}
                className="h-8 text-xs font-mono"
                placeholder="dotfiles"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dm-author" className="text-xs">GitHub username (for README clone URL)</Label>
              <Input
                id="dm-author"
                value={config.author}
                onChange={(e) => update({ author: e.target.value })}
                className="h-8 text-xs font-mono"
                placeholder="yourname"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Backup mode</Label>
              <select
                value={config.backupMode}
                onChange={(e) => update({ backupMode: e.target.value as DotfileConfig["backupMode"] })}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                <option value="bak">backup to .bak.&lt;ts&gt;</option>
                <option value="skip">skip existing</option>
                <option value="overwrite">overwrite (no backup)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs mt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={config.osGuards}
                onChange={(e) => update({ osGuards: e.target.checked })}
              />
              OS detection (macOS/Linux)
            </label>
            <label className="flex items-center gap-2 text-xs mt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={config.packageStub}
                onChange={(e) => update({ packageStub: e.target.checked })}
              />
              Brew/apt package stub
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <ClearButton onClick={handleClear} />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config); }} />
          </div>
        </CardContent>
      </Card>

      {validation.issues.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            {validation.issues.map((iss, i) => (
              <div
                key={i}
                className={`text-xs flex items-start gap-1.5 ${
                  iss.severity === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {iss.severity === "error"
                  ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                <span>{iss.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(stats.totalSelected > 0 || config.repoName) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <Stat label="Selected" value={stats.totalSelected} />
              <Stat label="Files" value={stats.files} />
              <Stat label="Directories" value={stats.directories} />
              <Stat label="Secret-risk" value={stats.withSecretRisk} highlight={stats.withSecretRisk > 0 ? "bad" : "good"} />
              <Stat label="Gitignore patterns" value={stats.gitignorePatterns} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FolderTree className="h-4 w-4" /> Repo structure
          </h3>
          <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto">
            {bundle.tree}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileCode2 className="h-4 w-4" /> install.sh
            <Badge variant="outline" className="text-[10px] ml-1">idempotent</Badge>
          </h3>
          <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto max-h-[400px]">
            {bundle.installScript}
          </pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => { handleSaveHistory(); return bundle.installScript; }}
              label="Copy install.sh"
            />
            <DownloadButton
              getText={() => { handleSaveHistory(); return bundle.installScript; }}
              filename="install.sh"
              mime="text/x-shellscript"
              label="Download install.sh"
            />
          </div>
        </CardContent>
      </Card>

      {bundle.dotbotConf && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode2 className="h-4 w-4" /> install.conf.yaml (Dotbot)
            </h3>
            <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto">
              {bundle.dotbotConf}
            </pre>
            <CopyButton getText={() => bundle.dotbotConf ?? ""} label="Copy YAML" />
          </CardContent>
        </Card>
      )}

      {bundle.chezmoiConf && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode2 className="h-4 w-4" /> .chezmoi.toml.tmpl
            </h3>
            <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto">
              {bundle.chezmoiConf}
            </pre>
            <CopyButton getText={() => bundle.chezmoiConf ?? ""} label="Copy template" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> .gitignore (secret-safe)
          </h3>
          <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto max-h-[300px]">
            {bundle.gitignore}
          </pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => bundle.gitignore} label="Copy .gitignore" />
            <DownloadButton getText={() => bundle.gitignore} filename=".gitignore" label="Download .gitignore" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">README.md</h3>
          <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
            {bundle.readme}
          </pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => bundle.readme} label="Copy README" />
            <DownloadButton getText={() => bundle.readme} filename="README.md" label="Download README" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Never commit these
          </h3>
          <div className="space-y-1">
            {bundle.checklist.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded border bg-background px-3 py-1.5">
                {c.severity === "critical"
                  ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-600" />
                  : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600" />}
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">{c.item}</div>
                  <div className="text-[10px] text-muted-foreground">{c.why}</div>
                </div>
                <Badge variant={c.severity === "critical" ? "destructive" : "outline"} className="text-[9px]">
                  {c.severity}
                </Badge>
              </div>
            ))}
          </div>
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{getManager(h.manager).label}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.selectedCount} dotfiles</Badge>
                  <span className="font-mono text-muted-foreground">{h.repoName}</span>
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
            <strong className="text-foreground">Privacy:</strong> All scaffolding runs locally. The generated .gitignore is designed to keep your secrets out of git. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
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
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint for icons that may not be referenced
export const _icons = { CheckCircle2 };
