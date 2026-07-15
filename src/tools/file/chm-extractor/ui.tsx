"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  parseChm, isChmFile, extractUncompressedFile, buildFileTree,
  searchEntries, filterByType, classifyChmFile,
  computeStats, detectMimeFromName, previewFile,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  type ChmEntry, type ChmStats, type TreeNode, type ChmFilter,
  type ChmParseResult, type HistoryEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, Eye,
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen, Search,
  HelpCircle, FileCode, Image as ImageIcon, AlertTriangle,
} from "lucide-react";

interface FullChmData extends ChmParseResult {
  bytes: Uint8Array;
}

export default function ChmExtractor() {
  const [chm, setChm] = useState<FullChmData | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChmFilter>("all");
  const [previewEntry, setPreviewEntry] = useState<ChmEntry | null>(null);
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
      if (!isChmFile(bytes)) {
        setError(`${file.name}: not a valid CHM file (missing ITSF signature).`);
        setChm(null);
        return;
      }
      const result = parseChm(bytes, file.name);
      setChm({ ...result, bytes });
      setHistory(saveToHistory({
        fileName: file.name,
        fileSize: result.fileSize,
        packageName: result.itsf.packageName || "(unknown)",
        version: result.itsf.version,
        entryCount: result.stats.entryCount,
        inspectedAt: new Date().toISOString(),
      }));
      toast.success(`Parsed ${result.stats.entryCount} entries from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setChm(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!chm) return [];
    return filterByType(searchEntries(chm.entries, search), filter);
  }, [chm, search, filter]);

  const filteredTree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const downloadEntry = useCallback(async (entry: ChmEntry) => {
    if (!chm) return;
    try {
      const data = extractUncompressedFile(chm.bytes, entry, chm.contentOffset);
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
  }, [chm]);

  const previewEntryData = useCallback(async (entry: ChmEntry) => {
    if (!chm) return;
    setPreviewEntry(entry);
    setPreviewData(null);
    try {
      const data = extractUncompressedFile(chm.bytes, entry, chm.contentOffset);
      setPreviewData(data);
    } catch (e) {
      toast.error((e as Error).message);
      setPreviewEntry(null);
    }
  }, [chm]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".chm,application/vnd.ms-htmlhelp,application/x-chm"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="chm-input"
            aria-label="Choose a .chm file"
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
            <p className="text-sm font-medium">Drop a .chm file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS ITSF + ITSP + PMGL parser · file tree · HTML/CSS/images listing · extract uncompressed files</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing CHM file...
          </CardContent>
        </Card>
      )}

      {chm && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">{chm.fileName}</Label>
                <button
                  type="button"
                  onClick={() => { setChm(null); setSearch(""); setFilter("all"); setPreviewEntry(null); }}
                  className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Entries" value={String(chm.stats.entryCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="HTML" value={String(chm.stats.htmlCount)} icon={<FileCode className="h-3 w-3" />} />
                <Stat label="Images" value={String(chm.stats.imageCount)} icon={<ImageIcon className="h-3 w-3" />} />
                <Stat label="CSS" value={String(chm.stats.cssCount)} />
                <Stat label="Uncompressed" value={String(chm.stats.uncompressedFileCount)} accent />
                <Stat label="Total size" value={formatBytes(chm.stats.totalUncompressedSize)} />
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <Badge variant="outline">ITSF v{chm.itsf.version}</Badge>
                <Badge variant="outline">Package: {chm.itsf.packageName || "(unknown)"}</Badge>
                <Badge variant="outline">Chunk size: {chm.itsp.directoryChunkSize}</Badge>
                <Badge variant="outline">Chunks: {chm.itsp.chunkCount}</Badge>
              </div>
              {chm.stats.executableCount > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ {chm.stats.executableCount} executable file(s) detected. Do not run them — they may contain malware.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Honesty clause:</strong> most CHM content is LZX-compressed (sections 1+). We can list all files but only extract files in the uncompressed section (section 0). For full LZX extraction, use 7-Zip on desktop.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Filter & search</Label>
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
                  onChange={(e) => setFilter(e.target.value as ChmFilter)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                  aria-label="Filter by type"
                >
                  <option value="all">All files</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="javascript">JavaScript</option>
                  <option value="image">Images</option>
                  <option value="metadata">Metadata</option>
                  <option value="executable">Executables</option>
                </select>
              </div>
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

      {previewEntry && previewData && (
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
            {(() => {
              const preview = previewFile(previewData);
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <Badge variant="outline">{formatBytes(previewEntry.length)}</Badge>
                    <Badge variant="outline">{detectMimeFromName(previewEntry.name)}</Badge>
                    {preview.truncated && <Badge variant="outline">truncated to {formatBytes(preview.previewSize)}</Badge>}
                  </div>
                  <pre className="text-[10px] font-mono bg-muted/30 rounded p-2 max-h-[300px] overflow-auto whitespace-pre-wrap break-all">
                    {preview.isText ? preview.text : preview.hex}
                  </pre>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!chm && !error && !working && (
        <EmptyState
          title="Inspect Microsoft CHM files"
          hint="Pure-JS ITSF + ITSP + PMGL parser. List all files in a Compiled HTML Help archive — HTML, CSS, images, index, table of contents. LZX-compressed content cannot be extracted (use 7-Zip on desktop for full extraction)."
          icon={<HelpCircle className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recent CHMs</Label>
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
                        {h.packageName} · v{h.version} · {h.entryCount} entries · {formatBytes(h.fileSize)}
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
            <strong className="text-foreground">Privacy:</strong> all CHM parsing runs in your browser using pure JavaScript. File metadata never leaves your device.
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
  onDownload: (entry: ChmEntry) => void;
  onPreview: (entry: ChmEntry) => void;
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
                  {entry && (
                    <Badge variant="outline" className="text-[9px] ml-1 flex-shrink-0">
                      {entry.fileType}
                    </Badge>
                  )}
                </div>
              )}
              {!child.isDirectory && entry && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{formatBytes(entry.length)}</span>
                  {entry.isUncompressed ? (
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
                  ) : (
                    <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400">LZX</Badge>
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
