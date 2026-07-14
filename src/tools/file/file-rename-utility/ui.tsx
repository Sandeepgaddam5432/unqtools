"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState, RunButton } from "../../_shared";
import {
  buildRenamePlan, planToJson, planToCsv, buildUndoPlan,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_OPTIONS,
  type RenameOptions, type FileEntry, type CaseConversion, type FindMode, type SortKey, type RenameHistoryEntry, type RenamePlan,
} from "./logic";
import { createZipBlob } from "../csv-file-splitter/logic";
import { Upload, FileText, X, History, PencilLine, Undo2, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function FileRenameUtility() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [options, setOptions] = useState<RenameOptions>(DEFAULT_OPTIONS);
  const [history, setHistory] = useState<RenameHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [lastPlan, setLastPlan] = useState<RenamePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (!h) return;
    const params = new URLSearchParams(h.slice(1));
    setOptions((o) => ({
      ...o,
      find: params.get("find") ?? o.find,
      replace: params.get("replace") ?? o.replace,
      findMode: (params.get("mode") as FindMode) ?? o.findMode,
      caseConversion: (params.get("case") as CaseConversion) ?? o.caseConversion,
      prefix: params.get("prefix") ?? o.prefix,
      suffix: params.get("suffix") ?? o.suffix,
      pattern: params.get("pattern") ?? o.pattern,
      numberPad: parseInt(params.get("pad") ?? String(o.numberPad)) || o.numberPad,
      numberStart: parseInt(params.get("start") ?? String(o.numberStart)) || o.numberStart,
    }));
  }, []);

  const update = <K extends keyof RenameOptions>(key: K, value: RenameOptions[K]) => {
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

  const onApply = useCallback(() => {
    if (!plan) return;
    setLastPlan(plan.plan);
    const entry: RenameHistoryEntry = {
      fileCount: plan.stats.total,
      changed: plan.stats.changed,
      options,
      renamedAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
    toast.success(`Rename plan generated — ${plan.stats.changed} of ${plan.stats.total} files changed`);
  }, [plan, options]);

  const onUndo = useCallback(() => {
    if (!lastPlan) {
      toast.error("No previous rename to undo");
      return;
    }
    const undo = buildUndoPlan(lastPlan);
    toast.success(`Undo plan ready — ${undo.length} files would revert to original names`);
    // Display undo in console (a real in-browser rename would require File System Access API)
  }, [lastPlan]);

  const downloadZip = useCallback(async () => {
    if (!plan) return;
    const changed = plan.plan.filter((p) => p.changed);
    if (changed.length === 0) {
      toast.error("No renamed files to download");
      return;
    }
    // Build a map: original FileEntry → renamed
    const fileMap = new Map(files.map((f) => [f.name, f.file]));
    const zipEntries: Array<{ name: string; content: string }> = [];
    for (const p of changed) {
      const f = fileMap.get(p.original);
      if (!f) continue;
      const text = await f.text().catch(() => "");
      zipEntries.push({ name: p.renamed, content: text });
    }
    if (zipEntries.length === 0) {
      toast.error("Could not read file contents (binary files not supported in ZIP preview)");
      return;
    }
    const blob = createZipBlob(zipEntries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "renamed_files.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${zipEntries.length} renamed files as ZIP`);
  }, [plan, files]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="rename-input"
            aria-label="Choose files to rename"
          />
          <button
            type="button"
            onClick={() => document.getElementById("rename-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · drag-drop · sort before renaming</p>
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
            <Label className="text-sm font-semibold">Rename rules</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Pattern (placeholders: {`{name}`}, {`{n}`}, {`{base}`})</label>
                <Input value={options.pattern} onChange={(e) => update("pattern", e.target.value)} className="h-8 text-xs font-mono" aria-label="Naming pattern" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Find mode</label>
                <select value={options.findMode} onChange={(e) => update("findMode", e.target.value as FindMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Find mode">
                  <option value="plain">Plain text</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Find</label>
                <Input value={options.find} onChange={(e) => update("find", e.target.value)} placeholder={options.findMode === "regex" ? "\\d+" : "old"} className="h-8 text-xs font-mono" aria-label="Find" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Replace</label>
                <Input value={options.replace} onChange={(e) => update("replace", e.target.value)} placeholder="new" className="h-8 text-xs font-mono" aria-label="Replace" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Case conversion</label>
                <select value={options.caseConversion} onChange={(e) => update("caseConversion", e.target.value as CaseConversion)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Case conversion">
                  <option value="none">None</option>
                  <option value="upper">UPPER</option>
                  <option value="lower">lower</option>
                  <option value="title">Title Case</option>
                  <option value="kebab">kebab-case</option>
                  <option value="camel">camelCase</option>
                  <option value="snake">snake_case</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Prefix / Suffix</label>
                <div className="flex gap-1">
                  <Input value={options.prefix} onChange={(e) => update("prefix", e.target.value)} placeholder="prefix_" className="h-8 text-xs font-mono" aria-label="Prefix" />
                  <Input value={options.suffix} onChange={(e) => update("suffix", e.target.value)} placeholder="_suffix" className="h-8 text-xs font-mono" aria-label="Suffix" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Numbering (start / pad width)</label>
                <div className="flex gap-1">
                  <Input type="number" min={0} value={options.numberStart} onChange={(e) => update("numberStart", Math.max(0, parseInt(e.target.value) || 0))} className="h-8 text-xs" aria-label="Number start" />
                  <Input type="number" min={1} max={10} value={options.numberPad} onChange={(e) => update("numberPad", Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-xs" aria-label="Number pad" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Sort by (before numbering)</label>
                <div className="flex gap-1">
                  <select value={options.sortKey} onChange={(e) => update("sortKey", e.target.value as SortKey)} className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Sort key">
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="date">Date</option>
                    <option value="none">None</option>
                  </select>
                  <select value={options.sortDir} onChange={(e) => update("sortDir", e.target.value as "asc" | "desc")} className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Sort direction">
                    <option value="asc">asc</option>
                    <option value="desc">desc</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Remove chars / Keep alphanumeric only</label>
                <div className="flex gap-1">
                  <Input value={options.removeChars} onChange={(e) => update("removeChars", e.target.value)} placeholder=" -_?" className="h-8 text-xs font-mono" aria-label="Remove characters" />
                  <button type="button" onClick={() => update("keepAlphanumericOnly", !options.keepAlphanumericOnly)} className={`h-8 rounded-md border px-2 text-xs cursor-pointer ${options.keepAlphanumericOnly ? "bg-primary/10 border-primary/30" : "bg-background border-input"}`} aria-label="Keep alphanumeric only">aA1</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Extension / Truncate</label>
                <div className="flex gap-1">
                  <Input value={options.changeExtension} onChange={(e) => update("changeExtension", e.target.value)} placeholder="new ext" className="h-8 text-xs font-mono" aria-label="Change extension" />
                  <Input type="number" min={0} value={options.maxLength} onChange={(e) => update("maxLength", Math.max(0, parseInt(e.target.value) || 0))} placeholder="max len" className="h-8 text-xs" aria-label="Max length" />
                  <button type="button" onClick={() => update("removeExtension", !options.removeExtension)} className={`h-8 rounded-md border px-2 text-xs cursor-pointer ${options.removeExtension ? "bg-primary/10 border-primary/30" : "bg-background border-input"}`} aria-label="Remove extension">.ext</button>
                </div>
              </div>
            </div>
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
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Before → After preview</Label>
                <div className="flex gap-2 flex-wrap">
                  <RunButton onClick={onApply} label="Apply plan" size="sm" />
                  <button type="button" onClick={onUndo} disabled={!lastPlan} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer hover:bg-muted/30 disabled:opacity-50">
                    <Undo2 className="h-3 w-3" /> Undo
                  </button>
                  <button type="button" onClick={downloadZip} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer hover:bg-muted/30">
                    <Download className="h-3 w-3" /> Download ZIP
                  </button>
                  <CopyButton getText={() => planToCsv(plan.plan)} label="CSV" size="sm" />
                  <DownloadButton getText={() => planToJson(plan.plan, plan.stats)} filename="rename_plan.json" mime="application/json" label="JSON" size="sm" />
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
                    <p className="font-medium">{h.fileCount} files · {h.changed} renamed</p>
                    <p className="text-[10px] text-muted-foreground">pattern: {h.options.pattern || "{name}"} · case: {h.options.caseConversion} · {new Date(h.renamedAt).toLocaleString()}</p>
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
          title="Batch rename files with patterns"
          hint="Find/replace (regex supported) · sequential numbering · case conversion · prefix/suffix · truncate · extension change · undo · JSON export. 100% local."
          icon={<PencilLine className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all rename logic runs in your browser. Your files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
