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
  DEFAULT_CONFIG,
  DIRECTION_LABELS,
  DIRECTION_HINTS,
  ARCHIVE_BREAKDOWN,
  RECIPES,
  shellQuote,
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
  visualizeSlashEffect,
  buildSshString,
  type BuilderConfig,
  type RsyncDirection,
  type SshTransport,
  type HistoryEntry,
} from "./logic";
import {
  RefreshCw, History, BookOpen, AlertTriangle, Wand2,
  Lightbulb, ArrowRight, ChevronRight, Terminal,
} from "lucide-react";

type Tab = "builder" | "explain" | "recipes";

const DIRECTIONS: RsyncDirection[] = ["local", "push", "pull"];

export default function RsyncCommandBuilder() {
  const [config, setConfig] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [excludesText, setExcludesText] = useState<string>("");
  const [tab, setTab] = useState<Tab>("builder");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.config.direction) setConfig((c) => ({ ...c, ...p.config }));
      if (p.config.excludes) setExcludesText(p.config.excludes.join("\n"));
      if (p.config.direction || p.config.source) toast.info("Loaded from share link");
    }
  }, []);

  const excludes = useMemo(
    () => excludesText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [excludesText],
  );

  const effectiveConfig = useMemo<BuilderConfig>(
    () => ({ ...config, excludes }),
    [config, excludes],
  );

  const built = useMemo(() => buildCommand(effectiveConfig), [effectiveConfig]);
  const intent = useMemo(() => explainIntent(effectiveConfig), [effectiveConfig]);
  const flags = useMemo(() => explainFlags(effectiveConfig), [effectiveConfig]);
  const validation = useMemo(() => validateConfig(effectiveConfig), [effectiveConfig]);
  const slashViz = useMemo(() => visualizeSlashEffect(effectiveConfig), [effectiveConfig]);
  const sshStr = useMemo(() => buildSshString(effectiveConfig.ssh), [effectiveConfig.ssh]);

  const update = <K extends keyof BuilderConfig>(key: K, value: BuilderConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const toggle = (key: keyof BuilderConfig) => {
    setConfig((c) => ({ ...c, [key]: !c[key as keyof BuilderConfig] as unknown as never }));
  };

  const updateSsh = <K extends keyof SshTransport>(key: K, value: SshTransport[K]) => {
    setConfig((c) => ({ ...c, ssh: { ...c.ssh, [key]: value } }));
  };

  const handleSaveHistory = useCallback(() => {
    if (built.command) {
      saveHistory({
        ts: Date.now(),
        direction: effectiveConfig.direction,
        command: built.command,
      });
      setHistory(loadHistory());
    }
  }, [built.command, effectiveConfig.direction]);

  const handleClear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setExcludesText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadRecipe = (id: string) => {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return;
    const next = { ...DEFAULT_CONFIG, ...recipe.config, ssh: { ...DEFAULT_CONFIG.ssh, ...(recipe.config.ssh ?? {}) } } as BuilderConfig;
    setConfig(next);
    setExcludesText(next.excludes.join("\n"));
    setTab("builder");
    toast.success(`Loaded recipe: ${recipe.label}`);
  };

  // Placeholders adapt to direction.
  const srcPlaceholder = config.direction === "pull" ? "user@host:/remote/path/" : "./local-source/";
  const destPlaceholder = config.direction === "push" ? "user@host:/remote/path/" : "./local-dest/";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            {(["builder", "explain", "recipes"] as Tab[]).map((t) => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
                className="text-xs"
              >
                {t === "builder" && <Wand2 className="h-3 w-3 mr-1" />}
                {t === "explain" && <Lightbulb className="h-3 w-3 mr-1" />}
                {t === "recipes" && <BookOpen className="h-3 w-3 mr-1" />}
                {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "builder" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Direction */}
            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <div className="grid grid-cols-3 gap-2">
                {DIRECTIONS.map((d) => (
                  <Button
                    key={d}
                    variant={config.direction === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("direction", d)}
                    className="text-xs"
                  >
                    {d}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{DIRECTION_HINTS[config.direction]}</p>
            </div>

            {/* Source + Destination with slash toggles */}
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="rsync-src" className="text-xs">Source</Label>
                <Input
                  id="rsync-src"
                  value={config.source}
                  onChange={(e) => update("source", e.target.value)}
                  placeholder={srcPlaceholder}
                  className="font-mono text-sm"
                />
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.sourceTrailingSlash}
                    onChange={() => toggle("sourceTrailingSlash")}
                  />
                  <span>Trailing slash on source ({config.sourceTrailingSlash ? "ON — copy CONTENTS" : "OFF — copy the DIR"})</span>
                </label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rsync-dst" className="text-xs">Destination</Label>
                <Input
                  id="rsync-dst"
                  value={config.destination}
                  onChange={(e) => update("destination", e.target.value)}
                  placeholder={destPlaceholder}
                  className="font-mono text-sm"
                />
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.destTrailingSlash}
                    onChange={() => toggle("destTrailingSlash")}
                  />
                  <span>Trailing slash on dest ({config.destTrailingSlash ? "ON" : "OFF"}) — generally irrelevant</span>
                </label>
              </div>
            </div>

            {/* Trailing-slash visualizer */}
            <div className="rounded border bg-muted/30 p-3 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-foreground">Trailing-slash effect</span>
              </div>
              <p className="text-muted-foreground mb-1">{slashViz.explanation}</p>
              <code className="font-mono text-foreground text-[11px] block bg-background border rounded px-2 py-1">
                {slashViz.example}
              </code>
            </div>

            {/* Flags */}
            <div className="space-y-1.5">
              <Label className="text-xs">Flags</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { k: "archive", label: "-a archive" },
                  { k: "recursive", label: "-r recursive (if no -a)" },
                  { k: "verbose", label: "-v verbose" },
                  { k: "compress", label: "-z compress" },
                  { k: "humanReadable", label: "-h human" },
                  { k: "progress", label: "--progress" },
                  { k: "partial", label: "--partial resume" },
                  { k: "checksum", label: "-c checksum" },
                  { k: "numericIds", label: "--numeric-ids" },
                  { k: "dryRun", label: "-n dry-run" },
                  { k: "delete", label: "--delete" },
                  { k: "deleteExcluded", label: "--delete-excluded" },
                ].map((opt) => (
                  <label
                    key={opt.k}
                    className={`flex items-center gap-1.5 text-xs cursor-pointer rounded border bg-background px-2 py-1.5 ${
                      (opt.k === "delete" || opt.k === "deleteExcluded") && config[opt.k as keyof BuilderConfig]
                        ? "border-red-500/50"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={config[opt.k as keyof BuilderConfig] as boolean}
                      onChange={() => toggle(opt.k as keyof BuilderConfig)}
                    />
                    <span className="font-mono">{opt.label}</span>
                  </label>
                ))}
              </div>
              {config.delete && !config.dryRun && (
                <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>--delete is enabled WITHOUT --dry-run. Strongly recommended: enable -n to preview what would be deleted.</span>
                </div>
              )}
            </div>

            {/* bwlimit */}
            <div className="space-y-1.5">
              <Label htmlFor="rsync-bw" className="text-xs">Bandwidth limit (--bwlimit KB/s, 0 = no limit)</Label>
              <Input
                id="rsync-bw"
                type="number"
                min={0}
                value={config.bwlimit}
                onChange={(e) => update("bwlimit", Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="font-mono text-sm"
              />
            </div>

            {/* Excludes */}
            <div className="space-y-1.5">
              <Label htmlFor="rsync-ex" className="text-xs">Excludes (one per line)</Label>
              <Textarea
                id="rsync-ex"
                value={excludesText}
                onChange={(e) => setExcludesText(e.target.value)}
                placeholder={".git/\nnode_modules/\n*.log"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </div>

            {/* Exclude-from */}
            <div className="space-y-1.5">
              <Label htmlFor="rsync-exf" className="text-xs">Exclude-from file (optional)</Label>
              <Input
                id="rsync-exf"
                value={config.excludeFrom}
                onChange={(e) => update("excludeFrom", e.target.value)}
                placeholder="excludes.txt"
                className="font-mono text-sm"
              />
            </div>

            {/* SSH transport */}
            <div className="space-y-1.5 rounded border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">SSH transport</Label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.ssh.enabled}
                    onChange={() => updateSsh("enabled", !config.ssh.enabled)}
                  />
                  <span>enabled</span>
                </label>
              </div>
              {config.ssh.enabled && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px]">User</Label>
                    <Input
                      value={config.ssh.user}
                      onChange={(e) => updateSsh("user", e.target.value)}
                      placeholder="deploy"
                      className="font-mono text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Host</Label>
                    <Input
                      value={config.ssh.host}
                      onChange={(e) => updateSsh("host", e.target.value)}
                      placeholder="example.com"
                      className="font-mono text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Port</Label>
                    <Input
                      value={config.ssh.port}
                      onChange={(e) => updateSsh("port", e.target.value)}
                      placeholder="22"
                      className="font-mono text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-[10px]">Identity key (-i)</Label>
                    <Input
                      value={config.ssh.keyFile}
                      onChange={(e) => updateSsh("keyFile", e.target.value)}
                      placeholder="~/.ssh/id_ed25519"
                      className="font-mono text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-3">
                    <Label className="text-[10px]">Extra ssh options</Label>
                    <Input
                      value={config.ssh.extraOptions}
                      onChange={(e) => updateSsh("extraOptions", e.target.value)}
                      placeholder="-o StrictHostKeyChecking=no"
                      className="font-mono text-xs h-8"
                    />
                  </div>
                </div>
              )}
              {sshStr.present && (
                <p className="text-[10px] text-muted-foreground pt-1">
                  Will use: <code className="font-mono">-e {sshStr.quoted}</code>
                </p>
              )}
              <p className="text-[10px] text-muted-foreground pt-1">
                Note: For push/pull you still need to prefix the remote path with <code className="font-mono">[user@]host:</code> — the SSH form here only builds the <code className="font-mono">-e</code> string.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "explain" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Plain-English intent
            </h3>
            <p className="text-xs text-foreground">{intent}</p>

            <h3 className="text-sm font-semibold text-foreground pt-2 flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4" /> Archive breakdown (-a = -rlptgoD)
            </h3>
            <div className="space-y-1">
              {ARCHIVE_BREAKDOWN.map((b) => (
                <div key={b.flag} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="font-mono mr-2 text-[10px]">{b.flag}</Badge>
                  <span className="text-foreground">{b.label}</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                -a does NOT include -H (hard links), -A (ACLs), -X (xattrs), or -z (compression).
              </p>
            </div>

            <h3 className="text-sm font-semibold text-foreground pt-2 flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4" /> Per-flag explanation
            </h3>
            <div className="space-y-1">
              {flags.map((f, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="font-mono mr-2 text-[10px]">{f.flag}</Badge>
                  <span className="text-foreground">{f.explanation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "recipes" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Common rsync recipes
            </h3>
            <div className="space-y-1">
              {RECIPES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRecipe(r.id)}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent transition"
                >
                  <div className="font-medium text-foreground">{r.label}</div>
                  <div className="text-muted-foreground text-[11px]">{r.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Output */}
      {built.command ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> Generated command
            </h3>
            <pre className="rounded border bg-muted/50 p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {built.command}
            </pre>

            {built.warnings.length > 0 && (
              <div className="space-y-1">
                {built.warnings.map((w, i) => {
                  const isDangerous = /delete|dangerous|push.*destination|pull.*source|local.*remote/i.test(w);
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded border px-3 py-1.5 text-xs ${
                        isDangerous
                          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {built.notes.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Notes ({built.notes.length})</summary>
                <ul className="list-disc pl-5 pt-2 space-y-1 text-muted-foreground">
                  {built.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return built.command; }}
                label="Copy command"
              />
              <DownloadButton
                getText={() => built.command}
                filename="rsync-command.sh"
                mime="text/x-shellscript"
                label="Download .sh"
              />
              <DownloadButton
                getText={() => renderRecipesText()}
                filename="rsync-recipes.txt"
                mime="text/plain"
                label="Download recipes"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(effectiveConfig); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Pick a direction and a source/dest"
          hint="Select local / push / pull, enter source & destination, toggle flags. The command updates live."
          icon={<RefreshCw className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.direction}</Badge>
                  <code className="font-mono text-foreground break-all">{h.command}</code>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Commands are generated locally — nothing is executed or uploaded. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
