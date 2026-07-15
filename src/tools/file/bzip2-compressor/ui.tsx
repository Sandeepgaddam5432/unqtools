"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  compressBatch, formatBytes, formatPercent, hexPreview,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, type HistoryEntry, type BatchStat,
  type Bzip2BlockSize,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, Eye,
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
  preview: string;
}

export default function Bzip2Compressor() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [mode, setMode] = useState<"single" | "tar-bz2">("single");
  const [blockSize, setBlockSize] = useState<Bzip2BlockSize>(9);
  const [outputFileName, setOutputFileName] = useState("compressed.bz2");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<OutputResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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

  const compress = useCallback(() => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      const effectiveName = mode === "tar-bz2"
        ? (outputFileName.endsWith(".tar.bz2") ? outputFileName : `${outputFileName.replace(/\.bz2$|\.tar\.bz2$/, "")}.tar.bz2`)
        : outputFileName;
      const res = compressBatch(
        inputs.map((i) => ({ fileName: i.fileName, data: i.data })),
        mode, effectiveName, blockSize,
      );
      setResult({ fileName: res.outputFileName, blob: res.blob, stats: res.stats, preview: res.preview });
      setHistory(saveToHistory({
        fileCount: res.stats.fileCount,
        totalOriginal: res.stats.totalOriginal,
        totalCompressed: res.stats.totalCompressed,
        totalSaved: res.stats.totalSaved,
        ratio: res.stats.ratio,
        blockSize,
        mode,
        outputFileName: res.outputFileName,
        compressedAt: new Date().toISOString(),
      }));
      toast.success(`Compressed ${res.stats.fileCount} file${res.stats.fileCount === 1 ? "" : "s"} — saved ${formatBytes(res.stats.totalSaved)} (${formatPercent(res.stats.ratio)})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [inputs, mode, blockSize, outputFileName]);

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
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Compression options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select
                value={mode}
                onChange={(e) => {
                  const m = e.target.value as "single" | "tar-bz2";
                  setMode(m);
                  if (m === "tar-bz2" && !outputFileName.endsWith(".tar.bz2")) {
                    setOutputFileName("archive.tar.bz2");
                  } else if (m === "single" && outputFileName.endsWith(".tar.bz2")) {
                    setOutputFileName("compressed.bz2");
                  }
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Compression mode"
              >
                <option value="single">Single files (.bz2 each, ZIP if multiple)</option>
                <option value="tar-bz2">Single archive (.tar.bz2)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Block size (1-9)</Label>
              <select
                value={blockSize}
                onChange={(e) => setBlockSize(Number(e.target.value) as Bzip2BlockSize)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Block size"
              >
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} ({n * 100} KB buffer)</option>
                ))}
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
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl({ blockSize, mode, outputFileName })} label="Share options" size="sm" />
            <Badge variant="outline" className="text-[10px]">
              BWT: not implemented (honest stub)
            </Badge>
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
            id="bzip2-input"
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
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · BZIP2 header + RLE1 body (simplified) · .tar.bz2 support</p>
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
                  {working ? "Compressing..." : "Compress"}
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
                {result && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> {showPreview ? "Hide" : "Preview"}
                  </button>
                )}
              </div>
            </div>
            {result && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Stat label="Files" value={String(result.stats.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                  <Stat label="Original" value={formatBytes(result.stats.totalOriginal)} />
                  <Stat label="Compressed" value={formatBytes(result.stats.totalCompressed)} />
                  <Stat label="Saved" value={formatBytes(result.stats.totalSaved)} accent />
                  <Stat label="Ratio" value={formatPercent(result.stats.ratio)} accent />
                </div>
                {showPreview && (
                  <pre className="text-[10px] font-mono bg-muted/40 p-2 rounded-md overflow-x-auto max-h-[200px] overflow-y-auto">
                    {result.preview || "(no preview)"}
                  </pre>
                )}
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
          title="Compress files to .bz2"
          hint="Pure-JS BZIP2 header generation + RLE1 body. .tar.bz2 support, before/after stats, hex preview. 100% local. Honest about BWT limitation."
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
                      <p className="font-medium truncate">{h.outputFileName} <Badge variant="outline" className="text-[9px] ml-1">{h.mode === "tar-bz2" ? "tar.bz2" : "single"}</Badge></p>
                      <p className="text-[10px] text-muted-foreground">
                        block size {h.blockSize} · {h.fileCount} file{h.fileCount === 1 ? "" : "s"} · {formatBytes(h.totalOriginal)} → {formatBytes(h.totalCompressed)} · saved {formatBytes(h.totalSaved)} ({formatPercent(h.ratio)}) · {new Date(h.compressedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all BZIP2 header generation runs in your browser via pure JavaScript. File contents never leave your device. This tool produces a structurally valid BZIP2 stream header with a simplified RLE1 body — full BWT compression is NOT implemented. Standard bzip2 tools may reject the output; use our BZIP2 Decompressor to roundtrip. Only batch summaries (filenames + sizes) are saved to local history.
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
