"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  MAGIC_BYTES,
  BIT_DEPTHS,
  CHANNEL_LAYOUTS,
  getComparisonTable,
  detectFormat,
  toAsciiPreview,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FormatDetectionResult,
  type HistoryEntry,
} from "./logic";
import { FileAudio, Upload, History, Search, FileCheck2, AlertTriangle } from "lucide-react";

interface LoadedFile {
  name: string;
  size: number;
  bytes: Uint8Array;
}

export default function AudioFormatDetector() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const result = useMemo<FormatDetectionResult | null>(() => {
    if (!file) return null;
    return detectFormat(file.bytes);
  }, [file]);

  const textReport = useMemo(() => result ? renderTextReport(result) : "", [result]);
  const csvReport = useMemo(() => result ? renderCsvReport(result) : "", [result]);
  const jsonReport = useMemo(() => result ? renderJsonReport(result) : "", [result]);
  const summary = useMemo(() => result ? computeSummaryStats(result) : null, [result]);
  const comparison = useMemo(() => getComparisonTable(), []);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.format || p.confidence || p.mime) {
        toast.info("Loaded from share link (drop a file to detect again)");
      }
    }
  }, []);

  const handleFile = useCallback(async (f: File) => {
    try {
      const arrayBuffer = await f.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer.slice(0, 64));
      setFile({ name: f.name, size: f.size, bytes });
      const r = detectFormat(bytes);
      saveHistory({
        ts: Date.now(),
        fileName: f.name,
        fileSize: f.size,
        format: r.format,
        label: r.label,
        confidence: r.confidence,
        mimeType: r.mimeType,
        extension: r.extension,
      });
      setHistory(loadHistory());
      toast.success(`Detected: ${r.label} (${r.confidence}%)`);
    } catch (e) {
      toast.error(`Could not read file: ${(e as Error).message}`);
    }
  }, []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (e.target) e.target.value = "";
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleReset = useCallback(() => {
    setFile(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs">Audio file (any format — we only read the first 64 bytes)</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : "Drop an audio file or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {file
                ? `${formatBytes(file.size)} · ${file.bytes.length} header bytes read`
                : "MP3, WAV, FLAC, OGG, M4A, WMA, AIFF, ALAC, OPUS, APE, TTA, WavPack, Speex, AMR, 3GP"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileInput}
            className="hidden"
          />
        </CardContent>
      </Card>

      {result && summary && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4" /> Detection result
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Detected format" value={summary.format} highlight={summary.formatId === "unknown" ? "bad" : "good"} />
                <Stat label="Confidence" value={`${summary.confidence}%`} />
                <Stat label="MIME type" value={summary.mimeType ?? "n/a"} />
                <Stat label="Extension" value={summary.extension ?? "n/a"} />
              </div>
              {result.format === "unknown" && (
                <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Format not recognized.</p>
                    <p className="mt-1">
                      Closest matches: {result.closestMatches.length > 0
                        ? result.closestMatches.map((m) => `${m.label} (${m.confidence}%)`).join(", ")
                        : "none"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {result.containerInfo && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileAudio className="h-4 w-4" /> Container info
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Codec" value={result.containerInfo.codec} />
                  <Stat label="Container" value={result.containerInfo.container} />
                  <Stat label="Compression" value={result.containerInfo.compression} highlight={result.containerInfo.compression === "lossless" ? "good" : undefined} />
                  <Stat label="Typical use" value={result.containerInfo.typicalUse} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Technical details</h3>
              {result.technical && Object.keys(result.technical).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Sample rate" value={result.technical.sampleRate !== undefined ? `${result.technical.sampleRate} Hz` : "n/a"} />
                  <Stat label="Channels" value={result.technical.channels !== undefined ? result.technical.channels : "n/a"} />
                  <Stat label="Bit depth" value={result.technical.bitDepth !== undefined ? `${result.technical.bitDepth} bits` : "n/a"} />
                  <Stat label="Duration" value={result.technical.durationSeconds !== undefined ? `${result.technical.durationSeconds.toFixed(2)}s` : "n/a"} />
                  {result.technical.notes && (
                    <div className="col-span-2 sm:col-span-4">
                      <Stat label="Notes" value={result.technical.notes} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No header details extractable from the first 64 bytes.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Magic bytes (first 64 bytes)</h3>
              <pre className="rounded bg-muted p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {result.magicBytesHex}
              </pre>
              <pre className="rounded bg-muted p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {toAsciiPreview(hexToBytes(result.magicBytesHex))}
              </pre>
            </CardContent>
          </Card>

          {result.closestMatches.length > 0 && result.format !== "unknown" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Other possible matches</h3>
                <div className="flex flex-wrap gap-2">
                  {result.closestMatches.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {m.label}: {m.confidence}%
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4" /> Export & actions
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => textReport} label="Copy text report" />
                <DownloadButton getText={() => textReport} filename="audio-format-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csvReport} filename="audio-format-report.csv" mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => jsonReport} filename="audio-format-report.json" mime="application/json" label="Download JSON" />
                <ShareButton getUrl={() => buildShareUrl({
                  format: result.label,
                  confidence: String(result.confidence),
                  mime: result.mimeType ?? "",
                })} />
                <ClearButton onClick={handleReset} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="Drop an audio file to detect its format"
          hint="We read the first 64 bytes locally and match against 15+ audio format signatures. No file is uploaded — only the header is examined."
          icon={<FileAudio className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Supported formats & comparison table</h3>
          <p className="text-xs text-muted-foreground">
            {MAGIC_BYTES.length} formats supported. Below is a comparison of common formats.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1.5 px-2 font-medium">Format</th>
                  <th className="py-1.5 px-2 font-medium">Compression</th>
                  <th className="py-1.5 px-2 font-medium">Typical bitrate</th>
                  <th className="py-1.5 px-2 font-medium">Typical use</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.format} className="border-b last:border-0">
                    <td className="py-1.5 px-2 font-mono">{row.label}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant={row.compression === "lossless" ? "secondary" : "outline"} className="text-[10px]">
                        {row.compression}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-muted-foreground">{row.typicalBitrate}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{row.typicalUse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Bit depth reference</h3>
          <div className="flex flex-wrap gap-2">
            {BIT_DEPTHS.map((b) => (
              <Badge key={b.id} variant="outline" className="text-[10px]">
                {b.label} · {b.dbRange}
              </Badge>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-foreground mt-3">Channel layout reference</h3>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_LAYOUTS.map((c) => (
              <Badge key={c.id} variant="outline" className="text-[10px]">
                {c.label} ({c.channels} ch) — {c.description}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> History ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant={h.format === "unknown" ? "outline" : "secondary"} className="text-[10px]">
                    {h.label}
                  </Badge>
                  <span className="text-muted-foreground">{h.confidence}%</span>
                  {h.mimeType && <Badge variant="outline" className="text-[10px]">{h.mimeType}</Badge>}
                  <span className="text-muted-foreground ml-auto truncate max-w-[200px]">{h.fileName}</span>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Only the first 64 bytes of your
            file are read locally in your browser to identify the format. The file is never uploaded.
            Detection metadata is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.split(/\s+/).filter(Boolean);
  return new Uint8Array(parts.map((p) => parseInt(p, 16)));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color} break-all`}>{value}</div>
    </div>
  );
}
