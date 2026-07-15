"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState, RunButton } from "../../_shared";
import {
  buildRenamePlan, planToJson, planToCsv, buildUndoPlan,
  loadHistory, saveToHistory, clearHistory, buildShareUrl, parseShareUrl,
  validateExtension, normalizeExtension, EXTENSION_PRESETS,
  DEFAULT_OPTIONS,
  type ExtensionOptions, type FileEntry, type Mode, type FindMode, type CaseMode,
  type RenamePlan, type HistoryEntry,
} from "./logic";
import { Upload, FileText, X, History, Undo2, ArrowRight, Settings2 } from "lucide-react";
import { toast } from "sonner";

export default function FileExtensionChanger() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [options, setOptions] = useState<ExtensionOptions>(DEFAULT_OPTIONS);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [lastPlan, setLastPlan] = useState<RenamePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseShareUrl(window.location.hash);
    if (parsed) {
      setOptions((o) => ({ ...o, ...parsed }));
      toast.info("Loaded settings from shareable URL");
    }
  }, []);

  const update = <K extends keyof ExtensionOptions>(key: K, value: ExtensionOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const entries: FileEntry[] = Array.from(fileList).map((file, i) => ({
      id: `${i}-${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      file,
    }));
    setFiles((prev) => [...prev, ...entries]);
    setLastPlan(null);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const plan = useMemo(() => {
    if (files.length === 0) return null;
    return buildRenamePlan(files, options);
  }, [files, options]);

  // Validate the active extension input for the chosen mode
  const validation = useMemo(() => {
    if (options.mode === "add") return validateExtension(options.addExtension);
    if (options.mode === "replace") return validateExtension(options.replaceExtension);
    return { ok: true };
  }, [options]);

  const onApply = useCallback(() => {
    if (!plan) return;
    if (!validation.ok) {
      setError(validation.error ?? "Invalid extension");
      return;
    }
    setError(null);
    setLastPlan(plan.plan);
    const entry: HistoryEntry = {
      fileCount: plan.stats.total,
      changed: plan.stats.changed,
      mode: options.mode,
      options,
      renamedAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
    toast.success(`Extension change plan applied — ${plan.stats.changed} of ${plan.stats.total} files changed`);
  }, [plan, options, validation]);

  const onUndo = useCallback(() => {
    if (!lastPlan) {
      toast.error("No previous change to undo");
      return;
    }
    const undo = buildUndoPlan(lastPlan);
    toast.success(`Undo plan ready — ${undo.length} files would revert to original names`);
  }, [lastPlan]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="ext-changer-input"
            ref={fileInputRef}
            aria-label="Choose files to rename"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · drag-drop · add/remove/replace extensions</p>
          </button>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Files ({files.length})</Label>
              <button type="button" onClick={() => { setFiles([]); setLastPlan(null); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear all</button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {files.map((f) => (
                <div key={f.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="truncate font-mono"><FileText className="inline h-3 w-3 mr-1" />{f.name}</span>
                  <Badge variant="outline" className="text-[9px]">{f.size} B</Badge>
                  <button type="button" onClick={() => removeFile(f.id)} className="text-muted-foreground hover:text-red-600 cursor-pointer"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold inline-flex items-center gap-1"><Settings2 className="h-3 w-3" /> Extension rules</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mode</label>
                <select value={options.mode} onChange={(e) => update("mode", e.target.value as Mode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Mode">
                  <option value="add">Add extension</option>
                  <option value="remove">Remove extension</option>
                  <option value="replace">Replace extension</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Case conversion (extension)</label>
                <select value={options.caseMode} onChange={(e) => update("caseMode", e.target.value as CaseMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Case mode">
                  <option value="none">Keep as-is</option>
                  <option value="upper">UPPER (e.g. .TXT)</option>
                  <option value="lower">lower (e.g. .txt)</option>
                </select>
              </div>

              {options.mode === "add" && (
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-muted-foreground">Extension to add</label>
                  <Input value={options.addExtension} onChange={(e) => update("addExtension", e.target.value)} placeholder="txt" className="h-8 text-xs font-mono" aria-label="Extension to add" />
                </div>
              )}

              {options.mode === "replace" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Find mode</label>
                    <select value={options.findMode} onChange={(e) => update("findMode", e.target.value as FindMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Find mode">
                      <option value="plain">Plain text</option>
                      <option value="regex">Regex</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Find (empty = any extension)</label>
                    <Input value={options.findExtension} onChange={(e) => update("findExtension", e.target.value)} placeholder={options.findMode === "regex" ? "\\d+$" : "jpeg"} className="h-8 text-xs font-mono" aria-label="Find" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground">Replace with</label>
                    <Input value={options.replaceExtension} onChange={(e) => update("replaceExtension", e.target.value)} placeholder="jpg" className="h-8 text-xs font-mono" aria-label="Replace" />
                  </div>
                </>
              )}

              <div className="space-y-1 sm:col-span-2 flex flex-wrap gap-3">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={options.preserveStem} onChange={(e) => update("preserveStem", e.target.checked)} className="cursor-pointer" />
                  <span>Preserve filename stem</span>
                </label>
                {options.mode === "replace" && (
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={options.onlyIfMatches} onChange={(e) => update("onlyIfMatches", e.target.checked)} className="cursor-pointer" />
                    <span>Only change if find matches</span>
                  </label>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground self-center">Presets:</span>
              {EXTENSION_PRESETS.map((p) => (
                <button key={p.label} type="button"
                  onClick={() => {
                    if (options.mode === "add") update("addExtension", p.value);
                    else if (options.mode === "replace") update("replaceExtension", p.value);
                  }}
                  className="rounded-md border border-input bg-background px-2 py-1 text-[10px] cursor-pointer hover:bg-accent font-mono"
                  aria-label={`Use preset ${p.label}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {!validation.ok && (
              <p className="text-[10px] text-red-600">{validation.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {plan && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Stats</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total</p><p className="font-mono font-semibold">{plan.stats.total}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Changed</p><p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{plan.stats.changed}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Unchanged</p><p className="font-mono font-semibold">{plan.stats.unchanged}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Warnings</p><p className="font-mono font-semibold text-amber-600 dark:text-amber-400">{plan.stats.warnings}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Before → After preview</Label>
                <div className="flex gap-2 flex-wrap">
                  <RunButton onClick={onApply} label="Apply plan" size="sm" />
                  <button type="button" onClick={onUndo} disabled={!lastPlan} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer hover:bg-muted/30 disabled:opacity-50">
                    <Undo2 className="h-3 w-3" /> Undo
                  </button>
                  <CopyButton getText={() => planToCsv(plan.plan)} label="CSV" size="sm" />
                  <DownloadButton getText={() => planToJson(plan.plan, plan.stats, options)} filename="extension_change_plan.json" mime="application/json" label="JSON" size="sm" />
                  <ShareButton getUrl={() => buildShareUrl(options)} label="" size="icon-sm" />
                  <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                    <History className="h-3 w-3" /> ({history.length})
                  </button>
                </div>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {plan.plan.map((p, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0 ${p.warning ? "bg-amber-500/5" : ""}`}>
                    <span className="truncate font-mono text-muted-foreground" title={p.original}>{p.original}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className={`truncate font-mono ${p.changed ? "text-foreground font-semibold" : "text-muted-foreground"}`} title={p.renamed}>
                      {p.renamed}
                      {p.warning && <Badge variant="outline" className="ml-1 text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/30">⚠ {p.warning}</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {showHistory && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">History ({history.length})</Label>
              {history.length > 0 && (
                <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                    <p className="font-medium">{h.fileCount} files · {h.changed} renamed · {h.mode}</p>
                    <p className="text-[10px] text-muted-foreground">case: {h.options.caseMode} · {new Date(h.renamedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {files.length === 0 && !error && (
        <EmptyState
          title="Batch change file extensions"
          hint="Add · remove · replace · regex · case conversion · presets · conflict detection · undo · JSON export. 100% local."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all extension change logic runs in your browser. Your files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
