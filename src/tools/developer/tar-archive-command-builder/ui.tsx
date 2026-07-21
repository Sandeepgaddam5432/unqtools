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
  COMPRESSION_INFO,
  FORMAT_LABELS,
  MODE_LABELS,
  MODE_HINTS,
  MODE_LETTER,
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
  suggestArchiveName,
  hasMatchingExtension,
  type BuilderConfig,
  type TarMode,
  type TarCompression,
  type TarFormat,
  type HistoryEntry,
} from "./logic";
import {
  Archive, History, BookOpen, AlertTriangle, Wand2,
  Lightbulb, FileArchive, ChevronRight,
} from "lucide-react";

type Tab = "builder" | "explain" | "recipes";

const MODES: TarMode[] = ["create", "extract", "list", "append"];
const COMPRESSIONS: TarCompression[] = ["none", "gzip", "bzip2", "xz", "zstd"];
const FORMATS: TarFormat[] = ["default", "gnu", "posix", "ustar", "pax"];

export default function TarArchiveCommandBuilder() {
  const [config, setConfig] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [filesText, setFilesText] = useState<string>(DEFAULT_CONFIG.files.join("\n"));
  const [excludesText, setExcludesText] = useState<string>(DEFAULT_CONFIG.excludes.join("\n"));
  const [tab, setTab] = useState<Tab>("builder");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.config.mode) setConfig((c) => ({ ...c, ...p.config }));
      if (p.config.files) setFilesText(p.config.files.join("\n"));
      if (p.config.excludes) setExcludesText(p.config.excludes.join("\n"));
      if (p.config.mode || p.config.archiveName) toast.info("Loaded from share link");
    }
  }, []);

  const files = useMemo(
    () => filesText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [filesText],
  );
  const excludes = useMemo(
    () => excludesText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [excludesText],
  );

  const effectiveConfig = useMemo<BuilderConfig>(
    () => ({ ...config, files, excludes }),
    [config, files, excludes],
  );

  const built = useMemo(() => buildCommand(effectiveConfig), [effectiveConfig]);
  const intent = useMemo(() => explainIntent(effectiveConfig), [effectiveConfig]);
  const flags = useMemo(() => explainFlags(effectiveConfig), [effectiveConfig]);
  const validation = useMemo(() => validateConfig(effectiveConfig), [effectiveConfig]);

  const update = <K extends keyof BuilderConfig>(key: K, value: BuilderConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const toggle = (key: keyof BuilderConfig) => {
    setConfig((c) => ({ ...c, [key]: !c[key as keyof BuilderConfig] as unknown as never }));
  };

  const handleSaveHistory = useCallback(() => {
    if (built.command) {
      saveHistory({
        ts: Date.now(),
        mode: effectiveConfig.mode,
        compression: effectiveConfig.compression,
        command: built.command,
      });
      setHistory(loadHistory());
    }
  }, [built.command, effectiveConfig.mode, effectiveConfig.compression]);

  const handleClear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setFilesText(DEFAULT_CONFIG.files.join("\n"));
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
    const next = { ...DEFAULT_CONFIG, ...recipe.config } as BuilderConfig;
    setConfig(next);
    setFilesText(next.files.join("\n"));
    setExcludesText(next.excludes.join("\n"));
    setTab("builder");
    toast.success(`Loaded recipe: ${recipe.label}`);
  };

  const applySuggestedName = () => {
    const suggested = suggestArchiveName(
      config.compression,
      (config.archiveName || "archive").replace(/\.tar.*$/, "").replace(/\.tgz$|\.tbz2?$|\.txz$|\.tzst$/, "") || "archive",
    );
    update("archiveName", suggested);
    toast.success(`Renamed to ${suggested}`);
  };

  const nameMismatch = config.archiveName && !hasMatchingExtension(config.archiveName, config.compression);

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
            {/* Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MODES.map((m) => (
                  <Button
                    key={m}
                    variant={config.mode === m ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("mode", m)}
                    className="text-xs justify-start"
                  >
                    <Badge variant="secondary" className="mr-1 font-mono">{MODE_LETTER[m]}</Badge>
                    <span className="capitalize">{m}</span>
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{MODE_HINTS[config.mode]}</p>
            </div>

            {/* Compression */}
            <div className="space-y-1.5">
              <Label className="text-xs">Compression</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {COMPRESSIONS.map((c) => (
                  <Button
                    key={c}
                    variant={config.compression === c ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("compression", c)}
                    className="text-xs"
                  >
                    {c === "none" ? "none" : c}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                <Badge variant="outline" className="font-mono mr-1">
                  {COMPRESSION_INFO[config.compression].shortFlag
                    ? `-${COMPRESSION_INFO[config.compression].shortFlag}`
                    : COMPRESSION_INFO[config.compression].flag || "(none)"}
                </Badge>
                <Badge variant="outline" className="font-mono mr-1">{COMPRESSION_INFO[config.compression].extension}</Badge>
                {COMPRESSION_INFO[config.compression].hint}
              </p>
            </div>

            {/* Archive name */}
            <div className="space-y-1.5">
              <Label htmlFor="tar-name">Archive name</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="tar-name"
                  value={config.archiveName}
                  onChange={(e) => update("archiveName", e.target.value)}
                  placeholder="archive.tar.gz"
                  className="font-mono text-sm flex-1 min-w-[200px]"
                />
                {nameMismatch && (
                  <Button variant="ghost" size="sm" onClick={applySuggestedName} className="text-xs">
                    Use {suggestArchiveName(config.compression, (config.archiveName || "archive").replace(/\.tar.*$/, "").replace(/\.tgz$|\.tbz2?$|\.txz$|\.tzst$/, "") || "archive")}
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Shell-quoted: <code className="font-mono">{shellQuote(config.archiveName || "")}</code>
                {" · "}Suggested: <code className="font-mono">{suggestArchiveName(config.compression, "archive")}</code>
              </p>
            </div>

            {/* Files (create / append) */}
            {(config.mode === "create" || config.mode === "append") && (
              <div className="space-y-1.5">
                <Label htmlFor="tar-files">Files / directories (one per line)</Label>
                <Textarea
                  id="tar-files"
                  value={filesText}
                  onChange={(e) => setFilesText(e.target.value)}
                  placeholder={"./project\n./README.md"}
                  className="min-h-[80px] resize-y font-mono text-xs"
                />
              </div>
            )}

            {/* Target dir + strip (extract / list) */}
            {(config.mode === "extract" || config.mode === "list") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Target directory (-C)</Label>
                  <Input
                    value={config.targetDir}
                    onChange={(e) => update("targetDir", e.target.value)}
                    placeholder="./out (empty = cwd)"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Empty = extract into cwd (tar-bomb risk). Recommended: a fresh dir.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Strip components (--strip-components=N)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.stripComponents}
                    onChange={(e) => update("stripComponents", Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Drops N leading path elements on extract. Use 1 to drop the wrapper folder.</p>
                </div>
              </div>
            )}

            {/* Excludes */}
            <div className="space-y-1.5">
              <Label htmlFor="tar-excludes">Excludes (one per line)</Label>
              <Textarea
                id="tar-excludes"
                value={excludesText}
                onChange={(e) => setExcludesText(e.target.value)}
                placeholder={"node_modules\n*.log\n.git"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </div>

            {/* Exclude file */}
            <div className="space-y-1.5">
              <Label htmlFor="tar-exfile" className="text-xs">Exclude file (-X) (optional)</Label>
              <Input
                id="tar-exfile"
                value={config.excludeFile}
                onChange={(e) => update("excludeFile", e.target.value)}
                placeholder="exclude.txt"
                className="font-mono text-sm"
              />
            </div>

            {/* Format selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Button
                    key={f}
                    variant={config.format === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("format", f)}
                    className="text-xs"
                  >
                    {f}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{FORMAT_LABELS[config.format]}</p>
            </div>

            {/* Toggles */}
            <div className="space-y-1.5">
              <Label className="text-xs">Toggles</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { k: "verbose", label: "-v verbose" },
                  { k: "preservePermissions", label: "-p preserve perms (extract)" },
                  { k: "preserveXattrs", label: "--xattrs" },
                  { k: "numericOwner", label: "--numeric-owner" },
                  { k: "verify", label: "--verify (create)" },
                  { k: "showTotals", label: "--totals (create)" },
                  { k: "useStdinStdout", label: "-O stdin/stdout" },
                ].map((opt) => (
                  <label key={opt.k} className="flex items-center gap-1.5 text-xs cursor-pointer rounded border bg-background px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={config[opt.k as keyof BuilderConfig] as boolean}
                      onChange={() => toggle(opt.k as keyof BuilderConfig)}
                    />
                    <span className="font-mono">{opt.label}</span>
                  </label>
                ))}
              </div>
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
              <BookOpen className="h-4 w-4" /> Common tar recipes
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
              <FileArchive className="h-4 w-4" /> Generated command
            </h3>
            <pre className="rounded border bg-muted/50 p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {built.command}
            </pre>

            {built.warnings.length > 0 && (
              <div className="space-y-1">
                {built.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
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
                filename="tar-command.sh"
                mime="text/x-shellscript"
                label="Download .sh"
              />
              <DownloadButton
                getText={() => renderRecipesText()}
                filename="tar-recipes.txt"
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
          title="Pick a mode and an archive name"
          hint="Select create / extract / list / append, choose compression, fill in the archive name. The command updates live."
          icon={<Archive className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 font-mono">{MODE_LETTER[h.mode]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.compression}</Badge>
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
