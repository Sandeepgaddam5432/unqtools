"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import {
  extractMetadata, metadataToJson, formatBytes,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  FILE_SIGNATURES,
  type FileMetadata, type MetadataHistoryEntry,
} from "./logic";
import { Upload, FileSearch, AlertTriangle, Database, History, ShieldAlert } from "lucide-react";

export default function FileMetadataViewer() {
  const [meta, setMeta] = useState<FileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [history, setHistory] = useState<MetadataHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      const m = await extractMetadata(file);
      setMeta(m);
      const entry: MetadataHistoryEntry = {
        name: m.name,
        size: m.size,
        type: m.type,
        detectedExt: m.detectedType?.ext ?? null,
        inspectedAt: new Date().toISOString(),
      };
      setHistory(saveToHistory(entry));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const onInput = useCallback((files: FileList | null) => {
    if (files && files.length > 0) handleFile(files[0]);
  }, [handleFile]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            onChange={(e) => onInput(e.target.files)}
            className="hidden"
            id="file-meta-input"
            aria-label="Choose a file to inspect"
          />
          <button
            type="button"
            onClick={() => document.getElementById("file-meta-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onInput(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Inspect metadata · magic bytes · hex dump · EXIF · entropy</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Inspecting file...
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {meta && !working && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Basic info</Label>
                <div className="flex gap-2">
                  <CopyButton getText={() => metadataToJson(meta)} label="Copy JSON" size="sm" />
                  <ShareButton getUrl={() => buildShareUrl(meta.detectedType ?? undefined)} label="Share sig" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <InfoRow label="Name" value={meta.name} mono />
                <InfoRow label="Size" value={`${meta.sizeHuman} (${meta.size.toLocaleString()} bytes)`} />
                <InfoRow label="MIME type (browser)" value={meta.type} mono />
                <InfoRow label="Last modified" value={new Date(meta.lastModified).toLocaleString()} />
                <InfoRow label="Detected type" value={meta.detectedType ? `${meta.detectedType.description} (.${meta.detectedType.ext})` : "unknown"} />
                <InfoRow label="Detected MIME" value={meta.detectedType?.mime ?? "unknown"} mono />
                <InfoRow label="Encoding" value={`${meta.encoding.encoding}${meta.encoding.hasBom ? " (BOM)" : ""}`} />
                <InfoRow label="Magic bytes (first 16)" value={meta.magicBytesHex} mono />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Entropy (first 1KB)</Label>
              <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                <div className="font-mono text-2xl font-semibold">{meta.entropy.toFixed(3)}</div>
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(meta.entropy / 8) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{meta.entropyHint}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Hex dump (first 256 bytes)</Label>
              <pre className="overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre">{meta.hexDump}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Base64 preview (first 1KB)</Label>
              <pre className="overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all max-h-[160px]">{meta.base64Preview}{meta.base64Preview.length >= 1024 * 1.36 ? "..." : ""}</pre>
            </CardContent>
          </Card>

          {meta.exif.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">EXIF data (JPEG)</Label>
                  {meta.sensitiveExif.sensitive && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="h-3 w-3 mr-1" /> Sensitive
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {meta.exif.map((e, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr] gap-2 items-baseline">
                      <span className="text-muted-foreground">{e.tag}</span>
                      <span className="font-mono break-all">{e.value}</span>
                    </div>
                  ))}
                </div>
                {meta.sensitiveExif.sensitive && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Privacy warning — sensitive metadata detected</p>
                      <p>This file contains: {meta.sensitiveExif.reasons.join(", ")}. Strip EXIF before sharing if you don't want to leak this info.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button type="button" onClick={() => setShowSignatures(!showSignatures)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                <Database className="h-3 w-3" /> File signature reference ({FILE_SIGNATURES.length} entries)
              </button>
              {showSignatures && (
                <div className="overflow-x-auto rounded-md border max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left text-[10px]">Ext</th>
                        <th className="px-2 py-1 text-left text-[10px]">Description</th>
                        <th className="px-2 py-1 text-left text-[10px]">Magic bytes</th>
                        <th className="px-2 py-1 text-left text-[10px]">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FILE_SIGNATURES.map((s, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="px-2 py-1 font-mono">.{s.ext}</td>
                          <td className="px-2 py-1">{s.description}</td>
                          <td className="px-2 py-1 font-mono text-[10px]">{s.bytes}</td>
                          <td className="px-2 py-1 text-[10px] text-muted-foreground">{s.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                <History className="h-3 w-3" /> History ({history.length})
              </button>
              {showHistory && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Recently inspected</Label>
                    {history.length > 0 && (
                      <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-[10px] text-red-600 hover:underline cursor-pointer">Clear</button>
                    )}
                  </div>
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No history yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {history.map((h, i) => (
                        <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                          <p className="font-medium truncate">{h.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatBytes(h.size)} · {h.type || "unknown"} · .{h.detectedExt ?? "?"} · {new Date(h.inspectedAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!meta && !error && !working && (
        <EmptyState title="Drop a file to inspect" hint="Magic bytes · hex dump · entropy · EXIF · base64 · file signature DB. 100% local." icon={<FileSearch className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all metadata extraction runs in your browser. File contents never leave your device. Only metadata (name, size, type) is saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-baseline border-b border-border/40 py-1 last:border-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`break-all ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
