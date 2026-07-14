"use client";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  generateBatch, generateFile, downloadFile, formatBytes, formatHexPreview,
  fileInfoToJson, buildShareUrl, parseShareUrl,
  loadHistory, saveToHistory, clearHistory,
  SIZE_PRESETS,
  DEFAULT_OPTIONS, type CreateOptions, type FillPattern, type SizeUnit,
  type GeneratedFile, type HistoryEntry,
} from "./logic";
import { FilePlus, History, Download, FileCheck2 } from "lucide-react";

export default function EmptyFileCreator() {
  const [options, setOptions] = useState<CreateOptions>(DEFAULT_OPTIONS);
  const [count, setCount] = useState<number>(1);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const update = <K extends keyof CreateOptions>(key: K, value: CreateOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  // Apply settings from shareable URL on first load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseShareUrl(window.location.hash);
    if (parsed) {
      setOptions((prev) => ({ ...prev, ...parsed.options }));
      setCount(parsed.count);
      toast.info("Loaded settings from shareable URL");
    }
  }, []);

  const onGenerate = useCallback(() => {
    setError(null);
    const totalBytes = count * options.size * (options.unit === "B" ? 1 : options.unit === "KB" ? 1024 : options.unit === "MB" ? 1024 * 1024 : 1024 * 1024 * 1024);
    if (totalBytes > 500 * 1024 * 1024) {
      toast.warning(`Generating ${formatBytes(totalBytes)} — this may take a moment and use significant memory.`);
    }
    if (totalBytes > 2 * 1024 * 1024 * 1024) {
      setError(`Total size (${formatBytes(totalBytes)}) exceeds 2GB browser limit. Reduce file size or count.`);
      return;
    }
    try {
      const generated = generateBatch(options, count);
      setFiles(generated);
      const entry: HistoryEntry = {
        count,
        totalSize: totalBytes,
        pattern: options.pattern,
        extension: options.extension,
        createdAt: new Date().toISOString(),
      };
      setHistory(saveToHistory(entry));
      toast.success(`Generated ${count} file(s)`);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [options, count]);

  const onDownloadAll = useCallback(() => {
    if (files.length === 0) return;
    for (const f of files) downloadFile(f);
    toast.success(`Downloading ${files.length} file(s)`);
  }, [files]);

  const onDownloadOne = useCallback((f: GeneratedFile) => {
    downloadFile(f);
    toast.success(`Downloaded ${f.filename}`);
  }, []);

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">File size</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Size</label>
              <Input type="number" min={0} step={0.1} value={options.size} onChange={(e) => update("size", parseFloat(e.target.value) || 0)} className="h-8 text-xs" aria-label="Size" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Unit</label>
              <select value={options.unit} onChange={(e) => update("unit", e.target.value as SizeUnit)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Unit">
                <option value="B">Bytes</option>
                <option value="KB">KB (1024 B)</option>
                <option value="MB">MB (1024² B)</option>
                <option value="GB">GB (1024³ B)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Fill pattern</label>
              <select value={options.pattern} onChange={(e) => update("pattern", e.target.value as FillPattern)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Fill pattern">
                <option value="zeros">Zeros (0x00)</option>
                <option value="random">Cryptographic random</option>
                <option value="0xff">0xFF</option>
                <option value="sequential">Sequential (0..255)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Count</label>
              <Input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} className="h-8 text-xs" aria-label="Number of files" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SIZE_PRESETS.map((p) => (
              <button key={p.label} type="button"
                onClick={() => { update("size", p.size); update("unit", p.unit); }}
                className="rounded-md border border-input bg-background px-2 py-1 text-[10px] cursor-pointer hover:bg-accent"
                aria-label={`Set size to ${p.label}`}>
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Filename</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] text-muted-foreground">Template (use {"{n}"} for index)</label>
              <Input value={options.filenameTemplate} onChange={(e) => update("filenameTemplate", e.target.value)} className="h-8 text-xs font-mono" aria-label="Filename template" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Extension</label>
              <Input value={options.extension} onChange={(e) => update("extension", e.target.value)} className="h-8 text-xs" aria-label="Extension" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Start index</label>
              <Input type="number" min={0} value={options.startIndex} onChange={(e) => update("startIndex", parseInt(e.target.value) || 0)} className="h-8 text-xs" aria-label="Start index" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Index padding (digits)</label>
              <Input type="number" min={0} max={10} value={options.padWidth} onChange={(e) => update("padWidth", parseInt(e.target.value) || 0)} className="h-8 text-xs" aria-label="Index padding width" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Preview: <code className="font-mono bg-muted/30 px-1 rounded">{options.filenameTemplate.replace(/\{n\}/g, String(options.startIndex).padStart(options.padWidth, "0"))}.{options.extension}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Generate</Label>
            <div className="flex gap-2">
              <button type="button" onClick={onGenerate} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 cursor-pointer inline-flex items-center gap-1">
                <FilePlus className="h-3 w-3" /> Generate {count} file(s)
              </button>
              {files.length > 0 && (
                <button type="button" onClick={onDownloadAll} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent cursor-pointer inline-flex items-center gap-1">
                  <Download className="h-3 w-3" /> Download all
                </button>
              )}
              <ShareButton getUrl={() => buildShareUrl(options, count)} label="Share settings" size="sm" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Total size: <span className="font-mono">{formatBytes(count * options.size * (options.unit === "B" ? 1 : options.unit === "KB" ? 1024 : options.unit === "MB" ? 1024 * 1024 : 1024 * 1024 * 1024))}</span>
            {count > 1 && <span> · {count} files</span>}
          </p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {files.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Generated files ({files.length})</Label>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Total: {formatBytes(totalSize)}
                  </Badge>
                  <CopyButton getText={() => fileInfoToJson(files)} label="Copy info" size="sm" />
                </div>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-mono truncate">{f.filename}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">{formatBytes(f.size)}</Badge>
                        <Badge variant="outline" className="text-[10px]">{f.pattern}</Badge>
                        <button type="button" onClick={() => onDownloadOne(f)} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {f.size > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">First 64 bytes (hex):</p>
                        <pre className="overflow-auto rounded bg-muted/30 p-1.5 font-mono text-[10px] leading-relaxed whitespace-pre">
                          {formatHexPreview(f.previewHex)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold inline-flex items-center gap-1"><History className="h-3 w-3" /> History ({history.length})</Label>
                {history.length > 0 && (
                  <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
                )}
              </div>
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                {showHistory ? "Hide" : "Show"} history
              </button>
              {showHistory && (
                history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history yet.</p>
                ) : (
                  <div className="space-y-1 max-h-[160px] overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                        <p className="font-medium">{h.count} file(s) · {formatBytes(h.totalSize)} · {h.pattern}</p>
                        <p className="text-[10px] text-muted-foreground">.{h.extension} · {new Date(h.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}

      {files.length === 0 && !error && (
        <EmptyState title="Configure and generate dummy files" hint="Zeros · random · 0xFF · sequential · size presets · templates · batch · shareable URL. 100% local." icon={<FilePlus className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all file generation runs in your browser. Files never leave your device. Only counts + sizes are saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
