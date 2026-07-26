"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseIso, isIsoImage, extractFile, buildFileTree,
  searchEntries, filterByType,
  computeStats, detectMimeFromName, previewFile,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildZipFromEntries,
  buildShareUrl,
  type IsoEntry, type IsoStats, type TreeNode, type IsoFilter,
  type IsoParseResult, type HistoryEntry,
} from "./logic";
import {
  Upload, Disc, Download, History, BarChart3, X, Eye,
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen, Search,
} from "lucide-react";

interface FullIsoData extends IsoParseResult {
  bytes: Uint8Array;
}

export default function IsoExtractor() {
  const [iso, setIso] = useState<FullIsoData | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<IsoFilter>("all");
  const [previewEntry, setPreviewEntry] = useState<IsoEntry | null>(null);
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
      if (!isIsoImage(bytes)) {
        setError(`${file.name}: not a valid ISO 9660 image (missing CD001 signature at sector 16).`);
        setIso(null);
        return;
      }
      const result = parseIso(bytes, file.name);
      setIso({ ...result, bytes });
      setHistory(saveToHistory({
        fileName: file.name,
        fileSize: result.fileSize,
        volumeId: result.pvd.volumeId,
        systemId: result.pvd.systemId,
        entryCount: result.stats.entryCount,
        hasJoliet: result.hasJoliet,
        extractedAt: new Date().toISOString(),
      }));
      toast.success(`Parsed ${result.stats.entryCount} entries from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setIso(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!iso) return [];
    return filterByType(searchEntries(iso.entries, search), filter);
  }, [iso, search, filter]);

  const filteredTree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const downloadEntry = useCallback((entry: IsoEntry) => {
    if (!iso) return;
    try {
      const data = extractFile(iso.bytes, entry);
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
  }, [iso]);

  const previewEntryData = useCallback((entry: IsoEntry) => {
    if (!iso) return;
    setPreviewEntry(entry);
    setPreviewData(null);
    try {
      const data = extractFile(iso.bytes, entry);
      setPreviewData(data);
    } catch (e) {
      toast.error((e as Error).message);
      setPreviewEntry(null);
    }
  }, [iso]);

  const downloadAllZip = useCallback(() => {
    if (!iso) return;
    try {
      const blob = buildZipFromEntries(iso.bytes, iso.entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${iso.fileName.replace(/\.iso$/i, "")}_extracted.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${iso.fileName.replace(/\.iso$/i, "")}_extracted.zip`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [iso]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".iso,application/x-iso9660-image,application/x-cd-image"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="iso-input"
            aria-label="Choose an .iso file"
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
            <p className="text-sm font-medium">Drop an .iso file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS ISO 9660 parser · PVD + directory records · Joliet support · file tree + extract</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing ISO image...
          </CardContent>
        </Card>
      )}

      {iso && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">{iso.fileName}</Label>
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
                    onClick={() => { setIso(null); setSearch(""); setFilter("all"); setPreviewEntry(null); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Entries" value={String(iso.stats.entryCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Files" value={String(iso.stats.fileCount)} />
                <Stat label="Dirs" value={String(iso.stats.directoryCount)} />
                <Stat label="Total size" value={formatBytes(iso.stats.totalFileSize)} accent />
                <Stat label="ISO size" value={formatBytes(iso.fileSize)} />
                <Stat label="Hidden" value={String(iso.stats.hiddenFileCount)} />
              </div>
              <div className="rounded-md border p-2 text-xs space-y-1">
                <p><span className="text-muted-foreground">Volume ID:</span> <span className="font-mono">{iso.pvd.volumeId}</span></p>
                <p><span className="text-muted-foreground">System ID:</span> <span className="font-mono">{iso.pvd.systemId}</span></p>
                <p><span className="text-muted-foreground">Application:</span> <span className="font-mono">{iso.pvd.applicationId}</span></p>
                <p><span className="text-muted-foreground">Created:</span> <span className="font-mono">{iso.pvd.creationDate || "(unknown)"}</span></p>
                <p><span className="text-muted-foreground">Block size:</span> <span className="font-mono">{iso.pvd.logicalBlockSize} bytes</span></p>
                <p><span className="text-muted-foreground">Joliet:</span> <span className="font-mono">{iso.hasJoliet ? "Yes (UTF-16 filenames)" : "No"}</span></p>
              </div>
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
                  onChange={(e) => setFilter(e.target.value as IsoFilter)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                  aria-label="Filter by type"
                >
                  <option value="all">All files</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="code">Code</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="archive">Archive</option>
                  <option value="executable">Executable</option>
                  <option value="document">Document</option>
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
                    <Badge variant="outline">{formatBytes(previewEntry.dataLength)}</Badge>
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

      {!iso && !error && !working && (
        <EmptyState
          title="Extract ISO 9660 disk images"
          hint="Pure-JS ISO 9660 parser. Parse Primary Volume Descriptor, walk the root directory recursively, extract individual files or all as ZIP. Supports Joliet (UTF-16) filenames. UDF (Blu-ray) is not supported."
          icon={<Disc className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recent ISOs</Label>
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
                        {h.volumeId} · {h.systemId} · {h.entryCount} entries · {formatBytes(h.fileSize)} · {new Date(h.extractedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all ISO parsing runs in your browser using pure JavaScript. File contents never leave your device.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <strong>Honesty clause:</strong> we parse ISO 9660 (with Joliet) but not UDF (Blu-ray). ISO 9660:1999 large-file extension is partially supported — files &gt;4GB may be reported with truncated sizes due to 32-bit fields.
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
  onDownload: (entry: IsoEntry) => void;
  onPreview: (entry: IsoEntry) => void;
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
                  <span className="text-[10px] text-muted-foreground">{formatBytes(entry.dataLength)}</span>
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
