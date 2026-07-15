"use client";
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  splitBytes, downloadPart, downloadManifest, mergeInstructions,
  manifestFilename, formatBytes, formatHexPreview, parseSizeString,
  buildShareUrl, parseShareUrl,
  loadHistory, saveToHistory, clearHistory,
  PART_SIZE_PRESETS,
  DEFAULT_OPTIONS, type SplitOptions, type SplitMode,
  type SplitResult, type HistoryEntry,
} from "./logic";
import { Upload, Scissors, Download, FileCheck2, History, ListChecks } from "lucide-react";

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500MB safety cap

export default function OnlineFileSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [options, setOptions] = useState<SplitOptions>(DEFAULT_OPTIONS);
  const [sizeInput, setSizeInput] = useState<string>("1 MB");
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<SplitResult | null>(null);
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

  const update = <K extends keyof SplitOptions>(key: K, value: SplitOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    setError(null);
    setResult(null);
    if (f.size > MAX_FILE_BYTES) {
      setError(`File too large (${formatBytes(f.size)}). Maximum supported is ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setWorking(true);
    setProgress(0);
    try {
      const buf = await f.arrayBuffer();
      setFile(f);
      setFileBytes(new Uint8Array(buf));
      toast.success(`Loaded ${f.name} (${formatBytes(f.size)})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const onSplit = useCallback(async () => {
    if (!fileBytes || !file) {
      toast.error("Drop a file first");
      return;
    }
    setError(null);
    setWorking(true);
    setProgress(0);
    try {
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const result = await splitBytes(fileBytes, baseName, options, (p) => setProgress(p));
      setResult(result);
      const entry: HistoryEntry = {
        filename: file.name,
        totalSize: result.totalSize,
        partCount: result.partCount,
        partSize: result.partSize,
        mode: options.mode,
        splitAt: new Date().toISOString(),
      };
      setHistory(saveToHistory(entry));
      toast.success(`Split into ${result.partCount} part(s)`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [fileBytes, file, options]);

  const onDownloadAll = useCallback(() => {
    if (!result) return;
    for (const p of result.parts) downloadPart(p);
    downloadManifest(result.baseName, result.manifest);
    toast.success(`Downloading ${result.parts.length} part(s) + manifest`);
  }, [result]);

  const onParseSizeInput = useCallback(() => {
    const bytes = parseSizeString(sizeInput);
    if (bytes === null) {
      toast.error("Invalid size (use e.g. '1 MB' or '500 KB')");
      return;
    }
    update("partSize", bytes);
    update("mode", "partSize");
    toast.success(`Set part size to ${formatBytes(bytes)}`);
  }, [sizeInput]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="split-input"
            ref={fileInputRef}
            aria-label="Choose file to split"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">HJSplit-compatible · CRC32 + SHA-256 · merge instructions · 100% local</p>
          </button>
        </CardContent>
      </Card>

      {file && fileBytes && !result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold inline-flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> {file.name}</Label>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {fileBytes.length.toLocaleString()} bytes</p>
          </CardContent>
        </Card>
      )}

      {file && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Split options</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mode</label>
                <select value={options.mode} onChange={(e) => update("mode", e.target.value as SplitMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Split mode">
                  <option value="partSize">By part size</option>
                  <option value="partCount">By number of parts</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">{options.mode === "partSize" ? "Part size (KB/MB/GB)" : "Number of parts"}</label>
                {options.mode === "partSize" ? (
                  <div className="flex gap-1">
                    <Input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} placeholder="1 MB" className="h-8 text-xs font-mono" aria-label="Part size input" onKeyDown={(e) => { if (e.key === "Enter") onParseSizeInput(); }} />
                    <button type="button" onClick={onParseSizeInput} className="h-8 rounded-md border border-input bg-background px-3 text-xs cursor-pointer hover:bg-accent">Set</button>
                  </div>
                ) : (
                  <Input type="number" min={1} max={10000} value={options.partCount} onChange={(e) => update("partCount", Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-xs" aria-label="Part count" />
                )}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] text-muted-foreground">Naming template (placeholders: {"{base}"}, {"{n}"}, {"{index}"})</label>
                <Input value={options.template} onChange={(e) => update("template", e.target.value)} className="h-8 text-xs font-mono" aria-label="Naming template" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Pad width (digits for part number)</label>
                <Input type="number" min={1} max={10} value={options.padWidth} onChange={(e) => update("padWidth", Math.max(1, parseInt(e.target.value) || 3))} className="h-8 text-xs" aria-label="Pad width" />
              </div>
            </div>
            {options.mode === "partSize" && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-muted-foreground self-center">Presets:</span>
                {PART_SIZE_PRESETS.map((p) => (
                  <button key={p.label} type="button"
                    onClick={() => { update("partSize", p.bytes); setSizeInput(p.label); update("mode", "partSize"); }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-[10px] cursor-pointer hover:bg-accent font-mono"
                    aria-label={`Set part size to ${p.label}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {file && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Split</Label>
              <div className="flex gap-2">
                <button type="button" onClick={onSplit} disabled={working} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 cursor-pointer inline-flex items-center gap-1 disabled:opacity-50">
                  <Scissors className="h-3 w-3" /> {working ? "Splitting..." : "Split file"}
                </button>
                <ShareButton getUrl={() => buildShareUrl(options)} label="" size="icon-sm" />
              </div>
            </div>
            {working && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Splitting...</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Stats</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total size</p><p className="font-mono font-semibold">{formatBytes(result.totalSize)}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Parts</p><p className="font-mono font-semibold">{result.partCount}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Part size</p><p className="font-mono font-semibold">{formatBytes(result.partSize)}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Last part</p><p className="font-mono font-semibold">{formatBytes(result.lastPartSize)}</p></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={onDownloadAll} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent cursor-pointer inline-flex items-center gap-1">
                  <Download className="h-3 w-3" /> Download all parts + manifest
                </button>
                <DownloadButton getText={() => result.manifest} filename={manifestFilename(result.baseName)} mime="text/plain" label="Download manifest" size="sm" />
                <CopyButton getText={() => result.manifest} label="Copy manifest" size="sm" />
                <button type="button" onClick={() => setShowInstructions(!showInstructions)} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                  <ListChecks className="h-3 w-3" /> Merge instructions
                </button>
              </div>
            </CardContent>
          </Card>

          {showInstructions && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">How to rejoin</Label>
                <pre className="text-[11px] whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded">{mergeInstructions(result.baseName, result.partCount)}</pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Parts ({result.parts.length})</Label>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {result.parts.map((p, i) => (
                  <div key={i} className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-mono truncate">{p.filename}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant="outline" className="text-[9px]">{formatBytes(p.size)}</Badge>
                        <button type="button" onClick={() => downloadPart(p)} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1" aria-label={`Download ${p.filename}`}>
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="text-muted-foreground">CRC32: </span>
                        <code className="font-mono">{p.crc32}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SHA-256: </span>
                        <code className="font-mono break-all">{p.sha256.slice(0, 16)}...</code>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">First 16 bytes (hex):</p>
                      <pre className="overflow-auto rounded bg-muted/30 p-1.5 font-mono text-[10px] leading-relaxed whitespace-pre">
                        {formatHexPreview(p.previewHex)}
                      </pre>
                    </div>
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
                        <p className="font-medium truncate">{h.filename}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(h.totalSize)} · {h.partCount} parts · {formatBytes(h.partSize)} each · {new Date(h.splitAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!file && !error && !working && (
        <EmptyState title="Split any file into smaller parts" hint="HJSplit-compatible (.001/.002/...) · CRC32 + SHA-256 manifest · merge instructions · progress bar · 100% local." icon={<Scissors className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all splitting runs in your browser. Your file never leaves your device. Only filenames + sizes are saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
