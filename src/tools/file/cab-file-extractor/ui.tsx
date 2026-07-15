"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  isCabArchive, parseCab, extractCabFile,
  computeStats, searchFiles, filterFiles, detectMimeFromName,
  formatBytes, formatFatDateTime,
  buildZipFromCab,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type CabInfo, type CabStats, type CabFile, type CabFilter, type HistoryEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3,
  Search, Folder, AlertTriangle,
} from "lucide-react";

interface ArchiveData {
  fileName: string;
  size: number;
  bytes: Uint8Array;
  info: CabInfo;
  stats: CabStats;
}

export default function CabFileExtractor() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CabFilter>("all");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    file.arrayBuffer().then((buf) => {
      const ab = new Uint8Array(buf);
      if (!isCabArchive(ab)) {
        setError(`${file.name}: not a CAB file (missing 'MSCF' signature).`);
        setArchive(null);
        setWorking(false);
        return;
      }
      const info = parseCab(ab);
      if (!info.isValid) {
        setError(info.error ?? `${file.name}: invalid CAB file.`);
        setArchive(null);
        setWorking(false);
        return;
      }
      const stats = computeStats(info, ab.length);
      setArchive({ fileName: file.name, size: ab.length, bytes: ab, info, stats });
      setHistory(saveToHistory({
        fileName: file.name,
        archiveSize: ab.length,
        fileCount: stats.fileCount,
        folderCount: stats.folderCount,
        storedFileCount: stats.storedFileCount,
        inspectedAt: new Date().toISOString(),
      }));
      setWorking(false);
      toast.success(`Parsed ${stats.fileCount} files from ${file.name}`);
    }).catch((e) => {
      setError(`${file.name}: ${(e as Error).message}`);
      setArchive(null);
      setWorking(false);
    });
  }, []);

  const filteredFiles = useMemo(() => {
    if (!archive) return [];
    return filterFiles(searchFiles(archive.info.files, search), filter);
  }, [archive, search, filter]);

  const downloadFile = useCallback((file: CabFile) => {
    if (!archive) return;
    const result = extractCabFile(archive.bytes, file, archive.info);
    if (!result) {
      toast.error("Cannot extract — compressed entries are not supported");
      return;
    }
    const mime = detectMimeFromName(file.name);
    const blob = new Blob([result.bytes as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.split(/[\\/]/).pop() ?? file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${file.name}`);
  }, [archive]);

  const downloadAllZip = useCallback(() => {
    if (!archive) return;
    const blob = buildZipFromCab(archive.bytes, archive.info);
    if (blob.size === 0) {
      toast.error("No extractable (stored) files in this CAB.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archive.fileName.replace(/\.cab$/i, "")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${archive.fileName.replace(/\.cab$/i, "")}.zip`);
  }, [archive]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".cab,application/vnd.ms-cab-compressed,application/x-cab"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="cab-input"
            aria-label="Choose a .cab file"
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
            <p className="text-sm font-medium">Drop a .cab file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS MSCF parser · stored files extractable · ZIP download</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing CAB file…
          </CardContent>
        </Card>
      )}

      {archive && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">{archive.fileName}</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadAllZip}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download stored as ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => { setArchive(null); setSearch(""); setFilter("all"); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Files" value={String(archive.stats.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Folders" value={String(archive.stats.folderCount)} />
                <Stat label="Stored" value={String(archive.stats.storedFileCount)} accent={archive.stats.storedFileCount > 0} />
                <Stat label="Compressed" value={String(archive.stats.compressedFileCount)} />
                <Stat label="Total" value={formatBytes(archive.stats.totalUncompressedSize)} accent />
                <Stat label="Archive" value={formatBytes(archive.size)} />
              </div>
              {archive.stats.hasMultiVolume && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ This is a multi-volume CAB set. Only the current cabinet is parsed — use 7-Zip or expand.exe for full extraction.
                </p>
              )}
              {archive.stats.compressedFileCount > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ {archive.stats.compressedFileCount} file(s) use MSZIP/LZX/Quantum compression. Their metadata is shown but extraction is not supported in pure JS.
                </p>
              )}
            </CardContent>
          </Card>

          {archive.info.folders.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5" /> Folders
                </Label>
                <div className="space-y-1">
                  {archive.info.folders.map((f, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                      <span className="font-mono">Folder #{i}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{f.compression}</Badge>
                      <Badge variant="outline" className="text-[10px]">{f.cCFData} blocks</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">@{f.coffCabStart}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Files</Label>
                <ShareButton getUrl={() => buildShareUrl({ search, filter })} label="Share view" size="sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search files…"
                    className="pl-7"
                    aria-label="Search files"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as CabFilter)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                  aria-label="Filter files"
                >
                  <option value="all">All files</option>
                  <option value="stored">Stored only</option>
                  <option value="compressed">Compressed only</option>
                  <option value="readonly">Read-only</option>
                  <option value="hidden">Hidden</option>
                  <option value="system">System</option>
                </select>
              </div>
              <p className="text-[10px] text-muted-foreground">{filteredFiles.length} file{filteredFiles.length === 1 ? "" : "s"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="max-h-[400px] overflow-y-auto rounded-md border">
                {filteredFiles.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No matching files.</p>
                ) : (
                  filteredFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs px-3 py-2 border-b border-border/40 last:border-0 hover:bg-accent/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFatDateTime(f.date, f.time)} · folder #{f.iFolder}
                          {f.attrFlags.length > 0 && ` · ${f.attrFlags.join(", ")}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">{formatBytes(f.size)}</Badge>
                      <button
                        type="button"
                        onClick={() => downloadFile(f)}
                        disabled={!f.isExtractable}
                        className="p-1 rounded hover:bg-accent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Download ${f.name}`}
                        title={f.isExtractable ? "Download" : "Compressed — not extractable"}
                      >
                        {f.isExtractable ? <Download className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!archive && !error && !working && (
        <EmptyState
          title="Extract .cab files"
          hint="Pure-JS MSCF parser — no WASM. Stored (uncompressed) files are fully extractable. MSZIP/LZX/Quantum-compressed files show metadata only — use 7-Zip for those."
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
                <Label className="text-xs font-semibold">Recent .cab files</Label>
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
                        {h.fileCount} files · {h.folderCount} folders · {h.storedFileCount} stored · {formatBytes(h.archiveSize)} · {new Date(h.inspectedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all CAB parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries are saved to local history.
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
