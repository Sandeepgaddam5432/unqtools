"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  stripMetadata, applySuffix, formatBytes, computeBatchStats,
  createZipBlob, loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_STRIP_OPTIONS, type StripOptions, type StripResult, type StripHistoryEntry,
} from "./logic";
import { Upload, ShieldOff, Download, Image as ImageIcon, History, BarChart3, Trash2, FileArchive } from "lucide-react";

interface FileResult {
  file: File;
  result: StripResult;
  outputUrl: string;
  previewUrl: string;
}

export default function FileMetadataStripper() {
  const [options, setOptions] = useState<StripOptions>(DEFAULT_STRIP_OPTIONS);
  const [results, setResults] = useState<FileResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<StripHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const stats = useMemo(() => {
    const stripResults = results.map((r) => r.result);
    const errorResults = errors.map((e) => ({ error: e }));
    return computeBatchStats([...stripResults, ...errorResults]);
  }, [results, errors]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setWorking(true);
    setErrors([]);
    const newResults: FileResult[] = [];
    const newErrors: string[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const result = stripMetadata(buf, options);
        const blob = new Blob([result.output as BlobPart], { type: file.type || "application/octet-stream" });
        const outputUrl = URL.createObjectURL(blob);
        const previewUrl = URL.createObjectURL(file);
        newResults.push({ file, result, outputUrl, previewUrl });
        const entry: StripHistoryEntry = {
          name: file.name,
          format: result.format,
          originalSize: result.originalSize,
          strippedSize: result.strippedSize,
          bytesSaved: result.bytesSaved,
          removedTypes: result.removed.map((r) => r.type),
          strippedAt: new Date().toISOString(),
        };
        setHistory(saveToHistory(entry));
      } catch (e) {
        newErrors.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setResults((prev) => [...prev, ...newResults]);
    setErrors(newErrors);
    setWorking(false);
    if (newResults.length > 0) {
      toast.success(`Stripped ${newResults.length} file${newResults.length === 1 ? "" : "s"}`);
    }
  }, [options]);

  const clearAll = useCallback(() => {
    results.forEach((r) => {
      URL.revokeObjectURL(r.outputUrl);
      URL.revokeObjectURL(r.previewUrl);
    });
    setResults([]);
    setErrors([]);
  }, [results]);

  const downloadZip = useCallback(async () => {
    if (results.length === 0) return;
    const entries = await Promise.all(results.map(async (r) => ({
      name: applySuffix(r.file.name, r.result.suffix),
      data: new Uint8Array(await fetch(r.outputUrl).then((res) => res.arrayBuffer())),
    })));
    const blob = createZipBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stripped-images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded stripped-images.zip");
  }, [results]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Strip options</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CheckOption label="EXIF (JPEG)" checked={options.stripExif} onChange={(v) => setOptions({ ...options, stripExif: v })} />
            <CheckOption label="XMP (JPEG/WebP)" checked={options.stripXmp} onChange={(v) => setOptions({ ...options, stripXmp: v })} />
            <CheckOption label="IPTC (JPEG)" checked={options.stripIptc} onChange={(v) => setOptions({ ...options, stripIptc: v })} />
            <CheckOption label="PNG text chunks" checked={options.stripPngText} onChange={(v) => setOptions({ ...options, stripPngText: v })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton getUrl={() => buildShareUrl(options)} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="metadata-stripper-input"
            aria-label="Choose image files to strip"
          />
          <button
            type="button"
            onClick={() => document.getElementById("metadata-stripper-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop images here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP · batch supported · no re-encoding</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Stripping metadata...
        </CardContent></Card>
      )}

      {errors.length > 0 && errors.map((e, i) => (
        <ErrorBanner key={i} message={e} />
      ))}

      {results.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Batch stats</Label>
                </div>
                <div className="flex gap-2">
                  <DownloadButton
                    getText={async () => ""}
                    filename=""
                    label=""
                    disabled
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={downloadZip}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <FileArchive className="h-3.5 w-3.5" /> Download ZIP
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Files" value={String(stats.successCount)} />
                <Stat label="Original size" value={formatBytes(stats.totalOriginalBytes)} />
                <Stat label="Stripped size" value={formatBytes(stats.totalStrippedBytes)} />
                <Stat label="Bytes saved" value={formatBytes(stats.totalBytesSaved)} accent />
              </div>
            </CardContent>
          </Card>

          {results.map((r, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="h-4 w-4 flex-shrink-0" />
                      <p className="text-sm font-medium truncate">{r.file.name}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{r.result.format}</Badge>
                      {r.result.changed ? (
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">stripped</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">no metadata</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(r.result.originalSize)} → {formatBytes(r.result.strippedSize)} · saved {formatBytes(r.result.bytesSaved)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <DownloadButton
                      getText={async () => {
                        const res = await fetch(r.outputUrl);
                        return await res.text();
                      }}
                      filename={applySuffix(r.file.name, r.result.suffix)}
                      label="Download"
                      size="sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Before</p>
                    { }
                    <img src={r.previewUrl} alt="Original" className="w-full rounded-md border max-h-[200px] object-contain bg-muted/30" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">After stripping</p>
                    { }
                    <img src={r.outputUrl} alt="Stripped" className="w-full rounded-md border max-h-[200px] object-contain bg-muted/30" />
                  </div>
                </div>

                {r.result.removed.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Removed segments</p>
                    <div className="flex flex-wrap gap-1">
                      {r.result.removed.map((m, j) => (
                        <Badge key={j} variant="outline" className="text-[10px] border-red-500/30 text-red-700 dark:text-red-400">
                          {m.type} ({formatBytes(m.size)})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {r.result.remaining.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Remaining (kept)</p>
                    <div className="flex flex-wrap gap-1">
                      {r.result.remaining.map((m, j) => (
                        <Badge key={j} variant="outline" className="text-[10px]">
                          {m.type} ({formatBytes(m.size)})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {results.length === 0 && errors.length === 0 && !working && (
        <EmptyState
          title="Drop images to strip metadata"
          hint="EXIF · GPS · XMP · IPTC · PNG text — all removed without re-encoding pixel data. 100% local."
          icon={<ShieldOff className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recently stripped</Label>
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
                      <p className="font-medium truncate">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.format.toUpperCase()} · {formatBytes(h.originalSize)} → {formatBytes(h.strippedSize)} · saved {formatBytes(h.bytesSaved)} · {h.removedTypes.join(", ") || "none"} · {new Date(h.strippedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all metadata stripping runs in your browser. Image bytes never leave your device. Only metadata summaries (filename, sizes, types) are saved to local history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
      <span>{label}</span>
    </label>
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
