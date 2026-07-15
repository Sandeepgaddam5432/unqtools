"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseRar, isRarFile, detectRarVersion, getPageEntries, detectImageMime,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type RarArchiveInfo, type RarEntry,
} from "./logic";
import {
  Upload, BookOpen, History, BarChart3, X, FileImage, AlertTriangle, ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface InputFile {
  fileName: string;
  size: number;
  info: RarArchiveInfo;
}

export default function CbrComicBookReader() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const info = parseRar(bytes);
        if (!info.isValid) {
          setError(`${file.name}: ${info.error ?? "Not a valid RAR/CBR file"}`);
          continue;
        }
        newInputs.push({ fileName: file.name, size: file.size, info });
        setHistory(saveToHistory({
          fileName: file.name, fileSize: file.size,
          version: info.version,
          pageCount: getPageEntries(info.entries).length,
          fileCount: info.fileCount,
          openedAt: new Date().toISOString(),
        }));
        toast.success(`Parsed ${file.name} — ${info.version.toUpperCase()}, ${info.fileCount} file${info.fileCount === 1 ? "" : "s"}`);
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const totalPages = useMemo(
    () => inputs.reduce((s, i) => s + getPageEntries(i.info.entries).length, 0),
    [inputs],
  );
  const totalFiles = useMemo(
    () => inputs.reduce((s, i) => s + i.info.fileCount, 0),
    [inputs],
  );
  const totalSize = useMemo(() => inputs.reduce((s, i) => s + i.size, 0), [inputs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".cbr,.rar,application/x-rar-compressed"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="cbr-input"
            aria-label="Choose .cbr files to inspect"
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
            <p className="text-sm font-medium">Drop .cbr / .rar files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">RAR4 + RAR5 signature detection · header parsing · file listing · page counter</p>
          </button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Honesty clause — RAR extraction limitation</p>
              <p>
                RAR uses a proprietary compression algorithm. We parse the archive header and list all file entries, but we cannot extract file contents in pure JavaScript. For full page rendering, convert your CBR to CBZ (ZIP-based) using a desktop tool (7-Zip, The Unarchiver), then open the CBZ in our{" "}
                <Link href="/tools/cbz-comic-book-reader" className="underline inline-flex items-center gap-0.5">
                  CBZ Comic Book Reader <ExternalLink className="h-3 w-3" />
                </Link>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Archives ({inputs.length}) · {totalFiles} file{totalFiles === 1 ? "" : "s"} · {totalPages} page{totalPages === 1 ? "" : "s"} · {formatBytes(totalSize)}
              </Label>
              <button
                type="button"
                onClick={() => setInputs([])}
                className="text-[10px] text-red-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButton getUrl={() => buildShareUrl()} label="Share" size="sm" />
            </div>
          </CardContent>
        </Card>
      )}

      {inputs.map((inp, idx) => {
        const pages = getPageEntries(inp.info.entries);
        const filtered = inp.info.entries.filter((e) =>
          e.name.toLowerCase().includes(search.toLowerCase()),
        );
        return (
          <Card key={idx}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm font-medium truncate">{inp.fileName}</p>
                  <Badge variant="outline" className="text-[10px]">{inp.info.version.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                  {inp.info.isEncrypted && (
                    <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">Encrypted</Badge>
                  )}
                  {inp.info.isMultiVolume && (
                    <Badge variant="outline" className="text-[10px]">Multi-volume</Badge>
                  )}
                  {inp.info.isSolid && (
                    <Badge variant="outline" className="text-[10px]">Solid</Badge>
                  )}
                  {inp.info.hasRecoveryRecord && (
                    <Badge variant="outline" className="text-[10px]">Recovery</Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeInput(idx)}
                  className="p-1 rounded-md hover:bg-accent cursor-pointer"
                  aria-label={`Remove ${inp.fileName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Files" value={String(inp.info.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Dirs" value={String(inp.info.directoryCount)} />
                <Stat label="Pages" value={String(pages.length)} accent />
                <Stat label="Uncompressed" value={formatBytes(inp.info.totalUncompressedSize)} />
                <Stat label="Compressed" value={formatBytes(inp.info.totalCompressedSize)} />
              </div>
              <Input
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
                aria-label="Search files"
              />
              <div className="rounded-md border">
                <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">
                  File entries ({filtered.length} of {inp.info.entries.length})
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {filtered.slice(0, 200).map((e, i) => {
                    const mime = detectImageMime(e.name);
                    const isImage = mime !== null;
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isImage ? (
                            <FileImage className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <span className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="truncate">{e.name}</span>
                          {e.isDirectory && <Badge variant="outline" className="text-[9px]">DIR</Badge>}
                          {e.isEncrypted && <Badge variant="outline" className="text-[9px] text-red-600 border-red-500/30">ENC</Badge>}
                        </div>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {formatBytes(e.uncompressedSize)}
                        </Badge>
                      </div>
                    );
                  })}
                  {filtered.length > 200 && (
                    <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">
                      ... and {filtered.length - 200} more
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && (
        <EmptyState
          title="Inspect CBR (RAR) comic books"
          hint="Detects RAR4 + RAR5 signatures, parses archive headers, lists all file entries (images counted as pages). Honest about extraction limitation — full RAR decompression requires WASM."
          icon={<BookOpen className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recently opened</Label>
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
                        {h.version.toUpperCase()} · {h.pageCount} page{h.pageCount === 1 ? "" : "s"} · {h.fileCount} file{h.fileCount === 1 ? "" : "s"} · {formatBytes(h.fileSize)} · {new Date(h.openedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all RAR signature detection and header parsing runs in your browser using pure JavaScript. File contents never leave your device. This tool parses archive headers and lists file entries — it does NOT extract file contents (RAR compression is proprietary and requires WASM). For full page rendering, convert your CBR to CBZ using a desktop tool. Only archive summaries (filename + entry count + RAR version) are saved to local history.
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
