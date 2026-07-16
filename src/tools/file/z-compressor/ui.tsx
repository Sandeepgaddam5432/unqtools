"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  compressZ, decompressZ, isZMagic, detectMode, parseHeader,
  computeStats, hexPreview, batchCompress, batchDecompress,
  formatBytes,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_OPTIONS, type ZOptions, type ZStats, type ZMode, type HistoryEntry,
} from "./logic";
import {
  Upload, Archive, Download, History, BarChart3, Settings,
  FileText, FileDown, Eye,
} from "lucide-react";

export default function ZCompressor() {
  const [opts, setOpts] = useState<ZOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{
    fileName: string;
    inputSize: number;
    outputSize: number;
    output: Uint8Array;
    outputName: string;
    mode: ZMode;
    stats: ZStats;
    hex: string;
  }>>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [previewHex, setPreviewHex] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setWorking(true);
    try {
      const files = await Promise.all(
        Array.from(fileList).map(async (f) => ({
          name: f.name,
          data: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      const newResults: typeof results = [];
      for (const f of files) {
        const mode = detectMode(f.name, f.data);
        let output: Uint8Array | null = null;
        let outputName = "";
        let inputSize = f.data.length;
        let outputSize = 0;
        if (mode === "compress") {
          const result = compressZ(f.data, opts);
          if (!result.ok) {
            setError(`${f.name}: ${result.error}`);
            continue;
          }
          output = result.output;
          outputName = f.name + ".Z";
          outputSize = output.length;
        } else {
          const result = decompressZ(f.data);
          if (!result.ok) {
            setError(`${f.name}: ${result.error}`);
            continue;
          }
          output = result.output;
          outputName = f.name.replace(/\.Z$/i, "").replace(/\.taz$/i, ".tar");
          outputSize = output.length;
        }
        const stats = computeStats(inputSize, outputSize, mode);
        const hex = hexPreview(output, 128);
        newResults.push({
          fileName: f.name, inputSize, outputSize, output, outputName, mode, stats, hex,
        });
        setHistory(saveToHistory({
          fileName: f.name, mode, inputSize, outputSize,
          savedPercent: stats.savedPercent, processedAt: new Date().toISOString(),
        }));
      }
      setResults((prev) => [...prev, ...newResults]);
      if (newResults.length > 0) {
        toast.success(`Processed ${newResults.length} file(s)`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [opts]);

  const downloadResult = useCallback((r: typeof results[number]) => {
    const blob = new Blob([r.output as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${r.outputName}`);
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Compression options
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Max bits</Label>
              <Input
                type="number"
                min={9}
                max={16}
                value={opts.maxBits}
                onChange={(e) => setOpts({ ...opts, maxBits: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.blockMode}
                  onChange={(e) => setOpts({ ...opts, blockMode: e.target.checked })}
                  className="cursor-pointer"
                />
                Block mode
              </label>
            </div>
            <div className="flex items-end">
              <ShareButton getUrl={() => buildShareUrl(opts)} label="Share options" size="sm" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Magic bytes: 0x1f 0x9d · Default: 16-bit block mode (compress -b 16). Drag .Z files to decompress, other files to compress.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".Z,.taz,.txt,.log,.json,.xml,.html,.css,.js,.ts,.csv,.tsv,.md"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="z-input"
            aria-label="Choose files to compress or decompress"
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
            <p className="mt-1 text-xs text-muted-foreground">.Z files auto-decompress · other files compress to .Z · batch supported</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Processing files…
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Results ({results.length})</Label>
            {results.map((r, i) => (
              <div key={i} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {r.mode === "compress" ? (
                      <FileDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{r.fileName}</span>
                    <Badge variant="outline" className="text-[10px]">{r.mode}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewHex(previewHex === r.fileName ? null : r.fileName)}
                      className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                      aria-label="Toggle hex preview"
                      title="Hex preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadResult(r)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-3 text-xs cursor-pointer"
                    >
                      <Download className="h-3 w-3" /> {r.outputName}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Input" value={formatBytes(r.inputSize)} />
                  <Stat label="Output" value={formatBytes(r.outputSize)} accent={r.stats.saved > 0} />
                  <Stat label="Ratio" value={r.stats.ratio.toFixed(3)} />
                  <Stat
                    label="Saved"
                    value={`${r.stats.saved >= 0 ? "+" : ""}${formatBytes(r.stats.saved)}`}
                  />
                </div>
                {previewHex === r.fileName && (
                  <pre className="max-h-[200px] overflow-auto rounded-md border border-border bg-muted/30 p-2 text-[10px] font-mono whitespace-pre">
                    {r.hex}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {results.length === 0 && !error && !working && (
        <EmptyState
          title="Compress or decompress Unix .Z files"
          hint="Pure-JS LZW implementation. Drop a .Z file to decompress, or any other file to compress. Magic bytes 0x1f 0x9d, configurable 9-16 bit codes, block mode toggle."
          icon={<Archive className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recently processed</Label>
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
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.mode} · {formatBytes(h.inputSize)} → {formatBytes(h.outputSize)} · {h.savedPercent >= 0 ? "+" : ""}{h.savedPercent.toFixed(1)}% · {new Date(h.processedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all LZW compression runs in your browser. File contents never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
