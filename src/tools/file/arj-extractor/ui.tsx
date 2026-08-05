"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseArj, isArjFile, extractStoredEntry, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type ArjArchiveInfo, type ArjEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, AlertTriangle,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  info: ArjArchiveInfo;
  bytes: Uint8Array;
}

export default function ArjExtractor() {
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
        if (!isArjFile(bytes)) {
          setError(`${file.name}: not a valid ARJ file (missing 0x60 0xEA magic)`);
          continue;
        }
        const info = parseArj(bytes);
        newInputs.push({ fileName: file.name, size: file.size, info, bytes });
        setHistory(saveToHistory({
          fileName: file.name, fileSize: file.size,
          fileCount: info.fileCount,
          hasCompressedEntries: info.hasCompressedEntries,
          inspectedAt: new Date().toISOString(),
        }));
        toast.success(`Parsed ${file.name} — ${info.fileCount} file${info.fileCount === 1 ? "" : "s"}, ${info.hasCompressedEntries ? "has compressed entries" : "all stored"}`);
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const downloadEntry = useCallback((inp: InputFile, entry: ArjEntry) => {
    const data = extractStoredEntry(inp.bytes, entry);
    if (!data) {
      toast.error("Cannot extract — compressed entries (methods 1-4) are not supported");
      return;
    }
    const blob = new Blob([data as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.name.split("/").pop() ?? entry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Extracted ${entry.name}`);
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".arj,application/x-arj"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="arj-input"
            aria-label="Choose .arj files to inspect"
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
            <p className="text-sm font-medium">Drop .arj files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">ARJ magic detection · header parsing · file listing · stored-entry extraction</p>
          </button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Honesty clause — ARJ compression limitation</p>
              <p>
                ARJ methods 1-4 use proprietary dictionary-based compression. We CAN extract stored (method 0) files, but most ARJ files use method 1. For full extraction, use ARJ software (DOS/Windows) or WinARJ.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {inputs.map((inp, idx) => {
        const filtered = inp.info.entries.filter((e) =>
          e.name.toLowerCase().includes(search.toLowerCase()),
        );
        return (
          <Card key={idx}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileArchive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm font-medium truncate">{inp.fileName}</p>
                  <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                  {inp.info.hasCompressedEntries ? (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">Has compressed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">All stored</Badge>
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
              {inp.info.mainHeader && (
                <div className="rounded-md border p-2 text-[10px] font-mono bg-muted/30">
                  <div>Archiver version: <span className="text-foreground">0x{inp.info.mainHeader.archiverVersion.toString(16)}</span></div>
                  <div>Min version to extract: <span className="text-foreground">0x{inp.info.mainHeader.minVersionToExtract.toString(16)}</span></div>
                  <div>Host OS: <span className="text-foreground">{inp.info.mainHeader.hostOsName}</span></div>
                  <div>Archive flags: <span className="text-foreground">0x{inp.info.mainHeader.archiveFlags.toString(16)}</span></div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Files" value={String(inp.info.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Dirs" value={String(inp.info.directoryCount)} />
                <Stat label="Original" value={formatBytes(inp.info.totalOriginalSize)} />
                <Stat label="Compressed" value={formatBytes(inp.info.totalCompressedSize)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Methods used:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {inp.info.methods.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {m} = {["Stored", "Most compressed", "Compressed", "Fastest", "Fastest (no CRC)"][m] ?? "Unknown"}
                    </Badge>
                  ))}
                </div>
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
                  {filtered.slice(0, 200).map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{e.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {e.methodName} · CRC 0x{e.crc32.toString(16).padStart(8, "0")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{formatBytes(e.originalSize)}</Badge>
                      <button
                        type="button"
                        onClick={() => downloadEntry(inp, e)}
                        disabled={!e.isStored}
                        className="text-[10px] text-primary hover:underline cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {e.isStored ? "Extract" : "N/A"}
                      </button>
                    </div>
                  ))}
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
          title="Inspect ARJ archives"
          hint="Detects 0x60 0xEA magic, parses main header and per-file headers, lists entries with sizes/CRCs/methods, extracts stored (method 0) files. Honest about compression methods 1-4."
          icon={<FileArchive className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
            >
              <History className="h-3 w-3" /> History ({history.length})
            </button>
            <ShareButton getUrl={() => buildShareUrl()} label="Share" size="sm" />
          </div>
          {showHistory && (
            <>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.fileCount} file{h.fileCount === 1 ? "" : "s"} · {formatBytes(h.fileSize)} · {h.hasCompressedEntries ? "has compressed" : "all stored"} · {new Date(h.inspectedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer mt-1"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> all ARJ magic detection, header parsing, and stored-entry extraction runs in your browser using pure JavaScript. File contents never leave your device. This tool parses headers and extracts stored (method 0) files. Compression methods 1-4 (most ARJ files) are NOT supported — use ARJ software or WinARJ. Only archive summaries (filename + entry count) are saved to local history.
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
