"use client";
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState, RunButton } from "../../_shared";
import { toast } from "sonner";
import {
  parsePartNumber, extractBaseName, sortParts, detectMissingParts,
  parseManifest, manifestMap, formatBytes, formatHexPreview, bytesToHex,
  mergeParts, downloadMerged,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type PartEntry, type HistoryEntry, type MergeResult,
} from "./logic";
import { Upload, Combine, Download, FileCheck2, History, X, AlertTriangle, CheckCircle2 } from "lucide-react";

interface LoadedPart extends PartEntry {
  bytes: Uint8Array;
}

export default function OnlineFileMerger() {
  const [parts, setParts] = useState<LoadedPart[]>([]);
  const [manifestText, setManifestText] = useState<string>("");
  const [outputName, setOutputName] = useState<string>("");
  const [verify, setVerify] = useState<boolean>(true);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);
  const [mergedStats, setMergedStats] = useState<MergeResult["stats"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const partsInputRef = useRef<HTMLInputElement | null>(null);
  const manifestInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseShareUrl(window.location.hash);
    if (parsed) {
      if (parsed.outputName) setOutputName(parsed.outputName);
      if (parsed.verify !== undefined) setVerify(parsed.verify);
      toast.info("Loaded settings from shareable URL");
    }
  }, []);

  const handleParts = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setMergedBytes(null);
    setMergedStats(null);
    try {
      const newParts: LoadedPart[] = [];
      for (const f of Array.from(fileList)) {
        const buf = await f.arrayBuffer();
        newParts.push({
          id: `${f.name}-${f.size}-${f.lastModified}`,
          name: f.name,
          size: f.size,
          partNumber: parsePartNumber(f.name),
          lastModified: f.lastModified,
          file: f,
          bytes: new Uint8Array(buf),
        });
      }
      setParts((prev) => [...prev, ...newParts]);
      // Auto-set output name from first part if not already set
      if (!outputName && newParts.length > 0) {
        const baseName = extractBaseName(newParts[0].name);
        if (baseName) setOutputName(baseName);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [outputName]);

  const handleManifestFile = useCallback(async (f: File | null) => {
    if (!f) return;
    try {
      const text = await f.text();
      setManifestText(text);
      toast.success(`Loaded manifest: ${f.name}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const removePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
    setMergedBytes(null);
    setMergedStats(null);
  };

  const sortedParts = useMemo(() => sortParts(parts), [parts]);
  const missingParts = useMemo(() => detectMissingParts(sortedParts), [sortedParts]);
  const manifestEntries = useMemo(() => parseManifest(manifestText), [manifestText]);
  const manifestMapInst = useMemo(() => manifestMap(manifestEntries), [manifestEntries]);

  const previewHex = useMemo(() => {
    if (!mergedBytes) return "";
    return bytesToHex(mergedBytes.slice(0, 32));
  }, [mergedBytes]);

  const onMerge = useCallback(async () => {
    if (parts.length === 0) {
      toast.error("Drop at least 2 parts to merge");
      return;
    }
    if (missingParts.length > 0) {
      toast.warning(`Missing ${missingParts.length} part(s): ${missingParts.slice(0, 5).join(", ")}${missingParts.length > 5 ? "..." : ""}`);
    }
    setError(null);
    setWorking(true);
    setProgress(0);
    setMergedBytes(null);
    setMergedStats(null);
    try {
      const result = await mergeParts(
        parts.map((p) => ({ entry: p, bytes: p.bytes })),
        verify ? manifestMapInst : new Map(),
        (p) => setProgress(p),
      );
      setMergedBytes(result.bytes);
      setMergedStats(result.stats);
      const baseName = result.stats.baseName || outputName || "merged";
      const entry: HistoryEntry = {
        baseName,
        partCount: result.stats.partCount,
        mergedSize: result.stats.mergedSize,
        verified: result.stats.verified,
        errorCount: result.stats.verificationErrors.length,
        mergedAt: new Date().toISOString(),
      };
      setHistory(saveToHistory(entry));
      toast.success(`Merged ${result.stats.partCount} parts → ${formatBytes(result.stats.mergedSize)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [parts, missingParts, manifestMapInst, verify, outputName]);

  const onDownload = useCallback(() => {
    if (!mergedBytes) return;
    const filename = outputName || (mergedStats?.baseName ?? "merged");
    downloadMerged(mergedBytes, filename);
    toast.success(`Downloaded ${filename}`);
  }, [mergedBytes, outputName, mergedStats]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleParts(e.target.files)}
            className="hidden"
            id="merger-parts-input"
            ref={partsInputRef}
            aria-label="Choose part files to merge"
          />
          <button
            type="button"
            onClick={() => partsInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleParts(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop part files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">.001 · .002 · .003 · ... · auto-sorted by extension number · 100% local</p>
          </button>
        </CardContent>
      </Card>

      {parts.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Parts ({parts.length})</Label>
              <button type="button" onClick={() => { setParts([]); setMergedBytes(null); setMergedStats(null); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear all</button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {sortedParts.map((p) => (
                <div key={p.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                  <Badge variant="outline" className="text-[9px]">.{String(p.partNumber).padStart(3, "0")}</Badge>
                  <span className="truncate font-mono"><FileCheck2 className="inline h-3 w-3 mr-1" />{p.name}</span>
                  <Badge variant="outline" className="text-[9px]">{formatBytes(p.size)}</Badge>
                  <button type="button" onClick={() => removePart(p.id)} className="text-muted-foreground hover:text-red-600 cursor-pointer"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            {missingParts.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Missing {missingParts.length} part(s):</p>
                  <p className="font-mono text-[10px]">{missingParts.slice(0, 10).map((n) => `.${String(n).padStart(3, "0")}`).join(", ")}{missingParts.length > 10 ? " ..." : ""}</p>
                  <p className="text-[10px] mt-1">You can still merge — the result will be missing those byte ranges.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Checksum manifest (optional)</Label>
            <input
              type="file"
              onChange={(e) => handleManifestFile(e.target.files?.[0] ?? null)}
              className="hidden"
              id="merger-manifest-input"
              ref={manifestInputRef}
              aria-label="Choose manifest file"
            />
            <button type="button" onClick={() => manifestInputRef.current?.click()} className="text-xs text-primary hover:underline cursor-pointer">
              Load .sha256 manifest
            </button>
          </div>
          {manifestText ? (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">{manifestEntries.length} entries parsed from manifest</p>
              <textarea
                value={manifestText}
                onChange={(e) => setManifestText(e.target.value)}
                className="w-full h-20 rounded-md border border-input bg-background p-2 text-[10px] font-mono"
                aria-label="Manifest content"
              />
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Drop the .sha256 manifest file from the File Splitter to verify each part&apos;s CRC32 + SHA-256 before merging.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Output</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Output filename</label>
              <Input value={outputName} onChange={(e) => setOutputName(e.target.value)} placeholder="merged.bin" className="h-8 text-xs font-mono" aria-label="Output filename" />
            </div>
            <div className="space-y-1 flex items-end">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} className="cursor-pointer" />
                <span>Verify parts against manifest</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Merge</Label>
            <div className="flex gap-2">
              <RunButton onClick={onMerge} label="Merge parts" loading={working} size="sm" />
              <ShareButton getUrl={() => buildShareUrl({ outputName, verify })} label="" size="icon-sm" />
            </div>
          </div>
          {working && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Merging + verifying...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {mergedStats && mergedBytes && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Stats</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Parts merged</p><p className="font-mono font-semibold">{mergedStats.partCount}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Merged size</p><p className="font-mono font-semibold">{formatBytes(mergedStats.mergedSize)}</p></div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] text-muted-foreground">Verification</p>
                  <p className={`font-mono font-semibold inline-flex items-center gap-1 ${mergedStats.verified ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {mergedStats.verified ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {mergedStats.verified ? "Passed" : "Errors"}
                  </p>
                </div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Missing parts</p><p className="font-mono font-semibold">{mergedStats.missingParts.length}</p></div>
              </div>
              {!mergedStats.verified && mergedStats.verificationErrors.length > 0 && (
                <div className="space-y-1 max-h-[120px] overflow-y-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Verification errors ({mergedStats.verificationErrors.length}):</p>
                  {mergedStats.verificationErrors.slice(0, 20).map((e, i) => (
                    <p key={i} className="text-[10px] font-mono text-amber-700 dark:text-amber-400">{e}</p>
                  ))}
                  {mergedStats.verificationErrors.length > 20 && <p className="text-[10px] text-muted-foreground">+ {mergedStats.verificationErrors.length - 20} more</p>}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={onDownload} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent cursor-pointer inline-flex items-center gap-1">
                  <Download className="h-3 w-3" /> Download merged file
                </button>
                <CopyButton getText={() => bytesToHex(mergedBytes.slice(0, 64))} label="Copy first 64 bytes (hex)" size="sm" />
                <DownloadButton getText={() => JSON.stringify({ baseName: mergedStats.baseName, partCount: mergedStats.partCount, mergedSize: mergedStats.mergedSize, verified: mergedStats.verified, errors: mergedStats.verificationErrors }, null, 2)} filename="merge_report.json" mime="application/json" label="Report" size="sm" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Preview merged file</Label>
              <p className="text-[10px] text-muted-foreground">First 32 bytes (hex):</p>
              <pre className="overflow-auto rounded bg-muted/30 p-1.5 font-mono text-[10px] leading-relaxed whitespace-pre">
                {formatHexPreview(previewHex)}
              </pre>
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
                        <p className="font-medium truncate">{h.baseName}</p>
                        <p className="text-[10px] text-muted-foreground">{h.partCount} parts · {formatBytes(h.mergedSize)} · {h.verified ? "verified" : `${h.errorCount} errors`} · {new Date(h.mergedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}

      {parts.length === 0 && !error && !working && (
        <EmptyState title="Rejoin split file parts (.001, .002, ...)" hint="Auto-sort · missing-part detection · CRC32 + SHA-256 verification · progress bar · 100% local." icon={<Combine className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all merging runs in your browser. Your files never leave your device. Only base names + sizes are saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
