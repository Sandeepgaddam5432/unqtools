"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  encodeFiles, isLargeFile, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  DEFAULT_OPTIONS,
  type EncodeOptions, type EncodeResult, type HistoryEntry, type OutputMode,
} from "./logic";
import { Upload, Binary, AlertTriangle, History, FileDown, X } from "lucide-react";

export default function Base64FileEncoder() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<EncodeResult[] | null>(null);
  const [options, setOptions] = useState<EncodeOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const update = <K extends keyof EncodeOptions>(key: K, value: EncodeOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleFiles = useCallback(async (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);
    if (fileArray.length === 0) return;
    // Warn for large files
    const large = fileArray.filter((f) => isLargeFile(f.size));
    if (large.length > 0) {
      toast.warning(`${large.length} large file(s) (>2MB) — encoding may take a moment.`);
    }
    setFiles((prev) => [...prev, ...fileArray]);
    setError(null);
    setWorking(true);
    setProgress(0);
    try {
      const rs = await encodeFiles(fileArray, options, (_i, pct) => setProgress(pct));
      setResults(rs);
      // Save first 3 to history
      for (const r of rs.slice(0, 3)) {
        const entry: HistoryEntry = {
          filename: r.filename,
          size: r.size,
          mime: r.mime,
          mode: options.mode,
          outputSize: r.outputSize,
          encodedAt: new Date().toISOString(),
        };
        setHistory(saveToHistory(entry));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setProgress(100);
    }
  }, [options]);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (results) setResults(results.filter((_, i) => i !== idx));
  };

  const onModeChange = (mode: OutputMode) => {
    update("mode", mode);
    // Re-encode if files are loaded
    if (files.length > 0) {
      const opts2 = { ...options, mode };
      setWorking(true);
      encodeFiles(files, opts2, (_i, pct) => setProgress(pct))
        .then((rs) => setResults(rs))
        .catch((e) => setError((e as Error).message))
        .finally(() => { setWorking(false); setProgress(100); });
    }
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="b64-enc-input"
            ref={fileInputRef}
            aria-label="Choose files to encode"
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
            <p className="mt-1 text-xs text-muted-foreground">Batch encode · URL-safe · data URL · line-wrapped · 100% local</p>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Output mode</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ["raw", "Raw Base64"],
              ["dataUrl", "Data URL"],
              ["urlSafe", "URL-safe"],
              ["wrapped", "Line-wrapped"],
            ] as Array<[OutputMode, string]>).map(([mode, label]) => (
              <button key={mode} type="button" onClick={() => onModeChange(mode)}
                className={`rounded-md border px-3 py-2 text-xs cursor-pointer ${options.mode === mode ? "bg-primary/10 border-primary/30 font-semibold" : "bg-background border-input"}`}
                aria-pressed={options.mode === mode}>
                {label}
              </button>
            ))}
          </div>
          {options.mode === "wrapped" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Wrap width:</label>
              <Input type="number" min={8} max={200} value={options.wrapWidth} onChange={(e) => update("wrapWidth", parseInt(e.target.value) || 76)} className="h-8 w-20 text-xs" aria-label="Wrap width" />
              <span className="text-xs text-muted-foreground">chars per line (RFC 2045 = 76)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Encoding... {progress}%
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {results && !working && results.length > 0 && (
        <>
          {results.map((r, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Binary className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{r.filename}</span>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{r.mime}</Badge>
                    {isLargeFile(r.size) && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Large
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <CopyButton getText={() => r.base64} label="Copy" size="sm" />
                    <DownloadButton getText={() => r.base64} filename={`${r.filename}.b64`} mime="text/plain" label=".b64" size="sm" />
                    <button type="button" onClick={() => removeFile(i)} className="text-xs text-red-600 hover:underline cursor-pointer inline-flex items-center gap-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Input</span>
                    <span className="font-mono">{r.sizeHuman} ({r.size.toLocaleString()} B)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Output</span>
                    <span className="font-mono">{r.outputSizeHuman} ({r.outputSize.toLocaleString()} chars)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Overhead</span>
                    <span className="font-mono">+{r.overhead.toFixed(1)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Preview (first 500 chars):</p>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed break-all max-h-[120px]">{r.preview}{r.base64.length > 500 ? "..." : ""}</pre>
                </div>
              </CardContent>
            </Card>
          ))}

          {results.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Batch summary</Label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Files</span>
                    <span className="font-mono">{results.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total input</span>
                    <span className="font-mono">{formatBytes(results.reduce((s, r) => s + r.size, 0))}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total output</span>
                    <span className="font-mono">{formatBytes(results.reduce((s, r) => s + r.outputSize, 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

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
                    <p className="font-medium truncate">{h.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(h.size)} → {formatBytes(h.outputSize)} · {h.mode} · {new Date(h.encodedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {!files.length && !error && (
        <EmptyState title="Drop files to encode" hint="Raw · Data URL · URL-safe · line-wrapped · batch · stats. 100% local, no upload." icon={<FileDown className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encoding runs in your browser. Files never leave your device. Only filenames + sizes are saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
