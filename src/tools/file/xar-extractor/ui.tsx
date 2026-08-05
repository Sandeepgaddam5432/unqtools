"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseXar, isXarFile, computeStats, searchEntries, filterByType,
  buildFileTree, detectMimeFromName, decompressEntryData, createZipBlob,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type XarArchiveInfo, type XarStats, type XarEntry, type XarTypeFilter, type TreeNode, type HistoryEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, Search, Code2,
  Folder, File, AlertTriangle, FolderTree, ChevronDown, ChevronRight,
} from "lucide-react";

interface ArchiveData {
  fileName: string;
  size: number;
  bytes: Uint8Array;
  info: XarArchiveInfo;
  stats: XarStats;
}

export default function XarExtractor() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<XarTypeFilter>("all");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showTocXml, setShowTocXml] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    try {
      const ab = new Uint8Array(await file.arrayBuffer());
      if (!isXarFile(ab)) {
        setError(`${file.name}: not a valid XAR file (missing 'xar!' magic).`);
        setArchive(null);
        setWorking(false);
        return;
      }
      const info = await parseXar(ab);
      if (!info.isValid) {
        setError(info.error ?? `${file.name}: invalid XAR file.`);
        setArchive(null);
        setWorking(false);
        return;
      }
      const stats = computeStats(info.entries);
      setArchive({ fileName: file.name, size: ab.length, bytes: ab, info, stats });
      setHistory(saveToHistory({
        fileName: file.name,
        archiveSize: ab.length,
        fileCount: stats.fileCount,
        version: info.header?.version ?? 1,
        inspectedAt: new Date().toISOString(),
      }));
      toast.success(`Parsed ${stats.fileCount} files from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setArchive(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!archive) return [];
    return filterByType(searchEntries(archive.info.entries, search), filter);
  }, [archive, search, filter]);

  const tree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const downloadFile = useCallback(async (entry: XarEntry) => {
    if (!archive) return;
    if (!entry.isExtractable) {
      toast.error(`Cannot extract "${entry.name}": unsupported encoding (${entry.encoding}).`);
      return;
    }
    try {
      const data = await decompressEntryData(archive.bytes, entry);
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
      toast.error(`Failed to extract: ${(e as Error).message}`);
    }
  }, [archive]);

  const downloadAllAsZip = useCallback(async () => {
    if (!archive) return;
    const files: Array<{ name: string; data: Uint8Array }> = [];
    for (const entry of archive.info.entries) {
      if (!entry.isExtractable) continue;
      try {
        const data = await decompressEntryData(archive.bytes, entry);
        files.push({ name: entry.path, data });
      } catch {
        // skip on error
      }
    }
    if (files.length === 0) {
      toast.error("No extractable files to download.");
      return;
    }
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archive.fileName.replace(/\.xar$/i, "")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${files.length} files as ZIP`);
  }, [archive]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".xar,.pkg,application/x-xar"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="xar-input"
            aria-label="Choose a .xar file"
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
            <p className="text-sm font-medium">Drop a .xar file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Apple&apos;s XAR format · XML TOC + zlib heap · 100% local</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Parsing XAR archive…
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {archive && !working && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <FileArchive className="h-4 w-4" /> {archive.fileName}
                </Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadAllAsZip}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download all as ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTocXml(!showTocXml)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Code2 className="h-3.5 w-3.5" /> {showTocXml ? "Hide" : "View"} TOC XML
                  </button>
                  <ShareButton getUrl={() => buildShareUrl({ filter, search })} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Files" value={String(archive.stats.fileCount)} accent />
                <Stat label="Dirs" value={String(archive.stats.directoryCount)} />
                <Stat label="Total size" value={formatBytes(archive.stats.totalUncompressed)} />
                <Stat label="Compressed" value={formatBytes(archive.stats.totalCompressed)} />
                <Stat label="Ratio" value={formatRatio(archive.stats.ratio)} />
                <Stat label="Extractable" value={String(archive.stats.extractableCount)} />
              </div>
              {archive.info.header && (
                <div className="text-[10px] text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <span>Version: <span className="font-mono">{archive.info.header.version}</span></span>
                  <span>Checksum: <span className="font-mono">{archive.info.header.cksumName}</span></span>
                  <span>TOC compressed: <span className="font-mono">{formatBytes(archive.info.header.tocCompressedLength)}</span></span>
                  <span>TOC uncompressed: <span className="font-mono">{formatBytes(archive.info.header.tocUncompressedLength)}</span></span>
                </div>
              )}
              {archive.stats.unsupportedCount > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{archive.stats.unsupportedCount} file(s) use unsupported encoding (bzip2/LZMA). They will be listed but cannot be extracted.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {showTocXml && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">XML TOC (Table of Contents)</Label>
                <pre className="max-h-[400px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-[10px] font-mono whitespace-pre-wrap break-all">
                  {archive.info.tocXml || "(empty)"}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[180px] flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter by name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-xs"
                    aria-label="Filter entries"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as XarTypeFilter)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
                  aria-label="Filter by type"
                >
                  <option value="all">All</option>
                  <option value="file">Files</option>
                  <option value="directory">Directories</option>
                  <option value="symlink">Symlinks</option>
                </select>
                <Badge variant="outline" className="text-[10px]">{filteredEntries.length} shown</Badge>
              </div>

              <div className="max-h-[500px] overflow-y-auto rounded-md border border-border p-2 text-xs">
                {tree.children.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No entries match your filter.</p>
                ) : (
                  tree.children.map((child) => (
                    <TreeRow
                      key={child.path}
                      node={child}
                      depth={0}
                      expanded={expanded}
                      toggleExpand={toggleExpand}
                      onDownload={downloadFile}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!archive && !error && !working && (
        <EmptyState
          title="Open a XAR archive"
          hint="Apple's XAR format with XML TOC + zlib heap. We parse the header, decompress the TOC, and let you preview, extract individual files, or re-package as ZIP."
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
                <Label className="text-xs font-semibold">Recently inspected</Label>
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
                        {h.fileCount} files · {formatBytes(h.archiveSize)} · v{h.version} · {new Date(h.inspectedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all XAR parsing and decompression runs in your browser. File contents never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TreeRow({
  node, depth, expanded, toggleExpand, onDownload,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (path: string) => void;
  onDownload: (entry: XarEntry) => void;
}) {
  const isExpanded = expanded.has(node.path);
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-1 py-1 hover:bg-accent/40 rounded-sm cursor-pointer"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={() => node.isDirectory && toggleExpand(node.path)}
        role={node.isDirectory ? "treeitem" : "row"}
        aria-expanded={node.isDirectory ? isExpanded : undefined}
      >
        {node.isDirectory ? (
          <button
            type="button"
            className="flex items-center gap-1 cursor-pointer"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Folder className="h-3.5 w-3.5 text-amber-500" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="w-3" />
            <File className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {node.entry && !node.isDirectory && (
          <>
            <span className="text-[10px] text-muted-foreground font-mono">{formatBytes(node.entry.size)}</span>
            {node.entry.isExtractable ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDownload(node.entry!); }}
                className="text-[10px] text-primary hover:underline cursor-pointer"
                aria-label={`Download ${node.name}`}
              >
                <Download className="h-3 w-3" />
              </button>
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-500" aria-label="Unsupported encoding" />
            )}
          </>
        )}
      </div>
      {node.isDirectory && isExpanded && node.children.map((child) => (
        <TreeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onDownload={onDownload}
        />
      ))}
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
