"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseZipEntries, decompressEntry, isZipArchive, isEmptyZip,
  buildFileTree, searchEntries, filterByExtension, listExtensions,
  computeStats, previewFile, detectMimeFromName,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, buildZipFromEntries,
  type ZipEntry, type ZipStats, type TreeNode, type ExtensionFilter,
  type HistoryEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, Eye,
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen, Search,
} from "lucide-react";

interface ArchiveData {
  fileName: string;
  size: number;
  bytes: Uint8Array;
  entries: ZipEntry[];
  stats: ZipStats;
}

export default function ZipExtractor() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ExtensionFilter>("all");
  const [previewEntry, setPreviewEntry] = useState<ZipEntry | null>(null);
  const [previewData, setPreviewData] = useState<Uint8Array | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isZipArchive(bytes) && !isEmptyZip(bytes)) {
        setError(`${file.name}: not a ZIP archive (missing PK\\x03\\x04 signature).`);
        setArchive(null);
        return;
      }
      if (isEmptyZip(bytes)) {
        setError(`${file.name}: ZIP archive is empty (no entries).`);
        setArchive(null);
        return;
      }
      const entries = parseZipEntries(bytes);
      if (entries.length === 0) {
        setError(`${file.name}: could not parse any entries from this ZIP.`);
        setArchive(null);
        return;
      }
      const stats = computeStats(entries);
      setArchive({ fileName: file.name, size: bytes.length, bytes, entries, stats });
      setHistory(saveToHistory({
        fileName: file.name,
        archiveSize: bytes.length,
        entryCount: stats.entryCount,
        regularFileCount: stats.regularFileCount,
        totalUncompressed: stats.totalUncompressed,
        extractedAt: new Date().toISOString(),
      }));
      toast.success(`Parsed ${stats.entryCount} entries from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setArchive(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!archive) return [];
    return filterByExtension(searchEntries(archive.entries, search), filter);
  }, [archive, search, filter]);

  const filteredTree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const extensions = useMemo(() => (archive ? listExtensions(archive.entries) : []), [archive]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const downloadEntry = useCallback(async (entry: ZipEntry) => {
    if (!archive) return;
    try {
      const data = await decompressEntry(entry);
      const mime = detectMimeFromName(entry.name);
      const blob = new Blob([data as BlobPart], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.name.split("/").pop() ?? entry.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${entry.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [archive]);

  const previewEntryData = useCallback(async (entry: ZipEntry) => {
    if (!archive) return;
    setPreviewEntry(entry);
    setPreviewData(null);
    try {
      if (!entry.isExtractable) {
        throw new Error(entry.isEncrypted
          ? "Cannot preview encrypted entry."
          : `Unsupported compression method ${entry.compressionMethod} (${entry.compressionName}).`);
      }
      const data = await decompressEntry(entry);
      setPreviewData(data);
    } catch (e) {
      toast.error((e as Error).message);
      setPreviewEntry(null);
    }
  }, [archive]);

  const downloadAllZip = useCallback(async () => {
    if (!archive) return;
    try {
      const blob = await buildZipFromEntries(archive.entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${archive.fileName.replace(/\.zip$/i, "")}_extracted.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${archive.fileName.replace(/\.zip$/i, "")}_extracted.zip`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [archive]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="zip-input"
            aria-label="Choose a .zip file"
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
            <p className="text-sm font-medium">Drop a .zip file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS ZIP parser · STORE + DEFLATE · no WASM · file tree · preview · re-zip</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing ZIP archive...
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
                    <Download className="h-3.5 w-3.5" /> Download all as ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => { setArchive(null); setSearch(""); setFilter("all"); setPreviewEntry(null); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Entries" value={String(archive.stats.entryCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Files" value={String(archive.stats.regularFileCount)} />
                <Stat label="Dirs" value={String(archive.stats.directoryCount)} />
                <Stat label="Compressed" value={formatBytes(archive.stats.totalCompressed)} />
                <Stat label="Uncompressed" value={formatBytes(archive.stats.totalUncompressed)} accent />
                <Stat label="Ratio" value={formatRatio(archive.stats.ratio)} />
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <Badge variant="outline">STORE: {archive.stats.storeCount}</Badge>
                <Badge variant="outline">DEFLATE: {archive.stats.deflateCount}</Badge>
                {archive.stats.encryptedCount > 0 && (
                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400">Encrypted: {archive.stats.encryptedCount}</Badge>
                )}
              </div>
              {archive.stats.encryptedCount > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ {archive.stats.encryptedCount} encrypted entr{archive.stats.encryptedCount === 1 ? "y is" : "ies are"} present and cannot be extracted. Password-protected ZIPs are not supported.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Filter & search</Label>
                <ShareButton getUrl={() => buildShareUrl({ filter, search })} label="Share view" size="sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by filename..."
                    className="pl-7"
                    aria-label="Search entries"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as ExtensionFilter)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                  aria-label="Filter by extension"
                >
                  <option value="all">All types</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="code">Code</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="archive">Archive</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {extensions.length > 0 && filter === "all" && (
                <div className="flex flex-wrap gap-1">
                  {extensions.slice(0, 10).map(({ ext, count }) => (
                    <Badge key={ext} variant="outline" className="text-[10px]">{ext}: {count}</Badge>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">{filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"} match</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">File tree</Label>
              <div className="max-h-[500px] overflow-y-auto rounded-md border">
                {filteredTree.children.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No matching entries.</p>
                ) : (
                  <TreeView
                    node={filteredTree}
                    expandedPaths={expandedPaths}
                    togglePath={togglePath}
                    onDownload={downloadEntry}
                    onPreview={previewEntryData}
                    depth={0}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {previewEntry && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Preview: {previewEntry.name}</Label>
              <button
                type="button"
                onClick={() => { setPreviewEntry(null); setPreviewData(null); }}
                className="p-1 rounded-md hover:bg-accent cursor-pointer"
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {previewData ? (
              (() => {
                const preview = previewFile(previewData);
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <Badge variant="outline">{formatBytes(previewEntry.uncompressedSize)}</Badge>
                      <Badge variant="outline">{detectMimeFromName(previewEntry.name)}</Badge>
                      <Badge variant="outline">{previewEntry.compressionName}</Badge>
                      {preview.truncated && <Badge variant="outline">truncated to {formatBytes(preview.previewSize)}</Badge>}
                    </div>
                    <pre className="text-[10px] font-mono bg-muted/30 rounded p-2 max-h-[300px] overflow-auto whitespace-pre-wrap break-all">
                      {preview.isText ? preview.text : preview.hex}
                    </pre>
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-muted-foreground">Loading preview...</p>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!archive && !error && !working && (
        <EmptyState
          title="Extract ZIP archives"
          hint="Pure-JS ZIP parser supporting STORE + DEFLATE (via DecompressionStream). File tree, search, filter, preview, re-zip. Password-protected ZIPs are not supported."
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
                <Label className="text-xs font-semibold">Recent archives</Label>
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
                        {h.entryCount} entries ({h.regularFileCount} files) · {formatBytes(h.totalUncompressed)} · {formatBytes(h.archiveSize)} · {new Date(h.extractedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all ZIP parsing runs in your browser using pure JavaScript + the native DecompressionStream API. File contents never leave your device.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <strong>Honesty clause:</strong> password-protected ZIPs are not supported (no AES/ZipCrypto). ZIP64 (&gt;4GB) is partially supported — central directory 64-bit fields are not yet parsed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TreeView({
  node, expandedPaths, togglePath, onDownload, onPreview, depth,
}: {
  node: TreeNode;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  onDownload: (entry: ZipEntry) => void;
  onPreview: (entry: ZipEntry) => void;
  depth: number;
}) {
  return (
    <div>
      {node.children.map((child) => {
        const isExpanded = expandedPaths.has(child.path);
        const entry = child.entry;
        return (
          <div key={child.path}>
            <div
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent/50 text-xs border-b border-border/30 last:border-0"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {child.isDirectory ? (
                <button
                  type="button"
                  onClick={() => togglePath(child.path)}
                  className="flex items-center gap-1 min-w-0 flex-1 text-left cursor-pointer"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                  {isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" /> : <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                  <span className="truncate">{child.name}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{child.name}</span>
                </div>
              )}
              {!child.isDirectory && entry && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{formatBytes(entry.uncompressedSize)}</span>
                  <Badge variant="outline" className="text-[9px]">{entry.compressionName}</Badge>
                  {entry.isExtractable && (
                    <>
                      <button
                        type="button"
                        onClick={() => onPreview(entry)}
                        className="p-0.5 rounded hover:bg-accent cursor-pointer"
                        aria-label={`Preview ${child.name}`}
                        title="Preview"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownload(entry)}
                        className="p-0.5 rounded hover:bg-accent cursor-pointer"
                        aria-label={`Download ${child.name}`}
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {child.isDirectory && isExpanded && (
              <TreeView
                node={child}
                expandedPaths={expandedPaths}
                togglePath={togglePath}
                onDownload={onDownload}
                onPreview={onPreview}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
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
