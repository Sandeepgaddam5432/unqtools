"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  decompressBatch, extractTarEntry, previewBytes,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, type HistoryEntry, type DecompressOutput, type TarEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, Eye, FileText,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  data: Uint8Array;
}

interface BatchResultView {
  outputs: DecompressOutput[];
  totalCompressed: number;
  totalDecompressed: number;
  blob: Blob | null;
  outputFileName: string;
}

export default function GzipDecompressor() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [autoExtractTar, setAutoExtractTar] = useState(true);
  const [customOutputName, setCustomOutputName] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<BatchResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
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

  const decompress = useCallback(async () => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    setProgress({ current: 0, total: inputs.length });
    try {
      const res = await decompressBatch(
        inputs.map((i) => ({ fileName: i.fileName, data: i.data })),
        autoExtractTar,
        (current, total) => setProgress({ current, total }),
      );
      const tarExtracted = res.outputs.some((o) => o.stat.isTar);
      const outputFileName = customOutputName.trim()
        ? customOutputName.trim()
        : (res.outputs.length === 1 ? res.outputs[0]!.outputFileName : "decompressed.zip");
      setResult({
        outputs: res.outputs,
        totalCompressed: res.totalCompressed,
        totalDecompressed: res.totalDecompressed,
        blob: res.blob,
        outputFileName,
      });
      setHistory(saveToHistory({
        fileCount: res.outputs.length,
        totalCompressed: res.totalCompressed,
        totalDecompressed: res.totalDecompressed,
        tarExtracted,
        decompressedAt: new Date().toISOString(),
      }));
      const errorCount = res.outputs.filter((o) => o.stat.error).length;
      if (errorCount > 0) {
        toast.warning(`Decompressed ${res.outputs.length - errorCount} files; ${errorCount} failed`);
      } else {
        toast.success(`Decompressed ${res.outputs.length} file${res.outputs.length === 1 ? "" : "s"} (${formatBytes(res.totalCompressed)} → ${formatBytes(res.totalDecompressed)})`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setProgress(null);
    }
  }, [inputs, autoExtractTar, customOutputName]);

  const download = useCallback(() => {
    if (!result || !result.blob) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${result.outputFileName}`);
  }, [result]);

  const downloadTarEntry = useCallback((out: DecompressOutput, entry: TarEntry) => {
    const data = extractTarEntry(out.data, entry);
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
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Decompression options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Custom output filename (optional)</Label>
              <Input
                value={customOutputName}
                onChange={(e) => setCustomOutputName(e.target.value)}
                placeholder="auto-detected from header"
                aria-label="Custom output filename"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={autoExtractTar}
                  onChange={(e) => setAutoExtractTar(e.target.checked)}
                  className="h-3 w-3 rounded border-input"
                />
                <span>Auto-extract .tar.gz (list TAR entries)</span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl({ autoExtractTar, customOutputName })} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".gz,.gzip,.tar.gz,application/gzip,application/x-gzip"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="gunzip-input"
            aria-label="Choose .gz files to decompress"
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
            <p className="text-sm font-medium">Drop .gz / .tar.gz files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · filename from GZIP header · TAR auto-extract · magic bytes MIME detection</p>
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
                    {inp.fileName.endsWith(".tar.gz") && <Badge variant="outline" className="text-[10px]">tar.gz</Badge>}
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
              <Label className="text-sm font-semibold">Decompress & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={decompress}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {working ? `Decompressing ${progress ? `(${progress.current}/${progress.total})` : "..."}` : "Decompress"}
                </button>
                {result && result.blob && (
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download {result.outputs.length > 1 ? "ZIP" : "file"}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Files" value={String(result.outputs.length)} icon={<BarChart3 className="h-3 w-3" />} />
                  <Stat label="Compressed" value={formatBytes(result.totalCompressed)} />
                  <Stat label="Decompressed" value={formatBytes(result.totalDecompressed)} accent />
                  <Stat label="Expansion" value={result.totalCompressed > 0 ? formatRatio(result.totalDecompressed / result.totalCompressed) : "—"} accent />
                </div>
                <div className="rounded-md border">
                  <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">Per-file breakdown</div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {result.outputs.map((out, i) => (
                      <div key={i} className="border-b border-border/40 last:border-0">
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate min-w-0">{out.fileName}</span>
                            <span className="text-muted-foreground flex-shrink-0">→</span>
                            <span className="truncate min-w-0 font-medium">{out.outputFileName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge variant="outline" className="text-[9px]">{out.stat.mimeDescription}</Badge>
                            {out.stat.isTar && <Badge variant="outline" className="text-[9px]">tar ({out.stat.tarEntryCount})</Badge>}
                            {out.stat.error && <Badge variant="destructive" className="text-[9px]">error</Badge>}
                            <Badge variant="outline" className="text-[9px]">{formatBytes(out.stat.compressedSize)} → {formatBytes(out.stat.decompressedSize)}</Badge>
                            <button
                              type="button"
                              onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
                              className="p-1 rounded-md hover:bg-accent cursor-pointer"
                              aria-label="Preview bytes"
                              title="Preview first 256 bytes"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {out.stat.error && (
                          <p className="px-2 pb-1 text-[10px] text-destructive">{out.stat.error}</p>
                        )}
                        {previewIdx === i && out.data.length > 0 && (
                          <div className="px-2 pb-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
                            <div>
                              <p className="text-[9px] text-muted-foreground mb-0.5">Hex (first 256 bytes)</p>
                              <pre className="text-[9px] font-mono bg-muted/30 rounded p-1 max-h-[120px] overflow-auto whitespace-pre">{previewBytes(out.data).hex || "(empty)"}</pre>
                            </div>
                            <div>
                              <p className="text-[9px] text-muted-foreground mb-0.5">ASCII</p>
                              <pre className="text-[9px] font-mono bg-muted/30 rounded p-1 max-h-[120px] overflow-auto whitespace-pre-wrap break-all">{previewBytes(out.data).ascii || "(empty)"}</pre>
                            </div>
                          </div>
                        )}
                        {out.tarEntries && out.tarEntries.length > 0 && (
                          <div className="px-2 pb-2 space-y-1">
                            <p className="text-[9px] text-muted-foreground">TAR contents ({out.tarEntries.length} regular files)</p>
                            <div className="max-h-[150px] overflow-y-auto rounded border">
                              {out.tarEntries.map((e, j) => (
                                <div key={j} className="flex items-center justify-between gap-2 px-2 py-0.5 text-[10px] border-b border-border/30 last:border-0">
                                  <span className="truncate min-w-0 flex-1 font-mono">{e.name}</span>
                                  <span className="text-muted-foreground flex-shrink-0">{formatBytes(e.size)}</span>
                                  <button
                                    type="button"
                                    onClick={() => downloadTarEntry(out, e)}
                                    className="p-0.5 rounded hover:bg-accent cursor-pointer flex-shrink-0"
                                    aria-label={`Download ${e.name}`}
                                  >
                                    <Download className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
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
          title="Decompress .gz files"
          hint="Uses the browser's native DecompressionStream API. Filename extracted from header, .tar.gz auto-extract, magic bytes MIME detection. 100% local."
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
                      <p className="font-medium">
                        {h.fileCount} file{h.fileCount === 1 ? "" : "s"}
                        {h.tarExtracted && <Badge variant="outline" className="text-[9px] ml-1">tar</Badge>}
                      </p>
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
            <strong className="text-foreground">Privacy:</strong> all GZIP decompression runs in your browser via the native DecompressionStream API. File contents never leave your device. Only batch summaries are saved to local history.
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
