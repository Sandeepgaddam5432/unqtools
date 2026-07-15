"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  compressBatch, computeStat, aggregateStats,
  formatBytes, formatPercent,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, type HistoryEntry, type BatchStat,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  data: Uint8Array;
}

interface OutputResult {
  fileName: string;
  blob: Blob;
  stats: BatchStat;
}

export default function GzipCompressor() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [mode, setMode] = useState<"single" | "tar-gz">("single");
  const [outputFileName, setOutputFileName] = useState("compressed.gz");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<OutputResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(() => inputs.reduce((s, i) => s + i.size, 0), [inputs]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        newInputs.push({ fileName: file.name, size: file.size, data });
      } catch (e) {
        setError(`Failed to read ${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
    setResult(null);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }, []);

  const compress = useCallback(async () => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    setProgress({ current: 0, total: inputs.length });
    try {
      const effectiveName = mode === "tar-gz"
        ? (outputFileName.endsWith(".tar.gz") ? outputFileName : `${outputFileName.replace(/\.gz$|\.tar\.gz$/, "")}.tar.gz`)
        : outputFileName;
      const res = await compressBatch(
        inputs.map((i) => ({ fileName: i.fileName, data: i.data })),
        mode,
        effectiveName,
        (current, total) => setProgress({ current, total }),
      );
      setResult({ fileName: res.outputFileName, blob: res.blob, stats: res.stats });
      setHistory(saveToHistory({
        fileCount: res.stats.fileCount,
        totalOriginal: res.stats.totalOriginal,
        totalCompressed: res.stats.totalCompressed,
        totalSaved: res.stats.totalSaved,
        ratio: res.stats.ratio,
        mode,
        outputFileName: res.outputFileName,
        compressedAt: new Date().toISOString(),
      }));
      toast.success(`Compressed ${res.stats.fileCount} file${res.stats.fileCount === 1 ? "" : "s"} — saved ${formatBytes(res.stats.totalSaved)} (${formatPercent(res.stats.ratio)})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setProgress(null);
    }
  }, [inputs, mode, outputFileName]);

  const download = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${result.fileName}`);
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Compression options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select
                value={mode}
                onChange={(e) => {
                  const m = e.target.value as "single" | "tar-gz";
                  setMode(m);
                  if (m === "tar-gz" && !outputFileName.endsWith(".tar.gz")) {
                    setOutputFileName("archive.tar.gz");
                  } else if (m === "single" && outputFileName.endsWith(".tar.gz")) {
                    setOutputFileName("compressed.gz");
                  }
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Compression mode"
              >
                <option value="single">Single files (.gz each, ZIP if multiple)</option>
                <option value="tar-gz">Single archive (.tar.gz)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output filename</Label>
              <Input
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                aria-label="Output filename"
              />
            </div>
            <div className="flex items-end">
              <Badge variant="outline" className="text-[10px]">
                Level: default (browser-managed, ~6)
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl({ mode, outputFileName })} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="gzip-input"
            aria-label="Choose files to compress"
            ref={fileInputRef}
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
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · GZIP via CompressionStream · preserves original filename in header</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Input files ({inputs.length}) — {formatBytes(totalSize)}</Label>
              <button
                type="button"
                onClick={() => { setInputs([]); setResult(null); }}
                className="text-[10px] text-red-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {inputs.map((inp, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileArchive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs font-medium truncate">{inp.fileName}</p>
                    <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInput(i)}
                    className="p-1 rounded-md hover:bg-accent cursor-pointer"
                    aria-label={`Remove ${inp.fileName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Compress & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={compress}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {working ? `Compressing ${progress ? `(${progress.current}/${progress.total})` : "..."}` : "Compress"}
                </button>
                {result && (
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                )}
              </div>
            </div>
            {working && progress && (
              <div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {progress.current} / {progress.total} files
                </p>
              </div>
            )}
            {result && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Stat label="Files" value={String(result.stats.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                  <Stat label="Original" value={formatBytes(result.stats.totalOriginal)} />
                  <Stat label="Compressed" value={formatBytes(result.stats.totalCompressed)} />
                  <Stat label="Saved" value={formatBytes(result.stats.totalSaved)} accent />
                  <Stat label="Ratio" value={formatPercent(result.stats.ratio)} accent />
                </div>
                <div className="rounded-md border">
                  <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">Per-file breakdown</div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {result.stats.perFile.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                        <span className="truncate min-w-0 flex-1">{s.fileName}</span>
                        <span className="text-muted-foreground flex-shrink-0">{formatBytes(s.originalSize)} → {formatBytes(s.compressedSize)}</span>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">{formatPercent(s.ratio)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && !working && (
        <EmptyState
          title="Compress files to .gz"
          hint="Uses the browser's native CompressionStream API. Batch compress, .tar.gz support, before/after stats. 100% local."
          icon={<FileArchive className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
          >
            <History className="h-3 w-3" /> History ({history.length})
          </button>
          {showHistory && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Recent batches</Label>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.outputFileName} <Badge variant="outline" className="text-[9px] ml-1">{h.mode === "tar-gz" ? "tar.gz" : "single"}</Badge></p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.fileCount} file{h.fileCount === 1 ? "" : "s"} · {formatBytes(h.totalOriginal)} → {formatBytes(h.totalCompressed)} · saved {formatBytes(h.totalSaved)} ({formatPercent(h.ratio)}) · {new Date(h.compressedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all GZIP compression runs in your browser via the native CompressionStream API. File contents never leave your device. Only batch summaries (filenames + sizes) are saved to local history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
