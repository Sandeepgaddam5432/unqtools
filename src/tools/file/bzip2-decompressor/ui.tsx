"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  decompressBatch, isBzip2Magic, parseBzip2Header,
  formatBytes, hexPreview,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type BatchStat, type TarEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, Eye, FileText,
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
  tarEntries?: TarEntry[];
  decompressedBytes?: Uint8Array;
}

export default function Bzip2Decompressor() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [autoExtractTar, setAutoExtractTar] = useState(true);
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

  const decompress = useCallback(() => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      const res = decompressBatch(
        inputs.map((i) => ({ fileName: i.fileName, data: i.data })),
        autoExtractTar,
      );
      setResult({
        fileName: res.outputFileName, blob: res.blob, stats: res.stats,
        preview: res.preview, tarEntries: res.tarEntries, decompressedBytes: res.decompressedBytes,
      });
      const tarBz2Count = res.stats.perFile.filter((s) => s.isTarBz2).length;
      setHistory(saveToHistory({
        fileCount: res.stats.fileCount,
        totalCompressed: res.stats.totalCompressed,
        totalDecompressed: res.stats.totalDecompressed,
        tarBz2Count,
        decompressedAt: new Date().toISOString(),
      }));
      const successCount = res.stats.perFile.filter((s) => !s.error).length;
      if (successCount === res.stats.fileCount) {
        toast.success(`Decompressed ${successCount} file${successCount === 1 ? "" : "s"} — ${formatBytes(res.stats.totalDecompressed)}`);
      } else {
        toast.error(`Decompressed ${successCount}/${res.stats.fileCount} files — see errors`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [inputs, autoExtractTar]);

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

  const downloadTarEntry = useCallback((entry: TarEntry) => {
    if (!result?.decompressedBytes) return;
    const data = result.decompressedBytes.subarray(entry.dataOffset, entry.dataOffset + entry.size);
    const blob = new Blob([data as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.name.split("/").pop() ?? entry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${entry.name}`);
  }, [result]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Decompression options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-tar"
                checked={autoExtractTar}
                onChange={(e) => setAutoExtractTar(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="auto-tar" className="text-xs cursor-pointer">
                Auto-extract .tar.bz2 (list files inside TAR)
              </Label>
            </div>
            <div className="flex items-end">
              <ShareButton getUrl={() => buildShareUrl({ outputFileName: "decompressed.bin", autoExtractTar })} label="Share options" size="sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".bz2,.tar.bz2,application/x-bzip2"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="bzip2-input"
            aria-label="Choose .bz2 files to decompress"
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
            <p className="text-sm font-medium">Drop .bz2 files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · BZIP2 header parsing · .tar.bz2 auto-extract · MIME detection</p>
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
              {inputs.map((inp, i) => {
                const isValid = isBzip2Magic(inp.data);
                const header = parseBzip2Header(inp.data);
                return (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileArchive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs font-medium truncate">{inp.fileName}</p>
                      <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                      {isValid ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          BZ valid · block {header.blockSize}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">
                          Invalid BZ
                        </Badge>
                      )}
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Decompress & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={decompress}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {working ? "Decompressing..." : "Decompress"}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Files" value={String(result.stats.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                  <Stat label="Compressed" value={formatBytes(result.stats.totalCompressed)} />
                  <Stat label="Decompressed" value={formatBytes(result.stats.totalDecompressed)} accent />
                  <Stat label="Expansion" value={`${result.stats.totalCompressed > 0 ? (result.stats.totalDecompressed / result.stats.totalCompressed).toFixed(2) : "0"}×`} accent />
                </div>
                {showPreview && (
                  <pre className="text-[10px] font-mono bg-muted/40 p-2 rounded-md overflow-x-auto max-h-[200px] overflow-y-auto">
                    {result.preview || "(no preview)"}
                  </pre>
                )}
                {result.tarEntries && result.tarEntries.length > 0 && (
                  <div className="rounded-md border">
                    <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">
                      TAR contents ({result.tarEntries.length} entries)
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {result.tarEntries.filter((e) => e.isRegularFile).map((e, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{e.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">{formatBytes(e.size)}</Badge>
                          <button
                            type="button"
                            onClick={() => downloadTarEntry(e)}
                            className="text-[10px] text-primary hover:underline cursor-pointer flex-shrink-0"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-md border">
                  <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">Per-file breakdown</div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {result.stats.perFile.map((s, i) => (
                      <div key={i} className="px-2 py-1 text-xs border-b border-border/40 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate min-w-0 flex-1">{s.fileName}</span>
                          {s.error ? (
                            <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30 flex-shrink-0">Error</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              {formatBytes(s.compressedSize)} → {formatBytes(s.decompressedSize)}
                            </Badge>
                          )}
                        </div>
                        {s.error && (
                          <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{s.error}</p>
                        )}
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
          title="Decompress .bz2 files"
          hint="Pure-JS BZIP2 header parsing + simplified RLE1 body decompression. .tar.bz2 auto-extract, MIME detection, magic bytes check. Honest about BWT limitation."
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
                      <p className="font-medium">{h.fileCount} file{h.fileCount === 1 ? "" : "s"}{h.tarBz2Count > 0 && ` · ${h.tarBz2Count} tar.bz2`}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(h.totalCompressed)} → {formatBytes(h.totalDecompressed)} · {new Date(h.decompressedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all BZIP2 header parsing and decompression runs in your browser. File contents never leave your device. This tool can decompress files created by our BZIP2 Compressor (RLE1 body). Standard bzip2 files (libbz2 with full BWT) cannot be decompressed in pure JS — we parse the header and report the block size, but body decoding fails. Only batch summaries (filenames + sizes) are saved to local history.
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
