"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  parseLzh, extractLzhEntry, hasCompressedEntries, getLzhStats, formatBytes,
  type LzhEntry,
} from "./logic";
import { Upload, FileArchive, AlertTriangle } from "lucide-react";

export default function LzhExtractor() {
  const [archive, setArchive] = useState<{ entries: LzhEntry[]; bytes: Uint8Array } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const parsed = parseLzh(bytes);
      if (!parsed.isValid) {
        setError(parsed.error ?? "Invalid LZH archive");
        setArchive(null);
        return;
      }
      setArchive({ entries: parsed.entries, bytes });
      toast.success(`Parsed ${parsed.entries.length} entries`);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleExtract = useCallback((entry: LzhEntry) => {
    if (!archive) return;
    const extracted = extractLzhEntry(archive.bytes, entry);
    if (!extracted) {
      toast.error("Cannot extract — compressed entries are not supported");
      return;
    }
    const blob = new Blob([extracted as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Extracted: ${entry.filename}`);
  }, [archive]);

  const filtered = archive?.entries.filter((e) => e.filename.toLowerCase().includes(search.toLowerCase())) ?? [];
  const stats = archive ? getLzhStats({ entries: archive.entries, isValid: true }) : null;
  const hasCompressed = archive ? hasCompressedEntries({ entries: archive.entries, isValid: true }) : false;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input type="file" accept=".lzh,.lha" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} className="hidden" id="lzh-input" />
          <button type="button" onClick={() => document.getElementById("lzh-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop .lzh / .lha file or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Level 0 (stored) archives supported</p>
          </button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {hasCompressed && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>This archive contains compressed entries (not stored). Only level 0 (uncompressed) entries can be extracted.</p>
          </div>
        </div>
      )}

      {archive && stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Contents ({filtered.length})</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">{stats.fileCount} files</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatBytes(stats.totalUncompressed)} total</Badge>
                  {stats.compressedCount > 0 && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">{stats.compressedCount} compressed</Badge>}
                </div>
              </div>
              <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
              {filtered.map((entry, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs py-2 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{entry.compressionMethod} · {entry.timestamp.toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">{formatBytes(entry.uncompressedSize)}</Badge>
                  <button type="button" onClick={() => handleExtract(entry)} disabled={entry.compressionMethod !== "-lh0-"}
                    className="text-[10px] text-primary hover:underline cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    Extract
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {!archive && !error && (
        <EmptyState title="Drop an LZH file to extract" hint="Level 0 (stored) archives are fully supported. Compressed entries show as unsupported." icon={<FileArchive className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all parsing is in-browser. Files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
